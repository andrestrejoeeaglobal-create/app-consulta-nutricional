import React, { useState } from 'react';
import { ShieldAlert, HeartPulse, Bone, Clock, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Activity, Dna, FileSpreadsheet, Zap } from 'lucide-react';

export const TabRecommendations = ({ patientData, isEditing, setPatientData }) => {
    const [activeTimelinePhase, setActiveTimelinePhase] = useState(1);

    const activePatientName = patientData?.profile?.name || patientData?.identificacion?.nombre || 'Agustín Martínez Reyes';
    const activePatientAge = patientData?.profile?.age || patientData?.identificacion?.edad || 73;

    return (
        <div className="space-y-6 font-sans text-slate-800 animate-in fade-in duration-300" id="tab-recommendations">
            {/* 🏥 CABECERA OFICIAL MATRIZ IFM NOM-004 */}
            <div className="bg-gradient-to-r from-[#1C75BC] via-blue-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-blue-700/50 flex flex-wrap justify-between items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-white/30 tracking-widest">
                            NOM-004-SSA3-2012 COMPLIANT
                        </span>
                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                            MATRIZ IFM v62.1
                        </span>
                    </div>
                    <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                        <span>🧪 Prescripción Nutracéutica y Matriz Terapéutica IFM</span>
                    </h3>
                    <p className="text-xs text-blue-100/90 mt-1 max-w-2xl">
                        Plan modular de precisión biomolecular y direccionamiento tisular para <strong>{activePatientName}</strong> ({activePatientAge} años).
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/20 backdrop-blur-md">
                    <div className="text-right">
                        <span className="text-[10px] text-blue-200 block uppercase font-bold">Folio de Cita</span>
                        <span className="text-sm font-black text-white font-mono">{patientData?.identificacion?.idCita || '20804'}</span>
                    </div>
                    <div className="w-px h-8 bg-white/20"></div>
                    <div className="text-right">
                        <span className="text-[10px] text-blue-200 block uppercase font-bold">Estatus Prescripción</span>
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={12} /> Aprobado CORTEX
                        </span>
                    </div>
                </div>
            </div>

            {/* 🚨 ALERTA CRÍTICA DE CONTRAINDICACIÓN ESTRICTA (DIRECCIONAMIENTO DE CALCIO) */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs flex items-start gap-4">
                <div className="p-3 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                    <ShieldAlert size={24} />
                </div>
                <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-amber-950 text-sm uppercase tracking-wider flex items-center gap-2">
                            <span>🚫 CONTRAINDICACIÓN ESTRICTA: SUPLEMENTACIÓN CON SALES DE CALCIO INORGÁNICO</span>
                        </h4>
                        <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300 uppercase">
                            CIE-10: M81.8 / M47.8
                        </span>
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                        Queda <strong>estrictamente prohibida la suplementación con sales de calcio inorgánico (carbonato o citrato de calcio sin K2)</strong>. La telemetría reporta calcio sérico elevado (<strong>3.013</strong>) con colapso de osteocalcina (<strong>0.240</strong>) y calcificación ectópica prostática (<strong>7.138</strong>), cervical (<strong>500.831</strong>) y lumbar (<strong>7.553</strong>). Administrar calcio libre agravaría la precipitación en tejidos blandos y lechos arteriales.
                    </p>
                </div>
            </div>

            {/* 🧬 NODOS DE LA MATRIZ IFM (CARDIOVASCULAR & ESTRUCTURAL) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* NODO A: TRANSPORTE Y CARDIOVASCULAR */}
                <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 space-y-4 ring-1 ring-red-500/10 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#E30613]/10 text-[#E30613] rounded-xl">
                                <HeartPulse size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Nodo Transporte & Cardiovascular</h4>
                                <span className="text-[10px] text-slate-500">CIE-10: I10 (Hipertensión) / I25.9 (Cardiopatía Isquémica)</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-red-100 text-[#E30613] border border-red-200 uppercase">
                            Prioridad Elevada
                        </span>
                    </div>

                    {/* Justificación Telemétrica */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                        <span className="font-bold text-slate-800 text-[11px] block">Justificación Telemétrica:</span>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-mono">
                            <div>• Resistencia Total (TPR): <strong className="text-red-700">1.703</strong></div>
                            <div>• Resistencia Vascular: <strong className="text-red-700">1.369</strong></div>
                            <div>• Consumo O2 Miocardio: <strong className="text-red-700">5.44</strong></div>
                            <div>• Impedancia Eyección VI: <strong className="text-red-700">1.769</strong></div>
                        </div>
                    </div>

                    {/* Intervención Nutracéutica */}
                    <div className="space-y-2 text-xs">
                        <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block">Prescripción Nutracéutica Específica:</span>
                        <ul className="space-y-2">
                            <li className="bg-red-50/50 p-2.5 rounded-xl border border-red-100 flex items-start gap-2">
                                <span className="text-[#E30613] font-bold text-base">💊</span>
                                <div>
                                    <strong className="text-slate-900 block">Coenzima Q10 (Ubiquinol): 100–200 mg/día</strong>
                                    <span className="text-slate-600 text-[11px]">Compensa el déficit telemétrico de <strong>0.823</strong> y restaura la bioenergética miocárdica sin incrementar demanda miocárdica de O2.</span>
                                </div>
                            </li>
                            <li className="bg-red-50/50 p-2.5 rounded-xl border border-red-100 flex items-start gap-2">
                                <span className="text-[#E30613] font-bold text-base">💊</span>
                                <div>
                                    <strong className="text-slate-900 block">Magnesio (Malato o Citrato): 300–400 mg/día</strong>
                                    <span className="text-slate-600 text-[11px]">Induce vasodilatación periférica suave, disminuyendo la reactividad vascular y la postcarga ventricular.</span>
                                </div>
                            </li>
                            <li className="bg-red-50/50 p-2.5 rounded-xl border border-red-100 flex items-start gap-2">
                                <span className="text-[#E30613] font-bold text-base">🌿</span>
                                <div>
                                    <strong className="text-slate-900 block">Polifenoles / Extracto de Olivo o Espino Blanco</strong>
                                    <span className="text-slate-600 text-[11px]">Soporte al tono microvascular periférico y reducción de la tortuosidad venular escleral observada.</span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* NODO B: ESTRUCTURAL Y MATRIZ EXTRACELULAR */}
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 space-y-4 ring-1 ring-emerald-500/10 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#3AAA35]/10 text-[#3AAA35] rounded-xl">
                                <Bone size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Nodo Estructural & Matriz ECM</h4>
                                <span className="text-[10px] text-slate-500">CIE-10: M81.8 (Osteopenia) / M47.8 (Espondiloartrosis)</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#3AAA35] border border-emerald-200 uppercase">
                            Prioridad Moderada
                        </span>
                    </div>

                    {/* Justificación Telemétrica */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                        <span className="font-bold text-slate-800 text-[11px] block">Justificación Telemétrica:</span>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-mono">
                            <div>• Osteocalcina: <strong className="text-amber-700">0.240</strong></div>
                            <div>• Colágeno Tisular: <strong className="text-amber-700">3.783</strong></div>
                            <div>• Calcificación Cervical: <strong className="text-amber-700">500.831</strong></div>
                            <div>• Calcificación Prostática: <strong className="text-amber-700">7.138</strong></div>
                        </div>
                    </div>

                    {/* Intervención Nutracéutica Direccionamiento Calcio */}
                    <div className="space-y-2 text-xs">
                        <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block">Direccionamiento Biomolecular de Calcio:</span>
                        <ul className="space-y-2">
                            <li className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 flex items-start gap-2">
                                <span className="text-[#3AAA35] font-bold text-base">💊</span>
                                <div>
                                    <strong className="text-slate-900 block">Vitamina K2 (Menaquinona MK-7): 100–120 mcg/día</strong>
                                    <span className="text-slate-600 text-[11px]">Activa la osteocalcina carboxilada, redirigiendo el calcio sérico desde lechos vasculares/prostáticos hacia la matriz ósea.</span>
                                </div>
                            </li>
                            <li className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 flex items-start gap-2">
                                <span className="text-[#3AAA35] font-bold text-base">💊</span>
                                <div>
                                    <strong className="text-slate-900 block">Vitamina D3 (Sinergia Obligada con K2)</strong>
                                    <span className="text-slate-600 text-[11px]">Ajuste coadyuvante sobre nivel bajo (<strong>4.653</strong>). Administrar exclusivamente en conjunto con MK-7.</span>
                                </div>
                            </li>
                            <li className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 flex items-start gap-2">
                                <span className="text-[#3AAA35] font-bold text-base">🧬</span>
                                <div>
                                    <strong className="text-slate-900 block">Péptidos de Colágeno Hidrolizado Bovino: 10 g/día + Vitamina C</strong>
                                    <span className="text-slate-600 text-[11px]">Estimula la síntesis de fibroblastos y regeneración de la matriz dérmico-articular.</span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* ⏳ ALGORITMO DE SECUENCIACIÓN TERAPÉUTICA (CRONOGRAMA DE 3 FASES) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                        <Clock size={20} className="text-[#1C75BC]" />
                        <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
                            Algoritmo de Secuenciación Terapéutica Cronológica (Línea de Tiempo)
                        </h4>
                    </div>
                    <div className="flex items-center gap-2">
                        {[1, 2, 3].map(phase => (
                            <button
                                key={phase}
                                onClick={() => setActiveTimelinePhase(phase)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                                    activeTimelinePhase === phase
                                        ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-xs'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                Fase {phase}
                            </button>
                        ))}
                    </div>
                </div>

                {/* VISUALIZACIÓN DE FASES EN TABS / LÍNEA DE TIEMPO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* FASE 1 */}
                    <div className={`rounded-2xl p-4 border transition-all space-y-3 ${
                        activeTimelinePhase === 1
                            ? 'bg-blue-50/80 border-[#1C75BC] ring-2 ring-[#1C75BC]/20 shadow-sm'
                            : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-[10px] font-black text-[#1C75BC] uppercase tracking-wider">Días 1 a 21</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-900">FASE 1</span>
                        </div>
                        <h5 className="font-extrabold text-slate-900 text-xs uppercase">Sellado de Asimilación & Drenaje</h5>
                        <ul className="text-xs space-y-2 text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-[#1C75BC] font-bold">1.</span>
                                <div><strong>Betaina HCl + Pepsina:</strong> Soporte gástrico por hipoclorhidria (57.426).</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#1C75BC] font-bold">2.</span>
                                <div><strong>L-Glutamina + Butirato + Probióticos:</strong> Reparación de mucosa colónica.</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#1C75BC] font-bold">3.</span>
                                <div><strong>Citrato de Potasio:</strong> Drenaje renal/linfático, alcalinizante (pH 3.036).</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#1C75BC] font-bold">4.</span>
                                <div><strong>CoQ10 (100-200mg) + Magnesio:</strong> Protección miocárdica (TPR 1.703).</div>
                            </li>
                        </ul>
                    </div>

                    {/* FASE 2 */}
                    <div className={`rounded-2xl p-4 border transition-all space-y-3 ${
                        activeTimelinePhase === 2
                            ? 'bg-emerald-50/80 border-[#3AAA35] ring-2 ring-[#3AAA35]/20 shadow-sm'
                            : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-[10px] font-black text-[#3AAA35] uppercase tracking-wider">Días 22 a 45</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">FASE 2</span>
                        </div>
                        <h5 className="font-extrabold text-slate-900 text-xs uppercase">Metabolismo, Energía & Direccionamiento Óseo</h5>
                        <ul className="text-xs space-y-2 text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-[#3AAA35] font-bold">1.</span>
                                <div><strong>Vitamina K2 (MK-7 100-120mcg) + D3 + Colágeno (10g):</strong> Direccionamiento óseo.</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#3AAA35] font-bold">2.</span>
                                <div><strong>Berberina / Silimarina + Complejo B:</strong> Eje Insulina/Hígado.</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#3AAA35] font-bold">3.</span>
                                <div><strong>Zinc biodisponible (0.693) + Selenio (0.590):</strong> Descongestión prostática/testicular.</div>
                            </li>
                        </ul>
                    </div>

                    {/* FASE 3 */}
                    <div className={`rounded-2xl p-4 border transition-all space-y-3 ${
                        activeTimelinePhase === 3
                            ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-sm'
                            : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Días 46+</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-900">FASE 3</span>
                        </div>
                        <h5 className="font-extrabold text-slate-900 text-xs uppercase">Quelación & Depuración Tisular Controlada</h5>
                        <ul className="text-xs space-y-2 text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-purple-700 font-bold">1.</span>
                                <div><strong>Quelación Suave con Glutatión / NAC:</strong> Depuración de metales e impurezas tisulares.</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-700 font-bold">2.</span>
                                <div><strong>Condición previa obligatoria:</strong> Verificar integridad de barrera mucosa colónica tras Fase 1 y 2.</div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TabRecommendations;
