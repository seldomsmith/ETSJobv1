import json
import time
import urllib.request
import numpy as np

print("--- Building Real Road-Network Commute Routes via OSRM ---")

DOWNTOWN = [-113.4938, 53.5445]
OSRM_BASE = "http://router.project-osrm.org/route/v1"

data = json.load(open('public/data/transit_penalty.geojson'))

# Extract top 15 highest-penalty DA centroids
scored = []
for f in data['features']:
    props = f['properties']
    geom = f['geometry']
    score = props.get('penalty_score', 0)
    da = props.get('DAUID', '')
    if not geom or score <= 0.3:
        continue
    try:
        if geom['type'] == 'Polygon':
            ring = geom['coordinates'][0]
        elif geom['type'] == 'MultiPolygon':
            ring = geom['coordinates'][0][0]
        else:
            continue
        lons = [c[0] for c in ring]
        lats = [c[1] for c in ring]
        cx = sum(lons) / len(lons)
        cy = sum(lats) / len(lats)
        scored.append((score, da, cx, cy))
    except Exception:
        continue

scored.sort(reverse=True)
top15 = scored[:15]

def fetch_route(origin_lon, origin_lat, dest_lon, dest_lat, profile='driving'):
    """Fetch real road-network route from OSRM."""
    url = (
        f"{OSRM_BASE}/{profile}/"
        f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        f"?geometries=geojson&overview=full"
    )
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'ETSJobsViz/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            result = json.loads(resp.read().decode())
            if result.get('code') == 'Ok':
                return result['routes'][0]['geometry']['coordinates']
    except Exception as e:
        print(f"  OSRM error ({profile}): {e}")
    return None

def offset_line(coords, offset_deg=0.0008):
    """Shift a line laterally by offset_deg to create a parallel lane."""
    shifted = []
    for i, (lon, lat) in enumerate(coords):
        if i < len(coords) - 1:
            dx = coords[i+1][0] - lon
            dy = coords[i+1][1] - lat
        else:
            dx = lon - coords[i-1][0]
            dy = lat - coords[i-1][1]
        length = max((dx**2 + dy**2)**0.5, 1e-10)
        perp_lon = -dy / length * offset_deg
        perp_lat = dx / length * offset_deg
        shifted.append([lon + perp_lon, lat + perp_lat])
    return shifted

features = []
successful = 0

for penalty_score, da, cx, cy in top15:
    print(f"  Routing DA {da} (score={penalty_score:.3f}) from [{cx:.4f}, {cy:.4f}]...")

    # Car route: driving profile on real roads
    car_coords = fetch_route(cx, cy, DOWNTOWN[0], DOWNTOWN[1], 'driving')
    time.sleep(0.3)  # be polite to public API

    if car_coords is None:
        # Fallback to straight line
        car_coords = [[cx, cy], DOWNTOWN]
        print(f"    Using straight-line fallback for car route")

    # Transit route: also uses driving roads for now (representative geometry)
    # Offset laterally to look like a parallel lane
    transit_coords = offset_line(car_coords, offset_deg=0.0010)
    time.sleep(0.3)

    speed_factor = 1.0 / (1.0 + penalty_score * 1.5)

    features.append({
        "type": "Feature",
        "properties": {
            "DAUID": da,
            "mode": "car",
            "penalty_score": penalty_score,
            "speed_factor": 1.0,
            "total_coords": len(car_coords)
        },
        "geometry": {"type": "LineString", "coordinates": car_coords}
    })

    features.append({
        "type": "Feature",
        "properties": {
            "DAUID": da,
            "mode": "transit",
            "penalty_score": penalty_score,
            "speed_factor": speed_factor,
            "total_coords": len(transit_coords)
        },
        "geometry": {"type": "LineString", "coordinates": transit_coords}
    })
    successful += 1

out = {"type": "FeatureCollection", "features": features}
with open('public/data/commute_routes.geojson', 'w') as f:
    json.dump(out, f)

print(f"\n✅ Done! Generated {successful} road-network route pairs ({len(features)} total lines).")
print("Saved to public/data/commute_routes.geojson")
