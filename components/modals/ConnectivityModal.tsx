
import React from 'react';
import { Activity, X, Server, BrainCircuit, MapPin, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { ConnectionStatusState } from '../../types';

interface ConnectivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ConnectionStatusState;
  onCheckConnection: () => void;
  isDark: boolean;
}

export const ConnectivityModal: React.FC<ConnectivityModalProps> = ({ isOpen, onClose, status, onCheckConnection, isDark }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-sm border rounded-[2rem] flex flex-col shadow-3xl p-6 animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Activity className="w-4 h-4 text-blue-500" /></div>
            <h2 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>Connectivity Status</h2>
          </div>
          <button onClick={onClose} className={`transition-colors ${isDark ? 'text-slate-600 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}><X className="w-4 h-4" /></button>
        </div>
        
        <div className="space-y-3 mb-6">
          {Object.entries(status).filter(([name]) => name !== 'llmDetails').map(([name, stat]) => (
            <div key={name} className={`flex items-center justify-between p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                {name === 'Open-Meteo' ? <Server className="w-4 h-4 text-slate-500" /> : name === 'Gemini LLM' ? <BrainCircuit className="w-4 h-4 text-blue-500" /> : <MapPin className="w-4 h-4 text-emerald-500" />}
                <span className={`text-xs font-bold uppercase tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{name}</span>
              </div>
              <div className="flex items-center gap-2">
                {stat === 'checking' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                ) : stat === 'ok' ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                    <Check className="w-2.5 h-2.5" />
                    Online
                  </div>
                ) : stat === 'fallback' ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[8px] font-black uppercase tracking-widest">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Fallback
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase tracking-widest">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Failed
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <div className={`flex flex-col gap-2 p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-3 mb-1">
              <BrainCircuit className="w-4 h-4 text-blue-500" />
              <span className={`text-xs font-bold uppercase tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>LLM Details</span>
            </div>
            {status.llmDetails.priority ? (
              <div className="flex flex-col gap-1 text-[10px] font-medium">
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                    {status.llmDetails.model ? 'Active Model:' : 'Last Attempted:'}
                  </span>
                  <span className={isDark ? 'text-white' : 'text-slate-900'}>
                    {status.llmDetails.model || 
                     (status.llmDetails.priority.startsWith('All failed') 
                        ? status.llmDetails.priority.split('(initial: ')[1]?.replace(')', '') || 'Unknown' 
                        : 'N/A')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Status:</span>
                  <span className={isDark ? 'text-white' : 'text-slate-900'}>
                    {status.llmDetails.model ? status.llmDetails.priority : 'Failed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Alternatives Left:</span>
                  <span className={isDark ? 'text-white' : 'text-slate-900'}>{status.llmDetails.alternatives}</span>
                </div>
              </div>
            ) : (
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                LLM status not yet determined. Ensure API key is configured.
              </p>
            )}
          </div>
        </div>

        <button onClick={onCheckConnection} className={`w-full py-3 mb-2 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] bg-blue-600 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2`}>
          <RefreshCw className="w-3.5 h-3.5" />
          Recalibrate Connections
        </button>
        <button onClick={onClose} className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] transition-all ${isDark ? 'bg-slate-900 border border-white/5 text-slate-500 hover:text-white' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'}`}>Close Hub</button>
      </div>
    </div>
  );
};
