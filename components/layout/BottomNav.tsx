
import React from 'react';
import { Bike, Trophy, CalendarDays } from 'lucide-react';

interface BottomNavProps {
  viewMode: 'daily' | 'weekly' | 'training' | 'training-weekly';
  setViewMode: (mode: 'daily' | 'weekly' | 'training' | 'training-weekly') => void;
  onShowTrainingWeekly: () => void;
  isDark: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ 
  viewMode, 
  setViewMode, 
  onShowTrainingWeekly,
  isDark 
}) => {
  const isCommuteGroup = viewMode === 'daily' || viewMode === 'weekly';
  const isTrainingGroup = viewMode === 'training' || viewMode === 'training-weekly';
  const isWeeklyActive = viewMode === 'weekly' || viewMode === 'training-weekly';

  const handleWeeklyToggle = () => {
    if (isCommuteGroup) {
      setViewMode(viewMode === 'weekly' ? 'daily' : 'weekly');
    } else if (isTrainingGroup) {
      if (viewMode === 'training-weekly') {
        setViewMode('training');
      } else {
        onShowTrainingWeekly();
      }
    }
  };

  // Modern iOS-style tab bar approach: Taller height, better centering, 
  // and explicit handling of both safe areas and legacy bottom edges.
  return (
    <nav className={`flex-none w-full border-t z-[100] px-6 transition-colors duration-300 ${
      isDark 
        ? 'bg-[#05070a]/90 backdrop-blur-xl border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]' 
        : 'bg-white/90 backdrop-blur-xl border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]'
    }`}>
      <div className="max-w-md mx-auto flex flex-col pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-1 h-12">
          <button 
            onClick={() => setViewMode('daily')}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90 ${
              isCommuteGroup && !isWeeklyActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <Bike className={`w-6 h-6 transition-all duration-300 ${isCommuteGroup && !isWeeklyActive ? 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`} />
              {isCommuteGroup && !isWeeklyActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Commute</span>
          </button>

          <button 
            onClick={() => setViewMode('training')}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90 ${
              isTrainingGroup && !isWeeklyActive ? (isDark ? 'text-orange-400' : 'text-orange-600') : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <Trophy className={`w-6 h-6 transition-all duration-300 ${isTrainingGroup && !isWeeklyActive ? 'drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]' : ''}`} />
              {isTrainingGroup && !isWeeklyActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Training</span>
          </button>

          <button 
            onClick={handleWeeklyToggle}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90 ${
              isWeeklyActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <CalendarDays className={`w-6 h-6 transition-all duration-300 ${isWeeklyActive ? 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`} />
              {isWeeklyActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">7 Day</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
