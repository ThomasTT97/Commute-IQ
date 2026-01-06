
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

  return (
    <nav className={`flex-none w-full border-t z-[50] px-0 transition-colors duration-300 ${
      isDark 
        ? 'bg-[#05070a]/95 backdrop-blur-3xl border-white/5 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]' 
        : 'bg-white/95 backdrop-blur-3xl border-slate-200 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]'
    }`}>
      <div className="w-full max-w-md mx-auto flex items-center justify-between gap-0 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <button 
          onClick={() => setViewMode('daily')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all active:scale-90 ${
            isCommuteGroup && !isWeeklyActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : 'text-slate-500'
          }`}
        >
          <div className="relative">
            <Bike className={`w-6 h-6 transition-all duration-300 ${isCommuteGroup && !isWeeklyActive ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]' : ''}`} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest leading-tight">Commute</span>
        </button>

        <button 
          onClick={() => setViewMode('training')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all active:scale-90 ${
            isTrainingGroup && !isWeeklyActive ? (isDark ? 'text-orange-400' : 'text-orange-600') : 'text-slate-500'
          }`}
        >
          <div className="relative">
            <Trophy className={`w-6 h-6 transition-all duration-300 ${isTrainingGroup && !isWeeklyActive ? 'drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]' : ''}`} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest leading-tight">Training</span>
        </button>

        <button 
          onClick={handleWeeklyToggle}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all active:scale-90 ${
            isWeeklyActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : 'text-slate-500'
          }`}
        >
          <div className="relative">
            <CalendarDays className={`w-6 h-6 transition-all duration-300 ${isWeeklyActive ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]' : ''}`} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest leading-tight">7 Day</span>
        </button>
      </div>
    </nav>
  );
};
