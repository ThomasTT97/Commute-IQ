
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  Search, 
  Home,
  MapPin,
  RefreshCw, 
  Clock, 
  Zap, 
  X, 
  Info, 
  BrainCircuit, 
  Trophy,
  Bike,
  Sparkles,
  RotateCcw,
  Loader2,
  CloudRain,
  Activity,
  Compass,
  Shirt,
  Calculator,
  Globe,
  Star
} from 'lucide-react';
import { TrainingState } from '../types';
import { BelgianLocation } from '../locations';
import { WeatherCard } from './WeatherCard';
import { TrainingWeeklyForecast } from './TrainingWeeklyForecast';
import { TypewriterText } from './TypewriterText';
import { currentLLMModel } from '../services/geminiService';

interface TrainingViewProps {
  isDark: boolean;
  training: TrainingState;
  trainingSearch: string;
  showTrainingSuggestions: boolean;
  setShowTrainingSuggestions?: (val: boolean) => void;
  isSearching: boolean;
  trainingData: any;
  trainingLoading: boolean;
  manualStartHour: number | null;
  bestStartHour: number | null;
  theme: 'dark' | 'light';
  onReturn: () => void;
  onSearchChange: (val: string) => void;
  onSetToHome: () => void;
  onSetToCurrent: () => void;
  onDateOffsetChange: (offset: number) => void;
  onDistanceChange: (dist: number) => void;
  onManualHourChange: (hour: number | null) => void;
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
  onTriggerAlternativesSearch: () => void;
}

const formatModelName = (model: string | null): string => {
  if (!model) return 'GEMINI';
  const m = model.toLowerCase();
  if (m.includes('gemini-3-flash')) return 'GEMINI 3.0 FLASH';
  if (m.includes('gemini-3-pro')) return 'GEMINI 3.0 PRO';
  if (m.includes('gemini-2.5-flash')) return 'GEMINI 2.5 FLASH';
  if (m.includes('gemini-1.5-flash')) return 'GEMINI 1.5 FLASH';
  if (m.includes('lite')) return 'GEMINI FLASH LITE';
  return 'GEMINI AI';
};

export const TrainingView: React.FC<TrainingViewProps> = ({
  isDark,
  training,
  trainingSearch,
  showTrainingSuggestions,
  setShowTrainingSuggestions,
  isSearching,
  trainingData,
  trainingLoading,
  manualStartHour,
  bestStartHour,
  theme,
  onReturn,
  onSearchChange,
  onSetToHome,
  onSetToCurrent,
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
  onToggleMode,
  onTriggerAlternativesSearch
}) => {
  const verticalPickerRef = useRef<HTMLDivElement>(null);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const [isIntelligenceExpanded, setIsIntelligenceExpanded] = useState(false);
  const [showTrainingOutlookInfo, setShowTrainingOutlookInfo] = useState(false);
  const [typingStep, setTypingStep] = useState(0);
  const [isInternalPopupActive, setIsInternalPopupActive] = useState(false);
  
  const distances = useMemo(() => Array.from({ length: 30 }, (_, i) => (i + 1) * 5), []);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

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

  const renderAdviceText = (text: string | undefined, fallback: string, stepIndex: number) => {
    if (isAIActive && !isAIFailed && text) {
      return (
        <TypewriterText 
          text={text} 
          speed={6} 
          className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`} 
          onComplete={() => setTypingStep(prev => Math.max(prev, stepIndex + 1))}
        />
      );
    }
    // Instant reveal for manual fallback
    return <span className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`}>{fallback}</span>;
  };

  const handlePopupStateChange = (isOpen: boolean) => {
    setIsInternalPopupActive(isOpen);
    onPopupStateChange?.(isOpen);
  };

  const currentSelectedHour = manualStartHour !== null ? manualStartHour : bestStartHour;
  const isOptimalSelected = manualStartHour === null || manualStartHour === bestStartHour;

  return (
    <div className="h-full flex flex-col gap-3 pb-1 animate-in fade-in duration-300">
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
            <button onClick={() => setShowTrainingOutlookInfo(true)} className={`absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/5 text-slate-600 hover:text-slate-400' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}><Info className="w-4 h-4" /></button>
          </div>
          <TrainingWeeklyForecast data={weeklyData} loading={weeklyLoading} onSelectDay={(offset, hour) => onSelectWeeklySlot?.(offset, hour)} theme={theme} />
        </div>
      ) : (
        <>
          {!isIntelligenceExpanded && (
            <div className={`flex-none rounded-[2rem] border p-3 flex flex-col gap-2 transition-all duration-300 ${isDark ? 'bg-[#0a0c10] border-white/5 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'} ${isInternalPopupActive ? 'brightness-[0.4] opacity-50 scale-[0.98] pointer-events-none' : ''}`}>
              <div className="flex gap-3 items-end">
                <div className="flex-1 flex flex-col gap-1 relative">
                  <label className={`text-[8px] font-black uppercase tracking-[0.2em] ml-1 transition-colors ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>Training Base</label>
                  <div className="relative h-10">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                    <input type="text" value={trainingSearch} placeholder="CITY..." onFocus={() => setShowTrainingSuggestions?.(true)} onChange={(e) => onSearchChange(e.target.value)} className={`w-full h-full rounded-xl pl-9 pr-24 text-[10px] font-black uppercase tracking-wider outline-none border transition-all ${isDark ? 'bg-[#05070a] border-white/10 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600 shadow-inner'}`} />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      {trainingSearch && (
                        <button onClick={() => onSearchChange("")} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 transition-colors" title="Clear"><X className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={onSetToCurrent} className="p-1.5 rounded-lg text-emerald-600" title="Current"><MapPin className="w-3.5 h-3.5" /></button>
                      <button onClick={onSetToHome} className="p-1.5 rounded-lg text-blue-600" title="Home"><Home className="w-3.5 h-3.5" /></button>
                    </div>

                    {showTrainingSuggestions && (isSearching || suggestions.length > 0) && (
                      <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
                        {suggestions.map(loc => (
                              <button key={`${loc.name}-${loc.lat}`} onClick={() => onSelectSuggestion(loc)} className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-[10px] font-black uppercase tracking-wider border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}>
                                <span className="truncate pr-4">{loc.name}</span>
                                <div className="flex items-center gap-1 text-[8px] font-black text-blue-500/80 shrink-0">
                                  <Globe className="w-2.5 h-2.5" />
                                  <span>GPS</span>
                                </div>
                              </button>
                        ))}
                        {isSearching && (
                          <div className={`px-4 py-2.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider border-t ${isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                            <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                            <span className="text-blue-500/80">Scanning Maps...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-16 flex flex-col gap-1">
                   <label className={`text-[8px] font-black uppercase tracking-[0.2em] text-center ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>Dist.</label>
                   <div className={`h-10 rounded-xl border overflow-hidden relative ${isDark ? 'bg-[#05070a] border-white/10' : 'bg-slate-50 border-slate-300 shadow-inner'}`}>
                      <div ref={verticalPickerRef} className="h-full overflow-y-auto hide-scrollbar scroll-smooth snap-y snap-mandatory py-1">
                         {distances.map(d => (
                           <button key={d} data-dist={d} onClick={() => onDistanceChange(d)} className={`w-full py-1 text-[11px] font-black transition-all snap-center ${training.distance === d ? (isDark ? 'text-blue-400' : 'text-slate-950') : 'text-slate-400'}`}>{d}</button>
                         ))}
                      </div>
                   </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className={`text-[8px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}><Clock className="w-2.5 h-2.5" />Optimal Window Search</label>
                  {!isOptimalSelected && (
                    <button 
                      onClick={() => onManualHourChange(null)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-500 text-[7px] font-black uppercase tracking-widest animate-in fade-in zoom-in duration-300"
                    >
                      <RotateCcw className="w-2 h-2" />
                      Reset to Optimal
                    </button>
                  )}
                </div>
                <div className={`h-12 rounded-xl border overflow-hidden relative ${isDark ? 'bg-[#05070a] border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
                   <div ref={timePickerRef} className="h-full flex items-center gap-2 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory px-[calc(50%-24px)]">
                      {hours.map(h => {
                        const isBest = h === bestStartHour;
                        const isSelected = currentSelectedHour === h;
                        return (
                          <button 
                            key={h} 
                            data-hour={h} 
                            onClick={() => onManualHourChange(h)} 
                            className={`flex-none w-12 h-8 flex flex-col items-center justify-center transition-all snap-center rounded-lg relative ${isSelected ? (isDark ? 'text-orange-400 font-black bg-white/5' : 'text-slate-950 font-black bg-slate-200 shadow-sm') : 'text-slate-400'}`}
                          >
                            <span className="text-[13px]">{h.toString().padStart(2, '0')}</span>
                            {isBest && !isSelected && (
                              <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500/50" />
                            )}
                            {isBest && isSelected && (
                              <Star className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 text-blue-500/80 fill-current" />
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
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 animate-pulse">Syncing...</span>
              </div>
            ) : trainingData ? (
              <div className="flex flex-col gap-4 flex-1 min-h-0 relative z-[70]">
                <div onClick={() => isIntelligenceExpanded && setIsIntelligenceExpanded(false)} className={`transition-all duration-500 ease-in-out ${isIntelligenceExpanded ? 'flex-none cursor-pointer' : 'flex-1 min-h-0'}`}>
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
                      popupDirection="down"
                      onTriggerAlternativesSearch={onTriggerAlternativesSearch}
                      isLoading={trainingLoading}
                      searchCriteria={trainingData.searchCriteria}
                      setSearchCriteria={trainingData.setSearchCriteria}
                    />
                </div>

                {isIntelligenceExpanded && (
                  <div className={`flex-1 border rounded-[2.5rem] p-6 flex flex-col gap-8 overflow-y-auto hide-scrollbar animate-in fade-in slide-in-from-top-4 duration-500 shadow-2xl ${isDark ? 'bg-[#0a0c10] border-white/5' : 'bg-white border-blue-200 shadow-sm'} ${isInternalPopupActive ? 'brightness-[0.4] opacity-50 pointer-events-none' : ''}`}>
                    
                    {/* IQ Header */}
                    <div className="flex items-center justify-between w-full flex-none">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-blue-600/10 text-blue-500">
                          <span className="text-[16px] font-black italic">IQ</span>
                        </div>
                        <span className={`text-[12px] font-black uppercase tracking-[0.25em] ${aiEnabled && !isAIActive && !isAIFailed ? 'text-blue-600 animate-pulse' : 'text-blue-500'}`}>
                          {aiEnabled && !isAIActive && !isAIFailed ? 'ENHANCING...' : 'TACTICAL ADVICE'}
                        </span>
                      </div>
                      <button onClick={() => setIsIntelligenceExpanded(false)} className={`p-2 rounded-full transition-all ${isDark ? 'bg-white/5 text-slate-500 hover:text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}><X className="w-5 h-5" /></button>
                    </div>

                    <div className="flex flex-col gap-8 flex-1">
                      
                      {/* Summary Section (Conditions) */}
                      <div className="flex flex-col gap-2.5 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 opacity-50">
                          <CloudRain className="w-4 h-4 text-blue-500" />
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Conditions</span>
                        </div>
                        <div className={`text-[14px] font-medium leading-[1.5] text-left opacity-90 transition-all ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                           {renderAdviceText(trainingData.condition.surfaceReason, trainingData.condition.surfaceReason || "Normal atmospheric conditions for standard training effort.", 0)}
                        </div>
                      </div>

                      {/* 4 Core Intelligence Topics */}
                      <div className="space-y-6">
                        
                        {/* Performance */}
                        {(typingStep >= 1 || !isAIActive) && (
                          <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex items-center gap-2 opacity-50">
                              <Activity className="w-4 h-4 text-emerald-500" />
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Performance</span>
                            </div>
                            <div className={`text-[14px] font-medium leading-[1.5] text-left opacity-90 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                               {renderAdviceText(trainingData.condition.performanceAdvice, "Maintain standard training intensity protocols.", 1)}
                            </div>
                          </div>
                        )}

                        {/* Riding Style */}
                        {(typingStep >= 2 || !isAIActive) && (
                          <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex items-center gap-2 opacity-50">
                              <Compass className="w-4 h-4 text-blue-400" />
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Riding Style</span>
                            </div>
                            <div className={`text-[14px] font-medium leading-[1.5] text-left opacity-90 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                               {renderAdviceText(trainingData.condition.ridingStyleAdvice, "Execute standard cornering and braking protocols.", 2)}
                            </div>
                          </div>
                        )}

                        {/* Bike Setup */}
                        {(typingStep >= 3 || !isAIActive) && (
                          <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex items-center gap-2 opacity-50">
                              <Bike className="w-4 h-4 text-blue-500" />
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Bike Setup</span>
                            </div>
                            <div className={`text-[14px] font-medium leading-[1.5] text-left opacity-90 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                               {renderAdviceText(trainingData.condition.bikeSetupAdvice, "Maintain base mechanical setup and check lights.", 3)}
                            </div>
                          </div>
                        )}

                        {/* Clothing */}
                        {(typingStep >= 4 || !isAIActive) && (
                          <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex items-center gap-2 opacity-50">
                              <Shirt className="w-4 h-4 text-indigo-400" />
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Clothing</span>
                            </div>
                            <div className={`text-[14px] font-medium leading-[1.5] text-left opacity-90 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                               {renderAdviceText(trainingData.condition.clothingAdvice, "Standard cycling kit for current atmospheric profile.", 4)}
                            </div>
                          </div>
                        )}

                      </div>

                      {/* Source attribution at the bottom-right */}
                      <div className="pt-6 mt-auto border-t border-dashed border-white/5 flex justify-end">
                        <div className={`flex items-center gap-2 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] opacity-40 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {isAIActive && !isAIFailed ? <Sparkles className="w-2.5 h-2.5" /> : <Calculator className="w-2.5 h-2.5" />}
                          <span>SOURCE: {isAIActive && !isAIFailed ? formatModelName(currentLLMModel) : 'COMMUTE IQ CORE'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <MapPin className="w-10 h-10 text-slate-500 opacity-20 mb-4" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Awaiting location resolution...</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
