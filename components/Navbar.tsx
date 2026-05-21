'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/',           label: 'Transit Map' },
    { href: '/dashboard',  label: 'Lead Finder' },
  ];

  const comingSoon = ['Equity Index', 'Reports'];

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
      
      <div className="hidden md:flex items-center space-x-2 text-sm font-medium">
        {navLinks.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'text-white bg-white/8 border border-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          );
        })}

        <div className="w-px h-4 bg-white/10 mx-2" />

        {comingSoon.map((label) => (
          <span
            key={label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 cursor-not-allowed select-none"
            title="Coming soon"
          >
            {label}
            <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-800 border border-white/5 text-slate-500 px-1.5 py-0.5 rounded">
              soon
            </span>
          </span>
        ))}
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
