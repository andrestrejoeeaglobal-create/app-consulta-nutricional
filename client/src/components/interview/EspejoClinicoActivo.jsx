import React, { useEffect, useState, useRef } from 'react';
import {
    Activity, Timer, Star, ClipboardList,
    Stethoscope, ShieldCheck, Baby, Sparkles, Check
} from 'lucide-react';

// Custom Hook para detectar un cambio y disparar un brillo (Blue Glow) de 1.5s
function useGlowOnUpdate(value) {
    const [isGlowing, setIsGlowing] = useState(false);
    const previousValue = useRef(value);

    useEffect(() => {
        if (value !== previousValue.current && value) {
            // Add tiny timeout to prevent synchronous state update warning during rendering
            const glowStartTimer = setTimeout(() => setIsGlowing(true), 10);
            const glowEndTimer = setTimeout(() => setIsGlowing(false), 1500);
            return () => {
                clearTimeout(glowStartTimer);
                clearTimeout(glowEndTimer);
            };
        }
    }, [value]);

    return isGlowing ? 'animate-blue-glow' : '';
}

const EspejoClinicoActivo = ({ fase3State, patientData }) => {
    // Si no hay estado aún, mostramos un esqueleto o información de espera
    // Combinamos fase3State (viejo) con patientData.clinical_context (nuevo)
    const ctx = patientData?.clinical_context || {};
    const aiAnalysis = ctx.ai_analysis || {};

    const localState = {
        patient_quote: fase3State?.patient_quote || ctx.primary_motive || "",
        specific_ailment: fase3State?.specific_ailment || (ctx.pain_zones?.length > 0 ? `Zonas referidas: ${ctx.pain_zones.join(', ')}` : ""),
        alert_level: fase3State?.alert_level || (aiAnalysis.detected_tags?.includes('red_flag_symptom') ? 'CRITICAL' : aiAnalysis.detected_tags?.length > 0 ? 'WARNING' : 'NONE'),
        emotional_anchor: fase3State?.emotional_anchor || ctx.goal || "",
        detective_radiography: {
            chronology: fase3State?.detective_radiography?.chronology || (ctx.secondary_symptoms ? "Síntomas secundarios referidos" : ""),
            suspicion: fase3State?.detective_radiography?.suspicion || aiAnalysis.avatar_assigned || ""
        },
        goal_standard: fase3State?.goal_standard || ctx.primary_motive || ""
    };

    // Tracking Glow Classes
    const quoteGlow = useGlowOnUpdate(localState.patient_quote);
    const chronoGlow = useGlowOnUpdate(localState.detective_radiography?.chronology);
    const suspicionGlow = useGlowOnUpdate(localState.specific_ailment);
    const anchorGlow = useGlowOnUpdate(localState.emotional_anchor);



    // Asumimos que podemos derivar showInferenceCard y isAnalyzing del propio estado
    // pero idealmente, los recibimos de props o fase3State.
    // Para simplificar, si hay un alert_level pero no un goal_standard y la cita está completa, podríamos mostrarlo.
    // O mejor, recibir 'showInferenceCard' en fase3State.

    const getInferredGoal = () => {
        const level = localState.alert_level;
        if (level === 'PRETERM') return 'Nutrición para el Desarrollo';
        if (level === 'NEURO') return 'Salud Neuromotriz y Seguridad';
        if (level !== 'NONE') return 'Controlar Enfermedad';
        return 'Bienestar / Aprender a comer';
    };

    return (
        <div className="w-full relative flex flex-col gap-6">
            <div id="card-motivo" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden transition-all duration-300">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Activity className="w-6 h-6 text-blue-500" />
                        <div>
                            <h3 className="font-bold text-slate-700 text-lg">Motivo de Consulta</h3>
                            <p className="text-xs text-slate-500 font-sansation">Espejo Clínico Activo</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className={`bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-sm transition-all ${quoteGlow}`}>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-prototype">Motivo Principal</h4>
                        <p className="text-sm text-slate-700 italic">"{localState.patient_quote || 'Esperando respuesta...'}"</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className={`bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-sm transition-all ${chronoGlow}`}>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-prototype flex items-center gap-2"><Timer size={14} /> Cronología</h4>
                            <p className="text-sm font-semibold text-slate-800">{localState.detective_radiography?.chronology || 'Pendiente...'}</p>
                        </div>
                        <div className={`bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-sm transition-all ${suspicionGlow}`}>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-prototype flex items-center gap-2"><Stethoscope size={14} /> Sospecha Clínica</h4>
                            <p className={`text-sm font-bold uppercase ${localState.alert_level === 'CRITICAL' ? 'text-red-600' : 'text-blue-600'}`}>
                                {localState.specific_ailment ? (localState.alert_level === 'CRITICAL' ? 'RIESGO ONCOLÓGICO / CRÍTICO' : localState.detective_radiography?.suspicion?.toUpperCase() || localState.specific_ailment.toUpperCase()) : 'Pendiente...'}
                            </p>
                        </div>
                    </div>

                    {localState.emotional_anchor && (
                        <div className={`bg-[#FFFBEB] border border-amber-100 p-5 rounded-2xl shadow-sm transition-all ${anchorGlow}`}>
                            <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2 font-prototype flex items-center gap-2"><Star size={14} className="text-amber-500" fill="currentColor" /> Norte de Salud</h4>
                            <p className="text-sm text-amber-900 font-medium italic">"{localState.emotional_anchor}"</p>
                        </div>
                    )}

                    {localState.showInferenceCard && (
                        <div className="mt-2 p-8 rounded-[32px] border-2 border-blue-500 bg-blue-50 relative overflow-hidden flex flex-col items-center text-center shadow-lg animate-in zoom-in duration-500">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><Sparkles size={60} /></div>
                            <h4 className="text-xs font-black text-blue-900 uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2 italic">
                                <ShieldCheck size={20} /> Veredicto Tilo Cortex
                            </h4>
                            <p className="text-sm text-blue-800 leading-relaxed max-w-sm mb-4">
                                Análisis Clínico Estratégico. El enfoque prioritario sugerido es:
                            </p>
                            <strong className="text-2xl block text-blue-900 font-prototype">{localState.inferred_goal || getInferredGoal()}</strong>

                            {localState.goal_standard && (
                                <div className="mt-6 flex items-center justify-center">
                                    <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
                                        <Check size={14} /> Enfoque Confirmado
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EspejoClinicoActivo;
