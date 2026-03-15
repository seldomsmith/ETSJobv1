import Navbar from '@/components/Navbar'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Header Section */}
        <section className="mb-16">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-5xl font-bold font-outfit mb-4">
                Transit <span className="text-slate-500 font-light">&</span> Employment Access
              </h1>
              <p className="text-slate-400 text-lg max-w-2xl">
                Analyzing the correlation between Edmonton Transit System (ETS) infrastructure and workforce participation in key labor sectors.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-aurora-cyan uppercase tracking-widest block mb-1">Live Status</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-aurora-lime animate-pulse"></div>
                <span className="text-sm font-medium">98.2% System Integrity</span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Avg Commute Time', value: '34 min', trend: '-2m', color: 'cyan' },
            { label: 'Job Accessibility', value: '142k', trend: '+12%', color: 'lime' },
            { label: 'Transit Reliability', value: '94.2%', trend: '+0.4%', color: 'pink' },
            { label: 'Equity Score', value: '0.84', trend: '+0.02', color: 'purple' },
          ].map((stat, i) => (
            <div key={i} className="glass-card p-6 group">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4 block">{stat.label}</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold group-hover:aurora-text transition-all">{stat.value}</span>
                <span className="text-xs font-medium text-aurora-lime">{stat.trend}</span>
              </div>
              <div className="w-full bg-slate-800 h-[2px] mt-6 overflow-hidden">
                <div 
                  className={`h-full bg-aurora-${stat.color}`}
                  style={{ width: '60%' }}
                ></div>
              </div>
            </div>
          ))}
        </section>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Placeholder/Area */}
          <div className="lg:col-span-2 glass-card p-8 aspect-video flex flex-col justify-center items-center group cursor-crosshair">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-aurora-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Network Accessibility Heatmap</h3>
            <p className="text-slate-500 text-sm mb-6 text-center max-w-sm">Requires Mapbox integration. This component will be fully initialized in the GitHub Codespace.</p>
            <button className="px-6 py-2 rounded-lg bg-slate-800 border border-white/5 text-sm font-medium hover:border-aurora-cyan/50 transition-all">
              Initialize Map Engine
            </button>
          </div>

          {/* Side Panel: Insights */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <h3 className="text-lg font-bold mb-6">Key Insights</h3>
              <div className="space-y-6">
                <div className="flex space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-aurora-cyan/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-aurora-cyan text-xs">🚀</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">New Rapid Bus Link</h4>
                    <p className="text-xs text-slate-500 mt-1">Increasing job access for south-side residents by 22% starting April.</p>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-aurora-pink/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-aurora-pink text-xs">⚠️</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Reliability Alert</h4>
                    <p className="text-xs text-slate-500 mt-1">LRT maintenance scheduled for 104st station may affect north-end commuters.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-8 bg-aurora-gradient">
              <div className="bg-slate-950/90 h-full w-full rounded-xl p-6">
                <h3 className="text-lg font-bold mb-2">Export Report</h3>
                <p className="text-xs text-slate-400 mb-6">Generate a professional PDF overview for stakeholder presentation.</p>
                <button className="w-full py-3 rounded-lg bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all">
                  Download PDF (v2.4)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="max-w-7xl mx-auto px-8 py-20 border-t border-white/5 text-center">
        <p className="text-slate-600 text-sm">Built with Next.js 14 & Antigravity Enterprise Engine</p>
      </footer>
    </main>
  )
}
