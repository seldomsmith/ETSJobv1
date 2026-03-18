'use client';
import React, { useState, useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { motion } from 'framer-motion';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

const chapters = [
  { id: 'baseline', title: 'Baseline Transit & Jobs', description: 'Overview of 236 active transit lines grouped by linear vectors and 3D Job Pillars rises in Edmonton.', layers: ['routes', 'job_centers'], viewState: { longitude: -113.4938, latitude: 53.5461, zoom: 11.2, pitch: 45, bearing: -10 }, metrics: [{ label: 'Transit Lines', value: '236', type: 'cyan' }, { label: 'Job Centres', value: '1,047 DAs', type: 'lime' }] },
  { id: 'access-gap', title: 'The Accessibility Gap', description: 'Contrasting bounded isochrones measuring reachability of neighborhoods under 30 minute thresholds.', layers: ['isochrones', 'routes'], viewState: { longitude: -113.4538, latitude: 53.5361, zoom: 11.5, pitch: 20 }, metrics: [{ label: 'Deficit Zones', value: '324 Areas', type: 'pink' }, { label: 'Max Reachable', value: '142k Jobs', type: 'cyan' }] },
  { id: 'transit-penalty', title: 'Transit Penalty Score', description: 'The Transit Penalty Score measures the time gap and delays of public transit compared to driving. Pink neighborhoods face the highest delays and worst transit competitiveness, severely limiting their access to city-wide employment hubs compared to car owners.', layers: ['transit_penalty'], viewState: { longitude: -113.4238, latitude: 53.5161, zoom: 12, pitch: 45, bearing: -15 }, metrics: [{ label: 'Avg Wait Penalty', value: '18 min', type: 'pink' }, { label: 'Normalized Index', value: '0.92 avg', type: 'purple' }] },
  { id: 'equity-divide', title: 'The Equity Divide', description: 'Combining social buffers reveals critical suburbs like Rutherford to belong to deficit quadrant limits.', layers: ['equity_map'], viewState: { longitude: -113.4038, latitude: 53.4661, zoom: 12.5, pitch: 60, bearing: -30 }, metrics: [{ label: 'Rutherford Equity', value: '1.0 Score', type: 'purple' }, { label: 'Job Access Link', value: '0.11 Ratio', type: 'lime' }] }
];

export default function ScrollytellingView() {
  const [currentChapter, setCurrentChapter] = useState(0);
  const [viewState, setViewState] = useState(chapters[0].viewState);
  const [jobCentersData, setJobCentersData] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/data/job_centers.geojson')
      .then(r => r.json())
      .then(data => {
        const size = 0.0012; 
        const features = data.features.map((f: any) => {
          // 🛡️ Safe-mapping Check for broken properties
          if (!f.geometry || !f.geometry.coordinates || f.geometry.type !== 'Point') return f;
          
          try {
            const [lon, lat] = f.geometry.coordinates;
            return {
              ...f,
              geometry: {
                type: 'Polygon',
                coordinates: [[[lon - size, lat - size], [lon + size, lat - size], [lon + size, lat + size], [lon - size, lat + size], [lon - size, lat - size]]]
              }
            };
          } catch (e) {
            return f;
          }
        });
        setJobCentersData({ ...data, features });
      }).catch(err => console.error(err));
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
                   'fill-extrusion-color': '#98ff98', 
                   'fill-extrusion-height': ['interpolate', ['linear'], ['get', 'total_jobs'], 0, 0, 1000, 2500], 
                   'fill-extrusion-opacity': 0.85,
                   'fill-extrusion-base': 0
                }} 
              />
            </Source>
          )}

          <Source id="isochrones" type="geojson" data="/data/isochrones.geojson">
            <Layer id="isochrones-layer" type="fill" layout={{ visibility: activeChap.layers.includes('isochrones') ? 'visible' : 'none' }} paint={{ 'fill-color': '#22d3ee', 'fill-opacity': 0.35, 'fill-outline-color': '#22d3ee' }} />
          </Source>

          <Source id="transit_penalty" type="geojson" data="/data/transit_penalty.geojson">
            <Layer id="penalty-choropleth" type="fill" layout={{ visibility: activeChap.layers.includes('transit_penalty') ? 'visible' : 'none' }} paint={{ 'fill-color': ['interpolate', ['linear'], ['get', 'penalty_score'], 0, '#22d3ee', 0.5, '#a855f7', 1, '#f472b6'], 'fill-opacity': 0.7 }} />
          </Source>

          <Source id="equity_map" type="geojson" data="/data/equity_map.geojson">
            <Layer id="equity-gradients" type="fill" layout={{ visibility: activeChap.layers.includes('equity_map') ? 'visible' : 'none' }} paint={{ 'fill-color': ['match', ['get', 'quadrant'], 'High Equity Need, Low Access', '#a855f7', 'Low Equity Need, High Access', '#98ff98', '#334155'], 'fill-opacity': 0.52 }} />
          </Source>
        </Map>

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
      <div className="absolute top-0 w-full z-10 flex flex-col items-center">
         {chapters.map((chap, i) => (
            <div key={chap.id} className="h-screen flex items-center justify-start p-12 max-w-xl w-full mr-auto">
               <motion.div className={`glass-card p-8 backdrop-blur-md border-l-4 transition-all duration-700 ${i === currentChapter ? 'border-aurora-cyan opacity-100 shadow-xl' : 'border-slate-800 opacity-20'}`} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: 0.6 }}>
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
