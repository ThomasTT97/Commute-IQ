
import React from 'react';
import { Clock, AlertTriangle, Droplets, ShieldCheck, Wind, MonitorPlay } from 'lucide-react';

interface TrainingWeeklyForecastProps {
  data: any[];
  loading: boolean;
  onSelectDay: (offset: number, startHour: number) => void;
  theme: 'dark' | 'light';
}

export const TrainingWeeklyForecast: React.FC<TrainingWeeklyForecastProps> = ({ data, loading, onSelectDay, theme }) => {
  const isDark = theme === 'dark';

  const getDayLabel = (offset: number) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return {
      name: d.toLocaleDateString(undefined, { weekday: 'long' }),
      short: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      date: `${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`
    };
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200';
    if (score >= 60) return isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200';
    if (score >= 40) return isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200';
    return isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200';
  };

  return (
    <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3 min-h-0 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {loading ? (
         Array.from({length: 7}).map((_, i) => (
           <div key={i} className={`h-24 rounded-[1.5rem] border animate-pulse ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-white border-slate-200'}`} />
         ))
      ) : (
         data.map((day) => {
           const label = getDayLabel(day.offset);
           const { bestSlot } = day;
           const score = bestSlot?.score || 0;
           const condition = bestSlot?.condition;
           
           const isIndoorRecommended = score < 45 || condition?.iceRisk;
           const isWet = condition?.wetSurfaceChance > 50 || condition?.precipitation > 0;
           const hasIce = condition?.iceRisk;

           return (
             <button 
               key={day.offset}
               onClick={() => onSelectDay(day.offset, bestSlot.startHour)}
               className={`group w-full p-4 rounded-[1.5rem] border transition-all active:scale-[0.98] relative overflow-hidden flex items-center justify-between ${isDark ? 'bg-[#0a0c10] border-white/5 hover:bg-white/5' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
             >
               <div className="flex flex-col items-start gap-1.5 z-10">
                  <div className="flex items-baseline gap-2">
                      <span className={`text-[13px] font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>{label.name}</span>
                      <span className="text-[11px] font-bold text-slate-500">{label.date}</span>
                  </div>
                  
                  <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border mt-0.5 ${getScoreBg(score)}`}>
                      <Clock className={`w-3 h-3 ${getScoreColor(score)}`} />
                      <span className={`text-[11px] font-black tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {bestSlot.window[0]} - {bestSlot.window[1]}
                      </span>
                  </div>
               </div>

               <div className="flex flex-col items-end gap-2 z-10">
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                     {isIndoorRecommended && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[9px] font-black uppercase tracking-wide">
                             <MonitorPlay className="w-3 h-3" /> INDOOR
                         </div>
                     )}
                     
                     {/* Surface Indicator */}
                     <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wide ${isWet ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                         {isWet ? <Droplets className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                         {isWet ? 'WET' : 'DRY'}
                     </div>

                     {/* Ice Indicator - Always Show */}
                     <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wide ${hasIce ? 'bg-red-500/10 border-red-500/20 text-red-500' : (isDark ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-500')}`}>
                         {hasIce ? <AlertTriangle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3 opacity-50" />}
                         {hasIce ? 'ICE' : 'NO ICE'}
                     </div>

                     {condition?.windSpeed > 25 && (
                         <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[9px] font-black uppercase tracking-wide">
                             <Wind className="w-3 h-3" /> WIND
                         </div>
                     )}
                  </div>
                  <div className="flex items-baseline gap-0.5">
                      <span className={`text-3xl font-black tracking-tighter ${getScoreColor(score)}`}>{Math.round(score)}</span>
                      <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/100</span>
                  </div>
               </div>
               
               {/* Score Bar Background */}
               <div className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ${getScoreColor(score).replace('text-', 'bg-')}`} style={{ width: `${score}%`, opacity: 0.3 }} />
             </button>
           );
         })
      )}
    </div>
  );
};
