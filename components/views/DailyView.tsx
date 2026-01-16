
import React, { useState, useEffect } from 'react';
import { WeatherCard } from '../WeatherCard';
import { Zap, RefreshCw, Compass, Bike, Shirt, ChevronDown, Loader2, Sparkles, Calculator, CloudRain, Activity, X, Plus } from 'lucide-react';
import { WeatherCondition } from '../../types';
import { TypewriterText } from '../TypewriterText';
import { currentLLMModel } from '../../services/geminiService';
import { CommuteCounter } from '../CommuteCounter';

interface DailyViewProps {
  activeLegIndex: number;
  setActiveLegIndex: (idx: number) => void;
  isAdviceExpanded: boolean;
  setIsAdviceExpanded: (val: boolean) => void;
  primaryData: any;
  secondaryData: any;
  activeWeather: WeatherCondition | null;
  displayedDistance: number;
  settings: any;
  isCurrentDayLoading: boolean;
  isCurrentDayEnhanced: boolean;
  isDark: boolean;
  onPopupStateChange?: (isOpen: boolean) => void;
  history: number[];
  onLogCommute: () => void;
}

const formatModelName = (model: string | null): string => {
  if (!model) return 'Gemini';
  const m = model.toLowerCase();
  if (m.includes('gemini-3-flash')) return 'Gemini 3.0 Flash';
  if (m.includes('gemini-3-pro')) return 'Gemini 3.0 Pro';
  if (m.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
  if (m.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash';
  if (m.includes('lite')) return 'Gemini Flash Lite';
  return 'Gemini AI';
};

export const DailyView: React.FC<DailyViewProps> = ({
  activeLegIndex,
  setActiveLegIndex,
  isAdviceExpanded,
  setIsAdviceExpanded,
  primaryData,
  secondaryData,
  activeWeather,
  displayedDistance,
  settings,
  isCurrentDayLoading,
  isCurrentDayEnhanced,
  isDark,
  onPopupStateChange,
  history,
  onLogCommute
}) => {
  const [typingStep, setTypingStep] = useState(0);
  const [counterFilter, setCounterFilter] = useState<'all' | 'year' | 'month'>('all');
  const [isLogging, setIsLogging] = useState(false);
  const [isLoggerExpanded, setIsLoggerExpanded] = useState(false);

  useEffect(() => {
    if (isAdviceExpanded) {
      setTypingStep(0);
    }
  }, [isAdviceExpanded, activeLegIndex]); 
  
  const shouldShowBlock = (index: number) => {
    if (settings.disableAI || !isCurrentDayEnhanced) return true;
    return typingStep >= index;
  };

  const renderAdviceText = (text: string | undefined, fallback: string, stepIndex: number) => {
    if (isCurrentDayEnhanced && !settings.disableAI && text) {
      return (
        <TypewriterText 
          text={text} 
          speed={8} 
          className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`} 
          onComplete={() => setTypingStep(prev => Math.max(prev, stepIndex + 1))}
        />
      );
    }
    return <span className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`}>{fallback}</span>;
  };

  const renderSurfaceReason = () => {
    const defaultText = activeWeather?.surfaceReason || (isCurrentDayLoading ? "Connecting to weather satellite..." : "Processing telemetry for tactical riding advice...");
    if (settings.disableAI || (!isCurrentDayEnhanced && !isCurrentDayLoading)) {
      return <p className={`text-[12.5px] font-semibold leading-[1.3] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{defaultText}</p>;
    }
    if (isCurrentDayEnhanced) {
      return <TypewriterText text={activeWeather?.surfaceReason || ""} speed={10} className={`text-[12.5px] font-semibold leading-[1.3] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`} />;
    }
    return (
      <div className="flex items-center gap-2 py-0.5">
         <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
         <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Synthesizing route intelligence...</span>
      </div>
    );
  };

  const handleCardClick = (index: number) => {
    if (isLoggerExpanded) {
      setIsLoggerExpanded(false);
      setActiveLegIndex(index);
      return;
    }

    if (activeLegIndex !== index) {
      setActiveLegIndex(index);
    } else {
      setIsAdviceExpanded(!isAdviceExpanded); 
    }
  };

  const handleLogClick = () => {
    setIsLogging(true);
    onLogCommute();
    setTimeout(() => setIsLogging(false), 500);
  };

  const activeLabel = activeLegIndex === 0 ? "Morning" : "Evening";

  return (
    <div className="flex flex-col gap-2 flex-1 h-full overflow-hidden pb-3 relative">
      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3 min-h-0">
        
        {/* Primary Weather Card */}
        <div className="flex-none transition-all duration-500 ease-in-out cursor-pointer relative z-40" onClick={() => handleCardClick(0)}>
          <WeatherCard 
            {...primaryData} 
            distance={displayedDistance} 
            safetyScore={primaryData.score} 
            theme={settings.theme} 
            compact={isLoggerExpanded || activeLegIndex === 1} 
            isActive={!isLoggerExpanded && activeLegIndex === 0} 
            popupDirection="down" 
            onPopupStateChange={onPopupStateChange} 
            isLoading={isCurrentDayLoading} 
          />
        </div>

        {/* Advice Block - Hidden when logger is expanded to save space */}
        {!isLoggerExpanded && (
          <div className={`border rounded-[1.5rem] flex flex-col transition-all duration-500 ease-in-out overflow-hidden shadow-lg z-10 flex-none animate-in fade-in zoom-in-95 ${isAdviceExpanded ? `p-5 gap-4 min-h-[360px] ${isDark ? 'bg-blue-600/5 border-blue-500/20' : 'bg-white border-blue-200 shadow-sm'}` : `cursor-pointer px-4 py-3 min-h-[72px] justify-center gap-1.5 active:scale-[0.99] ${isDark ? 'bg-blue-600/5 border-blue-500/20 shadow-blue-500/5' : 'bg-white border-blue-100 shadow-sm'}`}`} onClick={() => !isAdviceExpanded && setIsAdviceExpanded(true)}>
            <div className="flex items-center justify-between w-full flex-none">
              <div className="flex items-center gap-2.5">
                <div className={`flex items-center justify-center p-1.5 rounded-lg transition-colors bg-blue-600/10 text-blue-500`}>
                  <span className="text-[14px] font-black italic">IQ</span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] leading-none text-blue-600 ${!settings.disableAI && !isCurrentDayEnhanced ? 'animate-pulse' : ''}`}>
                    {!settings.disableAI && !isCurrentDayEnhanced ? 'Enhancing Analytics...' : 'Commute IQ Intelligence'}
                  </span>
                  {isAdviceExpanded && <span className={`text-[8px] font-bold uppercase tracking-wider mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Analysis For: <span className={isDark ? 'text-white' : 'text-slate-900'}>{activeLabel} Ride</span></span>}
                </div>
              </div>
              {isAdviceExpanded && <button onClick={(e) => { e.stopPropagation(); setIsAdviceExpanded(false); }} className={`p-1.5 rounded-full border transition-all ${isDark ? 'bg-slate-900 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-700'}`}><X className="w-3.5 h-3.5" /></button>}
            </div>
            
            <div className={`flex-1 min-h-0 ${isAdviceExpanded ? 'overflow-y-auto hide-scrollbar' : ''}`}>
              {!isAdviceExpanded ? renderSurfaceReason() : (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-500 pb-2">
                  {shouldShowBlock(0) && <div className="flex flex-col gap-2"><div className="flex items-center gap-2"><CloudRain className="w-4 h-4 text-blue-500" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Conditions</span></div><div className={`text-[13.5px] font-semibold leading-[1.45] text-left`}>{renderAdviceText(activeWeather?.surfaceReason, activeWeather?.surfaceReason || "Standard conditions.", 0)}</div></div>}
                  {shouldShowBlock(1) && <div className="flex flex-col gap-2"><div className="flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-600" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Performance</span></div><div className={`text-[13.5px] font-semibold leading-[1.45] text-left`}>{renderAdviceText(activeWeather?.performanceAdvice, activeWeather?.performanceAdvice || "Ride at standard pace.", 1)}</div></div>}
                  {shouldShowBlock(2) && <div className="flex flex-col gap-2"><div className="flex items-center gap-2"><Compass className="w-4 h-4 text-blue-600" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Riding Style</span></div><div className={`text-[13.5px] font-semibold leading-[1.45] text-left`}>{renderAdviceText(activeWeather?.ridingStyleAdvice, activeWeather?.ridingStyleAdvice || "Standard safety protocols.", 2)}</div></div>}
                  {shouldShowBlock(3) && <div className="flex flex-col gap-2"><div className="flex items-center gap-2"><Bike className="w-4 h-4 text-blue-600" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Bike Setup</span></div><div className={`text-[13.5px] font-semibold leading-[1.45] text-left`}>{renderAdviceText(activeWeather?.bikeSetupAdvice, activeWeather?.bikeSetupAdvice || "Check essential hardware.", 3)}</div></div>}
                  {shouldShowBlock(4) && <div className="flex flex-col gap-2"><div className="flex items-center gap-2"><Shirt className="w-4 h-4 text-blue-600" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Clothing</span></div><div className={`text-[13.5px] font-semibold leading-[1.45] text-left`}>{renderAdviceText(activeWeather?.clothingAdvice, activeWeather?.clothingAdvice || "Standard kit.", 4)}</div></div>}
                  <div className="pt-4 mt-2 border-t border-dashed border-slate-500/20 flex justify-end"><div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest opacity-40 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{isCurrentDayEnhanced && !settings.disableAI ? <Sparkles className="w-2.5 h-2.5" /> : <Calculator className="w-2.5 h-2.5" />}<span>SOURCE: {isCurrentDayEnhanced && !settings.disableAI ? formatModelName(currentLLMModel) : 'Algorithm'}</span></div></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Secondary Weather Card */}
        <div className="flex-none transition-all duration-500 ease-in-out cursor-pointer relative z-30" onClick={() => handleCardClick(1)}>
          <WeatherCard 
            {...secondaryData} 
            distance={displayedDistance} 
            safetyScore={secondaryData.score} 
            theme={settings.theme} 
            compact={isLoggerExpanded || activeLegIndex === 0} 
            isActive={!isLoggerExpanded && activeLegIndex === 1} 
            popupDirection="up" 
            onPopupStateChange={onPopupStateChange} 
            isLoading={isCurrentDayLoading} 
          />
        </div>

        {/* Commute Logger */}
        <div className={`transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] relative z-50 mt-0.5 ${isLoggerExpanded ? 'flex-1 min-h-0' : 'flex-none'}`}>
          <CommuteCounter 
            isDark={isDark} 
            distance={displayedDistance} 
            rate={settings.commuteCompensation} 
            history={history} 
            manualHistory={settings.manualCommuteHistory} 
            filter={counterFilter} 
            setFilter={setCounterFilter}
            expanded={isLoggerExpanded}
            onToggleExpand={() => setIsLoggerExpanded(!isLoggerExpanded)}
          />
          
          {/* Action Button */}
          {!isLoggerExpanded && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleLogClick(); }} 
              disabled={isLogging} 
              className={`absolute -top-5 right-2 w-11 h-11 rounded-2xl border flex items-center justify-center transition-all active:scale-95 z-[60] shadow-2xl ${isLogging ? 'bg-blue-600 border-blue-500 scale-90' : isDark ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-blue-500/20' : 'bg-blue-600 border-blue-700 text-white shadow-blue-900/10 hover:bg-blue-700'}`}
            >
              <Plus className={`w-6 h-6 transition-all ${isLogging ? 'rotate-90 scale-75' : ''}`} />
            </button>
          )}

           {isLoggerExpanded && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleLogClick(); }} 
              disabled={isLogging} 
              className={`absolute bottom-5 right-5 w-14 h-14 rounded-full border flex items-center justify-center transition-all active:scale-95 z-[60] shadow-2xl ${isLogging ? 'bg-blue-600 border-blue-500 scale-90' : isDark ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-blue-500/40' : 'bg-blue-600 border-blue-700 text-white shadow-blue-900/20 hover:bg-blue-700'}`}
            >
              <Plus className={`w-8 h-8 transition-all ${isLogging ? 'rotate-90 scale-75' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
