
import React from 'react';
import { Bike, Trophy, CalendarDays, Zap } from 'lucide-react';

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
    <nav className={`flex-none w-full border-t z-[100] px-6 pb-[env(safe-area-inset-bottom)] ${
      isDark ? 'bg-[#05070a]/80 backdrop-blur-lg border-white/5' : 'bg-white/80 backdrop-blur-lg border-slate-200'
    }`}>
      <div className="max-w-md mx-auto h-14 flex items-center justify-between gap-2">
        <button 
          onClick={() => setViewMode('daily')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            isCommuteGroup && !isWeeklyActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : 'text-slate-500'
          }`}
        >
          <Bike className={`w-5 h-5 ${isCommuteGroup && !isWeeklyActive ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Commute</span>
        </button>

        <button 
          onClick={() => setViewMode('training')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            isTrainingGroup && !isWeeklyActive ? (isDark ? 'text-orange-400' : 'text-orange-600') : 'text-slate-500'
          }`}
        >
          <Trophy className={`w-5 h-5 ${isTrainingGroup && !isWeeklyActive ? 'drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Training</span>
        </button>

        <button 
          onClick={handleWeeklyToggle}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            isWeeklyActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : 'text-slate-500'
          }`}
        >
          <CalendarDays className={`w-5 h-5 ${isWeeklyActive ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">7 Day</span>
        </button>
      </div>
    </nav>
  );
};
