import React, { useMemo } from 'react';
import { History, Coins } from 'lucide-react';

interface CommuteCounterProps {
  isDark: boolean;
  distance: number;
  rate: number;
  history: number[];
  manualHistory?: Record<string, number>;
}

type FilterRange = 'all' | 'year' | 'month';

export const CommuteCounter: React.FC<CommuteCounterProps & { filter: FilterRange; setFilter: (f: FilterRange) => void }> = ({ 
  isDark, 
  distance, 
  rate, 
  history, 
  manualHistory = {},
  filter,
  setFilter
}) => {
  const currentMonthName = useMemo(() => {
    return new Date().toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  }, []);

  const currentYear = useMemo(() => {
    return new Date().getFullYear().toString();
  }, []);

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

  const hasLoggedToday = useMemo(() => {
    const today = new Date().toDateString();
    return history.some(ts => new Date(ts).toDateString() === today);
  }, [history]);

  return (
    <div className={`p-2.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 ${isDark ? 'bg-[#0a0c10] border-white/5 shadow-inner' : 'bg-white border-slate-200 shadow-sm'}`}>
      
      {/* Left: Filter Segments */}
      <div className="flex flex-col gap-1.5 min-w-[110px]">
        <div className="flex items-center gap-1.5 ml-0.5">
          <History className="w-2.5 h-2.5 text-slate-500" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Period</span>
        </div>
        <div className={`flex p-0.5 rounded-lg border ${isDark ? 'bg-black/40 border-white/5' : 'bg-slate-100 border-slate-300'}`}>
          <button 
            onClick={() => setFilter('month')}
            className={`flex-1 px-1.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all ${filter === 'month' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}
          >
            {currentMonthName}
          </button>
          <button 
            onClick={() => setFilter('year')}
            className={`flex-1 px-1.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all ${filter === 'year' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}
          >
            {currentYear}
          </button>
          <button 
            onClick={() => setFilter('all')}
            className={`flex-1 px-1.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}
          >
            ALL
          </button>
        </div>
      </div>

      {/* Center: Combined Stats */}
      <div className="flex items-center justify-center flex-1 gap-3 px-1">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-black font-mono leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {filteredHistoryCount.toString().padStart(2, '0')}
          </span>
          <div className="flex flex-col">
            {hasLoggedToday && (
              <div className="flex items-center gap-0.5">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[6px] font-black text-emerald-500 uppercase">Today</span>
              </div>
            )}
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none">Rides</span>
          </div>
        </div>

        <div className={`h-6 w-px ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        <div className="flex flex-col items-start">
           <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5 leading-none">Yield</span>
           <div className="flex items-center gap-1">
             <Coins className="w-3 h-3 text-emerald-500" />
             <span className={`text-[15px] font-black font-mono leading-none ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
               €{totalEarnings.toFixed(2)}
             </span>
           </div>
        </div>
      </div>
    </div>
  );
};
