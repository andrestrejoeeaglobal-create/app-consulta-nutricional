import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Activity, 
    ShieldAlert,
    Zap
} from 'lucide-react';
import tiloImg from '../../assets/tilo.png';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

const IFM_NODE_CLINICAL_DESCRIPTIONS = {
    NODO_1_ASIMILACION: 'Evalúa la integridad de la barrera epitelial intestinal, función digestiva, permeabilidad mucosa y absorción de micronutrientes esenciales.',
    NODO_2_DEFENSA: 'Monitorea la vigilancia inmunológica, respuesta inflamatoria sistémica, hipersensibilidades alimentarias y mecanismos de reparación tisular.',
    NODO_3_ENERGIA: 'Cuantifica la eficiencia de la fosforilación oxidativa mitocondrial, regulación glucémica, sensibilidad insulínica y defensa antioxidante celular.',
    NODO_4_BIOTRANSFORMACION: 'Audita las rutas de detoxificación hepática Fase I y Fase II, depuración biliar, filtración glomerular renal y aclaramiento de xenobióticos.',
    NODO_5_TRANSPORTE: 'Analiza la hemodinámica cardiovascular, microcirculación endotelial, síntesis de óxido nítrico, perfusión de oxígeno y transporte lipoproteico.',
    NODO_6_COMUNICACION: 'Evalúa la señalización neuroendocrina del eje hipotálamo-hipófisis-adrenal (HPA), conversión tiroidea periférica y balance de neurotransmisores.',
    NODO_7_ESTRUCTURAL: 'Examina la biotensegridad miofascial, síntesis de colágeno en matriz extracelular, densidad mineral ósea e integridad de membranas celulares.'
};

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
// SUBCOMPONENTE: DiagnosticoRenderizado (Bento Cards Termodinámicas CORTEX v2.7)
// Homologado 1:1 con el estándar visual de TabBiochemicals.jsx
// ==========================================================================

// Resolutor Defensivo y Polimórfico de Items Diagnósticos (Cero Pantallas Blancas)
function resolveDiagnosticItems(rawCausaRaiz, rawPreliminary) {
    if (Array.isArray(rawPreliminary) && rawPreliminary.length > 0) {
        return rawPreliminary.map(item => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') return item.nombre || item.name || item.descripcion || JSON.stringify(item);
            return String(item);
        }).filter(Boolean);
    }
    if (Array.isArray(rawCausaRaiz) && rawCausaRaiz.length > 0) {
        return rawCausaRaiz.map(item => typeof item === 'string' ? item.trim() : JSON.stringify(item)).filter(Boolean);
    }
    if (typeof rawCausaRaiz === 'string' && rawCausaRaiz.trim().length > 0) {
        const text = rawCausaRaiz.trim();
        if (text.includes('•')) {
            const parts = text.split('•').map(p => p.trim()).filter(Boolean);
            if (parts.length > 0) return parts;
        }
        if (text.includes('\n')) {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length > 0) return lines;
        }
        return [text];
    }
    return [];
}

// Resolutor Defensivo y Polimórfico de Alertas Clínicas y Salvaguardas
function resolveAlertItems(rawAlertas, rawCriticalAlerts) {
    if (Array.isArray(rawCriticalAlerts) && rawCriticalAlerts.length > 0) {
        return rawCriticalAlerts.map(a => typeof a === 'string' ? a.trim() : JSON.stringify(a)).filter(Boolean);
    }
    if (Array.isArray(rawAlertas) && rawAlertas.length > 0) {
        return rawAlertas.map(a => typeof a === 'string' ? a.trim() : JSON.stringify(a)).filter(Boolean);
    }
    if (typeof rawAlertas === 'string' && rawAlertas.trim().length > 0) {
        const text = rawAlertas.trim();
        if (text.includes('•')) {
            const parts = text.split('•').map(p => p.trim()).filter(Boolean);
            if (parts.length > 0) return parts;
        }
        if (text.includes('\n')) {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length > 0) return lines;
        }
        return [text];
    }
    return [];
}

export function DiagnosticoRenderizado({ cortexSynthesis }) {
    const [selectedNodeId, setSelectedNodeId] = useState('ALL');

    const data = useMemo(() => {
        if (!cortexSynthesis) return null;
        try {
            return typeof cortexSynthesis === 'string' ? JSON.parse(cortexSynthesis) : cortexSynthesis;
        } catch (error) {
            console.error("Error parseando el diagnóstico de CORTEX:", error);
            return null;
        }
    }, [cortexSynthesis]);

    // Regla de Inmunidad: Memoización estricta de Nodos IFM y coordenadas termodinámicas
    const {
        processedNodes,
        totalNodesCount,
        alertNodesCount,
        normalNodesCount,
        globalAlertPct,
        rutaActiva,
        rawPreliminaryDiagnosis,
        rawCriticalAlerts,
        rawCausaRaiz,
        rawAlertas,
        causaRaiz,
        alertas,
        nutricion,
        readaptacion,
        sistemas,
        bioenergetics
    } = useMemo(() => {
        if (!data) {
            return {
                processedNodes: [],
                totalNodesCount: 0,
                alertNodesCount: 0,
                normalNodesCount: 0,
                globalAlertPct: 0,
                rutaActiva: '',
                rawPreliminaryDiagnosis: [],
                rawCriticalAlerts: [],
                rawCausaRaiz: null,
                rawAlertas: null,
                causaRaiz: '',
                alertas: '',
                nutricion: '',
                readaptacion: '',
                sistemas: [],
                bioenergetics: null
            };
        }

        const rawNodes = Array.isArray(data.ifm_nodes_matrix) ? data.ifm_nodes_matrix : [];
        const nodes = rawNodes.map((node, idx) => {
            const safeBiomarkers = Array.isArray(node.key_biomarkers) ? node.key_biomarkers : [];
            const isHomeostasis = node.status === 'HOMEOSTASIS' && safeBiomarkers.length === 0;
            const anomalyCount = safeBiomarkers.length > 0 ? safeBiomarkers.length : (isHomeostasis ? 0 : 1);
            const isHighPriority = !isHomeostasis && (node.status === 'PRIORIDAD_ALTA' || anomalyCount >= 2);
            const needsReview = node.validation_status === 'REQUIERE_REVISIÓN';

            // Cálculo termodinámico de posición en la barra tripartita (0% - 100%)
            let positionPct = 50;
            if (!isHomeostasis) {
                positionPct = Math.min(93, 70 + (anomalyCount * 6.5));
            }

            const shortName = String(node.nodeName || node.nodeId || `Nodo ${idx + 1}`)
                .replace(/^Nodo\s*\d+\s*:\s*/i, '')
                .trim();

            return {
                ...node,
                indexOrder: idx + 1,
                shortName,
                safeBiomarkers,
                isHomeostasis,
                anomalyCount,
                isHighPriority,
                needsReview,
                positionPct,
                clinicalDescription: IFM_NODE_CLINICAL_DESCRIPTIONS[node.nodeId] || 'Evaluación sistémica de medicina funcional e integración de biomarcadores clínicos.'
            };
        });

        const total = nodes.length;
        const alerts = nodes.filter(n => !n.isHomeostasis).length;
        const normals = total - alerts;
        const pct = total > 0 ? Math.round((alerts / total) * 100) : 0;

        return {
            processedNodes: nodes,
            totalNodesCount: total,
            alertNodesCount: alerts,
            normalNodesCount: normals,
            globalAlertPct: pct,
            rutaActiva: data.doctrina_aplicada || "RUTA D: NEUROPSIQUIATRÍA NUTRICIONAL E INMUNIDAD",
            rawPreliminaryDiagnosis: Array.isArray(data.preliminary_diagnosis) ? data.preliminary_diagnosis : [],
            rawCriticalAlerts: Array.isArray(data.critical_alerts) ? data.critical_alerts : [],
            rawCausaRaiz: data.diagnostico_causa_raiz,
            rawAlertas: data.alertas_bioseguridad,
            causaRaiz: data.diagnostico_causa_raiz || (Array.isArray(data.preliminary_diagnosis) ? data.preliminary_diagnosis.join(". ") : ""),
            alertas: data.alertas_bioseguridad || (Array.isArray(data.critical_alerts) ? data.critical_alerts.join(". ") : ""),
            nutricion: data.estrategia_terapeutica?.nutricion_defensora || (Array.isArray(data.suggested_management) ? data.suggested_management[0] : ""),
            readaptacion: data.estrategia_terapeutica?.readaptacion_fisica || (Array.isArray(data.suggested_management) ? data.suggested_management[1] : ""),
            sistemas: Array.isArray(data.sistemas_afectados) ? data.sistemas_afectados : (data.sistemas_afectados ? [data.sistemas_afectados] : ["Sistema Inmune", "Metabolismo Energético", "Biotensegridad Fascial"]),
            bioenergetics: data.bioenergetics || null
        };
    }, [data]);

    if (!data) return null;

    const activeNodeMeta = selectedNodeId === 'ALL'
        ? null
        : processedNodes.find(n => n.nodeId === selectedNodeId) || null;

    const visibleNodes = activeNodeMeta ? [activeNodeMeta] : processedNodes;

    const diagnosticItems = useMemo(() => {
        return resolveDiagnosticItems(rawCausaRaiz, rawPreliminaryDiagnosis);
    }, [rawCausaRaiz, rawPreliminaryDiagnosis]);

    const alertItems = useMemo(() => {
        return resolveAlertItems(rawAlertas, rawCriticalAlerts);
    }, [rawAlertas, rawCriticalAlerts]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* 1. SELECTOR HORIZONTAL DE PÍLDORAS INTERACTIVAS (❖ NODOS IFM:) */}
            {processedNodes.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-2 shrink-0 select-none">
                            ❖ NODOS IFM:
                        </span>

                        {/* Píldora Maestra: Todos los Nodos */}
                        <button
                            type="button"
                            onClick={() => setSelectedNodeId('ALL')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                                selectedNodeId === 'ALL'
                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-sm'
                                    : 'bg-slate-100/80 text-slate-700 border-slate-200/80 hover:bg-slate-200/70'
                            }`}
                        >
                            <span>Todos los Nodos ({totalNodesCount})</span>
                            {alertNodesCount > 0 ? (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    selectedNodeId === 'ALL'
                                        ? 'bg-white text-[#E30613]'
                                        : 'bg-[#E30613] text-white'
                                }`}>
                                    {alertNodesCount}
                                </span>
                            ) : (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    selectedNodeId === 'ALL'
                                        ? 'bg-white/20 text-white'
                                        : 'bg-[#3AAA35]/15 text-[#3AAA35]'
                                }`}>
                                    OK
                                </span>
                            )}
                        </button>

                        {/* Píldoras Individuales de los 7 Nodos IFM */}
                        {processedNodes.map((node) => {
                            const isActive = selectedNodeId === node.nodeId;
                            return (
                                <button
                                    key={node.nodeId}
                                    type="button"
                                    onClick={() => setSelectedNodeId(node.nodeId)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                                        isActive
                                            ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-sm'
                                            : 'bg-slate-100/80 text-slate-700 border-slate-200/80 hover:bg-slate-200/70'
                                    }`}
                                >
                                    <span className="truncate max-w-[190px]">
                                        {node.indexOrder}. {node.shortName}
                                    </span>
                                    {!node.isHomeostasis ? (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                            isActive
                                                ? 'bg-white text-[#E30613]'
                                                : 'bg-[#E30613] text-white'
                                        }`}>
                                            {node.anomalyCount}
                                        </span>
                                    ) : (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            isActive
                                                ? 'bg-white/20 text-white'
                                                : 'bg-[#3AAA35]/15 text-[#3AAA35]'
                                        }`}>
                                            OK
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 2. CABECERA DE TRIAGE SISTÉMICO (ESTADO CLÍNICO GLOBAL) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#1C75BC]/10 text-[#1C75BC] text-[10px] font-extrabold uppercase tracking-wider">
                            {activeNodeMeta ? `NODO IFM 0${activeNodeMeta.indexOrder}` : 'DOCTRINA CORTEX V2.4'}
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                            #IFM-{activeNodeMeta ? `700${activeNodeMeta.indexOrder}` : '7000'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                            • {totalNodesCount} Nodos IFM: <strong className="text-[#3AAA35]">{normalNodesCount} Normales</strong> / <strong className="text-[#E30613]">{alertNodesCount} Con Hallazgos</strong>
                        </span>
                        {bioenergetics && (
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-[#3AAA35] border border-emerald-200 text-[10px] font-extrabold">
                                ⚡ {bioenergetics.equationUsed}: TMB {bioenergetics.bmr} kcal | Meta {bioenergetics.targetKcal} kcal
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                        {activeNodeMeta ? activeNodeMeta.nodeName : rutaActiva}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                        {activeNodeMeta
                            ? activeNodeMeta.clinicalDescription
                            : (causaRaiz || 'Evaluación funcional integrativa de los 7 Nodos del Institute for Functional Medicine (IFM) con asignación determinista CIE-10 y suero clínico purificado.')}
                    </p>
                </div>

                {/* Widget de Estado Clínico Global (Derecha) */}
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 shrink-0">
                    <div className="text-right">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            ESTADO CLÍNICO GLOBAL
                        </span>
                        <span className={`text-sm font-extrabold ${
                            alertNodesCount > 0 ? 'text-[#E30613]' : 'text-[#3AAA35]'
                        }`}>
                            {alertNodesCount > 0
                                ? `⚠️ Alerta Prioritaria (${globalAlertPct}%)`
                                : '✓ Homeostasis Óptima'}
                        </span>
                    </div>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm border ${
                        alertNodesCount > 0
                            ? 'bg-red-50 text-[#E30613] border-red-200'
                            : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                    }`}>
                        {alertNodesCount}/{totalNodesCount}
                    </div>
                </div>
            </div>

            {/* 3. BENTO CARDS TERMODINÁMICAS DE LOS NODOS IFM */}
            {visibleNodes.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5">
                    {visibleNodes.map((node) => {
                        const borderLeftClass = node.isHomeostasis
                            ? 'border-l-[#3AAA35]'
                            : node.isHighPriority
                            ? 'border-l-orange-500'
                            : 'border-l-amber-500';

                        const badgeStyle = node.isHomeostasis
                            ? 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                            : node.isHighPriority
                            ? 'bg-orange-50 text-orange-800 border-orange-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300';

                        const badgeLabel = node.isHomeostasis
                            ? '✓ HOMEOSTASIS FISIOLÓGICA'
                            : node.isHighPriority
                            ? '⚠️ ANORMAL MODERADO (++)'
                            : '⚠️ ANORMAL LEVE (+)';

                        const markerBg = node.isHomeostasis ? 'bg-[#3AAA35]' : 'bg-[#1C75BC]';

                        return (
                            <div
                                key={node.nodeId}
                                className={`bg-white rounded-2xl border border-slate-200/90 border-l-4 ${borderLeftClass} p-5 shadow-xs hover:shadow-md transition-all`}
                            >
                                {/* Cabecera de la Bento Card */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                NODO 0{node.indexOrder}
                                            </span>
                                            <h4 className="text-sm font-extrabold text-slate-900">
                                                {node.nodeName || node.nodeId}
                                            </h4>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1">
                                            {node.clinicalDescription}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 self-start sm:self-center shrink-0">
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                                Código CIE-10 • Hallazgos
                                            </span>
                                            <span className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">
                                                {node.cie10}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 ml-1.5">
                                                ({node.anomalyCount} {node.anomalyCount === 1 ? 'parámetro' : 'parámetros'})
                                            </span>
                                        </div>

                                        {/* Píldora de Doble Codificación WCAG 2.1 AA */}
                                        <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border tracking-wide ${badgeStyle}`}>
                                            {badgeLabel}
                                        </span>

                                        {node.needsReview && (
                                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                                ⚠️ REVISIÓN CLÍNICA
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Barra de Progreso Termodinámica Tripartita con Callout Flotante */}
                                <div className="my-4 bg-slate-50/90 border border-slate-200/70 rounded-xl p-3.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-2">
                                        <span>DEFICIENCIA / RIESGO</span>
                                        <span className="text-[#3AAA35] font-extrabold">
                                            ZONA ÓPTIMA FISIOLÓGICA (Z00.0)
                                        </span>
                                        <span>EXCESO / DISFUNCIÓN ACTIVA</span>
                                    </div>

                                    <div className="relative h-6 rounded-lg overflow-visible flex items-center">
                                        {/* Fondo tripartito (Bajo | Normal | Alto) */}
                                        <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200/80 border border-slate-300/60">
                                            <div className="w-1/3 h-full bg-gradient-to-r from-red-200/70 via-amber-200/70 to-emerald-200/50 border-r border-slate-300/80" />
                                            <div className="w-1/3 h-full bg-[#3AAA35]/25 flex items-center justify-center">
                                                <span className="text-[8px] font-extrabold text-[#3AAA35] uppercase tracking-widest select-none">
                                                    RANGO FISIOLÓGICO NORMAL
                                                </span>
                                            </div>
                                            <div className="w-1/3 h-full bg-gradient-to-r from-emerald-200/50 via-amber-200/70 to-red-200/80 border-l border-slate-300/80" />
                                        </div>

                                        {/* Marcador flotante dinámico */}
                                        <div
                                            className="absolute -top-1.5 transform -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                                            style={{ left: `${node.positionPct}%` }}
                                        >
                                            <div className={`px-2 py-0.5 rounded shadow-sm text-[10px] font-extrabold text-white whitespace-nowrap ${markerBg}`}>
                                                {node.isHomeostasis
                                                    ? `${node.cie10} (Óptimo)`
                                                    : `${node.cie10} (${node.anomalyCount} ${node.anomalyCount === 1 ? 'Alerta' : 'Alertas'})`}
                                            </div>
                                            <div className={`w-2.5 h-2.5 rotate-45 -mt-1 ${markerBg} border border-white`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Biomarcadores Clave Aislados en el Nodo */}
                                {node.safeBiomarkers.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3.5">
                                        {node.safeBiomarkers.map((bm, bIdx) => (
                                            <span
                                                key={bIdx}
                                                className="text-[10.5px] font-bold bg-slate-50 text-slate-700 border border-slate-200/90 px-2.5 py-1 rounded-lg"
                                            >
                                                🔬 {bm}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Pie de Tarjeta: Correlación Clínica y Enfoque Terapéutico */}
                                <div className={`rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                    node.isHomeostasis
                                        ? 'bg-emerald-50/50 border border-emerald-200/60 text-emerald-950'
                                        : 'bg-amber-50/70 border border-amber-200/80 text-amber-950'
                                }`}>
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-start gap-2">
                                            <span className="font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-white/80 border border-black/10 shrink-0 mt-0.5">
                                                ⓘ Síntesis Clínica
                                            </span>
                                            <p className="font-medium leading-relaxed text-xs">
                                                {node.summary}
                                            </p>
                                        </div>
                                        {node.therapeutic_focus && (
                                            <p className="text-[11px] font-bold text-[#1C75BC] pl-1 pt-0.5">
                                                🎯 Enfoque Terapéutico: <span className="font-semibold text-slate-700">{node.therapeutic_focus}</span>
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-extrabold text-[#1C75BC] shrink-0 self-end sm:self-center">
                                        Correlación Córtex →
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 4. BLOQUE INFERIOR DE SÍNTESIS ESTRATÉGICA, CAUSA RAÍZ Y BIOSEGURIDAD */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                {/* Columna Izquierda: Causa Raíz y Alertas Clínicas */}
                <div className="space-y-4 flex flex-col">
                    {/* Bento Card: Diagnóstico Funcional de Causa Raíz */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-[#1C75BC] p-5 shadow-xs flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/20">
                                        ANÁLISIS ETIOLÓGICO MULTINODO
                                    </span>
                                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 select-none">
                                        <Activity className="w-4 h-4 text-[#1C75BC]" />
                                        <span>Diagnóstico Funcional de Causa Raíz</span>
                                    </h3>
                                </div>
                                {diagnosticItems.length > 0 && (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                        {diagnosticItems.length} {diagnosticItems.length === 1 ? 'Eje Clínico' : 'Ejes Clínicos'}
                                    </span>
                                )}
                            </div>

                            {/* Renderizado Defensivo: Si hay items desglosados */}
                            {diagnosticItems.length > 0 ? (
                                <div className="space-y-2.5">
                                    {diagnosticItems.map((item, idx) => {
                                        const cieMatch = String(item).match(/[(\[]?(?:CIE-10:\s*)?([A-Z][0-9]{2}(?:\.[0-9]{1,2})?)[)\]]?/i);
                                        const cleanText = String(item)
                                            .replace(/^[•\s\d.-]+/, '')
                                            .trim();

                                        return (
                                            <div
                                                key={idx}
                                                className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 text-xs text-slate-700 leading-relaxed font-medium hover:bg-slate-100/70 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <span className="font-extrabold text-[11px] text-slate-900 flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#1C75BC]"></span>
                                                        <span>Eje Diagnóstico 0{idx + 1}</span>
                                                    </span>
                                                    {cieMatch && (
                                                        <span className="font-mono text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-blue-50 text-[#1C75BC] border border-blue-200 shrink-0">
                                                            CIE-10: {cieMatch[1]}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11.5px] text-slate-700 leading-relaxed">
                                                    {cleanText}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* Fallback Seguro para expedientes legacy (String corrido sin items) */
                                <p className="text-slate-700 text-xs leading-relaxed font-medium text-justify">
                                    {causaRaiz || 'Evaluación de causa raíz completada.'}
                                </p>
                            )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 font-medium">Doctrina Médica Funcional IFM</span>
                            <span className="font-bold text-[#1C75BC]">Correlación Córtex →</span>
                        </div>
                    </div>

                    {/* Bento Card: Bioseguridad y Alertas Clínicas */}
                    {(alertItems.length > 0 || alertas) && (
                        <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-amber-500 p-5 shadow-xs">
                            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/70">
                                        FILTRO DE INMUNIDAD NORMATIVA
                                    </span>
                                    <h3 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5 select-none">
                                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                                        <span>Bioseguridad y Alertas Clínicas</span>
                                    </h3>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                    ⚠️ VIGILANCIA ACTIVA
                                </span>
                            </div>

                            {/* Desglose Defensivo de Alertas */}
                            {alertItems.length > 0 ? (
                                <div className="space-y-2">
                                    {alertItems.map((alt, aIdx) => {
                                        const isCritical = /SAFEGUARD|BLOQUEADO|CONTRAINDICADA|PROHIBIDO/i.test(alt);
                                        const cleanAlert = String(alt)
                                            .replace(/^[•\s\d.-]+/, '')
                                            .trim();

                                        return (
                                            <div
                                                key={aIdx}
                                                className={`rounded-xl p-3 text-xs leading-relaxed font-medium border ${
                                                    isCritical
                                                        ? 'bg-red-50/70 border-red-200/90 text-red-950'
                                                        : 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                                        isCritical ? 'text-[#E30613]' : 'text-amber-800'
                                                    }`}>
                                                        <span>{isCritical ? '🛑' : '⚠️'}</span>
                                                        <span>{isCritical ? 'Salvaguarda de Bioseguridad' : 'Alerta Fisiológica'}</span>
                                                    </span>
                                                </div>
                                                <p className="text-[11.5px] leading-relaxed">
                                                    {cleanAlert}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-amber-900 text-xs leading-relaxed font-medium text-justify">
                                    {alertas}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Columna Derecha: Estrategia Terapéutica y Sistemas Implicados */}
                <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-[#3AAA35] p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3.5 select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-[#3AAA35] border border-emerald-200/70">
                                    PRESCRIPCIÓN ORTOMOLECULAR INTEGRAL
                                </span>
                                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Zap className="w-4 h-4 text-[#3AAA35]" />
                                    <span>Estrategia Terapéutica Integral</span>
                                </h3>
                            </div>
                        </div>

                        {/* Chips Métricos Puros del Tronco Matemático (calculatePrecisionBioenergetics) */}
                        {bioenergetics && (
                            <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-slate-100 mb-3.5">
                                {bioenergetics.tdee && (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#3AAA35] border border-emerald-200/80 text-[10px] font-extrabold flex items-center gap-1">
                                        <span>⚡ TDEE:</span>
                                        <span>{bioenergetics.tdee} kcal</span>
                                    </span>
                                )}
                                {bioenergetics.targetKcal && (
                                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#1C75BC] border border-blue-200/80 text-[10px] font-extrabold flex items-center gap-1">
                                        <span>🎯 Meta Calórica:</span>
                                        <span>{bioenergetics.targetKcal} kcal/día</span>
                                    </span>
                                )}
                                {bioenergetics.bmr && (
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-extrabold flex items-center gap-1">
                                        <span>🔥 TMB:</span>
                                        <span>{bioenergetics.bmr} kcal</span>
                                    </span>
                                )}
                                {bioenergetics.equationUsed && (
                                    <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 text-[9.5px] font-bold">
                                        {bioenergetics.equationUsed}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="space-y-3">
                            {nutricion && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1.5 select-none">
                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                            Nutrición Defensora y Modulación Metabólica
                                        </span>
                                    </div>
                                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 text-xs text-slate-700 leading-relaxed font-medium">
                                        {nutricion}
                                    </div>
                                </div>
                            )}

                            {readaptacion && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1.5 select-none">
                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                            Prescripción Ortomolecular y Readaptación
                                        </span>
                                    </div>
                                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 text-xs text-slate-700 leading-relaxed font-medium">
                                        {readaptacion}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sistemas Fisiológicos Implicados */}
                    {Array.isArray(sistemas) && sistemas.length > 0 && (
                        <div className="pt-3.5 border-t border-slate-100 mt-4">
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 select-none">
                                Sistemas Fisiológicos Implicados
                            </h4>
                            <div className="flex flex-wrap gap-1.5 select-none">
                                {sistemas.map((sistema, idx) => (
                                    <span
                                        key={idx}
                                        className="bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/20 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider"
                                    >
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

    // 2. Auto-Recuperación Silenciosa (Self-Healing) si se refrescó la página o si existía algún nodo previo pendiente
    useEffect(() => {
        if (hasAutoRecoveredRef.current || isSynthesizingRef.current) return;
        const hasSynthesisMessageInChat = Array.isArray(messages) && messages.some(m =>
            typeof m?.content === 'string' &&
            (m.content.includes("Motor CORTEX v2.4 de Síntesis Activo") || m.content.includes("Sin síntomas adicionales"))
        );
        const persistedMatrix = patientData?.clinical_dossier?.ifm_nodes_matrix;
        const hasPersistedIfmMatrix = Array.isArray(persistedMatrix) && persistedMatrix.length > 0;
        const hasLegacyPendingNode = hasPersistedIfmMatrix && persistedMatrix.some(n =>
            n.status === 'ERROR_SINTESIS' ||
            String(n.summary || '').includes('SÍNTESIS_PENDIENTE') ||
            String(n.therapeutic_focus || '').includes('PENDIENTE DE EVALUACIÓN')
        );

        if ((hasSynthesisMessageInChat && !hasPersistedIfmMatrix) || hasLegacyPendingNode) {
            hasAutoRecoveredRef.current = true;
            triggerSynthesis(
                patientData?.clinical_dossier?.additional_symptoms_reported ||
                "Sin síntomas adicionales. Recuperación automática de síntesis tras actualización.",
                true
            );
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
