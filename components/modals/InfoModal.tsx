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
  <div className={`border rounded-lg transition-all overflow-hidden ${highlight ? (isDark ? 'border-blue-500/50 bg-blue-500/10' : 'border-blue-300 bg-blue-50') : (isDark ? 'border-white/5 bg-slate-900/30' : 'border-slate-200 bg-slate-50')}`}>
    <button 
      onClick={() => setExpandedInfoItem(expandedInfoItem === id ? null : id)}
      className="w-full px-3 py-1.5 flex items-center justify-between text-left"
    >
      <div className="flex items-center gap-2">
        {highlight ? <Sparkles className="w-3 h-3 text-blue-500" /> : <div className="w-3 h-3 flex items-center justify-center"><div className={`w-0.5 h-0.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} /></div>}
        <span className={`text-[9px] font-black uppercase tracking-widest ${highlight ? 'text-blue-600' : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>{title}</span>
      </div>
      <ChevronDown className={`w-2.5 h-2.5 text-slate-500 transition-transform ${expandedInfoItem === id ? 'rotate-180' : ''}`} />
    </button>
    {expandedInfoItem === id && (
      <div className={`px-3 pb-2 pt-0.5 text-[10px] leading-relaxed font-medium animate-in slide-in-from-top-1 duration-200 whitespace-pre-wrap ${highlight ? (isDark ? 'text-slate-200' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
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
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-w-[340px] border rounded-[1.75rem] flex flex-col shadow-3xl px-4 py-4 animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-blue-500" /></div>
            <div className="flex flex-col">
              <h2 className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>The Briefing</h2>
              <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tight">System Knowledge Base</span>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded-full transition-colors ${isDark ? 'hover:bg-white/5 text-slate-600 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}><X className="w-3.5 h-3.5" /></button>
        </div>
        
        <div className="flex flex-col gap-1 mb-4">
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
          className={`w-full py-3 rounded-xl font-black uppercase text-[9px] tracking-[0.25em] transition-all active:scale-[0.98] ${isDark ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-900 text-white shadow-lg'}`}
        >
          Confirm Intelligence
        </button>
      </div>
    </div>
  );
};