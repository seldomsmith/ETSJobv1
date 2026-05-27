'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import Link from 'next/link';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

const SIZE_STEPS = [
  { value: 0, label: '5', range: '5-9' },
  { value: 1, label: '10', range: '10-19' },
  { value: 2, label: '20', range: '20-99' },
  { value: 3, label: '100', range: '100-499' },
  { value: 4, label: '500+', range: '500+' }
];

export default function MarketResearchView() {
  const [viewState, setViewState] = useState({
    longitude: -113.4938,
    latitude: 53.5461,
    zoom: 11.2,
    pitch: 45,
    bearing: -10,
    padding: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  const [leadsData, setLeadsData] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [excludeHybrid, setExcludeHybrid] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'all' | '1' | '2' | '3'>('all');
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  
  // Logarithmic-Snapping Size Slider Indexes (0-4)
  const [minSizeIdx, setMinSizeIdx] = useState(0);
  const [maxSizeIdx, setMaxSizeIdx] = useState(4);

  // Load B2B leads on mount
  useEffect(() => {
    fetch('/data/ets_at_work_leads.geojson')
      .then(r => r.json())
      .then(data => setLeadsData(data))
      .catch(err => console.error("Error loading leads:", err));
  }, []);

  // Sync size limits
  const handleMinSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(parseInt(e.target.value), maxSizeIdx);
    setMinSizeIdx(value);
  };

  const handleMaxSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(parseInt(e.target.value), minSizeIdx);
    setMaxSizeIdx(value);
  };

  // Autocomplete Suggestions
  const searchSuggestions = useMemo(() => {
    if (!leadsData || !searchQuery || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    const matches: any[] = [];
    for (const f of leadsData.features) {
      if (f.properties.name.toLowerCase().includes(query)) {
        matches.push(f);
        if (matches.length >= 5) break;
      }
    }
    return matches;
  }, [leadsData, searchQuery]);

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

  // Filter core leads features
  const filteredFeatures = useMemo(() => {
    if (!leadsData) return [];
    return leadsData.features.filter((f: any) => {
      const p = f.properties;

      // Text query search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesAddress = p.address.toLowerCase().includes(query);
        const matchesSector = p.sector.toLowerCase().includes(query);
        if (!matchesName && !matchesAddress && !matchesSector) return false;
      }

      // Snapping range matching
      const companySizeIndex = SIZE_STEPS.findIndex(step => step.range === p.size);
      if (companySizeIndex < minSizeIdx || companySizeIndex > maxSizeIdx) {
        return false;
      }

      // Hybrid work filter
      if (excludeHybrid && p.hybrid === 'Yes') return false;

      // Suitability tier filter
      if (selectedTier !== 'all' && String(p.tier) !== selectedTier) return false;

      return true;
    });
  }, [leadsData, searchQuery, minSizeIdx, maxSizeIdx, excludeHybrid, selectedTier]);

  // Convert points to 3D extruded Polygons on-the-fly (limited to 2500 for performance)
  const renderedGeoJSON = useMemo(() => {
    const subset = filteredFeatures.slice(0, 2500).map((f: any) => {
      const [lon, lat] = f.geometry.coordinates;
      const size = f.properties.size;

      // Define width base offsets based on size categories
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
      features: subset
    };
  }, [filteredFeatures]);

  return (
    <div className="relative w-full flex-1 h-[calc(100vh-76px)]">
      <Map
        {...viewState}
        onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={['ets-leads-layer']}
        onMouseMove={(evt: any) => {
          const feature = evt.features && evt.features[0];
          if (feature) {
            setHoverInfo({ feature, x: evt.point.x, y: evt.point.y });
          } else {
            setHoverInfo(null);
          }
        }}
        onMouseLeave={() => setHoverInfo(null)}
      >
        <NavigationControl position="top-left" />

        {/* Transit Routes Layer */}
        <Source id="routes" type="geojson" data="/data/routes.geojson">
          <Layer
            id="routes-layer"
            type="line"
            paint={{
              'line-color': [
                'match',
                ['get', 'type'],
                'LRT', '#ffd700',
                'High-Freq', '#f472b6',
                'Local', '#22d3ee',
                '#22d3ee'
              ],
              'line-opacity': 0.7,
              'line-width': 2.0
            }}
          />
        </Source>

        {/* 3D Extruded Pillars for Employers */}
        {renderedGeoJSON.features.length > 0 && (
          <Source id="ets_leads" type="geojson" data={renderedGeoJSON}>
            <Layer
              id="ets-leads-layer"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': [
                  'match',
                  ['get', 'tier'],
                  1, '#4ade80', // Tier 1 Green
                  2, '#eab308', // Tier 2 Yellow
                  3, '#ec4899', // Tier 3 Pink
                  '#cbd5e1'
                ],
                'fill-extrusion-height': [
                  'match',
                  ['get', 'size'],
                  '5-9', 80,
                  '10-19', 160,
                  '20-99', 400,
                  '100-499', 900,
                  '500+', 1800,
                  60
                ],
                'fill-extrusion-opacity': 0.85,
                'fill-extrusion-base': 0
              }}
            />
          </Source>
        )}
      </Map>

      {/* 🗺️ Floating Glassmorphic Filter Controls */}
      <div className={`absolute top-6 right-6 z-20 glass-card p-6 max-w-[340px] w-full pointer-events-auto h-auto max-h-[85vh] overflow-y-auto transition-all duration-500 transform ${isFiltersCollapsed ? 'translate-x-[120%] opacity-0' : 'translate-x-0'}`}>
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider block font-outfit">ETS@Work Research</span>
            <span className="bg-aurora-cyan/10 border border-aurora-cyan/30 text-aurora-cyan text-[10px] px-2 py-0.5 rounded font-mono font-bold">B2B</span>
          </div>
          <button onClick={() => setIsFiltersCollapsed(true)} className="text-slate-500 hover:text-white transition-colors bg-white/5 p-1 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Search Employers */}
        <div className="mb-5 relative">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-outfit">Search Employers</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Acme, Oliver..."
              className="w-full bg-slate-900/90 border border-white/10 rounded-lg py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-aurora-cyan/50"
            />
            <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Suggestions Autocomplete */}
          {searchSuggestions.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-slate-950 border border-white/10 rounded-lg shadow-2xl max-h-[180px] overflow-y-auto">
              {searchSuggestions.map((s: any, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0 flex flex-col gap-0.5"
                >
                  <span className="font-bold text-white truncate">{s.properties.name}</span>
                  <span className="text-slate-500 truncate text-[10px]">{s.properties.address}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ⚡ Custom Dual Snapping Logarithmic Size Slider */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-outfit">
            Employer Size Limits: <span className="text-aurora-cyan font-bold">{SIZE_STEPS[minSizeIdx].label} - {SIZE_STEPS[maxSizeIdx].label}</span>
          </label>

          <div className="relative pt-4 pb-2 px-1">
            {/* Overlapping Range Sliders */}
            <div className="relative h-2 w-full rounded bg-slate-800">
              {/* Active selection bar */}
              <div
                className="absolute h-2 bg-aurora-gradient rounded"
                style={{
                  left: `${(minSizeIdx / 4) * 100}%`,
                  right: `${100 - (maxSizeIdx / 4) * 100}%`
                }}
              />

              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={minSizeIdx}
                onChange={handleMinSliderChange}
                className="absolute pointer-events-none appearance-none bg-transparent w-full h-2 top-0 left-0 z-20 outline-none range-thumb-cyan"
              />

              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={maxSizeIdx}
                onChange={handleMaxSliderChange}
                className="absolute pointer-events-none appearance-none bg-transparent w-full h-2 top-0 left-0 z-20 outline-none range-thumb-cyan"
              />
            </div>

            {/* Slider scale labels */}
            <div className="flex justify-between mt-3 text-[10px] text-slate-500 font-bold px-0.5">
              {SIZE_STEPS.map((step) => (
                <span
                  key={step.value}
                  className={`cursor-pointer transition-colors ${
                    step.value >= minSizeIdx && step.value <= maxSizeIdx
                      ? 'text-aurora-cyan font-extrabold'
                      : 'text-slate-600'
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Priority Tier Selectors */}
        <div className="mb-5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-outfit">Priority Suitability Tiers</label>
          <div className="flex flex-col gap-1.5">
            {([
              { key: 'all', label: 'All Targets', colorClass: 'bg-slate-400' },
              { key: '1', label: 'Tier 1 • Prime Targets', colorClass: 'bg-aurora-lime' },
              { key: '2', label: 'Tier 2 • Good Targets', colorClass: 'bg-yellow-400' },
              { key: '3', label: 'Tier 3 • Challenging', colorClass: 'bg-aurora-pink' }
            ] as const).map(({ key, label, colorClass }) => (
              <button
                key={key}
                onClick={() => setSelectedTier(key)}
                className={`text-xs py-1.5 px-3 rounded-lg text-left font-bold transition-all border flex items-center gap-2 ${
                  selectedTier === key
                    ? 'bg-white/5 border-white/20 text-white'
                    : 'bg-slate-900/60 border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${colorClass} shadow-sm`} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Exclude Hybrid Offices Toggle */}
        <div className="mb-6 flex items-center justify-between border-t border-white/5 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-slate-300 font-outfit">Exclude Hybrid Work</span>
            <span className="text-[10px] text-slate-500">Focus on daily commuters</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={excludeHybrid}
              onChange={(e) => setExcludeHybrid(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-900 rounded-full peer peer-checked:bg-aurora-cyan after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-slate-950"></div>
          </label>
        </div>

        {/* Stats Bar */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-white/5 mb-5 font-outfit">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Matched Employers</span>
            <span className="text-xs font-mono font-bold text-aurora-cyan">
              {filteredFeatures.length.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-aurora-gradient h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, leadsData ? (filteredFeatures.length / leadsData.features.length) * 100 : 0)}%`
              }}
            />
          </div>
          <span className="text-[9px] text-slate-500 block mt-1.5">
            * Displaying top 2,500 active features on map for 60fps
          </span>
        </div>

        {/* 📋 Large Call-to-Action to Full Lead Table */}
        <Link
          href="/dashboard"
          className="w-full py-3 rounded-xl bg-aurora-cyan text-slate-950 text-xs font-extrabold shadow-lg shadow-aurora-cyan/20 hover:scale-102 hover:shadow-aurora-cyan/30 transition-all flex items-center justify-center gap-2 font-outfit"
        >
          <span>Open Prospect Finder Table</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </Link>
      </div>

      {/* Collapsed Filters Icon */}
      {isFiltersCollapsed && (
        <button
          onClick={() => setIsFiltersCollapsed(false)}
          className="absolute top-6 right-6 z-20 p-2.5 glass-card rounded-lg flex items-center justify-center text-slate-400 hover:text-white pointer-events-auto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}

      {/* Floating Tooltip */}
      {hoverInfo && hoverInfo.feature && (
        <div
          className="absolute pointer-events-none z-50 glass-card p-4 min-w-[250px] shadow-2xl"
          style={{ left: hoverInfo.x + 15, top: hoverInfo.y + 15 }}
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1 font-outfit font-bold">
            Tier {hoverInfo.feature.properties.tier} Target • {hoverInfo.feature.properties.size} Employees
          </span>
          <h3 className="text-xs font-extrabold text-white mb-2 leading-snug font-outfit">{hoverInfo.feature.properties.name}</h3>

          <div className="w-full bg-white/5 h-[1px] mb-2.5" />

          <div className="flex flex-col gap-1.5 text-[10px] font-outfit">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 font-bold uppercase">Address:</span>
              <span className="text-slate-300 truncate max-w-[145px] text-right font-medium">
                {hoverInfo.feature.properties.address}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 font-bold uppercase">Sector:</span>
              <span className="text-slate-300 truncate max-w-[145px] text-right font-medium">
                {hoverInfo.feature.properties.sector}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 font-bold uppercase">Hybrid Work:</span>
              <span className={`font-extrabold ${hoverInfo.feature.properties.hybrid === 'Yes' ? 'text-aurora-pink' : 'text-aurora-cyan'}`}>
                {hoverInfo.feature.properties.hybrid}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-2 mt-1">
              <span className="text-slate-400 font-bold uppercase">Transit Score:</span>
              <span className="font-extrabold text-aurora-lime text-xs">
                {(hoverInfo.feature.properties.transit_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase">Priority Score:</span>
              <span className="font-extrabold text-aurora-cyan text-xs">
                {hoverInfo.feature.properties.lead_score?.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
