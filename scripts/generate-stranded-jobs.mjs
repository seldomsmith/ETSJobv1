#!/usr/bin/env node
/**
 * generate-stranded-jobs.mjs
 * 
 * Downloads Edmonton GTFS stops, computes nearest-stop distances for every
 * employer location, and writes stranded_jobs.geojson + stops_with_jobs.geojson.
 * 
 * Run from the project root:  node scripts/generate-stranded-jobs.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';

const GTFS_URL = 'https://gtfs.edmonton.ca/TMGTFSRealTimeWebService/GTFS/gtfs.zip';
const DATA_DIR = join(process.cwd(), 'public', 'data');
const TMP_DIR = join(process.cwd(), '.tmp-gtfs');

// --- Utilities ---

function haversine(lon1, lat1, lon2, lat2) {
  const R = 6371000;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLam = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi / 2) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getJobCount(sizeStr) {
  const m = { '5-9': 7, '10-19': 15, '20-99': 60, '100-499': 300, '500+': 500 };
  return m[sizeStr] || 1;
}

// --- Spatial grid index ---

const GRID = 0.01; // ~1 km cells

function buildGrid(points) {
  const grid = {};
  for (const p of points) {
    const key = `${Math.floor(p.lon / GRID)},${Math.floor(p.lat / GRID)}`;
    (grid[key] ||= []).push(p);
  }
  return grid;
}

function nearestDist(lon, lat, grid) {
  const gx = Math.floor(lon / GRID);
  const gy = Math.floor(lat / GRID);
  let best = Infinity;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const cell = grid[`${gx + dx},${gy + dy}`];
      if (!cell) continue;
      for (const p of cell) {
        const d = haversine(lon, lat, p.lon, p.lat);
        if (d < best) best = d;
      }
    }
  }
  return best;
}

// --- Main ---

console.log('=== Transit Gap Data Generator ===\n');

// 1. Download GTFS
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
const zipPath = join(TMP_DIR, 'gtfs.zip');

console.log('Downloading Edmonton GTFS feed...');
try {
  execSync(`curl -sL -o "${zipPath}" "${GTFS_URL}"`, { stdio: 'pipe' });
  execSync(`unzip -o -j "${zipPath}" stops.txt -d "${TMP_DIR}"`, { stdio: 'pipe' });
} catch (e) {
  console.error('Failed to download/extract GTFS. Ensure curl and unzip are available.');
  process.exit(1);
}

// 2. Parse stops.txt
const stopsRaw = readFileSync(join(TMP_DIR, 'stops.txt'), 'utf-8');
const lines = stopsRaw.trim().split('\n');
const hdr = lines[0].replace(/\r$/, '').split(',');
const iLat = hdr.indexOf('stop_lat');
const iLon = hdr.indexOf('stop_lon');
const iName = hdr.indexOf('stop_name');
const iId = hdr.indexOf('stop_id');

const stops = [];
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].replace(/\r$/, '').split(',');
  const lat = parseFloat(c[iLat]);
  const lon = parseFloat(c[iLon]);
  if (!isNaN(lat) && !isNaN(lon)) {
    stops.push({ lat, lon, name: c[iName] || '', id: c[iId] || '' });
  }
}
console.log(`Parsed ${stops.length} bus stops.\n`);

// 3. Load jobs
console.log('Loading employer locations...');
const jobsData = JSON.parse(readFileSync(join(DATA_DIR, 'ets_at_work_leads.geojson'), 'utf-8'));
console.log(`Loaded ${jobsData.features.length} employer locations.\n`);

// 4. Build spatial grid of stops
const stopGrid = buildGrid(stops);

// 5. Score every job by distance to nearest stop
console.log('Scoring employer locations by nearest bus stop...');
const stranded = [];
let strandedJobCount = 0;
const features = jobsData.features;

for (let i = 0; i < features.length; i++) {
  const feat = features[i];
  if (!feat.geometry || feat.geometry.type !== 'Point') continue;
  const [jlon, jlat] = feat.geometry.coordinates;

  const dist = nearestDist(jlon, jlat, stopGrid);

  let score = 0.0;
  if (dist <= 400) score = 1.0;
  else if (dist <= 600) score = 0.5;
  else if (dist <= 800) score = 0.1;

  if (score < 1.0) {
    const out = JSON.parse(JSON.stringify(feat));
    out.properties.nearest_stop_dist = Math.round(dist * 10) / 10;
    out.properties.transit_buffer_score = score;
    stranded.push(out);
    strandedJobCount += getJobCount(feat.properties.size || '');
  }

  if ((i + 1) % 10000 === 0) console.log(`  ${i + 1} / ${features.length}...`);
}

writeFileSync(
  join(DATA_DIR, 'stranded_jobs.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: stranded })
);
console.log(`\nWrote ${stranded.length} stranded locations (~${strandedJobCount} estimated jobs) to stranded_jobs.geojson`);

// 6. Generate stops_with_jobs.geojson (jobs within 400m of each stop)
console.log('\nComputing jobs within 400m of each bus stop...');
const jobGrid = buildGrid(
  features
    .filter(f => f.geometry && f.geometry.type === 'Point')
    .map(f => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], feat: f }))
);

const stopFeatures = [];
for (let s = 0; s < stops.length; s++) {
  const stop = stops[s];
  const gx = Math.floor(stop.lon / GRID);
  const gy = Math.floor(stop.lat / GRID);
  let jobCount = 0;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cell = jobGrid[`${gx + dx},${gy + dy}`];
      if (!cell) continue;
      for (const jp of cell) {
        if (haversine(stop.lon, stop.lat, jp.lon, jp.lat) <= 400) {
          jobCount += getJobCount(jp.feat.properties.size || '');
        }
      }
    }
  }

  stopFeatures.push({
    type: 'Feature',
    properties: { stop_id: stop.id, stop_name: stop.name, jobs_within_400m: jobCount },
    geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] }
  });

  if ((s + 1) % 2000 === 0) console.log(`  ${s + 1} / ${stops.length} stops...`);
}

writeFileSync(
  join(DATA_DIR, 'stops_with_jobs.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: stopFeatures })
);
console.log(`Wrote ${stopFeatures.length} stops to stops_with_jobs.geojson`);

// 7. Cleanup
try { rmSync(TMP_DIR, { recursive: true, force: true }); } catch (e) { /* ignore */ }

console.log('\n=== Done! Restart Next.js (npm run dev) and check the map. ===');
console.log('Then commit the generated files:');
console.log('  git add public/data/stranded_jobs.geojson public/data/stops_with_jobs.geojson');
console.log('  git commit -m "Add generated transit analysis data"');
console.log('  git push');
