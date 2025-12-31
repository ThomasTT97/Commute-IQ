
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CommuteSettings, Coordinates, Language, TrainingState, LocationSuggestion, WeatherCondition } from './types'; 
import { BelgianLocation } from './locations';
import { DEFAULT_SETTINGS, TRANSLATIONS, BELGIAN_CITIES } from './constants';
import { BELGIAN_LOCATIONS } from './locations';
import { WeatherCard } from './components/WeatherCard';
import { WeeklyForecast } from './components/WeeklyForecast';
import { 
  getTelemetryBatch,
  getAIInsights,
  getCommuteRoadDistance, 
  fetchRawWeatherData, 
  aggregateRawWeather, 
  getStandardizedAdvice,
  calculateBearing,
  calculateDistance
} from './services/geminiService';
import { 
  Settings as SettingsIcon, 
  RefreshCw,
  Calendar,
  X,
  Zap,
  Info,
  ChevronDown,
  Sun,
  Moon,
  Clock,
  Database,
  Check,
  BrainCircuit,
  Eye,
  EyeOff,
  Search,
  Bike,
  Trophy,
  ArrowLeft,
  Home, 
  Navigation,
  MapPin,
  MoveUp
} from 'lucide-react';

const ROAD_DETOUR_FACTOR = 1.32;
const CACHE_KEY = 'commute_iq_pulse_cache_v2';
const AVG_TRAINING_SPEED = 28.5; // km/h

const getLocality = (address: string): string => {
  if (!address) return '---';
  const parts = address.split(',').map(p => p.trim());
  return (parts.length > 1 ? (parts.length >= 3 ? parts[1] : parts[0]) : address).replace(/^\d+\s+/, '').toUpperCase();
};

function shuffleArray<T>(array: T[]): T[] {
  let currentIndex: number = array.length; 
  let randomIndex: number;
  const newArray = [...array]; 
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [newArray[currentIndex], newArray[randomIndex]] = [
      newArray[randomIndex], newArray[currentIndex]];
  }
  return newArray;
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<CommuteSettings>(() => {
    const saved = localStorage.getItem('velo_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return { 
      ...DEFAULT_SETTINGS, 
      ...parsed,
      homeCoords: parsed.homeCoords || DEFAULT_SETTINGS.homeCoords,
      workCoords: parsed.workCoords || DEFAULT_SETTINGS.workCoords,
    };
  });

  const [pulseDataMap, setPulseDataMap] = useState<Record<number, any>>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    try {
      const parsed: Record<number, any> = JSON.parse(cached);
      const now = Date.now();
      const filtered: Record<number, any> = {};
      Object.keys(parsed).forEach((k) => {
        const key = Number(k);
        // Keep cache for 24h
        if (now - (parsed[key]?.lastUpdated || 0) < 24 * 60 * 60 * 1000) {
          filtered[key] = parsed[key];
        }
      });
      return filtered;
    } catch (e: any) {
      console.error("Failed to parse cached pulse data:", e);
      return {}; 
    }
  });
  
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'training'>('daily');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [expandedInfoItem, setExpandedInfoItem] = useState<string | null>(null);

  const [training, setTraining] = useState<TrainingState>(() => {
    const initialSettings: CommuteSettings = localStorage.getItem('velo_settings') ? JSON.parse(localStorage.getItem('velo_settings')!) : DEFAULT_SETTINGS;
    return {
      location: initialSettings.homeLocation || "Gent", 
      coords: initialSettings.homeCoords || { lat: 51.0543, lng: 3.7174 }, 
      distance: 40,
      dateOffset: 0,
      preferredDirection: 0
    };
  });
  const [trainingSearch, setTrainingSearch] = useState(() => {
    const initialSettings: CommuteSettings = localStorage.getItem('velo_settings') ? JSON.parse(localStorage.getItem('velo_settings')!) : DEFAULT_SETTINGS;
    return initialSettings.homeLocation || "Gent";
  });
  const [showTrainingSuggestions, setShowTrainingSuggestions] = useState(false);
  const [trainingData, setTrainingData] = useState<any>(null); 
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [manualStartHour, setManualStartHour] = useState<number | null>(null);

  const [homeSearch, setHomeSearch] = useState(settings.homeLocation);
  const [workSearch, setWorkSearch] = useState(settings.workLocation);
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [showWorkSuggestions, setShowWorkSuggestions] = useState(false);

  const getTarget = useCallback((timeStr: string, addDays = 0) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + addDays); return d;
  }, []);

  const nextCommuteInfo = useMemo(() => {
    const now = new Date();
    if (now < getTarget(settings.morningWindow[1])) return { type: 'morning' as const, offset: 0 };
    if (now < getTarget(settings.eveningWindow[1])) return { type: 'evening' as const, offset: 0 };
    return { type: 'morning' as const, offset: 1 };
  }, [settings.morningWindow, settings.eveningWindow, getTarget]);

  const [selectedDateOffset, setSelectedDateOffset] = useState<number>(nextCommuteInfo.offset);
  const [loading, setLoading] = useState(false);
  const [loadingOffsets, setLoadingOffsets] = useState<number[]>([]);

  const displayedDistance = useMemo(() => {
    if (settings.roadDistance) return settings.roadDistance;
    const crowFly = calculateDistance(settings.homeCoords, settings.workCoords);
    return crowFly * ROAD_DETOUR_FACTOR;
  }, [settings.roadDistance, settings.homeCoords, settings.workCoords]);

  const commuteSequence = useMemo(() => {
    const primaryType = nextCommuteInfo.type;
    const primaryOffset = nextCommuteInfo.offset;

    if (selectedDateOffset === primaryOffset) {
      return {
        primary: { type: primaryType, offset: primaryOffset },
        secondary: { 
          type: primaryType === 'morning' ? 'evening' as const : 'morning' as const, 
          offset: primaryType === 'morning' ? primaryOffset : primaryOffset + 1
        }
      };
    }
    return {
      primary: { type: 'morning' as const, offset: selectedDateOffset },
      secondary: { type: 'evening' as const, offset: selectedDateOffset }
    };
  }, [selectedDateOffset, nextCommuteInfo]);

  const t = TRANSLATIONS[settings.language || 'en'];
  const isDark = settings.theme === 'dark';

  const [editSettings, setEditSettings] = useState<CommuteSettings>(settings); 
  const initialSyncStarted = useRef(false);

  useEffect(() => {
    setEditSettings((prev: CommuteSettings) => ({ ...prev, theme: settings.theme }));
  }, [settings.theme]);

  useEffect(() => {
    setHomeSearch(settings.homeLocation);
    setWorkSearch(settings.workLocation);
  }, [settings.homeLocation, settings.workLocation]);

  useEffect(() => {
    if (settings.homeLocation && settings.homeCoords) {
      setTraining((prev: TrainingState) => ({
        ...prev,
        location: settings.homeLocation,
        coords: settings.homeCoords as Coordinates,
      }));
      setTrainingSearch(settings.homeLocation);
      setManualStartHour(null); 
    }
  }, [settings.homeLocation, settings.homeCoords]);

  /**
   * High-Efficiency Sync:
   * Fetches all 7 days of telemetry in ONE operation.
   * Updates state immediately so UI (7-day overview) is populated instantly.
   * AI Interpretation is backgrounded as a separate pass.
   */
  const syncFullWeek = useCallback(async (currentSettings: CommuteSettings, isSilent = false) => {
    const allOffsets = [0, 1, 2, 3, 4, 5, 6];
    if (!isSilent) setLoading(true);
    setLoadingOffsets(allOffsets);
    
    try {
      // ONE call for the entire week (Open-Meteo returns 7 days of forecast)
      const telemetryBatch = await getTelemetryBatch(currentSettings, allOffsets);
      
      setPulseDataMap(prev => {
        const next = { ...prev, ...telemetryBatch };
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });

      if (!isSilent) setLoading(false);
      setLoadingOffsets([]); // Telemetry is done, UI is active

      // PASS 2: AI INSIGHTS (Parallel to UI usage)
      if (!currentSettings.disableAI) {
        try {
          const aiInsights = await getAIInsights(currentSettings, telemetryBatch);
          setPulseDataMap(prev => {
            const next = { ...prev };
            Object.keys(aiInsights).forEach(o => {
              const offset = Number(o);
              if (next[offset]) {
                next[offset] = {
                  ...next[offset],
                  isEnhanced: true,
                  weather: {
                    ...next[offset].weather,
                    morning: { ...next[offset].weather.morning, surfaceReason: aiInsights[offset].morning },
                    evening: { ...next[offset].weather.evening, surfaceReason: aiInsights[offset].evening }
                  }
                };
              }
            });
            localStorage.setItem(CACHE_KEY, JSON.stringify(next));
            return next;
          });
        } catch (aiErr) {
          console.error("Background AI sync failed", aiErr);
        }
      }
    } catch (err: any) {
      console.error("Full week sync failed:", err);
    } finally {
      setLoadingOffsets([]);
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialSyncStarted.current) {
      initialSyncStarted.current = true;
      
      const checkNeedsSync = () => {
        const allOffsets = [0, 1, 2, 3, 4, 5, 6];
        const now = Date.now();
        return allOffsets.some(offset => {
          const cached = pulseDataMap[offset];
          if (!cached) return true;
          const ageHours = (now - (cached.lastUpdated || 0)) / (1000 * 60 * 60);
          return ageHours > 1; // Sync if older than 1 hour
        });
      };

      if (checkNeedsSync()) {
        syncFullWeek(settings, true);
      }
    }
  }, [syncFullWeek, settings, pulseDataMap]);

  const syncTraining = useCallback(async () => {
    setTrainingLoading(true);
    try {
      const rawCurrentLocation = await fetchRawWeatherData(training.coords);
      const dayIdx = training.dateOffset * 24;
      const durationHours = training.distance / AVG_TRAINING_SPEED;
      const durationInt = Math.ceil(durationHours);
      
      const sunTimesCurrent = {
        sunrise: rawCurrentLocation.daily?.sunrise?.[training.dateOffset] || "07:00",
        sunset: rawCurrentLocation.daily?.sunset?.[training.dateOffset] || "20:00"
      };

      const scanWindowsCurrent = [];
      for (let hour = 3; hour <= 21; hour++) {
        const startTimeStr = `${hour.toString().padStart(2, '0')}:00`;
        const endHourVal = hour + durationInt;
        const endTimeStr = `${endHourVal.toString().padStart(2, '0')}:00`;
        const window: [string, string] = [startTimeStr, endTimeStr];
        
        const startIndex = dayIdx + hour;
        const endIndex = dayIdx + endHourVal;
        
        const slice: any = {};
        if (rawCurrentLocation.hourly) {
          Object.keys(rawCurrentLocation.hourly).forEach((k) => { 
            if (Array.isArray(rawCurrentLocation.hourly[k]) && startIndex <= endIndex && endIndex < rawCurrentLocation.hourly[k].length) {
              slice[k] = (rawCurrentLocation.hourly[k] as number[]).slice(startIndex, endIndex + 1);
            }
          });
        }

        const pastTemps = (rawCurrentLocation.hourly?.temperature_2m || []).slice(Math.max(0, startIndex - 6), startIndex);
        const minPastTemp = pastTemps.length ? Math.min(...pastTemps) : 10;

        const condition = aggregateRawWeather(slice, 0, true, settings, sunTimesCurrent, minPastTemp, window);
        scanWindowsCurrent.push({ startHour: hour, condition, window, score: condition.score });
      }

      let finalSlot: any = null;
      if (manualStartHour !== null) {
        finalSlot = scanWindowsCurrent.find(w => w.startHour === manualStartHour) || scanWindowsCurrent[0];
      } else if (scanWindowsCurrent.length > 0) {
        finalSlot = scanWindowsCurrent.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        setManualStartHour(finalSlot.startHour);
      }

      if (finalSlot) {
        finalSlot.condition.surfaceReason = getStandardizedAdvice(finalSlot.condition);
        const windDirFrom = finalSlot.condition.windDirection; 
        const targetBearing = windDirFrom;
        const routeTargetDist = training.distance * 0.4;
        const routeSuggestions = BELGIAN_LOCATIONS
          .map(loc => {
            const distFromCenter = calculateDistance(training.coords, { lat: loc.lat, lng: loc.lng });
            const bearing = calculateBearing(training.coords, { lat: loc.lat, lng: loc.lng });
            const bearingDiff = Math.abs(bearing - targetBearing);
            const normalizedDiff = Math.min(bearingDiff, 360 - bearingDiff);
            const distDiff = Math.abs(distFromCenter - routeTargetDist);
            const score = distDiff + (normalizedDiff / 5);
            return { name: loc.name, distFromCenter, normalizedDiff, score };
          })
          .filter(loc => loc.distFromCenter > 2 && loc.normalizedDiff < 45)
          .sort((a, b) => a.score - b.score)
          .reduce((acc: any[], curr) => {
             if (!acc.find(a => a.name === curr.name)) acc.push(curr);
             return acc;
          }, [])
          .slice(0, 3);

        const currentLocationBestScore = scanWindowsCurrent.reduce((maxScore, window) => Math.max(maxScore, window.score), 0); 
        const userHomeOrTrainingCoords = settings.homeCoords || training.coords;

        const nearbyCandidateLocations = BELGIAN_LOCATIONS.filter(loc => {
          const dist = calculateDistance(userHomeOrTrainingCoords, { lat: loc.lat, lng: loc.lng });
          return dist >= 40 && dist <= 80 && loc.name !== training.location;
        });

        const candidatesToProcess = shuffleArray(nearbyCandidateLocations).slice(0, 50); 
        const betterLocationSuggestions: LocationSuggestion[] = [];

        for (const candidateLoc of candidatesToProcess) {
          let candidateRaw: any;
          try {
            candidateRaw = await fetchRawWeatherData({ lat: candidateLoc.lat, lng: candidateLoc.lng });
          } catch (e: any) { continue; }

          const candidateSunTimes = {
            sunrise: candidateRaw.daily?.sunrise?.[training.dateOffset] || "07:00",
            sunset: candidateRaw.daily?.sunset?.[training.dateOffset] || "20:00"
          };

          const candidateScanWindows = [];
          for (let hour = 3; hour <= 21; hour++) {
            const startIndex = dayIdx + hour;
            const endIndex = dayIdx + hour + durationInt;
            const slice: any = {};
            if (candidateRaw.hourly) {
              Object.keys(candidateRaw.hourly).forEach((k) => {
                if (Array.isArray(candidateRaw.hourly[k]) && startIndex <= endIndex && endIndex < candidateRaw.hourly[k].length) {
                  slice[k] = (candidateRaw.hourly[k] as number[]).slice(startIndex, endIndex + 1);
                }
              });
            }
            const pastTemps = (candidateRaw.hourly?.temperature_2m || []).slice(Math.max(0, startIndex - 6), startIndex);
            const minPastTemp = pastTemps.length ? Math.min(...pastTemps) : 10;
            const cond = aggregateRawWeather(slice, training.preferredDirection, true, settings, candidateSunTimes, minPastTemp, [`${hour}:00`, `${hour+durationInt}:00`]);
            candidateScanWindows.push({ score: cond.score });
          }

          if (candidateScanWindows.length > 0) {
            const bestCandidateScore = Math.max(...candidateScanWindows.map(w => w.score));
            if (bestCandidateScore > currentLocationBestScore) { 
              betterLocationSuggestions.push({ 
                name: candidateLoc.name, 
                lat: candidateLoc.lat,
                lng: candidateLoc.lng,
                distanceFromHome: calculateDistance(userHomeOrTrainingCoords, { lat: candidateLoc.lat, lng: candidateLoc.lng }),
                score: bestCandidateScore 
              });
            }
          }
        }

        finalSlot.optimizationAdvice = routeSuggestions.map(s => ({ name: s.name, distanceFromTrainingCenter: s.distFromCenter, lat: training.coords.lat, lng: training.coords.lng }));
        finalSlot.locationAdvice = betterLocationSuggestions
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 3);
        setTrainingData(finalSlot);
      }
    } catch (e: any) { console.error(e); } finally { setTrainingLoading(false); }
  }, [training, settings, manualStartHour]);

  useEffect(() => {
    if (viewMode === 'training') syncTraining();
  }, [viewMode, training.location, training.distance, training.dateOffset, syncTraining]);

  const handleSave = async () => {
    setLoading(true);
    let roadDistance = editSettings.roadDistance;
    const locationChanged = editSettings.homeLocation !== settings.homeLocation || editSettings.workLocation !== settings.workLocation;
    if (locationChanged) {
      try {
        const dist = await getCommuteRoadDistance(editSettings.homeLocation, editSettings.workLocation);
        if (dist) roadDistance = dist;
      } catch (e: any) { }
    }
    const updated: CommuteSettings = { ...editSettings, roadDistance }; 
    setSettings(updated);
    localStorage.setItem('velo_settings', JSON.stringify(updated));
    setIsSettingsOpen(false);
    if (locationChanged || editSettings.disableAI !== settings.disableAI) { 
      setPulseDataMap({});
      localStorage.removeItem(CACHE_KEY);
      syncFullWeek(updated);
    } else {
      setLoading(false);
    }
  };

  const handleImmediateThemeChange = (newTheme: 'dark' | 'light') => {
    setSettings((prev: CommuteSettings) => ({ ...prev, theme: newTheme }));
    setEditSettings((prev: CommuteSettings) => ({ ...prev, theme: newTheme }));
  };

  const getDayLabel = (offset: number) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return {
      name: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      num: d.getDate(),
      month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
    };
  };

  const activeDayLabels = getDayLabel(selectedDateOffset);

  const primaryData = useMemo(() => {
    const config = commuteSequence.primary;
    const isMorning = config.type === 'morning';
    const dayPulse = pulseDataMap[config.offset];
    const condition = dayPulse?.weather?.[isMorning ? 'morning' : 'evening'] ?? null;
    const labels = getDayLabel(config.offset);

    return {
      label: isMorning ? t.morning : t.evening,
      timeRange: isMorning ? settings.morningWindow.join(' - ') : settings.eveningWindow.join(' - '),
      startLocation: getLocality(isMorning ? settings.homeLocation : settings.workLocation),
      endLocation: getLocality(isMorning ? settings.workLocation : settings.homeLocation),
      condition,
      score: condition?.score,
      dateLabel: `${labels.name} ${labels.num} ${labels.month}`,
    };
  }, [commuteSequence.primary, pulseDataMap, settings, t]);

  const secondaryData = useMemo(() => {
    const config = commuteSequence.secondary;
    const isMorning = config.type === 'morning';
    const dayPulse = pulseDataMap[config.offset];
    const condition = dayPulse?.weather?.[isMorning ? 'morning' : 'evening'] ?? null;
    const labels = getDayLabel(config.offset);
    return {
      label: isMorning ? t.morning : t.evening,
      timeRange: isMorning ? settings.morningWindow.join(' - ') : settings.eveningWindow.join(' - '),
      startLocation: getLocality(isMorning ? settings.homeLocation : settings.workLocation),
      endLocation: getLocality(isMorning ? settings.workLocation : settings.homeLocation),
      condition,
      score: condition?.score,
      dateLabel: `${labels.name} ${labels.num} ${labels.month}`,
    };
  }, [commuteSequence.secondary, pulseDataMap, settings, t]);

  const AccordionItem = ({ id, title, content }: { id: string, title: string, content: string }) => (
    <div className={`border rounded-xl transition-all overflow-hidden ${isDark ? 'border-white/5' : 'border-slate-200'} ${expandedInfoItem === id ? 'bg-blue-500/5 ring-1 ring-blue-500/20' : isDark ? 'bg-slate-900/30' : 'bg-slate-50'}`}>
      <button 
        onClick={() => setExpandedInfoItem(expandedInfoItem === id ? null : id)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-blue-500 transition-transform ${expandedInfoItem === id ? 'rotate-180' : ''}`} />
      </button>
      {expandedInfoItem === id && (
        <div className="px-4 pb-4 text-[12px] text-slate-400 leading-relaxed font-medium animate-in slide-in-from-top-1 duration-200 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );

  const filterLocations = (query: string) => {
    if (query.length < 2) return [];
    const filtered = BELGIAN_LOCATIONS.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
    const unique = filtered.filter((loc, index, self) =>
      index === self.findIndex((t) => t.name === loc.name)
    );
    return unique.slice(0, 5);
  };

  const handleSelectSuggestion = (type: 'home' | 'work' | 'training', loc: BelgianLocation) => {
    if (type === 'home') {
      setEditSettings((prev: CommuteSettings) => ({ ...prev, homeLocation: loc.name, homeCoords: { lat: loc.lat, lng: loc.lng } }));
      setHomeSearch(loc.name);
      setShowHomeSuggestions(false);
    } else if (type === 'work') {
      setEditSettings((prev: CommuteSettings) => ({ ...prev, workLocation: loc.name, workCoords: { lat: loc.lat, lng: loc.lng } }));
      setWorkSearch(loc.name);
      setShowWorkSuggestions(false);
    } else if (type === 'training') {
      setTraining((prev: TrainingState) => ({ ...prev, location: loc.name, coords: { lat: loc.lat, lng: loc.lng } }));
      setTrainingSearch(loc.name);
      setShowTrainingSuggestions(false);
      setManualStartHour(null); 
    }
  };

  const handleSetTrainingToHome = useCallback(() => {
    if (settings.homeLocation && settings.homeCoords) {
      setTraining((prev: TrainingState) => ({
        ...prev,
        location: settings.homeLocation,
        coords: settings.homeCoords as Coordinates,
      }));
      setTrainingSearch(settings.homeLocation);
      setManualStartHour(null); 
      setShowTrainingSuggestions(false);
    }
  }, [settings.homeLocation, settings.homeCoords]);

  const handleSelectLocationAdvice = useCallback((loc: BelgianLocation) => {
    setTraining((prev: TrainingState) => ({ ...prev, location: loc.name, coords: { lat: loc.lat, lng: loc.lng } }));
    setTrainingSearch(loc.name);
    setManualStartHour(null);
  }, []);

  const isCurrentDayEnhanced = useMemo(() => {
    const pulse = pulseDataMap[selectedDateOffset];
    return pulse?.isEnhanced ?? false;
  }, [pulseDataMap, selectedDateOffset]);

  return (
    <div className={`h-full w-full flex flex-col font-sans overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#05070a] text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
      <header className="flex-none px-6 py-2 flex items-center justify-between z-50 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button 
          onClick={() => setIsInfoOpen(true)}
          className="flex items-center gap-2 select-none cursor-pointer group"
          aria-label="Commute IQ Information"
        >
          <span className={`text-2xl font-bold tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>Commute</span>
          <span className="text-3xl font-black italic text-blue-500">IQ</span>
          <Info className={`w-4 h-4 ml-1 transition-colors ${isDark ? 'text-slate-500 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-blue-600'}`} />
        </button>
        
        <div className="flex items-center gap-2 relative">
          {viewMode !== 'training' ? (
            <button 
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className={`flex items-center gap-2 px-3 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                isDateDropdownOpen ? 'bg-blue-600 border-blue-500 text-white' : isDark ? 'bg-slate-900/50 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <Calendar className="w-3 text-blue-500" />
              <div className="flex flex-col items-center leading-[0.9]">
                <span className="text-[9px]">{selectedDateOffset === 0 ? 'TODAY' : `${activeDayLabels.name} ${activeDayLabels.num}`}</span>
                <span className="text-[9px] opacity-60 font-bold tracking-tight">{activeDayLabels.month}</span>
              </div>
            </button>
          ) : (
            <div className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 text-[7px] font-black uppercase tracking-widest ${isDark ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
              <Trophy className="w-2 h-2" />
              Training
            </div>
          )}

          {isDateDropdownOpen && viewMode !== 'training' && (
            <div className={`absolute top-11 right-0 w-48 border rounded-2xl shadow-2xl z-[100] p-1.5 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
              {[0, 1, 2, 3, 4, 5, 6].map(o => {
                const l = getDayLabel(o);
                const isSelected = selectedDateOffset === o;
                return (
                  <button 
                    key={o}
                    onClick={() => { setSelectedDateOffset(o); setViewMode('daily'); setIsDateDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-tight transition-colors ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span>{o === 0 ? 'TODAY' : `${l.name} ${l.num} ${l.month}`}</span>
                    {isSelected && <Check className="w-2.5 h-2.5" />}
                  </button>
                );
              })}
              <div className={`h-px my-1.5 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />
              <button 
                onClick={() => { setViewMode('weekly'); setIsDateDropdownOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-500/10"
              >
                <Database className="w-3 h-3" />
                7-Day Overview
              </button>
            </div>
          )}
          
          <div className={`flex items-center gap-1.5 p-1.5 rounded-xl border ${isDark ? 'bg-slate-900/30 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            <button onClick={() => viewMode === 'training' ? syncTraining() : syncFullWeek(settings)} className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-lg">
              <RefreshCw className={`w-4.5 h-4.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-lg">
              <SettingsIcon className="w-4.5 h-4.5 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-3 max-w-md mx-auto w-full min-h-0 overflow-y-auto relative">
        {viewMode === 'daily' && (
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex-[3] min-h-0">
              <WeatherCard 
                {...primaryData} 
                distance={displayedDistance} 
                safetyScore={primaryData.score} 
                theme={settings.theme} 
              />
            </div>
            
            <button 
              onClick={() => setIsInfoOpen(true)}
              className={`flex-none border rounded-[1.25rem] p-4 flex flex-col gap-1.5 active:scale-[0.98] transition-all ${isDark ? 'bg-blue-500/5 border-blue-500/20 shadow-lg shadow-blue-500/5' : 'bg-white border-blue-100 shadow-sm'}`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Zap className={`w-3.5 h-3.5 ${isCurrentDayEnhanced ? 'text-blue-500' : 'text-slate-500'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isCurrentDayEnhanced ? 'text-blue-500' : 'text-slate-500'}`}>
                    {isCurrentDayEnhanced ? 'Commute Intelligence' : 'Basic Telemetry'}
                  </span>
                </div>
                {!isCurrentDayEnhanced && !settings.disableAI && (
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-2.5 h-2.5 text-blue-400 animate-spin" />
                    <span className="text-[7px] font-black text-blue-400 uppercase">Interpretation Active</span>
                  </div>
                )}
              </div>
              <p className={`text-[13px] font-medium leading-[1.4] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {primaryData.condition?.surfaceReason || (loadingOffsets.length > 0 ? "Connecting to weather satellite..." : "Processing telemetry for tactical riding advice...")}
              </p>
            </button>

            <div className="flex-[1] min-h-0">
              <WeatherCard compact {...secondaryData} safetyScore={secondaryData.score} theme={settings.theme} />
            </div>
          </div>
        )}

        {viewMode === 'weekly' && (
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
            <WeeklyForecast 
              pulseDataMap={pulseDataMap} 
              loadingOffsets={loadingOffsets}
              theme={settings.theme} 
              onSelectDay={(offset: number) => { setSelectedDateOffset(offset); setViewMode('daily'); }} 
            />
          </div>
        )}

        {viewMode === 'training' && (
          <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto hide-scrollbar pb-6">
            <button 
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <ArrowLeft className="w-3 h-3" />
              Return to Commute
            </button>

            <div className={`rounded-2xl border p-3 flex flex-col gap-2.5 ${isDark ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 relative">
                  <label className="text-[8px] font-bold uppercase text-slate-500 tracking-widest">Training Area</label>
                  <div className="relative flex items-center">
                    <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-500" />
                    <input 
                      type="text" 
                      value={trainingSearch} 
                      onFocus={() => setShowTrainingSuggestions(true)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTrainingSearch(e.target.value); setShowTrainingSuggestions(true); }}
                      className={`w-full rounded-lg pl-6 pr-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                    />
                    {trainingSearch && ( 
                      <button 
                        onClick={() => { setTrainingSearch(""); setTraining(prev => ({...prev, location: "", coords: { lat: 0, lng: 0 }})); }}
                        className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors z-20"
                        aria-label="Clear training area"
                      >
                        <X className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`} />
                      </button>
                    )}
                    <button 
                      onClick={handleSetTrainingToHome}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}
                      aria-label="Set training area to home location"
                    >
                      <Home className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {showTrainingSuggestions && filterLocations(trainingSearch).length > 0 && (
                     <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-lg overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/20' : 'bg-white border-slate-300'}`}>
                       {filterLocations(trainingSearch).map(loc => (
                         <button key={loc.name} onClick={() => handleSelectSuggestion('training', loc)} className={`w-full px-3 py-2 text-left text-[11px] font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}>{loc.name}</button>
                       ))}
                     </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-bold uppercase text-slate-500 tracking-widest">Select Day</label>
                  <select 
                    value={training.dateOffset}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setTraining({...training, dateOffset: parseInt(e.target.value)}); setManualStartHour(null); }}
                    className={`w-full rounded-lg px-2 py-1 text-[11px] font-bold outline-none border ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200'}`}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map(o => {
                      const l = getDayLabel(o);
                      return <option key={o} value={o}>{o === 0 ? 'TODAY' : `${l.name} ${l.num}`}</option>
                    })}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[8px] font-bold uppercase text-slate-500 tracking-widest">Distance & Duration</label>
                  <div className="flex gap-2 items-baseline">
                    <span className="text-[10px] font-black text-blue-500">{training.distance} KM</span>
                    <span className="text-[7px] font-bold text-slate-500 uppercase">~{(training.distance / AVG_TRAINING_SPEED).toFixed(1)}H</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="150" 
                  step="5"
                  value={training.distance} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTraining({...training, distance: parseInt(e.target.value)}); setManualStartHour(null); }}
                  className="w-full h-1 bg-blue-500/20 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>

            {trainingData ? (
              <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div className={`p-2.5 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-blue-600/10 border-blue-500/20 shadow-lg shadow-blue-500/5' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Session Window</span>
                    <div className="flex items-center gap-1.5">
                       <Clock className="w-3 h-3 text-blue-500" />
                       <span className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{trainingData.window.join(' - ')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-500 uppercase">Training Score</span>
                    <span className={`text-xl font-black ${trainingData.score > 70 ? 'text-emerald-500' : 'text-orange-500'}`}>{Math.round(trainingData.score)}%</span>
                  </div>
                </div>

                <div className={`px-3 py-2 rounded-2xl border flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                   <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Adjust Start Time</span>
                      <span className="text-[10px] font-black text-blue-500">{manualStartHour?.toString().padStart(2, '0')}:00</span>
                   </div>
                   <input 
                    type="range" 
                    min="3" 
                    max="21" 
                    step="1"
                    value={manualStartHour ?? 0} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualStartHour(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="flex-[5]">
                  <WeatherCard 
                    condition={trainingData.condition} 
                    timeRange={trainingData.window.join(' - ')}
                    dateLabel={getDayLabel(training.dateOffset).name + " SESSION"}
                    startLocation={training.location.toUpperCase()}
                    endLocation="TRAINING LOOP"
                    distance={training.distance}
                    safetyScore={trainingData.score}
                    theme={settings.theme}
                    showRawWind={true}
                    optimizationAdvice={trainingData.optimizationAdvice}
                    locationAdvice={trainingData.locationAdvice}
                    onSelectLocationAdvice={handleSelectLocationAdvice}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
                {trainingLoading ? <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /> : <Database className="w-8 h-8 text-slate-700" />}
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{trainingLoading ? "Searching for optimal window..." : "Select parameters to optimize session"}</p>
              </div>
            )}
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className={`fixed inset-0 z-[200] flex flex-col animate-in fade-in duration-300 ${isDark ? 'bg-[#05070a]' : 'bg-white'}`}>
          <div className="flex-1 max-w-md mx-auto w-full flex flex-col px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between pb-1.5">
              <h2 className={`text-xl font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}><X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-900'}`} /></button>
            </div>
            
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto hide-scrollbar pb-4">
               <div className="flex flex-col gap-1.5">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">System Appearance</label>
                 <div className={`flex rounded-2xl p-1 border transition-all ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                   <button 
                     onClick={() => handleImmediateThemeChange('light')}
                     className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${settings.theme === 'light' ? 'bg-white text-blue-600 shadow-lg shadow-blue-500/10 border border-blue-500/10' : 'text-slate-500'}`}
                   >
                     <Sun className="w-4 h-4" />
                     Light
                   </button>
                   <button 
                     onClick={() => handleImmediateThemeChange('dark')}
                     className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${settings.theme === 'dark' ? 'bg-slate-800 text-blue-400 shadow-lg shadow-black/20 border border-white/10' : 'text-slate-500'}`}
                   >
                     <Moon className="w-4 h-4" />
                     Dark
                   </button>
                 </div>
               </div>

               <div className="grid grid-cols-1 gap-3">
                 <div className="flex flex-col gap-1.5 relative">
                   <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Home Base</label>
                   <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Start typing Belgian city..."
                      value={homeSearch} 
                      onFocus={() => setShowHomeSuggestions(true)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setHomeSearch(e.target.value);
                        setEditSettings((prev: CommuteSettings) => ({...prev, homeLocation: e.target.value}));
                        setShowHomeSuggestions(true);
                      }} 
                      className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} 
                    />
                    {homeSearch && ( 
                      <button 
                        onClick={() => { setHomeSearch(""); setEditSettings(prev => ({...prev, homeLocation: "", homeCoords: undefined})); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"
                        aria-label="Clear home location"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                   </div>
                   {showHomeSuggestions && filterLocations(homeSearch).length > 0 && (
                     <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                       {filterLocations(homeSearch).map(loc => (
                         <button 
                           key={loc.name} 
                           onClick={() => handleSelectSuggestion('home', loc)}
                           className={`w-full px-4 py-2.5 text-left text-xs font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}
                         >
                           {loc.name}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>

                 <div className="flex flex-col gap-1.5 relative">
                   <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Work Location</label>
                   <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Start typing Belgian city..."
                      value={workSearch} 
                      onFocus={() => setShowWorkSuggestions(true)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setWorkSearch(e.target.value);
                        setEditSettings((prev: CommuteSettings) => ({...prev, workLocation: e.target.value}));
                        setShowWorkSuggestions(true);
                      }} 
                      className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} 
                    />
                    {workSearch && ( 
                      <button 
                        onClick={() => { setWorkSearch(""); setEditSettings(prev => ({...prev, workLocation: "", workCoords: undefined})); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"
                        aria-label="Clear work location"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                   </div>
                   {showWorkSuggestions && filterLocations(workSearch).length > 0 && (
                     <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                       {filterLocations(workSearch).map(loc => (
                         <button 
                           key={loc.name} 
                           onClick={() => handleSelectSuggestion('work', loc)}
                           className={`w-full px-4 py-2.2 text-left text-xs font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}
                         >
                           {loc.name}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
               </div>

               <div className="flex flex-col gap-1.5">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Language</label>
                 <div className={`flex rounded-xl border p-0.5 ${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                   {['en', 'fr', 'nl'].map(lang => (
                     <button key={lang} onClick={() => setEditSettings((prev: CommuteSettings) => ({...prev, language: lang as Language}))} className={`flex-1 py-1.5 rounded-lg font-black text-[9px] transition-all ${editSettings.language === lang ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{lang.toUpperCase()}</button>
                   ))}
                 </div>
               </div>

               <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Commute Schedule</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className={`border rounded-xl p-2.5 flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                         <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Morning</span>
                         <Clock className="w-2.5 h-2.5 text-blue-500 opacity-50" />
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="time" value={editSettings.morningWindow[0]} onChange={(e) => setEditSettings((prev: CommuteSettings) => ({...prev, morningWindow: [e.target.value, prev.morningWindow[1]]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                        <span className="text-slate-600 text-[10px]">→</span>
                        <input type="time" value={editSettings.morningWindow[1]} onChange={(e) => setEditSettings((prev: CommuteSettings) => ({...prev, morningWindow: [prev.morningWindow[0], e.target.value]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                      </div>
                    </div>
                    <div className={`border rounded-xl p-2.5 flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                         <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Evening</span>
                         <Clock className="w-2.5 h-2.5 text-orange-400 opacity-50" />
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="time" value={editSettings.eveningWindow[0]} onChange={(e) => setEditSettings((prev: CommuteSettings) => ({...prev, eveningWindow: [e.target.value, prev.eveningWindow[1]]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                        <span className="text-slate-600 text-[10px]">→</span>
                        <input type="time" value={editSettings.eveningWindow[1]} onChange={(e) => setEditSettings((prev: CommuteSettings) => ({...prev, eveningWindow: [prev.eveningWindow[0], e.target.value]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                      </div>
                    </div>
                  </div>
               </div>

               <div className="flex flex-col gap-1.5 pt-1">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Intelligence Engine</label>
                 <button 
                   onClick={() => setEditSettings((prev: CommuteSettings) => ({...prev, disableAI: !prev.disableAI}))}
                   className={`w-full py-3 rounded-xl border flex items-center justify-between px-3.5 transition-all ${!editSettings.disableAI ? 'bg-blue-600/10 border-blue-500/30' : isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}
                 >
                   <div className="flex items-center gap-2.5">
                     {editSettings.disableAI ? <EyeOff className="w-4 h-4 text-slate-500" /> : <BrainCircuit className="w-4 h-4 text-blue-500" />}
                     <div className="flex flex-col items-start">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${!editSettings.disableAI ? 'text-blue-500' : 'text-slate-500'}`}>AI Analysis</span>
                        <span className="text-[8px] text-slate-500 font-medium">Enhanced tactical interpretation</span>
                     </div>
                   </div>
                   <div className={`w-9 h-5 rounded-full relative transition-colors ${!editSettings.disableAI ? 'bg-blue-600' : 'bg-slate-600'}`}>
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all transform ${!editSettings.disableAI ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                   </div>
                 </button>
               </div>

               <div className="flex flex-col gap-1.5 pt-1">
                 <button 
                   onClick={() => { setViewMode('training'); setIsSettingsOpen(false); setManualStartHour(null); }}
                   className={`w-full py-3 rounded-xl border flex items-center gap-3 px-3.5 transition-all ${isDark ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-600'}`}
                 >
                   <Trophy className="w-4 h-4" />
                   <div className="flex flex-col items-start">
                      <span className="text-[10px] font-black uppercase tracking-widest">Enter Training Mode</span>
                      <span className="text-[8px] opacity-70 font-medium">Plan sessions and optimize your workouts</span>
                   </div>
                 </button>
               </div>
            </div>

            <button onClick={handleSave} className="w-full py-3 bg-blue-600 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] text-white mt-4 mb-2 shadow-xl shadow-blue-600/25 active:scale-[0.98] transition-all">Save Profile</button>
          </div>
        </div>
      )}

      {isInfoOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsInfoOpen(false)} />
          <div className={`relative w-full max-sm border rounded-[2rem] flex flex-col shadow-3xl px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <h2 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>Information</h2>
              </div>
              <button onClick={() => setIsInfoOpen(false)} className={`transition-colors ${isDark ? 'text-slate-600 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto hide-scrollbar px-1">
              <AccordionItem id="purpose" title="WHAT IS COMMUTE IQ?" content={t.purposeContent} />
              <AccordionItem id="score" title="HOW THE SCORE WORKS" content={t.commuteScoreContent} />
              <AccordionItem id="training-mode" title="TRAINING MODE" content="Plan and optimize sessions by scanning time windows and location metadata for atmospheric superiority." />
              <AccordionItem id="retrieval" title="DATA VS. INTELLIGENCE" content={t.generalSourcesContent} />
              <AccordionItem id="ice" title="ICE RISK" content={TRANSLATIONS[settings.language].iceRiskContent} />
              <AccordionItem id="surface" title="SURFACE" content={TRANSLATIONS[settings.language].surfaceConditionContent} />
              <AccordionItem id="wind" title="WIND" content="Vector mapping against transit headings to detect drag or boost." />
              <AccordionItem id="lighting" title="LIGHTING" content="Solar window overlap analysis for required visibility gear." />
              <AccordionItem id="distance" title="ROUTE DISTANCE" content="Loxodromic distance adjusted by terrestrial detour coefficients." />
            </div>

            <button 
              onClick={() => setIsInfoOpen(false)}
              className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] transition-all ${isDark ? 'bg-slate-900 border border-white/5 text-slate-500 hover:text-white' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'}`}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
