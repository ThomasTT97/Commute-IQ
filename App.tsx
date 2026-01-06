
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CommuteSettings, Coordinates, TrainingState, ConnectionStatusState } from './types'; 
import { BelgianLocation } from './locations';
import { DEFAULT_SETTINGS, TRANSLATIONS, ROAD_DETOUR_FACTOR, CACHE_KEY, AVG_TRAINING_SPEED } from './constants';
import { BELGIAN_LOCATIONS } from './locations';
import { WeeklyForecast } from './components/WeeklyForecast';
import { TrainingView } from './components/TrainingView';
import { TrainingWeeklyForecast } from './components/TrainingWeeklyForecast';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { InfoModal } from './components/modals/InfoModal';
import { ConnectivityModal } from './components/modals/ConnectivityModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { DailyView } from './components/views/DailyView';
import { getLocality, shuffleArray, filterLocationsWithGlobal } from './utils/helpers';
import { 
  getTelemetryBatch,
  getAIInsights,
  getCommuteDayAIAdvice,
  getTrainingSessionAIAdvice,
  getCommuteRoadDistance, 
  fetchRawWeatherData, 
  aggregateRawWeather, 
  calculateBearing,
  calculateDistance,
  getGlobalLocationSuggestions,
  resolveAddress,
  checkLLMConnectivity,
  isAIFallingBack,
  isUsingFallbackModel,
  currentLLMModel,           
  currentLLMModelPriorityLabel, 
  remainingLLMAlternativesCount,
  lastApiErrorMessage 
} from './services/geminiService';

const App: React.FC = () => {
  const [settings, setSettings] = useState<CommuteSettings>(() => {
    const saved = localStorage.getItem('velo_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return { 
      ...DEFAULT_SETTINGS, 
      ...parsed,
      homeCoords: parsed.homeCoords || DEFAULT_SETTINGS.homeCoords,
      workCoords: parsed.workCoords || DEFAULT_SETTINGS.workCoords,
      equipment: parsed.equipment || DEFAULT_SETTINGS.equipment || [],
      averageSpeed: parsed.averageSpeed || DEFAULT_SETTINGS.averageSpeed,
      fitnessGoal: parsed.fitnessGoal || DEFAULT_SETTINGS.fitnessGoal,
      workDays: parsed.workDays || DEFAULT_SETTINGS.workDays
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
  
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'training' | 'training-weekly'>('daily');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isConnectivityOpen, setIsConnectivityOpen] = useState(false);
  const [isPopupActive, setIsPopupActive] = useState(false);

  const lastUpdateFromCache = useMemo(() => {
    const updates = Object.values(pulseDataMap).map((d: any) => d.lastUpdated).filter(Boolean);
    return updates.length > 0 ? Math.max(...updates) : undefined;
  }, [pulseDataMap]);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusState>({
    'Open-Meteo': 'checking',
    'Gemini LLM': 'checking',
    'Google Maps': 'checking',
    llmDetails: { model: null, priority: null, alternatives: null },
    lastWeatherUpdate: lastUpdateFromCache
  });

  useEffect(() => {
    if (lastUpdateFromCache) {
      setConnectionStatus(prev => ({ ...prev, lastWeatherUpdate: lastUpdateFromCache }));
    }
  }, [lastUpdateFromCache]);

  const checkConnections = useCallback(async () => {
    setConnectionStatus(prev => ({
      ...prev,
      'Open-Meteo': 'checking',
      'Gemini LLM': 'checking',
      'Google Maps': 'checking',
      llmDetails: { model: null, priority: null, alternatives: null },
      errorMessage: undefined
    }));
    
    try {
      await fetchRawWeatherData({ lat: 51.0, lng: 3.7 });
      setConnectionStatus(prev => ({ ...prev, 'Open-Meteo': 'ok' }));
    } catch (e) {
      setConnectionStatus(prev => ({ ...prev, 'Open-Meteo': 'fail' }));
    }

    try {
      await resolveAddress("Test Connectivity Check");
      setConnectionStatus(prev => ({ ...prev, 'Google Maps': 'ok' }));
    } catch (e) {
      setConnectionStatus(prev => ({ ...prev, 'Google Maps': 'fail' }));
    }

    try {
      const isConnected = await checkLLMConnectivity();
      let llmStatus: 'ok' | 'fallback' | 'fail' = 'ok';
      let errorMsg = undefined;

      if (!isConnected || isAIFallingBack) {
          llmStatus = 'fail';
          errorMsg = lastApiErrorMessage || "Connection check failed";
      } else if (isUsingFallbackModel) {
          llmStatus = 'fallback';
      }

      setConnectionStatus(prev => ({ 
        ...prev, 
        'Gemini LLM': llmStatus, 
        llmDetails: {
          model: currentLLMModel,
          priority: currentLLMModelPriorityLabel,
          alternatives: remainingLLMAlternativesCount,
        },
        errorMessage: errorMsg
      }));
    } catch (e) {
      setConnectionStatus(prev => ({ 
        ...prev, 
        'Gemini LLM': 'fail', 
        llmDetails: {
          model: currentLLMModel,
          priority: currentLLMModelPriorityLabel || 'All Chains Failed',
          alternatives: 0,
        },
        errorMessage: lastApiErrorMessage || (e as Error).message
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
      distance: 50,
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
  const [trainingWeek, setTrainingWeek] = useState<any[]>([]);
  const [isTrainingWeekLoading, setIsTrainingWeekLoading] = useState(false);

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

  const [globalTrainingResults, setGlobalTrainingResults] = useState<BelgianLocation[]>([]);
  const [isSearchingGlobalTraining, setIsSearchingGlobalTraining] = useState(false);

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
  
  // Keep training sync with shared header date offset
  useEffect(() => {
    setTraining(prev => ({ ...prev, dateOffset: selectedDateOffset }));
  }, [selectedDateOffset]);

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
  const initialSyncStarted = useRef(false);

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
    if (trainingSearch.length < 3) { setGlobalTrainingResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingGlobalTraining(true);
      try {
        const results = await getGlobalLocationSuggestions(trainingSearch);
        setGlobalTrainingResults(results);
      } catch (e) { /* ignore */ } 
      finally { setIsSearchingGlobalTraining(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [trainingSearch]);

  const syncFullWeek = useCallback(async (currentSettings: CommuteSettings, isSilent = false, specificOffsets?: number[]) => {
    const allOffsets = specificOffsets || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    if (!isSilent) setLoading(true);
    setLoadingOffsets(prev => [...new Set([...prev, ...allOffsets])]);
    try {
      const telemetryBatch = await getTelemetryBatch(currentSettings, allOffsets);
      const updateTime = Date.now();
      setPulseDataMap(prev => {
        const next = { ...prev, ...telemetryBatch };
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });
      setConnectionStatus(prev => ({ ...prev, lastWeatherUpdate: updateTime }));
      
      if (!isSilent) setLoading(false);
      setLoadingOffsets(prev => prev.filter(o => !allOffsets.includes(o)));
      if (!currentSettings.disableAI) {
        try {
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
        } catch (aiErr) { console.error("Background AI sync failed", aiErr); }
      }
    } catch (err: any) { console.error("Full week sync failed:", err); } 
    finally {
      setLoadingOffsets(prev => prev.filter(o => !allOffsets.includes(o)));
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'daily' && !pulseDataMap[selectedDateOffset] && !loadingOffsets.includes(selectedDateOffset)) {
      syncFullWeek(settings, false, [selectedDateOffset]);
    }
  }, [selectedDateOffset, viewMode, pulseDataMap, settings, syncFullWeek, loadingOffsets]);

  useEffect(() => {
    const currentPulse = pulseDataMap[selectedDateOffset];
    if (
      viewMode === 'daily' && 
      currentPulse && 
      !currentPulse.isEnhanced && 
      !currentPulse.aiFailed && 
      !settings.disableAI &&
      !loadingOffsets.includes(selectedDateOffset)
    ) {
      const enhanceCurrentCommute = async () => {
         try {
           const aiAdvice = await getCommuteDayAIAdvice(settings, currentPulse.weather);
           setPulseDataMap(prev => {
              const next = { ...prev };
              if (next[selectedDateOffset]) {
                next[selectedDateOffset] = {
                  ...next[selectedDateOffset],
                  isEnhanced: true,
                  weather: {
                    morning: { 
                      ...next[selectedDateOffset].weather.morning,
                      surfaceReason: aiAdvice.morning.summary,
                      ridingStyleAdvice: aiAdvice.morning.style,
                      bikeSetupAdvice: aiAdvice.morning.setup,
                      clothingAdvice: aiAdvice.morning.clothing,
                      performanceAdvice: aiAdvice.morning.performance
                    },
                    evening: {
                      ...next[selectedDateOffset].weather.evening,
                      surfaceReason: aiAdvice.evening.summary,
                      ridingStyleAdvice: aiAdvice.evening.style,
                      bikeSetupAdvice: aiAdvice.evening.setup,
                      clothingAdvice: aiAdvice.evening.clothing,
                      performanceAdvice: aiAdvice.evening.performance
                    }
                  }
                };
              }
              localStorage.setItem(CACHE_KEY, JSON.stringify(next));
              return next;
           });
         } catch (e) {
           console.warn("Targeted Commute AI failed", e);
           setPulseDataMap(prev => {
              const next = { ...prev };
              if (next[selectedDateOffset]) next[selectedDateOffset].aiFailed = true;
              return next;
           });
         }
      };
      
      const timer = setTimeout(enhanceCurrentCommute, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedDateOffset, viewMode, pulseDataMap, settings.disableAI, loadingOffsets]);

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
          return ageHours > 1; 
        });
      };
      if (checkNeedsSync()) syncFullWeek(settings, true);
    }
  }, [syncFullWeek, settings, pulseDataMap]);

  const syncTraining = useCallback(async () => {
    setTrainingLoading(true);
    try {
      const rawCurrentLocation = await fetchRawWeatherData(training.coords);
      const dayIdx = (training.dateOffset + 1) * 24; 
      
      // Use user's average speed or fallback to constant
      const speed = settings.averageSpeed || AVG_TRAINING_SPEED;
      const durationHours = training.distance / speed;
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
      const betterLocationSuggestions: any[] = [];
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

  const syncTrainingWeek = useCallback(async () => {
    setIsTrainingWeekLoading(true);
    setViewMode('training-weekly');
    try {
      const rawData = await fetchRawWeatherData(training.coords);
      
      // Use user's average speed or fallback to constant
      const speed = settings.averageSpeed || AVG_TRAINING_SPEED;
      const durationHours = training.distance / speed;
      const durationInt = Math.ceil(durationHours);
      
      const weeklyResults = [];
      
      for (let offset = 0; offset < 7; offset++) {
         const dayIdx = (offset + 1) * 24;
         const sunTimes = {
            sunrise: rawData.daily?.sunrise?.[offset] || "07:00",
            sunset: rawData.daily?.sunset?.[offset] || "20:00"
         };
         
         let bestSlot = null;
         
         for (let hour = 5; hour <= 20; hour++) {
            const startTimeStr = `${hour.toString().padStart(2, '0')}:00`;
            const endHourVal = hour + durationInt;
            const endTimeStr = `${endHourVal.toString().padStart(2, '0')}:00`;
            const window: [string, string] = [startTimeStr, endTimeStr];
            
            const startIndex = dayIdx + hour;
            const endIndex = dayIdx + endHourVal;
            
            const slice: any = {};
            if (rawData.hourly) {
               Object.keys(rawData.hourly).forEach(k => {
                  if (Array.isArray(rawData.hourly[k]) && startIndex <= endIndex && endIndex < rawData.hourly[k].length) {
                     slice[k] = rawData.hourly[k].slice(startIndex, endIndex + 1);
                  }
               });
            }
            
            const pastTemps = (rawData.hourly?.temperature_2m || []).slice(Math.max(0, startIndex - 6), startIndex);
            const minPastTemp = pastTemps.length ? Math.min(...pastTemps) : 10;
            
            const condition = aggregateRawWeather(
                slice, 
                0, 
                true, 
                settings, 
                sunTimes, 
                minPastTemp, 
                window, 
                undefined, 
                undefined, 
                true
            );
            
            if (!bestSlot || condition.score > bestSlot.score) {
                bestSlot = { score: condition.score, condition, startHour: hour, window };
            }
         }
         weeklyResults.push({ offset, bestSlot });
      }
      setTrainingWeek(weeklyResults);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTrainingWeekLoading(false);
    }
  }, [training.coords, training.distance, settings]);

  useEffect(() => {
    if (viewMode === 'training') syncTraining();
  }, [viewMode, training.location, training.distance, training.dateOffset, syncTraining]);

  useEffect(() => {
    if (
      viewMode === 'training' && 
      activeTrainingSlot && 
      !activeTrainingSlot.isAIEnhanced && 
      !activeTrainingSlot.aiFailed && 
      !settings.disableAI
    ) {
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
          setTrainingSlots(prev => prev.map(slot => {
            if (slot.startHour === activeTrainingSlot.startHour) {
              return { ...slot, aiFailed: true };
            }
            return slot;
          }));
        }
      };
      
      const timer = setTimeout(fetchAIAdvice, 800); 
      return () => clearTimeout(timer);
    }
  }, [
    activeTrainingSlot?.startHour, 
    activeTrainingSlot?.isAIEnhanced, 
    activeTrainingSlot?.aiFailed, 
    viewMode, 
    settings.disableAI, 
    training.distance, 
    settings 
  ]);

  const handleSaveSettings = async (newSettings: CommuteSettings) => {
    setIsSettingsOpen(false);
    setLoading(true);

    const locationChanged = newSettings.homeLocation !== settings.homeLocation || newSettings.workLocation !== settings.workLocation;
    const equipmentChanged = JSON.stringify(newSettings.equipment) !== JSON.stringify(settings.equipment);
    const aiChanged = newSettings.disableAI !== settings.disableAI;
    const personalChanged = newSettings.averageSpeed !== settings.averageSpeed || newSettings.fitnessGoal !== settings.fitnessGoal;
    
    let updatedSettings = { ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem('velo_settings', JSON.stringify(updatedSettings));

    if (locationChanged) {
      setPulseDataMap({}); 
      localStorage.removeItem(CACHE_KEY);
      
      try {
        const dist = await getCommuteRoadDistance(newSettings.homeLocation, newSettings.workLocation);
        if (dist) {
          updatedSettings = { ...updatedSettings, roadDistance: dist };
          setSettings(updatedSettings); 
          localStorage.setItem('velo_settings', JSON.stringify(updatedSettings));
        }
      } catch (e: any) { 
        console.error("Distance check failed", e);
      }
    }

    if (locationChanged || aiChanged || equipmentChanged || personalChanged) {
      if (!locationChanged) {
         // Clear cache to force re-evaluation with new personal settings if needed (e.g. AI advice context)
         // but maybe not strictly necessary for simple visual updates. 
         // For now, let's keep cache unless location changes to save API calls.
         // Actually, if AI context changes (fitness goal), we might want new insights.
         // Let's rely on standard re-sync.
      } else {
         setPulseDataMap({});
         localStorage.removeItem(CACHE_KEY);
      }
      await syncFullWeek(updatedSettings);
    } else {
      setLoading(false);
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

  const handleSelectSuggestion = (type: 'training', loc: BelgianLocation) => {
    setTraining((prev: TrainingState) => ({ ...prev, location: loc.name, coords: { lat: loc.lat, lng: loc.lng } }));
    setTrainingSearch(loc.name);
    setShowTrainingSuggestions(false);
    setManualStartHour(null); 
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

  const isCurrentDayLoading = useMemo(() => {
    return loadingOffsets.includes(selectedDateOffset);
  }, [loadingOffsets, selectedDateOffset]);

  const isWeeklyMode = viewMode === 'weekly' || viewMode === 'training-weekly';

  return (
    <div className={`h-full w-full flex flex-col font-sans overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#05070a] text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
      {!isWeeklyMode && (
        <Header 
          onOpenInfo={() => setIsInfoOpen(true)}
          viewMode={viewMode}
          selectedDateOffset={selectedDateOffset}
          setSelectedDateOffset={setSelectedDateOffset}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isDark={isDark}
        />
      )}

      <main className={`flex-1 px-5 flex flex-col gap-2 max-w-md mx-auto w-full min-h-0 overflow-y-auto hide-scrollbar relative ${
        isWeeklyMode ? 'pt-[max(0.5rem,env(safe-area-inset-top))] pb-0' : 'pt-1 pb-0'
      } ${isPopupActive ? 'z-[200]' : 'z-10'}`}>
        {viewMode === 'daily' && (
          <DailyView 
            activeLegIndex={activeLegIndex}
            setActiveLegIndex={setActiveLegIndex}
            isAdviceExpanded={isAdviceExpanded}
            setIsAdviceExpanded={setIsAdviceExpanded}
            primaryData={primaryData}
            secondaryData={secondaryData}
            activeWeather={activeWeather}
            displayedDistance={displayedDistance}
            settings={settings}
            isCurrentDayLoading={isCurrentDayLoading}
            isCurrentDayEnhanced={isCurrentDayEnhanced}
            isDark={isDark}
            onPopupStateChange={setIsPopupActive}
          />
        )}
        {viewMode === 'weekly' && (
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
            <WeeklyForecast 
              pulseDataMap={pulseDataMap} 
              loadingOffsets={loadingOffsets} 
              theme={settings.theme} 
              onSelectDay={(offset: number) => { setSelectedDateOffset(offset); setViewMode('daily'); }}
              onToggleMode={() => { syncTrainingWeek(); }}
              workDays={settings.workDays}
            />
          </div>
        )}
        {(viewMode === 'training' || viewMode === 'training-weekly') && (
          <TrainingView 
            isDark={isDark}
            training={training}
            trainingSearch={trainingSearch}
            showTrainingSuggestions={showTrainingSuggestions}
            isSearching={isSearchingGlobalTraining}
            trainingData={activeTrainingSlot}
            trainingLoading={trainingLoading}
            manualStartHour={manualStartHour}
            bestStartHour={bestStartHour}
            theme={settings.theme}
            onReturn={() => setViewMode('daily')}
            onSearchChange={(val) => { setTrainingSearch(val); setShowTrainingSuggestions(true); }}
            onSetToHome={handleSetTrainingToHome}
            onDateOffsetChange={(offset) => { 
                setSelectedDateOffset(offset);
                setManualStartHour(null); 
                if (viewMode === 'training-weekly') setViewMode('training');
            }}
            onDistanceChange={(dist) => { setTraining(prev => ({...prev, distance: dist})); setManualStartHour(null); }}
            onManualHourChange={(hour) => setManualStartHour(hour)}
            onSelectSuggestion={(loc) => handleSelectSuggestion('training', loc)}
            onShowWeekly={() => syncTrainingWeek()}
            filterLocations={filterLocationsWithGlobal}
            globalTrainingResults={globalTrainingResults}
            getDayLabel={getDayLabel}
            isWeeklyView={viewMode === 'training-weekly'}
            weeklyData={trainingWeek}
            weeklyLoading={isTrainingWeekLoading}
            onSelectWeeklySlot={(offset, hour) => {
               setSelectedDateOffset(offset);
               setManualStartHour(hour);
               setViewMode('training');
            }}
            aiEnabled={!settings.disableAI}
            onPopupStateChange={setIsPopupActive}
            onToggleMode={() => setViewMode('weekly')}
          />
        )}
      </main>

      <BottomNav 
        viewMode={viewMode}
        setViewMode={setViewMode}
        onShowTrainingWeekly={syncTrainingWeek}
        isDark={isDark}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings}
        onSave={handleSaveSettings}
        onThemeChange={(theme) => setSettings(prev => ({ ...prev, theme }))}
        onOpenConnectivity={() => setIsConnectivityOpen(true)}
        onOpenTraining={() => { setViewMode('training'); setManualStartHour(null); }}
        isDark={isDark}
      />

      <ConnectivityModal 
        isOpen={isConnectivityOpen}
        onClose={() => setIsConnectivityOpen(false)}
        status={connectionStatus}
        onCheckConnection={checkConnections}
        isDark={isDark}
      />

      <InfoModal 
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        isDark={isDark}
        language={settings.language}
      />
    </div>
  );
};

export default App;