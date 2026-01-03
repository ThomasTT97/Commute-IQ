
import React, { useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Home, 
  RefreshCw, 
  Target,
  Search,
  Zap,
  Star,
  Clock
} from 'lucide-react';
import { TrainingState } from '../types';
import { BelgianLocation } from '../locations';
import { WeatherCard } from './WeatherCard';

interface TrainingViewProps {
  isDark: boolean;
  training: TrainingState;
  trainingSearch: string;
  showTrainingSuggestions: boolean;
  trainingData: any;
  trainingLoading: boolean;
  manualStartHour: number | null;
  bestStartHour: number | null;
  theme: 'dark' | 'light';
  onReturn: () => void;
  onSearchChange: (val: string) => void;
  onSetToHome: () => void;
  onDateOffsetChange: (offset: number) => void;
  onDistanceChange: (dist: number) => void;
  onManualHourChange: (hour: number) => void;
  onSelectSuggestion: (loc: BelgianLocation) => void;
  filterLocations: (query: string) => BelgianLocation[];
  getDayLabel: (offset: number) => { name: string; num: number; month: string };
}

export const TrainingView: React.FC<TrainingViewProps> = ({
  isDark,
  training,
  trainingSearch,
  showTrainingSuggestions,
  trainingData,
  trainingLoading,
  manualStartHour,
  bestStartHour,
  theme,
  onReturn,
  onSearchChange,
  onSetToHome,
  onDateOffsetChange,
  onDistanceChange,
  onManualHourChange,
  onSelectSuggestion,
  filterLocations,
  getDayLabel
}) => {
  const verticalPickerRef = useRef<HTMLDivElement>(null);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const dayScrollRef = useRef<HTMLDivElement>(null);
  
  const distances = useMemo(() => Array.from({ length: 30 }, (_, i) => (i + 1) * 5), []); // 5 to 150km
  const hours = useMemo(() => Array.from({ length: 19 }, (_, i) => i + 3), []); // 03:00 to 21:00
  const dayOffsets = [0, 1, 2, 3, 4, 5, 6];

  // Sync vertical distance picker scroll position
  useEffect(() => {
    if (verticalPickerRef.current) {
      const activeEl = verticalPickerRef.current.querySelector(`[data-dist="${training.distance}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [training.distance]);

  // Sync horizontal time picker scroll position
  useEffect(() => {
    if (timePickerRef.current) {
      const hourToScroll = manualStartHour !== null ? manualStartHour : bestStartHour;
      if (hourToScroll !== null) {
        const activeEl = timePickerRef.current.querySelector(`[data-hour="${hourToScroll}"]`);
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
      }
    }
  }, [manualStartHour, bestStartHour]);

  // Sync horizontal day swiper position
  useEffect(() => {
    if (dayScrollRef.current) {
      const activeEl = dayScrollRef.current.querySelector(`[data-offset="${training.dateOffset}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [training.dateOffset]);

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden pb-1 animate-in fade-in duration-300">
      {/* HEADER: EXIT + COMPACT DAY SWIPER */}
      <div className="flex-none flex items-center gap-3 h-10 px-1">
        <button 
          onClick={onReturn}
          className={`flex-none flex items-center gap-1.5 px-3 h-8 rounded-lg border transition-all ${
            isDark ? 'bg-slate-900/50 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          <ArrowLeft className="w-3 h-3" />
          <span className="text-[8px] font-black uppercase tracking-widest leading-none">EXIT</span>
        </button>

        <div className="flex-1 relative h-full flex items-center overflow-hidden">
          <div className={`absolute inset-y-0 left-0 w-8 z-10 pointer-events-none bg-gradient-to-r ${isDark ? 'from-[#05070a]' : 'from-slate-50'} to-transparent`} />
          <div className={`absolute inset-y-0 right-0 w-8 z-10 pointer-events-none bg-gradient-to-l ${isDark ? 'from-[#05070a]' : 'from-slate-50'} to-transparent`} />
          
          <div 
            ref={dayScrollRef}
            className="flex items-center gap-2 overflow-x-auto hide-scrollbar h-full px-8 snap-x snap-mandatory"
          >
            {dayOffsets.map(o => {
              const l = getDayLabel(o);
              const isActive = training.dateOffset === o;
              return (
                <button 
                  key={o} 
                  data-offset={o}
                  onClick={() => onDateOffsetChange(o)}
                  className={`flex-none flex flex-col items-center justify-center w-8 h-8 rounded-lg border transition-all snap-center ${
                    isActive 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg scale-105' 
                      : isDark ? 'bg-white/5 border-white/5 text-slate-600' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="text-[6px] font-black uppercase leading-none mb-0.5">{l.name}</span>
                  <span className="text-[10px] font-black leading-none">{l.num}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TRAINING CONFIGURATION CARD */}
      <div className={`flex-none rounded-[2rem] border p-4 sm:p-5 flex flex-col gap-4 transition-all ${
        isDark ? 'bg-[#0a0c10] border-white/5 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        
        {/* TOP ROW: BASE + DISTANCE (ALIGNED) */}
        <div className="flex gap-4 items-end">
          {/* BASE SELECTOR */}
          <div className="flex-1 flex flex-col gap-1.5 relative">
            <label className={`text-[9px] font-black uppercase tracking-[0.2em] ml-1 transition-colors ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Training Base</label>
            <div className="relative h-12">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input 
                type="text" value={trainingSearch} placeholder="CITY..."
                onChange={(e) => onSearchChange(e.target.value)}
                className={`w-full h-full rounded-xl pl-10 pr-10 text-[11px] font-black uppercase tracking-wider outline-none border transition-all ${
                  isDark ? 'bg-black/40 border-white/10 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500/50'
                }`} 
              />
              <button 
                onClick={onSetToHome} 
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-blue-500 hover:bg-blue-500/10 active:scale-90 transition-all"
                title="Set to home location"
              >
                <Home className="w-4 h-4" />
              </button>
              {showTrainingSuggestions && filterLocations(trainingSearch).length > 0 && (
                <div className={`absolute top-full left-0 right-0 mt-2 z-[210] border rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-[#1a1d24] border-white/10' : 'bg-white border-slate-300'}`}>
                  {filterLocations(trainingSearch).map(loc => (
                    <button key={loc.name} onClick={() => onSelectSuggestion(loc)} className={`w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-wide border-b last:border-0 transition-colors ${isDark ? 'hover:bg-white/5 text-slate-300 border-white/5' : 'hover:bg-slate-50 text-slate-700 border-slate-100'}`}>{loc.name}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* DISTANCE PICKER (VERTICAL) */}
          <div className="w-20 sm:w-24 flex flex-col gap-1.5">
             <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Dist.</label>
             <div className={`h-12 rounded-xl border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`absolute inset-x-0 top-0 h-3 bg-gradient-to-b ${isDark ? 'from-black/40' : 'from-slate-200/40'} to-transparent pointer-events-none z-10`} />
                <div className={`absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t ${isDark ? 'from-black/40' : 'from-slate-200/40'} to-transparent pointer-events-none z-10`} />
                <div ref={verticalPickerRef} className="h-full overflow-y-auto hide-scrollbar scroll-smooth snap-y snap-mandatory py-1">
                   <div className="h-4" />
                   {distances.map(d => (
                     <button
                        key={d} data-dist={d} onClick={() => onDistanceChange(d)}
                        className={`w-full py-1 text-[13px] font-black transition-all snap-center ${training.distance === d ? 'text-blue-500' : isDark ? 'text-slate-700' : 'text-slate-400'}`}
                     >
                       {d}<span className="text-[7px] ml-0.5 opacity-60">KM</span>
                     </button>
                   ))}
                   <div className="h-4" />
                </div>
             </div>
          </div>
        </div>

        {/* BOTTOM ROW: BEST START (HORIZONTAL SLIDER) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
             <label className="text-[9px] font-black text-blue-500 uppercase tracking-[0.25em] flex items-center gap-1.5">
               <Clock className="w-3 h-3" />
               Optimal Window Search
             </label>
             {manualStartHour !== null && manualStartHour !== bestStartHour && (
               <button 
                 onClick={() => onManualHourChange(bestStartHour!)}
                 className="text-[7px] font-black uppercase text-orange-500 border border-orange-500/30 px-1.5 py-0.5 rounded-md hover:bg-orange-500/10 transition-colors"
               >
                 Reset to Best
               </button>
             )}
          </div>
          
          <div className={`h-16 rounded-2xl border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/5 shadow-inner' : 'bg-slate-50 border-slate-100 shadow-inner'}`}>
             <div className={`absolute inset-y-0 left-0 w-12 z-10 pointer-events-none bg-gradient-to-r ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
             <div className={`absolute inset-y-0 right-0 w-12 z-10 pointer-events-none bg-gradient-to-l ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
             
             {/* Center Marker */}
             <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-12 rounded-xl border-2 pointer-events-none z-20 ${isDark ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-200 bg-white'}`} />

             <div 
               ref={timePickerRef}
               className="h-full flex items-center gap-4 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory px-[calc(50%-28px)]"
             >
                {hours.map(h => {
                  const isSelected = manualStartHour === h || (manualStartHour === null && bestStartHour === h);
                  const isBest = bestStartHour === h;
                  return (
                    <button
                      key={h} data-hour={h} onClick={() => onManualHourChange(h)}
                      className={`flex-none w-14 h-10 flex flex-col items-center justify-center transition-all snap-center relative rounded-lg ${
                        isSelected 
                          ? 'text-orange-500 scale-110 font-black' 
                          : isDark ? 'text-slate-700 font-bold' : 'text-slate-400 font-bold'
                      }`}
                    >
                      <span className="text-[14px] leading-none">{h.toString().padStart(2, '0')}<span className="text-[8px] ml-0.5 opacity-50">H</span></span>
                      {isBest && (
                        <div className="absolute -top-1">
                          <Star className={`w-2 h-2 fill-current ${isSelected ? 'text-orange-500' : 'text-blue-500 opacity-40'}`} />
                        </div>
                      )}
                    </button>
                  );
                })}
             </div>
          </div>
        </div>
      </div>

      {/* INTELLIGENCE DASHBOARD */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        {trainingLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
            <div className="relative">
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
              <Zap className="w-5 h-5 text-yellow-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-black uppercase text-blue-500 tracking-[0.25em]">Scanning Atmos Vitals</span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Compiling recommended window...</span>
            </div>
          </div>
        ) : trainingData ? (
          <div className="flex-1 min-h-0">
             <WeatherCard 
                condition={trainingData.condition} 
                timeRange={trainingData.window.join(' - ')}
                dateLabel={`${getDayLabel(training.dateOffset).name} ${getDayLabel(training.dateOffset).num} ${getDayLabel(training.dateOffset).month}`}
                startLocation={training.location.toUpperCase()}
                endLocation="LOOP"
                distance={training.distance}
                safetyScore={trainingData.score}
                theme={theme}
                showRawWind={true}
                optimizationAdvice={trainingData.optimizationAdvice}
                locationAdvice={trainingData.locationAdvice}
                onSelectLocationAdvice={onSelectSuggestion}
              />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-20">
            <Target className="w-12 h-12" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Initialize parameters</span>
          </div>
        )}
      </div>
    </div>
  );
};
