import React, { useState } from 'react';
import { Activity, ShieldAlert, CheckCircle, AlertTriangle, Stethoscope, Zap, HeartPulse, Lock } from 'lucide-react';

export const TabDiagnosis = ({ patientData }) => {
    // === SAFETY ENGINE (Medical Override) ===
    const [overrideActive, setOverrideActive] = useState(false);

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
            {/* --- HEADER --- */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                            <Stethoscope className="w-8 h-8 text-blue-200" />
                            Diagnóstico Integral
                        </h2>
                        <p className="text-blue-100 mt-2 text-lg">Resumen Clínico y Arquitectura de Oro</p>
                    </div>
                </div>
            </div>

            {/* --- SAFETY ENGINE BANNER --- */}
            {isRiskDetected && !overrideActive && (
                <div
                    className="bg-red-50 border-l-4 border-red-500 p-6 rounded-xl shadow-sm flex items-start gap-4 transition-all"
                >
                    <ShieldAlert className="w-8 h-8 text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="text-red-800 font-bold text-lg">ALERTA DE SEGURIDAD CLÍNICA</h3>
                        <p className="text-red-700 text-sm mt-1">
                            El sistema ha detectado riesgos potenciales basados en el historial del paciente
                            ({hasAllergies ? 'Alergias registradas' : ''}{hasAllergies && hasPhentermine ? ' y ' : ''}{hasPhentermine ? 'Fentermina detectada' : ''}).
                            La prescripción de suplementación avanzada está bloqueada por seguridad.
                        </p>
                    </div>
                    <button
                        onClick={() => setOverrideActive(true)}
                        className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-200 transition-colors border border-red-200"
                    >
                        Medical Override
                    </button>
                </div>
            )}

            {overrideActive && (
                <div
                    className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between transition-all"
                >
                    <div className="flex items-center gap-2 text-amber-800 font-medium">
                        <AlertTriangle className="w-5 h-5" />
                        <span>Override Médico Activado. Riesgos asumidos por el especialista.</span>
                    </div>
                    <button
                        onClick={() => setOverrideActive(false)}
                        className="text-amber-600 hover:text-amber-800 text-sm font-bold underline"
                    >
                        Restaurar Bloqueos
                    </button>
                </div>
            )}

            {/* --- ABCD CLINICAL SUMMARY BLOCKS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* A: Antropometría */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        A. Antropometría
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                            <span className="text-sm font-medium text-slate-500">IMC</span>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded ${patientData?.imcEstado === 'Normal' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {patientData?.imc || '--'} ({patientData?.imcEstado || '--'})
                            </span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                            <span className="text-sm font-medium text-slate-500">Peso / Talla</span>
                            <span className="text-sm font-bold text-slate-700">{patientData?.peso || '--'} kg / {patientData?.talla || '--'} m</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-500">ICC</span>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded ${patientData?.iccRiesgo === 'Sin Riesgo' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                                {patientData?.icc || '--'} ({patientData?.iccRiesgo || '--'})
                            </span>
                        </div>
                    </div>
                </div>

                {/* B: Bioquímica / Vitales */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                        B. Bioquímicos / Vitales
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                            <span className="text-sm font-medium text-slate-500">Presión Arterial</span>
                            <span className="text-sm font-bold text-slate-700">{patientData?.signosVitales?.ta || '--'} mmHg</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                            <span className="text-sm font-medium text-slate-500">Glucosa Ayuno</span>
                            <span className="text-sm font-bold text-slate-700">{patientData?.signosVitales?.glucosa || '--'} mg/dL</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-500">SpO2 / FC</span>
                            <span className="text-sm font-bold text-slate-700">{patientData?.signosVitales?.spo2 || '--'}% / {patientData?.signosVitales?.fc || '--'} bpm</span>
                        </div>
                    </div>
                </div>

                {/* C: Clínica */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        C. Clínica
                    </h3>
                    <div className="space-y-3">
                        <div className="flex flex-col pb-2 border-b border-slate-50">
                            <span className="text-xs font-medium text-slate-500 mb-1">Patologías (APP)</span>
                            <span className="text-sm font-bold text-slate-700 truncate">{patientData?.clinica?.app_lista || 'Negados'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-500 mb-1">Alergias</span>
                            <span className={`text-sm font-bold truncate ${hasAllergies ? 'text-red-600' : 'text-slate-700'}`}>
                                {hasAllergies ? allergies.map(a => a.agent).join(', ') : 'Negadas'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* D: Dietética */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        D. Dietética
                    </h3>
                    <div className="space-y-3">
                        <div className="flex flex-col pb-2 border-b border-slate-50">
                            <span className="text-xs font-medium text-slate-500 mb-1">Aversiones</span>
                            <span className="text-sm font-bold text-slate-700 truncate">{patientData?.evaluacionDietetica?.preferencias?.aversiones || '--'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-500 mb-1">Logística</span>
                            <span className="text-sm font-bold text-slate-700 truncate">{patientData?.nutrition?.cook_type || '--'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ARQUITECTURA DE ORO (HERO CARD) --- */}
            <div className={`mt-8 bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 transition-all duration-500 relative ${isRiskDetected && !overrideActive ? 'grayscale opacity-60 pointer-events-none' : ''}`}>

                {/* Overlay Bloqueo (Solo visual para ilustrar que los botones internos estarían inactivos) */}
                {isRiskDetected && !overrideActive && (
                    <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-sm z-20 flex items-center justify-center">
                        <Lock className="w-12 h-12 text-slate-400 opacity-50" />
                    </div>
                )}

                <div className="bg-amber-50 border-b border-amber-100 p-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-amber-800 font-bold text-xl flex items-center gap-2">
                            <Zap className="w-6 h-6 text-amber-500" />
                            Arquitectura de Oro Recomendada
                        </h3>
                        <p className="text-amber-700 text-sm mt-1 opacity-80">Suplementación de alto impacto sugerida por Bio-Arquitecto</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 p-8 gap-8">
                    {/* 33 Plus */}
                    <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
                        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <HeartPulse className="w-10 h-10" />
                        </div>
                        <h4 className="text-2xl font-black text-slate-800 tracking-tight">33 PLUS</h4>
                        <p className="text-blue-600 font-bold text-sm tracking-widest uppercase mt-1 mb-4">Ignición Mitocondrial</p>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">
                            Optimización de la cadena respiratoria celular, reducción de fatiga crónica y mejora en la sensibilidad a la insulina.
                        </p>
                        <button className="mt-auto px-6 py-2 bg-slate-800 text-white rounded-full text-sm font-bold hover:bg-slate-900 transition-colors w-full">
                            Agregar al Plan
                        </button>
                    </div>

                    {/* 34 Plus */}
                    <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <Activity className="w-10 h-10" />
                        </div>
                        <h4 className="text-2xl font-black text-slate-800 tracking-tight">34 PLUS</h4>
                        <p className="text-emerald-600 font-bold text-sm tracking-widest uppercase mt-1 mb-4">Ingeniería Tisular</p>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">
                            Regeneración de matriz extracelular, fortalecimiento articular y optimización de síntesis proteica post-ejercicio.
                        </p>
                        <button className="mt-auto px-6 py-2 bg-slate-800 text-white rounded-full text-sm font-bold hover:bg-slate-900 transition-colors w-full">
                            Agregar al Plan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TabDiagnosis;
