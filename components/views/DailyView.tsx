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
  onPopupStateChange?: (isOpen: boolean) => void;
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
  isDark,
  onPopupStateChange
}) => {
  const [typingStep, setTypingStep] = useState(0);

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
          speed={15}
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
      return <TypewriterText text={activeWeather?.surfaceReason || ""} speed={15} className={`text-[12.5px] font-semibold leading-[1.3] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`} />;
    }

    return (
      <div className="flex items-center gap-2 py-0.5">
         <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
         <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Synthesizing route intelligence...</span>
      </div>
    );
  };

  const handleCardClick = (index: number) => {
    if (activeLegIndex !== index) {
      setActiveLegIndex(index);
    } else {
      setIsAdviceExpanded(!isAdviceExpanded); 
    }
  };

  const activeLabel = activeLegIndex === 0 ? "Morning" : "Evening";

  return (
    <div className="flex flex-col gap-1.5 flex-1 h-full overflow-hidden">
      {/* Morning Card */}
      <div 
        className={`min-h-0 transition-all duration-500 ease-in-out cursor-pointer relative ${
          isAdviceExpanded ? 'flex-none z-10' : (activeLegIndex === 0 ? 'flex-[1.7] z-40' : 'flex-[1] z-20')
        }`}
        onClick={() => handleCardClick(0)}
      >
        <WeatherCard 
          {...primaryData} 
          distance={displayedDistance} 
          safetyScore={primaryData.score} 
          theme={settings.theme} 
          compact={isAdviceExpanded || activeLegIndex === 1}
          isActive={activeLegIndex === 0}
          popupDirection="down"
          onPopupStateChange={onPopupStateChange}
        />
      </div>

      {/* Intelligence Box */}
      <div 
        className={`border rounded-[1.5rem] flex flex-col transition-all duration-500 ease-in-out overflow-hidden shadow-lg z-10 ${
          isAdviceExpanded 
            ? `flex-1 min-h-0 p-4 gap-3 ${isDark ? 'bg-blue-600/5 border-blue-500/20' : 'bg-white border-blue-200 shadow-sm'}`
            : `flex-none cursor-pointer px-4 py-2.5 min-h-[72px] justify-center gap-1.5 active:scale-[0.99] ${isDark ? 'bg-blue-600/5 border-blue-500/20 shadow-blue-500/5' : 'bg-white border-blue-100 shadow-sm'}`
        }`}
        onClick={() => !isAdviceExpanded && setIsAdviceExpanded(true)}
      >
        <div className="flex items-center justify-between w-full flex-none">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-lg transition-colors ${!settings.disableAI && !isCurrentDayEnhanced ? 'bg-slate-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
              <Zap className="w-3 h-3" />
            </div>
            <div className="flex flex-col">
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] leading-none ${!settings.disableAI && !isCurrentDayEnhanced ? 'text-slate-600' : 'text-blue-600'}`}>
                {!settings.disableAI && !isCurrentDayEnhanced ? 'Deep Analysis...' : 'Commute Intelligence'}
              </span>
              {isAdviceExpanded && (
                <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  For: <span className={isDark ? 'text-white' : 'text-slate-900'}>{activeLabel} Ride</span>
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdviceExpanded ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsAdviceExpanded(false); }}
                  className={`p-1 rounded-full border transition-all ${
                    isDark ? 'bg-slate-900 border-white/10 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-blue-600'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
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
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-500 pb-1">
              {!settings.disableAI && !isCurrentDayEnhanced && (
                <div className="flex flex-col gap-3 items-center justify-center py-6">
                  <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                  <span className="text-[9px] font-black uppercase text-blue-600 tracking-[0.2em] animate-pulse">Running Tactical Inference...</span>
                </div>
              )}

              {(shouldShowBlock(0) || settings.disableAI) && (
                <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-1.5">
                    <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Conditions Analysis</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.4] text-left`}>
                    {renderAdviceText(activeWeather?.surfaceReason, "Standard atmospheric conditions. No specific hazards detected.", 0)}
                  </div>
                </div>
              )}

              {(shouldShowBlock(1) || settings.disableAI) && (
                <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Performance Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.4] text-left`}>
                    {renderAdviceText(activeWeather?.performanceAdvice, "Conditions are within standard operating parameters.", 1)}
                  </div>
                </div>
              )}

              {(shouldShowBlock(2) || settings.disableAI) && (
                <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Riding Style Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.4] text-left`}>
                    {renderAdviceText(activeWeather?.ridingStyleAdvice, "Maintain standard defensive riding protocols.", 2)}
                  </div>
                </div>
              )}

              {(shouldShowBlock(3) || settings.disableAI) && (
                <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Bike Setup Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.4] text-left`}>
                    {renderAdviceText(activeWeather?.bikeSetupAdvice, "Check essential hardware and tire pressures.", 3)}
                  </div>
                </div>
              )}

              {(shouldShowBlock(4) || settings.disableAI) && (
                <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Clothing Advice</span>
                  </div>
                  <div className={`text-[13px] font-semibold leading-[1.4] text-left`}>
                    {renderAdviceText(activeWeather?.clothingAdvice, "Standard seasonal cycling kit.", 4)}
                  </div>
                </div>
              )}

              <div className="pt-3 mt-1 border-t border-dashed border-slate-500/20 flex justify-end">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest opacity-40 ${
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

      {/* Evening Card */}
      <div 
        className={`min-h-0 transition-all duration-500 ease-in-out cursor-pointer relative ${
          isAdviceExpanded ? 'flex-none z-10' : (activeLegIndex === 1 ? 'flex-[1.7] z-40' : 'flex-[1] z-20')
        }`}
        onClick={() => handleCardClick(1)}
      >
        <WeatherCard 
          {...secondaryData} 
          distance={displayedDistance} 
          safetyScore={secondaryData.score} 
          theme={settings.theme} 
          compact={isAdviceExpanded || activeLegIndex === 0}
          isActive={activeLegIndex === 1}
          popupDirection="up"
          onPopupStateChange={onPopupStateChange}
        />
      </div>
    </div>
  );
};