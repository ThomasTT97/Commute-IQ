
import React, { useMemo, useState } from 'react';
import { LocationSuggestion } from '../types';
import { BelgianLocation } from '../locations';
import { 
  Wind, 
  AlertTriangle, 
  ArrowDownToLine, 
  MoveUp, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  ArrowLeftRight, 
  MapPin, 
  ArrowRight, 
  Navigation, 
  Lightbulb, 
  Bike, 
  CircleHelp, 
  X,
  Thermometer,
  CloudRain,
  Moon,
  Sparkles,
  Map as MapIcon,
  Droplets
} from 'lucide-react';

interface WeatherCardProps {
  condition?: any | null; 
  timeRange?: string;
  dateLabel?: string;
  startLocation?: string;
  endLocation?: string;
  compact?: boolean;
  distance?: number;
  safetyScore?: number;
  theme?: 'dark' | 'light';
  showRawWind?: boolean;
  optimizationAdvice?: LocationSuggestion[] | undefined; 
  locationAdvice?: LocationSuggestion[] | undefined;     
  onSelectLocationAdvice?: (loc: BelgianLocation) => void;
}

const getCardinal = (angle: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(angle / 45) % 8];
};

export const WeatherCard: React.FC<WeatherCardProps> = ({ 
  condition, 
  timeRange, 
  dateLabel, 
  startLocation, 
  endLocation, 
  compact = false, 
  distance, 
  safetyScore, 
  theme = 'dark',
  showRawWind = false,
  optimizationAdvice, 
  locationAdvice,     
  onSelectLocationAdvice
}) => {
  const isDark = theme === 'dark';
  const [showWindDetails, setShowWindDetails] = useState(false);
  const [showIceDetails, setShowIceDetails] = useState(false);
  const [showSurfaceDetails, setShowSurfaceDetails] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [showTempDetails, setShowTempDetails] = useState(false);
  const [showRoutePopup, setShowRoutePopup] = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);

  const wind = useMemo(() => {
    const impact = condition?.headwindImpact ?? 0;
    const speed = condition?.windSpeed ?? 0;
    if (speed < 7) return { label: 'CALM', color: 'text-slate-500', icon: <Wind className="w-3.5 h-3.5" /> };
    if (impact > 20) return { label: 'HEADWIND', color: 'text-orange-500', icon: <ArrowDownToLine className="w-3.5 h-3.5" /> };
    if (impact < -20) return { label: 'TAILWIND', color: 'text-emerald-500', icon: <MoveUp className="w-3.5 h-3.5" /> };
    return { label: 'SIDEWIND', color: 'text-blue-500', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> };
  }, [condition?.headwindImpact, condition?.windSpeed]);

  const surface = useMemo(() => {
    const isWet = (condition?.wetSurfaceChance ?? 0) > 50;
    return isWet 
      ? { label: 'WET', color: 'text-blue-500', icon: <AlertTriangle className="w-3.5 h-3.5" /> }
      : { label: 'DRY', color: 'text-emerald-500', icon: <ShieldCheck className="w-3.5 h-3.5" /> };
  }, [condition?.wetSurfaceChance]);

  const iceInfo = useMemo(() => {
    const isIcy = !!condition?.iceRisk;
    return isIcy
      ? { label: 'ICE', color: 'text-red-500', icon: <AlertTriangle className="w-3.5 h-3.5" /> }
      : { label: 'NO ICE', color: 'text-emerald-500', icon: <ShieldCheck className="w-3.5 h-3.5" /> };
  }, [condition?.iceRisk]);

  const iceVitals = useMemo(() => {
    if (!condition) return [];
    return [
      { label: "Air Temp", value: `${Math.round(condition.temp)}°C`, icon: <Thermometer className="w-3 h-3 text-blue-400" /> },
      { label: "Min Past (6h)", value: `${Math.round(condition.minPastTemp ?? condition.temp)}°C`, icon: <Clock className="w-3 h-3 text-slate-400" /> },
      { label: "Humidity", value: `${condition.humidity}%`, icon: <Droplets className="w-3 h-3 text-blue-300" /> },
      { label: "Status", value: condition.iceRisk ? "High Risk" : "Safe", icon: <AlertTriangle className={`w-3 h-3 ${condition.iceRisk ? 'text-red-500' : 'text-emerald-500'}`} /> }
    ];
  }, [condition]);

  const surfaceVitals = useMemo(() => {
    if (!condition) return [];
    const rainDuring = condition.precipDuringSession ?? condition.precipitation ?? 0;
    return [
      { label: "Rain During", value: rainDuring > 0 ? `${rainDuring} mm` : "None", icon: <CloudRain className="w-3 h-3 text-blue-500" /> },
      { label: "History", value: condition.lastPrecipitationTime || "None", icon: <Clock className="w-3 h-3 text-slate-400" /> },
      { label: "Humidity", value: `${condition.humidity}%`, icon: <Droplets className="w-3 h-3 text-blue-300" /> },
      { label: "Traction", value: (condition.wetSurfaceChance > 50) ? "Wet" : "Dry", icon: <ShieldCheck className={`w-3 h-3 ${condition.wetSurfaceChance > 50 ? 'text-blue-500' : 'text-emerald-500'}`} /> }
    ];
  }, [condition]);

  const getBreakdownIcon = (label: string) => {
    switch (label) {
      case "Critical Ice Risk": return <AlertTriangle className="w-3 h-3 text-red-500" />;
      case "Active Precipitation": return <CloudRain className="w-3 h-3 text-blue-500" />;
      case "Wet Roads": return <AlertTriangle className="w-3 h-3 text-blue-400" />;
      case "Wind Intensity": return <Wind className="w-3 h-3 text-slate-400" />;
      case "Headwind Drag": return <ArrowDownToLine className="w-3 h-3 text-orange-500" />;
      case "Tailwind Boost": return <MoveUp className="w-3 h-3 text-emerald-500" />;
      case "Weather Surplus": return <Sparkles className="w-3 h-3 text-emerald-500" />;
      case "Cold Exposure": return <Thermometer className="w-3 h-3 text-blue-300" />;
      case "Heat Stress": return <Thermometer className="w-3 h-3 text-red-400" />;
      case "Darkness / Visibility": return <Moon className="w-3 h-3 text-indigo-400" />;
      default: return <CircleHelp className="w-3 h-3 text-slate-400" />;
    }
  };

  const closeAllPopups = () => {
    setShowWindDetails(false);
    setShowIceDetails(false);
    setShowSurfaceDetails(false);
    setShowScoreDetails(false);
    setShowTempDetails(false);
    setShowRoutePopup(false);
    setShowLocationPopup(false);
  };

  const toggleWind = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showWindDetails) setShowWindDetails(false); else { closeAllPopups(); setShowWindDetails(true); } };
  const toggleIce = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showIceDetails) setShowIceDetails(false); else { closeAllPopups(); setShowIceDetails(true); } };
  const toggleSurface = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showSurfaceDetails) setShowSurfaceDetails(false); else { closeAllPopups(); setShowSurfaceDetails(true); } };
  const toggleScore = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showScoreDetails) setShowScoreDetails(false); else { closeAllPopups(); setShowScoreDetails(true); } };
  const toggleTemp = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showTempDetails) setShowTempDetails(false); else { closeAllPopups(); setShowTempDetails(true); } };
  const toggleRoute = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showRoutePopup) setShowRoutePopup(false); else { closeAllPopups(); setShowRoutePopup(true); } };
  const toggleLocation = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showLocationPopup) setShowLocationPopup(false); else { closeAllPopups(); setShowLocationPopup(true); } };

  const popupBgClass = isDark 
    ? 'bg-[#1a1d24] border-white/20 shadow-2xl opacity-100' 
    : 'bg-white border-slate-300 shadow-2xl opacity-100';

  const scoreColor = useMemo(() => {
    const s = Math.round(safetyScore ?? 0);
    if (s > 70) return 'text-emerald-500';
    if (s >= 30) return 'text-orange-500';
    return 'text-red-500';
  }, [safetyScore]);

  if (compact) {
    return (
      <div className={`w-full rounded-[1.5rem] p-4 sm:p-5 border transition-all flex flex-col justify-between ${isDark ? 'border-white/5 bg-[#0a0c10]' : 'border-slate-200 bg-white shadow-sm'}`}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[9px] font-black tracking-[0.15em] text-slate-500 uppercase">
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3 text-blue-500/50" />
              <span>{dateLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-slate-600" />
              <span>{timeRange}</span>
            </div>
          </div>
          <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight truncate border-t pt-2 ${isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
            <MapPin className="w-3 h-3 flex-none text-blue-500/50" />
            <span className="truncate">{startLocation}</span>
            <ArrowRight className="w-2.5 h-2.5 opacity-30 flex-none" />
            <span className="truncate">{endLocation}</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <span className={`text-2xl sm:text-3xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition?.temp ?? 0)}°</span>
          </div>
          <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <Lightbulb className={`w-4.5 h-4.5 transition-all ${condition?.isDark ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.7)]' : 'text-slate-700 opacity-40'}`} />
                <div className="flex gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-black items-center">
                  <span className={surface.color}>{surface.label}</span>
                  <span className="text-slate-700 opacity-20">|</span>
                  <span className={iceInfo.label === 'NO ICE' ? 'text-emerald-500' : 'text-red-500'}>{iceInfo.label}</span>
                </div>
              </div>
            </div>
          <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-black text-[10px] sm:text-[11px] border tracking-wider transition-colors ${isDark ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-200'} ${showRawWind ? (isDark ? 'text-blue-400' : 'text-blue-600') : wind.color}`}>
            {showRawWind ? `${Math.round(condition?.windSpeed ?? 0)} ${getCardinal(condition?.windDirection ?? 0)}` : wind.label} <Wind className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full rounded-[2rem] border overflow-visible flex flex-col p-4 sm:p-6 sm:pb-8 shadow-2xl transition-all ${isDark ? 'border-white/5 bg-[#0a0c10]' : 'bg-white border-slate-200'}`}>
      <div className="flex-none flex items-center justify-between text-[10px] font-black tracking-widest text-slate-500 uppercase mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-blue-500/50" />
          <span>{dateLabel}</span>
          <Clock className="w-3.5 h-3.5 text-slate-600 ml-1.5" />
          <span>{timeRange}</span>
        </div>
      </div>

      <div className="flex-none flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-[70%]">
          <MapPin className="w-3.5 h-3.5 text-blue-500/50 flex-none" />
          <span className="truncate">{startLocation}</span>
          <ArrowRight className="w-3 h-3 opacity-30 flex-none" />
          <span className="truncate">{endLocation}</span>
        </div>
        {distance && (
          <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 flex-none">
            <Navigation className="w-3 h-3 text-blue-500" />
            <span>{distance.toFixed(1)} KM</span>
          </div>
        )}
      </div>

      {((optimizationAdvice && optimizationAdvice.length > 0) || (locationAdvice && locationAdvice.length > 0)) && (
        <div className="flex-none mb-3 flex gap-2 relative z-[100]">
          {optimizationAdvice && optimizationAdvice.length > 0 && (
            <button onClick={toggleRoute} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${showRoutePopup ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'}`}><Sparkles className="w-3 h-3" />route advice</button>
          )}
          {locationAdvice && locationAdvice.length > 0 && (
            <button onClick={toggleLocation} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${showLocationPopup ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-500/20'}`}><MapIcon className="w-3 h-3" />location advice</button>
          )}
          {showRoutePopup && (
            <div className={`absolute top-full left-0 right-0 mt-2 p-4 rounded-2xl border z-[150] ${popupBgClass}`}>
              <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-black uppercase text-blue-500">Suggested Points</span><button onClick={() => setShowRoutePopup(false)} className="p-1"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="flex flex-col gap-2">{optimizationAdvice.map((loc, idx) => (<div key={idx} className={`p-2 rounded-xl border flex items-center justify-between ${isDark ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}><span className="text-[11px] font-black uppercase text-white">{loc.name}</span></div>))}</div>
            </div>
          )}
          {showLocationPopup && (
            <div className={`absolute top-full left-0 right-0 mt-2 p-4 rounded-2xl border z-[150] ${popupBgClass}`}>
              <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-black uppercase text-orange-500">Alternatives</span><button onClick={() => setShowLocationPopup(false)} className="p-1"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="flex flex-col gap-2">{locationAdvice.map((loc, idx) => (<button key={idx} onClick={() => onSelectLocationAdvice?.(loc)} className={`p-2 rounded-xl border flex items-center justify-between ${isDark ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}><span className="text-[11px] font-black uppercase text-white">{loc.name}</span></button>))}</div>
            </div>
          )}
        </div>
      )}

      <div className="flex-none flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex flex-col relative">
          <button onClick={toggleTemp} className="flex items-baseline gap-1 group transition-opacity active:opacity-70 text-left">
            <span className={`text-5xl sm:text-6xl font-black leading-none tracking-tighter transition-colors ${isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'}`}>{Math.round(condition?.temp ?? 0)}°</span>
            <span className="text-xl font-bold text-slate-500 tracking-tighter ml-1">C</span>
            <CircleHelp className={`w-4 h-4 ml-1.5 transition-colors ${showTempDetails ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'}`} />
          </button>
          
          {showTempDetails && (
            <div className={`absolute top-full mt-2 left-0 p-4 rounded-2xl border z-[160] min-w-[150px] animate-in fade-in slide-in-from-top-2 duration-200 ${popupBgClass}`}>
              <div className="flex items-center justify-between mb-3"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Temp Range</span><button onClick={() => setShowTempDetails(false)} className="p-1 -mr-1"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-[11px] font-black"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>MIN TEMP</span><span className={isDark ? 'text-white' : 'text-slate-900'}>{Math.round(condition?.minTemp ?? condition?.temp)}°C</span></div>
                <div className="flex items-center justify-between text-[11px] font-black"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>MAX TEMP</span><span className={isDark ? 'text-white' : 'text-slate-900'}>{Math.round(condition?.maxTemp ?? condition?.temp)}°C</span></div>
              </div>
            </div>
          )}
        </div>
        <div className={`rounded-[1.25rem] p-3 flex items-center gap-3.5 min-w-[120px] ${isDark ? 'bg-slate-900/50 border border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <Lightbulb className={`w-6 h-6 ${condition?.isDark ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'text-slate-300'}`} />
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Lights</span>
            <span className={`text-[10px] font-black uppercase ${condition?.isDark ? 'text-yellow-500' : 'text-slate-500'}`}>{condition?.isDark ? 'Required' : 'Optional'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-grow min-h-0">
        <div className={`rounded-[1.25rem] px-4 py-3 flex flex-col justify-center border relative transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">WIND</span>
            <button onClick={toggleWind} className={`p-1 rounded-lg transition-colors -mr-1 z-30 ${showWindDetails ? 'bg-blue-500/20 text-blue-500' : 'text-slate-600 hover:text-blue-500'}`}><CircleHelp className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center justify-between">
            {showRawWind ? (
              <span className={`text-sm sm:text-lg font-black tracking-tight ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{Math.round(condition?.windSpeed ?? 0)} <span className="text-[10px] opacity-60">KM/H</span> {getCardinal(condition?.windDirection ?? 0)}</span>
            ) : (
              <span className={`text-base sm:text-xl font-black tracking-tight ${wind.color}`}>{wind.label}</span>
            )}
            <div className={showRawWind ? (isDark ? 'text-blue-400' : 'text-blue-600') : wind.color}>{showRawWind ? <Wind className="w-3.5 h-3.5" /> : wind.icon}</div>
          </div>
          {showWindDetails && (
            <div className={`absolute bottom-full mb-3 left-0 right-0 p-3 rounded-2xl border shadow-2xl z-[150] flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200 ${popupBgClass}`}>
              <div className="flex flex-col gap-1.5 flex-1"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Wind Details</span><p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Speed: {Math.round(condition?.windSpeed ?? 0)} km/h<br/>Direction: {getCardinal(condition?.windDirection ?? 0)}</p></div>
              <button onClick={() => setShowWindDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button>
            </div>
          )}
        </div>

        <div className={`rounded-[1.25rem] px-4 py-3 flex flex-col justify-center border relative transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">SURFACE</span>
            <button onClick={toggleSurface} className={`p-1 rounded-lg transition-colors -mr-1 z-30 ${showSurfaceDetails ? 'bg-blue-500/20 text-blue-500' : 'text-slate-600 hover:text-blue-500'}`}><CircleHelp className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-base sm:text-xl font-black tracking-tight ${surface.color}`}>{surface.label}</span>
            <div className={surface.color}>{surface.icon}</div>
          </div>
          {showSurfaceDetails && (
            <div className={`absolute ${showRawWind ? 'bottom-full mb-3' : 'top-full mt-3'} left-[-100%] right-0 p-4 rounded-2xl border shadow-2xl z-[150] flex flex-col gap-3 animate-in fade-in ${showRawWind ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200 ${popupBgClass}`}>
              <div className="flex items-center justify-between"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Precipitation History</span><button onClick={() => setShowSurfaceDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {surfaceVitals.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-bold">
                    <div className="flex items-center gap-2">{item.icon}<span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{item.label}</span></div>
                    <span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div className={`mt-1 p-2.5 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-black/60 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Traction Alert</span>
                <p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{condition.wetSurfaceChance > 70 ? "Surface is saturated. Use caution in turns." : "Dry asphalt detected. Optimal traction available."}</p>
              </div>
            </div>
          )}
        </div>

        <div className={`rounded-[1.25rem] px-4 py-3 flex flex-col justify-center border relative transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">ICE RISK</span>
            <button onClick={toggleIce} className={`p-1 rounded-lg transition-colors -mr-1 z-30 ${showIceDetails ? 'bg-red-500/20 text-red-500' : 'text-slate-600 hover:text-red-500'}`}><CircleHelp className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-base sm:text-xl font-black tracking-tight ${iceInfo.color}`}>{iceInfo.label}</span>
            <div className={iceInfo.color}>{iceInfo.icon}</div>
          </div>
          {showIceDetails && (
            <div className={`absolute bottom-full mb-3 left-0 right-[-100%] p-4 rounded-2xl border shadow-2xl z-[150] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${popupBgClass}`}>
              <div className="flex items-center justify-between"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Risk assessment</span><button onClick={() => setShowIceDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {iceVitals.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-bold">
                    <div className="flex items-center gap-2">{item.icon}<span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{item.label}</span></div>
                    <span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div className={`mt-1 p-2.5 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-black/60 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Assessment Details</span>
                <p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Comparing current air temp against the 6h thermal floor and humidity to detect hidden surface freezing.</p>
              </div>
            </div>
          )}
        </div>

        <div className={`rounded-[1.25rem] px-4 py-3 flex flex-col justify-center border relative transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">SCORE</span>
            <button onClick={toggleScore} className={`p-1 rounded-lg transition-colors -mr-1 z-30 ${showScoreDetails ? 'bg-blue-500/20 text-blue-500' : 'text-slate-600 hover:text-blue-500'}`}><CircleHelp className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-base sm:text-xl font-black tracking-tight ${scoreColor}`}>{Math.round(safetyScore ?? 0)}%</span>
            <div className={scoreColor}><Bike className="w-3.5 h-3.5" /></div>
          </div>
          {showScoreDetails && (
            <div className={`absolute bottom-full mb-3 left-[-100%] right-0 p-4 rounded-2xl border shadow-2xl z-[150] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${popupBgClass}`}>
              <div className="flex items-center justify-between"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Deduction Breakdown</span><button onClick={() => setShowScoreDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="space-y-2">
                {condition?.scoreBreakdown && condition.scoreBreakdown.length > 0 ? condition.scoreBreakdown.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-bold">
                    <div className="flex items-center gap-2">{getBreakdownIcon(item.label)}<span className={item.val < 0 ? (isDark ? 'text-slate-300' : 'text-slate-600') : 'text-emerald-500'}>{item.label}</span></div>
                    <span className={item.val < 0 ? 'text-red-400' : 'text-emerald-500'}>{item.val > 0 ? `+${Math.round(item.val)}%` : `${Math.round(item.val)}%`}</span>
                  </div>
                )) : <p className="text-[10px] font-bold text-emerald-500">Perfect conditions: No deductions applied.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
