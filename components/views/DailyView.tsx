import React, { useState, useEffect } from 'react';
import { WeatherCard } from '../WeatherCard';
import { Zap, RefreshCw, Compass, Bike, Shirt, ChevronDown, Loader2, Sparkles, Calculator, CloudRain, Activity, X } from 'lucide-react';
import { WeatherCondition } from '../../types';
import { TypewriterText } from '../TypewriterText';
import { currentLLMModel } from '../../services/geminiService';

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

const formatModelName = (model: string | null): string => {
  if (!model) return 'Gemini';
  if (model.includes('gemini-3-flash')) return 'Gemini 3.0 Flash';
  if (model.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
  if (model.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash';
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
  isDark
}) => {
  const [typingStep, setTypingStep] = useState(0);

  // Reset typing when expanded or when switching legs
  useEffect(() => {
    if (isAdviceExpanded) {
      setTypingStep(0);
    }
  }, [isAdviceExpanded, activeLegIndex]); 
  
  const shouldShowBlock = (index: number) => {
    if (settings.disableAI) return true;
    if (!isCurrentDayEnhanced) return false;
    return typingStep >= index;
  };

  const renderAdviceText = (text: string | undefined, fallback: string, stepIndex: number) => {
    if (settings.disableAI) {
      return <span className={`transition-opacity duration-300 ${isDark ? 'text-white' : 'text-slate-950'}`}>{text || fallback}</span>;
    }
    
    if (isCurrentDayEnhanced) {
      return (
        <TypewriterText 
          text={text || fallback} 
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
      return <p className={`text-[13px] font-medium leading-[1.5] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{defaultText}</p>;
    }

    if (isCurrentDayEnhanced) {
      return <TypewriterText text={activeWeather?.surfaceReason || ""} className={`text-[13px] font-medium leading-[1.5] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`} />;
    }

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
    } else {
      if (isAdviceExpanded) setIsAdviceExpanded(false);
      else setIsAdviceExpanded(true); 
    }
  };

  const activeLabel = activeLegIndex === 0 ? "Morning" : "Evening";

  return (
    <div className="flex flex-col gap-4 flex-1 h-full">
      {/* Top Card */}
      <div 
        className={`min-h-0 transition-all duration-500 ease-in-out cursor-pointer relative z-40 ${isAdviceExpanded ? 'flex-none' : (activeLegIndex === 0 ? 'flex-[3]' : 'flex-[1]')}`}
        onClick={() => handleCardClick(0)}
      >
        <WeatherCard 
          {...primaryData} 
          distance={displayedDistance} 
          safetyScore={primaryData.score} 
          theme={settings.theme} 
          compact={activeLegIndex !== 0 || isAdviceExpanded}
          isActive={activeLegIndex === 0}
          popupDirection="down"
        />
      </div>

      <div 
        onClick={() => !isAdviceExpanded && setIsAdviceExpanded(true)}
        className={`border rounded-[2rem] p-5 flex flex-col gap-3 transition-all duration-500 ease-in-out overflow-hidden shadow-xl z-10 ${
          isAdviceExpanded 
            ? `flex-1 min-h-0 ${isDark ? 'bg-blue-600/5 border-blue-500/20' : 'bg-white border-blue-200 shadow-sm'}`
            : `flex-none cursor-pointer active:scale-[0.99] ${isDark ? 'bg-blue-500/5 border-blue-500/20 shadow-blue-500/5' : 'bg-white border-blue-100 shadow-sm'}`
        }`}
      >
        <div className="flex items-center justify-between w-full flex-none">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg transition-colors ${!settings.disableAI && !isCurrentDayEnhanced ? 'bg-slate-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-black uppercase tracking-[0.2em] leading-none ${!settings.disableAI && !isCurrentDayEnhanced ? 'text-slate-600' : 'text-blue-600'}`}>
                {!settings.disableAI && !isCurrentDayEnhanced ? 'Deep Analysis...' : 'Commute Intelligence'}
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
              !isCurrentDayEnhanced && !settings.disableAI && (
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
              {!settings.disableAI && !isCurrentDayEnhanced && (
                <div className="flex flex-col gap-3 items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <span className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] animate-pulse">Running Tactical Inference...</span>
                </div>
              )}

              {(shouldShowBlock(0) || settings.disableAI) && (
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

              {(shouldShowBlock(1) || settings.disableAI) && (
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

              {(shouldShowBlock(2) || settings.disableAI) && (
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

              {(shouldShowBlock(3) || settings.disableAI) && (
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

              {(shouldShowBlock(4) || settings.disableAI) && (
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

              <div className="pt-4 mt-2 border-t border-dashed border-slate-500/20 flex justify-end">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest opacity-40 ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  {isCurrentDayEnhanced ? <Sparkles className="w-2.5 h-2.5" /> : <Calculator className="w-2.5 h-2.5" />}
                  <span>Source: {isCurrentDayEnhanced ? formatModelName(currentLLMModel) : 'Standard Algorithm'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div 
        className={`min-h-0 transition-all duration-500 ease-in-out cursor-pointer relative z-30 ${isAdviceExpanded ? 'flex-none' : (activeLegIndex === 1 ? 'flex-[3]' : 'flex-[1]')}`}
        onClick={() => handleCardClick(1)}
      >
        <WeatherCard 
          {...secondaryData} 
          distance={displayedDistance} 
          safetyScore={secondaryData.score} 
          theme={settings.theme} 
          compact={activeLegIndex !== 1 || isAdviceExpanded}
          isActive={activeLegIndex === 1}
          popupDirection="up"
        />
      </div>
    </div>
  );
};