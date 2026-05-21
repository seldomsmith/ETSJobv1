'use client';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Map, { Source, Layer, NavigationControl, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { motion } from 'framer-motion';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

const chapters = [
  { id: 'baseline', title: 'ETS@Work Target leads', description: 'Explore 21,882 Edmonton businesses eligible for the ETS@Work program (>= 10 employees). 3D Pillars represent real businesses, colored by transit suitability (Green = Prime, Yellow = Good, Pink = Challenging) and extruded by workforce size.', layers: ['routes', 'ets_leads'], viewState: { longitude: -113.4938, latitude: 53.5461, zoom: 11.2, pitch: 45, bearing: -10 }, metrics: [{ label: 'Eligible Employers', value: '21,882', type: 'cyan' }, { label: 'Prime Targets (Tier 1)', value: '476', type: 'lime' }] },
  { id: 'access-gap', title: 'The Accessibility Gap', description: 'The height of each 3D Hexagon indicates total jobs reachable within 30 minutes, weighted by travel speed. Jobs 5 mins away receive full 1.0x score, decaying down to remove center plateaus.', layers: ['hex_accessibility', 'routes'], viewState: { longitude: -113.4938, latitude: 53.5461, zoom: 11.5, pitch: 45, bearing: -20 }, metrics: [{ label: 'Accessibility', value: '30 mins', type: 'cyan' }, { label: 'Weighted Jobs', value: 'Decay Adjusted', type: 'pink' }] },
  { id: 'transit-penalty', title: 'The Time Gap', description: 'Watch 15 real commuters race from Edmonton’s highest-penalty suburbs into Downtown. Green dots are by car. Pink dots are by transit. The gap you see is not distance — it is time stolen from transit riders every single day.', layers: ['commute_race'], viewState: { longitude: -113.5738, latitude: 53.5261, zoom: 10.5, pitch: 35, bearing: -10 }, metrics: [{ label: 'Car', value: 'Arriving', type: 'cyan' }, { label: 'Transit', value: 'En Route…', type: 'pink' }] },
  { id: 'equity-divide', title: 'The Equity Divide', description: 'Combining social buffers reveals critical suburbs like Rutherford to belong to deficit quadrant limits.', layers: ['equity_map'], viewState: { longitude: -113.4038, latitude: 53.4661, zoom: 12.5, pitch: 60, bearing: -30 }, metrics: [{ label: 'Rutherford Equity', value: '1.0 Score', type: 'purple' }, { label: 'Job Access Link', value: '0.11 Ratio', type: 'lime' }] }
];

const jobCategories = [
  { name: 'Public administration', color: '#f59e0b' },
  { name: 'Health care and social assistance', color: '#ec4899' },
  { name: 'Accommodation and food services', color: '#f97316' },
  { name: 'Educational services', color: '#8b5cf6' },
  { name: 'Construction', color: '#eab308' },
  { name: 'Professional, scientific and technical services', color: '#22d3ee' },
  { name: 'Manufacturing', color: '#10b981' },
  { name: 'Transportation and warehousing', color: '#06b6d4' },
  { name: 'Finance and insurance', color: '#3b82f6' },
  { name: 'Retail trade', color: '#ef4444' },
  { name: 'Real estate and rental and leasing', color: '#f43f5e' },
  { name: 'Administrative and support, waste management and remediation services', color: '#a855f7' },
  { name: 'Utilities', color: '#34d399' },
  { name: 'Agriculture, forestry, fishing and hunting', color: '#84cc16' },
  { name: 'Information and cultural industries', color: '#6366f1' },
  { name: 'Arts, entertainment and recreation', color: '#db2777' },
  { name: 'Other services (except public administration)', color: '#475569' }
];

export default function ScrollytellingView() {
  const [currentChapter, setCurrentChapter] = useState(0);
  const [viewState, setViewState] = useState(chapters[0].viewState);
  const [jobCentersData, setJobCentersData] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [hexData, setHexData] = useState<any>(null);
  const [jobCategoriesState] = useState(jobCategories);
  const [commuteRoutesData, setCommuteRoutesData] = useState<any>(null);
  const [particlePositions, setParticlePositions] = useState<any>(null);
  const [penaltyGridData, setPenaltyGridData] = useState<any>(null);
  const [showAggregate, setShowAggregate] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [isNarrativeCollapsed, setIsNarrativeCollapsed] = useState(false);
  const [activePeriod, setActivePeriod] = useState<'weekday' | 'midday' | 'weekend'>('weekday');
  const [etsLeadsData, setEtsLeadsData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [minSize, setMinSize] = useState<'all' | '10+' | '20+' | '100+' | '500+'>('all');
  const [selectedTier, setSelectedTier] = useState<'all' | '1' | '2' | '3'>('all');
  const [excludeHybrid, setExcludeHybrid] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0);
  const animCompletedRef = useRef<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/data/job_centers.geojson')
      .then(r => r.json())
      .then(data => {
        // Expand each point feature into 3 stacked sub-features representing different industries
        const features = data.features.flatMap((f: any) => {
          if (f.geometry.type === 'Point') {
            const [lon, lat] = f.geometry.coordinates;
            const coords = [[
              [lon - 0.0015, lat - 0.001],
              [lon + 0.0015, lat - 0.001],
              [lon + 0.0015, lat + 0.001],
              [lon - 0.0015, lat + 0.001],
              [lon - 0.0015, lat - 0.001]
            ]];
            
            const total = f.properties.total_jobs || 0;
            const primaryCat = f.properties.job_category || 'Other';

            // Simulate distribution: 50% Primary, 30% Secondary, 20% Tertiary
            const slice1 = Math.floor(total * 0.5);
            const slice2 = Math.floor(total * 0.3);
            const slice3 = Math.max(0, total - slice1 - slice2);

            // Dynamically allocate secondary categories so it fills beautifully
            const catHash = Math.abs(parseFloat(f.properties.DAUID || "0") % jobCategories.length);
            const cat2 = jobCategories[(catHash + 1) % jobCategories.length].name;
            const cat3 = jobCategories[(catHash + 2) % jobCategories.length].name;

            return [
              {
                type: 'Feature',
                properties: { ...f.properties, base_jobs: 0, top_jobs: slice1, job_category: primaryCat },
                geometry: { type: 'Polygon', coordinates: coords }
              },
              {
                type: 'Feature',
                properties: { ...f.properties, base_jobs: slice1, top_jobs: slice1 + slice2, job_category: cat2 },
                geometry: { type: 'Polygon', coordinates: coords }
              },
              {
                type: 'Feature',
                properties: { ...f.properties, base_jobs: slice1 + slice2, top_jobs: total, job_category: cat3 },
                geometry: { type: 'Polygon', coordinates: coords }
              }
            ];
          }
          return [f];
        });
        const uniqueCats = Array.from(new Set(features.map((f: any) => f.properties.job_category).filter(Boolean))) as string[];
        setActiveCategories(uniqueCats);
        setJobCentersData({ ...data, features });
      }).catch(err => console.error(err));

    fetch('/data/hex_accessibility.geojson')
      .then(r => r.json())
      .then(data => setHexData(data))
      .catch(err => console.error(err));

    fetch('/data/commute_routes_weekday.geojson')
      .then(r => r.json())
      .then(data => setCommuteRoutesData(data))
      .catch(err => console.error(err));

    fetch('/data/transit_penalty_grid.geojson')
      .then(r => r.json())
      .then(data => setPenaltyGridData(data))
      .catch(err => console.error(err));

    fetch('/data/ets_at_work_leads.geojson')
      .then(r => r.json())
      .then(data => setEtsLeadsData(data))
      .catch(err => console.error(err));
  }, []);

  // Filter and process ETS@Work target leads on-the-fly
  const etsLeadsGeoJSON = useMemo(() => {
    if (!etsLeadsData) return null;

    const filteredFeatures = etsLeadsData.features.filter((f: any) => {
      const p = f.properties;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesAddress = p.address.toLowerCase().includes(query);
        const matchesSector = p.sector.toLowerCase().includes(query);
        if (!matchesName && !matchesAddress && !matchesSector) return false;
      }

      if (minSize === '10+') {
        if (p.size === '5-9') return false;
      } else if (minSize === '20+') {
        if (p.size === '5-9' || p.size === '10-19') return false;
      } else if (minSize === '100+') {
        if (p.size === '5-9' || p.size === '10-19' || p.size === '20-99') return false;
      } else if (minSize === '500+') {
        if (p.size !== '500+') return false;
      }

      if (excludeHybrid && p.hybrid === 'Yes') return false;

      if (selectedTier !== 'all' && String(p.tier) !== String(selectedTier)) return false;

      return true;
    });

    // Convert point coordinates to small 3D box polygons on-the-fly
    const renderFeatures = filteredFeatures.slice(0, 2500).map((f: any) => {
      const [lon, lat] = f.geometry.coordinates;
      const size = f.properties.size;

      const offset = size === '500+' ? 0.0006 : size === '100-499' ? 0.0004 : size === '20-99' ? 0.0003 : size === '10-19' ? 0.0002 : 0.00015;
      const polygonCoords = [[
        [lon - offset, lat - offset],
        [lon + offset, lat - offset],
        [lon + offset, lat + offset],
        [lon - offset, lat + offset],
        [lon - offset, lat - offset]
      ]];

      return {
        ...f,
        geometry: {
          type: 'Polygon',
          coordinates: polygonCoords
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features: renderFeatures,
      totalMatched: filteredFeatures.length
    };
  }, [etsLeadsData, searchQuery, minSize, excludeHybrid, selectedTier]);

  const etsLeadsGeoJSONData = useMemo(() => {
    if (!etsLeadsGeoJSON) return null;
    return {
      type: 'FeatureCollection',
      features: etsLeadsGeoJSON.features
    };
  }, [etsLeadsGeoJSON]);

  // Autocomplete search suggestions (max 5)
  const searchSuggestions = useMemo(() => {
    if (!etsLeadsData || !searchQuery || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    const matches: any[] = [];
    for (const f of etsLeadsData.features) {
      if (f.properties.name.toLowerCase().includes(query)) {
        matches.push(f);
        if (matches.length >= 5) break;
      }
    }
    return matches;
  }, [etsLeadsData, searchQuery]);

  const handleSelectSuggestion = (company: any) => {
    setSearchQuery(company.properties.name);
    const [lon, lat] = company.geometry.coordinates;
    setViewState(prev => ({
      ...prev,
      longitude: lon,
      latitude: lat,
      zoom: 15.5,
      pitch: 60,
      bearing: -10,
      transitionDuration: 1500
    } as any));
  };

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return;
      const scrollPos = window.scrollY;
      const height = window.innerHeight;
      const activeIdx = Math.min(chapters.length - 1, Math.floor((scrollPos + height / 3) / height));
      if (activeIdx !== currentChapter) { setCurrentChapter(activeIdx); setViewState((prev) => ({ ...prev, ...chapters[activeIdx].viewState })); }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Reload commute routes when time period changes
  useEffect(() => {
    progressRef.current = 0;
    animCompletedRef.current = false;
    setShowAggregate(false);
    fetch(`/data/commute_routes_${activePeriod}.geojson`)
      .then(r => r.json())
      .then(data => setCommuteRoutesData(data))
      .catch(err => console.error(err));
  }, [activePeriod]);

  // Animation loop for commute race
  useEffect(() => {
    if (!commuteRoutesData || currentChapter !== 2) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const routes = commuteRoutesData.features;

    const animate = () => {
      // Run up to 3.0 so that even dots with speed_factor=0.33 can reach 1.0 Distance before reset
      progressRef.current = (progressRef.current + 0.003) % 3.0;
      const p = progressRef.current;

      // Walk a curved multi-point LineString at progress t (0→1)
      const interpolateAlong = (coords: number[][], t: number): [number, number] => {
        if (coords.length === 1) return [coords[0][0], coords[0][1]];
        // Calculate total length
        let totalLen = 0;
        const segLens: number[] = [];
        for (let i = 0; i < coords.length - 1; i++) {
          const dx = coords[i+1][0] - coords[i][0];
          const dy = coords[i+1][1] - coords[i][1];
          const len = Math.sqrt(dx*dx + dy*dy);
          segLens.push(len);
          totalLen += len;
        }
        const targetDist = t * totalLen;
        let walked = 0;
        for (let i = 0; i < segLens.length; i++) {
          if (walked + segLens[i] >= targetDist) {
            const segT = (targetDist - walked) / segLens[i];
            const lng = coords[i][0] + (coords[i+1][0] - coords[i][0]) * segT;
            const lat = coords[i][1] + (coords[i+1][1] - coords[i][1]) * segT;
            return [lng, lat];
          }
          walked += segLens[i];
        }
        return [coords[coords.length-1][0], coords[coords.length-1][1]];
      };

      const points = routes.map((route: any) => {
        const coords: number[][] = route.geometry.coordinates;
        // Car or Transit speed weights
        const isCar = route.properties.mode === 'car';
        const speedFactor: number = route.properties.speed_factor ?? 1.0;
        
        // Let it stop at 1.0 (finish line) using Math.min
        const t = Math.min(p * (isCar ? 1.0 : speedFactor), 1.0);
        const [lng, lat] = interpolateAlong(coords, t);

        return {
          type: 'Feature',
          properties: {
            mode: route.properties.mode,
            penalty_score: route.properties.penalty_score
          },
          geometry: { type: 'Point', coordinates: [lng, lat] }
        };
      });

      setParticlePositions({ type: 'FeatureCollection', features: points });

      // Detect animation completion: progress > 2.9 means even slowest transit arrived
      if (progressRef.current > 2.85 && !animCompletedRef.current) {
        animCompletedRef.current = true;
        // Short pause then reveal aggregate
        setTimeout(() => setShowAggregate(true), 1200);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [commuteRoutesData, currentChapter]);

  const activeChap = chapters[currentChapter];

  return (
    <div className="relative w-full h-[400vh]" ref={scrollRef}>
      <div className="sticky top-0 h-screen w-full bg-slate-950">
        <Map 
          {...viewState} 
          onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)} 
          mapboxAccessToken={MAPBOX_TOKEN} 
          mapStyle="mapbox://styles/mapbox/dark-v11" 
          style={{ width: "100vw", height: "100vh" }}
          interactiveLayerIds={
            activeChap.id === 'baseline'
              ? ['ets-leads-layer']
              : activeChap.id === 'transit-penalty'
              ? ['penalty-choropleth']
              : []
          }
          onMouseMove={(evt: any) => {
             const feature = evt.features && evt.features[0];
             if (feature && (activeChap.id === 'transit-penalty' || activeChap.id === 'baseline')) {
                 setHoverInfo({ feature, x: evt.point.x, y: evt.point.y });
             } else {
                 setHoverInfo(null);
             }
          }}
          onMouseLeave={() => setHoverInfo(null)}
        >
          <NavigationControl position="top-right" />
          
          <Source id="routes" type="geojson" data="/data/routes.geojson">
            <Layer id="routes-layer" type="line" layout={{ visibility: activeChap.layers.includes('routes') ? 'visible' : 'none' }} paint={{ 'line-color': ['match', ['get', 'type'], 'LRT', '#ffd700', 'High-Freq', '#f472b6', 'Local', '#22d3ee', '#22d3ee'], 'line-opacity': 0.8, 'line-width': 1.5 }} />
          </Source>

          {etsLeadsGeoJSONData && (
            <Source id="ets_leads" type="geojson" data={etsLeadsGeoJSONData}>
              <Layer
                id="ets-leads-layer"
                type="fill-extrusion"
                layout={{ visibility: activeChap.layers.includes('ets_leads') ? 'visible' : 'none' }}
                paint={{
                  'fill-extrusion-color': [
                    'match',
                    ['get', 'tier'],
                    1, '#4ade80', // Tier 1 (Prime)
                    2, '#eab308', // Tier 2 (Good)
                    3, '#ec4899', // Tier 3 (Challenging)
                    '#cbd5e1'
                  ],
                  'fill-extrusion-height': [
                    'match',
                    ['get', 'size'],
                    '5-9', 80,
                    '10-19', 150,
                    '20-99', 400,
                    '100-499', 900,
                    '500+', 1800,
                    50
                  ],
                  'fill-extrusion-opacity': 0.85,
                  'fill-extrusion-base': 0
                }}
              />
            </Source>
          )}

          {jobCentersData && (
            <Source id="job_centers" type="geojson" data={jobCentersData}>
              <Layer 
                id="job-centers" 
                type="fill-extrusion" 
                layout={{ visibility: activeChap.layers.includes('job_centers') ? 'visible' : 'none' }} 
                paint={{ 
                   'fill-extrusion-color': [
                     'match',
                     ['get', 'job_category'],
                     ...jobCategories.flatMap(c => [c.name, c.color]),
                     '#98ff98' // Default fallback
                   ], 
                   'fill-extrusion-height': ['interpolate', ['linear'], ['get', 'top_jobs'], 0, 0, 1000, 2500], 
                   'fill-extrusion-opacity': 0.85,
                   'fill-extrusion-base': ['interpolate', ['linear'], ['get', 'base_jobs'], 0, 0, 1000, 2500]
                }} 
                filter={['in', ['get', 'job_category'], ['literal', activeCategories]]}
              />
            </Source>
          )}

          {hexData && (
            <Source id="hex_accessibility" type="geojson" data={hexData}>
              <Layer 
                 id="hex-accessibility" 
                 type="fill-extrusion" 
                 layout={{ visibility: activeChap.layers.includes('hex_accessibility') ? 'visible' : 'none' }} 
                 paint={{
                    'fill-extrusion-color': [
                       'interpolate', ['linear'], ['get', 'accessible_jobs'],
                       0, '#0f172a',
                       10000, '#06b6d4',
                       50000, '#22d3ee',
                       130000, '#ec4899'
                    ],
                    'fill-extrusion-height': ['interpolate', ['linear'], ['get', 'accessible_jobs'], 0, 0, 130000, 3200],
                    'fill-extrusion-opacity': 0.85,
                    'fill-extrusion-base': 0
                 }}
              />
            </Source>
          )}

          <Source id="transit_penalty" type="geojson" data="/data/transit_penalty.geojson">
            <Layer id="penalty-choropleth" type="fill" layout={{ visibility: activeChap.layers.includes('transit_penalty') ? 'visible' : 'none' }} paint={{ 'fill-color': ['interpolate', ['linear'], ['get', 'penalty_score'], 0, '#22d3ee', 0.5, '#a855f7', 1, '#f472b6'], 'fill-opacity': 0.7 }} />
          </Source>

          <Source id="equity_map" type="geojson" data="/data/equity_map.geojson">
            <Layer id="equity-gradients" type="fill" layout={{ visibility: activeChap.layers.includes('equity_map') ? 'visible' : 'none' }} paint={{ 'fill-color': ['match', ['get', 'quadrant'], 'High Equity Need, Low Access', '#a855f7', 'Low Equity Need, High Access', '#98ff98', '#334155'], 'fill-opacity': 0.52 }} />
          </Source>

          {/* ───── AGGREGATE PENALTY GRID ─────────────────────────────────── */}
          {penaltyGridData && activeChap.id === 'transit-penalty' && (
            <Source id="penalty_grid" type="geojson" data={penaltyGridData}>
              {/* Filled DA polygons — vivid bi-polar color scale */}
              <Layer
                id="penalty-grid-fill"
                type="fill"
                paint={{
                  'fill-color': [
                    'interpolate', ['linear'],
                    ['coalesce',
                      ['get', activePeriod === 'weekday' ? 'penalty_weekday' :
                               activePeriod === 'midday'  ? 'penalty_midday'  : 'penalty_weekend'],
                      0
                    ],
                    0.00, '#0f172a',   // dark slate — great transit
                    0.15, '#1e3a5f',   // deep navy
                    0.30, '#312e81',   // indigo
                    0.50, '#7c3aed',   // vivid violet
                    0.65, '#db2777',   // hot pink
                    0.80, '#f97316',   // blazing orange
                    1.00, '#fef08a',   // amber glow — transit desert
                  ],
                  'fill-opacity': showAggregate ? 0.78 : 0,
                }}
              />
              {/* DA polygon outlines for definition */}
              <Layer
                id="penalty-grid-outline"
                type="line"
                paint={{
                  'line-color': [
                    'interpolate', ['linear'],
                    ['coalesce',
                      ['get', activePeriod === 'weekday' ? 'penalty_weekday' :
                               activePeriod === 'midday'  ? 'penalty_midday'  : 'penalty_weekend'],
                      0
                    ],
                    0, 'rgba(255,255,255,0.0)',
                    0.4, 'rgba(124,58,237,0.3)',
                    0.7, 'rgba(249,115,22,0.5)',
                    1.0, 'rgba(254,240,138,0.7)',
                  ],
                  'line-width': 0.5,
                  'line-opacity': showAggregate ? 1 : 0,
                }}
              />
            </Source>
          )}

          {commuteRoutesData && (
            <Source id="commute_ghost" type="geojson" data={commuteRoutesData}>
              <Layer
                id="ghost-car-lines"
                type="line"
                filter={['==', ['get', 'mode'], 'car']}
                layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }}
                paint={{ 'line-color': '#4ade80', 'line-opacity': 0.15, 'line-width': 1.5, 'line-dasharray': [4, 4] }}
              />
              <Layer
                id="ghost-transit-lines"
                type="line"
                filter={['==', ['get', 'mode'], 'transit']}
                layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }}
                paint={{ 'line-color': '#ec4899', 'line-opacity': 0.15, 'line-width': 1.5, 'line-dasharray': [4, 4] }}
              />
            </Source>
          )}

          {/* ⚡ Racing Pulse: Animated Particles */}
          {particlePositions && (
            <Source id="particles" type="geojson" data={particlePositions}>
              {/* Car glow — outer halo */}
              <Layer
                id="car-particles-halo"
                type="circle"
                filter={['==', ['get', 'mode'], 'car']}
                layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }}
                paint={{ 'circle-radius': 12, 'circle-color': '#4ade80', 'circle-opacity': 0.2, 'circle-blur': 1 }}
              />
              {/* Car glow — bright core */}
              <Layer
                id="car-particles-core"
                type="circle"
                filter={['==', ['get', 'mode'], 'car']}
                layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }}
                paint={{ 'circle-radius': 5, 'circle-color': '#4ade80', 'circle-opacity': 0.95 }}
              />
              {/* Transit glow — outer halo */}
              <Layer
                id="transit-particles-halo"
                type="circle"
                filter={['==', ['get', 'mode'], 'transit']}
                layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }}
                paint={{ 'circle-radius': 12, 'circle-color': '#ec4899', 'circle-opacity': 0.2, 'circle-blur': 1 }}
              />
              {/* Transit glow — bright core */}
              <Layer
                id="transit-particles-core"
                type="circle"
                filter={['==', ['get', 'mode'], 'transit']}
                layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }}
                paint={{ 'circle-radius': 5, 'circle-color': '#ec4899', 'circle-opacity': 0.95 }}
              />
            </Source>
          )}
        </Map>

        {/* Interactive Industry Checkbox Control */}
        {activeChap.id === 'baseline' && (
          <>
            <div className={`absolute top-24 right-4 z-20 glass-card p-5 max-w-[320px] pointer-events-auto h-auto max-h-[90vh] overflow-y-auto w-full transition-all duration-500 transform ${isFiltersCollapsed ? 'translate-x-[120%] opacity-0' : 'translate-x-0'}`}>
               <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white uppercase tracking-wider block font-outfit">ETS@Work Prospector</span>
                    <span className="bg-aurora-cyan/10 border border-aurora-cyan/30 text-aurora-cyan text-[10px] px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">B2B</span>
                  </div>
                  <button onClick={() => setIsFiltersCollapsed(true)} className="text-slate-500 hover:text-white transition-colors bg-white/5 p-1 rounded">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  </button>
               </div>

               {/* Search Box */}
               <div className="mb-4 relative">
                  <label className="text-xxs font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-outfit">Search Employers</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. Acme Corp, 104 St..."
                      className="w-full bg-slate-900/90 border border-white/10 rounded-lg py-2 pl-8 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-aurora-cyan/50 focus:ring-0"
                    />
                    <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>

                  {/* Search Autocomplete Suggestions */}
                  {searchSuggestions.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-slate-950/95 border border-white/10 rounded-lg shadow-2xl max-h-[200px] overflow-y-auto pointer-events-auto">
                      {searchSuggestions.map((s: any, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectSuggestion(s)}
                          className="w-full text-left px-3 py-2 text-xxs text-slate-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0 flex flex-col gap-0.5"
                        >
                          <span className="font-bold text-white truncate">{s.properties.name}</span>
                          <span className="text-slate-500 truncate">{s.properties.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
               </div>

               {/* Min Size Pills */}
               <div className="mb-4">
                  <label className="text-xxs font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-outfit">Min Employer Size</label>
                  <div className="grid grid-cols-5 gap-1">
                    {([
                      { key: 'all', label: '5+' },
                      { key: '10+', label: '10+' },
                      { key: '20+', label: '20+' },
                      { key: '100+', label: '100+' },
                      { key: '500+', label: '500+' }
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setMinSize(key)}
                        className={`text-[9px] py-1 rounded font-bold transition-all border ${
                          minSize === key
                            ? 'bg-aurora-cyan/10 border-aurora-cyan text-aurora-cyan'
                            : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
               </div>

               {/* Tier Selector Pills */}
               <div className="mb-4">
                  <label className="text-xxs font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-outfit">Target Priority Tier</label>
                  <div className="flex flex-col gap-1.5">
                    {([
                      { key: 'all', label: 'All Targets', colorClass: 'bg-slate-400' },
                      { key: '1', label: 'Tier 1 • Prime Target', colorClass: 'bg-aurora-lime' },
                      { key: '2', label: 'Tier 2 • Good Target', colorClass: 'bg-yellow-400' },
                      { key: '3', label: 'Tier 3 • Challenging', colorClass: 'bg-aurora-pink' }
                    ] as const).map(({ key, label, colorClass }) => (
                      <button
                        key={key}
                        onClick={() => setSelectedTier(key)}
                        className={`text-xxs py-1.5 px-3 rounded-lg text-left font-bold transition-all border flex items-center gap-2 ${
                          selectedTier === key
                            ? 'bg-white/5 border-white/20 text-white'
                            : 'bg-slate-900/60 border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${colorClass} shadow-sm`} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
               </div>

               {/* Exclude Hybrid Toggle */}
               <div className="mb-5 flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xxs font-bold text-slate-300">Exclude Hybrid Offices</span>
                    <span className="text-[10px] text-slate-500">Focus on daily full-time commuters</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={excludeHybrid}
                      onChange={(e) => setExcludeHybrid(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-900 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-aurora-cyan peer-checked:after:bg-slate-950 peer-checked:after:border-transparent"></div>
                  </label>
               </div>

               {/* Matching Stats */}
               <div className="bg-slate-950/80 rounded-xl p-3 border border-white/5 mb-4 font-outfit">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Matched Leads</span>
                    <span className="text-xs font-mono font-bold text-aurora-cyan">
                      {etsLeadsGeoJSON ? etsLeadsGeoJSON.totalMatched.toLocaleString() : '0'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-aurora-gradient h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${Math.min(100, etsLeadsData ? ((etsLeadsGeoJSON?.totalMatched || 0) / etsLeadsData.features.length) * 100 : 0)}%` 
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 block mt-1.5">
                    * Showing top 2,500 on map for 60fps performance
                  </span>
               </div>

               {/* Open Dashboard Link */}
               <Link 
                 href="/dashboard" 
                 className="w-full py-2.5 rounded-lg bg-aurora-cyan/10 border border-aurora-cyan/30 text-aurora-cyan text-xxs font-extrabold hover:bg-aurora-cyan/20 transition-all duration-200 flex items-center justify-center gap-1.5 font-outfit"
               >
                 <span>Open Leads Finder Dashboard</span>
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
               </Link>
            </div>

            {isFiltersCollapsed && (
               <button onClick={() => setIsFiltersCollapsed(false)} className="absolute top-24 right-4 z-20 p-2 glass-card rounded h-8 w-8 flex items-center justify-center pointer-events-auto text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" /></svg>
               </button>
            )}
          </>
        )}

        {/* Race Legend + Period Selector */}
        {activeChap.id === 'transit-penalty' && (
          <div className="absolute bottom-12 right-12 z-20 glass-card p-4 flex flex-col gap-3 min-w-[180px] pointer-events-auto">
            {/* Period selector pills */}
            <div>
              <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest block mb-2">Time Period</span>
              <div className="flex flex-col gap-1.5">
                {([
                  { key: 'weekday', label: '⏰ Weekday AM Peak' },
                  { key: 'midday',  label: '☀️ Weekday Midday' },
                  { key: 'weekend', label: '📅 Weekend' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActivePeriod(key)}
                    className={`text-xs px-3 py-1.5 rounded-lg text-left transition-all duration-200 font-medium ${
                      activePeriod === key
                        ? 'bg-aurora-cyan/20 text-aurora-cyan border border-aurora-cyan/40'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Race key + Skip button */}
            <div className="border-t border-white/10 pt-2">
              {!showAggregate && (
                <button
                  onClick={() => { animCompletedRef.current = true; setShowAggregate(true); }}
                  className="w-full mb-3 px-3 py-2 rounded-lg bg-aurora-cyan/10 border border-aurora-cyan/30 text-aurora-cyan text-xs font-bold hover:bg-aurora-cyan/20 transition-all duration-200 flex items-center justify-center gap-1.5"
                >
                  <span>⚡ Skip to Results</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" /><path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
              )}
              {showAggregate && (
                <button
                  onClick={() => { animCompletedRef.current = false; progressRef.current = 0; setShowAggregate(false); }}
                  className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-700/40 border border-white/10 text-slate-400 text-xs font-bold hover:bg-white/5 transition-all duration-200 flex items-center justify-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 4.293a1 1 0 010 1.414L5.414 10l4.293 4.293a1 1 0 01-1.414 1.414l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 0z" clipRule="evenodd" /><path fillRule="evenodd" d="M15.707 4.293a1 1 0 010 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  <span>↩ Replay Animation</span>
                </button>
              )}
              <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest block mb-2">The Race</span>
              <div className={`flex items-center gap-2 mb-1 transition-opacity duration-700 ${showAggregate ? 'opacity-30' : 'opacity-100'}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                <span className="text-xs text-slate-300">Car (full speed)</span>
              </div>
              <div className={`flex items-center gap-2 transition-opacity duration-700 ${showAggregate ? 'opacity-30' : 'opacity-100'}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-pink-400 flex-shrink-0" />
                <span className="text-xs text-slate-300">Transit (penalized)</span>
              </div>
            </div>
          </div>
        )}

        {/* Aggregate View Legend — bottom left, fades in with choropleth */}
        {activeChap.id === 'transit-penalty' && (
          <div className={`absolute bottom-12 left-12 z-20 glass-card p-4 flex flex-col gap-2 min-w-[200px] transition-all duration-1000 ${showAggregate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest block">Transit Penalty Citywide</span>
            <div className="w-full h-3 rounded-full" style={{ background: 'linear-gradient(to right, #0f172a, #312e81, #7c3aed, #db2777, #f97316, #fef08a)' }} />
            <div className="flex justify-between text-xxs text-slate-400 font-medium">
              <span>🟢 Low Penalty</span>
              <span>🔴 Transit Desert</span>
            </div>
            <div className="mt-1 pt-2 border-t border-white/10 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#312e81' }} />
                <span className="text-xxs text-slate-400">Moderate (30–50% slower)</span>
              </div>
              <div className="flex items-center gap-2">
<div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#db2777' }} />
                <span className="text-xxs text-slate-400">Severe (50–70% slower)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#f97316' }} />
                <span className="text-xxs text-slate-400">Critical (70%+ slower)</span>
              </div>
            </div>
          </div>
        )}

        {/* Floating Tooltip */}
        {hoverInfo && hoverInfo.feature && (
          <div className="absolute pointer-events-none z-50 glass-card p-4 min-w-[240px]"
               style={{ left: hoverInfo.x + 15, top: hoverInfo.y + 15 }}>
            {activeChap.id === 'baseline' ? (
              <>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1 font-outfit">
                  Tier {hoverInfo.feature.properties.tier} Lead • {hoverInfo.feature.properties.size} Employees
                </span>
                <h3 className="text-sm font-extrabold text-white mb-2 leading-snug font-outfit">{hoverInfo.feature.properties.name}</h3>
                
                <div className="w-full bg-slate-800 h-[1px] mb-2.5"></div>
                
                <div className="flex flex-col gap-1.5 text-xxs">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 font-bold uppercase">Address:</span>
                    <span className="text-slate-300 truncate max-w-[140px] text-right font-medium" title={hoverInfo.feature.properties.address}>
                      {hoverInfo.feature.properties.address}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 font-bold uppercase">Sector:</span>
                    <span className="text-slate-300 truncate max-w-[140px] text-right font-medium" title={hoverInfo.feature.properties.sector}>
                      {hoverInfo.feature.properties.sector}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 font-bold uppercase">Hybrid Work:</span>
                    <span className={`font-extrabold ${hoverInfo.feature.properties.hybrid === 'Yes' ? 'text-aurora-pink' : 'text-aurora-cyan'}`}>
                      {hoverInfo.feature.properties.hybrid}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 mt-1">
                    <span className="text-slate-400 font-bold">Transit Score:</span>
                    <span className="font-extrabold text-aurora-lime">
                      {(hoverInfo.feature.properties.transit_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Priority Score:</span>
                    <span className="font-extrabold text-aurora-cyan">
                      {hoverInfo.feature.properties.lead_score?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2 font-outfit">DA UID: {hoverInfo.feature.properties.DAUID || "N/A"}</span>
                
                <div className="w-full bg-slate-800 h-[1px] mb-2.5"></div>
                
                <div className="flex flex-col gap-2">
                   <div className="flex justify-between items-center gap-4">
                      <span className="text-xs text-slate-300">Transit Penalty:</span>
                      <span className="text-sm font-bold text-aurora-pink">
                          {hoverInfo.feature.properties.penalty_score?.toFixed(2) || "0.00"}
                      </span>
                   </div>
                   <div className="flex justify-between items-center gap-4">
                      <span className="text-xs text-slate-300">Avg Wait Time:</span>
                      <span className="text-sm font-bold text-white">
                          {hoverInfo.feature.properties.avg_wait_time_minutes?.toFixed(1) || "0"} min
                      </span>
                   </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* Narrative Toggle Button */}
      <button onClick={() => setIsNarrativeCollapsed(!isNarrativeCollapsed)} className="absolute top-24 left-4 z-30 p-2 glass-card rounded h-8 w-8 flex items-center justify-center pointer-events-auto text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300">
         {isNarrativeCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
         ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" /></svg>
         )}
      </button>

      <div className={`absolute top-0 w-full z-10 flex flex-col items-center pointer-events-none transition-all duration-500 transform ${isNarrativeCollapsed ? '-translate-x-[110%] opacity-0' : 'translate-x-0 opacity-100'}`}>
         {chapters.map((chap, i) => (
            <div key={chap.id} className="h-screen flex items-center justify-start p-12 max-w-xl w-full mr-auto">
               <motion.div className={`glass-card p-8 backdrop-blur-md border-l-4 transition-all duration-700 pointer-events-auto ${i === currentChapter ? 'border-aurora-cyan opacity-100 shadow-xl' : 'border-slate-800 opacity-20'}`} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: 0.6 }}>
                 <span className="text-xs font-bold text-aurora-cyan uppercase tracking-widest block font-outfit">View {i + 1}</span>
                 <h2 className="text-3xl font-extrabold mb-3">{chap.title}</h2>
                 <p className="text-slate-400 text-sm mb-6">{chap.description}</p>
                 <div className="grid grid-cols-2 gap-4">
                     {chap.metrics?.map((m, j) => (
                        <div key={j} className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                           <span className="text-xxs text-slate-500 uppercase">{m.label}</span>
                           <span className={`text-xl font-bold block mt-1 text-aurora-${m.type || 'cyan'}`}>{m.value}</span>
                        </div>
                     ))}
                 </div>
               </motion.div>
            </div>
         ))}
      </div>
    </div>
  );
}
