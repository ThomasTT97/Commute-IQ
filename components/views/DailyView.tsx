
import React, { useState, useEffect } from 'react';
import { WeatherCard } from '../WeatherCard';
import { Zap, RefreshCw, Compass, Bike, Shirt, ChevronDown, Loader2, Sparkles, Calculator, CloudRain, Activity, X } from 'lucide-react';
import { WeatherCondition } from '../../types';
import { TypewriterText } from '../TypewriterText';

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
}

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
  isDark
}) => {
  const [typingStep, setTypingStep] = useState(0);

  // Reset typing when expanded or when switching legs
  useEffect(() => {
    if (isAdviceExpanded) {
      setTypingStep(0);
    }
  }, [isAdviceExpanded, activeLegIndex]); // Changed dependency to activeLegIndex to ensure reset on switch
  
  const shouldShowBlock = (index: number) => {
    if (settings.disableAI) return true;
    // If AI is enabled but not enhanced, only show if NOT loading (meaning failed fallback)
    if (!isCurrentDayEnhanced) return !isCurrentDayLoading;
    return typingStep >= index;
  };

  const renderAdviceText = (text: string | undefined, fallback: string, stepIndex: number) => {
    // If AI disabled, or failed (not enhanced and not loading), show fallback immediately
    if (settings.disableAI || (!isCurrentDayEnhanced && !isCurrentDayLoading)) {
      return <span className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`}>{text || fallback}</span>;
    }
    
    // If enhanced, type it out
    if (isCurrentDayEnhanced) {
      return (
        <TypewriterText 
          text={text || fallback} 
          className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`} 
          onComplete={() => setTypingStep(prev => Math.max(prev, stepIndex + 1))}
        />
      );
    }
    return null;
  };

  const renderSurfaceReason = () => {
    const defaultText = activeWeather?.surfaceReason || (isCurrentDayLoading ? "Connecting to weather satellite..." : "Processing telemetry for tactical riding advice...");
    
    if (settings.disableAI || (!isCurrentDayEnhanced && !isCurrentDayLoading)) {
      return <p className={`text-[13px] font-medium leading-[1.5] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{defaultText}</p>;
    }

    if (isCurrentDayEnhanced) {
      return <TypewriterText text={activeWeather?.surfaceReason || ""} className={`text-[13px] font-medium leading-[1.5] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`} />;
    }

    // AI on, waiting for enhancement
    return (
      <div className="flex items-center gap-2 py-1">
         <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
         <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Synthesizing route intelligence...</span>
      </div>
    );
  };

  const handleCardClick = (index: number) => {
    if (activeLegIndex !== index) {
      setActiveLegIndex(index);
      // Keep expanded if it was expanded, allowing seamless switching
    } else {
      // If clicking the active card, toggle expansion
      if (isAdviceExpanded) setIsAdviceExpanded(false);
      else setIsAdviceExpanded(true); // Optional: Clicking active card opens intelligence? Maybe better to just toggle off.
    }
  };

  const activeLabel = activeLegIndex === 0 ? "Morning" : "Evening";

  return (
    <div className="flex flex-col gap-4 flex-1 h-full">
      <div 
        className={`min-h-0 transition-all duration-500 ease-in-out cursor-pointer ${isAdviceExpanded ? 'flex-none' : (activeLegIndex === 0 ? 'flex-[3]' : 'flex-[1]')}`}
        onClick={() => handleCardClick(0)}
      >
        <WeatherCard 
          {...primaryData} 
          distance={displayedDistance} 
          safetyScore={primaryData.score} 
          theme={settings.theme} 
          compact={activeLegIndex !== 0 || isAdviceExpanded}
          isActive={activeLegIndex === 0}
        />
      </div>

      <div 
        onClick={() => !isAdviceExpanded && setIsAdviceExpanded(true)}
        className={`border rounded-[2rem] p-5 flex flex-col gap-3 transition-all duration-500 ease-in-out overflow-hidden shadow-xl ${
          isAdviceExpanded 
            ? `flex-1 min-h-0 ${isDark ? 'bg-blue-600/5 border-blue-500/20' : 'bg-white border-blue-200 shadow-sm'}`
            : `flex-none cursor-pointer active:scale-[0.99] ${isDark ? 'bg-blue-500/5 border-blue-500/20 shadow-blue-500/5' : 'bg-white border-blue-100 shadow-sm'}`
        }`}
      >
        <div className="flex items-center justify-between w-full flex-none">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg transition-colors ${!settings.disableAI && isCurrentDayLoading && !isCurrentDayEnhanced ? 'bg-slate-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-black uppercase tracking-[0.2em] leading-none ${!settings.disableAI && isCurrentDayLoading && !isCurrentDayEnhanced ? 'text-slate-600' : 'text-blue-600'}`}>
                {!settings.disableAI && isCurrentDayLoading && !isCurrentDayEnhanced ? 'Deep Analysis...' : 'Commute Intelligence'}
              </span>
              {isAdviceExpanded && (
                <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  For: <span className={isDark ? 'text-white' : 'text-slate-900'}>{activeLabel} Ride</span>
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdviceExpanded ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsAdviceExpanded(false); }}
                  className={`p-1.5 rounded-full border transition-all ${
                    isDark ? 'bg-slate-900 border-white/10 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-blue-600'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
            ) : (
              !isCurrentDayEnhanced && !settings.disableAI && isCurrentDayLoading && (
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="w-2.5 h-2.5 text-blue-400 animate-spin" />
                </div>
              )
            )}
          </div>
        </div>
        
        <div className={`flex-1 min-h-0 ${isAdviceExpanded ? 'overflow-y-auto hide-scrollbar' : ''}`}>
          {!isAdviceExpanded ? (
            renderSurfaceReason()
          ) : (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-500 pb-2">
              {!settings.disableAI && isCurrentDayLoading && !isCurrentDayEnhanced && (
                <div className="flex items-center gap-2 py-1">
                  <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                  <span className="text-[8px] font-black uppercase text-blue-600 tracking-widest">Generative Intelligence active...</span>
                </div>
              )}

              {shouldShowBlock(0) && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <CloudRain className="w-4 h-4 text-blue-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Conditions Analysis</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.5] text-left`}>
                    {renderAdviceText(activeWeather?.surfaceReason, "Standard atmospheric conditions. No specific hazards detected.", 0)}
                  </div>
                </div>
              )}

              {shouldShowBlock(1) && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Performance Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.5] text-left`}>
                    {renderAdviceText(activeWeather?.performanceAdvice, "Conditions are within standard operating parameters. Monitor heart rate response and hydration.", 1)}
                  </div>
                </div>
              )}

              {shouldShowBlock(2) && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-blue-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Riding Style Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.5] text-left`}>
                    {renderAdviceText(activeWeather?.ridingStyleAdvice, "Maintain standard defensive riding protocols.", 2)}
                  </div>
                </div>
              )}

              {shouldShowBlock(3) && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <Bike className="w-4 h-4 text-blue-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Bike Setup Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.5] text-left`}>
                    {renderAdviceText(activeWeather?.bikeSetupAdvice, "Check essential hardware and tire pressures.", 3)}
                  </div>
                </div>
              )}

              {shouldShowBlock(4) && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-blue-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Clothing Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.5] text-left`}>
                    {renderAdviceText(activeWeather?.clothingAdvice, "Standard seasonal cycling kit.", 4)}
                  </div>
                </div>
              )}

              {/* BOTTOM SOURCE INDICATOR - Subtle */}
              <div className="pt-4 mt-2 border-t border-dashed border-slate-500/20 flex justify-end">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest opacity-40 ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  {isCurrentDayEnhanced ? <Sparkles className="w-2.5 h-2.5" /> : <Calculator className="w-2.5 h-2.5" />}
                  <span>Source: {isCurrentDayEnhanced ? 'Gemini 2.0 Flash' : 'Standard Algorithm'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div 
        className={`min-h-0 transition-all duration-500 ease-in-out cursor-pointer ${isAdviceExpanded ? 'flex-none' : (activeLegIndex === 1 ? 'flex-[3]' : 'flex-[1]')}`}
        onClick={() => handleCardClick(1)}
      >
        <WeatherCard 
          {...secondaryData} 
          distance={displayedDistance} 
          safetyScore={secondaryData.score} 
          theme={settings.theme} 
          compact={activeLegIndex !== 1 || isAdviceExpanded}
          isActive={activeLegIndex === 1}
        />
      </div>
    </div>
  );
};
