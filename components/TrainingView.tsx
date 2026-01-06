
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  Search, 
  Home,
  RefreshCw, 
  Clock, 
  Zap, 
  X, 
  Info, 
  BrainCircuit, 
  Trophy,
  Bike,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { TrainingState } from '../types';
import { BelgianLocation } from '../locations';
import { WeatherCard } from './WeatherCard';
import { TrainingWeeklyForecast } from './TrainingWeeklyForecast';
import { TypewriterText } from './TypewriterText';

interface TrainingViewProps {
  isDark: boolean;
  training: TrainingState;
  trainingSearch: string;
  showTrainingSuggestions: boolean;
  isSearching: boolean;
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
  onShowWeekly: () => void;
  filterLocations: (query: string, globalResults: BelgianLocation[]) => BelgianLocation[];
  globalTrainingResults: BelgianLocation[];
  getDayLabel: (offset: number) => { name: string; num: number; month: string };
  isWeeklyView?: boolean;
  weeklyData?: any[];
  weeklyLoading?: boolean;
  onSelectWeeklySlot?: (offset: number, startHour: number) => void;
  aiEnabled: boolean;
  onPopupStateChange?: (isOpen: boolean) => void;
  onToggleMode?: () => void;
}

export const TrainingView: React.FC<TrainingViewProps> = ({
  isDark,
  training,
  trainingSearch,
  showTrainingSuggestions,
  isSearching,
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
  onShowWeekly,
  filterLocations,
  globalTrainingResults,
  getDayLabel,
  isWeeklyView = false,
  weeklyData = [],
  weeklyLoading = false,
  onSelectWeeklySlot,
  aiEnabled,
  onPopupStateChange,
  onToggleMode
}) => {
  const verticalPickerRef = useRef<HTMLDivElement>(null);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const [isIntelligenceExpanded, setIsIntelligenceExpanded] = useState(false);
  const [showTrainingOutlookInfo, setShowTrainingOutlookInfo] = useState(false);
  const [typingStep, setTypingStep] = useState(0);
  const [isInternalPopupActive, setIsInternalPopupActive] = useState(false);
  
  const distances = useMemo(() => Array.from({ length: 30 }, (_, i) => (i + 1) * 5), []); // 5 to 150km
  const hours = useMemo(() => Array.from({ length: 19 }, (_, i) => i + 3), []); // 03:00 to 21:00

  useEffect(() => {
    if (isIntelligenceExpanded) {
      setTypingStep(0);
    }
  }, [isIntelligenceExpanded, trainingData]);

  useEffect(() => {
    const performSync = () => {
      if (!isIntelligenceExpanded && !isWeeklyView && verticalPickerRef.current) {
        const activeEl = verticalPickerRef.current.querySelector(`[data-dist="${training.distance}"]`);
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }
    };
    performSync();
  }, [training.distance, isIntelligenceExpanded, isWeeklyView]);

  useEffect(() => {
    const performSync = () => {
      if (!isIntelligenceExpanded && !isWeeklyView && timePickerRef.current) {
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
  }, [manualStartHour, bestStartHour, isIntelligenceExpanded, isWeeklyView]);

  const suggestions = useMemo(() => filterLocations(trainingSearch, globalTrainingResults), [filterLocations, trainingSearch, globalTrainingResults]);

  const isAIActive = trainingData?.isAIEnhanced;
  const isAIFailed = trainingData?.aiFailed;

  const shouldShowBlock = (index: number) => {
    if (!aiEnabled || isAIFailed) return true;
    if (!isAIActive) return false;
    return typingStep >= index;
  };

  const renderAdviceText = (text: string | undefined, fallback: string, stepIndex: number) => {
    const content = (isAIActive && text && text.length > 0) ? text : fallback;
    if (!aiEnabled || isAIFailed || (isAIActive && (!text || text.length === 0))) {
      return <span className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`}>{content}</span>;
    }
    return (
      <TypewriterText 
        text={content} 
        speed={15}
        className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`} 
        onComplete={() => setTypingStep(prev => Math.max(prev, stepIndex + 1))}
      />
    );
  };

  const handlePopupStateChange = (isOpen: boolean) => {
    setIsInternalPopupActive(isOpen);
    onPopupStateChange?.(isOpen);
  };

  const currentSelectedHour = manualStartHour !== null ? manualStartHour : bestStartHour;
  const isOptimalSelected = currentSelectedHour === bestStartHour;

  return (
    <div className="h-full flex flex-col gap-3 pb-1 animate-in fade-in duration-300">
      {/* Note: Removed overflow-hidden from root container to allow weather popups to overflow visibly */}
      
      {/* TRAINING OUTLOOK INFO POPUP */}
      {showTrainingOutlookInfo && isWeeklyView && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowTrainingOutlookInfo(false)} />
          <div className={`relative w-full max-sm border rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">Optimization Logic</span>
              <button onClick={() => setShowTrainingOutlookInfo(false)} className="p-1 rounded-full hover:bg-white/10 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-none"><Clock className="w-4 h-4 text-orange-500" /></div>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Golden Window</span>
                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed">Scanning 24h to find peak alignment for your effort.</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowTrainingOutlookInfo(false)}
              className={`w-full mt-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDark ? 'bg-slate-900 text-slate-400 border border-white/5 hover:text-white' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'}`}
            >
              Understand
            </button>
          </div>
        </div>
      )}

      {isWeeklyView ? (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-none relative flex items-center justify-center py-2 z-20 shrink-0">
            <div className={`flex items-center p-1 rounded-full border shadow-sm ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
              <button 
                onClick={onToggleMode}
                className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all duration-300 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Bike className="w-3.5 h-3.5" />
                <span>Commute</span>
              </button>
              <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] shadow-lg flex items-center gap-2 transition-all duration-300 ${isDark ? 'bg-orange-900/30 text-orange-400 ring-1 ring-orange-500/50' : 'bg-orange-100 text-orange-700'}`}>
                <Trophy className="w-3.5 h-3.5" />
                <span>Training</span>
              </div>
            </div>
            <button 
              onClick={() => setShowTrainingOutlookInfo(true)}
              className={`absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/5 text-slate-600 hover:text-slate-400' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          <TrainingWeeklyForecast 
            data={weeklyData} 
            loading={weeklyLoading} 
            onSelectDay={(offset, hour) => onSelectWeeklySlot?.(offset, hour)} 
            theme={theme} 
          />
        </div>
      ) : (
        <>
          {!isIntelligenceExpanded && (
            <div className={`flex-none rounded-[2rem] border p-3 flex flex-col gap-2 transition-all duration-300 ${
              isDark ? 'bg-[#0a0c10] border-white/5 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'
            } ${isInternalPopupActive ? 'brightness-[0.4] opacity-50 scale-[0.98] pointer-events-none' : ''}`}>
              
              <div className="flex gap-3 items-end">
                <div className="flex-1 flex flex-col gap-1 relative">
                  <label className={`text-[8px] font-black uppercase tracking-[0.2em] ml-1 transition-colors ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>Training Base</label>
                  <div className="relative h-10">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                    <input 
                      type="text" value={trainingSearch} placeholder="CITY..."
                      onChange={(e) => onSearchChange(e.target.value)}
                      className={`w-full h-full rounded-xl pl-9 pr-9 text-[10px] font-black uppercase tracking-wider outline-none border transition-all ${
                        isDark ? 'bg-[#05070a] border-white/10 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600 shadow-inner'
                      }`} 
                    />
                    <button 
                      onClick={onSetToHome} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 active:scale-90 transition-all"
                    >
                      <Home className="w-3.5 h-3.5" />
                    </button>
                    {showTrainingSuggestions && (isSearching || suggestions.length > 0) && (
                      <div className={`absolute top-full left-0 right-0 mt-2 z-[210] border rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-[#1a1d24] border-white/10' : 'bg-white border-slate-300'}`}>
                        {suggestions.map(loc => (
                          <button key={loc.name} onClick={() => onSelectSuggestion(loc)} className={`w-full px-4 py-3 flex items-center justify-between text-left text-[10px] font-black uppercase tracking-wide border-b last:border-0 transition-colors ${isDark ? 'hover:bg-white/5 text-slate-300 border-white/5' : 'hover:bg-slate-50 text-slate-900 border-slate-100'}`}>
                            <span>{loc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-16 sm:w-20 flex flex-col gap-1">
                   <label className={`text-[8px] font-black uppercase tracking-[0.2em] text-center ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>Dist.</label>
                   <div className={`h-10 rounded-xl border overflow-hidden relative ${isDark ? 'bg-[#05070a] border-white/10' : 'bg-slate-50 border-slate-300 shadow-inner'}`}>
                      <div ref={verticalPickerRef} className="h-full overflow-y-auto hide-scrollbar scroll-smooth snap-y snap-mandatory py-1">
                         <div className="h-3" />
                         {distances.map(d => (
                           <button
                              key={d} data-dist={d} onClick={() => onDistanceChange(d)}
                              className={`w-full py-1 text-[11px] font-black transition-all snap-center relative z-30 ${training.distance === d ? (isDark ? 'text-blue-400' : 'text-slate-950 scale-110') : (isDark ? 'text-slate-700' : 'text-slate-400')}`}
                           >
                             {d}<span className="text-[7px] ml-0.5 opacity-60">KM</span>
                           </button>
                         ))}
                         <div className="h-3" />
                      </div>
                   </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-1 h-4">
                   <label className={`text-[8px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                     <Clock className="w-2.5 h-2.5" />
                     Optimal Window Search
                   </label>
                   {!isOptimalSelected && bestStartHour !== null && (
                     <button 
                        onClick={() => onManualHourChange(bestStartHour)}
                        className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wide text-emerald-500 hover:text-emerald-400 transition-colors animate-in fade-in slide-in-from-right-2 duration-300"
                     >
                       <span>Return to Best</span>
                       <RotateCcw className="w-2.5 h-2.5" />
                     </button>
                   )}
                </div>
                
                <div className={`h-12 rounded-xl border overflow-hidden relative ${isDark ? 'bg-[#05070a] border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
                   <div 
                     ref={timePickerRef}
                     className="h-full flex items-center gap-2 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory px-[calc(50%-24px)]"
                   >
                      {hours.map(h => {
                        const isSelected = currentSelectedHour === h;
                        const isBest = h === bestStartHour;
                        return (
                          <button
                            key={h} data-hour={h} onClick={() => onManualHourChange(h)}
                            className={`flex-none w-12 h-8 flex flex-col items-center justify-center transition-all snap-center relative rounded-lg z-30 group ${
                              isSelected 
                                ? (isDark ? 'text-orange-400 scale-110 font-black' : 'text-slate-950 scale-110 font-black') 
                                : (isDark ? 'text-slate-700 font-bold' : 'text-slate-400 font-bold')
                            }`}
                          >
                            <div className="relative">
                              <span className="text-[13px] leading-none">{h.toString().padStart(2, '0')}<span className="text-[8px] ml-0.5 opacity-50">H</span></span>
                              {isBest && !isSelected && (
                                <div className="absolute -top-1.5 -right-2">
                                  <Sparkles className="w-2 h-2 text-emerald-500 fill-emerald-500/20" />
                                </div>
                              )}
                            </div>
                            {isBest && isSelected && (
                               <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                            )}
                          </button>
                        );
                      })}
                   </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col gap-3 relative z-[60]">
            {trainingLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
            ) : trainingData ? (
              <div className="flex flex-col gap-4 flex-1 min-h-0 relative z-[70]">
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
                      onPopupStateChange={handlePopupStateChange}
                      popupDirection="down" // Ensure downward expansion for visibility
                    />
                </div>

                {isIntelligenceExpanded && (
                  <div 
                    className={`flex-1 border rounded-[2rem] p-5 sm:p-6 flex flex-col gap-6 overflow-y-auto hide-scrollbar animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl ${
                      isDark ? 'bg-[#0a0c10] border-blue-500/20' : 'bg-white border-blue-200 shadow-sm'
                    } ${isInternalPopupActive ? 'brightness-[0.4] opacity-50 pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center justify-between w-full flex-none">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                          <Zap className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">Training Intelligence</span>
                      </div>
                      <button onClick={() => setIsIntelligenceExpanded(false)} className={`p-1.5 rounded-full border transition-all ${isDark ? 'bg-[#1a1d24] border-white/10 text-slate-400' : 'bg-slate-100'}`}><X className="w-4 h-4" /></button>
                    </div>

                    <div className="flex flex-col gap-6 flex-1 pb-2">
                      {shouldShowBlock(0) && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Conditions Analysis</span>
                          <div className="text-[13px] font-semibold text-left">{renderAdviceText(trainingData.condition.surfaceReason, "Standard atmospheric conditions.", 0)}</div>
                        </div>
                      )}
                      {shouldShowBlock(1) && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Performance Advice</span>
                          <div className="text-[13px] font-semibold text-left">{renderAdviceText(trainingData.condition.performanceAdvice, "Maintain standard protocols.", 1)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};