/* eslint-disable no-unused-vars */
import React from 'react';
import { User, Heart, Lock, Check, AlertTriangle } from 'lucide-react';

export const TabVitals = ({
    patientData,
    onTriggerEdit,
    CardHeader
}) => {
    const { peso, imc, imcEstado } = patientData?.vitals || {};

    const isVitalsCompleted = patientData?.vitals?.status === 'COMPLETED' || (
        patientData?.vitals?.blood_pressure?.systolic != null &&
        patientData?.vitals?.blood_pressure?.diastolic != null &&
        patientData?.vitals?.heart_rate != null &&
        patientData?.vitals?.respiratory_rate != null &&
        patientData?.vitals?.temperature != null &&
        patientData?.vitals?.spo2 != null
    );

    return (
        <div className="space-y-6 tabular-nums">

            {/* TARJETA J: BIOMETRÍA */}
            <div id="card-j" className="bg-white dark:bg-[#1E293B] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <CardHeader icon={User} title="Biometría General" colorClass="text-[#1C75BC] dark:text-[#3894E0]"
                    onEdit={() => onTriggerEdit && onTriggerEdit('biometrics')}
                    showEdit={true}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* PESO */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">Peso</label>
                        <div className="p-3 bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[50px] flex items-center justify-between">
                            <div className="flex items-baseline gap-1 tabular-nums">
                                <span className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">{patientData.vitals?.weight || peso || '--'}</span>
                                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-semibold">kg</span>
                            </div>
                        </div>
                    </div>

                    {/* TALLA */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">Estatura</label>
                        <div className="p-3 bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[50px] flex items-center justify-between">
                            <div className="flex items-baseline gap-1 tabular-nums">
                                <span className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">{patientData.vitals?.height || patientData.talla || '--'}</span>
                                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-semibold">cm</span>
                            </div>
                        </div>
                    </div>

                    {/* IMC */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">IMC</label>
                        <div className={`p-3 rounded-xl border shadow-sm min-h-[50px] flex flex-col justify-center ${patientData.vitals?.bmi > 25 ? 'bg-[#FFCC00]/25 border-[#FFCC00]' : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700'}`}>
                            <div className="flex items-baseline gap-2 tabular-nums">
                                <span className={`text-xl font-bold ${patientData.vitals?.bmi > 25 ? 'text-[#0F172A] dark:text-[#FFCC00]' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>{patientData.vitals?.bmi || imc || '--'}</span>
                                {(patientData.vitals?.bmi_class || imcEstado) && (
                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-[#F8FAFC] font-bold px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 uppercase">
                                        {patientData.vitals?.bmi_class || imcEstado}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CINTURA */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">Cintura</label>
                        <div className="p-3 bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[50px] flex items-center justify-between">
                            <div className="flex items-baseline gap-1 tabular-nums">
                                <span className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">{patientData.vitals?.waist || patientData.cintura || '--'}</span>
                                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-semibold">cm</span>
                            </div>
                        </div>
                    </div>

                    {/* CADERA */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">Cadera</label>
                        <div className="p-3 bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[50px] flex items-center justify-between">
                            <div className="flex items-baseline gap-1 tabular-nums">
                                <span className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">{patientData.vitals?.hip || patientData.cadera || '--'}</span>
                                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-semibold">cm</span>
                            </div>
                        </div>
                    </div>

                    {/* ICC / WHR */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">ICC (Cintura/Cadera)</label>
                        <div className={`p-3 rounded-xl border shadow-sm min-h-[50px] flex items-center justify-between ${patientData.vitals?.whr_risk === 'HIGH' ? 'bg-red-50 dark:bg-red-950/40 border-[#B70E0C]/40' : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700'}`}>
                            <div className="flex items-baseline gap-2 tabular-nums">
                                <span className={`text-xl font-bold ${patientData.vitals?.whr_risk === 'HIGH' ? 'text-[#B70E0C] dark:text-[#FCA5A5]' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>{patientData.vitals?.whr || patientData.icc || '--'}</span>
                                {patientData.vitals?.whr_risk === 'HIGH' && <AlertTriangle size={14} strokeWidth={2} className="text-[#B70E0C]" />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TARJETA K: SIGNOS VITALES MANUALES (Validación NOM-004) */}
            <div id="card-vitals" className="bg-white dark:bg-[#1E293B] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden transition-all duration-300">
                <CardHeader icon={Heart} title="Signos Vitales (Manual)" colorClass="text-[#B70E0C] dark:text-[#FCA5A5]"
                    onEdit={() => onTriggerEdit && onTriggerEdit('vitals')}
                />

                <div className="flex justify-between items-center mb-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${isVitalsCompleted ? 'bg-[#3AAA35]/10 text-[#166534] dark:text-[#86EFAC] border-[#3AAA35]/40' : 'bg-[#FFCC00] text-[#0F172A] border-[#0F172A]/20'}`}>
                        {isVitalsCompleted ? <Check size={12} strokeWidth={2} /> : <Lock size={12} strokeWidth={2} />}
                        {isVitalsCompleted ? 'COMPLETADO' : 'REQUERIDO'}
                    </span>
                    {patientData.vitals?.blood_pressure?.alert_level === 'CRISIS' && (
                        <span className="bg-[#B70E0C] text-white px-3 py-1 rounded-full text-[10px] font-bold motion-safe:animate-pulse">
                            ⛔ CRISIS HIPERTENSIVA
                        </span>
                    )}
                </div>

                <div className="space-y-4 relative z-10">
                    {/* LINE 1: TA */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">Tensión Arterial</label>
                        <div className={`p-3 rounded-xl border flex items-center justify-between tabular-nums ${patientData.vitals?.blood_pressure?.alert_level === 'ELEVATED' ? 'bg-[#FFCC00]/25 border-[#FFCC00]' : patientData.vitals?.blood_pressure?.alert_level === 'CRISIS' ? 'bg-red-50 dark:bg-red-950/40 border-[#B70E0C]/50' : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700'}`}>
                            <span className={`text-xl font-bold ${patientData.vitals?.blood_pressure?.alert_level === 'CRISIS' ? 'text-[#B70E0C] dark:text-[#FCA5A5]' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>
                                {patientData.vitals?.blood_pressure?.systolic || '--'}/{patientData.vitals?.blood_pressure?.diastolic || '--'}
                            </span>
                            <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-bold">mmHg</span>
                        </div>
                    </div>

                    {/* LINE 2: FC & FR */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">Frecuencia Cardíaca</label>
                            <div className="p-3 bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between tabular-nums">
                                <span className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">{patientData.vitals?.heart_rate || '--'}</span>
                                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-bold">LPM</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider leading-none">Frecuencia Respiratoria</label>
                            </div>
                            <div className="p-3 bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between tabular-nums">
                                <span className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">{patientData.vitals?.respiratory_rate || '--'}</span>
                                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-bold">RPM</span>
                            </div>
                        </div>
                    </div>

                    {/* LINE 3: TEMP, SPO2, GLUCOSE (Vista Clínica NOM-004) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">Temperatura</label>
                            <div className={`p-3 rounded-xl border flex items-center justify-between tabular-nums ${patientData.vitals?.temperature > 37.5 ? 'bg-[#FFCC00]/25 border-[#FFCC00]' : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700'}`}>
                                <span className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">{patientData.vitals?.temperature || '--'}</span>
                                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-bold">°C</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">SpO2</label>
                            <div className={`p-3 rounded-xl border flex items-center justify-between tabular-nums ${patientData.vitals?.spo2 > 0 && patientData.vitals?.spo2 < 90 ? 'bg-red-50 dark:bg-red-950/40 border-[#B70E0C]/50' : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700'}`}>
                                <span className={`text-xl font-bold ${patientData.vitals?.spo2 > 0 && patientData.vitals?.spo2 < 90 ? 'text-[#B70E0C] dark:text-[#FCA5A5]' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>{patientData.vitals?.spo2 || '--'}</span>
                                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-bold">%</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] tracking-wider mb-1">Glucemia Capilar (NOM-004)</label>
                            <div className={`p-3 rounded-xl border flex items-center justify-between tabular-nums ${(patientData.vitals?.glucose || patientData.biochemical?.glucose?.value) > 200 ? 'bg-red-50 dark:bg-red-950/40 border-[#B70E0C]/50' : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700'}`}>
                                <span className={`text-xl font-bold ${(patientData.vitals?.glucose || patientData.biochemical?.glucose?.value) > 200 ? 'text-[#B70E0C] dark:text-[#FCA5A5]' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>{patientData.vitals?.glucose || patientData.biochemical?.glucose?.value || '--'}</span>
                                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-bold">mg/dL</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
