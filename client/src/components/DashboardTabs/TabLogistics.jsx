/* eslint-disable no-unused-vars */
import React from 'react';
import { Activity, AlertCircle, AlertTriangle, Dumbbell, Moon, Brain, Briefcase } from 'lucide-react';

const capitalizeFirst = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
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
    
    const exerciseLog = patientData.lifestyle_profile?.activity?.log || [];
    const exerciseLogF10 = patientData.clinical_context?.activity?.exercise?.log || [];

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
                                    {!hasLifestyle ? (
                                        <span className="bg-tilo-text-muted/10 text-tilo-text-muted text-[10px] px-2 py-0.5 rounded font-bold border border-tilo-text-muted/20">SIN EVALUAR</span>
                                    ) : hasExercise ? (
                                        <span className="bg-tilo-success/10 text-tilo-success text-[10px] px-2 py-0.5 rounded font-bold border border-tilo-success/20">EJERCITANTE</span>
                                    ) : (
                                        <span className="bg-tilo-text-muted/10 text-tilo-text-muted text-[10px] px-2 py-0.5 rounded font-bold border border-tilo-text-muted/20">SEDENTARIO</span>
                                    )}
                                </div>

                                {/* Activity Log */}
                                {exerciseLog.length > 0 ? (
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
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                        neatLevelRaw === 'LIGHT' ? 'bg-tilo-success/10 text-tilo-success border-tilo-success/20' :
                                        neatLevelRaw === 'MODERATE' ? 'bg-tilo-primary/10 text-tilo-primary border-tilo-primary/20' :
                                        neatLevelRaw === 'HEAVY' ? 'bg-tilo-danger/10 text-tilo-danger border-tilo-danger/20' :
                                        neatLevelRaw === 'SEDENTARY' ? 'bg-tilo-text-muted/10 text-tilo-text-muted border-tilo-text-muted/20' :
                                        'bg-tilo-text-muted/10 text-tilo-text-muted border-tilo-text-muted/20'
                                    }`}>
                                        {neatLevelRaw ? (neatMap[neatLevelRaw]?.toUpperCase() || neatLevelRaw.toUpperCase()) : 'SIN EVALUAR'}
                                    </span>
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
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${sleepQuality === 'GOOD' ? 'bg-tilo-primary/10 text-tilo-primary border-tilo-primary/20' :
                                        sleepQuality === 'POOR' ? 'bg-tilo-danger/10 text-tilo-danger border-tilo-danger/20' :
                                        sleepQuality === 'REGULAR' ? 'bg-tilo-primary/5 text-tilo-primary/80 border-tilo-primary/10' :
                                        'bg-tilo-text-muted/10 text-tilo-text-muted border-tilo-text-muted/20'
                                        }`}>
                                        {sleepQuality === 'GOOD' ? 'CALIDAD BUENA' :
                                            sleepQuality === 'POOR' ? 'MALA CALIDAD' : sleepQuality === 'REGULAR' ? 'REGULAR' : 'SIN DATO'}
                                    </span>
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
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${stressLevel === 'BAJO' ? 'bg-tilo-success/10 text-tilo-success border-tilo-success/20' :
                                    stressLevel === 'ALTO' ? 'bg-tilo-danger/10 text-tilo-danger border-tilo-danger/20' :
                                    'bg-tilo-primary/10 text-tilo-primary border-tilo-primary/20'
                                    }`}>
                                    {stressLevel}
                                </span>
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
