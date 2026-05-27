'use client';

import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';

const MarketResearchView = dynamic(() => import('@/components/MarketResearchView'), {
  ssr: false, // Prevent Mapbox SSR canvas crashes
});

export default function MarketResearchPage() {
  return (
    <main className="h-screen bg-slate-950 flex flex-col text-slate-100 font-sans relative overflow-hidden">
      <Navbar />
      <MarketResearchView />
    </main>
  );
}
