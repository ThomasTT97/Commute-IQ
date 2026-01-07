
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
  getDirectLocationSuggestions,
  resolveAddress,
  reverseGeocodeDirect,
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
    return { ...DEFAULT_SETTINGS, ...parsed };
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
    } catch (e) { return {}; }
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

  const checkConnections = useCallback(async () => {
    setConnectionStatus(prev => ({ ...prev, 'Open-Meteo': 'checking', 'Gemini LLM': 'checking', 'Google Maps': 'checking' }));
    try { await fetchRawWeatherData({ lat: 51.0, lng: 3.7 }); setConnectionStatus(prev => ({ ...prev, 'Open-Meteo': 'ok' })); } catch (e) { setConnectionStatus(prev => ({ ...prev, 'Open-Meteo': 'fail' })); }
    try { await getDirectLocationSuggestions("Gent"); setConnectionStatus(prev => ({ ...prev, 'Google Maps': 'ok' })); } catch (e) { setConnectionStatus(prev => ({ ...prev, 'Google Maps': 'fail' })); }
    try {
      const isConnected = await checkLLMConnectivity();
      let llmStatus: 'ok' | 'fallback' | 'fail' = (isConnected && !isAIFallingBack) ? (isUsingFallbackModel ? 'fallback' : 'ok') : 'fail';
      setConnectionStatus(prev => ({ 
        ...prev, 
        'Gemini LLM': llmStatus, 
        llmDetails: { model: currentLLMModel, priority: currentLLMModelPriorityLabel, alternatives: remainingLLMAlternativesCount },
        errorMessage: lastApiErrorMessage || undefined
      }));
    } catch (e) { setConnectionStatus(prev => ({ ...prev, 'Gemini LLM': 'fail' })); }
  }, []);

  useEffect(() => { if (isConnectivityOpen) checkConnections(); }, [isConnectivityOpen, checkConnections]);

  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [isAdviceExpanded, setIsAdviceExpanded] = useState(false);

  // Force morning leg (top) to be expanded when switching to daily view
  useEffect(() => {
    if (viewMode === 'daily') {
      setActiveLegIndex(0);
      setIsAdviceExpanded(false);
    }
  }, [viewMode]);

  const [training, setTraining] = useState<TrainingState>(() => {
    const saved = localStorage.getItem('velo_settings');
    const initialSettings = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return {
      location: initialSettings.homeLocation || "Gent", 
      coords: initialSettings.homeCoords || { lat: 51.0543, lng: 3.7174 }, 
      distance: 50, dateOffset: 0, preferredDirection: 0
    };
  });
  const [trainingSearch, setTrainingSearch] = useState(() => settings.homeLocation || "Gent");
  const [showTrainingSuggestions, setShowTrainingSuggestions] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [manualStartHour, setManualStartHour] = useState<number | null>(null);
  const [trainingSlots, setTrainingSlots] = useState<any[]>([]);
  const [trainingWeek, setTrainingWeek] = useState<any[]>([]);
  const [isTrainingWeekLoading, setIsTrainingWeekLoading] = useState(false);

  const bestStartHour = useMemo(() => {
    if (!trainingSlots.length) return null;
    return trainingSlots.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), trainingSlots[0]).startHour;
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
  const [loadingOffsets, setLoadingOffsets] = useState<number[]>([]);

  const displayedDistance = useMemo(() => {
    if (settings.roadDistance) return settings.roadDistance;
    return calculateDistance(settings.homeCoords, settings.workCoords) * ROAD_DETOUR_FACTOR;
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
    return { primary: { type: 'morning' as const, offset: selectedDateOffset }, secondary: { type: 'evening' as const, offset: selectedDateOffset } };
  }, [selectedDateOffset, nextCommuteInfo]);

  const t = TRANSLATIONS[settings.language || 'en'];
  const isDark = settings.theme === 'dark';
  const initialSyncStarted = useRef(false);

  useEffect(() => {
    if (trainingSearch.length < 3) { setGlobalTrainingResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingGlobalTraining(true);
      try { const results = await getDirectLocationSuggestions(trainingSearch); setGlobalTrainingResults(results); } catch (e) { } 
      finally { setIsSearchingGlobalTraining(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [trainingSearch]);

  const syncFullWeek = useCallback(async (currentSettings: CommuteSettings, isSilent = false, specificOffsets?: number[]) => {
    const allOffsets = specificOffsets || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    if (!isSilent) setLoadingOffsets(allOffsets);
    try {
      const telemetryBatch = await getTelemetryBatch(currentSettings, allOffsets);
      const updateTime = Date.now();
      setPulseDataMap(prev => {
        const next = { ...prev, ...telemetryBatch };
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });
      setConnectionStatus(prev => ({ ...prev, lastWeatherUpdate: updateTime }));
      setLoadingOffsets([]);
      
      if (!currentSettings.disableAI) {
        const aiOffsets = allOffsets.filter(o => o <= 6);
        if (aiOffsets.length > 0) {
          const telemetryForAI: Record<number, any> = {};
          aiOffsets.forEach(o => { if (telemetryBatch[o]) telemetryForAI[o] = telemetryBatch[o]; });
          try {
            const aiInsights = await getAIInsights(currentSettings, telemetryForAI);
            setPulseDataMap(prev => {
              const next = { ...prev };
              Object.keys(aiInsights).forEach(o => {
                const offset = Number(o);
                if (next[offset]) {
                  next[offset] = { ...next[offset], isEnhanced: true, weather: {
                    morning: { ...next[offset].weather.morning, surfaceReason: aiInsights[offset].morning.summary, ridingStyleAdvice: aiInsights[offset].morning.style, bikeSetupAdvice: aiInsights[offset].morning.setup, clothingAdvice: aiInsights[offset].morning.clothing, performanceAdvice: aiInsights[offset].morning.performance },
                    evening: { ...next[offset].weather.evening, surfaceReason: aiInsights[offset].evening.summary, ridingStyleAdvice: aiInsights[offset].evening.style, bikeSetupAdvice: aiInsights[offset].evening.setup, clothingAdvice: aiInsights[offset].evening.clothing, performanceAdvice: aiInsights[offset].evening.performance }
                  }};
                }
              });
              localStorage.setItem(CACHE_KEY, JSON.stringify(next));
              return next;
            });
          } catch (aiErr) { }
        }
      }
    } catch (err) { setLoadingOffsets([]); }
  }, []);

  useEffect(() => {
    if (viewMode === 'daily' && !pulseDataMap[selectedDateOffset] && !loadingOffsets.includes(selectedDateOffset)) {
      syncFullWeek(settings, false, [selectedDateOffset]);
    }
  }, [selectedDateOffset, viewMode, pulseDataMap, settings, syncFullWeek, loadingOffsets]);

  useEffect(() => {
    if (!initialSyncStarted.current) {
      initialSyncStarted.current = true;
      const needsSync = [0,1,2,3,4,5,6].some(offset => !pulseDataMap[offset] || (Date.now() - (pulseDataMap[offset].lastUpdated || 0)) > 3600000);
      if (needsSync) syncFullWeek(settings, true);
    }
  }, [syncFullWeek, settings, pulseDataMap]);

  const syncTraining = useCallback(async () => {
    if (!training.coords || typeof training.coords.lat !== 'number') return;
    setTrainingLoading(true);
    try {
      const raw = await fetchRawWeatherData(training.coords);
      const dayIdx = (training.dateOffset + 1) * 24; 
      const durationInt = Math.ceil(training.distance / (settings.averageSpeed || AVG_TRAINING_SPEED));
      const sunTimes = { sunrise: raw.daily?.sunrise?.[training.dateOffset+1] || "07:00", sunset: raw.daily?.sunset?.[training.dateOffset+1] || "20:00" };
      const slots = [];
      for (let h = 3; h <= 21; h++) {
        const slice: any = {};
        Object.keys(raw.hourly).forEach(k => { if (Array.isArray(raw.hourly[k])) slice[k] = raw.hourly[k].slice(dayIdx + h, dayIdx + h + durationInt + 1); });
        if (!slice.temperature_2m) continue;
        const past = raw.hourly.temperature_2m.slice(Math.max(0, dayIdx+h-6), dayIdx+h);
        const condition = aggregateRawWeather(slice, 0, true, settings, sunTimes, past.length ? Math.min(...past) : 10, [`${h}:00`, `${h+durationInt}:00`], undefined, undefined, true);
        slots.push({ startHour: h, condition, window: [`${h}:00`, `${h+durationInt}:00`], score: condition.score });
      }
      setTrainingSlots(slots);
      if (manualStartHour === null) setManualStartHour(slots.reduce((p, c) => (c.score > p.score ? c : p), slots[0]).startHour);
    } catch (e) { } finally { setTrainingLoading(false); }
  }, [training.coords, training.distance, training.dateOffset, settings]);

  const syncTrainingWeek = useCallback(async () => {
    if (!training.coords || typeof training.coords.lat !== 'number') return;
    setIsTrainingWeekLoading(true); setViewMode('training-weekly');
    try {
      const raw = await fetchRawWeatherData(training.coords);
      const durationInt = Math.ceil(training.distance / (settings.averageSpeed || AVG_TRAINING_SPEED));
      const weeklyResults = [];
      for (let o = 0; o < 7; o++) {
         const dayIdx = (o + 1) * 24;
         const sun = { sunrise: raw.daily?.sunrise?.[o+1] || "07:00", sunset: raw.daily?.sunset?.[o+1] || "20:00" };
         let best = null;
         for (let h = 5; h <= 20; h++) {
            const slice: any = {};
            Object.keys(raw.hourly).forEach(k => { if (Array.isArray(raw.hourly[k])) slice[k] = raw.hourly[k].slice(dayIdx+h, dayIdx+h+durationInt+1); });
            if (!slice.temperature_2m) continue;
            const past = raw.hourly.temperature_2m.slice(Math.max(0, dayIdx+h-6), dayIdx+h);
            const condition = aggregateRawWeather(slice, 0, true, settings, sun, past.length ? Math.min(...past) : 10, [`${h}:00`, `${h+durationInt}:00`], undefined, undefined, true);
            if (!best || condition.score > best.score) best = { score: condition.score, condition, startHour: h, window: [`${h}:00`, `${h+durationInt}:00`] };
         }
         weeklyResults.push({ offset: o, bestSlot: best });
      }
      setTrainingWeek(weeklyResults);
    } catch (e) { } finally { setIsTrainingWeekLoading(false); }
  }, [training.coords, training.distance, settings]);

  useEffect(() => { if (viewMode === 'training') syncTraining(); }, [viewMode, training.coords, training.distance, training.dateOffset, syncTraining]);

  const handleSetTrainingToCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const address = await reverseGeocodeDirect(coords);
        setTraining(prev => ({ ...prev, location: address, coords }));
        setTrainingSearch(address);
      } catch (e) {
        const fallback = `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
        setTraining(prev => ({ ...prev, location: fallback, coords }));
        setTrainingSearch(fallback);
      }
      setManualStartHour(null);
    });
  }, []);

  const handleSaveSettings = async (newSettings: CommuteSettings) => {
    setIsSettingsOpen(false);
    const locationChanged = newSettings.homeLocation !== settings.homeLocation || newSettings.workLocation !== settings.workLocation;
    let updated = { ...newSettings };
    setSettings(updated); localStorage.setItem('velo_settings', JSON.stringify(updated));
    if (locationChanged) {
      setPulseDataMap({}); localStorage.removeItem(CACHE_KEY);
      try { const dist = await getCommuteRoadDistance(newSettings.homeLocation, newSettings.workLocation); if (dist) { updated.roadDistance = dist; setSettings(updated); localStorage.setItem('velo_settings', JSON.stringify(updated)); } } catch (e) { }
      await syncFullWeek(updated);
    } else await syncFullWeek(updated, true);
  };

  const getDayLabel = (offset: number) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return { name: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(), num: d.getDate(), month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() };
  };

  const mapLegData = (config: any) => {
    const isMorning = config.type === 'morning';
    const dayPulse = pulseDataMap[config.offset];
    const condition = dayPulse?.weather?.[isMorning ? 'morning' : 'evening'] ?? null;
    const labels = getDayLabel(config.offset);
    return {
      label: isMorning ? t.morning : t.evening, timeRange: isMorning ? settings.morningWindow.join(' - ') : settings.eveningWindow.join(' - '),
      startLocation: getLocality(isMorning ? settings.homeLocation : settings.workLocation), endLocation: getLocality(isMorning ? settings.workLocation : settings.homeLocation),
      condition, score: condition?.score, dateLabel: `${labels.name} ${labels.num} ${labels.month}`,
    };
  };

  const primaryData = useMemo(() => mapLegData(commuteSequence.primary), [commuteSequence.primary, pulseDataMap, settings, t]);
  const secondaryData = useMemo(() => mapLegData(commuteSequence.secondary), [commuteSequence.secondary, pulseDataMap, settings, t]);

  return (
    <div className={`h-full w-full flex flex-col font-sans overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#05070a] text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
      {viewMode !== 'weekly' && viewMode !== 'training-weekly' && (
        <Header onOpenInfo={() => setIsInfoOpen(true)} viewMode={viewMode} selectedDateOffset={selectedDateOffset} setSelectedDateOffset={setSelectedDateOffset} onOpenSettings={() => setIsSettingsOpen(true)} isDark={isDark} />
      )}
      <main className={`flex-1 px-5 flex flex-col gap-2 max-w-md mx-auto w-full min-h-0 overflow-y-auto hide-scrollbar relative ${viewMode.includes('weekly') ? 'pt-[max(0.5rem,env(safe-area-inset-top))] pb-0' : 'pt-1 pb-0'} ${isPopupActive ? 'z-[200]' : 'z-10'}`}>
        {viewMode === 'daily' && (
          <DailyView activeLegIndex={activeLegIndex} setActiveLegIndex={setActiveLegIndex} isAdviceExpanded={isAdviceExpanded} setIsAdviceExpanded={setIsAdviceExpanded} primaryData={primaryData} secondaryData={secondaryData} activeWeather={activeLegIndex === 0 ? primaryData.condition : secondaryData.condition} displayedDistance={displayedDistance} settings={settings} isCurrentDayLoading={loadingOffsets.includes(selectedDateOffset)} isCurrentDayEnhanced={pulseDataMap[selectedDateOffset]?.isEnhanced ?? false} isDark={isDark} onPopupStateChange={setIsPopupActive} />
        )}
        {viewMode === 'weekly' && (
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
            <WeeklyForecast pulseDataMap={pulseDataMap} loadingOffsets={loadingOffsets} theme={settings.theme} onSelectDay={(offset: number) => { setSelectedDateOffset(offset); setViewMode('daily'); }} onToggleMode={syncTrainingWeek} workDays={settings.workDays} />
          </div>
        )}
        {(viewMode === 'training' || viewMode === 'training-weekly') && (
          <TrainingView isDark={isDark} training={training} trainingSearch={trainingSearch} showTrainingSuggestions={showTrainingSuggestions} isSearching={isSearchingGlobalTraining} trainingData={activeTrainingSlot} trainingLoading={trainingLoading} manualStartHour={manualStartHour} bestStartHour={bestStartHour} theme={settings.theme} onReturn={() => setViewMode('daily')} onSearchChange={setTrainingSearch} onSetToHome={() => { setTraining(prev => ({...prev, location: settings.homeLocation, coords: settings.homeCoords as Coordinates})); setTrainingSearch(settings.homeLocation); setManualStartHour(null); }} onSetToCurrent={handleSetTrainingToCurrentLocation} onDateOffsetChange={setSelectedDateOffset} onDistanceChange={d => { setTraining(prev => ({...prev, distance: d})); setManualStartHour(null); }} onManualHourChange={setManualStartHour} onSelectSuggestion={loc => { setTraining(p => ({...p, location: loc.name, coords: {lat: loc.lat, lng: loc.lng}})); setTrainingSearch(loc.name); setShowTrainingSuggestions(false); setManualStartHour(null); }} onShowWeekly={syncTrainingWeek} filterLocations={filterLocationsWithGlobal} globalTrainingResults={globalTrainingResults} getDayLabel={getDayLabel} isWeeklyView={viewMode === 'training-weekly'} weeklyData={trainingWeek} weeklyLoading={isTrainingWeekLoading} aiEnabled={!settings.disableAI} onPopupStateChange={setIsPopupActive} onToggleMode={() => setViewMode('weekly')} />
        )}
      </main>
      <BottomNav viewMode={viewMode} setViewMode={setViewMode} onShowTrainingWeekly={syncTrainingWeek} isDark={isDark} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentSettings={settings} onSave={handleSaveSettings} onThemeChange={t => setSettings(prev => ({ ...prev, theme: t }))} onOpenConnectivity={() => setIsConnectivityOpen(true)} onOpenTraining={() => { setViewMode('training'); setManualStartHour(null); }} isDark={isDark} />
      <ConnectivityModal isOpen={isConnectivityOpen} onClose={() => setIsConnectivityOpen(false)} status={connectionStatus} onCheckConnection={checkConnections} isDark={isDark} />
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} isDark={isDark} language={settings.language} />
    </div>
  );
};

export default App;
