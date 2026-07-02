'use client';

import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

export default function BusStopsMap({ viewMode }: { viewMode: 'proximity' | 'hexbin' | 'stranded' }) {
  const [activeTheme, setActiveTheme] = useState('dark');
  const [hoverInfo, setHoverInfo] = useState<{feature: any, x: number, y: number} | null>(null);

  useEffect(() => {
    setActiveTheme(localStorage.getItem('ets-theme') || 'dark');
    const onThemeChange = (e: any) => setActiveTheme(e.detail.theme);
    window.addEventListener('ets-theme-change', onThemeChange);
    return () => window.removeEventListener('ets-theme-change', onThemeChange);
  }, []);

  const onHover = (e: any) => {
    const { features, point: { x, y } } = e;
    const hoveredFeature = features && features[0];
    
    if (hoveredFeature) {
      setHoverInfo({ feature: hoveredFeature, x, y });
    } else {
      setHoverInfo(null);
    }
  };

  const mapStyle = activeTheme === 'light' ? 'mapbox://styles/mapbox/light-v11' : 'mapbox://styles/mapbox/dark-v11';

  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={{
          longitude: -113.4909,
          latitude: 53.5444,
          zoom: 11
        }}
        mapStyle={mapStyle}
        mapboxAccessToken={MAPBOX_TOKEN}
        interactiveLayerIds={['bus-stops-layer', 'jobs-layer', 'hexbin-layer', 'stranded-jobs-layer']}
        onMouseMove={onHover}
        onMouseLeave={() => setHoverInfo(null)}
      >
        <NavigationControl position="bottom-right" />
        
        {/* VIEW 1: Stop Proximity */}
        {viewMode === 'proximity' && (
          <>
            <Source id="jobs" type="geojson" data="/data/ets_at_work_leads.geojson">
              <Layer 
                id="jobs-layer" 
                type="circle" 
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 6],
                  'circle-color': '#4299e1',
                  'circle-opacity': 0.6,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#2b6cb0'
                }} 
              />
            </Source>
            <Source id="bus-stops" type="geojson" data="/data/stops_with_jobs.geojson">
              <Layer 
                id="bus-stops-layer" 
                type="circle" 
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
                  'circle-color': [
                    'interpolate', ['linear'], ['get', 'jobs_within_400m'],
                    0, '#a0aec0',
                    10, '#f6e05e',
                    50, '#ed8936',
                    200, '#e53e3e'
                  ],
                  'circle-opacity': 0.8,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#1a202c'
                }} 
              />
            </Source>
          </>
        )}

        {/* VIEW 2: Hexbin Gap Analysis */}
        {viewMode === 'hexbin' && (
          <Source id="hexbins" type="geojson" data="/data/hexbin_transit_gaps.geojson">
            <Layer 
              id="hexbin-layer" 
              type="fill" 
              paint={{
                'fill-color': [
                  'interpolate', ['linear'], ['get', 'gap_score'],
                  0, '#3182ce',    // Good access or no jobs (blue)
                  10, '#9f7aea',   // Moderate gap (purple)
                  50, '#ed8936',   // High gap (orange)
                  200, '#e53e3e'   // Severe gap (red)
                ],
                'fill-opacity': 0.6,
                'fill-outline-color': '#ffffff'
              }} 
            />
          </Source>
        )}

        {/* VIEW 3: Stranded Jobs & 3-Ring Buffer */}
        {viewMode === 'stranded' && (
          <>
            <Source id="stranded-jobs" type="geojson" data="/data/stranded_jobs.geojson">
              <Layer 
                id="stranded-jobs-layer" 
                type="circle" 
                paint={{
                  'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    10, ['match', ['get', 'size'],
                      '500+', 6, '100-499', 5, '20-99', 4, '10-19', 3, '5-9', 2, 3],
                    15, ['match', ['get', 'size'],
                      '500+', 16, '100-499', 12, '20-99', 9, '10-19', 7, '5-9', 5, 6]
                  ],
                  'circle-color': [
                    'step', ['get', 'transit_buffer_score'],
                    '#9b2c2c', // < 0.1 (i.e. 0.0, > 800m)
                    0.1, '#e53e3e', // >= 0.1 (i.e. 600-800m)
                    0.5, '#ed8936', // >= 0.5 (i.e. 400-600m)
                    1.0, '#a0aec0'  // >= 1.0 (fallback)
                  ],
                  'circle-opacity': 0.85,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#fff'
                }} 
              />
            </Source>
          </>
        )}
        
        {/* Hover Info Tooltip */}
        {hoverInfo && (() => {
          const isStranded = hoverInfo.feature.source === 'stranded-jobs';
          const score = hoverInfo.feature.properties.transit_buffer_score;
          const distColor = score >= 0.5 ? '#ed8936' : score >= 0.1 ? '#e53e3e' : '#9b2c2c';
          const tooltipClass = isStranded
            ? 'absolute bg-white text-gray-900 p-3 rounded-lg shadow-xl text-sm border border-gray-200 pointer-events-none'
            : 'absolute bg-slate-900/90 text-white p-3 rounded-lg shadow-xl text-sm border border-white/10 pointer-events-none';

          return (
            <div className={tooltipClass} style={{left: hoverInfo.x + 15, top: hoverInfo.y + 15, zIndex: 1000}}>
              {hoverInfo.feature.source === 'bus-stops' && (
                <>
                  <div className="font-bold mb-1">{hoverInfo.feature.properties.stop_name || 'Bus Stop'}</div>
                  <div>Stop ID: {hoverInfo.feature.properties.stop_id}</div>
                  <div className="text-aurora-orange font-semibold">Jobs within 400m: {hoverInfo.feature.properties.jobs_within_400m}</div>
                </>
              )}
              {hoverInfo.feature.source === 'jobs' && (
                <>
                  <div className="font-bold mb-1">{hoverInfo.feature.properties.name}</div>
                  <div>Sector: {hoverInfo.feature.properties.sector}</div>
                  <div>Tier: {hoverInfo.feature.properties.tier}</div>
                </>
              )}
              {isStranded && (
                <>
                  <div className="font-bold mb-1 text-gray-900">{hoverInfo.feature.properties.name}</div>
                  <div className="text-gray-600">Sector: {hoverInfo.feature.properties.sector}</div>
                  <div className="text-gray-600">Size: {hoverInfo.feature.properties.size} employees</div>
                  {hoverInfo.feature.properties.nearest_stop_dist !== undefined && (
                    <div className="mt-1.5 font-bold" style={{color: distColor}}>
                      {Math.round(hoverInfo.feature.properties.nearest_stop_dist)}m to nearest stop
                    </div>
                  )}
                </>
              )}
              {hoverInfo.feature.source === 'hexbins' && (
                <>
                  <div className="font-bold mb-1">Grid Hexagon: {hoverInfo.feature.properties.hex_id}</div>
                  <div>Total Jobs: {hoverInfo.feature.properties.jobs}</div>
                  <div>Total Stops: {hoverInfo.feature.properties.stops}</div>
                  <div className="text-aurora-orange font-semibold mt-1">Gap Score: {hoverInfo.feature.properties.gap_score}</div>
                </>
              )}
            </div>
          );
        })()}
      </Map>
    </div>
  );
}
