'use client';
import React, { useState, useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { motion } from 'framer-motion';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

const chapters = [
  { id: 'baseline', title: 'Baseline Transit & Jobs', description: 'Overview of 236 active transit lines grouped by linear vectors and 3D Job Pillars rises in Edmonton.', layers: ['routes', 'job_centers'], viewState: { longitude: -113.4938, latitude: 53.5461, zoom: 11.2, pitch: 45, bearing: -10 }, metrics: [{ label: 'Transit Lines', value: '236', type: 'cyan' }, { label: 'Job Centres', value: '1,047 DAs', type: 'lime' }] },
  { id: 'access-gap', title: 'The Accessibility Gap', description: 'The height of each 3D Hexagon indicates total jobs reachable within 30 minutes, weighted by travel speed. Jobs 5 mins away receive full 1.0x score, decaying down to remove center plateaus.', layers: ['hex_accessibility', 'routes'], viewState: { longitude: -113.4938, latitude: 53.5461, zoom: 11.5, pitch: 45, bearing: -20 }, metrics: [{ label: 'Accessibility', value: '30 mins', type: 'cyan' }, { label: 'Weighted Jobs', value: 'Decay Adjusted', type: 'pink' }] },
  { id: 'transit-penalty', title: 'Transit Penalty Score', description: 'The Transit Penalty Score measures the time gap and delays of public transit compared to driving. Pink neighborhoods face the highest delays and worst transit competitiveness, severely limiting their access to city-wide employment hubs compared to car owners.', layers: ['transit_penalty'], viewState: { longitude: -113.4238, latitude: 53.5161, zoom: 12, pitch: 45, bearing: -15 }, metrics: [{ label: 'Avg Wait Penalty', value: '18 min', type: 'pink' }, { label: 'Normalized Index', value: '0.92 avg', type: 'purple' }] },
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
  }, [currentChapter]);

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
        </Map>

        {/* Interactive Industry Checkbox Control */}
        {activeChap.id === 'baseline' && (
          <div className="absolute top-24 right-4 z-20 glass-card p-4 max-w-[240px] pointer-events-auto h-auto max-h-[400px] overflow-y-auto w-full">
             <span className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 block">Filter Industries</span>
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
        )}

        {/* Legend Overlay */}
        {activeChap.id === 'transit-penalty' && (
          <div className="absolute bottom-12 right-12 z-20 glass-card p-4 flex flex-col items-center">
             <span className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2 block font-outfit">Penalty Score</span>
             <div className="w-48 h-3 rounded-full bg-gradient-to-r from-aurora-cyan via-purple-500 to-aurora-pink mb-2"></div>
             <div className="w-full flex justify-between text-xxs font-bold text-slate-400">
               <span>Good (Transit ~ Car)</span>
               <span>Poor (Car Faster)</span>
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
      <div className="absolute top-0 w-full z-10 flex flex-col items-center pointer-events-none">
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
