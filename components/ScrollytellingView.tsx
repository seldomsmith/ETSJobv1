'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMapGL, { Source, Layer, NavigationControl, ViewStateChangeEvent } from 'react-map-gl';
import { motion } from 'framer-motion';

// Required for map styling anchor points
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

interface Metric {
  label: string;
  value: string;
  trend?: string;
  type?: 'cyan' | 'lime' | 'pink' | 'purple';
}

interface Chapter {
  id: string;
  title: string;
  description: string;
  layers: string[];
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing?: number;
  };
  metrics: Metric[];
}

const chapters: Chapter[] = [
  {
    id: 'baseline',
    title: 'Baseline Transit & Jobs',
    description: 'Overview of 236 active transit lines grouped by linear vectors and job density clusters in Edmonton.',
    layers: ['routes', 'job_centers'],
    viewState: {
      longitude: -113.4938,
      latitude: 53.5461,
      zoom: 11,
      pitch: 0,
    },
    metrics: [
      { label: 'Transit Lines', value: '236', trend: 'Active', type: 'cyan' },
      { label: 'Job Centres', value: '1,047 DAs', type: 'lime' }
    ]
  },
  {
    id: 'access-gap',
    title: 'The Accessibility Gap',
    description: 'Contrasting bounded isochrones measuring reachability of neighborhoods under 30 minute thresholds.',
    layers: ['isochrones', 'routes'],
    viewState: {
      longitude: -113.4538,
      latitude: 53.5361,
      zoom: 11.5,
      pitch: 20
    },
    metrics: [
      { label: 'Deficit Zones', value: '324 Areas', trend: 'High Need', type: 'pink' },
      { label: 'Max Reachable', value: '142k Jobs', type: 'cyan' }
    ]
  },
  {
    id: 'transit-penalty',
    title: 'Transit Penalty Score',
    description: 'Wait times and transfer delays create significant temporal penalties for off-core commutes.',
    layers: ['transit_penalty'],
    viewState: {
      longitude: -113.4238,
      latitude: 53.5161,
      zoom: 12,
      pitch: 45,
      bearing: -15
    },
    metrics: [
      { label: 'Avg Wait Penalty', value: '18 min', trend: '+12%', type: 'pink' },
      { label: 'Normalized Index', value: '0.92 avg', type: 'purple' }
    ]
  },
  {
    id: 'equity-divide',
    title: 'The Equity Divide',
    description: 'Combining social buffers reveals critical suburbs like Rutherford to belong to deficit quadrant limits.',
    layers: ['equity_map'],
    viewState: {
      longitude: -113.4038,
      latitude: 53.4661, // Focus on Rutherford area
      zoom: 12.5,
      pitch: 60,
      bearing: -30
    },
    metrics: [
      { label: 'Rutherford Equity', value: '1.0 Score', type: 'purple' },
      { label: 'Job Access Link', value: '0.11 Ratio', type: 'lime' }
    ]
  }
];

export default function ScrollytellingView() {
  const [currentChapter, setCurrentChapter] = useState(0);
  const [viewState, setViewState] = useState(chapters[0].viewState);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return;
      
      const scrollPos = window.scrollY;
      const height = window.innerHeight;
      
      // Compute active chapter based on index scroll height
      const activeIdx = Math.min(
         chapters.length - 1,
         Math.floor((scrollPos + height / 3) / height)
      );
      
      if (activeIdx !== currentChapter) {
        setCurrentChapter(activeIdx);
        // Animate camera transition by updating viewState
        setViewState((prev) => ({
          ...prev,
          ...chapters[activeIdx].viewState,
        }));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentChapter]);

  const activeChap = chapters[currentChapter];

  return (
    <div className="relative" ref={scrollRef}>
      {/* 🗺️ Map Backdrop (Sticky viewport height) */}
      <div className="sticky top-0 h-screen w-full -z-10 bg-slate-950">
        <ReactMapGL
          {...viewState}
          onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
        >
          <NavigationControl position="top-right" />
          
          {/* Chapter 1: Routes Static Layer */}
          {activeChap.layers.includes('routes') && (
            <Source id="routes" type="geojson" data="/data/routes.geojson">
              <Layer
                id="routes-layer"
                type="line"
                paint={{
                  'line-color': [
                    'match',
                    ['get', 'type'], // Change to your exact property name (e.g., 'category', 'route_type')
                    'LRT', '#ffd700', // Gold
                    'High-Freq', '#f472b6', // Pink
                    'Local', '#22d3ee', // Turquoise
                    '#22d3ee' // Default Cyan
                  ],
                  'line-width': 1.5,
                  'line-opacity': 0.8
                }}
              />
            </Source>
          )}

          {/* Chapter 1: Job Centers Dynamic bubbles */}
          {activeChap.layers.includes('job_centers') && (
            <Source id="job_centers" type="geojson" data="/data/job_centers.geojson">
              <Layer
                id="job-centers"
                type="circle"
                paint={{
                  'circle-radius': [
                     'interpolate', ['linear'], ['get', 'total_jobs'],
                     10, 4,
                     1000, 20
                  ],
                  'circle-color': '#98ff98', // aurora-lime
                  'circle-opacity': 0.6,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#111'
                }}
              />
            </Source>
          )}

          {/* Chapter 2: Isochrones access buffer */}
          {activeChap.layers.includes('isochrones') && (
            <Source id="isochrones" type="geojson" data="/data/isochrones.geojson">
              <Layer
                id="isochrones-layer"
                type="fill"
                paint={{
                  'fill-color': '#22d3ee',
                  'fill-opacity': 0.3,
                  'fill-outline-color': '#22d3ee'
                }}
              />
            </Source>
          )}

          {/* Chapter 3: Transit Penalty (Choropleth normal) */}
          {activeChap.layers.includes('transit_penalty') && (
            <Source id="transit_penalty" type="geojson" data="/data/transit_penalty.geojson">
              <Layer
                id="penalty-choropleth"
                type="fill"
                paint={{
                  'fill-color': [
                     'interpolate', ['linear'], ['get', 'penalty_score'],
                     0, '#0f172a',    // low penalty slate
                     1, '#f472b6'     // high penalty pink
                  ],
                  'fill-opacity': 0.6,
                }}
              />
            </Source>
          )}

          {/* Chapter 4: Equity Map quadrant classification */}
          {activeChap.layers.includes('equity_map') && (
            <Source id="equity_map" type="geojson" data="/data/equity_map.geojson">
              <Layer
                id="equity-gradients"
                type="fill"
                paint={{
                  'fill-color': [
                    'match', ['get', 'quadrant'],
                    'High Equity Need, Low Access', '#a855f7', // purple
                    'Low Equity Need, High Access', '#98ff98', // lime
                    '#334155' // default slate
                  ],
                  'fill-opacity': 0.5,
                }}
              />
            </Source>
          )}
        </ReactMapGL>
      </div>

      {/* 📜 Content Chapters Scroll Overlay */}
      <div className="absolute top-0 w-full flex flex-col items-center">
         {chapters.map((chap, i) => (
            <div key={chap.id} className="h-screen flex items-center justify-start p-12 max-w-xl w-full mr-auto">
               <motion.div 
                 className={`glass-card p-8 backdrop-blur-md transition-all duration-700 border-l-4 ${
                    i === currentChapter ? 'border-aurora-cyan shadow-xl border-opacity-100' : 'border-slate-800 opacity-20'
                 }`}
                 initial={{ opacity: 0, x: -30 }}
                 whileInView={{ opacity: 1, x: 0 }}
                 viewport={{ once: false, amount: 0.6 }}
               >
                 <span className="text-xs font-bold text-aurora-cyan uppercase tracking-widest mb-1 block">
                    Analytical View • {i + 1}
                 </span>
                 <h2 className="text-3xl font-extrabold font-outfit mb-3">{chap.title}</h2>
                 <p className="text-slate-400 text-sm mb-6 leading-relaxed">{chap.description}</p>
                 
                 {/* Metrics snippet view in card indexer */}
                 <div className="grid grid-cols-2 gap-4">
                     {chap.metrics.map((m, j) => (
                        <div key={j} className="bg-slate-900/40 p-4 rounded-xl border border-white/5 aurora-glow">
                           <span className="text-xxs text-slate-500 uppercase font-medium tracking-wide">{m.label}</span>
                           <span className={`text-xl font-bold block mt-1 text-aurora-${m.type || 'cyan'}`}>
                              {m.value}
                           </span>
                           {m.trend && (
                              <span className="text-xxs bg-slate-800/10 px-1 rounded block text-slate-400 mt-1">
                                 {m.trend}
                              </span>
                           )}
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
