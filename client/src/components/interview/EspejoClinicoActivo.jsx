import React, { useEffect, useState, useRef } from 'react';
import {
    Activity, Timer, Star, ClipboardList,
    Stethoscope, ShieldCheck, Baby, Sparkles, Check, AlertTriangle,
    User, Target
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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

const riskToSpanish = (risk) => {
    const map = {
        'LOW': 'Estable',
        'BASE': 'Estable',
        'MEDIUM': 'Moderado',
        'HIGH': 'Riesgo Alto / Límite',
        'SEVERE': 'Crítico (Red Flag)'
    };
    const cleanRisk = (risk || "").toUpperCase();
    return map[cleanRisk] || risk;
};

const renderClinicalCards = (text) => {
    if (!text) return null;
    
    const renderFormattedContent = (content) => {
        if (!content) return null;
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const hasBullets = lines.some(line => line.startsWith('-'));
        
        if (hasBullets) {
            return (
                <ul className="list-disc pl-4 space-y-1 mt-1 text-[11px] text-tilo-text-main leading-snug">
                    {lines.map((line, lIdx) => {
                        const cleanLine = line.startsWith('-') ? line.substring(1).trim() : line;
                        return (
                            <li key={lIdx} className="text-[11px] text-tilo-text-main leading-snug">
                                {cleanLine}
                            </li>
                        );
                    })}
                </ul>
            );
        }
        
        if (content.includes(' - ')) {
            const parts = content.split(' - ').map(p => p.trim()).filter(p => p.length > 0);
            return (
                <ul className="list-disc pl-4 space-y-1 mt-1 text-[11px] text-tilo-text-main leading-snug">
                    {parts.map((part, pIdx) => (
                        <li key={pIdx} className="text-[11px] text-tilo-text-main leading-snug">
                            {part}
                        </li>
                    ))}
                </ul>
            );
        }
        
        return <p className="text-[11px] text-tilo-text-main leading-snug">{content}</p>;
    };

    // Normalize newlines
    const cleanText = text.replace(/\r\n/g, '\n').trim();
    
    // Regex extraction
    const forenseMatch = cleanText.match(/Análisis Forense:\s*([\s\S]*?)(?=Modelo ATM:|Nodos de la Matriz IFM afectados:|$)/i);
    const atmMatch = cleanText.match(/Modelo ATM:\s*([\s\S]*?)(?=Nodos de la Matriz IFM afectados:|\*Nota Clínica\*|$)/i);
    const nodesMatch = cleanText.match(/Nodos de la Matriz IFM afectados:\s*([\s\S]*?)(?=\*Nota Clínica\*|\*Nota Clínica:\*|$)/i);
    const noteMatch = cleanText.match(/\*Nota Clínica:\*?\s*([\s\S]*?)$/i);
    
    const forenseText = forenseMatch ? forenseMatch[1].trim() : "";
    const atmText = atmMatch ? atmMatch[1].trim() : "";
    const nodesText = nodesMatch ? nodesMatch[1].trim() : "";
    const noteText = noteMatch ? noteMatch[1].trim() : "";
    
    // Parse sub-items
    const parseSubItems = (subText) => {
        const items = [];
        const regex = /-\s*(Antecedentes|Desencadenantes|Mediadores|Asimilación|Integridad Estructural|Energía|Defensa y Reparación):\s*([\s\S]*?)(?=-\s*(Antecedentes|Desencadenantes|Mediadores|Asimilación|Integridad Estructural|Energía|Defensa y Reparación)|$)/gi;
        let match;
        while ((match = regex.exec(subText)) !== null) {
            items.push({
                title: match[1].trim(),
                content: match[2].trim()
            });
        }
        return items;
    };
    
    const atmItems = parseSubItems(atmText);
    const nodeItems = parseSubItems(nodesText);
    
    // If we couldn't parse structured items, fall back to clean Markdown rendering
    if (atmItems.length === 0 && nodeItems.length === 0) {
        let formatted = cleanText
            .replace(/\n\s*-\s*/g, '\n\n- ')
            .replace(/([a-zA-Z0-9]):\s+-/g, '$1:\n\n-');
        return (
            <div className="text-sm text-tilo-text-main leading-relaxed">
                <ReactMarkdown>{formatted}</ReactMarkdown>
            </div>
        );
    }
    
    return (
        <div className="space-y-4 mt-2">
            {forenseText && (
                <div className="bg-tilo-bg-base/30 p-3.5 rounded-xl border border-tilo-border">
                    <span className="text-[10px] text-tilo-text-muted font-bold uppercase tracking-wider block mb-1">Análisis Forense</span>
                    <p className="text-xs text-tilo-text-main leading-relaxed">{forenseText}</p>
                </div>
            )}
            
            {atmItems.length > 0 && (
                <div className="bg-tilo-bg-panel p-3.5 rounded-xl border border-tilo-border">
                    <span className="text-[10px] text-tilo-primary font-bold uppercase tracking-wider block mb-2">Modelo ATM</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {atmItems.map((item, idx) => (
                            <div key={idx} className="bg-tilo-bg-base/20 p-2.5 rounded-lg border border-tilo-border/50">
                                <span className="text-[10px] text-tilo-text-muted font-bold block mb-0.5">{item.title}</span>
                                {renderFormattedContent(item.content)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {nodeItems.length > 0 && (
                <div className="bg-tilo-bg-panel p-3.5 rounded-xl border border-tilo-border">
                    <span className="text-[10px] text-tilo-success font-bold uppercase tracking-wider block mb-2">Nodos Matriz IFM Afectados</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {nodeItems.map((item, idx) => (
                            <div key={idx} className="bg-tilo-bg-base/20 p-2.5 rounded-lg border border-tilo-border/50">
                                <span className="text-[10px] text-tilo-success font-bold block mb-0.5">{item.title}</span>
                                {renderFormattedContent(item.content)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {noteText && (
                <div className="border-t border-tilo-border/60 pt-2.5 text-[10px] text-tilo-text-muted italic flex items-center gap-1.5">
                    <span className="font-bold uppercase tracking-wider text-[9px] bg-tilo-bg-base/60 px-1.5 py-0.5 rounded border border-tilo-border">Nota Clínica</span>
                    <span>{noteText.replace(/\*Nota Clínica:\*?\s*/i, "")}</span>
                </div>
            )}
        </div>
    );
};

const EspejoClinicoActivo = ({ patientData }) => {
    const ctx = patientData?.clinical_context || {};
    const aiAnalysis = ctx.ai_analysis || {};

    let currentAge = null;
    if (patientData?.profile?.age !== undefined && patientData?.profile?.age !== null) currentAge = Number(patientData.profile.age);
    else if (patientData?.identificacion?.edad !== undefined && patientData?.identificacion?.edad !== null) currentAge = Number(patientData.identificacion.edad);

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
        let cleanText = txt.replace(/\\{[^}]+\\}/g, '').replace(/\\[[^\]]+\\]/g, '').replace(/┬┐/g, '¿');
        
        // Sanitización contra fuga de variables internas
        cleanText = cleanText.replace(/\*?\*?(freeText|telemetry|bodyMapZones)\*?\*?\s*:\s*/gi, '');

        // Primero intentamos reemplazar cualquier llave conocida dentro del string por su valor en español
        Object.keys(motiveOptionsMap).forEach(key => {
            if (cleanText.includes(key)) {
                cleanText = cleanText.replace(new RegExp(key, 'g'), motiveOptionsMap[key]);
            }
        });

        // Si todavía quedan etiquetas ROUTE_ o GOAL_, las limpiamos
        cleanText = cleanText.replace(/(ROUTE_|GOAL_)[A-Z_]+/g, 'ruta clínica');
        return cleanText.trim();
    };
    const reasoningText = sanitizeReasoning(aiAnalysis.gem_reasoning);

    const primaryRouteText = aiAnalysis.primaryRoute ? sanitizeRouteName(aiAnalysis.primaryRoute) : "Pendiente...";
    const secondaryRouteText = aiAnalysis.secondaryRoute ? sanitizeRouteName(aiAnalysis.secondaryRoute) : "No detectada";

    const isRedFlag = aiAnalysis.redFlag;

    const tagTranslations = {
        'JOINT_KNEE': 'Riesgo Articular (Rodilla)',
        'JOINT_SHOULDER': 'Riesgo Articular (Hombro)',
        'JOINT_ELBOW': 'Riesgo Articular (Codo)',
        'CIRCULATION_RISK': 'Riesgo Circulatorio',
        'JOINT_ANKLE': 'Riesgo Articular (Tobillo)',
        'JOINT_FOOT': 'Riesgo Articular (Pie)',
        'HEADACHE_RISK': 'Cefalea / Riesgo Neurológico',
        'CERVICAL_RISK': 'Riesgo Cervical',
        'POSTURAL_RISK': 'Riesgo Postural',
        'GASTRIC_RISK': 'Riesgo Gástrico',
        'INTESTINAL_RISK': 'Riesgo Intestinal',
        'JOINT_HIP': 'Riesgo Articular (Cadera)',
        'LUMBAR_RISK': 'Riesgo Lumbar',
        'RESPIRATORY_RISK': 'Riesgo Respiratorio',
        'BREAST_RISK': 'Riesgo Mamario',
        'BREAST_L': 'Riesgo Mamario',
        'GYNECO_RISK': 'Riesgo Ginecológico',
        'RENAL_RISK': 'Riesgo Renal',
        'JOINT_WRIST': 'Riesgo Articular (Muñeca)',
        'PAIN_GENERAL': 'Dolor Generalizado',
        'CARDIO_RISK': 'Alerta Cardiovascular',
        'RED_FLAG_SYMPTOM': 'Síntoma Crítico',
        'HIGH_VULNERABILITY': 'Riesgo Alto / Límite'
    };

    // Deduplication and case-insensitive normalization of tags (V15.7 Update)
    const uniqueTags = Array.from(new Set(
        (aiAnalysis.detected_tags || [])
            .map(t => String(t).toUpperCase().trim())
            .filter(t => t !== 'RED_FLAG_SYMPTOM' && t !== '')
    ));

    const chronoGlow = useGlowOnUpdate(chronologyText);
    const quoteGlow = useGlowOnUpdate(motiveText);
    const anchorGlow = useGlowOnUpdate(primaryRouteText);
    const suspicionGlow = useGlowOnUpdate(isRedFlag);
    const reasoningGlow = isRedFlag ? 'shadow-[0_0_15px_rgba(239,68,68,0.3)]' : '';

    return (
        <div className="w-full relative flex flex-col gap-4">
            {/* PILLS DE ESTADO INMEDIATO (Disposición Grid Horizontal) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Perfil */}
                <div className={`bg-tilo-bg-base/40 p-4 rounded-2xl shadow-sm border border-tilo-border transition-all duration-300 ${chronoGlow}`}>
                    <h4 className="text-[10px] font-bold text-tilo-text-muted uppercase tracking-widest mb-2 font-prototype flex items-center gap-2">
                        <User size={14} className="text-tilo-primary" /> Perfil
                    </h4>
                    <p className="text-sm font-semibold text-tilo-text-main leading-relaxed">
                        {devStage} {currentAge !== null ? `(${currentAge} años)` : ''}
                    </p>
                </div>

                {/* 2. Eje Crítico */}
                <div className={`bg-tilo-bg-panel/80 p-4 rounded-2xl shadow-sm border border-tilo-primary/20 transition-all duration-300 ${anchorGlow}`}>
                    <h4 className="text-[10px] font-bold text-tilo-primary/80 uppercase tracking-widest mb-2 font-prototype flex items-center gap-2">
                        <Target size={14} className="text-tilo-primary" /> Eje Crítico
                    </h4>
                    <p className="text-sm font-semibold text-tilo-text-main leading-relaxed">
                        {primaryRouteText}
                    </p>
                </div>

                {/* 3. Riesgo / Estado */}
                {(() => {
                    const cleanRisk = String(aiAnalysis.risk_level || '').toUpperCase().trim();
                    let cardColorClass = 'bg-tilo-success/10 border-tilo-success/30 text-tilo-success-text';
                    let headerColorClass = 'text-tilo-success-text';

                    if (isRedFlag || cleanRisk === 'SEVERE') {
                        cardColorClass = 'bg-tilo-danger/10 border-tilo-danger/30 text-tilo-danger';
                        headerColorClass = 'text-tilo-danger';
                    } else if (cleanRisk === 'HIGH' || uniqueTags.includes('HIGH_VULNERABILITY')) {
                        cardColorClass = 'bg-tilo-danger/5 border-tilo-danger/20 text-tilo-danger/90';
                        headerColorClass = 'text-tilo-danger/80';
                    } else if (cleanRisk === 'MEDIUM') {
                        cardColorClass = 'bg-tilo-warning/10 border-tilo-warning/30 text-tilo-warning-text';
                        headerColorClass = 'text-tilo-warning-text';
                    }

                    return (
                        <div className={`backdrop-blur-sm border rounded-2xl p-4 shadow-sm transition-all duration-300 ${suspicionGlow} ${cardColorClass}`}>
                            <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-2 font-prototype flex items-center gap-2 ${headerColorClass}`}>
                                <AlertTriangle size={14} />
                                {isRedFlag || cleanRisk === 'SEVERE' ? 'Riesgo Crítico' : 'Riesgo / Estado'}
                            </h4>
                            <p className="text-sm font-semibold leading-relaxed">
                                {isRedFlag || cleanRisk === 'SEVERE' ? 'Crítico (Red Flag)' : (uniqueTags.length > 0 && tagTranslations[uniqueTags[0]] ? tagTranslations[uniqueTags[0]] : riskToSpanish(aiAnalysis.risk_level || 'Base'))}
                            </p>
                        </div>
                    );
                })()}
            </div>

            {/* MOTIVO PRINCIPAL (Rápida Lectura) */}
            <div className={`bg-tilo-bg-panel p-5 rounded-2xl shadow-sm border border-tilo-border transition-all duration-300 ${quoteGlow}`}>
                <h4 className="text-[10px] font-bold text-tilo-text-muted uppercase tracking-widest mb-2 font-prototype flex items-center gap-2">
                    <ClipboardList size={14} className="text-tilo-primary/80" /> Motivo de Consulta
                </h4>
                <p className="text-[1.1rem] text-tilo-text-main font-medium leading-relaxed">
                    {motiveText}
                </p>
            </div>

            {/* ANÁLISIS FORENSE (GLASSMORPHISM) */}
            <div className={`relative group mt-1 transition-all duration-500 ${reasoningGlow}`}>
                {/* Glow de fondo (Blur) */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-tilo-primary/5 to-tilo-primary/10 rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition duration-500"></div>
                
                {/* Contenedor Glassmorphism */}
                <div className="relative bg-tilo-bg-panel/75 backdrop-blur-xl border border-tilo-border p-5 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-bold text-tilo-primary uppercase tracking-widest font-prototype flex items-center gap-2">
                            <Sparkles size={14} className="text-tilo-primary/80" /> Deducción Sugerida (Matriz IFM)
                        </h4>
                        {aiAnalysis.secondaryRoute && (
                            <span className="text-[9px] font-bold text-tilo-text-muted uppercase bg-tilo-bg-base/60 px-2 py-1 rounded-full border border-tilo-border">
                                {secondaryRouteText}
                            </span>
                        )}
                    </div>
                    
                    <div className="text-tilo-text-main leading-relaxed font-sansation">
                        {renderClinicalCards(reasoningText)}
                    </div>

                    {aiAnalysis.clinicalJustification && (
                        <div className="mt-4 p-3.5 bg-tilo-bg-base/30 rounded-xl border border-tilo-border/60 text-xs text-tilo-text-main leading-relaxed font-sansation">
                            <span className="text-[10px] text-tilo-primary font-bold uppercase tracking-wider block mb-1">Justificación del Triage</span>
                            <p className="text-tilo-text-main font-medium">{aiAnalysis.clinicalJustification}</p>
                        </div>
                    )}

                    {/* Tags adicionales si los hay (Deduplicados y Traducidos) */}
                    {uniqueTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-tilo-border">
                            {uniqueTags.map((tag, idx) => (
                                <span key={idx} className="bg-tilo-bg-base/60 text-tilo-text-muted px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider font-sansation border border-tilo-border">
                                    {tagTranslations[tag] || tag.replace(/_/g, ' ')}
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
