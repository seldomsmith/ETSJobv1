import json
import math
import os

def haversine(lon1, lat1, lon2, lat2):
    R = 6371000  # radius of Earth in meters
    phi_1 = math.radians(lat1)
    phi_2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi_1) * math.cos(phi_2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def get_job_count(size_str):
    mapping = {
        "5-9": 7,
        "10-19": 15,
        "20-99": 60,
        "100-499": 300,
        "500+": 500
    }
    return mapping.get(size_str, 1)

def generate_hex_polygon(center_lon, center_lat, size_deg):
    """Generate 6 vertices for a flat-topped hexagon."""
    coords = []
    for i in range(6):
        angle = math.radians(60 * i)
        # scale y by approx cos(lat) to account for projection distortion locally
        dx = size_deg * math.cos(angle)
        dy = size_deg * math.sin(angle) * 0.6  # Edmonton latitude adjustment
        coords.append([center_lon + dx, center_lat + dy])
    coords.append(coords[0])  # Close polygon
    return coords

def build_hexbins():
    print("--- Starting True Hexbin Generation ---")
    
    # Edmonton Approximate Bounding Box
    MIN_LON, MAX_LON = -113.75, -113.25
    MIN_LAT, MAX_LAT = 53.38, 53.68
    
    # Size parameter (degrees)
    # 0.005 is roughly ~300-400m width
    SIZE = 0.006
    
    # Generate Hex Grid Centers
    # Flat topped hexagons:
    # width = 2 * SIZE, horiz spacing = 3 * SIZE / 2
    # height = sqrt(3) * SIZE, vert spacing = sqrt(3) * SIZE (with y adjustment)
    hex_centers = []
    
    w_step = 1.5 * SIZE
    h_step = math.sqrt(3) * SIZE * 0.6 # lat adjustment
    
    col = 0
    curr_lon = MIN_LON
    while curr_lon <= MAX_LON:
        row = 0
        curr_lat = MIN_LAT
        # offset every other column
        if col % 2 == 1:
            curr_lat += h_step / 2.0
            
        while curr_lat <= MAX_LAT:
            hex_centers.append({
                "id": f"hex_{col}_{row}",
                "lon": curr_lon,
                "lat": curr_lat,
                "jobs": 0,
                "stops": 0
            })
            curr_lat += h_step
            row += 1
            
        curr_lon += w_step
        col += 1

    print(f"Generated {len(hex_centers)} hexbins. Loading data...")

    # Load Jobs
    jobs_path = os.path.join("public", "data", "ets_at_work_leads.geojson")
    if os.path.exists(jobs_path):
        with open(jobs_path, "r", encoding="utf-8") as f:
            jobs_data = json.load(f)
            for feat in jobs_data.get("features", []):
                geom = feat.get("geometry", {})
                if geom.get("type") == "Point":
                    jlon, jlat = geom["coordinates"]
                    # Find nearest hexbin center
                    # Simple heuristic: filter by bbox, then distance
                    min_dist = float('inf')
                    best_hex = None
                    for h in hex_centers:
                        if abs(h["lon"] - jlon) < SIZE * 2 and abs(h["lat"] - jlat) < SIZE * 2:
                            dist = (h["lon"] - jlon)**2 + (h["lat"] - jlat)**2
                            if dist < min_dist:
                                min_dist = dist
                                best_hex = h
                    if best_hex:
                        size_str = feat.get('properties', {}).get('size', '')
                        best_hex["jobs"] += get_job_count(size_str)
    else:
        print(f"Warning: {jobs_path} not found.")

    # Load Stops
    stops_path = os.path.join("public", "data", "stops_with_jobs.geojson")
    if os.path.exists(stops_path):
        with open(stops_path, "r", encoding="utf-8") as f:
            stops_data = json.load(f)
            for feat in stops_data.get("features", []):
                geom = feat.get("geometry", {})
                if geom.get("type") == "Point":
                    slon, slat = geom["coordinates"]
                    min_dist = float('inf')
                    best_hex = None
                    for h in hex_centers:
                        if abs(h["lon"] - slon) < SIZE * 2 and abs(h["lat"] - slat) < SIZE * 2:
                            dist = (h["lon"] - slon)**2 + (h["lat"] - slat)**2
                            if dist < min_dist:
                                min_dist = dist
                                best_hex = h
                    if best_hex:
                        best_hex["stops"] += 1
    else:
        print(f"Warning: {stops_path} not found. Run build_bus_stops.py first.")

    print("Building GeoJSON features...")
    features = []
    for h in hex_centers:
        # Filter empty hexes to save rendering time
        if h["jobs"] == 0 and h["stops"] == 0:
            continue
            
        gap_score = h["jobs"] if h["stops"] == 0 else (h["jobs"] / (h["stops"] * 5.0))
        
        polygon = generate_hex_polygon(h["lon"], h["lat"], SIZE)
        features.append({
            "type": "Feature",
            "properties": {
                "hex_id": h["id"],
                "jobs": h["jobs"],
                "stops": h["stops"],
                "gap_score": round(gap_score, 2)
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [polygon]
            }
        })

    out_path = os.path.join("public", "data", "hexbin_transit_gaps.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)

    print(f"Wrote {len(features)} active hexbins to {out_path}.")
    print("--- Done ---")

if __name__ == "__main__":
    build_hexbins()
