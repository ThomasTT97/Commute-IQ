
import React from 'react';

interface LoadingVisualProps {
  progress: number;
  status?: string;
  theme?: 'dark' | 'light';
}

export const LoadingVisual: React.FC<LoadingVisualProps> = ({ progress, status = "Processing", theme = 'dark' }) => {
  const safeProgress = Math.min(100, Math.max(0, progress));
  const isDark = theme === 'dark';

  return (
    <div className={`w-full flex flex-col gap-4 p-6 border rounded-[2rem] backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300 transition-colors ${isDark ? 'bg-blue-500/5 border-blue-500/10' : 'bg-white border-blue-200 shadow-md'}`}>
      <div className="flex justify-between items-end px-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-blue-500' : 'text-blue-600'}`}>Telemetry Active</span>
          </div>
          <h3 className={`text-sm font-bold uppercase tracking-tight truncate max-w-[200px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {status}
          </h3>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-2xl font-black font-mono leading-none ${isDark ? 'text-white' : 'text-slate-950'}`}>{Math.round(safeProgress)}%</span>
          <span className={`text-[7px] font-bold tracking-[0.2em] uppercase mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Network Sync</span>
        </div>
      </div>

      <div className={`relative w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-900/50' : 'bg-slate-200'}`}>
        <div 
          className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] transition-all duration-300 ease-out" 
          style={{ width: `${safeProgress}%` }} 
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-32 h-full -skew-x-12 animate-[scan_1.5s_linear_infinite]" 
             style={{ left: '-30%' }} />
      </div>

      <style>{`
        @keyframes scan {
          from { transform: translateX(-100%); }
          to { transform: translateX(500%); }
        }
      `}</style>
    </div>
  );
};
