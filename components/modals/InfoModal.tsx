
import React, { useState } from 'react';
import { Info, X, ChevronDown } from 'lucide-react';
import { TRANSLATIONS } from '../../constants';
import { Language } from '../../types';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  language: Language;
}

const AccordionItem = ({ id, title, content, expandedInfoItem, setExpandedInfoItem, isDark }: { id: string, title: string, content: string, expandedInfoItem: string | null, setExpandedInfoItem: (id: string | null) => void, isDark: boolean }) => (
  <div className={`border rounded-xl transition-all overflow-hidden ${isDark ? 'border-white/5' : 'border-slate-200'} ${expandedInfoItem === id ? 'bg-blue-500/5 ring-1 ring-blue-500/20' : isDark ? 'bg-slate-900/30' : 'bg-slate-50'}`}>
    <button 
      onClick={() => setExpandedInfoItem(expandedInfoItem === id ? null : id)}
      className="w-full px-4 py-3 flex items-center justify-between text-left"
    >
      <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">{title}</span>
      <ChevronDown className={`w-3.5 h-3.5 text-blue-500 transition-transform ${expandedInfoItem === id ? 'rotate-180' : ''}`} />
    </button>
    {expandedInfoItem === id && (
      <div className="px-4 pb-4 text-[12px] text-slate-400 leading-relaxed font-medium animate-in slide-in-from-top-1 duration-200 whitespace-pre-wrap">
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
      <div className={`relative w-full max-sm border rounded-[2rem] flex flex-col shadow-3xl px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0c10] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Info className="w-3.5 h-3.5 text-blue-500" /></div>
            <h2 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>System Logic</h2>
          </div>
          <button onClick={onClose} className={`transition-colors ${isDark ? 'text-slate-600 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto hide-scrollbar px-1">
          <AccordionItem id="how-to-use" title={t.howToUseTitle} content={t.howToUseContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="purpose" title={t.purposeTitle} content={t.purposeContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="score" title={t.commuteScore} content={t.commuteScoreContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="training-mode" title={t.trainingMode} content={t.trainingModeContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="retrieval" title={t.generalSources} content={t.generalSourcesContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="ice" title={t.iceRisk} content={t.iceRiskContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="surface" title={t.surfaceCondition} content={t.surfaceConditionContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="wind" title={t.windCondition} content={t.windContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="lighting" title={t.lightingCondition} content={t.lightingContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="equipment" title={t.equipmentLogic} content={t.equipmentContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
          <AccordionItem id="distance" title={t.distanceCalculation} content={t.distanceContent} expandedInfoItem={expandedInfoItem} setExpandedInfoItem={setExpandedInfoItem} isDark={isDark} />
        </div>
        <button onClick={onClose} className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] transition-all ${isDark ? 'bg-slate-900 border border-white/5 text-slate-500 hover:text-white' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'}`}>Close</button>
      </div>
    </div>
  );
};
