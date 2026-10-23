import React, { useState } from 'react';
import { ShieldAlert, HeartPulse, Bone, Clock, CheckCircle2, Activity, Zap, BrainCircuit } from 'lucide-react';
import { useClinicalGenome } from '../../store/useClinicalGenome';

export const TabRecommendations = ({ patientData }) => {
    const [activeTimelinePhase, setActiveTimelinePhase] = useState(1);
    const identityLock = useClinicalGenome(state => state.identityLock);

    const activePatientName =
        patientData?.profile?.name ||
        patientData?.identificacion?.nombre ||
        identityLock?.patientInfo?.name ||
        patientData?.nombre ||
        'Paciente en Consulta';

    const activePatientAge =
        patientData?.profile?.age ??
        patientData?.identificacion?.edad ??
        identityLock?.patientInfo?.age ??
        patientData?.edad ??
        '--';

    const activeCitationId =
        patientData?.identificacion?.idCita ||
        patientData?.idCita ||
        patientData?.citaId ||
        'ACTIVA';

    const dossier = patientData?.clinical_dossier || {};
    const ifmNodes = Array.isArray(dossier.ifm_nodes_matrix) ? dossier.ifm_nodes_matrix : [];
    const ortho = dossier.orthomolecular_prescription || {};
    const supplements = Array.isArray(ortho.supplements) && ortho.supplements.length > 0
        ? ortho.supplements
        : (Array.isArray(patientData?.advanced_supplementation) ? patientData.advanced_supplementation : []);
    const bioenergetics = dossier.bioenergetics || ortho.bioenergetics_summary || null;

    // Extraer anomalías reales de Lab OCR y Electret por si aún no se ha corrido Fase 19
    const liveLabAlerts = [];
    const extSections = patientData?.scan_data?.external_metrics?.sections || {};
    Object.values(extSections).forEach(sec => {
        const items = Array.isArray(sec?.items) ? sec.items : [];
        items.forEach(it => {
            const st = String(it?.status || '').toUpperCase();
            if (st && st !== 'NORMAL' && st !== 'OPTIMAL' && st !== 'NEGATIVO') {
                liveLabAlerts.push(`${it.name}: ${it.value} ${it.unit || ''} (${st})`);
            }
        });
    });

    const liveElectretAlerts = [];
    const electretCats = patientData?.scan_data?.electret_metrics || {};
    Object.values(electretCats).forEach(cat => {
        const items = Array.isArray(cat?.items) ? cat.items : [];
        items.forEach(it => {
            const st = String(it?.status || it?.level || '').toUpperCase();
            if (st && st !== 'NORMAL' && st !== 'OPTIMAL' && st !== 'NORMALES') {
                liveElectretAlerts.push(`${it.name || it.parameter}: ${it.value ?? it.actual} (${st})`);
            }
        });
    });

    const node3 = ifmNodes.find(n => n.nodeId === 'NODO_3_ENERGIA');
    const node5 = ifmNodes.find(n => n.nodeId === 'NODO_5_TRANSPORTE');
    const node6 = ifmNodes.find(n => n.nodeId === 'NODO_6_DEFENSA');
    const node7 = ifmNodes.find(n => n.nodeId === 'NODO_7_ESTRUCTURAL');

    const cardioMetabolicBiomarkers = [
        ...(Array.isArray(node3?.key_biomarkers) ? node3.key_biomarkers : []),
        ...(Array.isArray(node5?.key_biomarkers) ? node5.key_biomarkers : []),
        ...liveLabAlerts,
        ...liveElectretAlerts
    ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i).slice(0, 6);

    const immuneStructuralBiomarkers = [
        ...(Array.isArray(node6?.key_biomarkers) ? node6.key_biomarkers : []),
        ...(Array.isArray(node7?.key_biomarkers) ? node7.key_biomarkers : [])
    ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i).slice(0, 6);

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
                            MATRIZ IFM v2.4 NEURO-SIMBÓLICA
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
                        <span className="text-sm font-black text-white font-mono">{activeCitationId}</span>
                    </div>
                    <div className="w-px h-8 bg-white/20"></div>
                    <div className="text-right">
                        <span className="text-[10px] text-blue-200 block uppercase font-bold">Estatus Prescripción</span>
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={12} /> {dossier.status ? 'Sellado CORTEX' : 'Sincronizado'}
                        </span>
                    </div>
                </div>
            </div>

            {/* 🚨 BANNER DINÁMICO DE BIOSEGURIDAD Y PRIORIDAD FISIOPATOLÓGICA */}
            {ortho.has_calcium_contraction_lock ? (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs flex items-start gap-4">
                    <div className="p-3 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                        <ShieldAlert size={24} />
                    </div>
                    <div className="space-y-1.5 flex-1">
                        <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-amber-950 text-sm uppercase tracking-wider">
                                🚫 CONTRAINDICACIÓN ESTRICTA: DIRECCIONAMIENTO DE CALCIO
                            </h4>
                            <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300 uppercase">
                                CIE-10: {node7?.cie10 || 'M81.8'}
                            </span>
                        </div>
                        <p className="text-xs text-amber-900 leading-relaxed font-medium">
                            {ortho.calcium_alert_text}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 shadow-xs flex items-start gap-4">
                    <div className="p-3 bg-[#1C75BC] text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                        <BrainCircuit size={22} />
                    </div>
                    <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
                                🛡️ Directriz de Bioseguridad y Precisión Metabólica ({activePatientName})
                            </h4>
                            {bioenergetics && (
                                <span className="text-[10px] bg-white text-[#1C75BC] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-200 uppercase">
                                    {bioenergetics.equationUsed}: {bioenergetics.targetKcal} kcal/día
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {dossier.alertas_bioseguridad || 'Prescripción generada por el Tronco Encefálico Determinista de T.I.L.O. cruzando biometría, laboratorio OCR, bioimpedancia Electret y exploración clínica.'}
                        </p>
                    </div>
                </div>
            )}

            {/* 🧬 NODOS DE LA MATRIZ IFM Y FÓRMULAS 33PLUS® / 34PLUS® */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* COLUMNA 1: NODO BIOENERGÉTICO / CARDIOVASCULAR (33Plus®) */}
                <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 space-y-4 ring-1 ring-red-500/10 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#E30613]/10 text-[#E30613] rounded-xl">
                                <HeartPulse size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                                    Eje Mitocondrial, Lipídico & Reológico (33Plus®)
                                </h4>
                                <span className="text-[10px] text-slate-500">
                                    CIE-10: {node3?.cie10 || 'E78.5'} / {node5?.cie10 || 'R70.1'}
                                </span>
                            </div>
                        </div>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-red-100 text-[#E30613] border border-red-200 uppercase">
                            Ignición Diurna
                        </span>
                    </div>

                    {/* Justificación Telemétrica Real */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <span className="font-bold text-slate-800 text-[11px] block">
                            Biomarcadores de Activación en Expediente:
                        </span>
                        {cardioMetabolicBiomarkers.length > 0 ? (
                            <div className="grid grid-cols-1 gap-1 text-[10.5px] text-slate-700 font-mono">
                                {cardioMetabolicBiomarkers.map((bm, idx) => (
                                    <div key={idx} className="truncate">• <strong className="text-[#E30613]">{bm}</strong></div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-500">Homeostasis cardiometabólica conservada (Z00.0).</p>
                        )}
                    </div>

                    {/* Intervención 33Plus® */}
                    <div className="space-y-2 text-xs">
                        <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block">
                            Prescripción Ortomolecular Diurna:
                        </span>
                        <div className="bg-red-50/50 p-3.5 rounded-xl border border-red-100 space-y-1.5">
                            <strong className="text-slate-900 block text-xs">
                                💊 {supplements[0]?.name || '33 PLUS® - Polifenoles de Semilla de Uva, CoQ10, Cromo (200mcg) y L-Teanina'}
                            </strong>
                            <span className="text-[11px] font-bold text-[#E30613] block">
                                Dosis: {supplements[0]?.dosage || '1 toma al día'} • {supplements[0]?.timing || 'Por la mañana con el primer alimento'}
                            </span>
                            <p className="text-slate-600 text-[11px] leading-relaxed">
                                {supplements[0]?.rationale || node3?.therapeutic_focus || 'Optimización de sensibilidad insulínica, control de oxidación LDL y microcirculación diurna.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* COLUMNA 2: NODO INMUNE / ESTRUCTURAL / MUCOSO (34Plus®) */}
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 space-y-4 ring-1 ring-emerald-500/10 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#3AAA35]/10 text-[#3AAA35] rounded-xl">
                                <Bone size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                                    Eje Tisular, Cutáneo & Homeostasis Mucosa (34Plus®)
                                </h4>
                                <span className="text-[10px] text-slate-500">
                                    CIE-10: {node6?.cie10 || 'L53.9'} / {node7?.cie10 || 'Z00.0'}
                                </span>
                            </div>
                        </div>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#3AAA35] border border-emerald-200 uppercase">
                            Reparación Nocturna
                        </span>
                    </div>

                    {/* Justificación Telemétrica Real */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <span className="font-bold text-slate-800 text-[11px] block">
                            Hallazgos Tisulares / Inmunológicos en Expediente:
                        </span>
                        {immuneStructuralBiomarkers.length > 0 ? (
                            <div className="grid grid-cols-1 gap-1 text-[10.5px] text-slate-700 font-mono">
                                {immuneStructuralBiomarkers.map((bm, idx) => (
                                    <div key={idx} className="truncate">• <strong className="text-[#3AAA35]">{bm}</strong></div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-500">Soporte preventivo de matriz extracelular y barrera mucosa.</p>
                        )}
                    </div>

                    {/* Intervención 34Plus® */}
                    <div className="space-y-2 text-xs">
                        <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block">
                            Prescripción Ortomolecular Nocturna:
                        </span>
                        <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 space-y-1.5">
                            <strong className="text-slate-900 block text-xs">
                                🧬 {supplements[1]?.name || '34 PLUS® - Péptidos de Colágeno Hidrolizado, Vitamina C, L-Arginina e Inulina Prebiótica'}
                            </strong>
                            <span className="text-[11px] font-bold text-[#3AAA35] block">
                                Dosis: {supplements[1]?.dosage || '1 toma disuelta en 500 ml de agua 💧'} • {supplements[1]?.timing || '60 min antes de dormir'}
                            </span>
                            <p className="text-slate-600 text-[11px] leading-relaxed">
                                {supplements[1]?.rationale || node6?.therapeutic_focus || 'Regeneración nocturna de matriz dérmico-articular y sellado de barrera epitelial.'}
                            </p>
                        </div>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`rounded-2xl p-4 border transition-all space-y-3 ${
                        activeTimelinePhase === 1
                            ? 'bg-blue-50/80 border-[#1C75BC] ring-2 ring-[#1C75BC]/20 shadow-sm'
                            : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-[10px] font-black text-[#1C75BC] uppercase tracking-wider">Días 1 a 21</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-900">FASE 1</span>
                        </div>
                        <h5 className="font-extrabold text-slate-900 text-xs uppercase">Estabilización Endotelial y Barrera Mucosa</h5>
                        <p className="text-xs text-slate-700 leading-relaxed">
                            {ifmNodes[0]?.therapeutic_focus || 'Optimización digestiva e hidratación estructurada'} + Inicio de cronobiología 33Plus® (mañana) y 34Plus® (noche en 500 ml de agua).
                        </p>
                    </div>

                    <div className={`rounded-2xl p-4 border transition-all space-y-3 ${
                        activeTimelinePhase === 2
                            ? 'bg-emerald-50/80 border-[#3AAA35] ring-2 ring-[#3AAA35]/20 shadow-sm'
                            : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-[10px] font-black text-[#3AAA35] uppercase tracking-wider">Días 22 a 45</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">FASE 2</span>
                        </div>
                        <h5 className="font-extrabold text-slate-900 text-xs uppercase">Modulación Lipídica y Reológica Profunda</h5>
                        <p className="text-xs text-slate-700 leading-relaxed">
                            {node3?.therapeutic_focus || 'Corrección de perfil lipídico aterogénico y sensibilidad insulínica'} + {node5?.therapeutic_focus || 'Optimización de perfusión microvascular'}.
                        </p>
                    </div>

                    <div className={`rounded-2xl p-4 border transition-all space-y-3 ${
                        activeTimelinePhase === 3
                            ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-sm'
                            : 'bg-slate-50/60 border-slate-200 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Días 46+</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-900">FASE 3</span>
                        </div>
                        <h5 className="font-extrabold text-slate-900 text-xs uppercase">Consolidación Metabólica y Re-Evaluación</h5>
                        <p className="text-xs text-slate-700 leading-relaxed">
                            Auditoría de control de biomarcadores fuera de rango y consolidación de composición corporal ({bioenergetics ? `${bioenergetics.targetKcal} kcal/día` : 'Mantenimiento'}).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TabRecommendations;
