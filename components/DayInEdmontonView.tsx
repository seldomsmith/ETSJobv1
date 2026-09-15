// @ts-nocheck
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Map, { MapRef, NavigationControl } from 'react-map-gl/mapbox';
import { 
  Play, Pause, RotateCcw, Maximize, Minimize, Clock, Bus, Train, 
  FastForward, Compass, Eye, X, Activity, Gauge, Navigation, Sparkles, Video
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

const CATEGORY_COLORS = {
  day: {
    0: { stroke: 'rgba(15, 23, 42, ', fill: '#0f172a', label: 'City Bus' },
    1: { stroke: 'rgba(16, 185, 129, ', fill: '#10b981', label: 'Valley Line LRT' },
    2: { stroke: 'rgba(37, 99, 235, ', fill: '#2563eb', label: 'Capital Line LRT' },
    3: { stroke: 'rgba(239, 68, 68, ', fill: '#ef4444', label: 'Metro Line LRT' },
    4: { stroke: 'rgba(249, 115, 22, ', fill: '#f97316', label: 'Regional Bus' }
  },
  night: {
    0: { stroke: 'rgba(56, 189, 248, ', fill: '#38bdf8', label: 'City Bus' },
    1: { stroke: 'rgba(52, 211, 153, ', fill: '#34d399', label: 'Valley Line LRT' },
    2: { stroke: 'rgba(96, 165, 250, ', fill: '#60a5fa', label: 'Capital Line LRT' },
    3: { stroke: 'rgba(248, 113, 113, ', fill: '#f87171', label: 'Metro Line LRT' },
    4: { stroke: 'rgba(251, 146, 60, ', fill: '#fb923c', label: 'Regional Bus' }
  }
};

const DURATION_24H_SEC = 86400;
const DEFAULT_LOOP_REAL_SEC = 60;
const SIM_SPEED_BASE = DURATION_24H_SEC / DEFAULT_LOOP_REAL_SEC;
const TAIL_DURATION_SEC = 300;

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

function getDaylightFactor(tSec: number): number {
  const h = tSec / 3600.0;
  if (h >= 7.0 && h <= 19.5) return 1.0;
  if (h > 19.5 && h <= 21.5) return 1.0 - (h - 19.5) / 2.0;
  if (h > 21.5 || h < 5.0) return 0.0;
  if (h >= 5.0 && h < 7.0) return (h - 5.0) / 2.0;
  return 1.0;
}

const DIRECTOR_HOTSPOTS = [
  { startH: 6.5, endH: 9.5, name: 'Downtown & University Morning Rush', lng: -113.515, lat: 53.535, zoom: 13.5, pitch: 45, bearing: -20 },
  { startH: 9.5, endH: 14.5, name: 'Central High-Frequency Grid', lng: -113.498, lat: 53.546, zoom: 13.8, pitch: 48, bearing: 15 },
  { startH: 14.5, endH: 18.5, name: 'South Campus & Mill Woods Evening Rush', lng: -113.505, lat: 53.490, zoom: 13.2, pitch: 45, bearing: -30 },
  { startH: 18.5, endH: 23.9, name: 'Whyte & Jasper Evening Corridors', lng: -113.500, lat: 53.530, zoom: 14.0, pitch: 50, bearing: 45 },
  { startH: 0.0, endH: 6.5, name: 'Citywide Night Network', lng: -113.4938, lat: 53.5461, zoom: 11.5, pitch: 35, bearing: 0 }
];

export default function DayInEdmontonView() {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('Downloading 24-hour simulation telemetry...');

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(60);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'lrt' | 'bus' | 'regional'>('all');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [isDirectorMode, setIsDirectorMode] = useState<boolean>(false);
  const [chaseTripIndex, setChaseTripIndex] = useState<number | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);

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
  const isDirectorRef = useRef<boolean>(false);
  const chaseIndexRef = useRef<number | null>(null);

  currentTimeRef.current = currentTimeSec;
  isPlayingRef.current = isPlaying;
  speedMultiplierRef.current = speedMultiplier;
  isDirectorRef.current = isDirectorMode;
  chaseIndexRef.current = chaseTripIndex;

  const [viewState, setViewState] = useState({
    longitude: -113.4938,
    latitude: 53.5461,
    zoom: 11.2,
    pitch: 0,
    bearing: 0
  });

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

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const map = mapRef.current?.getMap();
    if (!canvas || !map || !data || !data.trajectories) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const tSec = currentTimeRef.current;
    const interval = data.interval || 20;
    const trajectories = data.trajectories;

    let closestDist = 24;
    let hitTrip: any = null;
    let hitIndex: number | null = null;

    for (let i = 0; i < trajectories.length; i++) {
      const trip = trajectories[i];
      const s = trip.s;
      const pts = trip.pts;
      const eTime = s + (pts.length - 1) * interval;
      if (tSec < s || tSec > eTime) continue;

      const exactIdx = (tSec - s) / interval;
      const fIdx = Math.floor(exactIdx);
      const cIdx = Math.min(pts.length - 1, fIdx + 1);
      const frac = exactIdx - fIdx;

      const lon = pts[fIdx][0] + frac * (pts[cIdx][0] - pts[fIdx][0]);
      const lat = pts[fIdx][1] + frac * (pts[cIdx][1] - pts[fIdx][1]);
      const p = map.project([lon, lat]);

      const dist = Math.hypot(p.x - clickX, p.y - clickY);
      if (dist < closestDist) {
        closestDist = dist;
        hitTrip = trip;
        hitIndex = i;
      }
    }

    if (hitTrip && hitIndex !== null) {
      setSelectedVehicle({ trip: hitTrip, index: hitIndex });
    } else {
      if (!isDirectorRef.current && chaseIndexRef.current === null) {
        setSelectedVehicle(null);
      }
    }
  };

  const renderSimulationFrame = useCallback((tSec: number) => {
    const canvas = canvasRef.current;
    const map = mapRef.current?.getMap();
    if (!canvas || !map || !data || !data.trajectories) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const daylightFactor = getDaylightFactor(tSec);
    const isNight = daylightFactor < 0.55;
    const activePalette = isNight ? CATEGORY_COLORS.night : CATEGORY_COLORS.day;

    const zoom = map.getZoom();
    const zoomScale = Math.max(0.6, Math.min(2.8, (zoom - 8.0) * 0.35 + 0.6));
    const busRadius = 2.4 * zoomScale * dpr;
    const lrtRadius = 3.8 * zoomScale * dpr;
    const regionalRadius = 2.8 * zoomScale * dpr;

    const interval = data.interval || 20;
    const tailSteps = Math.ceil(TAIL_DURATION_SEC / interval);

    let countTotal = 0;
    let countValley = 0;
    let countCapital = 0;
    let countMetro = 0;
    let countBus = 0;
    let countRegional = 0;

    const trajectories = data.trajectories;
    const filter = selectedFilter;
    const selectedIdx = selectedVehicle?.index;

    if (chaseIndexRef.current !== null && trajectories[chaseIndexRef.current]) {
      const chaseTrip = trajectories[chaseIndexRef.current];
      const s = chaseTrip.s;
      const pts = chaseTrip.pts;
      const eTime = s + (pts.length - 1) * interval;

      if (tSec >= s && tSec <= eTime) {
        const exactIdx = (tSec - s) / interval;
        const fIdx = Math.floor(exactIdx);
        const cIdx = Math.min(pts.length - 1, fIdx + 1);
        const frac = exactIdx - fIdx;

        const currLon = pts[fIdx][0] + frac * (pts[cIdx][0] - pts[fIdx][0]);
        const currLat = pts[fIdx][1] + frac * (pts[cIdx][1] - pts[fIdx][1]);

        const dLon = pts[cIdx][0] - pts[fIdx][0];
        const dLat = pts[cIdx][1] - pts[fIdx][1];
        let bearing = 0;
        if (Math.hypot(dLon, dLat) > 0.00001) {
          bearing = (Math.atan2(dLon, dLat) * 180) / Math.PI;
        }

        map.easeTo({
          center: [currLon, currLat],
          zoom: 15.2,
          pitch: 50,
          bearing: bearing,
          duration: 30
        });
      } else {
        setChaseTripIndex(null);
      }
    } else if (isDirectorRef.current) {
      const simH = (tSec % 86400) / 3600.0;
      const targetHotspot = DIRECTOR_HOTSPOTS.find(h => simH >= h.startH && simH < h.endH) || DIRECTOR_HOTSPOTS[0];
      map.easeTo({
        center: [targetHotspot.lng, targetHotspot.lat],
        zoom: targetHotspot.zoom,
        pitch: targetHotspot.pitch,
        bearing: targetHotspot.bearing + Math.sin(tSec * 0.02) * 8,
        duration: 100
      });
    }

    for (let i = 0; i < trajectories.length; i++) {
      const trip = trajectories[i];
      const cat = trip.c;

      if (filter === 'lrt' && cat !== 1 && cat !== 2 && cat !== 3) continue;
      if (filter === 'bus' && cat !== 0) continue;
      if (filter === 'regional' && cat !== 4) continue;

      const s = trip.s;
      const pts = trip.pts;
      const numPts = pts.length;
      const tripDuration = (numPts - 1) * interval;
      const eTime = s + tripDuration;

      if (tSec < s || tSec > eTime + TAIL_DURATION_SEC) continue;

      const exactIdx = (tSec - s) / interval;
      const isCurrentlyActive = tSec <= eTime;

      if (isCurrentlyActive) {
        countTotal++;
        if (cat === 1) countValley++;
        else if (cat === 2) countCapital++;
        else if (cat === 3) countMetro++;
        else if (cat === 4) countRegional++;
        else countBus++;
      }

      const startTailIdx = Math.max(0, Math.floor(exactIdx - tailSteps));
      const endTailIdx = Math.min(numPts - 1, Math.floor(exactIdx));

      const style = activePalette[cat as keyof typeof activePalette] || activePalette[0];
      const strokeBase = style.stroke;

      if (endTailIdx > startTailIdx) {
        ctx.lineWidth = (cat === 1 || cat === 2 || cat === 3 ? 2.8 : 1.6) * zoomScale * dpr;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let ptIdx = startTailIdx; ptIdx < endTailIdx; ptIdx++) {
          const ptA = pts[ptIdx];
          const ptB = pts[ptIdx + 1];
          const pA = map.project([ptA[0], ptA[1]]);
          const pB = map.project([ptB[0], ptB[1]]);

          if (
            (pA.x < -50 && pB.x < -50) ||
            (pA.x > canvas.width / dpr + 50 && pB.x > canvas.width / dpr + 50) ||
            (pA.y < -50 && pB.y < -50) ||
            (pA.y > canvas.height / dpr + 50 && pB.y > canvas.height / dpr + 50)
          ) {
            continue;
          }

          const ptTime = s + ptIdx * interval;
          const ageSec = tSec - ptTime;
          const maxAlpha = isNight ? 0.95 : 0.85;
          const alpha = Math.max(0, Math.min(maxAlpha, (1 - (ageSec / TAIL_DURATION_SEC)) * maxAlpha));

          ctx.beginPath();
          ctx.strokeStyle = `${strokeBase}${alpha.toFixed(2)})`;
          ctx.moveTo(pA.x * dpr, pA.y * dpr);
          ctx.lineTo(pB.x * dpr, pB.y * dpr);
          ctx.stroke();
        }
      }

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

        if (sx < -40 || sx > canvas.width + 40 || sy < -40 || sy > canvas.height + 40) {
          continue;
        }

        const rad = (cat === 1 || cat === 2 || cat === 3) ? lrtRadius : (cat === 4 ? regionalRadius : busRadius);

        const pAhead = map.project([pt1[0], pt1[1]]);
        const angle = Math.atan2((pAhead.y - screenPos.y), (pAhead.x - screenPos.x));

        if (isNight) {
          const beamLen = (18 + zoom * 2.2) * dpr;
          const beamHalfAngle = 0.30;

          const grad = ctx.createRadialGradient(sx, sy, 2 * dpr, sx, sy, beamLen);
          grad.addColorStop(0, 'rgba(255, 255, 230, 0.45)');
          grad.addColorStop(0.5, 'rgba(255, 255, 200, 0.18)');
          grad.addColorStop(1, 'rgba(255, 255, 200, 0.0)');

          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, beamLen, angle - beamHalfAngle, angle + beamHalfAngle);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
        }

        if (isNight || cat === 1 || cat === 2 || cat === 3) {
          ctx.beginPath();
          ctx.arc(sx, sy, rad * (isNight ? 2.2 : 1.8), 0, Math.PI * 2);
          ctx.fillStyle = `${strokeBase}${isNight ? '0.38' : '0.25'})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = style.fill;
        ctx.fill();

        ctx.lineWidth = 1.2 * dpr;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        if (selectedIdx === i) {
          const reticleRad = (rad * 2.8) + Math.sin(tSec * 4) * 2 * dpr;
          ctx.beginPath();
          ctx.arc(sx, sy, reticleRad, 0, Math.PI * 2);
          ctx.lineWidth = 2 * dpr;
          ctx.strokeStyle = '#f59e0b';
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(sx, sy, reticleRad * 1.3, 0, Math.PI * 2);
          ctx.lineWidth = 1 * dpr;
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.stroke();
        }
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
  }, [data, selectedFilter, selectedVehicle]);

  const animate = useCallback((timestamp: number) => {
    if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
    const deltaMs = timestamp - lastTimestampRef.current;
    lastTimestampRef.current = timestamp;

    if (isPlayingRef.current) {
      const deltaSimSec = (deltaMs / 1000.0) * SIM_SPEED_BASE * speedMultiplierRef.current;
      let nextTime = currentTimeRef.current + deltaSimSec;
      if (nextTime >= DURATION_24H_SEC) {
        nextTime = 60;
      }
      currentTimeRef.current = nextTime;
      setCurrentTimeSec(nextTime);
    }

    renderSimulationFrame(currentTimeRef.current);
    animFrameId.current = requestAnimationFrame(animate);
  }, [renderSimulationFrame]);

  useEffect(() => {
    lastTimestampRef.current = performance.now();
    animFrameId.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [animate]);

  const handleMapMove = () => {
    renderSimulationFrame(currentTimeRef.current);
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    currentTimeRef.current = 60;
    setCurrentTimeSec(60);
    renderSimulationFrame(60);
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = parseFloat(e.target.value);
    currentTimeRef.current = newSec;
    setCurrentTimeSec(newSec);
    renderSimulationFrame(newSec);
  };

  const clock = useMemo(() => formatSecondsToClock(currentTimeSec), [currentTimeSec]);
  const daylight = useMemo(() => getDaylightFactor(currentTimeSec), [currentTimeSec]);
  const isNight = daylight < 0.55;

  const selectedTelemetry = useMemo(() => {
    if (!selectedVehicle || !data || !data.routes) return null;
    const trip = selectedVehicle.trip;
    const routeMeta = data.routes[trip.r] || {};
    const interval = data.interval || 20;
    const pts = trip.pts;
    const s = trip.s;
    const numPts = pts.length;
    const eTime = s + (numPts - 1) * interval;
    const tSec = currentTimeSec;

    const exactIdx = Math.max(0, Math.min(numPts - 1, (tSec - s) / interval));
    const fIdx = Math.floor(exactIdx);
    const cIdx = Math.min(numPts - 1, fIdx + 1);

    let speedKmh = 0;
    if (cIdx > fIdx && fIdx < numPts - 1) {
      const p0 = pts[fIdx];
      const p1 = pts[cIdx];
      const dKm = Math.hypot((p1[0] - p0[0]) * 66.5, (p1[1] - p0[1]) * 111.3);
      speedKmh = Math.round((dKm / (interval / 3600)) * 1.0);
      speedKmh = Math.max(0, Math.min(95, speedKmh));
    }

    const progressPct = Math.round(Math.max(0, Math.min(100, (exactIdx / (numPts - 1)) * 100)));
    const upcomingStops = (trip.st || []).filter((st: any) => st[0] >= tSec).slice(0, 3);

    return {
      routeTitle: routeMeta.title || `Route ${trip.r}`,
      headsign: trip.h || routeMeta.long || 'In Service',
      vtype: routeMeta.vtype || 'ETS Standard Vehicle',
      cat: trip.c,
      speedKmh,
      progressPct,
      upcomingStops,
      isFinished: tSec > eTime
    };
  }, [selectedVehicle, currentTimeSec, data]);

  return (
    <div 
      ref={containerRef}
      onClick={handleCanvasClick}
      className="relative w-full h-[calc(100vh-76px)] bg-slate-950 overflow-hidden select-none font-sans"
    >
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin mb-4" />
          <h3 className="text-xl font-bold text-white mb-1">A ETS Day in Edmonton</h3>
          <p className="text-sm text-cyan-300 animate-pulse">{loadingProgress}</p>
        </div>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => {
          setViewState(evt.viewState);
          handleMapMove();
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={isNight ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'}
        style={{ width: '100%', height: '100%' }}
        minZoom={9.5}
        maxZoom={16.5}
      >
        <NavigationControl position="top-right" />
      </Map>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />

      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
        <div className={`backdrop-blur-md border shadow-2xl rounded-2xl p-4 min-w-[290px] transition-all duration-500 ${
          isNight 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white/95 border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h1 className="text-lg font-black tracking-tight">A ETS Day in Edmonton</h1>
              </div>
              <p className="text-[11px] font-semibold opacity-60 uppercase tracking-wider">
                {isNight ? '🌙 Night Glow Telemetry' : '☀️ Daylight Street Grid'}
              </p>
            </div>
            <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border ${
              isNight 
                ? 'bg-cyan-950/80 border-cyan-800/80 text-cyan-300' 
                : 'bg-blue-50 border-blue-200/80 text-blue-800'
            }`}>
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-xs font-mono font-bold">{clock.timeStr}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-1">
            <div className={`flex flex-col border rounded-lg p-2 text-center ${
              isNight ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200/60'
            }`}>
              <span className="text-[10px] uppercase font-bold opacity-60">Active Fleet</span>
              <span className="text-lg font-black font-mono">{activeCounts.total}</span>
            </div>
            <div className="flex flex-col bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-500">LRT Fleet</span>
              <span className="text-lg font-black text-emerald-400 font-mono">
                {activeCounts.valley + activeCounts.capital + activeCounts.metro}
              </span>
            </div>
            <div className={`flex flex-col border rounded-lg p-2 text-center ${
              isNight ? 'bg-sky-500/10 border-sky-500/30 text-sky-300' : 'bg-slate-100/70 border-slate-200/70 text-slate-800'
            }`}>
              <span className="text-[10px] uppercase font-bold opacity-70">Buses</span>
              <span className="text-lg font-black font-mono">{activeCounts.bus}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-white/10">
            <div className={`flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-medium ${
              isNight ? 'bg-slate-800 text-sky-300' : 'bg-slate-100 text-slate-800'
            }`}>
              <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
              <span>Bus ({activeCounts.bus})</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-emerald-500/10 text-[11px] font-medium text-emerald-400 border border-emerald-500/30">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              <span>Valley ({activeCounts.valley})</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-blue-500/10 text-[11px] font-medium text-blue-400 border border-blue-500/30">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
              <span>Capital ({activeCounts.capital})</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-red-500/10 text-[11px] font-medium text-red-400 border border-red-500/30">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
              <span>Metro ({activeCounts.metro})</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-orange-500/10 text-[11px] font-medium text-orange-400 border border-orange-500/30">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
              <span>Regional ({activeCounts.regional})</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-16 z-20 hidden md:flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => {
            setIsDirectorMode(!isDirectorMode);
            setChaseTripIndex(null);
          }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg border ${
            isDirectorMode
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-400 ring-2 ring-purple-400/30 animate-pulse'
              : isNight
                ? 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:text-slate-900'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>{isDirectorMode ? 'Director 3D Active' : 'Director 3D Mode'}</span>
        </button>

        <div className={`flex items-center backdrop-blur-md border shadow-md rounded-xl p-1 gap-1 ${
          isNight ? 'bg-slate-900/90 border-slate-700' : 'bg-white/95 border-slate-200'
        }`}>
          {(['all', 'lrt', 'bus', 'regional'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setSelectedFilter(filterKey)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
                selectedFilter === filterKey
                  ? isNight ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'bg-slate-900 text-white shadow-sm'
                  : isNight ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {filterKey === 'all' ? 'All' : filterKey === 'lrt' ? 'LRT Only' : filterKey === 'bus' ? 'Buses' : 'Regional'}
            </button>
          ))}
        </div>
      </div>

      {selectedVehicle && selectedTelemetry && (
        <div className="absolute top-4 right-4 md:right-4 z-30 w-80 max-w-[90vw] pointer-events-auto">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl rounded-2xl p-4 text-white animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-start justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full ${
                  selectedTelemetry.cat === 1 ? 'bg-emerald-500' :
                  selectedTelemetry.cat === 2 ? 'bg-blue-500' :
                  selectedTelemetry.cat === 3 ? 'bg-red-500' :
                  selectedTelemetry.cat === 4 ? 'bg-orange-500' : 'bg-sky-400'
                }`} />
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight text-white">{selectedTelemetry.routeTitle}</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{selectedTelemetry.headsign}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedVehicle(null);
                  setChaseTripIndex(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300">
              <span className="font-semibold text-slate-400">Fleet: </span>
              {selectedTelemetry.vtype}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <div className="flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center space-x-1 text-slate-400 text-[10px] font-bold uppercase">
                  <Gauge className="w-3 h-3 text-cyan-400" />
                  <span>Velocity</span>
                </div>
                <span className="text-xl font-black font-mono text-cyan-400 mt-0.5">
                  {selectedTelemetry.speedKmh} <span className="text-xs font-normal text-slate-400">km/h</span>
                </span>
              </div>
              <div className="flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center space-x-1 text-slate-400 text-[10px] font-bold uppercase">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span>Trip Progress</span>
                </div>
                <span className="text-xl font-black font-mono text-emerald-400 mt-0.5">
                  {selectedTelemetry.progressPct}%
                </span>
              </div>
            </div>

            {selectedTelemetry.upcomingStops.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Upcoming Stops</span>
                <div className="mt-1.5 space-y-1">
                  {selectedTelemetry.upcomingStops.map((st: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-800/40 border border-slate-800">
                      <span className="text-slate-300 font-medium truncate max-w-[180px]">{st[1]}</span>
                      <span className="text-[10px] font-mono text-slate-400">{formatSecondsToClock(st[0]).simpleTime}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 pt-2 border-t border-slate-800 flex gap-2">
              <button
                onClick={() => {
                  if (chaseTripIndex === selectedVehicle.index) {
                    setChaseTripIndex(null);
                  } else {
                    setChaseTripIndex(selectedVehicle.index);
                    setIsDirectorMode(false);
                  }
                }}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-bold transition shadow-md ${
                  chaseTripIndex === selectedVehicle.index
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/40'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{chaseTripIndex === selectedVehicle.index ? 'Release Chase' : 'Chase Vehicle (3D)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 w-11/12 max-w-4xl pointer-events-auto">
        <div className={`backdrop-blur-xl border shadow-2xl rounded-2xl p-4 md:p-5 flex flex-col gap-3 transition-all duration-500 ${
          isNight 
            ? 'bg-slate-900/90 border-slate-700/80 text-white' 
            : 'bg-white/95 border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
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

              <button
                onClick={handleReset}
                title="Restart from 12:01 AM"
                className={`p-2.5 rounded-xl transition ${
                  isNight ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-2 font-mono text-center">
              <span className="text-xl md:text-2xl font-black tracking-tight">{clock.timeStr}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className={`flex items-center border rounded-xl p-0.5 ${
                isNight ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
              }`}>
                {[0.5, 1.0, 2.0, 4.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeedMultiplier(s)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      speedMultiplier === s
                        ? isNight ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-white text-blue-700 shadow-sm font-black'
                        : isNight ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <button
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
                className={`p-2.5 rounded-xl transition ${
                  isNight ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <input
              type="range"
              min={60}
              max={86340}
              step={20}
              value={currentTimeSec}
              onChange={handleScrubberChange}
              className="w-full h-2.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 transition"
            />
            <div className="flex justify-between text-[11px] font-bold opacity-50 px-0.5">
              <span>12:01 AM (Night Glow)</span>
              <span>7:00 AM (Morning Rush)</span>
              <span>12:00 PM (Midday)</span>
              <span>5:00 PM (Evening Rush)</span>
              <span>11:59 PM (Night Glow)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
