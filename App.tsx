
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CommuteSettings, Coordinates, Language } from './types';
import { DEFAULT_SETTINGS, TRANSLATIONS, LANGUAGES, BELGIAN_CITIES } from './constants';
import { WeatherCard } from './components/WeatherCard';
import { LoadingVisual } from './components/LoadingVisual';
import { WeeklyForecast } from './components/WeeklyForecast';
import { getPulseBatch, resolveAddress, getCommuteRoadDistance, lastApiErrorMessage, lastApiErrorType } from './services/geminiService';
import { 
  Settings, 
  RefreshCw,
  Calendar,
  LayoutGrid,
  Navigation,
  Sun,
  Moon,
  Globe,
  Loader2,
  MapPin,
  ChevronDown,
  Info,
  Database // New icon for Data Insights
} from 'lucide-react';

const ROAD_DETOUR_FACTOR = 1.32;

const calculateDistance = (c1?: Coordinates, c2?: Coordinates): number => {
  if (!c1 || !c2) return 0;
  const R = 6371; 
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLon = (c2.lng - c1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

const formatDateLabel = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
};

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
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [isDataInfoOpen, setIsDataInfoOpen] = useState(false); // New state for data info page

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
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Idle");
  const [pulseDataMap, setPulseDataMap] = useState<Record<number, any>>({});
  const [loadingOffsets, setLoadingOffsets] = useState<number[]>([]);
  const [resolving, setResolving] = useState<'home' | 'work' | null>(null);

  const [homeQuery, setHomeQuery] = useState(settings.homeLocation);
  const [workQuery, setWorkQuery] = useState(settings.workLocation);
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [showWorkSuggestions, setShowWorkSuggestions] = useState(false);

  const t = TRANSLATIONS[settings.language || 'en'];
  const isDark = settings.theme === 'dark';

  const [editSettings, setEditSettings] = useState<CommuteSettings>(settings);
  const initialSyncStarted = useRef(false);

  const homeSuggestions = useMemo(() => {
    if (!homeQuery || homeQuery.length < 1) return [];
    const lower = homeQuery.toLowerCase();
    return Object.keys(BELGIAN_CITIES).filter(city => city.toLowerCase().includes(lower)).slice(0, 5);
  }, [homeQuery]);

  const workSuggestions = useMemo(() => {
    if (!workQuery || workQuery.length < 1) return [];
    const lower = workQuery.toLowerCase();
    return Object.keys(BELGIAN_CITIES).filter(city => city.toLowerCase().includes(lower)).slice(0, 5);
  }, [workQuery]);

  const displayedDistance = useMemo(() => {
    return settings.roadDistance || (calculateDistance(settings.homeCoords, settings.workCoords) * ROAD_DETOUR_FACTOR);
  }, [settings.homeCoords, settings.workCoords, settings.roadDistance]);

  const commuteSequence = useMemo(() => {
    const primaryType = selectedDateOffset === nextCommuteInfo.offset ? nextCommuteInfo.type : 'morning';
    const primaryOffset = selectedDateOffset;
    return primaryType === 'morning' 
      ? { primary: { type: 'morning' as const, offset: primaryOffset }, secondary: { type: 'evening' as const, offset: primaryOffset } }
      : { primary: { type: 'evening' as const, offset: primaryOffset }, secondary: { type: 'morning' as const, offset: primaryOffset + 1 } };
  }, [selectedDateOffset, nextCommuteInfo]);

  const syncData = useCallback(async (currentSettings: CommuteSettings, offsets: number[], isBackground = false) => {
    if (!offsets.length) return;
    
    if (!isBackground) {
      setLoading(true);
      setLoadingProgress(10);
      setLoadingStatus("Retrieving Telemetry...");
    }
    setLoadingOffsets(prev => [...new Set([...prev, ...offsets])]);

    try {
      const results = await getPulseBatch(currentSettings, offsets);
      setPulseDataMap(prev => ({ ...prev, ...results }));
      if (!isBackground) setLoadingProgress(100);
    } catch (err: any) {
      console.error("Sync data failed:", err);
      // lastApiErrorMessage and lastApiErrorType are set by geminiService
    } finally {
      setLoadingOffsets(prev => prev.filter(o => !offsets.includes(o)));
      if (!isBackground) setTimeout(() => setLoading(false), 300);
    }
  }, []);

  useEffect(() => {
    if (!initialSyncStarted.current) {
      initialSyncStarted.current = true;
      syncData(settings, [0]).then(() => {
        syncData(settings, [1, 2, 3], true).then(() => {
          syncData(settings, [4, 5, 6], true);
        });
      });
    }
  }, [syncData, settings]);

  const handleSave = async () => {
    setLoadingStatus("Optimizing Commute Parameters...");
    setLoading(true);
    let roadDistance = editSettings.roadDistance;
    const locationChanged = editSettings.homeLocation !== settings.homeLocation || editSettings.workLocation !== settings.workLocation;

    if (locationChanged) {
      try {
        const dist = await getCommuteRoadDistance(editSettings.homeLocation, editSettings.workLocation);
        if (dist) roadDistance = dist;
      } catch (e) { } // Errors are handled by geminiService, will set lastApiErrorMessage
    }

    const updated = { ...editSettings, roadDistance };
    setSettings(updated);
    localStorage.setItem('velo_settings', JSON.stringify(updated));
    setIsSettingsOpen(false);

    if (locationChanged || lastApiErrorType !== null) { // Force full refresh if location changed or any API error occurred
      setPulseDataMap({});
      syncData(updated, [0]).then(() => {
        syncData(updated, [1, 2, 3], true).then(() => {
          syncData(updated, [4, 5, 6], true);
        });
      });
    } else {
      setLoading(false);
    }
  };

  const handleResolve = async (type: 'home' | 'work') => {
    const query = type === 'home' ? homeQuery : workQuery;
    if (!query) return;
    
    setResolving(type);
    try {
      const result = await resolveAddress(query);
      setEditSettings(prev => ({
        ...prev,
        [type === 'home' ? 'homeLocation' : 'workLocation']: result.address,
        [type === 'home' ? 'homeCoords' : 'workCoords']: result.coords
      }));
      if (type === 'home') { setHomeQuery(result.address); setShowHomeSuggestions(false); }
      else { setWorkQuery(result.address); setShowWorkSuggestions(false); }
    } catch (e: any) {
      console.error("Address resolution failed:", e);
      // lastApiErrorMessage and lastApiErrorType are set by geminiService
    } finally {
      setResolving(null);
    }
  };

  const selectSuggestion = (type: 'home' | 'work', city: string) => {
    const coords = BELGIAN_CITIES[city];
    setEditSettings(prev => ({
      ...prev,
      [type === 'home' ? 'homeLocation' : 'workLocation']: city,
      [type === 'home' ? 'homeCoords' : 'workCoords']: coords
    }));
    if (type === 'home') { setHomeQuery(city); setShowHomeSuggestions(false); }
    else { setWorkQuery(city); setShowWorkSuggestions(false); }
  };

  const primaryData = useMemo(() => {
    const config = commuteSequence.primary;
    const isMorning = config.type === 'morning';
    const dayPulse = pulseDataMap[config.offset];
    const timeStr = isMorning ? settings.morningWindow[0] : settings.eveningWindow[0];
    const [h, m] = timeStr.split(':').map(Number);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + config.offset);
    targetDate.setHours(h, m, 0, 0);

    return {
      label: isMorning ? t.morning : t.evening,
      timeRange: isMorning ? settings.morningWindow.join(' - ') : settings.eveningWindow.join(' - '),
      startLocation: getLocality(isMorning ? settings.homeLocation : settings.workLocation),
      endLocation: getLocality(isMorning ? settings.workLocation : settings.homeLocation),
      condition: dayPulse?.weather?.[isMorning ? 'morning' : 'evening'] ?? null,
      score: dayPulse?.score,
      dateLabel: formatDateLabel(config.offset),
      targetDate,
      isDummy: dayPulse?.isDummy, 
      isSynthesized: dayPulse?.isSynthesized || false,
    };
  }, [commuteSequence.primary, pulseDataMap, settings, t]);

  const secondaryData = useMemo(() => {
    const config = commuteSequence.secondary;
    const isMorning = config.type === 'morning';
    const dayPulse = pulseDataMap[config.offset];
    return {
      label: isMorning ? t.morning : t.evening,
      timeRange: isMorning ? settings.morningWindow.join(' - ') : settings.eveningWindow.join(' - '),
      startLocation: getLocality(isMorning ? settings.homeLocation : settings.workLocation),
      endLocation: getLocality(isMorning ? settings.workLocation : settings.homeLocation),
      condition: dayPulse?.weather?.[isMorning ? 'morning' : 'evening'] ?? null,
      dateLabel: formatDateLabel(config.offset),
      isDummy: dayPulse?.isDummy, 
      isSynthesized: dayPulse?.isSynthesized || false,
    };
  }, [commuteSequence.secondary, pulseDataMap, settings, t]);

  const DataInfoContent: React.FC = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-xl font-bold uppercase tracking-tight flex items-center gap-3 ${isDark ? 'text-white' : 'text-slate-950'}`}><Database className="text-blue-600 w-5 h-5" /> {t.dataInsights}</h2>
        <button onClick={() => setIsDataInfoOpen(false)} className="text-slate-500 hover:text-blue-600 transition-colors">✕</button>
      </div>
      <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.dataInsightsDesc}</p>
      
      {/* Shortened list focusing on Inference vs Telemetry */}
      {[
        { title: t.generalSources, content: t.generalSourcesContent },
        { title: t.iceRisk, content: t.iceRiskContent },
        { title: t.surfaceCondition, content: t.surfaceConditionContent },
        { title: t.distanceCalculation, content: t.distanceCalculationContent },
      ].map((section, index) => (
        <div key={index} className={`p-5 rounded-[2rem] border space-y-2 ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
          <h3 className={`text-sm font-bold uppercase tracking-wide ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{section.title}</h3>
          <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{section.content}</p>
        </div>
      ))}

      <div className="flex gap-3 pt-4">
        <button onClick={() => setIsDataInfoOpen(false)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>Close</button>
      </div>
    </div>
  );

  return (
    <div className={`h-full w-full flex flex-col font-sans overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#05070a] text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
      <header className="flex-none px-6 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              Commute<span className="text-blue-500">IQ</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setIsCalendarOpen(!isCalendarOpen)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'weekly' ? 'bg-blue-600 border-blue-500 text-white' : (isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700' : 'bg-white border-slate-300 text-slate-700 shadow-sm')}`}>
              {viewMode === 'weekly' ? <LayoutGrid className="w-3 h-3" /> : <Calendar className={`w-3 h-3 ${isDark ? 'text-blue-500/80' : 'text-blue-600'}`} />} 
              {viewMode === 'weekly' ? "FORECAST" : formatDateLabel(selectedDateOffset).split(',')[0]}
            </button>
            {isCalendarOpen && (
              <div className={`absolute top-full right-0 mt-2 w-48 border rounded-2xl shadow-2xl p-1 z-[60] animate-in fade-in zoom-in-95 duration-150 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                {Array.from({length: 7}).map((_, i) => (
                  <button key={i} onClick={() => { setSelectedDateOffset(i); setViewMode('daily'); setIsCalendarOpen(false); }} className={`w-full px-4 py-2 text-left text-[9px] font-bold uppercase tracking-widest rounded-xl transition-all ${selectedDateOffset === i && viewMode === 'daily' ? 'bg-blue-600 text-white' : (isDark ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-600')}`}>
                    {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(Date.now() + i * 86400000).toLocaleDateString(undefined, {weekday: 'short'})}
                  </button>
                ))}
                <div className={`border-t my-1 ${isDark ? 'border-slate-800' : 'border-slate-200'}`} />
                <button onClick={() => { setViewMode('weekly'); setIsCalendarOpen(false); }} className="w-full px-4 py-2 text-left text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center gap-2 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"><LayoutGrid className="w-3.5 h-3.5" /> 7-Day View</button>
              </div>
            )}
          </div>
          <button onClick={() => { setPulseDataMap({}); syncData(settings, [0]).then(() => syncData(settings, [1,2,3], true).then(() => syncData(settings, [4,5,6], true))); }} className={`p-2 border rounded-lg transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-600 shadow-sm'}`}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
          <button onClick={() => setIsDataInfoOpen(true)} className={`p-2 border rounded-lg transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-600 shadow-sm'}`}>
            <Database className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditSettings(settings); setHomeQuery(settings.homeLocation); setWorkQuery(settings.workLocation); setIsSettingsOpen(true); }} className={`p-2 border rounded-lg transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-600 shadow-sm'}`}>
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pb-6 flex flex-col gap-4 max-w-xl mx-auto w-full min-h-0 overflow-hidden relative">
        {loading && <div className="absolute top-0 left-0 w-full px-6 z-50"><LoadingVisual progress={loadingProgress} status={loadingStatus} theme={settings.theme} /></div>}
        
        {viewMode === 'daily' ? (
          <div className={`flex flex-col gap-4 h-full overflow-hidden transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex-1 min-h-0">
              <WeatherCard {...primaryData} distance={displayedDistance} safetyScore={primaryData.score} theme={settings.theme} />
            </div>
            <div className="flex-none">
              <WeatherCard compact {...secondaryData} theme={settings.theme} />
            </div>
          </div>
        ) : (
          <div className={`flex-1 min-h-0 overflow-y-auto hide-scrollbar transition-opacity duration-300 ${loading ? 'opacity-40' : 'opacity-100'}`}>
            <WeeklyForecast 
              pulseDataMap={pulseDataMap} 
              loadingOffsets={loadingOffsets}
              theme={settings.theme} 
              onSelectDay={(offset) => { setSelectedDateOffset(offset); setViewMode('daily'); }} 
            />
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
          <div className={`w-full max-w-md rounded-[2.5rem] border p-8 shadow-2xl space-y-6 my-auto transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-bold uppercase tracking-tight flex items-center gap-3 ${isDark ? 'text-white' : 'text-slate-950'}`}><Settings className="text-blue-600 w-5 h-5" /> {t.settings}</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-blue-600 transition-colors">✕</button>
            </div>
            
            <div className="space-y-6">
              <div className={`p-5 rounded-[2rem] border space-y-4 ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-2 px-1">
                  <Globe className="w-3 h-3 text-blue-600" />
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t.preferences}</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.theme}</span>
                    <div className={`flex p-1 rounded-xl ${isDark ? 'bg-slate-900' : 'bg-slate-200'}`}>
                      <button onClick={() => setEditSettings({...editSettings, theme: 'light'})} className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${editSettings.theme === 'light' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}><Sun className="w-4 h-4" /></button>
                      <button onClick={() => setEditSettings({...editSettings, theme: 'dark'})} className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${editSettings.theme === 'dark' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}><Moon className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.language}</span>
                    <div className={`flex p-1 rounded-xl ${isDark ? 'bg-slate-900' : 'bg-slate-200'}`}>
                      {LANGUAGES.map(lang => (
                        <button key={lang.code} onClick={() => setEditSettings({...editSettings, language: lang.code})} className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all ${editSettings.language === lang.code ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>{lang.code.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {(['home', 'work'] as const).map((type) => {
                const isHome = type === 'home';
                const query = isHome ? homeQuery : workQuery;
                const setQuery = isHome ? setHomeQuery : setWorkQuery;
                const showSuggestions = isHome ? showHomeSuggestions : showWorkSuggestions;
                const setShowSuggestions = isHome ? setShowHomeSuggestions : setShowWorkSuggestions;
                const suggestions = isHome ? homeSuggestions : workSuggestions;

                return (
                  <div key={type} className={`space-y-3 p-5 rounded-[2rem] border relative ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                         <MapPin className="w-3 h-3 text-blue-600" />
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{isHome ? t.home : t.work}</label>
                      </div>
                      <div className="flex items-center gap-1">
                        {editSettings[isHome ? 'homeCoords' : 'workCoords'] && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <Info className="w-2.5 h-2.5 text-emerald-500" />
                            <span className="text-[7px] font-black text-emerald-500 uppercase">Cached</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="relative">
                      <input 
                        type="text" 
                        value={query} 
                        onFocus={() => setShowSuggestions(true)}
                        onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
                        placeholder={`Start typing Belgian city...`}
                        className={`w-full border rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-600 transition-all pr-12 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600' : 'bg-white border-slate-300 shadow-sm placeholder:text-slate-400'}`} 
                      />
                      <button 
                        onClick={() => handleResolve(type)} 
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-lg shadow-blue-600/20"
                      >
                        {resolving === type ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Navigation className="w-4 h-4 text-white" />}
                      </button>

                      {showSuggestions && suggestions.length > 0 && (
                        <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-2xl z-[70] overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className={`px-4 py-2 text-[8px] font-black uppercase tracking-widest border-b ${isDark ? 'text-slate-600 border-slate-800' : 'text-slate-400 border-slate-100'}`}>Quick Select (Local)</div>
                          {suggestions.map(city => (
                            <button 
                              key={city} 
                              onClick={() => selectSuggestion(type, city)}
                              className={`w-full px-4 py-3 text-left text-xs font-semibold flex items-center justify-between group transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-700'}`}
                            >
                              <span>{city}</span>
                              <ChevronDown className="w-3 h-3 -rotate-90 opacity-40 group-hover:opacity-100 transition-all" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsSettingsOpen(false)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>{t.cancel}</button>
              <button onClick={handleSave} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-blue-500/20 transition-all text-white">{t.apply}</button>
            </div>
          </div>
        </div>
      )}

      {isDataInfoOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
          <div className={`w-full max-w-md rounded-[2.5rem] border p-8 shadow-2xl space-y-6 my-auto transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
            <DataInfoContent />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
