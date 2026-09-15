// @ts-nocheck
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Map, { MapRef, NavigationControl, Layer } from 'react-map-gl/mapbox';
import { 
  Play, Pause, RotateCcw, Maximize, Minimize, Clock, Bus, Train, 
  FastForward, Compass, Eye, X, Activity, Gauge, Navigation, Sparkles, Video, Building2, Zap, Film
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VsZG9tc21pdGgiLCJhIjoiY21tdGY5bGxjMXg4YzJzb21mOTY4aTB2cyJ9.cLdZbTpTPB5196GaD7Vo-Q";

const DURATION_24H_SEC = 86400;
const DEFAULT_LOOP_REAL_SEC = 60;
const SIM_SPEED_BASE = DURATION_24H_SEC / DEFAULT_LOOP_REAL_SEC;
const TAIL_DURATION_SEC = 240; // 4 minutes
const START_TIME_SEC = 12600; // 3:30 AM

const SPEED_OPTIONS = [
  { label: 'Very Slow', mult: 0.25 },
  { label: 'Slow', mult: 0.5 },
  { label: 'Medium', mult: 1.0 },
  { label: 'Fast', mult: 2.0 },
  { label: 'Insane Speed', mult: 4.0 }
];

interface SolarAtmosphere {
  phaseName: string;
  darknessOpacity: number;
  sunGlowOpacity: number;
  sunDirection: 'east' | 'west' | 'none';
  sunXRatio: number;
  headlightIntensity: number;
  paletteBlend: number;
}

function getSolarAtmosphere(tSec: number): SolarAtmosphere {
  const H = (tSec % 86400) / 3600.0;

  if (H < 4.5) {
    return {
      phaseName: '🌙 Midnight Starlight',
      darknessOpacity: 0.78,
      sunGlowOpacity: 0.0,
      sunDirection: 'none',
      sunXRatio: 0.5,
      headlightIntensity: 1.0,
      paletteBlend: 1.0
    };
  } else if (H < 5.75) {
    const p = (H - 4.5) / 1.25;
    return {
      phaseName: '🌅 First Dawn (East)',
      darknessOpacity: 0.78 - p * 0.35,
      sunGlowOpacity: p * 0.5,
      sunDirection: 'east',
      sunXRatio: 0.95,
      headlightIntensity: 1.0 - p * 0.3,
      paletteBlend: 1.0 - p * 0.4
    };
  } else if (H < 7.5) {
    const p = (H - 5.75) / 1.75;
    const goldenPeak = Math.max(0, 1.0 - Math.abs(p - 0.4) * 1.8);
    return {
      phaseName: '✨ Golden Hour Sunrise (East)',
      darknessOpacity: (1.0 - p) * 0.43,
      sunGlowOpacity: goldenPeak * 0.85,
      sunDirection: 'east',
      sunXRatio: 0.88,
      headlightIntensity: Math.max(0, (1.0 - p) * 0.7),
      paletteBlend: Math.max(0, (1.0 - p) * 0.6)
    };
  } else if (H < 18.5) {
    return {
      phaseName: '☀️ Daylight Street Grid',
      darknessOpacity: 0.0,
      sunGlowOpacity: 0.0,
      sunDirection: 'none',
      sunXRatio: 0.5,
      headlightIntensity: 0.0,
      paletteBlend: 0.0
    };
  } else if (H < 20.5) {
    const p = (H - 18.5) / 2.0;
    const goldenPeak = Math.max(0, 1.0 - Math.abs(p - 0.45) * 1.7);
    return {
      phaseName: '🌇 Golden Hour Sunset (West)',
      darknessOpacity: p * 0.38,
      sunGlowOpacity: goldenPeak * 0.90,
      sunDirection: 'west',
      sunXRatio: 0.12,
      headlightIntensity: Math.min(1.0, Math.max(0, (p - 0.15) * 1.1)),
      paletteBlend: p * 0.65
    };
  } else if (H < 22.0) {
    const p = (H - 20.5) / 1.5;
    return {
      phaseName: '🌆 Twilight & Dusk',
      darknessOpacity: 0.38 + p * 0.40,
      sunGlowOpacity: (1.0 - p) * 0.35,
      sunDirection: 'west',
      sunXRatio: 0.05,
      headlightIntensity: 0.85 + p * 0.15,
      paletteBlend: 0.65 + p * 0.35
    };
  } else {
    return {
      phaseName: '🌙 Midnight Starlight',
      darknessOpacity: 0.78,
      sunGlowOpacity: 0.0,
      sunDirection: 'none',
      sunXRatio: 0.5,
      headlightIntensity: 1.0,
      paletteBlend: 1.0
    };
  }
}

function lerpColor(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, t: number) {
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  return { r, g, b, hex };
}

const PALETTE_RGB = {
  0: { day: [15, 23, 42],   night: [56, 189, 248] },  // Bus
  1: { day: [16, 185, 129], night: [52, 211, 153] },  // Valley Line
  2: { day: [37, 99, 235],  night: [96, 165, 250] },  // Capital Line
  3: { day: [239, 68, 68],  night: [248, 113, 113] },  // Metro Line
  4: { day: [249, 115, 22], night: [251, 146, 60] },  // Regional
};

function formatSecondsToClock(totalSeconds: number) {
  const normSec = Math.max(0, Math.floor(totalSeconds));
  const rawH = Math.floor(normSec / 3600);
  const m = Math.floor((normSec % 3600) / 60);
  const s = Math.floor(normSec % 60);
  const h24 = rawH % 24;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const displayH = h24 % 12 === 0 ? 12 : h24 % 12;
  const padM = m.toString().padStart(2, '0');
  const padS = s.toString().padStart(2, '0');
  return {
    timeStr: `${displayH}:${padM}:${padS} ${period}`,
    simpleTime: `${displayH}:${padM} ${period}`,
    h: h24, m, s, period, rawH
  };
}

export default function DayInEdmontonView() {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('Downloading 24-hour simulation telemetry...');

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(START_TIME_SEC);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'lrt' | 'bus' | 'regional'>('all');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [isDirectorMode, setIsDirectorMode] = useState<boolean>(false);
  const [chaseTripIndex, setChaseTripIndex] = useState<number | null>(null);
  const [show3DBuildings, setShow3DBuildings] = useState<boolean>(false);
  const [trailStyle, setTrailStyle] = useState<'classic' | 'streaks'>('classic');

  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);

  const maxSimulationSec = useMemo(() => {
    if (!data || !data.trajectories || data.trajectories.length === 0) return 86400;
    const interval = data.interval || 20;
    let maxT = 86400;
    for (let i = 0; i < data.trajectories.length; i++) {
      const trip = data.trajectories[i];
      const endT = trip.s + (trip.pts.length - 1) * interval;
      if (endT > maxT) {
        maxT = endT;
      }
    }
    return maxT + 120; // 2 minute buffer after last late-night vehicle terminates
  }, [data]);

  const maxSimulationSecRef = useRef<number>(86400);
  maxSimulationSecRef.current = maxSimulationSec;

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
  const currentTimeRef = useRef<number>(START_TIME_SEC);
  const isPlayingRef = useRef<boolean>(false);
  const speedMultiplierRef = useRef<number>(1.0);
  const isDirectorRef = useRef<boolean>(false);
  const chaseIndexRef = useRef<number | null>(null);
  const trailStyleRef = useRef<'classic' | 'streaks'>('classic');

  currentTimeRef.current = currentTimeSec;
  isPlayingRef.current = isPlaying;
  speedMultiplierRef.current = speedMultiplier;
  isDirectorRef.current = isDirectorMode;
  chaseIndexRef.current = chaseTripIndex;
  trailStyleRef.current = trailStyle;

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordProgressPct, setRecordProgressPct] = useState<number>(0);
  const isRecordingRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);

  isRecordingRef.current = isRecording;

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

  const startRecording = useCallback(() => {
    const map = mapRef.current?.getMap();
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      mimeType = 'video/webm;codecs=vp9,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }

    const recCanvas = document.createElement('canvas');
    recCanvas.width = canvas.width;
    recCanvas.height = canvas.height;
    recordCanvasRef.current = recCanvas;

    const stream = recCanvas.captureStream(60);
    recordedChunksRef.current = [];

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ETS_A_Day_in_Edmonton_Drone.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setIsRecording(false);
        recordCanvasRef.current = null;
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setIsDirectorMode(true);
      setChaseTripIndex(null);
      setSelectedVehicle(null);
      currentTimeRef.current = START_TIME_SEC;
      setCurrentTimeSec(START_TIME_SEC);
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Video recording is not supported in this browser.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const abortRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    recordCanvasRef.current = null;
  }, []);

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

    const solar = getSolarAtmosphere(tSec);
    const zoom = map.getZoom();
    const zoomScale = Math.max(0.6, Math.min(2.8, (zoom - 8.0) * 0.35 + 0.6));
    const busRadius = 2.4 * zoomScale * dpr;
    const lrtRadius = 3.8 * zoomScale * dpr;
    const regionalRadius = 2.8 * zoomScale * dpr;

    // 1. Directional Solar & Atmospheric Ambient Lighting Pass
    if (solar.darknessOpacity > 0.01) {
      ctx.fillStyle = `rgba(15, 23, 42, ${solar.darknessOpacity.toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (solar.sunGlowOpacity > 0.01) {
      const sunX = canvas.width * solar.sunXRatio;
      const sunY = canvas.height * 0.42;
      const sunRad = Math.max(canvas.width, canvas.height) * 0.95;

      const solarGrad = ctx.createRadialGradient(sunX, sunY, 15 * dpr, sunX, sunY, sunRad);
      if (solar.sunDirection === 'east') {
        solarGrad.addColorStop(0, `rgba(255, 225, 140, ${(0.55 * solar.sunGlowOpacity).toFixed(3)})`);
        solarGrad.addColorStop(0.28, `rgba(251, 146, 60, ${(0.38 * solar.sunGlowOpacity).toFixed(3)})`);
        solarGrad.addColorStop(0.65, `rgba(244, 114, 182, ${(0.18 * solar.sunGlowOpacity).toFixed(3)})`);
        solarGrad.addColorStop(1.0, 'rgba(244, 114, 182, 0.0)');
      } else {
        solarGrad.addColorStop(0, `rgba(255, 175, 55, ${(0.58 * solar.sunGlowOpacity).toFixed(3)})`);
        solarGrad.addColorStop(0.32, `rgba(239, 68, 68, ${(0.36 * solar.sunGlowOpacity).toFixed(3)})`);
        solarGrad.addColorStop(0.72, `rgba(139, 92, 246, ${(0.22 * solar.sunGlowOpacity).toFixed(3)})`);
        solarGrad.addColorStop(1.0, 'rgba(139, 92, 246, 0.0)');
      }
      ctx.fillStyle = solarGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

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

    // Director & Chase Camera updates
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
      const simSpan = Math.max(1, maxSimulationSecRef.current - START_TIME_SEC);
      const simProgress = Math.max(0, Math.min(1.0, (tSec - START_TIME_SEC) / simSpan));
      const orbitSpeedFactor = 2.0;
      const orbitAngle = simProgress * Math.PI * 2 * orbitSpeedFactor;
      
      // Starts at South Henday looking directly North into Edmonton Core (bearing 0°)
      const coreLng = -113.4938;
      const coreLat = 53.5461;
      const radiusLng = 0.085;
      const radiusLat = 0.058;
      const droneLng = coreLng + Math.sin(orbitAngle) * radiusLng;
      const droneLat = coreLat - Math.cos(orbitAngle) * radiusLat;
      const droneBearing = ((orbitAngle * 180.0) / Math.PI) % 360;

      map.easeTo({
        center: [droneLng, droneLat],
        zoom: 11.5,
        pitch: 60,
        bearing: droneBearing,
        duration: 35
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

      const rgbDef = PALETTE_RGB[cat as keyof typeof PALETTE_RGB] || PALETTE_RGB[0];
      const colorObj = lerpColor(
        rgbDef.day[0], rgbDef.day[1], rgbDef.day[2],
        rgbDef.night[0], rgbDef.night[1], rgbDef.night[2],
        solar.paletteBlend
      );
      const strokeBase = `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, `;
      const fillHex = colorObj.hex;

      const isStreakMode = trailStyleRef.current === 'streaks';

      if (isStreakMode) {
        // --- Option 2: Long-Exposure Uniform Light Streaks Mode ---
        const streakWidth = (cat === 1 || cat === 2 || cat === 3 ? 3.4 : 2.2) * zoomScale * dpr;

        // 1. Draw Luminous Light Streak Ribbon
        if (endTailIdx > startTailIdx) {
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
            const maxAlpha = 0.95 + solar.paletteBlend * 0.05;
            const alpha = Math.max(0, Math.min(maxAlpha, (1 - (ageSec / TAIL_DURATION_SEC)) * maxAlpha));

            // Soft glow aura
            ctx.beginPath();
            ctx.lineWidth = streakWidth * 2.2;
            ctx.strokeStyle = `${strokeBase}${(alpha * 0.25).toFixed(2)})`;
            ctx.moveTo(pA.x * dpr, pA.y * dpr);
            ctx.lineTo(pB.x * dpr, pB.y * dpr);
            ctx.stroke();

            // Saturated light streak body
            ctx.beginPath();
            ctx.lineWidth = streakWidth;
            ctx.strokeStyle = `${strokeBase}${alpha.toFixed(2)})`;
            ctx.moveTo(pA.x * dpr, pA.y * dpr);
            ctx.lineTo(pB.x * dpr, pB.y * dpr);
            ctx.stroke();

            // Laser hot core line
            ctx.beginPath();
            ctx.lineWidth = streakWidth * 0.35;
            ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.85).toFixed(2)})`;
            ctx.moveTo(pA.x * dpr, pA.y * dpr);
            ctx.lineTo(pB.x * dpr, pB.y * dpr);
            ctx.stroke();
          }
        }

        // 2. Leading Tip (No bulbous head dot)
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

          if (sx >= -40 && sx <= canvas.width + 40 && sy >= -40 && sy <= canvas.height + 40) {
            const pAhead = map.project([pt1[0], pt1[1]]);
            const angle = Math.atan2((pAhead.y - screenPos.y), (pAhead.x - screenPos.x));

            // Headlight Cone
            if (solar.headlightIntensity > 0.04) {
              const beamLen = (14 + zoom * 1.6) * dpr;
              const beamHalfAngle = 0.25;
              const beamAlpha = 0.22 * solar.headlightIntensity;

              const grad = ctx.createRadialGradient(sx, sy, 1.5 * dpr, sx, sy, beamLen);
              grad.addColorStop(0, `rgba(255, 255, 220, ${beamAlpha.toFixed(3)})`);
              grad.addColorStop(0.5, `rgba(255, 245, 180, ${(beamAlpha * 0.35).toFixed(3)})`);
              grad.addColorStop(1.0, 'rgba(255, 245, 180, 0.0)');

              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.arc(sx, sy, beamLen, angle - beamHalfAngle, angle + beamHalfAngle);
              ctx.closePath();
              ctx.fillStyle = grad;
              ctx.fill();
            }

            // Crisp laser leading tip (flush with beam width)
            ctx.beginPath();
            ctx.arc(sx, sy, streakWidth * 0.75, 0, Math.PI * 2);
            ctx.fillStyle = fillHex;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(sx, sy, streakWidth * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            if (selectedIdx === i) {
              const reticleRad = (streakWidth * 3.8) + Math.sin(tSec * 4) * 2 * dpr;
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
      } else {
        // --- Classic Particles Mode (Original Untouched) ---
        // 1. Draw Tail Streak
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
            const maxAlpha = 0.85 + solar.paletteBlend * 0.12;
            const alpha = Math.max(0, Math.min(maxAlpha, (1 - (ageSec / TAIL_DURATION_SEC)) * maxAlpha));

            ctx.beginPath();
            ctx.strokeStyle = `${strokeBase}${alpha.toFixed(2)})`;
            ctx.moveTo(pA.x * dpr, pA.y * dpr);
            ctx.lineTo(pB.x * dpr, pB.y * dpr);
            ctx.stroke();
          }
        }

        // 2. Draw Current Vehicle Head Dot & Gradual Headlight Cones
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

          // Gradual Headlight Cone (50% softened intensity)
          if (solar.headlightIntensity > 0.04) {
            const beamLen = (14 + zoom * 1.6) * dpr;
            const beamHalfAngle = 0.25;
            const beamAlpha = 0.22 * solar.headlightIntensity;

            const grad = ctx.createRadialGradient(sx, sy, 1.5 * dpr, sx, sy, beamLen);
            grad.addColorStop(0, `rgba(255, 255, 220, ${beamAlpha.toFixed(3)})`);
            grad.addColorStop(0.5, `rgba(255, 245, 180, ${(beamAlpha * 0.35).toFixed(3)})`);
            grad.addColorStop(1.0, 'rgba(255, 245, 180, 0.0)');

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.arc(sx, sy, beamLen, angle - beamHalfAngle, angle + beamHalfAngle);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
          }

          // Glow ring
          const glowOpacity = Math.max(
            cat === 1 || cat === 2 || cat === 3 ? 0.28 : 0.0,
            solar.paletteBlend * 0.38
          );
          if (glowOpacity > 0.04) {
            ctx.beginPath();
            ctx.arc(sx, sy, rad * (1.6 + solar.paletteBlend * 0.6), 0, Math.PI * 2);
            ctx.fillStyle = `${strokeBase}${glowOpacity.toFixed(2)})`;
            ctx.fill();
          }

          // Solid core dot
          ctx.beginPath();
          ctx.arc(sx, sy, rad, 0, Math.PI * 2);
          ctx.fillStyle = fillHex;
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
    }

    // 3. Composite into video stream when Recording Mode is active
    if (isRecordingRef.current && recordCanvasRef.current) {
      const recCanvas = recordCanvasRef.current;
      const recCtx = recCanvas.getContext('2d');
      const mapCanvas = map.getCanvas();
      if (recCtx && mapCanvas) {
        recCtx.clearRect(0, 0, recCanvas.width, recCanvas.height);
        // Draw Mapbox WebGL Map Base
        recCtx.drawImage(mapCanvas, 0, 0, recCanvas.width, recCanvas.height);
        // Draw Transit Simulation Trails & Atmosphere
        recCtx.drawImage(canvas, 0, 0, recCanvas.width, recCanvas.height);

        // Draw Minimalist HUD Digital Clock directly onto exported video frames
        const clockData = formatSecondsToClock(tSec);
        recCtx.save();
        recCtx.font = `900 ${Math.round(26 * dpr)}px 'Manrope', sans-serif`;
        recCtx.fillStyle = '#ffffff';
        recCtx.shadowColor = '#000000';
        recCtx.shadowBlur = 10 * dpr;
        recCtx.shadowOffsetX = 3 * dpr;
        recCtx.shadowOffsetY = 3 * dpr;
        recCtx.fillText(clockData.timeStr, 35 * dpr, recCanvas.height - (35 * dpr));
        recCtx.restore();
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
      const simSpan = Math.max(1, maxSimulationSecRef.current - START_TIME_SEC);
      const simSpeed = (simSpan / DEFAULT_LOOP_REAL_SEC) * speedMultiplierRef.current;
      const deltaSimSec = (deltaMs / 1000.0) * simSpeed;
      let nextTime = currentTimeRef.current + deltaSimSec;

      if (isRecordingRef.current) {
        const pct = Math.round(Math.min(100, Math.max(0, ((nextTime - START_TIME_SEC) / simSpan) * 100)));
        setRecordProgressPct(pct);

        if (nextTime >= maxSimulationSecRef.current) {
          stopRecording();
          nextTime = START_TIME_SEC;
        }
      } else {
        if (nextTime >= maxSimulationSecRef.current) {
          nextTime = START_TIME_SEC;
        }
      }

      currentTimeRef.current = nextTime;
      setCurrentTimeSec(nextTime);
    }

    renderSimulationFrame(currentTimeRef.current);
    animFrameId.current = requestAnimationFrame(animate);
  }, [renderSimulationFrame, stopRecording]);

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
    currentTimeRef.current = START_TIME_SEC;
    setCurrentTimeSec(START_TIME_SEC);
    renderSimulationFrame(START_TIME_SEC);
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = parseFloat(e.target.value);
    currentTimeRef.current = newSec;
    setCurrentTimeSec(newSec);
    renderSimulationFrame(newSec);
  };

  const clock = useMemo(() => formatSecondsToClock(currentTimeSec), [currentTimeSec]);
  const solar = useMemo(() => getSolarAtmosphere(currentTimeSec), [currentTimeSec]);
  const isNight = solar.paletteBlend > 0.5;

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
      style={{ fontFamily: "'Manrope', sans-serif" }}
      className="relative w-full h-[calc(100vh-76px)] bg-slate-950 overflow-hidden select-none"
    >
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-cyan-400 rounded-full animate-spin mb-4" />
          <h3 className="text-xl font-black text-white mb-1 tracking-tight">A ETS Day in Edmonton</h3>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 animate-pulse">{loadingProgress}</p>
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
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        minZoom={9.5}
        maxZoom={17.5}
        preserveDrawingBuffer={true}
      >
        <NavigationControl position="top-right" />
        <Layer
          id="custom-water-fill"
          source="composite"
          source-layer="water"
          type="fill"
          paint={{
            'fill-color': '#c6e2ff',
            'fill-opacity': 0.85
          }}
        />
        <Layer
          id="custom-waterway-lines"
          source="composite"
          source-layer="waterway"
          type="line"
          paint={{
            'line-color': '#b8dcfe',
            'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 14, 3],
            'line-opacity': 0.85
          }}
        />
        {show3DBuildings && (
          <Layer
            id="3d-buildings-extrusion"
            source="composite"
            source-layer="building"
            filter={['==', 'extrude', 'true']}
            type="fill-extrusion"
            minzoom={12}
            paint={{
              'fill-extrusion-color': isNight ? '#334155' : '#cbd5e1',
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12,
                0,
                12.5,
                ['get', 'height']
              ],
              'fill-extrusion-base': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12,
                0,
                12.5,
                ['get', 'min_height']
              ],
              'fill-extrusion-opacity': 0.8
            }}
          />
        )}
      </Map>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />

      {!isFullscreen && !isRecording && (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
          <div className="bg-slate-950/95 border-2 border-slate-700 shadow-[5px_5px_0px_0px_#000000] rounded-2xl p-4 min-w-[310px] text-white">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <h1 className="text-base font-black tracking-tight uppercase">A ETS Day in Edmonton</h1>
                </div>
                <p className="text-[11px] font-extrabold tracking-wide text-amber-400 mt-0.5">
                  {solar.phaseName}
                </p>
              </div>
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl border-2 border-slate-700 bg-slate-900 shadow-[2px_2px_0px_0px_#000] text-cyan-300">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                <span className="text-xs font-mono font-black">{clock.timeStr}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-1">
              <div className="flex flex-col bg-slate-900 border-2 border-slate-800 shadow-[3px_3px_0px_0px_#000] rounded-xl p-2 text-center">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Active</span>
                <span className="text-lg font-black font-mono text-white mt-0.5">{activeCounts.total}</span>
              </div>
              <div className="flex flex-col bg-emerald-950/50 border-2 border-emerald-500 shadow-[3px_3px_0px_0px_#000] rounded-xl p-2 text-center">
                <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider">LRT</span>
                <span className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                  {activeCounts.valley + activeCounts.capital + activeCounts.metro}
                </span>
              </div>
              <div className="flex flex-col bg-sky-950/50 border-2 border-sky-500 shadow-[3px_3px_0px_0px_#000] rounded-xl p-2 text-center">
                <span className="text-[10px] uppercase font-black text-sky-400 tracking-wider">Buses</span>
                <span className="text-lg font-black text-sky-400 font-mono mt-0.5">{activeCounts.bus}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t-2 border-slate-800">
              <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-900 border-2 border-slate-800 shadow-[2px_2px_0px_0px_#000] text-[11px] font-black text-sky-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] border border-slate-950" />
                <span>Bus ({activeCounts.bus})</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-emerald-950/60 border-2 border-emerald-500 shadow-[2px_2px_0px_0px_#000] text-[11px] font-black text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-slate-950" />
                <span>Valley ({activeCounts.valley})</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-blue-950/60 border-2 border-blue-500 shadow-[2px_2px_0px_0px_#000] text-[11px] font-black text-blue-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] border border-slate-950" />
                <span>Capital ({activeCounts.capital})</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-red-950/60 border-2 border-red-500 shadow-[2px_2px_0px_0px_#000] text-[11px] font-black text-red-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-slate-950" />
                <span>Metro ({activeCounts.metro})</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-orange-950/60 border-2 border-orange-500 shadow-[2px_2px_0px_0px_#000] text-[11px] font-black text-orange-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] border border-slate-950" />
                <span>Regional ({activeCounts.regional})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isRecording && (
        <div className="absolute top-4 right-16 z-20 hidden md:flex items-center gap-2 pointer-events-auto">
          <button
            onClick={startRecording}
            title="Export high-resolution 60 FPS Drone video starting from 3:30 AM to final run"
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border-red-400 shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px]"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Record Video (MP4)</span>
          </button>

          <button
            onClick={() => {
              setTrailStyle((prev) => (prev === 'classic' ? 'streaks' : 'classic'));
            }}
            title="Toggle between Classic Particles and Long-Exposure Light Streaks"
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 ${
              trailStyle === 'streaks'
                ? 'bg-amber-400 text-slate-950 border-slate-950 shadow-[3px_3px_0px_0px_#000]'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{trailStyle === 'streaks' ? 'Light Streaks' : 'Classic Dots'}</span>
          </button>

          <button
            onClick={() => {
              const next = !show3DBuildings;
              setShow3DBuildings(next);
              if (next && viewState.pitch === 0) {
                setViewState((prev) => ({ ...prev, pitch: 50 }));
              }
            }}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 ${
              show3DBuildings
                ? 'bg-blue-600 text-white border-blue-400 shadow-[3px_3px_0px_0px_#000]'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{show3DBuildings ? '3D Buildings On' : '3D Buildings'}</span>
          </button>

          <button
            onClick={() => {
              setIsDirectorMode(!isDirectorMode);
              setChaseTripIndex(null);
            }}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 ${
              isDirectorMode
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-400 shadow-[3px_3px_0px_0px_#000] animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>{isDirectorMode ? 'Drone Orbit Active (60°)' : 'Drone 360° Orbit (60°)'}</span>
          </button>

          <div className="flex items-center bg-slate-950 border-2 border-slate-700 shadow-[4px_4px_0px_0px_#000] rounded-xl p-1 gap-1">
            {(['all', 'lrt', 'bus', 'regional'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setSelectedFilter(filterKey)}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all capitalize ${
                  selectedFilter === filterKey
                    ? 'bg-cyan-400 text-slate-950 border-2 border-slate-950 shadow-[1.5px_1.5px_0px_0px_#000]'
                    : 'text-slate-300 hover:text-white font-extrabold'
                }`}
              >
                {filterKey === 'all' ? 'All' : filterKey === 'lrt' ? 'LRT Only' : filterKey === 'bus' ? 'Buses' : 'Regional'}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isRecording && selectedVehicle && selectedTelemetry && (
        <div className="absolute top-4 right-4 md:right-4 z-30 w-80 max-w-[90vw] pointer-events-auto">
          <div className="bg-slate-950/95 border-2 border-slate-700 shadow-[6px_6px_0px_0px_#000] rounded-2xl p-4 text-white animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-start justify-between pb-2.5 border-b-2 border-slate-800">
              <div className="flex items-center space-x-2">
                <span className={`w-3.5 h-3.5 rounded-full border-2 border-slate-950 shadow-[1px_1px_0px_0px_#000] ${
                  selectedTelemetry.cat === 1 ? 'bg-emerald-500' :
                  selectedTelemetry.cat === 2 ? 'bg-blue-500' :
                  selectedTelemetry.cat === 3 ? 'bg-red-500' :
                  selectedTelemetry.cat === 4 ? 'bg-orange-500' : 'bg-sky-400'
                }`} />
                <div>
                  <h3 className="font-black text-sm tracking-tight text-white uppercase">{selectedTelemetry.routeTitle}</h3>
                  <p className="text-[11px] font-bold text-slate-400 line-clamp-1">{selectedTelemetry.headsign}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedVehicle(null);
                  setChaseTripIndex(null);
                }}
                className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition hover:bg-slate-800 shadow-[2px_2px_0px_0px_#000]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 px-3 py-1.5 rounded-xl bg-slate-900 border-2 border-slate-800 shadow-[2px_2px_0px_0px_#000] text-xs font-bold text-slate-300">
              <span className="font-black text-slate-400 uppercase tracking-wider text-[10px]">Fleet: </span>
              {selectedTelemetry.vtype}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <div className="flex flex-col bg-slate-900 border-2 border-slate-800 shadow-[3px_3px_0px_0px_#000] rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center space-x-1 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Velocity</span>
                </div>
                <span className="text-xl font-black font-mono text-cyan-400 mt-0.5">
                  {selectedTelemetry.speedKmh} <span className="text-xs font-bold text-slate-400">km/h</span>
                </span>
              </div>
              <div className="flex flex-col bg-slate-900 border-2 border-slate-800 shadow-[3px_3px_0px_0px_#000] rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center space-x-1 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Progress</span>
                </div>
                <span className="text-xl font-black font-mono text-emerald-400 mt-0.5">
                  {selectedTelemetry.progressPct}%
                </span>
              </div>
            </div>

            {selectedTelemetry.upcomingStops.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Upcoming Scheduled Stops</span>
                <div className="mt-1.5 space-y-1.5">
                  {selectedTelemetry.upcomingStops.map((st: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900 border-2 border-slate-800 shadow-[2px_2px_0px_0px_#000]">
                      <span className="text-slate-300 font-extrabold truncate max-w-[180px]">{st[1]}</span>
                      <span className="text-[10px] font-mono font-black text-amber-400">{formatSecondsToClock(st[0]).simpleTime}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 pt-2.5 border-t-2 border-slate-800 flex gap-2">
              <button
                onClick={() => {
                  if (chaseTripIndex === selectedVehicle.index) {
                    setChaseTripIndex(null);
                  } else {
                    setChaseTripIndex(selectedVehicle.index);
                    setIsDirectorMode(false);
                  }
                }}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-black transition border-2 ${
                  chaseTripIndex === selectedVehicle.index
                    ? 'bg-amber-400 text-slate-950 border-slate-950 shadow-[3px_3px_0px_0px_#000]'
                    : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-slate-950 shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px]'
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
        {isRecording ? (
          <div className="bg-slate-950/95 border-2 border-red-500 shadow-[6px_6px_0px_0px_#000000] rounded-2xl p-4 md:p-5 flex flex-col gap-3 text-white animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-red-950 border-2 border-red-500 text-red-400 font-black text-xs shadow-[2px_2px_0px_0px_#000]">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>REC {recordProgressPct}%</span>
                </div>
                <span className="text-xs font-bold text-slate-400 hidden sm:inline">60° Drone Orbit 4K Video Capture</span>
              </div>

              <div className="flex items-center space-x-2 font-mono text-center">
                <span className="text-2xl md:text-3xl font-black tracking-tight text-white">{clock.timeStr}</span>
              </div>

              <button
                onClick={abortRecording}
                title="Cancel Video Export"
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border-2 border-slate-700 shadow-[3px_3px_0px_0px_#000] text-xs font-black transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px]"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <div className="w-full h-3 bg-slate-900 border-2 border-slate-700 rounded-lg overflow-hidden shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)]">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-cyan-400 transition-all duration-150"
                  style={{ width: `${recordProgressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 px-0.5">
                <span>3:30 AM (Launch)</span>
                <span>7:00 AM (Morning Rush)</span>
                <span>12:00 PM (Midday)</span>
                <span>5:00 PM (Evening Rush)</span>
                <span>12:00 AM (Midnight)</span>
                <span>{formatSecondsToClock(maxSimulationSec).simpleTime} (Final Run)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/95 border-2 border-slate-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl p-4 md:p-5 flex flex-col gap-3 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlayPause}
                  className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all border-2 border-slate-950 shadow-[3px_3px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] ${
                    isPlaying
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>{isPlaying ? 'Pause' : 'Play Simulation'}</span>
                </button>

                <button
                  onClick={handleReset}
                  title="Restart from 3:30 AM"
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border-2 border-slate-700 shadow-[3px_3px_0px_0px_#000] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px]"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-2 font-mono text-center">
                <span className="text-xl md:text-2xl font-black tracking-tight text-white">{clock.timeStr}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border-2 border-slate-700 shadow-[3px_3px_0px_0px_#000] rounded-xl p-1 gap-1">
                  {SPEED_OPTIONS.map(({ label, mult }) => (
                    <button
                      key={mult}
                      onClick={() => setSpeedMultiplier(mult)}
                      className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all ${
                        speedMultiplier === mult
                          ? 'bg-cyan-400 text-slate-950 border-2 border-slate-950 shadow-[1.5px_1.5px_0px_0px_#000]'
                          : 'text-slate-300 hover:text-white font-extrabold'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={toggleFullscreen}
                  title="Toggle Fullscreen"
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border-2 border-slate-700 shadow-[3px_3px_0px_0px_#000] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px]"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <input
                type="range"
                min={START_TIME_SEC}
                max={maxSimulationSec}
                step={20}
                value={currentTimeSec}
                onChange={handleScrubberChange}
                className="w-full h-3 bg-slate-800 border-2 border-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] transition"
              />
              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 px-0.5">
                <span>3:30 AM (Launch)</span>
                <span>7:00 AM (Morning Rush)</span>
                <span>12:00 PM (Midday)</span>
                <span>5:00 PM (Evening Rush)</span>
                <span>12:00 AM (Midnight)</span>
                <span>{formatSecondsToClock(maxSimulationSec).simpleTime} (Final Run)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
