// Fix: Import React to resolve 'Cannot find namespace React' errors for types like React.FC and React.ChangeEvent
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CommuteSettings, Coordinates, Language, TrainingState, LocationSuggestion, WeatherCondition, Equipment, EquipmentType } from './types'; 
import { BelgianLocation } from './locations';
import { DEFAULT_SETTINGS, TRANSLATIONS, BELGIAN_CITIES } from './constants';
import { BELGIAN_LOCATIONS } from './locations';
import { WeatherCard } from './components/WeatherCard';
import { WeeklyForecast } from './components/WeeklyForecast';
import { TrainingView } from './components/TrainingView';
import { 
  getTelemetryBatch,
  getAIInsights,
  getTrainingSessionAIAdvice,
  getCommuteRoadDistance, 
  fetchRawWeatherData, 
  aggregateRawWeather, 
  getStandardizedAdvice,
  calculateBearing,
  calculateDistance,
  getGlobalLocationSuggestions,
  resolveAddress,
  isAIFallingBack,
  currentLLMModel,           // New import
  currentLLMModelPriorityLabel, // New import
  remainingLLMAlternativesCount // New import
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
  EyeOff,
  Search,
  Trophy,
  Home, 
  MapPin,
  Bike,
  Shirt,
  Compass,
  Globe,
  Activity,
  Server,
  CloudLightning,
  AlertCircle,
  Plus,
  Trash2,
  Gauge,
  ArrowLeft
} from 'lucide-react';

const ROAD_DETOUR_FACTOR = 1.32;
const CACHE_KEY = 'commute_iq_pulse_cache_v2';
const AVG_TRAINING_SPEED = 28.5; // km/h

const getLocality = (address: string): string => {
  if (!address) return '---';
  const parts = address.split(',').map(p => p.trim());
  return parts[0].replace(/^\d+\s+/, '').toUpperCase();
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

// Fix: Define a specific interface for connectionStatus to resolve TypeScript errors
interface ConnectionStatusState {
  'Open-Meteo': 'checking' | 'ok' | 'fail' | 'fallback';
  'Gemini LLM': 'checking' | 'ok' | 'fail' | 'fallback';
  'Google Maps': 'checking' | 'ok' | 'fail' | 'fallback';
  llmDetails: { model: string | null; priority: string | null; alternatives: number | null };
}

const App: React.FC = () => {
  const [settings, setSettings] = useState<CommuteSettings>(() => {
    const saved = localStorage.getItem('velo_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return { 
      ...DEFAULT_SETTINGS, 
      ...parsed,
      homeCoords: parsed.homeCoords || DEFAULT_SETTINGS.homeCoords,
      workCoords: parsed.workCoords || DEFAULT_SETTINGS.workCoords,
      equipment: parsed.equipment || DEFAULT_SETTINGS.equipment || []
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
  const [isEquipmentViewOpen, setIsEquipmentViewOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isConnectivityOpen, setIsConnectivityOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [expandedInfoItem, setExpandedInfoItem] = useState<string | null>(null);

  // New Equipment Form State
  const [isAddingEquipment, setIsAddingEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState<Partial<Equipment>>({
    type: 'Road Bike',
    tireWidth: 28,
    riderWeight: 75
  });

  // Fix: Use the newly defined ConnectionStatusState interface for the state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusState>({
    'Open-Meteo': 'checking',
    'Gemini LLM': 'checking',
    'Google Maps': 'checking',
    llmDetails: { model: null, priority: null, alternatives: null }
  });

  const checkConnections = useCallback(async () => {
    // Fix: Ensure the initial state update also uses the new interface
    setConnectionStatus({
      'Open-Meteo': 'checking',
      'Gemini LLM': 'checking',
      'Google Maps': 'checking',
      llmDetails: { model: null, priority: null, alternatives: null }
    });
    
    // Check Telemetry
    try {
      await fetchRawWeatherData({ lat: 51.0, lng: 3.7 });
      // Fix: Update state correctly using the ConnectionStatusState interface
      setConnectionStatus(prev => ({ ...prev, 'Open-Meteo': 'ok' }));
    } catch (e) {
      // Fix: Update state correctly using the ConnectionStatusState interface
      setConnectionStatus(prev => ({ ...prev, 'Open-Meteo': 'fail' }));
    }

    // Check Gemini & Maps via resolveAddress (uses both)
    try {
      await resolveAddress("Brussels");
      // Fix: Update state correctly using the ConnectionStatusState interface
      setConnectionStatus(prev => ({ 
        ...prev, 
        'Gemini LLM': isAIFallingBack ? 'fallback' : 'ok', 
        'Google Maps': 'ok',
        llmDetails: {
          model: currentLLMModel,
          priority: currentLLMModelPriorityLabel,
          alternatives: remainingLLMAlternativesCount,
        }
      }));
    } catch (e) {
      // Fix: Update state correctly using the ConnectionStatusState interface
      setConnectionStatus(prev => ({ 
        ...prev, 
        'Gemini LLM': 'fail', 
        'Google Maps': 'fail',
        llmDetails: {
          model: currentLLMModel,
          priority: currentLLMModelPriorityLabel,
          alternatives: remainingLLMAlternativesCount,
        }
      }));
    }
  }, []);

  useEffect(() => {
    if (isConnectivityOpen) checkConnections();
  }, [isConnectivityOpen, checkConnections]);

  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [isAdviceExpanded, setIsAdviceExpanded] = useState(false);

  const [training, setTraining] = useState<TrainingState>(() => {
    const initialSettings: CommuteSettings = localStorage.getItem('velo_settings') ? JSON.parse(localStorage.getItem('velo_settings')!) : DEFAULT_SETTINGS;
    return {
      location: initialSettings.homeLocation || "Gent", 
      coords: initialSettings.homeCoords || { lat: 51.0543, lng: 4.7005 }, 
      distance: 50, // Updated default to 50km as requested
      dateOffset: 0,
      preferredDirection: 0
    };
  });
  const [trainingSearch, setTrainingSearch] = useState(() => {
    const initialSettings: CommuteSettings = localStorage.getItem('velo_settings') ? JSON.parse(localStorage.getItem('velo_settings')!) : DEFAULT_SETTINGS;
    return initialSettings.homeLocation || "Gent";
  });
  const [showTrainingSuggestions, setShowTrainingSuggestions] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [manualStartHour, setManualStartHour] = useState<number | null>(null);
  
  const [trainingSlots, setTrainingSlots] = useState<any[]>([]);

  const bestStartHour = useMemo(() => {
    if (!trainingSlots.length) return null;
    const best = trainingSlots.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), trainingSlots[0]);
    return best.startHour;
  }, [trainingSlots]);

  const activeTrainingSlot = useMemo(() => {
    if (!trainingSlots.length) return null;
    const hourToFind = manualStartHour !== null ? manualStartHour : bestStartHour;
    return trainingSlots.find(s => s.startHour === hourToFind) || trainingSlots[0];
  }, [trainingSlots, manualStartHour, bestStartHour]);

  const [homeSearch, setHomeSearch] = useState(settings.homeLocation);
  const [workSearch, setWorkSearch] = useState(settings.workLocation);
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [showWorkSuggestions, setShowWorkSuggestions] = useState(false);

  const [globalHomeResults, setGlobalHomeResults] = useState<BelgianLocation[]>([]);
  const [globalWorkResults, setGlobalWorkResults] = useState<BelgianLocation[]>([]);
  const [globalTrainingResults, setGlobalTrainingResults] = useState<BelgianLocation[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState({ home: false, work: false, training: false });

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

  useEffect(() => {
    if (homeSearch.length < 3) { setGlobalHomeResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingGlobal(prev => ({ ...prev, home: true }));
      const results = await getGlobalLocationSuggestions(homeSearch);
      setGlobalHomeResults(results);
      setIsSearchingGlobal(prev => ({ ...prev, home: false }));
    }, 700);
    return () => clearTimeout(timer);
  }, [homeSearch]);

  useEffect(() => {
    if (workSearch.length < 3) { setGlobalWorkResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingGlobal(prev => ({ ...prev, work: true }));
      const results = await getGlobalLocationSuggestions(workSearch);
      setGlobalWorkResults(results);
      setIsSearchingGlobal(prev => ({ ...prev, work: false }));
    }, 700);
    return () => clearTimeout(timer);
  }, [workSearch]);

  useEffect(() => {
    if (trainingSearch.length < 3) { setGlobalTrainingResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingGlobal(prev => ({ ...prev, training: true }));
      const results = await getGlobalLocationSuggestions(trainingSearch);
      setGlobalTrainingResults(results);
      setIsSearchingGlobal(prev => ({ ...prev, training: false }));
    }, 700);
    return () => clearTimeout(timer);
  }, [trainingSearch]);

  const syncFullWeek = useCallback(async (currentSettings: CommuteSettings, isSilent = false, specificOffsets?: number[]) => {
    // Extended to 14 days to support data-driven "Next Optimal Weekday" search
    const allOffsets = specificOffsets || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    if (!isSilent) setLoading(true);
    setLoadingOffsets(prev => [...new Set([...prev, ...allOffsets])]);
    try {
      const telemetryBatch = await getTelemetryBatch(currentSettings, allOffsets);
      setPulseDataMap(prev => {
        const next = { ...prev, ...telemetryBatch };
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });
      if (!isSilent) setLoading(false);
      setLoadingOffsets(prev => prev.filter(o => !allOffsets.includes(o)));
      if (!currentSettings.disableAI) {
        try {
          // Process AI insights for primary 7 days only to save tokens/latency
          const aiPrimaryOffsets = allOffsets.filter(o => o <= 6);
          if (aiPrimaryOffsets.length > 0) {
            const telemetryForAI: Record<number, any> = {};
            aiPrimaryOffsets.forEach(o => { if (telemetryBatch[o]) telemetryForAI[o] = telemetryBatch[o]; });
            
            const aiInsights = await getAIInsights(currentSettings, telemetryForAI);
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
                      morning: { 
                        ...next[offset].weather.morning, 
                        surfaceReason: aiInsights[offset].morning.summary,
                        ridingStyleAdvice: aiInsights[offset].morning.style,
                        bikeSetupAdvice: aiInsights[offset].morning.setup,
                        clothingAdvice: aiInsights[offset].morning.clothing,
                        performanceAdvice: aiInsights[offset].morning.performance
                      },
                      evening: { 
                        ...next[offset].weather.evening, 
                        surfaceReason: aiInsights[offset].evening.summary,
                        ridingStyleAdvice: aiInsights[offset].evening.style,
                        bikeSetupAdvice: aiInsights[offset].evening.setup,
                        clothingAdvice: aiInsights[offset].evening.clothing,
                        performanceAdvice: aiInsights[offset].evening.performance
                      }
                    }
                  };
                }
              });
              localStorage.setItem(CACHE_KEY, JSON.stringify(next));
              return next;
            });
          }
        } catch (aiErr) {
          console.error("Background AI sync failed", aiErr);
        }
      }
    } catch (err: any) {
      console.error("Full week sync failed:", err);
    } finally {
      setLoadingOffsets(prev => prev.filter(o => !allOffsets.includes(o)));
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Trigger sync for selected offset if missing (supports navigating to 'Next Optimal Weekday')
  useEffect(() => {
    if (viewMode === 'daily' && !pulseDataMap[selectedDateOffset] && !loadingOffsets.includes(selectedDateOffset)) {
      syncFullWeek(settings, false, [selectedDateOffset]);
    }
  }, [selectedDateOffset, viewMode, pulseDataMap, settings, syncFullWeek, loadingOffsets]);

  useEffect(() => {
    if (!initialSyncStarted.current) {
      initialSyncStarted.current = true;
      const checkNeedsSync = () => {
        // Only require daily sync for the standard week
        const allOffsets = [0, 1, 2, 3, 4, 5, 6];
        const now = Date.now();
        return allOffsets.some(offset => {
          const cached = pulseDataMap[offset];
          if (!cached) return true;
          const ageHours = (now - (cached.lastUpdated || 0)) / (1000 * 60 * 60);
          return ageHours > 1; 
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
        const condition = aggregateRawWeather(slice, 0, true, settings, sunTimesCurrent, minPastTemp, window, undefined, undefined, true);
        scanWindowsCurrent.push({ startHour: hour, condition, window, score: condition.score });
      }

      const windDirFrom = scanWindowsCurrent[0].condition.windDirection; 
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

      const userHomeOrTrainingCoords = settings.homeCoords || training.coords;
      const nearbyCandidateLocations = BELGIAN_LOCATIONS.filter(loc => {
        const dist = calculateDistance(userHomeOrTrainingCoords, { lat: loc.lat, lng: loc.lng });
        return dist >= 40 && dist <= 80 && loc.name !== training.location;
      });
      const betterLocationSuggestions: LocationSuggestion[] = [];
      const candidatesToProcess = shuffleArray(nearbyCandidateLocations).slice(0, 15); 
      for (const candidateLoc of candidatesToProcess) {
        let candidateRaw: any;
        try { candidateRaw = await fetchRawWeatherData({ lat: candidateLoc.lat, lng: candidateLoc.lng }); } catch (e: any) { continue; }
        betterLocationSuggestions.push({ name: candidateLoc.name, lat: candidateLoc.lat, lng: candidateLoc.lng, score: 100 });
      }

      const allUpdated = scanWindowsCurrent.map(s => ({
        ...s,
        optimizationAdvice: routeSuggestions.map(rs => ({ name: rs.name, distanceFromTrainingCenter: rs.distFromCenter, lat: training.coords.lat, lng: training.coords.lng })),
        locationAdvice: betterLocationSuggestions.map(bl => ({...bl, distanceFromHome: calculateDistance(userHomeOrTrainingCoords, bl)}))
      }));

      setTrainingSlots(allUpdated);
      
      if (manualStartHour === null) {
        const bestHour = allUpdated.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), allUpdated[0]).startHour;
        setManualStartHour(bestHour);
      }
    } catch (e: any) { console.error(e); } finally { setTrainingLoading(false); }
  }, [training, settings, manualStartHour]);

  useEffect(() => {
    if (viewMode === 'training') syncTraining();
  }, [viewMode, training.location, training.distance, training.dateOffset, syncTraining]);

  // EFFECT TO ENHANCE ACTIVE TRAINING SLOT WITH AI ADVICE
  useEffect(() => {
    if (viewMode === 'training' && activeTrainingSlot && !activeTrainingSlot.isAIEnhanced && !settings.disableAI) {
      const fetchAIAdvice = async () => {
        try {
          const aiAdvice = await getTrainingSessionAIAdvice(settings, activeTrainingSlot.condition, training.distance);
          setTrainingSlots(prev => prev.map(slot => {
            if (slot.startHour === activeTrainingSlot.startHour) {
              return {
                ...slot,
                isAIEnhanced: true,
                condition: {
                  ...slot.condition,
                  surfaceReason: aiAdvice.summary,
                  ridingStyleAdvice: aiAdvice.style,
                  bikeSetupAdvice: aiAdvice.setup,
                  clothingAdvice: aiAdvice.clothing,
                  performanceAdvice: aiAdvice.performance
                }
              };
            }
            return slot;
          }));
        } catch (e) {
          console.error("Training AI enhancement failed", e);
        }
      };
      
      const timer = setTimeout(fetchAIAdvice, 800); // Debounce AI call
      return () => clearTimeout(timer);
    }
  }, [activeTrainingSlot, viewMode, settings.disableAI, training.distance, settings]);

  const handleSave = async () => {
    setLoading(true);
    let roadDistance = editSettings.roadDistance;
    const locationChanged = editSettings.homeLocation !== settings.homeLocation || editSettings.workLocation !== settings.workLocation;
    const equipmentChanged = JSON.stringify(editSettings.equipment) !== JSON.stringify(settings.equipment);
    
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
    if (locationChanged || editSettings.disableAI !== settings.disableAI || equipmentChanged) { 
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

  // --- Equipment Handlers ---
  const handleAddEquipment = () => {
    if (!newEquipment.name) return;
    const newBike: Equipment = {
      id: Date.now().toString(),
      name: newEquipment.name || 'New Bike',
      type: newEquipment.type || 'Road Bike',
      tireWidth: newEquipment.tireWidth || 28,
      riderWeight: newEquipment.riderWeight || 75,
      isSelected: true // Auto select new bike
    };
    setEditSettings(prev => ({
      ...prev,
      equipment: [
        ...prev.equipment.map(e => ({ ...e, isSelected: false })), // Deselect others
        newBike
      ]
    }));
    setIsAddingEquipment(false);
    setNewEquipment({ type: 'Road Bike', tireWidth: 28, riderWeight: 75 });
  };

  const handleSelectEquipment = (id: string) => {
    setEditSettings(prev => ({
      ...prev,
      equipment: prev.equipment.map(e => ({
        ...e,
        isSelected: e.id === id
      }))
    }));
  };

  const handleDeleteEquipment = (id: string) => {
    setEditSettings(prev => {
      const remaining = prev.equipment.filter(e => e.id !== id);
      // If deleted bike was selected, select the first available or none
      if (prev.equipment.find(e => e.id === id)?.isSelected && remaining.length > 0) {
        remaining[0].isSelected = true;
      }
      return { ...prev, equipment: remaining };
    });
  };

  const getBikeIcon = (type: EquipmentType) => {
    switch(type) {
      case 'Mountainbike': return <Activity className="w-4 h-4" />;
      case 'Speedpedelec': return <Zap className="w-4 h-4" />;
      case 'Gravel Bike': return <Compass className="w-4 h-4" />;
      default: return <Bike className="w-4 h-4" />;
    }
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

  const activeWeather = useMemo(() => {
    return activeLegIndex === 0 ? primaryData.condition : secondaryData.condition;
  }, [activeLegIndex, primaryData, secondaryData]);

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

  const filterLocationsWithGlobal = (query: string, globalResults: BelgianLocation[]) => {
    if (query.length < 2) return [];
    const local = BELGIAN_LOCATIONS.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
    const uniqueLocal = local.filter((loc, index, self) =>
      index === self.findIndex((t) => t.name === loc.name)
    ).slice(0, 5);
    
    const filteredGlobal = globalResults.filter(g => !uniqueLocal.some(l => l.name.toLowerCase() === g.name.toLowerCase()));
    return [...uniqueLocal, ...filteredGlobal].slice(0, 8);
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
                  <button key={o} onClick={() => { setSelectedDateOffset(o); setViewMode('daily'); setIsDateDropdownOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-tight transition-colors ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <span>{o === 0 ? 'TODAY' : `${l.name} ${l.num} ${l.month}`}</span>
                    {isSelected && <Check className="w-2.5 h-2.5" />}
                  </button>
                );
              })}
              <div className={`h-px my-1.5 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />
              <button onClick={() => { setViewMode('weekly'); setIsDateDropdownOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-500/10">
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
            <div 
              className={`min-h-0 transition-all duration-500 ease-in-out ${activeLegIndex === 0 && !isAdviceExpanded ? 'flex-[3]' : 'flex-[1]'}`}
              onClick={() => {
                if (isAdviceExpanded) setIsAdviceExpanded(false);
                if (activeLegIndex !== 0) setActiveLegIndex(0);
              }}
            >
              <WeatherCard 
                {...primaryData} 
                distance={displayedDistance} 
                safetyScore={primaryData.score} 
                theme={settings.theme} 
                compact={activeLegIndex !== 0 || isAdviceExpanded}
              />
            </div>

            <button 
              onClick={() => setIsAdviceExpanded(!isAdviceExpanded)} 
              className={`flex-none border rounded-[2rem] p-5 flex flex-col gap-3 active:scale-[0.99] transition-all duration-500 ease-in-out overflow-hidden shadow-xl ${
                isAdviceExpanded 
                  ? (isDark ? 'bg-blue-600/10 border-blue-500/40 ring-1 ring-blue-500/20 h-auto' : 'bg-white border-blue-200 shadow-blue-500/10 h-auto')
                  : (isDark ? 'bg-blue-500/5 border-blue-500/20 shadow-blue-500/5' : 'bg-white border-blue-100 shadow-sm')
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg transition-colors ${isAdviceExpanded ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className={`text-[11px] font-black uppercase tracking-[0.25em] ${isAdviceExpanded || isCurrentDayEnhanced ? 'text-blue-500' : 'text-slate-500'}`}>
                    {isCurrentDayEnhanced ? 'Commute Intelligence' : 'Basic Telemetry'}
                  </span>
                </div>
                {isAdviceExpanded ? (
                  <ChevronDown className="w-4 h-4 text-blue-500 rotate-180 transition-transform" />
                ) : (
                  !isCurrentDayEnhanced && !settings.disableAI && (
                    <div className="flex items-center gap-1.5">
                      <RefreshCw className="w-2.5 h-2.5 text-blue-400 animate-spin" />
                    </div>
                  )
                )}
              </div>
              
              {!isAdviceExpanded ? (
                <p className={`text-[13px] font-medium leading-[1.5] text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {activeWeather?.surfaceReason || (loadingOffsets.length > 0 ? "Connecting to weather satellite..." : "Processing telemetry for tactical riding advice...")}
                </p>
              ) : (
                <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Compass className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Riding Style Advice</span>
                    </div>
                    <p className={`text-[13px] font-semibold leading-[1.5] text-left ${isDark ? 'text-white' : 'text-slate-950'}`}>
                      {activeWeather?.ridingStyleAdvice || "Standard defensive riding protocols."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Bike className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Bike Setup Advice</span>
                    </div>
                    <p className={`text-[13px] font-semibold leading-[1.5] text-left ${isDark ? 'text-white' : 'text-slate-950'}`}>
                      {activeWeather?.bikeSetupAdvice || "Check tire pressure and clean drive-train."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Shirt className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Clothing Advice</span>
                    </div>
                    <p className={`text-[13px] font-semibold leading-[1.5] text-left ${isDark ? 'text-white' : 'text-slate-950'}`}>
                      {activeWeather?.clothingAdvice || "Standard seasonal cycling kit."}
                    </p>
                  </div>
                </div>
              )}
            </button>

            <div 
              className={`min-h-0 transition-all duration-500 ease-in-out ${activeLegIndex === 1 && !isAdviceExpanded ? 'flex-[3]' : 'flex-[1]'}`}
              onClick={() => {
                if (isAdviceExpanded) setIsAdviceExpanded(false);
                if (activeLegIndex !== 1) setActiveLegIndex(1);
              }}
            >
              <WeatherCard 
                {...secondaryData} 
                distance={displayedDistance}
                safetyScore={secondaryData.score} 
                theme={settings.theme} 
                compact={activeLegIndex !== 1 || isAdviceExpanded}
              />
            </div>
          </div>
        )}
        {viewMode === 'weekly' && (
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
            <WeeklyForecast pulseDataMap={pulseDataMap} loadingOffsets={loadingOffsets} theme={settings.theme} onSelectDay={(offset: number) => { setSelectedDateOffset(offset); setViewMode('daily'); }} />
          </div>
        )}
        {viewMode === 'training' && (
          <TrainingView 
            isDark={isDark}
            training={training}
            trainingSearch={trainingSearch}
            showTrainingSuggestions={showTrainingSuggestions}
            trainingData={activeTrainingSlot}
            trainingLoading={trainingLoading}
            manualStartHour={manualStartHour}
            bestStartHour={bestStartHour}
            theme={settings.theme}
            onReturn={() => setViewMode('daily')}
            onSearchChange={(val) => { setTrainingSearch(val); setShowTrainingSuggestions(true); }}
            onSetToHome={handleSetTrainingToHome}
            onDateOffsetChange={(offset) => { setTraining(prev => ({...prev, dateOffset: offset})); setManualStartHour(null); }}
            onDistanceChange={(dist) => { setTraining(prev => ({...prev, distance: dist})); setManualStartHour(null); }}
            onManualHourChange={(hour) => setManualStartHour(hour)}
            onSelectSuggestion={(loc) => handleSelectSuggestion('training', loc)}
            filterLocations={filterLocationsWithGlobal}
            globalTrainingResults={globalTrainingResults}
            getDayLabel={getDayLabel}
          />
        )}
      </main>

      {isSettingsOpen && (
        <div className={`fixed inset-0 z-[200] flex flex-col animate-in fade-in duration-300 ${isDark ? 'bg-[#05070a]' : 'bg-white'}`}>
          <div className="flex-1 max-w-md mx-auto w-full flex flex-col px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] h-full">
            
            {/* Main Settings Header */}
            {!isEquipmentViewOpen && (
              <div className="flex items-center justify-between pb-1.5 flex-none">
                <h2 className={`text-xl font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}><X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-900'}`} /></button>
              </div>
            )}

            {/* Equipment View Header */}
            {isEquipmentViewOpen && (
              <div className="flex items-center justify-between pb-1.5 flex-none">
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsEquipmentViewOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}><ArrowLeft className={`w-4 h-4 ${isDark ? 'text-white' : 'text-slate-900'}`} /></button>
                  <h2 className={`text-lg font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Equipment Overview</h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}><X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-900'}`} /></button>
              </div>
            )}
            
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto hide-scrollbar pb-4 gap-3">
               
               {/* EQUIPMENT SUB-VIEW */}
               {isEquipmentViewOpen ? (
                 <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Your Garage</span>
                      {!isAddingEquipment && (
                        <button onClick={() => setIsAddingEquipment(true)} className="flex items-center gap-1 text-[9px] font-bold uppercase text-blue-500 hover:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                          <Plus className="w-3 h-3" /> Add Bike
                        </button>
                      )}
                    </div>

                    {isAddingEquipment ? (
                      <div className={`p-4 rounded-2xl border flex flex-col gap-3 animate-in fade-in zoom-in-95 ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-white border-slate-200'}`}>
                        <input 
                          type="text" 
                          placeholder="Bike Name (e.g. Canyon Aeroad)" 
                          value={newEquipment.name || ''}
                          onChange={(e) => setNewEquipment({...newEquipment, name: e.target.value})}
                          className={`w-full p-2.5 rounded-xl text-xs font-medium outline-none border transition-all ${isDark ? 'bg-black/40 border-white/10 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                        />
                        
                        <div className="grid grid-cols-2 gap-2">
                          <select 
                            value={newEquipment.type}
                            onChange={(e) => setNewEquipment({...newEquipment, type: e.target.value as EquipmentType})}
                            className={`w-full p-2.5 rounded-xl text-xs font-medium outline-none border appearance-none ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                          >
                            <option value="Road Bike">Road Bike</option>
                            <option value="Gravel Bike">Gravel Bike</option>
                            <option value="Mountainbike">Mountainbike</option>
                            <option value="Speedpedelec">Speedpedelec</option>
                          </select>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input 
                                type="number" 
                                placeholder="Width"
                                value={newEquipment.tireWidth}
                                onChange={(e) => setNewEquipment({...newEquipment, tireWidth: Number(e.target.value)})}
                                className={`w-full p-2.5 rounded-xl text-xs font-medium outline-none border pl-2 pr-8 ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">mm</span>
                            </div>
                            <div className="relative flex-1">
                              <input 
                                type="number" 
                                placeholder="Weight"
                                value={newEquipment.riderWeight}
                                onChange={(e) => setNewEquipment({...newEquipment, riderWeight: Number(e.target.value)})}
                                className={`w-full p-2.5 rounded-xl text-xs font-medium outline-none border pl-2 pr-8 ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">kg</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-1">
                          <button onClick={() => setIsAddingEquipment(false)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>Cancel</button>
                          <button onClick={handleAddEquipment} disabled={!newEquipment.name} className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase bg-blue-600 text-white disabled:opacity-50">Save Bike</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {editSettings.equipment && editSettings.equipment.length > 0 ? (
                          editSettings.equipment.map(bike => (
                            <div 
                              key={bike.id} 
                              onClick={() => handleSelectEquipment(bike.id)}
                              className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${bike.isSelected ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/20' : isDark ? 'bg-slate-900/50 border-white/5 hover:bg-white/5' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${bike.isSelected ? 'bg-white/20 text-white' : isDark ? 'bg-white/5 text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>
                                  {getBikeIcon(bike.type)}
                                </div>
                                <div className="flex flex-col">
                                  <span className={`text-xs font-bold ${bike.isSelected ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-900'}`}>{bike.name}</span>
                                  <span className={`text-[9px] font-medium ${bike.isSelected ? 'text-blue-100' : 'text-slate-500'}`}>{bike.type} • {bike.tireWidth}mm • {bike.riderWeight}kg</span>
                                </div>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteEquipment(bike.id); }}
                                className={`p-2 rounded-lg transition-colors ${bike.isSelected ? 'text-blue-200 hover:bg-white/20 hover:text-white' : 'text-slate-500 hover:bg-red-500/10 hover:text-red-500'}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className={`p-4 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-2 text-center ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
                            <Bike className="w-6 h-6 opacity-50" />
                            <span className="text-[10px] font-medium">No equipment added yet.<br/>Add a bike for tailored pressure advice.</span>
                          </div>
                        )}
                      </div>
                    )}
                 </div>
               ) : (
                 // MAIN SETTINGS VIEW
                 <div className="flex flex-col gap-3 animate-in slide-in-from-left-4 duration-300">
                   <div className="flex flex-col gap-1.5">
                     <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">System Appearance</label>
                     <div className={`flex rounded-2xl p-1 border transition-all ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                       <button onClick={() => handleImmediateThemeChange('light')} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${settings.theme === 'light' ? 'bg-white text-blue-600 shadow-lg shadow-blue-500/10 border border-blue-500/10' : 'text-slate-500'}`}><Sun className="w-4 h-4" />Light</button>
                       <button onClick={() => handleImmediateThemeChange('dark')} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${settings.theme === 'dark' ? 'bg-slate-800 text-blue-400 shadow-lg shadow-black/20 border border-white/10' : 'text-slate-500'}`}><Moon className="w-4 h-4" />Dark</button>
                     </div>
                   </div>

                   <div className="flex flex-col gap-1.5">
                     <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Profile Configuration</label>
                     
                     <div className="flex flex-col gap-1.5">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                          <input type="text" placeholder="Home Location..." value={homeSearch} onFocus={() => setShowHomeSuggestions(true)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setHomeSearch(e.target.value); setEditSettings((prev: CommuteSettings) => ({...prev, homeLocation: e.target.value})); setShowHomeSuggestions(true); }} className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} />
                          {homeSearch && ( 
                            <button onClick={() => { setHomeSearch(""); setEditSettings(prev => ({...prev, homeLocation: "", homeCoords: undefined})); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors" aria-label="Clear home location"><X className="w-3.5 h-3.5" /></button>
                          )}
                          {showHomeSuggestions && filterLocationsWithGlobal(homeSearch, globalHomeResults).length > 0 && (
                            <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                              {filterLocationsWithGlobal(homeSearch, globalHomeResults).map(loc => {
                                  const isGlobal = !BELGIAN_LOCATIONS.some(bl => bl.name === loc.name);
                                  return (
                                    <button key={loc.name} onClick={() => handleSelectSuggestion('home', loc)} className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}>
                                      <span>{loc.name}</span>
                                      {isGlobal && <Globe className="w-3 h-3 text-blue-500/50" />}
                                    </button>
                                  );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                          <input type="text" placeholder="Work Location..." value={workSearch} onFocus={() => setShowWorkSuggestions(true)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setWorkSearch(e.target.value); setEditSettings((prev: CommuteSettings) => ({...prev, workLocation: e.target.value})); setShowWorkSuggestions(true); }} className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} />
                          {workSearch && ( 
                            <button onClick={() => { setWorkSearch(""); setEditSettings(prev => ({...prev, workLocation: "", workCoords: undefined})); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors" aria-label="Clear work location"><X className="w-3.5 h-3.5" /></button>
                          )}
                          {showWorkSuggestions && filterLocationsWithGlobal(workSearch, globalWorkResults).length > 0 && (
                            <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                              {filterLocationsWithGlobal(workSearch, globalWorkResults).map(loc => {
                                  const isGlobal = !BELGIAN_LOCATIONS.some(bl => bl.name === loc.name);
                                  return (
                                    <button key={loc.name} onClick={() => handleSelectSuggestion('work', loc)} className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}>
                                      <span>{loc.name}</span>
                                      {isGlobal && <Globe className="w-3 h-3 text-blue-500/50" />}
                                    </button>
                                  );
                              })}
                            </div>
                          )}
                        </div>
                     </div>
                   </div>

                   <div className="flex flex-col gap-1.5">
                     <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Commute Schedule</label>
                     <div className="grid grid-cols-2 gap-2.5">
                       <div className={`border rounded-xl p-2.5 flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                         <div className="flex items-center justify-between"><span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Morning</span><Clock className="w-2.5 h-2.5 text-blue-500 opacity-50" /></div>
                         <div className="flex items-center gap-1">
                           <input type="time" value={editSettings.morningWindow[0]} onChange={(e) => setEditSettings((prev: CommuteSettings) => ({...prev, morningWindow: [e.target.value, prev.morningWindow[1]]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                           <span className="text-slate-600 text-[10px]">→</span>
                           <input type="time" value={editSettings.morningWindow[1]} onChange={(e) => setEditSettings((prev: CommuteSettings) => ({...prev, morningWindow: [prev.morningWindow[0], e.target.value]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                         </div>
                       </div>
                       <div className={`border rounded-xl p-2.5 flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                         <div className="flex items-center justify-between"><span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Evening</span><Clock className="w-2.5 h-2.5 text-orange-400 opacity-50" /></div>
                         <div className="flex items-center gap-1">
                           <input type="time" value={editSettings.eveningWindow[0]} onChange={(e) => setEditSettings((prev: CommuteSettings) => ({...prev, eveningWindow: [e.target.value, prev.eveningWindow[1]]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                           <span className="text-slate-600 text-[10px]">→</span>
                           <input type="time" value={editSettings.eveningWindow[1]} onChange={(e) => setEditSettings((prev: CommuteSettings) => ({...prev, eveningWindow: [prev.morningWindow[0], e.target.value]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Equipment Entry Button */}
                   <div className="flex flex-col gap-1.5">
                     <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Equipment</label>
                     <button onClick={() => setIsEquipmentViewOpen(true)} className={`w-full py-3 rounded-xl border flex items-center justify-between px-3.5 transition-all ${isDark ? 'bg-slate-900/50 border-white/5 hover:bg-white/5' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                       <div className="flex items-center gap-2.5">
                         <Bike className="w-4 h-4 text-blue-500" />
                         <div className="flex flex-col items-start">
                           <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Equipment Overview</span>
                           <span className="text-[8px] text-slate-500 font-medium">{editSettings.equipment?.length || 0} bikes configured</span>
                         </div>
                       </div>
                       <div className="p-1 rounded-full bg-blue-500/10"><ChevronDown className="-rotate-90 w-3.5 h-3.5 text-blue-500" /></div>
                     </button>
                   </div>

                   <div className="flex flex-col gap-1.5">
                     <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Intelligence</label>
                     <button onClick={() => setEditSettings((prev: CommuteSettings) => ({...prev, disableAI: !prev.disableAI}))} className={`w-full py-3 rounded-xl border flex items-center justify-between px-3.5 transition-all ${!editSettings.disableAI ? 'bg-blue-600/10 border-blue-500/30' : isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                       <div className="flex items-center gap-2.5">
                         {editSettings.disableAI ? <EyeOff className="w-4 h-4 text-slate-500" /> : <BrainCircuit className="w-4 h-4 text-blue-500" />}
                         <div className="flex flex-col items-start"><span className={`text-[10px] font-black uppercase tracking-widest ${!editSettings.disableAI ? 'text-blue-500' : 'text-slate-500'}`}>AI Analysis</span><span className="text-[8px] text-slate-500 font-medium">Enhanced tactical interpretation</span></div>
                       </div>
                       <div className={`w-8 h-5 rounded-full relative transition-all duration-300 ${!editSettings.disableAI ? 'bg-blue-600' : 'bg-slate-600'}`}>
                         <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 transform ${!editSettings.disableAI ? 'translate-x-3' : 'translate-x-0'}`} />
                       </div>
                     </button>
                   </div>
                   
                   <div className="flex flex-col gap-2 mt-1 pb-4">
                     <button onClick={() => { setViewMode('training'); setIsSettingsOpen(false); setManualStartHour(null); }} className={`w-full py-2.5 rounded-xl border flex items-center gap-3 px-3.5 transition-all ${isDark ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
                       <Trophy className="w-4 h-4" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Training Mode</span>
                     </button>
                     <button onClick={() => setIsConnectivityOpen(true)} className={`w-full py-2.5 rounded-xl border flex items-center gap-3 px-3.5 transition-all ${isDark ? 'bg-blue-500/5 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                       <Activity className="w-4 h-4 text-blue-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Connectivity Hub</span>
                     </button>
                   </div>
                 </div>
               )}
            </div>

            {/* Sticky Save Button - Only on Main Settings */}
            {!isEquipmentViewOpen && (
              <div className="flex-none pt-2">
                <button onClick={handleSave} className="w-full py-3 bg-blue-600 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] text-white shadow-xl shadow-blue-600/25 active:scale-[0.98] transition-all">Save Profile</button>
              </div>
            )}
          </div>
        </div>
      )}

      {isConnectivityOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsConnectivityOpen(false)} />
          <div className={`relative w-full max-sm border rounded-[2rem] flex flex-col shadow-3xl p-6 animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Activity className="w-4 h-4 text-blue-500" /></div>
                <h2 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>Connectivity Status</h2>
              </div>
              <button onClick={() => setIsConnectivityOpen(false)} className={`transition-colors ${isDark ? 'text-slate-600 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}><X className="w-4 h-4" /></button>
            </div>
            
            <div className="space-y-3 mb-6">
              {Object.entries(connectionStatus).filter(([name]) => name !== 'llmDetails').map(([name, status]) => (
                <div key={name} className={`flex items-center justify-between p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    {name === 'Open-Meteo' ? <Server className="w-4 h-4 text-slate-500" /> : name === 'Gemini LLM' ? <BrainCircuit className="w-4 h-4 text-blue-500" /> : <MapPin className="w-4 h-4 text-emerald-500" />}
                    <span className={`text-xs font-bold uppercase tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {status === 'checking' ? (
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                    ) : status === 'ok' ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                        <Check className="w-2.5 h-2.5" />
                        Online
                      </div>
                    ) : status === 'fallback' ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[8px] font-black uppercase tracking-widest">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Fallback
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase tracking-widest">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Failed
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* LLM Specific Details */}
              <div className={`flex flex-col gap-2 p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-1">
                  <BrainCircuit className="w-4 h-4 text-blue-500" />
                  <span className={`text-xs font-bold uppercase tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>LLM Details</span>
                </div>
                {connectionStatus.llmDetails.priority ? (
                  <div className="flex flex-col gap-1 text-[10px] font-medium">
                    <div className="flex items-center justify-between">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                        {connectionStatus.llmDetails.model ? 'Active Model:' : 'Last Attempted:'}
                      </span>
                      <span className={isDark ? 'text-white' : 'text-slate-900'}>
                        {connectionStatus.llmDetails.model || 
                         (connectionStatus.llmDetails.priority.startsWith('All failed') 
                            ? connectionStatus.llmDetails.priority.split('(initial: ')[1]?.replace(')', '') || 'Unknown' 
                            : 'N/A')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Status:</span>
                      <span className={isDark ? 'text-white' : 'text-slate-900'}>
                        {connectionStatus.llmDetails.model ? connectionStatus.llmDetails.priority : 'Failed'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Alternatives Left:</span>
                      <span className={isDark ? 'text-white' : 'text-slate-900'}>{connectionStatus.llmDetails.alternatives}</span>
                    </div>
                  </div>
                ) : (
                  <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    LLM status not yet determined. Ensure API key is configured.
                  </p>
                )}
              </div>
            </div>

            <button onClick={checkConnections} className={`w-full py-3 mb-2 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] bg-blue-600 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2`}>
              <RefreshCw className="w-3.5 h-3.5" />
              Recalibrate Connections
            </button>
            <button onClick={() => setIsConnectivityOpen(false)} className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] transition-all ${isDark ? 'bg-slate-900 border border-white/5 text-slate-500 hover:text-white' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'}`}>Close Hub</button>
          </div>
        </div>
      )}

      {isInfoOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsInfoOpen(false)} />
          <div className={`relative w-full max-sm border rounded-[2rem] flex flex-col shadow-3xl px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Info className="w-3.5 h-3.5 text-blue-500" /></div>
                <h2 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>Information</h2>
              </div>
              <button onClick={() => setIsInfoOpen(false)} className={`transition-colors ${isDark ? 'text-slate-600 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}><X className="w-4 h-4" /></button>
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
            <button onClick={() => setIsInfoOpen(false)} className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] transition-all ${isDark ? 'bg-slate-900 border border-white/5 text-slate-500 hover:text-white' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'}`}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;