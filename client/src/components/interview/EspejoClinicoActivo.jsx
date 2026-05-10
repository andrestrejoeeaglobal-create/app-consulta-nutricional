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
    "GOAL_PEDIATRICS": "Pediatría (Crecimiento y Desarrollo)",
    "GOAL_LONGEVITY": "Prevención y Longevidad (Biohacking)",
    "GOAL_MENTAL_HEALTH": "Salud Mental / TCA (Seguridad Conductual)",
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
        cleanRoute = cleanRoute.replace(/(ROUTE_|GOAL_)[A-Z_]+/gi, 'ruta clínica');
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

    return (
        <div className="w-full relative flex flex-col gap-6">
            <div id="card-motivo" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden transition-all duration-300">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Activity className="w-6 h-6 text-[#1C75BC]" />
                        <div>
                            <h3 className="font-bold text-slate-700 text-lg">Resumen Clínico</h3>
                            <p className="text-xs text-slate-500 font-sansation">Síntesis Dinámica Cortex</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {/* CRONOLOGÍA */}
                    <div className={`bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-sm transition-all ${chronoGlow}`}>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-prototype flex items-center gap-2">
                            <Timer size={14} /> Cronología
                        </h4>
                        <p className="text-sm font-semibold text-slate-800 line-clamp-3">{chronologyText}</p>
                    </div>

                    {/* MOTIVO DE CONSULTA */}
                    <div className={`bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-sm transition-all ${quoteGlow}`}>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-prototype flex items-center gap-2">
                            <ClipboardList size={14} /> Motivo de Consulta
                        </h4>
                        <p className="text-sm text-slate-700 font-medium italic mb-2 line-clamp-2">{motiveText}</p>
                        <p className="text-sm text-slate-600 line-clamp-3 border-t border-slate-200 pt-2 mt-2">{reasoningText}</p>
                    </div>

                    {/* NORTE DE SALUD (RUTAS) */}
                    <div className={`bg-[#FFFBEB] border border-amber-100 p-5 rounded-2xl shadow-sm transition-all ${anchorGlow}`}>
                        <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2 font-prototype flex items-center gap-2">
                            <Star size={14} className="text-amber-500" fill="currentColor" /> Norte de Salud
                        </h4>
                        <div className="flex flex-col gap-2 mt-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-amber-900 bg-amber-200 px-2 py-1 rounded">Ruta Principal</span>
                                <span className="text-sm text-amber-900 font-medium">{primaryRouteText}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">Ruta Secundaria</span>
                                <span className="text-sm text-amber-800">{secondaryRouteText}</span>
                            </div>
                        </div>
                    </div>

                    {/* SOSPECHA CLÍNICA (ALERTAS) */}
                    {(isRedFlag || aiAnalysis.detected_tags?.length > 0) && (
                        <div className={`bg-slate-50 border ${isRedFlag ? 'border-red-200 bg-red-50' : 'border-slate-100'} p-5 rounded-2xl shadow-sm transition-all ${suspicionGlow}`}>
                            <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-2 font-prototype flex items-center gap-2 ${isRedFlag ? 'text-red-500' : 'text-slate-400'}`}>
                                <Stethoscope size={14} /> Sospecha Clínica
                            </h4>
                            {isRedFlag && (
                                <p className="text-sm font-bold text-red-600 uppercase flex items-center gap-2 mb-2">
                                    ⚠️ Alerta Clínica Detectada
                                </p>
                            )}
                            {aiAnalysis.detected_tags?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {aiAnalysis.detected_tags.filter(t => t !== 'red_flag_symptom').map((tag, idx) => (
                                        <span key={idx} className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-bold uppercase">
                                            {tag.replace(/_/g, ' ')}
                                        </span>
                                    ))}
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
