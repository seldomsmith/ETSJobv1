import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center py-6 px-8 border-b border-white/5 sticky top-0 bg-slate-950/80 backdrop-blur-md z-50">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-aurora-gradient p-[2px]">
          <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center font-bold text-xs">ET</div>
        </div>
        <div className="flex flex-col">
          <span className="aurora-text text-xl font-bold leading-none">ETS INSIGHT</span>
          <span className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase">Enterprise Transit analytics</span>
        </div>
      </div>
      
      <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
        <Link href="/" className="text-white hover:text-aurora-cyan transition-colors">Dashboard</Link>
        <Link href="/scrollytelling" className="text-slate-400 hover:text-white transition-colors">Maps</Link>
        <a href="#" className="text-slate-400 hover:text-white transition-colors">Equity Index</a>
        <a href="#" className="text-slate-400 hover:text-white transition-colors">Reports</a>
      </div>

      <div className="flex items-center space-x-4">
        <button className="px-4 py-2 rounded-full border border-white/10 text-sm hover:bg-white/5 transition-all">
          Settings
        </button>
        <button className="px-4 py-2 rounded-full bg-aurora-cyan text-slate-950 text-sm font-bold shadow-lg shadow-aurora-cyan/20 hover:scale-105 transition-transform">
          Export Data
        </button>
      </div>
    </nav>
  )
}
