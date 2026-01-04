
import React, { useState, useEffect } from 'react';
import { CommuteSettings } from '../../types';
import { EquipmentManager } from '../EquipmentManager';
import { BelgianLocation, BELGIAN_LOCATIONS } from '../../locations';
import { getGlobalLocationSuggestions } from '../../services/geminiService';
import { filterLocationsWithGlobal } from '../../utils/helpers';
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
  Loader2
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
  const [isEquipmentViewOpen, setIsEquipmentViewOpen] = useState(false);
  
  // Search State
  const [homeSearch, setHomeSearch] = useState(currentSettings.homeLocation);
  const [workSearch, setWorkSearch] = useState(currentSettings.workLocation);
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [showWorkSuggestions, setShowWorkSuggestions] = useState(false);
  const [globalHomeResults, setGlobalHomeResults] = useState<BelgianLocation[]>([]);
  const [globalWorkResults, setGlobalWorkResults] = useState<BelgianLocation[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState({ home: false, work: false });
  const [isSaving, setIsSaving] = useState(false);

  // Sync internal state when opened
  useEffect(() => {
    if (isOpen) {
      setEditSettings(currentSettings);
      setHomeSearch(currentSettings.homeLocation);
      setWorkSearch(currentSettings.workLocation);
      setIsSaving(false);
    }
  }, [isOpen, currentSettings]);

  // Global Search Logic
  useEffect(() => {
    if (homeSearch.length < 3) { setGlobalHomeResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingGlobal(prev => ({ ...prev, home: true }));
      try {
        const results = await getGlobalLocationSuggestions(homeSearch);
        setGlobalHomeResults(results);
      } catch (e) { /* ignore */ } 
      finally { setIsSearchingGlobal(prev => ({ ...prev, home: false })); }
    }, 500);
    return () => clearTimeout(timer);
  }, [homeSearch]);

  useEffect(() => {
    if (workSearch.length < 3) { setGlobalWorkResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingGlobal(prev => ({ ...prev, work: true }));
      try {
        const results = await getGlobalLocationSuggestions(workSearch);
        setGlobalWorkResults(results);
      } catch (e) { /* ignore */ } 
      finally { setIsSearchingGlobal(prev => ({ ...prev, work: false })); }
    }, 500);
    return () => clearTimeout(timer);
  }, [workSearch]);

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
    // The modal will likely unmount here due to onSave logic in App.tsx
    // But if not, we reset saving state
    if (isOpen) setIsSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col animate-in fade-in duration-300 ${isDark ? 'bg-[#05070a]' : 'bg-white'}`}>
      <div className="flex-1 max-w-md mx-auto w-full flex flex-col px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] h-full">
        
        {!isEquipmentViewOpen && (
          <div className="flex items-center justify-between pb-1.5 flex-none">
            <h2 className={`text-xl font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</h2>
            <button onClick={onClose} className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}><X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-900'}`} /></button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto hide-scrollbar pb-4 gap-3">
           
           {isEquipmentViewOpen ? (
             <EquipmentManager 
                equipment={editSettings.equipment}
                onChange={(newEq) => setEditSettings(prev => ({...prev, equipment: newEq}))}
                onClose={() => setIsEquipmentViewOpen(false)}
                isDark={isDark}
             />
           ) : (
             <div className="flex flex-col gap-3 animate-in slide-in-from-left-4 duration-300">
               
               {/* Theme */}
               <div className="flex flex-col gap-1.5">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">System Appearance</label>
                 <div className={`flex rounded-2xl p-1 border transition-all ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                   <button onClick={() => handleThemeChange('light')} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${editSettings.theme === 'light' ? 'bg-white text-blue-600 shadow-lg shadow-blue-500/10 border border-blue-500/10' : 'text-slate-500'}`}><Sun className="w-4 h-4" />Light</button>
                   <button onClick={() => handleThemeChange('dark')} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${editSettings.theme === 'dark' ? 'bg-slate-800 text-blue-400 shadow-lg shadow-black/20 border border-white/10' : 'text-slate-500'}`}><Moon className="w-4 h-4" />Dark</button>
                 </div>
               </div>

               {/* Profile Config */}
               <div className="flex flex-col gap-1.5">
                 <label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Profile Configuration</label>
                 <div className="flex flex-col gap-1.5">
                    {/* Home Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input type="text" placeholder="Home Location..." value={homeSearch} onFocus={() => setShowHomeSuggestions(true)} onChange={(e) => { setHomeSearch(e.target.value); setEditSettings(prev => ({...prev, homeLocation: e.target.value})); setShowHomeSuggestions(true); }} className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} />
                      {homeSearch && ( 
                        <button onClick={() => { setHomeSearch(""); setEditSettings(prev => ({...prev, homeLocation: "", homeCoords: undefined})); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      )}
                      {showHomeSuggestions && (isSearchingGlobal.home || filterLocationsWithGlobal(homeSearch, globalHomeResults).length > 0) && (
                        <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                          {filterLocationsWithGlobal(homeSearch, globalHomeResults).map(loc => {
                              const isGlobal = !BELGIAN_LOCATIONS.some(bl => bl.name === loc.name);
                              return (
                                <button key={loc.name} onClick={() => handleSelectSuggestion('home', loc)} className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}>
                                  <span>{loc.name}</span>
                                  {isGlobal && (
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-blue-500/80">
                                      <MapPin className="w-3 h-3" />
                                      <span>MAPS</span>
                                    </div>
                                  )}
                                </button>
                              );
                          })}
                          {isSearchingGlobal.home && (
                            <div className={`px-4 py-2.5 flex items-center gap-2 text-xs font-medium border-t ${isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                              <span className="text-blue-500/80">Searching via Google Maps...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Work Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input type="text" placeholder="Work Location..." value={workSearch} onFocus={() => setShowWorkSuggestions(true)} onChange={(e) => { setWorkSearch(e.target.value); setEditSettings(prev => ({...prev, workLocation: e.target.value})); setShowWorkSuggestions(true); }} className={`w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 border transition-all ${isDark ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} />
                      {workSearch && ( 
                        <button onClick={() => { setWorkSearch(""); setEditSettings(prev => ({...prev, workLocation: "", workCoords: undefined})); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      )}
                      {showWorkSuggestions && (isSearchingGlobal.work || filterLocationsWithGlobal(workSearch, globalWorkResults).length > 0) && (
                        <div className={`absolute top-full left-0 right-0 mt-1 z-[210] border rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                          {filterLocationsWithGlobal(workSearch, globalWorkResults).map(loc => {
                              const isGlobal = !BELGIAN_LOCATIONS.some(bl => bl.name === loc.name);
                              return (
                                <button key={loc.name} onClick={() => handleSelectSuggestion('work', loc)} className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-medium border-b last:border-0 ${isDark ? 'border-white/5 text-slate-300 hover:bg-white/5' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}>
                                  <span>{loc.name}</span>
                                  {isGlobal && (
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-blue-500/80">
                                      <MapPin className="w-3 h-3" />
                                      <span>MAPS</span>
                                    </div>
                                  )}
                                </button>
                              );
                          })}
                          {isSearchingGlobal.work && (
                            <div className={`px-4 py-2.5 flex items-center gap-2 text-xs font-medium border-t ${isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                              <span className="text-blue-500/80">Searching via Google Maps...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                 </div>
               </div>

               {/* Schedule */}
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

               {/* Equipment */}
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

               {/* Intelligence */}
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
               
               {/* Footer Buttons */}
               <div className="flex flex-col gap-2 mt-1 pb-4">
                 <button onClick={() => { onOpenTraining(); onClose(); }} className={`w-full py-2.5 rounded-xl border flex items-center gap-3 px-3.5 transition-all ${isDark ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
                   <Trophy className="w-4 h-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Training Mode</span>
                 </button>
                 <button onClick={onOpenConnectivity} className={`w-full py-2.5 rounded-xl border flex items-center gap-3 px-3.5 transition-all ${isDark ? 'bg-blue-500/5 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                   <Activity className="w-4 h-4 text-blue-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Connectivity Hub</span>
                 </button>
               </div>
             </div>
           )}
        </div>

        {!isEquipmentViewOpen && (
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