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
  Map as MapIcon
} from 'lucide-react';

interface WeatherCardProps {
  condition?: any | null; // Changed to any to avoid type issues with `WeatherCondition` directly
  timeRange?: string;
  dateLabel?: string;
  startLocation?: string;
  endLocation?: string;
  compact?: boolean;
  distance?: number;
  safetyScore?: number;
  theme?: 'dark' | 'light';
  showRawWind?: boolean;
  optimizationAdvice?: LocationSuggestion[] | undefined; // Explicitly allow undefined
  locationAdvice?: LocationSuggestion[] | undefined;     // Explicitly allow undefined
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
  optimizationAdvice, // No default empty array
  locationAdvice,     // No default empty array
  onSelectLocationAdvice
}) => {
  const isDark = theme === 'dark';
  const [showWindDetails, setShowWindDetails] = useState(false);
  const [showIceDetails, setShowIceDetails] = useState(false);
  const [showSurfaceDetails, setShowSurfaceDetails] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
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

  const scoreBreakdown = useMemo(() => {
    if (!condition) return [];
    const items = [];
    if (condition.iceRisk) items.push({ label: "Critical Ice Risk", val: -70, icon: <AlertTriangle className="w-3 h-3 text-red-500" /> });
    if (condition.precipitation > 0) items.push({ label: "Active Precipitation", val: -(20 + Math.min(20, condition.precipitation * 4)), icon: <CloudRain className="w-3 h-3 text-blue-500" /> });
    else if (condition.wetSurfaceChance > 50) items.push({ label: "Wet Roads", val: -10, icon: <AlertTriangle className="w-3 h-3 text-blue-400" /> });
    if (condition.windSpeed > 15) items.push({ label: "Wind Intensity", val: -((condition.windSpeed - 15) * 1.5), icon: <Wind className="w-3 h-3 text-slate-400" /> });
    if (condition.headwindImpact > 20) items.push({ label: "Headwind Drag", val: -(condition.headwindImpact / 4), icon: <ArrowDownToLine className="w-3 h-3 text-orange-500" /> });
    // Exclude Tailwind Boost in training mode (where showRawWind is true for loop context)
    else if (!showRawWind && condition.headwindImpact < -20) items.push({ label: "Tailwind Boost", val: 5, icon: <MoveUp className="w-3 h-3 text-emerald-500" /> });
    if (condition.temp < 5) items.push({ label: "Cold Exposure", val: -((5 - condition.temp) * 2), icon: <Thermometer className="w-3 h-3 text-blue-300" /> });
    else if (condition.temp > 28) items.push({ label: "Heat Stress", val: -((condition.temp - 28) * 2), icon: <Thermometer className="w-3 h-3 text-red-400" /> });
    if (condition.isDark) items.push({ label: "Darkness / Visibility", val: -5, icon: <Moon className="w-3 h-3 text-indigo-400" /> });
    return items;
  }, [condition, showRawWind]);

  const iceRiskReason = useMemo(() => {
    if (!condition) return "";

    if (condition.iceRisk) { // If there IS an overall ice risk...
      if (condition.activeFreezing) {
        return "Critical: Surface moisture has frozen solid. Air and ground temperatures have been at or below 0°C, creating a treacherous layer of ice.";
      }
      if (condition.overnightFreeze) {
        return "Caution: Sub-zero temperatures were recorded recently. Due to thermal inertia, the road surface remains colder than the air, and damp patches may be frozen.";
      }
      return "Surface Alert: Near-freezing air with high humidity is causing frost or 'black ice' to settle on the asphalt.";
    } else { // If there is NO overall ice risk...
      const isFreezing = (condition.temp <= 0.5) || (condition.minTemp !== undefined && condition.minTemp <= 0.5);
      const wasFreezingRecently = condition.minPastTemp !== undefined && condition.minPastTemp <= 0;

      if (isFreezing || wasFreezingRecently) {
        return "Safe (Dry Cold): Conditions are at or below freezing, but critically low humidity and the absence of surface moisture have inhibited the formation of ice or frost. The substrate remains high-traction and dry.";
      }
      return "Safe: Temperatures have consistently remained above the freezing threshold, ensuring no latent ice accumulation.";
    }
  }, [condition]);

  const surfaceRiskReason = useMemo(() => {
    if (!condition) return "";
    const prec = condition.precipitation ?? 0;
    const wetChance = condition.wetSurfaceChance ?? 0;
    if (prec > 0) return `Active Rain: ${prec}mm of falling precipitation. Traction is significantly compromised. Expect spray and long braking distances.`;
    if (wetChance > 70) return `Residual Moisture: Asphalt is saturated from recent rain. A water film remains present on the surface.`;
    return "Optimal Surface: No recent rainfall and moderate humidity have ensured a clean, dry contact patch.";
  }, [condition]);

  const scoreColor = useMemo(() => {
    const s = Math.round(safetyScore ?? 0);
    if (s > 70) return 'text-emerald-500';
    if (s >= 30) return 'text-orange-500';
    return 'text-red-500';
  }, [safetyScore]);

  const closeAllPopups = () => {
    setShowWindDetails(false);
    setShowIceDetails(false);
    setShowSurfaceDetails(false);
    setShowScoreDetails(false);
    setShowRoutePopup(false);
    setShowLocationPopup(false);
  };

  const toggleWind = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showWindDetails) setShowWindDetails(false); else { closeAllPopups(); setShowWindDetails(true); } };
  const toggleIce = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showIceDetails) setShowIceDetails(false); else { closeAllPopups(); setShowIceDetails(true); } };
  const toggleSurface = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showSurfaceDetails) setShowSurfaceDetails(false); else { closeAllPopups(); setShowSurfaceDetails(true); } };
  const toggleScore = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showScoreDetails) setShowScoreDetails(false); else { closeAllPopups(); setShowScoreDetails(true); } };
  const toggleRoute = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showRoutePopup) setShowRoutePopup(false); else { closeAllPopups(); setShowRoutePopup(true); } };
  const toggleLocation = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (showLocationPopup) setShowLocationPopup(false); else { closeAllPopups(); setShowLocationPopup(true); } };

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
            {condition?.minTemp !== undefined && condition?.maxTemp !== undefined ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">min</span>
                  <span className={`text-xl sm:text-2xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition.minTemp)}°</span>
                </div>
                <div className="h-6 w-px bg-slate-500/20 self-end mb-1" />
                <div className="flex flex-col">
                  <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">max</span>
                  <span className={`text-xl sm:text-2xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition.maxTemp)}°</span>
                </div>
                <span className="text-lg font-bold text-slate-500 tracking-tighter self-end mb-1">C</span>
              </div>
            ) : (
              <span className={`text-2xl sm:text-3xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition?.temp ?? 0)}°</span>
            )}
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

      {((optimizationAdvice && optimizationAdvice.length > 0) || (locationAdvice && locationAdvice.length > 0)) && !compact && (
        <div className="flex-none mb-3 flex gap-2 relative z-[100]">
          {optimizationAdvice && optimizationAdvice.length > 0 && (
            <button 
              onClick={toggleRoute}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${showRoutePopup ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'}`}
            >
              <Sparkles className="w-3 h-3" />
              route advice
            </button>
          )}
          {locationAdvice && locationAdvice.length > 0 && (
            <button 
              onClick={toggleLocation}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${showLocationPopup ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20'}`}
            >
              <MapIcon className="w-3 h-3" />
              location advice
            </button>
          )}

          {showRoutePopup && (
            <div className={`absolute top-full left-0 right-0 mt-2 p-4 rounded-2xl border shadow-2xl z-[110] animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-[#1a1d24] border-white/20' : 'bg-white border-slate-300'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Suggested Route Points</span>
                <button onClick={() => setShowRoutePopup(false)} className="p-1 rounded-full hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mb-3 leading-tight uppercase tracking-tight">Optimal turnaround points based on wind direction for a balanced loop:</p>
              <div className="flex flex-col gap-2">
                {optimizationAdvice && optimizationAdvice.map((loc, idx) => (
                  <div key={idx} className={`p-2.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                       <MapPin className="w-3 h-3 text-blue-500" />
                       <span className={`text-[11px] font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{loc.name}</span>
                    </div>
                    {loc.distanceFromTrainingCenter !== undefined && (
                       <span className="text-[8px] font-black text-slate-500">~{loc.distanceFromTrainingCenter.toFixed(0)} KM FROM TRAINING CENTER</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showLocationPopup && (
            <div className={`absolute top-full left-0 right-0 mt-2 p-4 rounded-2xl border shadow-2xl z-[110] animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-[#1a1d24] border-white/20' : 'bg-white border-slate-300'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Better Starting Points</span>
                <button onClick={() => setShowLocationPopup(false)} className="p-1 rounded-full hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mb-3 leading-tight uppercase tracking-tight">Municipalities nearby with potentially better training conditions:</p>
              <div className="flex flex-col gap-2">
                {locationAdvice && locationAdvice.length > 0 ? (
                  locationAdvice.map((loc, idx) => (
                    <button 
                      key={idx} 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        if (onSelectLocationAdvice) onSelectLocationAdvice({ name: loc.name, lat: loc.lat, lng: loc.lng });
                        closeAllPopups(); 
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors hover:bg-orange-500/10 active:scale-[0.98] ${isDark ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <div className="flex items-center gap-2">
                         <MapIcon className="w-3 h-3 text-orange-500" />
                         <span className={`text-[11px] font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{loc.name}</span>
                      </div>
                      {loc.distanceFromHome !== undefined && (
                        <span className="text-[8px] font-black text-slate-500">{loc.distanceFromHome.toFixed(1)} KM FROM HOME</span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className={`text-[10px] font-bold text-center p-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    No better locations found nearby for today's session.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-none flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex flex-col">
          {condition?.minTemp !== undefined && condition?.maxTemp !== undefined ? (
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                 <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">min</span>
                 <span className={`text-4xl sm:text-5xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition.minTemp)}°</span>
              </div>
              <div className="h-10 w-px bg-slate-500/20 self-end mb-1" />
              <div className="flex flex-col">
                 <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">max</span>
                 <span className={`text-4xl sm:text-5xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition.maxTemp)}°</span>
              </div>
              <span className="text-xl font-bold text-slate-500 tracking-tighter self-end mb-1">C</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className={`text-5xl sm:text-6xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition?.temp ?? 0)}°</span>
              <span className="text-xl font-bold text-slate-500 tracking-tighter ml-1">C</span>
            </div>
          )}
        </div>
        <div className={`rounded-[1.25rem] p-3 flex items-center gap-3.5 min-w-[120px] ${isDark ? 'bg-slate-900/50 border border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <Lightbulb className={`w-6 h-6 ${condition?.isDark ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'text-slate-300'}`} />
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Lights</span>
            <span className={`text-[10px] font-black uppercase ${condition?.isDark ? 'text-yellow-500' : 'text-slate-500'}`}>
              {condition?.isDark ? 'Required' : 'Optional'}
            </span>
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
            <div className={`absolute bottom-full mb-3 left-0 right-0 p-3 rounded-2xl border shadow-2xl z-[60] flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200 ${isDark ? 'bg-[#1a1d24] border-white/20' : 'bg-white border-slate-300'}`}>
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Wind Details</span>
                <p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  Speed: {Math.round(condition?.windSpeed ?? 0)} km/h<br/>
                  Direction: {getCardinal(condition?.windDirection ?? 0)}
                </p>
              </div>
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
            <div className={`absolute bottom-full mb-3 left-[-100%] right-0 p-3 rounded-2xl border shadow-2xl z-[60] flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200 ${isDark ? 'bg-[#1a1d24] border-white/20' : 'bg-white border-slate-300'}`}>
              <div className="flex flex-col gap-1.5 flex-1"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Traction</span><p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{surfaceRiskReason}</p></div>
              <button onClick={() => setShowSurfaceDetails(false)} className="p-1 rounded-md hover:bg-white/10 self-start"><X className="w-3.5 h-3.5 text-slate-500" /></button>
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
            <div className={`absolute bottom-full mb-3 left-0 right-0 p-3 rounded-2xl border shadow-2xl z-[60] flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200 ${isDark ? 'bg-[#1a1d24] border-white/20' : 'bg-white border-slate-300'}`}>
              <div className="flex flex-col gap-1.5 flex-1"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Ice Dynamics</span><p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{iceRiskReason}</p></div>
              <button onClick={() => setShowIceDetails(false)} className="p-1 rounded-md hover:bg-white/10 self-start"><X className="w-3.5 h-3.5 text-slate-500" /></button>
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
            <div className={`absolute bottom-full mb-3 left-[-100%] right-0 p-4 rounded-2xl border shadow-2xl z-[60] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${isDark ? 'bg-[#1a1d24] border-white/20' : 'bg-white border-slate-300'}`}>
              <div className="flex items-center justify-between"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-slate-500">Deduction Breakdown</span><button onClick={() => setShowScoreDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="space-y-2">
                {scoreBreakdown.length > 0 ? scoreBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-bold">
                    <div className="flex items-center gap-2">{item.icon}<span className={item.val < 0 ? (isDark ? 'text-slate-300' : 'text-slate-600') : 'text-emerald-500'}>{item.label}</span></div>
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