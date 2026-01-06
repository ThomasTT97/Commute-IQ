
import React, { useMemo, useState, useEffect } from 'react';
import { LocationSuggestion, WeatherCondition } from '../types';
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
  Droplets,
  Sunrise,
  Sunset,
  Zap,
  Timer,
  Compass
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
  onToggleIntelligence?: () => void;
  isIntelligenceExpanded?: boolean;
  isActive?: boolean;
  popupDirection?: 'up' | 'down';
  onPopupStateChange?: (isOpen: boolean) => void;
}

const getCardinal = (angle: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(angle / 45) % 8];
};

const formatTime = (isoString?: string): string => {
  if (!isoString) return "--:--";
  const timePart = isoString.includes('T') ? isoString.split('T')[1] : isoString;
  return timePart.substring(0, 5);
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
  onSelectLocationAdvice,
  onToggleIntelligence,
  isIntelligenceExpanded = false,
  isActive = false,
  popupDirection = 'up',
  onPopupStateChange
}) => {
  const isDark = theme === 'dark';
  const [showWindDetails, setShowWindDetails] = useState(false);
  const [showIceDetails, setShowIceDetails] = useState(false);
  const [showSurfaceDetails, setShowSurfaceDetails] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [showTempDetails, setShowTempDetails] = useState(false);
  const [showLightsDetails, setShowLightsDetails] = useState(false);
  const [showRoutePopup, setShowRoutePopup] = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [countdown, setCountdown] = useState<string>("");

  const isAnyPopupOpen = showWindDetails || showIceDetails || showSurfaceDetails || showScoreDetails || showTempDetails || showLightsDetails || showRoutePopup || showLocationPopup;

  useEffect(() => {
    onPopupStateChange?.(isAnyPopupOpen);
  }, [isAnyPopupOpen, onPopupStateChange]);

  const closeAllPopups = () => {
    setShowWindDetails(false); 
    setShowIceDetails(false); 
    setShowSurfaceDetails(false); 
    setShowScoreDetails(false);
    setShowTempDetails(false); 
    setShowLightsDetails(false); 
    setShowRoutePopup(false); 
    setShowLocationPopup(false);
  };

  useEffect(() => {
    closeAllPopups();
  }, [compact]);

  useEffect(() => {
    if (!condition?.estimatedDryTime || !showSurfaceDetails) return;
    const updateTimer = () => {
      const now = Date.now();
      const diff = condition.estimatedDryTime - now;
      if (diff <= 0) {
        setCountdown("DRY");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        if (hours > 0) setCountdown(`${hours}h ${minutes}m`);
        else setCountdown(`${minutes}m ${seconds}s`);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [condition?.estimatedDryTime, showSurfaceDetails]);

  const wind = useMemo(() => {
    const impact = condition?.headwindImpact ?? 0;
    const speed = condition?.windSpeed ?? 0;
    if (speed < 7) return { label: 'CALM', color: 'text-slate-500', icon: <Wind className="w-5.5 h-5.5" /> };
    if (impact > 20) return { label: 'HEADWIND', color: 'text-orange-500', icon: <ArrowDownToLine className="w-5.5 h-5.5" /> };
    if (impact < -20) return { label: 'TAILWIND', color: 'text-emerald-500', icon: <MoveUp className="w-5.5 h-5.5" /> };
    return { label: 'SIDEWIND', color: 'text-blue-500', icon: <ArrowLeftRight className="w-5.5 h-5.5" /> };
  }, [condition?.headwindImpact, condition?.windSpeed]);

  const surface = useMemo(() => {
    const isWet = (condition?.wetSurfaceChance ?? 0) > 50;
    return isWet 
      ? { label: 'WET', color: 'text-blue-500', icon: <AlertTriangle className="w-5.5 h-5.5" /> }
      : { label: 'DRY', color: 'text-emerald-500', icon: <ShieldCheck className="w-5.5 h-5.5" /> };
  }, [condition?.wetSurfaceChance]);

  const iceInfo = useMemo(() => {
    const isIcy = !!condition?.iceRisk;
    return isIcy
      ? { label: 'ICE', color: 'text-red-500', icon: <AlertTriangle className="w-5.5 h-5.5" /> }
      : { label: 'NO ICE', color: 'text-emerald-500', icon: <ShieldCheck className="w-5.5 h-5.5" /> };
  }, [condition?.iceRisk]);

  const iceRiskReason = useMemo(() => {
    if (!condition) return "";
    if (condition.iceRisk) {
      if (condition.activeFreezing) {
        const temp = Math.round(condition.temp);
        if (temp > 0) return `Caution: Temperatures touched the freezing boundary (0.5°C). At ${temp}°C, invisible black ice remains a high probability.`;
        return `Critical: Surface moisture has frozen solid. Air temperatures reached ${temp}°C, creating treacherous conditions.`;
      }
      if (condition.overnightFreeze) {
        return "Caution: Recent sub-zero temperatures. Due to thermal inertia, damp patches may remain frozen despite current air temp.";
      }
      return "Surface Alert: High moisture and near-freezing temperatures detected. Roads likely slippery with frost.";
    } else {
      const isCurrentlyFreezing = condition.temp <= 0.5;
      const wasFreezingRecently = condition.minPastTemp !== undefined && condition.minPastTemp <= 0;
      if (isCurrentlyFreezing || wasFreezingRecently) return "Safe (Dry Cold): Below freezing, but critically low humidity inhibits frost formation.";
      return "Safe: Temperatures remained consistently above the freezing threshold.";
    }
  }, [condition]);

  const surfaceRiskReason = useMemo(() => {
    if (!condition) return "";
    const isWet = (condition.wetSurfaceChance ?? 0) > 50;
    const rainDuring = condition.precipDuringSession ?? condition.precipitation ?? 0;
    if (isWet) {
      if (rainDuring > 0) return `Active Saturation: ${rainDuring}mm precipitation falling. Traction significantly reduced.`;
      if (condition.lastPrecipitationTime && condition.lastPrecipitationTime !== "None") return `Residual Moisture: Roads remain wet from rain at ${condition.lastPrecipitationTime}.`;
      return `Damp Surface: low solar radiation prevented the surface from fully drying.`;
    }
    return "Optimal Traction: The road surface is dry. Evaporation cycles effective.";
  }, [condition]);

  const iceVitals = useMemo(() => {
    if (!condition) return [];
    return [
      { label: "Air Temp", value: `${Math.round(condition.temp)}°C`, icon: <Thermometer className="w-3.5 h-3.5 text-blue-400" /> },
      { label: "Min Past (6h)", value: `${Math.round(condition.minPastTemp ?? condition.temp)}°C`, icon: <Clock className="w-3.5 h-3.5 text-slate-400" /> },
      { label: "Humidity", value: `${condition.humidity}%`, icon: <Droplets className="w-3.5 h-3.5 text-blue-300" /> },
      { label: "Status", value: condition.iceRisk ? "High Risk" : "Safe", icon: <AlertTriangle className={`w-3.5 h-3.5 ${condition.iceRisk ? 'text-red-500' : 'text-emerald-500'}`} /> }
    ];
  }, [condition]);

  const surfaceVitals = useMemo(() => {
    if (!condition) return [];
    const rainDuring = condition.precipDuringSession ?? condition.precipitation ?? 0;
    return [
      { label: "Rain During", value: rainDuring > 0 ? `${rainDuring} mm` : "None", icon: <CloudRain className="w-3.5 h-3.5 text-blue-500" /> },
      { label: "Last rain", value: condition.lastPrecipitationTime || "None", icon: <Clock className="w-3.5 h-3.5 text-slate-400" /> },
      { label: "Humidity", value: `${condition.humidity}%`, icon: <Droplets className="w-3.5 h-3.5 text-blue-300" /> },
      { label: "Saturation", value: `${condition.wetSurfaceChance}%`, icon: <Droplets className={`w-3.5 h-3.5 text-blue-500`} /> }
    ];
  }, [condition]);

  const scoreColor = useMemo(() => {
    const s = Math.round(safetyScore ?? 0);
    if (s > 70) return 'text-emerald-500';
    if (s >= 30) return 'text-orange-500';
    return 'text-red-500';
  }, [safetyScore]);

  const getBreakdownIcon = (label: string) => {
    switch (label) {
      case "Critical Ice Risk": return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
      case "Active Precipitation": return <CloudRain className="w-3.5 h-3.5 text-blue-500" />;
      case "Wet Roads": return <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />;
      case "Wind Intensity": return <Wind className="w-3.5 h-3.5 text-slate-400" />;
      case "Headwind Drag": return <ArrowDownToLine className="w-3.5 h-3.5 text-orange-500" />;
      case "Tailwind Boost": return <MoveUp className="w-3.5 h-3.5 text-emerald-500" />;
      case "Weather Surplus": return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
      case "Cold Exposure": return <Thermometer className="w-3.5 h-3.5 text-blue-300" />;
      case "Heat Stress": return <Thermometer className="w-3.5 h-3.5 text-red-400" />;
      case "Darkness / Visibility": return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      default: return <Droplets className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const scoreBreakdown = useMemo(() => {
    if (!condition?.scoreBreakdown) return [];
    return condition.scoreBreakdown.map((item: any) => ({
      ...item,
      icon: getBreakdownIcon(item.label)
    }));
  }, [condition?.scoreBreakdown]);

  const toggleWind = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showWindDetails) setShowWindDetails(false); else { closeAllPopups(); setShowWindDetails(true); } };
  const toggleIce = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showIceDetails) setShowIceDetails(false); else { closeAllPopups(); setShowIceDetails(true); } };
  const toggleSurface = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showSurfaceDetails) setShowSurfaceDetails(false); else { closeAllPopups(); setShowSurfaceDetails(true); } };
  const toggleScore = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showScoreDetails) setShowScoreDetails(false); else { closeAllPopups(); setShowScoreDetails(true); } };
  const toggleTemp = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showTempDetails) setShowTempDetails(false); else { closeAllPopups(); setShowTempDetails(true); } };
  const toggleLights = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showLightsDetails) setShowLightsDetails(false); else { closeAllPopups(); setShowLightsDetails(true); } };
  const toggleRoute = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showRoutePopup) setShowRoutePopup(false); else { closeAllPopups(); setShowRoutePopup(true); } };
  const toggleLocation = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showLocationPopup) setShowLocationPopup(false); else { closeAllPopups(); setShowLocationPopup(true); } };

  const popupBgClass = isDark ? 'bg-[#0f1115] border-white/20 shadow-2xl' : 'bg-white border-slate-300 shadow-2xl';
  const blockBgClass = isDark ? 'bg-[#0f1115] border-white/5 hover:bg-[#14171d]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100';

  const getPopupStyles = (isLeftOffset = false, isRightOffset = false, isFullWidth = false) => {
    const vertical = popupDirection === 'up' ? 'bottom-full mb-3' : 'top-full mt-3';
    const horizontal = isFullWidth ? 'left-0 right-0' : (isRightOffset ? 'right-0' : (isLeftOffset ? 'left-0' : 'left-0 right-0'));
    const animation = popupDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2';
    const widthClass = isFullWidth ? 'w-full' : 'w-max max-w-[calc(100vw-3rem)] sm:max-w-[320px]';
    return `${vertical} ${horizontal} animate-in fade-in ${animation} duration-200 ${widthClass} z-[1100] transform-gpu`;
  };

  if (compact) {
    return (
      <div className={`w-full rounded-[1.5rem] p-3 sm:p-4 border transition-all flex flex-col justify-between ${isActive ? (isDark ? 'border-blue-500 bg-[#0a0c10]' : 'border-blue-300 bg-blue-50') : (isDark ? 'border-white/5 bg-[#0a0c10]' : 'border-slate-200 bg-white shadow-sm')}`}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[8px] font-black tracking-[0.15em] text-slate-500 uppercase">
            <div className="flex items-center gap-1.5"><Calendar className="w-2.5 h-2.5 text-blue-500/50" /><span>{dateLabel}</span></div>
            <div className="flex items-center gap-1.5"><Clock className="w-2.5 h-2.5 text-slate-600" /><span>{timeRange}</span></div>
          </div>
          <div className={`flex items-center gap-2 text-[9px] font-bold uppercase tracking-tight truncate border-t pt-1.5 ${isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
            <MapPin className="w-2.5 h-2.5 flex-none text-blue-500/50" /><span className="truncate">{startLocation}</span><ArrowRight className="w-2 h-2 opacity-30 flex-none" /><span className="truncate">{endLocation}</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4 sm:gap-6"><span className={`text-xl sm:text-2xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition?.temp ?? 0)}°</span></div>
          <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <Lightbulb className={`w-4 h-4 transition-all ${condition?.isDark ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.7)]' : 'text-slate-700 opacity-40'}`} />
                <div className="flex gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-black items-center"><span className={surface.color}>{surface.label}</span><span className="text-slate-700 opacity-20">|</span><span className={iceInfo.label === 'NO ICE' ? 'text-emerald-500' : 'text-red-500'}>{iceInfo.label}</span></div>
              </div>
            </div>
          <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl font-black text-[9px] sm:text-[10px] border tracking-wider transition-colors ${isDark ? 'bg-[#1a1d24] border-white/5' : 'bg-slate-50 border-slate-200'} ${showRawWind ? (isDark ? 'text-blue-400' : 'text-blue-600') : wind.color}`}>{showRawWind ? `${Math.round(condition?.windSpeed ?? 0)} ${getCardinal(condition?.windDirection ?? 0)}` : wind.label} <Wind className="w-4 h-4" /></div>
        </div>
      </div>
    );
  }

  const actionBtnClass = isDark 
    ? 'bg-[#1a1d24] border-blue-500/20 text-blue-400 hover:bg-[#20252d]' 
    : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 shadow-sm';

  return (
    <div className={`h-full w-full rounded-[2rem] border overflow-visible flex flex-col p-4 sm:p-5 shadow-2xl transition-all relative ${isDark ? 'border-white/5 bg-[#0a0c10]' : 'bg-white border-slate-200'}`}>
      
      {isAnyPopupOpen && (
        <div 
          className="fixed inset-0 z-[900] bg-black/60 transition-all duration-300 cursor-default" 
          onClick={(e) => { e.stopPropagation(); closeAllPopups(); }} 
        />
      )}

      {showSurfaceDetails && (
        <div className={`absolute shadow-2xl flex flex-col gap-3 p-4 rounded-2xl border ${getPopupStyles(false, false, true)} ${popupBgClass}`}>
          <div className="flex items-center justify-between"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Surface Diagnostics</span><button onClick={toggleSurface} className="p-1 rounded-md hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
          {condition?.estimatedDryTime && (condition?.wetSurfaceChance ?? 0) > 50 && (
            <div className={`p-3 rounded-xl border flex flex-col gap-1.5 ${isDark ? 'bg-black border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex justify-between items-center"><div className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-blue-500 animate-pulse" /><span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Time to dry</span></div><span className={`text-sm font-black font-mono tracking-tighter ${isDark ? 'text-white' : 'text-blue-700'}`}>{countdown}</span></div>
              <div className={`h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}><div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.max(0, 100 - (condition.wetSurfaceChance || 0))}%` }} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">{surfaceVitals.map((item, i) => (<div key={i} className="flex items-center justify-between text-[10px] font-bold"><div className="flex items-center gap-2"><div className="flex-none w-5 flex justify-center">{item.icon}</div><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{item.label}</span></div><span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{item.value}</span></div>))}</div>
          <div className={`mt-1 p-2.5 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-100'}`}><span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Atmos Logic Analysis</span><p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{surfaceRiskReason}</p></div>
        </div>
      )}

      {showIceDetails && (
        <div className={`absolute shadow-2xl flex flex-col gap-3 p-4 rounded-2xl border ${getPopupStyles(false, false, true)} ${popupBgClass}`}>
          <div className="flex items-center justify-between"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Risk assessment</span><button onClick={toggleIce} className="p-1 rounded-md hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">{iceVitals.map((item, i) => (<div key={i} className="flex items-center justify-between text-[10px] font-bold"><div className="flex items-center gap-2"><div className="flex-none w-5 flex justify-center">{item.icon}</div><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{item.label}</span></div><span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{item.value}</span></div>))}</div>
          <div className={`mt-1 p-2.5 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-100'}`}><span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Assessment Details</span><p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{iceRiskReason}</p></div>
        </div>
      )}

      {showScoreDetails && (
        <div className={`absolute shadow-2xl flex flex-col gap-3 p-4 rounded-2xl border ${getPopupStyles(false, false, true)} ${popupBgClass}`}>
          <div className="flex items-center justify-between"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Deduction Breakdown</span><button onClick={() => setShowScoreDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
          <div className="space-y-2">
            {scoreBreakdown.length > 0 ? scoreBreakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] font-bold"><div className="flex items-center gap-2"><div className="flex-none w-5 flex justify-center">{item.icon}</div><span className={item.val < 0 ? (isDark ? 'text-slate-300' : 'text-slate-600') : 'text-emerald-500'}>{item.label}</span></div><span className={item.val < 0 ? 'text-red-400' : 'text-emerald-500'}>{item.val > 0 ? `+${Math.round(item.val)}%` : `${Math.round(item.val)}%`}</span></div>
            )) : <p className="text-[10px] font-bold text-emerald-500">Perfect conditions: No deductions applied.</p>}
          </div>
        </div>
      )}

      <div className="flex-none flex items-center justify-between text-[9px] font-black tracking-widest text-slate-500 uppercase mb-1.5">
        <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3 text-blue-500/50" /><span>{dateLabel}</span><Clock className="w-3 h-3 text-slate-600 ml-1" /><span>{timeRange}</span></div>
      </div>
      <div className="flex-none flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-[70%]"><MapPin className="w-3 h-3 text-blue-500/50 flex-none" /><span className="truncate">{startLocation}</span><ArrowRight className="w-2.5 h-2.5 opacity-30 flex-none" /><span className="truncate">{endLocation}</span></div>
        {distance && (<div className="flex items-center gap-1.5 text-[8px] font-black text-slate-500 flex-none"><Navigation className="w-2.5 h-2.5 text-blue-500" /><span>{distance.toFixed(1)} KM</span></div>)}
      </div>

      {((optimizationAdvice && optimizationAdvice.length > 0) || (locationAdvice && locationAdvice.length > 0) || onToggleIntelligence) && (
        <div className="flex-none mb-2 flex gap-1.5 relative z-[1000]">
          {optimizationAdvice && optimizationAdvice.length > 0 && (<button onClick={toggleRoute} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${showRoutePopup ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : actionBtnClass}`}><Sparkles className="w-2.5 h-2.5" />route</button>)}
          {locationAdvice && locationAdvice.length > 0 && (<button onClick={toggleLocation} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${showLocationPopup ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : actionBtnClass}`}><MapIcon className="w-2.5 h-2.5" />location</button>)}
          {onToggleIntelligence && (<button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleIntelligence(); }} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${isIntelligenceExpanded ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : actionBtnClass}`}><Zap className="w-2.5 h-2.5" />Intel</button>)}
          
          {showRoutePopup && (
            <div className={`absolute top-full left-0 right-0 mt-2 p-4 rounded-2xl border ${popupBgClass} z-[1200] transform-gpu`}>
              <div className="flex items-center justify-between mb-3"><span className="text-[8px] font-black uppercase text-blue-500">Suggested Points</span><button onClick={() => setShowRoutePopup(false)} className="p-1"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="flex flex-col gap-2">{optimizationAdvice?.slice(0, 5).map((loc, idx) => (
                <div key={idx} className={`p-2 rounded-xl border flex items-center justify-between ${isDark ? 'bg-black border-white/5' : 'bg-slate-100 border-slate-300'}`}>
                  <span className={`text-[11px] font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>{loc.name}</span>
                </div>
              ))}</div>
            </div>
          )}
          {showLocationPopup && (
            <div className={`absolute top-full left-0 right-0 mt-2 p-4 rounded-2xl border ${popupBgClass} z-[1200] transform-gpu`}>
              <div className="flex items-center justify-between mb-3"><span className="text-[8px] font-black uppercase text-blue-500">Alternatives</span><button onClick={() => setShowLocationPopup(false)} className="p-1"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="flex flex-col gap-2">{locationAdvice?.slice(0, 5).map((loc, idx) => (
                <button key={idx} onClick={() => onSelectLocationAdvice?.(loc)} className={`p-2 rounded-xl border flex items-center justify-between transition-colors ${isDark ? 'bg-black border-white/5 hover:bg-blue-500/10' : 'bg-slate-100 border-slate-300 hover:bg-blue-50'}`}>
                  <span className={`text-[11px] font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>{loc.name}</span>
                  <MapIcon className="w-3 h-3 text-blue-500" />
                </button>
              ))}</div>
            </div>
          )}
        </div>
      )}

      <div className="flex-none flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex flex-col relative">
          <button onClick={toggleTemp} className="flex items-baseline gap-1 group transition-all active:opacity-70 text-left">
            <span className={`text-4xl sm:text-5xl font-black leading-none tracking-tighter transition-colors ${isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'}`}>{Math.round(condition?.temp ?? 0)}°</span><span className="text-lg font-bold text-slate-500 tracking-tighter ml-1">C</span>
          </button>
          {showTempDetails && (
            <div className={`absolute p-4 rounded-2xl border min-w-[150px] ${getPopupStyles()} ${popupBgClass}`}>
              <div className="flex items-center justify-between mb-3"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Temp Range</span><button onClick={() => setShowTempDetails(false)} className="p-1 -mr-1"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-[11px] font-black"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>MIN TEMP</span><span className={isDark ? 'text-white' : 'text-slate-900'}>{Math.round(condition?.minTemp ?? condition?.temp ?? 0)}°C</span></div>
                <div className="flex items-center justify-between text-[11px] font-black"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>MAX TEMP</span><span className={isDark ? 'text-white' : 'text-slate-900'}>{Math.round(condition?.maxTemp ?? condition?.temp ?? 0)}°C</span></div>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button onClick={toggleLights} className={`rounded-[1.25rem] p-2.5 flex items-center gap-3 min-w-[110px] transition-all active:scale-[0.98] ${isDark ? 'bg-[#161920] border border-white/5 hover:bg-[#1c2029]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
            <Lightbulb className={`w-5 h-5 transition-all ${condition?.isDark ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'text-slate-300'}`} />
            <div className="flex flex-col text-left"><span className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Lights</span><span className={`text-[9px] font-black uppercase ${condition?.isDark ? 'text-yellow-500' : 'text-slate-500'}`}>{condition?.isDark ? 'Required' : 'Optional'}</span></div>
          </button>
          {showLightsDetails && (
            <div className={`absolute p-4 rounded-2xl border min-w-[160px] ${getPopupStyles(false, true)} ${popupBgClass}`}>
              <div className="flex items-center justify-between mb-3"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Solar Analysis</span><button onClick={() => setShowLightsDetails(false)} className="p-1 -mr-1"><X className="w-3.5 h-3.5 text-slate-500" /></button></div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><Sunrise className="w-3.5 h-3.5 text-orange-400" /><span className="text-[10px] font-black text-slate-500 uppercase">Sunrise</span></div><span className={`text-[11px] font-mono font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{formatTime(condition?.sunrise)}</span></div>
                <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><Sunset className="w-3.5 h-3.5 text-indigo-400" /><span className="text-[10px] font-black text-slate-500 uppercase">Sunset</span></div><span className={`text-[11px] font-mono font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{formatTime(condition?.sunset)}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-grow min-h-0">
        <button onClick={toggleWind} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border relative transition-all duration-300 active:scale-[0.98] ${showWindDetails ? 'ring-1 ring-blue-500/50' : ''} ${blockBgClass}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">WIND</span></div>
          <div className="flex items-center justify-between">{showRawWind ? (<span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{Math.round(condition?.windSpeed ?? 0)} <span className="text-[8px] opacity-60">KM/H</span> {getCardinal(condition?.windDirection ?? 0)}</span>) : (<span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${wind.color}`}>{wind.label}</span>)}<div className={showRawWind ? (isDark ? 'text-blue-400' : 'text-blue-600') : wind.color}>{wind.icon}</div></div>
          {showWindDetails && (
            <div className={`absolute shadow-2xl flex items-center justify-between p-3 rounded-2xl border ${getPopupStyles(true, false)} ${popupBgClass}`}>
              <div className="flex flex-col gap-1.5 flex-1"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Wind Details</span><p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Speed: {Math.round(condition?.windSpeed ?? 0)} km/h<br/>Direction: {getCardinal(condition?.windDirection ?? 0)}</p></div>
              <button onClick={toggleWind} className="p-1 rounded-md hover:bg-white/10"><X className="w-3.5 h-3.5 text-slate-500" /></button>
            </div>
          )}
        </button>

        <button onClick={toggleSurface} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border relative transition-all duration-300 active:scale-[0.98] ${showSurfaceDetails ? 'ring-1 ring-blue-500/50' : ''} ${blockBgClass}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">SURFACE</span></div>
          <div className="flex items-center justify-between"><span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${surface.color}`}>{surface.label}</span><div className={surface.color}>{surface.icon}</div></div>
        </button>

        <button onClick={toggleIce} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border relative transition-all duration-300 active:scale-[0.98] ${showIceDetails ? 'ring-1 ring-red-500/50' : ''} ${blockBgClass}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">ICE RISK</span></div>
          <div className="flex items-center justify-between"><span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${iceInfo.color}`}>{iceInfo.label}</span><div className={iceInfo.color}>{iceInfo.icon}</div></div>
        </button>

        <button onClick={toggleScore} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border relative transition-all duration-300 active:scale-[0.98] ${showScoreDetails ? 'ring-1 ring-blue-500/50' : ''} ${blockBgClass}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">SCORE</span></div>
          <div className="flex items-center justify-between"><span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${scoreColor}`}>{Math.round(safetyScore ?? 0)}%</span><div className={scoreColor}><Bike className="w-5.5 h-5.5" /></div></div>
        </button>
      </div>
    </div>
  );
};
