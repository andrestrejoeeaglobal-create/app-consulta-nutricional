import React, { useEffect, useState, useRef } from 'react';
import {
    Activity, Timer, Star, ClipboardList,
    Stethoscope, ShieldCheck, Baby, Sparkles, Check, AlertTriangle
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

const motiveOptionsMap = {
    "GOAL_ADDICTIONS": "Adicciones y Sustancias",
    "GOAL_GERIATRICS": "Adulto Mayor (Geriatría)",
    "GOAL_ALLERGIES": "Alergias Graves (Protocolo Anafilaxia)",
    "GOAL_WEIGHT_LOSS": "Bajar de Peso / Sobrepeso",
    "GOAL_BARIATRIC": "Bariátrica / Quirúrgico",
    "GOAL_MENOPAUSE": "Climaterio y Menopausia",
    "GOAL_CLINICAL": "Control Clínico (Patologías Crónicas)",
    "GOAL_PALLIATIVE": "Cuidados Paliativos",
    "GOAL_DISABILITY": "Discapacidad y Rehabilitación",
    "GOAL_PREGNANCY": "Embarazo y Lactancia",
    "GOAL_MUSCLE": "Ganar Músculo / Deporte (Rendimiento)",
    "GOAL_ONCOLOGY": "Oncología Nutricional",
    "GOAL_PEDIATRICS": "Pediatría (Crecimiento)",
    "GOAL_LONGEVITY": "Prevención y Longevidad",
    "GOAL_MENTAL_HEALTH": "Salud Mental / TCA",
    "GOAL_RENAL": "Salud Renal (Nefropatía)",
    "GOAL_IMMUNE": "VIH e Inmunodeficiencias"
};

const getDevelopmentStage = (age) => {
    if (age == null) return "Etapa no definida";
    if (age < 2) return "Primera Infancia";
    if (age < 12) return "Infancia";
    if (age < 18) return "Adolescencia";
    if (age < 35) return "Adulto Joven";
    if (age < 60) return "Adultez";
    return "Adulto Mayor";
};

const EspejoClinicoActivo = ({ patientData }) => {
    const ctx = patientData?.clinical_context || {};
    const aiAnalysis = ctx.ai_analysis || {};

    let currentAge = null;
    if (patientData?.profile?.age) currentAge = Number(patientData.profile.age);
    else if (patientData?.identificacion?.edad) currentAge = Number(patientData.identificacion.edad);

    const devStage = getDevelopmentStage(currentAge);
    const chronologyText = aiAnalysis.chronologySynthesis || (currentAge !== null ? `Paciente de ${currentAge} años. ${devStage}.` : "Edad no registrada.");

    const sanitizeRouteName = (route) => {
        if (!route) return "Pendiente...";
        let cleanRoute = route;
        
        // Primero intentamos reemplazar cualquier llave conocida dentro del string
        Object.keys(motiveOptionsMap).forEach(key => {
            if (cleanRoute.includes(key)) {
                cleanRoute = cleanRoute.replace(key, motiveOptionsMap[key]);
            }
        });

        // Si todavía quedan etiquetas ROUTE_ o GOAL_, las limpiamos
        cleanRoute = cleanRoute.replace(/(ROUTE_|GOAL_)[A-Z_]+/gi, 'Ruta Clínica');
        return cleanRoute.replace(/_/g, ' ');
    };

    const rawMotive = ctx.primary_motive || "Esperando motivo...";
    const motiveText = aiAnalysis.motiveSynthesis || (rawMotive.includes('GOAL_') ? sanitizeRouteName(rawMotive) : `"${rawMotive}"`);
    
    // Purga de caracteres extraños y sanitización JSON
    const sanitizeReasoning = (txt) => {
        if (!txt) return "Esperando síntesis de telemetría...";
        return txt.replace(/\\{[^}]+\\}/g, '').replace(/\\[[^\]]+\\]/g, '').replace(/(ROUTE_|GOAL_)[A-Z_]+/g, 'ruta clínica').replace(/┬┐/g, '¿').trim();
    };
    const reasoningText = sanitizeReasoning(aiAnalysis.gem_reasoning);

    const primaryRouteText = aiAnalysis.primaryRoute ? sanitizeRouteName(aiAnalysis.primaryRoute) : "Pendiente...";
    const secondaryRouteText = aiAnalysis.secondaryRoute ? sanitizeRouteName(aiAnalysis.secondaryRoute) : "No detectada";

    const isRedFlag = aiAnalysis.redFlag;

    const chronoGlow = useGlowOnUpdate(chronologyText);
    const quoteGlow = useGlowOnUpdate(motiveText);
    const anchorGlow = useGlowOnUpdate(primaryRouteText);
    const suspicionGlow = useGlowOnUpdate(isRedFlag);
    const reasoningGlow = useGlowOnUpdate(reasoningText);

    return (
        <div className="w-full relative flex flex-col gap-4">
            {/* BENTO GRID: PILLS DE ESTADO INMEDIATO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Perfil */}
                <div className={`bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3 transition-all duration-300 ${chronoGlow}`}>
                    <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-500">
                        <Baby size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest truncate">Perfil</p>
                        <p className="text-sm font-semibold text-slate-700 truncate">{devStage} {currentAge !== null ? `(${currentAge} años)` : ''}</p>
                    </div>
                </div>

                {/* 2. Eje Crítico */}
                <div className={`bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3 transition-all duration-300 ${anchorGlow}`}>
                    <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500">
                        <Star size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest truncate">Eje Crítico</p>
                        <p className="text-sm font-semibold text-slate-700 truncate">{primaryRouteText}</p>
                    </div>
                </div>

                {/* 3. Riesgo / Estado */}
                <div className={`bg-white border ${isRedFlag ? 'border-red-200' : 'border-slate-100'} p-3 rounded-2xl shadow-sm flex items-center gap-3 transition-all duration-300 ${suspicionGlow}`}>
                    <div className={`${isRedFlag ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'} p-2.5 rounded-xl`}>
                        {isRedFlag ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-[10px] uppercase font-bold tracking-widest truncate ${isRedFlag ? 'text-red-400' : 'text-slate-400'}`}>
                            {isRedFlag ? 'Riesgo Crítico' : 'Sospecha Clínica'}
                        </p>
                        <p className={`text-sm font-semibold truncate ${isRedFlag ? 'text-red-600' : 'text-emerald-600'}`}>
                            {isRedFlag ? 'Alerta Detectada' : (aiAnalysis.detected_tags?.length > 0 ? aiAnalysis.detected_tags[0].replace(/_/g, ' ') : 'Estable')}
                        </p>
                    </div>
                </div>
            </div>

            {/* MOTIVO PRINCIPAL (Rápida Lectura) */}
            <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-all duration-300 ${quoteGlow}`}>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-prototype flex items-center gap-2">
                    <ClipboardList size={14} className="text-indigo-400" /> Motivo de Consulta
                </h4>
                <p className="text-[1.1rem] text-slate-800 font-medium leading-relaxed">
                    {motiveText}
                </p>
            </div>

            {/* ANÁLISIS FORENSE (GLASSMORPHISM) */}
            <div className={`relative group mt-1 transition-all duration-500 ${reasoningGlow}`}>
                {/* Glow de fondo (Blur) */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition duration-500"></div>
                
                {/* Contenedor Glassmorphism */}
                <div className="relative bg-white/70 backdrop-blur-xl border border-white/80 p-5 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest font-prototype flex items-center gap-2">
                            <Sparkles size={14} className="text-indigo-400" /> Deducción Sugerida (Matriz IFM)
                        </h4>
                        {aiAnalysis.secondaryRoute && (
                            <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-100/80 px-2 py-1 rounded-full">
                                {secondaryRouteText}
                            </span>
                        )}
                    </div>
                    
                    <p className="text-sm text-slate-600 leading-relaxed font-sansation">
                        {reasoningText}
                    </p>

                    {/* Tags adicionales si los hay */}
                    {aiAnalysis.detected_tags?.length > 1 && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-200/50">
                            {aiAnalysis.detected_tags.filter(t => t !== 'red_flag_symptom').map((tag, idx) => (
                                <span key={idx} className="bg-slate-100/80 text-slate-600 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                    {tag.replace(/_/g, ' ')}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EspejoClinicoActivo;
