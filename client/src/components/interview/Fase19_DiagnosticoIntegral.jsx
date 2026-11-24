import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Activity, 
    ShieldAlert,
    Zap,
    Droplets,
    CheckCircle2,
    AlertTriangle,
    Clock,
    ShieldCheck
} from 'lucide-react';
import tiloImg from '../../assets/tilo.png';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import {
    sanitizeClinicalSpanish,
    normalizeMetricDecimals,
    capitalizeLeadingSpanish,
    isPhysiologicallyNormal,
    isBiomarkerStringActuallyNormal,
    resolveVerifiedPatientAge
} from '../../utils/patientGuideAdapter';

const IFM_NODE_CLINICAL_DESCRIPTIONS = {
    NODO_1_ASIMILACION: 'Evalúa la integridad de la barrera epitelial intestinal, función digestiva, permeabilidad mucosa y absorción de micronutrientes esenciales.',
    NODO_2_BIOTRANSFORMACION: 'Audita las rutas de detoxificación hepática Fase I y Fase II, depuración biliar, filtración glomerular renal y aclaramiento de xenobióticos.',
    NODO_2_DEFENSA: 'Monitorea la vigilancia inmunológica, respuesta inflamatoria sistémica, hipersensibilidades alimentarias y mecanismos de reparación tisular.',
    NODO_3_ENERGIA: 'Cuantifica la eficiencia de la fosforilación oxidativa mitocondrial, regulación glucémica, sensibilidad insulínica y defensa antioxidante celular.',
    NODO_4_COMUNICACION: 'Evalúa la señalización neuroendocrina del eje hipotálamo-hipófisis-adrenal (HPA), conversión tiroidea periférica y balance de neurotransmisores.',
    NODO_4_BIOTRANSFORMACION: 'Audita las rutas de detoxificación hepática Fase I y Fase II, depuración biliar, filtración glomerular renal y aclaramiento de xenobióticos.',
    NODO_5_TRANSPORTE: 'Analiza la hemodinámica cardiovascular, microcirculación endotelial, síntesis de óxido nítrico, perfusión de oxígeno y transporte lipoproteico.',
    NODO_6_DEFENSA: 'Monitorea la vigilancia inmunológica, respuesta inflamatoria sistémica, hipersensibilidades alimentarias y mecanismos de reparación tisular.',
    NODO_6_COMUNICACION: 'Evalúa la señalización neuroendocrina del eje hipotálamo-hipófisis-adrenal (HPA), conversión tiroidea periférica y balance de neurotransmisores.',
    NODO_7_ESTRUCTURAL: 'Examina la biotensegridad miofascial, síntesis de colágeno en matriz extracelular, densidad mineral ósea e integridad de membranas celulares.'
};

// ==========================================================================
// PODADO DE PAYLOAD EN RED (< 12 KB): Elimina Base64 y filtra solo anomalías reales
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
                const st = String(it?.status || it?.level || '').toUpperCase().trim();
                return Boolean(st) && !isPhysiologicallyNormal(st);
            }).map(it => ({
                key: it.key,
                name: it.name || it.parameter || it.label,
                displayName: it.displayName || sanitizeClinicalSpanish(it.name || it.parameter || it.label || ''),
                value: it.value ?? it.val ?? it.actual,
                reference: it.reference || it.ref || it.range || it.standard,
                range: it.reference || it.ref || it.range || it.standard,
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
            // Preservar todos los analitos de laboratorio con sus valores numéricos íntegros (para cálculo de índices funcionales TG/HDL, HOMA-IR, etc.)
            const cleanItems = items.map(it => ({
                analyte_uid: it.analyte_uid,
                name: it.name || it.label || it.parameter,
                val: it.val ?? it.value,
                value: it.value ?? it.val,
                unit: it.unit,
                ref: it.ref || it.reference,
                status: it.status || 'NORMAL',
                studyDate: it.studyDate,
                studyDateIso: it.studyDateIso
            }));
            if (cleanItems.length > 0) {
                prunedSections[secKey] = { items: cleanItems };
            }
        });
        prunedExt = {
            abnormalCount: rawExt.abnormalCount,
            totalParameters: rawExt.totalParameters,
            vigencia: rawExt.vigencia || null,
            sections: prunedSections,
            external_studies: rawExt.external_studies || null,
            imaging: rawExt.imaging || null,
            labs: rawExt.labs || null,
            biomarkers: rawExt.biomarkers || null
        };
    }

    const prunedOcular = rawScan.ocular_metrics ? {
        status: rawScan.ocular_metrics.status,
        severity: rawScan.ocular_metrics.severity,
        findings: rawScan.ocular_metrics.findings,
        clinical_flags: rawScan.ocular_metrics.clinical_flags || [],
        pilares: rawScan.ocular_metrics.pilares || null
    } : null;

    const prunedLingual = rawScan.lingual_metrics ? {
        status: rawScan.lingual_metrics.status,
        severity: rawScan.lingual_metrics.severity,
        findings: rawScan.lingual_metrics.findings,
        clinical_flags: rawScan.lingual_metrics.clinical_flags || [],
        pilares: rawScan.lingual_metrics.pilares || null
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

    delete base._session_meta;
    const verifiedAge = resolveVerifiedPatientAge({ ...base, identityLock }, 35);
    const safeAge = verifiedAge.ageYears;
    return {
        ...base,
        scan_data: {
            electret_metrics: prunedElectret,
            external_metrics: prunedExt,
            ocular_metrics: prunedOcular,
            lingual_metrics: prunedLingual,
            visual_metrics: prunedVisual
        },
        lab_results: base.lab_results || rawExt?.labs || null,
        somatic_findings: base.somatic_findings || base.body_zones || base.VisualBodyMap || null,
        body_zones: base.body_zones || null,
        VisualBodyMap: base.VisualBodyMap || null,
        identityLock,
        isLactante: Boolean(safeAge < 2 && (verifiedAge.isLactanteVerified || isLactante === true)),
        isPediatrico: Boolean(safeAge < 18 && (verifiedAge.isPediatricVerified || isPediatrico === true)),
        age: safeAge
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

// Diccionario Clínico de Traducción y Sanitización de Biomarcadores y Banderas Somáticas
const CLINICAL_TRANSLATION_MAP = {
    'RETICULAR_ERYTHEMA': 'Eritema Reticular',
    'PUNCTATE_MACULES': 'Máculas Puntiformes',
    'MICROPAPULAR_ERUPTION': 'Erupción Micropapular',
    'PERIFOLLICULAR_INVOLVEMENT': 'Compromiso Perifolicular',
    'CUTANEOUS_EDEMA_SUPERFICIAL': 'Edema Cutáneo Superficial',
    'SUPERFICIAL_CUTANEOUS_EDEMA': 'Edema Cutáneo Superficial',
    'CHRONIC_VENOUS_INSUFFICIENCY_DETECTED': 'Insuficiencia Venosa Crónica',
    'CHRONIC_VENOUS_INSUFFICIENCY': 'Insuficiencia Venosa Crónica',
    'VARICOSE_VEINS_HIGH_RISK': 'Riesgo Elevado de Várices',
    'VENOUS_STASIS_DERMATITIS': 'Dermatitis por Estasis Venosa',
    'EDEMA_PERIPHERAL_MODERATE': 'Edema Periférico Moderado',
    'PERIPHERAL_EDEMA': 'Edema Periférico',
    'HYPERPIGMENTATION': 'Hiperpigmentación Cutánea',
    'HEMOSIDERIN_PIGMENTATION': 'Pigmentación por Hemosiderina',
    'FOLLICULAR_HYPERKERATOSIS': 'Hiperqueratosis Folicular',
    'XEROSIS_CUTIS': 'Xerosis Cutánea (Piel Seca)',
    'TELANGIECTASIA': 'Telangiectasias Superficiales',
    'VENOUS_ECTASIA': 'Ectasia Venosa',
    'SUBLINGUAL_VARICES': 'Várices Sublinguales',
    'LINGUAL_COATING_WHITE': 'Saburra Lingual Blanquecina',
    'GINGIVAL_CONGESTION': 'Congestión Gingival',
    'DRY_MUCOSA': 'Resequedad de Mucosa',
    'ERYTHEMATOUS_EDEMA': 'Edema Eritematoso',
    'MICROVASCULAR_CONGESTION': 'Congestión Microvascular',
    'BLOOD_VISCOSITY': 'Viscosidad Sanguínea',
    'VASCULAR_RESISTANCE': 'Resistencia Vascular',
    'VASCULAR_ELASTICITY': 'Elasticidad Vascular',
    'MYOCARDIAL_BLOOD_DEMAND': 'Demanda de Sangre Miocárdica',
    'STROKE_VOLUME': 'Volumen Sistólico',
    'LEFT_VENTRICULAR_EJECTION_IMPEDANCE': 'Impedancia Ventricular de Expulsión',
    'EFFECTIVE_PUMP_FORCE': 'Fuerza de Bombeo Efectiva',
    'CORONARY_ARTERY_ELASTICITY': 'Elasticidad Coronaria',
    'CEREBRAL_VESSEL_ELASTICITY': 'Elasticidad de Vaso Cerebral',
    'CHOLESTEROL_CRYSTAL': 'Cristal de Colesterol'
};

export function formatClinicalBiomarker(raw) {
    if (!raw) return '';
    let text = normalizeMetricDecimals(sanitizeClinicalSpanish(String(raw).trim()));

    const upperKey = text.toUpperCase().replace(/\s+/g, '_');
    if (CLINICAL_TRANSLATION_MAP[upperKey]) {
        return CLINICAL_TRANSLATION_MAP[upperKey];
    }

    if (text.includes(':')) {
        const parts = text.split(':');
        const rawLeft = parts[0].trim();
        const key = rawLeft.toUpperCase().replace(/\s+/g, '_');
        const val = parts.slice(1).join(':').trim();
        const translatedKey = CLINICAL_TRANSLATION_MAP[key] || (
            /^[A-Z0-9_]{3,}$/.test(rawLeft)
                ? rawLeft.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                : capitalizeLeadingSpanish(rawLeft)
        );
        const sanitizedVal = normalizeMetricDecimals(sanitizeClinicalSpanish(val))
            .replace(/(?<![\p{L}\p{N}_])Ref:\s*N\/A(?![\p{L}\p{N}_])/giu, 'Rango Observacional')
            .replace(/(?<![\p{L}\p{N}_])ANORMAL\s+LEVE(?![\p{L}\p{N}_])/giu, 'Alerta Leve')
            .replace(/(?<![\p{L}\p{N}_])ANORMAL\s+MODERADO(?![\p{L}\p{N}_])/giu, 'Alerta Moderada')
            .replace(/(?<![\p{L}\p{N}_])ANORMAL\s+SEVERO(?![\p{L}\p{N}_])/giu, 'Alerta Severa');
        return `${translatedKey}: ${sanitizedVal}`;
    }

    Object.entries(CLINICAL_TRANSLATION_MAP).forEach(([key, val]) => {
        const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${key}(?![\\p{L}\\p{N}_])`, 'giu');
        text = text.replace(regex, val);
    });

    text = text
        .replace(/^(?:SAFEGUARD|SALVAGUARDA)\s+DE\s+ESFUERZO\s+(?:F[ÍI]SICO\s+)?(?:\(ADULTO\)|ADULTO):?\s*/iu, 'Salvaguarda de Esfuerzo Físico (Adulto): ')
        .replace(/SAFEGUARD\s*(?:DE)?/giu, 'Salvaguarda de')
        .replace(/\s+([.,;:])/g, (_, p) => p)
        .replace(/\s+/g, ' ')
        .replace(/(?<![\p{L}\p{N}_])Ref:\s*N\/A(?![\p{L}\p{N}_])/giu, 'Rango Observacional')
        .replace(/(?<![\p{L}\p{N}_])ANORMAL\s+LEVE(?![\p{L}\p{N}_])/giu, 'Alerta Leve')
        .replace(/(?<![\p{L}\p{N}_])ANORMAL\s+MODERADO(?![\p{L}\p{N}_])/giu, 'Alerta Moderada')
        .replace(/(?<![\p{L}\p{N}_])ANORMAL\s+SEVERO(?![\p{L}\p{N}_])/giu, 'Alerta Severa')
        .replace(/(?<![\p{L}\p{N}_])OPTIMAL(?![\p{L}\p{N}_])/giu, 'Óptimo')
        .replace(/(?<![\p{L}\p{N}_])NORMAL(?![\p{L}\p{N}_])/giu, 'Normal')
        .trim();

    if (/^[A-Z0-9_]{3,}$/.test(text)) {
        text = text
            .split('_')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }

    return capitalizeLeadingSpanish(text);
}

export function formatClinicalText(text) {
    if (!text) return '';
    let result = sanitizeClinicalSpanish(String(text));

    Object.entries(CLINICAL_TRANSLATION_MAP).forEach(([key, val]) => {
        const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${key}(?![\\p{L}\\p{N}_])`, 'giu');
        result = result.replace(regex, val);
    });

    return result
        .replace(/^(?:SAFEGUARD|SALVAGUARDA)\s+DE\s+ESFUERZO\s+(?:F[ÍI]SICO\s+)?(?:\(ADULTO\)|ADULTO):?\s*/iu, 'Salvaguarda de Esfuerzo Físico (Adulto): ')
        .replace(/SAFEGUARD\s*(?:DE)?/giu, 'Salvaguarda de')
        .replace(/\s+([.,;:])/g, (_, p) => p)
        .replace(/[^\S\u00A0]+/g, ' ')
        .replace(/\(Matriz IFM SSoTT v2\.[456]\)/giu, '(Matriz IFM SSoTT v2.7)')
        .replace(/\[Readaptaci[óo]n F[íi]sica\]/giu, '[Readaptación Biomecánica y Prescripción de Movimiento]')
        .replace(/6,000[–-]8,000\s*pasos\/d[íi]a/giu, '6\u00A0000 a 8\u00A0000 pasos/día')
        .replace(/(?<![\p{L}\p{N}_])Ref:\s*N\/A(?![\p{L}\p{N}_])/giu, 'Rango Observacional')
        .replace(/(?<![\p{L}\p{N}_])ANORMAL\s+LEVE(?![\p{L}\p{N}_])/giu, 'Alerta Leve')
        .replace(/(?<![\p{L}\p{N}_])ANORMAL\s+MODERADO(?![\p{L}\p{N}_])/giu, 'Alerta Moderada')
        .replace(/(?<![\p{L}\p{N}_])ANORMAL\s+SEVERO(?![\p{L}\p{N}_])/giu, 'Alerta Severa')
        .replace(/(?<![\p{L}\p{N}_])OPTIMAL(?![\p{L}\p{N}_])/giu, 'Óptimo')
        .replace(/(?<![\p{L}\p{N}_])NORMAL(?![\p{L}\p{N}_])/giu, 'Normal')
        .replace(/(?<![\p{L}\p{N}_])RUTA_([A-D]):\s*/giu, 'Ruta Clínica $1 • ')
        .replace(/(?<![\p{L}\p{N}_])RUTA_([A-D])(?![\p{L}\p{N}_])/giu, 'Ruta Clínica $1')
        .trim();
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
        bioenergetics,
        orthomolecularPrescription,
        biosecuritySemaphore,
        metabolicAgeStudy
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
                bioenergetics: null,
                orthomolecularPrescription: null,
                biosecuritySemaphore: null,
                metabolicAgeStudy: null
            };
        }

        const rawNodes = Array.isArray(data.ifm_nodes_matrix) ? data.ifm_nodes_matrix : [];
        const nodes = rawNodes.map((node, idx) => {
            // Filtrar falsos positivos legados como NORMAL (-) en tiempo de lectura
            const safeBiomarkers = (Array.isArray(node.key_biomarkers) ? node.key_biomarkers : [])
                .filter(b => !isBiomarkerStringActuallyNormal(b));
            const isHomeostasis = node.status === 'HOMEOSTASIS' || (safeBiomarkers.length === 0 && !['CRÍTICO', 'PRIORIDAD_ALTA', 'ALERTA_MODERADA'].includes(node.status));
            const anomalyCount = safeBiomarkers.length > 0 ? safeBiomarkers.length : (isHomeostasis ? 0 : 1);
            const isHighPriority = !isHomeostasis && (node.status === 'CRÍTICO' || node.status === 'PRIORIDAD_ALTA' || anomalyCount >= 2);
            const needsReview = Boolean(node.requires_clinical_review || node.validation_status === 'REQUIERE_REVISIÓN');
            const axisBadgeCode = node.accredited_cie10 || node.functionalCode || `IFM-0${idx + 1}`;

            // Cálculo termodinámico de posición en la barra tripartita (0% - 100%)
            let positionPct = 50;
            if (!isHomeostasis) {
                positionPct = Math.min(93, 70 + (anomalyCount * 4.5));
            }

            const cleanName = sanitizeClinicalSpanish(
                String(node.nodeName || node.nodeId || `Nodo ${idx + 1}`)
                    .replace(/^(?:(?:Nodo\s*)?\d+[.:\s-]*)+/i, '')
                    .trim()
            );

            // Guardia de lectura SSoTT contra contradicciones legadas en expedientes históricos
            const rawFocus = sanitizeClinicalSpanish(String(node.therapeutic_focus || ''));
            const calciumLocked = Boolean(data?.orthomolecular_prescription?.has_calcium_contraction_lock);
            const isMaintenanceKcal = (data?.bioenergetics?.caloricDeltaType || 'MANTENIMIENTO_RECOMPOSICION') !== 'DEFICIT_TERMODINAMICO';
            const targetKcalVal = data?.bioenergetics?.targetKcal || 2000;
            const hasLegacyContradiction = (
                /(quelaci[óo]n|silimarina|glutati[óo]n|fitoterapia)/i.test(rawFocus) ||
                (calciumLocked && /suplementaci[óo]n[^.]*\bcalcio\b/i.test(rawFocus) && !/exclusi[óo]n|evita/i.test(rawFocus)) ||
                (isMaintenanceKcal && /hipocal[óo]ric/i.test(rawFocus))
            );
            let safeTherapeuticFocus = rawFocus;
            if (hasLegacyContradiction) {
                if (node.nodeId === 'NODO_7_ESTRUCTURAL' && calciumLocked) {
                    safeTherapeuticFocus = 'Soporte de matriz osteoarticular y colágeno con exclusión estricta de suplementos aislados de calcio inorgánico (priorizando hidratación, magnesio, vitamina D/K2 alimentaria y péptidos de colágeno de 34Plus® en 500 ml de agua simple 💧).';
                } else if (node.nodeId === 'NODO_2_BIOTRANSFORMACION') {
                    safeTherapeuticFocus = `Soporte hepatobiliar y renal mediante alimentación antiinflamatoria normocalórica (${targetKcalVal} kcal/día), hidratación estructurada y titulación prudente sin agentes quelantes externos.`;
                } else {
                    safeTherapeuticFocus = rawFocus
                        .replace(/quelaci[óo]n[^,.;]*/gi, 'hidratación renal y fibra soluble alimentaria')
                        .replace(/silimarina|glutati[óo]n/gi, 'fitonutrientes alimentarios')
                        .replace(/dieta\s+hipocal[óo]rica/gi, `alimentación antiinflamatoria (${targetKcalVal} kcal/día)`);
                }
            }

            return {
                ...node,
                axisBadgeCode,
                therapeutic_focus: safeTherapeuticFocus,
                indexOrder: idx + 1,
                shortName: cleanName,
                cleanName,
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
            bioenergetics: data.bioenergetics || null,
            orthomolecularPrescription: data.orthomolecular_prescription || null,
            biosecuritySemaphore: data.biosecurity_semaphore || data.orthomolecular_prescription?.biosecurity_semaphore || null,
            metabolicAgeStudy: data.metabolic_age_study || data.canonical_clinical_plan?.metabolicAgeStudy || null
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

    // Filtrar ecos redundantes de biomarcadores crudos para aislar salvaguardas de bioseguridad y hard locks (incluyendo bloqueo de calcio exógeno en registro NOM-004)
    const criticalSafeguards = useMemo(() => {
        const hydTarget = orthomolecularPrescription?.hydrationTargetLiters || orthomolecularPrescription?.therapeutic_contract?.hydrationTargetLiters || '2.3';
        const clinicalMineralSafeguard = orthomolecularPrescription?.calcium_clinical_safeguard_text || (
            orthomolecularPrescription?.has_calcium_contraction_lock
                ? `Riesgo biofísico de calcificación ectópica: se excluye suplementación aislada con sales de calcio inorgánico; priorizar hidratación estructurada (${hydTarget} L/día), magnesio y vitamina K2 alimentaria.`
                : null
        );
        const filtered = alertItems
            .filter(item => {
                const str = String(item);
                const isRawEcho = /^ALERTA\s*(?:\d+|NODO)/i.test(str) && /(?:\(Ref:|\d+\.\d+|\b[A-Z_]{4,}\b)/.test(str) && !/SAFEGUARD|SALVAGUARDA|BLOQUEAD|CONTRAINDICA|PROHIBID|LOCK|RIESGO|SEMÁFORO/i.test(str);
                return !isRawEcho;
            })
            .map(item => {
                const str = String(item);
                if (/^SALVAGUARDA\s+MINERAL/iu.test(str) && /Detectamos\s+tendencia/iu.test(str) && clinicalMineralSafeguard) {
                    return `SALVAGUARDA MINERAL (BLOQUEO DE CALCIO EXÓGENO): ${clinicalMineralSafeguard}`;
                }
                return str;
            });
        if (
            orthomolecularPrescription?.has_calcium_contraction_lock &&
            clinicalMineralSafeguard &&
            !filtered.some((s) => /calcio\s+inorg[áa]nico|calcio\s+ex[óo]geno|calcificaci[óo]n\s+ect[óo]pica|calcio\s+fuera\s+del\s+hueso/i.test(String(s)))
        ) {
            filtered.push(`SALVAGUARDA MINERAL (BLOQUEO DE CALCIO EXÓGENO): ${clinicalMineralSafeguard}`);
        }
        return filtered;
    }, [alertItems, orthomolecularPrescription]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* 1. SELECTOR HORIZONTAL DE PÍLDORAS INTERACTIVAS (❖ NODOS IFM:) */}
            {processedNodes.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
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
                                        ? 'bg-white text-[#B70E0C]'
                                        : 'bg-[#B70E0C] text-white'
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
                                                ? 'bg-white text-[#B70E0C]'
                                                : 'bg-[#B70E0C] text-white'
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
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] space-y-2">
                <div className="flex flex-wrap items-center gap-2 tabular-nums">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#1C75BC]/10 text-[#1C75BC] text-[10px] font-extrabold tracking-wider">
                        {activeNodeMeta ? `NODO IFM 0${activeNodeMeta.indexOrder}` : 'DOCTRINA CORTEX SSoTT v2.7'}
                    </span>
                    <span className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                        #IFM-{activeNodeMeta ? `700${activeNodeMeta.indexOrder}` : '7000'}
                    </span>
                    <span className="text-[11px] font-semibold text-[#334155] dark:text-[#CBD5E1]">
                        • {totalNodesCount} Nodos IFM: <strong className="text-[#3AAA35]">{normalNodesCount} Normales</strong> / <strong className="text-[#B70E0C]">{alertNodesCount} Con Hallazgos</strong>
                    </span>

                    {/* Badge Inline de Estado Clínico Global con Triple Señal WCAG 2.2 AAA */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[10.5px] font-extrabold ${
                        alertNodesCount > 0
                            ? 'bg-[#B70E0C]/8 text-[#B70E0C] border-[#B70E0C]/25'
                            : 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30'
                    }`}>
                        {alertNodesCount > 0 ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <CheckCircle2 className="w-3 h-3 shrink-0" />}
                        <span className="text-[9.5px] uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] font-bold">Estado Global:</span>
                        <span>{alertNodesCount > 0 ? `Alerta Prioritaria (${globalAlertPct}%)` : 'Homeostasis Óptima'}</span>
                        <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] tabular-nums ${
                            alertNodesCount > 0 ? 'bg-[#B70E0C] text-white' : 'bg-[#3AAA35] text-white'
                        }`}>
                            {alertNodesCount}/{totalNodesCount}
                        </span>
                    </span>

                    {bioenergetics && (
                        <span className="px-2.5 py-0.5 rounded-md bg-[#3AAA35]/10 text-[#3AAA35] border border-[#3AAA35]/30 text-[10px] font-extrabold tabular-nums">
                            {bioenergetics.equationUsed}: TMB {bioenergetics.bmr} kcal | Meta {bioenergetics.targetKcal} kcal
                        </span>
                    )}
                </div>

                <h3 className="text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                    {activeNodeMeta ? `${activeNodeMeta.indexOrder}. ${activeNodeMeta.cleanName}` : formatClinicalText(rutaActiva)}
                </h3>
                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                    {activeNodeMeta
                        ? activeNodeMeta.clinicalDescription
                        : 'Evaluación funcional integrativa de los 7 Nodos del Institute for Functional Medicine (IFM) con cobertura ontológica completa y dosificación de precisión.'}
                </p>
            </div>

            {/* 2.5 ESTUDIO MULTIVARIABLE DE EDAD METABÓLICA (EGM-51 v2 — SSoTT) */}
            {metabolicAgeStudy && selectedNodeId === 'ALL' && (
                metabolicAgeStudy.isSuppressedBySafetyGate ? (
                    <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] border-l-4 border-l-[#1C75BC] p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#1C75BC]/10 border border-[#1C75BC]/25 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-4 h-4 text-[#1C75BC]" strokeWidth={2} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                        ESTUDIO DE EDAD METABÓLICA • COMPUERTA PROTECTORA ACTIVA
                                    </span>
                                    <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                        Enfoque Clínico No Punitivo Activado por Seguridad de Ruta
                                    </h4>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/30">
                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                <span>Protección Clínica Activa</span>
                            </span>
                        </div>
                        <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium">
                            {sanitizeClinicalSpanish(metabolicAgeStudy.suppressionReasonText || 'Por protocolo de seguridad clínica, se omite la comparación punitiva de Edad Metabólica y se prioriza el acompañamiento funcional integral.')}
                        </p>
                    </div>
                ) : (metabolicAgeStudy.metabolicAge !== null && metabolicAgeStudy.metabolicAge !== undefined) && (
                    <div className={`bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] border-l-4 ${
                        Number(metabolicAgeStudy.deltaYears) > 1.5
                            ? 'border-l-[#B70E0C]'
                            : Number(metabolicAgeStudy.deltaYears) > 0.4
                                ? 'border-l-[#FFCC00]'
                                : 'border-l-[#3AAA35]'
                    } p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] space-y-4 tabular-nums`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#334155]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#1C75BC]/10 border border-[#1C75BC]/25 flex items-center justify-center shrink-0">
                                    <Clock className="w-4 h-4 text-[#1C75BC]" strokeWidth={2} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                        ESTUDIO MULTIVARIABLE DE EDAD METABÓLICA • EGM-51 v2
                                    </span>
                                    <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                        Ponderación por Evidencia, Sexo Biológico y Altitud ({metabolicAgeStudy.altitudeMsnm || 2240} msnm)
                                    </h4>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/25">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                    <span>{metabolicAgeStudy.evidenceTierBadge || 'Certeza Clínica Integral'} ({metabolicAgeStudy.evidenceConfidencePct || 85}%)</span>
                                </span>
                                {Number(metabolicAgeStudy.deltaYears) > 1.5 ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#B70E0C]/10 text-[#B70E0C] border border-[#B70E0C]/30">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                        <span>Sobrecarga Reversible: +{metabolicAgeStudy.deltaYears} años</span>
                                    </span>
                                ) : Number(metabolicAgeStudy.deltaYears) > 0.4 ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#FFCC00] text-[#0F172A] border border-[#0F172A]/15">
                                        <Activity className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                        <span>Ajuste Leve: +{metabolicAgeStudy.deltaYears} años</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#3AAA35]/10 text-[#3AAA35] border border-[#3AAA35]/30">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                        <span>{Number(metabolicAgeStudy.deltaYears) < -0.4 ? `Reserva Joven (${metabolicAgeStudy.deltaYears} años)` : 'Homeostasis Conservada'}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] rounded-xl p-3 text-center">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] block">Edad Cronológica</span>
                                <span className="text-xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 block">{metabolicAgeStudy.chronologicalAge} años</span>
                            </div>
                            <div className={`border rounded-xl p-3 text-center ${
                                Number(metabolicAgeStudy.deltaYears) > 1.5
                                    ? 'bg-[#B70E0C]/5 border-[#B70E0C]/25'
                                    : 'bg-[#3AAA35]/5 border-[#3AAA35]/25'
                            }`}>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] block">Edad Metabólica</span>
                                <span className={`text-xl font-extrabold mt-0.5 block ${
                                    Number(metabolicAgeStudy.deltaYears) > 1.5 ? 'text-[#B70E0C]' : 'text-[#3AAA35]'
                                }`}>
                                    {metabolicAgeStudy.metabolicAgeExact ?? metabolicAgeStudy.metabolicAge} años
                                </span>
                            </div>
                            <div className="bg-[#3AAA35]/5 border border-[#3AAA35]/25 rounded-xl p-3 text-center">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] block">Meta Ciclo 1 (28d)</span>
                                <span className="text-xl font-extrabold text-[#3AAA35] mt-0.5 block">{metabolicAgeStudy.cycle1TargetAge28d} años</span>
                            </div>
                            <div className="bg-[#1C75BC]/5 border border-[#1C75BC]/25 rounded-xl p-3 text-center">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] block">Proyección 90 Días</span>
                                <span className="text-xl font-extrabold text-[#1C75BC] mt-0.5 block">{metabolicAgeStudy.cycle3ProjectionAge90d} años</span>
                            </div>
                        </div>

                        {metabolicAgeStudy.clinicalSummary && (
                            <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium">
                                {sanitizeClinicalSpanish(metabolicAgeStudy.clinicalSummary)}
                            </p>
                        )}
                    </div>
                )
            )}

            {/* 3. BENTO CARDS TERMODINÁMICAS DE LOS NODOS IFM */}
            {visibleNodes.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5">
                    {visibleNodes.map((node) => {
                        const borderLeftClass = node.isHomeostasis
                            ? 'border-l-[#3AAA35]'
                            : node.isHighPriority
                            ? 'border-l-[#B70E0C]'
                            : 'border-l-[#FFCC00]';

                        const badgeStyle = node.isHomeostasis
                            ? 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30'
                            : node.isHighPriority
                            ? 'bg-[#B70E0C]/10 text-[#B70E0C] border-[#B70E0C]/30'
                            : 'bg-[#FFCC00] text-[#0F172A] border-[#0F172A]/15 dark:bg-[#FFCC00]/15 dark:text-[#FEF9C3] dark:border-[#FFCC00]/50';

                        const badgeLabel = node.isHomeostasis
                            ? 'HOMEOSTASIS FISIOLÓGICA'
                            : node.isHighPriority
                            ? 'PRIORIDAD CLÍNICA ALTA'
                            : 'VIGILANCIA PREVENTIVA';

                        const markerBg = node.isHomeostasis ? 'bg-[#3AAA35]' : 'bg-[#1C75BC]';
                        const visiblePills = node.safeBiomarkers.slice(0, 12);
                        const extraPills = node.safeBiomarkers.slice(12);

                        return (
                            <div
                                key={node.nodeId}
                                className={`bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] border-l-4 ${borderLeftClass} p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] hover:shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all`}
                            >
                                {/* Cabecera de la Bento Card */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#334155]">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-[#0F172A] text-[#334155] dark:text-[#CBD5E1] tabular-nums">
                                                NODO 0{node.indexOrder}
                                            </span>
                                            <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                                {node.cleanName}
                                            </h4>
                                        </div>
                                        <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] mt-1">
                                            {node.clinicalDescription}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 self-start sm:self-center shrink-0 tabular-nums">
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-[#334155] dark:text-[#CBD5E1] block">
                                                {node.accredited_cie10 ? 'CIE-10 Acreditado • Hallazgos' : 'Eje Funcional • Hallazgos'}
                                            </span>
                                            <span className="text-xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight font-mono tabular-nums">
                                                {node.axisBadgeCode}
                                            </span>
                                            <span className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1] mx-1.5" aria-hidden="true">
                                                {' • '}
                                            </span>
                                            <span className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1] tabular-nums">
                                                ({node.anomalyCount} {node.anomalyCount === 1 ? 'parámetro' : 'parámetros'})
                                            </span>
                                        </div>

                                        {/* Píldora de Triple Señal WCAG 2.2 AAA */}
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border tracking-wide ${badgeStyle}`}>
                                            {node.isHomeostasis ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                                            <span>{badgeLabel}</span>
                                        </span>

                                        {node.needsReview && (
                                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-[#FFCC00] text-[#0F172A] border border-[#0F172A]/15 dark:bg-[#FFCC00]/15 dark:text-[#FEF9C3] dark:border-[#FFCC00]/50">
                                                CORRELACIÓN MÉDICA SUGERIDA
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Barra de Progreso Termodinámica Tripartita con Callout Flotante */}
                                <div className="my-4 bg-slate-50/90 dark:bg-[#0F172A]/70 border border-slate-200/70 dark:border-[#334155] rounded-xl p-3.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-[#334155] dark:text-[#CBD5E1] mb-2">
                                        <span>DEFICIENCIA / RIESGO</span>
                                        <span className="text-[#3AAA35] font-extrabold">
                                            ZONA ÓPTIMA FISIOLÓGICA (HOMEOSTASIS)
                                        </span>
                                        <span>EXCESO / DISFUNCIÓN ACTIVA</span>
                                    </div>

                                    <div className="relative h-6 rounded-lg overflow-visible flex items-center">
                                        <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200/80 dark:bg-[#1E293B] border border-slate-300/60 dark:border-[#334155]">
                                            <div className="w-1/3 h-full bg-gradient-to-r from-red-200/70 via-amber-200/70 to-emerald-200/50 border-r border-slate-300/80" />
                                            <div className="w-1/3 h-full bg-[#3AAA35]/25 flex items-center justify-center">
                                                <span className="text-[8px] font-extrabold text-[#3AAA35] uppercase tracking-widest select-none">
                                                    RANGO FISIOLÓGICO NORMAL
                                                </span>
                                            </div>
                                            <div className="w-1/3 h-full bg-gradient-to-r from-emerald-200/50 via-amber-200/70 to-red-200/80 border-l border-slate-300/80" />
                                        </div>

                                        <div
                                            className="absolute -top-1.5 transform -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                                            style={{ left: `${node.positionPct}%` }}
                                        >
                                            <div className={`px-2 py-0.5 rounded shadow-sm text-[10px] font-extrabold text-white whitespace-nowrap tabular-nums ${markerBg}`}>
                                                {node.isHomeostasis
                                                    ? 'Equilibrio Funcional (Óptimo)'
                                                    : `${node.axisBadgeCode} (${node.anomalyCount} ${node.anomalyCount === 1 ? 'Hallazgo' : 'Hallazgos'})`}
                                            </div>
                                            <div className={`w-2.5 h-2.5 rotate-45 -mt-1 ${markerBg} border border-white`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Biomarcadores Clave Aislados en el Nodo (Divulgación progresiva si > 12) */}
                                {visiblePills.length > 0 && (
                                    <div className="mb-3.5 space-y-2">
                                        <div className="flex flex-wrap gap-1.5">
                                            {visiblePills.map((bm, bIdx) => (
                                                <span
                                                    key={bIdx}
                                                    className="text-[10.5px] font-bold bg-slate-50 text-slate-700 border border-slate-200/90 px-2.5 py-1 rounded-lg"
                                                >
                                                    🔬 {formatClinicalBiomarker(bm)}
                                                </span>
                                            ))}
                                        </div>
                                        {extraPills.length > 0 && (
                                            <details className="group bg-slate-50/70 border border-slate-200/70 rounded-xl p-2.5">
                                                <summary className="cursor-pointer text-[11px] font-bold text-[#1C75BC] select-none">
                                                    Ver {extraPills.length} biomarcadores adicionales de este nodo
                                                </summary>
                                                <div className="flex flex-wrap gap-1.5 pt-2.5 mt-2 border-t border-slate-200/60">
                                                    {extraPills.map((bm, eIdx) => (
                                                        <span
                                                            key={eIdx}
                                                            className="text-[10.5px] font-bold bg-white text-slate-700 border border-slate-200/90 px-2.5 py-1 rounded-lg"
                                                        >
                                                            🔬 {formatClinicalBiomarker(bm)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                )}

                                {/* Pie de Tarjeta: Correlación Clínica y Enfoque Terapéutico */}
                                <div className={`rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                    node.isHomeostasis
                                        ? 'bg-[#3AAA35]/8 border border-[#3AAA35]/25 text-slate-900'
                                        : 'bg-[#FFCC00]/15 border border-[#FFCC00]/45 text-slate-900 dark:bg-[#FFCC00]/10 dark:text-slate-100'
                                }`}>
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-start gap-2">
                                            <span className="font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-white/90 border border-slate-200/80 text-slate-700 shrink-0 mt-0.5">
                                                ⓘ Síntesis Clínica
                                            </span>
                                            <p className="font-medium leading-relaxed text-xs">
                                                {formatClinicalText(node.summary)}
                                            </p>
                                        </div>
                                        {node.therapeutic_focus && (
                                            <p className="text-[11px] font-bold text-[#1C75BC] pl-1 pt-0.5">
                                                🎯 Enfoque Terapéutico: <span className="font-semibold text-slate-700">{formatClinicalText(node.therapeutic_focus)}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 4. BLOQUE INFERIOR DE SÍNTESIS ESTRATÉGICA, CAUSA RAÍZ Y BIOSEGURIDAD (LAYOUT HOMOLOGADO ANCHO COMPLETO) */}
            <div className="space-y-4 pt-1 w-full">
                {/* Bento Card 1: Diagnóstico Funcional de Causa Raíz (Fallback Exclusivo para Expedientes Legacy sin Matriz IFM) */}
                {processedNodes.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-[#1C75BC] p-5 shadow-xs">
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/20">
                                    ANÁLISIS ETIOLÓGICO DE BASE
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

                        {/* Renderizado Defensivo para Expedientes Legacy */}
                        {diagnosticItems.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {diagnosticItems.map((item, idx) => {
                                    const cieMatch = String(item).match(/[(\[]?(?:CIE-10:\s*)?([A-Z][0-9]{2}(?:\.[0-9]{1,2})?)[)\]]?/i);
                                    const cleanText = String(item)
                                        .replace(/^[•\s\d.-]+/, '')
                                        .trim();

                                    return (
                                        <div
                                            key={idx}
                                            className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 text-xs text-slate-700 leading-relaxed font-medium hover:bg-slate-100/70 transition-colors flex flex-col justify-between"
                                        >
                                            <div>
                                                <div className="flex items-start justify-between gap-2 mb-1.5">
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
                                                    {formatClinicalText(cleanText)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-slate-700 text-xs leading-relaxed font-medium text-justify">
                                {formatClinicalText(causaRaiz) || 'Evaluación de causa raíz completada.'}
                            </p>
                        )}

                        <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 font-medium">Doctrina Médica Funcional IFM</span>
                        </div>
                    </div>
                )}

                {/* Bento Card 2: Bioseguridad y Salvaguardas Clínicas (Homologación Lineal Desaturada) */}
                <div className={`bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] border-l-4 ${
                    (biosecuritySemaphore?.level === 'ROJO' || biosecuritySemaphore?.isPaused)
                        ? 'border-l-[#B70E0C]'
                        : (criticalSafeguards.length > 0 || biosecuritySemaphore?.level === 'AMARILLO' || biosecuritySemaphore?.isMicroDose)
                            ? 'border-l-[#FFCC00]'
                            : 'border-l-[#3AAA35]'
                } transition-all`}>
                    {/* Cabecera en 3 flex-items con Triple Señal WCAG 2.2 AAA */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-3.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFCC00]/25 text-[#0F172A] border border-[#FFCC00] dark:bg-[#FFCC00]/15 dark:border-[#FFCC00]/50 dark:text-[#FEF9C3]">
                                FILTRO DE INMUNIDAD NORMATIVA
                            </span>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 select-none">
                                <ShieldAlert className="w-4 h-4 text-[#B70E0C]" />
                                <span>Bioseguridad y Salvaguardas Clínicas</span>
                            </h3>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-extrabold tracking-wide border shrink-0 self-start sm:self-center ${
                            (biosecuritySemaphore?.level === 'ROJO' || biosecuritySemaphore?.isPaused)
                                ? 'bg-[#B70E0C] text-white border-[#B70E0C]'
                                : (criticalSafeguards.length > 0 || biosecuritySemaphore?.level === 'AMARILLO' || biosecuritySemaphore?.isMicroDose)
                                    ? 'bg-[#FFCC00] text-[#0F172A] border-[#EAB308] dark:bg-[#FFCC00]/15 dark:border-[#FFCC00]/50 dark:text-[#FEF9C3]'
                                    : 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30'
                        }`}>
                            {(biosecuritySemaphore?.level === 'ROJO' || biosecuritySemaphore?.isPaused) ? (
                                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            ) : (criticalSafeguards.length > 0 || biosecuritySemaphore?.level === 'AMARILLO' || biosecuritySemaphore?.isMicroDose) ? (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>
                                {biosecuritySemaphore?.badgeLabel || (criticalSafeguards.length > 0 ? 'VIGILANCIA ACTIVA' : 'BIOSEGURIDAD VERIFICADA')}
                            </span>
                        </span>
                    </div>

                    {/* Desglose Exclusivo de Salvaguardas en Filas Horizontales Lineales */}
                    {criticalSafeguards.length > 0 ? (
                        <div className="space-y-2">
                            {criticalSafeguards.map((alt, aIdx) => {
                                const isCritical = /SAFEGUARD|SALVAGUARDA|BLOQUEADO|CONTRAINDICADA|PROHIBIDO|LOCK|PRIORIDAD MÉDICA|PAUSA PREVENTIVA/i.test(alt);
                                const cleanAlert = String(alt)
                                    .replace(/^[•\s\d.-]+/, '')
                                    .trim();

                                return (
                                    <div
                                        key={aIdx}
                                        className="bg-slate-50/60 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-2.5 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                                    >
                                        <div className="flex-1 space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                {isCritical ? (
                                                    <ShieldAlert className="w-4 h-4 text-[#B70E0C] shrink-0" />
                                                ) : (
                                                    <AlertTriangle className="w-4 h-4 text-[#0F172A] dark:text-[#FEF9C3] shrink-0" />
                                                )}
                                                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                                                    {isCritical ? 'Salvaguarda de Bioseguridad y Titulación' : 'Precaución Clínica Activa'}
                                                </span>
                                            </div>
                                            <p className="text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium pl-6">
                                                {formatClinicalText(cleanAlert)}
                                            </p>
                                        </div>
                                        <span className={`text-[9.5px] font-extrabold px-2.5 py-1 rounded-lg border shrink-0 self-start sm:self-center uppercase tracking-wider pl-6 sm:pl-2.5 ${
                                            isCritical
                                                ? 'bg-[#B70E0C]/10 text-[#B70E0C] border-[#B70E0C]/30'
                                                : 'bg-[#FFCC00] text-[#0F172A] border-[#EAB308] dark:bg-[#FFCC00]/15 dark:border-[#FFCC00]/50 dark:text-[#FEF9C3]'
                                        }`}>
                                            {isCritical ? 'Bloqueo / Ajuste' : 'Vigilancia'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-[#3AAA35]/10 border border-[#3AAA35]/30 rounded-xl p-3.5 text-xs text-slate-800 dark:text-slate-200 font-medium flex items-center gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-[#3AAA35] shrink-0" />
                            <span>Homeostasis y Bioseguridad Normativa Verificada: Sin contraindicaciones activas ni bloqueos de esfuerzo detectados.</span>
                        </div>
                    )}

                    {/* Estudios Paraclínicos de Control Solicitados (Espejo SSoTT con Vista Paciente) */}
                    {Array.isArray(biosecuritySemaphore?.recommendedLabs) && biosecuritySemaphore.recommendedLabs.length > 0 && (
                        <div className="mt-2.5 bg-[#1C75BC]/5 dark:bg-[#1C75BC]/10 border border-[#1C75BC]/25 rounded-xl p-3.5 space-y-2">
                            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#1C75BC] dark:text-[#93C5FD]">
                                🔬 Estudios Paraclínicos de Control Solicitados (Confirmación Diagnóstica NOM-004):
                            </p>
                            <div className="grid grid-cols-1 gap-1.5">
                                {biosecuritySemaphore.recommendedLabs.map((lab, lIdx) => (
                                    <div
                                        key={lIdx}
                                        className="flex items-start gap-2 text-[11.5px] text-slate-700 dark:text-slate-200 font-semibold"
                                    >
                                        <span className="text-[#1C75BC] dark:text-[#93C5FD] font-extrabold shrink-0">•</span>
                                        <span>{formatClinicalText(lab)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pie de Tarjeta Estándar */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-[#334155] mt-3 flex items-center justify-between text-[10px]">
                        <span className="text-[#334155] dark:text-[#CBD5E1] font-medium">ⓘ Salvaguarda biomecánica, renal y hemodinámica de prescripción</span>
                    </div>
                </div>

                {/* Bento Card 3: Estrategia Terapéutica Integral (Homologación Lineal Desaturada) */}
                <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] border-l-4 border-l-[#3AAA35] transition-all">
                    {/* Cabecera en 3 flex-items */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#334155] mb-3 select-none">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#3AAA35]/10 text-[#3AAA35] border border-[#3AAA35]/30">
                                PRESCRIPCIÓN ORTOMOLECULAR INTEGRAL
                            </span>
                            <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                                <Activity className="w-4 h-4 text-[#3AAA35]" />
                                <span>Estrategia Terapéutica Integral</span>
                            </h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold tracking-wide border shrink-0 self-start sm:self-center bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30">
                            {orthomolecularPrescription?.protocolName || biosecuritySemaphore?.badgeLabel || 'Prescripción Adaptativa'}
                        </span>
                    </div>

                    {/* Metas Bioenergéticas Aplanadas (Inline desaturado sin micro-píldoras gruesas) */}
                    {bioenergetics && (
                        <div className="my-2.5 text-[10.5px] text-[#334155] dark:text-[#CBD5E1] font-medium flex flex-wrap items-center gap-x-2 gap-y-1 pb-3 border-b border-slate-100/80 dark:border-[#334155] tabular-nums">
                            <span className="font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider text-[9.5px]">Metas Bioenergéticas:</span>
                            {bioenergetics.tdee && (
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                    <span className="text-[#334155] dark:text-[#CBD5E1]">Gasto Total (TDEE):</span>
                                    <strong className="text-[#0F172A] dark:text-[#F8FAFC] font-bold tabular-nums">{bioenergetics.tdee} kcal</strong>
                                </span>
                            )}
                            {bioenergetics.targetKcal && (
                                <>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-1 tabular-nums">
                                        <span className="text-[#334155] dark:text-[#CBD5E1]">Meta Calórica:</span>
                                        <strong className="text-[#0F172A] dark:text-[#F8FAFC] font-bold tabular-nums">{bioenergetics.targetKcal} kcal/día</strong>
                                    </span>
                                </>
                            )}
                            {bioenergetics.bmr && (
                                <>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-1 tabular-nums">
                                        <span className="text-[#334155] dark:text-[#CBD5E1]">TMB:</span>
                                        <strong className="text-[#0F172A] dark:text-[#F8FAFC] font-bold tabular-nums">{bioenergetics.bmr} kcal</strong>
                                    </span>
                                </>
                            )}
                            {(orthomolecularPrescription?.hydrationTargetLiters || bioenergetics.weightKg) && (
                                <>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-1 tabular-nums">
                                        <span className="text-[#334155] dark:text-[#CBD5E1]">Hidratación Meta:</span>
                                        <strong className="text-[#1C75BC] dark:text-[#93C5FD] font-bold tabular-nums">
                                            {orthomolecularPrescription?.hydrationTargetLiters || Math.min(3.2, Math.max(1.8, Number((((Number(bioenergetics.weightKg) || 70) * 32) / 1000).toFixed(1))))} L/día
                                        </strong>
                                    </span>
                                </>
                            )}
                            {bioenergetics.equationUsed && (
                                <>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[#334155] dark:text-[#CBD5E1] text-[10px]">Fórmula: {bioenergetics.equationUsed}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Distribución Lineal en Filas Horizontales de Ancho Completo */}
                    <div className="space-y-2.5 my-3">
                        {nutricion && (
                            <div className="bg-slate-50/60 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-3 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                                <div className="flex-1 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">🥗</span>
                                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                                            Nutrición Defensora y Modulación Metabólica
                                        </span>
                                    </div>
                                    <p className="text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium pl-6">
                                        {formatClinicalText(nutricion)}
                                    </p>
                                </div>
                                <span className="text-[9.5px] font-extrabold px-2.5 py-1 rounded-lg border shrink-0 self-start sm:self-center uppercase tracking-wider bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30 pl-6 sm:pl-2.5">
                                    Modulación Activa
                                </span>
                            </div>
                        )}

                        {readaptacion && (
                            <div className="bg-slate-50/60 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-3 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                                <div className="flex-1 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">🏃</span>
                                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                                            Readaptación Biomecánica y Prescripción de Movimiento
                                        </span>
                                    </div>
                                    <p className="text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium pl-6">
                                        {formatClinicalText(readaptacion)}
                                    </p>
                                </div>
                                <span className="text-[9.5px] font-extrabold px-2.5 py-1 rounded-lg border shrink-0 self-start sm:self-center uppercase tracking-wider bg-[#1C75BC]/10 text-[#1C75BC] border-[#1C75BC]/30 pl-6 sm:pl-2.5">
                                    Readaptación Progresiva
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Sistemas Fisiológicos Implicados Aplanados */}
                    {Array.isArray(sistemas) && sistemas.length > 0 && (
                        <div className="my-2 text-[10.5px] text-slate-500 font-medium flex flex-wrap items-center gap-x-2 gap-y-1 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                            <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[9.5px]">Sistemas Fisiológicos:</span>
                            {sistemas.map((sistema, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5">
                                    <span className="text-slate-700 dark:text-slate-200 font-semibold">{formatClinicalText(sistema)}</span>
                                    {idx < sistemas.length - 1 && <span className="text-slate-300">•</span>}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Cronobiología Circadiana Acoplada al Semáforo Clínico de Bioseguridad */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                ⏱️ Esquema Circadiano Sincronizado al Despertar (33Plus® / 34Plus®)
                            </span>
                            <span className="text-[10px] font-bold text-[#3AAA35] bg-[#3AAA35]/10 px-2 py-0.5 rounded border border-[#3AAA35]/30">
                                {formatClinicalText(
                                    orthomolecularPrescription?.dietaryPlan?.regimenBadge ||
                                    ((Number(bioenergetics?.macros?.carbs) > 0 && Number(bioenergetics?.macros?.carbs) <= 15)
                                        ? 'NutriKeto Clínico (0 Picante • 0 Cerdo • 0 Azúcares)'
                                        : 'Alimentación Antiinflamatoria (0 Picante • 0 Cerdo • 0 Azúcares)')
                                )}
                            </span>
                        </div>

                        {(biosecuritySemaphore?.level === 'ROJO' || biosecuritySemaphore?.isPaused) ? (
                            <div className="bg-[#B70E0C]/10 border border-[#B70E0C]/35 rounded-xl p-3.5 text-xs text-slate-800 dark:text-slate-100 flex items-start gap-2.5">
                                <ShieldAlert className="w-4 h-4 text-[#B70E0C] shrink-0 mt-0.5" />
                                <div>
                                    <strong className="font-extrabold text-[#B70E0C] block">Pausa Preventiva Médica (0 sobres activos):</strong>
                                    <span className="text-[11px] leading-relaxed">
                                        {formatClinicalText(biosecuritySemaphore?.honestExplanation || 'Se difiere temporalmente el inicio de 33Plus® y 34Plus® hasta contar con valoración médica y estudios de laboratorio de control.')}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2.5 text-xs">
                                {(Array.isArray(orthomolecularPrescription?.circadianSchedule) && orthomolecularPrescription.circadianSchedule.length > 0
                                    ? orthomolecularPrescription.circadianSchedule
                                    : [
                                        {
                                            tomaNumber: 1,
                                            timeSlot: 'Al despertar en ayunas',
                                            formula: '33Plus®',
                                            dosage: '1 sobre (10.6 g) disuelto en 300 ml de agua natural o tibia',
                                            clinicalObjective: 'Ignición mitocondrial, oxigenación microvascular y producción limpia de ATP.'
                                        },
                                        {
                                            tomaNumber: 2,
                                            timeSlot: 'A media mañana',
                                            formula: '33Plus®',
                                            dosage: '1 sobre (10.6 g) disuelto en 300 ml de agua natural',
                                            clinicalObjective: 'Enfoque cognitivo, sensibilidad metabólica y sostén energético diurno.'
                                        },
                                        {
                                            tomaNumber: 3,
                                            timeSlot: 'A media tarde',
                                            formula: '34Plus®',
                                            dosage: '1 sobre (11.4 g) disuelto en MÍNIMO 500 ml de agua simple 💧',
                                            clinicalObjective: 'Reparación de barrera mucosa intestinal y equilibrio electrolítico.'
                                        },
                                        {
                                            tomaNumber: 4,
                                            timeSlot: '30 a 60 min antes de dormir',
                                            formula: '34Plus®',
                                            dosage: '1 sobre (11.4 g) disuelto en MÍNIMO 500 ml de agua simple 💧',
                                            clinicalObjective: 'Regeneración estructural nocturna y síntesis de colágeno.'
                                        }
                                    ]
                                ).map((slot, sIdx) => {
                                    const rawFormula = String(slot.formula || '');
                                    const rawDosage = String(slot.dosage || slot.dose || '');
                                    const firstSegmentDosage = rawDosage.split('•')[0] || '';
                                    const hasActiveSachetWeek1 = /\b(?:1|2|1\/2|1\/4|medio|cuarto|un)\s+sobres?\b/i.test(firstSegmentDosage);
                                    const isPureHydrationFormula = !rawFormula.includes('33') && !rawFormula.includes('34');
                                    const isWaterOnlyWeek1 =
                                        isPureHydrationFormula ||
                                        (!hasActiveSachetWeek1 && /(?:iniciar\s+solo\s+con\s+agua|solo\s+(?:con\s+)?agua\s+(?:natural|simple)|hidrataci[óo]n\s+preparatoria|pausa\s+preventiva|0\s+sobres)/i.test(firstSegmentDosage));
                                    const isActive33 = !isWaterOnlyWeek1 && rawFormula.includes('33');
                                    const isActive34 = !isWaterOnlyWeek1 && rawFormula.includes('34');
                                    const displayFormula = isWaterOnlyWeek1 && rawFormula.includes('33')
                                        ? '💧 Hidratación Preparatoria (Semana 1 — previo a 33Plus® en Semana 2)'
                                        : isWaterOnlyWeek1 && rawFormula.includes('34')
                                            ? '💧 Hidratación Preparatoria (Semana 1 — previo a 34Plus® en Semana 2)'
                                            : formatClinicalText(rawFormula);
                                    const slotLabel = slot.tomaNumber ? `Toma ${slot.tomaNumber}` : (slot.slot || `Toma ${sIdx + 1}`);
                                    const slotMoment = slot.timeSlot || slot.moment || '';
                                    const slotDose = formatClinicalText(rawDosage.replace(/🍵/g, '💧'));
                                    const slotObj = formatClinicalText(slot.clinicalObjective || slot.patientObjective || slot.purpose || '');

                                    return (
                                        <div
                                            key={sIdx}
                                            className={`rounded-xl p-3 space-y-1 border ${
                                                isActive33
                                                    ? 'bg-[#B70E0C]/5 dark:bg-[#B70E0C]/15 border-[#B70E0C]/25 dark:border-[#B70E0C]/45'
                                                    : isActive34
                                                        ? 'bg-[#3AAA35]/5 dark:bg-[#3AAA35]/15 border-[#3AAA35]/25 dark:border-[#3AAA35]/45'
                                                        : 'bg-[#1C75BC]/5 dark:bg-[#1C75BC]/15 border-[#1C75BC]/25 dark:border-[#1C75BC]/45'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`inline-flex items-center gap-1.5 font-extrabold text-[11px] ${
                                                    isActive33
                                                        ? 'text-[#B70E0C] dark:text-[#FECACA]'
                                                        : isActive34
                                                            ? 'text-[#3AAA35] dark:text-[#DCFCE7]'
                                                            : 'text-[#1C75BC] dark:text-[#93C5FD]'
                                                }`}>
                                                    {isActive33 ? (
                                                        <Zap className="w-3.5 h-3.5 text-[#B70E0C] dark:text-[#FECACA] shrink-0" />
                                                    ) : (
                                                        <Droplets className={`w-3.5 h-3.5 shrink-0 ${isActive34 ? 'text-[#3AAA35] dark:text-[#DCFCE7]' : 'text-[#1C75BC] dark:text-[#93C5FD]'}`} />
                                                    )}
                                                    <span>{slotLabel}: {slotMoment}</span>
                                                </span>
                                            </div>
                                            <div className="text-[10.5px] text-slate-800 dark:text-slate-200 font-bold">
                                                {displayFormula} • <span className="text-[#1C75BC] dark:text-[#93C5FD]">{slotDose}</span>
                                            </div>
                                            <p className="text-[10.5px] text-slate-600 dark:text-slate-300 leading-snug">
                                                {slotObj}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Pie de Tarjeta Estándar */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-[#334155] mt-3 flex items-center justify-between text-[10px]">
                        <span className="text-[#334155] dark:text-[#CBD5E1] font-medium">ⓘ Prescripción nutricional adaptativa acoplada al Semáforo Clínico de Bioseguridad</span>
                    </div>
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
    onPhaseComplete,
    apiContext
}) {
    const identityLock = useClinicalGenome(state => state.identityLock);
    const electretTelemetry = useClinicalGenome(state => state.electretTelemetry);
    const { isLactante, isPediatrico, patientAge } = usePatientLinguistics(patientData);
    const citationId = useMemo(() => {
        const candidates = [
            patientData?.identificacion?.idCita,
            patientData?.identificacion?.citaId,
            patientData?.profile?.citaId,
            patientData?.profile?.citationId,
            apiContext?.citaId,
            apiContext?.idCita,
            patientData?.idCita,
            patientData?.citaId
        ];
        for (const c of candidates) {
            if (c !== null && c !== undefined) {
                const s = String(c).trim();
                if (s && s !== '0' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') {
                    return s;
                }
            }
        }
        return null;
    }, [patientData, apiContext]);

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
        } else if (hasPersistedIfmMatrix && setMessages) {
            // Rehidratación atómica de opciones de confirmación tras F5
            setMessages(prev => {
                if (!Array.isArray(prev) || prev.length === 0) return prev;
                const lastIdx = prev.length - 1;
                const lastMsg = prev[lastIdx];
                if (lastMsg?.role === 'assistant' && (!Array.isArray(lastMsg.options) || lastMsg.options.length === 0)) {
                    const updated = [...prev];
                    updated[lastIdx] = {
                        ...lastMsg,
                        options: [
                            { label: "✅ Confirmar y Sellar Expediente ➔", value: "APPROVE_AND_SEAL_DOSSIER" },
                            { label: "🔄 Re-Sintetizar Expediente", value: "RESYNTHESIZE_DOSSIER" }
                        ]
                    };
                    return updated;
                }
                return prev;
            });
        }
    }, [messages, patientData?.clinical_dossier, setMessages]);

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
                if (!citationId) {
                    isSynthesizingRef.current = false;
                    if (setMessages) {
                        setMessages(prev => [
                            ...prev.filter(m => m.inputType !== 'analyzing'),
                            {
                                role: 'assistant',
                                content: "⛔ **Bloqueo de Integridad NOM-004:** No se detectó un folio de cita válido en el expediente activo. Se abortó la escritura en base de datos para evitar contaminar otro registro clínico.",
                                avatar: tiloImg
                            }
                        ]);
                    }
                    return;
                }
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const resolvedUid = patientData?.profile?.usuarioId || patientData?.identificacion?.usuarioId || apiContext?.userId || null;

                // 🛡️ SIN CONDICIÓN DE CARRERA: Presincronización Basal T0 de los 245 biomarcadores ANTES de la síntesis
                try {
                    await fetch(`${apiUrl}/api/cortex/presync-baseline`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            citationId,
                            userId: resolvedUid,
                            rawPatientData: patientData,
                            electret245Baseline: electretTelemetry || patientData?.electretTelemetry || {}
                        })
                    });
                } catch (presyncErr) {
                    console.warn("⚠️ Presync baseline notice:", presyncErr);
                }

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
                        suggested_management: ["Plan Nutracéutico Personalizado 33Plus® / 34Plus®"],
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
                if (!citationId) {
                    if (setMessages) {
                        setMessages(prev => [
                            ...prev,
                            {
                                role: 'assistant',
                                content: "⛔ **Bloqueo de Integridad NOM-004:** Folio de cita ausente o inválido. No es posible sellar el expediente en base de datos sin identificador de cita legítimo.",
                                avatar: tiloImg
                            }
                        ]);
                    }
                    return;
                }
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
                        ssot_contract_version: "2.8.2",
                        status: "approved"
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
            const cleanText = String(userMsg).trim().toLowerCase();
            const isAffirmative = /^(confirmar|sellar|aprobar|avanzar|continuar|listo|ok|siguiente|proceder|adelante|si|sí)\b/i.test(cleanText) ||
                cleanText.includes('confirmar') || cleanText.includes('sellar') || cleanText.includes('aprobar');

            if (isAffirmative && patientData?.clinical_dossier?.ifm_nodes_matrix?.length > 0) {
                if (setMessages) {
                    setMessages(prev => [
                        ...prev.map(m => m.options ? { ...m, options: undefined } : m),
                        { role: 'user', content: userMsg }
                    ]);
                }
                await handleApproveDossier();
                return;
            }

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
