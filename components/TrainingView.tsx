import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  ArrowLeft, 
  Home, 
  RefreshCw, 
  Target,
  Search,
  Zap,
  Star,
  Clock,
  Compass,
  Bike,
  Shirt,
  ChevronDown,
  Globe,
  Activity,
  X,
  Loader2
} from 'lucide-react';
import { TrainingState } from '../types';
import { BelgianLocation } from '../locations';
import { WeatherCard } from './WeatherCard';
import { BELGIAN_LOCATIONS } from '../locations';

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
  // Fix: Update filterLocations prop to accept globalResults and add globalTrainingResults prop
  filterLocations: (query: string, globalResults: BelgianLocation[]) => BelgianLocation[];
  globalTrainingResults: BelgianLocation[]; // New prop
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
  globalTrainingResults, // Destructure new prop
  getDayLabel
}) => {
  const verticalPickerRef = useRef<HTMLDivElement>(null);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const dayScrollRef = useRef<HTMLDivElement>(null);
  const [isIntelligenceExpanded, setIsIntelligenceExpanded] = useState(false);
  
  const distances = useMemo(() => Array.from({ length: 30 }, (_, i) => (i + 1) * 5), []); // 5 to 150km
  const hours = useMemo(() => Array.from({ length: 19 }, (_, i) => i + 3), []); // 03:00 to 21:00
  const dayOffsets = [0, 1, 2, 3, 4, 5, 6];

  // Sync vertical distance picker scroll position
  useEffect(() => {
    const performSync = () => {
      if (!isIntelligenceExpanded && verticalPickerRef.current) {
        const activeEl = verticalPickerRef.current.querySelector(`[data-dist="${training.distance}"]`);
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }
    };

    // Immediate attempt
    performSync();
    
    // Delayed retry to ensure layout is ready after view transition
    const timer = setTimeout(performSync, 100);
    return () => clearTimeout(timer);
  }, [training.distance, isIntelligenceExpanded]);

  // Sync horizontal time picker scroll position
  useEffect(() => {
    const performSync = () => {
      if (!isIntelligenceExpanded && timePickerRef.current) {
        const hourToScroll = manualStartHour !== null ? manualStartHour : bestStartHour;
        if (hourToScroll !== null) {
          const activeEl = timePickerRef.current.querySelector(`[data-hour="${hourToScroll}"]`);
          if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'auto', inline: 'center' });
          }
        }
      }
    };

    performSync();
    const timer = setTimeout(performSync, 100);
    return () => clearTimeout(timer);
  }, [manualStartHour, bestStartHour, isIntelligenceExpanded]);

  // Sync horizontal day picker scroll position to match timing style
  useEffect(() => {
    const performSync = () => {
      if (dayScrollRef.current) {
        const activeEl = dayScrollRef.current.querySelector(`[data-offset="${training.dateOffset}"]`);
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', inline: 'start' });
        }
      }
    };
    
    performSync();
    const timer = setTimeout(performSync, 100);
    return () => clearTimeout(timer);
  }, [training.dateOffset]);

  // Fix: Pass globalTrainingResults to filterLocations
  const suggestions = useMemo(() => filterLocations(trainingSearch, globalTrainingResults), [filterLocations, trainingSearch, globalTrainingResults]);

  const isAIActive = trainingData?.isAIEnhanced;

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden pb-1 animate-in fade-in duration-300">
      {/* HEADER: EXIT + DAY PICKER */}
      <div className="flex-none flex items-center gap-2.5 px-1">
        <button 
          onClick={onReturn}
          className={`flex-none flex items-center gap-1.5 px-2.5 h-10 rounded-xl border transition-all ${
            isDark ? 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-white' : 'bg-white border-slate-300 text-slate-700 hover:text-blue-700'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="text-[8px] font-black uppercase tracking-widest leading-none">EXIT</span>
        </button>

        <div className={`flex-1 h-12 rounded-[1.25rem] border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
          <div className={`absolute inset-y-0 left-0 w-10 z-10 pointer-events-none bg-gradient-to-r ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
          <div className={`absolute inset-y-0 right-0 w-10 z-10 pointer-events-none bg-gradient-to-l ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
          
          <div 
            ref={dayScrollRef}
            className="h-full flex items-center gap-3 overflow-x-auto hide-scrollbar scroll-smooth pl-4"
          >
            {dayOffsets.map(o => {
              const l = getDayLabel(o);
              const isActive = training.dateOffset === o;
              return (
                <button 
                  key={o} 
                  data-offset={o}
                  onClick={() => onDateOffsetChange(o)}
                  className={`flex-none w-11 h-8 flex flex-col items-center justify-center transition-all z-30 ${
                    isActive 
                      ? (isDark ? 'text-blue-400 scale-110 font-black' : 'text-slate-950 scale-110 font-black')
                      : (isDark ? 'text-slate-700 font-bold' : 'text-slate-400 font-bold')
                  }`}
                >
                  <span className="text-[6px] font-black uppercase leading-none mb-0.5">{l.name}</span>
                  <span className="text-[14px] font-black leading-none">{l.num}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TRAINING CONFIGURATION CARD */}
      {!isIntelligenceExpanded && (
        <div className={`flex-none rounded-[2rem] border p-4 sm:p-5 flex flex-col gap-4 transition-all ${
          isDark ? 'bg-[#0a0c10] border-white/5 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          
          <div className="flex gap-4 items-end">
            <div className="flex-1 flex flex-col gap-1.5 relative">
              <label className={`text-[9px] font-black uppercase tracking-[0.2em] ml-1 transition-colors ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>Training Base</label>
              <div className="relative h-12">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input 
                  type="text" value={trainingSearch} placeholder="CITY..."
                  onChange={(e) => onSearchChange(e.target.value)}
                  className={`w-full h-full rounded-xl pl-10 pr-10 text-[11px] font-black uppercase tracking-wider outline-none border transition-all ${
                    isDark ? 'bg-black/40 border-white/10 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600 shadow-inner'
                  }`} 
                />
                <button 
                  onClick={onSetToHome} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 active:scale-90 transition-all"
                  title="Set to home location"
                >
                  <Home className="w-4 h-4" />
                </button>
                {showTrainingSuggestions && suggestions.length > 0 && (
                  <div className={`absolute top-full left-0 right-0 mt-2 z-[210] border rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-[#1a1d24] border-white/10' : 'bg-white border-slate-300'}`}>
                    {suggestions.map(loc => {
                      const isGlobal = !BELGIAN_LOCATIONS.some(bl => bl.name === loc.name);
                      return (
                        <button key={loc.name} onClick={() => onSelectSuggestion(loc)} className={`w-full px-4 py-3 flex items-center justify-between text-left text-[10px] font-black uppercase tracking-wide border-b last:border-0 transition-colors ${isDark ? 'hover:bg-white/5 text-slate-300 border-white/5' : 'hover:bg-slate-50 text-slate-900 border-slate-100'}`}>
                          <span>{loc.name}</span>
                          {isGlobal && <Globe className="w-3 h-3 text-blue-600/50" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="w-20 sm:w-24 flex flex-col gap-1.5">
               <label className={`text-[8px] font-black uppercase tracking-[0.2em] text-center ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>Dist.</label>
               <div className={`h-12 rounded-xl border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-300 shadow-inner'}`}>
                  <div className={`absolute inset-x-0 top-0 h-3 bg-gradient-to-b ${isDark ? 'from-black/40' : 'from-slate-200/40'} to-transparent pointer-events-none z-10`} />
                  <div className={`absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t ${isDark ? 'from-black/40' : 'from-slate-200/40'} to-transparent pointer-events-none z-10`} />
                  
                  {/* Adjusted distance picker highlight height */}
                  <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-9 bg-white border-y border-slate-200 z-20 pointer-events-none opacity-100 ${isDark ? 'hidden' : 'block'}`} />

                  <div ref={verticalPickerRef} className="h-full overflow-y-auto hide-scrollbar scroll-smooth snap-y snap-mandatory py-1">
                     <div className="h-4" />
                     {distances.map(d => (
                       <button
                          key={d} data-dist={d} onClick={() => onDistanceChange(d)}
                          className={`w-full py-1.5 text-[13px] font-black transition-all snap-center relative z-30 ${training.distance === d ? (isDark ? 'text-blue-400' : 'text-slate-950 scale-110') : (isDark ? 'text-slate-700' : 'text-slate-400')}`}
                       >
                         {d}<span className="text-[7px] ml-0.5 opacity-60">KM</span>
                       </button>
                     ))}
                     <div className="h-4" />
                  </div>
               </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
               <label className={`text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                 <Clock className="w-3 h-3" />
                 Optimal Window Search
               </label>
               {manualStartHour !== null && manualStartHour !== bestStartHour && (
                 <button 
                   onClick={() => onManualHourChange(bestStartHour!)}
                   className="text-[7px] font-black uppercase text-orange-600 border border-orange-500/30 px-1.5 py-0.5 rounded-md hover:bg-orange-50 active:scale-95 transition-all"
                 >
                   Reset to Best
                 </button>
               )}
            </div>
            
            <div className={`h-16 rounded-2xl border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
               <div className={`absolute inset-y-0 left-0 w-12 z-10 pointer-events-none bg-gradient-to-r ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
               <div className={`absolute inset-y-0 right-0 w-12 z-10 pointer-events-none bg-gradient-to-l ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
               <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-12 rounded-xl border-2 pointer-events-none z-20 ${isDark ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-400 bg-white shadow-sm'}`} />

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
                        className={`flex-none w-14 h-10 flex flex-col items-center justify-center transition-all snap-center relative rounded-lg z-30 ${
                          isSelected 
                            ? (isDark ? 'text-orange-400 scale-115 font-black' : 'text-slate-950 scale-115 font-black') 
                            : (isDark ? 'text-slate-700 font-bold' : 'text-slate-400 font-bold')
                        }`}
                      >
                        <span className="text-[15px] leading-none">{h.toString().padStart(2, '0')}<span className="text-[9px] ml-0.5 opacity-50">H</span></span>
                        {isBest && (
                          <div className="absolute -top-1">
                            <Star className={`w-2.5 h-2.5 fill-current ${isSelected ? (isDark ? 'text-orange-400' : 'text-slate-950') : 'text-blue-500 opacity-40'}`} />
                          </div>
                        )}
                      </button>
                    );
                  })}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* INTELLIGENCE DASHBOARD */}
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {trainingLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
            <div className="relative">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
              <Zap className="w-5 h-5 text-yellow-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-black uppercase text-blue-600 tracking-[0.25em]">Scanning Atmos Vitals</span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Compiling recommended window...</span>
            </div>
          </div>
        ) : trainingData ? (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div 
              onClick={() => isIntelligenceExpanded && setIsIntelligenceExpanded(false)}
              className={`transition-all duration-500 ease-in-out ${isIntelligenceExpanded ? 'flex-none cursor-pointer' : 'flex-1 min-h-0'}`}
            >
               <WeatherCard 
                  condition={trainingData.condition} 
                  timeRange={trainingData.window.join(' - ')}
                  dateLabel={`${getDayLabel(training.dateOffset).name} ${getDayLabel(training.dateOffset).num} ${getDayLabel(training.dateOffset).month}`}
                  startLocation={training.location.split(',')[0].trim().toUpperCase()}
                  endLocation="LOOP"
                  distance={training.distance}
                  safetyScore={trainingData.score}
                  theme={theme}
                  showRawWind={true}
                  compact={isIntelligenceExpanded}
                  optimizationAdvice={trainingData.optimizationAdvice}
                  locationAdvice={trainingData.locationAdvice}
                  onSelectLocationAdvice={onSelectSuggestion}
                  onToggleIntelligence={() => setIsIntelligenceExpanded(!isIntelligenceExpanded)}
                  isIntelligenceExpanded={isIntelligenceExpanded}
                />
            </div>

            {isIntelligenceExpanded && (
              <div 
                className={`flex-1 border rounded-[2rem] p-5 sm:p-6 flex flex-col gap-6 overflow-y-auto hide-scrollbar animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl ${
                  isDark ? 'bg-blue-600/5 border-blue-500/20' : 'bg-white border-blue-200 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between w-full flex-none">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg transition-colors ${isAIActive ? 'bg-blue-600 text-white' : 'bg-slate-500 text-white animate-pulse'}`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-[0.25em] ${isAIActive ? 'text-blue-600' : 'text-slate-600'}`}>
                      {isAIActive ? 'Training Intelligence' : 'Deep Analysis...'}
                    </span>
                  </div>
                  <button 
                    onClick={() => setIsIntelligenceExpanded(false)}
                    className={`p-1.5 rounded-full border transition-all ${
                      isDark ? 'bg-slate-900 border-white/10 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-blue-600'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-6 flex-1">
                  {!isAIActive && (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                      <span className="text-[8px] font-black uppercase text-blue-600 tracking-widest">Generative Intelligence active...</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Performance Advice</span>
                    </div>
                    <p className={`text-[13px] font-semibold leading-relaxed text-left transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'} ${isAIActive ? 'opacity-100' : 'opacity-40'}`}>
                      {trainingData.condition.performanceAdvice || "Conditions are within standard operating parameters. Monitor heart rate response and hydration."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-blue-600" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Riding Style Advice</span>
                    </div>
                    <p className={`text-[13px] font-semibold leading-relaxed text-left transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'} ${isAIActive ? 'opacity-100' : 'opacity-40'}`}>
                      {trainingData.condition.ridingStyleAdvice || "Maintain standard session protocols."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4 text-blue-600" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Bike Setup Advice</span>
                    </div>
                    <p className={`text-[13px] font-semibold leading-relaxed text-left transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'} ${isAIActive ? 'opacity-100' : 'opacity-40'}`}>
                      {trainingData.condition.bikeSetupAdvice || "Check essential hardware and tire pressures."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Shirt className="w-4 h-4 text-blue-600" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Clothing Advice</span>
                    </div>
                    <p className={`text-[13px] font-semibold leading-relaxed text-left transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'} ${isAIActive ? 'opacity-100' : 'opacity-40'}`}>
                      {trainingData.condition.clothingAdvice || "Standard training kit recommendation."}
                    </p>
                  </div>
                </div>
              </div>
            )}
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