// @ts-nocheck
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Map, { MapRef, NavigationControl } from 'react-map-gl/mapbox';
import { Play, Pause, RotateCcw, Maximize, Minimize, Clock, Bus, Train, FastForward } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

// Color mappings matching specification
// 0: Bus (Navy), 1: Valley (Green), 2: Capital (Blue), 3: Metro (Red), 4: Regional (Orange)
const CATEGORY_COLORS = {
  0: { stroke: 'rgba(15, 23, 42, ', fill: '#0f172a', label: 'City Bus', name: 'Bus' },
  1: { stroke: 'rgba(16, 185, 129, ', fill: '#10b981', label: 'Valley Line LRT', name: 'Valley' },
  2: { stroke: 'rgba(37, 99, 235, ', fill: '#2563eb', label: 'Capital Line LRT', name: 'Capital' },
  3: { stroke: 'rgba(239, 68, 68, ', fill: '#ef4444', label: 'Metro Line LRT', name: 'Metro' },
  4: { stroke: 'rgba(249, 115, 22, ', fill: '#f97316', label: 'Regional Bus', name: 'Regional' }
};

const DURATION_24H_SEC = 86400; // 24 hours in seconds
const DEFAULT_LOOP_REAL_SEC = 60; // 24 hours replayed in 60s
const SIM_SPEED_BASE = DURATION_24H_SEC / DEFAULT_LOOP_REAL_SEC; // 1440 simulated seconds per real second
const TAIL_DURATION_SEC = 300; // 5 minutes tail history

function formatSecondsToClock(totalSeconds: number) {
  const clamped = Math.max(0, Math.min(86399, Math.floor(totalSeconds)));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const padM = m.toString().padStart(2, '0');
  const padS = s.toString().padStart(2, '0');
  return {
    timeStr: `${displayH}:${padM}:${padS} ${period}`,
    simpleTime: `${displayH}:${padM} ${period}`,
    h, m, s, period
  };
}

export default function DayInEdmontonView() {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulation Data
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('Downloading 24-hour simulation telemetry...');

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(60); // Start at 12:01 AM (60s)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'lrt' | 'bus' | 'regional'>('all');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Active vehicle counts
  const [activeCounts, setActiveCounts] = useState({
    total: 0,
    valley: 0,
    capital: 0,
    metro: 0,
    bus: 0,
    regional: 0
  });

  const animFrameId = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const currentTimeRef = useRef<number>(60);
  const isPlayingRef = useRef<boolean>(false);
  const speedMultiplierRef = useRef<number>(1.0);

  // Keep refs in sync for the animation loop
  currentTimeRef.current = currentTimeSec;
  isPlayingRef.current = isPlaying;
  speedMultiplierRef.current = speedMultiplier;

  // Initial map center on Edmonton
  const [viewState, setViewState] = useState({
    longitude: -113.4938,
    latitude: 53.5461,
    zoom: 11.2,
    pitch: 0,
    bearing: 0
  });

  // Load GTFS simulation JSON
  useEffect(() => {
    setLoading(true);
    setLoadingProgress('Loading Wednesday schedule telemetry...');
    
    fetch('/data/ets_day_simulation.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load simulation data:', err);
        setLoadingProgress('Error loading simulation dataset.');
      });
  }, []);

  // Resize canvas when container or viewport changes
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(resizeCanvas, 150);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [resizeCanvas]);

  // Render Frame onto Canvas
  const renderSimulationFrame = useCallback((tSec: number) => {
    const canvas = canvasRef.current;
    const map = mapRef.current?.getMap();
    if (!canvas || !map || !data || !data.trajectories) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const zoom = map.getZoom();
    // Dynamic dot radius scaling based on zoom level:
    // At zoom 9 -> ~1.2px, at zoom 11.5 -> ~2.8px, at zoom 15+ -> ~6.5px
    const zoomScale = Math.max(0.6, Math.min(2.8, (zoom - 8.0) * 0.35 + 0.6));
    const busRadius = 2.2 * zoomScale * dpr;
    const lrtRadius = 3.5 * zoomScale * dpr;
    const regionalRadius = 2.6 * zoomScale * dpr;

    const interval = data.interval || 20;
    const tailSteps = Math.ceil(TAIL_DURATION_SEC / interval); // ~15 steps for 5 min tail

    let countTotal = 0;
    let countValley = 0;
    let countCapital = 0;
    let countMetro = 0;
    let countBus = 0;
    let countRegional = 0;

    const trajectories = data.trajectories;
    const filter = selectedFilter;

    for (let i = 0; i < trajectories.length; i++) {
      const trip = trajectories[i];
      const cat = trip.c;

      // Filter check
      if (filter === 'lrt' && cat !== 1 && cat !== 2 && cat !== 3) continue;
      if (filter === 'bus' && cat !== 0) continue;
      if (filter === 'regional' && cat !== 4) continue;

      const s = trip.s;
      const pts = trip.pts;
      const numPts = pts.length;
      const tripDuration = (numPts - 1) * interval;
      const e = s + tripDuration;

      // Check if trip is active or within tail window
      if (tSec < s || tSec > e + TAIL_DURATION_SEC) continue;

      const exactIdx = (tSec - s) / interval;
      const isCurrentlyActive = tSec <= e;

      if (isCurrentlyActive) {
        countTotal++;
        if (cat === 1) countValley++;
        else if (cat === 2) countCapital++;
        else if (cat === 3) countMetro++;
        else if (cat === 4) countRegional++;
        else countBus++;
      }

      // Compute tail points
      const startTailIdx = Math.max(0, Math.floor(exactIdx - tailSteps));
      const endTailIdx = Math.min(numPts - 1, Math.floor(exactIdx));

      const style = CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS[0];
      const strokeBase = style.stroke;

      // 1. Draw Tail Streak (5-minute historical path fading to 0 opacity)
      if (endTailIdx > startTailIdx) {
        ctx.lineWidth = (cat === 1 || cat === 2 || cat === 3 ? 2.5 : 1.5) * zoomScale * dpr;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let ptIdx = startTailIdx; ptIdx < endTailIdx; ptIdx++) {
          const ptA = pts[ptIdx];
          const ptB = pts[ptIdx + 1];
          const pA = map.project([ptA[0], ptA[1]]);
          const pB = map.project([ptB[0], ptB[1]]);

          // Skip if out of viewport bounds
          if (
            (pA.x < -50 && pB.x < -50) ||
            (pA.x > canvas.width / dpr + 50 && pB.x > canvas.width / dpr + 50) ||
            (pA.y < -50 && pB.y < -50) ||
            (pA.y > canvas.height / dpr + 50 && pB.y > canvas.height / dpr + 50)
          ) {
            continue;
          }

          // Age in seconds from current time
          const ptTime = s + ptIdx * interval;
          const ageSec = tSec - ptTime;
          // Opacity decreases linearly with age from 0.85 down to 0 at 300s
          const alpha = Math.max(0, Math.min(0.85, (1 - (ageSec / TAIL_DURATION_SEC)) * 0.85));

          ctx.beginPath();
          ctx.strokeStyle = `${strokeBase}${alpha.toFixed(2)})`;
          ctx.moveTo(pA.x * dpr, pA.y * dpr);
          ctx.lineTo(pB.x * dpr, pB.y * dpr);
          ctx.stroke();
        }
      }

      // 2. Draw Current Vehicle Head Dot (if vehicle is currently actively on route)
      if (isCurrentlyActive && exactIdx >= 0 && exactIdx < numPts) {
        const floorIdx = Math.floor(exactIdx);
        const ceilIdx = Math.min(numPts - 1, floorIdx + 1);
        const frac = exactIdx - floorIdx;

        const pt0 = pts[floorIdx];
        const pt1 = pts[ceilIdx];

        const currLon = pt0[0] + frac * (pt1[0] - pt0[0]);
        const currLat = pt0[1] + frac * (pt1[1] - pt0[1]);

        const screenPos = map.project([currLon, currLat]);
        const sx = screenPos.x * dpr;
        const sy = screenPos.y * dpr;

        // Skip if outside viewport
        if (sx < -20 || sx > canvas.width + 20 || sy < -20 || sy > canvas.height + 20) {
          continue;
        }

        const rad = (cat === 1 || cat === 2 || cat === 3) ? lrtRadius : (cat === 4 ? regionalRadius : busRadius);

        // Subtle glow ring for LRT vehicles
        if (cat === 1 || cat === 2 || cat === 3) {
          ctx.beginPath();
          ctx.arc(sx, sy, rad * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `${strokeBase}0.28)`;
          ctx.fill();
        }

        // Solid core dot
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = style.fill;
        ctx.fill();

        // White border for crisp separation on light map
        ctx.lineWidth = 1 * dpr;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }

    setActiveCounts({
      total: countTotal,
      valley: countValley,
      capital: countCapital,
      metro: countMetro,
      bus: countBus,
      regional: countRegional
    });
  }, [data, selectedFilter]);

  // Main 60 FPS Animation Loop
  const animate = useCallback((timestamp: number) => {
    if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
    const deltaMs = timestamp - lastTimestampRef.current;
    lastTimestampRef.current = timestamp;

    if (isPlayingRef.current) {
      // Advance simulation time
      const deltaSimSec = (deltaMs / 1000.0) * SIM_SPEED_BASE * speedMultiplierRef.current;
      let nextTime = currentTimeRef.current + deltaSimSec;
      if (nextTime >= DURATION_24H_SEC) {
        nextTime = 60; // Loop back to 12:01 AM
      }
      currentTimeRef.current = nextTime;
      setCurrentTimeSec(nextTime);
    }

    renderSimulationFrame(currentTimeRef.current);
    animFrameId.current = requestAnimationFrame(animate);
  }, [renderSimulationFrame]);

  // Start animation loop on mount
  useEffect(() => {
    lastTimestampRef.current = performance.now();
    animFrameId.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [animate]);

  // Redraw canvas whenever map moves or zooms
  const handleMapMove = () => {
    renderSimulationFrame(currentTimeRef.current);
  };

  // Play / Pause toggle
  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  // Reset to 12:01 AM
  const handleReset = () => {
    currentTimeRef.current = 60;
    setCurrentTimeSec(60);
    renderSimulationFrame(60);
  };

  // Scrubber change
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = parseFloat(e.target.value);
    currentTimeRef.current = newSec;
    setCurrentTimeSec(newSec);
    renderSimulationFrame(newSec);
  };

  const clock = useMemo(() => formatSecondsToClock(currentTimeSec), [currentTimeSec]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[calc(100vh-76px)] bg-slate-100 overflow-hidden select-none font-sans"
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-1">A ETS Day in Edmonton</h3>
          <p className="text-sm text-slate-600 animate-pulse">{loadingProgress}</p>
        </div>
      )}

      {/* Mapbox Canvas Container */}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => {
          setViewState(evt.viewState);
          handleMapMove();
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        minZoom={9.5}
        maxZoom={16.5}
      >
        <NavigationControl position="top-right" />
      </Map>

      {/* High-Performance Canvas Overlay for Vehicle Movement & Fading Tails */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />

      {/* Top Header & Live AM/PM Clock HUD */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg rounded-2xl p-4 min-w-[280px]">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">A ETS Day in Edmonton</h1>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">24-Hour Wednesday Motion</p>
            </div>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200/60 rounded-full">
              <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span className="text-xs font-mono font-bold text-blue-800">{clock.timeStr}</span>
            </div>
          </div>

          {/* Active Fleet Statistics */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-1">
            <div className="flex flex-col bg-slate-50 border border-slate-200/50 rounded-lg p-2 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500">Active Fleet</span>
              <span className="text-lg font-black text-slate-900 font-mono">{activeCounts.total}</span>
            </div>
            <div className="flex flex-col bg-emerald-50/70 border border-emerald-200/50 rounded-lg p-2 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-700">LRT Fleet</span>
              <span className="text-lg font-black text-emerald-800 font-mono">
                {activeCounts.valley + activeCounts.capital + activeCounts.metro}
              </span>
            </div>
            <div className="flex flex-col bg-slate-100/70 border border-slate-200/70 rounded-lg p-2 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-700">City Buses</span>
              <span className="text-lg font-black text-slate-800 font-mono">{activeCounts.bus}</span>
            </div>
          </div>

          {/* Interactive Legend & Service Breakdown */}
          <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-100/80 text-[11px] font-medium text-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0f172a]" />
              <span>Bus ({activeCounts.bus})</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-emerald-50 text-[11px] font-medium text-emerald-800 border border-emerald-200/50">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              <span>Valley ({activeCounts.valley})</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-blue-50 text-[11px] font-medium text-blue-800 border border-blue-200/50">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
              <span>Capital ({activeCounts.capital})</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-red-50 text-[11px] font-medium text-red-800 border border-red-200/50">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
              <span>Metro ({activeCounts.metro})</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-orange-50 text-[11px] font-medium text-orange-800 border border-orange-200/50">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
              <span>Regional ({activeCounts.regional})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Filter Selector */}
      <div className="absolute top-4 right-16 z-20 hidden md:flex items-center bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md rounded-xl p-1 gap-1">
        {(['all', 'lrt', 'bus', 'regional'] as const).map((filterKey) => (
          <button
            key={filterKey}
            onClick={() => setSelectedFilter(filterKey)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
              selectedFilter === filterKey
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {filterKey === 'all' ? 'All Vehicles' : filterKey === 'lrt' ? 'LRT Only' : filterKey === 'bus' ? 'Buses' : 'Regional'}
          </button>
        ))}
      </div>

      {/* Bottom Interactive Playback Deck */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 w-11/12 max-w-4xl">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-2xl rounded-2xl p-4 md:p-5 flex flex-col gap-3">
          {/* Top Control Bar: Buttons, Clock, Speed Multipliers */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Play / Pause Toggle Button */}
              <button
                onClick={togglePlayPause}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all ${
                  isPlaying
                    ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-400/30'
                    : 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-500/30'
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                <span>{isPlaying ? 'Pause' : 'Play Simulation'}</span>
              </button>

              {/* Reset to 12:01 AM */}
              <button
                onClick={handleReset}
                title="Restart from 12:01 AM"
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Current Timeline Display */}
            <div className="flex items-center space-x-2 font-mono text-center">
              <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{clock.timeStr}</span>
            </div>

            {/* Speed Multipliers & Fullscreen */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-xl p-0.5">
                {[0.5, 1.0, 2.0, 4.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeedMultiplier(s)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      speedMultiplier === s
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Time Scrubber Slider */}
          <div className="flex flex-col gap-1">
            <input
              type="range"
              min={60}
              max={86340}
              step={20}
              value={currentTimeSec}
              onChange={handleScrubberChange}
              className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 transition"
            />
            <div className="flex justify-between text-[11px] font-bold text-slate-400 px-0.5">
              <span>12:01 AM</span>
              <span>6:00 AM (Morning Rush)</span>
              <span>12:00 PM (Midday)</span>
              <span>5:00 PM (Evening Rush)</span>
              <span>11:59 PM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
