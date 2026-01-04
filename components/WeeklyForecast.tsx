
import React, { useMemo, useState } from 'react';
import { ChevronRight, AlertTriangle, Droplets, ShieldCheck, Info, Loader2, X, BrainCircuit, Zap, ArrowRight, Sparkles } from 'lucide-react';

interface WeeklyForecastProps {
  pulseDataMap: Record<number, any>;
  loadingOffsets?: number[];
  onSelectDay: (offset: number) => void;
  theme?: 'dark' | 'light';
}

const OFFSETS = [0, 1, 2, 3, 4, 5, 6];

const getScoreStyles = (score: number, hasPulse: boolean, isDark: boolean) => {
  if (!hasPulse) return { color: isDark ? 'text-slate-300' : 'text-slate-500', bg: isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-100 border-slate-300', shadow: '' };
  
  const roundedScore = Math.round(score);
  if (roundedScore > 70) {
    return { 
      color: isDark ? 'text-emerald-300' : 'text-emerald-700', 
      bg: isDark ? 'bg-emerald-900/40 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300', 
      shadow: isDark ? 'shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'shadow-sm' 
    };
  }
  if (roundedScore >= 30) {
    return { 
      color: isDark ? 'text-orange-300' : 'text-orange-700', 
      bg: isDark ? 'bg-orange-900/40 border-orange-500/40' : 'bg-orange-50 border-orange-300', 
      shadow: isDark ? '' : 'shadow-sm' 
    };
  }
  return { 
    color: isDark ? 'text-red-300' : 'text-red-700', 
    bg: isDark ? 'bg-red-900/40 border-red-500/40' : 'bg-red-50 border-red-300', 
    shadow: isDark ? 'shadow-[0_0_20px_rgba(239,68,68,0.05)]' : 'shadow-sm' 
  };
};

export const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ pulseDataMap, loadingOffsets = [], onSelectDay, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const [showOutlookInfo, setShowOutlookInfo] = useState(false);

  const progress = useMemo(() => {
    // Only track progress for primary week
    const loadedCount = OFFSETS.filter(o => pulseDataMap[o] && !loadingOffsets.includes(o)).length;
    return (loadedCount / OFFSETS.length) * 100;
  }, [pulseDataMap, loadingOffsets]);

  const isCompleted = progress >= 100;

  // Logic to detect if any WEEKDAY in the HORIZON (offsets 0-6) has score > 70%
  const hasHighScoresOnWeekdays = useMemo(() => {
    return OFFSETS.some(o => {
      const d = new Date();
      d.setDate(d.getDate() + o);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) return false;

      const pulse = pulseDataMap[o];
      return pulse && !loadingOffsets.includes(o) && pulse.score > 70;
    });
  }, [pulseDataMap, loadingOffsets]);

  // Data-driven "Next Optimal Weekday" search logic scanning up to 14 days
  const nextProjectedWeekday = useMemo(() => {
    const allAvailableOffsets = Object.keys(pulseDataMap).map(Number).sort((a, b) => a - b);
    
    // 1. Try to find the first weekday (MON-FRI) with score > 70 starting from tomorrow
    for (let o of allAvailableOffsets) {
      if (o === 0) continue; // Skip today
      const d = new Date();
      d.setDate(d.getDate() + o);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue;

      const pulse = pulseDataMap[o];
      if (pulse && pulse.score > 70) {
        return {
          day: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
          date: d.getDate(),
          month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
          offset: o,
          label: 'Next optimal weekday',
          score: pulse.score
        };
      }
    }

    // 2. Fallback: Find the Weekday with the highest score in the extended range (7-13)
    let bestExtendedWeekday: any = null;
    for (let o = 7; o <= 13; o++) {
      const pulse = pulseDataMap[o];
      if (!pulse) continue;
      
      const d = new Date();
      d.setDate(d.getDate() + o);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue;

      if (!bestExtendedWeekday || pulse.score > bestExtendedWeekday.score) {
        bestExtendedWeekday = {
          day: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
          date: d.getDate(),
          month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
          offset: o,
          label: 'Best available weekday',
          score: pulse.score
        };
      }
    }

    if (bestExtendedWeekday) return bestExtendedWeekday;

    // 3. Last Fallback: Just the next calendar weekday outside the window
    const d = new Date();
    let offset = 7;
    d.setDate(d.getDate() + offset);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
      offset++;
    }
    return {
      day: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      date: d.getDate(),
      month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
      offset: offset,
      label: 'Next projected weekday',
      score: 0
    };
  }, [pulseDataMap, loadingOffsets]);

  return (
    <div className="h-full flex flex-col gap-2 pb-2 overflow-hidden">
      {/* SCREEN TITLE AREA */}
      <div className="flex items-center justify-between px-1 mb-0.5 flex-none">
        <button 
          onClick={() => setShowOutlookInfo(true)}
          className="flex items-center gap-2.5 group active:opacity-70 transition-opacity"
        >
          <div className={`p-1.5 rounded-lg border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-100 border-blue-300'}`}>
            <Zap className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className={`text-[13px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-white' : 'text-slate-900'}`}>7-Day Outlook</h2>
          <Info className={`w-3.5 h-3.5 transition-opacity ${isDark ? 'text-slate-500 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-blue-700'}`} />
        </button>
      </div>

      {/* OUTLOOK INFO POPUP */}
      {showOutlookInfo && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowOutlookInfo(false)} />
          <div className={`relative w-full max-w-xs border rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Forecasting Logic</span>
              <button onClick={() => setShowOutlookInfo(false)} className="p-1 rounded-full hover:bg-white/10 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-none"><BrainCircuit className="w-4 h-4 text-blue-500" /></div>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Minimal Score Policy</span>
                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed">Score reflects the most challenging leg of your journey (min value between AM/PM).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-none"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Critical Ice Triggers</span>
                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed">Risk detection is active across the full day cycle if any leg presents sub-zero moisture risks.</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowOutlookInfo(false)}
              className={`w-full mt-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDark ? 'bg-slate-900 text-slate-400 border border-white/5 hover:text-white' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'}`}
            >
              Understand
            </button>
          </div>
        </div>
      )}

      {/* COMPACT PROGRESS BAR */}
      {!isCompleted && (
        <div className={`flex flex-col gap-1.5 p-2.5 rounded-2xl border transition-all duration-500 animate-in fade-in slide-in-from-top-2 flex-none ${isDark ? 'bg-slate-900/80 border-white/20' : 'bg-white border-slate-300 shadow-sm'}`}>
          <div className="flex justify-between items-center px-1">
            <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Syncing Data</span>
            <span className={`text-[10px] font-mono font-black ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{Math.round(progress)}%</span>
          </div>
          <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
            <div className="h-full bg-blue-600 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* LIST - Improved font sizes for readability */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {OFFSETS.map((offset) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          const dayName = d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
          const dateNum = d.getDate();
          const dayOfWeek = d.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          const pulse = pulseDataMap[offset];
          const isLoading = loadingOffsets.includes(offset);
          const score = pulse?.score ?? 0;
          const styles = getScoreStyles(score, !!pulse && !isLoading, isDark);
          
          const isWet = pulse?.summary?.isWet ?? false;
          const hasIce = pulse?.summary?.isIcy ?? false;

          return (
            <button
              key={offset}
              onClick={() => onSelectDay(offset)}
              disabled={isLoading}
              className={`group flex items-center justify-between py-2 px-4 rounded-[1.25rem] border transition-all duration-300 relative overflow-hidden flex-1 min-h-[60px] ${styles.bg} ${styles.shadow} ${isLoading ? 'opacity-70 animate-pulse' : 'hover:scale-[1.01] active:scale-[0.99] hover:border-blue-600/40'}`}
            >
              <div className="flex items-center gap-4 z-10">
                <div className="flex flex-col items-center justify-center min-w-[2.5rem]">
                  <span className={`text-[9px] font-black tracking-widest ${isWeekend ? (isDark ? 'text-slate-600' : 'text-slate-500') : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>{dayName}</span>
                  <span className={`text-xl font-black mt-0.5 leading-none ${isDark ? 'text-white' : 'text-slate-950'}`}>{dateNum}</span>
                </div>

                <div className={`h-6 w-px ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

                <div className="flex flex-col gap-1.5 min-w-[100px]">
                  <div className="flex items-center gap-1.5 opacity-60">
                    <span className={`text-[7px] font-black uppercase tracking-[0.2em] leading-none ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Risk Indicators</span>
                    {isLoading && <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-600" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {!pulse || isLoading ? (
                      <div className="h-5 w-24 rounded-full bg-slate-500/10 animate-pulse" />
                    ) : (
                      <>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border uppercase tracking-wide ${isWet ? 'bg-blue-500/20 border-blue-500/30 text-blue-500' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600'}`}>
                          {isWet ? <Droplets className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          {isWet ? 'WET' : 'DRY'}
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border uppercase tracking-wide ${hasIce ? 'bg-red-500/20 border-red-500/30 text-red-500' : (isDark ? 'bg-slate-800/50 border-white/5 text-slate-500' : 'bg-slate-200 border-slate-300 text-slate-600')}`}>
                          {hasIce ? <AlertTriangle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5 opacity-20" />}
                          {hasIce ? 'ICE' : 'NO ICE'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 z-10">
                <div className="flex flex-col items-end">
                  <span className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Score</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-2xl font-black font-mono leading-none ${styles.color}`}>
                      {pulse && !isLoading ? Math.round(score) : '--'}
                    </span>
                    <span className={`text-[9px] font-bold opacity-80 ${styles.color}`}>%</span>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform group-hover:translate-x-1`} />
              </div>

              {pulse && !isLoading && (
                <div 
                  className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 transition-all duration-1000" 
                  style={{ width: `${Math.round(score)}%`, color: 'inherit' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* NEXT OPTIMAL WEEKDAY MENTION (Now truly data-driven) */}
      {!hasHighScoresOnWeekdays && isCompleted && (
        <button 
          onClick={() => onSelectDay(nextProjectedWeekday.offset)}
          className={`mt-1 py-2.5 px-5 rounded-2xl border flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500 flex-none active:scale-[0.98] transition-all text-left ${isDark ? 'bg-emerald-500/5 border-emerald-500/10 hover:bg-emerald-500/10' : 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100'}`}
        >
          <div className="flex items-center gap-4">
             <div className="p-1.5 rounded-full bg-emerald-500/20">
               <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
             </div>
             <div className="flex flex-col">
               <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-emerald-500/50' : 'text-emerald-700/60'}`}>Proactive Planning</span>
               <span className={`text-[11px] font-bold leading-none mt-1 ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                 {nextProjectedWeekday.label}: <span className="font-black underline decoration-emerald-500/40">{nextProjectedWeekday.day}, {nextProjectedWeekday.date} {nextProjectedWeekday.month}</span>
                 {nextProjectedWeekday.score > 0 && <span className="ml-1 opacity-60">({Math.round(nextProjectedWeekday.score)}%)</span>}
               </span>
             </div>
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-600 opacity-50" />
        </button>
      )}
    </div>
  );
};
