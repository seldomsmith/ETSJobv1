import json
import numpy as np

print("--- Building Commute Race Routes ---")

# Downtown Edmonton destination (City Hall centroid)
DOWNTOWN = [-113.4938, 53.5445]
LATERAL_OFFSET = 0.003  # degrees offset for parallel transit lane

data = json.load(open('public/data/transit_penalty.geojson'))

# Extract features with a real penalty score and geometry
scored = []
for f in data['features']:
    props = f['properties']
    geom = f['geometry']
    score = props.get('penalty_score', 0)
    da = props.get('DAUID', '')
    if not geom or score <= 0.3:
        continue
    # Get a representative centroid point from the polygon
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

# Take top 15 worst penalty DAs
scored.sort(reverse=True)
top15 = scored[:15]
print(f"Selected {len(top15)} high-penalty corridors")

features = []
for penalty_score, da, cx, cy in top15:
    # Car route: straight line from origin to downtown
    car_line = {
        "type": "Feature",
        "properties": {
            "DAUID": da,
            "mode": "car",
            "penalty_score": penalty_score,
            # Car speed factor is 1.0 (fastest)
            "speed_factor": 1.0
        },
        "geometry": {
            "type": "LineString",
            "coordinates": [[cx, cy], DOWNTOWN]
        }
    }

    # Transit route: laterally offset to sit parallel alongside the car lane
    # Offset perpendicular to the route direction
    dx = DOWNTOWN[0] - cx
    dy = DOWNTOWN[1] - cy
    length = (dx**2 + dy**2) ** 0.5
    perp_x = -dy / length * LATERAL_OFFSET
    perp_y = dx / length * LATERAL_OFFSET

    transit_line = {
        "type": "Feature",
        "properties": {
            "DAUID": da,
            "mode": "transit",
            "penalty_score": penalty_score,
            # Transit is slower by the penalty factor (e.g. 1.0 + penalty_score as multiplier)
            "speed_factor": 1.0 / (1.0 + penalty_score * 1.5)
        },
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [cx + perp_x, cy + perp_y],
                [DOWNTOWN[0] + perp_x, DOWNTOWN[1] + perp_y]
            ]
        }
    }

    features.append(car_line)
    features.append(transit_line)

out = {"type": "FeatureCollection", "features": features}
with open('public/data/commute_routes.geojson', 'w') as f:
    json.dump(out, f)

print(f"Wrote {len(features)} route lines ({len(top15)} car + {len(top15)} transit) to commute_routes.geojson")
