
import React, { useState, useEffect, useMemo } from 'react';
import { WeatherCondition } from '../types';
import { WEATHER_ICONS } from '../constants';
import { 
  Waves, 
  Wind, 
  AlertTriangle, 
  ArrowDownToLine, 
  MoveUp, 
  ShieldCheck, 
  Zap, 
  HelpCircle,
  Clock,
  Calendar,
  ArrowLeftRight,
  MapPin,
  ArrowRight,
  Navigation,
  Lightbulb,
  LightbulbOff
} from 'lucide-react';

interface WeatherCardProps {
  condition?: WeatherCondition | null;
  title?: string;
  timeRange?: string;
  dateLabel?: string;
  startLocation?: string;
  endLocation?: string;
  compact?: boolean;
  targetTime?: Date | null;
  distance?: number;
  safetyScore?: number;
  theme?: 'dark' | 'light';
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ 
  condition, 
  timeRange, 
  dateLabel, 
  startLocation,
  endLocation,
  compact = false,
  targetTime,
  distance,
  safetyScore,
  theme = 'dark'
}) => {
  const [timeLeft, setTimeLeft] = useState<{ h: string, m: string, s: string } | null>(null);
  const isDarkTheme = theme === 'dark';

  useEffect(() => {
    if (!targetTime || compact) return;
    const updateTimer = () => {
      const now = new Date();
      const diff = Math.max(0, targetTime.getTime() - now.getTime());
      const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
      setTimeLeft({ h, m, s });
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetTime, compact]);

  const wind = useMemo(() => {
    const impact = condition?.headwindImpact ?? 0;
    const speed = condition?.windSpeed ?? 0;
    if (speed < 7) {
      return { label: 'NO WIND', color: isDarkTheme ? 'text-slate-500' : 'text-slate-500', icon: <Wind className="w-4 h-4 opacity-40" /> };
    }
    if (impact > 20) {
      return { label: 'HEAD WIND', color: 'text-orange-500', icon: <ArrowDownToLine className="w-4 h-4" /> };
    }
    if (impact < -20) {
      return { label: 'TAIL WIND', color: 'text-emerald-600', icon: <MoveUp className="w-4 h-4" /> };
    }
    return { label: 'SIDE WIND', color: 'text-blue-600', icon: <ArrowLeftRight className="w-4 h-4" /> };
  }, [condition?.headwindImpact, condition?.windSpeed, isDarkTheme]);

  const surface = useMemo(() => {
    // Grounding: If the AI says wetSurfaceChance > 50, it is wet. 
    // Increased from 30 to 50 to avoid over-warning on minor dampness/spots.
    const isWet = (condition?.wetSurfaceChance ?? 0) > 50;
    return isWet 
      ? { label: 'WET', color: 'text-blue-600', icon: <Waves className="w-4 h-4" /> }
      : { label: 'DRY', color: 'text-emerald-600', icon: <ShieldCheck className="w-4 h-4" /> };
  }, [condition?.wetSurfaceChance]);

  const pulseColor = useMemo(() => {
    if (safetyScore === undefined || safetyScore === null) return isDarkTheme ? 'text-slate-500' : 'text-slate-500';
    if (safetyScore > 70) return 'text-emerald-600';
    if (safetyScore >= 30) return 'text-orange-600';
    return 'text-red-600';
  }, [safetyScore, isDarkTheme]);

  if (compact) {
    const isIce = !!condition?.iceRisk;
    const isWet = (condition?.wetSurfaceChance ?? 0) > 50;

    return (
      <div className={`w-full rounded-3xl p-5 border flex flex-col gap-4 transition-all backdrop-blur-sm shadow-xl ${isDarkTheme ? 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60' : 'bg-white border-slate-200 hover:bg-slate-50 shadow-md'}`}>
        <div className={`flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] ${isDarkTheme ? 'text-slate-500' : 'text-slate-600'}`}>
          <div className="flex items-center gap-2">
            <Calendar className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-blue-500/60' : 'text-blue-600'}`} /> 
            <span>{dateLabel}</span>
          </div>
          <span className={`font-black opacity-30 select-none ${isDarkTheme ? 'text-slate-800' : 'text-slate-300'}`}>•</span>
          <div className="flex items-center gap-2">
            <Clock className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`} /> 
            <span>{timeRange}</span>
          </div>
        </div>

        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] pb-3 border-b ${isDarkTheme ? 'text-slate-300 border-white/5' : 'text-slate-700 border-slate-200'}`}>
           <MapPin className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-blue-500/60' : 'text-blue-600'}`} />
           <span className="truncate max-w-[140px]">{startLocation || '---'}</span>
           <ArrowRight className={`w-3 h-3 flex-none mx-0.5 ${isDarkTheme ? 'text-slate-700' : 'text-slate-400'}`} />
           <span className="truncate max-w-[140px]">{endLocation || '---'}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <div className={`text-2xl font-black leading-none ${isDarkTheme ? 'text-white' : 'text-slate-950'}`}>
                 {(condition && typeof condition.temp === 'number') ? Math.round(condition.temp) : '--'}°
               </div>
               <div className="opacity-80 scale-100">
                  {condition?.isDark ? (
                    <Lightbulb className="text-yellow-400 w-6 h-6 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
                  ) : (
                    <LightbulbOff className={`w-6 h-6 ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`} />
                  )}
               </div>
            </div>
            
            <div className={`h-8 w-px ${isDarkTheme ? 'bg-slate-800/40' : 'bg-slate-200'}`} />
            
            <div className="flex items-center gap-5">
               <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isWet ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-emerald-600'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isWet ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {isWet ? 'WET' : 'DRY'}
                  </span>
               </div>
               <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isIce ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]' : (isDarkTheme ? 'bg-slate-700' : 'bg-slate-300')}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isIce ? 'text-red-600' : (isDarkTheme ? 'text-slate-600' : 'text-slate-500')}`}>
                    {isIce ? 'ICE' : 'NO ICE'}
                  </span>
               </div>
            </div>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${wind.color} ${isDarkTheme ? 'bg-slate-950/40 border-white/5' : 'bg-slate-100 border-slate-200 shadow-sm'}`}>
            <span className="text-[10px] font-black tracking-[0.1em]">{wind.label.split(' ')[0]}</span>
            {wind.icon}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full rounded-[2rem] border shadow-2xl overflow-hidden flex flex-col min-h-0 backdrop-blur-md relative transition-all duration-500 ${isDarkTheme ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-300 shadow-xl'}`}>
      <div className="p-5 pb-1 flex flex-col gap-2">
        <div className={`flex flex-wrap items-center gap-y-2 gap-x-4 font-bold text-[10px] tracking-[0.2em] uppercase ${isDarkTheme ? 'text-slate-500' : 'text-slate-700'}`}>
          <div className="flex items-center gap-2">
            <Calendar className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-blue-500/60' : 'text-blue-600'}`} /> 
            <span>{dateLabel}</span>
          </div>
          <span className={`font-black opacity-30 select-none ${isDarkTheme ? 'text-slate-800' : 'text-slate-300'}`}>•</span>
          <div className="flex items-center gap-2">
            <Clock className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`} /> 
            <span>{timeRange}</span>
          </div>
          
          {timeLeft && (
            <div className={`ml-auto border rounded-xl px-3 py-1.5 flex items-center gap-2.5 ${isDarkTheme ? 'bg-slate-950/40 border-slate-800/40' : 'bg-slate-50 border-slate-200'}`}>
               {[timeLeft.h, timeLeft.m, timeLeft.s].map((unit, i) => (
                 <React.Fragment key={i}>
                   <div className="flex flex-col items-center">
                      <span className={`text-sm font-bold font-mono leading-none ${isDarkTheme ? 'text-white' : 'text-slate-950'}`}>{unit}</span>
                      <span className={`text-[5px] font-bold tracking-widest mt-0.5 ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`}>{['HRS','MIN','SEC'][i]}</span>
                   </div>
                   {i < 2 && <span className={`font-bold text-[10px] mb-2 ${isDarkTheme ? 'text-slate-800' : 'text-slate-300'}`}>:</span>}
                 </React.Fragment>
               ))}
            </div>
          )}
        </div>

        <div className={`flex items-center gap-2 font-bold text-[10px] tracking-[0.2em] uppercase ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
          <MapPin className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-blue-500/60' : 'text-blue-600'}`} /> 
          <span className="truncate max-w-[140px]">{startLocation || '---'}</span>
          <ArrowRight className={`w-2.5 h-2.5 mx-0.5 ${isDarkTheme ? 'opacity-40' : 'opacity-30'}`} /> 
          <span className="truncate max-w-[140px]">{endLocation || '---'}</span>
        </div>

        {distance !== undefined && distance > 0 && (
          <div className={`flex items-center gap-2 font-bold text-[9px] tracking-[0.15em] uppercase px-1 -mt-1 opacity-90 ${isDarkTheme ? 'text-slate-500' : 'text-slate-600'}`}>
            <Navigation className="w-2.5 h-2.5 text-blue-500" />
            <span>{distance.toFixed(1)} KM</span>
          </div>
        )}
      </div>
      
      <div className="px-10 py-5 flex items-center justify-between">
        <div className="flex items-baseline">
          <span className={`text-5xl font-black tracking-tighter leading-none ${isDarkTheme ? 'text-white' : 'text-slate-950'}`}>
            {(condition && typeof condition.temp === 'number') ? Math.round(condition.temp) : '--'}
          </span>
          <span className={`text-xl font-bold ml-1.5 uppercase ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`}>°C</span>
        </div>
        
        <div className={`flex items-center gap-3 rounded-2xl border pr-4 transition-all duration-300 ${isDarkTheme ? 'bg-slate-900/40 border-white/5 shadow-inner' : 'bg-slate-100 border-slate-200 shadow-sm'}`}>
          <div className="p-3">
             {condition?.isDark ? (
               <Lightbulb className="text-yellow-400 w-7 h-7 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" />
             ) : (
               <LightbulbOff className={`w-7 h-7 opacity-30 ${isDarkTheme ? 'text-slate-800' : 'text-slate-400'}`} />
             )}
          </div>
          <div className="flex flex-col">
            <span className={`text-[7px] font-black uppercase tracking-widest mb-0.5 leading-none ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`}>Safety Gear</span>
            <span className={`text-[10px] font-black uppercase tracking-tight leading-none ${condition?.isDark ? 'text-yellow-500' : (isDarkTheme ? 'text-slate-500' : 'text-slate-600')}`}>
              {condition?.isDark ? 'LIGHTS REQUIRED' : 'LIGHTS NOT REQUIRED'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 grid grid-cols-2 gap-2.5">
        <div className={`p-3.5 rounded-2xl border flex flex-col justify-center ${isDarkTheme ? 'bg-slate-900/20 border-white/5' : 'bg-slate-100/50 border-slate-200 shadow-sm'}`}>
           <span className={`text-[8px] font-bold uppercase tracking-[0.2em] mb-1 ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`}>Wind</span>
           <div className="flex items-center justify-between">
              <span className={`text-sm font-black ${wind.color}`}>{wind.label}</span>
              <div className="opacity-70">{wind.icon}</div>
           </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex flex-col justify-center ${isDarkTheme ? 'bg-slate-900/20 border-white/5' : 'bg-slate-100/50 border-slate-200 shadow-sm'}`}>
           <span className={`text-[8px] font-bold uppercase tracking-[0.2em] mb-1 ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`}>Surface</span>
           <div className="flex items-center justify-between">
              <span className={`text-sm font-black ${surface.color}`}>{surface.label}</span>
              <div className="opacity-70">{surface.icon}</div>
           </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex flex-col justify-center transition-colors duration-300 ${condition?.iceRisk ? 'bg-red-500/5 border-red-500/20' : (isDarkTheme ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50/50 border-emerald-200')}`}>
           <span className={`text-[8px] font-bold uppercase tracking-[0.2em] mb-1 ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`}>Ice Risk</span>
           <div className="flex items-center justify-between">
              <span className={`text-sm font-black ${condition?.iceRisk ? 'text-red-600 animate-pulse' : 'text-emerald-600'}`}>
                {condition?.iceRisk ? 'CRITICAL' : 'SAFE'}
              </span>
              {condition?.iceRisk ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-pulse" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600/40" />
              )}
           </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex flex-col justify-center ${isDarkTheme ? 'bg-slate-900/20 border-white/5' : 'bg-slate-100/50 border-slate-200 shadow-sm'}`}>
           <span className={`text-[8px] font-bold uppercase tracking-[0.2em] mb-1 ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`}>Commute Pulse</span>
           <div className="flex items-center justify-between">
              <span className={`text-sm font-black transition-colors duration-500 ${pulseColor}`}>{safetyScore !== undefined ? `${safetyScore}%` : '--%'}</span>
              <ShieldCheck className={`w-3.5 h-3.5 opacity-60 transition-colors duration-500 ${pulseColor}`} />
           </div>
        </div>
      </div>

      {condition?.surfaceReason && (
        <div className={`mx-6 mb-5 flex flex-col gap-2.5 p-4 rounded-2xl border shadow-inner group transition-colors ${isDarkTheme ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50 border-blue-200 shadow-sm'}`}>
          <div className="flex items-center gap-2">
            <Zap className={`w-3 h-3 ${isDarkTheme ? 'text-blue-500/80' : 'text-blue-600'}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-blue-500/80' : 'text-blue-700'}`}>Commute Intelligence</span>
          </div>
          <p className={`text-[11px] font-medium leading-relaxed whitespace-normal break-words overflow-visible transition-colors ${isDarkTheme ? 'text-slate-400' : 'text-slate-700'}`}>
            {condition?.surfaceReason}
          </p>
        </div>
      )}
    </div>
  );
};
