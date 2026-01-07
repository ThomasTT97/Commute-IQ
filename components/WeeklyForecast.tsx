
import React, { useMemo, useState } from 'react';
import { ChevronRight, AlertTriangle, Droplets, ShieldCheck, Info, Loader2, X, BrainCircuit, Zap, ArrowRight, Sparkles, Bike, Trophy, Coffee, Snowflake } from 'lucide-react';

interface WeeklyForecastProps {
  pulseDataMap: Record<number, any>;
  loadingOffsets?: number[];
  onSelectDay: (offset: number) => void;
  theme?: 'dark' | 'light';
  onToggleMode?: () => void;
  workDays?: number[];
}

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

export const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ pulseDataMap, loadingOffsets = [], onSelectDay, theme = 'dark', onToggleMode, workDays = [1, 2, 3, 4, 5] }) => {
  const isDark = theme === 'dark';
  const [showOutlookInfo, setShowOutlookInfo] = useState(false);

  // Dynamically calculate the next 7 active commute days
  const activeCommuteOffsets = useMemo(() => {
    const result: number[] = [];
    let currentOffset = 0;
    // We scan up to 14 days ahead to find 7 work days
    while (result.length < 7 && currentOffset < 14) {
      const d = new Date();
      d.setDate(d.getDate() + currentOffset);
      if (workDays.includes(d.getDay())) {
        result.push(currentOffset);
      }
      currentOffset++;
    }
    return result;
  }, [workDays]);

  const progress = useMemo(() => {
    const loadedCount = activeCommuteOffsets.filter(o => pulseDataMap[o] && !loadingOffsets.includes(o)).length;
    return (loadedCount / activeCommuteOffsets.length) * 100;
  }, [pulseDataMap, loadingOffsets, activeCommuteOffsets]);

  const isCompleted = progress >= 100;

  return (
    <div className="h-full flex flex-col gap-3 pb-4 overflow-hidden">
      <div className="flex-none relative flex items-center justify-center py-2 z-20 shrink-0">
        <div className={`flex items-center p-1 rounded-full border shadow-sm ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] shadow-lg flex items-center gap-2 transition-all duration-300 ${isDark ? 'bg-blue-900/30 text-blue-400 ring-1 ring-blue-500/50' : 'bg-blue-100 text-blue-700'}`}>
            <Bike className="w-3.5 h-3.5" />
            <span>Commute</span>
          </div>
          <button 
            onClick={onToggleMode}
            className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all duration-300 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Training</span>
          </button>
        </div>
        <button 
          onClick={() => setShowOutlookInfo(true)}
          className={`absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/5 text-slate-600 hover:text-slate-400' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {showOutlookInfo && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowOutlookInfo(false)} />
          <div className={`relative w-full max-w-xs border rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Active Outlook</span>
              <button onClick={() => setShowOutlookInfo(false)} className="p-1 rounded-full hover:bg-white/10 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-none"><BrainCircuit className="w-4 h-4 text-blue-500" /></div>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Commute Focus</span>
                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed">This view filters for your next 7 scheduled commute days, skipping off-days for better tactical planning.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-none"><ShieldCheck className="w-4 h-4 text-emerald-500" /></div>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Safety Thresholds</span>
                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed">Daily scores are calculated based on the lowest scoring leg of your round trip.</p>
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

      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {activeCommuteOffsets.map((offset) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          const dayName = d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
          const dateNum = d.getDate();
          const pulse = pulseDataMap[offset];
          const isLoading = loadingOffsets.includes(offset);
          const score = pulse?.score ?? 0;
          const styles = getScoreStyles(score, !!pulse && !isLoading, isDark);
          const isWet = pulse?.summary?.isWet ?? false;
          const isSnowy = pulse?.summary?.isSnowy ?? false;
          const hasIce = pulse?.summary?.isIcy ?? false;

          return (
            <button
              key={offset}
              onClick={() => onSelectDay(offset)}
              disabled={isLoading}
              className={`group flex items-center justify-between px-4 rounded-[1.25rem] border transition-all duration-300 relative overflow-hidden flex-1 py-2 min-h-[56px] ${styles.bg} ${styles.shadow} ${isLoading ? 'opacity-70 animate-pulse' : 'hover:scale-[1.01] active:scale-[0.99] hover:border-blue-600/40'}`}
            >
              <div className="flex items-center gap-4 z-10">
                <div className="flex flex-col items-center justify-center min-w-[2.5rem]">
                  <span className={`text-[9px] font-black tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{dayName}</span>
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
                        {isSnowy ? (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border uppercase tracking-wide w-20 justify-start bg-indigo-500/20 border-indigo-500/30 text-indigo-500`}>
                            <Snowflake className="w-3.5 h-3.5 flex-none" />
                            SNOW
                          </div>
                        ) : (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border uppercase tracking-wide w-20 justify-start ${isWet ? 'bg-blue-500/20 border-blue-500/30 text-blue-500' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600'}`}>
                            {isWet ? <Droplets className="w-3.5 h-3.5 flex-none" /> : <ShieldCheck className="w-3.5 h-3.5 flex-none" />}
                            {isWet ? 'WET' : 'DRY'}
                          </div>
                        )}
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border uppercase tracking-wide w-24 justify-start ${hasIce ? 'bg-red-500/20 border-red-500/30 text-red-500' : (isDark ? 'bg-slate-800/50 border-white/5 text-slate-500' : 'bg-slate-200 border-slate-300 text-slate-600')}`}>
                          {hasIce ? <AlertTriangle className="w-3.5 h-3.5 flex-none" /> : <ShieldCheck className="w-3.5 h-3.5 opacity-20 flex-none" />}
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
    </div>
  );
};
