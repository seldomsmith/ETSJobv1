'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState('dark');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('ets-theme') || 'dark';
    setActiveTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, []);

  const handleThemeChange = (theme: 'dark' | 'light') => {
    localStorage.setItem('ets-theme', theme);
    setActiveTheme(theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    // Fire a custom window event so map pages can listen and switch styles dynamically
    window.dispatchEvent(new CustomEvent('ets-theme-change', { detail: { theme } }));
  };

  const navLinks = [
    { href: '/',                  label: 'Transit Map' },
    { href: '/market-research',   label: 'ETS@Work Research' },
    { href: '/dashboard',         label: 'Lead Finder' },
    { href: '/bus-stops',         label: 'Bus Stops Analysis' },
  ];

  const comingSoon = ['Equity Index', 'Reports'];

  return (
    <>
      <nav className="flex justify-between items-center py-6 px-8 border-b border-white/5 sticky top-0 bg-slate-950/80 backdrop-blur-md z-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-aurora-gradient p-[2px]">
            <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center font-bold text-xs text-white">ET</div>
          </div>
          <div className="flex flex-col">
            <span className="aurora-text text-xl font-bold leading-none">ETS and Edmonton Jobs</span>
            <span className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase">Market Research Dashboard</span>
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
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 cursor-not-allowed select-none"
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
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="px-4 py-2 rounded-full border border-white/10 text-sm hover:bg-white/5 transition-all text-white font-medium flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span>Settings</span>
          </button>
        </div>
      </nav>

      {/* ⚙️ Beautiful Slide-Out Settings Panel */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto">
          {/* Backdrop overlay */}
          <div 
            onClick={() => setIsSettingsOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Glassmorphic Panel Content */}
          <div className="relative w-full max-w-sm h-full bg-slate-950/95 border-l border-white/10 p-8 flex flex-col justify-between shadow-2xl font-sans">
            <div>
              <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                <h3 className="text-lg font-bold text-white tracking-wide uppercase font-outfit">Visual Configuration</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-white p-1 bg-white/5 rounded transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Theme Selection Toggle */}
              <div className="mb-6">
                <span className="text-xxs font-bold text-slate-400 uppercase tracking-widest block mb-3 font-outfit">Color Theme Mode</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-1.5 border border-white/5 rounded-xl">
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      activeTheme === 'dark'
                        ? 'bg-aurora-cyan text-slate-950 shadow-md font-extrabold'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>🌙 Dark Theme</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      activeTheme === 'light'
                        ? 'bg-white text-slate-950 shadow-md font-extrabold border border-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>☀️ Light Theme</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                  Switching to Light Theme loads the white Mapbox base layer and deep navy blue routes.
                </p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <span className="text-[10px] text-slate-500 block text-center font-mono">
                ETS and Edmonton Jobs Dashboard v1.1
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


