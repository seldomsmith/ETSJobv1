'use client';

import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

interface EquityNode {
  name: string;
  accessibility: number; // X-axis (0-100)
  vulnerability: number; // Y-axis (0-100)
  quadrant: string;
}

const mockData: EquityNode[] = [
  { name: 'Rutherford', accessibility: 11, vulnerability: 85, quadrant: 'High Equity Need, Low Access' },
  { name: 'Mill Woods', accessibility: 35, vulnerability: 72, quadrant: 'High Equity Need, Low Access' },
  { name: 'Southgate', accessibility: 78, vulnerability: 22, quadrant: 'Low Equity Need, High Access' },
  { name: 'Downtown Core', accessibility: 92, vulnerability: 12, quadrant: 'Low Equity Need, High Access' },
  { name: 'Sherwood', accessibility: 45, vulnerability: 48, quadrant: 'Average' },
  { name: 'Jasper Place', accessibility: 58, vulnerability: 62, quadrant: 'High Equity Need, High Access' },
  { name: 'Windermere', accessibility: 22, vulnerability: 18, quadrant: 'Low Equity Need, Low Access' },
];

export default function EquityIndexChart() {
  return (
    <div className="w-full h-[320px] p-4 bg-slate-900/30 rounded-xl border border-white/5 relative">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Equity Divide Scatter Matrix</h4>
      
      <ResponsiveContainer width="100%" height="85%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
          <XAxis 
            type="number" 
            dataKey="accessibility" 
            name="Access Score" 
            domain={[0, 100]} 
            stroke="#64748b" 
            fontSize={10} 
            label={{ value: 'Access %', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }} 
          />
          <YAxis 
            type="number" 
            dataKey="vulnerability" 
            name="Vulnerability" 
            domain={[0, 100]} 
            stroke="#64748b" 
            fontSize={10} 
            label={{ value: 'Vulnerability %', position: 'insideLeft', angle: -90, offset: 5, fill: '#64748b', fontSize: 10 }} 
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '12px' }} 
          />

          {/* 🟥 Top-Left: High Vulnerability, Low Access (Critical Priority) */}
          <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="#f472b6" fillOpacity={0.08} />
          
          {/* 🟪 Bottom-Left: Low Vulnerability, Low Access */}
          <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="#a855f7" fillOpacity={0.05} />
          
          {/* 🟧 Top-Right: High Vulnerability, High Access */}
          <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill="#6d28d9" fillOpacity={0.05} />
          
          {/* 🟦 Bottom-Right: Low Vulnerability, High Access (Resilient) */}
          <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill="#22d3ee" fillOpacity={0.08} />

          <Scatter 
            name="Dissemination Areas" 
            data={mockData} 
            fill="#98ff98" 
            line={false} 
            shape="circle" 
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Floating Quadrant Markers for visual context */}
      <span className="absolute top-12 left-16 text-[8px] font-bold text-pink-400 opacity-60">CRITICAL</span>
      <span className="absolute bottom-12 right-12 text-[8px] font-bold text-cyan-400 opacity-60">RESILIENT</span>
    </div>
  );
}
