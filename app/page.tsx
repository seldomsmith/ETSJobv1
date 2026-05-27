import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';

const ScrollytellingView = dynamic(() => import('@/components/ScrollytellingView'), {
  ssr: false, // Disable server-side rendering for map box visuals
});

export default function ScrollytellingPage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <ScrollytellingView />
    </main>
  );
}
