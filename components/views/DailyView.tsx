
import React, { useState, useEffect } from 'react';
import { WeatherCard } from '../WeatherCard';
import { Zap, RefreshCw, Compass, Bike, Shirt, ChevronDown, Loader2, Sparkles, Calculator } from 'lucide-react';
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
  loadingOffsets: number[];
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
  loadingOffsets,
  isCurrentDayEnhanced,
  isDark
}) => {
  const [typingStep, setTypingStep] = useState(0);

  // Reset typing when expanded
  useEffect(() => {
    if (isAdviceExpanded) {
      setTypingStep(0);
    }
  }, [isAdviceExpanded, activeWeather]);
  
  const shouldShowBlock = (index: number) => {
    if (settings.disableAI) return true;
    if (!isCurrentDayEnhanced) return false;
    return typingStep >= index;
  };

  const renderAdviceText = (text: string, fallback: string, stepIndex: number) => {
    // If AI is disabled, show the fallback (default) advice immediately.
    if (settings.disableAI) {
      return <span className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`}>{text || fallback}</span>;
    }
    
    // If AI is enabled and we have enhancements, type it out sequentially
    if (isCurrentDayEnhanced) {
      return (
        <TypewriterText 
          text={text} 
          className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`} 
          onComplete={() => setTypingStep(prev => Math.max(prev, stepIndex + 1))}
        />
      );
    }
    return null;
  };

  const renderSurfaceReason = () => {
    const defaultText = activeWeather?.surfaceReason || (loadingOffsets.length > 0 ? "Connecting to weather satellite..." : "Processing telemetry for tactical riding advice...");
    
    if (settings.disableAI) {
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

  return (
    <div className="flex flex-col gap-4 flex-1 h-full">
      <div 
        className={`min-h-0 transition-all duration-500 ease-in-out ${isAdviceExpanded ? 'flex-none' : (activeLegIndex === 0 ? 'flex-[3]' : 'flex-[1]')}`}
        onClick={() => {
          if (isAdviceExpanded) setIsAdviceExpanded(false);
          if (activeLegIndex !== 0) setActiveLegIndex(0);
        }}
      >
        <WeatherCard 
          {...primaryData} 
          distance={displayedDistance} 
          safetyScore={primaryData.score} 
          theme={settings.theme} 
          compact={activeLegIndex !== 0 || isAdviceExpanded}
        />
      </div>

      <div 
        onClick={() => !isAdviceExpanded && setIsAdviceExpanded(true)}
        className={`border rounded-[2rem] p-5 flex flex-col gap-3 transition-all duration-500 ease-in-out overflow-hidden shadow-xl ${
          isAdviceExpanded 
            ? `flex-1 min-h-0 ${isDark ? 'bg-blue-600/10 border-blue-500/40 ring-1 ring-blue-500/20' : 'bg-white border-blue-200 shadow-blue-500/10'}`
            : `flex-none cursor-pointer active:scale-[0.99] ${isDark ? 'bg-blue-500/5 border-blue-500/20 shadow-blue-500/5' : 'bg-white border-blue-100 shadow-sm'}`
        }`}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); setIsAdviceExpanded(!isAdviceExpanded); }}
          className="flex items-center justify-between w-full flex-none"
        >
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg transition-colors ${isAdviceExpanded ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
              <Zap className="w-4 h-4" />
            </div>
            <span className={`text-[11px] font-black uppercase tracking-[0.25em] ${isAdviceExpanded || isCurrentDayEnhanced ? 'text-blue-500' : 'text-slate-500'}`}>
              {!settings.disableAI && !isCurrentDayEnhanced ? 'Analyzing...' : 'Commute Intelligence'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdviceExpanded ? (
              <ChevronDown className="w-4 h-4 text-blue-500 rotate-180 transition-transform" />
            ) : (
              !isCurrentDayEnhanced && !settings.disableAI && (
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="w-2.5 h-2.5 text-blue-400 animate-spin" />
                </div>
              )
            )}
          </div>
        </button>
        
        <div className={`flex-1 min-h-0 ${isAdviceExpanded ? 'overflow-y-auto hide-scrollbar' : ''}`}>
          {!isAdviceExpanded ? (
            renderSurfaceReason()
          ) : (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-500 pb-2">
              {shouldShowBlock(0) && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Riding Style Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.5] text-left`}>
                    {renderAdviceText(activeWeather?.ridingStyleAdvice || "", "Standard defensive riding protocols.", 0)}
                  </div>
                </div>
              )}

              {shouldShowBlock(1) && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <Bike className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Bike Setup Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.5] text-left`}>
                    {renderAdviceText(activeWeather?.bikeSetupAdvice || "", "Check tire pressure and clean drive-train.", 1)}
                  </div>
                </div>
              )}

              {shouldShowBlock(2) && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <Shirt className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Clothing Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.5] text-left`}>
                    {renderAdviceText(activeWeather?.clothingAdvice || "", "Standard seasonal cycling kit.", 2)}
                  </div>
                </div>
              )}

              {/* BOTTOM SOURCE INDICATOR - Subtle */}
              <div className="pt-4 mt-2 border-t border-dashed border-slate-500/10 flex justify-end">
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
        className={`min-h-0 transition-all duration-500 ease-in-out ${isAdviceExpanded ? 'flex-none' : (activeLegIndex === 1 ? 'flex-[3]' : 'flex-[1]')}`}
        onClick={() => {
          if (isAdviceExpanded) setIsAdviceExpanded(false);
          if (activeLegIndex !== 1) setActiveLegIndex(1);
        }}
      >
        <WeatherCard 
          {...secondaryData} 
          distance={displayedDistance} 
          safetyScore={secondaryData.score} 
          theme={settings.theme} 
          compact={activeLegIndex !== 1 || isAdviceExpanded}
        />
      </div>
    </div>
  );
};
