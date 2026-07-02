import json
import math
import urllib.request
import zipfile
import io
import os
import csv

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

def build_bus_stops():
    print("Downloading Edmonton GTFS feed...")
    url = "https://gtfs.edmonton.ca/TMGTFSRealTimeWebService/GTFS/gtfs.zip"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        response = urllib.request.urlopen(req)
        zip_data = response.read()
    except Exception as e:
        print(f"Failed to download GTFS feed: {e}")
        return

    print("Extracting stops.txt...")
    stops = []
    with zipfile.ZipFile(io.BytesIO(zip_data)) as gtfs_zip:
        if 'stops.txt' in gtfs_zip.namelist():
            with gtfs_zip.open('stops.txt') as stops_file:
                reader = csv.DictReader(io.TextIOWrapper(stops_file, 'utf-8-sig'))
                for row in reader:
                    stops.append({
                        'stop_id': row['stop_id'],
                        'stop_name': row.get('stop_name', ''),
                        'stop_lat': float(row['stop_lat']),
                        'stop_lon': float(row['stop_lon'])
                    })
        else:
            print("stops.txt not found in GTFS zip.")
            return
            
    print(f"Parsed {len(stops)} stops.")

    jobs_path = os.path.join("public", "data", "ets_at_work_leads.geojson")
    if not os.path.exists(jobs_path):
        print(f"Jobs data not found at {jobs_path}")
        return
        
    print("Loading jobs data...")
    with open(jobs_path, "r", encoding="utf-8") as f:
        jobs_data = json.load(f)
        
    features = jobs_data.get("features", [])
    print(f"Loaded {len(features)} job features.")
    
    print("Calculating jobs within 400m of each stop...")
    # To optimize, we won't calculate everything against everything naively if it's too slow,
    # but for ~7000 stops and a few thousand jobs, ~14M iterations is fine in python (few seconds).
    
    stops_geojson = {
        "type": "FeatureCollection",
        "features": []
    }
    
    for i, stop in enumerate(stops):
        jobs_within_400m = 0
        slat = stop['stop_lat']
        slon = stop['stop_lon']
        
        for feat in features:
            geom = feat.get('geometry')
            if not geom or geom.get('type') != 'Point':
                continue
            coords = geom.get('coordinates')
            if not coords or len(coords) < 2:
                continue
            
            jlon, jlat = coords[0], coords[1]
            # quick bounding box check
            if abs(slat - jlat) > 0.01 or abs(slon - jlon) > 0.01:
                continue
                
            dist = haversine(slon, slat, jlon, jlat)
            if dist <= 400:
                size_str = feat.get('properties', {}).get('size', '')
                jobs_within_400m += get_job_count(size_str)
                
        stops_geojson["features"].append({
            "type": "Feature",
            "properties": {
                "stop_id": stop["stop_id"],
                "stop_name": stop["stop_name"],
                "jobs_within_400m": jobs_within_400m
            },
            "geometry": {
                "type": "Point",
                "coordinates": [stop["stop_lon"], stop["stop_lat"]]
            }
        })
        
        if (i+1) % 1000 == 0:
            print(f"Processed {i+1} / {len(stops)} stops...")
            
    out_path = os.path.join("public", "data", "stops_with_jobs.geojson")
    print(f"Writing {out_path}...")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(stops_geojson, f)
        
    print("Done!")

if __name__ == "__main__":
    build_bus_stops()
