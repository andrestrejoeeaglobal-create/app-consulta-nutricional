/* eslint-disable no-unused-vars */
import React from 'react';
import { Activity, AlertCircle, AlertTriangle, Dumbbell, Moon, Brain, Briefcase } from 'lucide-react';
import BiomarkerScoringEngine from '../../utils/BiomarkerScoringEngine';
import { resolveActiveExerciseTelemetry } from '../../utils/genderConcordance';

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
                <span className={`text-xs font-black tabular-nums ${textColor} leading-none`}>
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
    
    // Contexto Pediátrico / Lactante blindado (sin centinela "0" en adultos)
    const rawAgeCandidate =
        patientData?.profile?.age ??
        patientData?.identificacion?.edad ??
        patientData?.profile?.pediatric_profile?.age ??
        null;
    const parsedAge = (rawAgeCandidate !== null && rawAgeCandidate !== undefined && rawAgeCandidate !== "")
        ? parseInt(rawAgeCandidate, 10)
        : null;
    const babyMonths = patientData?.profile?.baby_age_months !== undefined ? patientData.profile.baby_age_months : (patientData?.identificacion?.baby_age_months !== undefined ? patientData.identificacion.baby_age_months : null);
    const isLactante = Boolean(
        patientData?.profile?.pediatric_profile?.is_lactante ||
        (babyMonths !== null && babyMonths < 24) ||
        (parsedAge !== null && !isNaN(parsedAge) && parsedAge > 0 && parsedAge < 2)
    );

    const neatMap = isLactante
        ? { SEDENTARY: 'Tranquilo', LIGHT: 'Gateo Inicial', MODERATE: 'Gateo Activo', HEAVY: 'Explorador' }
        : { SEDENTARY: 'Sedentario', LIGHT: 'Ligero', MODERATE: 'Moderado', HEAVY: 'Intenso' };

    const neatDescMap = isLactante
        ? {
            SEDENTARY: 'Tranquilo / Acostado la mayor parte del tiempo',
            LIGHT: 'Gateo inicial / Juego sentado',
            MODERATE: 'Gateo activo / Ya camina con apoyo',
            HEAVY: 'Explora activamente / Corre / Salta'
          }
        : {
            SEDENTARY: 'Jornada en escritorio o traslados mínimos',
            LIGHT: 'Caminatas breves o actividad de pie intermitente',
            MODERATE: 'Movimiento activo constante en jornada diaria',
            HEAVY: 'Actividad física ocupacional continua de alta demanda'
          };

    const neatLevelRaw = patientData.lifestyle_profile?.activity?.neat_level ||
                         patientData.clinical_context?.activity?.exercise?.neat_level;
    const isPreviewNeatPending = Boolean(
        patientData.lifestyle_profile?.activity?.preview_neat_pending ||
        patientData.clinical_context?.activity?.exercise?.preview_neat_pending
    );
    const neatLevel = neatLevelRaw ? (neatMap[neatLevelRaw] || neatLevelRaw) : 'Sin evaluar';
    const neatDesc = neatLevelRaw ? (neatDescMap[neatLevelRaw] || '--') : 'Sin evaluar';
    
    const canonicalSourceType =
        patientData.lifestyle_profile?.activity?.source_type ||
        patientData.clinical_context?.activity?.exercise?.source_type ||
        patientData.lifestyle?.activity?.source_type ||
        'MANUAL';
    const exerciseLog = canonicalSourceType === 'MANUAL'
        ? (patientData.lifestyle_profile?.activity?.log || [])
        : (patientData.lifestyle_profile?.activity?.log || patientData.lifestyle?.activity?.log || []);
    const exerciseLogF10 = patientData.clinical_context?.activity?.exercise?.log || [];
    const telemetryMetadata = resolveActiveExerciseTelemetry(patientData);

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
                                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2.5">
                                        <div className="font-bold text-[#1C75BC] dark:text-sky-400 flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-2">
                                            <span>⌚</span>
                                            <span className="text-[#0F172A] dark:text-[#F8FAFC]">
                                                {telemetryMetadata.device_name && telemetryMetadata.device_name !== 'Wearable Device'
                                                    ? telemetryMetadata.device_name
                                                    : 'Telemetría .TCX'}
                                            </span>
                                            {telemetryMetadata.preview_pending_confirm ? (
                                                <span className="ml-auto text-[10px] bg-[#FFCC00] text-[#0F172A] font-bold px-2 py-0.5 rounded-full border border-[#0F172A]/20 tabular-nums">
                                                    Vista previa • Por confirmar
                                                </span>
                                            ) : (
                                                <span className="ml-auto text-[10px] bg-[#3AAA35]/15 text-[#0F172A] dark:text-[#F8FAFC] font-bold px-2 py-0.5 rounded-full border border-[#3AAA35]/40 tabular-nums">
                                                    {telemetryMetadata.unique_days_count || telemetryMetadata.total_parsed_sessions || 1}{' '}
                                                    {(telemetryMetadata.unique_days_count || telemetryMetadata.total_parsed_sessions || 1) === 1 ? 'jornada' : 'jornadas'}
                                                    {telemetryMetadata.total_blocks_count > 1 ? ` • ${telemetryMetadata.total_blocks_count} bloques` : ''}
                                                    {telemetryMetadata.weekly_days ? ` • ${telemetryMetadata.weekly_days} d/sem` : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 py-1 text-[#0F172A] dark:text-[#F8FAFC]">
                                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <span className="text-base">🔥</span>
                                                <div>
                                                    <div className="text-[10px] text-[#334155] dark:text-[#CBD5E1] leading-none">Gasto Calórico</div>
                                                    <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 tabular-nums">
                                                        {(telemetryMetadata.daily_calories || telemetryMetadata.total_calories) ? `${Math.round(telemetryMetadata.daily_calories || telemetryMetadata.total_calories)} kcal/día` : '--'}
                                                    </div>
                                                    {telemetryMetadata.weekly_calories > 0 && (
                                                        <div className="text-[10px] font-semibold text-[#1C75BC] dark:text-sky-400 tabular-nums">
                                                            {Math.round(telemetryMetadata.weekly_calories)} kcal/sem
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <span className="text-base">⏱️</span>
                                                <div>
                                                    <div className="text-[10px] text-[#334155] dark:text-[#CBD5E1] leading-none">Tiempo Activo</div>
                                                    <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 tabular-nums">
                                                        {(telemetryMetadata.daily_minutes || telemetryMetadata.total_minutes) ? `${telemetryMetadata.daily_minutes || telemetryMetadata.total_minutes} min/día` : '--'}
                                                    </div>
                                                    {telemetryMetadata.weekly_minutes > 0 && (
                                                        <div className="text-[10px] font-semibold text-[#1C75BC] dark:text-sky-400 tabular-nums">
                                                            {telemetryMetadata.weekly_minutes} min/sem
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <span className="text-base">📏</span>
                                                <div>
                                                    <div className="text-[10px] text-[#334155] dark:text-[#CBD5E1] leading-none">Distancia</div>
                                                    <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 tabular-nums">
                                                        {telemetryMetadata.total_distance > 0
                                                            ? (telemetryMetadata.total_distance >= 1000
                                                                ? `${(Math.round(telemetryMetadata.total_distance / 10) / 100).toFixed(2)} km`
                                                                : `${Math.round(telemetryMetadata.total_distance)} m`)
                                                            : 'Indoor / Sin GPS'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <span className="text-base">❤️</span>
                                                <div>
                                                    <div className="text-[10px] text-[#334155] dark:text-[#CBD5E1] leading-none">FC Ponderada</div>
                                                    <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 tabular-nums">
                                                        {telemetryMetadata.average_hr ? `${telemetryMetadata.average_hr} BPM` : '--'}
                                                    </div>
                                                    {telemetryMetadata.max_hr > 0 && (
                                                        <div className="text-[10px] font-semibold text-[#334155] dark:text-[#CBD5E1] tabular-nums">
                                                            Pico {telemetryMetadata.max_hr} BPM
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {Array.isArray(telemetryMetadata.disciplines) && telemetryMetadata.disciplines.length > 0 ? (
                                            <div className="space-y-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                                                <div className="text-[10px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase">
                                                    Disciplinas Desglosadas{telemetryMetadata.dates_display?.[0] ? ` (${telemetryMetadata.dates_display[0]})` : ''}:
                                                </div>
                                                {telemetryMetadata.disciplines.map((disc, dIdx) => {
                                                    const lowerSp = String(disc.sport || '').toLowerCase();
                                                    const icon = lowerSp.includes('cicl') ? '🚴'
                                                        : lowerSp.includes('nat') ? '🏊'
                                                        : lowerSp.includes('caminadora') || lowerSp.includes('run') || lowerSp.includes('carr') || lowerSp.includes('elípt') || lowerSp.includes('elipt') ? '🏃'
                                                        : lowerSp.includes('caminat') ? '🚶'
                                                        : '🧘';
                                                    return (
                                                        <div key={dIdx} className="flex justify-between items-center bg-white dark:bg-slate-900/60 px-2.5 py-1.5 rounded-md border border-slate-200/80 dark:border-slate-700 text-[11px] text-[#0F172A] dark:text-[#F8FAFC]">
                                                            <span className="font-semibold flex items-center gap-1.5">
                                                                <span>{icon}</span>
                                                                <span>{disc.sport || 'Entrenamiento'}</span>
                                                                {disc.blocksCount > 1 && (
                                                                    <span className="text-[10px] text-[#334155] dark:text-[#CBD5E1] tabular-nums">({disc.blocksCount} bloques)</span>
                                                                )}
                                                            </span>
                                                            <span className="text-[#334155] dark:text-[#CBD5E1] font-medium tabular-nums">
                                                                {disc.distanceMeters > 0 ? `${(Math.round(disc.distanceMeters / 10) / 100).toFixed(2)} km | ` : ''}
                                                                {disc.durationMinutesExact || disc.durationMinutes} min
                                                                {disc.calories > 0 ? ` | ${Math.round(disc.calories)} kcal` : ''}
                                                                {disc.averageHeartRate > 0 ? ` | FC ${disc.averageHeartRate}` : ''}
                                                                {disc.maximumHeartRate > 0 ? `/${disc.maximumHeartRate} BPM` : (disc.averageHeartRate > 0 ? ' BPM' : '')}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : Array.isArray(telemetryMetadata.sessions) && telemetryMetadata.sessions.length > 0 && (
                                            <div className="space-y-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                                                <div className="text-[10px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase">Bloques Detectados:</div>
                                                {telemetryMetadata.sessions.map((sess, sIdx) => (
                                                    <div key={sIdx} className="flex justify-between items-center bg-white dark:bg-slate-900/60 px-2.5 py-1.5 rounded-md border border-slate-200/80 dark:border-slate-700 text-[11px] text-[#0F172A] dark:text-[#F8FAFC]">
                                                        <span className="font-semibold flex items-center gap-1">
                                                            <span>{sess.sport?.toLowerCase().includes('cicl') ? '🚴' : sess.sport?.toLowerCase().includes('nat') ? '🏊' : sess.sport?.toLowerCase().includes('run') || sess.sport?.toLowerCase().includes('carr') || sess.sport?.toLowerCase().includes('caminadora') || sess.sport?.toLowerCase().includes('elípt') ? '🏃' : '🏋️'}</span>
                                                            {sess.sport || 'Entrenamiento'}
                                                        </span>
                                                        <span className="text-[#334155] dark:text-[#CBD5E1] font-medium tabular-nums">
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
                                            <div className="text-sm font-bold text-tilo-text-main flex items-center gap-2">
                                                <span>Actividad Diaria (NEAT)</span>
                                                {isPreviewNeatPending && (
                                                    <span className="text-[10px] bg-[#FFCC00] text-[#0F172A] font-bold px-2 py-0.5 rounded-full border border-[#0F172A]/20">
                                                        Vista previa
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-tilo-text-muted font-medium">
                                                {neatDesc}
                                            </div>
                                        </div>
                                    </div>
                                    <ProgressRing
                                        score={isPreviewNeatPending ? null : scores?.neat?.score}
                                        label={isPreviewNeatPending ? "Por confirmar" : scores?.neat?.label}
                                    />
                                </div>
                            </div>

                            {/* 2. SUEÑO Y RITMO CIRCADIANO */}
                            <div className="border-b border-tilo-border pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <Moon className="w-5 h-5 text-tilo-text-muted" />
                                        <div>
                                            <div className="text-sm font-bold text-tilo-text-main">Sueño y Descanso</div>
                                            <div className="text-xs text-tilo-text-muted tabular-nums">
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
                                        <div className="text-sm font-bold text-tilo-text-main">Nivel de Estrés</div>
                                        {stressLevel === 'SIN DATO' ? (
                                            <div className="text-xs text-tilo-text-muted">Sin evaluar</div>
                                        ) : !(stressLevel === 'BAJO' && (!stressOrigin || stressOrigin === 'NONE' || stressOrigin === 'N/A')) ? (
                                            <div className="text-xs text-tilo-text-muted font-medium">
                                                Origen: {!stressOrigin || stressOrigin === 'NONE' || stressOrigin === 'N/A' ? 'No refiere' : stressOrigin}
                                            </div>
                                        ) : null}
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
