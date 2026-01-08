
import React, { useState, useEffect } from 'react';
import { Activity, X, Server, BrainCircuit, MapPin, RefreshCw, Check, AlertCircle, Gauge, Timer, Clock, ShieldCheck, Zap, ChevronDown } from 'lucide-react';
import { ConnectionStatusState } from '../../types';
import { MODEL_CHAIN, getLlmUsageStats, currentLLMModel, remainingLLMAlternativesCount, alternativeLLMModels } from '../../services/geminiService';

interface ConnectivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ConnectionStatusState;
  onCheckConnection: () => void;
  isDark: boolean;
}

const formatModelName = (model: string | null): string => {
  if (!model) return 'Inactive';
  if (model.includes('gemini-3-flash')) return 'Gemini 3.0 Flash';
  if (model.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
  if (model.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash';
  if (model.includes('lite')) return 'Gemini Flash Lite';
  return model;
};

const formatTimestamp = (ts?: number) => {
  if (!ts) return "Never";
  const date = new Date(ts);
  return date.toLocaleString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  }).toUpperCase();
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

  const DAILY_LIMIT = 1500;
  const RPM_LIMIT = 15;
  const dayProgress = Math.min(100, (usage.rpd / DAILY_LIMIT) * 100);
  
  const weatherNodes = [
    { 
      id: 'Open-Meteo', 
      label: 'Primary Weather Node', 
      sub: 'Open-Meteo API', 
      status: status['Open-Meteo'],
      icon: <Server className="w-4 h-4 text-blue-500" /> 
    },
    { 
      id: 'Fallback Weather', 
      label: 'Fallback Weather Node', 
      sub: 'Met.no / Norwegian Met', 
      status: status['Fallback Weather'],
      icon: <RefreshCw className="w-4 h-4 text-emerald-500" /> 
    }
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className={`relative w-full max-w-[380px] max-h-[90dvh] overflow-y-auto hide-scrollbar border rounded-[2.5rem] flex flex-col shadow-3xl animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
        
        {/* Header Section */}
        <div className="flex-none p-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Activity className="w-4.5 h-4.5 text-blue-500" />
              </div>
              <div className="flex flex-col">
                <h2 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>System Hub</h2>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Node & Infrastructure Connectivity</span>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'text-slate-600 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}>
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 pb-8 space-y-5">
          
          {/* Active Provider Dashboard */}
          <div className={`p-4 rounded-3xl border flex items-center justify-between ${isDark ? 'bg-blue-600/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex flex-col gap-0.5">
               <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">Live Telemetry Source</span>
               <div className="flex items-center gap-2">
                 <Zap className="w-4 h-4 text-blue-500 animate-pulse" />
                 <span className={`text-[12px] font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                   {status.activeWeatherProvider === 'Open-Meteo' ? 'Open-Meteo (Primary)' : status.activeWeatherProvider === 'WeatherAPI' ? 'Met.no (Fallback Active)' : 'Initializing...'}
                 </span>
               </div>
            </div>
            <ShieldCheck className={`w-6 h-6 transition-all ${status.activeWeatherProvider !== 'Unknown' ? 'text-blue-500 scale-110' : 'text-slate-700 opacity-20'}`} />
          </div>

          {/* Infrastructure Nodes */}
          <div className="space-y-2">
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Atmospheric Grid</span>
             {weatherNodes.map((node) => (
               <div key={node.id} className={`flex items-center justify-between p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                 <div className="flex items-center gap-3.5">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-black/40' : 'bg-white shadow-sm'}`}>{node.icon}</div>
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black uppercase tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{node.label}</span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{node.sub}</span>
                    </div>
                 </div>
                 <div className={`px-2.5 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                   node.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                   node.status === 'checking' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                   'bg-red-500/10 border-red-500/20 text-red-500'
                 }`}>
                   {node.status === 'checking' && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                   {node.status === 'ok' && <Check className="w-2.5 h-2.5" />}
                   {node.status === 'fail' && <AlertCircle className="w-2.5 h-2.5" />}
                   {node.status}
                 </div>
               </div>
             ))}
          </div>

          {/* Intelligence Section */}
          <div className={`flex flex-col gap-4 p-5 rounded-[2rem] border relative overflow-hidden ${isDark ? 'bg-blue-900/10 border-blue-500/20' : 'bg-slate-50 border-blue-200 shadow-sm'}`}>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <BrainCircuit className="w-5 h-5 text-blue-500" />
                <div className="flex flex-col">
                  <span className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>Intelligence Core</span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase">Reasoning & Tactical Logic</span>
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                status['Gemini LLM'] === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                'bg-blue-500/10 border-blue-500/20 text-blue-500'
              }`}>
                {status['Gemini LLM'] === 'ok' ? 'Primary' : 'Fallback'}
              </div>
            </div>

            <div className="space-y-4 relative z-10">
               <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-baseline px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active Node</span>
                    <span className={`text-[11px] font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{formatModelName(currentLLMModel)}</span>
                  </div>
                  <div className="flex justify-between items-baseline px-1 border-t border-slate-500/10 pt-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Redundancy Status</span>
                    <div className="flex items-center gap-1.5">
                       <span className={`text-[10px] font-black ${remainingLLMAlternativesCount && remainingLLMAlternativesCount > 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                         {remainingLLMAlternativesCount ?? 0} Nodes left
                       </span>
                    </div>
                  </div>
               </div>

               <button 
                 onClick={() => setShowAlternatives(!showAlternatives)}
                 className={`w-full py-2.5 rounded-xl border flex items-center justify-between px-3 transition-all ${isDark ? 'bg-black/40 border-white/5 hover:bg-black/60' : 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm'}`}
               >
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">View Fallback Chain</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showAlternatives ? 'rotate-180' : ''}`} />
               </button>

               {showAlternatives && (
                 <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                    {(alternativeLLMModels.length > 0 ? alternativeLLMModels : MODEL_CHAIN.slice(1)).map((m, idx) => (
                      <div key={m} className={`flex items-center justify-between p-2.5 rounded-lg border border-dashed ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-300 text-slate-600'}`}>
                         <span className="text-[9px] font-black font-mono">NODE_{idx + 1}</span>
                         <span className="text-[10px] font-bold">{formatModelName(m)}</span>
                      </div>
                    ))}
                 </div>
               )}
            </div>

            {/* Quota visualization */}
            <div className="mt-2 space-y-3 pt-3 border-t border-slate-500/10">
               <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-3 h-3 text-slate-500" />
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Reasoning Quota</span>
                    </div>
                    <span className={`text-[9px] font-black font-mono ${isDark ? 'text-white' : 'text-slate-950'}`}>{usage.rpd} / {DAILY_LIMIT}</span>
                  </div>
                  <div className={`h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                    <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${dayProgress}%` }} />
                  </div>
               </div>

               <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-3 h-3 text-slate-500" />
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Real-time Load</span>
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-[10px] font-black font-mono ${usage.rpm > 10 ? 'text-orange-500' : (isDark ? 'text-blue-400' : 'text-blue-700')}`}>{usage.rpm}</span>
                    <span className="text-[7px] font-bold text-slate-500">RPM</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Last Update Metadata */}
          {status.lastWeatherUpdate && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Clock className="w-3 h-3 text-slate-600" />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                Last Synchronized: {formatTimestamp(status.lastWeatherUpdate)}
              </span>
            </div>
          )}
        </div>

        <div className="flex-none p-6 pt-0 space-y-2">
          <button 
            onClick={onCheckConnection} 
            className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <RefreshCw className="w-4 h-4" />
            Recalibrate All Nodes
          </button>
          <button 
            onClick={onClose} 
            className={`w-full py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all ${
              isDark ? 'bg-slate-900 border border-white/5 text-slate-500 hover:text-white' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
