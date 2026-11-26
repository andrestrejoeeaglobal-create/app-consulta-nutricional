import React, { useState } from 'react';
import {
    Activity,
    ShieldAlert,
    AlertTriangle,
    Zap,
    Heart,
    Utensils,
    Droplets,
    ShieldCheck,
    Bone,
    CheckCircle2,
    Footprints,
    Baby,
    Sparkles,
    Lock,
    Calendar,
    Clock,
    Copy
} from 'lucide-react';
import { DiagnosticoRenderizado } from '../interview/Fase19_DiagnosticoIntegral';
import {
    resolvePatientFriendlyGuide,
    resolveVerifiedPatientAge,
    sanitizeClinicalSpanish,
    resolveBiometricMonitorLabel,
    resolveNom004IdentificationSheet,
    resolveScheduledAppointmentSummary
} from '../../utils/patientGuideAdapter';
import { isSyntheticElectretPayload } from '../../utils/electretParser';
import { copySSoTDocument, resolveDossierSealSha256 } from '../../utils/formatPlanForClipboard';
import { useClinicalToast } from '../../hooks/useClinicalToast';

function renderSystemSvgIcon(iconKey, className = 'w-4 h-4') {
    const key = String(iconKey || '').toLowerCase();
    switch (key) {
        case 'heart':
            return <Heart className={className} />;
        case 'utensils':
            return <Utensils className={className} />;
        case 'droplets':
            return <Droplets className={className} />;
        case 'shield':
        case 'shieldcheck':
            return <ShieldCheck className={className} />;
        case 'bone':
            return <Bone className={className} />;
        default:
            return <Activity className={className} />;
    }
}

export const TabDiagnosis = ({
    patientData,
    citationId,
    isPhase20EditMode,
    planViewMode: propPlanViewMode,
    setPlanViewMode: propSetPlanViewMode
}) => {
    const [activeTimelinePhase, setActiveTimelinePhase] = useState(1);

    const dossier = patientData?.clinical_dossier || {};
    const hasSynthesizedDossier = Boolean(
        dossier &&
        Array.isArray(dossier.ifm_nodes_matrix) &&
        dossier.ifm_nodes_matrix.length > 0 &&
        (
            dossier.status === 'SYNTHESIZED_READY_FOR_REVIEW' ||
            dossier.status === 'APPROVED_AND_SEALED' ||
            dossier.status === 'READY_FOR_PHASE_20' ||
            dossier.status === 'COMPLETED' ||
            dossier.status === 'synthesized' ||
            dossier.status === 'approved' ||
            Boolean(dossier.diagnostico_causa_raiz) ||
            Boolean(dossier.preliminary_diagnosis)
        )
    );

    const ifmNodes = Array.isArray(dossier.ifm_nodes_matrix) ? dossier.ifm_nodes_matrix : [];
    const ortho = dossier.orthomolecular_prescription || {};
    const bioenergetics = dossier.bioenergetics || ortho.bioenergetics_summary || null;

    // Modelo resiliente para la Vista Empática del Paciente (con fallback automático en citas históricas)
    const patientGuide = React.useMemo(() => {
        return resolvePatientFriendlyGuide(patientData || {});
    }, [patientData]);

    // Síntesis Fisiopatológica Multimodal CORTEX (Lectura Defensiva Sanitizada)
    const correlacionMultimodal = React.useMemo(() => {
        const rawCorr = patientData?.scan_data?.correlacion_multimodal ||
            patientData?.scan_data?.ocular_metrics?.correlacion_multimodal ||
            patientData?.scan_data?.lingual_metrics?.correlacion_multimodal;
        if (rawCorr && typeof rawCorr === 'object' && rawCorr.sintesis_fisiopatologica) {
            return {
                sintesis_fisiopatologica: sanitizeClinicalSpanish(rawCorr.sintesis_fisiopatologica),
                indice_prioridad_clinica: sanitizeClinicalSpanish(rawCorr.indice_prioridad_clinica || 'Moderado')
            };
        }
        const patientName = sanitizeClinicalSpanish(patientData?.profile?.name || patientData?.identificacion?.nombre || 'el paciente');
        return {
            sintesis_fisiopatologica: `Integración multimodal de bioseñales clínicas evaluadas para ${patientName}.`,
            indice_prioridad_clinica: 'Evaluado'
        };
    }, [patientData?.scan_data, patientData?.profile?.name, patientData?.identificacion?.nombre]);

    // Detección de alertas de alergias o estimulantes (estrictamente de lectura en Dashboard)
    const allergies = [
        ...(patientData?.history?.allergies?.food || []),
        ...(patientData?.history?.allergies?.drug || [])
    ];
    const hasAllergies = allergies.length > 0;
    const medications = patientData?.history?.medications || [];
    const hasPhentermine = medications.some(m => {
        const n = String(m?.name || m || '').toUpperCase();
        return n.includes('FENTER') || n.includes('ACXION') || n.includes('TERFAMEX');
    });
    const overrideActive = Boolean(patientData?.nutrition?.preferences?.safety_lock?.override_applied);
    const isRiskDetected = hasAllergies || hasPhentermine;

    const ageCandidate = resolveVerifiedPatientAge(patientData, 35).ageYears;

    // Extracción Dinámica de Patologías para Fallback en Vista Médica
    const rawDiag = patientData?.clinical_dossier?.human_approved_diagnosis || patientData?.preliminary_diagnosis || [];

    const classifyDiagnosisToIFMNode = (diagString) => {
        const str = (typeof diagString === 'string' ? diagString : (diagString?.nombre || diagString?.name || '')).toLowerCase();
        if (str.includes('absorción') || str.includes('intestinal') || str.includes('digest') || str.includes('leaky') || str.includes('disbiosis') || str.includes('k90')) {
            return {
                nodeKey: 'asimilacion',
                nodo: '1. Asimilación (Digestión / Absorción Intestinal)',
                cie10: 'K90.9',
                prioridad: 'Alta / Primaria (Nodo Raíz)',
                isRootNode: true
            };
        }
        if (str.includes('hígado') || str.includes('hepátic') || str.includes('esteatosis') || str.includes('renal') || str.includes('riñón') || str.includes('detox') || str.includes('n19') || str.includes('k76')) {
            return {
                nodeKey: 'biotransformacion',
                nodo: '2. Biotransformación y Eliminación',
                cie10: str.includes('renal') || str.includes('riñón') ? 'N19' : 'K76.0',
                prioridad: 'Elevada',
                isRootNode: false
            };
        }
        if (str.includes('alergia') || str.includes('inflama') || str.includes('inmun') || str.includes('t78')) {
            return {
                nodeKey: 'defensa',
                nodo: '3. Defensa y Reparación Inmunológica',
                cie10: 'T78.4',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        if (str.includes('tiroid') || str.includes('hormon') || str.includes('insulin') || str.includes('cortisol') || str.includes('diabet') || str.includes('prostat') || str.includes('e07')) {
            return {
                nodeKey: 'comunicacion',
                nodo: '4. Comunicación Neuroendocrina',
                cie10: 'E07.9',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        if (str.includes('metaból') || str.includes('mitocondr') || str.includes('fatiga') || str.includes('glucem') || str.includes('glucosa') || str.includes('e88')) {
            return {
                nodeKey: 'energia',
                nodo: '5. Bioenergética y Función Mitocondrial',
                cie10: 'E88.9',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        if (str.includes('hipoxia') || str.includes('hipertens') || str.includes('cardio') || str.includes('presión') || str.includes('vascular') || str.includes('g93')) {
            return {
                nodeKey: 'transporte',
                nodo: '6. Transporte Cardiovascular y Linfático',
                cie10: 'G93.1',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        if (str.includes('colágeno') || str.includes('fasci') || str.includes('sarcopeni') || str.includes('músculo') || str.includes('articul') || str.includes('m35')) {
            return {
                nodeKey: 'estructural',
                nodo: '7. Integridad Estructural y Biotensegridad',
                cie10: 'M35.9',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        return {
            nodeKey: 'general',
            nodo: 'Control Metabólico General',
            cie10: 'Z00.0',
            prioridad: 'Estándar',
            isRootNode: false
        };
    };

    const parsedDiagnoses = rawDiag.map(d => {
        if (!d) return null;
        const rawStr = typeof d === 'string' ? d.trim() : (d.nombre || d.name || d.descripcion || '');
        const nameStr = sanitizeClinicalSpanish(rawStr);
        if (!nameStr) return null;

        if (ageCandidate >= 18) {
            const lower = nameStr.toLowerCase();
            if (lower.includes('pediátr') || lower.includes('l-oms') || lower.includes('psicomotor') || lower.includes('lactante')) {
                return null;
            }
        }

        const meta = classifyDiagnosisToIFMNode(nameStr);
        return {
            nombre: nameStr,
            cie10: (typeof d === 'object' && d.cie10) ? d.cie10 : meta.cie10,
            prioridad: meta.prioridad,
            nodo: meta.nodo,
            nodeKey: meta.nodeKey,
            isRootNode: meta.isRootNode
        };
    }).filter(Boolean);

    const defaultAdultDiagnoses = [
        {
            nodo: '1. Asimilación y Salud Digestiva',
            nombre: '1. Asimilación: Eubiosis e Integridad Intestinal (K90.9 - Prioridad Primaria)',
            cie10: 'K90.9',
            prioridad: 'Alta / Primaria (Nodo Raíz)',
            nodeKey: 'asimilacion',
            isRootNode: true
        },
        {
            nodo: '2. Biotransformación y Salud Renal',
            nombre: '2. Biotransformación: Salud Hepática y Renal Fisiológica (Z71.3 - Preventivo)',
            cie10: 'Z71.3',
            prioridad: 'Elevada',
            nodeKey: 'biotransformacion',
            isRootNode: false
        }
    ];

    const cleanDiagnoses = parsedDiagnoses.length > 0 ? parsedDiagnoses : defaultAdultDiagnoses;

    // --- SISTEMA BIVALENTE DE VISTAS (PACIENTE vs MÉDICA) ---
    const [localPlanViewMode, setLocalPlanViewMode] = useState('medical');
    const activeViewMode = propPlanViewMode || localPlanViewMode;
    const setActiveViewMode = propSetPlanViewMode || setLocalPlanViewMode;

    // Consorcio Dinámico de Fuentes Clínicas Reales Evaluadas (Fases 0 a 18)
    const fuentesClinicas = React.useMemo(() => {
        const baseList = [
            {
                id: 'anamnesis',
                icon: '📋',
                badge: 'Fases 0 a 17',
                title: 'Historia Clínica y Hábitos',
                summary: 'Antecedentes personales, hábitos diarios, calidad de descanso y contexto alimentario evaluados bajo la NOM-004.'
            }
        ];
        try {
            const scan = patientData?.scan_data || {};
            const vitals = patientData?.vitals || {};
            const electret = scan.electret_metrics || patientData?.electretTelemetry || null;
            const ocular = scan.ocular_metrics || null;
            const lingual = scan.lingual_metrics || null;
            const extMetrics = scan.external_metrics || {};

            const hasLaboratory = Boolean(
                extMetrics?.labs ||
                patientData?.lab_results ||
                (scan.laboratorio_ocr && scan.laboratorio_ocr.analitos && scan.laboratorio_ocr.analitos.length > 0) ||
                (extMetrics?.sections && Object.keys(extMetrics.sections).length > 0) ||
                (extMetrics?.biomarkers && Object.keys(extMetrics.biomarkers).length > 0)
            );

            const cabinetStudies = Array.isArray(extMetrics?.external_studies?.clinical_imaging_and_cabinet)
                ? extMetrics.external_studies.clinical_imaging_and_cabinet
                : (Array.isArray(extMetrics?.imaging?.studies) ? extMetrics.imaging.studies : []);
            const hasCabinet = cabinetStudies.length > 0;

            const hasVisualSomatic = Boolean(
                (Array.isArray(scan.visual_metrics?.items) && scan.visual_metrics.items.length > 0) ||
                (Array.isArray(scan.visual_evidence) && scan.visual_evidence.length > 0) ||
                (Array.isArray(vitals.visual_evidence_photos) && vitals.visual_evidence_photos.length > 0)
            );

            const list = [...baseList];

            const rawElectretCats = scan.electret_metrics || patientData?.electretTelemetry?.categories || null;
            const hasRealElectret = Boolean(rawElectretCats && !isSyntheticElectretPayload(rawElectretCats));
            if (hasRealElectret || scan.electret_status === 'COMPLETED') {
                const sysCount = rawElectretCats ? Object.keys(rawElectretCats).length : 37;
                const synCount = Array.isArray(scan.electret_synthesis) ? scan.electret_synthesis.length : 0;
                const dynamicSummary = `Evaluación biofísica nativa de ${sysCount} sistemas y composición corporal${synCount > 0 ? ` (${synCount} hallazgos prioritarios de síntesis)` : ''} correlacionada con su protocolo Equipo en Acción® (33Plus® y 34Plus®).`;
                list.push({
                    id: 'electret',
                    icon: '⚡',
                    badge: 'Paso 1 (Fase 18)',
                    title: 'Escaneo Biofísico Electret',
                    summary: sanitizeClinicalSpanish(scan.electret_summary || electret?.summary || dynamicSummary)
                });
            }

            if (ocular && (ocular.pilares || ocular.sintesis_fisiopatologica || ocular.findings || ocular.status === 'COMPLETED')) {
                list.push({
                    id: 'ocular',
                    icon: '👁️',
                    badge: 'Paso 2 (Fase 18)',
                    title: 'Evaluación Visual Ocular',
                    summary: sanitizeClinicalSpanish(ocular.sintesis_fisiopatologica || 'Observación de microcirculación, oxigenación tisular e hidratación ocular.')
                });
            }

            if (lingual && (lingual.pilares || lingual.sintesis_fisiopatologica || lingual.findings || lingual.saburra || lingual.status === 'COMPLETED')) {
                list.push({
                    id: 'lingual',
                    icon: '👅',
                    badge: 'Paso 3 (Fase 18)',
                    title: 'Topografía Lingual Glosómica',
                    summary: sanitizeClinicalSpanish(lingual.sintesis_fisiopatologica || 'Inspección de hidratación celular, mucosa digestiva y circulación sublingual.')
                });
            }

            if (hasLaboratory) {
                const labTotal = Number(extMetrics?.totalParameters) || 0;
                const labAlerts = Number(extMetrics?.abnormalCount) || 0;
                const vigLabel = extMetrics?.vigencia?.study_date_display ? ` (${extMetrics.vigencia.study_date_display})` : '';
                const defaultLabSummary = labTotal > 0
                    ? `${labTotal} parámetros bioquímicos cuantitativos (${labAlerts} alertas fuera de rango)${vigLabel} integrados bajo NOM-004.`
                    : 'Parámetros bioquímicos cuantitativos integrados a su expediente.';
                list.push({
                    id: 'laboratorio',
                    icon: '🩸',
                    badge: 'Paso 4A (Fase 18)',
                    title: 'Estudios de Laboratorio',
                    summary: sanitizeClinicalSpanish(scan.laboratorio_summary || defaultLabSummary)
                });
            }

            if (hasCabinet) {
                const titles = cabinetStudies
                    .map((s) => s?.title || s?.modality)
                    .filter(Boolean)
                    .join(', ');
                list.push({
                    id: 'gabinete',
                    icon: '🏥',
                    badge: 'Paso 4B (Fase 18)',
                    title: 'Estudios de Gabinete e Imagenología',
                    summary: sanitizeClinicalSpanish(
                        `${cabinetStudies.length} ${cabinetStudies.length === 1 ? 'estudio consolidado' : 'estudios consolidados'} (${titles}) correlacionados con la Matriz IFM.`
                    )
                });
            }

            if (hasVisualSomatic) {
                list.push({
                    id: 'somatico',
                    icon: '📸',
                    badge: 'Paso 5 (Fase 18)',
                    title: 'Evidencia Visual Complementaria',
                    summary: sanitizeClinicalSpanish(vitals.visual_evidence_notes || 'Registro visual complementario de signos físicos evaluados en consulta.')
                });
            }

            const tcxActivity = patientData?.lifestyle_profile?.activity;
            const hasWearableTcx = Boolean(
                tcxActivity?.source_type === 'TELEMETRY_TCX' ||
                tcxActivity?.telemetry_metadata ||
                tcxActivity?.tcx_meta ||
                scan.wearable_telemetry
            );
            if (hasWearableTcx) {
                const devName = sanitizeClinicalSpanish(
                    tcxActivity?.telemetry_metadata?.device_name ||
                    tcxActivity?.tcx_meta?.device_name ||
                    scan.wearable_telemetry?.device_name ||
                    `${resolveBiometricMonitorLabel()} / Reloj Inteligente`
                );
                list.push({
                    id: 'wearable_tcx',
                    icon: '⌚',
                    badge: 'Telemetría Deportiva (Fase 11)',
                    title: `Telemetría Wearable (${devName})`,
                    summary: sanitizeClinicalSpanish(
                        `Registro cardiovascular y volumen aeróbico sincronizado desde ${devName} para calibrar sus zonas seguras de movimiento.`
                    )
                });
            }

            return list;
        } catch (srcErr) {
            console.warn('⚠️ [TabDiagnosis fuentesClinicas Fallback]:', srcErr);
            return baseList;
        }
    }, [patientData]);

    const semaphore = patientGuide.biosecuritySemaphore || {};
    const uiLabels = patientGuide.uiLabels || {};
    const semLevel = semaphore.level || semaphore.color || 'VERDE';
    const isRedSemaphore = semLevel === 'ROJO' || Boolean(semaphore.isPaused);
    const isYellowSemaphore = !isRedSemaphore && (semLevel === 'AMARILLO' || Boolean(semaphore.isMicroDose));

    const formula33 = patientGuide.formula33Card || {};
    const formula34 = patientGuide.formula34Card || {};
    const schedule = Array.isArray(patientGuide.circadianSchedule) ? patientGuide.circadianSchedule : [];
    const actionPlan = patientGuide.homeActionPlan || {};
    const nutritionCard = actionPlan.protective_nutrition || {};
    const hydrationCard = actionPlan.smart_hydration || {};
    const movementCard = actionPlan.gentle_movement || {};
    const isMeaningfulExclusion = (val) => {
        const clean = String(val || '').trim();
        if (!clean) return false;
        return !/^(ninguna?|ninguno|niega|negad[oa]s?|n\/a|na|sin\s+alergias?|sin\s+exclusiones?|sin\s+restricciones?|no|no\s+refiere|null|undefined|-+)$/i.test(clean);
    };
    const nutritionPillars = [
        ...(Array.isArray(nutritionCard.universalRules) ? nutritionCard.universalRules : []),
        ...(Array.isArray(nutritionCard.personalExclusions)
            ? nutritionCard.personalExclusions.filter(isMeaningfulExclusion).map((ex) => `Evitar: ${ex}`)
            : [])
    ];
    const cleanKeyRule34Plus = hydrationCard.keyRule34Plus
        ? String(hydrationCard.keyRule34Plus).replace(/💧\s*/g, '').replace(/\s+([.,;:])/g, '$1').trim()
        : '';
    const nom004SheetView = patientGuide?.nom004Sheet || resolveNom004IdentificationSheet(patientData || {});
    const scheduledApptView = patientGuide?.scheduledAppointmentSummary || resolveScheduledAppointmentSummary(patientData || {});
    const dossierSealSha = resolveDossierSealSha256(patientData || {}, citationId || patientData?.citaId || '');

    return (
        <div className="space-y-6 font-sans">
            {/* --- BANNER INFORMATIVO DE BIOSEGURIDAD (ESTRICTAMENTE DE LECTURA EN DASHBOARD) --- */}
            {isRiskDetected && !overrideActive && (
                <div className="bg-[#B70E0C]/10 border-l-4 border-[#B70E0C] p-5 rounded-2xl flex items-start gap-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
                    <ShieldAlert className="w-6 h-6 text-[#B70E0C] shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-[#B70E0C] font-extrabold text-xs uppercase tracking-wider">
                            Alerta de Seguridad Farmacológica y Alergológica Activa
                        </h3>
                        <p className="text-slate-800 dark:text-slate-200 text-xs mt-1 leading-relaxed">
                            Se registraron antecedentes relevantes ({hasAllergies ? 'alergias reportadas' : ''}{hasAllergies && hasPhentermine ? ' y ' : ''}{hasPhentermine ? 'uso de estimulantes centrales' : ''}). El Semáforo Clínico de Bioseguridad ajusta automáticamente la pauta nutricional.
                        </p>
                    </div>
                </div>
            )}

            {!hasSynthesizedDossier ? (
                <div className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-3xl p-10 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col items-center justify-center text-center space-y-4 my-4 animate-in fade-in duration-300">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1C75BC]/20 to-[#3AAA35]/20 flex items-center justify-center border border-[#1C75BC]/30 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
                        <Activity className="w-8 h-8 text-[#1C75BC] animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] font-extrabold tracking-widest text-[#1C75BC] bg-[#1C75BC]/10 px-3 py-1 rounded-full border border-[#1C75BC]/20">
                            Motor CORTEX SSoTT v2.7 • Síntesis Multimodal
                        </span>
                        <h3 className="text-base font-extrabold text-[#0F172A] dark:text-[#F8FAFC] pt-2">
                            Integrando Diagnóstico y Guía Empática del Paciente...
                        </h3>
                        <p className="text-xs text-[#334155] dark:text-[#CBD5E1] max-w-md mx-auto leading-relaxed">
                            Analizando las fuentes clínicas evaluadas para estructurar la Matriz IFM de 7 Nodos, el Semáforo de Bioseguridad y su Guía de Salud personalizada.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] bg-slate-50 dark:bg-[#0F172A] px-4 py-2 rounded-xl border border-slate-200/80 dark:border-[#334155]">
                        <span className="w-2 h-2 rounded-full bg-[#FFCC00] animate-pulse" />
                        Esperando conclusión del motor de síntesis en el panel conversacional
                    </div>
                </div>
            ) : (
                <div className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,0.05)] overflow-hidden flex flex-col mb-6">
                    {/* CONMUTADOR DUAL DE VISTAS (❖ MODO DE VISUALIZACIÓN:) */}
                    <div className="p-3 bg-white dark:bg-[#1E293B] border-b border-slate-200/90 dark:border-[#334155] flex flex-wrap items-center justify-between gap-2 select-none no-print">
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] px-2 shrink-0 select-none">
                                ❖ MODO DE VISUALIZACIÓN:
                            </span>

                            <button
                                type="button"
                                onClick={() => {
                                    try {
                                        setActiveViewMode('patient');
                                    } catch (e) {
                                        console.error('⚠️ [TabDiagnosis toggle patient]:', e);
                                    }
                                }}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border min-h-[40px] ${
                                    activeViewMode === 'patient'
                                        ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-[0_2px_8px_rgba(28,117,188,0.25)]'
                                        : 'bg-slate-100/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700 hover:bg-slate-200/70'
                                }`}
                            >
                                <span>👤 Guía Amigable para el Paciente</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    activeViewMode === 'patient'
                                        ? 'bg-white text-[#1C75BC]'
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}>
                                    5 Sistemas
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    try {
                                        setActiveViewMode('medical');
                                    } catch (e) {
                                        console.error('⚠️ [TabDiagnosis toggle medical]:', e);
                                    }
                                }}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border min-h-[40px] ${
                                    activeViewMode === 'medical'
                                        ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-[0_2px_8px_rgba(28,117,188,0.25)]'
                                        : 'bg-slate-100/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700 hover:bg-slate-200/70'
                                }`}
                            >
                                <span>🩺 Expediente Clínico Técnico</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    activeViewMode === 'medical'
                                        ? 'bg-white text-[#1C75BC]'
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}>
                                    NOM-004
                                </span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={async () => {
                                    const result = await copySSoTDocument({
                                        patientData,
                                        citationId,
                                        viewMode: activeViewMode
                                    });
                                    const showToast = useClinicalToast.getState().showToast;
                                    if (result.ok) {
                                        showToast({
                                            dedupeKey: 'ssot-clipboard',
                                            type: 'success',
                                            icon: 'clipboard',
                                            title: activeViewMode === 'patient' ? 'Guía del Paciente Copiada' : 'Expediente NOM-004 Copiado',
                                            message: `${result.patientName} • Cita #${result.folio} sincronizada al 100% en portapapeles.`,
                                            duration: 3200
                                        });
                                    } else {
                                        const isFailClosed = result.reason === 'MISSING_CLINICAL_DOSSIER' || result.reason === 'INCOMPLETE_IDENTITY';
                                        showToast({
                                            dedupeKey: 'ssot-clipboard',
                                            type: isFailClosed ? 'error' : 'warning',
                                            icon: 'clipboard',
                                            title: isFailClosed ? 'Copiado Bloqueado por Bioseguridad (NOM-004)' : 'Acceso al Portapapeles Restringido',
                                            message: isFailClosed
                                                ? 'El expediente clínico aún no cuenta con síntesis o identidad validada.'
                                                : 'Verifique los permisos del navegador e intente nuevamente.',
                                            duration: 4000
                                        });
                                    }
                                }}
                                className="flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all cursor-pointer border bg-white dark:bg-slate-900 text-[#1C75BC] border-[#1C75BC]/40 hover:bg-[#1C75BC] hover:text-white shadow-sm"
                                title={activeViewMode === 'patient' ? 'Copiar Guía Amigable del Paciente (SSoTT)' : 'Copiar Expediente Clínico NOM-004 (SSoTT)'}
                            >
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                                <span>{activeViewMode === 'patient' ? 'Copiar Guía Paciente' : 'Copiar Expediente NOM-004'}</span>
                            </button>

                            <span className="hidden xl:inline text-[10px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider px-2">
                                Doctrina T.I.L.O. 2030
                            </span>
                        </div>
                    </div>

                    {isPhase20EditMode && (
                        <div className="px-6 py-2.5 bg-[#FFCC00]/20 dark:bg-[#FFCC00]/15 border-b border-[#FFCC00]/60 dark:border-[#FFCC00]/45 flex items-center justify-between text-xs font-bold text-[#0F172A] dark:text-[#FEF9C3] no-print">
                            <span>Modo Revisión Final Activo: Utilice el panel conversacional izquierdo para confirmar o ajustar el cierre del expediente.</span>
                        </div>
                    )}

                    {/* ===================================================================== */}
                    {/* VISTA 1: GUÍA EMPÁTICA Y TRANSPARENTE PARA EL PACIENTE Y SU FAMILIA    */}
                    {/* ===================================================================== */}
                    {activeViewMode === 'patient' ? (
                        <div className="p-5 sm:p-6 space-y-6">
                            {/* CABECERA EMPÁTICA CON ACENTO CÁLIDO INSTITUCIONAL (#F29FC5) */}
                            <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-3.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#F29FC5]/25 text-[#0F172A] border border-[#F29FC5]/70 dark:bg-[#F29FC5]/15 dark:border-[#F29FC5]/45 dark:text-[#FDF2F8]">
                                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                        <span>Acompañamiento Clínico Personalizado • Equipo en Acción®</span>
                                    </span>
                                    <span className="text-[11px] font-bold text-[#1C75BC] bg-[#1C75BC]/10 px-2.5 py-1 rounded-lg border border-[#1C75BC]/20 tabular-nums">
                                        {fuentesClinicas.length} Evaluaciones Integradas
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                                        {patientGuide.greetingTitle}
                                    </h2>
                                    <p className="text-xs sm:text-[13px] text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium">
                                        {patientGuide.empatheticLead}
                                    </p>
                                </div>

                                {/* Tira limpia de evaluaciones tomadas en cuenta */}
                                <div className="pt-3 border-t border-slate-100 dark:border-[#334155] flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1]">
                                        Evaluaciones revisadas hoy:
                                    </span>
                                    {fuentesClinicas.map((f) => (
                                        <span
                                            key={f.id}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                                        >
                                            <span>{f.icon}</span>
                                            <span>{f.title}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* ================================================================= */}
                            {/* BLOQUE A: SEMÁFORO CLÍNICO DE BIOSEGURIDAD (TRIPLE SEÑAL AAA)      */}
                            {/* ================================================================= */}
                            <div
                                id="card-biosecurity-semaphore"
                                className={`rounded-2xl p-5 border border-l-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-3.5 transition-all ${
                                    isRedSemaphore
                                        ? 'bg-white dark:bg-[#1E293B] border-slate-200/90 dark:border-[#B70E0C]/50 border-l-[#B70E0C]'
                                        : isYellowSemaphore
                                            ? 'bg-white dark:bg-[#FFCC00]/15 border-slate-200/90 dark:border-[#FFCC00]/50 border-l-[#FFCC00]'
                                            : 'bg-white dark:bg-[#1E293B] border-slate-200/90 dark:border-[#3AAA35]/40 border-l-[#3AAA35]'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                    <div className="flex items-center gap-2.5">
                                        {isRedSemaphore ? (
                                            <div className="w-9 h-9 rounded-xl bg-[#B70E0C]/10 border border-[#B70E0C]/30 flex items-center justify-center shrink-0">
                                                <ShieldAlert className="w-5 h-5 text-[#B70E0C]" />
                                            </div>
                                        ) : isYellowSemaphore ? (
                                            <div className="w-9 h-9 rounded-xl bg-[#FFCC00] dark:bg-[#FFCC00]/20 border border-[#EAB308] dark:border-[#FFCC00]/50 flex items-center justify-center shrink-0">
                                                <AlertTriangle className="w-5 h-5 text-[#0F172A] dark:text-[#FEF9C3]" />
                                            </div>
                                        ) : (
                                            <div className="w-9 h-9 rounded-xl bg-[#3AAA35]/12 border border-[#3AAA35]/30 flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-5 h-5 text-[#3AAA35]" />
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                Semáforo Clínico de Bioseguridad Transparente
                                            </span>
                                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                                {semaphore.title || uiLabels.semaphoreFallbackTitle || '¿Cómo iniciaremos su protocolo de forma segura?'}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Badge Triple Señal WCAG 2.2 AAA (Color + Icono + Etiqueta Explícita) */}
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold border shrink-0 self-start sm:self-center ${
                                        isRedSemaphore
                                            ? 'bg-[#B70E0C] text-white border-[#B70E0C]'
                                            : isYellowSemaphore
                                                ? 'bg-[#FFCC00] text-[#0F172A] border-[#EAB308] dark:bg-[#FFCC00]/25 dark:border-[#FFCC00]/60 dark:text-[#FEF9C3]'
                                                : 'bg-[#3AAA35] text-white border-[#3AAA35]'
                                    }`}>
                                        {isRedSemaphore ? (
                                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                        ) : isYellowSemaphore ? (
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        ) : (
                                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                        )}
                                        <span>
                                            {semaphore.badgeLabel || (isRedSemaphore
                                                ? 'Prioridad Médica • Pausa Preventiva'
                                                : isYellowSemaphore
                                                    ? 'Inicio Gradual Preventivo • Fracción Inicial Gradual'
                                                    : 'Vía Libre Biosegura • Protocolo Completo')}
                                        </span>
                                    </span>
                                </div>

                                <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-100 leading-relaxed font-medium">
                                    {semaphore.honestExplanation}
                                </p>

                                {patientGuide.calciumAlertText && (
                                    <div className="bg-white/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200 font-medium">
                                        💧 <strong className="font-extrabold text-slate-900 dark:text-slate-100">Cuidado mineral personalizado:</strong> {patientGuide.calciumAlertText}
                                    </div>
                                )}

                                {/* Estudios de laboratorio de acompañamiento (si aplican) */}
                                {Array.isArray(semaphore.recommendedLabs) && semaphore.recommendedLabs.length > 0 && (
                                    <div className="bg-[#F8FAFC] dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                                        <span className="text-[11px] font-extrabold text-[#1C75BC] dark:text-sky-400 block">
                                            {uiLabels.recommendedLabsTitle || '🔬 Estudios de control sugeridos para personalizar aún más su seguimiento:'}
                                        </span>
                                        <div className="grid grid-cols-1 gap-2.5">
                                            {semaphore.recommendedLabs.map((lab, lIdx) => (
                                                <div
                                                    key={lIdx}
                                                    className="bg-white dark:bg-[#1A1A1A] border border-slate-200/80 dark:border-slate-800 rounded-lg px-3 py-2 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-[#1C75BC] shrink-0" />
                                                    <span>{lab}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Nota de transparencia ética COFEPRIS / NOM-043 */}
                                {semaphore.ethicalNote && (
                                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-[#334155] dark:text-[#CBD5E1] font-medium leading-relaxed">
                                        🛡️ <strong className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Compromiso de honestidad clínica:</strong> {semaphore.ethicalNote}
                                    </div>
                                )}
                            </div>

                            {/* ================================================================= */}
                            {/* BLOQUE A.2: ESTUDIO DE EDAD METABÓLICA Y PROYECCIÓN REALISTA      */}
                            {/* ================================================================= */}
                            {patientGuide.metabolicAgeStudy && (
                                patientGuide.metabolicAgeStudy.isSuppressedBySafetyGate ? (
                                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] border-l-4 border-l-[#1C75BC] rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-2.5">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-[#1C75BC]/10 border border-[#1C75BC]/25 flex items-center justify-center shrink-0">
                                                    <ShieldCheck className="w-4 h-4 text-[#1C75BC]" strokeWidth={2} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                                        Acompañamiento Clínico Protector
                                                    </span>
                                                    <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                                        Enfoque Integral Centrado en su Bienestar Funcional
                                                    </h3>
                                                </div>
                                            </div>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/30">
                                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                                <span>Ruta Protectora Activa</span>
                                            </span>
                                        </div>
                                        <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium">
                                            {patientGuide.metabolicAgeStudy.suppressionReasonText}
                                        </p>
                                    </div>
                                ) : (patientGuide.metabolicAgeStudy.metabolicAge !== null && patientGuide.metabolicAgeStudy.metabolicAge !== undefined) && (
                                    <div className={`bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] border-l-4 ${
                                        Number(patientGuide.metabolicAgeStudy.deltaYears) > 1.5
                                            ? 'border-l-[#B70E0C]'
                                            : (patientGuide.metabolicAgeStudy.hasActiveCompensationFocalDrag || Number(patientGuide.metabolicAgeStudy.deltaYears) > 0.4)
                                                ? 'border-l-[#FFCC00]'
                                                : 'border-l-[#3AAA35]'
                                    } rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-4 tabular-nums`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#334155]">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-[#1C75BC]/10 border border-[#1C75BC]/25 flex items-center justify-center shrink-0">
                                                    <Clock className="w-4 h-4 text-[#1C75BC]" strokeWidth={2} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                                        Vitalidad Celular y Reserva Funcional
                                                    </span>
                                                    <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                                        Estudio Personalizado de Edad Metabólica
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/25">
                                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                                    <span>{patientGuide.metabolicAgeStudy.evidenceTierBadge || 'Nivel I — Evidencia Bioquímica y Clínica Completa'}</span>
                                                </span>
                                                {Number(patientGuide.metabolicAgeStudy.deltaYears) > 1.5 ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#B70E0C]/10 text-[#B70E0C] border border-[#B70E0C]/30">
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                                        <span>Esfuerzo Reversible: +{patientGuide.metabolicAgeStudy.deltaYears} años</span>
                                                    </span>
                                                ) : patientGuide.metabolicAgeStudy.hasActiveCompensationFocalDrag ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#FFCC00] text-[#0F172A] border border-[#0F172A]/15">
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                                        <span>COMPENSACIÓN FISIOLÓGICA ACTIVA • FOCOS PRIORITARIOS POR OPTIMIZAR</span>
                                                    </span>
                                                ) : Number(patientGuide.metabolicAgeStudy.deltaYears) > 0.4 ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#FFCC00] text-[#0F172A] border border-[#0F172A]/15">
                                                        <Activity className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                                        <span>Potencial por Desbloquear: +{patientGuide.metabolicAgeStudy.deltaYears} años</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10.5px] font-extrabold bg-[#3AAA35]/10 text-[#3AAA35] border border-[#3AAA35]/30">
                                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                                        <span>{Number(patientGuide.metabolicAgeStudy.deltaYears) < -0.4 ? `Reserva Funcional Joven (${patientGuide.metabolicAgeStudy.deltaYears} años)` : 'Reserva Funcional Conservada'}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] rounded-xl p-3 text-center">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] block">Su Edad Actual</span>
                                                <span className="text-xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 block">{patientGuide.metabolicAgeStudy.chronologicalAge} años</span>
                                            </div>
                                            <div className={`border rounded-xl p-3 text-center ${
                                                Number(patientGuide.metabolicAgeStudy.deltaYears) > 1.5
                                                    ? 'bg-[#B70E0C]/5 border-[#B70E0C]/25'
                                                    : patientGuide.metabolicAgeStudy.hasActiveCompensationFocalDrag
                                                        ? 'bg-[#FFCC00]/15 border-[#FFCC00]/50'
                                                        : 'bg-[#3AAA35]/5 border-[#3AAA35]/25'
                                            }`}>
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] block">Edad Metabólica</span>
                                                <span className={`text-xl font-extrabold mt-0.5 block ${
                                                    Number(patientGuide.metabolicAgeStudy.deltaYears) > 1.5
                                                        ? 'text-[#B70E0C]'
                                                        : patientGuide.metabolicAgeStudy.hasActiveCompensationFocalDrag
                                                            ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                                                            : 'text-[#3AAA35]'
                                                }`}>
                                                    {patientGuide.metabolicAgeStudy.metabolicAgeExact ?? patientGuide.metabolicAgeStudy.metabolicAge} años
                                                </span>
                                            </div>
                                            <div className="bg-[#3AAA35]/5 border border-[#3AAA35]/25 rounded-xl p-3 text-center">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] block">Meta a 28 Días</span>
                                                <span className="text-xl font-extrabold text-[#3AAA35] mt-0.5 block">{patientGuide.metabolicAgeStudy.cycle1TargetAge28d} años</span>
                                            </div>
                                            <div className="bg-[#1C75BC]/5 border border-[#1C75BC]/25 rounded-xl p-3 text-center">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] block">Proyección 90 Días</span>
                                                <span className="text-xl font-extrabold text-[#1C75BC] mt-0.5 block">{patientGuide.metabolicAgeStudy.cycle3ProjectionAge90d} años</span>
                                            </div>
                                            <div className="col-span-2 sm:col-span-1 bg-[#1C75BC]/10 border border-[#1C75BC]/30 rounded-xl p-3 text-center">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">Potencial 180d (Ciclo 6)</span>
                                                <span className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 block">{patientGuide.metabolicAgeStudy.cycle6RangeLabel180d || `${patientGuide.metabolicAgeStudy.cycle3ProjectionAge90d} años`}</span>
                                            </div>
                                        </div>

                                        {patientGuide.metabolicAgeStudy.patientSummary && (
                                            <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium">
                                                {patientGuide.metabolicAgeStudy.patientSummary}
                                            </p>
                                        )}
                                    </div>
                                )
                            )}

                            {/* ================================================================= */}
                            {/* BLOQUE B: SUS 5 SISTEMAS DE SALUD EN PALABRAS SENCILLAS            */}
                            {/* ================================================================= */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <div>
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                            Traducción Clínica Clara
                                        </span>
                                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                                            {uiLabels.systemsSectionTitle || 'Sus 5 Sistemas de Salud Explicados con Sencillez'}
                                        </h3>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5">
                                    {(patientGuide.fiveSystems || []).map((sys) => {
                                        const isPriority = sys.status === 'ATENCION_PRIORITARIA' || sys.status === 'PRIORITY';
                                        const isPreventive = sys.status === 'VIGILANCIA_PREVENTIVA' || sys.status === 'PREVENTIVE';

                                        return (
                                            <div
                                                key={sys.id}
                                                className={`bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col gap-3 border-t-4 ${
                                                    isPriority
                                                        ? 'border-t-[#B70E0C]'
                                                        : isPreventive
                                                            ? 'border-t-[#FFCC00]'
                                                            : 'border-t-[#3AAA35]'
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                                                            isPriority
                                                                ? 'bg-[#B70E0C]/10 text-[#B70E0C] border-[#B70E0C]/25'
                                                                : isPreventive
                                                                    ? 'bg-[#FFCC00]/30 text-[#0F172A] border-[#FFCC00] dark:bg-[#FFCC00]/15 dark:border-[#FFCC00]/50 dark:text-[#FEF9C3]'
                                                                    : 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/25'
                                                        }`}>
                                                            {renderSystemSvgIcon(sys.iconKey, 'w-4 h-4')}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                                                {sys.title}
                                                            </h4>
                                                            {sys.subtitle && (
                                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                                                                    {sys.subtitle}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Triple Señal WCAG 2.2 AAA */}
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold border ${
                                                        isPriority
                                                            ? 'bg-[#B70E0C]/10 text-[#B70E0C] border-[#B70E0C]/30'
                                                            : isPreventive
                                                                ? 'bg-[#FFCC00] text-[#0F172A] border-[#EAB308] dark:bg-[#FFCC00]/15 dark:border-[#FFCC00]/50 dark:text-[#FEF9C3]'
                                                                : 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30'
                                                    }`}>
                                                        {isPriority ? (
                                                            <ShieldAlert className="w-3 h-3 shrink-0" />
                                                        ) : isPreventive ? (
                                                            <AlertTriangle className="w-3 h-3 shrink-0" />
                                                        ) : (
                                                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                                                        )}
                                                        <span>{sys.statusLabel}</span>
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 flex-1">
                                                    <div className="bg-[#F8FAFC] dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 space-y-1">
                                                        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#1C75BC] dark:text-sky-400 block">
                                                            {uiLabels.observedBoxTitle || '¿Qué observamos en su evaluación?'}
                                                        </span>
                                                        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                            {sys.whatWeObserved}
                                                        </p>
                                                    </div>

                                                    <div className="bg-[#F8FAFC] dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 space-y-1">
                                                        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#3AAA35] block">
                                                            ¿Qué significa en palabras sencillas?
                                                        </span>
                                                        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                            {sys.whatItMeans}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ================================================================= */}
                            {/* BLOQUE C: SUS ALIADOS NUTRICIONALES Y HORARIOS ADAPTADOS A SU DÍA  */}
                            {/* ================================================================= */}
                            <div id="card-gold-architecture" className="relative space-y-4">
                                {isRiskDetected && !overrideActive && isRedSemaphore && (
                                    <div className="bg-[#B70E0C]/10 border border-[#B70E0C]/30 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs font-bold text-[#B70E0C]">
                                        <Lock className="w-4 h-4 shrink-0" />
                                        <span>Suplementación en pausa preventiva de seguridad hasta validación médica presencial.</span>
                                    </div>
                                )}

                                <div className="px-1">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                        {uiLabels.alliesSectionKicker || 'Nutrición Funcional Sincronizada a su Despertar'}
                                    </span>
                                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                                        {uiLabels.alliesSectionTitle || 'Sus Aliados Nutricionales (33Plus® y 34Plus®)'}
                                    </h3>
                                </div>

                                {/* Tarjetas Bento de 33Plus® (#B70E0C + Zap exclusivo) y 34Plus® (#3AAA35 + Droplets) */}
                                {!patientGuide.isLactante && (
                                <div className="grid grid-cols-1 gap-4">
                                    {/* 33Plus® */}
                                    <div className="flex flex-col bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] border-l-4 border-l-[#B70E0C] p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
                                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-xl bg-[#B70E0C]/10 border border-[#B70E0C]/25 flex items-center justify-center shrink-0">
                                                    <Zap className="w-4 h-4 text-[#B70E0C] dark:text-[#FECACA]" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#B70E0C] dark:text-[#FECACA] block">
                                                        ALIADO DIURNO • ENERGÍA LIMPIA
                                                    </span>
                                                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                                        {formula33.brandTitle || '33Plus®'}
                                                    </h4>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-extrabold text-[#B70E0C] dark:text-[#FECACA] bg-[#B70E0C]/10 dark:bg-[#B70E0C]/20 border border-[#B70E0C]/25 dark:border-[#B70E0C]/45 px-2.5 py-1 rounded-lg">
                                                Circulación y Vitalidad
                                            </span>
                                        </div>

                                        <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-medium mb-3.5 flex-1">
                                            {formula33.explanation}
                                        </p>

                                        <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 text-[11px] space-y-2">
                                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                                                <span className="text-slate-500 dark:text-slate-400 font-bold sm:w-32 shrink-0">Pauta indicada:</span>
                                                <span className="font-extrabold text-slate-900 dark:text-slate-100 flex-1 text-left">
                                                    {String(formula33.dosage || '').replace(/(\d+)\s+(ml|g)\b/gi, '$1\u00A0$2')}
                                                </span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                                                <span className="text-slate-500 dark:text-slate-400 font-bold sm:w-32 shrink-0">Momento ideal:</span>
                                                <span className="font-bold text-[#B70E0C] dark:text-[#FECACA] flex-1 text-left">
                                                    ☀️ {String(formula33.timing || '').replace(/(\d+:\d+)\s+(AM|PM)/gi, '$1\u00A0$2')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 34Plus® */}
                                    <div className="flex flex-col bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] border-l-4 border-l-[#3AAA35] p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
                                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-xl bg-[#3AAA35]/12 border border-[#3AAA35]/25 flex items-center justify-center shrink-0">
                                                    <Droplets className="w-4 h-4 text-[#3AAA35] dark:text-[#DCFCE7]" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3AAA35] dark:text-[#DCFCE7] block">
                                                        ALIADO VESPERTINO / NOCTURNO
                                                    </span>
                                                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                                        {formula34.brandTitle || '34Plus®'}
                                                    </h4>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-extrabold text-[#3AAA35] dark:text-[#DCFCE7] bg-[#3AAA35]/10 dark:bg-[#3AAA35]/20 border border-[#3AAA35]/25 dark:border-[#3AAA35]/45 px-2.5 py-1 rounded-lg">
                                                Reparación y Descanso
                                            </span>
                                        </div>

                                        <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-medium mb-3.5 flex-1">
                                            {formula34.explanation}
                                        </p>

                                        <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 text-[11px] space-y-2">
                                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                                                <span className="text-slate-500 dark:text-slate-400 font-bold sm:w-32 shrink-0">Pauta indicada:</span>
                                                <span className="font-extrabold text-slate-900 dark:text-slate-100 flex-1 text-left">
                                                    {String(formula34.dosage || '').replace(/(\d+)\s+(ml|g)\b/gi, '$1\u00A0$2')}
                                                </span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                                                <span className="text-slate-500 dark:text-slate-400 font-bold sm:w-32 shrink-0">Hidratación clave:</span>
                                                <span className="font-bold text-[#3AAA35] dark:text-[#DCFCE7] flex-1 text-left">
                                                    💧 Mínimo 500{'\u00A0'}ml de agua simple
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                )}

                                {/* Tarjeta de Horarios Adaptados al Despertar Real del Paciente */}
                                <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-[#1C75BC]" />
                                            <span>{uiLabels.scheduleCardTitle || 'Cómo integrarlo a su rutina diaria (adaptado a su hora real de despertar)'}</span>
                                        </h4>
                                        <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-800">
                                            {isRedSemaphore || semaphore.modeCode === 'PAUSA_DUAL_INTERACCION_FARMACOLOGICA'
                                                ? '0 sobres activos (Pausa Preventiva)'
                                                : (semaphore.isCardioprotective1Plus2Continuity || semaphore.modeCode === 'PAUTA_OPTIMA_CARDIOPROTECTORA_SOBRE_COMPLETO')
                                                    ? 'Pauta Cardioprotectora (3 sobres completos/día • 1 + 2)'
                                                    : (semaphore.isSelective33Paused || semaphore.modeCode === 'PAUSA_SELECTIVA_33PLUS_SALICILATOS_ANTICOAG')
                                                        ? 'Pausa Selectiva 33Plus® • 34Plus® Activo'
                                                        : (semaphore.isSelective34Paused || String(semaphore.modeCode || '').startsWith('PAUSA_SELECTIVA_34PLUS'))
                                                            ? '33Plus® Activo • Pausa Selectiva 34Plus®'
                                                            : (semaphore.isEstablishedContinuityFullDose || semaphore.modeCode === 'CONTINUIDAD_CALIBRADA_DOSIS_COMPLETA')
                                                                ? 'Continuidad Calibrada (1 a 2 sobres completos/día)'
                                                                : isYellowSemaphore
                                                                    ? 'Titulación Gradual (1/2 sobre por toma)'
                                                                    : 'Esquema Completo Sincronizado'}
                                        </span>
                                    </div>

                                    {isRedSemaphore ? (
                                        <div className="bg-[#B70E0C]/8 border border-[#B70E0C]/30 rounded-xl p-4 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-3">
                                            <ShieldAlert className="w-5 h-5 text-[#B70E0C] shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="font-extrabold text-[#B70E0C] block mb-0.5">
                                                    {uiLabels.redPauseTitle || 'Primero su seguridad médica (0 sobres por ahora)'}
                                                </strong>
                                                <span>
                                                    {uiLabels.redPauseBody || 'Por precaución clínica, aún no iniciaremos sobres de suplementación. Siga hoy mismo su guía de alimentación protectora e hidratación natural mientras revisamos sus estudios con su médico.'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3">
                                            {schedule.map((slot, idx) => {
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
                                                        : rawFormula;
                                                const slotTitle = slot.tomaNumber ? `Momento ${slot.tomaNumber}` : `Momento ${idx + 1}`;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`rounded-xl p-3.5 border space-y-1.5 ${
                                                            isActive33
                                                                ? 'bg-[#B70E0C]/5 dark:bg-[#B70E0C]/15 border-[#B70E0C]/25 dark:border-[#B70E0C]/45'
                                                                : isActive34
                                                                    ? 'bg-[#3AAA35]/5 dark:bg-[#3AAA35]/15 border-[#3AAA35]/25 dark:border-[#3AAA35]/45'
                                                                    : 'bg-[#1C75BC]/5 dark:bg-[#1C75BC]/15 border-[#1C75BC]/25 dark:border-[#1C75BC]/45'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className={`inline-flex items-center gap-1.5 font-extrabold text-xs ${
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
                                                                <span>{slotTitle}: {slot.timeSlot}</span>
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                                                            {displayFormula} • <span className="text-[#1C75BC] dark:text-[#93C5FD]">{rawDosage}</span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                                            {slot.patientObjective}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ================================================================= */}
                            {/* BLOQUE D: SU PLAN DE ACCIÓN DIARIO EN CASA (3 TARJETAS BENTO)      */}
                            {/* ================================================================= */}
                            <div className="space-y-3">
                                <div className="px-1">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                        Hábitos Diarios Protectores
                                    </span>
                                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                                        {uiLabels.homePlanSectionTitle || 'Su Plan de Acción Diario en Casa'}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {/* Tarjeta 1: Alimentación Protectora */}
                                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col gap-3">
                                        <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                            <div className="w-8 h-8 rounded-xl bg-[#1C75BC]/10 border border-[#1C75BC]/25 flex items-center justify-center shrink-0">
                                                <Utensils className="w-4 h-4 text-[#1C75BC]" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                                    Pilar Alimentario
                                                </span>
                                                <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                                    {nutritionCard.title || 'Alimentación Protectora en Casa'}
                                                </h4>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                            {nutritionCard.summary}
                                        </p>

                                        {patientGuide?.logisticsSummary?.operationalSummary && (
                                            <div className="bg-[#1C75BC]/5 dark:bg-[#1C75BC]/15 border border-[#1C75BC]/25 rounded-xl px-3 py-2 text-[11px] font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                                                🏠 <strong className="font-extrabold text-[#1C75BC] dark:text-[#93C5FD]">Logística familiar:</strong> {patientGuide.logisticsSummary.operationalSummary}
                                            </div>
                                        )}

                                        {nutritionPillars.length > 0 && (
                                            <div className="grid grid-cols-1 gap-1.5 mt-auto pt-2">
                                                {nutritionPillars.map((rule, rIdx) => (
                                                    <div
                                                        key={rIdx}
                                                        className="bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-[#3AAA35] shrink-0" />
                                                        <span>{rule}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Tarjeta 2: Hidratación Inteligente */}
                                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col gap-3">
                                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-[#1C75BC]/10 border border-[#1C75BC]/25 flex items-center justify-center shrink-0">
                                                    <Droplets className="w-4 h-4 text-[#1C75BC]" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                                        Agua Natural
                                                    </span>
                                                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                                        {hydrationCard.title || 'Hidratación Inteligente'}
                                                    </h4>
                                                </div>
                                            </div>
                                            {hydrationCard.fluidRestrictionActive ? (
                                                <span className="px-2.5 py-1 rounded-lg bg-[#FFCC00] text-[#0F172A] border border-[#0F172A]/20 text-[10.5px] font-extrabold inline-flex items-center gap-1">
                                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                                    <span>Techo Hídrico Médico</span>
                                                </span>
                                            ) : hydrationCard.litersPerDay ? (
                                                <span className="px-2.5 py-1 rounded-lg bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/25 text-[11px] font-extrabold tabular-nums">
                                                    💧 {hydrationCard.litersPerDay} L/día
                                                </span>
                                            ) : null}
                                        </div>

                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium flex-1">
                                            {hydrationCard.summary}
                                        </p>

                                        {cleanKeyRule34Plus && (
                                            <div className="bg-[#3AAA35]/8 border border-[#3AAA35]/25 rounded-xl p-3 text-[11px] font-semibold text-slate-800 dark:text-slate-200 mt-auto">
                                                💧 {cleanKeyRule34Plus}
                                            </div>
                                        )}
                                    </div>

                                    {/* Tarjeta 3: Movimiento Cotidiano Seguro (Cero 🧸 en adultos, Cero jerga NEAT/HIIT) */}
                                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col gap-3">
                                        <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                            <div className="w-8 h-8 rounded-xl bg-[#3AAA35]/12 border border-[#3AAA35]/25 flex items-center justify-center shrink-0">
                                                {movementCard.isPediatric ? (
                                                    <Baby className="w-4 h-4 text-[#3AAA35]" />
                                                ) : (
                                                    <Footprints className="w-4 h-4 text-[#3AAA35]" />
                                                )}
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3AAA35] block">
                                                    {movementCard.isPediatric ? 'Desarrollo Psicomotor' : 'Movilidad Saludable'}
                                                </span>
                                                <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                                    {movementCard.title || 'Movimiento Cotidiano Seguro'}
                                                </h4>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium flex-1">
                                            {movementCard.summary}
                                        </p>

                                        {movementCard.sleepHabit && (
                                            <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 mt-auto">
                                                🌙 {movementCard.sleepHabit}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Tarjeta 3.5: Hito de Pulso Día 14 (Mitad de Ciclo — EGM-73) */}
                                {patientGuide?.homeActionPlan?.mid_cycle_pulse_day14?.summary && (
                                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] border-l-4 border-l-[#3AAA35] rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-2 tabular-nums">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-[#3AAA35]/12 border border-[#3AAA35]/25 flex items-center justify-center shrink-0">
                                                    <Activity className="w-4 h-4 text-[#3AAA35]" strokeWidth={2} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3AAA35] block">
                                                        Control Intermedio de Adherencia • Día 14
                                                    </span>
                                                    <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                                        {patientGuide.homeActionPlan.mid_cycle_pulse_day14.title || 'Hito de Pulso Día 14 (Mitad de Ciclo)'}
                                                    </h4>
                                                </div>
                                            </div>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3AAA35]/10 text-[#3AAA35] border border-[#3AAA35]/30 text-[10.5px] font-extrabold">
                                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                                <span>Mitad de Ciclo 1</span>
                                            </span>
                                        </div>
                                        <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium">
                                            {patientGuide.homeActionPlan.mid_cycle_pulse_day14.summary}
                                        </p>
                                    </div>
                                )}

                                {/* Tarjeta 4: Próxima Cita de Seguimiento y Sello NOM-004 */}
                                {scheduledApptView?.formattedLine && (
                                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] border-l-4 border-l-[#1C75BC] rounded-2xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-2 tabular-nums">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-[#1C75BC]/10 border border-[#1C75BC]/25 flex items-center justify-center shrink-0">
                                                    <Calendar className="w-4 h-4 text-[#1C75BC]" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                                        Continuidad de su Ciclo 1 • Fase 21
                                                    </span>
                                                    <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                                        Próxima Cita de Evaluación y Seguimiento
                                                    </h4>
                                                </div>
                                            </div>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3AAA35]/10 text-[#3AAA35] border border-[#3AAA35]/30 text-[10.5px] font-extrabold">
                                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                <span>{scheduledApptView.hasScheduled ? 'Cita Confirmada' : 'Seguimiento a 28 Días'}</span>
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                                            {scheduledApptView.formattedLine}
                                        </p>
                                        {dossierSealSha && (
                                            <p className="text-[10px] font-mono text-[#334155] dark:text-[#CBD5E1] pt-1.5 border-t border-slate-100 dark:border-[#334155] break-all">
                                                Sello NOM-004 (SHA-256): {dossierSealSha}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* ===================================================================== */
                        /* VISTA 2: EXPEDIENTE CLÍNICO OFICIAL (NOM-004 / MATRIZ IFM DE 7 NODOS) */
                        /* ===================================================================== */
                        <div className="p-6 space-y-6">
                            {/* CABECERA PARITARIA NOM-004: IDENTIDAD COMPLETA Y CONSORCIO DE FUENTES INTEGRADAS (1:1 CON GUÍA PACIENTE) */}
                            <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/25">
                                            EXPEDIENTE CLÍNICO TÉCNICO • NOM-004-SSA3-2012
                                        </span>
                                        {patientGuide?.patientFullName && (
                                            <span className="text-xs font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                                                {patientGuide.patientFullName} ({patientGuide.ageYears} años)
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] font-bold text-[#1C75BC] bg-[#1C75BC]/10 px-2.5 py-1 rounded-lg border border-[#1C75BC]/20 tabular-nums">
                                        {fuentesClinicas.length} Evaluaciones Integradas
                                    </span>
                                </div>
                                <div className="pt-2 border-t border-slate-100 dark:border-[#334155] flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1]">
                                        Fuentes auditadas:
                                    </span>
                                    {fuentesClinicas.map((f) => (
                                        <span
                                            key={f.id}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] text-[11px] font-semibold text-[#334155] dark:text-[#CBD5E1]"
                                        >
                                            <span>{f.icon}</span>
                                            <span>{f.title}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* BLOQUE 00: FICHA REGLAMENTARIA NOM-004 (IDENTIFICACIÓN, ANTECEDENTES, VITALES Y SOMATOMETRÍA) */}
                            {nom004SheetView && (
                                <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] border-l-4 border-l-[#1C75BC] rounded-2xl p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] space-y-3 tabular-nums">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-[#334155]">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/25">
                                                00. FICHA REGLAMENTARIA NOM-004
                                            </span>
                                            <h3 className="text-xs sm:text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                                Identificación, Antecedentes, Signos Vitales y Somatometría
                                            </h3>
                                        </div>
                                        <span className="text-[10.5px] font-bold text-[#334155] dark:text-[#CBD5E1] bg-slate-100 dark:bg-[#0F172A] px-2.5 py-0.5 rounded-lg border border-slate-200/80 dark:border-[#334155]">
                                            {sanitizeClinicalSpanish(nom004SheetView.altitudeLabel)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11.5px] text-[#334155] dark:text-[#CBD5E1]">
                                        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] rounded-xl p-3 space-y-1">
                                            <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">Demografía, Emergencia y Motivo</span>
                                            <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Titular:</strong> {nom004SheetView.sexLabel} • {nom004SheetView.ageYears} años{nom004SheetView.birthDate ? ` (${nom004SheetView.birthDate})` : ''}{nom004SheetView.curp ? ` • CURP: ${nom004SheetView.curp}` : ''}</p>
                                            <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Contacto Emergencia:</strong> {sanitizeClinicalSpanish(nom004SheetView.emergencyContactText)}</p>
                                            <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Motivo Primario:</strong> {sanitizeClinicalSpanish(nom004SheetView.primaryMotive)}</p>
                                        </div>

                                        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] rounded-xl p-3 space-y-1">
                                            <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">Antecedentes, Alergias y Farmacología</span>
                                            <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">AHF:</strong> {sanitizeClinicalSpanish(nom004SheetView.ahfText)}</p>
                                            <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">APP / Cirugías:</strong> {sanitizeClinicalSpanish(nom004SheetView.appText)} • Quirúrgicos: {sanitizeClinicalSpanish(nom004SheetView.surgicalText)}</p>
                                            <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Alergias / Fármacos:</strong> {sanitizeClinicalSpanish(nom004SheetView.allergiesText)} • {sanitizeClinicalSpanish(nom004SheetView.medicationsText)}</p>
                                            <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Digestivo / Suplementos:</strong> {sanitizeClinicalSpanish(nom004SheetView.digestivePhenotypeText)} • {sanitizeClinicalSpanish(nom004SheetView.priorSupplementsText)}</p>
                                        </div>

                                        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] rounded-xl p-3 space-y-1">
                                            <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#3AAA35] block">Signos Vitales Completos (Fase 17)</span>
                                            <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{sanitizeClinicalSpanish(nom004SheetView.vitals?.summaryLine || '')}</p>
                                        </div>

                                        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] rounded-xl p-3 space-y-1">
                                            <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#3AAA35] block">Somatometría Física Completa (Fase 16)</span>
                                            <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{sanitizeClinicalSpanish(nom004SheetView.somatometry?.summaryLine || '')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {Array.isArray(ifmNodes) && ifmNodes.length > 0 ? (
                                <DiagnosticoRenderizado cortexSynthesis={patientData.clinical_dossier} />
                            ) : (
                                <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
                                    <h3 className="text-slate-900 dark:text-slate-100 text-xs font-extrabold uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                                        <Activity className="w-4 h-4 text-[#1C75BC]" />
                                        1. Evaluación Funcional y Hallazgos Clínico-Paraclínicos Acreditados (NOM-004)
                                    </h3>

                                    {cleanDiagnoses.length > 0 ? (
                                        <div className="space-y-2.5">
                                            {cleanDiagnoses.map((d, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex justify-between items-start p-3.5 rounded-xl text-xs font-medium border ${
                                                        d.isRootNode
                                                            ? 'bg-[#FFCC00]/15 border-[#FFCC00]/60 dark:bg-[#FFCC00]/15 dark:border-[#FFCC00]/50'
                                                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                                                    }`}
                                                >
                                                    <div>
                                                        {d.nodo && (
                                                            <span className="text-[10px] font-extrabold text-[#1C75BC] uppercase tracking-wider block mb-0.5">
                                                                {d.nodo}
                                                            </span>
                                                        )}
                                                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{d.nombre}</span>
                                                        {d.accredited_cie10 && (
                                                            <span className="text-[10.5px] text-[#334155] dark:text-[#CBD5E1] font-mono mt-0.5 block">{d.accredited_cie10}</span>
                                                        )}
                                                    </div>
                                                    <span className="px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-wider rounded-full bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/25">
                                                        {d.prioridad}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-[#3AAA35]/10 border border-[#3AAA35]/30 rounded-xl p-4 text-xs text-slate-800 dark:text-slate-200 font-medium flex items-center gap-2.5">
                                            <CheckCircle2 className="w-4 h-4 text-[#3AAA35]" />
                                            <span>Homeostasis Metabólica General (Sin Alteraciones Agudas Registradas).</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Algoritmo de Secuenciación de Hábitos, Pulso Día 14 y Complementación */}
                            <div className="bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-[#334155] rounded-2xl p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] border-l-4 border-l-[#1C75BC] transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-3.5 select-none">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/20">
                                            CRONOBIOLOGÍA METABÓLICA
                                        </span>
                                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-[#1C75BC]" />
                                            <span>Secuenciación de Hábitos, Pulso Día 14 y Complementación (28 Días)</span>
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {[1, 2, 3].map(phase => (
                                            <button
                                                key={phase}
                                                type="button"
                                                onClick={() => setActiveTimelinePhase(phase)}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all border cursor-pointer ${
                                                    activeTimelinePhase === phase
                                                        ? 'bg-[#1C75BC] text-white border-[#1C75BC]'
                                                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                Fase {phase}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {(() => {
                                    const targetKcalVal = bioenergetics?.targetKcal || 2000;
                                    const targetWaterVal = ortho?.hydrationTargetLiters || hydrationCard?.litersPerDay || 2.2;
                                    const fallbackPhases = isRedSemaphore
                                        ? [
                                            {
                                                phase: 1,
                                                rangeLabel: 'Días 1 a 7',
                                                weekLabel: 'Semana 1',
                                                title: 'Estabilización Inicial y Pausa Preventiva de Suplementación',
                                                description: `Alimentación antiinflamatoria (${targetKcalVal} kcal/día), hidratación estructurada (${targetWaterVal} L/día) y recopilación de estudios de laboratorio de control (0 sobres activos).`
                                            },
                                            {
                                                phase: 2,
                                                rangeLabel: 'Días 8 a 21',
                                                weekLabel: 'Semanas 2-3',
                                                title: 'Valoración Médica Paraclínica y Desinflamación Mucosa',
                                                description: 'Revisión clínica de analitos solicitados para validar función renal, hepática y hemodinámica previo a cualquier suplementación.'
                                            },
                                            {
                                                phase: 3,
                                                rangeLabel: 'Días 22 a 28',
                                                weekLabel: 'Semana 4',
                                                title: 'Consolidación Metabólica y Re-Evaluación Comparativa (T0 → T1)',
                                                description: `Auditoría comparativa de evolución clínica al cierre del ciclo de 28 días (${targetKcalVal} kcal/día).`
                                            }
                                        ]
                                        : (isYellowSemaphore && !semaphore.isCardioprotective1Plus2Continuity && !semaphore.isEstablishedContinuityFullDose && semaphore.modeCode !== 'PAUTA_OPTIMA_CARDIOPROTECTORA_SOBRE_COMPLETO' && semaphore.modeCode !== 'CONTINUIDAD_CALIBRADA_DOSIS_COMPLETA')
                                            ? [
                                                {
                                                    phase: 1,
                                                    rangeLabel: 'Días 1 a 7',
                                                    weekLabel: 'Semana 1',
                                                    title: 'Adaptación Mucosa y Fracción Inicial Gradual',
                                                    description: `Sellado epitelial digestivo (0 Picante, 0 Cerdo, 0 Azúcares), hidratación medida (${targetWaterVal} L/día) e inicio gradual con 1/2 sobre (5.3 g) matutino de 33Plus® en 300 ml de agua natural y 1/2 sobre (5.7 g) nocturno de 34Plus® en mínimo 500 ml de agua simple 💧.`
                                                },
                                                {
                                                    phase: 2,
                                                    rangeLabel: 'Días 8 a 21',
                                                    weekLabel: 'Semanas 2-3',
                                                    title: 'Escalamiento Gradual según Tolerancia y Modulación Metabólica',
                                                    description: 'Valoración de tolerancia digestiva y renal a partir del Día 8 para integrar o mantener la toma de media mañana, optimizando sensibilidad metabólica y fluidez microvascular.'
                                                },
                                                {
                                                    phase: 3,
                                                    rangeLabel: 'Días 22 a 28',
                                                    weekLabel: 'Semana 4',
                                                    title: 'Consolidación Funcional y Re-Evaluación Comparativa (T0 → T1)',
                                                    description: `Auditoría comparativa de bioseñales y estudios de control al cierre del ciclo de 28 días sobre meta de ${targetKcalVal} kcal/día.`
                                                }
                                            ]
                                            : [
                                                {
                                                    phase: 1,
                                                    rangeLabel: 'Días 1 a 7',
                                                    weekLabel: 'Semana 1',
                                                    title: 'Sincronización Circadiana y Sellado de Barrera Mucosa',
                                                    description: `Integración alimentaria (${targetKcalVal} kcal/día), hidratación diaria (${targetWaterVal} L/día) y protocolo sincronizado de 33Plus® y 34Plus® (en mínimo 500 ml de agua simple 💧).`
                                                },
                                                {
                                                    phase: 2,
                                                    rangeLabel: 'Días 8 a 21',
                                                    weekLabel: 'Semanas 2-3',
                                                    title: 'Modulación Metabólica, Vascular y Reparación Tisular',
                                                    description: 'Optimización del transporte lipídico-glucémico, oxigenación microvascular diurna y síntesis nocturna de matriz de colágeno.'
                                                },
                                                {
                                                    phase: 3,
                                                    rangeLabel: 'Días 22 a 28',
                                                    weekLabel: 'Semana 4',
                                                    title: 'Consolidación Funcional y Re-Evaluación Comparativa (T0 → T1)',
                                                    description: `Auditoría comparativa de parámetros fuera de rango al día 28 y consolidación de composición corporal (${targetKcalVal} kcal/día).`
                                                }
                                            ];

                                    const timelinePhases = Array.isArray(ortho?.evolutionTimeline?.phases) && ortho.evolutionTimeline.phases.length === 3
                                        ? ortho.evolutionTimeline.phases
                                        : fallbackPhases;

                                    return (
                                        <div className="space-y-2.5 my-3">
                                            {timelinePhases.map((pItem, idx) => {
                                                const phaseNum = pItem.phase || (idx + 1);
                                                const isGreenAccent = phaseNum === 2;
                                                const isActive = activeTimelinePhase === phaseNum;
                                                return (
                                                    <div
                                                        key={phaseNum}
                                                        onClick={() => setActiveTimelinePhase(phaseNum)}
                                                        className={`rounded-xl px-4 py-3 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all border ${
                                                            isActive
                                                                ? (isGreenAccent
                                                                    ? 'bg-[#3AAA35]/8 border-[#3AAA35] ring-1 ring-[#3AAA35]/30'
                                                                    : 'bg-[#1C75BC]/8 border-[#1C75BC] ring-1 ring-[#1C75BC]/30')
                                                                : 'bg-slate-50/60 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800'
                                                        }`}
                                                    >
                                                        <div className="flex-1 space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[9.5px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                                                                    isGreenAccent
                                                                        ? 'bg-[#3AAA35]/15 text-[#3AAA35] border-[#3AAA35]/30'
                                                                        : 'bg-[#1C75BC]/15 text-[#1C75BC] border-[#1C75BC]/30'
                                                                }`}>
                                                                    FASE {phaseNum}
                                                                </span>
                                                                <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                                                                    {sanitizeClinicalSpanish(pItem.title)}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium pl-6">
                                                                {sanitizeClinicalSpanish(pItem.description)}
                                                            </p>
                                                        </div>
                                                        <div className="shrink-0 flex items-center sm:flex-col sm:items-end gap-1.5 pl-6 sm:pl-0 tabular-nums">
                                                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                                                                isGreenAccent ? 'text-[#3AAA35]' : 'text-[#1C75BC]'
                                                            }`}>
                                                                {sanitizeClinicalSpanish(pItem.rangeLabel)}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-[#334155] dark:text-[#CBD5E1]">
                                                                {sanitizeClinicalSpanish(pItem.weekLabel)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}

                                <div className="pt-2.5 border-t border-slate-100 dark:border-[#334155] mt-3 flex items-center justify-between text-[10px]">
                                    <span className="text-[#334155] dark:text-[#CBD5E1] font-medium">ⓘ Secuenciación cronobiológica de hábitos y complementación sincronizada al ciclo de 28 días</span>
                                </div>
                            </div>

                            {/* Sección Logística y Cierre Seguimiento Fase 21 */}
                            <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] tabular-nums">
                                <h3 className="text-[#0F172A] dark:text-[#F8FAFC] text-xs font-extrabold uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-[#334155] pb-3">
                                    <Calendar className="w-4 h-4 text-[#3AAA35]" />
                                    <span>Logística, Seguimiento (Fase 21) y Trazabilidad NOM-004</span>
                                    <span className="sr-only">{' — '}</span>
                                </h3>
                                <div className="grid grid-cols-1 gap-3 text-xs bg-slate-50 dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] p-4 rounded-xl font-medium">
                                    <div>
                                        <span className="text-[9.5px] uppercase font-extrabold text-[#334155] dark:text-[#CBD5E1] block mb-1 tracking-wider">Logística Familiar y Operativa: </span>
                                        <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-xs">
                                            {patientGuide?.logisticsSummary?.operationalSummary || `${patientGuide?.logisticsSummary?.venueLabel || 'Casa'} | Preparación: ${patientGuide?.logisticsSummary?.cookLabel || 'Preparación propia'}`}
                                        </span>
                                    </div>
                                    <div className="border-t border-slate-200/80 dark:border-[#334155] pt-2.5">
                                        <span className="sr-only">{' | '}</span>
                                        <span className="text-[9.5px] uppercase font-extrabold text-[#334155] dark:text-[#CBD5E1] block mb-1 tracking-wider">Ruta de Evolución: </span>
                                        <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-xs tabular-nums">
                                            {sanitizeClinicalSpanish(
                                                ortho?.evolutionTimeline?.summaryLabel ||
                                                '28 Días de seguimiento continuo (Fase 1: Días 1–7 • Fase 2: Días 8–21 • Fase 3: Días 22–28)'
                                            )}
                                        </span>
                                    </div>
                                    {scheduledApptView?.formattedLine && (
                                        <div className="border-t border-slate-200/80 dark:border-[#334155] pt-2.5">
                                            <span className="text-[9.5px] uppercase font-extrabold text-[#1C75BC] dark:text-[#93C5FD] block mb-1 tracking-wider">Próxima Cita Programada (Fase 21): </span>
                                            <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-xs tabular-nums">
                                                {scheduledApptView.formattedLine}
                                            </span>
                                        </div>
                                    )}
                                    {dossierSealSha && (
                                        <div className="border-t border-slate-200/80 dark:border-[#334155] pt-2.5">
                                            <span className="text-[9.5px] uppercase font-extrabold text-[#334155] dark:text-[#CBD5E1] block mb-1 tracking-wider">Huella Criptográfica NOM-004 (SHA-256): </span>
                                            <span className="font-mono text-[10.5px] text-[#334155] dark:text-[#CBD5E1] break-all">
                                                {dossierSealSha}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TabDiagnosis;
