
import React, { useState } from 'react';
import { Info, X, ChevronDown, Sparkles, MapPin, Clock, Bike, Zap, Activity } from 'lucide-react';
import { TRANSLATIONS } from '../../constants';
import { Language } from '../../types';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  language: Language;
}

const AccordionItem = ({ id, title, content, expandedInfoItem, setExpandedInfoItem, isDark, highlight = false }: { id: string, title: string, content: string, expandedInfoItem: string | null, setExpandedInfoItem: (id: string | null) => void, isDark: boolean, highlight?: boolean }) => (
  <div className={`border rounded-2xl transition-all overflow-hidden ${highlight ? (isDark ? 'border-blue-500/50 bg-blue-500/10' : 'border-blue-300 bg-blue-50') : (isDark ? 'border-white/5 bg-slate-900/30' : 'border-slate-200 bg-slate-50')} ${expandedInfoItem === id ? 'ring-1 ring-blue-500/20 shadow-lg' : ''}`}>
    <button 
      onClick={() => setExpandedInfoItem(expandedInfoItem === id ? null : id)}
      className="w-full px-5 py-4 flex items-center justify-between text-left"
    >
      <div className="flex items-center gap-2.5">
        {highlight ? <Sparkles className="w-4 h-4 text-blue-500" /> : <Info className="w-3.5 h-3.5 text-slate-500" />}
        <span className={`text-[11px] font-black uppercase tracking-widest ${highlight ? 'text-blue-600' : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{title}</span>
      </div>
      <ChevronDown className={`w-3.5 h-3.5 text-blue-500 transition-transform ${expandedInfoItem === id ? 'rotate-180' : ''}`} />
    </button>
    {expandedInfoItem === id && (
      <div className={`px-5 pb-5 text-[12px] leading-relaxed font-medium animate-in slide-in-from-top-1 duration-200 whitespace-pre-wrap ${highlight ? (isDark ? 'text-slate-200' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
        {content}
      </div>
    )}
  </div>
);

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, isDark, language }) => {
  const [expandedInfoItem, setExpandedInfoItem] = useState<string | null>(null);
  const t = TRANSLATIONS[language || 'en'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-sm border rounded-[2.5rem] flex flex-col shadow-3xl px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-5 px-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center"><Zap className="w-5 h-5 text-blue-500" /></div>
            <div className="flex flex-col">
              <h2 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>The Briefing</h2>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Your Intelligent Cycling Coach</span>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/5 text-slate-600 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}><X className="w-5 h-5" /></button>
        </div>
        
        <div className="space-y-3 mb-6 max-h-[65vh] overflow-y-auto hide-scrollbar px-1 pb-4">
          <AccordionItem id="quick-start" title={t.quickStart} content={t.quickStartContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} highlight={true} />
          <AccordionItem id="purpose" title={t.purposeTitle} content={t.purposeContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="score" title={t.commuteScore} content={t.commuteScoreContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="training-mode" title={t.trainingMode} content={t.trainingModeContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="retrieval" title={t.generalSources} content={t.generalSourcesContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="ice" title={t.iceRisk} content={t.iceRiskContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="surface" title={t.surfaceCondition} content={t.surfaceConditionContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="wind" title={t.windCondition} content={t.windContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="lighting" title={t.lightingCondition} content={t.lightingContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="equipment" title={t.equipmentLogic} content={t.equipmentContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
        </div>
        
        <button 
          onClick={onClose} 
          className={`w-full py-4 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] transition-all active:scale-[0.98] ${isDark ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-900 text-white shadow-lg'}`}
        >
          Got it, let's ride!
        </button>
      </div>
    </div>
  );
};
