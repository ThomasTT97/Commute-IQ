
import React from 'react';
import { ChevronRight, AlertTriangle, Droplets, ShieldCheck, Loader2, Clock } from 'lucide-react';

interface TrainingWeeklyForecastProps {
  data: any[];
  loading: boolean;
  onSelectDay: (offset: number, startHour: number) => void;
  theme: 'dark' | 'light';
}

const getScoreStyles = (score: number, isLoading: boolean, isDark: boolean) => {
  if (isLoading) return { color: isDark ? 'text-slate-300' : 'text-slate-50', bg: isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-100 border-slate-300', shadow: '' };
  
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

export const TrainingWeeklyForecast: React.FC<TrainingWeeklyForecastProps> = ({ data, loading, onSelectDay, theme }) => {
  const isDark = theme === 'dark';

  const getDayDetails = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return {
      dayName: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      dateNum: d.getDate(),
      dayOfWeek: d.getDay()
    };
  };

  return (
    <div className="flex-1 flex flex-col gap-1.5 min-h-0 pb-2 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      {loading ? (
        Array.from({ length: 7 }).map((_, i) => (
          <div 
            key={i} 
            className={`flex-1 rounded-[1.25rem] border animate-pulse ${
              isDark ? 'bg-slate-900/50 border-white/5' : 'bg-white border-slate-200'
            }`} 
          />
        ))
      ) : (
        data.map((day) => {
          const { dayName, dateNum, dayOfWeek } = getDayDetails(day.offset);
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const { bestSlot } = day;
          const score = bestSlot?.score || 0;
          const condition = bestSlot?.condition;
          
          const isWet = condition?.wetSurfaceChance > 50 || (condition?.precipitation || 0) > 0;
          const hasIce = condition?.iceRisk;
          const styles = getScoreStyles(score, false, isDark);

          return (
            <button
              key={day.offset}
              onClick={() => onSelectDay(day.offset, bestSlot.startHour)}
              className={`group flex items-center justify-between py-1 px-4 rounded-[1.25rem] border transition-all duration-300 relative overflow-hidden flex-1 ${styles.bg} ${styles.shadow} hover:scale-[1.01] active:scale-[0.99] hover:border-blue-600/40`}
            >
              <div className="flex items-center gap-3 z-10">
                <div className="flex flex-col items-center justify-center min-w-[2.2rem]">
                  <span className={`text-[8px] font-black tracking-widest ${isWeekend ? (isDark ? 'text-slate-600' : 'text-slate-500') : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>
                    {dayName}
                  </span>
                  <span className={`text-lg font-black leading-none ${isDark ? 'text-white' : 'text-slate-950'}`}>
                    {dateNum}
                  </span>
                </div>

                <div className={`h-6 w-px ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

                <div className="flex flex-col gap-0.5 min-w-[80px]">
                  <div className="flex items-center gap-1.5 opacity-60">
                    <span className={`text-[6px] font-black uppercase tracking-[0.2em] leading-none ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                      Outlook
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wide ${isWet ? 'bg-blue-500/20 border-blue-500/30 text-blue-500' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600'}`}>
                      {isWet ? <Droplets className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
                      {isWet ? 'WET' : 'DRY'}
                    </div>
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wide ${hasIce ? 'bg-red-500/20 border-red-500/30 text-red-500' : (isDark ? 'bg-slate-800/50 border-white/5 text-slate-500' : 'bg-slate-200 border-slate-300 text-slate-600')}`}>
                      {hasIce ? <AlertTriangle className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5 opacity-20" />}
                      {hasIce ? 'ICE' : 'NO ICE'}
                    </div>
                  </div>
                </div>
                
                {/* IDEAL WINDOW SECTION - CIRCLED AREA FROM USER REQUEST */}
                <div className="flex flex-col gap-0.5 min-w-[75px]">
                  <div className="flex items-center gap-1.5 opacity-60">
                    <span className={`text-[6px] font-black uppercase tracking-[0.2em] leading-none ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                      Ideal Window
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className={`w-2.5 h-2.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={`text-[10px] font-black font-mono leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {bestSlot?.window[0]} - {bestSlot?.window[1]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 z-10">
                <div className="flex flex-col items-end">
                  <span className={`text-[7px] font-black uppercase tracking-widest leading-none mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Score</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-xl font-black font-mono leading-none ${styles.color}`}>
                      {Math.round(score)}
                    </span>
                    <span className={`text-[8px] font-bold opacity-80 ${styles.color}`}>%</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform group-hover:translate-x-1`} />
              </div>

              <div 
                className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 transition-all duration-1000" 
                style={{ width: `${Math.round(score)}%`, color: 'inherit' }}
              />
            </button>
          );
        })
      )}
    </div>
  );
};
