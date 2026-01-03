
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
  Gauge
} from 'lucide-react';

interface EquipmentManagerProps {
  equipment: Equipment[];
  onChange: (equipment: Equipment[]) => void;
  onClose: () => void;
  isDark: boolean;
}

// Internal utility for calculating base optimized pressure (Dry conditions)
const calculateBasePressure = (type: EquipmentType, weight: number, width: number): string => {
  let pressure = 0;
  if (type === 'Road Bike' || type === 'Speedpedelec') {
    pressure = 2.0 + (weight * 0.05) - ((width - 25) * 0.1);
    pressure = Math.max(3.5, Math.min(8.5, pressure));
  } else if (type === 'Gravel Bike') {
    pressure = 1.0 + (weight * 0.03) - ((width - 35) * 0.05);
    pressure = Math.max(1.8, Math.min(4.5, pressure));
  } else {
    // Mountainbike
    pressure = 0.5 + (weight * 0.02);
    pressure = Math.max(1.4, Math.min(3.0, pressure));
  }
  return `${pressure.toFixed(1)} Bar`;
};

export const EquipmentManager: React.FC<EquipmentManagerProps> = ({ equipment, onChange, onClose, isDark }) => {
  const [view, setView] = useState<'list' | 'add'>('list');
  const [newBike, setNewBike] = useState<Partial<Equipment>>({
    type: 'Road Bike',
    tireWidth: 28,
    riderWeight: 75,
    tireSetup: 'Tubeless'
  });

  // Pickers Refs
  const widthPickerRef = useRef<HTMLDivElement>(null);
  const weightPickerRef = useRef<HTMLDivElement>(null);
  const addScrollContainerRef = useRef<HTMLDivElement>(null);

  // Constants
  const widthRange = useMemo(() => Array.from({ length: 43 }, (_, i) => i + 23), []); // 23 to 65
  const weightRange = useMemo(() => Array.from({ length: 76 }, (_, i) => i + 45), []); // 45 to 120

  const bikeTypes: { type: EquipmentType; label: string; icon: React.ReactNode; desc: string }[] = [
    { type: 'Road Bike', label: 'Road', icon: <Bike className="w-5 h-5" />, desc: 'Fast, tarmac focus' },
    { type: 'Gravel Bike', label: 'Gravel', icon: <Compass className="w-5 h-5" />, desc: 'Mixed terrain' },
    { type: 'Mountainbike', label: 'MTB', icon: <Activity className="w-5 h-5" />, desc: 'Rough trails' },
    { type: 'Speedpedelec', label: 'E-Bike', icon: <Zap className="w-5 h-5" />, desc: 'Electric assist' },
  ];

  const tireSetups: { type: TireSetup; mainLabel: string; subLabel: string; icon: React.ReactNode }[] = [
    { type: 'Tubeless', mainLabel: 'Tubeless', subLabel: 'Liquid Sealant', icon: <Droplets className="w-4 h-4" /> },
    { type: 'Clincher (Butyl)', mainLabel: 'Clincher', subLabel: 'Butyl Tube', icon: <Circle className="w-4 h-4" /> },
    { type: 'Clincher (TPU)', mainLabel: 'Clincher', subLabel: 'TPU Tube', icon: <CircleDashed className="w-4 h-4" /> },
    { type: 'Clincher (Latex)', mainLabel: 'Clincher', subLabel: 'Latex Tube', icon: <CircleDot className="w-4 h-4" /> },
    { type: 'Tubular', mainLabel: 'Tubular', subLabel: 'Sew-up', icon: <Disc className="w-4 h-4" /> },
  ];

  // Sync scroll positions for pickers
  useEffect(() => {
    if (view === 'add') {
      const syncPicker = (ref: React.RefObject<HTMLDivElement>, value: number | undefined, dataAttr: string, orientation: 'horizontal' | 'vertical') => {
        if (ref.current && value) {
          const el = ref.current.querySelector(`[${dataAttr}="${value}"]`);
          if (el) {
             el.scrollIntoView({ behavior: 'auto', block: orientation === 'vertical' ? 'center' : 'nearest', inline: orientation === 'horizontal' ? 'center' : 'nearest' });
          }
        }
      };
      
      const timer = setTimeout(() => {
        syncPicker(widthPickerRef, newBike.tireWidth, 'data-width', 'horizontal');
        syncPicker(weightPickerRef, newBike.riderWeight, 'data-weight', 'vertical');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [view, newBike.tireWidth, newBike.riderWeight]);

  useEffect(() => {
    if (view === 'add' && addScrollContainerRef.current) {
      addScrollContainerRef.current.scrollTop = 0;
    }
  }, [view]);

  const handleSelect = (id: string) => {
    const updated = equipment.map(e => ({ ...e, isSelected: e.id === id }));
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    const remaining = equipment.filter(e => e.id !== id);
    if (equipment.find(e => e.id === id)?.isSelected && remaining.length > 0) {
      remaining[0].isSelected = true;
    }
    onChange(remaining);
  };

  const handleSave = () => {
    if (!newBike.name) return;
    const bike: Equipment = {
      id: Date.now().toString(),
      name: newBike.name,
      type: newBike.type as EquipmentType,
      tireWidth: newBike.tireWidth || 28,
      riderWeight: newBike.riderWeight || 75,
      tireSetup: newBike.tireSetup || 'Clincher (Butyl)',
      isSelected: true
    };
    const updated = equipment.map(e => ({ ...e, isSelected: false }));
    onChange([bike, ...updated]);
    setView('list');
    setNewBike({ type: 'Road Bike', tireWidth: 28, riderWeight: 75, tireSetup: 'Tubeless' });
  };

  if (view === 'add') {
    const liveBasePressure = calculateBasePressure(newBike.type as EquipmentType, newBike.riderWeight || 75, newBike.tireWidth || 28);

    return (
      <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
        <div className="flex items-center gap-3 mb-4 flex-none">
          <button onClick={() => setView('list')} className={`p-2 rounded-full transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Machine</h2>
        </div>

        <div ref={addScrollContainerRef} className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-6 pb-4 min-h-0">
          
          <div className="flex flex-col gap-2 flex-none">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Frame Architecture</label>
            <div className="grid grid-cols-2 gap-2">
              {bikeTypes.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setNewBike({ ...newBike, type: t.type })}
                  className={`p-3 rounded-2xl border text-left flex flex-col gap-2 transition-all duration-200 active:scale-[0.98] ${
                    newBike.type === t.type 
                      ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20' 
                      : isDark 
                        ? 'bg-slate-900/50 border-white/5 hover:bg-white/5' 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className={`p-2 w-fit rounded-xl ${newBike.type === t.type ? 'bg-white/20 text-white' : isDark ? 'bg-white/5 text-slate-400' : 'bg-white text-slate-500 shadow-sm'}`}>
                    {t.icon}
                  </div>
                  <div>
                    <div className={`text-xs font-black uppercase ${newBike.type === t.type ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-900'}`}>{t.label}</div>
                    <div className={`text-[9px] font-medium leading-tight ${newBike.type === t.type ? 'text-blue-100' : 'text-slate-500'}`}>{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-none">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Identity</label>
            <input 
              type="text" 
              placeholder="e.g. Canyon Aeroad CF SLX"
              value={newBike.name || ''}
              onChange={(e) => setNewBike({ ...newBike, name: e.target.value })}
              className={`w-full p-4 rounded-2xl text-sm font-bold outline-none border transition-all ${
                isDark 
                  ? 'bg-black/40 border-white/10 text-white focus:border-blue-500 placeholder:text-slate-600' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 placeholder:text-slate-400 shadow-sm'
              }`}
            />
          </div>

          <div className="flex flex-col gap-3 flex-none">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Tire Configuration</label>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar px-1 -mx-1 pb-2 snap-x snap-mandatory">
              {tireSetups.map((s) => {
                 const isSelected = newBike.tireSetup === s.type;
                 return (
                  <button
                    key={s.type}
                    onClick={() => setNewBike({ ...newBike, tireSetup: s.type })}
                    className={`flex-none w-32 p-3 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all duration-300 snap-center relative overflow-hidden group ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-600/20 scale-[1.02]'
                        : isDark
                          ? 'bg-slate-900/50 border-white/5 hover:bg-white/5'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && (
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    )}
                    
                    <div className={`p-2 rounded-xl w-fit ${isSelected ? 'bg-white/20 text-white' : isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {s.icon}
                    </div>
                    <div>
                      <div className={`text-[11px] font-black uppercase tracking-wide leading-tight mb-0.5 ${isSelected ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                        {s.mainLabel}
                      </div>
                      <div className={`text-[9px] font-medium ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        {s.subLabel}
                      </div>
                    </div>
                  </button>
                 );
              })}
            </div>
          </div>

          <div className={`p-5 rounded-3xl border flex flex-col gap-6 flex-none ${isDark ? 'bg-[#05070a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
            
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-end px-1">
                 <div className="flex items-center gap-2 text-slate-500">
                    <CircleDashed className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Tire Width</span>
                 </div>
                 <span className={`text-xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{newBike.tireWidth} <span className="text-xs text-slate-500">mm</span></span>
              </div>
              
              <div className={`h-16 rounded-2xl border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
                 <div className={`absolute inset-y-0 left-0 w-12 z-10 pointer-events-none bg-gradient-to-r ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
                 <div className={`absolute inset-y-0 right-0 w-12 z-10 pointer-events-none bg-gradient-to-l ${isDark ? 'from-black/60' : 'from-slate-100/60'} to-transparent`} />
                 <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-12 rounded-xl border-2 pointer-events-none z-20 ${isDark ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-400 bg-white shadow-sm'}`} />

                 <div 
                   ref={widthPickerRef}
                   className="h-full flex items-center gap-4 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory px-[calc(50%-28px)]"
                 >
                    {widthRange.map(w => {
                      const isSelected = newBike.tireWidth === w;
                      return (
                        <button
                          key={w} data-width={w} onClick={() => setNewBike({ ...newBike, tireWidth: w })}
                          className={`flex-none w-14 h-10 flex flex-col items-center justify-center transition-all snap-center relative rounded-lg z-30 ${
                            isSelected 
                              ? (isDark ? 'text-blue-400 scale-115 font-black' : 'text-slate-950 scale-115 font-black') 
                              : (isDark ? 'text-slate-700 font-bold' : 'text-slate-400 font-bold')
                          }`}
                        >
                          <span className="text-[15px] leading-none">{w}</span>
                        </button>
                      );
                    })}
                 </div>
              </div>
            </div>

            <div className={`h-px w-full ${isDark ? 'bg-white/5' : 'bg-slate-200'}`} />

            <div className="flex gap-4 items-center h-28">
              <div className="flex-1 flex flex-col justify-center gap-1">
                 <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Scale className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Rider Weight</span>
                 </div>
                 <span className={`text-4xl font-black font-mono tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{newBike.riderWeight}</span>
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kilograms</span>
              </div>
              
              <div className="flex-none w-24 h-full flex flex-col gap-1.5">
                 <div className={`h-full rounded-xl border overflow-hidden relative ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-300 shadow-inner'}`}>
                    <div className={`absolute inset-x-0 top-0 h-6 bg-gradient-to-b ${isDark ? 'from-black/60' : 'from-slate-200/60'} to-transparent pointer-events-none z-10`} />
                    <div className={`absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t ${isDark ? 'from-black/60' : 'from-slate-200/60'} to-transparent pointer-events-none z-10`} />
                    <div className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 h-9 border-y z-20 pointer-events-none ${isDark ? 'border-blue-500/30 bg-blue-500/5' : 'bg-white border-slate-300 shadow-sm'}`} />

                    <div ref={weightPickerRef} className="h-full overflow-y-auto hide-scrollbar scroll-smooth snap-y snap-mandatory py-[calc(50%-18px)]">
                       {weightRange.map(w => (
                         <button
                            key={w} data-weight={w} onClick={() => setNewBike({ ...newBike, riderWeight: w })}
                            className={`w-full h-9 flex items-center justify-center text-[13px] font-black transition-all snap-center relative z-30 ${newBike.riderWeight === w ? (isDark ? 'text-blue-400' : 'text-slate-950 scale-110') : (isDark ? 'text-slate-700' : 'text-slate-400')}`}
                         >
                           {w}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>
            </div>

            <div className={`h-px w-full ${isDark ? 'bg-white/5' : 'bg-slate-200'}`} />

            {/* Pressure Preview Display */}
            <div className={`p-4 rounded-2xl flex items-center justify-between border ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-white text-blue-600 shadow-sm'}`}>
                  <Gauge className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">Optimal Baseline</span>
                  <span className={`text-[10px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Standard Dry Traction</span>
                </div>
              </div>
              <span className={`text-lg font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-blue-700'}`}>
                {liveBasePressure}
              </span>
            </div>

          </div>
        </div>

        <div className="flex-none pt-2">
            <button 
              onClick={handleSave} 
              disabled={!newBike.name} 
              className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              Confirm Setup
            </button>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="flex flex-col h-full animate-in slide-in-from-left-8 duration-300">
      <div className="flex items-center justify-between mb-6 flex-none">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Garage</h2>
        </div>
        <button 
          onClick={() => setView('add')} 
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${isDark ? 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Bike</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3 min-h-0">
        {equipment.length > 0 ? (
          equipment.map((bike) => {
            const basePressure = calculateBasePressure(bike.type, bike.riderWeight, bike.tireWidth);
            return (
              <div 
                key={bike.id} 
                onClick={() => handleSelect(bike.id)}
                className={`group relative p-4 rounded-[1.5rem] border transition-all duration-300 cursor-pointer ${
                  bike.isSelected 
                    ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-600/20 scale-[1.02]' 
                    : isDark 
                      ? 'bg-slate-900/50 border-white/5 hover:border-white/10 hover:bg-white/5' 
                      : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${bike.isSelected ? 'bg-white/20 text-white' : isDark ? 'bg-black/40 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {bikeTypes.find(t => t.type === bike.type)?.icon || <Bike className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-black tracking-tight ${bike.isSelected ? 'text-white' : isDark ? 'text-slate-100' : 'text-slate-900'}`}>{bike.name}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${bike.isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        {bike.type}
                        {bike.tireSetup && (
                          <span className="opacity-70 font-medium"> • {bike.tireSetup}</span>
                        )}
                      </span>
                    </div>
                  </div>
                  {bike.isSelected && (
                    <div className="bg-white/20 p-1 rounded-full text-white animate-in zoom-in spin-in-90 duration-300">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                <div className={`mt-4 pt-3 border-t flex items-center justify-between ${bike.isSelected ? 'border-white/20' : isDark ? 'border-white/5' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5" title="Tire Width">
                       <CircleDashed className={`w-3 h-3 ${bike.isSelected ? 'text-blue-200' : 'text-slate-400'}`} />
                       <span className={`text-[9px] font-mono font-bold ${bike.isSelected ? 'text-white' : isDark ? 'text-slate-300' : 'text-slate-600'}`}>{bike.tireWidth}mm</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Base Pressure">
                       <Gauge className={`w-3 h-3 ${bike.isSelected ? 'text-white' : 'text-blue-500'}`} />
                       <span className={`text-[9px] font-mono font-black ${bike.isSelected ? 'text-white' : 'text-blue-600'}`}>{basePressure}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Rider Weight">
                       <Scale className={`w-3 h-3 ${bike.isSelected ? 'text-blue-200' : 'text-slate-400'}`} />
                       <span className={`text-[9px] font-mono font-bold ${bike.isSelected ? 'text-white' : isDark ? 'text-slate-300' : 'text-slate-600'}`}>{bike.riderWeight}kg</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(bike.id); }}
                    className={`p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${bike.isSelected ? 'text-blue-200 hover:bg-white/20 hover:text-white' : 'text-slate-400 hover:bg-red-500/10 hover:text-red-500'}`}
                    title="Remove bike"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40 gap-4">
            <Bike className="w-12 h-12" />
            <span className="text-[10px] font-black uppercase tracking-widest text-center">Your garage is empty.<br/>Add a bike to get optimized advice.</span>
          </div>
        )}
      </div>
      
      <div className={`mt-4 pt-4 border-t flex items-start gap-3 flex-none ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
        <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-500' : 'bg-blue-50 text-blue-600'}`}>
          <Sliders className="w-4 h-4" />
        </div>
        <p className={`text-[10px] leading-relaxed font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Selected bike determines <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>optimized tire pressure</span> and influences <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>braking recommendations</span> based on your mass and setup.
        </p>
      </div>
    </div>
  );
};
