
import React, { useMemo, useState } from 'react';
import { ChevronRight, AlertTriangle, Droplets, ShieldCheck, Info, Loader2, X, BrainCircuit, Zap } from 'lucide-react';

interface WeeklyForecastProps {
  pulseDataMap: Record<number, any>;
  loadingOffsets?: number[];
  onSelectDay: (offset: number) => void;
  theme?: 'dark' | 'light';
}

const OFFSETS = [0, 1, 2, 3, 4, 5, 6];

const getScoreStyles = (score: number, hasPulse: boolean, isDark: boolean) => {
  if (!hasPulse) return { color: isDark ? 'text-slate-300' : 'text-slate-400', bg: isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-100 border-slate-200', shadow: '' };
  
  const roundedScore = Math.round(score);
  if (roundedScore > 70) {
    return { 
      color: isDark ? 'text-emerald-300' : 'text-emerald-600', 
      bg: isDark ? 'bg-emerald-900/40 border-emerald-500/40' : 'bg-emerald-50 border-emerald-200', 
      shadow: isDark ? 'shadow-[0_0_25px_rgba(16,185,129,0.1)]' : 'shadow-md' 
    };
  }
  if (roundedScore >= 30) {
    return { 
      color: isDark ? 'text-orange-300' : 'text-orange-600', 
      bg: isDark ? 'bg-orange-900/40 border-orange-500/40' : 'bg-orange-50 border-orange-200', 
      shadow: isDark ? '' : 'shadow-sm' 
    };
  }
  return { 
    color: isDark ? 'text-red-300' : 'text-red-600', 
    bg: isDark ? 'bg-red-900/40 border-red-500/40' : 'bg-red-50 border-red-200', 
    shadow: isDark ? 'shadow-[0_0_25px_rgba(239,68,68,0.1)]' : 'shadow-md' 
  };
};

export const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ pulseDataMap, loadingOffsets = [], onSelectDay, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const [showOutlookInfo, setShowOutlookInfo] = useState(false);

  const progress = useMemo(() => {
    const loadedCount = OFFSETS.filter(o => pulseDataMap[o] && !loadingOffsets.includes(o)).length;
    return (loadedCount / OFFSETS.length) * 100;
  }, [pulseDataMap, loadingOffsets]);

  const isCompleted = progress >= 100;

  return (
    <div className="flex flex-col gap-4 pb-6 relative">
      {/* SCREEN TITLE AREA */}
      <div className="flex items-center justify-between px-1 mb-1">
        <button 
          onClick={() => setShowOutlookInfo(true)}
          className="flex items-center gap-2 group active:opacity-70 transition-opacity"
        >
          <div className={`p-1.5 rounded-lg border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
            <Zap className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="flex flex-col items-start">
            <h2 className={`text-xs font-black uppercase tracking-[0.25em] ${isDark ? 'text-white' : 'text-slate-900'}`}>7-Day Outlook</h2>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              Pulse Metadata <Info className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
        </button>
      </div>

      {/* OUTLOOK INFO POPUP */}
      {showOutlookInfo && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowOutlookInfo(false)} />
          <div className={`relative w-full max-w-xs border rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Forecasting Logic</span>
              <button onClick={() => setShowOutlookInfo(false)} className="p-1 rounded-full hover:bg-white/10"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-none"><BrainCircuit className="w-4 h-4 text-blue-400" /></div>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Minimal Score Policy</span>
                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed">The displayed score represents the worst-case scenario. It is the minimum value between your morning and evening commute to ensure maximum preparedness.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-none"><AlertTriangle className="w-4 h-4 text-red-400" /></div>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Critical Ice Triggers</span>
                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed">If sub-zero surface risk or active freezing is detected on either leg of your journey, the 'ICE' indicator is activated for the entire day.</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowOutlookInfo(false)}
              className={`w-full mt-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDark ? 'bg-slate-900 text-slate-400 border border-white/5 hover:text-white' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'}`}
            >
              Understand
            </button>
          </div>
        </div>
      )}

      {!isCompleted && (
        <div className={`flex flex-col gap-2 p-4 rounded-3xl border transition-all duration-500 animate-in fade-in slide-in-from-top-2 ${isDark ? 'bg-slate-900/80 border-white/20' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
               <Info className={`w-3 h-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
               <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>Syncing Forecast</span>
            </div>
            <span className={`text-[10px] font-mono font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{Math.round(progress)}%</span>
          </div>
          <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <div 
              className="h-full bg-blue-500 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(37,99,235,0.4)]" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {OFFSETS.map((offset) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          const dayName = d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
          const dateNum = d.getDate();
          
          const pulse = pulseDataMap[offset];
          const isLoading = loadingOffsets.includes(offset);
          const score = pulse?.score ?? 0;
          const styles = getScoreStyles(score, !!pulse && !isLoading, isDark);
          
          const isWet = pulse?.summary?.isWet ?? false;
          const hasIce = pulse?.summary?.isIcy ?? false;

          return (
            <button
              key={offset}
              onClick={() => onSelectDay(offset)}
              disabled={isLoading}
              className={`group relative flex items-center justify-between p-4 rounded-3xl border transition-all duration-300 overflow-hidden ${styles.bg} ${styles.shadow} ${isLoading ? 'opacity-70 animate-pulse' : 'hover:scale-[1.01] active:scale-[0.99] hover:border-blue-400'}`}
            >
              <div className="flex items-center gap-5 z-10">
                <div className="flex flex-col items-center justify-center min-w-[3rem]">
                  <span className={`text-[10px] font-black tracking-widest ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{dayName}</span>
                  <span className={`text-xl font-black mt-1 leading-none ${isDark ? 'text-white' : 'text-slate-950'}`}>{dateNum}</span>
                </div>

                <div className={`h-8 w-px ${isDark ? 'bg-white/20' : 'bg-slate-300'}`} />

                <div className="flex flex-col gap-1.5 min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <span className={`text-[7px] font-black uppercase tracking-widest outline-none leading-none ${isDark ? 'text-slate-300' : 'text-slate-50'}`}>
                      {isLoading ? 'Calculating...' : 'Conditions'}
                    </span>
                    {isLoading && <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-400" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {!pulse || isLoading ? (
                      <div className="flex items-center gap-2 opacity-20">
                         <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-400'}`} />
                         <div className={`w-8 h-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`} />
                      </div>
                    ) : (
                      <>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-black border transition-colors ${isWet ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'}`}>
                          {isWet ? <Droplets className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
                          {isWet ? 'WET' : 'DRY'}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-black border transition-colors ${hasIce ? 'bg-red-500/20 border-red-400 text-red-300 animate-pulse' : (isDark ? 'bg-slate-800 border-slate-600 text-slate-300' : 'bg-slate-200 border-slate-300 text-slate-500')}`}>
                          {hasIce ? <AlertTriangle className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5 opacity-30" />}
                          {hasIce ? 'ICE' : 'NO ICE'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 z-10">
                <div className="flex flex-col items-end">
                  <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Score</span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-black font-mono leading-none ${styles.color}`}>
                      {pulse && !isLoading ? Math.round(score) : '--'}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-tight opacity-90 ${styles.color}`}>%</span>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 group-hover:text-blue-400 group-hover:translate-x-1 transition-all ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
              </div>

              {pulse && !isLoading && (
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-current opacity-40 transition-all duration-1000" 
                  style={{ width: `${Math.round(score)}%`, color: 'inherit' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
