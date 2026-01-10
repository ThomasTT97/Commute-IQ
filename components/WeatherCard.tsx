
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LocationSuggestion, WeatherCondition, SearchCriteria } from '../types';
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
  Snowflake,
  ArrowUp,
  RefreshCw,
  Search,
  Loader2,
  Activity,
  Compass,
  Sun,
  Cloud,
  CloudLightning
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
  onTriggerAlternativesSearch?: () => void;
  searchCriteria?: SearchCriteria;
  setSearchCriteria?: (val: SearchCriteria) => void;
  isLoading?: boolean;
}

const getCardinal = (angle: number): string => {
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 
    'E', 'ESE', 'SE', 'SSE', 
    'S', 'SSW', 'SW', 'WSW', 
    'W', 'WNW', 'NW', 'NNW'
  ];
  return directions[Math.round(angle / 22.5) % 16];
};

const formatTime = (isoString?: string): string => {
  if (!isoString) return "--:--";
  const timePart = isoString.includes('T') ? isoString.split('T')[1] : isoString;
  return timePart.substring(0, 5);
};

const getWeatherIcon = (cond: string, isDark: boolean, sizeClasses: string = "w-8 h-8") => {
  if (isDark && (cond === 'Sunny' || cond === 'Cloudy')) return <Moon className={`${sizeClasses} text-indigo-400`} />;
  switch (cond) {
    case 'Sunny': return <Sun className={`${sizeClasses} text-yellow-500`} />;
    case 'Rainy': return <CloudRain className={`${sizeClasses} text-blue-500`} />;
    case 'Cloudy': return <Cloud className={`${sizeClasses} text-slate-400`} />;
    case 'Windy': return <Wind className={`${sizeClasses} text-slate-400`} />;
    case 'Stormy': return <CloudLightning className={`${sizeClasses} text-purple-500`} />;
    case 'Snowy': return <Snowflake className={`${sizeClasses} text-blue-200`} />;
    default: return <Cloud className={`${sizeClasses} text-slate-400`} />;
  }
};

const Modal = ({ children, onClose, isDark, size = 'md' }: { children?: React.ReactNode, onClose: () => void, isDark: boolean, size?: 'md' | 'lg' }) => {
  const maxWidth = size === 'lg' ? 'max-w-[400px]' : 'max-w-[340px]';
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div 
        className={`relative w-full ${maxWidth} max-h-[90dvh] rounded-[1.75rem] shadow-2xl p-6 border animate-in zoom-in-95 fade-in duration-200 flex flex-col ${isDark ? 'bg-[#0f1115] border-white/20' : 'bg-white border-slate-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
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
  onPopupStateChange,
  onTriggerAlternativesSearch,
  searchCriteria,
  setSearchCriteria,
  isLoading = false
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

  const wind = useMemo(() => {
    const impact = condition?.headwindImpact ?? 0;
    const speed = condition?.windSpeed ?? 0;

    if (showRawWind) {
      return { label: 'COMPASS', color: 'text-blue-400', icon: <Compass className="w-5.5 h-5.5" /> };
    }

    if (speed < 7) return { label: 'CALM', color: 'text-slate-500', icon: <Wind className="w-5.5 h-5.5" /> };
    if (impact > 20) return { label: 'HEADWIND', color: 'text-orange-500', icon: <ArrowDownToLine className="w-5.5 h-5.5" /> };
    if (impact < -20) return { label: 'TAILWIND', color: 'text-emerald-500', icon: <MoveUp className="w-5.5 h-5.5" /> };
    return { label: 'SIDEWIND', color: 'text-blue-500', icon: <ArrowLeftRight className="w-5.5 h-5.5" /> };
  }, [condition?.headwindImpact, condition?.windSpeed, showRawWind]);

  const surface = useMemo(() => {
    if (condition?.isSnowy) return { label: 'SNOW', color: 'text-indigo-400', icon: <Snowflake className="w-5.5 h-5.5" /> };
    const chance = condition?.wetSurfaceChance ?? 0;
    if (chance > 80) return { label: 'WET', color: 'text-blue-500', icon: <AlertTriangle className="w-5.5 h-5.5" /> };
    if (chance >= 10) return { label: 'DAMP', color: 'text-blue-400', icon: <Droplets className="w-5.5 h-5.5" /> };
    return { label: 'DRY', color: 'text-emerald-500', icon: <ShieldCheck className="w-5.5 h-5.5" /> };
  }, [condition?.wetSurfaceChance, condition?.isSnowy]);

  const iceInfo = useMemo(() => {
    const isIcy = !!condition?.iceRisk;
    return isIcy
      ? { label: 'ICE', color: 'text-red-500', icon: <AlertTriangle className="w-5.5 h-5.5" /> }
      : { label: 'NO ICE', color: 'text-emerald-500', icon: <ShieldCheck className="w-5.5 h-5.5" /> };
  }, [condition?.iceRisk]);

  const iceRiskReason = useMemo(() => {
    if (!condition) return "";
    if (condition.iceRisk) {
      if (condition.isSnowy) {
        return "Critical: Snow accumulation detected. Surface friction is non-existent. Stay upright and minimize lean angle.";
      }
      const isWet = (condition.wetSurfaceChance ?? 0) >= 10;
      if (isWet) {
        if (condition.activeFreezing) {
          return `Active Freezing: Air temp is ${Math.round(condition.temp)}°C. Wet roads are likely turning to black ice as ground temp is often 2-3 degrees lower.`;
        }
        if (condition.overnightFreeze) {
          return `Thermal Inertia: Sub-zero temps overnight. Shaded patches will remain frozen well into the day despite rising air temperatures.`;
        }
      } else {
        return `Hoar Frost: High humidity (${condition.humidity}%) meeting freezing air. Moisture is crystallizing directly onto dry roads. Corners will be greasy.`;
      }
      return "Safety Alert: Atmospheric profile suggests high probability of surface icing. Execute defensive handling.";
    } else {
      const isCurrentlyCold = condition.temp <= 2.5;
      const wasFreezingRecently = condition.minPastTemp !== undefined && condition.minPastTemp <= 0.5;
      if (isCurrentlyCold || wasFreezingRecently) {
        return "Dry Cold: Conditions are near zero, but critically low humidity inhibits frost formation and roads are bone dry.";
      }
      return "Safe: Surface and air temperatures remain comfortably above the freezing boundary.";
    }
  }, [condition]);

  const surfaceRiskReason = useMemo(() => {
    if (!condition) return "";
    if (condition.isSnowy) return "Snow Cover: Active snowfall detected. Traction is compromised across all vectors. High risk of sliding.";
    const chance = condition.wetSurfaceChance ?? 0;
    if (chance > 80) return "Saturated: Roads are significantly wet. Hydroplaning risk and low friction coefficients present.";
    if (chance >= 10) return `Drying: Residual moisture detected from rain at ${condition.lastPrecipitationTime || 'earlier'}. Surface is likely greasy/damp.`;
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
      { label: "Humidity", value: `${condition.humidity}%`, icon: <Droplets className="w-3.5 h-3.5 text-blue-300" /> },
      { label: "Rain Vol", value: rainDuring > 0 ? `${rainDuring} mm` : "None", icon: <CloudRain className="w-3.5 h-3.5 text-blue-500" /> },
      { label: "Last Rain", value: condition.lastPrecipitationTime || "None", icon: <Clock className="w-3.5 h-3.5 text-slate-400" /> },
      { label: "Wetness%", value: `${condition.wetSurfaceChance}%`, icon: <Activity className="w-3.5 h-3.5 text-blue-300" /> }
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
      case "Active Snowfall": return <Snowflake className="w-3.5 h-3.5 text-indigo-400" />;
      case "Active Precipitation": return <CloudRain className="w-3.5 h-3.5 text-blue-500" />;
      case "Wet Roads": return <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />;
      case "Wind Intensity": return <Wind className="w-3.5 h-3.5 text-slate-400" />;
      case "Headwind Drag": return <ArrowDownToLine className="w-3.5 h-3.5 text-orange-500" />;
      case "Tailwind Boost": return <MoveUp className="w-3.5 h-3.5 text-emerald-500" />;
      case "Weather Surplus": return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
      case "Cold Exposure": return <Thermometer className="w-3.5 h-3.5 text-blue-300" />;
      case "Heat Stress": return <Thermometer className="w-3.5 h-3.5 text-red-400" />;
      case "Darkness / Visibility": return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      case "Sleep hours": return <Clock className="w-3.5 h-3.5 text-slate-500" />;
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
  
  const toggleLocation = (e?: React.MouseEvent) => { 
    e?.preventDefault(); 
    e?.stopPropagation(); 
    if (showLocationPopup) setShowLocationPopup(false); 
    else { 
      closeAllPopups(); 
      setShowLocationPopup(true); 
      if (onTriggerAlternativesSearch && (!locationAdvice || locationAdvice.length === 0)) {
        onTriggerAlternativesSearch();
      }
    } 
  };

  const blockBgClass = isDark ? 'bg-[#0f1115] border-white/5 hover:bg-[#14171d]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100';
  const actionBtnClass = isDark 
    ? 'bg-[#1a1d24] border-blue-500/20 text-blue-400 hover:bg-[#20252d]' 
    : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 shadow-sm';

  const getSubScoreColor = (s: number) => {
    if (s > 70) return 'text-emerald-500';
    if (s >= 30) return 'text-orange-500';
    return 'text-red-500';
  };

  const isScanning = !!condition?.isScanning;
  const scanProgress = condition?.scanningProgress ?? 0;

  const primaryTemp = Math.round(condition?.startTemp ?? condition?.temp ?? 0);
  const primaryWindSpeed = Math.round(condition?.startWindSpeed ?? condition?.windSpeed ?? 0);
  const primaryWindDir = condition?.startWindDirection ?? condition?.windDirection ?? 0;

  const formattedDryTime = useMemo(() => {
    if (!condition?.estimatedDryTime) return "";
    const d = new Date(condition.estimatedDryTime);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }, [condition?.estimatedDryTime]);

  if (compact) {
    return (
      <div className={`w-full rounded-[1.5rem] p-3 sm:p-4 border transition-all flex flex-col justify-between ${isActive ? (isDark ? 'border-blue-500 bg-[#0a0c10]' : 'border-blue-300 bg-blue-50') : (isDark ? 'border-white/5 bg-[#0a0c10]' : 'border-slate-200 bg-white shadow-sm')}`}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-black tracking-widest text-slate-500 uppercase">
            <div className="flex items-center gap-1.5"><Calendar className="w-2.5 h-2.5 text-blue-500/50" /><span>{dateLabel}</span></div>
            <div className="flex items-center gap-1.5">
              {isLoading && <RefreshCw className="w-2.5 h-2.5 animate-spin text-blue-500/50 mr-1" />}
              <Clock className="w-2.5 h-2.5 text-slate-600" /><span>{timeRange}</span>
            </div>
          </div>
          <div className={`flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-tight truncate border-t pt-1.5 ${isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
            <div className="flex items-center gap-2 truncate">
              <MapPin className="w-2.5 h-2.5 flex-none text-blue-500/50" /><span className="truncate">{startLocation}</span><ArrowRight className="w-2 h-2 opacity-30 flex-none" /><span className="truncate">{endLocation}</span>
            </div>
            {distance && (
              <span className="flex-none text-[9px] font-black text-slate-500 opacity-60 tabular-nums">
                {distance.toFixed(1)}KM
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {getWeatherIcon(condition?.condition || 'Cloudy', !!condition?.isDark, "w-6 h-6")}
            <div className="flex items-center gap-4 sm:gap-6"><span className={`text-xl sm:text-2xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{primaryTemp}°</span></div>
          </div>
          <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <Lightbulb className={`w-4 h-4 transition-all ${condition?.isDark ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.7)]' : 'text-slate-700 opacity-40'}`} />
                <div className="flex gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-black items-center"><span className={surface.color}>{surface.label}</span><span className="text-slate-700 opacity-20">|</span><span className={iceInfo.label === 'NO ICE' ? 'text-emerald-500' : 'text-red-500'}>{iceInfo.label}</span></div>
              </div>
            </div>
          <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-black text-[10px] sm:text-[11px] border tracking-wider transition-colors ${isDark ? 'bg-[#1a1d24] border-white/5' : 'bg-slate-50 border-slate-200'} ${showRawWind ? (isDark ? 'text-blue-400' : 'text-blue-600') : wind.color}`}>{showRawWind ? `${primaryWindSpeed} ${getCardinal(primaryWindDir)}` : wind.label} <Wind className="w-4 h-4" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full rounded-[2rem] border overflow-visible flex flex-col p-4 sm:p-5 shadow-2xl transition-all relative ${isDark ? 'border-white/5 bg-[#0a0c10]' : 'bg-white border-slate-200'}`}>
      
      {showTempDetails && (
        <Modal onClose={() => setShowTempDetails(false)} isDark={isDark}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">Thermal Profile</span>
            <button onClick={() => setShowTempDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col gap-2">
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-blue-600/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Feels Like</span>
                <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition?.feelsLike ?? condition?.temp ?? 0)}°C</span>
              </div>
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Min Forecast</span>
                <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition?.minTemp ?? condition?.temp ?? 0)}°C</span>
              </div>
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Max Forecast</span>
                <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(condition?.maxTemp ?? condition?.temp ?? 0)}°C</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showLightsDetails && (
        <Modal onClose={() => setShowLightsDetails(false)} isDark={isDark}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">Solar Analysis</span>
            <button onClick={() => setShowLightsDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2">
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <Sunrise className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sunrise</span>
                </div>
                <span className={`text-sm font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatTime(condition?.sunrise)}</span>
              </div>
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <Sunset className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sunset</span>
                </div>
                <span className={`text-sm font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatTime(condition?.sunset)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showWindDetails && (
        <Modal onClose={() => setShowWindDetails(false)} isDark={isDark}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">Wind analysis</span>
            <button onClick={() => setShowWindDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col gap-4">
            <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Start Velocity</span>
                <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{primaryWindSpeed} KM/H</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Vector</span>
                <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{getCardinal(primaryWindDir)}</span>
              </div>
            </div>
            <div className="flex justify-center py-2">
               <div className={`relative p-6 rounded-full border ${isDark ? 'bg-black border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <div 
                  className="transition-transform duration-700 ease-out" 
                  style={{ transform: `rotate(${(primaryWindDir) + 180}deg)` }}
                >
                  <ArrowUp className="w-12 h-12 text-blue-500" />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showSurfaceDetails && (
        <Modal onClose={() => setShowSurfaceDetails(false)} isDark={isDark}>
          <div className="flex items-center justify-between mb-4"><span className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">Surface Diagnostics</span><button onClick={() => setShowSurfaceDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-4 h-4" /></button></div>
          {condition?.estimatedDryTime && (condition?.wetSurfaceChance ?? 0) >= 10 && !condition?.isSnowy && (
            <div className={`p-3 rounded-xl border flex flex-col gap-1.5 mb-3 ${isDark ? 'bg-black border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex justify-between items-center"><div className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-blue-500 animate-pulse" /><span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Expected Dry</span></div><span className={`text-sm font-black font-mono tracking-tighter ${isDark ? 'text-white' : 'text-blue-700'}`}>{formattedDryTime}</span></div>
              <div className={`h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}><div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.max(0, 100 - (condition.wetSurfaceChance || 0))}%` }} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-3">{surfaceVitals.map((item, i) => (<div key={i} className="flex items-center justify-between text-[11px] font-bold"><div className="flex items-center gap-2"><div className="flex-none w-5 flex justify-center">{item.icon}</div><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{item.label}</span></div><span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{item.value}</span></div>))}</div>
          <div className={`p-3 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-100'}`}><span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Atmos Logic Analysis</span><p className={`text-[11px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{surfaceRiskReason}</p></div>
        </Modal>
      )}

      {showIceDetails && (
        <Modal onClose={() => setShowIceDetails(false)} isDark={isDark}>
          <div className="flex items-center justify-between mb-4"><span className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">Risk Assessment</span><button onClick={() => setShowIceDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-4 h-4" /></button></div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-3">{iceVitals.map((item, i) => (<div key={i} className="flex items-center justify-between text-[11px] font-bold"><div className="flex items-center gap-2"><div className="flex-none w-5 flex justify-center">{item.icon}</div><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{item.label}</span></div><span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{item.value}</span></div>))}</div>
          <div className={`p-3 rounded-xl border flex flex-col gap-1 ${isDark ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-100'}`}><span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Assessment Details</span><p className={`text-[11px] font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{iceRiskReason}</p></div>
        </Modal>
      )}

      {showScoreDetails && (
        <Modal onClose={() => setShowScoreDetails(false)} isDark={isDark}>
          <div className="flex items-center justify-between mb-4"><span className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">SCORE</span><button onClick={() => setShowScoreDetails(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-4 h-4" /></button></div>
          <div className="space-y-3">
            {scoreBreakdown.length > 0 ? scoreBreakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] font-bold"><div className="flex items-center gap-2"><div className="flex-none w-5 flex justify-center">{item.icon}</div><span className={item.val < 0 ? (isDark ? 'text-slate-300' : 'text-slate-600') : 'text-emerald-500'}>{item.label}</span></div><span className={item.val < 0 ? 'text-red-400' : 'text-emerald-500'}>{item.val > 0 ? `+${Math.round(item.val)}%` : `${Math.round(item.val)}%`}</span></div>
            )) : <p className="text-[11px] font-bold text-emerald-500 text-center py-2">Perfect conditions: No deductions applied.</p>}
          </div>
        </Modal>
      )}

      {showRoutePopup && (
        <Modal onClose={() => setShowRoutePopup(false)} isDark={isDark}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest leading-none">Suggested Points</span>
            <button onClick={() => setShowRoutePopup(false)} className="p-1 rounded-md hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col gap-2">
            {optimizationAdvice?.length ? optimizationAdvice.slice(0, 5).map((loc, idx) => (
              <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between ${isDark ? 'bg-black border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[12px] font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{loc.name}</span>
                <MapPin className="w-3.5 h-3.5 text-blue-500/50" />
              </div>
            )) : (
              <div className="py-4 text-center text-slate-500 text-[11px] font-bold uppercase tracking-widest">No tactical points found.</div>
            )}
          </div>
        </Modal>
      )}

      {showLocationPopup && (
        <Modal onClose={() => setShowLocationPopup(false)} isDark={isDark} size="lg">
          <div className="flex items-center justify-between mb-4 flex-none">
            <div className="flex items-center gap-2.5">
              <span className="text-[14px] font-black text-blue-500 uppercase tracking-widest leading-none">ALTERNATIVE LOCATIONS</span>
              {isScanning && (
                <div className="relative flex items-center justify-center h-6 w-6">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                  <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
            <button onClick={() => setShowLocationPopup(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
          
          {isScanning && (
            <div className="mb-6 space-y-2.5 flex-none">
               <div className={`h-2 w-full rounded-full overflow-hidden relative ${isDark ? 'bg-white/5 shadow-inner' : 'bg-slate-200'}`}>
                 <div 
                   className="h-full bg-blue-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                   style={{ width: `${scanProgress}%` }} 
                 />
               </div>
               <div className="flex justify-between items-center px-0.5">
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] animate-pulse">Scanning Grid...</span>
                  </div>
                  <span className={`text-[10px] font-black font-mono ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{scanProgress}%</span>
               </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto hide-scrollbar mb-4 flex flex-col gap-2.5 px-0.5">
            {locationAdvice?.length ? locationAdvice.map((loc, idx) => (
              <button key={idx} onClick={() => { onSelectLocationAdvice?.(loc); setShowLocationPopup(false); }} className={`group p-4 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98] border ${isDark ? 'bg-black border-white/5 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5' : 'bg-slate-50 border-slate-200 hover:bg-blue-50'}`}>
                <div className="flex flex-col items-start gap-1.5 flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2.5 w-full">
                    <span className={`text-[14px] font-black uppercase tracking-tight leading-none truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{loc.name.split(',')[0]}</span>
                    {loc.distanceFromTrainingCenter !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded bg-blue-500/10 text-[8px] font-black uppercase tracking-widest whitespace-nowrap flex-none ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                        {Math.round(loc.distanceFromTrainingCenter)} KM
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">SCORE:</span>
                      <span className={`text-[12px] font-black ${getSubScoreColor(loc.score || 0)}`}>{Math.round(loc.score || 0)}%</span>
                    </div>
                    {loc.bestHour !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">START:</span>
                        <span className={`text-[12px] font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{loc.bestHour.toString().padStart(2, '0')}:00</span>
                      </div>
                    )}
                  </div>
                </div>
                <MapPin className="w-4.5 h-4.5 text-blue-500 transition-transform group-hover:scale-125" />
              </button>
            )) : (
              !isScanning && <div className="py-16 text-center text-slate-500 text-[11px] font-black uppercase tracking-[0.3em] opacity-30 flex flex-col items-center gap-4">
                <MapIcon className="w-8 h-8 mb-2" />
                Registry Empty
              </div>
            )}
          </div>

          {!isScanning && onTriggerAlternativesSearch && (
            <button 
              onClick={(e) => { e.stopPropagation(); onTriggerAlternativesSearch(); }}
              className={`w-full py-4 rounded-2xl border font-black uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-[0.98] flex-none ${isDark ? 'bg-blue-600 border-blue-500 text-white shadow-2xl shadow-blue-600/30 hover:bg-blue-500' : 'bg-blue-600 border-blue-500 text-white shadow-xl'}`}
            >
              <RefreshCw className="w-4 h-4" />
              Scan for alternatives
            </button>
          )}
        </Modal>
      )}

      <div className="flex-none flex items-center justify-between text-[10px] font-black tracking-widest text-slate-500 uppercase mb-1.5">
        <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3 text-blue-500/50" /><span>{dateLabel}</span><Clock className="w-3 h-3 text-slate-600 ml-1" /><span>{timeRange}</span></div>
        {isLoading && (
          <div className="flex items-center gap-1.5 animate-in fade-in duration-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
            <span className="text-[8px] font-black tracking-[0.2em] text-blue-500">REFRESHING</span>
          </div>
        )}
      </div>
      <div className="flex-none flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-[70%]"><MapPin className="w-3 h-3 text-blue-500/50 flex-none" /><span className="truncate">{startLocation}</span><ArrowRight className="w-2.5 h-2.5 opacity-30 flex-none" /><span className="truncate">{endLocation}</span></div>
        {distance && (<div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 flex-none"><Bike className="w-2.5 h-2.5 text-blue-500" /><span className="tracking-tighter tabular-nums">{distance.toFixed(1)} KM</span></div>)}
      </div>

      {((optimizationAdvice && optimizationAdvice.length > 0) || (locationAdvice && (locationAdvice.length > 0 || isScanning)) || onToggleIntelligence) && (
        <div className="flex-none mb-2 flex gap-1.5 relative z-10">
          {optimizationAdvice && optimizationAdvice.length > 0 && (<button onClick={toggleRoute} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${showRoutePopup ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : actionBtnClass}`}><Sparkles className="w-2.5 h-2.5" />route</button>)}
          {(onTriggerAlternativesSearch || (locationAdvice && locationAdvice.length > 0)) && (<button onClick={toggleLocation} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${showLocationPopup ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : actionBtnClass}`}><Zap className="w-2.5 h-2.5" />{isScanning ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <MapIcon className="w-2.5 h-2.5" />}location</button>)}
          {onToggleIntelligence && (
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleIntelligence(); }} 
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl border transition-all ${isIntelligenceExpanded ? 'bg-blue-600 border-blue-500 shadow-lg' : actionBtnClass}`}
            >
              <span className={`text-[18px] font-black italic tracking-tight ${isIntelligenceExpanded ? 'text-white' : 'text-blue-500'}`}>
                IQ
              </span>
            </button>
          )}
        </div>
      )}

      <div className="flex-none flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex flex-col relative">
          <div className="flex items-center gap-4">
            {getWeatherIcon(condition?.condition || 'Cloudy', !!condition?.isDark, "w-10 h-10")}
            <button onClick={toggleTemp} className="flex items-baseline gap-1 group transition-all active:opacity-70 text-left">
              <span className={`text-4xl sm:text-5xl font-black leading-none tracking-tighter transition-colors ${isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'}`}>{primaryTemp}°</span><span className="text-lg font-bold text-slate-500 tracking-tighter ml-1">C</span>
            </button>
          </div>
        </div>
        <div className="relative">
          <button onClick={toggleLights} className={`rounded-[1.25rem] p-2.5 flex items-center gap-3 min-w-[110px] transition-all active:scale-[0.98] ${isDark ? 'bg-[#161920] border border-white/5 hover:bg-[#1c2029]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
            <Lightbulb className={`w-5 h-5 transition-all ${condition?.isDark ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'text-slate-300'}`} />
            <div className="flex flex-col text-left"><span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Lights</span><span className={`text-[10px] font-black uppercase ${condition?.isDark ? 'text-yellow-500' : 'text-slate-500'}`}>{condition?.isDark ? 'Required' : 'Optional'}</span></div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-grow min-h-0">
        <button onClick={toggleWind} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border relative transition-all duration-300 active:scale-[0.98] ${showWindDetails ? 'ring-1 ring-blue-500/50' : ''} ${blockBgClass}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">WIND</span></div>
          <div className="flex items-center justify-between">{showRawWind ? (<span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{primaryWindSpeed} <span className="text-[9px] opacity-60">KM/H</span> {getCardinal(primaryWindDir)}</span>) : (<span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${wind.color}`}>{wind.label}</span>)}<div className={showRawWind ? (isDark ? 'text-blue-400' : 'text-blue-600') : wind.color}>{wind.icon}</div></div>
        </button>

        <button onClick={toggleSurface} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border relative transition-all duration-300 active:scale-[0.98] ${showSurfaceDetails ? 'ring-1 ring-blue-500/50' : ''} ${blockBgClass}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">SURFACE</span></div>
          <div className="flex items-center justify-between"><span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${surface.color}`}>{surface.label}</span><div className={surface.color}>{surface.icon}</div></div>
        </button>

        <button onClick={toggleIce} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border relative transition-all duration-300 active:scale-[0.98] ${showIceDetails ? 'ring-1 ring-red-500/50' : ''} ${blockBgClass}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">ICE RISK</span></div>
          <div className="flex items-center justify-between"><span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${iceInfo.color}`}>{iceInfo.label}</span><div className={iceInfo.color}>{iceInfo.icon}</div></div>
        </button>

        <button onClick={toggleScore} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border relative transition-all duration-300 active:scale-[0.98] ${showScoreDetails ? 'ring-1 ring-blue-500/50' : ''} ${blockBgClass}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">SCORE</span></div>
          <div className="flex items-center justify-between"><span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${scoreColor}`}>{Math.round(safetyScore ?? 0)}%</span><div className={scoreColor}><Bike className="w-5.5 h-5.5" /></div></div>
        </button>
      </div>
    </div>
  );
};
