import React, { useRef, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

interface HeaderProps {
  onOpenInfo: () => void;
  viewMode: 'daily' | 'weekly' | 'training' | 'training-weekly';
  selectedDateOffset: number;
  setSelectedDateOffset: (val: number) => void;
  onOpenSettings: () => void;
  isDark: boolean;
}

const getDayLabel = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return {
    name: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
    num: d.getDate(),
  };
};

export const Header: React.FC<HeaderProps> = ({
  onOpenInfo,
  viewMode,
  selectedDateOffset,
  setSelectedDateOffset,
  onOpenSettings,
  isDark
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayOffsets = [0, 1, 2, 3, 4, 5, 6];
  const isTrainingGroup = viewMode === 'training' || viewMode === 'training-weekly';

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector(`[data-offset="${selectedDateOffset}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDateOffset]);

  return (
    <header className="flex-none px-4 py-3 flex items-center justify-between gap-3 z-[40] pt-[max(1rem,env(safe-area-inset-top))]">
      {/* App Full Title - Larger & Taking space */}
      <div className="flex-1 flex items-center select-none cursor-pointer group">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onOpenInfo();
          }}
          className="flex items-center outline-none focus:ring-0 active:opacity-70 transition-opacity"
        >
          <span className={`text-[22px] font-black uppercase tracking-[0.05em] ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Commute
          </span>
          <span className="text-[26px] font-black italic text-blue-500 ml-1.5">IQ</span>
        </button>
      </div>
      
      {/* Date Picker - Contained in the "marked box" space */}
      <div className={`flex-none w-[140px] h-10 rounded-[1.25rem] border overflow-hidden relative ${isDark ? 'bg-black/60 border-white/10 shadow-inner' : 'bg-slate-100 border-slate-300 shadow-inner'}`}>
        <div className={`absolute inset-y-0 left-0 w-4 z-10 pointer-events-none bg-gradient-to-r ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
        <div className={`absolute inset-y-0 right-0 w-4 z-10 pointer-events-none bg-gradient-to-l ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
        
        <div 
          ref={scrollRef}
          className="h-full flex items-center gap-5 overflow-x-auto hide-scrollbar scroll-smooth px-4"
        >
          {dayOffsets.map(o => {
            const l = getDayLabel(o);
            const isActive = selectedDateOffset === o;
            return (
              <button 
                key={o} 
                data-offset={o}
                onClick={() => setSelectedDateOffset(o)}
                className={`flex-none flex flex-col items-center justify-center transition-all min-w-[24px] ${
                  isActive 
                    ? (isTrainingGroup ? 'text-orange-500 scale-110 font-black' : 'text-blue-500 scale-110 font-black')
                    : (isDark ? 'text-slate-700 font-bold' : 'text-slate-400 font-bold')
                }`}
              >
                <span className="text-[7px] font-black uppercase leading-none mb-0.5">{l.name}</span>
                <span className="text-[14px] leading-none font-black">{l.num}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings Action */}
      <button 
        onClick={onOpenSettings} 
        className={`flex-none h-10 w-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${
          isDark ? 'bg-slate-900/30 border-white/5 text-slate-400 hover:bg-white/5' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
        }`}
        aria-label="Open Settings"
      >
        <SettingsIcon className="w-4.5 h-4.5" />
      </button>
    </header>
  );
};