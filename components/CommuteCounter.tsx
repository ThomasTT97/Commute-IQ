
import React, { useMemo } from 'react';
import { History, Coins, Route, Leaf, ChevronUp, BarChart3 } from 'lucide-react';

interface CommuteCounterProps {
  isDark: boolean;
  distance: number;
  rate: number;
  history: number[];
  manualHistory?: Record<string, number>;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

type FilterRange = 'all' | 'year' | 'month';

export const CommuteCounter: React.FC<CommuteCounterProps & { filter: FilterRange; setFilter: (f: FilterRange) => void }> = ({ 
  isDark, 
  distance, 
  rate, 
  history, 
  manualHistory = {},
  filter,
  setFilter,
  expanded = false,
  onToggleExpand
}) => {
  const currentMonthName = useMemo(() => {
    return new Date().toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  }, []);

  const currentYear = useMemo(() => {
    return new Date().getFullYear().toString();
  }, []);

  // Calculate the main displayed count based on filter
  const filteredHistoryCount = useMemo(() => {
    const now = new Date();
    const keys = Object.keys(manualHistory);
    
    if (filter === 'all') {
      return keys.reduce((acc, k) => acc + (manualHistory[k] || 0), 0);
    }
    if (filter === 'year') {
      const yearStr = now.getFullYear().toString();
      return keys
        .filter(k => k.startsWith(yearStr))
        .reduce((acc, k) => acc + (manualHistory[k] || 0), 0);
    }
    // Month filter
    const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    return manualHistory[monthKey] || 0;
  }, [filter, manualHistory]);

  const totalEarnings = useMemo(() => {
    return filteredHistoryCount * distance * rate;
  }, [filteredHistoryCount, distance, rate]);

  const totalDistance = useMemo(() => {
    return filteredHistoryCount * distance;
  }, [filteredHistoryCount, distance]);

  // CO2 saved (approx 0.12kg per km vs car)
  const co2Saved = useMemo(() => {
    return (totalDistance * 0.12).toFixed(1);
  }, [totalDistance]);

  // Data for the Chart
  const chartData = useMemo(() => {
    const data: { label: string; value: number; active: boolean }[] = [];
    const now = new Date();
    const maxBars = 12; // Max bars to show

    if (filter === 'month') {
      // Show days of current month based on timestamp history
      // Note: We use the raw 'history' array here for granular daily data as manualHistory is only monthly
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dailyCounts = new Array(daysInMonth + 1).fill(0);
      
      history.forEach(ts => {
        const d = new Date(ts);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          dailyCounts[d.getDate()]++;
        }
      });

      // Just show last 14 days or so to fit space if needed, or sparse days
      // Let's show representative spread
      for (let i = 1; i <= daysInMonth; i++) {
        data.push({ 
          label: i.toString(), 
          value: dailyCounts[i], 
          active: i === now.getDate() 
        });
      }
    } else if (filter === 'year') {
      // Show 12 months from manualHistory
      const yearStr = now.getFullYear().toString();
      for (let i = 0; i < 12; i++) {
        const m = i + 1;
        const key = `${yearStr}-${m.toString().padStart(2, '0')}`;
        const count = manualHistory[key] || 0;
        data.push({
          label: new Date(now.getFullYear(), i, 1).toLocaleDateString(undefined, { month: 'narrow' }),
          value: count,
          active: i === now.getMonth()
        });
      }
    } else {
      // All - Show years
      const years = new Set<string>();
      Object.keys(manualHistory).forEach(k => years.add(k.split('-')[0]));
      const sortedYears = Array.from(years).sort();
      // If empty, show current year
      if (sortedYears.length === 0) sortedYears.push(now.getFullYear().toString());
      
      sortedYears.forEach(y => {
        const count = Object.keys(manualHistory)
          .filter(k => k.startsWith(y))
          .reduce((acc, k) => acc + (manualHistory[k] || 0), 0);
        data.push({
          label: y,
          value: count,
          active: y === now.getFullYear().toString()
        });
      });
    }
    return data;
  }, [filter, history, manualHistory]);

  const maxChartValue = Math.max(...chartData.map(d => d.value), 1);

  return (
    <div 
      onClick={onToggleExpand}
      className={`rounded-3xl border transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col gap-3 overflow-hidden cursor-pointer ${
        expanded ? 'flex-1 p-5' : 'p-2.5 min-h-[64px]'
      } ${isDark ? 'bg-[#0a0c10] border-white/5 shadow-inner' : 'bg-white border-slate-200 shadow-sm'}`}
    >
      
      {/* Header / Minimized View */}
      <div className="flex items-center justify-between gap-3 flex-none">
        
        {/* Left: Filter Segments */}
        <div className="flex flex-col gap-1.5 min-w-[110px] justify-center">
          {expanded && (
             <div className="flex items-center gap-1.5 ml-0.5 animate-in fade-in slide-in-from-left-2 duration-300 mb-1">
               <BarChart3 className="w-3 h-3 text-blue-500" />
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Analytics</span>
             </div>
          )}
          
          <div 
            className={`flex p-1 rounded-xl border w-full max-w-[180px] ${isDark ? 'bg-black/40 border-white/5' : 'bg-slate-100 border-slate-300'}`}
            onClick={(e) => e.stopPropagation()} // Prevent expansion when clicking filters
          >
            <button 
              onClick={() => setFilter('month')}
              className={`flex-1 px-2 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${filter === 'month' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-400'}`}
            >
              {currentMonthName}
            </button>
            <button 
              onClick={() => setFilter('year')}
              className={`flex-1 px-2 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${filter === 'year' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-400'}`}
            >
              {currentYear}
            </button>
            <button 
              onClick={() => setFilter('all')}
              className={`flex-1 px-2 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-400'}`}
            >
              ALL
            </button>
          </div>
        </div>

        {/* Center: Count & Yield (Minimized) / Title (Expanded) */}
        {!expanded && (
          <div className="flex items-center justify-center flex-1 gap-4 px-1 animate-in fade-in duration-300">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black font-mono leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {filteredHistoryCount.toString().padStart(2, '0')}
              </span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Rides</span>
            </div>

            <div className={`h-6 w-px ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

            <div className="flex flex-col items-start">
               <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5 leading-none">Yield</span>
               <div className="flex items-center gap-1">
                 <Coins className="w-3 h-3 text-emerald-500" />
                 <span className={`text-[15px] font-black font-mono leading-none ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                   €{totalEarnings.toFixed(0)}
                 </span>
               </div>
            </div>
          </div>
        )}

        {expanded && (
          <div className="flex justify-end flex-1">
             <div className={`p-2 rounded-full ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                <ChevronUp className="w-4 h-4" />
             </div>
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
           
           {/* Chart Container */}
           <div className={`flex-1 min-h-[100px] flex items-end gap-1.5 pb-2 relative border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
              {chartData.length > 0 ? chartData.map((d, i) => {
                 const heightPct = (d.value / maxChartValue) * 100;
                 return (
                   <div key={i} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
                      <div className="relative w-full flex justify-end flex-col h-full items-center">
                         <div 
                           className={`w-full max-w-[12px] min-h-[4px] rounded-t-sm transition-all duration-500 ${d.active ? 'bg-blue-500' : (isDark ? 'bg-slate-800 group-hover:bg-slate-700' : 'bg-slate-200 group-hover:bg-slate-300')}`}
                           style={{ height: `${Math.max(4, heightPct)}%` }}
                         />
                      </div>
                      <span className={`text-[6px] font-bold uppercase ${d.active ? 'text-blue-500' : 'text-slate-600'}`}>{d.label}</span>
                   </div>
                 )
              }) : (
                 <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 uppercase font-bold opacity-50">No Data Available</div>
              )}
           </div>

           {/* Stats Grid */}
           <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isDark ? 'bg-blue-900/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                 <div className="flex items-center gap-1.5 opacity-70">
                    <Route className="w-3 h-3 text-blue-500" />
                    <span className="text-[8px] font-black uppercase text-blue-500">Distance</span>
                 </div>
                 <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-black font-mono leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalDistance.toFixed(0)}</span>
                    <span className="text-[9px] font-bold text-slate-500">KM</span>
                 </div>
              </div>

              <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isDark ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                 <div className="flex items-center gap-1.5 opacity-70">
                    <Coins className="w-3 h-3 text-emerald-500" />
                    <span className="text-[8px] font-black uppercase text-emerald-500">Yield</span>
                 </div>
                 <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-black font-mono leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalEarnings.toFixed(0)}</span>
                    <span className="text-[9px] font-bold text-slate-500">EUR</span>
                 </div>
              </div>

              <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                 <div className="flex items-center gap-1.5 opacity-70">
                    <Leaf className="w-3 h-3 text-slate-400" />
                    <span className="text-[8px] font-black uppercase text-slate-500">CO2 Saved</span>
                 </div>
                 <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-black font-mono leading-none ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{co2Saved}</span>
                    <span className="text-[9px] font-bold text-slate-500">KG</span>
                 </div>
              </div>
           </div>
      </div>
      )}
    </div>
  );
};
