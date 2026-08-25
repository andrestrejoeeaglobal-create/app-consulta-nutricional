/* eslint-disable no-unused-vars */
import React from 'react';
import { Activity, AlertCircle, AlertTriangle, Dumbbell, Moon, Brain, Briefcase } from 'lucide-react';
import BiomarkerScoringEngine from '../../utils/BiomarkerScoringEngine';

const capitalizeFirst = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const ProgressRing = ({ score, label }) => {
    const isEvaluated = score !== null && score !== undefined;
    const displayScore = isEvaluated ? score : 0;
    const displayLabel = isEvaluated ? label : "Sin evaluar";

    let strokeColor = "stroke-tilo-text-muted/30";
    let textColor = "text-tilo-text-muted";
    
    if (isEvaluated) {
        if (displayLabel === "Óptimo") {
            strokeColor = "stroke-tilo-success";
            textColor = "text-tilo-success-text";
        } else if (displayLabel === "Bueno") {
            strokeColor = "stroke-tilo-primary";
            textColor = "text-tilo-primary";
        } else if (displayLabel === "Regular") {
            strokeColor = "stroke-tilo-warning";
            textColor = "text-tilo-warning-text";
        } else if (displayLabel === "Deficiente") {
            strokeColor = "stroke-tilo-danger";
            textColor = "text-tilo-danger";
        }
    }
    
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (displayScore / 100) * circumference;
    
    return (
        <div className="flex items-center gap-2">
            <svg className="w-8 h-8 transform -rotate-90">
                <circle
                    className="stroke-tilo-border fill-transparent"
                    strokeWidth="3"
                    r={radius}
                    cx="16"
                    cy="16"
                />
                <circle
                    className={`${strokeColor} fill-transparent transition-all duration-500 ease-out`}
                    strokeWidth="3"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    r={radius}
                    cx="16"
                    cy="16"
                />
            </svg>
            <div className="flex flex-col text-left">
                <span className={`text-xs font-black ${textColor} leading-none`}>
                    {isEvaluated ? `${displayScore}` : "--"}{" "}
                    <span className="text-[8px] font-normal text-tilo-text-muted">pts</span>
                </span>
                <span className="text-[8px] font-bold text-tilo-text-muted uppercase leading-none mt-0.5">
                    {displayLabel}
                </span>
            </div>
        </div>
    );
};

export const TabLogistics = ({
    patientData,
    setPatientData,
    isEditing,
    onTriggerEdit,
    onEditToggle,
    renderEditableField,
    CardHeader,
    Accordion,
    openSections,
    toggleSection,
    currentStep
}) => {
    // Calcular en tiempo real y de forma reactiva las puntuaciones
    const scores = BiomarkerScoringEngine.calculate(patientData) || {
        activity: { score: null, label: "Sin evaluar" },
        neat: { score: null, label: "Sin evaluar" },
        sleep: { score: null, label: "Sin evaluar" },
        stress: { score: null, label: "Sin evaluar" }
    };

    // --- UNIFICACIÓN RESILIENTE DE FUENTES DE DATOS CLÍNICOS (ESTADO ACTIVIDAD/SUEÑO/ESTRÉS) ---
    const hasLifestyle = (!!patientData.lifestyle_profile && 
                          patientData.lifestyle_profile.activity?.has_scheduled_exercise !== null &&
                          patientData.lifestyle_profile.activity?.has_scheduled_exercise !== undefined) ||
                         (!!patientData.clinical_context?.activity?.exercise &&
                          patientData.clinical_context.activity.exercise.has_scheduled_exercise !== null &&
                          patientData.clinical_context.activity.exercise.has_scheduled_exercise !== undefined);

    // 1. Actividad Física
    const hasExercise = patientData.lifestyle_profile?.activity?.has_scheduled_exercise || 
                        patientData.clinical_context?.activity?.exercise?.has_scheduled_exercise;
    
    // Contexto Pediátrico / Lactante para mapeo NEAT
    const ageStr = patientData?.profile?.pediatric_profile?.age || patientData?.identificacion?.edad || "0";
    const age = parseInt(ageStr, 10) || 0;
    const babyMonths = patientData?.profile?.baby_age_months !== undefined ? patientData.profile.baby_age_months : (patientData?.identificacion?.baby_age_months !== undefined ? patientData.identificacion.baby_age_months : null);
    const isLactante = age === 0 || (babyMonths !== null && babyMonths < 24);

    const neatMap = isLactante
        ? { SEDENTARY: 'Tranquilo', LIGHT: 'Gateo Inicial', MODERATE: 'Gateo Activo', HEAVY: 'Explorador' }
        : { SEDENTARY: 'Sedentario', LIGHT: 'Ligero', MODERATE: 'Moderado', HEAVY: 'Pesado' };

    const neatDescMap = isLactante
        ? {
            SEDENTARY: 'Tranquilo / Acostado la mayor parte del tiempo',
            LIGHT: 'Gateo inicial / Juego sentado',
            MODERATE: 'Gateo activo / Ya camina con apoyo',
            HEAVY: 'Explora activamente / Corre / Salta'
          }
        : {
            SEDENTARY: 'Principalmente sentado / Oficina',
            LIGHT: 'De pie o caminando poco',
            MODERATE: 'Movimiento constante / Trabajo activo',
            HEAVY: 'Trabajo físico demandante'
          };

    const neatLevelRaw = patientData.lifestyle_profile?.activity?.neat_level ||
                         patientData.clinical_context?.activity?.exercise?.neat_level;
    const neatLevel = neatLevelRaw ? (neatMap[neatLevelRaw] || neatLevelRaw) : 'Sin evaluar';
    const neatDesc = neatLevelRaw ? (neatDescMap[neatLevelRaw] || '--') : 'Sin evaluar';
    
    const exerciseLog = patientData.lifestyle_profile?.activity?.log || patientData.lifestyle?.activity?.log || [];
    const exerciseLogF10 = patientData.clinical_context?.activity?.exercise?.log || [];
    const telemetryMetadata = patientData.lifestyle?.activity?.telemetry_metadata || 
                             patientData.lifestyle_profile?.activity?.telemetry_metadata || 
                             patientData.clinical_context?.activity?.exercise?.telemetry_metadata;

    // 2. Sueño y Descanso
    const sleepHours = patientData.lifestyle_profile?.sleep?.hours_avg || 
                       patientData.clinical_context?.habits?.sleep?.hours || 0;
    
    const sleepQualityRaw = patientData.lifestyle_profile?.sleep?.quality || 
                            patientData.clinical_context?.habits?.sleep?.quality;
    
    const sleepQuality = (sleepQualityRaw?.toUpperCase() === 'GOOD' || sleepQualityRaw?.toLowerCase() === 'buena') ? 'GOOD' :
                         (sleepQualityRaw?.toUpperCase() === 'POOR' || sleepQualityRaw?.toLowerCase() === 'mala') ? 'POOR' :
                         (sleepQualityRaw?.toUpperCase() === 'REGULAR' || sleepQualityRaw?.toLowerCase() === 'regular') ? 'REGULAR' : null;

    // 3. Estrés y Cortisol
    const stressLevelRaw = patientData.lifestyle_profile?.stress?.level || 
                           patientData.clinical_context?.habits?.stress;
    
    const stressLevel = (stressLevelRaw?.toUpperCase() === 'LOW' || stressLevelRaw?.toLowerCase() === 'bajo') ? 'BAJO' :
                        (stressLevelRaw?.toUpperCase() === 'HIGH' || stressLevelRaw?.toLowerCase() === 'alto') ? 'ALTO' :
                        (stressLevelRaw?.toUpperCase() === 'MODERATE' || stressLevelRaw?.toLowerCase() === 'moderado') ? 'MODERADO' : 
                        stressLevelRaw ? stressLevelRaw.toUpperCase() : 'SIN DATO';
    
    const stressOrigin = patientData.lifestyle_profile?.stress?.origin || 
                         patientData.clinical_context?.habits?.stress_origin || 
                         'N/A';
    
    const isCortisolAlert = patientData.lifestyle_profile?.stress?.cortisol_management_needed || 
                            (stressLevel === 'ALTO');

    // Food logistics variables moved to TabNutrition.jsx

    return (
        <div className="space-y-6">
            <Accordion
                title="Estilo de Vida y Entorno"
                id="accordion-lifestyle-env"
                isOpen={openSections.parentLifestyle}
                onToggle={() => toggleSection('parentLifestyle')}
                variant="parent"
            >
                <div className="space-y-6">
                    <Accordion
                        title="Actividad y Entorno"
                        id="accordion-activity"
                        isOpen={openSections.childActivity}
                        onToggle={() => toggleSection('childActivity')}
                    >
                        <div id="card-lifestyle" className="space-y-4">
                            {/* 1. ACTIVIDAD FÍSICA / EJERCICIO */}
                            <div className="border-b border-tilo-border pb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <Dumbbell className="w-5 h-5 text-tilo-text-muted" />
                                        <div>
                                            <div className="text-sm font-bold text-tilo-text-main">Actividad Física / Ejercicio</div>
                                        </div>
                                    </div>
                                    <ProgressRing score={scores?.activity?.score} label={scores?.activity?.label} />
                                </div>

                                {/* Telemetry Metadata Card */}
                                {telemetryMetadata ? (
                                    <div className="mt-3 p-3 bg-tilo-bg/50 rounded-xl border border-tilo-border text-xs space-y-2">
                                        <div className="font-bold text-tilo-primary flex items-center gap-1.5 border-b border-tilo-border pb-1.5">
                                            <span>📊</span>
                                            <span>Resumen Metabólico Consolidado</span>
                                            <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                {telemetryMetadata.total_parsed_sessions || 1} {telemetryMetadata.total_parsed_sessions === 1 ? 'sesión' : 'sesiones'} (.TCX)
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 text-tilo-text-main">
                                            <div className="flex items-center gap-1.5 bg-white/60 dark:bg-slate-800/60 p-2 rounded-lg border border-tilo-border/60">
                                                <span className="text-base">🔥</span>
                                                <div>
                                                    <div className="text-[10px] text-tilo-text-muted leading-none">Gasto Calórico</div>
                                                    <div className="font-bold text-tilo-text-main mt-0.5">{telemetryMetadata.total_calories ? Math.round(telemetryMetadata.total_calories) : '--'} kcal</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white/60 dark:bg-slate-800/60 p-2 rounded-lg border border-tilo-border/60">
                                                <span className="text-base">⏱️</span>
                                                <div>
                                                    <div className="text-[10px] text-tilo-text-muted leading-none">Tiempo Total</div>
                                                    <div className="font-bold text-tilo-text-main mt-0.5">{telemetryMetadata.total_minutes || '--'} min</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white/60 dark:bg-slate-800/60 p-2 rounded-lg border border-tilo-border/60">
                                                <span className="text-base">📈</span>
                                                <div>
                                                    <div className="text-[10px] text-tilo-text-muted leading-none">FC Ponderada</div>
                                                    <div className="font-bold text-tilo-text-main mt-0.5">
                                                        {telemetryMetadata.average_hr ? `${telemetryMetadata.average_hr} BPM` : '--'}
                                                        {telemetryMetadata.max_hr ? ` (Pico ${telemetryMetadata.max_hr})` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {Array.isArray(telemetryMetadata.sessions) && telemetryMetadata.sessions.length > 0 && (
                                            <div className="space-y-1.5 pt-1 border-t border-tilo-border/60">
                                                <div className="text-[10px] font-bold text-tilo-text-muted uppercase">Sesiones Detectadas:</div>
                                                {telemetryMetadata.sessions.map((sess, sIdx) => (
                                                    <div key={sIdx} className="flex justify-between items-center bg-white/40 dark:bg-slate-800/40 px-2.5 py-1.5 rounded-md text-[11px] text-tilo-text-main">
                                                        <span className="font-semibold flex items-center gap-1">
                                                            <span>{sess.sport?.toLowerCase().includes('cicl') ? '🚴' : sess.sport?.toLowerCase().includes('nat') ? '🏊' : sess.sport?.toLowerCase().includes('run') || sess.sport?.toLowerCase().includes('carr') ? '🏃' : '🏋️'}</span>
                                                            {sess.sport || 'Entrenamiento'}
                                                        </span>
                                                        <span className="text-tilo-text-muted font-medium">
                                                            {sess.distanceMeters > 0 ? `${(sess.distanceMeters / 1000).toFixed(2)} km | ` : ''}
                                                            {sess.durationMinutes} min
                                                            {sess.calories > 0 ? ` | ${Math.round(sess.calories)} kcal` : ''}
                                                            {sess.averageHeartRate > 0 ? ` | FC ${sess.averageHeartRate} BPM` : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : exerciseLog.length > 0 ? (
                                    <div className="space-y-1 mt-2 pl-7">
                                        {exerciseLog.map((act, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-1 text-xs text-tilo-text-main">
                                                <span className="font-semibold">{capitalizeFirst(act.type)}</span>
                                                <span>{act.frequency}d/sem - {act.duration}min</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : exerciseLogF10.length > 0 ? (
                                    <div className="space-y-1 mt-2 pl-7">
                                        {exerciseLogF10.map((actStr, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-1 text-xs text-tilo-text-main font-semibold">
                                                <span>{capitalizeFirst(actStr)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    hasExercise && <div className="text-xs text-tilo-text-muted italic pl-7">Sin detalles de actividad</div>
                                )}
                            </div>

                            {/* 2. ACTIVIDAD DIARIA (NEAT) */}
                            <div className="border-b border-tilo-border pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="w-5 h-5 text-tilo-text-muted" />
                                        <div>
                                            <div className="text-sm font-bold text-tilo-text-main">Actividad Diaria (NEAT)</div>
                                            <div className="text-xs text-tilo-text-muted font-medium">
                                                {neatDesc}
                                            </div>
                                        </div>
                                    </div>
                                    <ProgressRing score={scores?.neat?.score} label={scores?.neat?.label} />
                                </div>
                            </div>

                            {/* 2. SUEÑO Y RITMO CIRCADIANO */}
                            <div className="border-b border-tilo-border pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <Moon className="w-5 h-5 text-tilo-text-muted" />
                                        <div>
                                            <div className="text-sm font-bold text-tilo-text-main">Sueño y Descanso</div>
                                            <div className="text-xs text-tilo-text-muted">
                                                {sleepHours > 0 ? `${sleepHours} horas/noche` : '--'}
                                            </div>
                                        </div>
                                    </div>
                                    <ProgressRing score={scores?.sleep?.score} label={scores?.sleep?.label} />
                                </div>
                                {/* Ghrelin Warning */}
                                {sleepHours > 0 && sleepHours < 6 && (
                                    <div className="mt-2 flex items-center gap-2 bg-tilo-primary/5 px-2 py-1 rounded text-[10px] text-tilo-primary border border-tilo-primary/20">
                                        <AlertCircle size={12} />
                                        <span>Riesgo Hormonal: Posible aumento de Grelina (Apetito).</span>
                                    </div>
                                )}
                                {patientData.lifestyle_profile?.sleep?.issue_type && patientData.lifestyle_profile?.sleep?.issue_type !== 'NONE' && (
                                    <div className="mt-1 pl-7 text-xs text-tilo-text-muted">
                                        Problema: <span className="font-medium text-tilo-text-main">{patientData.lifestyle_profile?.sleep?.issue_type}</span>
                                    </div>
                                )}
                            </div>

                            {/* 3. ESTRÉS Y CORTISOL */}
                            <div className="flex justify-between items-start pb-3 border-b border-tilo-border">
                                <div className="flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-tilo-text-muted" />
                                    <div>
                                        <div className="text-sm font-bold text-tilo-text-main font-prototype">Nivel de Estrés</div>
                                        {!(stressLevel === 'BAJO' && (!stressOrigin || stressOrigin === 'NONE' || stressOrigin === 'N/A')) && (
                                            <div className="text-xs text-tilo-text-muted font-medium">
                                                Origen: {!stressOrigin || stressOrigin === 'NONE' || stressOrigin === 'N/A' ? 'No refiere' : stressOrigin}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <ProgressRing score={scores?.stress?.score} label={scores?.stress?.label} />
                            </div>
                            {isCortisolAlert && (
                                <div className="mt-2 flex items-center gap-2 bg-tilo-danger/10 px-2 py-1 rounded text-[10px] text-tilo-danger border border-tilo-danger/20">
                                    <AlertTriangle size={12} />
                                    <span>Alerta Cortisol: Gestión de estrés prioritaria.</span>
                                </div>
                            )}
                        </div>
                    </Accordion>
                </div>
            </Accordion>
        </div>
    );
};

export default TabLogistics;
