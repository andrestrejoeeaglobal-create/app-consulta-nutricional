import React, { useState } from 'react';
import { Activity, ShieldAlert, AlertTriangle, Zap, HeartPulse, Lock } from 'lucide-react';
import TabNotes from './TabNotes';
import TabIntervention from './TabIntervention';

export const TabDiagnosis = ({
    patientData,
    setPatientData,
    isEditing,
    onTabChange,
    Accordion,
    openSections,
    toggleSection
}) => {
    // === SAFETY ENGINE (Medical Override) ===
    const [overrideActive, setOverrideActive] = useState(
        patientData?.nutrition?.preferences?.safety_lock?.override_applied || false
    );

    const handleOverrideToggle = (active) => {
        setOverrideActive(active);
        if (setPatientData) {
            setPatientData(prev => {
                const nutrition = prev.nutrition || {};
                const prefs = nutrition.preferences || {};
                const safety = prefs.safety_lock || {};
                return {
                    ...prev,
                    nutrition: {
                        ...nutrition,
                        preferences: {
                            ...prefs,
                            safety_lock: {
                                ...safety,
                                override_applied: active
                            }
                        }
                    }
                };
            });
        }
    };

    const is33Added = patientData?.advanced_supplementation?.some(s => s.name === '33 PLUS');
    const is34Added = patientData?.advanced_supplementation?.some(s => s.name === '34 PLUS');

    const handleToggle33 = () => {
        if (!setPatientData) return;
        setPatientData(prev => {
            const list = prev.advanced_supplementation || [];
            const exists = list.some(s => s.name === '33 PLUS');
            const newList = exists
                ? list.filter(s => s.name !== '33 PLUS')
                : [...list, {
                    id: '33plus',
                    cortex: '33Plus (Neuro-cognitivo)',
                    name: '33 PLUS',
                    dosage: '1 toma al día',
                    timing: 'Con el desayuno (09:00 AM)',
                    rationale: 'Optimización de la cadena respiratoria celular, reducción de fatiga crónica y mejora en la sensibilidad a la insulina.',
                    status: 'approved'
                }];
            return {
                ...prev,
                advanced_supplementation: newList
            };
        });
    };

    const handleToggle34 = () => {
        if (!setPatientData) return;
        setPatientData(prev => {
            const list = prev.advanced_supplementation || [];
            const exists = list.some(s => s.name === '34 PLUS');
            const newList = exists
                ? list.filter(s => s.name !== '34 PLUS')
                : [...list, {
                    id: '34plus',
                    cortex: '34Plus (Metabólico)',
                    name: '34 PLUS',
                    dosage: '1 toma al día',
                    timing: 'Con la cena (08:30 PM)',
                    rationale: 'Regeneración de matriz extracelular, fortalecimiento articular y optimización de síntesis proteica post-ejercicio.',
                    status: 'approved'
                }];
            return {
                ...prev,
                advanced_supplementation: newList
            };
        });
    };

    // 1. Scan for Allergies
    const allergies = [...(patientData?.history?.allergies?.food || []), ...(patientData?.history?.allergies?.drug || [])];
    const hasAllergies = allergies.length > 0;

    // 2. Scan for specific medications (e.g., Fentermina, SSRIs)
    const medications = patientData?.history?.medications || [];
    const hasPhentermine = medications.some(m => m.name.toUpperCase().includes("FENTER") || m.name.toUpperCase().includes("ACXION") || m.name.toUpperCase().includes("TERFAMEX"));

    // 3. Risk Detected Boolean
    const isRiskDetected = hasAllergies || hasPhentermine;

    return (
        <div className="space-y-6 font-sans">
            {/* --- ACORDEÓN PADRE: DIAGNÓSTICO INTEGRAL --- */}
            <Accordion
                title="Diagnóstico Integral"
                id="accordion-diagnosis-parent"
                isOpen={openSections.parentDiagnosis}
                onToggle={() => toggleSection('parentDiagnosis')}
                variant="parent"
            >
                <div className="space-y-6">
                    {/* --- SAFETY ENGINE BANNER --- */}
                    {isRiskDetected && !overrideActive && (
                        <div className="bg-tilo-danger/10 border-l-4 border-tilo-danger p-6 rounded-xl flex items-start gap-4 transition-all animate-in zoom-in-95 duration-300">
                            <ShieldAlert className="w-8 h-8 text-tilo-danger flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="text-tilo-danger font-extrabold text-base uppercase tracking-wider">Alerta de Seguridad Clínica</h3>
                                <p className="text-tilo-text-main text-xs mt-1 leading-relaxed">
                                    El sistema ha detectado riesgos potenciales basados en el historial del paciente 
                                    ({hasAllergies ? 'Alergias registradas' : ''}{hasAllergies && hasPhentermine ? ' y ' : ''}{hasPhentermine ? 'Fentermina detectada' : ''}).
                                    La prescripción de suplementación avanzada está bloqueada por seguridad.
                                </p>
                            </div>
                            <button
                                onClick={() => handleOverrideToggle(true)}
                                className="bg-tilo-danger text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-tilo-danger/80 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                            >
                                Autorización Clínica
                            </button>
                        </div>
                    )}

                    {overrideActive && (
                        <div className="bg-tilo-warning/10 border border-tilo-warning/30 p-4 rounded-xl flex items-center justify-between transition-all animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-2 text-tilo-warning font-medium">
                                <AlertTriangle className="w-5 h-5 text-tilo-warning" />
                                <span className="text-tilo-text-main text-xs">Override Médico Activado. Riesgos asumidos por el especialista.</span>
                            </div>
                            <button
                                onClick={() => handleOverrideToggle(false)}
                                className="text-tilo-warning hover:text-tilo-warning/80 text-xs font-bold underline cursor-pointer"
                            >
                                Restaurar Seguridad
                            </button>
                        </div>
                    )}

                    {/* --- CHILD ACCORDION 1: RESUMEN CLÍNICO (ABCD) --- */}
                    <Accordion
                        title="Resumen Clínico (ABCD)"
                        id="accordion-diagnosis-abcd"
                        isOpen={openSections.childDiagnosisAbcd}
                        onToggle={() => toggleSection('childDiagnosisAbcd')}
                    >
                        <div id="card-diagnosis" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* A: Antropometría */}
                            <div className="bg-tilo-bg-base/40 p-5 rounded-2xl border border-tilo-border">
                                <h3 className="text-tilo-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-tilo-primary"></span>
                                    A. Antropometría
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center pb-2 border-b border-tilo-border/60">
                                        <span className="text-xs font-medium text-tilo-text-muted">IMC</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${patientData?.imcEstado === 'Normal' ? 'bg-tilo-success/10 text-tilo-success' : 'bg-tilo-danger/10 text-tilo-danger'}`}>
                                            {patientData?.imc || '--'} ({patientData?.imcEstado || '--'})
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-tilo-border/60">
                                        <span className="text-xs font-medium text-tilo-text-muted">Peso / Talla</span>
                                        <span className="text-xs font-bold text-tilo-text-main">{patientData?.peso || '--'} kg / {patientData?.talla || '--'} m</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-tilo-text-muted">ICC</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${patientData?.iccRiesgo === 'Sin Riesgo' ? 'bg-tilo-success/10 text-tilo-success' : 'bg-tilo-warning/10 text-tilo-warning'}`}>
                                            {patientData?.icc || '--'} ({patientData?.iccRiesgo || '--'})
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* B: Bioquímicos / Vitales */}
                            <div className="bg-tilo-bg-base/40 p-5 rounded-2xl border border-tilo-border">
                                <h3 className="text-tilo-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-tilo-danger"></span>
                                    B. Bioquímicos / Vitales
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center pb-2 border-b border-tilo-border/60">
                                        <span className="text-xs font-medium text-tilo-text-muted">Presión Arterial</span>
                                        <span className="text-xs font-bold text-tilo-text-main">{patientData?.signosVitales?.ta || '--'} mmHg</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-tilo-border/60">
                                        <span className="text-xs font-medium text-tilo-text-muted">Glucosa Ayuno</span>
                                        <span className="text-xs font-bold text-tilo-text-main">{patientData?.signosVitales?.glucosa || '--'} mg/dL</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-tilo-text-muted">SpO2 / FC</span>
                                        <span className="text-xs font-bold text-tilo-text-main">{patientData?.signosVitales?.spo2 || '--'}% / {patientData?.signosVitales?.fc || '--'} bpm</span>
                                    </div>
                                </div>
                            </div>

                            {/* C: Clínica */}
                            <div className="bg-tilo-bg-base/40 p-5 rounded-2xl border border-tilo-border">
                                <h3 className="text-tilo-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-tilo-warning"></span>
                                    C. Clínica
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex flex-col pb-2 border-b border-tilo-border/60">
                                        <span className="text-[10px] font-medium text-tilo-text-muted mb-1">Patologías (APP)</span>
                                        <span className="text-xs font-bold text-tilo-text-main truncate" title={patientData?.clinica?.app_lista || 'Negados'}>
                                            {patientData?.clinica?.app_lista || 'Negados'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-medium text-tilo-text-muted mb-1">Alergias</span>
                                        <span className={`text-xs font-bold truncate ${hasAllergies ? 'text-tilo-danger font-extrabold' : 'text-tilo-text-main'}`} title={hasAllergies ? allergies.map(a => a.agent).join(', ') : 'Negadas'}>
                                            {hasAllergies ? allergies.map(a => a.agent).join(', ') : 'Negadas'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* D: Dietética */}
                            <div className="bg-tilo-bg-base/40 p-5 rounded-2xl border border-tilo-border">
                                <h3 className="text-tilo-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-tilo-success"></span>
                                    D. Dietética
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex flex-col pb-2 border-b border-tilo-border/60">
                                        <span className="text-[10px] font-medium text-tilo-text-muted mb-1">Aversiones</span>
                                        <span className="text-xs font-bold text-tilo-text-main truncate" title={patientData?.evaluacionDietetica?.preferencias?.aversiones || '--'}>
                                            {patientData?.evaluacionDietetica?.preferencias?.aversiones || '--'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-medium text-tilo-text-muted mb-1">Logística</span>
                                        <span className="text-xs font-bold text-tilo-text-main truncate" title={patientData?.nutrition?.cook_type || '--'}>
                                            {patientData?.nutrition?.cook_type || '--'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 2: ARQUITECTURA DE ORO RECOMENDADA --- */}
                    <Accordion
                        title="Arquitectura de Oro Recomendada"
                        id="accordion-gold-architecture"
                        isOpen={openSections.childGoldArchitecture}
                        onToggle={() => toggleSection('childGoldArchitecture')}
                    >
                        <div id="card-gold-architecture" className="relative p-1">
                            {/* Overlay Bloqueo (Solo visual) */}
                            {isRiskDetected && !overrideActive && (
                                <div className="absolute inset-0 bg-tilo-bg-base/60 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
                                    <Lock className="w-12 h-12 text-tilo-text-muted opacity-50 animate-pulse" />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* 33 Plus */}
                                <div className="flex flex-col items-center text-center p-6 bg-tilo-bg-base/40 rounded-2xl border border-tilo-border hover:shadow-md transition-shadow">
                                    <div className="w-20 h-20 bg-tilo-primary/10 text-tilo-primary rounded-full flex items-center justify-center mb-4 shadow-inner">
                                        <HeartPulse className="w-10 h-10 text-tilo-primary" />
                                    </div>
                                    <h4 className="text-2xl font-black text-tilo-text-main tracking-tight">33 PLUS</h4>
                                    <p className="text-tilo-primary font-bold text-xs tracking-widest uppercase mt-1 mb-4">Ignición Mitocondrial</p>
                                    <p className="text-tilo-text-muted text-xs leading-relaxed mb-6">
                                        Optimización de la cadena respiratoria celular, reducción de fatiga crónica y mejora en la sensibilidad a la insulina.
                                    </p>
                                    <button
                                        onClick={handleToggle33}
                                        className={`mt-auto px-6 py-2.5 rounded-full text-xs font-bold transition-all w-full cursor-pointer shadow-sm ${
                                            is33Added
                                                ? 'bg-tilo-success hover:bg-tilo-success/80 text-white shadow-tilo-success/20'
                                                : 'bg-tilo-primary hover:bg-tilo-primary/80 text-white shadow-tilo-primary/20'
                                        }`}
                                    >
                                        {is33Added ? '✓ Agregado al Plan' : 'Agregar al Plan'}
                                    </button>
                                </div>

                                {/* 34 Plus */}
                                <div className="flex flex-col items-center text-center p-6 bg-tilo-bg-base/40 rounded-2xl border border-tilo-border hover:shadow-md transition-shadow">
                                    <div className="w-20 h-20 bg-tilo-success/10 text-tilo-success rounded-full flex items-center justify-center mb-4 shadow-inner">
                                        <Activity className="w-10 h-10 text-tilo-success" />
                                    </div>
                                    <h4 className="text-2xl font-black text-tilo-text-main tracking-tight">34 PLUS</h4>
                                    <p className="text-tilo-success font-bold text-xs tracking-widest uppercase mt-1 mb-4">Ingeniería Tisular</p>
                                    <p className="text-tilo-text-muted text-xs leading-relaxed mb-6">
                                        Regeneración de matriz extracelular, fortalecimiento articular y optimización de síntesis proteica post-ejercicio.
                                    </p>
                                    <button
                                        onClick={handleToggle34}
                                        className={`mt-auto px-6 py-2.5 rounded-full text-xs font-bold transition-all w-full cursor-pointer shadow-sm ${
                                            is34Added
                                                ? 'bg-tilo-success hover:bg-tilo-success/80 text-white shadow-tilo-success/20'
                                                : 'bg-tilo-primary hover:bg-tilo-primary/80 text-white shadow-tilo-primary/20'
                                        }`}
                                    >
                                        {is34Added ? '✓ Agregado al Plan' : 'Agregar al Plan'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 3: NOTAS DE EVOLUCIÓN (SOAP) --- */}
                    <TabNotes
                        patientData={patientData}
                        setPatientData={setPatientData}
                        isEditing={isEditing}
                        Accordion={Accordion}
                        openSections={openSections}
                        toggleSection={toggleSection}
                    />

                    {/* --- CHILD ACCORDION 4: PLAN DE INTERVENCIÓN --- */}
                    <TabIntervention
                        patientData={patientData}
                        setPatientData={setPatientData}
                        isEditing={isEditing}
                        Accordion={Accordion}
                        openSections={openSections}
                        toggleSection={toggleSection}
                    />
                </div>
            </Accordion>

            {/* BOTÓN DE AVANCE (Calendario) */}
            <div className="flex justify-end pt-4 border-t border-tilo-border mt-8">
                <button
                    onClick={() => onTabChange && onTabChange('schedule')}
                    className="flex justify-center items-center gap-2 px-8 py-4 bg-tilo-primary hover:bg-tilo-primary/80 text-white rounded-2xl font-black tracking-wide text-xs transition-all duration-300 w-full sm:w-auto shadow-lg shadow-tilo-primary/10 hover:shadow-tilo-primary/30 hover:-translate-y-0.5 cursor-pointer"
                >
                    <span>Continuar a Calendario & Sprint</span>
                    <span className="text-lg">➔</span>
                </button>
            </div>
        </div>
    );
};

export default TabDiagnosis;
