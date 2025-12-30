import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CommuteSettings, Coordinates, Language, TrainingState, LocationSuggestion } from './types'; 
import { BelgianLocation } from './locations';
import { DEFAULT_SETTINGS, TRANSLATIONS, BELGIAN_CITIES } from './constants';
import { BELGIAN_LOCATIONS } from './locations';
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
  Home, // Import Home icon
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

// Utility function to shuffle an array
// FIX: Changed from arrow function with generics to regular function with generics to avoid potential parser issues.
function shuffleArray<T>(array: T[]): T[] {
  let currentIndex: number = array.length; 
  let randomIndex: number;
  const newArray = [...array]; // Create a shallow copy to avoid mutating original
  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [newArray[currentIndex], newArray[randomIndex]] = [
      newArray[randomIndex], newArray[currentIndex]];
  }
  return newArray;
};

// FIX: Changed App to a default export and explicitly typed state initializers.
const App: React.FC = () => {
  const [settings, setSettings] = useState<CommuteSettings>(() => {
    const saved = localStorage.getItem('velo_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    // FIX: Ensure DEFAULT_SETTINGS type is spread correctly, and handle potential missing coords
    return { 
      ...DEFAULT_SETTINGS, 
      ...parsed,
      homeCoords: parsed.homeCoords || DEFAULT_SETTINGS.homeCoords, // Ensure coords are present
      workCoords: parsed.workCoords || DEFAULT_SETTINGS.workCoords, // Ensure coords are present
    };
  });

  const [pulseDataMap, setPulseDataMap] = useState<Record<number, any>>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    try {
      const parsed: Record<number, any> = JSON.parse(cached); // FIX: Explicitly type parsed
      const now = Date.now();
      const filtered: Record<number, any> = {}; // FIX: Explicitly type filtered
      Object.keys(parsed).forEach((k) => {
        const key = Number(k);
        if (now - (parsed[key]?.lastUpdated || 0) < 24 * 60 * 60 * 1000) { // FIX: Optional chaining for lastUpdated
          filtered[key] = parsed[key];
        }
      });
      return filtered;
    } catch (e: any) { // FIX: Explicitly type 'e' in catch block
      console.error("Failed to parse cached pulse data:", e);
      return {}; 
    }
  });
  
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'training'>('daily');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [expandedInfoItem, setExpandedInfoItem] = useState<string | null>(null);

  // Training State
  const [training, setTraining] = useState<TrainingState>(() => {
    const initialSettings: CommuteSettings = localStorage.getItem('velo_settings') ? JSON.parse(localStorage.getItem('velo_settings')!) : DEFAULT_SETTINGS;
    return {
      location: initialSettings.homeLocation || "Gent", // Default to Gent if homeLocation is not set
      coords: initialSettings.homeCoords || { lat: 51.0543, lng: 3.7174 }, // Default to Gent coords
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
  const [trainingData, setTrainingData] = useState<any>(null); // FIX: Explicitly typed as any
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [manualStartHour, setManualStartHour] = useState<number | null>(null);

  // Autocomplete state for settings
  const [homeSearch, setHomeSearch] = useState(settings.homeLocation); // FIX: Initialize with settings value
  const [workSearch, setWorkSearch] = useState(settings.workLocation); // FIX: Initialize with settings value
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [showWorkSuggestions, setShowWorkSuggestions] = useState(false);

  // FIX: Moved getTarget outside useMemo
  const getTarget = useCallback((timeStr: string, addDays = 0) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + addDays); return d;
  }, []);

  const nextCommuteInfo = useMemo(() => {
    const now = new Date();
    // FIX: Use the new useCallback getTarget
    if (now < getTarget(settings.morningWindow[1])) return { type: 'morning' as const, offset: 0 };
    if (now < getTarget(settings.eveningWindow[1])) return { type: 'evening' as const, offset: 0 };
    return { type: 'morning' as const, offset: 1 };
  }, [settings.morningWindow, settings.eveningWindow, getTarget]); // FIX: Add getTarget to dependencies

  const [selectedDateOffset, setSelectedDateOffset] = useState<number>(nextCommuteInfo.offset);
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

  const [editSettings, setEditSettings] = useState<CommuteSettings>(settings); // FIX: Initialize with settings state
  const initialSyncStarted = useRef(false);

  useEffect(() => {
    // FIX: Corrected state setter usage
    setEditSettings((prevEditSettings: CommuteSettings) => ({ ...prevEditSettings, theme: settings.theme }));
  }, [settings.theme]);

  useEffect(() => {
    // FIX: Corrected state setter usage
    setHomeSearch(settings.homeLocation);
    setWorkSearch(settings.workLocation);
  }, [settings.homeLocation, settings.workLocation]);

  // Update training location when home location changes in settings
  useEffect(() => {
    if (settings.homeLocation && settings.homeCoords) {
      // FIX: Corrected state setter usage and type casting for coords
      setTraining((prevTraining: TrainingState) => ({ // FIX: Type prevTraining
        ...prevTraining,
        location: settings.homeLocation,
        coords: settings.homeCoords as Coordinates, // Cast to Coordinates
      }));
      setTrainingSearch(settings.homeLocation);
      setManualStartHour(null); // Reset manual hour when base location changes
    }
  }, [settings.homeLocation, settings.homeCoords]);


  const syncData = useCallback(async (currentSettings: CommuteSettings, offsets: number[], isSilent = false) => {
    if (!offsets.length) return;
    if (!isSilent) setLoading(true);
    setLoadingOffsets((prevOffsets: number[]) => [...new Set([...prevOffsets, ...offsets])]); // FIX: Type prevOffsets
    try {
      const results = await getPulseBatch(currentSettings, offsets, false);
      // FIX: Corrected state setter usage
      setPulseDataMap(prev => {
        const next = { ...prev, ...results };
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err: any) { // FIX: Type 'err' as any
      console.error("Sync data failed:", err);
    } finally {
      // FIX: Corrected state setter usage
      setLoadingOffsets((prevOffsets: number[]) => prevOffsets.filter(o => !offsets.includes(o))); // FIX: Type prevOffsets
      if (!isSilent) setLoading(false);
    }
  }, [settings]); // FIX: Add settings to syncData dependencies

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
          // FIX: Corrected function call parameters
          syncData(settings, priority).then(() => {
            if (background.length > 0) {
              // FIX: Corrected function call parameters
              syncData(settings, background, true);
            }
          });
        } else if (background.length > 0) {
          // FIX: Corrected function call parameters
          syncData(settings, background, true);
        }
      }
    }
  }, [syncData, settings, pulseDataMap]); // FIX: Added pulseDataMap as a dependency

  // Training Data Fetcher
  const syncTraining = useCallback(async () => {
    setTrainingLoading(true);
    try {
      // First, get the raw weather data for the currently selected training location
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
            // FIX: Corrected slice method arguments and property access
            if (Array.isArray(rawCurrentLocation.hourly[k]) && startIndex <= endIndex && endIndex < rawCurrentLocation.hourly[k].length) {
              slice[k] = (rawCurrentLocation.hourly[k] as number[]).slice(startIndex, endIndex + 1);
            } else if (Array.isArray(rawCurrentLocation.hourly[k]) && startIndex > endIndex) {
              slice[k] = []; 
            }
          });
        }

        const pastTemps = (rawCurrentLocation.hourly?.temperature_2m || []).slice(Math.max(0, startIndex - 6), startIndex);
        const minPastTemp = pastTemps.length ? Math.min(...pastTemps) : 10;

        const condition = aggregateRawWeather(slice, 0, true, settings, sunTimesCurrent, minPastTemp, window);
        const score = calculateSegmentScore(condition);
        scanWindowsCurrent.push({ startHour: hour, condition, window, score });
      }

      let finalSlot: any = null; // FIX: Declared `finalSlot` with `let` and type `any`
      if (manualStartHour !== null) {
        finalSlot = scanWindowsCurrent.find(w => w.startHour === manualStartHour) || scanWindowsCurrent[0];
      } else if (scanWindowsCurrent.length > 0) {
        finalSlot = scanWindowsCurrent.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        setManualStartHour(finalSlot.startHour);
      }

      if (finalSlot) {
        finalSlot.condition.surfaceReason = getStandardizedAdvice(finalSlot.condition);
        
        // Spatial Optimization Advice Logic
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

        // --- Location Advice: Find alternative START locations with *strictly better* scores ---
        const currentLocationBestScore = scanWindowsCurrent.reduce((maxScore, window) => Math.max(maxScore, window.score), 0); 
        const userHomeOrTrainingCoords = settings.homeCoords || training.coords;

        const nearbyCandidateLocations = BELGIAN_LOCATIONS.filter(loc => {
          const dist = calculateDistance(userHomeOrTrainingCoords, { lat: loc.lat, lng: loc.lng });
          // Filter for locations at least 40km away and within 80km
          return dist >= 40 && dist <= 80 && loc.name !== training.location;
        });

        // Shuffle and limit to 50 candidates for performance and randomness
        const candidatesToProcess = shuffleArray(nearbyCandidateLocations).slice(0, 50); 

        const betterLocationSuggestions: LocationSuggestion[] = [];

        for (const candidateLoc of candidatesToProcess) {
          let candidateRaw: any; // FIX: Declared `candidateRaw` with `let` and type `any`
          try {
            candidateRaw = await fetchRawWeatherData({ lat: candidateLoc.lat, lng: candidateLoc.lng });
          } catch (e: any) { // FIX: Type 'e' as any
            console.warn(`Failed to fetch weather for candidate ${candidateLoc.name}:`, e);
            continue; 
          }

          const candidateSunTimes = {
            sunrise: candidateRaw.daily?.sunrise?.[training.dateOffset] || "07:00",
            sunset: candidateRaw.daily?.sunset?.[training.dateOffset] || "20:00"
          };

          const candidateScanWindows = [];
          for (let hour = 3; hour <= 21; hour++) {
            const startTimeStr = `${hour.toString().padStart(2, '0')}:00`;
            const endHourVal = hour + durationInt;
            const endTimeStr = `${endHourVal.toString().padStart(2, '0')}:00`;
            const window: [string, string] = [startTimeStr, endTimeStr];
            
            const startIndex = dayIdx + hour;
            const endIndex = dayIdx + endHourVal;
            
            const slice: any = {};
            if (candidateRaw.hourly) {
              Object.keys(candidateRaw.hourly).forEach((k) => {
                // FIX: Corrected slice method arguments and property access
                if (Array.isArray(candidateRaw.hourly[k]) && startIndex <= endIndex && endIndex < candidateRaw.hourly[k].length) {
                  slice[k] = (candidateRaw.hourly[k] as number[]).slice(startIndex, endIndex + 1);
                } else if (Array.isArray(candidateRaw.hourly[k]) && startIndex > endIndex) {
                  slice[k] = [];
                }
              });
            }

            const pastTemps = (candidateRaw.hourly?.temperature_2m || []).slice(Math.max(0, startIndex - 6), startIndex);
            const minPastTemp = pastTemps.length ? Math.min(...pastTemps) : 10;

            const condition = aggregateRawWeather(slice, training.preferredDirection, true, settings, candidateSunTimes, minPastTemp, window);
            candidateScanWindows.push({ startHour: hour, condition, window, score: calculateSegmentScore(condition) });
          }

          if (candidateScanWindows.length > 0) {
            const bestCandidateScore = candidateScanWindows.reduce((prev, current) => (prev.score > current.score) ? prev : current).score;

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

        // FIX: Added dummy lat/lng for optimizationAdvice to match LocationSuggestion interface
        finalSlot.optimizationAdvice = routeSuggestions.map(s => ({ name: s.name, distanceFromTrainingCenter: s.distFromCenter, lat: training.coords.lat, lng: training.coords.lng }));
        finalSlot.locationAdvice = betterLocationSuggestions
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 3);
        setTrainingData(finalSlot);
      }
    } catch (e: any) { // FIX: Type 'e' as any
      console.error(e);
    } finally {
      setTrainingLoading(false);
    }
  }, [training, settings, manualStartHour, shuffleArray]); // FIX: Add shuffleArray to dependencies, as it's a utility used here

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
      } catch (e: any) { } // FIX: Type 'e' as any
    }
    // FIX: Corrected updated object construction for settings
    const updated: CommuteSettings = { ...editSettings, roadDistance }; 
    setSettings(updated);
    localStorage.setItem('velo_settings', JSON.stringify(updated));
    setIsSettingsOpen(false);
    if (locationChanged || editSettings.disableAI !== settings.disableAI) { 
      setPulseDataMap({});
      localStorage.removeItem(CACHE_KEY);
      // FIX: Corrected function calls for syncData
      syncData(updated, [0]).then(() => {
        syncData(updated, [1, 2, 3, 4, 5, 6], true);
      });
    } else {
      setLoading(false);
    }
  };

  const handleImmediateThemeChange = (newTheme: 'dark' | 'light') => {
    // FIX: Corrected state setter usage
    setSettings((prevSettings: CommuteSettings) => ({ ...prevSettings, theme: newTheme }));
    setEditSettings((prevEditSettings: CommuteSettings) => ({ ...prevEditSettings, theme: newTheme }));
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
      // FIX: explicitly set optimizationAdvice and locationAdvice to undefined for daily mode
      optimizationAdvice: undefined,
      locationAdvice: undefined,
    };
  }, [commuteSequence.primary, pulseDataMap, settings.morningWindow, settings.eveningWindow, settings.homeLocation, settings.workLocation, t, getDayLabel]); // FIX: Add dependencies

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
      // FIX: explicitly set optimizationAdvice and locationAdvice to undefined for daily mode
      optimizationAdvice: undefined,
      locationAdvice: undefined,
    };
  }, [commuteSequence.secondary, pulseDataMap, settings.morningWindow, settings.eveningWindow, settings.homeLocation, settings.workLocation, t, getDayLabel]); // FIX: Add dependencies

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
      // FIX: Corrected object spread and property access
      setEditSettings((prev: CommuteSettings) => ({ ...prev, homeLocation: loc.name, homeCoords: { lat: loc.lat, lng: loc.lng } }));
      setHomeSearch(loc.name);
      setShowHomeSuggestions(false);
    } else if (type === 'work') {
      // FIX: Corrected object spread and property access
      setEditSettings((prev: CommuteSettings) => ({ ...prev, workLocation: loc.name, workCoords: { lat: loc.lat, lng: loc.lng } }));
      setWorkSearch(loc.name);
      setShowWorkSuggestions(false);
    } else if (type === 'training') {
      const newCoords: Coordinates = { lat: loc.lat, lng: loc.lng };
      // FIX: Corrected object spread for prevTraining
      setTraining((prevTraining: TrainingState) => ({ ...prevTraining, location: loc.name, coords: newCoords }));
      setTrainingSearch(loc.name);
      setShowTrainingSuggestions(false);
      setManualStartHour(null); // Reset manual hour when location changes
    }
  };

  const handleSetTrainingToHome = useCallback(() => {
    if (settings.homeLocation && settings.homeCoords) {
      setTraining((prevTraining: TrainingState) => ({
        ...prevTraining,
        location: settings.homeLocation,
        coords: settings.homeCoords as Coordinates,
      }));
      setTrainingSearch(settings.homeLocation);
      setManualStartHour(null); // Reset manual hour when location changes
      setShowTrainingSuggestions(false); // Hide suggestions after selection
    }
  }, [settings.homeLocation, settings.homeCoords]); // FIX: Add dependencies

  const handleSelectLocationAdvice = useCallback((loc: BelgianLocation) => {
    const newCoords: Coordinates = { lat: loc.lat, lng: loc.lng };
    // FIX: Corrected object spread for prevTraining and property access for coords
    setTraining((prevTraining: TrainingState) => ({ ...prevTraining, location: loc.name, coords: newCoords }));
    setTrainingSearch(loc.name);
    setManualStartHour(null); // Reset manual hour when location changes
    // Removed setShowLocationPopup(false) from here as WeatherCard manages its own internal state to close on click
  }, []); // FIX: Add dependencies

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
            <div className={`absolute top-11 right-0 w-48 border rounded-2xl shadow-2xl z-[100] p-1.5 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}> {/* FIX: Removed animation classes */}
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
                  <div className="relative flex items-center"> {/* Added flex container */}
                    <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-500" />
                    <input 
                      type="text" 
                      value={trainingSearch} 
                      onFocus={() => setShowTrainingSuggestions(true)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTrainingSearch(e.target.value); setShowTrainingSuggestions(true); }} // FIX: Type e
                      className={`w-full rounded-lg pl-6 pr-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                    />
                    {trainingSearch && ( // Only show clear button if there's text
                      <button 
                        onClick={() => { setTrainingSearch(""); setTraining(prev => ({...prev, location: "", coords: { lat: 0, lng: 0 }})); }}
                        className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors z-20" // Adjusted right position to not overlap with Home button
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
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setTraining({...training, dateOffset: parseInt(e.target.value)}); setManualStartHour(null); }} // FIX: Type e
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTraining({...training, distance: parseInt(e.target.value)}); setManualStartHour(null); }} // FIX: Type e
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualStartHour(parseInt(e.target.value))} // FIX: Type e
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => { // FIX: Type e
                        setHomeSearch(e.target.value);
                        setEditSettings((prevEditSettings: CommuteSettings) => ({...prevEditSettings, homeLocation: e.target.value})); // FIX: Type prevEditSettings
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
                   <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Transit Destination</label>
                   <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Start typing Belgian city..."
                      value={workSearch} 
                      onFocus={() => setShowWorkSuggestions(true)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => { // FIX: Type e
                        setWorkSearch(e.target.value);
                        setEditSettings((prevEditSettings: CommuteSettings) => ({...prevEditSettings, workLocation: e.target.value})); // FIX: Type prevEditSettings
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
                     <button key={lang} onClick={(e: React.MouseEvent<HTMLButtonElement>) => setEditSettings((prevEditSettings: CommuteSettings) => ({...prevEditSettings, language: lang as Language}))} className={`flex-1 py-1.5 rounded-lg font-black text-[9px] transition-all ${editSettings.language === lang ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{lang.toUpperCase()}</button> // FIX: Type e and prevEditSettings
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
                        <input type="time" value={editSettings.morningWindow[0]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditSettings((prevEditSettings: CommuteSettings) => ({...prevEditSettings, morningWindow: [e.target.value, prevEditSettings.morningWindow[1]]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" /> {/* FIX: Type e and prevEditSettings */}
                        <span className="text-slate-600 text-[10px]">→</span>
                        <input type="time" value={editSettings.morningWindow[1]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditSettings((prevEditSettings: CommuteSettings) => ({...prevEditSettings, morningWindow: [prevEditSettings.morningWindow[0], e.target.value]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" /> {/* FIX: Type e and prevEditSettings */}
                      </div>
                    </div>
                    <div className={`border rounded-xl p-2.5 flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                         <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Evening</span>
                         <Clock className="w-2.5 h-2.5 text-orange-400 opacity-50" />
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="time" value={editSettings.eveningWindow[0]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditSettings((prevEditSettings: CommuteSettings) => ({...prevEditSettings, eveningWindow: [e.target.value, prevEditSettings.eveningWindow[1]]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" /> {/* FIX: Type e and prevEditSettings */}
                        <span className="text-slate-600 text-[10px]">→</span>
                        <input type="time" value={editSettings.eveningWindow[1]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditSettings((prevEditSettings: CommuteSettings) => ({...prevEditSettings, eveningWindow: [prevEditSettings.eveningWindow[0], e.target.value]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" /> {/* FIX: Type e and prevEditSettings */}
                      </div>
                    </div>
                  </div>
               </div>

               <div className="flex flex-col gap-1.5 pt-1">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Intelligence Engine</label>
                 <button 
                   onClick={(e: React.MouseEvent<HTMLButtonElement>) => setEditSettings((prevEditSettings: CommuteSettings) => ({...prevEditSettings, disableAI: !prevEditSettings.disableAI}))} // FIX: Type e and prevEditSettings
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
                   onClick={(e: React.MouseEvent<HTMLButtonElement>) => { setViewMode('training'); setIsSettingsOpen(false); setManualStartHour(null); }} // FIX: Type e
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
                content={t.purposeContent} 
              />
              <AccordionItem 
                id="score" 
                title="HOW THE SCORE WORKS" 
                content={t.commuteScoreContent} 
              />
              <AccordionItem
                id="training-mode"
                title="TRAINING MODE"
                content="Enter training mode to plan and optimize your cycling workouts. This feature allows you to select a training area, set your desired distance, and choose a specific day. The app then scans various time windows to suggest the optimal start time based on weather conditions, providing tactical advice for your session and even suggesting route turning points or alternative starting locations."
              />
              <AccordionItem 
                id="retrieval" 
                title="DATA VS. INTELLIGENCE" 
                content={t.generalSourcesContent} 
              />
              <AccordionItem 
                id="ice" 
                title="ICE RISK" 
                content={TRANSLATIONS[settings.language].iceRiskContent} 
              />
              <AccordionItem 
                id="surface" 
                title="SURFACE" 
                content={TRANSLATIONS[settings.language].surfaceConditionContent} 
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