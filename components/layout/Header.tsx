
import React, { useRef, useState } from 'react';
import { Info, Calendar, Settings as SettingsIcon, Database, Check, Trophy } from 'lucide-react';

interface HeaderProps {
  onOpenInfo: () => void;
  viewMode: 'daily' | 'weekly' | 'training' | 'training-weekly';
  isDateDropdownOpen: boolean;
  setIsDateDropdownOpen: (val: boolean) => void;
  selectedDateOffset: number;
  setSelectedDateOffset: (val: number) => void;
  setViewMode: (val: 'daily' | 'weekly' | 'training' | 'training-weekly') => void;
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
  const isTrainingMode = viewMode === 'training' || viewMode === 'training-weekly';
  const touchStartY = useRef<number | null>(null);

  // Handle Scroll/Wheel event on the title area
  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY > 20 && !isTrainingMode) {
      setViewMode('training');
    } else if (e.deltaY < -20 && isTrainingMode) {
      setViewMode('daily');
    }
  };

  // Handle Swipe gestures on the title area
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;
    
    // Threshold for swipe detection
    if (deltaY < -30 && !isTrainingMode) {
      setViewMode('training');
    } else if (deltaY > 30 && isTrainingMode) {
      setViewMode('daily');
    }
    
    touchStartY.current = null;
  };

  const toggleMode = () => {
    if (isTrainingMode) {
      setViewMode('daily');
    } else {
      setViewMode('training');
    }
  };

  return (
    <header className="flex-none px-6 py-2 flex items-center justify-between z-50 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div 
        className="flex items-center gap-1 select-none cursor-ns-resize group"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button 
          onClick={toggleMode}
          className="flex items-center gap-1 group text-left"
          aria-label="Toggle Navigation Mode"
        >
          <span className={`text-2xl font-bold tracking-tighter transition-all duration-500 ease-out transform ${isDark ? 'text-white' : 'text-slate-900'} group-hover:scale-105 active:scale-95`}>
            Commute
          </span>
          <span className="text-3xl font-black italic text-blue-500 transition-transform group-hover:skew-x-[-10deg]">IQ</span>
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            onOpenInfo();
          }}
          className="ml-1 p-1 rounded-full hover:bg-blue-500/10 transition-colors"
          aria-label="System Information"
        >
          <Info className={`w-7 h-7 transition-colors ${isDark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'}`} />
        </button>
      </div>
      
      <div className="flex-1 flex items-center justify-end gap-2 relative">
        {!isTrainingMode ? (
          <button 
            onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
            className={`flex items-center gap-2.5 px-3.5 h-10 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
              isDateDropdownOpen ? 'bg-blue-600 border-blue-500 text-white' : isDark ? 'bg-slate-900/50 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <Calendar className="w-3.5 text-blue-500" />
            <div className="flex flex-col items-center leading-[0.9]">
              <span className="text-[10px]">{selectedDateOffset === 0 ? 'TODAY' : `${activeDayLabels.name} ${activeDayLabels.num}`}</span>
              <span className="text-[9px] opacity-60 font-bold tracking-tight">{activeDayLabels.month}</span>
            </div>
          </button>
        ) : (
          <div 
            onClick={() => setViewMode('daily')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg border flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${isDark ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-600'}`}
          >
            <Trophy className="w-2.5 h-2.5" />
            Training
          </div>
        )}
        
        {isDateDropdownOpen && !isTrainingMode && (
          <div className={`absolute top-12 right-0 w-48 border rounded-2xl shadow-2xl z-[100] p-1.5 animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
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

        <button 
          onClick={onOpenSettings} 
          className={`h-10 w-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${
            isDark ? 'bg-slate-900/30 border-white/5 text-slate-400 hover:bg-white/5' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
          }`}
          aria-label="Open Settings"
        >
          <SettingsIcon className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  );
};
