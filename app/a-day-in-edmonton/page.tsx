import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';

const DayInEdmontonView = dynamic(() => import('@/components/DayInEdmontonView'), {
  ssr: false,
});

export default function DayInEdmontonPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex-1 relative w-full h-full">
        <DayInEdmontonView />
      </div>
    </main>
  );
}
