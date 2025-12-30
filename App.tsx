import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CommuteSettings, Coordinates, Language } from './types';
import { DEFAULT_SETTINGS, TRANSLATIONS, LANGUAGES, BELGIAN_CITIES } from './constants';
import { WeatherCard } from './components/WeatherCard';
import { LoadingVisual } from './components/LoadingVisual';
import { WeeklyForecast } from './components/WeeklyForecast';
import { getPulseBatch, resolveAddress, getCommuteRoadDistance, lastApiErrorMessage, lastApiErrorType } from './services/geminiService';
import { 
  Settings as SettingsIcon, 
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
  Clock,
  ChevronUp,
  Brain,
  Zap,
  X,
  ArrowRight
} from 'lucide-react';

const ROAD_DETOUR_FACTOR = 1.32;
const CACHE_KEY = 'commute_iq_pulse_cache_v2';

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
  // Load settings first
  const [settings, setSettings] = useState<CommuteSettings>(() => {
    const saved = localStorage.getItem('velo_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...parsed };
  });

  // Pulse data cache implementation
  const [pulseDataMap, setPulseDataMap] = useState<Record<number, any>>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    try {
      const parsed = JSON.parse(cached);
      // Optional: Filter out data that is too old (e.g., > 24 hours)
      const now = Date.now();
      const filtered: Record<number, any> = {};
      Object.keys(parsed).forEach(k => {
        const key = Number(k);
        if (now - (parsed[key].lastUpdated || 0) < 24 * 60 * 60 * 1000) {
          filtered[key] = parsed[key];
        }
      });
      return filtered;
    } catch (e) {
      return {};
    }
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [isDataInfoOpen, setIsDataInfoOpen] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState<string | null>('purpose');

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

  const syncData = useCallback(async (currentSettings: CommuteSettings, offsets: number[], isSilent = false) => {
    if (!offsets.length) return;
    
    // Only show global loading if we don't have cached data for these offsets
    const hasMissingData = offsets.some(o => !pulseDataMap[o]);
    if (!isSilent && hasMissingData) {
      setLoading(true);
      setLoadingProgress(10);
      setLoadingStatus("Connecting Telemetry...");
    }
    
    setLoadingOffsets(prev => [...new Set([...prev, ...offsets])]);

    try {
      // First pass: Fast Meteorological sync
      const results = await getPulseBatch(currentSettings, offsets, false);
      
      setPulseDataMap(prev => {
        const next = { ...prev, ...results };
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });
      
      if (!isSilent) setLoadingProgress(100);
    } catch (err: any) {
      console.error("Sync data failed:", err);
    } finally {
      setLoadingOffsets(prev => prev.filter(o => !offsets.includes(o)));
      if (!isSilent) setTimeout(() => setLoading(false), 300);
    }
  }, [pulseDataMap]);

  useEffect(() => {
    if (!initialSyncStarted.current) {
      initialSyncStarted.current = true;
      
      // STAGGERED LOAD: 
      // 1. Immediate refresh for today (silent if we have cache)
      syncData(settings, [0], !!pulseDataMap[0]).then(() => {
        // 2. Background refresh for rest of week
        syncData(settings, [1, 2, 3], true).then(() => {
          syncData(settings, [4, 5, 6], true);
        });
      });
    }
  }, [syncData, settings, pulseDataMap]);

  const handleSave = async () => {
    setLoadingStatus("Optimizing Parameters...");
    setLoading(true);
    let roadDistance = editSettings.roadDistance;
    const locationChanged = editSettings.homeLocation !== settings.homeLocation || editSettings.workLocation !== settings.workLocation;
    const aiToggled = editSettings.disableAI !== settings.disableAI;

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

    // Clear cache on location change
    if (locationChanged || aiToggled) { 
      setPulseDataMap({});
      localStorage.removeItem(CACHE_KEY);
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
      isSynthesized: dayPulse?.isEnhanced || false,
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
      isSynthesized: dayPulse?.isEnhanced || false,
    };
  }, [commuteSequence.secondary, pulseDataMap, settings, t]);

  const DataInfoContent: React.FC = () => {
    const sections = [
      { id: 'purpose', title: t.purposeTitle, content: t.purposeContent },
      { id: 'score', title: t.commuteScore, content: t.commuteScoreContent },
      { id: 'indicators', title: t.generalSources, content: t.generalSourcesContent }
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-bold uppercase tracking-tight flex items-center gap-3 ${isDark ? 'text-white' : 'text-slate-950'}`}>
            <Info className="text-blue-600 w-5 h-5" /> {t.dataInsights}
          </h2>
          <button onClick={() => setIsDataInfoOpen(false)} className="text-slate-500 hover:text-blue-600 transition-colors">✕</button>
        </div>
        
        <div className="space-y-3">
          {sections.map((section) => {
            const isExpanded = expandedTopic === section.id;
            return (
              <div 
                key={section.id} 
                className={`rounded-[1.5rem] border overflow-hidden transition-all duration-300 ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}
              >
                <button 
                  onClick={() => setExpandedTopic(isExpanded ? null : section.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left group"
                >
                  <h3 className={`text-xs font-bold uppercase tracking-wide transition-colors ${isExpanded ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-slate-300' : 'text-slate-700')} group-hover:text-blue-500`}>
                    {section.title}
                  </h3>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                
                <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                  <div className={`px-5 pb-5 pt-0 text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {section.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-6">
          <button onClick={() => setIsDataInfoOpen(false)} className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
            Close
          </button>
        </div>
      </div>
    );
  };

  // Helper to split date label for 2-line display
  const dateParts = useMemo(() => {
    const full = formatDateLabel(selectedDateOffset); // e.g. "TUE 30 DEC"
    const split = full.split(' ');
    return {
      day: split[0],
      date: split.slice(1).join(' ')
    };
  }, [selectedDateOffset]);

  return (
    <div className={`h-full w-full flex flex-col font-sans overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#05070a] text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
      <header className="flex-none px-6 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="flex flex-col items-center leading-none text-center select-none">
              <span className="uppercase text-[14px] font-black tracking-[0.45em] text-slate-500/80 ml-1">Commute</span>
              <span className="text-3xl text-blue-500 italic font-black -mt-1">IQ</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setIsCalendarOpen(!isCalendarOpen)} 
              className={`flex items-center gap-2 px-3 h-12 rounded-xl border text-[8px] font-black uppercase tracking-[0.15em] transition-all ${
                viewMode === 'weekly' 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                  : (isDark 
                      ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700' 
                      : 'bg-white border-slate-300 text-slate-700 shadow-sm')
              }`}
            >
              {viewMode === 'weekly' ? <LayoutGrid className="w-3.5 h-3.5" /> : <Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-blue-500/80' : 'text-blue-600'}`} />} 
              <div className="flex flex-col items-start leading-tight">
                {viewMode === 'weekly' ? (
                  <span className="text-[10px] tracking-[0.1em]">FORECAST</span>
                ) : (
                  <>
                    <span className="text-[10px] opacity-70">{dateParts.day}</span>
                    <span className="text-[9px] -mt-0.5 whitespace-nowrap">{dateParts.date}</span>
                  </>
                )}
              </div>
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
          <button onClick={() => { setPulseDataMap({}); localStorage.removeItem(CACHE_KEY); syncData(settings, [0]).then(() => syncData(settings, [1,2,3], true).then(() => syncData(settings, [4,5,6], true))); }} className={`h-12 w-12 flex items-center justify-center border rounded-xl transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-600 shadow-sm'}`}>
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
          <button onClick={() => setIsDataInfoOpen(true)} className={`h-12 w-12 flex items-center justify-center border rounded-xl transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-600 shadow-sm'}`}>
            <Info className="w-5 h-5" />
          </button>
          <button onClick={() => { setEditSettings(settings); setHomeQuery(settings.homeLocation); setWorkQuery(settings.workLocation); setIsSettingsOpen(true); }} className={`h-12 w-12 flex items-center justify-center border rounded-xl transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-600 shadow-sm'}`}>
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pb-6 flex flex-col gap-4 max-w-xl mx-auto w-full min-h-0 overflow-hidden relative">
        {loading && <div className="absolute top-0 left-0 w-full px-6 z-50"><LoadingVisual progress={loadingProgress} status={loadingStatus} theme={settings.theme} /></div>}
        
        {viewMode === 'daily' ? (
          <div className="flex flex-col gap-4 h-full overflow-hidden">
            <div className="flex-1 min-h-0">
              <WeatherCard {...primaryData} distance={displayedDistance} safetyScore={primaryData.score} theme={settings.theme} />
            </div>
            <div className="flex-none">
              <WeatherCard compact {...secondaryData} theme={settings.theme} />
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
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
        <div className="fixed inset-0 z-[100] bg-[#05070a] flex flex-col animate-in fade-in duration-300 overflow-y-auto hide-scrollbar">
          <div className={`flex-1 max-w-lg mx-auto w-full flex flex-col p-4 space-y-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <SettingsIcon className="text-blue-500 w-5 h-5" />
                <h2 className="text-xl font-black uppercase tracking-tighter">{t.settings}</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors active:scale-90">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            
            <div className="flex flex-col gap-2.5">
              
              {/* AI INTELLIGENCE COMMAND CENTER - TOP BOX (MORE COMPACT) */}
              <div className={`p-4 rounded-[1.5rem] border transition-all duration-500 shadow-xl ${!editSettings.disableAI ? 'bg-blue-600/10 border-blue-500/40' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl shadow-md ${!editSettings.disableAI ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                      <Brain className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-500 leading-none mb-1">{t.aiInsights}</span>
                      <span className="text-sm font-bold tracking-tight">
                        {!editSettings.disableAI ? 'Full Intelligence' : 'Performance Only'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditSettings({...editSettings, disableAI: !editSettings.disableAI})}
                    className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden ${!editSettings.disableAI ? 'bg-blue-600' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-500 transform ${!editSettings.disableAI ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* PREFERENCES GRID (MORE COMPACT) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-[1.25rem] border bg-slate-900/40 border-white/5">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Sun className="w-3 h-3 text-slate-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{t.theme}</span>
                  </div>
                  <div className="flex p-1 rounded-xl bg-slate-950 border border-white/5">
                    <button onClick={() => setEditSettings({...editSettings, theme: 'light'})} className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${editSettings.theme === 'light' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}><Sun className="w-4 h-4" /></button>
                    <button onClick={() => setEditSettings({...editSettings, theme: 'dark'})} className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${editSettings.theme === 'dark' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}><Moon className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-3.5 rounded-[1.25rem] border bg-slate-900/40 border-white/5">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Globe className="w-3 h-3 text-slate-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{t.language}</span>
                  </div>
                  <div className="flex p-1 rounded-xl bg-slate-950 border border-white/5">
                    {['en', 'fr', 'nl'].map(lang => (
                      <button key={lang} onClick={() => setEditSettings({...editSettings, language: lang as Language})} className={`flex-1 py-1.5 text-[8px] font-black rounded-lg transition-all ${editSettings.language === lang ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{lang.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* LOCATION CARDS (HIGH DENSITY) */}
              {(['home', 'work'] as const).map((type) => {
                const isHome = type === 'home';
                const query = isHome ? homeQuery : workQuery;
                const setQuery = isHome ? setHomeQuery : setWorkQuery;
                const suggestions = isHome ? homeSuggestions : workSuggestions;
                const showSuggestions = isHome ? showHomeSuggestions : showWorkSuggestions;
                const setShowSuggestions = isHome ? setShowHomeSuggestions : setShowWorkSuggestions;

                return (
                  <div key={type} className="p-4 rounded-[1.75rem] border bg-slate-900/30 border-white/5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <MapPin className="w-4 h-4 text-blue-500" />
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{isHome ? t.home : t.work}</label>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input 
                          type="text" 
                          value={query} 
                          onFocus={() => setShowSuggestions(true)}
                          onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
                          placeholder={`Locality...`}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-blue-600 transition-all shadow-inner" 
                        />
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl z-[70] overflow-hidden backdrop-blur-xl">
                            {suggestions.map(city => (
                              <button key={city} onClick={() => selectSuggestion(type, city)} className="w-full px-4 py-3 text-left text-xs font-bold transition-all border-b border-white/5 last:border-0 hover:bg-blue-600 hover:text-white">{city}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => handleResolve(type)} 
                        className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95 flex-none"
                      >
                        {resolving === type ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Navigation className="w-4 h-4 text-white" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                       <Clock className="w-3.5 h-3.5 text-blue-500 flex-none" />
                       <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <div className="bg-slate-950 border border-white/5 rounded-lg px-2 py-1.5 flex flex-col items-center">
                            <span className="text-[6px] font-black uppercase tracking-widest text-slate-600 leading-none mb-1">In</span>
                            <input 
                              type="time" 
                              value={isHome ? editSettings.morningWindow[0] : editSettings.eveningWindow[0]}
                              onChange={e => setEditSettings(prev => ({...prev, [isHome ? 'morningWindow' : 'eveningWindow']: [e.target.value, prev[isHome ? 'morningWindow' : 'eveningWindow'][1]]}))}
                              className="bg-transparent text-xs font-bold font-mono outline-none text-center text-white leading-none appearance-none"
                            />
                          </div>
                          <ArrowRight className="w-3 h-3 text-slate-700" />
                          <div className="bg-slate-950 border border-white/5 rounded-lg px-2 py-1.5 flex flex-col items-center">
                            <span className="text-[6px] font-black uppercase tracking-widest text-slate-600 leading-none mb-1">Out</span>
                            <input 
                              type="time" 
                              value={isHome ? editSettings.morningWindow[1] : editSettings.eveningWindow[1]}
                              onChange={e => setEditSettings(prev => ({...prev, [isHome ? 'morningWindow' : 'eveningWindow']: [prev[isHome ? 'morningWindow' : 'eveningWindow'][0], e.target.value]}))}
                              className="bg-transparent text-xs font-bold font-mono outline-none text-center text-white leading-none appearance-none"
                            />
                          </div>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ACTION FOOTER (MORE COMPACT) */}
            <div className="pt-2 pb-6 flex flex-col gap-2 flex-none">
              <button 
                onClick={handleSave} 
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-600/20 transition-all text-white active:scale-95 flex items-center justify-center gap-2"
              >
                {t.apply}
              </button>
              <button 
                onClick={() => setIsSettingsOpen(false)} 
                className="w-full py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] transition-all active:scale-95 bg-slate-900 border border-white/5 text-slate-500 hover:text-white"
              >
                {t.cancel}
              </button>
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