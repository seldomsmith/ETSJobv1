"""
build_a_day_in_edmonton.py
---------------------------
Parses Edmonton Transit GTFS schedule for a full Wednesday (24 hours),
interpolates vehicle positions every 20 seconds along actual shape geometries,
and exports an ultra-lean trajectory JSON dataset with route, headsign, stop milestones,
and vehicle hardware type classifications to public/data/ets_day_simulation.json.

Category IDs:
  0: Bus (Navy Blue #0F172A / Night Cyan-Blue)
  1: Valley Line LRT (Green #10B981)
  2: Capital Line LRT (Blue #2563EB)
  3: Metro Line LRT (Red #EF4444)
  4: Regional Routes (Orange #F97316)
"""

import os
import io
import csv
import math
import json
import zipfile
import urllib.request
from collections import defaultdict
from datetime import datetime

GTFS_URL = "https://gtfs.edmonton.ca/TMGTFSRealTimeWebService/GTFS/gtfs.zip"
TMP_DIR = os.path.join(os.path.dirname(__file__), ".tmp-gtfs")
CACHE_ZIP = os.path.join(TMP_DIR, "gtfs.zip")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "public", "data", "ets_day_simulation.json")

def ensure_gtfs():
    os.makedirs(TMP_DIR, exist_ok=True)
    if not os.path.exists(CACHE_ZIP) or os.path.getsize(CACHE_ZIP) == 0:
        print(f"Downloading GTFS feed from {GTFS_URL}...")
        req = urllib.request.Request(GTFS_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(CACHE_ZIP, "wb") as f:
            f.write(resp.read())
        print("GTFS download complete.")
    else:
        print(f"Using cached GTFS from {CACHE_ZIP}")

def parse_time_to_seconds(t_str):
    if not t_str:
        return 0
    parts = t_str.strip().split(":")
    if len(parts) == 3:
        h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
        return h * 3600 + m * 60 + s
    return 0

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def get_route_info(route_id, route_short, route_long, route_type):
    rid = route_id.strip()
    rtype = str(route_type).strip()
    rshort = (route_short or "").strip()
    rlong = (route_long or "").strip()
    rshort_lower = rshort.lower()
    rlong_lower = rlong.lower()

    # Strictly classify LRT routes (route_type 0 and matching exact line names)
    if rid == "023R" or (rtype == "0" and (rshort_lower == "valley" or rlong_lower == "valley line")):
        return 1, "Valley Line LRT", "Bombardier Flexity Freedom (2-Car Train)"
    if rid == "021R" or (rtype == "0" and (rshort_lower == "capital" or rlong_lower == "capital line")):
        return 2, "Capital Line LRT", "Siemens SD-160 / U2 (5-Car High-Floor Train)"
    if rid == "022R" or (rtype == "0" and (rshort_lower == "metro" or rlong_lower == "metro line")):
        return 3, "Metro Line LRT", "Siemens SD-160 (3-Car High-Floor Train)"
    
    # Regional routes
    if rid in ["540", "560", "747"] or rid.startswith("F") or "regional" in rlong_lower or "airport" in rlong_lower:
        return 4, f"Regional Express {rshort}", "Grande West Vicinity / Nova LFS Regional Coach"
    
    # Exclude DATS and on-demand
    if "dats" in rlong_lower or "on demand" in rlong_lower or "ondemand" in rlong_lower:
        return -1, "", ""
        
    return 0, f"Route {rshort}", "ETS 40ft Clean Diesel / Hybrid Low-Floor Bus"

def build_simulation():
    ensure_gtfs()
    
    with zipfile.ZipFile(CACHE_ZIP, "r") as z:
        print("Finding representative Wednesday service IDs...")
        services_by_date = defaultdict(set)
        for r in csv.DictReader(io.StringIO(z.open("calendar_dates.txt").read().decode("utf-8-sig"))):
            if r["exception_type"] == "1":
                services_by_date[r["date"]].add(r["service_id"])
        
        best_date = None
        max_svcs = 0
        for d_str, s_set in services_by_date.items():
            try:
                dt = datetime.strptime(d_str, "%Y%m%d")
                if dt.weekday() == 2:
                    if len(s_set) > max_svcs:
                        max_svcs = len(s_set)
                        best_date = d_str
            except Exception:
                pass
        
        active_services = services_by_date[best_date]
        print(f"Using Wednesday date {best_date} with {len(active_services)} active services.")

        print("Parsing routes.txt...")
        routes = {}
        for r in csv.DictReader(io.StringIO(z.open("routes.txt").read().decode("utf-8-sig"))):
            cat, line_title, vtype = get_route_info(r["route_id"], r.get("route_short_name", ""), r.get("route_long_name", ""), r.get("route_type", ""))
            routes[r["route_id"]] = {
                "cat": cat,
                "short": r.get("route_short_name", ""),
                "long": r.get("route_long_name", ""),
                "title": line_title,
                "vtype": vtype
            }

        print("Parsing trips.txt...")
        wed_trips = {}
        for r in csv.DictReader(io.StringIO(z.open("trips.txt").read().decode("utf-8-sig"))):
            if r["service_id"] in active_services:
                route_id = r["route_id"]
                rdata = routes.get(route_id, {})
                cat = rdata.get("cat", 0)
                if cat != -1:
                    wed_trips[r["trip_id"]] = {
                        "route_id": route_id,
                        "shape_id": r.get("shape_id", ""),
                        "cat": cat,
                        "headsign": r.get("trip_headsign", "")
                    }
        print(f"Total active Wednesday trips to process: {len(wed_trips)}")

        print("Parsing stops.txt...")
        stops = {}
        stop_names = {}
        for r in csv.DictReader(io.StringIO(z.open("stops.txt").read().decode("utf-8-sig"))):
            stops[r["stop_id"]] = (float(r["stop_lat"]), float(r["stop_lon"]))
            stop_names[r["stop_id"]] = r.get("stop_name", "").strip()

        print("Parsing shapes.txt...")
        shapes_raw = defaultdict(list)
        for r in csv.DictReader(io.StringIO(z.open("shapes.txt").read().decode("utf-8-sig"))):
            shapes_raw[r["shape_id"]].append((
                int(r["shape_pt_sequence"]),
                float(r["shape_pt_lat"]),
                float(r["shape_pt_lon"])
            ))

        shapes = {}
        for shape_id, pts in shapes_raw.items():
            pts.sort(key=lambda p: p[0])
            coords = []
            cum_dist = [0.0]
            total = 0.0
            for i, p in enumerate(pts):
                coords.append((p[1], p[2]))
                if i > 0:
                    d = haversine_m(pts[i-1][1], pts[i-1][2], p[1], p[2])
                    total += d
                    cum_dist.append(total)
            shapes[shape_id] = {
                "coords": coords,
                "cum_dist": cum_dist,
                "total_dist": total
            }
        print(f"Indexed {len(shapes)} shapes.")

        print("Parsing stop_times.txt for active trips...")
        trip_stop_times = defaultdict(list)
        for r in csv.DictReader(io.StringIO(z.open("stop_times.txt").read().decode("utf-8-sig"))):
            tid = r["trip_id"]
            if tid in wed_trips:
                dep_sec = parse_time_to_seconds(r["departure_time"])
                arr_sec = parse_time_to_seconds(r["arrival_time"])
                seq = int(r["stop_sequence"])
                stop_id = r["stop_id"]
                trip_stop_times[tid].append((seq, arr_sec, dep_sec, stop_id))

        print(f"Loaded stop schedules for {len(trip_stop_times)} trips.")

    print("Interpolating vehicle trajectories at 20-second sample interval...")
    SAMPLE_INTERVAL = 20
    MAX_DAY_SEC = 24 * 3600

    trajectories = []
    category_counts = defaultdict(int)

    for trip_id, stop_list in trip_stop_times.items():
        if len(stop_list) < 2:
            continue
        stop_list.sort(key=lambda x: x[0])
        trip_meta = wed_trips[trip_id]
        cat = trip_meta["cat"]
        shape_id = trip_meta["shape_id"]
        shape_data = shapes.get(shape_id)
        route_id = trip_meta["route_id"]

        first_dep = stop_list[0][2]
        last_arr = stop_list[-1][1]

        if last_arr <= first_dep or first_dep >= MAX_DAY_SEC:
            continue

        start_tick = (first_dep // SAMPLE_INTERVAL) * SAMPLE_INTERVAL
        end_tick = math.ceil(last_arr / SAMPLE_INTERVAL) * SAMPLE_INTERVAL

        milestones = []
        stop_schedule = []
        for seq, arr_s, dep_s, stop_id in stop_list:
            if stop_id in stops:
                lat, lon = stops[stop_id]
                sname = stop_names.get(stop_id, f"Stop {stop_id}")
                milestones.append((arr_s, dep_s, lat, lon))
                stop_schedule.append((arr_s, sname))
        
        if len(milestones) < 2:
            continue

        shape_mapped = False
        shape_milestones = []
        if shape_data and len(shape_data["coords"]) > 1:
            shape_coords = shape_data["coords"]
            shape_cum = shape_data["cum_dist"]
            curr_idx = 0
            for arr_s, dep_s, slat, slon in milestones:
                best_idx = curr_idx
                best_d = float("inf")
                # Search forward along the full shape polyline (never capped)
                for s_i in range(curr_idx, len(shape_coords)):
                    d = haversine_m(slat, slon, shape_coords[s_i][0], shape_coords[s_i][1])
                    if d < best_d:
                        best_d = d
                        best_idx = s_i
                    elif d > best_d + 800 and s_i > curr_idx + 20:
                        # Local minimum passed with safe buffer
                        pass
                curr_idx = best_idx
                shape_milestones.append((arr_s, dep_s, shape_cum[best_idx]))
            shape_mapped = True

        sampled_points = []
        curr_m_idx = 0

        for t in range(start_tick, end_tick + 1, SAMPLE_INTERVAL):
            if t > MAX_DAY_SEC + 3600:
                break

            while curr_m_idx < len(milestones) - 2 and t >= milestones[curr_m_idx + 1][1]:
                curr_m_idx += 1
            
            m_curr = milestones[curr_m_idx]
            m_next = milestones[curr_m_idx + 1]

            t_start = m_curr[1]
            t_end = m_next[0]

            if t <= t_start:
                lat, lon = m_curr[2], m_curr[3]
            elif t >= t_end:
                lat, lon = m_next[2], m_next[3]
            else:
                fraction = (t - t_start) / max(1, (t_end - t_start))
                fraction = max(0.0, min(1.0, fraction))

                if shape_mapped and len(shape_milestones) > curr_m_idx + 1:
                    dist_start = shape_milestones[curr_m_idx][2]
                    dist_end = shape_milestones[curr_m_idx + 1][2]
                    target_dist = dist_start + fraction * (dist_end - dist_start)

                    shape_coords = shape_data["coords"]
                    shape_cum = shape_data["cum_dist"]
                    low = 0
                    high = len(shape_cum) - 1
                    while low <= high:
                        mid = (low + high) // 2
                        if shape_cum[mid] < target_dist:
                            low = mid + 1
                        else:
                            high = mid - 1
                    
                    idx_pt = max(0, min(len(shape_coords) - 2, high))
                    d0 = shape_cum[idx_pt]
                    d1 = shape_cum[idx_pt + 1]
                    seg_frac = (target_dist - d0) / max(1.0, (d1 - d0))
                    seg_frac = max(0.0, min(1.0, seg_frac))

                    lat = shape_coords[idx_pt][0] + seg_frac * (shape_coords[idx_pt + 1][0] - shape_coords[idx_pt][0])
                    lon = shape_coords[idx_pt][1] + seg_frac * (shape_coords[idx_pt + 1][1] - shape_coords[idx_pt][1])
                else:
                    lat = m_curr[2] + fraction * (m_next[2] - m_curr[2])
                    lon = m_curr[3] + fraction * (m_next[3] - m_curr[3])

            sampled_points.append([round(lon, 5), round(lat, 5)])

        if len(sampled_points) > 1:
            # Subsample stops schedule to key milestones to keep JSON lightweight
            # (e.g. up to 10 milestone stops evenly spaced)
            if len(stop_schedule) > 12:
                step = len(stop_schedule) // 10
                compact_stops = [stop_schedule[0]] + [stop_schedule[i] for i in range(step, len(stop_schedule) - 1, step)] + [stop_schedule[-1]]
            else:
                compact_stops = stop_schedule

            trajectories.append({
                "c": cat,
                "r": route_id,
                "h": trip_meta["headsign"] or routes.get(route_id, {}).get("long", ""),
                "s": start_tick,
                "pts": sampled_points,
                "st": compact_stops
            })
            category_counts[cat] += 1

    print("\nSimulation Compilation Summary:")
    print(f"Total Active Trajectories: {len(trajectories)}")
    print(f"  - Buses (Navy): {category_counts[0]}")
    print(f"  - Valley Line LRT (Green): {category_counts[1]}")
    print(f"  - Capital Line LRT (Blue): {category_counts[2]}")
    print(f"  - Metro Line LRT (Red): {category_counts[3]}")
    print(f"  - Regional (Orange): {category_counts[4]}")

    payload = {
        "interval": SAMPLE_INTERVAL,
        "date": best_date,
        "day": "Wednesday",
        "totalTrips": len(trajectories),
        "routes": routes,
        "trajectories": trajectories
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    print(f"Writing dataset to {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))
    
    file_size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"Successfully generated {OUTPUT_PATH} ({file_size_mb:.2f} MB)")

if __name__ == "__main__":
    build_simulation()
