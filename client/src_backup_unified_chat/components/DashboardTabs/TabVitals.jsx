/* eslint-disable no-unused-vars */
import React from 'react';
import { User, Heart, Lock, Check, AlertTriangle } from 'lucide-react';

export const TabVitals = ({
    patientData,
    onTriggerEdit,
    CardHeader
}) => {
    // Safe access
    const { peso, imc, imcEstado } = patientData?.vitals || {};

    return (
        <div className="space-y-6">

            {/* TARJETA J: BIOMETRÍA (Chat / Auto) */}
            <div id="card-j" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <CardHeader icon={User} title="Biometría General" colorClass="text-blue-500"
                    onEdit={() => onTriggerEdit && onTriggerEdit('biometrics')}
                    showEdit={true}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* PESO */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Peso</label>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[50px] flex items-center justify-between">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-slate-700">{patientData.vitals?.weight || peso || '--'}</span>
                                <span className="text-xs text-slate-500 font-medium">kg</span>
                            </div>
                        </div>
                    </div>

                    {/* TALLA */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Estatura</label>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[50px] flex items-center justify-between">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-slate-700">{patientData.vitals?.height || patientData.talla || '--'}</span>
                                <span className="text-xs text-slate-500 font-medium">cm</span>
                            </div>
                        </div>
                    </div>

                    {/* IMC */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">IMC</label>
                        <div className={`p-3 rounded-xl border shadow-sm min-h-[50px] flex flex-col justify-center ${patientData.vitals?.bmi > 25 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-xl font-bold ${patientData.vitals?.bmi > 25 ? 'text-orange-700' : 'text-slate-700'}`}>{patientData.vitals?.bmi || imc || '--'}</span>
                                {(patientData.vitals?.bmi_class || imcEstado) && (
                                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                                        {patientData.vitals?.bmi_class || imcEstado}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CINTURA */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Cintura</label>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[50px] flex items-center justify-between">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-slate-700">{patientData.vitals?.waist || patientData.cintura || '--'}</span>
                                <span className="text-xs text-slate-500 font-medium">cm</span>
                            </div>
                        </div>
                    </div>

                    {/* CADERA */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Cadera</label>
                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[50px] flex items-center justify-between">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-slate-700">{patientData.vitals?.hip || patientData.cadera || '--'}</span>
                                <span className="text-xs text-slate-500 font-medium">cm</span>
                            </div>
                        </div>
                    </div>

                    {/* ICC / WHR */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">ICC (Cintura/Cadera)</label>
                        <div className={`p-3 rounded-xl border shadow-sm min-h-[50px] flex items-center justify-between ${patientData.vitals?.whr_risk === 'HIGH' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-xl font-bold ${patientData.vitals?.whr_risk === 'HIGH' ? 'text-red-700' : 'text-slate-700'}`}>{patientData.vitals?.whr || patientData.icc || '--'}</span>
                                {patientData.vitals?.whr_risk === 'HIGH' && <AlertTriangle size={14} className="text-red-500" />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TARJETA K: SIGNOS VITALES MANUALES (Validación NOM-004) */}
            <div id="card-vitals" className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden transition-all duration-300">
                <CardHeader icon={Heart} title="Signos Vitales (Manual)" colorClass="text-rose-500"
                    onEdit={() => onTriggerEdit && onTriggerEdit('vitals')}
                />

                <div className="flex justify-between items-center mb-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${patientData.vitals?.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        {patientData.vitals?.status === 'COMPLETED' ? <Check size={10} /> : <Lock size={10} />}
                        {patientData.vitals?.status === 'COMPLETED' ? 'COMPLETADO' : 'REQUERIDO'}
                    </span>
                    {patientData.vitals?.blood_pressure?.alert_level === 'CRISIS' && (
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-bold animate-pulse">
                            ⛔ CRISIS HIPERTENSIVA
                        </span>
                    )}
                </div>

                <div className="space-y-4 relative z-10">
                    {/* LINE 1: TA */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Tensión Arterial</label>
                        <div className={`p-3 rounded-xl border flex items-center justify-between ${patientData.vitals?.blood_pressure?.alert_level === 'ELEVATED' ? 'bg-orange-50 border-orange-200' : patientData.vitals?.blood_pressure?.alert_level === 'CRISIS' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                            <span className={`text-xl font-bold ${patientData.vitals?.blood_pressure?.alert_level === 'CRISIS' ? 'text-red-700' : 'text-slate-700'}`}>
                                {patientData.vitals?.blood_pressure?.systolic || '--'}/{patientData.vitals?.blood_pressure?.diastolic || '--'}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">mmHg</span>
                        </div>
                    </div>

                    {/* LINE 2: FC & FR (TIMER) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Frecuencia Cardíaca</label>
                            <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                                <span className="text-xl font-bold text-slate-700">{patientData.vitals?.heart_rate || '--'}</span>
                                <span className="text-xs text-slate-400 font-bold">LPM</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Frecuencia Respiratoria</label>
                                <button
                                    onClick={() => {
                                        const btn = document.getElementById('rr-timer-btn');
                                        if (btn.innerText.includes('Inicia')) {
                                            let left = 30;
                                            btn.innerText = `⏱️ ${left}s`;
                                            btn.classList.add('bg-rose-100', 'text-rose-700');
                                            const interval = setInterval(() => {
                                                left--;
                                                btn.innerText = `⏱️ ${left}s`;
                                                if (left <= 0) {
                                                    clearInterval(interval);
                                                    btn.innerText = "🔔 TIEMPO";
                                                    btn.classList.remove('bg-rose-100');
                                                    btn.classList.add('bg-emerald-100', 'text-emerald-700');
                                                    // Vibrate if supported
                                                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                                                    setTimeout(() => { btn.innerText = "⏱️ Iniciar 30s"; btn.className = "text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-200 transition-colors"; }, 5000);
                                                }
                                            }, 1000);
                                        }
                                    }}
                                    id="rr-timer-btn"
                                    className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-200 transition-colors"
                                >
                                    ⏱️ Iniciar 30s
                                </button>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                                <span className="text-xl font-bold text-slate-700">{patientData.vitals?.respiratory_rate || '--'}</span>
                                <span className="text-xs text-slate-400 font-bold">RPM</span>
                            </div>
                        </div>
                    </div>

                    {/* LINE 3: TEMP, SPO2, GLUCOSE */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Temperatura</label>
                            <div className={`p-3 rounded-xl border flex items-center justify-between ${patientData.vitals?.temperature > 37.5 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                                <span className={`text-xl font-bold ${patientData.vitals?.temperature > 37.5 ? 'text-orange-700' : 'text-slate-700'}`}>{patientData.vitals?.temperature || '--'}</span>
                                <span className="text-xs text-slate-400 font-bold">°C</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">SpO2</label>
                            <div className={`p-3 rounded-xl border flex items-center justify-between ${patientData.vitals?.spo2 > 0 && patientData.vitals?.spo2 < 90 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                                <span className={`text-xl font-bold ${patientData.vitals?.spo2 > 0 && patientData.vitals?.spo2 < 90 ? 'text-red-700' : 'text-slate-700'}`}>{patientData.vitals?.spo2 || '--'}</span>
                                <span className="text-xs text-slate-400 font-bold">%</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Glucosa</label>
                            <div className={`p-3 rounded-xl border flex items-center justify-between ${patientData.biochemical?.glucose?.value > 200 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                                <span className={`text-xl font-bold ${patientData.biochemical?.glucose?.value > 200 ? 'text-red-700' : 'text-slate-700'}`}>{patientData.biochemical?.glucose?.value || '--'}</span>
                                <span className="text-xs text-slate-400 font-bold">mg/dL</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BG Decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-50 z-0"></div>
            </div>
        </div>
    );
};

export default TabVitals;
