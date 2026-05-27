'use client';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Map, { Source, Layer, NavigationControl, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { motion } from 'framer-motion';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

const chapters = [
  { id: 'baseline', title: 'Edmonton Transit Network', description: 'Edmonton Transit Service (ETS) connects over one million residents across a vast spatial geography. This visualization overlays the GTFS rapid transit corridors (Gold LRT lines, Pink High-Frequency lines, and Cyan local routes) over the city\'s urban footprint.', layers: ['routes'], viewState: { longitude: -113.4938, latitude: 53.5461, zoom: 11.2, pitch: 45, bearing: -10 }, metrics: [{ label: 'Transit Coverage', value: 'Citywide', type: 'cyan' }, { label: 'GTFS Feed', value: 'Active ETS', type: 'lime' }] },
  { id: 'access-gap', title: 'The Accessibility Gap', description: 'The height of each 3D Hexagon indicates total jobs reachable within 30 minutes, weighted by travel speed. Jobs 5 mins away receive full 1.0x score, decaying down to remove center plateaus.', layers: ['hex_accessibility', 'routes'], viewState: { longitude: -113.4938, latitude: 53.5461, zoom: 11.5, pitch: 45, bearing: -20 }, metrics: [{ label: 'Accessibility', value: '30 mins', type: 'cyan' }, { label: 'Weighted Jobs', value: 'Decay Adjusted', type: 'pink' }] },
  { id: 'transit-penalty', title: 'The Time Gap', description: 'Watch 15 real commuters race from Edmonton’s highest-penalty suburbs into Downtown. Green dots are by car. Pink dots are by transit. The gap you see is not distance — it is time stolen from transit riders every single day.', layers: ['commute_race'], viewState: { longitude: -113.5738, latitude: 53.5261, zoom: 10.5, pitch: 35, bearing: -10 }, metrics: [{ label: 'Car', value: 'Arriving', type: 'cyan' }, { label: 'Transit', value: 'En Route…', type: 'pink' }] },
  { id: 'equity-divide', title: 'The Equity Divide', description: 'Combining social buffers reveals critical suburbs like Rutherford to belong to deficit quadrant limits.', layers: ['equity_map'], viewState: { longitude: -113.4038, latitude: 53.4661, zoom: 12.5, pitch: 60, bearing: -30 }, metrics: [{ label: 'Rutherford Equity', value: '1.0 Score', type: 'purple' }, { label: 'Job Access Link', value: '0.11 Ratio', type: 'lime' }] }
];

export default function ScrollytellingView() {
  const [currentChapter, setCurrentChapter] = useState(0);
  const [viewState, setViewState] = useState(chapters[0].viewState);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [hexData, setHexData] = useState<any>(null);
  const [commuteRoutesData, setCommuteRoutesData] = useState<any>(null);
  const [particlePositions, setParticlePositions] = useState<any>(null);
  const [penaltyGridData, setPenaltyGridData] = useState<any>(null);
  const [showAggregate, setShowAggregate] = useState(false);
  const [isNarrativeCollapsed, setIsNarrativeCollapsed] = useState(false);
  const [activePeriod, setActivePeriod] = useState<'weekday' | 'midday' | 'weekend'>('weekday');
  const [activeTheme, setActiveTheme] = useState('dark');
  const animFrameRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0);
  const animCompletedRef = useRef<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync theme selection on mount and custom events
  useEffect(() => {
    const savedTheme = localStorage.getItem('ets-theme') || 'dark';
    setActiveTheme(savedTheme);

    const handleThemeChange = (e: Event) => {
      const theme = (e as CustomEvent).detail?.theme || 'dark';
      setActiveTheme(theme);
    };

    window.addEventListener('ets-theme-change', handleThemeChange);
    return () => window.removeEventListener('ets-theme-change', handleThemeChange);
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    progressRef.current = 0;
    animCompletedRef.current = false;
    setShowAggregate(false);
    fetch(`/data/commute_routes_${activePeriod}.geojson`)
      .then(r => r.json())
      .then(data => setCommuteRoutesData(data))
      .catch(err => console.error(err));
  }, [activePeriod]);

  useEffect(() => {
    if (!commuteRoutesData || currentChapter !== 2) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    const routes = commuteRoutesData.features;
    const animate = () => {
      progressRef.current = (progressRef.current + 0.003) % 3.0;
      const p = progressRef.current;
      const interpolateAlong = (coords: number[][], t: number): [number, number] => {
        if (coords.length === 1) return [coords[0][0], coords[0][1]];
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
        const isCar = route.properties.mode === 'car';
        const speedFactor: number = route.properties.speed_factor ?? 1.0;
        const t = Math.min(p * (isCar ? 1.0 : speedFactor), 1.0);
        const [lng, lat] = interpolateAlong(coords, t);
        return {
          type: 'Feature',
          properties: { mode: route.properties.mode },
          geometry: { type: 'Point', coordinates: [lng, lat] }
        };
      });
      setParticlePositions({ type: 'FeatureCollection', features: points });
      if (progressRef.current > 2.85 && !animCompletedRef.current) {
        animCompletedRef.current = true;
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
          mapStyle={activeTheme === 'light' ? 'mapbox://styles/mapbox/light-v11' : 'mapbox://styles/mapbox/dark-v11'} 
          style={{ width: "100%", height: "100%" }}
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
            <Layer 
              id="routes-layer" 
              type="line" 
              layout={{ visibility: activeChap.layers.includes('routes') ? 'visible' : 'none' }} 
              paint={{ 
                'line-color': activeTheme === 'light' 
                  ? '#1e3a8a' 
                  : ['match', ['get', 'type'], 'LRT', '#ffd700', 'High-Freq', '#f472b6', 'Local', '#22d3ee', '#22d3ee'], 
                'line-opacity': 0.8, 
                'line-width': 1.5 
              }} 
            />
          </Source>
          {hexData && (
            <Source id="hex_accessibility" type="geojson" data={hexData}>
              <Layer 
                 id="hex-accessibility" 
                 type="fill-extrusion" 
                 layout={{ visibility: activeChap.layers.includes('hex_accessibility') ? 'visible' : 'none' }} 
                 paint={{
                    'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'accessible_jobs'], 0, '#0f172a', 10000, '#06b6d4', 50000, '#22d3ee', 130000, '#ec4899'],
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
          {penaltyGridData && activeChap.id === 'transit-penalty' && (
            <Source id="penalty_grid" type="geojson" data={penaltyGridData}>
              <Layer
                id="penalty-grid-fill"
                type="fill"
                paint={{
                  'fill-color': ['interpolate', ['linear'], ['get', 'penalty_avg'], 0.1, '#0f172a', 0.25, '#312e81', 0.4, '#7c3aed', 0.6, '#db2777', 0.8, '#f97316', 0.95, '#fef08a'],
                  'fill-opacity': showAggregate ? 0.75 : 0
                }}
              />
            </Source>
          )}
          {commuteRoutesData && (
            <Source id="commute_ghost" type="geojson" data={commuteRoutesData}>
              <Layer id="ghost-car-lines" type="line" filter={['==', ['get', 'mode'], 'car']} layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }} paint={{ 'line-color': '#4ade80', 'line-opacity': 0.15, 'line-width': 1.5, 'line-dasharray': [4, 4] }} />
              <Layer id="ghost-transit-lines" type="line" filter={['==', ['get', 'mode'], 'transit']} layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }} paint={{ 'line-color': '#ec4899', 'line-opacity': 0.15, 'line-width': 1.5, 'line-dasharray': [4, 4] }} />
            </Source>
          )}
          {particlePositions && (
            <Source id="particles" type="geojson" data={particlePositions}>
              <Layer id="car-particles-halo" type="circle" filter={['==', ['get', 'mode'], 'car']} layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }} paint={{ 'circle-radius': 12, 'circle-color': '#4ade80', 'circle-opacity': 0.2, 'circle-blur': 1 }} />
              <Layer id="car-particles-core" type="circle" filter={['==', ['get', 'mode'], 'car']} layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }} paint={{ 'circle-radius': 5, 'circle-color': '#4ade80', 'circle-opacity': 0.95 }} />
              <Layer id="transit-particles-halo" type="circle" filter={['==', ['get', 'mode'], 'transit']} layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }} paint={{ 'circle-radius': 12, 'circle-color': '#ec4899', 'circle-opacity': 0.2, 'circle-blur': 1 }} />
              <Layer id="transit-particles-core" type="circle" filter={['==', ['get', 'mode'], 'transit']} layout={{ visibility: activeChap.layers.includes('commute_race') ? 'visible' : 'none' }} paint={{ 'circle-radius': 5, 'circle-color': '#ec4899', 'circle-opacity': 0.95 }} />
            </Source>
          )}
        </Map>
        {activeChap.id === 'transit-penalty' && (
          <div className="absolute bottom-12 right-12 z-20 glass-card p-4 flex flex-col gap-3 min-w-[180px] pointer-events-auto">
            <div>
              <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest block mb-2">Time Period</span>
              <div className="flex flex-col gap-1.5">
                {([{ key: 'weekday', label: '⏰ Weekday AM Peak' }, { key: 'midday', label: '☀️ Weekday Midday' }, { key: 'weekend', label: '📅 Weekend' }] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => setActivePeriod(key)} className={`text-xs px-3 py-1.5 rounded-lg text-left transition-all duration-200 font-medium ${activePeriod === key ? 'bg-aurora-cyan/20 text-aurora-cyan border border-aurora-cyan/40' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {showAggregate && activeChap.id === 'transit-penalty' && (
          <div className="absolute bottom-12 left-12 z-20 glass-card p-4 flex flex-col gap-2 min-w-[200px] transition-all duration-1000">
            <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest block">Transit Penalty Citywide</span>
            <div className="w-full h-3 rounded-full" style={{ background: 'linear-gradient(to right, #0f172a, #312e81, #7c3aed, #db2777, #f97316, #fef08a)' }} />
            <div className="flex justify-between text-xxs text-slate-400 font-medium"><span>Low Penalty</span><span>Transit Desert</span></div>
            <div className="mt-1 pt-2 border-t border-white/10 flex flex-col gap-1">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#312e81' }} /><span className="text-xxs text-slate-400">Moderate (30–50% slower)</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#db2777' }} /><span className="text-xxs text-slate-400">Severe (50–70% slower)</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#f97316' }} /><span className="text-xxs text-slate-400">Critical (70%+ slower)</span></div>
            </div>
          </div>
        )}
        {hoverInfo && hoverInfo.feature && (
          <div className="absolute pointer-events-none z-50 glass-card p-4 min-w-[240px]" style={{ left: hoverInfo.x + 15, top: hoverInfo.y + 15 }}>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2 font-outfit">DA UID: {hoverInfo.feature.properties.DAUID || "N/A"}</span>
            <div className="w-full bg-slate-800 h-[1px] mb-2.5"></div>
            <div className="flex flex-col gap-2">
               <div className="flex justify-between items-center gap-4"><span className="text-xs text-slate-300">Transit Penalty:</span><span className="text-sm font-bold text-aurora-pink">{hoverInfo.feature.properties.penalty_score?.toFixed(2) || "0.00"}</span></div>
               <div className="flex justify-between items-center gap-4"><span className="text-xs text-slate-300">Avg Wait Time:</span><span className="text-sm font-bold text-white">{hoverInfo.feature.properties.avg_wait_time_minutes?.toFixed(1) || "0"} min</span></div>
            </div>
          </div>
        )}
      </div>
      <button onClick={() => setIsNarrativeCollapsed(!isNarrativeCollapsed)} className="absolute top-24 left-4 z-30 p-2 glass-card rounded h-8 w-8 flex items-center justify-center pointer-events-auto text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300">
         {isNarrativeCollapsed ? (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" /></svg>)}
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
