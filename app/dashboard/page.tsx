'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import AccessibilityChart from '@/components/AccessibilityChart';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine, Label } from 'recharts';

interface LeadProperties {
  name: string;
  size: string;
  address: string;
  sector: string;
  naics_desc: string;
  hybrid: string;
  transit_score: number;
  lead_score: number;
  tier: number;
  dauid: string;
  ward: string;
  bia: string;
}

interface LeadFeature {
  type: string;
  properties: LeadProperties;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
}

const sizeValues: Record<string, number> = {
  "5-9": 0,
  "10-19": 1,
  "20-99": 2,
  "100-499": 3,
  "500+": 4
};

const ETS_MEMBER_KEYS = [
  "apegga", "atb financial", "atb", "bee-clean", "bee clean", "biamonte", "boyle street",
  "bryan & company", "bryan and company", "campus tower", "canada place", "commissionaires",
  "canadian linen", "canterbury", "concordia university", "dentons", "dialog alberta",
  "dialog architecture", "doubletree", "newcomer centre", "explore edmonton", "emery jamieson",
  "exciton", "macewan", "greater edmonton", "ikea", "independent advocacy", "fairmont",
  "hotel macdonald", "kpmg", "quality one", "marriott", "jw marriott", "metropolitan credit",
  "metterra", "mlt", "nait", "mnp", "norquest", "ogilvie", "peace hills", "reimagine",
  "reynolds mirth", "sandman", "stantec", "citadel", "brick warehouse", "westin", "vallen",
  "witten"
];

function isCurrentMember(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return ETS_MEMBER_KEYS.some(k => lower.includes(k));
}

export default function LeadDashboard() {
  const [leadsData, setLeadsData] = useState<LeadFeature[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [hybridStatus, setHybridStatus] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [showCurrentOnly, setShowCurrentOnly] = useState(false);
  
  // Custom Logarithmic Snapping Size Slider Index States (0-4)
  const [minSizeIdx, setMinSizeIdx] = useState(0);
  const [maxSizeIdx, setMaxSizeIdx] = useState(4);
  
  // Table sorting & pagination
  const [sortBy, setSortBy] = useState<keyof LeadProperties>('lead_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Load leads GeoJSON on mount
  useEffect(() => {
    fetch('/data/ets_at_work_leads.geojson')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.features) {
          setLeadsData(data.features);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading lead lists:", err);
        setLoading(false);
      });
  }, []);

  // Reset pagination on search filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, minSizeIdx, maxSizeIdx, selectedTier, hybridStatus, selectedSector, showCurrentOnly]);

  // Extract unique sectors for dropdown filter
  const uniqueSectors = useMemo(() => {
    const sectors = new Set<string>();
    leadsData.forEach((feat) => {
      if (feat.properties.sector) {
        sectors.add(feat.properties.sector);
      }
    });
    return Array.from(sectors).sort();
  }, [leadsData]);

  // Dynamic analytic calculations based on loaded dataset
  const stats = useMemo(() => {
    if (leadsData.length === 0) {
      return { total: 0, tier1: 0, tier2: 0, avgTransitScore: 0 };
    }
    const total = leadsData.length;
    let t1 = 0;
    let t2 = 0;
    let transitSum = 0;

    leadsData.forEach((f) => {
      const p = f.properties;
      if (p.tier === 1) t1++;
      if (p.tier === 2) t2++;
      transitSum += p.transit_score;
    });

    return {
      total,
      tier1: t1,
      tier2: t2,
      avgTransitScore: Math.round((transitSum / total) * 100)
    };
  }, [leadsData]);

  // Filter core logic
  const filteredLeads = useMemo(() => {
    return leadsData.filter((feat) => {
      const p = feat.properties;
      
      // Text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesAddress = p.address.toLowerCase().includes(query);
        const matchesNaics = p.naics_desc.toLowerCase().includes(query);
        const matchesSector = p.sector.toLowerCase().includes(query);
        if (!matchesName && !matchesAddress && !matchesNaics && !matchesSector) {
          return false;
        }
      }

      // Snapping size range matching
      const companySizeIndex = sizeValues[p.size] !== undefined ? sizeValues[p.size] : -1;
      if (companySizeIndex < minSizeIdx || companySizeIndex > maxSizeIdx) {
        return false;
      }

      // Priority tier
      if (selectedTier !== 'all' && String(p.tier) !== selectedTier) {
        return false;
      }

      // Hybrid work status
      if (hybridStatus !== 'all' && p.hybrid !== hybridStatus) {
        return false;
      }

      // Sector Category
      if (selectedSector !== 'all' && p.sector !== selectedSector) {
        return false;
      }

      // Current ETS@Work Members
      if (showCurrentOnly && !isCurrentMember(p.name)) {
        return false;
      }

      return true;
    });
  }, [leadsData, searchQuery, minSizeIdx, maxSizeIdx, selectedTier, hybridStatus, selectedSector, showCurrentOnly]);

  // Scatter chart data: sample up to 300 per size category for performance
  const scatterData = useMemo(() => {
    const SIZE_X: Record<string, number> = { '5-9': 0, '10-19': 1, '20-99': 2, '100-499': 3, '500+': 4 };
    const TIER_COLOR: Record<number, string> = { 1: '#4ade80', 2: '#eab308', 3: '#ec4899' };
    const buckets: Record<string, any[]> = { '5-9': [], '10-19': [], '20-99': [], '100-499': [], '500+': [] };
    filteredLeads.forEach(f => {
      const s = f.properties.size;
      if (buckets[s] && buckets[s].length < 300) {
        // Small deterministic jitter on X to spread within size band
        const jitter = (Math.sin(f.properties.lead_score * 997) * 0.3);
        buckets[s].push({
          x: (SIZE_X[s] ?? 0) + jitter,
          y: Math.round(f.properties.transit_score * 100),
          tier: f.properties.tier,
          color: TIER_COLOR[f.properties.tier] ?? '#94a3b8',
          name: f.properties.name,
          size: s,
          rawTransit: f.properties.transit_score,
        });
      }
    });
    const t1: any[] = [], t2: any[] = [], t3: any[] = [];
    Object.values(buckets).flat().forEach(d => {
      if (d.tier === 1) t1.push(d);
      else if (d.tier === 2) t2.push(d);
      else t3.push(d);
    });
    return { t1, t2, t3 };
  }, [filteredLeads]);

  // Count matching businesses in each tier dynamically
  const tierCounts = useMemo(() => {
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    filteredLeads.forEach((feat) => {
      const t = feat.properties.tier;
      if (t === 1) t1++;
      else if (t === 2) t2++;
      else if (t === 3) t3++;
    });
    return [
      { name: 'Tier 1: Prime', count: t1, color: '#4ade80' },
      { name: 'Tier 2: Good', count: t2, color: '#eab308' },
      { name: 'Tier 3: Challenging', count: t3, color: '#ec4899' }
    ];
  }, [filteredLeads]);

  // ── Shared html2canvas section export utility ──
  const exportSection = async (elementId: string, filename: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const isLight = document.documentElement.classList.contains('light');
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: isLight ? '#ffffff' : '#0f172a',
        logging: false,
      });
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Convert Bar Chart SVG to Canvas and Download as PNG
  const handleDownloadChart = () => {
    exportSection('tier-distribution-chart', 'ets_work_tier_distribution');
  };

  // Sort logic
  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads];
    list.sort((a, b) => {
      const ap = a.properties;
      const bp = b.properties;
      
      let valA: any = ap[sortBy];
      let valB: any = bp[sortBy];

      if (sortBy === 'size') {
        valA = sizeValues[ap.size] || 0;
        valB = sizeValues[bp.size] || 0;
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredLeads, sortBy, sortOrder]);

  // Paginated leads subset
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedLeads.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLeads, currentPage]);

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / itemsPerPage));

  const handleSort = (field: keyof LeadProperties) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // CSV Exporter tool: client-side text download matching outreach requirements
  const handleExportCSV = (exportAll = false) => {
    const targets = exportAll ? sortedLeads : paginatedLeads;
    if (targets.length === 0) return;

    const headers = [
      "Company Name", "Address", "Size Category", "Sector", 
      "NAICS Description", "Hybrid Status", "Transit Score", 
      "Priority Lead Score", "Lead Tier", "Dissemination Area ID", 
      "Ward Name", "BIA Name"
    ];

    const rows = targets.map((f) => {
      const p = f.properties;
      return [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.address.replace(/"/g, '""')}"`,
        `"${p.size}"`,
        `"${p.sector.replace(/"/g, '""')}"`,
        `"${p.naics_desc.replace(/"/g, '""')}"`,
        `"${p.hybrid}"`,
        p.transit_score,
        p.lead_score,
        `Tier ${p.tier}`,
        `"${p.dauid}"`,
        `"${p.ward.replace(/"/g, '""')}"`,
        `"${p.bia.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ets_at_work_prospects_${exportAll ? 'all' : 'filtered'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen font-outfit pb-20">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Header Section */}
        <section className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-aurora-cyan/10 border border-aurora-cyan/30 text-aurora-cyan text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full">B2B Prospecting Suite</span>
              <span className="text-slate-500 font-mono text-xs">YEG Business Census 2026</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              ETS@Work <span className="aurora-text font-light">Target Page</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl mt-2">
              Explore and filter eligible businesses (5+ employees) to target for transit incentives. Sort by transit scoring and priority layers to optimize outreach campaign yields.
            </p>
          </div>
          
          <div className="flex gap-3">
            <Link 
              href="/scrollytelling" 
              className="px-5 py-2.5 rounded-xl bg-slate-900 border border-white/5 text-xs font-bold hover:border-aurora-cyan/30 hover:text-aurora-cyan transition-all flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              <span>Switch to Scrollytelling Map</span>
            </Link>
          </div>
        </section>

        {/* Dynamic Metric Widgets Bar */}
        <section id="summary-stats-panel" className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
          {[
            { label: 'Total Eligible Employers', value: loading ? '...' : stats.total.toLocaleString(), detail: '>= 5 Employees total', color: 'cyan' },
            { label: 'Prime Targets (Tier 1)', value: loading ? '...' : stats.tier1.toLocaleString(), detail: 'High priority, great access', color: 'lime' },
            { label: 'Good Targets (Tier 2)', value: loading ? '...' : stats.tier2.toLocaleString(), detail: 'Strong mid-priority pool', color: 'pink' },
            { label: 'Avg Transit Score', value: loading ? '...' : `${stats.avgTransitScore}%`, detail: 'Citywide Lead Average', color: 'purple' },
          ].map((stat, i) => (
            <div key={i} className="glass-card p-5 group border border-white/5 relative overflow-hidden">
              <span className="text-slate-500 text-xxs font-bold uppercase tracking-wider mb-2 block">{stat.label}</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold group-hover:text-white transition-all text-slate-100">{stat.value}</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">{stat.detail}</span>
              <div className="w-full bg-slate-900 h-[2px] mt-4 overflow-hidden">
                <div 
                  className={`h-full bg-aurora-${stat.color} transition-all duration-1000`}
                  style={{ width: loading ? '0%' : '100%' }}
                ></div>
              </div>
            </div>
          ))}
        </section>

        {/* Stats Export Button */}
        {!loading && (
          <div className="flex justify-end mb-6 -mt-4">
            <button
              onClick={() => exportSection('summary-stats-panel', 'ets_work_summary_stats')}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-white/5 text-[11px] font-bold text-slate-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export Summary Stats
            </button>
          </div>
        )}

        {/* Advanced Filters Panel */}
        <section className="glass-card p-6 mb-8 border border-white/5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
            <svg className="w-4 h-4 text-aurora-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Prospect Filtering Grid</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Search Box */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-bold text-slate-400 uppercase">Search Keywords</label>
              <div className="relative">
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Company name, address..."
                  className="w-full bg-slate-900/60 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-aurora-cyan/40 focus:ring-0"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Dual Logarithmic snapping Size Slider */}
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-xxs font-bold text-slate-400 uppercase tracking-wider block">
                Workforce Size: <span className="text-aurora-cyan font-extrabold">
                  {minSizeIdx === 0 && maxSizeIdx === 4 ? 'All' : `${[5, 10, 20, 100, '500+'][minSizeIdx]} - ${[5, 10, 20, 100, '500+'][maxSizeIdx]}`}
                </span>
              </label>
              <div className="relative pt-3 pb-1 px-1">
                <div className="relative h-2 w-full rounded bg-slate-900">
                  {/* Highlighted active range */}
                  <div
                    className="absolute h-2 bg-aurora-gradient rounded"
                    style={{
                      left: `${(minSizeIdx / 4) * 100}%`,
                      right: `${100 - (maxSizeIdx / 4) * 100}%`
                    }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="1"
                    value={minSizeIdx}
                    onChange={(e) => setMinSizeIdx(Math.min(parseInt(e.target.value), maxSizeIdx))}
                    className={`absolute appearance-none bg-transparent w-full h-2 top-0 left-0 outline-none range-thumb-cyan ${
                      minSizeIdx === maxSizeIdx ? 'z-30' : 'z-20'
                    }`}
                  />
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="1"
                    value={maxSizeIdx}
                    onChange={(e) => setMaxSizeIdx(Math.max(parseInt(e.target.value), minSizeIdx))}
                    className={`absolute appearance-none bg-transparent w-full h-2 top-0 left-0 outline-none range-thumb-cyan ${
                      minSizeIdx === maxSizeIdx ? 'z-20' : 'z-25'
                    }`}
                  />
                </div>
                <div className="flex justify-between mt-2.5 text-[9px] font-bold text-slate-500 px-0.5 select-none">
                  {['5', '10', '20', '100', '500+'].map((lbl, idx) => (
                    <span
                      key={lbl}
                      onClick={() => {
                        if (idx <= maxSizeIdx) setMinSizeIdx(idx);
                        else setMaxSizeIdx(idx);
                      }}
                      className={`cursor-pointer transition-colors ${
                        idx >= minSizeIdx && idx <= maxSizeIdx
                          ? 'text-aurora-cyan font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {lbl}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority Tier filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-bold text-slate-400 uppercase">Target Tier</label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-aurora-cyan/40 focus:ring-0"
              >
                <option value="all">All Tiers (1 - 3)</option>
                <option value="1">Tier 1: Prime ETS@Work Target</option>
                <option value="2">Tier 2: Good ETS@Work Target</option>
                <option value="3">Tier 3: Challenging ETS@Work Targets</option>
              </select>
            </div>

            {/* Hybrid status filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-bold text-slate-400 uppercase">Commute Format</label>
              <select
                value={hybridStatus}
                onChange={(e) => setHybridStatus(e.target.value)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-aurora-cyan/40 focus:ring-0"
              >
                <option value="all">All Structures</option>
                <option value="No">Office-Only (Commuters)</option>
                <option value="Yes">Hybrid Workplaces</option>
              </select>
            </div>

            {/* Sector filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-bold text-slate-400 uppercase">Industry Sector</label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-aurora-cyan/40 focus:ring-0 truncate"
              >
                <option value="all">All Industries</option>
                {uniqueSectors.map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>

            {/* Current ETS@Work existing members toggle */}
            <div className="flex flex-col gap-1.5 justify-center border-l border-white/5 pl-4">
              <label className="text-xxs font-bold text-slate-400 uppercase">Existing Members</label>
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-300 font-bold">Current ETS@Work</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCurrentOnly}
                    onChange={(e) => setShowCurrentOnly(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-900 rounded-full peer peer-checked:bg-aurora-cyan after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-slate-950"></div>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Data Visualizations Section */}
        <section className="glass-card p-6 mb-8 border border-white/5 flex flex-col gap-6">
          <div className="flex justify-between items-center pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-aurora-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Filtered Target Distribution</h3>
            </div>
            <button
              onClick={handleDownloadChart}
              disabled={loading || sortedLeads.length === 0}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-white/5 text-[11px] font-bold text-slate-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              📥 Download Chart Image
            </button>
          </div>

          <div id="tier-distribution-chart" className="w-full h-[280px] bg-slate-900/10 rounded-xl p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tierCounts}
                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
              >
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="glass-card p-3 shadow-2xl border border-white/10 text-xxs font-outfit">
                          <span className="font-bold text-white block mb-1">{data.name}</span>
                          <span className="text-slate-400">Total Matched: </span>
                          <span className="font-bold text-aurora-cyan font-mono">{data.count.toLocaleString()}</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="count" 
                  barSize={70}
                  shape={(props: any) => {
                    const { x, y, width, height, fill } = props;
                    if (!height || height <= 0) return null;
                    const cx = x + width / 2;
                    const w = width * 0.75;
                    const h = height;
                    const hexTop = y;
                    const hexBottom = y + h;
                    const tipH = Math.min(w * 0.35, h * 0.25);
                    const d = [
                      `M ${cx} ${hexTop}`,
                      `L ${cx + w / 2} ${hexTop + tipH}`,
                      `L ${cx + w / 2} ${hexBottom - tipH}`,
                      `L ${cx} ${hexBottom}`,
                      `L ${cx - w / 2} ${hexBottom - tipH}`,
                      `L ${cx - w / 2} ${hexTop + tipH}`,
                      `Z`
                    ].join(' ');
                    return (
                      <g>
                        <defs>
                          <filter id={`hex-glow-${fill?.replace('#','')}`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feFlood floodColor={fill} floodOpacity="0.35" result="color" />
                            <feComposite in="color" in2="blur" operator="in" result="glow" />
                            <feMerge>
                              <feMergeNode in="glow" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <path 
                          d={d} 
                          fill={fill} 
                          fillOpacity={0.85} 
                          stroke={fill} 
                          strokeWidth={1.5} 
                          strokeOpacity={0.6}
                          filter={`url(#hex-glow-${fill?.replace('#','')})`}
                        />
                        <path 
                          d={d} 
                          fill="url(#hex-sheen)" 
                          fillOpacity={0.12} 
                        />
                      </g>
                    );
                  }}
                >
                  {tierCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Transit Score vs Employer Size Scatter Chart */}
        <section id="transit-size-scatter" className="glass-card p-6 mb-8 border border-white/5">
          <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-aurora-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Transit Score vs. Employer Size</h3>
            </div>
            <button
              onClick={() => exportSection('transit-size-scatter', 'ets_transit_vs_size')}
              disabled={loading || filteredLeads.length === 0}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-white/5 text-[11px] font-bold text-slate-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export Chart
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-5 max-w-3xl">
            Each dot represents a matched employer, plotted by transit accessibility score and workforce size category. Reference lines mark the
            tier threshold boundaries. Employers near or below a threshold line may warrant reclassification review.
          </p>

          <div className="w-full h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 40, left: 20, bottom: 30 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-0.5, 4.5]}
                  ticks={[0, 1, 2, 3, 4]}
                  tickFormatter={(v) => (['5-9', '10-19', '20-99', '100-499', '500+'][Math.round(v)] ?? '')}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                >
                  <Label value="Employer Size Category" position="insideBottom" offset={-15} fontSize={11} fill="#64748b" />
                </XAxis>
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                >
                  <Label value="Transit Score" angle={-90} position="insideLeft" offset={10} fontSize={11} fill="#64748b" />
                </YAxis>
                <ZAxis range={[18, 18]} />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="glass-card p-3 shadow-2xl border border-white/10 text-[11px] font-outfit min-w-[200px]">
                          <span className="font-extrabold text-white block mb-1 truncate">{d.name}</span>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Size:</span>
                            <span className="font-bold text-white">{d.size}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Transit Score:</span>
                            <span className="font-bold font-mono" style={{ color: d.color }}>{(d.rawTransit * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Current Tier:</span>
                            <span className="font-bold" style={{ color: d.color }}>Tier {d.tier}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Tier boundary reference lines */}
                <ReferenceLine y={70} stroke="#22d3ee" strokeDasharray="5 4" strokeWidth={1.5} label={{ value: '70% — Superb transit', position: 'insideTopRight', fontSize: 10, fill: '#22d3ee' }} />
                <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5} label={{ value: '40% — Decent transit', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }} />
                {/* Scatter series by tier */}
                <Scatter name="Tier 3" data={scatterData.t3} fill="#ec4899" fillOpacity={0.35} />
                <Scatter name="Tier 2" data={scatterData.t2} fill="#eab308" fillOpacity={0.55} />
                <Scatter name="Tier 1" data={scatterData.t1} fill="#4ade80" fillOpacity={0.75} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Tier threshold breakdown table */}
          <div className="mt-6 border-t border-white/5 pt-5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Current Tier Threshold Rules</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 px-3 text-slate-400 font-bold uppercase tracking-wider w-[120px]">Size Category</th>
                    <th className="text-center py-2 px-3 font-bold" style={{ color: '#4ade80' }}>Tier 1 Condition</th>
                    <th className="text-center py-2 px-3 font-bold" style={{ color: '#eab308' }}>Tier 2 Condition</th>
                    <th className="text-center py-2 px-3 font-bold" style={{ color: '#ec4899' }}>Tier 3 Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { size: '500+ employees', t1: 'Transit ≥ 40%', t2: 'Transit < 40%', t3: '—', note: true },
                    { size: '100–499 employees', t1: 'Transit ≥ 40%', t2: 'Transit < 40%', t3: '—', note: false },
                    { size: '20–99 employees', t1: 'Transit ≥ 70%', t2: 'Transit ≥ 40%', t3: 'Transit < 40%', note: false },
                    { size: '10–19 employees', t1: '—', t2: 'Transit ≥ 70%', t3: 'Transit < 70%', note: false },
                    { size: '5–9 employees', t1: '—', t2: '—', t3: 'Always Tier 3', note: false },
                  ].map((row) => (
                    <tr key={row.size} className={`border-b border-white/5 ${row.note ? 'bg-amber-400/5' : ''}`}>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {row.size}
                        {row.note && <span className="ml-2 text-[9px] bg-amber-400/20 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded font-bold uppercase">Review?</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono" style={{ color: row.t1 !== '—' ? '#4ade80' : '#334155' }}>{row.t1}</td>
                      <td className="py-2.5 px-3 text-center font-mono" style={{ color: row.t2 !== '—' ? '#eab308' : '#334155' }}>{row.t2}</td>
                      <td className="py-2.5 px-3 text-center font-mono" style={{ color: row.t3 !== '—' ? '#ec4899' : '#334155' }}>{row.t3}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
              <span className="text-amber-400 font-bold">Note:</span> The 500+ employee category uses the same 40% transit threshold as 100-499. Given the disproportionate workforce scale
              (500+ employees represent 50x+ the minimum outreach target), you may wish to lower this threshold to ensure no large employer is
              excluded from Tier 1 on a marginal transit score difference.
            </p>
          </div>
        </section>

        {/* Main Leads Table Card */}
        <section className="glass-card border border-white/5 overflow-hidden flex flex-col mb-8">
          <div className="px-6 py-4 border-b border-white/5 bg-slate-900/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-white uppercase font-outfit">Outreach Database</span>
              <span className="text-xxs text-slate-500 font-mono">
                {loading ? 'Analyzing...' : `Matched ${sortedLeads.length.toLocaleString()} leads`}
              </span>
            </div>
            
            <div className="flex gap-2.5">
              <button 
                onClick={() => handleExportCSV(false)}
                disabled={loading || sortedLeads.length === 0}
                className="px-4 py-2 rounded-lg bg-slate-800 border border-white/5 text-[11px] font-bold text-slate-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                📥 Export Page CSV
              </button>
              <button 
                onClick={() => handleExportCSV(true)}
                disabled={loading || sortedLeads.length === 0}
                className="px-4 py-2 rounded-lg bg-aurora-cyan/15 border border-aurora-cyan/30 text-[11px] font-bold text-aurora-cyan hover:bg-aurora-cyan/25 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                ⚡ Export All Filtered ({sortedLeads.length.toLocaleString()})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/10 text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-6 font-semibold select-none cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                    Company Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="py-3.5 px-4 font-semibold select-none cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('tier')}>
                    Priority Tier {sortBy === 'tier' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="py-3.5 px-4 font-semibold select-none cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('size')}>
                    Workforce Size {sortBy === 'size' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="py-3.5 px-4 font-semibold select-none cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('hybrid')}>
                    Commute {sortBy === 'hybrid' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="py-3.5 px-4 font-semibold select-none cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('transit_score')}>
                    Transit Score {sortBy === 'transit_score' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="py-3.5 px-4 font-semibold select-none cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('lead_score')}>
                    Priority Index {sortBy === 'lead_score' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="py-3.5 px-6 font-semibold">Address</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-500 font-mono">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-t-aurora-cyan border-white/5 animate-spin"></div>
                        <span>Parsing business census data layers...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-500 font-mono">
                      🚫 No leads found matching current filtering grid. Try widening constraints.
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead, idx) => {
                    const p = lead.properties;
                    return (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                        {/* Name & Sector */}
                        <td className="py-4 px-6 max-w-[280px]">
                          <div className="font-extrabold text-white truncate group-hover:text-aurora-cyan transition-colors" title={p.name}>
                            {p.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5" title={p.sector}>
                            {p.sector}
                          </div>
                        </td>
                        
                        {/* Priority Tier tag */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono ${
                            p.tier === 1 
                              ? 'bg-aurora-lime/10 border border-aurora-lime/20 text-aurora-lime' 
                              : p.tier === 2 
                              ? 'bg-yellow-400/10 border border-yellow-400/20 text-yellow-400' 
                              : 'bg-aurora-pink/10 border border-aurora-pink/20 text-aurora-pink'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              p.tier === 1 ? 'bg-aurora-lime' : p.tier === 2 ? 'bg-yellow-400' : 'bg-aurora-pink'
                            }`} />
                            Tier {p.tier}
                          </span>
                        </td>

                        {/* Size Category */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-300">
                          {p.size}
                        </td>

                        {/* Hybrid flag */}
                        <td className="py-4 px-4">
                          <span className={`text-[10px] font-bold ${p.hybrid === 'Yes' ? 'text-aurora-pink' : 'text-aurora-cyan'}`}>
                            {p.hybrid === 'Yes' ? 'Hybrid' : 'Full Office'}
                          </span>
                        </td>

                        {/* Transit Score Progress */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-200 w-8">
                              {(p.transit_score * 100).toFixed(0)}%
                            </span>
                            <div className="w-16 bg-slate-900 h-1.5 rounded-full overflow-hidden hidden sm:block">
                              <div 
                                className="h-full bg-aurora-lime rounded-full" 
                                style={{ width: `${p.transit_score * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Score Index */}
                        <td className="py-4 px-4 font-mono font-extrabold text-aurora-cyan">
                          {p.lead_score.toFixed(2)}
                        </td>

                        {/* Address */}
                        <td className="py-4 px-6 text-slate-400 max-w-[240px] truncate" title={p.address}>
                          {p.address}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && sortedLeads.length > 0 && (
            <div className="px-6 py-4 border-t border-white/5 bg-slate-900/10 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-xxs font-mono text-slate-500">
                Showing {Math.min(sortedLeads.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(sortedLeads.length, currentPage * itemsPerPage)} of {sortedLeads.length.toLocaleString()} target companies
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-white/5 text-[10px] font-bold text-slate-400 hover:text-white hover:border-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  « First
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded bg-slate-900 border border-white/5 text-[10px] font-bold text-slate-400 hover:text-white hover:border-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  ‹ Prev
                </button>
                
                <span className="px-3 py-1.5 text-xxs font-mono text-slate-300 bg-white/5 border border-white/10 rounded">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded bg-slate-900 border border-white/5 text-[10px] font-bold text-slate-400 hover:text-white hover:border-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  Next ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-white/5 text-[10px] font-bold text-slate-400 hover:text-white hover:border-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Dashboard Extras Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spatial Target Insights Card */}
          <div className="glass-card p-6 lg:col-span-2 border border-white/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-aurora-lime" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Spatial Target Analytics</h3>
              </div>
              <p className="text-slate-400 text-xs mb-6">
                Analyzing geographic accessibility and structural travel time penalties throughout Edmonton's dissemination quadrants.
              </p>
              
              <div className="mb-2">
                <AccessibilityChart />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 mt-4 flex items-center justify-between text-xxs text-slate-500 font-mono">
              <span>* Data source: Edmonton Transit Accessibility Survey</span>
              <span>Layer: Weekday Peak Access Ratio</span>
            </div>
          </div>

          {/* Quick Start B2B Campaign Guide */}
          <div className="glass-card p-6 border border-white/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-aurora-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-outfit">Campaign Guide</h3>
              </div>
              
              <div className="space-y-4 text-xxs font-medium text-slate-400">
                <div className="flex gap-2.5">
                  <span className="text-aurora-cyan font-bold">01</span>
                  <div>
                    <span className="text-white font-bold block">Isolate Large Employers</span>
                    <span>Use workforce size filters to isolate 100+ size brackets. This targets high volumes first.</span>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <span className="text-aurora-lime font-bold">02</span>
                  <div>
                    <span className="text-white font-bold block">Check Transit Access</span>
                    <span>Focus on Tier 1 leads. Since they have superior transit scores, program uptake will be immediate.</span>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <span className="text-aurora-pink font-bold">03</span>
                  <div>
                    <span className="text-white font-bold block">Leverage Office commuters</span>
                    <span>Filter for non-hybrid workspaces (Commute: Office-Only) to maximize active daily ridership incentives.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 bg-aurora-gradient p-[1px] rounded-xl overflow-hidden">
              <div className="bg-slate-950 p-4 rounded-[11px] text-center">
                <span className="text-[10px] font-bold text-slate-300 block mb-1">Targeting Map Scopes</span>
                <span className="text-[9px] text-slate-500 block mb-3.5">View coordinates and walk corridors live.</span>
                <Link 
                  href="/scrollytelling" 
                  className="inline-block w-full py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold hover:bg-white/10 transition-all"
                >
                  Open scrollytelling tool ↗
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="max-w-7xl mx-auto px-8 py-16 border-t border-white/5 text-center mt-20">
        <p className="text-slate-600 text-xs font-mono">Built with Next.js 14 & Antigravity Enterprise Engine</p>
      </footer>
    </main>
  );
}
