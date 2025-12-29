
import React from 'react';
import { HelpCircle, ChevronRight, TrendingUp, AlertTriangle, Droplets, ShieldCheck, Database } from 'lucide-react';

interface WeeklyForecastProps {
  pulseDataMap: Record<number, any>;
  onSelectDay: (offset: number) => void;
  theme?: 'dark' | 'light';
}

const OFFSETS = [0, 1, 2, 3, 4, 5, 6];

const getScoreStyles = (score: number, hasPulse: boolean, isDark: boolean) => {
  if (!hasPulse) return { color: isDark ? 'text-slate-500' : 'text-slate-400', bg: isDark ? 'bg-slate-900/40' : 'bg-slate-100', shadow: '' };
  
  if (score > 70) {
    return { 
      color: 'text-emerald-500', 
      bg: isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200', 
      shadow: isDark ? 'shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'shadow-md' 
    };
  }
  if (score >= 30) {
    return { 
      color: 'text-orange-500', 
      bg: isDark ? 'bg-orange-500/5 border-orange-500/20' : 'bg-orange-50 border-orange-200', 
      shadow: isDark ? '' : 'shadow-sm' 
    };
  }
  return { 
    color: 'text-red-500', 
    bg: isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200', 
    shadow: isDark ? 'shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'shadow-md' 
  };
};

export const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ pulseDataMap, onSelectDay, theme = 'dark' }) => {
  const isDark = theme === 'dark';

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="grid grid-cols-1 gap-3">
        {OFFSETS.map((offset) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          const dayName = d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
          const dateNum = d.getDate();
          
          const pulse = pulseDataMap[offset];
          const score = pulse?.score ?? 0;
          const styles = getScoreStyles(score, !!pulse, isDark);
          
          const isWet = pulse?.summary?.isWet ?? false;
          const hasIce = pulse?.summary?.isIcy ?? false;

          return (
            <button
              key={offset}
              onClick={() => onSelectDay(offset)}
              className={`group relative flex items-center justify-between p-4 rounded-3xl border transition-all duration-300 overflow-hidden ${styles.bg} ${styles.shadow} hover:scale-[1.01] active:scale-[0.99] ${isDark ? 'border-white/5' : 'border-slate-200 shadow-sm'}`}
            >
              <div className="flex items-center gap-5 z-10">
                <div className="flex flex-col items-center justify-center min-w-[3rem]">
                  <span className={`text-[10px] font-black tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{dayName}</span>
                  <span className={`text-xl font-black mt-1 leading-none ${isDark ? 'text-white' : 'text-slate-950'}`}>{dateNum}</span>
                </div>

                <div className={`h-8 w-px ${isDark ? 'bg-slate-800/40' : 'bg-slate-300'}`} />

                <div className="flex flex-col gap-1.5 min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <span className={`text-[7px] font-black uppercase tracking-widest leading-none ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>Conditions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!pulse ? (
                      <div className="flex items-center gap-2 opacity-20">
                         <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-400'}`} />
                         <div className={`w-8 h-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`} />
                      </div>
                    ) : (
                      <>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-black border transition-colors ${isWet ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'}`}>
                          {isWet ? <Droplets className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
                          {isWet ? 'WET' : 'DRY'}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-black border transition-colors ${hasIce ? 'bg-red-500/10 border-red-500/30 text-red-500 animate-pulse' : (isDark ? 'bg-slate-800 border-slate-700/50 text-slate-500' : 'bg-slate-200 border-slate-300 text-slate-500')}`}>
                          {hasIce ? <AlertTriangle className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5 opacity-30" />}
                          {hasIce ? 'ICE' : 'NO ICE'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 z-10">
                <div className="flex flex-col items-end">
                  <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>Score</span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-black font-mono leading-none ${styles.color}`}>
                      {pulse ? score : '--'}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-tight opacity-90 ${styles.color}`}>%</span>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 group-hover:text-blue-600 group-hover:translate-x-1 transition-all ${isDark ? 'text-slate-800' : 'text-slate-400'}`} />
              </div>

              {pulse && (
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-current opacity-20 transition-all duration-1000" 
                  style={{ width: `${score}%`, color: 'inherit' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
