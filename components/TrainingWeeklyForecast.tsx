
import React from 'react';
import { ChevronRight, AlertTriangle, Droplets, ShieldCheck, Loader2, Clock, Snowflake } from 'lucide-react';

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
          
          const isSnowy = condition?.isSnowy;
          const chance = condition?.wetSurfaceChance ?? 0;
          
          // Unified Surface labels and thresholds with WeatherCard
          let surfaceLabel = 'DRY';
          let surfaceColor = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600';
          let surfaceIcon = null;

          if (isSnowy) {
            surfaceLabel = 'SNOW';
            surfaceColor = 'bg-indigo-500/20 border-indigo-500/30 text-indigo-500';
            surfaceIcon = <Snowflake className="w-3 h-3" />;
          } else if (chance > 80) {
            surfaceLabel = 'WET';
            surfaceColor = 'bg-blue-500/20 border-blue-500/30 text-blue-500';
          } else if (chance >= 10) {
            surfaceLabel = 'DAMP';
            surfaceColor = 'bg-blue-400/20 border-blue-400/30 text-blue-400';
          }

          const hasIce = !!condition?.iceRisk;
          const styles = getScoreStyles(score, false, isDark);

          return (
            <button
              key={day.offset}
              onClick={() => onSelectDay(day.offset, bestSlot.startHour)}
              className={`group flex items-center justify-between py-2 px-4 rounded-[1.25rem] border transition-all duration-300 relative overflow-hidden flex-1 min-h-[56px] ${styles.bg} ${styles.shadow} hover:scale-[1.01] active:scale-[0.99] hover:border-blue-600/40`}
            >
              {/* Left Side: Date and Stacked Time Window */}
              <div className="flex items-center gap-4 z-10">
                <div className="flex flex-col items-center justify-center min-w-[2.2rem]">
                  <span className={`text-[8px] font-black tracking-widest ${isWeekend ? (isDark ? 'text-slate-600' : 'text-slate-500') : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>
                    {dayName}
                  </span>
                  <span className={`text-xl font-black leading-none ${isDark ? 'text-white' : 'text-slate-950'}`}>
                    {dateNum}
                  </span>
                </div>

                <div className={`h-8 w-px ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

                <div className="flex flex-col gap-0.5 items-start justify-center">
                  <div className="flex flex-col justify-center leading-tight">
                    <span className={`text-[11px] font-black font-mono leading-none ${isDark ? 'text-white' : 'text-slate-950'}`}>
                      {bestSlot?.window[0]}
                    </span>
                    <span className={`text-[11px] font-bold font-mono leading-none opacity-50 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {bestSlot?.window[1]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Risk Indicators (Grid) & Score */}
              <div className="flex items-center gap-4 z-10">
                <div className="grid grid-cols-2 gap-2">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wide w-16 justify-center ${surfaceColor}`}>
                      {surfaceIcon}
                      {surfaceLabel}
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wide w-16 justify-center ${hasIce ? 'bg-red-500/20 border-red-500/30 text-red-500' : (isDark ? 'bg-slate-800/50 border-white/5 text-slate-500' : 'bg-slate-200 border-slate-300 text-slate-600')}`}>
                      {hasIce ? 'ICE' : 'NO ICE'}
                    </div>
                </div>

                <div className="flex flex-col items-end min-w-[2.5rem]">
                  <span className={`text-[7px] font-black uppercase tracking-widest leading-none mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Score</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-2xl font-black font-mono leading-none ${styles.color}`}>
                      {Math.round(score)}
                    </span>
                    <span className={`text-[9px] font-bold opacity-80 ${styles.color}`}>%</span>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform group-hover:translate-x-1`} />
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
