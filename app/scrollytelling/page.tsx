import ScrollytellingView from '@/components/ScrollytellingView';
import Navbar from '@/components/Navbar';

export default function ScrollytellingPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />
      <ScrollytellingView />
    </main>
  );
}
