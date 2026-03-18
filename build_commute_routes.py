"""
Build commute race routes for 3 time periods:
  - weekday     (AM Peak)
  - midday      (Weekday Midday)
  - weekend     (Saturday)

For each period, we:
  1. Load the parquet and compute per-DA average transit travel time to Downtown
  2. Compute a speed_factor = car_avg / transit_avg (capped)
  3. Fetch real OSRM roads for the top 15 worst transit DAs (shared across periods)
  4. Write commute_routes_{period}.geojson with per-route speed_factor
"""

import json
import time
import urllib.request
import numpy as np
import pandas as pd

DOWNTOWN_DA = '48110083'  # Closest DA UID to City Hall
DOWNTOWN = [-113.4938, 53.5445]
OSRM_BASE = "http://router.project-osrm.org/route/v1"
LATERAL_OFFSET = 0.0010

PERIODS = {
    'weekday': 'public/data/travel_times_weekday.parquet',
    'midday':  'public/data/travel_times_weekday_midday.parquet',
    'weekend': 'public/data/travel_times_saturday.parquet',
}

# ── 1. Load penalty GeoJSON for DA centroids ─────────────────────────────────
print("Loading DA centroids from transit_penalty.geojson...")
geojson = json.load(open('public/data/transit_penalty.geojson'))

da_centroids: dict[str, tuple[float, float]] = {}
for f in geojson['features']:
    da = f['properties'].get('DAUID', '')
    geom = f['geometry']
    if not geom:
        continue
    try:
        ring = geom['coordinates'][0] if geom['type'] == 'Polygon' else geom['coordinates'][0][0]
        lons = [c[0] for c in ring]; lats = [c[1] for c in ring]
        da_centroids[da] = (sum(lons)/len(lons), sum(lats)/len(lats))
    except Exception:
        continue

# ── 2. Identify top-15 worst DAs using weekday peak as the master list ───────
print("Identifying top-15 worst-penalty DAs (using weekday peak)...")
df_peak = pd.read_parquet(PERIODS['weekday'])

# Filter trips going TO downtown, exclude self-loops
downtown_trips = df_peak[(df_peak['to_id'] == DOWNTOWN_DA) & (df_peak['from_id'] != DOWNTOWN_DA)]
avg_by_da = downtown_trips.groupby('from_id')['travel_time'].mean()
# Car baseline: assume ~15 min average drive to downtown
CAR_AVG_MINS = 22.0
penalty_by_da = ((avg_by_da - CAR_AVG_MINS) / avg_by_da).clip(0, 1)
top15_das = penalty_by_da.nlargest(15).index.tolist()
print(f"  Top 15 DAs: {top15_das[:5]}...")

# ── 3. Fetch OSRM car routes (done once — roads don't change by time period) ─
print("\nFetching OSRM car routes (once for all periods)...")

def fetch_osrm(origin_lon, origin_lat, dest_lon, dest_lat, profile='driving'):
    url = f"{OSRM_BASE}/{profile}/{origin_lon},{origin_lat};{dest_lon},{dest_lat}?geometries=geojson&overview=full"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'ETSJobsViz/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            r = json.loads(resp.read().decode())
            if r.get('code') == 'Ok':
                return r['routes'][0]['geometry']['coordinates']
    except Exception as e:
        print(f"    OSRM error: {e}")
    return None

def offset_line(coords, offset=LATERAL_OFFSET):
    shifted = []
    for i, (lon, lat) in enumerate(coords):
        dx = (coords[i+1][0] - lon) if i < len(coords)-1 else (lon - coords[i-1][0])
        dy = (coords[i+1][1] - lat) if i < len(coords)-1 else (lat - coords[i-1][1])
        length = max((dx**2 + dy**2)**0.5, 1e-10)
        shifted.append([lon + (-dy/length)*offset, lat + (dx/length)*offset])
    return shifted

car_routes: dict[str, list] = {}
for da in top15_das:
    if da not in da_centroids:
        print(f"  Skipping {da} — no centroid")
        continue
    cx, cy = da_centroids[da]
    coords = fetch_osrm(cx, cy, DOWNTOWN[0], DOWNTOWN[1])
    car_routes[da] = coords if coords else [[cx, cy], DOWNTOWN]
    print(f"  Routed {da}: {len(car_routes[da])} waypoints")
    time.sleep(0.4)

# ── 4. Build GeoJSON for each time period ────────────────────────────────────
for period_name, parquet_path in PERIODS.items():
    print(f"\n--- Building {period_name} ---")
    df = pd.read_parquet(parquet_path)
    downtown_to = df[(df['to_id'] == DOWNTOWN_DA) & (df['from_id'] != DOWNTOWN_DA)]
    transit_avg = downtown_to.groupby('from_id')['travel_time'].mean()

    features = []
    for da in top15_das:
        if da not in car_routes:
            continue
        car_coords = car_routes[da]
        transit_coords = offset_line(car_coords)

        # Speed factor: how much slower is transit vs car
        transit_time = transit_avg.get(da, np.nan)
        if pd.isna(transit_time) or transit_time <= 0:
            transit_time = CAR_AVG_MINS * 2.5  # fallback
        raw_factor = CAR_AVG_MINS / transit_time  # <1 means transit is slower
        speed_factor = float(np.clip(raw_factor, 0.2, 1.0))

        features.append({
            "type": "Feature",
            "properties": {"DAUID": da, "mode": "car", "period": period_name,
                           "speed_factor": 1.0, "transit_mins": round(float(transit_time), 1)},
            "geometry": {"type": "LineString", "coordinates": car_coords}
        })
        features.append({
            "type": "Feature",
            "properties": {"DAUID": da, "mode": "transit", "period": period_name,
                           "speed_factor": speed_factor, "transit_mins": round(float(transit_time), 1)},
            "geometry": {"type": "LineString", "coordinates": transit_coords}
        })
        print(f"  DA {da}: transit={transit_time:.1f}min, speed_factor={speed_factor:.2f}")

    out_path = f"public/data/commute_routes_{period_name}.geojson"
    with open(out_path, 'w') as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)
    print(f"  ✅ Wrote {len(features)} routes to {out_path}")

print("\n🏁 All 3 time periods complete.")
