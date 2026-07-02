'use client';
import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import BusStopsMap from '@/components/BusStopsMap';

export default function BusStopsPage() {
  const [viewMode, setViewMode] = useState<'proximity' | 'hexbin' | 'stranded'>('proximity');

  return (
    <main className="min-h-screen bg-slate-950 font-sans flex flex-col h-screen overflow-hidden">
      <Navbar />
      
      <div className="flex-1 flex flex-col relative w-full h-full">
        {/* Header Overlay & Toggles */}
        <div className="absolute top-0 left-0 w-full p-6 z-10 pointer-events-none flex justify-between items-start">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-extrabold text-white mb-4 drop-shadow-lg pointer-events-auto">
              Transit Gap Analysis
            </h1>
            
            <div className="flex bg-slate-900/60 p-1.5 rounded-xl backdrop-blur-md border border-white/10 pointer-events-auto mb-4 max-w-fit shadow-xl">
              <button 
                onClick={() => setViewMode('proximity')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'proximity' ? 'bg-aurora-cyan text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Stop Proximity
              </button>
              <button 
                onClick={() => setViewMode('hexbin')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'hexbin' ? 'bg-aurora-cyan text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Hexbin Overlay
              </button>
              <button 
                onClick={() => setViewMode('stranded')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'stranded' ? 'bg-aurora-cyan text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Stranded Jobs (3-Rings)
              </button>
            </div>

            <div className="text-slate-300 drop-shadow-md text-sm leading-relaxed bg-slate-900/40 p-4 rounded-xl backdrop-blur-sm border border-white/10 pointer-events-auto">
              {viewMode === 'proximity' && (
                <>
                  Visualizes existing bus stops scaled by the number of jobs within 400m. <br/><br/>
                  <span className="flex items-center gap-2 mt-1"><span className="w-3 h-3 rounded-full bg-[#f6e05e] shadow-md"></span> 10+ jobs within 400m</span>
                  <span className="flex items-center gap-2 mt-1"><span className="w-3 h-3 rounded-full bg-[#ed8936] shadow-md"></span> 50+ jobs within 400m</span>
                  <span className="flex items-center gap-2 mt-1"><span className="w-3 h-3 rounded-full bg-[#e53e3e] shadow-md"></span> 200+ jobs within 400m</span>
                </>
              )}
              {viewMode === 'hexbin' && (
                <>
                  True hexagonal tessellation scoring the ratio of jobs to transit access.<br/><br/>
                  <span className="flex items-center gap-2 mt-1"><span className="w-3 h-3 bg-[#3182ce] opacity-70"></span> Good access / No jobs</span>
                  <span className="flex items-center gap-2 mt-1"><span className="w-3 h-3 bg-[#9f7aea] opacity-70"></span> Moderate Gap</span>
                  <span className="flex items-center gap-2 mt-1"><span className="w-3 h-3 bg-[#e53e3e] opacity-70"></span> Severe Gap (High Jobs, No Stops)</span>
                </>
              )}
              {viewMode === 'stranded' && (
                <>
                  Highlights specific jobs that are disconnected from the transit network (Straight-line buffers).<br/><br/>
                  <span className="flex items-center gap-2 mt-1"><span className="w-3 h-3 rounded-full bg-[#ed8936] shadow-md"></span> 400m - 600m to nearest stop (0.5 score)</span>
                  <span className="flex items-center gap-2 mt-1"><span className="w-3 h-3 rounded-full bg-[#e53e3e] shadow-md"></span> 600m - 800m to nearest stop (0.1 score)</span>
                  <span className="flex items-center gap-2 mt-1"><span className="w-3 h-3 rounded-full bg-[#9b2c2c] shadow-md"></span> &gt; 800m to nearest stop (0.0 score)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="w-full h-full">
          <BusStopsMap viewMode={viewMode} />
        </div>
      </div>
    </main>
  );
}
