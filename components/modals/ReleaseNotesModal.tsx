
import React from 'react';
import { X, Sparkles, Snowflake, Droplets, Clock, Zap, ShieldCheck } from 'lucide-react';
import { RELEASE_NOTES } from '../../constants';

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

const getFeatureIcon = (name: string) => {
  switch (name) {
    case 'Snowflake': return <Snowflake className="w-5 h-5 text-blue-300" />;
    case 'Droplets': return <Droplets className="w-5 h-5 text-blue-500" />;
    case 'Clock': return <Clock className="w-5 h-5 text-emerald-500" />;
    default: return <Zap className="w-5 h-5 text-blue-500" />;
  }
};

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({ isOpen, onClose, isDark }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className={`relative w-full max-w-[360px] border rounded-[2.5rem] flex flex-col shadow-3xl animate-in zoom-in-95 duration-200 overflow-hidden ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
        
        {/* Animated Background Element */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none" />

        <div className="p-6 pb-2 relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
              </div>
              <div className="flex flex-col min-w-0 overflow-hidden">
                <h2 className={`text-sm font-black uppercase tracking-widest leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>System Update</h2>
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis block w-full">
                  Build v{RELEASE_NOTES.version} • {RELEASE_NOTES.date}
                </span>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-full transition-colors shrink-0 ${isDark ? 'text-slate-600 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 pb-6 space-y-4 overflow-y-auto hide-scrollbar max-h-[60vh] relative z-10">
          <p className={`text-[10px] font-medium leading-relaxed opacity-70 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Tactical improvements and physics model updates for the winter cycling season.
          </p>

          <div className="space-y-2.5">
            {RELEASE_NOTES.features.map((feature, idx) => (
              <div key={idx} className={`p-3.5 rounded-2xl border flex flex-col gap-1 ${isDark ? 'bg-white/5 border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-lg shrink-0 ${isDark ? 'bg-black/40' : 'bg-white shadow-sm'}`}>
                    {getFeatureIcon(feature.icon)}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-tight ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{feature.title}</span>
                </div>
                <p className={`text-[10px] font-medium leading-[1.3] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div className={`p-3 rounded-xl border border-dashed flex items-center justify-between ${isDark ? 'border-white/10 bg-black/20' : 'border-slate-300 bg-slate-100'}`}>
             <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Stability Rating</span>
             </div>
             <span className="text-[10px] font-black text-emerald-500 uppercase">99.8%</span>
          </div>
        </div>

        <div className="p-6 pt-2">
          <button 
            onClick={onClose} 
            className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            Deploy Updates
          </button>
        </div>
      </div>
    </div>
  );
};
