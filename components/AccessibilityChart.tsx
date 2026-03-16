'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DataPoint {
  name: string;
  accessibility: number;
  penalty: number;
}

const defaultData: DataPoint[] = [
  { name: 'Core', accessibility: 85, penalty: 5 },
  { name: 'Inner', accessibility: 64, penalty: 12 },
  { name: 'Mid', accessibility: 45, penalty: 22 },
  { name: 'Outer', accessibility: 32, penalty: 35 },
  { name: 'Suburbs', accessibility: 18, penalty: 48 },
];

export default function AccessibilityChart() {
  return (
    <div className="w-full h-[250px] p-2 bg-slate-900/30 rounded-xl">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={defaultData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="gradientCyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradientPink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f472b6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '12px' }} />
          <Area type="monotone" dataKey="accessibility" stroke="#22d3ee" fill="url(#gradientCyan)" strokeWidth={2} />
          <Area type="monotone" dataKey="penalty" stroke="#f472b6" fill="url(#gradientPink)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
