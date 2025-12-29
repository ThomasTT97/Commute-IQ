

import React, { useState, useEffect, useMemo } from 'react';
import { WeatherCondition } from '../types';
import { 
  Wind, 
  AlertTriangle, 
  ArrowDownToLine, 
  MoveUp, 
  ShieldCheck, 
  Zap, 
  Clock,
  Calendar,
  ArrowLeftRight,
  MapPin,
  ArrowRight,
  Navigation,
  Lightbulb,
  LightbulbOff,
  Bike,
  Car,
  Brain
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
  isDummy?: boolean;
}

const getWindDir = (deg: number) => {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
};

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
  theme = 'dark',
  isDummy = false
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
      return { label: 'CALM', color: isDarkTheme ? 'text-slate-500' : 'text-slate-500', icon: <Wind className="w-5 h-5 opacity-40" /> };
    }
    if (impact > 20) {
      return { label: 'HEADWIND', color: 'text-orange-500', icon: <ArrowDownToLine className="w-5 h-5" /> };
    }
    if (impact < -20) {
      return { label: 'TAILWIND', color: 'text-emerald-500', icon: <MoveUp className="w-5 h-5" /> };
    }
    return { label: 'SIDEWIND', color: 'text-blue-500', icon: <ArrowLeftRight className="w-5 h-5" /> };
  }, [condition?.headwindImpact, condition?.windSpeed, isDarkTheme]);

  const surface = useMemo(() => {
    const isWet = (condition?.wetSurfaceChance ?? 0) > 50;
    return isWet 
      ? { label: 'WET', color: 'text-blue-500', icon: <AlertTriangle className="w-5 h-5" /> }
      : { label: 'DRY', color: 'text-emerald-500', icon: <ShieldCheck className="w-5 h-5" /> };
  }, [condition?.wetSurfaceChance]);

  const iceInfo = useMemo(() => {
    const isIcy = !!condition?.iceRisk;
    return isIcy
      ? { label: 'CRITICAL', color: 'text-red-500', icon: <AlertTriangle className="w-5 h-5 animate-pulse" /> }
      : { label: 'SAFE', color: 'text-emerald-500', icon: <ShieldCheck className="w-5 h-5" /> };
  }, [condition?.iceRisk]);

  const scoreInfo = useMemo(() => {
    if (safetyScore === undefined || safetyScore === null) return { color: isDarkTheme ? 'text-slate-500' : 'text-slate-500', icon: <Brain className="w-5 h-5" /> };
    const roundedScore = Math.round(safetyScore);
    if (roundedScore > 70) return { color: 'text-emerald-500', icon: <Bike className="w-5 h-5" /> };
    if (roundedScore < 30) return { color: 'text-red-500', icon: <Car className="w-5 h-5" /> };
    return { color: 'text-orange-500', icon: <Brain className="w-5 h-5" /> };
  }, [safetyScore, isDarkTheme]);

  if (compact) {
    const isIce = !!condition?.iceRisk;
    const isWet = (condition?.wetSurfaceChance ?? 0) > 50;

    return (
      <div className={`w-full rounded-[1.5rem] p-4 border flex flex-col gap-2.5 transition-all backdrop-blur-sm shadow-lg relative ${isDarkTheme ? 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60' : 'bg-white border-slate-200 hover:bg-slate-50 shadow-md'}`}>
        <div className={`flex items-center gap-4 text-[9px] font-bold uppercase tracking-[0.2em] ${isDarkTheme ? 'text-slate-500' : 'text-slate-600'}`}>
          <div className="flex items-center gap-2">
            <Calendar className={`w-3 h-3 ${isDarkTheme ? 'text-blue-500/60' : 'text-blue-600'}`} /> 
            <span>{dateLabel}</span>
          </div>
          <span className={`font-black opacity-30 select-none ${isDarkTheme ? 'text-slate-800' : 'text-slate-300'}`}>•</span>
          <div className="flex items-center gap-2">
            <Clock className={`w-3 h-3 ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`} /> 
            <span>{timeRange}</span>
          </div>
        </div>

        <div className={`flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] pb-2 border-b ${isDarkTheme ? 'text-slate-300 border-white/5' : 'text-slate-700 border-slate-200'}`}>
           <MapPin className={`w-3 h-3 ${isDarkTheme ? 'text-blue-500/60' : 'text-blue-600'}`} />
           <span className="truncate max-w-[120px]">{startLocation || '---'}</span>
           <ArrowRight className={`w-3 h-3 flex-none mx-0.5 ${isDarkTheme ? 'text-slate-700' : 'text-slate-400'}`} />
           <span className="truncate max-w-[120px]">{endLocation || '---'}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
               <div className={`text-xl font-black leading-none ${isDarkTheme ? 'text-white' : 'text-slate-950'}`}>
                 {(condition && typeof condition.temp === 'number') ? Math.round(condition.temp) : '--'}°
               </div>
               <div className="opacity-80 scale-90">
                  {condition?.isDark ? (
                    <Lightbulb className="text-yellow-400 w-5 h-5 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
                  ) : (
                    <LightbulbOff className={`w-5 h-5 ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`} />
                  )}
               </div>
            </div>
            
            <div className={`h-6 w-px ${isDarkTheme ? 'bg-slate-800/40' : 'bg-slate-200'}`} />
            
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-1.5">
                  <div className={`w-1 h-1 rounded-full ${isWet ? 'bg-blue-500' : 'bg-emerald-600'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isWet ? 'text-blue-500' : 'text-emerald-500'}`}>
                    {isWet ? 'WET' : 'DRY'}
                  </span>
               </div>
               <div className="flex items-center gap-1.5">
                  <div className={`w-1 h-1 rounded-full ${isIce ? 'bg-red-500 animate-pulse' : (isDarkTheme ? 'bg-slate-700' : 'bg-slate-300')}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isIce ? 'text-red-500' : (isDarkTheme ? 'text-slate-600' : 'text-slate-500')}`}>
                    {isIce ? 'ICE' : 'NO ICE'}
                  </span>
               </div>
            </div>
          </div>

          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border ${wind.color} ${isDarkTheme ? 'bg-slate-950/40 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className="text-[9px] font-black tracking-[0.1em]">{wind.label.split(' ')[0]}</span>
            {wind.icon}
          </div>
        </div>
      </div>
    );
  }

  const hasIntelligence = !!condition?.surfaceReason;
  const windDetail = (condition?.windSpeed !== undefined && condition?.windDirection !== undefined) 
    ? ` • ${Math.round(condition.windSpeed)}KM/H ${getWindDir(condition.windDirection)}` 
    : '';

  return (
    <div className={`h-full w-full rounded-[2rem] border shadow-2xl overflow-hidden flex flex-col backdrop-blur-md relative transition-all duration-500 ${isDarkTheme ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-300 shadow-xl'}`}>
      <div className="flex-none p-5 pb-0 flex flex-col gap-2">
        <div className={`flex flex-wrap items-center justify-between font-bold text-[10px] tracking-[0.2em] uppercase ${isDarkTheme ? 'text-slate-500' : 'text-slate-700'}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <Calendar className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-blue-500/60' : 'text-blue-600'}`} /> 
              <span>{dateLabel}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`} /> 
              <span>{timeRange}</span>
            </div>
          </div>
          
          {timeLeft && (
            <div className={`flex items-center gap-2 ${isDarkTheme ? 'text-blue-400' : 'text-blue-600'}`}>
               <span className="font-mono text-sm font-bold">{timeLeft.h}:{timeLeft.m}:{timeLeft.s}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2.5 font-bold text-[10px] tracking-[0.2em] uppercase ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
            <MapPin className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-blue-500/60' : 'text-blue-600'}`} /> 
            <span className="truncate max-w-[130px]">{startLocation}</span>
            <ArrowRight className="w-3 h-3 opacity-30" /> 
            <span className="truncate max-w-[130px]">{endLocation}</span>
          </div>
          {distance !== undefined && distance > 0 && (
            <div className={`flex items-center gap-2 font-bold text-[9px] tracking-[0.15em] uppercase opacity-90 ${isDarkTheme ? 'text-slate-500' : 'text-slate-600'}`}>
              <Navigation className="w-3 h-3 text-blue-500" />
              <span>{distance.toFixed(1)} KM</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-none px-10 py-3 flex items-center justify-between">
          <div className="flex items-baseline">
            <span className={`text-6xl font-black tracking-tighter leading-none ${isDarkTheme ? 'text-white' : 'text-slate-950'}`}>
              {(condition && typeof condition.temp === 'number') ? Math.round(condition.temp) : '--'}
            </span>
            <span className={`text-xl font-bold ml-1.5 uppercase ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`}>°C</span>
          </div>
          
          <div className={`flex items-center gap-3.5 rounded-2xl border pr-4 py-1 transition-all duration-300 ${isDarkTheme ? 'bg-slate-900/40 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            <div className="p-3">
               {condition?.isDark ? (
                 <Lightbulb className="text-yellow-400 w-7 h-7 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
               ) : (
                 <LightbulbOff className={`w-7 h-7 opacity-30 ${isDarkTheme ? 'text-slate-800' : 'text-slate-400'}`} />
               )}
            </div>
            <div className="flex flex-col">
              <span className={`text-[7px] font-black uppercase tracking-widest leading-none ${isDarkTheme ? 'text-slate-600' : 'text-slate-500'}`}>Lights</span>
              <span className={`text-[9px] font-black uppercase tracking-tight leading-none mt-1 ${condition?.isDark ? 'text-yellow-500' : (isDarkTheme ? 'text-slate-500' : 'text-slate-600')}`}>
                {condition?.isDark ? 'REQUIRED' : 'NOT REQ.'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-none grid grid-cols-2 gap-3 px-6 py-2">
          {[
            { label: `WIND${windDetail}`, value: wind.label, color: wind.color, icon: wind.icon },
            { label: 'SURFACE', value: surface.label, color: surface.color, icon: surface.icon },
            { label: 'ICE RISK', value: iceInfo.label, color: iceInfo.color, icon: iceInfo.icon },
            { label: 'COMMUTE SCORE', value: safetyScore !== undefined ? `${Math.round(safetyScore)}%` : '--%', color: scoreInfo.color, icon: scoreInfo.icon }
          ].map((stat, i) => (
            <div key={i} className={`p-4 rounded-[1.75rem] border flex flex-col justify-between h-24 transition-all ${isDarkTheme ? 'bg-slate-950/80 border-white/10 hover:bg-slate-900 shadow-inner' : 'bg-slate-100/70 border-slate-200 shadow-sm'}`}>
              <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>{stat.label}</span>
              <div className="flex items-end justify-between mt-auto mb-1">
                <span className={`text-xl font-black tracking-tight leading-none ${stat.color}`}>{stat.value}</span>
                <div className={`scale-125 mb-0.5 ${stat.color}`}>
                  {React.cloneElement(stat.icon as React.ReactElement<any>, { className: `w-5 h-5 ${stat.color}` })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 px-6 pb-6 mt-1 flex flex-col min-h-0 overflow-hidden">
          {hasIntelligence && (
            <div className={`flex flex-col gap-2.5 p-4 rounded-[1.75rem] border h-full overflow-hidden transition-colors ${isDarkTheme ? 'bg-blue-500/10 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.05)]' : 'bg-blue-50 border-blue-200 shadow-sm'}`}>
              <div className="flex items-center gap-2 flex-none">
                <Zap className={`w-3 h-3 ${isDarkTheme ? 'text-blue-500/80' : 'text-blue-600'}`} />
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDarkTheme ? 'text-blue-500/80' : 'text-blue-700'}`}>Commute Intelligence</span>
              </div>
              
              <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
                <p className={`text-[10px] sm:text-[11px] font-medium leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-line ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>
                  {condition?.surfaceReason}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};