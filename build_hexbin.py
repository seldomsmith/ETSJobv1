import pandas as pd
import json
import numpy as np
import os

print("--- Starting Time-Decay Hexbin Processing ---")

# 1. Load job values from job_centers.geojson
f = open('public/data/job_centers.geojson')
data = json.load(f)
jobs_dict = {}
coords_dict = {}

for feat in data['features']:
    props = feat['properties']
    da = str(props['DAUID']).split('.')[0]
    total = props.get('total_jobs', 0)
    jobs_dict[da] = jobs_dict.get(da, 0) + total
    if feat['geometry']['type'] == 'Point':
        coords_dict[da] = feat['geometry']['coordinates']

# 2. Load Parquet Travel Time Matrix
df = pd.read_parquet('public/data/travel_times_weekday.parquet')
df['from_id'] = df['from_id'].astype(str).str.split('.').str[0]
df['to_id'] = df['to_id'].astype(str).str.split('.').str[0]

df_sub = df[df['travel_time'] <= 30].copy()

# Add Job count to each destination
df_sub['jobs'] = df_sub['to_id'].map(jobs_dict).fillna(0)

# ⏳ Apply Time-Decay Weighting: 
# Let 5 mins = 1.0 weight, and 20 mins = 0.5 weight.
# Formula: weight = 1.0 - (travel_time - 5) / 30.0
df_sub['weight'] = 1.0 - (df_sub['travel_time'] - 5) / 30.0
df_sub['weight'] = df_sub['weight'].clip(0, 1.0) # clamp between 0 and 1.0

# Calculate weighted score
df_sub['weighted_jobs'] = df_sub['jobs'] * df_sub['weight']

# Sum reachable weighted jobs per originating DAUID
agg = df_sub.groupby('from_id')['weighted_jobs'].sum().reset_index()

# 3. Create Hexagon features for every origin DA node
hex_features = []
size_deg = 0.0016  

for _, row in agg.iterrows():
    da = row['from_id']
    if da not in coords_dict:
        continue
        
    reachable_jobs = int(row['weighted_jobs'])
    if reachable_jobs <= 100: # filter very low to reduce rendering noise
        continue 
        
    lon, lat = coords_dict[da]
    hex_coords = []
    for i in range(6):
        angle = np.deg2rad(60 * i)
        dx = size_deg * np.cos(angle)
        dy = size_deg * np.sin(angle) / 1.5 
        hex_coords.append([lon + dx, lat + dy])
    
    hex_coords.append(hex_coords[0])
    hex_features.append({
        "type": "Feature",
        "properties": { "DAUID": da, "accessible_jobs": reachable_jobs },
        "geometry": { "type": "Polygon", "coordinates": [hex_coords] }
    })

out = { "type": "FeatureCollection", "features": hex_features }
with open('public/data/hex_accessibility.geojson', 'w') as out_f:
    json.dump(out, out_f)

print(f"Successfully generated {len(hex_features)} decay-weighted hexagons.")
