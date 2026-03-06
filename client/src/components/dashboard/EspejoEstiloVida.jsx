import React, { useEffect, useState, useRef } from 'react';
import {
    ClipboardList, Lock, Wind, Moon, Heart, Battery, Sparkles
} from 'lucide-react';

// Custom Hook para detectar un cambio y disparar un brillo (Blue Glow) de 1.5s
function useGlowOnUpdate(value) {
    const [isGlowing, setIsGlowing] = useState(false);
    const previousValue = useRef(value);

    // Simplificando un poco la lógica de comparación para objetos anidados o strings
    useEffect(() => {
        const valStr = JSON.stringify(value);
        const prevStr = JSON.stringify(previousValue.current);

        if (valStr !== prevStr && valStr !== 'null' && valStr !== '{}') {
            const glowStartTimer = setTimeout(() => setIsGlowing(true), 10);
            const glowEndTimer = setTimeout(() => setIsGlowing(false), 1500);
            previousValue.current = value;
            return () => {
                clearTimeout(glowStartTimer);
                clearTimeout(glowEndTimer);
            };
        }
    }, [value]);

    return isGlowing ? 'ring-[8px] ring-green-500/20 shadow-2xl' : '';
}

const EspejoEstiloVida = ({ patientProfile, lifeStyleState, isPhaseComplete }) => {
    const localState = lifeStyleState || {
        environment: { altitude: 0, hypoxiaRisk: false, city: "Pendiente..." },
        circadian: { sleepHours: 0, quality: "" },
        hormonal: { cyclePhase: "N/A", lastPeriod: "" },
        energy: { level: 0, peakTime: "" },
        bio_architecture_goal: ""
    };

    const containerGlow = useGlowOnUpdate(localState);

    return (
        <div className="w-full relative flex flex-col gap-6">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-xl font-black italic tracking-tighter text-slate-800 flex items-center gap-3 uppercase font-prototype tracking-tighter">
                    <ClipboardList className="text-[#1C75BC]" /> Espejo Clínico Activo
                </h1>
                <div className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest font-prototype border border-gray-300">
                    <Lock size={12} /> {isPhaseComplete ? "BLOQUEADO" : "EN PROCESO"}
                </div>
            </div>

            <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm overflow-hidden transition-all duration-1000 relative">
                <div className="p-10 pb-6 flex items-center gap-6 bg-slate-50/30">
                    <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] text-[#1C75BC] flex items-center justify-center font-bold text-2xl shadow-sm font-prototype">6</div>
                    <div>
                        <h3 className="font-bold text-[#1E293B] text-xl leading-none tracking-tight font-prototype uppercase">Auditoría de Vida</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.25em] mt-2 italic font-sansation leading-none">TELEMETRÍA BIO-ARQUITECTÓNICA</p>
                    </div>
                </div>

                <div className={`px-10 pb-12 space-y-6 transition-all duration-500 ${containerGlow}`}>
                    {/* INDICADOR DE ALTITUD (Dimensión 2) */}
                    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[32px] flex items-center gap-4 animate-in slide-in-from-right">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                            <Wind size={24} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-prototype">Fisiología Ambiental</p>
                            <p className="text-[14px] font-bold text-indigo-900 leading-none font-prototype">
                                {localState.environment.city}: {localState.environment.altitude} msnm
                            </p>
                        </div>
                        {localState.environment.hypoxiaRisk && (
                            <div className="bg-indigo-600 text-white text-[9px] font-black px-4 py-2 rounded-full uppercase font-prototype animate-pulse">
                                Hipoxia Detectada
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* ENERGÍA (Dimensión 6) */}
                        <div className="bg-white border border-slate-100 p-6 rounded-[40px] shadow-sm flex flex-col gap-2">
                            <Battery className={localState.energy.level > 5 ? "text-green-500" : "text-amber-500"} size={24} />
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-prototype">Energía Basal</p>
                            <p className="text-lg font-black text-slate-800 font-prototype">{localState.energy.level || "-"}/10</p>
                        </div>

                        {/* SUEÑO */}
                        <div className="bg-white border border-slate-100 p-6 rounded-[40px] shadow-sm flex flex-col gap-2">
                            <Moon className="text-blue-500" size={24} />
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-prototype">Reparación Nocturna</p>
                            <p className="text-lg font-black text-slate-800 font-prototype">{localState.circadian.sleepHours || "-"} hrs</p>
                        </div>
                    </div>

                    {/* CICLO HORMONAL (Dimensión 7) */}
                    {patientProfile?.sex === 'FEMALE' && (
                        <div className="bg-pink-50 border border-pink-100 p-6 rounded-[32px] flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center">
                                    <Heart size={20} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-pink-400 uppercase tracking-widest font-prototype">Estatus Endocrino</p>
                                    <p className="text-[13px] font-bold text-pink-900 leading-none font-prototype">Fase Actual: {localState.hormonal.cyclePhase}</p>
                                </div>
                            </div>
                            <div className="text-[10px] font-bold text-pink-600 font-prototype uppercase tracking-tighter italic">
                                Sincronización On
                            </div>
                        </div>
                    )}

                    {localState.environment.hypoxiaRisk && (
                        <div className="bg-blue-50/50 border border-blue-100 p-8 rounded-[40px] flex items-start gap-4 italic shadow-sm">
                            <Sparkles className="text-[#1C75BC] flex-shrink-0 mt-1" size={20} />
                            <p className="text-sm text-blue-900 leading-relaxed font-sansation">
                                "Al vivir a {localState.environment.altitude} metros, su cuerpo necesita optimizar el transporte de oxígeno. La clorofila (34+) será su mejor aliada para cerrar el grifo de la fatiga."
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EspejoEstiloVida;
