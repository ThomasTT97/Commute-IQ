
import React, { useState, useEffect } from 'react';
import { Activity, X, Server, BrainCircuit, MapPin, RefreshCw, Check, AlertCircle, Gauge, Timer } from 'lucide-react';
import { ConnectionStatusState } from '../../types';
import { MODEL_CHAIN, getLlmUsageStats } from '../../services/geminiService';

interface ConnectivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ConnectionStatusState;
  onCheckConnection: () => void;
  isDark: boolean;
}

const formatModelName = (model: string | null): string | null => {
  if (!model) return null;
  if (model.includes('gemini-3-flash')) return 'Gemini 3.0 Flash';
  if (model.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
  if (model.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash';
  if (model.includes('gemini-2.0-flash-lite')) return 'Gemini 2.0 Flash Lite';
  return model;
};

export const ConnectivityModal: React.FC<ConnectivityModalProps> = ({ isOpen, onClose, status, onCheckConnection, isDark }) => {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [usage, setUsage] = useState(getLlmUsageStats());

  useEffect(() => {
    if (isOpen) {
      setUsage(getLlmUsageStats());
      const interval = setInterval(() => setUsage(getLlmUsageStats()), 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Standard Google Gemini Free Tier Limits
  const DAILY_LIMIT = 1500;
  const RPM_LIMIT = 15;
  const dayProgress = Math.min(100, (usage.rpd / DAILY_LIMIT) * 100);
  const isHighRpm = usage.rpm > 10;

  // Calculate alternatives based on current model from the full chain
  const activeModelIndex = status.llmDetails.model ? MODEL_CHAIN.indexOf(status.llmDetails.model) : -1;
  const alternativesList = activeModelIndex !== -1 ? MODEL_CHAIN.slice(activeModelIndex + 1) : [];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-sm max-h-[85dvh] overflow-y-auto hide-scrollbar border rounded-[2rem] flex flex-col shadow-3xl p-6 animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Activity className="w-4 h-4 text-blue-500" /></div>
            <h2 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>Connectivity Status</h2>
          </div>
          <button onClick={onClose} className={`transition-colors ${isDark ? 'text-slate-600 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}><X className="w-4 h-4" /></button>
        </div>
        
        <div className="space-y-3 mb-6">
          {Object.entries(status).filter(([name]) => name !== 'llmDetails' && name !== 'errorMessage').map(([name, stat]) => (
            <div key={name} className={`flex items-center justify-between p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                {name === 'Open-Meteo' ? <Server className="w-4 h-4 text-slate-500" /> : name === 'Gemini LLM' ? <BrainCircuit className="w-4 h-4 text-blue-500" /> : <MapPin className="w-4 h-4 text-emerald-500" />}
                <span className={`text-xs font-bold uppercase tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{name}</span>
              </div>
              <div className="flex items-center gap-2">
                {stat === 'checking' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                ) : (stat === 'ok' || stat === 'fallback') ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                    <Check className="w-2.5 h-2.5" />
                    Online
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

          {/* Resource Quota Monitor */}
          <div className={`flex flex-col gap-3 p-4 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                 <Gauge className="w-4 h-4 text-blue-400" />
                 <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Resource Utilization</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-end">
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Daily Quota (Estimated)</span>
                   <span className={`text-[10px] font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{usage.rpd} / {DAILY_LIMIT}</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${dayProgress}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Timer className={`w-3.5 h-3.5 ${isHighRpm ? 'text-orange-500 animate-pulse' : 'text-slate-500'}`} />
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Real-time RPM</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-[11px] font-black font-mono ${usage.rpm >= RPM_LIMIT ? 'text-red-500' : isHighRpm ? 'text-orange-500' : (isDark ? 'text-white' : 'text-slate-900')}`}>{usage.rpm}</span>
                  <span className="text-[8px] font-bold text-slate-500">REQ/MIN</span>
                </div>
              </div>
            </div>
            
            <p className="text-[8px] font-medium text-slate-500 italic mt-1 leading-tight">Note: Usage is tracked locally. Official limits may vary based on your API Key tier.</p>
          </div>
          
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
                    {formatModelName(status.llmDetails.model) || 
                     (status.llmDetails.priority.includes('(last: ') 
                        ? formatModelName(status.llmDetails.priority.split('(last: ')[1].replace(')', '')) 
                        : (status.llmDetails.alternatives === 0 ? formatModelName(MODEL_CHAIN[MODEL_CHAIN.length-1]) : 'Unknown'))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Status:</span>
                  <span className={isDark ? 'text-white' : 'text-slate-900'}>
                    {status.llmDetails.model ? 'Fully Operational' : 'Failed'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Fallback Chain:</span>
                  <button 
                    onClick={() => setShowAlternatives(!showAlternatives)}
                    disabled={!status.llmDetails.alternatives || status.llmDetails.alternatives === 0}
                    className={`flex items-center gap-1 font-mono transition-colors ${isDark ? 'text-white' : 'text-slate-900'} ${(!status.llmDetails.alternatives || status.llmDetails.alternatives === 0) ? 'cursor-default opacity-70' : 'hover:text-blue-500 cursor-pointer underline decoration-dotted underline-offset-2'}`}
                  >
                    <span>{status.llmDetails.alternatives} nodes available</span>
                  </button>
                </div>

                {showAlternatives && alternativesList.length > 0 && (
                  <div className={`mt-2 p-2 rounded-lg border flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-200 ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Secondary Nodes</span>
                    {alternativesList.map((m, i) => (
                      <div key={m} className="flex items-center gap-2 text-[9px] font-mono opacity-80">
                        <span className="text-slate-500">{i + 1}.</span>
                        <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{formatModelName(m)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {status.errorMessage && (
                  <div className="mt-2 pt-2 border-t border-dashed border-red-500/20">
                     <span className="text-red-400 block mb-0.5">Error Diagnosis:</span>
                     <span className={`block font-mono text-[9px] break-all whitespace-pre-wrap ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                       {status.errorMessage}
                     </span>
                  </div>
                )}
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
