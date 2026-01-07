
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Equipment, EquipmentType, TireSetup } from '../types';
import { 
  Bike, 
  Zap, 
  Activity, 
  Compass, 
  Plus, 
  Trash2, 
  Check, 
  Scale, 
  CircleDashed,
  ArrowLeft,
  Sliders,
  Disc,
  Droplets,
  Circle,
  CircleDot,
  Gauge,
  Pencil,
  Mountain,
  Milestone
} from 'lucide-react';

interface EquipmentManagerProps {
  equipment: Equipment[];
  onChange: (equipment: Equipment[]) => void;
  onClose: () => void;
  isDark: boolean;
}

const calculateBasePressure = (weight: number, width: number, setup: TireSetup, surface: number): string => {
  // Logic synced with geminiService.ts
  let pressure = (weight * 0.045) + 3.8 - ((width - 25) * 0.14);
  if (setup === 'Tubeless') pressure -= 0.6;
  if (setup === 'Clincher (TPU)' || setup === 'Clincher (Latex)') pressure -= 0.2;
  if (setup === 'Tubular') pressure += 0.2;
  pressure -= (surface / 100) * 1.4;
  pressure = Math.max(1.5, Math.min(8.5, pressure));
  return `${pressure.toFixed(1)} Bar`;
};

export const EquipmentManager: React.FC<EquipmentManagerProps> = ({ equipment, onChange, onClose, isDark }) => {
  const [view, setView] = useState<'list' | 'add'>('list');
  const [newBike, setNewBike] = useState<Partial<Equipment>>({
    type: 'Road Bike',
    tireWidth: 28,
    riderWeight: 75,
    tireSetup: 'Tubeless',
    surfacePreference: 0
  });

  const widthPickerRef = useRef<HTMLDivElement>(null);
  const weightPickerRef = useRef<HTMLDivElement>(null);
  
  const widthRange = useMemo(() => Array.from({ length: 43 }, (_, i) => i + 23), []); 
  const weightRange = useMemo(() => Array.from({ length: 131 }, (_, i) => i + 20), []); 

  const bikeTypes: { type: EquipmentType; label: string; icon: React.ReactNode }[] = [
    { type: 'Road Bike', label: 'Road', icon: <Bike className="w-4 h-4" /> },
    { type: 'Gravel Bike', label: 'Gravel', icon: <Compass className="w-4 h-4" /> },
    { type: 'Mountainbike', label: 'MTB', icon: <Activity className="w-4 h-4" /> },
    { type: 'Speedpedelec', label: 'E-Bike', icon: <Zap className="w-4 h-4" /> },
  ];

  const tireSetups: { type: TireSetup; label: string; icon: React.ReactNode }[] = [
    { type: 'Tubeless', label: 'Tubeless', icon: <Droplets className="w-3.5 h-3.5" /> },
    { type: 'Clincher (Butyl)', label: 'Butyl', icon: <Circle className="w-3.5 h-3.5" /> },
    { type: 'Clincher (TPU)', label: 'TPU/Latex', icon: <CircleDot className="w-3.5 h-3.5" /> },
    { type: 'Tubular', label: 'Tubular', icon: <Disc className="w-3.5 h-3.5" /> },
  ];

  useEffect(() => {
    if (view === 'add') {
      const syncPicker = (ref: React.RefObject<HTMLDivElement | null>, value: number | undefined, dataAttr: string) => {
        if (ref.current && value) {
          const el = ref.current.querySelector(`[${dataAttr}="${value}"]`);
          if (el) el.scrollIntoView({ behavior: 'auto', inline: 'center' });
        }
      };
      const timer = setTimeout(() => {
        syncPicker(widthPickerRef, newBike.tireWidth, 'data-width');
        syncPicker(weightPickerRef, newBike.riderWeight, 'data-weight');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [view, newBike.tireWidth, newBike.riderWeight]);

  const handleSave = () => {
    if (!newBike.name) return;
    if (newBike.id) {
        const updatedList = equipment.map(e => e.id === newBike.id ? { ...e, ...newBike } as Equipment : e);
        onChange(updatedList);
    } else {
        const bike: Equipment = {
            id: Date.now().toString(),
            name: newBike.name,
            type: newBike.type as EquipmentType,
            tireWidth: newBike.tireWidth || 28,
            riderWeight: newBike.riderWeight || 75,
            tireSetup: newBike.tireSetup || 'Clincher (Butyl)',
            surfacePreference: newBike.surfacePreference || 0,
            isSelected: true
        };
        const updated = equipment.map(e => ({ ...e, isSelected: false }));
        onChange([bike, ...updated]);
    }
    setView('list');
  };

  const handleSelect = (id: string) => {
    const updated = equipment.map(e => ({ ...e, isSelected: e.id === id }));
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    const updated = equipment.filter(e => e.id !== id);
    if (equipment.find(e => e.id === id)?.isSelected && updated.length > 0) updated[0].isSelected = true;
    onChange(updated);
  };

  if (view === 'add') {
    const livePressure = calculateBasePressure(newBike.riderWeight || 75, newBike.tireWidth || 28, newBike.tireSetup as TireSetup, newBike.surfacePreference || 0);
    return (
      <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setView('list')} className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}><ArrowLeft className="w-4 h-4" /></button>
          <h2 className={`text-base font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>{newBike.id ? 'Edit Machine' : 'New Machine'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-4 pb-2">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-1.5">
              {bikeTypes.map((t) => (
                <button key={t.type} onClick={() => setNewBike({ ...newBike, type: t.type })} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${newBike.type === t.type ? 'bg-blue-600 border-blue-500 shadow-md' : isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={newBike.type === t.type ? 'text-white' : 'text-slate-500'}>{t.icon}</div>
                  <span className={`text-[8px] font-black uppercase ${newBike.type === t.type ? 'text-white' : 'text-slate-400'}`}>{t.label}</span>
                </button>
              ))}
            </div>
            <input type="text" placeholder="GIVE IT A NAME..." value={newBike.name || ''} onChange={(e) => setNewBike({ ...newBike, name: e.target.value.toUpperCase() })} className={`w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase outline-none border transition-all ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm focus:border-blue-500'}`} />
          </div>

          <div className={`p-4 rounded-3xl border flex flex-col gap-4 ${isDark ? 'bg-[#0a0c10] border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
            <label className="text-[8px] font-black uppercase tracking-widest text-blue-500">Tire Configuration</label>
            <div className="grid grid-cols-4 gap-1.5">
              {tireSetups.map((s) => (
                <button key={s.type} onClick={() => setNewBike({ ...newBike, tireSetup: s.type })} className={`py-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${newBike.tireSetup === s.type ? 'bg-blue-600 border-blue-500 text-white' : isDark ? 'bg-black/40 border-white/5 text-slate-500' : 'bg-white border-slate-200 text-slate-500'}`}>
                  {s.icon}<span className="text-[7px] font-black uppercase">{s.label}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1"><span className="text-[8px] font-black uppercase text-slate-500">Width</span><span className={`text-base font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{newBike.tireWidth}MM</span></div>
              <div className={`h-10 rounded-xl border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'}`}>
                 <div ref={widthPickerRef} className="h-full flex items-center gap-4 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory px-[calc(50%-18px)]">
                    {widthRange.map(w => (
                      <button key={w} data-width={w} onClick={() => setNewBike({ ...newBike, tireWidth: w })} className={`flex-none w-9 h-7 flex items-center justify-center transition-all snap-center ${newBike.tireWidth === w ? 'text-blue-500 font-black scale-125' : 'text-slate-600'}`}>{w}</button>
                    ))}
                 </div>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-3xl border flex flex-col gap-3 ${isDark ? 'bg-[#0a0c10] border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-center px-1">
              <label className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Typical Surface</label>
              <span className={`text-[10px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {newBike.surfacePreference === 0 ? 'Pure Road' : 
                 newBike.surfacePreference === 100 ? 'Extreme Off-road' : 
                 `${newBike.surfacePreference}% Off-road`}
              </span>
            </div>
            <div className="px-2 py-4">
               <div className="relative w-full h-6 flex items-center">
                  <div className={`absolute inset-x-0 h-1.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                  <div className="absolute inset-x-0 flex justify-between px-1 pointer-events-none opacity-40">
                     <Milestone className="w-3 h-3 text-blue-500" />
                     <Mountain className="w-3 h-3 text-emerald-500" />
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={newBike.surfacePreference || 0} 
                    onChange={(e) => setNewBike({ ...newBike, surfacePreference: parseInt(e.target.value) })}
                    className="absolute inset-x-0 w-full h-2 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-lg" 
                  />
               </div>
               <div className="flex justify-between mt-1 text-[8px] font-black text-slate-500 uppercase px-1">
                  <span>Pavement</span>
                  <span>Loose</span>
               </div>
            </div>
          </div>

          <div className={`p-4 rounded-3xl border flex flex-col gap-3 ${isDark ? 'bg-[#0a0c10] border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-center px-1">
              <label className="text-[8px] font-black uppercase tracking-widest text-orange-500">Rider Weight</label>
              <div className="flex items-baseline gap-1"><span className={`text-xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{newBike.riderWeight}</span><span className="text-[8px] font-black text-slate-500">KG</span></div>
            </div>
            <div className={`h-12 rounded-xl border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'}`}>
               <div ref={weightPickerRef} className="h-full flex items-center gap-5 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory px-[calc(50%-22px)]">
                  {weightRange.map(w => (
                    <button key={w} data-weight={w} onClick={() => setNewBike({ ...newBike, riderWeight: w })} className={`flex-none w-11 h-8 flex items-center justify-center transition-all snap-center ${newBike.riderWeight === w ? 'text-orange-500 font-black scale-125' : 'text-slate-600'}`}>{w}</button>
                  ))}
               </div>
            </div>
          </div>

          <div className={`p-3 rounded-2xl flex items-center justify-between border ${isDark ? 'bg-blue-600/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
            <div className="flex items-center gap-2"><Gauge className="w-4 h-4 text-blue-500" /><span className="text-[8px] font-black uppercase text-blue-500">Optimized Pressure</span></div>
            <span className={`text-base font-black font-mono ${isDark ? 'text-white' : 'text-blue-700'}`}>{livePressure}</span>
          </div>
        </div>

        <button onClick={handleSave} disabled={!newBike.name} className="w-full py-4 mt-2 rounded-2xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]">Confirm Setup</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-left-8 duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}><ArrowLeft className="w-4 h-4" /></button>
          <h2 className={`text-base font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Garage</h2>
        </div>
        <button onClick={() => { setNewBike({ type: 'Road Bike', tireWidth: 28, riderWeight: 75, tireSetup: 'Tubeless', surfacePreference: 0 }); setView('add'); }} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600/10 text-blue-500 text-[8px] font-black uppercase"><Plus className="w-3 h-3" /> Machine</button>
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-2">
        {equipment.length > 0 ? equipment.map((bike) => (
          <div key={bike.id} onClick={() => handleSelect(bike.id)} className={`p-4 rounded-3xl border transition-all cursor-pointer ${bike.isSelected ? 'bg-blue-600 border-blue-500 shadow-lg' : isDark ? 'bg-slate-900/50 border-white/5' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-2xl ${bike.isSelected ? 'bg-white/20 text-white' : isDark ? 'bg-black/40 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{bikeTypes.find(t => t.type === bike.type)?.icon || <Bike className="w-4 h-4" />}</div>
                <div className="flex flex-col">
                  <span className={`text-sm font-black ${bike.isSelected ? 'text-white' : isDark ? 'text-slate-100' : 'text-slate-900'}`}>{bike.name}</span>
                  <span className={`text-[8px] font-bold uppercase ${bike.isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    {bike.tireWidth}mm • {bike.tireSetup.split(' ')[0]} • {bike.surfacePreference === 0 ? 'Road' : (bike.surfacePreference === 100 ? 'MTB' : 'Mixed')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); setNewBike(bike); setView('add'); }} className={`p-2 ${bike.isSelected ? 'text-blue-100' : 'text-slate-400'}`}><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(bike.id); }} className={`p-2 ${bike.isSelected ? 'text-blue-100' : 'text-slate-400'}`}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        )) : <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-4"><Bike className="w-12 h-12" /><span className="text-[9px] font-black uppercase">Garage Empty</span></div>}
      </div>
    </div>
  );
};
