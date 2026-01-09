
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CommuteSettings, FitnessGoal } from '../../types';
import { EquipmentManager } from '../EquipmentManager';
import { BelgianLocation } from '../../locations';
import { getDirectLocationSuggestions } from '../../services/geminiService';
import { CACHE_KEY } from '../../constants';
import { 
  X, 
  Sun, 
  Moon, 
  Search, 
  Globe, 
  RefreshCw, 
  Clock, 
  Bike, 
  ChevronDown, 
  EyeOff, 
  BrainCircuit, 
  Trophy, 
  Activity,
  MapPin,
  Loader2,
  User,
  Zap,
  Heart,
  Briefcase,
  ArrowLeft,
  Gauge,
  CalendarDays,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: CommuteSettings;
  onSave: (newSettings: CommuteSettings) => Promise<void>;
  onThemeChange: (theme: 'dark' | 'light') => void;
  onOpenConnectivity: () => void;
  onOpenTraining: () => void;
  isDark: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  currentSettings, 
  onSave, 
  onThemeChange, 
  onOpenConnectivity,
  onOpenTraining,
  isDark 
}) => {
  const [editSettings, setEditSettings] = useState<CommuteSettings>(currentSettings);
  const [currentView, setCurrentView] = useState<'main' | 'equipment' | 'personal'>('main');
  
  const [homeSearch, setHomeSearch] = useState(currentSettings.homeLocation);
  const [workSearch, setWorkSearch] = useState(currentSettings.workLocation);
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [showWorkSuggestions, setShowWorkSuggestions] = useState(false);
  const [globalHomeResults, setGlobalHomeResults] = useState<BelgianLocation[]>([]);
  const [globalWorkResults, setGlobalWorkResults] = useState<BelgianLocation[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState({ home: false, work: false });
  const [isSaving, setIsSaving] = useState(false);

  const speedRange = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 15), []); // 15 to 45 kph
  const speedPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setEditSettings(currentSettings);
      setHomeSearch(currentSettings.homeLocation);
      setWorkSearch(currentSettings.workLocation);
      setIsSaving(false);
      setCurrentView('main');
    }
  }, [isOpen, currentSettings]);

  useEffect(() => {
    if (homeSearch.length < 3) { setGlobalHomeResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingGlobal(prev => ({ ...prev, home: true }));
      try {
        const results = await getDirectLocationSuggestions(homeSearch);
        setGlobalHomeResults(results);
      } catch (e) { /* ignore */ } 
      finally { setIsSearchingGlobal(prev => ({ ...prev, home: false })); }
    }, 400);
    return () => clearTimeout(timer);
  }, [homeSearch]);

  useEffect(() => {
    if (workSearch.length < 3) { setGlobalWorkResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingGlobal(prev => ({ ...prev, work: true }));
      try {
        const results = await getDirectLocationSuggestions(workSearch);
        setGlobalWorkResults(results);
      } catch (e) { /* ignore */ } 
      finally { setIsSearchingGlobal(prev => ({ ...prev, work: false })); }
    }, 400);
    return () => clearTimeout(timer);
  }, [workSearch]);

  // Sync scroll on mount/change
  useEffect(() => {
    if (currentView === 'personal' && speedPickerRef.current) {
      const targetSpeed = editSettings.averageSpeed || 25;
      const timer = setTimeout(() => {
        const el = speedPickerRef.current?.querySelector(`[data-speed="${targetSpeed}"]`);
        if (el) {
           el.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentView, editSettings.averageSpeed]);

  const handleSelectSuggestion = (type: 'home' | 'work', loc: BelgianLocation) => {
    if (type === 'home') {
      setEditSettings(prev => ({ ...prev, homeLocation: loc.name, homeCoords: { lat: loc.lat, lng: loc.lng } }));
      setHomeSearch(loc.name);
      setShowHomeSuggestions(false);
    } else {
      setEditSettings(prev => ({ ...prev, workLocation: loc.name, workCoords: { lat: loc.lat, lng: loc.lng } }));
      setWorkSearch(loc.name);
      setShowWorkSuggestions(false);
    }
  };

  const handleThemeChange = (theme: 'dark' | 'light') => {
    setEditSettings(prev => ({ ...prev, theme }));
    onThemeChange(theme);
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    await onSave(editSettings);
    if (isOpen) setIsSaving(false);
  };

  const handleResetApp = () => {
    const confirmed = window.confirm("Reset Application? This will clear all saved locations, equipment, and cache. You will return to a clean factory state.");
    if (confirmed) {
      localStorage.removeItem('velo_settings');
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem('commute_iq_usage_log');
      window.location.href = '/'; 
      window.location.reload();
    }
  };

  const toggleWorkDay = (day: number) => {
    setEditSettings(prev => {
      const current = prev.workDays || [1, 2, 3, 4, 5];
      if (current.includes(day)) {
        return { ...prev, workDays: current.filter(d => d !== day) };
      } else {
        return { ...prev, workDays: [...current, day].sort() };
      }
    });
  };

  const fitnessGoals: { id: FitnessGoal; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'commute', label: 'Commute', desc: 'Efficiency first. Get from A to B.', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'active', label: 'Active', desc: 'Health maintenance. Moderate effort.', icon: <Heart className="w-4 h-4" /> },
    { id: 'fitness', label: 'Fitness', desc: 'Performance gains. High intensity.', icon: <Zap className="w-4 h-4" /> },
  ];

  const weekDays = [
    { label: 'M', val: 1 },
    { label: 'T', val: 2 },
    { label: 'W', val: 3 },
    { label: 'T', val: 4 },
    { label: 'F', val: 5 },
    { label: 'S', val: 6 },
    { label: 'S', val: 0 },
  ];

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col animate-in fade-in duration-300 ${isDark ? 'bg-[#05070a]' : 'bg-white'}`}>
      <div className="flex-1 max-w-md mx-auto w-full flex flex-col px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] h-full">
        
        {currentView === 'main' && (
          <div className="flex items-center justify-between pb-1.5 flex-none">
            <h2 className={`text-xl font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</h2>
            <button onClick={onClose} className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}><X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-900'}`} /></button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto hide-scrollbar pb-4 gap-3">
           
           {currentView === 'equipment' ? (
             <EquipmentManager 
                equipment={editSettings.equipment}
                onChange={(newEq) => setEditSettings(prev => ({...prev, equipment: newEq}))}
                onClose={() => setCurrentView('main')}
                isDark={isDark}
             />
           ) : currentView === 'personal' ? (
             <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
                <div className="flex items-center gap-3 mb-4 flex-none">
                  <button onClick={() => setCurrentView('main')} className={`p-2 rounded-full transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h2 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Personal Profile</h2>
                </div>

                <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-6 min-h-0">
                  <div className={`p-5 rounded-3xl border flex flex-col gap-3 flex-none ${isDark ? 'bg-[#05070a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex justify-between items-end px-1">
                       <div className="flex items-center gap-2 text-slate-500">
                          <Gauge className="w-4 h-4" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Cruising Velocity</span>
                       </div>
                       <span className={`text-xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{editSettings.averageSpeed || 25} <span className="text-xs text-slate-500">km/h</span></span>
                    </div>
                    
                    <div className={`h-16 rounded-2xl border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
                       <div className={`absolute inset-y-0 left-0 w-12 z-10 pointer-events-none bg-gradient-to-r ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
                       <div className={`absolute inset-y-0 right-0 w-12 z-10 pointer-events-none bg-gradient-to-l ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
                       <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-12 rounded-xl border-2 pointer-events-none z-20 ${isDark ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-400 bg-white shadow-sm'}`} />

                       <div 
                         ref={speedPickerRef}
                         className="h-full flex items-center gap-4 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory px-[calc(50%-28px)]"
                       >
                          {speedRange.map(s => {
                            const isSelected = (editSettings.averageSpeed || 25) === s;
                            return (
                              <button
                                key={s} data-speed={s} onClick={() => setEditSettings(prev => ({ ...prev, averageSpeed: s }))}
                                className={`flex-none w-14 h-10 flex flex-col items-center justify-center transition-all snap-center relative rounded-lg z-30 ${
                                  isSelected 
                                    ? (isDark ? 'text-blue-400 scale-115 font-black' : 'text-slate-950 scale-115 font-black') 
                                    : (isDark ? 'text-slate-700 font-bold' : 'text-slate-400 font-bold')
                                }`}
                              >
                                <span className="text-[15px] leading-none">{s}</span>
                              </button>
                            );
                          })}
                       </div>
                    </div>
                  </div>

                  <div className={`p-5 rounded-3xl border flex flex-col gap-4 flex-none ${isDark ? 'bg-[#05070a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex items-center gap-2 text-slate-500 px-1">
                       <CalendarDays className="w-4 h-4" />
                       <span className="text-[9px] font-black uppercase tracking-widest">Active Commute Days</span>
                    </div>
                    <div className="flex gap-2">
                      {weekDays.map(d => {
                         const isActive = editSettings.workDays?.includes(d.val);
                         return (
                           <button
                             key={d.label + d.val}
                             onClick={() => toggleWorkDay(d.val)}
                             className={`flex-1 h-10 rounded-xl font-black text-[11px] transition-all active:scale-95 ${
                               isActive 
                                 ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                 : isDark ? 'bg-slate-900/50 border border-white/5 text-slate-500 hover:text-slate-300' : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600'
                             }`}
                           >
                             {d.label}
                           </button>
                         )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 flex-none">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Strategic Focus</label>
                    <div className="flex flex-col gap-2">
                      {fitnessGoals.map((goal) => (
                        <button
                          key={goal.id}
                          onClick={() => setEditSettings(prev => ({ ...prev, fitnessGoal: goal.id }))}
                          className={`p-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-200 active:scale-[0.98] ${
                            editSettings.fitnessGoal === goal.id
                              ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20' 
                              : isDark 
                                ? 'bg-slate-900/50 border-white/5 hover:bg-white/5' 
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className={`p-2.5 rounded-xl ${editSettings.fitnessGoal === goal.id ? 'bg-white/20 text-white' : isDark ? 'bg-white/5 text-slate-400' : 'bg-white text-slate-500 shadow-sm'}`}>
                            {goal.icon}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs font-black uppercase ${editSettings.fitnessGoal === goal.id ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-900'}`}>{goal.label}</span>
                            <span className={`text-[10px] font-medium leading-tight ${editSettings.fitnessGoal === goal.id ? 'text-blue-100' : 'text-slate-500'}`}>{goal.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
                
                <div className="flex-none pt-2">
                  <button 
                    onClick={() => setCurrentView('main')}
                    className={`w-full py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg transition-all active:scale-[0.98] ${isDark ? 'bg-slate-800 text-white border border-white/10' : 'bg-white text-slate-900 border border-slate-200'}`}
                  >
                    Back to Settings
                  </button>
                </div>
             </div>
           ) : (
             <div className="flex flex-col gap-3 animate-in slide-in-from-left-4 duration-300">
               <div className="flex flex-col gap-1.5">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">System Appearance</label>
                 <div className={`flex rounded-2xl p-1 border transition-all ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                   <button onClick={() => handleThemeChange('light')} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${editSettings.theme === 'light' ? 'bg-white text-blue-600 shadow-lg shadow-blue-500/10 border border-blue-500/10' : 'text-slate-500'}`}><Sun className="w-4 h-4" />Light</button>
                   <button onClick={() => handleThemeChange('dark')} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${editSettings.theme === 'dark' ? 'bg-slate-800 text-blue-400 shadow-lg shadow-black/20 border border-white/10' : 'text-slate-500'}`}><Moon className="w-4 h-4" />Dark</button>
                 </div>
               </div>

               <div className="flex flex-col gap-1.5">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Location Management</label>
                 <div className="flex flex-col gap-1.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input type="text" placeholder="Search Home Address..." value={homeSearch} onFocus={() => setShowHomeSuggestions(true)} onChange={(e) => { setHomeSearch(e.target.value); setShowHomeSuggestions(true); }} className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} />
                      {homeSearch && ( 
                        <button onClick={() => { setHomeSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      )}
                      {showHomeSuggestions && (isSearchingGlobal.home || globalHomeResults.length > 0) && (
                        <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                          {globalHomeResults.map(loc => (
                                <button key={`${loc.name}-${loc.lat}`} onClick={() => handleSelectSuggestion('home', loc)} className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}>
                                  <span className="truncate pr-4">{loc.name}</span>
                                  <div className="flex items-center gap-1 text-[8px] font-black text-blue-500/80 shrink-0">
                                    <Globe className="w-2.5 h-2.5" />
                                    <span>GPS</span>
                                  </div>
                                </button>
                          ))}
                          {isSearchingGlobal.home && (
                            <div className={`px-4 py-2.5 flex items-center gap-2 text-xs font-medium border-t ${isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                              <span className="text-blue-500/80">Scanning Maps...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input type="text" placeholder="Search Work Address..." value={workSearch} onFocus={() => setShowWorkSuggestions(true)} onChange={(e) => { setWorkSearch(e.target.value); setShowWorkSuggestions(true); }} className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} />
                      {workSearch && ( 
                        <button onClick={() => { setWorkSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      )}
                      {showWorkSuggestions && (isSearchingGlobal.work || globalWorkResults.length > 0) && (
                        <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                          {globalWorkResults.map(loc => (
                                <button key={`${loc.name}-${loc.lat}`} onClick={() => handleSelectSuggestion('work', loc)} className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}>
                                  <span className="truncate pr-4">{loc.name}</span>
                                  <div className="flex items-center gap-1 text-[8px] font-black text-blue-500/80 shrink-0">
                                    <Globe className="w-2.5 h-2.5" />
                                    <span>GPS</span>
                                  </div>
                                </button>
                          ))}
                          {isSearchingGlobal.work && (
                            <div className={`px-4 py-2.5 flex items-center gap-2 text-xs font-medium border-t ${isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                              <span className="text-blue-500/80">Scanning Maps...</span>
                            </div>
                          )}
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
                       <input type="time" value={editSettings.morningWindow[0]} onChange={(e) => setEditSettings(prev => ({...prev, morningWindow: [e.target.value, prev.morningWindow[1]]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                       <span className="text-slate-600 text-[10px]">→</span>
                       <input type="time" value={editSettings.morningWindow[1]} onChange={(e) => setEditSettings(prev => ({...prev, morningWindow: [prev.morningWindow[0], e.target.value]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                     </div>
                   </div>
                   <div className={`border rounded-xl p-2.5 flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                     <div className="flex items-center justify-between"><span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Evening</span><Clock className="w-2.5 h-2.5 text-orange-400 opacity-50" /></div>
                     <div className="flex items-center gap-1">
                       <input type="time" value={editSettings.eveningWindow[0]} onChange={(e) => setEditSettings(prev => ({...prev, eveningWindow: [e.target.value, prev.eveningWindow[1]]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                       <span className="text-slate-600 text-[10px]">→</span>
                       <input type="time" value={editSettings.eveningWindow[1]} onChange={(e) => setEditSettings(prev => ({...prev, eveningWindow: [prev.morningWindow[0], e.target.value]}))} className="bg-transparent text-[11px] font-bold text-slate-400 outline-none w-full" />
                     </div>
                   </div>
                 </div>
               </div>

               <div className="flex flex-col gap-1.5">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Equipment</label>
                 <button onClick={() => setCurrentView('equipment')} className={`w-full py-3 rounded-xl border flex items-center justify-between px-3.5 transition-all ${isDark ? 'bg-slate-900/50 border-white/5 hover:bg-white/5' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
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
                 <button onClick={() => setEditSettings(prev => ({...prev, disableAI: !prev.disableAI}))} className={`w-full py-3 rounded-xl border flex items-center justify-between px-3.5 transition-all ${!editSettings.disableAI ? 'bg-blue-600/10 border-blue-500/30' : isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                   <div className="flex items-center gap-2.5">
                     {editSettings.disableAI ? <EyeOff className="w-4 h-4 text-slate-500" /> : <BrainCircuit className="w-4 h-4 text-blue-500" />}
                     <div className="flex flex-col items-start"><span className={`text-[10px] font-black uppercase tracking-widest ${!editSettings.disableAI ? 'text-blue-500' : 'text-slate-500'}`}>AI Analysis</span><span className="text-[8px] text-slate-500 font-medium">Enhanced tactical interpretation</span></div>
                   </div>
                   <div className={`w-8 h-5 rounded-full relative transition-all duration-300 ${!editSettings.disableAI ? 'bg-blue-600' : 'bg-slate-600'}`}>
                     <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 transform ${!editSettings.disableAI ? 'translate-x-3' : 'translate-x-0'}`} />
                   </div>
                 </button>
               </div>
               
               <div className="flex flex-col gap-2 mt-1">
                 <button onClick={() => setCurrentView('personal')} className={`w-full py-2.5 rounded-xl border flex items-center gap-3 px-3.5 transition-all ${isDark ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
                   <User className="w-4 h-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Personal Settings</span>
                 </button>
                 <button onClick={onOpenConnectivity} className={`w-full py-2.5 rounded-xl border flex items-center gap-3 px-3.5 transition-all ${isDark ? 'bg-blue-500/5 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                   <Activity className="w-4 h-4 text-blue-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Connectivity Hub</span>
                 </button>
               </div>

               <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t border-dashed border-slate-500/20">
                 <label className="text-[9px] font-black uppercase text-red-500 tracking-widest ml-1">Danger Zone</label>
                 <button onClick={handleResetApp} className={`w-full py-3.5 rounded-xl border flex items-center justify-center gap-3 px-3.5 transition-all active:scale-[0.98] ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                   <RotateCcw className="w-4 h-4" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">Reset Application</span>
                 </button>
                 <p className="text-[8px] text-center font-bold text-slate-500 uppercase tracking-widest mt-1">Clears all locations, equipment, and cached pulse data.</p>
               </div>
             </div>
           )}
        </div>

        {currentView === 'main' && (
          <div className="flex-none pt-2">
            <button 
              onClick={handleSaveClick} 
              disabled={isSaving}
              className={`w-full py-3 bg-blue-600 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] text-white shadow-xl shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${isSaving ? 'opacity-80' : ''}`}
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
