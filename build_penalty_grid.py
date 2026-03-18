"""
Build transit_penalty_grid.geojson
- For each DA polygon, attach penalty scores for all 3 time periods
- penalty = normalized (transit_time - car_baseline) / transit_time
- Values 0.0 = transit as fast as car; 1.0 = transit catastrophically slow
"""
import json
import numpy as np
import pandas as pd

DOWNTOWN_DA = '48110083'
CAR_BASELINE = 22.0  # approximate avg car travel time to downtown in minutes

PERIODS = {
    'weekday': 'public/data/travel_times_weekday.parquet',
    'midday':  'public/data/travel_times_weekday_midday.parquet',
    'weekend': 'public/data/travel_times_saturday.parquet',
}

print("Loading parquet files...")
period_scores = {}
for period_name, path in PERIODS.items():
    df = pd.read_parquet(path)
    downtown = df[(df['to_id'] == DOWNTOWN_DA) & (df['from_id'] != DOWNTOWN_DA)]
    avg_time = downtown.groupby('from_id')['travel_time'].mean()
    # Normalize: higher score = worse transit vs car
    scores = ((avg_time - CAR_BASELINE) / avg_time.clip(lower=1)).clip(0, 1)
    period_scores[period_name] = scores
    print(f"  {period_name}: {len(scores)} DAs, score range {scores.min():.2f}–{scores.max():.2f}")

print("\nLoading DA polygon GeoJSON...")
raw = json.load(open('public/data/transit_penalty.geojson'))

enriched_features = []
missing = 0
for f in raw['features']:
    da = str(f['properties'].get('DAUID', ''))
    if not da or not f.get('geometry'):
        missing += 1
        continue

    p_weekday = float(period_scores['weekday'].get(da, np.nan))
    p_midday  = float(period_scores['midday'].get(da, np.nan))
    p_weekend = float(period_scores['weekend'].get(da, np.nan))

    # Skip DAs with no transit data
    if np.isnan(p_weekday) and np.isnan(p_midday) and np.isnan(p_weekend):
        missing += 1
        continue

    # Average penalty used for base display; individual period penalties attached
    valid = [x for x in [p_weekday, p_midday, p_weekend] if not np.isnan(x)]
    avg_penalty = float(np.mean(valid))

    enriched_features.append({
        "type": "Feature",
        "properties": {
            "DAUID": da,
            "penalty_weekday": round(p_weekday, 4) if not np.isnan(p_weekday) else None,
            "penalty_midday":  round(p_midday, 4)  if not np.isnan(p_midday) else None,
            "penalty_weekend": round(p_weekend, 4) if not np.isnan(p_weekend) else None,
            "penalty_avg":     round(avg_penalty, 4),
        },
        "geometry": f['geometry']
    })

out = {"type": "FeatureCollection", "features": enriched_features}
with open('public/data/transit_penalty_grid.geojson', 'w') as fp:
    json.dump(out, fp)

print(f"\n✅ Wrote {len(enriched_features)} DA polygons ({missing} skipped).")
print("Saved → public/data/transit_penalty_grid.geojson")
