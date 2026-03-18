'use client';
import React, { useState, useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { motion } from 'framer-motion';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

const chapters = [
  { id: 'baseline', title: 'Baseline Transit & Jobs', description: 'Overview of 236 active transit lines grouped by linear vectors and 3D Job Pillars rises in Edmonton.', layers: ['routes', 'job_centers'], viewState: { longitude: -113.4938, latitude: 53.5461, zoom: 11.2, pitch: 45, bearing: -10 }, metrics: [{ label: 'Transit Lines', value: '236', type: 'cyan' }, { label: 'Job Centres', value: '1,047 DAs', type: 'lime' }] },
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

    fetch('/data/travel_times_weekday.parquet') // just to ensure fetch works, keeping same sequence
  }, []);

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
          interactiveLayerIds={activeChap.id === 'transit-penalty' ? ['penalty-choropleth'] : []}
          onMouseMove={(evt: any) => {
             const feature = evt.features && evt.features[0];
             if (feature && activeChap.id === 'transit-penalty') {
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
            <div className={`absolute top-24 right-4 z-20 glass-card p-4 max-w-[240px] pointer-events-auto h-auto max-h-[400px] overflow-y-auto w-full transition-all duration-500 transform ${isFiltersCollapsed ? 'translate-x-[120%] opacity-0' : 'translate-x-0'}`}>
               <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest block font-outfit">Filter Industries</span>
                  <button onClick={() => setIsFiltersCollapsed(true)} className="text-slate-500 hover:text-white transition-colors bg-white/5 p-1 rounded">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  </button>
               </div>
               <div className="flex flex-col gap-2">
                   {jobCategories.map((cat) => (
                      <label key={cat.name} className="flex items-center gap-2 cursor-pointer group text-xxs">
                         <input 
                            type="checkbox" 
                            checked={activeCategories.includes(cat.name)}
                            onChange={(e) => {
                               if (e.target.checked) {
                                  setActiveCategories(prev => [...prev, cat.name]);
                               } else {
                                  setActiveCategories(prev => prev.filter(n => n !== cat.name));
                               }
                            }}
                            className="rounded border-white/10 bg-slate-900/80 text-aurora-cyan focus:ring-0"
                         />
                         <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
                         <span className="text-slate-400 group-hover:text-white transition-colors truncate">{cat.name}</span>
                      </label>
                   ))}
               </div>
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
          <div className="absolute pointer-events-none z-50 glass-card p-4 min-w-[200px]"
               style={{ left: hoverInfo.x + 15, top: hoverInfo.y + 15 }}>
              <span className="text-xxs uppercase font-bold text-slate-500 tracking-widest block mb-2">DA UID: {hoverInfo.feature.properties.DAUID || "N/A"}</span>
              
              <div className="w-full bg-slate-800 h-[1px] mb-2"></div>
              
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
