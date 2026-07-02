import json
import math
import os

def haversine(lon1, lat1, lon2, lat2):
    R = 6371000
    phi_1 = math.radians(lat1)
    phi_2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi_1) * math.cos(phi_2) * \
        math.sin(delta_lambda / 2.0) ** 2
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def build_isochrones():
    print("--- Starting Job Transit Buffer Scoring ---")
    
    # Load Stops
    stops_path = os.path.join("public", "data", "stops_with_jobs.geojson")
    if not os.path.exists(stops_path):
        print(f"Error: {stops_path} not found. Run build_bus_stops.py first.")
        return
        
    with open(stops_path, "r", encoding="utf-8") as f:
        stops_data = json.load(f)
        
    stops = []
    for feat in stops_data.get("features", []):
        geom = feat.get("geometry", {})
        if geom.get("type") == "Point":
            stops.append(geom["coordinates"])
            
    print(f"Loaded {len(stops)} stops.")

    # Load Jobs
    jobs_path = os.path.join("public", "data", "ets_at_work_leads.geojson")
    if not os.path.exists(jobs_path):
        print(f"Error: {jobs_path} not found.")
        return
        
    with open(jobs_path, "r", encoding="utf-8") as f:
        jobs_data = json.load(f)

    print("Scoring jobs based on distance to nearest stop...")
    stranded_jobs = []
    
    features = jobs_data.get("features", [])
    for i, feat in enumerate(features):
        geom = feat.get("geometry", {})
        if geom.get("type") != "Point":
            continue
            
        jlon, jlat = geom["coordinates"]
        
        min_dist = float('inf')
        for slon, slat in stops:
            # fast bbox prune
            if abs(slon - jlon) > 0.05 or abs(slat - jlat) > 0.05:
                continue
            dist = haversine(jlon, jlat, slon, slat)
            if dist < min_dist:
                min_dist = dist
                
        # Scoring: 400m = 1.0, 600m = 0.5, 800m = 0.1, > 800m = 0.0
        score = 0.0
        if min_dist <= 400:
            score = 1.0
        elif min_dist <= 600:
            score = 0.5
        elif min_dist <= 800:
            score = 0.1
            
        feat["properties"]["nearest_stop_dist"] = round(min_dist, 1)
        feat["properties"]["transit_buffer_score"] = score
        
        if score < 1.0:
            stranded_jobs.append(feat)
            
        if (i+1) % 1000 == 0:
            print(f"Processed {i+1}/{len(features)} jobs...")

    out_path = os.path.join("public", "data", "stranded_jobs.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": stranded_jobs}, f)
        
    print(f"Wrote {len(stranded_jobs)} stranded or underserved jobs to {out_path}.")
    print("--- Done ---")

if __name__ == "__main__":
    build_isochrones()
