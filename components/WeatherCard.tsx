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
  CloudLightning,
  SlidersHorizontal,
  ChevronLeft,
  Check
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
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
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
  const maxWidth = size === 'lg' ? 'max-w-[380px]' : 'max-w-[340px]';
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div 
        className={`relative w-full ${maxWidth} h-[80dvh] max-h-[640px] rounded-[2rem] shadow-2xl p-0 border animate-in zoom-in-95 fade-in duration-200 overflow-hidden flex flex-col ${isDark ? 'bg-[#0f1115] border-white/20' : 'bg-white border-slate-200'}`}
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
  const [showLocationSettings, setShowLocationSettings] = useState(false);

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

  const toggleLocation = (e?: React.MouseEvent) => {
    e?.preventDefault(); e?.stopPropagation();
    if (showLocationPopup) {
      setShowLocationPopup(false);
      setShowLocationSettings(false);
    } else {
      closeAllPopups();
      setShowLocationPopup(true);
      // Automatically trigger scan when opening locations
      if (onTriggerAlternativesSearch) {
        onTriggerAlternativesSearch();
      }
    }
  };

  const toggleWind = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showWindDetails) setShowWindDetails(false); else { closeAllPopups(); setShowWindDetails(true); } };
  const toggleRoute = (e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); if (showRoutePopup) setShowRoutePopup(false); else { closeAllPopups(); setShowRoutePopup(true); } };
  
  const actionBtnClass = isDark 
    ? 'bg-[#1a1d24] border-blue-500/20 text-blue-400 hover:bg-[#20252d]' 
    : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 shadow-sm';

  const wind = useMemo(() => {
    const impact = condition?.headwindImpact ?? 0;
    const speed = condition?.windSpeed ?? 0;
    if (showRawWind) return { label: 'COMPASS', color: 'text-blue-400', icon: <Compass className="w-5.5 h-5.5" /> };
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
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {getWeatherIcon(condition?.condition || 'Cloudy', !!condition?.isDark, "w-6 h-6")}
            <div className="flex items-center gap-4 sm:gap-6"><span className={`text-xl sm:text-2xl font-black leading-none tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{primaryTemp}°</span></div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-black text-[10px] sm:text-[11px] border tracking-wider transition-colors ${isDark ? 'bg-[#1a1d24] border-white/5' : 'bg-slate-50 border-slate-200'} ${showRawWind ? (isDark ? 'text-blue-400' : 'text-blue-600') : wind.color}`}>{showRawWind ? `${primaryWindSpeed} ${getCardinal(primaryWindDir)}` : wind.label} <Wind className="w-4 h-4" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full rounded-[2rem] border overflow-visible flex flex-col p-4 sm:p-5 shadow-2xl transition-all relative ${isDark ? 'border-white/5 bg-[#0a0c10]' : 'bg-white border-slate-200'}`}>
      
      {showLocationPopup && (
        <Modal onClose={() => setShowLocationPopup(false)} isDark={isDark} size="lg">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Tighter Header */}
            <div className={`flex items-center justify-between p-4 border-b flex-none ${isDark ? 'border-white/5 bg-[#0a0c10]' : 'border-slate-100 bg-white'}`}>
              <div className="flex items-center gap-2.5">
                {showLocationSettings ? (
                  <button onClick={() => setShowLocationSettings(false)} className={`p-1.5 rounded-lg transition-all ${isDark ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <ChevronLeft className="w-4.5 h-4.5" />
                  </button>
                ) : (
                  <div className={`p-1.5 rounded-lg ${isDark ? 'bg-blue-600/10 text-blue-500' : 'bg-blue-50 text-blue-600'}`}>
                    <MapIcon className="w-4.5 h-4.5" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest leading-none">
                    {showLocationSettings ? 'SEARCH CONFIG' : 'ALTERNATIVE BASES'}
                  </span>
                  {!showLocationSettings && isScanning && (
                    <span className="text-[7px] font-black text-blue-500/50 uppercase tracking-[0.2em] mt-0.5 animate-pulse">Scanning Grid...</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!showLocationSettings && (
                  <button 
                    onClick={() => setShowLocationSettings(true)} 
                    className={`p-1.5 rounded-lg border transition-all ${isDark ? 'bg-slate-900 border-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                  >
                    <SlidersHorizontal className="w-4.5 h-4.5" />
                  </button>
                )}
                <button 
                  onClick={() => { setShowLocationPopup(false); setShowLocationSettings(false); }} 
                  className={`p-1.5 rounded-lg border transition-all ${isDark ? 'bg-slate-900 border-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* View Port */}
            <div className="flex-1 relative overflow-hidden">
              {/* Dense Settings View (Overlay) */}
              <div className={`absolute inset-0 z-20 flex flex-col p-5 transition-all duration-300 ease-in-out ${showLocationSettings ? 'translate-x-0' : 'translate-x-full'} ${isDark ? 'bg-[#0f1115]' : 'bg-slate-50'}`}>
                <div className="flex-1 space-y-6 overflow-y-auto hide-scrollbar">
                  {/* Max Distance with Integrated Value */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end px-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">MAX RADIUS</span>
                      <div className="flex items-center gap-1.5">
                         <span className={`text-[15px] font-black font-mono leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{searchCriteria?.maxDistance}</span>
                         <span className="text-[8px] font-black text-blue-500 uppercase">KM</span>
                      </div>
                    </div>
                    <div className="relative pt-2 pb-1">
                      <input 
                        type="range" min="50" max="500" step="50" value={searchCriteria?.maxDistance} 
                        onChange={(e) => setSearchCriteria?.({ ...searchCriteria!, maxDistance: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-blue-600/20 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between mt-2 text-[7px] font-black text-slate-500 uppercase tracking-[0.1em]">
                        <span>50KM</span>
                        <span>250KM</span>
                        <span>500KM</span>
                      </div>
                    </div>
                  </div>

                  {/* Priority Sort */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">PRIORITY VECTOR</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'score', label: 'Score' },
                        { id: 'distance', label: 'Dist' },
                        { id: 'hour', label: 'Time' }
                      ].map((opt) => (
                        <button 
                          key={opt.id} onClick={() => setSearchCriteria?.({ ...searchCriteria!, sortBy: opt.id as any })}
                          className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${searchCriteria?.sortBy === opt.id ? 'bg-blue-600 border-blue-500 text-white shadow-md' : isDark ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}
                        >
                          <span className="text-[9px] font-black uppercase tracking-widest">{opt.label}</span>
                          {searchCriteria?.sortBy === opt.id && <div className="w-1 h-1 rounded-full bg-white mt-1" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mandatory Filters */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">HARD CONSTRAINTS</span>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => setSearchCriteria?.({ ...searchCriteria!, drySurface: !searchCriteria?.drySurface })}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${searchCriteria?.drySurface ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500' : isDark ? 'bg-white/5 border-white/5 text-slate-500' : 'bg-white border-slate-200 text-slate-600'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Droplets className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">DRY ONLY</span>
                        </div>
                        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${searchCriteria?.drySurface ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                          <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${searchCriteria?.drySurface ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                      </button>
                      <button 
                        onClick={() => setSearchCriteria?.({ ...searchCriteria!, noIce: !searchCriteria?.noIce })}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${searchCriteria?.noIce ? 'bg-red-600/10 border-red-500/30 text-red-500' : isDark ? 'bg-white/5 border-white/5 text-slate-500' : 'bg-white border-slate-200 text-slate-600'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Snowflake className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">NO ICE</span>
                        </div>
                        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${searchCriteria?.noIce ? 'bg-red-500' : 'bg-slate-700'}`}>
                          <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${searchCriteria?.noIce ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowLocationSettings(false); onTriggerAlternativesSearch?.(); }}
                  className={`w-full mt-4 py-3 rounded-xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-[0.15em] shadow-lg transition-all active:scale-[0.98]`}
                >
                  RESCAN GRID
                </button>
              </div>

              {/* Tighter List View */}
              <div className="flex flex-col h-full">
                {isScanning && (
                  <div className={`flex-none p-4 pb-1 space-y-1.5`}>
                    <div className={`h-1 w-full rounded-full overflow-hidden relative ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                      <div className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ width: `${scanProgress}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-black font-mono">
                      <span className="text-blue-500 animate-pulse uppercase tracking-[0.1em]">Intelligence Core Scanning...</span>
                      <span className={isDark ? 'text-blue-400' : 'text-blue-700'}>{scanProgress}%</span>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-2">
                  {locationAdvice?.length ? locationAdvice.map((loc, idx) => (
                    <button key={idx} onClick={() => { onSelectLocationAdvice?.(loc); setShowLocationPopup(false); }} className={`group w-full p-3 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98] border ${isDark ? 'bg-black/30 border-white/5 hover:border-blue-500/30' : 'bg-white border-slate-200 hover:bg-blue-50 shadow-sm'}`}>
                      <div className="flex flex-col items-start gap-1 flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 w-full">
                          <span className={`text-[12px] font-black uppercase tracking-tight leading-none truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{loc.name.split(',')[0]}</span>
                          {loc.distanceFromTrainingCenter !== undefined && (
                            <span className={`px-1 py-0.5 rounded bg-blue-500/10 text-[7px] font-black uppercase tracking-[0.1em] whitespace-nowrap flex-none ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                              {Math.round(loc.distanceFromTrainingCenter)}KM
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[7px] font-black text-slate-500 uppercase">SCORE:</span>
                            <span className={`text-[10px] font-black ${getSubScoreColor(loc.score || 0)}`}>{Math.round(loc.score || 0)}%</span>
                          </div>
                          {loc.bestHour !== undefined && (
                            <div className="flex items-center gap-1">
                              <span className="text-[7px] font-black text-slate-500 uppercase">START:</span>
                              <span className={`text-[10px] font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{loc.bestHour.toString().padStart(2, '0')}:00</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <MapPin className="w-4 h-4 text-blue-500 transition-transform group-hover:scale-110" />
                    </button>
                  )) : (
                    !isScanning && <div className="py-16 text-center text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] opacity-30 flex flex-col items-center gap-3">
                      <MapIcon className="w-10 h-10 mb-1" />
                      Registry Empty
                    </div>
                  )}
                </div>

                <div className="p-4 pt-1 flex-none">
                  {!isScanning && onTriggerAlternativesSearch ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onTriggerAlternativesSearch(); }}
                      className={`w-full py-3 rounded-xl border font-black uppercase text-[10px] tracking-[0.1em] transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] ${isDark ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/20' : 'bg-blue-600 border-blue-500 text-white shadow-md'}`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Manual Refresh
                    </button>
                  ) : isScanning ? (
                    <div className={`w-full py-3 rounded-xl border text-center font-black uppercase text-[9px] tracking-[0.1em] opacity-50 ${isDark ? 'bg-slate-900 border-white/5 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      Processing Telemetry Grid...
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Main Card UI */}
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

      {((optimizationAdvice && optimizationAdvice.length > 0) || onTriggerAlternativesSearch || (locationAdvice && locationAdvice.length > 0) || onToggleIntelligence) && (
        <div className="flex-none mb-2 flex gap-1.5 relative z-10">
          {optimizationAdvice && optimizationAdvice.length > 0 && (<button onClick={toggleRoute} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${showRoutePopup ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : actionBtnClass}`}><Sparkles className="w-2.5 h-2.5" />route</button>)}
          {(onTriggerAlternativesSearch || (locationAdvice && locationAdvice.length > 0)) && (<button onClick={toggleLocation} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${showLocationPopup ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : actionBtnClass}`}><Zap className="w-2.5 h-2.5" />{isScanning ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <MapIcon className="w-2.5 h-2.5" />}location</button>)}
          {onToggleIntelligence && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleIntelligence(); }} className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl border transition-all ${isIntelligenceExpanded ? 'bg-blue-600 border-blue-500 shadow-lg' : actionBtnClass}`}>
              <span className={`text-[18px] font-black italic tracking-tight ${isIntelligenceExpanded ? 'text-white' : 'text-blue-500'}`}>IQ</span>
            </button>
          )}
        </div>
      )}

      <div className="flex-none flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex flex-col relative">
          <div className="flex items-center gap-4">
            {getWeatherIcon(condition?.condition || 'Cloudy', !!condition?.isDark, "w-10 h-10")}
            <button onClick={() => setShowTempDetails(true)} className="flex items-baseline gap-1 group transition-all active:opacity-70 text-left">
              <span className={`text-4xl sm:text-5xl font-black leading-none tracking-tighter transition-colors ${isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'}`}>{primaryTemp}°</span><span className="text-lg font-bold text-slate-500 tracking-tighter ml-1">C</span>
            </button>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowLightsDetails(true)} className={`rounded-[1.25rem] p-2.5 flex items-center gap-3 min-w-[110px] transition-all active:scale-[0.98] ${isDark ? 'bg-[#161920] border border-white/5 hover:bg-[#1c2029]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
            <Lightbulb className={`w-5 h-5 transition-all ${condition?.isDark ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'text-slate-300'}`} />
            <div className="flex flex-col text-left"><span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Lights</span><span className={`text-[10px] font-black uppercase ${condition?.isDark ? 'text-yellow-500' : 'text-slate-500'}`}>{condition?.isDark ? 'Required' : 'Optional'}</span></div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-grow min-h-0">
        <button onClick={toggleWind} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border transition-all duration-300 active:scale-[0.98] ${isDark ? 'bg-[#0f1115] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">WIND</span></div>
          <div className="flex items-center justify-between">{showRawWind ? (<span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{primaryWindSpeed} <span className="text-[9px] opacity-60">KM/H</span> {getCardinal(primaryWindDir)}</span>) : (<span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${wind.color}`}>{wind.label}</span>)}<div className={showRawWind ? (isDark ? 'text-blue-400' : 'text-blue-600') : wind.color}>{wind.icon}</div></div>
        </button>
        <button onClick={() => setShowSurfaceDetails(true)} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border transition-all duration-300 active:scale-[0.98] ${isDark ? 'bg-[#0f1115] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">SURFACE</span></div>
          <div className="flex items-center justify-between"><span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${surface.color}`}>{surface.label}</span><div className={surface.color}>{surface.icon}</div></div>
        </button>
        <button onClick={() => setShowIceDetails(true)} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border transition-all duration-300 active:scale-[0.98] ${isDark ? 'bg-[#0f1115] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">ICE RISK</span></div>
          <div className="flex items-center justify-between"><span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${iceInfo.color}`}>{iceInfo.label}</span><div className={iceInfo.color}>{iceInfo.icon}</div></div>
        </button>
        <button onClick={() => setShowScoreDetails(true)} className={`text-left rounded-[1.25rem] px-3.5 py-2.5 flex flex-col justify-center border transition-all duration-300 active:scale-[0.98] ${isDark ? 'bg-[#0f1115] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-0.5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">SCORE</span></div>
          <div className="flex items-center justify-between"><span className={`text-lg sm:text-[1.6rem] font-black tracking-tighter ${getSubScoreColor(safetyScore || 0)}`}>{Math.round(safetyScore ?? 0)}%</span><div className={getSubScoreColor(safetyScore || 0)}><Bike className="w-5.5 h-5.5" /></div></div>
        </button>
      </div>
    </div>
  );
};
