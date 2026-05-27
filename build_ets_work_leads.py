"""
build_ets_work_leads.py
- Processes the raw Edmonton Business Census CSV
- Filters for eligible ETS@Work businesses (10+ employees)
- Maps each business to the nearest Census DAUID (Dissemination Area) centroid
- Associates transit penalty scores and calculates target priority tiers
- Outputs an optimized public/data/ets_at_work_leads.geojson file
"""

import os
import json
import numpy as np
import pandas as pd

print("--- Starting ETS@Work Target Lead Data Pipeline ---")

# Paths
CENSUS_CSV_PATH = "../../Edmonton_Business_Census_20260521.csv"
PENALTY_GEOJSON_PATH = "public/data/transit_penalty.geojson"
GRID_GEOJSON_PATH = "public/data/transit_penalty_grid.geojson"
OUTPUT_GEOJSON_PATH = "public/data/ets_at_work_leads.geojson"

# Verify files exist
if not os.path.exists(CENSUS_CSV_PATH):
    raise FileNotFoundError(f"Missing census CSV file: {CENSUS_CSV_PATH}")
if not os.path.exists(PENALTY_GEOJSON_PATH):
    raise FileNotFoundError(f"Missing transit penalty file: {PENALTY_GEOJSON_PATH}")
if not os.path.exists(GRID_GEOJSON_PATH):
    raise FileNotFoundError(f"Missing penalty grid file: {GRID_GEOJSON_PATH}")

# 1. Load DA centroids from transit_penalty.geojson
print("Loading DA centroids...")
with open(PENALTY_GEOJSON_PATH, "r") as f:
    penalty_geojson = json.load(f)

da_centroids = {}
for feat in penalty_geojson["features"]:
    da = str(feat["properties"].get("DAUID", ""))
    geom = feat.get("geometry")
    if not da or not geom:
        continue
    try:
        # Pull coordinates of the ring and compute mean as centroid
        ring = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
        lons = [c[0] for c in ring]
        lats = [c[1] for c in ring]
        da_centroids[da] = (sum(lons) / len(lons), sum(lats) / len(lats))
    except Exception:
        continue

print(f"  Loaded {len(da_centroids)} DA centroids successfully.")

# Convert to numpy arrays for vectorized fast nearest-neighbor matching
da_uids = list(da_centroids.keys())
da_coords = np.array([da_centroids[uid] for uid in da_uids]) # dimensions: (num_das, 2)

# 2. Load Transit Penalty Grid scores
print("Loading penalty grid scores...")
with open(GRID_GEOJSON_PATH, "r") as f:
    grid_geojson = json.load(f)

da_penalties = {}
for feat in grid_geojson["features"]:
    props = feat["properties"]
    da = str(props.get("DAUID", ""))
    if da:
        da_penalties[da] = {
            "penalty_weekday": props.get("penalty_weekday"),
            "penalty_midday": props.get("penalty_midday"),
            "penalty_weekend": props.get("penalty_weekend"),
            "penalty_avg": props.get("penalty_avg")
        }

print(f"  Loaded penalty scores for {len(da_penalties)} DAs.")

# 3. Read and normalize Edmonton Business Census
print("Loading and cleaning Edmonton Business Census (this may take a few seconds)...")
df = pd.read_csv(CENSUS_CSV_PATH)
print(f"  Loaded {len(df)} total businesses.")

# Drop rows missing coordinates
df = df.dropna(subset=["Longitude", "Latitude"])

# Normalize sizes (replace en-dashes, strip spaces, convert <10 to 5-9)
df["Business Size"] = df["Business Size"].astype(str).str.replace("<10", "5-9").str.replace("–", "-").str.replace("—", "-").str.strip()

# Filter for eligible sizes (5+ employees)
valid_sizes = ["5-9", "10-19", "20-99", "100-499", "500+"]
df_filtered = df[df["Business Size"].isin(valid_sizes)].copy()
print(f"  Filtered to {len(df_filtered)} eligible businesses (size >= 5).")

# 4. Map businesses to nearest DA using fast vectorized NumPy math
print("Mapping businesses to nearest transit dissemination areas (DAs)...")
biz_coords = df_filtered[["Longitude", "Latitude"]].values # dimensions: (num_biz, 2)

# Compute Euclidean distance matrix using numpy broadcasting
# (num_biz, 1, 2) - (1, num_das, 2) -> (num_biz, num_das, 2)
# Sum squared differences along the last axis to get squared Euclidean distance
distances_sq = np.sum((biz_coords[:, np.newaxis, :] - da_coords[np.newaxis, :, :]) ** 2, axis=2)
closest_indices = np.argmin(distances_sq, axis=1)

# Assign closest DAUID and centroid coordinates to each business
df_filtered["DAUID"] = [da_uids[idx] for idx in closest_indices]

# 5. Attach transit penalty scores, lead scores, and priority tiers
print("Calculating lead scores and priority tiers...")

def compute_tier_and_scores(row):
    da = row["DAUID"]
    size = row["Business Size"]
    hybrid = str(row["Hybrid Work"]).strip().lower() == "yes"
    
    # Get penalties (default to high penalty if not found)
    penalties = da_penalties.get(da, {
        "penalty_weekday": 0.8,
        "penalty_midday": 0.8,
        "penalty_weekend": 0.8,
        "penalty_avg": 0.8
    })
    
    p_avg = penalties["penalty_avg"] if penalties["penalty_avg"] is not None else 0.8
    
    # Size multiplier weight
    size_weights = {
        "5-9": 0.5,
        "10-19": 1.0,
        "20-99": 2.5,
        "100-499": 6.0,
        "500+": 12.0
    }
    s_weight = size_weights.get(size, 1.0)
    
    # Transit Suitability Score (higher score = better transit accessibility)
    # Range is roughly 0.0 (catastrophic) to 1.0 (perfect)
    transit_score = round(max(0.0, 1.0 - p_avg), 3)
    
    # Lead Priority Score: Combines transit score, size weight, and hybrid penalty
    # (Hybrid companies are weighted slightly lower since fewer employees commute daily)
    hybrid_mult = 0.7 if hybrid else 1.0
    lead_score = round(transit_score * s_weight * hybrid_mult, 3)
    
    # Balanced Tier classification for actionable B2B targeting
    if (size in ["100-499", "500+"] and transit_score >= 0.4) or (size == "20-99" and transit_score >= 0.7):
        tier = 1 # Prime Target (Large with decent transit, or Mid-sized with superb transit)
    elif (size in ["100-499", "500+"]) or (size == "20-99" and transit_score >= 0.4) or (size == "10-19" and transit_score >= 0.7):
        tier = 2 # Good Target (Large in transit deserts, Mid-sized with decent transit, or Small/Very Small with superb transit)
    else:
        tier = 3 # Low/Challenging Target (Mostly small/mid businesses in poor transit areas)
        
    return pd.Series([transit_score, lead_score, tier, penalties["penalty_weekday"], penalties["penalty_avg"]])

df_filtered[["Transit_Score", "Lead_Score", "Tier", "Penalty_Weekday", "Penalty_Avg"]] = df_filtered.apply(compute_tier_and_scores, axis=1)

# Sort by Lead Score descending
df_filtered = df_filtered.sort_values(by="Lead_Score", ascending=False)

# Print tier summary
print("\nLead Tiering Summary:")
print(df_filtered["Tier"].value_counts())

# 6. Generate optimized GeoJSON
print("\nExporting target leads to GeoJSON...")
features = []

# To keep Mapbox extremely performant, we export key columns and round coordinates
for _, row in df_filtered.iterrows():
    # Coordinates rounded to 6 decimal places (~10cm precision) to save file space
    lon = round(float(row["Longitude"]), 6)
    lat = round(float(row["Latitude"]), 6)
    
    feat = {
        "type": "Feature",
        "properties": {
            "name": str(row["Business Name"]),
            "size": str(row["Business Size"]),
            "address": str(row["Business Address"]) if not pd.isna(row["Business Address"]) else "",
            "sector": str(row["Sectors"]) if not pd.isna(row["Sectors"]) else "",
            "naics_desc": str(row["NAICS Description"]) if not pd.isna(row["NAICS Description"]) else "",
            "hybrid": str(row["Hybrid Work"]) if not pd.isna(row["Hybrid Work"]) else "No",
            "transit_score": float(row["Transit_Score"]),
            "lead_score": float(row["Lead_Score"]),
            "tier": int(row["Tier"]),
            "dauid": str(row["DAUID"]),
            "ward": str(row["Ward Name"]) if not pd.isna(row["Ward Name"]) else "",
            "bia": str(row["BIA"]) if not pd.isna(row["BIA"]) else ""
        },
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat]
        }
    }
    features.append(feat)

geojson_out = {
    "type": "FeatureCollection",
    "features": features
}

with open(OUTPUT_GEOJSON_PATH, "w") as f:
    json.dump(geojson_out, f)

print(f"\nSuccessfully generated {len(features)} target leads!")
print(f"Saved -> {OUTPUT_GEOJSON_PATH} (Size: {os.path.getsize(OUTPUT_GEOJSON_PATH) / 1024 / 1024:.2f} MB)")
