import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CommuteSettings, Coordinates, Language, TrainingState, LocationSuggestion } from './types'; 
import { DEFAULT_SETTINGS, TRANSLATIONS, BELGIAN_CITIES } from './constants';
import { BELGIAN_LOCATIONS, BelgianLocation } from './locations';
import { WeatherCard } from './components/WeatherCard';
import { WeeklyForecast } from './components/WeeklyForecast';
import { 
  getPulseBatch, 
  getCommuteRoadDistance, 
  fetchRawWeatherData, 
  aggregateRawWeather, 
  calculateSegmentScore,
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

const App: React.FC = () => {
  const [settings, setSettings] = useState<CommuteSettings>(() => {
    const saved = localStorage.getItem('velo_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...parsed };
  });

  const [pulseDataMap, setPulseDataMap] = useState<Record<number, any>>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    try {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const filtered: Record<number, any> = {};
      Object.keys(parsed).forEach(k => {
        const key = Number(k);
        if (now - (parsed[key].lastUpdated || 0) < 24 * 60 * 60 * 1000) {
          filtered[key] = parsed[key];
        }
      });
      return filtered;
    } catch (e) { return {}; }
  });
  
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'training'>('daily');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [expandedInfoItem, setExpandedInfoItem] = useState<string | null>(null);

  // Training State
  const [training, setTraining] = useState<TrainingState>({
    location: "Gent",
    coords: { lat: 51.0543, lng: 3.7174 },
    distance: 40,
    dateOffset: 0,
    preferredDirection: 0
  });
  const [trainingSearch, setTrainingSearch] = useState("Gent");
  const [showTrainingSuggestions, setShowTrainingSuggestions] = useState(false);
  const [trainingData, setTrainingData] = useState<any>(null);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [manualStartHour, setManualStartHour] = useState<number | null>(null);

  // Autocomplete state for settings
  const [homeSearch, setHomeSearch] = useState("");
  const [workSearch, setWorkSearch] = useState("");
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [showWorkSuggestions, setShowWorkSuggestions] = useState(false);

  const nextCommuteInfo = useMemo(() => {
    const now = new Date();
    const getTarget = (timeStr: string, addDays = 0) => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + addDays); return d;
    };
    if (now < getTarget(settings.morningWindow[1])) return { type: 'morning' as const, offset: 0 };
    if (now < getTarget(settings.eveningWindow[1])) return { type: 'evening' as const, offset: 0 };
    return { type: 'morning' as const, offset: 1 };
  }, [settings]);

  const [selectedDateOffset, setSelectedDateOffset] = useState(nextCommuteInfo.offset);
  const [loading, setLoading] = useState(false);
  const [loadingOffsets, setLoadingOffsets] = useState<number[]>([]);

  // Calculate the displayed distance based on settings or crow-fly distance
  const displayedDistance = useMemo(() => {
    if (settings.roadDistance) return settings.roadDistance;
    const crowFly = calculateDistance(settings.homeCoords, settings.workCoords);
    return crowFly * ROAD_DETOUR_FACTOR;
  }, [settings.roadDistance, settings.homeCoords, settings.workCoords]);

  // Determine the sequence of commutes to show (Morning vs Evening)
  const commuteSequence = useMemo(() => {
    if (selectedDateOffset === nextCommuteInfo.offset) {
      return {
        primary: nextCommuteInfo,
        secondary: { 
          type: nextCommuteInfo.type === 'morning' ? 'evening' as const : 'morning' as const, 
          offset: nextCommuteInfo.type === 'morning' ? nextCommuteInfo.offset : nextCommuteInfo.offset + 1
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
    setEditSettings(prev => ({ ...prev, theme: settings.theme }));
  }, [settings.theme]);

  useEffect(() => {
    setHomeSearch(settings.homeLocation);
    setWorkSearch(settings.workLocation);
  }, [settings]);

  const syncData = useCallback(async (currentSettings: CommuteSettings, offsets: number[], isSilent = false) => {
    if (!offsets.length) return;
    if (!isSilent) setLoading(true);
    setLoadingOffsets(prev => [...new Set([...prev, ...offsets])]);
    try {
      const results = await getPulseBatch(currentSettings, offsets, false);
      setPulseDataMap(prev => {
        const next = { ...prev, ...results };
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error("Sync data failed:", err);
    } finally {
      setLoadingOffsets(prev => prev.filter(o => !offsets.includes(o)));
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Optimized initial sync: do not execute previous prompts again if valid cached data exists
  useEffect(() => {
    if (!initialSyncStarted.current) {
      initialSyncStarted.current = true;
      
      const allOffsets = [0, 1, 2, 3, 4, 5, 6];
      const offsetsToSync = allOffsets.filter(offset => {
        const cached = pulseDataMap[offset];
        if (!cached) return true;
        // Data considered stale after 6 hours
        return Date.now() - (cached.lastUpdated || 0) > 6 * 60 * 60 * 1000;
      });

      if (offsetsToSync.length > 0) {
        const priority = offsetsToSync.filter(o => o === 0 || o === 1);
        const background = offsetsToSync.filter(o => o > 1);
        
        if (priority.length > 0) {
          syncData(settings, priority).then(() => {
            if (background.length > 0) {
              syncData(settings, background, true);
            }
          });
        } else if (background.length > 0) {
          syncData(settings, background, true);
        }
      }
    }
  }, [syncData, settings, pulseDataMap]);

  // Training Data Fetcher
  const syncTraining = useCallback(async () => {
    setTrainingLoading(true);
    try {
      const raw = await fetchRawWeatherData(training.coords);
      const dayIdx = training.dateOffset * 24;
      const durationHours = training.distance / AVG_TRAINING_SPEED;
      const durationInt = Math.ceil(durationHours);
      
      const sunTimes = {
        sunrise: raw.daily?.sunrise?.[training.dateOffset] || "07:00",
        sunset: raw.daily?.sunset?.[training.dateOffset] || "20:00"
      };

      const scanWindows = [];
      // Training start range from 3 AM until 9 PM (21:00)
      for (let hour = 3; hour <= 21; hour++) {
        const startTimeStr = `${hour.toString().padStart(2, '0')}:00`;
        const endHourVal = hour + durationInt;
        const endTimeStr = `${endHourVal.toString().padStart(2, '0')}:00`;
        const window: [string, string] = [startTimeStr, endTimeStr];
        
        const startIndex = dayIdx + hour;
        const endIndex = dayIdx + endHourVal;
        
        const slice: any = {};
        Object.keys(raw.hourly).forEach(k => {
          // Ensure we only slice if the raw data for this key is an array and within bounds
          if (Array.isArray(raw.hourly[k]) && startIndex <= endIndex && endIndex < raw.hourly[k].length) {
            slice[k] = raw.hourly[k].slice(startIndex, endIndex + 1);
          } else if (Array.isArray(raw.hourly[k]) && startIndex > endIndex) {
            // Handle cases where the window might span across midnight for single day view (unlikely with 3-21h range, but defensive)
            slice[k] = []; 
          }
        });

        const pastTemps = (raw.hourly.temperature_2m || []).slice(Math.max(0, startIndex - 6), startIndex);
        const minPastTemp = pastTemps.length ? Math.min(...pastTemps) : 10;

        const condition = aggregateRawWeather(slice, 0, true, settings, sunTimes, minPastTemp, window);
        const score = calculateSegmentScore(condition);
        scanWindows.push({ startHour: hour, condition, window, score });
      }

      let finalSlot = null;
      if (manualStartHour !== null) {
        finalSlot = scanWindows.find(w => w.startHour === manualStartHour) || scanWindows[0];
      } else {
        // Find best scoring slot initially
        finalSlot = scanWindows.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        setManualStartHour(finalSlot.startHour);
      }

      if (finalSlot) {
        finalSlot.condition.surfaceReason = getStandardizedAdvice(finalSlot.condition);
        
        // Spatial Optimization Advice Logic
        const windDirFrom = finalSlot.condition.windDirection; 
        const targetBearing = windDirFrom; // Heading directly into the wind source
        
        // Route Advice: Optimize for turning points roughly 40% of the total distance away from current training center
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

        // Location Advice: Find alternative START locations within specified distance ranges
        const userHome = settings.homeCoords || training.coords;
        const allPotentialLocations = BELGIAN_LOCATIONS
          .filter(loc => loc.name !== training.location) // Exclude current training location
          .map(loc => ({
            name: loc.name,
            coords: { lat: loc.lat, lng: loc.lng },
            distanceFromHome: calculateDistance(userHome, { lat: loc.lat, lng: loc.lng })
          }));

        const selectRandom = (arr: LocationSuggestion[], count: number) => {
          const shuffled = [...arr].sort(() => 0.5 - Math.random());
          return shuffled.slice(0, count);
        };

        const locationSuggestions: LocationSuggestion[] = [];

        // Try to get one for ~40km
        const candidates40 = allPotentialLocations.filter(loc => loc.distanceFromHome >= 30 && loc.distanceFromHome <= 50);
        if (candidates40.length > 0) locationSuggestions.push(selectRandom(candidates40, 1)[0]);

        // Try to get one for ~60-70km
        const candidates60_70 = allPotentialLocations.filter(loc => loc.distanceFromHome > 50 && loc.distanceFromHome <= 75);
        if (candidates60_70.length > 0) locationSuggestions.push(selectRandom(candidates60_70, 1)[0]);

        // Try to get one for ~100km
        const candidates100 = allPotentialLocations.filter(loc => loc.distanceFromHome > 75 && loc.distanceFromHome <= 110);
        if (candidates100.length > 0) locationSuggestions.push(selectRandom(candidates100, 1)[0]);

        // Fill remaining slots if fewer than 3 unique suggestions were found
        if (locationSuggestions.length < 3) {
          const existingNames = new Set(locationSuggestions.map(s => s.name));
          const remainingCandidates = allPotentialLocations.filter(loc => !existingNames.has(loc.name));
          const fillCount = 3 - locationSuggestions.length;
          locationSuggestions.push(...selectRandom(remainingCandidates, fillCount));
        }

        finalSlot.optimizationAdvice = routeSuggestions.map(s => ({ name: s.name, distanceFromTrainingCenter: s.distFromCenter }));
        finalSlot.locationAdvice = locationSuggestions.slice(0, 3); // Ensure max 3 results
        setTrainingData(finalSlot);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTrainingLoading(false);
    }
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
      } catch (e) { } 
    }
    const updated = { ...editSettings, roadDistance };
    setSettings(updated);
    localStorage.setItem('velo_settings', JSON.stringify(updated));
    setIsSettingsOpen(false);
    if (locationChanged || editSettings.disableAI !== settings.disableAI) { 
      setPulseDataMap({});
      localStorage.removeItem(CACHE_KEY);
      syncData(updated, [0]).then(() => {
        syncData(updated, [1, 2, 3, 4, 5, 6], true);
      });
    } else {
      setLoading(false);
    }
  };

  const handleImmediateThemeChange = (newTheme: 'dark' | 'light') => {
    setSettings(prev => ({ ...prev, theme: newTheme }));
    setEditSettings(prev => ({ ...prev, theme: newTheme }));
  };

  const getDayLabel = (offset: number) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return {
      name: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      num: d.getDate(),
      month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
    };
  };

  const primaryData = useMemo(() => {
    const config = commuteSequence.primary;
    const isMorning = config.type === 'morning';
    const dayPulse = pulseDataMap[config.offset];
    const timeRange = isMorning ? settings.morningWindow.join(' - ') : settings.eveningWindow.join(' - ');
    const labels = getDayLabel(config.offset);

    return {
      label: isMorning ? t.morning : t.evening,
      timeRange,
      startLocation: getLocality(isMorning ? settings.homeLocation : settings.workLocation),
      endLocation: getLocality(isMorning ? settings.workLocation : settings.homeLocation),
      condition: dayPulse?.weather?.[isMorning ? 'morning' : 'evening'] ?? null,
      score: dayPulse?.score,
      dateLabel: `${labels.name} ${labels.num} ${labels.month}`,
    };
  }, [commuteSequence.primary, pulseDataMap, settings, t]);

  const secondaryData = useMemo(() => {
    const config = commuteSequence.secondary;
    const isMorning = config.type === 'morning';
    const dayPulse = pulseDataMap[config.offset];
    const labels = getDayLabel(config.offset);
    return {
      label: isMorning ? t.morning : t.evening,
      timeRange: isMorning ? settings.morningWindow.join(' - ') : settings.eveningWindow.join(' - '),
      startLocation: getLocality(isMorning ? settings.homeLocation : settings.workLocation),
      endLocation: getLocality(isMorning ? settings.workLocation : settings.homeLocation),
      condition: dayPulse?.weather?.[isMorning ? 'morning' : 'evening'] ?? null,
      score: dayPulse?.score,
      dateLabel: `${labels.name} ${labels.num} ${labels.month}`,
    };
  }, [commuteSequence.secondary, pulseDataMap, settings, t]);

  const activeDayLabels = getDayLabel(selectedDateOffset);

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
    
    // Deduplicate by city name to ensure unique proposals
    const unique = filtered.filter((loc, index, self) =>
      index === self.findIndex((t) => t.name === loc.name)
    );
    
    return unique.slice(0, 5);
  };

  const handleSelectSuggestion = (type: 'home' | 'work' | 'training', loc: BelgianLocation) => {
    if (type === 'home') {
      setEditSettings({ ...editSettings, homeLocation: loc.name, homeCoords: { lat: loc.lat, lng: loc.lng } });
      setHomeSearch(loc.name);
      setShowHomeSuggestions(false);
    } else if (type === 'work') {
      setEditSettings({ ...editSettings, workLocation: loc.name, workCoords: { lat: loc.lat, lng: loc.lng } });
      setWorkSearch(loc.name);
      setShowWorkSuggestions(false);
    } else if (type === 'training') {
      setTraining({ ...training, location: loc.name, coords: { lat: loc.lat, lng: loc.lng } });
      setTrainingSearch(loc.name);
      setShowTrainingSuggestions(false);
      setManualStartHour(null);
    }
  };

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
                <span className="text-[9px]">{selectedDateOffset === 0 ? 'TODAY' : selectedDateOffset === 1 ? 'TOMORROW' : `${activeDayLabels.name} ${activeDayLabels.num}`}</span>
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
            <div className={`absolute top-11 right-0 w-48 border rounded-2xl shadow-2xl z-[100] p-1.5 animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
              {[0, 1, 2, 3, 4, 5, 6].map(o => {
                const l = getDayLabel(o);
                const isSelected = selectedDateOffset === o;
                return (
                  <button 
                    key={o}
                    onClick={() => { setSelectedDateOffset(o); setViewMode('daily'); setIsDateDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-tight transition-colors ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span>{o === 0 ? 'TODAY' : o === 1 ? 'TOMORROW' : `${l.name} ${l.num} ${l.month}`}</span>
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
            <button onClick={() => viewMode === 'training' ? syncTraining() : syncData(settings, [selectedDateOffset])} className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-lg">
              <RefreshCw className={`w-4.5 h-4.5 text-slate-400 ${(loading || trainingLoading) ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-lg">
              <SettingsIcon className="w-4.5 h-4.5 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-3 max-w-md mx-auto w-full min-h-0 overflow-y-auto relative">
        {viewMode === 'daily' && (
          <div className="flex flex-col gap-4 flex-1"> {/* Added flex-1 here */}
            <div className="flex-[3] min-h-0"> {/* Primary WeatherCard now takes more space */}
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
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Commute Intelligence</span>
              </div>
              <p className={`text-[13px] font-medium leading-[1.4] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {primaryData.condition?.surfaceReason || "Processing telemetry for tactical riding advice..."}
              </p>
            </button>

            <div className="flex-[1] min-h-0"> {/* Secondary WeatherCard takes less relative space */}
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
              onSelectDay={(offset) => { setSelectedDateOffset(offset); setViewMode('daily'); }} 
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
                  <div className="relative">
                    <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-500" />
                    <input 
                      type="text" 
                      value={trainingSearch} 
                      onFocus={() => setShowTrainingSuggestions(true)}
                      onChange={e => { setTrainingSearch(e.target.value); setShowTrainingSuggestions(true); }}
                      className={`w-full rounded-lg pl-6 pr-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                    />
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
                    onChange={e => { setTraining({...training, dateOffset: parseInt(e.target.value)}); setManualStartHour(null); }}
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
                  onChange={e => { setTraining({...training, distance: parseInt(e.target.value)}); setManualStartHour(null); }}
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

                {/* Adjust Start Hour Slider */}
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
                    onChange={e => setManualStartHour(parseInt(e.target.value))}
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

      {/* Settings Modal */}
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
                      onChange={e => {
                        setHomeSearch(e.target.value);
                        setEditSettings({...editSettings, homeLocation: e.target.value});
                        setShowHomeSuggestions(true);
                      }} 
                      className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} 
                    />
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
                   <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Transit Destination</label>
                   <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Start typing Belgian city..."
                      value={workSearch} 
                      onFocus={() => setShowWorkSuggestions(true)}
                      onChange={e => {
                        setWorkSearch(e.target.value);
                        setEditSettings({...editSettings, workLocation: e.target.value});
                        setShowWorkSuggestions(true);
                      }} 
                      className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} 
                    />
                   </div>
                   {showWorkSuggestions && filterLocations(workSearch).length > 0 && (
                     <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                       {filterLocations(workSearch).map(loc => (
                         <button 
                           key={loc.name} 
                           onClick={() => handleSelectSuggestion('work', loc)}
                           className={`w-full px-4 py-2.5 text-left text-xs font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}
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
                     <button key={lang} onClick={() => setEditSettings({...editSettings, language: lang as Language})} className={`flex-1 py-1.5 rounded-lg font-black text-[9px] transition-all ${editSettings.language === lang ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{lang.toUpperCase()}</button>
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
                        <input type="time" value={editSettings.morningWindow[0]} onChange={e => setEditSettings({...editSettings, morningWindow: [e.target.value, editSettings.morningWindow[1]]})} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                        <span className="text-slate-600 text-[10px]">→</span>
                        <input type="time" value={editSettings.morningWindow[1]} onChange={e => setEditSettings({...editSettings, morningWindow: [editSettings.morningWindow[0], e.target.value]})} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                      </div>
                    </div>
                    <div className={`border rounded-xl p-2.5 flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                         <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Evening</span>
                         <Clock className="w-2.5 h-2.5 text-orange-400 opacity-50" />
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="time" value={editSettings.eveningWindow[0]} onChange={e => setEditSettings({...editSettings, eveningWindow: [e.target.value, editSettings.eveningWindow[1]]})} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                        <span className="text-slate-600 text-[10px]">→</span>
                        <input type="time" value={editSettings.eveningWindow[1]} onChange={e => setEditSettings({...editSettings, eveningWindow: [editSettings.eveningWindow[0], e.target.value]})} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                      </div>
                    </div>
                  </div>
               </div>

               <div className="flex flex-col gap-1.5 pt-1">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Intelligence Engine</label>
                 <button 
                   onClick={() => setEditSettings({...editSettings, disableAI: !editSettings.disableAI})}
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

               {/* TRAINING MODE BUTTON */}
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

      {/* Information Modal */}
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
              <AccordionItem 
                id="purpose" 
                title="WHAT IS COMMUTE IQ?" 
                content="Commute IQ is your personal cycling sidekick. It takes complex weather data and turns it into simple, actionable advice so you can focus on the ride, not the forecast. No jargon, just the info you need to stay safe and dry." 
              />
              <AccordionItem 
                id="score" 
                title="HOW THE SCORE WORKS" 
                content={"We start with a perfect 100% and deduct points for things that make your ride harder or riskier:\n\n• Ice Risk: -70 (Major hazard!)\n• Rain: -20 to -40 (depending on intensity)\n• Wind: Points lost for high speeds and tough headwinds\n• Temperature: Deductions for extreme cold or heat\n• Darkness: -5 (for visibility)\n\nThe final score shown is the 'worst-case' scenario between your morning and evening trips."} 
              />
              <AccordionItem
                id="training-mode"
                title="TRAINING MODE"
                content="Enter training mode to plan and optimize your cycling workouts. This feature allows you to select a training area, set your desired distance, and choose a specific day. The app then scans various time windows to suggest the optimal start time based on weather conditions, providing tactical advice for your session and even suggesting route turning points or alternative starting locations."
              />
              <AccordionItem 
                id="retrieval" 
                title="DATA VS. INTELLIGENCE" 
                content={"We use two main engines to power the dashboard:\n\n1. The Telemetry API: Pulls raw, live numbers for temperature, rain, and wind from high-precision Open-Meteo feeds.\n\n2. The AI Brain (LLM): Gemini analyzes these raw numbers to interpret what they actually mean for a cyclist, giving you tactical advice like 'watch your speed in corners' or 'expect a tough headwind'."} 
              />
              <AccordionItem 
                id="ice" 
                title="ICE RISK" 
                content="Determined by checking moisture levels against ground temperatures. We look back 6 hours to see if the ground likely stayed frozen (thermal inertia) even if the air warmed up slightly." 
              />
              <AccordionItem 
                id="surface" 
                title="SURFACE" 
                content="Based on recent rainfall and humidity. If it rained within the last few hours, we assume roads are still wet and drying at a natural rate." 
              />
              <AccordionItem 
                id="wind" 
                title="WIND" 
                content="Calculated by comparing the wind's forecast direction to the exact mathematical path between your home and work. We identify if it's a helpful tailwind or a punishing headwind." 
              />
              <AccordionItem 
                id="lighting" 
                title="LIGHTING" 
                content="Determined using astronomical sunrise and sunset data for your specific coordinates. If your commute window overlaps with twilight or night, we flag that lights are required." 
              />
              <AccordionItem 
                id="distance" 
                title="ROUTE DISTANCE" 
                content="Estimated by taking the 'as-the-crow-flies' distance between your locations and adding a 32% detour factor to account for real-world twists and turns of bike paths and streets." 
              />
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