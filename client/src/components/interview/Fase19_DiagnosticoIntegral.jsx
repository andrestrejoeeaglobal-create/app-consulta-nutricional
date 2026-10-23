import React, { useState, useEffect, useRef } from 'react';
import { 
    BrainCircuit, 
    Activity, 
    ShieldAlert,
    Target,
    Zap
} from 'lucide-react';
import tiloImg from '../../assets/tilo.png';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

// ==========================================================================
// PODADO DE PAYLOAD EN RED (< 12 KB): Elimina Base64 y filtra solo anomalías
// ==========================================================================
function pruneTelemetryPayloadForNetwork(rawPatientData, electretTelemetry, identityLock, isLactante, isPediatrico, patientAge) {
    const base = { ...(rawPatientData || {}) };
    const rawScan = { ...(base.scan_data || {}) };

    const rawElectret = rawScan.electret_metrics || electretTelemetry?.categories || null;
    let prunedElectret = null;
    if (rawElectret && typeof rawElectret === 'object') {
        prunedElectret = {};
        Object.entries(rawElectret).forEach(([catKey, catVal]) => {
            const items = Array.isArray(catVal?.items) ? catVal.items : (Array.isArray(catVal) ? catVal : []);
            const abnormalItems = items.filter(it => {
                const st = String(it?.status || it?.level || '').toUpperCase();
                return st && st !== 'NORMAL' && st !== 'OPTIMAL' && st !== 'NORMALES';
            }).map(it => ({
                name: it.name || it.parameter || it.label,
                value: it.value ?? it.actual,
                range: it.range || it.standard,
                status: it.status || it.level
            }));
            if (abnormalItems.length > 0) {
                prunedElectret[catKey] = { items: abnormalItems };
            }
        });
    }

    const rawExt = rawScan.external_metrics || null;
    let prunedExt = null;
    if (rawExt && typeof rawExt === 'object') {
        const prunedSections = {};
        Object.entries(rawExt.sections || {}).forEach(([secKey, secObj]) => {
            const items = Array.isArray(secObj?.items) ? secObj.items : (Array.isArray(secObj) ? secObj : []);
            const abnormalItems = items.filter(it => {
                const st = String(it?.status || '').toUpperCase();
                return st && st !== 'NORMAL' && st !== 'OPTIMAL' && st !== 'OPTIMO' && st !== 'NEGATIVO';
            }).map(it => ({
                name: it.name || it.label || it.parameter,
                value: it.value,
                unit: it.unit,
                ref: it.ref || it.reference,
                status: it.status
            }));
            if (abnormalItems.length > 0) {
                prunedSections[secKey] = { items: abnormalItems };
            }
        });
        prunedExt = {
            abnormalCount: rawExt.abnormalCount,
            sections: prunedSections
        };
    }

    const prunedOcular = rawScan.ocular_metrics ? {
        status: rawScan.ocular_metrics.status,
        severity: rawScan.ocular_metrics.severity,
        findings: rawScan.ocular_metrics.findings,
        clinical_flags: rawScan.ocular_metrics.clinical_flags || []
    } : null;

    const prunedLingual = rawScan.lingual_metrics ? {
        status: rawScan.lingual_metrics.status,
        severity: rawScan.lingual_metrics.severity,
        findings: rawScan.lingual_metrics.findings,
        clinical_flags: rawScan.lingual_metrics.clinical_flags || []
    } : null;

    const prunedVisual = rawScan.visual_metrics ? {
        status: rawScan.visual_metrics.status,
        severity: rawScan.visual_metrics.severity,
        findings: rawScan.visual_metrics.findings,
        clinical_flags: rawScan.visual_metrics.clinical_flags || [],
        items: Array.isArray(rawScan.visual_metrics.items)
            ? rawScan.visual_metrics.items.map(it => ({
                index: it.index,
                region: it.region,
                finding: it.finding,
                severity: it.severity,
                clinical_flags: it.clinical_flags || []
            }))
            : []
    } : null;

    return {
        ...base,
        scan_data: {
            electret_metrics: prunedElectret,
            external_metrics: prunedExt,
            ocular_metrics: prunedOcular,
            lingual_metrics: prunedLingual,
            visual_metrics: prunedVisual
        },
        identityLock,
        isLactante: isLactante || base.isLactante || (identityLock?.patientInfo?.age < 2),
        isPediatrico: isPediatrico || base.isPediatrico || (identityLock?.patientInfo?.age < 18),
        age: patientAge !== undefined ? patientAge : (identityLock?.patientInfo?.age ?? base.age)
    };
}

// ==========================================================================
// SUBCOMPONENTE: DiagnosticoRenderizado (Bento Grid Estructurado CORTEX v2.4)
// ==========================================================================
export function DiagnosticoRenderizado({ cortexSynthesis }) {
    let data = null;
    try {
        data = typeof cortexSynthesis === 'string' ? JSON.parse(cortexSynthesis) : cortexSynthesis;
    } catch (error) {
        console.error("Error parseando el diagnóstico de CORTEX:", error);
    }

    if (!data) return null;

    const rutaActiva = data.doctrina_aplicada || "RUTA D: NEUROPSIQUIATRÍA NUTRICIONAL E INMUNIDAD";
    const causaRaiz = data.diagnostico_causa_raiz || (Array.isArray(data.preliminary_diagnosis) ? data.preliminary_diagnosis.join(". ") : "");
    const alertas = data.alertas_bioseguridad || (Array.isArray(data.critical_alerts) ? data.critical_alerts.join(". ") : "");
    const nutricion = data.estrategia_terapeutica?.nutricion_defensora || (Array.isArray(data.suggested_management) ? data.suggested_management[0] : "");
    const readaptacion = data.estrategia_terapeutica?.readaptacion_fisica || (Array.isArray(data.suggested_management) ? data.suggested_management[1] : "");
    const sistemas = data.sistemas_afectados || ["Sistema Inmune", "Metabolismo Energético", "Biotensegridad Fascial"];
    const ifmNodes = Array.isArray(data.ifm_nodes_matrix) ? data.ifm_nodes_matrix : [];
    const bioenergetics = data.bioenergetics || null;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* CABECERA: DOCTRINA APLICADA */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-md border border-slate-800 select-none">
                <div>
                    <h2 className="text-sm font-extrabold flex items-center gap-2 uppercase tracking-wider">
                        <Target className="w-5 h-5 text-indigo-400" />
                        Ruta Clínica Activa
                    </h2>
                    <p className="text-slate-200 text-xs font-medium mt-1">{rutaActiva}</p>
                </div>
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
                    Doctrina CORTEX v2.4
                </span>
            </div>

            {/* MATRIZ DE 7 NODOS IFM (ISOMORFISMO ESTRUCTURAL COMPLETO) */}
            {ifmNodes.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-slate-900 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4 text-[#1C75BC]" />
                            Matriz Funcional de 7 Nodos IFM (Suero Clínico Purificado)
                        </h3>
                        <span className="text-[10px] font-bold text-[#1C75BC] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                            CIE-10 Determinista Auditado
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                        {ifmNodes.map((node) => {
                            const isHomeostasis = node.status === 'HOMEOSTASIS';
                            const isError = node.status === 'ERROR_SINTESIS';
                            const needsReview = node.validation_status === 'REQUIERE_REVISIÓN';
                            const safeBiomarkers = Array.isArray(node.key_biomarkers) ? node.key_biomarkers : [];

                            return (
                                <div
                                    key={node.nodeId}
                                    className={`p-3.5 rounded-xl border transition-all ${
                                        isError
                                            ? 'bg-amber-50/70 border-amber-300'
                                            : isHomeostasis
                                            ? 'bg-slate-50/70 border-slate-200/80'
                                            : 'bg-blue-50/30 border-blue-200'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                        <span className="font-extrabold text-xs text-slate-800">
                                            {node.nodeName || node.nodeId}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                                isHomeostasis
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-[#1C75BC]/10 text-[#1C75BC] border-[#1C75BC]/30'
                                            }`}>
                                                CIE-10: {node.cie10}
                                            </span>
                                            {needsReview && (
                                                <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                                    ⚠️ REQUIERE REVISIÓN
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-[11.5px] text-slate-700 leading-relaxed font-medium">
                                        {node.summary}
                                    </p>
                                    {safeBiomarkers.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {safeBiomarkers.map((bm, bIdx) => (
                                                <span key={bIdx} className="text-[10px] font-semibold bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                                                    🔬 {bm}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {node.therapeutic_focus && (
                                        <p className="text-[10.5px] text-[#1C75BC] font-bold mt-2">
                                            🎯 Enfoque: {node.therapeutic_focus}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* RESUMEN BIOENERGÉTICO MULTI-ECUACIÓN */}
            {bioenergetics && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-slate-900 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                            <Zap className="w-4 h-4 text-[#3AAA35]" />
                            Árbol Bioenergético: {bioenergetics.equationUsed}
                        </h3>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#3AAA35] border border-emerald-200">
                            TMB: {bioenergetics.bmr} kcal | TDEE: {bioenergetics.tdee} kcal → Meta: {bioenergetics.targetKcal} kcal
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">
                        {bioenergetics.formulaExplanation} {bioenergetics.weights ? `| Peso Ideal Devine: ${bioenergetics.weights.idealWeight} kg | Lemmens: ${bioenergetics.weights.lemmensIdealWeight} kg` : ''}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* COLUMNA IZQUIERDA: DIAGNÓSTICO Y ALERTAS */}
                <div className="space-y-6 flex flex-col">
                    {/* Tarjeta de Causa Raíz */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex-1">
                        <h3 className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2 select-none">
                            <Activity className="w-4.5 h-4.5 text-blue-600" />
                            Diagnóstico de Causa Raíz
                        </h3>
                        <p className="text-slate-700 text-xs leading-relaxed font-medium text-justify">
                            {causaRaiz}
                        </p>
                    </div>

                    {/* Tarjeta de Alertas */}
                    {alertas && (
                        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-sm">
                            <h3 className="text-amber-900 font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2 select-none">
                                <ShieldAlert className="w-4.5 h-4.5 text-amber-600" />
                                Bioseguridad y Alertas
                            </h3>
                            <p className="text-amber-800 text-xs leading-relaxed font-medium text-justify">
                                {alertas}
                            </p>
                        </div>
                    )}
                </div>

                {/* COLUMNA DERECHA: ESTRATEGIA TERAPÉUTICA */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between bg-gradient-to-br from-indigo-50/30 to-white">
                    <div>
                        <h3 className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 select-none">
                            <Zap className="w-4.5 h-4.5 text-indigo-600" />
                            Estrategia Terapéutica Integral
                        </h3>
                        
                        <div className="space-y-4">
                            {/* Nutrición Defensora */}
                            {nutricion && (
                                <div>
                                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 select-none">Nutrición Defensora</h4>
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed font-medium shadow-xs">
                                        {nutricion}
                                    </div>
                                </div>
                            )}

                            {/* Readaptación Física */}
                            {readaptacion && (
                                <div>
                                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 select-none">Readaptación Física</h4>
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed font-medium shadow-xs">
                                        {readaptacion}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sistemas Afectados (Chips) */}
                    {sistemas && sistemas.length > 0 && (
                        <div className="pt-4 border-t border-slate-200 mt-5">
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5 select-none">Sistemas Implicados</h4>
                            <div className="flex flex-wrap gap-1.5 select-none">
                                {sistemas.map((sistema, idx) => (
                                    <span key={idx} className="bg-blue-100 text-blue-800 border border-blue-200 text-[10.5px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                                        {sistema}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

// ==========================================================================
// CONTROLADOR HEADLESS FASE 19: Mantiene activo <MedicalDashboard /> (50/50)
// ==========================================================================
export default function Fase19_DiagnosticoIntegral({
    patientData,
    setPatientData,
    messages,
    setMessages,
    registerInputHandler,
    setActiveTab,
    onPhaseComplete
}) {
    const identityLock = useClinicalGenome(state => state.identityLock);
    const electretTelemetry = useClinicalGenome(state => state.electretTelemetry);
    const { isLactante, isPediatrico, patientAge } = usePatientLinguistics(patientData);
    const citationId = patientData?.idCita || patientData?.citaId || 1;

    const isSynthesizingRef = useRef(false);
    const hasAutoRecoveredRef = useRef(false);
    const [additionalSymptoms, setAdditionalSymptoms] = useState(
        patientData?.clinical_dossier?.additional_symptoms_reported || ''
    );

    // 1. Inicialización de Wayfinding con Deduplicación Atómica StrictMode
    useEffect(() => {
        const wayfindingQuestion = "Revisando su historial médico y bio-escaneos... ¿Hay algún síntoma, dolor o molestia reciente que no hayamos registrado hasta este momento?";

        if (setMessages) {
            setMessages(prev => {
                let seenWayfinding = false;
                const deduplicated = prev.filter(m => {
                    if (typeof m?.content === 'string' && m.content.includes(wayfindingQuestion)) {
                        if (seenWayfinding) return false;
                        seenWayfinding = true;
                        return true;
                    }
                    return true;
                });

                if (seenWayfinding) {
                    return deduplicated.length !== prev.length ? deduplicated : prev;
                }

                return [
                    ...deduplicated,
                    {
                        role: 'assistant',
                        content: wayfindingQuestion,
                        avatar: tiloImg,
                        options: [
                            { label: "✅ Sin síntomas adicionales (Generar Diagnóstico)", value: "NO_ADDITIONAL_SYMPTOMS" },
                            { label: "✏️ Registrar síntoma o molestia", value: "ADD_SYMPTOM" }
                        ]
                    }
                ];
            });
        }
    }, [setMessages]);

    // 2. Auto-Recuperación Silenciosa (Self-Healing) si se refrescó la página tras haber sintetizado
    useEffect(() => {
        if (hasAutoRecoveredRef.current || isSynthesizingRef.current) return;
        const hasSynthesisMessageInChat = Array.isArray(messages) && messages.some(m =>
            typeof m?.content === 'string' &&
            (m.content.includes("Motor CORTEX v2.4 de Síntesis Activo") || m.content.includes("Sin síntomas adicionales"))
        );
        const hasPersistedIfmMatrix = Array.isArray(patientData?.clinical_dossier?.ifm_nodes_matrix) &&
            patientData.clinical_dossier.ifm_nodes_matrix.length > 0;

        if (hasSynthesisMessageInChat && !hasPersistedIfmMatrix) {
            hasAutoRecoveredRef.current = true;
            triggerSynthesis("Sin síntomas adicionales. Recuperación automática de síntesis tras refresco.", true);
        }
    }, [messages, patientData?.clinical_dossier]);

    // 3. Acción Principal: Detonar Síntesis CORTEX v2.4 y Persistir de Inmediato en patientData + SQLite
    const triggerSynthesis = async (patientText, silentChat = false) => {
        if (isSynthesizingRef.current) return;
        isSynthesizingRef.current = true;
        setAdditionalSymptoms(patientText);

        if (!silentChat && setMessages) {
            setMessages(prev => [
                ...prev.map(m => m.options ? { ...m, options: undefined } : m),
                {
                    role: 'assistant',
                    content: "🧠 **Procesando Expediente Clínico en Motor CORTEX v2.4...**\n\nDestilando anomalías en las 7 Micro-Cápsulas IFM, auditando códigos CIE-10 y calculando el Árbol Bioenergético. Mientras tanto, puede navegar libremente por las pestañas superiores del Dashboard.",
                    avatar: tiloImg,
                    inputType: 'analyzing'
                }
            ]);
        }

        const isCloudStandalone = typeof window !== 'undefined' && 
            (window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')) && 
            !import.meta.env.VITE_API_URL;

        try {
            const payloadToSend = pruneTelemetryPayloadForNetwork(
                patientData,
                electretTelemetry,
                identityLock,
                isLactante,
                isPediatrico,
                patientAge
            );

            let data;
            if (!isCloudStandalone) {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const response = await fetch(`${apiUrl}/api/cortex/synthesize-dossier`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ citationId, patientData: payloadToSend })
                });
                data = await response.json();
            } else {
                data = {
                    success: true,
                    dossier: {
                        preliminary_diagnosis: ["Evaluación Metabólica Preliminar Completada (Modo Standalone)"],
                        suggested_management: ["Plan Nutracéutico Personalizado 33Plus/34Plus"],
                        critical_alerts: []
                    }
                };
            }

            if (data?.success && data?.dossier) {
                const dossier = data.dossier;

                // PERSISTENCIA INMEDIATA EN ESTADO GLOBAL (Sobrevive a F5 y habilita todas las pestañas del Dashboard)
                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        clinical_dossier: {
                            ...dossier,
                            human_approved_diagnosis: dossier.preliminary_diagnosis || [],
                            human_approved_management: dossier.suggested_management || [],
                            additional_symptoms_reported: patientText,
                            status: "SYNTHESIZED_READY_FOR_REVIEW"
                        }
                    }));
                }

                if (setActiveTab) {
                    setActiveTab('diagnosis');
                }

                if (setMessages) {
                    setMessages(prev => {
                        const withoutAnalyzing = prev.filter(m => m.inputType !== 'analyzing').map(m => m.options ? { ...m, options: undefined } : m);
                        return [
                            ...withoutAnalyzing,
                            {
                                role: 'assistant',
                                content: `🧠 **Motor CORTEX v2.4 de Síntesis Activo.**\n\nHe compilado y guardado el expediente clínico en las **7 Micro-Cápsulas de la Matriz IFM** y el **Árbol Bioenergético** dentro de la pestaña **Diagnóstico** del Dashboard derecho.\n\n💡 *Puede navegar libremente por las pestañas superiores (Biometría y Vitales, Bioquímicos, Historia Clínica) para consultar cualquier dato del paciente.* Cuando esté listo, confirme a continuación:`,
                                avatar: tiloImg,
                                options: [
                                    { label: "✅ Confirmar y Sellar Expediente ➔", value: "APPROVE_AND_SEAL_DOSSIER" },
                                    { label: "🔄 Re-Sintetizar Expediente", value: "RESYNTHESIZE_DOSSIER" }
                                ]
                            }
                        ];
                    });
                }
            } else if (!silentChat && setMessages) {
                setMessages(prev => [
                    ...prev.filter(m => m.inputType !== 'analyzing'),
                    {
                        role: 'assistant',
                        content: `⚠️ **Aviso del Motor CORTEX:** ${data?.message || "No se pudo completar la síntesis en este intento."}`,
                        avatar: tiloImg,
                        options: [
                            { label: "🔄 Reintentar Síntesis CORTEX", value: "RESYNTHESIZE_DOSSIER" }
                        ]
                    }
                ]);
            }
        } catch (err) {
            console.error("🔥 Error al recuperar síntesis CORTEX:", err);
            if (!silentChat && setMessages) {
                setMessages(prev => [
                    ...prev.filter(m => m.inputType !== 'analyzing'),
                    {
                        role: 'assistant',
                        content: "⚠️ **Error de comunicación con el servidor clínico.** Verifique su conexión e intente nuevamente.",
                        avatar: tiloImg,
                        options: [
                            { label: "🔄 Reintentar Síntesis CORTEX", value: "RESYNTHESIZE_DOSSIER" }
                        ]
                    }
                ]);
            }
        } finally {
            isSynthesizingRef.current = false;
        }
    };

    // 4. Acción: Confirmar y Sellar Dossier en SQLite y Avanzar a Fase 20
    const handleApproveDossier = async () => {
        const currentDossier = patientData?.clinical_dossier || {};
        const finalDiagnosis = currentDossier.human_approved_diagnosis || currentDossier.preliminary_diagnosis || [];
        const finalManagement = currentDossier.human_approved_management || currentDossier.suggested_management || [];

        const isCloudStandalone = typeof window !== 'undefined' && 
            (window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')) && 
            !import.meta.env.VITE_API_URL;
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        try {
            if (!isCloudStandalone) {
                await fetch(`${apiUrl}/api/cortex/approve-dossier`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        citationId,
                        approvedDiagnosis: finalDiagnosis,
                        approvedManagement: finalManagement,
                        additionalSymptoms,
                        originalDiagnosis: currentDossier.preliminary_diagnosis || [],
                        originalManagement: currentDossier.suggested_management || [],
                        ifmNodesMatrix: currentDossier.ifm_nodes_matrix || [],
                        bioenergetics: currentDossier.bioenergetics || null,
                        orthomolecularPrescription: currentDossier.orthomolecular_prescription || null
                    })
                });
            }

            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    clinical_dossier: {
                        ...(prev?.clinical_dossier || {}),
                        human_approved_diagnosis: finalDiagnosis,
                        human_approved_management: finalManagement,
                        additional_symptoms_reported: additionalSymptoms,
                        doctor_approval_timestamp: new Date().toISOString(),
                        status: "READY_FOR_PHASE_20"
                    },
                    diagnosis_approved: true
                }));
            }

            if (onPhaseComplete) {
                onPhaseComplete('PHASE_20_PORTAPAPELES');
            }
        } catch (err) {
            console.error("🔥 Error aprobando dossier:", err);
        }
    };

    // 5. Handler Headless para el Chat Unificado de App.jsx
    const handleChatInput = async (userMsg, source = 'text') => {
        if (!userMsg) return;

        if (userMsg === 'NO_ADDITIONAL_SYMPTOMS') {
            await triggerSynthesis("Sin síntomas adicionales. Proceder con el diagnóstico integral CORTEX v2.4.", false);
            return;
        }

        if (userMsg === 'ADD_SYMPTOM') {
            if (setMessages) {
                setMessages(prev => [
                    ...prev.map(m => m.options ? { ...m, options: undefined } : m),
                    {
                        role: 'assistant',
                        content: "✏️ Por favor, escriba a continuación el síntoma, dolor o molestia adicional que desea integrar antes de ejecutar la síntesis diagnóstica:",
                        avatar: tiloImg,
                        inputType: 'text'
                    }
                ]);
            }
            return;
        }

        if (userMsg === 'APPROVE_AND_SEAL_DOSSIER') {
            await handleApproveDossier();
            return;
        }

        if (userMsg === 'RESYNTHESIZE_DOSSIER') {
            await triggerSynthesis(additionalSymptoms || "Re-síntesis de expediente clínico solicitada.", false);
            return;
        }

        // Texto libre ingresado por el usuario en la barra del chat
        if (source === 'text') {
            if (setMessages) {
                setMessages(prev => [
                    ...prev.map(m => m.options ? { ...m, options: undefined } : m),
                    { role: 'user', content: userMsg }
                ]);
            }
            await triggerSynthesis(userMsg, false);
        }
    };

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => handleChatInput);
        }
    }, [registerInputHandler, patientData, additionalSymptoms]);

    return null;
}
