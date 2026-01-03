
import React from 'react';
import { Info, Calendar, RefreshCw, Settings as SettingsIcon, Database, Check, Trophy } from 'lucide-react';

interface HeaderProps {
  onOpenInfo: () => void;
  viewMode: 'daily' | 'weekly' | 'training';
  isDateDropdownOpen: boolean;
  setIsDateDropdownOpen: (val: boolean) => void;
  selectedDateOffset: number;
  setSelectedDateOffset: (val: number) => void;
  setViewMode: (val: 'daily' | 'weekly' | 'training') => void;
  activeDayLabels: { name: string; num: number; month: string };
  loading: boolean;
  onSync: () => void;
  onOpenSettings: () => void;
  isDark: boolean;
}

const getDayLabel = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return {
    name: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
    num: d.getDate(),
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
  };
};

export const Header: React.FC<HeaderProps> = ({
  onOpenInfo,
  viewMode,
  isDateDropdownOpen,
  setIsDateDropdownOpen,
  selectedDateOffset,
  setSelectedDateOffset,
  setViewMode,
  activeDayLabels,
  loading,
  onSync,
  onOpenSettings,
  isDark
}) => {
  return (
    <header className="flex-none px-6 py-2 flex items-center justify-between z-50 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button 
        onClick={onOpenInfo}
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
          <button onClick={onSync} className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-lg">
            <RefreshCw className={`w-4.5 h-4.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onOpenSettings} className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-lg">
            <SettingsIcon className="w-4.5 h-4.5 text-slate-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
