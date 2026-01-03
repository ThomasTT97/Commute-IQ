
import React from 'react';
import { WeatherCard } from '../WeatherCard';
import { Zap, RefreshCw, Compass, Bike, Shirt, ChevronDown } from 'lucide-react';
import { WeatherCondition } from '../../types';

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
  return (
    <div className="flex flex-col gap-4 flex-1">
      <div 
        className={`min-h-0 transition-all duration-500 ease-in-out ${activeLegIndex === 0 && !isAdviceExpanded ? 'flex-[3]' : 'flex-[1]'}`}
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

      <button 
        onClick={() => setIsAdviceExpanded(!isAdviceExpanded)} 
        className={`flex-none border rounded-[2rem] p-5 flex flex-col gap-3 active:scale-[0.99] transition-all duration-500 ease-in-out overflow-hidden shadow-xl ${
          isAdviceExpanded 
            ? (isDark ? 'bg-blue-600/10 border-blue-500/40 ring-1 ring-blue-500/20 h-auto' : 'bg-white border-blue-200 shadow-blue-500/10 h-auto')
            : (isDark ? 'bg-blue-500/5 border-blue-500/20 shadow-blue-500/5' : 'bg-white border-blue-100 shadow-sm')
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg transition-colors ${isAdviceExpanded ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
              <Zap className="w-4 h-4" />
            </div>
            <span className={`text-[11px] font-black uppercase tracking-[0.25em] ${isAdviceExpanded || isCurrentDayEnhanced ? 'text-blue-500' : 'text-slate-500'}`}>
              {isCurrentDayEnhanced ? 'Commute Intelligence' : 'Basic Telemetry'}
            </span>
          </div>
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
        
        {!isAdviceExpanded ? (
          <p className={`text-[13px] font-medium leading-[1.5] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {activeWeather?.surfaceReason || (loadingOffsets.length > 0 ? "Connecting to weather satellite..." : "Processing telemetry for tactical riding advice...")}
          </p>
        ) : (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Riding Style Advice</span>
              </div>
              <p className={`text-[13px] font-semibold leading-[1.5] text-left ${isDark ? 'text-white' : 'text-slate-950'}`}>
                {activeWeather?.ridingStyleAdvice || "Standard defensive riding protocols."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Bike className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Bike Setup Advice</span>
              </div>
              <p className={`text-[13px] font-semibold leading-[1.5] text-left ${isDark ? 'text-white' : 'text-slate-950'}`}>
                {activeWeather?.bikeSetupAdvice || "Check tire pressure and clean drive-train."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Shirt className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Clothing Advice</span>
              </div>
              <p className={`text-[13px] font-semibold leading-[1.5] text-left ${isDark ? 'text-white' : 'text-slate-950'}`}>
                {activeWeather?.clothingAdvice || "Standard seasonal cycling kit."}
              </p>
            </div>
          </div>
        )}
      </button>

      <div 
        className={`min-h-0 transition-all duration-500 ease-in-out ${activeLegIndex === 1 && !isAdviceExpanded ? 'flex-[3]' : 'flex-[1]'}`}
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
