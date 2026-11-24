import React, { useState, useEffect } from 'react';
import { FlaskConical, AlertTriangle, Filter, CheckCircle2, ChevronDown } from 'lucide-react';
import { parseElectretData, isSyntheticElectretPayload } from '../../utils/electretParser';
import { useClinicalGenome } from '../../store/useClinicalGenome';

const getValidImageUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const normalized = rawUrl.replace(/\\/g, '/');
    if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('data:')) {
        return normalized;
    }
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const relativePath = normalized.startsWith('/') ? normalized : `/${normalized}`;
    const finalPath = relativePath.startsWith('/uploads') ? relativePath : `/uploads${relativePath}`;
    return `${cleanBase}${finalPath}`;
};

const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.classList.remove('object-cover');
    e.target.classList.add('object-contain', 'p-3', 'bg-slate-100', 'dark:bg-slate-800', 'opacity-60', 'rounded-xl');
    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="2" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
};

/**
 * Normaliza nombres clínicos para cotejo biométrico NOM-004.
 */
const normalizeClinicalName = (name) => {
    if (!name) return '';
    return String(name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Valida correspondencia de identidad de paciente (NOM-004-SSA3-2012).
 */
const checkPatientMatch = (targetName, scannedName) => {
    if (!targetName) return true;
    if (!scannedName) return false;
    const normTarget = normalizeClinicalName(targetName);
    const normScan = normalizeClinicalName(scannedName);
    if (!normTarget || !normScan) return true;
    if (normTarget === normScan || normScan.includes(normTarget) || normTarget.includes(normScan)) return true;
    
    const targetTokens = normTarget.split(' ').filter(t => t.length > 2);
    const scanTokens = normScan.split(' ').filter(t => t.length > 2);
    const matchingTokens = targetTokens.filter(t => scanTokens.includes(t));
    return matchingTokens.length >= 2 || (targetTokens.length === 1 && matchingTokens.length === 1);
};

// ============================================================================
// 🛡️ NORMALIZADORES PUROS SSoTT — MARCA BLANCA EQUIPO EN ACCIÓN®, COFEPRIS Y AAA
// Cero Hooks adicionales (EGM-36, EGM-38, EGM-39, EGM-41, EGM-45)
// ============================================================================
const sanitizeUiWhiteLabelText = (rawText) => {
    if (!rawText || typeof rawText !== 'string') return rawText;
    return rawText
        .replace(/Gemini\s*2\.5\s*Flash\s*Vision|Gemini\s*2\.5\s*Flash|Gemini\s*Vision|Google\s*Gemini|CYTOS\s*Spectrum|Topograf[ií]a\s*CYTOS|\bCYTOS\b/gi, 'Motor de Visión Clínica Equipo en Acción®')
        .replace(/microcirculaci[oó]n\s+foveal/gi, 'microcirculación epiescleral y bulbar')
        .replace(/\b(?:origen\s+|etiolog[ií]a\s+|patolog[ií]a\s+|proceso\s+|enfermedad\s+)?autoinmun[ea]s?\b/gi, 'reactividad microvascular cutánea')
        .replace(/Moderada\s*\(\s*Blanquecina\s*\)/gi, 'Moderada (blanquecina)')
        .replace(/Delgada\s*\(\s*Blanquecina\s*\)/gi, 'Delgada (blanquecina)')
        .replace(/Delgada\s*\(\s*Blanca\s*\)/gi, 'Delgada (blanquecina)')
        .replace(/\bEutrofico\b/g, 'Eutrófico')
        .replace(/\beutrofico\b/g, 'eutrófico')
        .replace(/&/g, 'y')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

const normalizeUiCornealArcus = (rawArco) => {
    const s = String(rawArco || '').trim();
    if (!s || /negativ|ausent|sin\s+arco|normal/i.test(s)) return 'Ausente';
    if (/grado\s*(ii|iii|2|3)|circunferencial|denso|severo|marcado/i.test(s)) return 'Grado II–III (Circunferencial)';
    return 'Grado I (Incipiente)';
};

const isOcularHbNoEvaluableSSoT = (csa) => {
    if (!csa || typeof csa !== 'object') return true;
    const estado = String(csa.estado_anemia || '').toUpperCase();
    const joined = `${csa.hemoglobina_estimada_gdl || ''} ${csa.palidez_conjuntival_tarsal || ''} ${csa.hallazgos || ''}`;
    if (estado === 'NO_EVALUABLE' || csa.tiene_eversion_tarsal === false) return true;
    if (/no\s+evaluable|falta\s+de\s+eversi[oó]n|sin\s+eversi[oó]n|14\.0\s*g\/dl|13\.5\s*-\s*15/i.test(joined)) return true;
    if (csa.tiene_eversion_tarsal !== true) return true;
    return false;
};

const CORTEX_DOMAIN_BLUEPRINTS = {
    ocular_eco: {
        title: 'Cruce Oculómico • Eco Metabólico y Microvasculatura',
        categories: ['eye', 'blood_glucose', 'blood_sugar', 'pancreas'],
        keywords: ['ojo', 'colageno', 'insulina', 'azucar', 'glucosa', 'microcirculacion'],
        synergy33: 'Soporte bioenergético diurno con L-Carnitina (MP080 500 mg), Coenzima Q10 (MP104 31.25 mg) y polifenoles antioxidantes que acompañan el metabolismo energético saludable.',
        synergy34: 'Acompañamiento nocturno con fibra prebiótica e Inulina disueltas en mínimo 500 ml de agua natural para favorecer el equilibrio metabólico post-prandial.'
    },
    ocular_cardio: {
        title: 'Cruce Oculómico • Angioarquitectura y Lípidos',
        categories: ['cardiovascular', 'blood_lipids', 'eye', 'collagen'],
        keywords: ['viscosidad', 'elasticidad', 'resistencia', 'lipid', 'triglicerido', 'circulatorio'],
        synergy33: 'Aporte matutino de Coenzima Q10 (MP104 31.25 mg), Niacina B3 (MP046 31.25 mg) y Vitamina C (MP048 1,000 mg) como soporte antioxidante endotelial.',
        synergy34: 'Soporte estructural nocturno con Colágeno Hidrolizado (MP009 500 mg), L-Glicina (MP023 200 mg) y Vitamina K2 MK-7 (MP172) para la matriz vascular.'
    },
    ocular_tarsal: {
        title: 'Cruce Oculómico • Perfusión Tisular y Cofactores',
        categories: ['trace_elements', 'vitamins', 'basic_physical', 'eye'],
        keywords: ['hierro', 'cobre', 'vitamina_c', 'vitamina_b', 'oxigen', 'hipoxia'],
        synergy33: 'Aporte de Vitamina C (MP048 1,000 mg) y complejo vitamínico B matutino que coadyuvan en el aprovechamiento fisiológico de micronutrientes de la dieta.',
        synergy34: 'Matriz nocturna de aminoácidos y oligoelementos esenciales que respaldan la renovación celular durante el descanso.'
    },
    ocular_hepatorrenal: {
        title: 'Cruce Oculómico • Equilibrio Hidrosalino y Hepatobiliar',
        categories: ['renal', 'liver', 'gallbladder', 'basic_physical'],
        keywords: ['renal', 'agua', 'acido_urico', 'higado', 'biliar', 'proteina'],
        synergy33: 'Soporte antioxidante celular diurno sin sobrecarga de azúcares añadidos, en armonía con hidratación fraccionada.',
        synergy34: 'Acompañamiento nocturno diluido obligatoriamente en un mínimo de 500 ml de agua simple purificada para favorecer el balance hídrico.'
    },
    ocular_longevidad: {
        title: 'Cruce Oculómico • Edad Biológica y Resiliencia Endotelial',
        categories: ['eye', 'collagen', 'coenzymes', 'vitamins'],
        keywords: ['ojo', 'colageno', 'coenzima_q10', 'fatiga_visual', 'edema'],
        synergy33: 'Ignición mitocondrial diurna con Coenzima Q10 (MP104 31.25 mg), Vitamina C (MP048) y Silicio (MP119) frente al estrés oxidativo cotidiano.',
        synergy34: 'Regeneración tisular nocturna con Colágeno Hidrolizado (MP009 500 mg) y L-Glicina (MP023 200 mg) orientada a preservar el healthspan microvascular.'
    },
    ocular_estructura: {
        title: 'Cruce Oculómico • Medios Refringentes y Matriz Colágena',
        categories: ['eye', 'collagen', 'skin', 'trace_elements'],
        keywords: ['ojo', 'colageno', 'silicio', 'zinc', 'vitamina_a', 'vitamina_c'],
        synergy33: 'Soporte antioxidante de superficie con Vitamina C (MP048 1,000 mg) y Silicio estructural (MP119) en la fase matutina.',
        synergy34: 'Aporte nocturno de Colágeno Hidrolizado (MP009 500 mg) y Zinc Optizinc (MP171 18.75 mg) para la integridad de tejidos conectivos.'
    },
    lingual_microbioma: {
        title: 'Cruce Glosómico • Microbioma y Motilidad Digestiva',
        categories: ['gastrointestinal', 'colon', 'pancreas'],
        keywords: ['peristalsis', 'pepsina', 'absorcion', 'flora', 'colon', 'gastrico'],
        synergy33: 'Activación metabólica matutina suave que acompaña una alimentación natural libre de ultraprocesados e irritantes.',
        synergy34: 'Soporte digestivo nocturno con L-Glutamina (MP024 100 mg), Bromelina (MP008), Papaína (MP033) y fibra prebiótica en >= 500 ml de agua.'
    },
    lingual_vascular: {
        title: 'Cruce Glosómico • Retorno Sublingual y Hemodinamia',
        categories: ['cardiovascular', 'pulso_cerebro_y_corazon', 'collagen'],
        keywords: ['viscosidad', 'resistencia', 'elasticidad', 'circulatorio', 'perfusion'],
        synergy33: 'Soporte endotelial y de microperfusión diurna con Coenzima Q10 (MP104 31.25 mg) y Niacina B3 (MP046 31.25 mg).',
        synergy34: 'Respaldo estructural nocturno a paredes vasculares mediante Colágeno Hidrolizado (MP009 500 mg) y L-Glicina (MP023 200 mg).'
    },
    lingual_nutricion: {
        title: 'Cruce Glosómico • Sustrato Mucoso y Cofactores',
        categories: ['vitamins', 'trace_elements', 'amino_acids'],
        keywords: ['vitamina_b', 'folico', 'hierro', 'zinc', 'aminoacido'],
        synergy33: 'Aporte matutino de vitaminas hidrosolubles y cofactores catalíticos celulares para sostener la vitalidad diurna.',
        synergy34: 'Reposición nocturna de aminoácidos y minerales quelados (Zinc Optizinc MP171) que favorecen el recambio epitelial.'
    },
    lingual_hepatorrenal: {
        title: 'Cruce Glosómico • Hidratación Mucosa y Eje Hepatorrenal',
        categories: ['liver', 'renal', 'gallbladder', 'basic_physical'],
        keywords: ['agua', 'higado', 'biliar', 'renal', 'deshidratacion'],
        synergy33: 'Acompañamiento metabólico diurno vinculado a ingesta constante de agua natural durante la jornada.',
        synergy34: 'Dilución nocturna en mínimo 500 ml de agua purificada con aminoácidos de soporte metabólico celular.'
    },
    lingual_inmune: {
        title: 'Cruce Glosómico • Reactividad Mucosa e Inmunotolerancia',
        categories: ['immune', 'allergies', 'toxins'],
        keywords: ['inmune', 'mucosa', 'ig', 'alergia', 'toxina'],
        synergy33: 'Respaldo antioxidante diurno con Vitamina C (MP048 1,000 mg) y fitonutrientes moduladores frente a carga oxidativa.',
        synergy34: 'Soporte de barrera epitelial nocturna con L-Glutamina (MP024 100 mg) y Zinc Optizinc (MP171 18.75 mg).'
    },
    lingual_mucosal: {
        title: 'Cruce Glosómico • Trofismo Muscular y Edad Mucosal',
        categories: ['collagen', 'amino_acids', 'coenzymes'],
        keywords: ['colageno', 'muscular', 'biotina', 'pantotenico', 'coenzima'],
        synergy33: 'Cofactores energéticos diurnos que apoyan el tono funcional y la vitalidad celular.',
        synergy34: 'Soporte regenerativo nocturno con Colágeno Hidrolizado (MP009 500 mg), Ácido Pantoténico B5 (MP149) y Biotina B7 (MP053).'
    },
    somatic_vascular: {
        title: 'Cruce Somático • Matriz Vascular y Tejido Conectivo',
        categories: ['collagen', 'cardiovascular', 'skin'],
        keywords: ['circulatorio', 'sistema_circulatorio', 'vascular', 'elasticidad', 'colageno', 'piel'],
        synergy33: 'Soporte antioxidante y estructural diurno con Vitamina C (MP048 1,000 mg), Silicio (MP119) y Coenzima Q10 (MP104 31.25 mg).',
        synergy34: 'Acompañamiento regenerativo nocturno con Colágeno Hidrolizado (MP009 500 mg), L-Glicina (MP023 200 mg) y Zinc Optizinc (MP171 18.75 mg) para paredes vasculares y dermis.'
    }
};

export const TabBiochemicals = ({
    selectedFileToView,
    setSelectedFileToView,
    processedDocs,
    analyzeStatus,
    patientData
}) => {
    // ⚙️ Estado Reactivo de Acordeones (Fase 18) - Derivado y sin efecto en cascada
    const [manualToggles, setManualToggles] = useState({});

    const hasRealOcr = Boolean(
        (patientData?.scan_data?.external_metrics?.biomarkers &&
            Object.keys(patientData.scan_data.external_metrics.biomarkers).length > 0) ||
        (Array.isArray(patientData?.scan_data?.external_metrics?.sections) &&
            patientData.scan_data.external_metrics.sections.length > 0) ||
        (Array.isArray(patientData?.scan_data?.external_metrics?.external_studies?.clinical_imaging_and_cabinet) &&
            patientData.scan_data.external_metrics.external_studies.clinical_imaging_and_cabinet.length > 0)
    );
    const hasRealSomatic = Boolean(
        typeof patientData?.scan_data?.visual_metrics === 'object' && 
        patientData?.scan_data?.visual_metrics?.imageUrl
    );

    const openSections = {
        electret: manualToggles.electret ?? true,
        ocular: manualToggles.ocular ?? true,
        lingual: manualToggles.lingual ?? true,
        ocr: manualToggles.ocr ?? hasRealOcr,
        somatic: manualToggles.somatic ?? hasRealSomatic
    };

    const toggleSection = (sectionKey) => {
        setManualToggles(prev => ({
            ...prev,
            [sectionKey]: !(prev[sectionKey] ?? openSections[sectionKey])
        }));
    };

    const areAllOpen = Object.values(openSections).every(Boolean);

    const toggleAllSections = () => {
        const nextState = !areAllOpen;
        setManualToggles(prev => {
            const preservedCortex = Object.fromEntries(
                Object.entries(prev || {}).filter(([k]) => k.startsWith('cortex_'))
            );
            return {
                ...preservedCortex,
                electret: nextState,
                ocular: nextState,
                lingual: nextState,
                ocr: nextState,
                somatic: nextState
            };
        });
    };

    const renderModalContent = () => {
        if (!selectedFileToView) return null;
        const docData = processedDocs[selectedFileToView.name];
        if (!docData) return null;

        const hasAnyAlert = docData.isGrouped && Object.values(docData.findings).some(rows => rows.some(r => analyzeStatus(r.value, r.ref) !== 'normal'));

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 font-sans">
                    <div className="bg-[#1C75BC] p-5 flex justify-between items-center text-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2.5 rounded-xl shadow-lg backdrop-blur-md">
                                <span className="text-xl">🧪</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg tracking-wide">{docData.title}</h3>
                                <div className="flex gap-3 text-xs opacity-90 mt-1">
                                    <span className="flex items-center gap-1">👤 {docData.patient}</span>
                                    <span>|</span>
                                    <span className="bg-white/20 px-2 rounded border border-white/30 font-semibold">NOM-004 VERIFIED</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedFileToView(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-xl">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-6 custom-scrollbar">
                        {!hasAnyAlert && (
                            <div className="p-8 text-center bg-white rounded-xl border border-green-200 shadow-sm">
                                <div className="text-4xl mb-2">🌿</div>
                                <h3 className="text-[#3AAA35] font-bold">Sin hallazgos patológicos</h3>
                                <p className="text-[#3AAA35] text-sm">Todo en orden.</p>
                            </div>
                        )}
                        {docData.isGrouped && Object.entries(docData.findings).map(([section, rows], idx) => {
                            const abnormalRows = rows.filter(row => analyzeStatus(row.value, row.ref) !== 'normal');
                            if (abnormalRows.length === 0) return null;
                            return (
                                <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-red-50 px-6 py-3 border-b border-red-100 flex justify-between items-center">
                                        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-[#B70E0C] animate-pulse"></span> {section}
                                        </h4>
                                        <span className="text-[10px] bg-red-100 text-[#B70E0C] px-2 py-0.5 rounded-full font-bold border border-red-200">{abnormalRows.length} ALERTAS</span>
                                    </div>
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-slate-50">
                                            {abnormalRows.map((row, rIdx) => {
                                                const status = analyzeStatus(row.value, row.ref);
                                                let badgeClass = "bg-green-50 text-[#3AAA35] border-green-200";
                                                let badgeLabel = "Normal";
                                                if (status === 'low' || status === 'high') {
                                                    badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                                                    badgeLabel = status === 'high' ? "Anormal Leve ⬆" : "Anormal Leve ⬇";
                                                } else if (status === 'warning_low' || status === 'warning_high') {
                                                    badgeClass = "bg-orange-50 text-orange-700 border-orange-200";
                                                    badgeLabel = status === 'warning_high' ? "Anormal Moderado ⬆" : "Anormal Moderado ⬇";
                                                } else if (status === 'critical_low' || status === 'critical_high') {
                                                    badgeClass = "bg-red-50 text-[#B70E0C] border-red-200 font-extrabold";
                                                    badgeLabel = status === 'critical_high' ? "Anormal Severo ⬆" : "Anormal Severo ⬇";
                                                }
                                                return (
                                                    <tr key={rIdx} className="hover:bg-red-50/10 transition-colors tabular-nums">
                                                        <td className="px-6 py-3 font-medium text-[#334155] w-[40%]">{row.label}</td>
                                                        <td className="px-6 py-3 font-bold text-[#0F172A] text-base tabular-nums">{row.value}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${badgeClass}`}>{badgeLabel}</span>
                                                        </td>
                                                        <td className="px-6 py-3 text-[#334155] text-xs text-right font-mono tabular-nums">{row.ref}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showOnlyAbnormalities, setShowOnlyAbnormalities] = useState(false);

    const genomeTelemetry = useClinicalGenome(state => state.electretTelemetry);

    const activePatientFullName = (patientData?.profile?.name || patientData?.identificacion?.nombre || patientData?.name || '').trim();
    const activePatientFirstName = activePatientFullName.split(' ')[0] || '';

    // Sanitización estricta NOM-004 de electretMetrics contra contaminación de expediente
    const isElectretValidForCurrentPatient = React.useMemo(() => {
        // 1. Evaluar si Zustand contiene datos de otro paciente
        if (genomeTelemetry?.patientName && activePatientFullName) {
            if (!checkPatientMatch(activePatientFullName, genomeTelemetry.patientName)) {
                console.warn(`🛡️ NOM-004: Telemetría en Zustand (${genomeTelemetry.patientName}) no corresponde al paciente actual (${activePatientFullName}). Bloqueando.`);
                return false;
            }
        }

        const metricsToCheck = (genomeTelemetry?.isScanned && Object.keys(genomeTelemetry?.categories || {}).length > 0)
            ? genomeTelemetry.categories
            : patientData?.scan_data?.electret_metrics;
        if (!metricsToCheck || isSyntheticElectretPayload(metricsToCheck)) return false;

        // 2. Extraer nombre del paciente únicamente desde metadatos explícitos de paciente (NUNCA usar regex sobre "name" general porque coincide con el nombre de cada biomarcador como "Viscosidad de la Sangre")
        let scannedName = null;
        if (metricsToCheck?.patient_metadata?.name) {
            scannedName = metricsToCheck.patient_metadata.name;
        } else if (metricsToCheck?.patient_name) {
            scannedName = metricsToCheck.patient_name;
        } else if (patientData?.scan_data?.electret_patient_name) {
            scannedName = patientData.scan_data.electret_patient_name;
        } else if (genomeTelemetry?.patientName) {
            scannedName = genomeTelemetry.patientName;
        }

        if (scannedName && activePatientFullName) {
            const matches = checkPatientMatch(activePatientFullName, scannedName);
            if (!matches) {
                console.warn(`🛡️ NOM-004: Descartando telemetría de "${scannedName}" porque no corresponde al paciente activo "${activePatientFullName}"`);
                return false;
            }
        }
        return true;
    }, [patientData?.scan_data?.electret_metrics, patientData?.scan_data?.electret_patient_name, genomeTelemetry, activePatientFullName]);

    // Purga activa en Zustand si se detecta contaminación cruzada
    React.useEffect(() => {
        if (genomeTelemetry?.isScanned && !isElectretValidForCurrentPatient) {
            console.warn("🛡️ NOM-004: Purgando electretTelemetry en Zustand por incongruencia de paciente.");
            useClinicalGenome.getState().clearElectretTelemetry();
        }
    }, [isElectretValidForCurrentPatient, genomeTelemetry?.isScanned]);

    const isScanned = (patientData?.scan_data?.electret_scanned || genomeTelemetry?.isScanned) && isElectretValidForCurrentPatient;
    const validElectretMetrics = isScanned
        ? ((genomeTelemetry?.isScanned && Object.keys(genomeTelemetry?.categories || {}).length >= Object.keys(patientData?.scan_data?.electret_metrics || {}).length)
            ? genomeTelemetry.categories
            : (patientData?.scan_data?.electret_metrics || genomeTelemetry?.categories))
        : null;

    // INYECCIÓN ANTIGRAVITY: Rehidratación de estado global (Prevención de Amnesia F5)
    React.useEffect(() => {
        if (validElectretMetrics && !genomeTelemetry?.isScanned && isElectretValidForCurrentPatient) {
            useClinicalGenome.getState().setElectretTelemetry({
                categories: validElectretMetrics,
                patientName: activePatientFullName,
                isScanned: true
            });
        }
    }, [validElectretMetrics, genomeTelemetry?.isScanned, activePatientFullName, isElectretValidForCurrentPatient]);

    // INYECCIÓN ANTIGRAVITY: Actualización de SSOT y renderizado optimizado
    const activeMetrics = React.useMemo(() => {
        if (!isElectretValidForCurrentPatient) return {};
        let rawSource = null;
        
        const zustandCats = genomeTelemetry?.categories || {};
        const localCats = validElectretMetrics || {};

        // Priorizar la fuente que tenga el reporte completo (37 categorías vs 1 categoría parcial)
        if (genomeTelemetry?.isScanned && Object.keys(zustandCats).length >= Object.keys(localCats).length && Object.keys(zustandCats).length > 0) {
            rawSource = zustandCats;
        } else if (Object.keys(localCats).length > 0) {
            rawSource = localCats;
        }

        if (!rawSource) return {};
        
        // Procesamiento protegido por el cortocircuito del parser
        const parsed = parseElectretData(rawSource);
        return parsed?.categories || rawSource;
    }, [validElectretMetrics, genomeTelemetry, isElectretValidForCurrentPatient]);

    const categoriesKeys = Object.keys(activeMetrics);

    // 🔄 Auto-Rescate de Reporte Consolidado Completo (37 Categorías):
    // Si Zustand se vació por HMR/F5 pero SQLite ya resguarda el estudio del paciente activo, rehidratarlo pasivamente (storedOnly=true)
    const activeCitationId = String(patientData?.citaId || patientData?.idCita || patientData?.profile?.citaId || patientData?.identificacion?.idCita || '').trim();
    const hadElectretScanIntent = Boolean(patientData?.scan_data?.electret_scanned || genomeTelemetry?.isScanned);
    const hasAutoUpgradedRef = React.useRef(null);
    React.useEffect(() => {
        if (!activePatientFullName && !activeCitationId) return;
        if (categoriesKeys.length >= 20) return;
        const lookupKey = `${activeCitationId}|${activePatientFullName}:${hadElectretScanIntent ? 'scanned' : 'stored'}:rev4`;
        if (hasAutoUpgradedRef.current === lookupKey) return;

        hasAutoUpgradedRef.current = lookupKey;
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const storedParam = hadElectretScanIntent ? '' : '&storedOnly=true';
        const citaParam = activeCitationId ? `&citationId=${encodeURIComponent(activeCitationId)}` : '';

        fetch(`${cleanBase}/api/bio/scan/electret/sync?patientName=${encodeURIComponent(activePatientFullName)}${citaParam}${storedParam}&_t=${Date.now()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: JSON.stringify({ patientName: activePatientFullName, citationId: activeCitationId, storedOnly: !hadElectretScanIntent })
        })
            .then(r => r.json())
            .then(data => {
                if (data?.success && data?.electret_metrics && Object.keys(data.electret_metrics).length > 0 && !isSyntheticElectretPayload(data.electret_metrics)) {
                    useClinicalGenome.getState().setElectretTelemetry({
                        categories: data.electret_metrics,
                        patientName: data?.patientMetadata?.name || activePatientFullName,
                        patientMetadata: data?.patientMetadata || null,
                        synthesisItems: data?.synthesisItems || [],
                        citationId: activeCitationId || null,
                        isScanned: true,
                        totalParameters: data.totalParameters || 262,
                        abnormalCount: data.abnormalCount || 0
                    });
                }
            })
            .catch(err => console.warn("⚠️ Auto-upgrade Electret:", err.message));
    }, [`${activeCitationId}|${activePatientFullName}|${categoriesKeys.length}|${hadElectretScanIntent}|rev4`, activePatientFullName, categoriesKeys.length, activeCitationId, hadElectretScanIntent]);

    const activeCategory = selectedCategory || (categoriesKeys.length > 0 ? categoriesKeys[0] : null);

    const CATEGORIAS_CLINICAS = {
        cardiovascular: "Cardiovascular y Cerebrovasculares",
        gastrointestinal: "Función Gastrointestinal",
        colon: "Función del Intestino Grueso",
        liver: "Función Hepática",
        gallbladder: "Función de la Vesícula Biliar",
        pancreas: "Función Pancreática",
        renal: "Función Renal",
        pulmonary: "Función Pulmonar",
        brain: "Nervio Cerebral",
        bone_disease: "Padecimientos Óseos",
        bone_density: "Densidad Mineral Ósea",
        rheumatoid: "Enfermedad de Hueso Reumatoide",
        bone_growth: "Índice de Crecimiento Óseo",
        ndice_de_crecimiento_seo: "Índice de Crecimiento Óseo",
        blood_glucose: "Glucosa en la Sangre",
        blood_sugar: "Glucosa en la Sangre",
        trace_elements: "Oligoelementos",
        vitamins: "Vitaminas",
        amino_acids: "Aminoácidos",
        coenzymes: "Coenzimas",
        fatty_acids: "Ácidos Grasos",
        endocrine: "Sistema Endocrino",
        immune: "Sistema Inmunológico",
        thyroid: "Tiroides",
        toxins: "Toxina Humana",
        heavy_metals: "Metales Pesados",
        basic_physical: "Condición Física Básica",
        allergies: "Alergias",
        obesity: "Obesidad",
        skin: "Piel",
        eye: "Ojo",
        collagen: "Colágeno",
        meridians: "Meridianos (Acupuntura)",
        pulso_cerebro_y_corazon: "Pulso Cerebro y Corazón",
        blood_lipids: "Lípidos Sanguíneos",
        gynecology: "Ginecología",
        breasts: "Senos",
        menstrual_cycle: "Ciclo Menstrual",
        prostate: "Próstata",
        male_sexual: "Función Sexual Masculina",
        sperm_semen: "Esperma y Semen",
        body_composition: "Análisis Componencial Corporal",
        informe_de_anlisis_de_expertos: "Informe de Análisis de Expertos",
        informe_de_anlisis_de_la_mano: "Informe de Análisis de la Mano"
    };

    const [showAllSystemsMenu, setShowAllSystemsMenu] = useState(false);
    const [systemSearchQuery, setSystemSearchQuery] = useState('');
    const [selectedLabSectionId, setSelectedLabSectionId] = useState(null);
    const [showOnlyLabAbnormalities, setShowOnlyLabAbnormalities] = useState(false);

    const getCategoryItems = (catData) => {
        if (!catData) return [];
        if (Array.isArray(catData)) return catData;
        if (catData.items) {
            if (Array.isArray(catData.items)) return catData.items;
            if (typeof catData.items === 'object') {
                return Object.values(catData.items).filter(item => item && typeof item === 'object' && (item.name || item.val !== undefined || item.value !== undefined));
            }
        }
        if (Array.isArray(catData.abnormal) && catData.items === undefined) return catData.abnormal;
        if (typeof catData === 'object') {
            return Object.values(catData).filter(item => item && typeof item === 'object' && (item.name || item.val !== undefined || item.value !== undefined));
        }
        return [];
    };

    const getBadgeStyle = (status) => {
        if (!status || typeof status !== 'string') {
            return {
                bg: "bg-slate-100 text-slate-700 border-slate-200",
                borderLeft: "border-l-slate-400",
                calloutBg: "bg-slate-600 text-white",
                calloutArrow: "border-b-slate-600",
                label: "Informativo / Métrica Base",
                icon: <span className="text-slate-400 text-xs">📊</span>
            };
        }
        const s = status.toUpperCase().trim();
        if (s.includes('SEVERO') || s === 'CRITICAL' || s === '+++') {
            return {
                bg: "bg-red-50 text-[#B70E0C] border-red-200 font-extrabold",
                borderLeft: "border-l-[#B70E0C]",
                calloutBg: "bg-[#B70E0C] text-white",
                calloutArrow: "border-b-[#B70E0C]",
                label: "ANORMAL SEVERO (+++)",
                icon: <AlertTriangle size={12} className="text-[#B70E0C] animate-pulse" />
            };
        } else if (s.includes('MODERADO') || s === 'WARNING' || s === '++') {
            return {
                bg: "bg-orange-50 text-orange-700 border-orange-200 font-bold",
                borderLeft: "border-l-orange-500",
                calloutBg: "bg-orange-600 text-white",
                calloutArrow: "border-b-orange-600",
                label: "ANORMAL MODERADO (++)",
                icon: <AlertTriangle size={12} className="text-orange-600" />
            };
        } else if (s.includes('LEVE') || s === '+') {
            return {
                bg: "bg-amber-50 text-amber-700 border-amber-200 font-bold",
                borderLeft: "border-l-amber-500",
                calloutBg: "bg-amber-600 text-white",
                calloutArrow: "border-b-amber-600",
                label: "ANORMAL LEVE (+)",
                icon: <AlertTriangle size={12} className="text-amber-600" />
            };
        } else if (s.includes('NORMAL') || s === '-') {
            return {
                bg: "bg-green-50 text-[#3AAA35] border-green-200 font-bold",
                borderLeft: "border-l-[#3AAA35]",
                calloutBg: "bg-[#3AAA35] text-white",
                calloutArrow: "border-b-[#3AAA35]",
                label: "NORMAL (-)",
                icon: <CheckCircle2 size={12} className="text-[#3AAA35]" />
            };
        }
        return {
            bg: "bg-slate-100 text-slate-700 border-slate-200",
            borderLeft: "border-l-slate-400",
            calloutBg: "bg-slate-600 text-white",
            calloutArrow: "border-b-slate-600",
            label: status,
            icon: <span className="text-slate-400 text-xs">⚪</span>
        };
    };

    /**
     * 📐 Motor Matemático del Espectro Fisiológico (La Barra Termodinámica)
     * Blindado contra comas decimales europeas, rangos invertidos (ej. 0,796 - 0,433) y valores no numéricos.
     */
    const computeThermodynamicSpectrum = (valRaw, refRaw) => {
        if (valRaw === null || valRaw === undefined || refRaw === null || refRaw === undefined) {
            return { isRenderable: false };
        }
        const refStr = String(refRaw).trim();
        const valStr = String(valRaw).trim();

        // Excluir rangos descriptivos o porcentuales compuestos (ej. "Sin Dirección", "+", "< u 0,2", "Mediciones")
        if (!refStr.includes('-') || refStr.includes('<') || refStr.includes('>') || refStr.includes('%')) {
            return { isRenderable: false };
        }

        const rangeMatch = refStr.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)\s*$/);
        if (!rangeMatch) {
            return { isRenderable: false };
        }

        const numA = parseFloat(rangeMatch[1].replace(',', '.'));
        const numB = parseFloat(rangeMatch[2].replace(',', '.'));
        const numVal = parseFloat(valStr.replace(',', '.'));

        if (isNaN(numA) || isNaN(numB) || isNaN(numVal) || numA === numB) {
            return { isRenderable: false };
        }

        // Blindaje contra rangos invertidos de fábrica en ResultOne.htm (ej. Densidad Mineral Ósea: 0,796 - 0,433)
        const min = Math.min(numA, numB);
        const max = Math.max(numA, numB);
        const span = max - min;

        let rawPct = 50;
        let zone = 'OPTIMAL';
        let calloutText = `${valStr} (Dentro de límite)`;

        const formatDelta = (n) => Number(n.toFixed(3)).toString();

        if (numVal < min) {
            zone = 'LOW';
            const deficitRatio = Math.min((min - numVal) / (span || 1), 1.5) / 1.5;
            rawPct = 33.33 - (deficitRatio * 25.33);
            calloutText = `${valStr} (Déficit -${formatDelta(min - numVal)})`;
        } else if (numVal > max) {
            zone = 'HIGH';
            const excessRatio = Math.min((numVal - max) / (span || 1), 1.5) / 1.5;
            rawPct = 66.67 + (excessRatio * 25.33);
            calloutText = `${valStr} (Excede +${formatDelta(numVal - max)})`;
        } else {
            zone = 'OPTIMAL';
            const optRatio = (numVal - min) / span;
            rawPct = 33.33 + (optRatio * 33.34);
            calloutText = `${valStr} (Dentro de límite)`;
        }

        const positionPct = Math.max(8, Math.min(92, Number(rawPct.toFixed(2))));

        return {
            isRenderable: true,
            min,
            max,
            numVal,
            zone,
            positionPct,
            calloutText,
            cleanRangeLabel: `${min} – ${max}`
        };
    };

    /**
     * 🔍 Evaluador Estricto de Valores Fuera de Rango
     * Verifica tanto la desviación matemática real (numVal < min || numVal > max) como el estado biosemántico.
     */
    const isMarkerOutOfRange = (item) => {
        if (!item) return false;
        const valText = item.val !== undefined ? item.val : (item.value !== undefined ? item.value : '');
        const refText = item.ref !== undefined ? item.ref : (item.reference !== undefined ? item.reference : '');
        const spectrum = computeThermodynamicSpectrum(valText, refText);
        const s = item?.status ? String(item.status).toUpperCase().trim() : 'NORMAL';
        const isStatusAbnormal = s !== 'NORMAL' && s !== 'NORMAL (-)' && s !== '-' && s !== 'INFORMATIVO';

        if (spectrum.isRenderable) {
            return spectrum.zone !== 'OPTIMAL' || isStatusAbnormal;
        }
        return isStatusAbnormal;
    };

    const getCategoryAbnormalCount = (catKey) => {
        const catData = activeMetrics?.[catKey];
        const items = getCategoryItems(catData);
        return items.reduce((acc, item) => (isMarkerOutOfRange(item) ? acc + 1 : acc), 0);
    };

    const getSystemMeta = (catKey) => {
        const key = String(catKey || '').toLowerCase();
        if (['cardiovascular', 'pulso_cerebro_y_corazon', 'blood_lipids'].includes(key)) {
            return {
                domain: 'SISTEMA CARDIOVASCULAR Y HEMODINÁMICO',
                desc: 'Evaluación bioeléctrica de perfusión tisular, resistencia vascular, elasticidad endotelial y reología sanguínea.'
            };
        }
        if (['gastrointestinal', 'colon', 'liver', 'gallbladder', 'pancreas'].includes(key)) {
            return {
                domain: 'SISTEMA DIGESTIVO Y HEPATOBILIAR',
                desc: 'Mapeo de motilidad peristáltica, absorción enterocitaria, biotransformación hepática y cinética enzimática.'
            };
        }
        if (['bone_disease', 'bone_density', 'rheumatoid', 'bone_growth'].includes(key)) {
            return {
                domain: 'SISTEMA OSTEOARTICULAR Y ESTRUCTURAL',
                desc: 'Evaluación polarimétrica de micro-calcificaciones, densidad trabecular, recambio óseo e inflamación tisular.'
            };
        }
        if (['trace_elements', 'vitamins', 'amino_acids', 'coenzymes', 'fatty_acids'].includes(key)) {
            return {
                domain: 'RESERVA MICRONUTRICIONAL Y COENZIMÁTICA',
                desc: 'Cuantificación biosemántica de cofactores catalíticos celulares, oligoelementos, vitaminas y sustratos esenciales.'
            };
        }
        if (['endocrine', 'thyroid', 'blood_sugar', 'blood_glucose', 'obesity'].includes(key)) {
            return {
                domain: 'EJE ENDOCRINO-METABÓLICO',
                desc: 'Análisis de señalización hormonal, sensibilidad insulínica, tasa metabólica tiroidea y oxidación lipídica.'
            };
        }
        if (['immune', 'allergies', 'toxins', 'heavy_metals'].includes(key)) {
            return {
                domain: 'INMUNOLOGÍA Y CARGA XENOBIÓTICA',
                desc: 'Tamizaje de reactividad inmunológica mucosa, hipersensibilidad ambiental y retención de metales pesados.'
            };
        }
        if (['skin', 'eye', 'collagen'].includes(key)) {
            return {
                domain: 'MATRIZ EXTRACELULAR Y TEGUMENTOS',
                desc: 'Integridad de fibras de colágeno estructural, hidratación epidérmica y microcirculación neuro-ocular.'
            };
        }
        return {
            domain: 'TELEMETRÍA SISTÉMICA FUNCIONAL',
            desc: 'Evaluación electromagnética celular no invasiva y mapeo de reactividad bioeléctrica de precisión.'
        };
    };

    const patientAgeYears = parseFloat(
        patientData?.profile?.age ??
        patientData?.identificacion?.edad ??
        35
    ) || 35;
    const isTutorAddressing = patientAgeYears < 13;
    const subjectPossessive = isTutorAddressing
        ? `el organismo de ${activePatientFirstName || 'su menor'}`
        : 'su organismo';

    const triggerManualDashboardSync = async () => {
        if (!activePatientFullName && !activeCitationId) return;
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        try {
            const res = await fetch(`${cleanBase}/api/bio/scan/electret/sync?patientName=${encodeURIComponent(activePatientFullName)}&forceFresh=true&_t=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                },
                body: JSON.stringify({
                    patientName: activePatientFullName,
                    citationId: activeCitationId,
                    forceFresh: true
                })
            });
            const data = await res.json().catch(() => null);
            if (data?.success && data?.electret_metrics && !isSyntheticElectretPayload(data.electret_metrics)) {
                useClinicalGenome.getState().setElectretTelemetry({
                    categories: data.electret_metrics,
                    patientName: data?.patientMetadata?.name || activePatientFullName,
                    patientMetadata: data?.patientMetadata || null,
                    synthesisItems: data?.synthesisItems || [],
                    citationId: activeCitationId || null,
                    isScanned: true,
                    totalParameters: data.totalParameters || 262,
                    abnormalCount: data.abnormalCount || 0
                });
            }
        } catch (err) {
            console.warn('⚠️ Sincronización manual desde Dashboard:', err.message);
        }
    };

    // Colección derivada del Informe de Síntesis original (inSynthesisReport: true) — Cero Hooks adicionales
    const synthesisPriorityMarkers = [];
    categoriesKeys.forEach((ck) => {
        const items = getCategoryItems(activeMetrics[ck]);
        items.forEach((it) => {
            if (it?.inSynthesisReport) {
                synthesisPriorityMarkers.push({
                    ...it,
                    catKey: ck,
                    catTitle: CATEGORIAS_CLINICAS[ck] || ck
                });
            }
        });
    });

    const getBiosemanticInference = (marker, spectrum, catKey = '') => {
        if (marker?.translation) return marker.translation;
        if (marker?.description) return marker.description;

        const name = marker?.displayName || marker?.name || 'Parámetro biológico';
        const normKey = String(marker?.key || name)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const normCat = String(catKey || '').toLowerCase();
        const s = String(marker?.status || 'NORMAL').toUpperCase().trim();
        const isStrictlyNormal = s === 'NORMAL' || s === 'NORMAL (-)' || s === '-' || s === 'EN RANGO';

        if (isStrictlyNormal) {
            return `${name} dentro de rango fisiológico saludable en ${subjectPossessive}, compatible con equilibrio funcional.`;
        }

        // Correlación funcional oficial Equipo en Acción® (Estequiometría 33Plus® y 34Plus® • COFEPRIS-Safe • Usted Global)
        if (normKey.includes('coenzima_q10') || normKey.includes('hipoxia') || normKey.includes('capacidad_vital') || normKey.includes('resistencia_vascular')) {
            return `Demanda bioenergética y de oxigenación microvascular en ${subjectPossessive}. Dentro del acompañamiento nutricional de Equipo en Acción®, se correlaciona con el soporte matutino de 33Plus® (Coenzima Q10 MP104 31.25 mg y polifenoles antioxidantes).`;
        }
        if (normKey.includes('vitamina_b3') || normKey.includes('niacina')) {
            return `Requerimiento de cofactor energético NAD+ y microcirculación en ${subjectPossessive}. Se acompaña en el esquema matutino con 33Plus® (Niacina B3 MP046 31.25 mg) junto a su alimentación diaria.`;
        }
        if (normKey.includes('vitamina_c')) {
            return `Mayor demanda antioxidante endotelial y de síntesis estructural en ${subjectPossessive}. El protocolo matutino de Equipo en Acción® aporta soporte nutricional mediante 33Plus® (Vitamina C MP048 1,000 mg).`;
        }
        if (normKey === 'silicio' || normKey.includes('silicio')) {
            return `Variación en reserva de silicio estructural para matriz vascular y tejido conectivo en ${subjectPossessive}. Se vincula al soporte micronutricional de 33Plus® (Silicio MP119) en sincronía con su hidratación diaria.`;
        }
        if (normKey.includes('metabolismo_lipidico') || normKey.includes('triglicerido') || normKey.includes('grasas_neutras') || normKey.includes('hdl') || normCat === 'obesity') {
            return `Indicador de movilización y oxidación de lípidos en ${subjectPossessive}. Se acompaña con alimentación limpia libre de azúcares refinados y soporte metabólico matutino de 33Plus® (L-Carnitina MP080 500 mg).`;
        }
        if (normKey.includes('peristalsis') || normKey.includes('absorcion') || normKey.includes('pepsina') || normCat === 'gastrointestinal' || normCat === 'colon') {
            return `Sensibilidad en motilidad o absorción enterocitaria en ${subjectPossessive}. Se sugiere alimentación libre de irritantes y acompañamiento vespertino/nocturno con 34Plus® (L-Glutamina MP024 100 mg, Bromelina MP008, Papaína MP033 y fibra prebiótica disueltos en mínimo 500 ml de agua simple).`;
        }
        if (normCat === 'collagen' || normKey.includes('colageno')) {
            return `Mayor demanda de recambio estructural en matriz extracelular y paredes vasculares de ${subjectPossessive}. Se vincula al soporte regenerativo nocturno de 34Plus® (Colágeno Hidrolizado MP009 500 mg y L-Glicina MP023 200 mg).`;
        }
        if (normKey === 'zinc' || normKey.includes('testosterona') || normKey.includes('prostatitis')) {
            return `Indicador funcional de equilibrio mineral, prostático y endocrino en ${subjectPossessive}. Dentro del protocolo de Equipo en Acción® recibe soporte nutricional complementario en 34Plus® (Zinc Optizinc MP171 18.75 mg) junto a valoración clínica integral.`;
        }
        if (normKey.includes('pantotenico') || normKey.includes('biotina')) {
            return `Requerimiento de cofactores enzimáticos celulares en ${subjectPossessive}. Se acompaña en la fase nocturna con 34Plus® (Ácido Pantoténico B5 MP149 6.25 mg y Biotina B7 MP053 1 mg).`;
        }
        if (normKey.includes('vitamina_k') || normKey.includes('paratiroides') || normKey.includes('calcificacion')) {
            return `Indicador de regulación y orientación fisiológica del calcio tisular en ${subjectPossessive}. Se correlaciona con el soporte nutricional de 34Plus® (Vitamina K2 MK-7 MP172 1 mg) bajo vigilancia médica responsable.`;
        }
        if (normKey.includes('acido_urico') || normKey.includes('falta_de_agua') || normKey.includes('mercurio') || normKey.includes('arsenico') || normCat === 'renal') {
            return `Señal de demanda hídrica y depuración fisiológica renal en ${subjectPossessive}. Priorice hidratación constante con agua simple purificada y diluya siempre 34Plus® en un mínimo de 500 ml de agua natural.`;
        }

        if (spectrum?.isRenderable) {
            if (spectrum.zone === 'HIGH') {
                return `Elevación bioeléctrica en ${name} por encima del umbral de referencia (${spectrum.max}) en ${subjectPossessive}. Sugiere demanda adaptativa que usted puede acompañar con hidratación estructurada y nutrición personalizada de Equipo en Acción®.`;
            }
            if (spectrum.zone === 'LOW') {
                return `Disminución bioeléctrica en ${name} por debajo del umbral de referencia (${spectrum.min}) en ${subjectPossessive}. Sugiere requerimiento de soporte nutricional celular dentro de su protocolo personalizado.`;
            }
        }
        return `Variación funcional detectada en ${name} (${marker?.status}) en ${subjectPossessive}. Se integra a la correlación clínica global de su expediente NOM-004.`;
    };

    const activeSubstep = patientData?.scan_data?.active_substep;
    const substepSyncTick = patientData?.scan_data?.substep_sync_tick || 0;

    useEffect(() => {
        if (!activeSubstep) return;
        let targetId = null;
        let activeSectionKey = null;
        if (activeSubstep === 'ELECTRET') {
            targetId = 'card-electret';
            activeSectionKey = 'electret';
        } else if (activeSubstep === 'OCULAR' || activeSubstep.includes('OCULAR')) {
            targetId = 'card-ocular';
            activeSectionKey = 'ocular';
        } else if (activeSubstep === 'LINGUAL') {
            targetId = 'card-lingual';
            activeSectionKey = 'lingual';
        } else if (activeSubstep === 'EXTERNAL') {
            targetId = 'card-pdf';
            activeSectionKey = 'ocr';
        } else if (activeSubstep === 'VISUAL') {
            targetId = 'card-somatic';
            activeSectionKey = 'somatic';
        }

        if (activeSectionKey) {
            setManualToggles(prev => {
                const preservedCortex = Object.fromEntries(
                    Object.entries(prev || {}).filter(([k]) => k.startsWith('cortex_'))
                );
                return {
                    ...preservedCortex,
                    electret: activeSectionKey === 'electret',
                    ocular: activeSectionKey === 'ocular',
                    lingual: activeSectionKey === 'lingual',
                    ocr: activeSectionKey === 'ocr',
                    somatic: activeSectionKey === 'somatic'
                };
            });
        } else if (activeSubstep === 'FINAL_SEAL') {
            setManualToggles(prev => {
                const preservedCortex = Object.fromEntries(
                    Object.entries(prev || {}).filter(([k]) => k.startsWith('cortex_'))
                );
                return {
                    ...preservedCortex,
                    electret: Boolean(isScanned),
                    ocular: Boolean(patientData?.scan_data?.ocular_metrics && patientData?.scan_data?.ocular_metrics !== 'OMITTED'),
                    lingual: Boolean(patientData?.scan_data?.lingual_metrics && patientData?.scan_data?.lingual_metrics !== 'OMITTED'),
                    ocr: hasRealOcr,
                    somatic: hasRealSomatic
                };
            });
        }

        if (targetId) {
            const timer = setTimeout(() => {
                const el = document.getElementById(targetId);
                if (el) {
                    const scrollParent = el.closest('.overflow-y-auto');
                    if (scrollParent) {
                        const parentRect = scrollParent.getBoundingClientRect();
                        const elRect = el.getBoundingClientRect();
                        const nextTop = scrollParent.scrollTop + (elRect.top - parentRect.top) - 12;
                        scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
                    } else {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }, 220);
            return () => clearTimeout(timer);
        }
    }, [activeSubstep, substepSyncTick, hasRealOcr, hasRealSomatic, isScanned, patientData?.scan_data?.ocular_metrics, patientData?.scan_data?.lingual_metrics]);

    // Normalización Dinámica Defensiva y Extracción Unificada
    const rawOcular = patientData?.scan_data?.ocular_metrics || patientData?.scan_data?.ocular_audit;
    const rawLingual = patientData?.scan_data?.lingual_metrics || patientData?.scan_data?.lingual_topography;

    const ocularAudit = React.useMemo(() => {
        if (!rawOcular || rawOcular === 'OMITTED' || typeof rawOcular !== 'object') return null;
        const base = rawOcular.ocular_audit || rawOcular.ocular_metrics || rawOcular;
        const pilares = rawOcular.pilares || base.pilares || null;

        return {
            right_eye_url: rawOcular?.right_eye_url || base.right_eye_url || base.rightEyeUrl || null,
            left_eye_url: rawOcular?.left_eye_url || base.left_eye_url || base.leftEyeUrl || null,
            tipo_toma: sanitizeUiWhiteLabelText(rawOcular?.tipo_toma || base.tipo_toma || "Segmento Anterior (Superficie Ocular)"),
            calidad_optica: sanitizeUiWhiteLabelText(rawOcular?.calidad_optica || base.calidad_optica || "Óptima"),
            sintesis_fisiopatologica: sanitizeUiWhiteLabelText(rawOcular?.sintesis_fisiopatologica || base.sintesis_fisiopatologica || '') || null,
            disclaimer_legal: sanitizeUiWhiteLabelText(rawOcular?.disclaimer_legal || base.disclaimer_legal || "Tamizaje bio-óptico no invasivo mediante el Motor de Visión Clínica Equipo en Acción® conforme a la NOM-004-SSA3-2012 y COFEPRIS."),
            pilares: pilares ? {
                diabetes_glucosa: pilares.diabetes_glucosa || null,
                cardiovascular_lipidos: pilares.cardiovascular_lipidos || null,
                conteo_sanguineo_anemia: pilares.conteo_sanguineo_anemia || null,
                funcion_renal_hepatica: pilares.funcion_renal_hepatica || null,
                edad_biologica_longevidad: pilares.edad_biologica_longevidad || null,
                salud_visual_estructural: pilares.salud_visual_estructural || null,
            } : null,
            palidez_conjuntival: (typeof base.palidez_conjuntival === 'object' && base.palidez_conjuntival !== null)
                ? base.palidez_conjuntival
                : {
                    estado: typeof base.palidez_conjuntival === 'string' ? base.palidez_conjuntival : "No evaluable sin eversión palpebral tarsal",
                    descripcion_clinica: sanitizeUiWhiteLabelText(base.predictions?.hemoglobin?.translation || "Determinación fotográfica sujeta a eversión tarsal.")
                },
            microcirculacion_escleral: (typeof base.microcirculacion_escleral === 'object' && base.microcirculacion_escleral !== null)
                ? base.microcirculacion_escleral
                : {
                    calibre_vascular: base.calibre_vascular || "Calibre Normal",
                    densidad_capilar: typeof base.microcirculacion_escleral === 'string' ? base.microcirculacion_escleral : "Lechos venulares epiesclerales analizados",
                    hallazgos_especificos: Array.isArray(base.hallazgos_especificos) ? base.hallazgos_especificos : []
                },
            tejido_periorbital: (typeof base.tejido_periorbital === 'object' && base.tejido_periorbital !== null)
                ? base.tejido_periorbital
                : null,
            asimetria_binocular: (typeof base.asimetria_binocular === 'object' && base.asimetria_binocular !== null)
                ? base.asimetria_binocular
                : {
                    es_simetrico: true,
                    observaciones: base.asymmetry_findings || "Simetría binocular evaluada."
                }
        };
    }, [rawOcular]);

    const lingualAudit = React.useMemo(() => {
        if (!rawLingual || rawLingual === 'OMITTED' || typeof rawLingual !== 'object') return null;
        const base = rawLingual.lingual_metrics || rawLingual.lingual_topography || rawLingual;
        const pilares = rawLingual.pilares || base.pilares || null;

        return {
            dorsal_url: rawLingual?.dorsal_url || rawLingual?.dorsalUrl || base.dorsal_url || base.dorsalUrl || base.imageUrl || null,
            ventral_url: rawLingual?.ventral_url || rawLingual?.ventralUrl || base.ventral_url || base.ventralUrl || null,
            imageUrl: rawLingual?.imageUrl || base.imageUrl || base.image_url || null,
            tipo_toma: sanitizeUiWhiteLabelText(rawLingual?.tipo_toma || base.tipo_toma || "Cara Dorsal (Saburra y Papilas)"),
            calidad_optica: sanitizeUiWhiteLabelText(rawLingual?.calidad_optica || base.calidad_optica || "Óptima"),
            sintesis_fisiopatologica: sanitizeUiWhiteLabelText(rawLingual?.sintesis_fisiopatologica || base.sintesis_fisiopatologica || '') || null,
            disclaimer_legal: sanitizeUiWhiteLabelText(rawLingual?.disclaimer_legal || base.disclaimer_legal || "Tamizaje glosómico funcional no invasivo mediante el Motor de Visión Clínica Equipo en Acción® conforme a la NOM-004-SSA3-2012 y COFEPRIS."),
            pilares: pilares ? {
                gastrointestinal_microbioma: pilares.gastrointestinal_microbioma || null,
                cardiovascular_oxigenacion: pilares.cardiovascular_oxigenacion || null,
                conteo_sanguineo_nutricion: pilares.conteo_sanguineo_nutricion || null,
                funcion_hepatica_renal_hidratacion: pilares.funcion_hepatica_renal_hidratacion || null,
                inmune_inflamacion: pilares.inmune_inflamacion || null,
                edad_biologica_mucosal: pilares.edad_biologica_mucosal || null
            } : null,
            cuerpo_lingual: (typeof base.cuerpo_lingual === 'object' && base.cuerpo_lingual !== null)
                ? base.cuerpo_lingual
                : {
                    coloracion_sustrato: base.coloracion_sustrato || "Normal / Rosado",
                    trofismo_volumen: sanitizeUiWhiteLabelText(base.trofismo_volumen || "Eutrófico"),
                    indentaciones_dentales: base.indentaciones_dentales || "Ausentes",
                    fisuras_mucosa: base.fisuras_mucosa || "Sin fisuras"
                },
            saburra_microbiota: (typeof base.saburra_microbiota === 'object' && base.saburra_microbiota !== null)
                ? base.saburra_microbiota
                : {
                    grosor: sanitizeUiWhiteLabelText(base.saburra_thickness || (typeof base.saburra_lingual === 'string' ? base.saburra_lingual : "Delgada / Fisiológica")),
                    color: "Normocoloreada",
                    distribucion_topografica: (typeof base.saburra_microbiota?.distribucion_topografica === 'object')
                        ? base.saburra_microbiota.distribucion_topografica
                        : null,
                    humectacion: base.epithelial_hydration || "Normo-humectada"
                }
        };
    }, [rawLingual]);

    const lingualTopography = lingualAudit;

    const renderCortexCorrelationControl = (toggleKey, domainKey) => {
        const blueprint = CORTEX_DOMAIN_BLUEPRINTS[domainKey] || CORTEX_DOMAIN_BLUEPRINTS.ocular_longevidad;
        const isOpen = Boolean(manualToggles[toggleKey]);

        const matchedMarkers = [];
        let primaryCatKey = null;
        for (const catCandidate of blueprint.categories) {
            if (activeMetrics?.[catCandidate]) {
                if (!primaryCatKey) primaryCatKey = catCandidate;
                const catItems = getCategoryItems(activeMetrics[catCandidate]);
                for (const it of catItems) {
                    const normItem = String(it?.key || it?.displayName || it?.name || '')
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .toLowerCase();
                    const kwHit = blueprint.keywords.some(kw => normItem.includes(kw));
                    if (kwHit || isMarkerOutOfRange(it)) {
                        matchedMarkers.push({
                            catKey: catCandidate,
                            catLabel: CATEGORIAS_CLINICAS[catCandidate] || catCandidate,
                            name: it?.displayName || it?.name || 'Parámetro',
                            val: it?.val ?? it?.value ?? '—',
                            status: it?.status || 'Normal',
                            abnormal: isMarkerOutOfRange(it)
                        });
                    }
                    if (matchedMarkers.length >= 4) break;
                }
            }
            if (matchedMarkers.length >= 4) break;
        }

        if (matchedMarkers.length === 0 && primaryCatKey) {
            const fallbackItems = getCategoryItems(activeMetrics[primaryCatKey]).slice(0, 2);
            fallbackItems.forEach((it) => {
                matchedMarkers.push({
                    catKey: primaryCatKey,
                    catLabel: CATEGORIAS_CLINICAS[primaryCatKey] || primaryCatKey,
                    name: it?.displayName || it?.name || 'Parámetro',
                    val: it?.val ?? it?.value ?? '—',
                    status: it?.status || 'Normal',
                    abnormal: isMarkerOutOfRange(it)
                });
            });
        }

        const hasHtmLoaded = Object.keys(activeMetrics || {}).length > 0;

        return (
            <div className="pt-1.5 space-y-2.5">
                <div className="flex justify-end">
                    <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setManualToggles(prev => ({ ...prev, [toggleKey]: !prev[toggleKey] }))}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#1C75BC]/35 dark:border-[#93C5FD]/35 bg-[#F8FAFC] dark:bg-[#0F172A] hover:bg-[#1C75BC] hover:text-white dark:hover:bg-[#1C75BC] dark:hover:text-white text-[#1C75BC] dark:text-[#93C5FD] text-xs font-extrabold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                        <span>{isOpen ? 'Ocultar Correlación Córtex ↑' : 'Correlación Córtex →'}</span>
                    </button>
                </div>

                {isOpen && (
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] space-y-2.5 text-left animate-in fade-in duration-200 tabular-nums">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-[#334155] pb-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
                                {blueprint.title}
                            </span>
                            {hasHtmLoaded && primaryCatKey && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategory(primaryCatKey);
                                        setManualToggles(prev => ({ ...prev, electret: true }));
                                        const el = document.getElementById('card-electret');
                                        if (el) {
                                            const scrollParent = el.closest('.overflow-y-auto');
                                            if (scrollParent) {
                                                const pRect = scrollParent.getBoundingClientRect();
                                                const eRect = el.getBoundingClientRect();
                                                scrollParent.scrollTo({
                                                    top: Math.max(0, scrollParent.scrollTop + (eRect.top - pRect.top) - 12),
                                                    behavior: 'smooth'
                                                });
                                            } else {
                                                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }
                                        }
                                    }}
                                    className="min-h-[44px] px-2.5 py-1 rounded-lg bg-white dark:bg-[#1E293B] border border-[#1C75BC]/30 text-[#1C75BC] dark:text-[#93C5FD] hover:bg-[#1C75BC] hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                                >
                                    Abrir {CATEGORIAS_CLINICAS[primaryCatKey] || primaryCatKey} en Electret ↑
                                </button>
                            )}
                        </div>

                        {hasHtmLoaded && matchedMarkers.length > 0 ? (
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] block">
                                    Cruce en vivo con bioseñales .HTM de {subjectPossessive}:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {matchedMarkers.map((mk, mIdx) => (
                                        <div
                                            key={mIdx}
                                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                                                mk.abnormal
                                                    ? 'bg-[#FFCC00]/20 border-[#E6B800] text-[#0F172A] dark:text-[#F8FAFC]'
                                                    : 'bg-white dark:bg-[#1E293B] border-slate-200 dark:border-[#334155] text-[#0F172A] dark:text-[#F8FAFC]'
                                            }`}
                                        >
                                            <span className="font-semibold truncate" title={`${mk.catLabel}: ${mk.name}`}>{mk.name}</span>
                                            <span className="font-mono font-extrabold shrink-0">{String(mk.val)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                                Sin lectura .HTM activa en memoria; correlación funcional calculada sobre el hallazgo morfológico registrado en {subjectPossessive}.
                            </p>
                        )}

                        <div className="grid grid-cols-1 gap-2 pt-1">
                            <div className="p-2.5 rounded-lg bg-white dark:bg-[#1E293B] border-l-4 border-l-[#B70E0C] border border-slate-200/80 dark:border-[#334155] text-[11px] leading-relaxed text-[#0F172A] dark:text-[#F8FAFC]">
                                <strong className="text-[#B70E0C] dark:text-[#FCA5A5] font-extrabold">33Plus® (Base Celular Diurna): </strong>
                                {blueprint.synergy33}
                            </div>
                            <div className="p-2.5 rounded-lg bg-white dark:bg-[#1E293B] border-l-4 border-l-[#3AAA35] border border-slate-200/80 dark:border-[#334155] text-[11px] leading-relaxed text-[#0F172A] dark:text-[#F8FAFC]">
                                <strong className="text-[#3AAA35] dark:text-[#86EFAC] font-extrabold">34Plus® (Soporte Regenerativo Nocturno): </strong>
                                {blueprint.synergy34}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4 font-sans" id="card-lab">

            {/* 🔄 BARRA DE HERRAMIENTAS SUPERIOR CON CONTROL GLOBAL DE ACORDEONES */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#1C75BC] flex items-center justify-center text-sm font-bold shadow-xs">
                        📋
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Telemetría y Evaluaciones Multimodales (Fase 18)</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Secuencia cronológica estricta de expediente clínico conforme a la NOM-004-SSA3-2012</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={toggleAllSections}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                >
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${areAllOpen ? 'rotate-180' : ''}`} />
                    <span>{areAllOpen ? 'Colapsar todo' : 'Expandir todo'}</span>
                </button>
            </div>

            {/* ⚡ [ACORDEÓN 1] PASO 1: ESCÁNER BIOELÉCTRICO Y BIORRESONANCIA (ELECTRET) */}
            <div id="card-electret" className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                <div className="bg-[#1C75BC]/5 dark:bg-[#1C75BC]/10 border-b border-[#1C75BC]/20 flex items-center justify-between">
                    <button 
                        type="button"
                        onClick={() => toggleSection('electret')}
                        className="flex-1 p-4 flex items-center gap-2.5 text-left hover:bg-[#1C75BC]/10 transition-colors select-none focus:outline-none cursor-pointer"
                        aria-expanded={openSections.electret}
                    >
                        <span className="text-base">⚡</span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Escáner Bioeléctrico y Biorresonancia (Electret)</h4>
                        <ChevronDown className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openSections.electret ? 'rotate-180' : ''}`} />
                    </button>

                    {/* 🔒 Aislamiento de eventos con e.stopPropagation() */}
                    <div className="pr-4 flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                triggerManualDashboardSync();
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl border border-[#1C75BC]/30 bg-white dark:bg-slate-800 text-[#1C75BC] hover:bg-[#1C75BC] hover:text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="Sincronizar informe .HTM más reciente del paciente"
                        >
                            <span>🔄 Sincronizar .HTM</span>
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                const nextVal = !showOnlyAbnormalities;
                                setShowOnlyAbnormalities(nextVal);
                                if (nextVal && activeCategory && getCategoryAbnormalCount(activeCategory) === 0) {
                                    const firstWithAlerts = categoriesKeys.find(k => getCategoryAbnormalCount(k) > 0);
                                    if (firstWithAlerts) setSelectedCategory(firstWithAlerts);
                                }
                            }} 
                            className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                showOnlyAbnormalities 
                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] hover:bg-[#155A92]' 
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            <Filter size={12} />
                            {showOnlyAbnormalities ? 'Mostrando fuera de rango' : 'Mostrar solo alertas'}
                        </button>
                    </div>
                </div>

                <div className={`grid transition-all duration-300 ease-in-out ${openSections.electret ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                        {Object.keys(activeMetrics).length === 0 ? (
                            <div className="p-10 text-center bg-[#F8FAFC] dark:bg-slate-900/60 my-6 mx-4 rounded-3xl border border-dashed border-[#1C75BC]/30 space-y-4">
                                <div className="w-14 h-14 rounded-2xl bg-[#1C75BC]/10 text-[#1C75BC] flex items-center justify-center mx-auto text-2xl shadow-xs">
                                    ⚡
                                </div>
                                <div className="space-y-1.5">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                        Compuerta de telemetría bioeléctrica en espera (NOM-004)
                                    </h4>
                                    <p className="text-slate-700 dark:text-slate-300 text-xs max-w-md mx-auto leading-relaxed">
                                        {activePatientFullName ? (
                                            <>Aguardando informe real <code>.htm</code> verificado para <strong>{activePatientFullName}</strong>. Realice el escaneo en Electret o sincronice el reporte existente.</>
                                        ) : (
                                            <>Aguardando sincronización de estudio real desde la <strong>Fase 18</strong> del panel izquierdo.</>
                                        )}
                                    </p>
                                </div>
                                {activePatientFullName && (
                                    <div className="pt-1 flex justify-center">
                                        <button
                                            type="button"
                                            onClick={triggerManualDashboardSync}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[48px] rounded-xl bg-[#1C75BC] hover:bg-[#155A92] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                                        >
                                            <span>🔄 Sincronizar informe .HTM del paciente</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col bg-[#FAFAFA] dark:bg-slate-900">
                                {/* 🧭 1. NAVEGACIÓN ANATÓMICA HORIZONTAL + MENÚ BUSCABLE DE 37 CATEGORÍAS */}
                                <div className="relative bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                                    {(() => {
                                        const navigableKeys = showOnlyAbnormalities
                                            ? categoriesKeys.filter(k => getCategoryAbnormalCount(k) > 0)
                                            : categoriesKeys;
                                        const effectiveCategory = (activeCategory && navigableKeys.includes(activeCategory))
                                            ? activeCategory
                                            : (navigableKeys[0] || activeCategory);
                                        const baseSlice = navigableKeys.slice(0, 5);
                                        const visiblePills = effectiveCategory && !baseSlice.includes(effectiveCategory)
                                            ? [effectiveCategory, ...navigableKeys.filter(k => k !== effectiveCategory).slice(0, 4)]
                                            : baseSlice;

                                        return (
                                            <>
                                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0 mr-1">
                                                        <span className="text-[#1C75BC]">❖</span> SISTEMAS:
                                                    </span>

                                                    {visiblePills.map(catKey => {
                                                        const title = CATEGORIAS_CLINICAS[catKey] || catKey.replace(/_/g, ' ');
                                                        const abnormalCount = getCategoryAbnormalCount(catKey);
                                                        const isSelected = catKey === effectiveCategory;

                                                        return (
                                                            <button
                                                                key={catKey}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedCategory(catKey);
                                                                    setShowAllSystemsMenu(false);
                                                                }}
                                                                className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                                                                    isSelected
                                                                        ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-sm'
                                                                        : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-200/70'
                                                                }`}
                                                            >
                                                                <span className="truncate max-w-[180px]">{title}</span>
                                                                {abnormalCount > 0 ? (
                                                                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                                                                        isSelected
                                                                            ? 'bg-[#B70E0C] text-white ring-1 ring-white/80'
                                                                            : 'bg-[#B70E0C] text-white'
                                                                    }`}>
                                                                        {abnormalCount}
                                                                    </span>
                                                                ) : (
                                                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                                                                        isSelected
                                                                            ? 'bg-white/20 text-white'
                                                                            : 'bg-[#3AAA35]/15 text-[#3AAA35]'
                                                                    }`}>
                                                                        OK
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}

                                                    {navigableKeys.length > 5 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowAllSystemsMenu(prev => !prev)}
                                                            className={`ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-extrabold border transition-all shrink-0 cursor-pointer ${
                                                                showAllSystemsMenu
                                                                    ? 'bg-slate-800 text-white border-slate-800'
                                                                    : 'bg-white dark:bg-slate-800 text-[#1C75BC] border-[#1C75BC]/30 hover:bg-[#1C75BC]/5'
                                                            }`}
                                                        >
                                                            <span>Más ({navigableKeys.length - 5})</span>
                                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllSystemsMenu ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Panel Desplegable Buscable para las Categorías */}
                                                {showAllSystemsMenu && (
                                                    <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg animate-in fade-in duration-150">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                                                {showOnlyAbnormalities
                                                                    ? `Sistemas con Valores Fuera de Rango (${navigableKeys.length} Categorías)`
                                                                    : `Directorio Completo de Sistemas Biológicos (${navigableKeys.length} Categorías)`}
                                                            </span>
                                                            <input
                                                                type="text"
                                                                value={systemSearchQuery}
                                                                onChange={(e) => setSystemSearchQuery(e.target.value)}
                                                                placeholder="🔍 Filtrar sistema (ej. Oligoelementos, Tiroides, Hígado)..."
                                                                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 w-full sm:w-72 focus:outline-none focus:border-[#1C75BC]"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                                            {navigableKeys
                                                                .filter(catKey => {
                                                                    if (!systemSearchQuery.trim()) return true;
                                                                    const q = systemSearchQuery.toLowerCase().trim();
                                                                    const label = (CATEGORIAS_CLINICAS[catKey] || catKey).toLowerCase();
                                                                    return label.includes(q) || catKey.toLowerCase().includes(q);
                                                                })
                                                                .map((catKey, index) => {
                                                                    const title = CATEGORIAS_CLINICAS[catKey] || catKey.replace(/_/g, ' ');
                                                                    const abnormalCount = getCategoryAbnormalCount(catKey);
                                                                    const isSelected = catKey === effectiveCategory;
                                                                    return (
                                                                        <button
                                                                            key={catKey}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedCategory(catKey);
                                                                                setShowAllSystemsMenu(false);
                                                                                setSystemSearchQuery('');
                                                                            }}
                                                                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer border ${
                                                                                isSelected
                                                                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-xs'
                                                                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:border-[#1C75BC]/50'
                                                                            }`}
                                                                        >
                                                                            <span className="truncate pr-2">
                                                                                <span className={`font-mono text-[10px] mr-1.5 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                                                                    {index + 1}.
                                                                                </span>
                                                                                {title}
                                                                            </span>
                                                                            {abnormalCount > 0 ? (
                                                                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                                                                                    isSelected ? 'bg-[#B70E0C] text-white ring-1 ring-white/80' : 'bg-[#B70E0C] text-white'
                                                                                }`}>
                                                                                    {abnormalCount}
                                                                                </span>
                                                                            ) : (
                                                                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${
                                                                                    isSelected ? 'bg-white/20 text-white' : 'bg-[#3AAA35]/15 text-[#3AAA35]'
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
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* 🏥 2. CABECERA DE TRIAGE SISTÉMICO + BENTO CARDS TERMODINÁMICAS */}
                                <div className="p-5 max-h-[760px] overflow-y-auto space-y-4 custom-scrollbar">
                                    {(() => {
                                        const navigableKeys = showOnlyAbnormalities
                                            ? categoriesKeys.filter(k => getCategoryAbnormalCount(k) > 0)
                                            : categoriesKeys;
                                        const targetCat = (activeCategory && navigableKeys.includes(activeCategory))
                                            ? activeCategory
                                            : (navigableKeys[0] || activeCategory);

                                        if (!targetCat || !activeMetrics[targetCat]) {
                                            return (
                                                <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                                                    <span className="text-4xl mb-2">🧬</span>
                                                    <p className="text-sm font-bold">Seleccione un sistema biológico</p>
                                                    <p className="text-xs">Elija una categoría en la barra superior para explorar sus Bento Cards Termodinámicas.</p>
                                                </div>
                                            );
                                        }

                                        const categoryItems = getCategoryItems(activeMetrics[targetCat]);
                                        const displayedItems = categoryItems.filter(marker => {
                                            if (!showOnlyAbnormalities) return true;
                                            return isMarkerOutOfRange(marker);
                                        });
                                        const categoryTitle = CATEGORIAS_CLINICAS[targetCat] || targetCat.replace(/_/g, ' ');
                                        const totalCount = categoryItems.length;
                                        const abnormalTotal = getCategoryAbnormalCount(targetCat);
                                        const normalTotal = Math.max(0, totalCount - abnormalTotal);
                                        const riskPct = totalCount > 0 ? Math.round((abnormalTotal / totalCount) * 100) : 0;
                                        const sysMeta = getSystemMeta(targetCat);
                                        const catIndex = Math.max(0, categoriesKeys.indexOf(targetCat));
                                        const readingCode = `#B-${9001 + catIndex}`;

                                        let globalRiskLabel = `Homeostasis Óptima (${riskPct}%)`;
                                        let globalRiskColor = 'text-[#3AAA35]';
                                        let globalRiskBadgeBg = 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30';
                                        if (abnormalTotal > 0) {
                                            if (riskPct >= 60) {
                                                globalRiskLabel = `Alerta Prioritaria (${riskPct}%)`;
                                                globalRiskColor = 'text-[#B70E0C]';
                                                globalRiskBadgeBg = 'bg-red-50 text-[#B70E0C] border-red-200';
                                            } else if (riskPct >= 30) {
                                                globalRiskLabel = `Riesgo Moderado (${riskPct}%)`;
                                                globalRiskColor = 'text-orange-600';
                                                globalRiskBadgeBg = 'bg-orange-50 text-orange-700 border-orange-200';
                                            } else {
                                                globalRiskLabel = `Vigilancia Preventiva (${riskPct}%)`;
                                                globalRiskColor = 'text-amber-600';
                                                globalRiskBadgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                                            }
                                        }

                                        return (
                                            <div className="space-y-4">
                                                {/* 📌 RESUMEN EJECUTIVO DEL INFORME DE SÍNTESIS ORIGINAL (PARIDAD 10/10) */}
                                                {synthesisPriorityMarkers.length > 0 && (
                                                    <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-700/80">
                                                            <div className="flex items-center gap-2">
                                                                <AlertTriangle size={16} className="text-[#B70E0C] shrink-0" />
                                                                <h5 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                                                                    Hallazgos prioritarios del informe de síntesis ({synthesisPriorityMarkers.length})
                                                                </h5>
                                                            </div>
                                                            <span className="px-2.5 py-1 rounded-xl bg-[#B70E0C]/10 text-[#B70E0C] dark:bg-[#B70E0C]/20 dark:text-red-200 border border-[#B70E0C]/30 text-[11px] font-bold tabular-nums">
                                                                Paridad nativa 1 a 1 • Equipo en Acción®
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                            {synthesisPriorityMarkers.map((sm, sIdx) => {
                                                                const isMod = String(sm.status || '').includes('MODERADO') || String(sm.status || '').includes('++');
                                                                return (
                                                                    <button
                                                                        key={`syn-${sm.catKey}-${sm.key}-${sIdx}`}
                                                                        type="button"
                                                                        onClick={() => setSelectedCategory(sm.catKey)}
                                                                        className="flex items-center justify-between gap-3 p-3 min-h-[48px] rounded-xl border border-slate-200/90 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900/70 hover:border-[#1C75BC] text-left transition-all cursor-pointer"
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <span className="block text-[10px] font-bold text-[#1C75BC] truncate">
                                                                                {sm.catTitle}
                                                                            </span>
                                                                            <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                                                                {sm.displayName || sm.name}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-right shrink-0 tabular-nums">
                                                                            <span className="block text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                                                                                {sm.val ?? sm.value}
                                                                            </span>
                                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                                                                                isMod
                                                                                    ? 'bg-[#B70E0C] text-white border-[#B70E0C]'
                                                                                    : 'bg-[#FFCC00] text-[#0F172A] border-amber-400 dark:bg-[#FFCC00]/20 dark:text-amber-100'
                                                                            }`}>
                                                                                <AlertTriangle size={10} />
                                                                                <span>{isMod ? 'Moderado ++' : 'Síntesis +'}</span>
                                                                            </span>
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Cabecera de Triage Sistémico */}
                                                <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                    <div className="space-y-1.5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="px-2.5 py-0.5 rounded-md bg-[#1C75BC]/10 text-[#1C75BC] text-[10px] font-extrabold uppercase tracking-wider">
                                                                {sysMeta.domain}
                                                            </span>
                                                            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium tabular-nums">
                                                                Lectura bioeléctrica {readingCode}
                                                            </span>
                                                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-600 tabular-nums">
                                                                {totalCount} Parámetros: {normalTotal} Normales / {abnormalTotal} Alertas
                                                            </span>
                                                        </div>
                                                        <h5 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                                                            {categoryTitle}
                                                        </h5>
                                                        <p className="text-xs text-slate-700 dark:text-slate-300">
                                                            {sysMeta.desc}
                                                        </p>
                                                    </div>

                                                    {/* Widget de Estado Clínico Global */}
                                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shrink-0 self-start lg:self-center tabular-nums">
                                                        <div className="text-right">
                                                            <div className="text-[9px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                                                                Estado Clínico Global
                                                            </div>
                                                            <div className={`text-xs font-extrabold flex items-center justify-end gap-1 mt-0.5 ${globalRiskColor}`}>
                                                                {abnormalTotal > 0 ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                                                                <span>{globalRiskLabel}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold font-mono tabular-nums ${globalRiskBadgeBg}`}>
                                                            {abnormalTotal}/{totalCount}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 🧍 VISTA ESPECIALIZADA COMPACTA PARA ELEMENTOS HUMANOS (COMPOSICIÓN CORPORAL — 15 KPIs) */}
                                                {targetCat === 'body_composition' && categoryItems.length > 0 && (
                                                    <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-3">
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
                                                            <h6 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                                                                Matriz antropométrica y compartimentos hídricos ({categoryItems.length} indicadores)
                                                            </h6>
                                                            <span className="text-[11px] font-bold text-[#3AAA35] bg-[#3AAA35]/10 px-2.5 py-0.5 rounded-lg border border-[#3AAA35]/30">
                                                                Elementos humanos • Bioimpedancia
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                                                            {categoryItems.map((bcItem, bIdx) => {
                                                                const bcAbn = isMarkerOutOfRange(bcItem);
                                                                return (
                                                                    <div
                                                                        key={`bc-kpi-${bcItem.key}-${bIdx}`}
                                                                        className={`p-3 rounded-xl border tabular-nums ${
                                                                            bcAbn
                                                                                ? 'bg-[#FFCC00]/15 dark:bg-[#FFCC00]/10 border-[#FFCC00]'
                                                                                : 'bg-[#F8FAFC] dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-700'
                                                                        }`}
                                                                    >
                                                                        <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                                                                            {bcItem.displayName || bcItem.name}
                                                                        </span>
                                                                        <span className="block text-base font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                                                                            {bcItem.val ?? bcItem.value}
                                                                        </span>
                                                                        <span className="block text-[10px] font-medium text-slate-700 dark:text-slate-300 mt-0.5 tabular-nums">
                                                                            Ref: {bcItem.ref || 'Informativo'}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 🌡️ 3. BENTO CARDS TERMODINÁMICAS */}
                                                <div className="grid grid-cols-1 gap-4">
                                                    {displayedItems.map((marker, idx) => {
                                                        const badge = getBadgeStyle(marker.status);
                                                        const valText = marker.val !== undefined ? marker.val : (marker.value !== undefined ? marker.value : '-');
                                                        const refText = marker.ref !== undefined ? marker.ref : (marker.reference !== undefined ? marker.reference : '-');
                                                        const spectrum = computeThermodynamicSpectrum(valText, refText);
                                                        const inferenceText = getBiosemanticInference(marker, spectrum, targetCat);

                                                        return (
                                                            <div
                                                                key={`${activeCategory}-${marker.key || marker.name || 'param'}-${idx}`}
                                                                className={`bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 border-l-4 ${badge.borderLeft} rounded-3xl p-5 shadow-xs hover:shadow-md transition-all font-sans space-y-4`}
                                                            >
                                                                {/* Encabezado de la Bento Card */}
                                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                                    <div>
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <h6 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                                                                                {marker.displayName || marker.name}
                                                                            </h6>
                                                                            {marker.inSynthesisReport && (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#B70E0C]/10 text-[#B70E0C] dark:bg-[#B70E0C]/25 dark:text-red-200 border border-[#B70E0C]/30 text-[10px] font-extrabold">
                                                                                    <AlertTriangle size={10} />
                                                                                    <span>Informe de síntesis</span>
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-wrap items-baseline gap-2 mt-1 tabular-nums">
                                                                            <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                                                                                {valText}
                                                                            </span>
                                                                            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                                                                Valor obtenido
                                                                            </span>
                                                                            <span className="text-slate-300">•</span>
                                                                            <span className="text-xs text-slate-700 dark:text-slate-300">
                                                                                Rango clínico de referencia:{' '}
                                                                                <strong className="text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                                                                                    {spectrum.isRenderable ? spectrum.cleanRangeLabel : refText}
                                                                                </strong>
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] uppercase tracking-wider shrink-0 self-start ${badge.bg}`}>
                                                                        {badge.icon}
                                                                        <span>{badge.label}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Barra Termodinámica Tripartita (con Regla de Inmunidad si ref no es numérico) */}
                                                                {spectrum.isRenderable && (
                                                                    <div className="pt-1 pb-2">
                                                                        {/* Etiquetas de los 3 tercios */}
                                                                        <div className="grid grid-cols-3 text-[10px] font-extrabold uppercase tracking-wider mb-1.5">
                                                                            <div className={`text-left ${spectrum.zone === 'LOW' ? 'text-amber-700 font-extrabold' : 'text-slate-400'}`}>
                                                                                DEFICIENCIA (&lt;{spectrum.min})
                                                                            </div>
                                                                            <div className="text-center text-[#3AAA35]">
                                                                                ZONA ÓPTIMA FISIOLÓGICA ({spectrum.min} — {spectrum.max})
                                                                            </div>
                                                                            <div className={`text-right ${spectrum.zone === 'HIGH' ? 'text-orange-600 font-extrabold' : 'text-slate-400'}`}>
                                                                                EXCESO (&gt;{spectrum.max})
                                                                            </div>
                                                                        </div>

                                                                        {/* Pista Termodinámica 3 Tercios */}
                                                                        <div className="h-4 w-full rounded-full overflow-hidden flex border border-slate-200/80 dark:border-slate-700">
                                                                            <div className={`w-1/3 h-full transition-colors ${spectrum.zone === 'LOW' ? 'bg-amber-100/80' : 'bg-slate-100 dark:bg-slate-800'}`} />
                                                                            <div className="w-1/3 h-full bg-[#3AAA35]/15 border-x border-[#3AAA35]/30 flex items-center justify-center">
                                                                                <span className="text-[9px] font-extrabold text-[#3AAA35] uppercase tracking-widest truncate px-1">
                                                                                    RANGO FISIOLÓGICO NORMAL
                                                                                </span>
                                                                            </div>
                                                                            <div className={`w-1/3 h-full transition-colors ${spectrum.zone === 'HIGH' ? 'bg-orange-100/80' : 'bg-slate-100 dark:bg-slate-800'}`} />
                                                                        </div>

                                                                        {/* Marcador Flotante Dinámico */}
                                                                        <div className="relative h-7 mt-1 w-full">
                                                                            <div
                                                                                className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                                                                                style={{ left: `${spectrum.positionPct}%` }}
                                                                            >
                                                                                <div className={`w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] ${badge.calloutArrow}`} />
                                                                                <div className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap shadow-xs ${badge.calloutBg}`}>
                                                                                    {spectrum.calloutText}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* 5. Inyección Biosemántica en Base de Tarjeta */}
                                                                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                                    <div className="flex items-start gap-2">
                                                                        <span className="text-[#1C75BC] font-bold shrink-0">ⓘ</span>
                                                                        <span className="leading-relaxed">{inferenceText}</span>
                                                                    </div>
                                                                    {spectrum.zone !== 'OPTIMAL' && (
                                                                        <span className="text-[11px] font-bold text-[#1C75BC] shrink-0 hidden sm:inline">
                                                                            Correlación Córtex →
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {showOnlyAbnormalities && displayedItems.length === 0 && (
                                                        <div className="py-12 text-center bg-white rounded-2xl border border-slate-200/80 text-slate-400">
                                                            <CheckCircle2 size={36} className="text-[#3AAA35] mx-auto mb-2 opacity-80" />
                                                            <p className="text-sm font-bold text-slate-600">¡Homeostasis fisiológica en este sistema!</p>
                                                            <p className="text-xs text-slate-400 mt-0.5">Todos los parámetros evaluados se encuentran dentro del rango clínico normal.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 👁️ [ACORDEÓN 2] PASO 2: AUDITORÍA VISUAL OCULAR BINOCULAR */}
            <div id="card-ocular" className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                <button 
                    type="button"
                    onClick={() => toggleSection('ocular')}
                    className="w-full p-4 min-h-[48px] flex items-center justify-between bg-slate-50/60 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition-colors text-left select-none focus:outline-none cursor-pointer"
                    aria-expanded={openSections.ocular}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">👁️</span>
                        <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider">Auditoría Visual Ocular Binocular</h4>
                        <ChevronDown className={`w-5 h-5 text-[#334155] dark:text-[#CBD5E1] transition-transform duration-200 ${openSections.ocular ? 'rotate-180' : ''}`} />
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${patientData?.scan_data?.ocular_metrics === 'OMITTED' ? 'bg-slate-100 text-[#334155] border border-slate-300 dark:bg-slate-800 dark:text-[#CBD5E1] dark:border-[#334155]' : (ocularAudit ? 'bg-blue-50 text-[#1C75BC] border border-blue-200 dark:bg-blue-950/60 dark:text-[#93C5FD] dark:border-blue-800' : 'bg-slate-100 text-[#334155] border border-slate-300 dark:bg-slate-800 dark:text-[#CBD5E1] dark:border-[#334155]')}`}>
                        {patientData?.scan_data?.ocular_metrics === 'OMITTED' ? 'EVALUACIÓN OMITIDA' : (ocularAudit ? 'EVALUACIÓN VERIFICADA' : 'EVALUACIÓN PENDIENTE')}
                    </span>
                </button>

                <div className={`grid transition-all duration-300 ease-in-out ${openSections.ocular ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-[#334155]' : 'grid-rows-[0fr] opacity-0 border-t-0'}`}>
                    <div className="overflow-hidden">
                        <div className="p-5 space-y-4">
                            {patientData?.scan_data?.ocular_metrics === 'OMITTED' ? (
                                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] italic py-1">Evaluación de microcirculación epiescleral y bulbar omitida por el evaluado o especialista.</p>
                            ) : ocularAudit ? (
                                ocularAudit.pilares ? (
                                    <div className="space-y-4">
                                        {/* CABECERA SEGMENTO ANTERIOR: BADGES + FOTOS BINOCULARES OD/OI + SÍNTESIS + RELOJ OCULAR */}
                                        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-4 rounded-2xl border border-slate-200/80 dark:border-[#334155] space-y-4">
                                            <div className="space-y-1">
                                                <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-md bg-blue-100/80 text-[#1C75BC] dark:bg-blue-950 dark:text-[#93C5FD] border border-blue-200/60 dark:border-blue-800 uppercase tracking-wide">
                                                    {ocularAudit.tipo_toma || 'SEGMENTO ANTERIOR (SUPERFICIE OCULAR EXTERNA)'}
                                                </span>
                                                <p className="text-[11px] font-medium text-[#334155] dark:text-[#CBD5E1] pl-0.5">
                                                    Resolución: <span className="font-bold text-[#3AAA35]">{ocularAudit.calidad_optica || 'Óptima'}</span>
                                                </p>
                                            </div>

                                            {/* Fotografías Binoculares Centradas OD / OI */}
                                            {(ocularAudit.right_eye_url || ocularAudit.left_eye_url) && (
                                                <div className="flex items-center justify-center gap-5 py-1">
                                                    {ocularAudit.right_eye_url && (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-[#334155] shadow-sm bg-[#0F172A]">
                                                                <img
                                                                    src={getValidImageUrl(ocularAudit.right_eye_url)}
                                                                    onError={handleImageError}
                                                                    alt="Ojo Derecho"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <span className="absolute bottom-0 inset-x-0 bg-[#0F172A]/85 text-white text-[8px] font-black text-center py-0.5 tracking-wider uppercase">
                                                                    OD • EXTERNA
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase">Ojo Derecho (OD)</span>
                                                        </div>
                                                    )}
                                                    {ocularAudit.left_eye_url && (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-[#334155] shadow-sm bg-[#0F172A]">
                                                                <img
                                                                    src={getValidImageUrl(ocularAudit.left_eye_url)}
                                                                    onError={handleImageError}
                                                                    alt="Ojo Izquierdo"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <span className="absolute bottom-0 inset-x-0 bg-[#0F172A]/85 text-white text-[8px] font-black text-center py-0.5 tracking-wider uppercase">
                                                                    OI • EXTERNA
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase">Ojo Izquierdo (OI)</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Síntesis Fisiopatológica en Caja Blanca */}
                                            {ocularAudit.sintesis_fisiopatologica && (
                                                <div className="bg-white dark:bg-[#1E293B] p-3.5 rounded-xl border border-slate-200/80 dark:border-[#334155] shadow-2xs">
                                                    <p className="text-xs text-[#334155] dark:text-[#CBD5E1] italic leading-relaxed">
                                                        "{ocularAudit.sintesis_fisiopatologica}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Barra Inferior de Reloj Ocular */}
                                            {ocularAudit.pilares.edad_biologica_longevidad && (
                                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-[#334155] tabular-nums">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[10px] font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider">Reloj Ocular</span>
                                                        <span className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">
                                                            {ocularAudit.pilares.edad_biologica_longevidad.edad_biologica_ocular || patientData?.profile?.age || patientData?.identificacion?.edad || 34} años
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                                                            Cronológica: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{patientData?.profile?.age || patientData?.identificacion?.edad || 34} años</strong>
                                                        </span>
                                                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                                                            ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap?.includes('+')
                                                                ? 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800]'
                                                                : 'bg-emerald-50 text-[#3AAA35] border-emerald-200 dark:bg-emerald-950/40 dark:text-[#86EFAC] dark:border-emerald-800'
                                                        }`}>
                                                            Diferencia: {String(ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap || '0 años').replace(/^Gap:\s*/i, '')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* TÍTULO DE SECCIÓN: BIOMARCADORES OCULÓMICOS MORFOLÓGICOS */}
                                        <div className="flex items-center justify-between px-1 pt-1">
                                            <h5 className="text-[11px] font-black text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider">
                                                Biomarcadores Oculómicos Morfológicos
                                            </h5>
                                            <span className="text-[11px] font-semibold text-[#334155] dark:text-[#CBD5E1] tabular-nums">
                                                6 ejes verificados
                                            </span>
                                        </div>

                                        {/* 🏛️ STACK VERTICAL DE 6 BENTO CARDS TERMODINÁMICAS OCULÓMICAS */}
                                        <div className="flex flex-col gap-3.5">
                                            {/* PILAR 1: ECO METABÓLICO Y MICROVASCULATURA EPIESCLERAL */}
                                            {ocularAudit.pilares.diabetes_glucosa && (() => {
                                                const riesgo = (ocularAudit.pilares.diabetes_glucosa.riesgo || 'BAJO').toUpperCase();
                                                const isElevado = riesgo.includes('ELEVADO') || riesgo.includes('ALTO');
                                                const isModerado = riesgo.includes('MODERADO');
                                                const nodePos = isElevado ? 84 : isModerado ? 62 : 31;
                                                const nodeBorder = isElevado ? 'border-[#B70E0C]' : isModerado ? 'border-[#FFCC00]' : 'border-[#3AAA35]';
                                                const cardBorder = isElevado ? 'border-red-200/90 bg-red-50/10' : isModerado ? 'border-[#E6B800]/60 bg-[#FFCC00]/10' : 'border-slate-200/90 bg-white';
                                                const ecoStatusLabel = ocularAudit.pilares.diabetes_glucosa.indice_eco_metabolico
                                                    || (isElevado ? 'Sobrecarga Microvascular Activa' : isModerado ? 'Vigilancia Microvascular Moderada' : 'Equilibrio Microvascular Fisiológico');
                                                const cleanEcoHallazgos = sanitizeUiWhiteLabelText(
                                                    ocularAudit.pilares.diabetes_glucosa.hallazgos ||
                                                    ocularAudit.pilares.diabetes_glucosa.retinopatia_microangiopatia ||
                                                    'Lecho microvascular epiescleral y bulbar sin congestión ni exudados observables en segmento anterior.'
                                                )
                                                    .replace(/HbA1c(?:\s*(?:estimad[ao]|est\.?|[<>≥≤=:\-])*\s*\d+(?:[.,]\d+)?\s*%)?/gi, 'indicador morfológico de Eco Metabólico')
                                                    .replace(/diab[eé]tic[ao]s?/gi, 'microvascular')
                                                    .replace(/\bdiabetes\b/gi, 'desequilibrio metabólico')
                                                    .replace(/\bglucosa\b/gi, 'Eco Metabólico');

                                                return (
                                                    <div className={`p-4 rounded-2xl border ${cardBorder} dark:bg-[#0F172A]/60 dark:border-[#334155] shadow-2xs space-y-3 transition-all`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                                <span>🔬</span> Eco Metabólico y Microvasculatura
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                isElevado
                                                                    ? 'bg-red-50 text-[#B70E0C] border-red-200'
                                                                    : isModerado
                                                                    ? 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800]'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                Nivel {ocularAudit.pilares.diabetes_glucosa.riesgo || 'Bajo'}
                                                            </span>
                                                        </div>

                                                        <div className="text-xs space-y-2.5">
                                                            <p className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                                                                Indicador Morfológico: <span className="text-[#0F172A] dark:text-[#F8FAFC] font-extrabold">{ecoStatusLabel}</span>
                                                            </p>

                                                            {/* Barra Termodinámica Oculómica */}
                                                            <div className="pt-1 pb-0.5">
                                                                <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-sky-200 via-emerald-400 to-rose-300">
                                                                    <div
                                                                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 ${nodeBorder} shadow-xs transition-all duration-300`}
                                                                        style={{ left: `${nodePos}%` }}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider mt-1.5">
                                                                    <span className="text-[#334155] dark:text-[#CBD5E1]">Hipoperfusión</span>
                                                                    <span className="text-[#3AAA35]">Equilibrio Fisiológico</span>
                                                                    <span className="text-[#334155] dark:text-[#CBD5E1]">Sobrecarga</span>
                                                                </div>
                                                            </div>

                                                            <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px]">
                                                                {cleanEcoHallazgos}
                                                            </p>
                                                        </div>

                                                        {renderCortexCorrelationControl('cortex_ocular_1', 'ocular_eco')}
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 2: CARDIOVASCULAR Y LÍPIDOS */}
                                            {ocularAudit.pilares.cardiovascular_lipidos && (() => {
                                                const riesgo = (ocularAudit.pilares.cardiovascular_lipidos.riesgo_cardiovascular || 'BAJO').toUpperCase();
                                                const arco = normalizeUiCornealArcus(ocularAudit.pilares.cardiovascular_lipidos.arco_senil_corneal);
                                                const hasArco = arco !== 'Ausente';
                                                const isElevado = riesgo.includes('ELEVADO') || riesgo.includes('ALTO');
                                                const isModerado = riesgo.includes('MODERADO') || hasArco;
                                                const nodePos = isElevado ? 84 : isModerado ? 68 : 26;
                                                const nodeBorder = isElevado ? 'border-[#B70E0C]' : isModerado ? 'border-[#FFCC00]' : 'border-[#3AAA35]';
                                                const cardBorder = isElevado ? 'border-red-200/90 bg-red-50/10' : isModerado ? 'border-[#E6B800]/60 bg-[#FFCC00]/10' : 'border-slate-200/90 bg-white';

                                                return (
                                                    <div className={`p-4 rounded-2xl border ${cardBorder} dark:bg-[#0F172A]/60 dark:border-[#334155] shadow-2xs space-y-3 transition-all`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                                <span>🫀</span> Cardiovascular y Lípidos
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                isElevado
                                                                    ? 'bg-red-50 text-[#B70E0C] border-red-200'
                                                                    : isModerado
                                                                    ? 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800]'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                Riesgo {ocularAudit.pilares.cardiovascular_lipidos.riesgo_cardiovascular || (isModerado ? 'Moderado' : 'Bajo')}
                                                            </span>
                                                        </div>

                                                        <div className="text-xs space-y-2.5">
                                                            <p className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                                                                Halo / Arco Corneal: <span className="text-[#0F172A] dark:text-[#F8FAFC] font-extrabold">{arco}</span>
                                                            </p>

                                                            {/* Barra Termodinámica Lipídica */}
                                                            <div className="pt-1 pb-0.5">
                                                                <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-sky-300 via-amber-300 to-rose-400">
                                                                    <div
                                                                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 ${nodeBorder} shadow-xs transition-all duration-300`}
                                                                        style={{ left: `${nodePos}%` }}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider mt-1.5">
                                                                    <span className="text-[#334155] dark:text-[#CBD5E1]">Ausente</span>
                                                                    <span className="text-[#334155] dark:text-[#CBD5E1]">Grado I</span>
                                                                    <span className={isModerado || isElevado ? 'text-[#0F172A] dark:text-[#FFCC00] font-black' : 'text-[#334155] dark:text-[#CBD5E1]'}>Grado II–III</span>
                                                                </div>
                                                            </div>

                                                            <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px]">
                                                                {sanitizeUiWhiteLabelText(ocularAudit.pilares.cardiovascular_lipidos.hallazgos || ocularAudit.pilares.cardiovascular_lipidos.angioarquitectura_hipertensiva || 'Calibre microvascular epiescleral y bulbar conservado.')}
                                                            </p>
                                                        </div>

                                                        {renderCortexCorrelationControl('cortex_ocular_2', 'ocular_cardio')}
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 3: PERFUSIÓN CONJUNTIVAL TARSAL (EGM-36: HONESTIDAD BIOLÓGICA ESTRICTA) */}
                                            {ocularAudit.pilares.conteo_sanguineo_anemia && (() => {
                                                const csa = ocularAudit.pilares.conteo_sanguineo_anemia;
                                                const hbNoEvaluable = isOcularHbNoEvaluableSSoT(csa);
                                                const hasTarsalAlert = !hbNoEvaluable && /palidez|anemia|observaci/i.test(`${csa.estado_anemia || ''} ${csa.palidez_conjuntival_tarsal || ''}`);

                                                return (
                                                    <div className="p-4 bg-white dark:bg-[#0F172A]/60 rounded-2xl border border-slate-200/90 dark:border-[#334155] shadow-2xs space-y-2.5 transition-all">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                                <span>🧪</span> Perfusión Conjuntival Tarsal
                                                            </span>
                                                            {hbNoEvaluable ? (
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase border bg-[#FFCC00] text-[#0F172A] border-[#E6B800]">
                                                                    <AlertTriangle size={12} strokeWidth={2} className="text-[#0F172A] shrink-0" />
                                                                    <span>NO EVALUABLE SIN EVERSIÓN TARSAL</span>
                                                                </span>
                                                            ) : (
                                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                    hasTarsalAlert
                                                                        ? 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800]'
                                                                        : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                                }`}>
                                                                    {hasTarsalAlert ? <AlertTriangle size={12} strokeWidth={2} className="text-[#0F172A]" /> : <CheckCircle2 size={12} strokeWidth={2} className="text-[#3AAA35]" />}
                                                                    <span>{csa.estado_anemia || 'NORMOCRÓMICA TARSAL'}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs space-y-1.5">
                                                            <p className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                                                                Estado Tarsal:{' '}
                                                                <span className="text-[#0F172A] dark:text-[#F8FAFC] font-extrabold">
                                                                    {hbNoEvaluable
                                                                        ? 'No evaluable en toma bulbar externa (requiere eversión palpebral tarsal)'
                                                                        : sanitizeUiWhiteLabelText(csa.palidez_conjuntival_tarsal || 'Coloración tarsal conservada')}
                                                                </span>
                                                            </p>
                                                            <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px]">
                                                                {hbNoEvaluable
                                                                    ? 'Por honestidad biológica (NOM-004), no se infiere hemoglobina numérica a partir de fotografía frontal externa. La cuantificación de hemoglobina corresponde exclusivamente a biometría hemática venosa.'
                                                                    : sanitizeUiWhiteLabelText(csa.hallazgos || 'Perfusión microvascular tarsal evaluada cualitativamente; la cuantificación de hemoglobina requiere biometría hemática venosa.')
                                                                        .replace(/\b\d+(?:\.\d+)?\s*g\/dL\b/gi, 'valor sujeto a laboratorio venoso')}
                                                            </p>
                                                        </div>
                                                        {renderCortexCorrelationControl('cortex_ocular_3', 'ocular_tarsal')}
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 4: FUNCIÓN RENAL Y HEPATOBILIAR */}
                                            {ocularAudit.pilares.funcion_renal_hepatica && (
                                                <div className="p-4 bg-white dark:bg-[#0F172A]/60 rounded-2xl border border-slate-200/90 dark:border-[#334155] shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                            <span>🧬</span> Función Renal y Hepatobiliar
                                                        </span>
                                                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase bg-blue-50 text-[#1C75BC] border border-blue-200 dark:bg-blue-950/50 dark:text-[#93C5FD] dark:border-blue-800">
                                                            Morfología Periorbital
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                                                            <li>
                                                                • Edema Infraorbitario: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{ocularAudit.pilares.funcion_renal_hepatica.edema_infraorbitario_renal || 'Normal'}</strong>
                                                            </li>
                                                            <li>
                                                                • Esclera: <strong className="text-[#3AAA35]">{ocularAudit.pilares.funcion_renal_hepatica.ictericia_escleral_hepatica || 'Ausente de Ictericia (Blanco Quirúrgico Fisiológico)'}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px] pt-0.5">
                                                            {sanitizeUiWhiteLabelText(ocularAudit.pilares.funcion_renal_hepatica.hallazgos || 'Sin estasis periorbitaria significativa ni signos de tinte ictérico escleral.')}
                                                        </p>
                                                    </div>
                                                    {renderCortexCorrelationControl('cortex_ocular_4', 'ocular_hepatorrenal')}
                                                </div>
                                            )}

                                            {/* PILAR 5: RELOJ DE EDAD BIOLÓGICA OCULAR */}
                                            {ocularAudit.pilares.edad_biologica_longevidad && (() => {
                                                const cleanDiff = String(ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap || '0 años').replace(/^Gap:\s*/i, '');
                                                const hasPositiveGap = cleanDiff.includes('+');
                                                return (
                                                    <div className={`p-4 rounded-2xl border ${hasPositiveGap ? 'border-[#E6B800]/60 bg-[#FFCC00]/10' : 'border-slate-200/90 bg-white'} dark:bg-[#0F172A]/60 dark:border-[#334155] shadow-2xs space-y-2.5 transition-all tabular-nums`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                                <span>⏳</span> Edad Biológica y Longevidad
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                hasPositiveGap
                                                                    ? 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800]'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                {cleanDiff}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs space-y-1.5">
                                                            <p className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                                                                Edad Estimada Ocular: <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC] font-extrabold">{ocularAudit.pilares.edad_biologica_longevidad.edad_biologica_ocular || patientData?.profile?.age || patientData?.identificacion?.edad || 34} años</span>{' '}
                                                                <span className="text-[#334155] dark:text-[#CBD5E1] text-[11px] font-normal">(Cronológica: {patientData?.profile?.age || patientData?.identificacion?.edad || 34} años)</span>
                                                            </p>
                                                            <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px]">
                                                                {sanitizeUiWhiteLabelText(ocularAudit.pilares.edad_biologica_longevidad.hallazgos || ocularAudit.pilares.edad_biologica_longevidad.estado_senescencia || 'Morfología microvascular acorde a patrón cronológico.')}
                                                            </p>
                                                        </div>
                                                        {renderCortexCorrelationControl('cortex_ocular_5', 'ocular_longevidad')}
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 6: SALUD VISUAL Y MEDIOS ESTRUCTURALES */}
                                            {ocularAudit.pilares.salud_visual_estructural && (
                                                <div className="p-4 bg-white dark:bg-[#0F172A]/60 rounded-2xl border border-slate-200/90 dark:border-[#334155] shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                            <span>👁️</span> Medios y Estructura
                                                        </span>
                                                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase bg-emerald-50 text-[#3AAA35] border border-emerald-200 dark:bg-emerald-950/40 dark:text-[#86EFAC] dark:border-emerald-800">
                                                            {ocularAudit.pilares.salud_visual_estructural.asimetria_binocular?.toLowerCase().includes('asim') ? 'Asimétrico' : 'Simétrico'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                                                            <li>
                                                                • Cristalino: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{ocularAudit.pilares.salud_visual_estructural.cristalino_cataratas || 'Transparente'}</strong>
                                                            </li>
                                                            <li>
                                                                • Córnea: <strong className="text-[#3AAA35]">{ocularAudit.pilares.salud_visual_estructural.cornea_superficie || 'Transparente (sin ectasias ni leucomas)'}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px] pt-0.5">
                                                            {sanitizeUiWhiteLabelText(ocularAudit.pilares.salud_visual_estructural.hallazgos || 'Transparencia óptica en rangos adecuados para evaluación morfológica. Reflejo pupilar simétrico.')}
                                                        </p>
                                                    </div>
                                                    {renderCortexCorrelationControl('cortex_ocular_6', 'ocular_estructura')}
                                                </div>
                                            )}
                                        </div>

                                        {/* PIE DE GOBERNANZA CLÍNICA Y REGULATORIA NOM-004 */}
                                        <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] italic text-center pt-2 border-t border-slate-100 dark:border-[#334155]">
                                            {ocularAudit.disclaimer_legal}
                                        </p>
                                    </div>
                                ) : (
                                    /* VISTA RETROCOMPATIBLE LEGACY */
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-4">
                                            {ocularAudit.right_eye_url && (
                                                <div className="flex flex-col items-center gap-1">
                                                    <img 
                                                        src={getValidImageUrl(ocularAudit.right_eye_url)} 
                                                        onError={handleImageError}
                                                        alt="Ojo Derecho" 
                                                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs" 
                                                    />
                                                    <span className="text-[9px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase">Ojo Derecho</span>
                                                </div>
                                            )}
                                            {ocularAudit.left_eye_url && (
                                                <div className="flex flex-col items-center gap-1">
                                                    <img 
                                                        src={getValidImageUrl(ocularAudit.left_eye_url)} 
                                                        onError={handleImageError}
                                                        alt="Ojo Izquierdo" 
                                                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs" 
                                                    />
                                                    <span className="text-[9px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase">Ojo Izquierdo</span>
                                                </div>
                                            )}
                                            <div className="flex-1 text-xs text-[#334155] dark:text-[#CBD5E1] space-y-1.5">
                                                <p>
                                                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] block sm:inline">Perfusión Conjuntival: </span>
                                                    <span>
                                                        {typeof ocularAudit.palidez_conjuntival === 'object'
                                                            ? `${ocularAudit.palidez_conjuntival?.estado || 'No evaluable sin eversión tarsal'} - ${sanitizeUiWhiteLabelText(ocularAudit.palidez_conjuntival?.descripcion_clinica || 'Sujeto a eversión tarsal.')}`
                                                            : sanitizeUiWhiteLabelText(ocularAudit.palidez_conjuntival || 'No evaluable sin eversión tarsal')
                                                        }
                                                    </span>
                                                </p>
                                                <p>
                                                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] block sm:inline">Microcirculación Epiescleral y Bulbar: </span>
                                                    <span>
                                                        {typeof ocularAudit.microcirculacion_escleral === 'object'
                                                            ? `Calibre: ${ocularAudit.microcirculacion_escleral?.calibre_vascular || 'Calibre Normal'} | Densidad: ${ocularAudit.microcirculacion_escleral?.densidad_capilar || 'Lechos venulares epiesclerales analizados'}`
                                                            : (ocularAudit.microcirculacion_escleral || 'Lechos venulares epiesclerales analizados')
                                                        }
                                                    </span>
                                                </p>
                                                {typeof ocularAudit.tejido_periorbital === 'object' && ocularAudit.tejido_periorbital !== null && (
                                                    <p className="bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-100/60 dark:border-blue-900/40 text-[11px]">
                                                        <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-0.5">Morfología Periorbital y Lipídica:</span>
                                                        <span>Edema: {ocularAudit.tejido_periorbital?.edema_infraorbitario || 'Normal'} • Ojeras Vasculares: {ocularAudit.tejido_periorbital?.estasis_venosa_pigmentaria || 'Sin hallazgos'} • Halo Corneal: {normalizeUiCornealArcus(ocularAudit.tejido_periorbital?.deposito_lipidico_corneal)}</span>
                                                    </p>
                                                )}
                                                <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                                                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Simetría Binocular: </span>
                                                    {typeof ocularAudit.asimetria_binocular === 'object'
                                                        ? ocularAudit.asimetria_binocular?.observaciones
                                                        : (ocularAudit.asymmetry_findings || 'Simetría binocular evaluada.')
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="p-8 text-center bg-[#F8FAFC] dark:bg-[#0F172A]/60 my-1 rounded-xl border border-dashed border-blue-200/80 dark:border-[#334155]">
                                    <span className="text-3xl block mb-2">👁️</span>
                                    <h5 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-xs mb-1 uppercase tracking-wider">Auditoría Visual Ocular Binocular Pendiente</h5>
                                    <p className="text-[#334155] dark:text-[#CBD5E1] text-[11px] max-w-md mx-auto leading-relaxed">
                                        {activePatientFirstName ? (
                                            <>Para procesar y desplegar el análisis de microcirculación epiescleral y bulbar de <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{activePatientFirstName}</strong>, ejecute la toma binocular en el <strong>Paso 2 de la Fase 18</strong>.</>
                                        ) : (
                                            <>Para procesar y desplegar el análisis de microcirculación epiescleral y bulbar, ejecute la toma binocular en el <strong>Paso 2 de la Fase 18</strong>.</>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 👅 [ACORDEÓN 3] PASO 3: TOPOGRAFÍA LINGUAL (GLOSÓMICA DE 6 EJES • EQUIPO EN ACCIÓN®) */}
            <div id="card-lingual" className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                <button 
                    type="button"
                    onClick={() => toggleSection('lingual')}
                    className="w-full p-4 min-h-[48px] flex items-center justify-between bg-slate-50/60 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition-colors text-left select-none focus:outline-none cursor-pointer"
                    aria-expanded={openSections.lingual}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">👅</span>
                        <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider">Topografía Lingual (Glosómica de 6 Ejes)</h4>
                        <ChevronDown className={`w-5 h-5 text-[#334155] dark:text-[#CBD5E1] transition-transform duration-200 ${openSections.lingual ? 'rotate-180' : ''}`} />
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${
                        patientData?.scan_data?.lingual_metrics === 'OMITTED' 
                            ? 'bg-slate-100 text-[#334155] border border-slate-300 dark:bg-slate-800 dark:text-[#CBD5E1] dark:border-[#334155]' 
                            : (lingualAudit
                                ? 'bg-blue-50 text-[#1C75BC] border border-blue-200 dark:bg-blue-950/60 dark:text-[#93C5FD] dark:border-blue-800'
                                : 'bg-slate-100 text-[#334155] border border-slate-300 dark:bg-slate-800 dark:text-[#CBD5E1] dark:border-[#334155]')
                    }`}>
                        {patientData?.scan_data?.lingual_metrics === 'OMITTED' 
                            ? 'EVALUACIÓN OMITIDA' 
                            : (lingualAudit?.pilares ? 'GLOSÓMICA 6 EJES ACTIVA' : (lingualAudit ? 'ESPECTRO VERIFICADO' : 'EVALUACIÓN PENDIENTE'))}
                    </span>
                </button>

                <div className={`grid transition-all duration-300 ease-in-out ${openSections.lingual ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-[#334155]' : 'grid-rows-[0fr] opacity-0 border-t-0'}`}>
                    <div className="overflow-hidden">
                        <div className="p-5 space-y-4">
                            {patientData?.scan_data?.lingual_metrics === 'OMITTED' ? (
                                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] italic py-1">Evaluación de topografía lingual omitida por el evaluado o especialista.</p>
                            ) : lingualAudit ? (
                                lingualAudit.pilares ? (
                                    /* STACK VERTICAL DE 6 BENTO CARDS TERMODINÁMICAS GLOSÓMICAS */
                                    <div className="space-y-4">
                                        {/* CABECERA GLOSÓMICA: BADGES + FOTOS DORSAL / VENTRAL + SÍNTESIS + RELOJ MUCOSAL */}
                                        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-4 rounded-2xl border border-slate-200/80 dark:border-[#334155] space-y-4">
                                            <div className="space-y-1">
                                                <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-md bg-blue-100/80 text-[#1C75BC] dark:bg-blue-950 dark:text-[#93C5FD] border border-blue-200/60 dark:border-blue-800 uppercase tracking-wide">
                                                    {lingualAudit.tipo_toma || 'TOMA DUAL COMPLETA (SUPERFICIE DORSAL Y VENTRAL SUBLINGUAL)'}
                                                </span>
                                                <p className="text-[11px] font-medium text-[#334155] dark:text-[#CBD5E1] pl-0.5">
                                                    Calidad: <span className="font-bold text-[#3AAA35]">{lingualAudit.calidad_optica || 'Óptima'}</span>
                                                </p>
                                            </div>

                                            {/* Fotografías Linguales Centradas Cara Dorsal / Cara Ventral */}
                                            {(lingualAudit.dorsal_url || lingualAudit.ventral_url) && (
                                                <div className="flex items-center justify-center gap-5 py-1">
                                                    {lingualAudit.dorsal_url && (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-[#334155] shadow-sm bg-[#0F172A]">
                                                                <img
                                                                    src={getValidImageUrl(lingualAudit.dorsal_url)}
                                                                    onError={handleImageError}
                                                                    alt="Cara Dorsal"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <span className="absolute bottom-0 inset-x-0 bg-[#0F172A]/85 text-white text-[8px] font-black text-center py-0.5 tracking-wider uppercase">
                                                                    CARA DORSAL
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase">Dorsal</span>
                                                        </div>
                                                    )}
                                                    {lingualAudit.ventral_url && (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-[#334155] shadow-sm bg-[#0F172A]">
                                                                <img
                                                                    src={getValidImageUrl(lingualAudit.ventral_url)}
                                                                    onError={handleImageError}
                                                                    alt="Cara Ventral"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <span className="absolute bottom-0 inset-x-0 bg-[#0F172A]/85 text-white text-[8px] font-black text-center py-0.5 tracking-wider uppercase">
                                                                    CARA VENTRAL
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase">Ventral</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Síntesis Fisiopatológica en Caja Blanca */}
                                            {lingualAudit.sintesis_fisiopatologica && (
                                                <div className="bg-white dark:bg-[#1E293B] p-3.5 rounded-xl border border-slate-200/80 dark:border-[#334155] shadow-2xs">
                                                    <p className="text-xs text-[#334155] dark:text-[#CBD5E1] italic leading-relaxed">
                                                        "{lingualAudit.sintesis_fisiopatologica}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Barra Inferior de Reloj / Edad Mucosal */}
                                            {lingualAudit.pilares.edad_biologica_mucosal && (
                                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-[#334155] tabular-nums">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[10px] font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider">Edad Mucosal</span>
                                                        <span className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">
                                                            {lingualAudit.pilares.edad_biologica_mucosal.edad_mucosal_estimada || patientData?.profile?.age || patientData?.identificacion?.edad || 34} años
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                                                            Cronológica: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{patientData?.profile?.age || patientData?.identificacion?.edad || 34} años</strong>
                                                        </span>
                                                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-emerald-50 text-[#3AAA35] border border-emerald-200 dark:bg-emerald-950/40 dark:text-[#86EFAC] dark:border-emerald-800">
                                                            Resiliencia: {sanitizeUiWhiteLabelText(lingualAudit.pilares.edad_biologica_mucosal.resiliencia_epitelial || 'Preservada')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* TÍTULO DE SECCIÓN: BIOMARCADORES GLOSÓMICOS FUNCIONALES */}
                                        <div className="flex items-center justify-between px-1 pt-1">
                                            <h5 className="text-[11px] font-black text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider">
                                                Biomarcadores Glosómicos Funcionales
                                            </h5>
                                            <span className="text-[11px] font-semibold text-[#334155] dark:text-[#CBD5E1] tabular-nums">
                                                6 ejes verificados
                                            </span>
                                        </div>

                                        {/* 🏛️ STACK VERTICAL DE 6 BENTO CARDS TERMODINÁMICAS GLOSÓMICAS */}
                                        <div className="flex flex-col gap-3.5">
                                            {/* PILAR 1: GASTROINTESTINAL Y MICROBIOMA */}
                                            {lingualAudit.pilares.gastrointestinal_microbioma && (() => {
                                                const saburraGrosor = sanitizeUiWhiteLabelText(lingualAudit.pilares.gastrointestinal_microbioma.saburra_grosor || 'Delgada');
                                                const saburraColor = sanitizeUiWhiteLabelText(lingualAudit.pilares.gastrointestinal_microbioma.saburra_color || 'blanquecina fisiológica').toLowerCase();
                                                const fisuras = sanitizeUiWhiteLabelText(lingualAudit.pilares.gastrointestinal_microbioma.fisuras_grietas || 'Ausentes');
                                                const disbiosis = (lingualAudit.pilares.gastrointestinal_microbioma.sospecha_disbiosis || 'Baja').toUpperCase();
                                                const isElevada = disbiosis.includes('ELEVAD') || disbiosis.includes('ALTA') || saburraGrosor.toLowerCase().includes('gruesa');
                                                const isModerada = disbiosis.includes('MODERAD') || saburraGrosor.toLowerCase().includes('moderada');
                                                const nodePos = isElevada ? 84 : isModerada ? 64 : 42;
                                                const nodeBorder = isElevada ? 'border-[#B70E0C]' : isModerada ? 'border-[#FFCC00]' : 'border-[#3AAA35]';
                                                const cardBorder = isElevada ? 'border-red-200/90 bg-red-50/10' : isModerada ? 'border-[#E6B800]/60 bg-[#FFCC00]/10' : 'border-slate-200/90 bg-white';

                                                return (
                                                    <div className={`p-4 rounded-2xl border ${cardBorder} dark:bg-[#0F172A]/60 dark:border-[#334155] shadow-2xs space-y-3 transition-all`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                                <span>🍞</span> Microbioma y Digestivo
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                isElevada
                                                                    ? 'bg-red-50 text-[#B70E0C] border-red-200'
                                                                    : isModerada
                                                                    ? 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800]'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                {isElevada ? 'Disbiosis Activa' : isModerada ? 'Saburra Moderada' : 'Eubiosis Fisiológica'}
                                                            </span>
                                                        </div>

                                                        <div className="text-xs space-y-2.5">
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                                                                <p className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                                                                    Saburra: <span className="text-[#0F172A] dark:text-[#F8FAFC] font-extrabold">{saburraGrosor}</span>
                                                                    {!String(saburraGrosor).includes('(') && (
                                                                        <span className="text-[#334155] dark:text-[#CBD5E1] font-normal ml-1">({saburraColor})</span>
                                                                    )}
                                                                </p>
                                                                <p className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                                                                    Fisuras: <span className="text-[#0F172A] dark:text-[#F8FAFC] font-extrabold">{fisuras}</span>
                                                                </p>
                                                            </div>

                                                            {/* Barra Termodinámica de Biopelícula / Saburra */}
                                                            <div className="pt-1 pb-0.5">
                                                                <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-sky-200 via-emerald-400 to-amber-400">
                                                                    <div
                                                                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 ${nodeBorder} shadow-xs transition-all duration-300`}
                                                                        style={{ left: `${nodePos}%` }}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider mt-1.5">
                                                                    <span className="text-[#334155] dark:text-[#CBD5E1]">Atrófica / Lisa</span>
                                                                    <span className="text-[#3AAA35]">Eubiosis (Delgada)</span>
                                                                    <span className={isModerada || isElevada ? 'text-[#0F172A] dark:text-[#FFCC00] font-black' : 'text-[#334155] dark:text-[#CBD5E1]'}>Biopelícula Densa</span>
                                                                </div>
                                                            </div>

                                                            <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px]">
                                                                {sanitizeUiWhiteLabelText(lingualAudit.pilares.gastrointestinal_microbioma.hallazgos || 'Mucosa lingual con biopelícula evaluada dentro de parámetros funcionales.')}
                                                            </p>
                                                        </div>

                                                        {renderCortexCorrelationControl('cortex_lingual_1', 'lingual_microbioma')}
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 2: CARDIOVASCULAR Y VENAS SUBLINGUALES */}
                                            {lingualAudit.pilares.cardiovascular_oxigenacion && (() => {
                                                const riesgoVasc = (lingualAudit.pilares.cardiovascular_oxigenacion.riesgo_vascular_congestivo || 'BAJO').toUpperCase();
                                                const estasis = sanitizeUiWhiteLabelText(lingualAudit.pilares.cardiovascular_oxigenacion.estasis_venosa_sublingual || 'Fisiológica');
                                                const cianosis = sanitizeUiWhiteLabelText(lingualAudit.pilares.cardiovascular_oxigenacion.cianosis_periferica || 'Ausente (Perfusión Óptima)');
                                                const isElevado = riesgoVasc.includes('ELEVAD') || riesgoVasc.includes('ALTO');
                                                const isModerado = riesgoVasc.includes('MODERAD') || estasis.toLowerCase().includes('dilataci') || estasis.toLowerCase().includes('leve');
                                                const nodePos = isElevado ? 85 : isModerado ? 66 : 28;
                                                const nodeBorder = isElevado ? 'border-[#B70E0C]' : isModerado ? 'border-[#FFCC00]' : 'border-[#3AAA35]';
                                                const cardBorder = isElevado ? 'border-red-200/90 bg-red-50/10' : isModerado ? 'border-[#E6B800]/60 bg-[#FFCC00]/10' : 'border-slate-200/90 bg-white';

                                                return (
                                                    <div className={`p-4 rounded-2xl border ${cardBorder} dark:bg-[#0F172A]/60 dark:border-[#334155] shadow-2xs space-y-3 transition-all`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                                <span>🫀</span> Vascular y Venas Sublinguales
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                isElevado
                                                                    ? 'bg-red-50 text-[#B70E0C] border-red-200'
                                                                    : isModerado
                                                                    ? 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800]'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                Riesgo {lingualAudit.pilares.cardiovascular_oxigenacion.riesgo_vascular_congestivo || (isModerado ? 'Moderado' : 'Bajo')}
                                                            </span>
                                                        </div>

                                                        <div className="text-xs space-y-2.5">
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                                                                <p className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                                                                    Estasis Sublingual: <span className="text-[#0F172A] dark:text-[#F8FAFC] font-extrabold">{estasis}</span>
                                                                </p>
                                                                <p className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                                                                    Cianosis: <span className="text-[#3AAA35] font-extrabold">{cianosis}</span>
                                                                </p>
                                                            </div>

                                                            {/* Barra Termodinámica de Retorno Venoso Sublingual */}
                                                            <div className="pt-1 pb-0.5">
                                                                <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-400">
                                                                    <div
                                                                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 ${nodeBorder} shadow-xs transition-all duration-300`}
                                                                        style={{ left: `${nodePos}%` }}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider mt-1.5">
                                                                    <span className="text-[#3AAA35]">Flujo Óptimo</span>
                                                                    <span className={isModerado ? 'text-[#0F172A] dark:text-[#FFCC00] font-black' : 'text-[#334155] dark:text-[#CBD5E1]'}>Dilatación Leve</span>
                                                                    <span className={isElevado ? 'text-[#B70E0C] font-black' : 'text-[#334155] dark:text-[#CBD5E1]'}>Estasis / Congestión</span>
                                                                </div>
                                                            </div>

                                                            <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px]">
                                                                {sanitizeUiWhiteLabelText(lingualAudit.pilares.cardiovascular_oxigenacion.hallazgos || 'Red venosa sublingual evaluada sin signos de congestión severa.')}
                                                            </p>
                                                        </div>

                                                        {renderCortexCorrelationControl('cortex_lingual_2', 'lingual_vascular')}
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 3: NUTRICIÓN Y SUSTRATO */}
                                            {lingualAudit.pilares.conteo_sanguineo_nutricion && (
                                                <div className="p-4 bg-white dark:bg-[#0F172A]/60 rounded-2xl border border-slate-200/90 dark:border-[#334155] shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                            <span>🧪</span> Nutrición y Sustrato
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                            lingualAudit.pilares.conteo_sanguineo_nutricion.palidez_sustrato?.includes('Palidez')
                                                                ? 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800]'
                                                                : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                        }`}>
                                                            {lingualAudit.pilares.conteo_sanguineo_nutricion.palidez_sustrato?.includes('Palidez') ? 'Observación Sustrato' : 'Normocrómica'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                                                            <li>
                                                                • Color Sustrato: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{sanitizeUiWhiteLabelText(lingualAudit.pilares.conteo_sanguineo_nutricion.palidez_sustrato || 'Normocrómica (Rosado Saludable)')}</strong>
                                                            </li>
                                                            <li>
                                                                • Papilas Linguales: <strong className="text-[#3AAA35]">{sanitizeUiWhiteLabelText(lingualAudit.pilares.conteo_sanguineo_nutricion.atrofia_papilar_glositis || 'Papilas Preservadas')}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px] pt-0.5">
                                                            {sanitizeUiWhiteLabelText(lingualAudit.pilares.conteo_sanguineo_nutricion.hallazgos || 'Coloración rosada saludable del sustrato lingual con papilas filiformes y fungiformes preservadas.')}
                                                        </p>
                                                    </div>
                                                    {renderCortexCorrelationControl('cortex_lingual_3', 'lingual_nutricion')}
                                                </div>
                                            )}

                                            {/* PILAR 4: HEPATORRENAL E HIDRATACIÓN */}
                                            {lingualAudit.pilares.funcion_hepatica_renal_hidratacion && (
                                                <div className="p-4 bg-white dark:bg-[#0F172A]/60 rounded-2xl border border-slate-200/90 dark:border-[#334155] shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                            <span>🧬</span> Hepatorrenal e Hidratación
                                                        </span>
                                                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase bg-blue-50 text-[#1C75BC] border border-blue-200 dark:bg-blue-950/50 dark:text-[#93C5FD] dark:border-blue-800">
                                                            Hidratación Mucosa
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                                                            <li>
                                                                • Festoneado / Edema: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{sanitizeUiWhiteLabelText(lingualAudit.pilares.funcion_hepatica_renal_hidratacion.marcas_dentales_festoneado || 'Ausentes (Bordes Lisos)')}</strong>
                                                            </li>
                                                            <li>
                                                                • Tinte Amarillo: <strong className="text-[#3AAA35]">{sanitizeUiWhiteLabelText(lingualAudit.pilares.funcion_hepatica_renal_hidratacion.tinte_amarillo_base || 'Ausente')}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px] pt-0.5">
                                                            {sanitizeUiWhiteLabelText(lingualAudit.pilares.funcion_hepatica_renal_hidratacion.hallazgos || 'Buena hidratación general de la mucosa, ausencia de marcas dentales laterales y sin tinte ictérico sublingual.')}
                                                        </p>
                                                    </div>
                                                    {renderCortexCorrelationControl('cortex_lingual_4', 'lingual_hepatorrenal')}
                                                </div>
                                            )}

                                            {/* PILAR 5: INMUNIDAD E INFLAMACIÓN */}
                                            {lingualAudit.pilares.inmune_inflamacion && (
                                                <div className="p-4 bg-white dark:bg-[#0F172A]/60 rounded-2xl border border-slate-200/90 dark:border-[#334155] shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                            <span>🛡️</span> Inmunidad e Inflamación
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                            lingualAudit.pilares.inmune_inflamacion.nivel_inflamacion_mucosa?.includes('Activo')
                                                                ? 'bg-red-50 text-[#B70E0C] border-red-200'
                                                                : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                        }`}>
                                                            {sanitizeUiWhiteLabelText(lingualAudit.pilares.inmune_inflamacion.nivel_inflamacion_mucosa || 'Bajo / Fisiológico')}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                                                            <li>
                                                                • Lengua Geográfica: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{sanitizeUiWhiteLabelText(lingualAudit.pilares.inmune_inflamacion.lengua_geografica || 'Ausente')}</strong>
                                                            </li>
                                                            <li>
                                                                • Papilas Eritematosas: <strong className="text-[#3AAA35]">{sanitizeUiWhiteLabelText(lingualAudit.pilares.inmune_inflamacion.petequias_papilas_eritematosas || 'Ausentes')}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px] pt-0.5">
                                                            {sanitizeUiWhiteLabelText(lingualAudit.pilares.inmune_inflamacion.hallazgos || 'Sin signos de inflamación aguda, parches geográficos ni lesiones eritematosas en bordes o punta.')}
                                                        </p>
                                                    </div>
                                                    {renderCortexCorrelationControl('cortex_lingual_5', 'lingual_inmune')}
                                                </div>
                                            )}

                                            {/* PILAR 6: EDAD BIOLÓGICA MUCOSAL Y TROFISMO */}
                                            {lingualAudit.pilares.edad_biologica_mucosal && (
                                                <div className="p-4 bg-white dark:bg-[#0F172A]/60 rounded-2xl border border-slate-200/90 dark:border-[#334155] shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                                                            <span>⏳</span> Edad Mucosal y Trofismo
                                                        </span>
                                                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase bg-emerald-50 text-[#3AAA35] border border-emerald-200 dark:bg-emerald-950/40 dark:text-[#86EFAC] dark:border-emerald-800">
                                                            {sanitizeUiWhiteLabelText(lingualAudit.pilares.edad_biologica_mucosal.resiliencia_epitelial || 'Preservada')}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                                                            <li>
                                                                • Trofismo Muscular: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{sanitizeUiWhiteLabelText(lingualAudit.pilares.edad_biologica_mucosal.trofismo_muscular || 'Eutrófico (tono óptimo)')}</strong>
                                                            </li>
                                                            <li>
                                                                • Fasciculaciones: <strong className="text-[#3AAA35]">{sanitizeUiWhiteLabelText(lingualAudit.pilares.edad_biologica_mucosal.temblores_fasciculaciones || 'Ausentes')}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px] pt-0.5">
                                                            {sanitizeUiWhiteLabelText(lingualAudit.pilares.edad_biologica_mucosal.hallazgos || 'Trofismo muscular lingual eutrófico, adecuado tono neuromuscular y ausencia de temblores finos.')}
                                                        </p>
                                                    </div>
                                                    {renderCortexCorrelationControl('cortex_lingual_6', 'lingual_mucosal')}
                                                </div>
                                            )}
                                        </div>

                                        {/* PIE DE GOBERNANZA CLÍNICA Y REGULATORIA NOM-004 */}
                                        <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] italic text-center pt-2 border-t border-slate-100 dark:border-[#334155]">
                                            {lingualAudit.disclaimer_legal}
                                        </p>
                                    </div>
                                ) : (
                                    /* VISTA RETROCOMPATIBLE LEGACY */
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-4">
                                            {lingualAudit.imageUrl && (
                                                <img 
                                                    src={getValidImageUrl(lingualAudit.imageUrl)} 
                                                    onError={handleImageError}
                                                    alt="Superficie Lingual" 
                                                    className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs shrink-0" 
                                                />
                                            )}
                                            <div className="flex-1 text-xs text-[#334155] dark:text-[#CBD5E1] space-y-1.5">
                                                {typeof lingualAudit.cuerpo_lingual === 'object' && (
                                                    <div className="bg-blue-50/40 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-100/60 dark:border-blue-900/40 space-y-1 text-[11px]">
                                                        <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider text-[10px] block">Cuerpo Lingual y Trofismo:</span>
                                                        <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Sustrato y Color:</strong> {sanitizeUiWhiteLabelText(lingualAudit.cuerpo_lingual?.coloracion_sustrato || 'Normal / Rosado')}</p>
                                                        <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Trofismo / Volumen:</strong> {sanitizeUiWhiteLabelText(lingualAudit.cuerpo_lingual?.trofismo_volumen || 'Eutrófico')}</p>
                                                        <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Indentaciones Dentales:</strong> <span className="font-bold text-[#0F172A] dark:text-[#FFCC00]">{sanitizeUiWhiteLabelText(lingualAudit.cuerpo_lingual?.indentaciones_dentales || 'Ausentes')}</span></p>
                                                        <p><strong className="text-[#0F172A] dark:text-[#F8FAFC]">Fisuras:</strong> {sanitizeUiWhiteLabelText(lingualAudit.cuerpo_lingual?.fisuras_mucosa || 'Sin fisuras')}</p>
                                                    </div>
                                                )}
                                                <p>
                                                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Saburra Lingual y Microbiota: </span>
                                                    {typeof lingualAudit.saburra_microbiota === 'object'
                                                        ? `Grosor: ${sanitizeUiWhiteLabelText(lingualAudit.saburra_microbiota?.grosor || 'Delgada')} | Color: ${sanitizeUiWhiteLabelText(lingualAudit.saburra_microbiota?.color || 'Normocoloreada')}`
                                                        : sanitizeUiWhiteLabelText(lingualAudit.saburra_thickness || 'Delgada / Fisiológica')
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="p-8 text-center bg-[#F8FAFC] dark:bg-[#0F172A]/60 my-1 rounded-xl border border-dashed border-blue-200/80 dark:border-[#334155]">
                                    <span className="text-3xl block mb-2">👅</span>
                                    <h5 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-xs mb-1 uppercase tracking-wider">Topografía Lingual Glosómica Pendiente</h5>
                                    <p className="text-[#334155] dark:text-[#CBD5E1] text-[11px] max-w-md mx-auto leading-relaxed">
                                        {activePatientFirstName ? (
                                            <>Para procesar y desplegar la evaluación de saburra, venas sublinguales y microbiota de <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{activePatientFirstName}</strong>, ejecute la toma fotográfica en el <strong>Paso 3 de la Fase 18</strong>.</>
                                        ) : (
                                            <>Para procesar y desplegar la evaluación de saburra, venas sublinguales y microbiota, ejecute la toma fotográfica en el <strong>Paso 3 de la Fase 18</strong>.</>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 📋 [ACORDEÓN 4] PASO 4: ESTUDIOS CLÍNICOS EXTERNOS — LABORATORIO Y GABINETE (OCR NOM-004) */}
            <div id="card-pdf" className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                {(() => {
                    try {
                    const extMetrics = patientData?.scan_data?.external_metrics;
                    const rawBiomarkers = extMetrics?.biomarkers;
                    const cabinetStudies = Array.isArray(extMetrics?.external_studies?.clinical_imaging_and_cabinet)
                        ? extMetrics.external_studies.clinical_imaging_and_cabinet
                        : (Array.isArray(extMetrics?.imaging?.studies) ? extMetrics.imaging.studies : []);
                    const adminSkipped = Array.isArray(extMetrics?.external_studies?.administrative_skipped)
                        ? extMetrics.external_studies.administrative_skipped
                        : [];
                    const vigenciaMeta = extMetrics?.vigencia || null;

                    // Construir secciones dinámicas exclusivamente desde el expediente autenticado del paciente (Regla 8 NOM-004: Cero mocks hardcodeados)
                    let resolvedSections = [];
                    if (Array.isArray(extMetrics?.sections) && extMetrics.sections.length > 0) {
                        resolvedSections = extMetrics.sections;
                    } else if (rawBiomarkers && typeof rawBiomarkers === 'object' && Object.keys(rawBiomarkers).length > 0) {
                        const grouped = {};
                        Object.entries(rawBiomarkers).forEach(([k, bio]) => {
                            if (!bio || typeof bio !== 'object') return;
                            const secTitle = bio.section || 'Química Sanguínea y Biomarcadores Analíticos';
                            const secId = secTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                            if (!grouped[secId]) {
                                grouped[secId] = {
                                    id: secId,
                                    title: secTitle,
                                    domain: secTitle.toUpperCase(),
                                    desc: 'Parámetros analíticos cuantitativos extraídos mediante auditoría forense OCR.',
                                    items: []
                                };
                            }
                            grouped[secId].items.push({
                                analyte_uid: bio.analyte_uid || k,
                                name: bio.name || k.replace(/_/g, ' '),
                                value: bio.value,
                                unit: bio.unit || '',
                                reference: bio.reference || bio.ref || '',
                                status: bio.status || 'NORMAL',
                                note: bio.note || '',
                                study_date_display: bio.study_date_display || null,
                                delta: bio.delta || null
                            });
                        });
                        resolvedSections = Object.values(grouped);
                    }

                    const hasLabData = resolvedSections.length > 0;
                    const hasCabinetData = cabinetStudies.length > 0;
                    const hasExternalData = hasLabData || hasCabinetData;

                    // Motor de espectro para rangos bilaterales ("55 - 99") y unilaterales ("< 200", "> 60")
                    const computeLabSpectrum = (valRaw, refRaw, statusRaw) => {
                        const numVal = parseFloat(String(valRaw ?? '').replace(',', '.'));
                        const refStr = String(refRaw ?? '').trim();
                        if (isNaN(numVal) || !refStr) return { isRenderable: false };

                        const formatDelta = (n) => Number(n.toFixed(3)).toString();

                        // Caso 1: Rango bilateral "A - B" o "A – B"
                        const biMatch = refStr.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
                        if (biMatch) {
                            const a = parseFloat(biMatch[1].replace(',', '.'));
                            const b = parseFloat(biMatch[2].replace(',', '.'));
                            const min = Math.min(a, b);
                            const max = Math.max(a, b);
                            const span = (max - min) || 1;
                            let zone = 'OPTIMAL';
                            let rawPct = 50;
                            let calloutText = `${numVal} (Dentro de límite)`;

                            if (numVal < min) {
                                zone = 'LOW';
                                const deficitRatio = Math.min((min - numVal) / span, 1.5) / 1.5;
                                rawPct = 33.33 - (deficitRatio * 25.33);
                                calloutText = `${numVal} (Bajo LR -${formatDelta(min - numVal)})`;
                            } else if (numVal > max) {
                                zone = 'HIGH';
                                const excessRatio = Math.min((numVal - max) / span, 1.5) / 1.5;
                                rawPct = 66.67 + (excessRatio * 25.33);
                                calloutText = `${numVal} (Sobre LR +${formatDelta(numVal - max)})`;
                            } else {
                                const optRatio = (numVal - min) / span;
                                rawPct = 33.33 + (optRatio * 33.34);
                            }
                            return {
                                isRenderable: true,
                                minLabel: `${min}`,
                                maxLabel: `${max}`,
                                cleanRangeLabel: `${min} – ${max}`,
                                zone,
                                positionPct: Math.max(8, Math.min(92, Number(rawPct.toFixed(2)))),
                                calloutText
                            };
                        }

                        // Caso 2: Límite superior "< X" o "<= X"
                        const ltMatch = refStr.match(/^\s*<=?\s*(-?\d+(?:[.,]\d+)?)\s*$/);
                        if (ltMatch) {
                            const max = parseFloat(ltMatch[1].replace(',', '.'));
                            const span = max || 1;
                            let zone = 'OPTIMAL';
                            let rawPct = 50;
                            let calloutText = `${numVal} (Dentro de límite < ${max})`;

                            if (numVal > max) {
                                zone = 'HIGH';
                                const excessRatio = Math.min((numVal - max) / (span * 0.5), 1.5) / 1.5;
                                rawPct = 66.67 + (excessRatio * 25.33);
                                calloutText = `${numVal} (Sobre LR +${formatDelta(numVal - max)})`;
                            } else {
                                const optRatio = Math.max(0, Math.min(1, numVal / span));
                                rawPct = 33.33 + (optRatio * 33.34);
                            }
                            return {
                                isRenderable: true,
                                minLabel: '0',
                                maxLabel: `${max}`,
                                cleanRangeLabel: `< ${max}`,
                                zone,
                                positionPct: Math.max(8, Math.min(92, Number(rawPct.toFixed(2)))),
                                calloutText
                            };
                        }

                        // Caso 3: Límite inferior "> X" o ">= X"
                        const gtMatch = refStr.match(/^\s*>=?\s*(-?\d+(?:[.,]\d+)?)\s*$/);
                        if (gtMatch) {
                            const min = parseFloat(gtMatch[1].replace(',', '.'));
                            const max = min * 2 || 120;
                            const span = (max - min) || 1;
                            let zone = 'OPTIMAL';
                            let rawPct = 50;
                            let calloutText = `${numVal} (Dentro de límite > ${min})`;

                            if (numVal < min) {
                                zone = 'LOW';
                                const deficitRatio = Math.min((min - numVal) / (min * 0.5 || 1), 1.5) / 1.5;
                                rawPct = 33.33 - (deficitRatio * 25.33);
                                calloutText = `${numVal} (Bajo LR -${formatDelta(min - numVal)})`;
                            } else {
                                const optRatio = Math.max(0, Math.min(1, (numVal - min) / span));
                                rawPct = 33.33 + (optRatio * 33.34);
                            }
                            return {
                                isRenderable: true,
                                minLabel: `${min}`,
                                maxLabel: `${max}+`,
                                cleanRangeLabel: `> ${min}`,
                                zone,
                                positionPct: Math.max(8, Math.min(92, Number(rawPct.toFixed(2)))),
                                calloutText
                            };
                        }

                        const sUpper = String(statusRaw || 'NORMAL').toUpperCase();
                        const isAbn = sUpper.includes('ELEVADO') || sUpper.includes('ALTO') || sUpper.includes('BAJO') || sUpper.includes('CRÍTICO');
                        return {
                            isRenderable: false,
                            zone: isAbn ? 'HIGH' : 'OPTIMAL'
                        };
                    };

                    const isLabItemAbnormal = (item) => {
                        const spec = computeLabSpectrum(item.value, item.reference, item.status);
                        const sUpper = String(item.status || 'NORMAL').toUpperCase();
                        const statusAbn = sUpper.includes('ELEVADO') || sUpper.includes('ALTO') || sUpper.includes('BAJO') || sUpper.includes('CRÍTICO') || sUpper.includes('SOBRE') || sUpper.includes('FUERA');
                        return (spec.isRenderable && spec.zone !== 'OPTIMAL') || statusAbn;
                    };

                    const getSectionAbnormalCount = (sec) =>
                        (sec?.items || []).reduce((acc, it) => (isLabItemAbnormal(it) ? acc + 1 : acc), 0);

                    const totalLabParameters = resolvedSections.reduce((acc, s) => acc + (s.items?.length || 0), 0);
                    const totalLabAbnormalities = resolvedSections.reduce((acc, s) => acc + getSectionAbnormalCount(s), 0);

                    const navigableSections = showOnlyLabAbnormalities
                        ? resolvedSections.filter(s => getSectionAbnormalCount(s) > 0)
                        : resolvedSections;

                    const activeLabSection = (selectedLabSectionId && navigableSections.find(s => s.id === selectedLabSectionId))
                        || navigableSections[0]
                        || resolvedSections[0]
                        || null;

                    return (
                        <>
                            <div className="bg-slate-50/60 dark:bg-[#0F172A]/60 border-b border-slate-100 dark:border-[#334155] flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('ocr')}
                                    className="flex-1 p-4 min-h-[48px] flex items-center gap-2.5 text-left hover:bg-slate-100/70 dark:hover:bg-[#0F172A]/80 transition-colors select-none focus:outline-none cursor-pointer"
                                    aria-expanded={openSections.ocr}
                                >
                                    <span className="text-base">📋</span>
                                    <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider">
                                        Estudios Clínicos Externos: Laboratorio y Gabinete (OCR)
                                    </h4>
                                    <ChevronDown className={`w-5 h-5 text-[#334155] dark:text-[#CBD5E1] transition-transform duration-200 ${openSections.ocr ? 'rotate-180' : ''}`} />
                                </button>

                                <div className="pr-4 flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {hasLabData && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const nextVal = !showOnlyLabAbnormalities;
                                                setShowOnlyLabAbnormalities(nextVal);
                                                if (nextVal && activeLabSection && getSectionAbnormalCount(activeLabSection) === 0) {
                                                    const firstWithAlerts = resolvedSections.find(s => getSectionAbnormalCount(s) > 0);
                                                    if (firstWithAlerts) setSelectedLabSectionId(firstWithAlerts.id);
                                                }
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border text-[11px] font-bold transition-all shadow-xs cursor-pointer tabular-nums ${
                                                showOnlyLabAbnormalities
                                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] hover:bg-[#155A92]'
                                                    : 'bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] border-slate-200 dark:border-[#334155] hover:bg-slate-50'
                                            }`}
                                        >
                                            <Filter size={11} />
                                            {showOnlyLabAbnormalities ? `Solo Alertas (${totalLabAbnormalities})` : `Filtrar Alertas (${totalLabAbnormalities})`}
                                        </button>
                                    )}
                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tabular-nums ${
                                        hasExternalData
                                            ? 'bg-[#3AAA35]/10 text-[#3AAA35] border border-[#3AAA35]/30 dark:bg-[#3AAA35]/15 dark:text-[#DCFCE7] dark:border-[#3AAA35]/40'
                                            : 'bg-slate-100 text-[#334155] border border-slate-200 dark:bg-[#0F172A] dark:text-[#CBD5E1] dark:border-[#334155]'
                                    }`}>
                                        {hasExternalData
                                            ? `NOM-004 (${totalLabParameters} ANALITOS${hasCabinetData ? ` • ${cabinetStudies.length} GABINETE` : ''})`
                                            : 'SIN ESTUDIOS EXTERNOS'}
                                    </span>
                                </div>
                            </div>

                            <div className={`grid transition-all duration-300 ease-in-out ${openSections.ocr ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                    {!hasExternalData ? (
                                        <div className="p-5">
                                            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] rounded-xl p-3.5 text-xs text-[#334155] dark:text-[#CBD5E1] font-medium flex items-start gap-2.5">
                                                <span className="text-base shrink-0 mt-0.5">📋</span>
                                                <div>
                                                    <strong className="text-[#0F172A] dark:text-[#F8FAFC] block font-bold mb-0.5 uppercase tracking-wider text-[10px]">Constancia Asentada (NOM-004-SSA3-2012):</strong>
                                                    <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px]">
                                                        Sin estudios de laboratorio o gabinete exógenos cargados en esta consulta. El paciente no presentó estudios previos al momento de la valoración.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col bg-[#F8FAFC] dark:bg-[#0F172A]">
                                            {/* 🕒 BANNER DE VIGENCIA NOM-004 Y TRAZABILIDAD MULTI-DOCUMENTO */}
                                            {(vigenciaMeta || adminSkipped.length > 0) && (
                                                <div className="px-4 py-2.5 bg-white dark:bg-[#1E293B] border-b border-slate-200 dark:border-[#334155] flex flex-wrap items-center justify-between gap-2">
                                                    {vigenciaMeta && (
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold border tabular-nums ${
                                                            vigenciaMeta.tier === 'HISTORICA'
                                                                ? 'bg-[#FFCC00] text-[#0F172A] border-[#EAB308]'
                                                                : vigenciaMeta.tier === 'INTERMEDIA'
                                                                    ? 'bg-[#1C75BC]/10 text-[#1C75BC] border-[#1C75BC]/30 dark:text-[#93C5FD]'
                                                                    : 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30 dark:text-[#DCFCE7]'
                                                        }`}>
                                                            {vigenciaMeta.tier === 'HISTORICA' ? (
                                                                <AlertTriangle size={13} className="text-[#0F172A] shrink-0" />
                                                            ) : (
                                                                <CheckCircle2 size={13} className="shrink-0" />
                                                            )}
                                                            <span>
                                                                {vigenciaMeta.label || (vigenciaMeta.tier === 'HISTORICA'
                                                                    ? `Vigencia histórica (> 180 días${vigenciaMeta.study_date_display ? ` • ${vigenciaMeta.study_date_display}` : ''}) — Referencia basal NOM-004`
                                                                    : `Vigencia clínica verificada${vigenciaMeta.study_date_display ? ` (${vigenciaMeta.study_date_display})` : ''}`)}
                                                            </span>
                                                        </span>
                                                    )}
                                                    {adminSkipped.length > 0 && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] text-[10.5px] font-bold text-[#334155] dark:text-[#CBD5E1] tabular-nums">
                                                            <span>📄</span>
                                                            <span>
                                                                {adminSkipped.length} {adminSkipped.length === 1 ? 'carátula administrativa filtrada' : 'carátulas administrativas filtradas'} (0 analitos clínicos)
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* 🧭 1. BARRA DE NAVEGACIÓN DE SECCIONES ANALÍTICAS DEL LABORATORIO */}
                                            {hasLabData && (
                                                <div className="bg-white dark:bg-[#1E293B] border-b border-slate-200 dark:border-[#334155] px-4 py-3">
                                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                                        <span className="text-[11px] font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider flex items-center gap-1.5 shrink-0 mr-1">
                                                            <span className="text-[#1C75BC]">❖</span> SECCIONES:
                                                        </span>
                                                        {navigableSections.map((sec) => {
                                                            const abnCount = getSectionAbnormalCount(sec);
                                                            const isSelected = activeLabSection?.id === sec.id;
                                                            return (
                                                                <button
                                                                    key={sec.id}
                                                                    type="button"
                                                                    onClick={() => setSelectedLabSectionId(sec.id)}
                                                                    className={`flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border tabular-nums ${
                                                                        isSelected
                                                                            ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-sm'
                                                                            : 'bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] border-slate-200 dark:border-[#334155] hover:bg-slate-200/70'
                                                                    }`}
                                                                >
                                                                    <span className="truncate max-w-[230px]">{sec.title}</span>
                                                                    {abnCount > 0 ? (
                                                                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none tabular-nums ${
                                                                            isSelected
                                                                                ? 'bg-[#B70E0C] text-white ring-1 ring-white/80'
                                                                                : 'bg-[#B70E0C] text-white'
                                                                        }`}>
                                                                            {abnCount}
                                                                        </span>
                                                                    ) : (
                                                                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                                                                            isSelected
                                                                                ? 'bg-white/20 text-white'
                                                                                : 'bg-[#3AAA35]/10 text-[#3AAA35] border border-[#3AAA35]/30'
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

                                            {/* 🧬 2. CABECERA SISTÉMICA DE TRIAJE + CARDS TERMODINÁMICAS DE LA SECCIÓN ACTIVA */}
                                            {hasLabData && activeLabSection && (() => {
                                                const allSecItems = activeLabSection.items || [];
                                                const visibleSecItems = showOnlyLabAbnormalities
                                                    ? allSecItems.filter(it => isLabItemAbnormal(it))
                                                    : allSecItems;
                                                const secAbnCount = getSectionAbnormalCount(activeLabSection);

                                                return (
                                                    <div className="p-5 space-y-5">
                                                        {/* Cabecera Sistémica de Triaje */}
                                                        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2 text-[11px] font-extrabold text-[#1C75BC] uppercase tracking-wider">
                                                                    <span>•</span>
                                                                    <span>{activeLabSection.domain || 'QUÍMICA CLÍNICA Y LABORATORIO FORENSE'}</span>
                                                                </div>
                                                                <h3 className="text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                                                                    {activeLabSection.title}
                                                                </h3>
                                                                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] max-w-2xl leading-relaxed">
                                                                    {activeLabSection.desc || 'Parámetros bioquímicos extraídos íntegramente del reporte de laboratorio clínico.'}
                                                                </p>
                                                            </div>

                                                            <div className="flex items-center gap-3 shrink-0 self-start md:self-center tabular-nums">
                                                                <div className="px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/80 dark:border-[#334155] text-center min-w-[115px]">
                                                                    <span className="block text-[9px] font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-widest mb-0.5">
                                                                        Total Evaluados
                                                                    </span>
                                                                    <span className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                                                                        {allSecItems.length} Parámetros
                                                                    </span>
                                                                </div>
                                                                <div className={`px-4 py-2.5 rounded-xl border text-center min-w-[125px] ${
                                                                    secAbnCount > 0
                                                                        ? 'bg-[#B70E0C]/8 dark:bg-[#B70E0C]/15 border-[#B70E0C]/30'
                                                                        : 'bg-[#3AAA35]/8 dark:bg-[#3AAA35]/15 border-[#3AAA35]/30'
                                                                }`}>
                                                                    <span className={`block text-[9px] font-extrabold uppercase tracking-widest mb-0.5 ${
                                                                        secAbnCount > 0 ? 'text-[#B70E0C] dark:text-[#FECACA]' : 'text-[#3AAA35] dark:text-[#DCFCE7]'
                                                                    }`}>
                                                                        Fuera de Rango
                                                                    </span>
                                                                    <span className={`text-sm font-black flex items-center justify-center gap-1 tabular-nums ${
                                                                        secAbnCount > 0 ? 'text-[#B70E0C] dark:text-[#FECACA]' : 'text-[#3AAA35] dark:text-[#DCFCE7]'
                                                                    }`}>
                                                                        {secAbnCount > 0 ? (
                                                                            <>
                                                                                <AlertTriangle size={13} className="text-[#B70E0C] dark:text-[#FECACA]" />
                                                                                {secAbnCount} Alertas
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <CheckCircle2 size={13} className="text-[#3AAA35] dark:text-[#DCFCE7]" />
                                                                                0 Alertas
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Pila vertical de Tarjetas Bento Termodinámicas */}
                                                        <div className="space-y-4">
                                                            {visibleSecItems.map((marker, idx) => {
                                                                const spectrum = computeLabSpectrum(marker.value, marker.reference, marker.status);
                                                                const isAbn = isLabItemAbnormal(marker);

                                                                const isLow = spectrum.zone === 'LOW' || String(marker.status || '').toUpperCase().includes('BAJO');
                                                                const badge = isAbn
                                                                    ? {
                                                                        bg: 'bg-[#B70E0C]/10 text-[#B70E0C] border-[#B70E0C]/30 dark:text-[#FECACA] font-extrabold',
                                                                        borderLeft: 'border-l-[#B70E0C]',
                                                                        calloutBg: 'bg-[#B70E0C] text-white',
                                                                        calloutArrow: 'border-b-[#B70E0C]',
                                                                        label: isLow ? 'BAJO LR (FUERA DE RANGO)' : 'ELEVADO / SOBRE LR',
                                                                        icon: <AlertTriangle size={12} className="text-[#B70E0C] dark:text-[#FECACA]" />
                                                                    }
                                                                    : {
                                                                        bg: 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30 dark:text-[#DCFCE7] font-bold',
                                                                        borderLeft: 'border-l-[#3AAA35]',
                                                                        calloutBg: 'bg-[#3AAA35] text-white',
                                                                        calloutArrow: 'border-b-[#3AAA35]',
                                                                        label: 'DENTRO DE RANGO (NORMAL)',
                                                                        icon: <CheckCircle2 size={12} className="text-[#3AAA35] dark:text-[#DCFCE7]" />
                                                                    };

                                                                return (
                                                                    <div
                                                                        key={marker.analyte_uid || `${marker.name}_${marker.unit}_${idx}`}
                                                                        className={`bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] border-l-4 ${badge.borderLeft} p-5 shadow-2xs hover:shadow-md transition-all`}
                                                                    >
                                                                        {/* NIVEL 1: Encabezado de Tarjeta, Píldora Semántica y Valor Hero */}
                                                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <h5 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                                                                                        {marker.name}
                                                                                    </h5>
                                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] border uppercase tracking-wider ${badge.bg}`}>
                                                                                        {badge.icon}
                                                                                        <span>{badge.label}</span>
                                                                                    </span>
                                                                                    {marker.delta && marker.delta.diff !== undefined && (
                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1C75BC]/10 text-[#1C75BC] dark:text-[#93C5FD] border border-[#1C75BC]/25 tabular-nums">
                                                                                            Δ {marker.delta.diff > 0 ? `+${marker.delta.diff}` : marker.delta.diff} vs {marker.delta.prev_date || 'previo'}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed max-w-2xl">
                                                                                    {marker.note || (isAbn
                                                                                        ? `${marker.name} presenta desviación respecto al intervalo de referencia del laboratorio (${marker.reference}).`
                                                                                        : `${marker.name} dentro de los límites de referencia biológica (${marker.reference}).`)}
                                                                                </p>
                                                                            </div>

                                                                            <div className="sm:text-right shrink-0 tabular-nums">
                                                                                <div className="flex sm:justify-end items-baseline gap-1.5">
                                                                                    <span className={`text-2xl font-black tracking-tight tabular-nums ${
                                                                                        isAbn ? 'text-[#B70E0C] dark:text-[#FECACA]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                                                                                    }`}>
                                                                                        {marker.value}
                                                                                    </span>
                                                                                    {marker.unit && (
                                                                                        <span className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1]">
                                                                                            {marker.unit}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <span className="block text-[10px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider tabular-nums">
                                                                                    Ref: {marker.reference || 'N/A'} {marker.unit || ''}
                                                                                    {marker.study_date_display ? ` • ${marker.study_date_display}` : ''}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* NIVEL 2: La Barra Termodinámica del Espectro Fisiológico */}
                                                                        {spectrum.isRenderable && (
                                                                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#334155]">
                                                                                <div className="grid grid-cols-3 text-[9px] font-extrabold uppercase tracking-wider mb-1.5 tabular-nums">
                                                                                    <span className="text-[#334155] dark:text-[#CBD5E1] text-left">Bajo Límite</span>
                                                                                    <span className="text-[#3AAA35] dark:text-[#DCFCE7] text-center">
                                                                                        Rango de Referencia ({spectrum.cleanRangeLabel})
                                                                                    </span>
                                                                                    <span className="text-[#334155] dark:text-[#CBD5E1] text-right">Sobre Límite</span>
                                                                                </div>

                                                                                <div className="relative pt-1 pb-8">
                                                                                    <div className="h-2.5 w-full rounded-full overflow-hidden grid grid-cols-3 gap-0.5 bg-slate-100 dark:bg-[#334155] p-0.5">
                                                                                        <div className="bg-amber-300/60 dark:bg-amber-500/40 rounded-l-full" />
                                                                                        <div className="bg-[#3AAA35]/75 dark:bg-[#3AAA35]/65" />
                                                                                        <div className="bg-rose-400/65 dark:bg-rose-500/45 rounded-r-full" />
                                                                                    </div>

                                                                                    <div
                                                                                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                                                                                        style={{ left: `${spectrum.positionPct}%` }}
                                                                                    >
                                                                                        <div className={`w-4 h-4 rounded-full border-2 border-white dark:border-[#0F172A] shadow-md ${
                                                                                            spectrum.zone === 'OPTIMAL'
                                                                                                ? 'bg-[#3AAA35]'
                                                                                                : 'bg-[#B70E0C]'
                                                                                        }`} />
                                                                                        <div className={`w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] ${badge.calloutArrow} mt-0.5`} />
                                                                                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap shadow-xs tabular-nums ${badge.calloutBg}`}>
                                                                                            {spectrum.calloutText}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* 🏥 3. SECCIÓN CONSOLIDADA DE GABINETE, CARDIOLOGÍA E IMAGENOLOGÍA (EGM-44) */}
                                            {hasCabinetData && (
                                                <div className="p-5 pt-2 space-y-4 border-t border-slate-200 dark:border-[#334155]">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base">🏥</span>
                                                            <div>
                                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C75BC] block">
                                                                    Integración Multimodal • Study Grouping NOM-004
                                                                </span>
                                                                <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                                                    Estudios de Gabinete, Cardiología e Imagenología
                                                                </h3>
                                                            </div>
                                                        </div>
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#1C75BC]/10 text-[#1C75BC] dark:text-[#93C5FD] border border-[#1C75BC]/30 tabular-nums">
                                                            {cabinetStudies.length} {cabinetStudies.length === 1 ? 'Estudio Consolidado' : 'Estudios Consolidados'}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-4">
                                                        {cabinetStudies.map((study, cIdx) => {
                                                            const m = study?.metrics || {};
                                                            const modUpper = String(study?.modality || study?.type || '').toUpperCase();
                                                            const isEcg = modUpper.includes('ECG');
                                                            const isRx = modUpper.includes('RX') || modUpper.includes('RADIO');
                                                            const modIcon = isEcg ? '💓' : isRx ? '🫁' : '📡';
                                                            const studyVig = study?.vigencia || null;
                                                            const isStudyHistorical = studyVig?.tier === 'HISTORICA';
                                                            const metricChips = [];
                                                            if (m.hr_bpm !== undefined) metricChips.push(`FC ${m.hr_bpm} lpm`);
                                                            if (m.pr_ms !== undefined) metricChips.push(`PR ${m.pr_ms} ms`);
                                                            if (m.qrs_ms !== undefined) metricChips.push(`QRS ${m.qrs_ms} ms`);
                                                            if (m.qt_ms !== undefined && m.qtc_ms !== undefined) {
                                                                metricChips.push(`QT/QTc ${m.qt_ms}/${m.qtc_ms} ms`);
                                                            } else if (m.qtc_ms !== undefined) {
                                                                metricChips.push(`QTc ${m.qtc_ms} ms`);
                                                            }
                                                            if (m.p_axis_deg !== undefined && m.qrs_axis_deg !== undefined && m.t_axis_deg !== undefined) {
                                                                metricChips.push(`Ejes P/QRS/T ${m.p_axis_deg}° / ${m.qrs_axis_deg}° / ${m.t_axis_deg}°`);
                                                            } else if (m.qrs_axis_deg !== undefined) {
                                                                metricChips.push(`Eje QRS ${m.qrs_axis_deg}°`);
                                                            }
                                                            if (m.rr_ms !== undefined) metricChips.push(`RR ${m.rr_ms} ms`);
                                                            if (m.ict !== undefined) metricChips.push(`ICT ${m.ict} (Normal <= 0.50)`);

                                                            const hasAlertFlag = Array.isArray(study?.clinical_flags) && study.clinical_flags.some((f) =>
                                                                /(RBBB|BRADYCARDIA|LEFT_AXIS|PROMINENT_AORTIC|ECHOCARDIOGRAM)/i.test(String(f))
                                                            );

                                                            return (
                                                                <div
                                                                    key={study.study_uid || `cab_${cIdx}`}
                                                                    className={`bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] border-l-4 ${
                                                                        hasAlertFlag ? 'border-l-[#FFCC00]' : 'border-l-[#1C75BC]'
                                                                    } p-5 shadow-2xs space-y-3`}
                                                                >
                                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                                        <div className="space-y-1">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <span className="text-base">{modIcon}</span>
                                                                                <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                                                                                    {study.title || study.modality || 'Estudio de Gabinete'}
                                                                                </h4>
                                                                                {Number(study.attached_plate_pages) > 0 && (
                                                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#1C75BC]/10 text-[#1C75BC] dark:text-[#93C5FD] border border-[#1C75BC]/30 tabular-nums">
                                                                                        Informe + {study.attached_plate_pages} láminas Doppler
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {study.study_date_display && (
                                                                                <span className="block text-[11px] font-semibold text-[#334155] dark:text-[#CBD5E1] tabular-nums">
                                                                                    Fecha del estudio: {study.study_date_display}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase border tabular-nums ${
                                                                            isStudyHistorical || hasAlertFlag
                                                                                ? 'bg-[#FFCC00] text-[#0F172A] border-[#EAB308]'
                                                                                : 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30 dark:text-[#DCFCE7]'
                                                                        }`}>
                                                                            {isStudyHistorical || hasAlertFlag ? (
                                                                                <AlertTriangle size={12} className="text-[#0F172A] shrink-0" />
                                                                            ) : (
                                                                                <CheckCircle2 size={12} className="shrink-0" />
                                                                            )}
                                                                            <span>
                                                                                {hasAlertFlag
                                                                                    ? 'Hallazgos de Seguimiento'
                                                                                    : (isStudyHistorical ? 'Referencia Histórica (> 180 d)' : 'Integrado NOM-004')}
                                                                            </span>
                                                                        </span>
                                                                    </div>

                                                                    {metricChips.length > 0 && (
                                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                                            {metricChips.map((chip, mIdx) => (
                                                                                <span
                                                                                    key={mIdx}
                                                                                    className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] text-[11px] font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums"
                                                                                >
                                                                                    {chip}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {(study.impression || study.findings_summary) && (
                                                                        <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200/70 dark:border-[#334155] rounded-xl p-3">
                                                                            <strong className="text-[#0F172A] dark:text-[#F8FAFC] font-extrabold">Conclusión diagnóstica: </strong>
                                                                            {study.impression || study.findings_summary}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    );
                    } catch (ocrRenderErr) {
                        console.error('⚠️ [TabBiochemicals #card-pdf Fallback]:', ocrRenderErr);
                        return (
                            <div className="p-5 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] bg-[#FFCC00]/20 border-l-4 border-[#FFCC00]">
                                Estudios clínicos externos registrados en el expediente NOM-004.
                            </div>
                        );
                    }
                })()}
            </div>

            {/* 📸 [ACORDEÓN 5] PASO 5: EVIDENCIA SOMÁTICA DOCUMENTADA - CONTENEDOR PERMANENTE NOM-004 */}
            <div id="card-somatic" className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                {(() => {
                    const vm = typeof patientData?.scan_data?.visual_metrics === 'object' && patientData?.scan_data?.visual_metrics !== null
                        ? patientData.scan_data.visual_metrics
                        : null;
                    const somaticItems = Array.isArray(vm?.items) && vm.items.length > 0
                        ? vm.items
                        : (vm?.imageUrl ? [{
                            index: 1,
                            region: 'Evidencia Somática #1',
                            finding: vm.findings || 'Exploración visual somática documentada.',
                            severity: vm.severity || 'Baja',
                            clinical_flags: vm.clinical_flags || [],
                            imageUrl: vm.imageUrl
                        }] : []);
                    const hasSomatic = somaticItems.length > 0;

                    // 🧬 Traductor Clínico de Severidad (insensible a mayúsculas/minúsculas: low, Medium, HIGH, CRITICAL, etc.)
                    const translateSomaticSeverity = (rawSev) => {
                        const s = String(rawSev || 'Baja').trim().toUpperCase();
                        if (s.includes('CRIT') || s.includes('CRÍT') || s.includes('SEVER')) return 'CRÍTICA';
                        if (s.includes('HIGH') || s.includes('ALT')) return 'ALTA';
                        if (s.includes('MED') || s.includes('MOD')) return 'MODERADA';
                        if (s.includes('LOW') || s.includes('BAJ') || s.includes('NORM') || s.includes('LEVE')) return 'BAJA';
                        return s || 'BAJA';
                    };

                    // 🧬 Traductor Clínico de Banderas Morfológicas (#CamelCase + snake_case + acentuación española + blindaje COFEPRIS)
                    const translateSomaticFlag = (rawFlag) => {
                        if (!rawFlag) return '';
                        const preCleaned = String(rawFlag)
                            .trim()
                            .replace(/^#+/, '')
                            .replace(/autoinmun[ea]s?/gi, 'Reactividad Microvascular')
                            .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
                            .replace(/([A-ZÁÉÍÓÚÑ]+)([A-ZÁÉÍÓÚÑ][a-záéíóúñ])/g, '$1 $2');
                        const cleanKey = preCleaned.toUpperCase().replace(/[\s-]+/g, '_');
                        const EXACT_FLAG_MAP = {
                            RETICULAR_ERYTHEMA: 'ERITEMA RETICULAR',
                            PUNCTATE_MACULES: 'MÁCULAS PUNTIFORMES',
                            MICROPAPULAR_ERUPTION: 'ERUPCIÓN MICROPAPULAR',
                            PERIFOLLICULAR_INVOLVEMENT: 'COMPROMISO PERIFOLICULAR',
                            CUTANEOUS_EDEMA_SUPERFICIAL: 'EDEMA CUTÁNEO SUPERFICIAL',
                            SUPERFICIAL_CUTANEOUS_EDEMA: 'EDEMA CUTÁNEO SUPERFICIAL',
                            CHRONIC_VENOUS_INSUFFICIENCY_DETECTED: 'INSUFICIENCIA VENOSA CRÓNICA',
                            CHRONIC_VENOUS_INSUFFICIENCY: 'INSUFICIENCIA VENOSA CRÓNICA',
                            INSUFICIENCIA_VENOSA_CRONICA: 'INSUFICIENCIA VENOSA CRÓNICA',
                            VARICOSE_VEINS_HIGH_RISK: 'VENAS VARICOSAS DE ALTO RIESGO',
                            VENOUS_STASIS_DERMATITIS: 'DERMATITIS POR ESTASIS VENOSA',
                            EDEMA_PERIPHERAL_MODERATE: 'EDEMA PERIFÉRICO MODERADO',
                            PERIPHERAL_EDEMA: 'EDEMA PERIFÉRICO',
                            HYPERPIGMENTATION: 'HIPERPIGMENTACIÓN CUTÁNEA',
                            HEMOSIDERIN_PIGMENTATION: 'PIGMENTACIÓN POR HEMOSIDERINA',
                            FOLLICULAR_HYPERKERATOSIS: 'HIPERQUERATOSIS FOLICULAR',
                            XEROSIS_CUTIS: 'XEROSIS CUTÁNEA',
                            TELANGIECTASIA: 'TELANGIECTASIAS SUPERFICIALES',
                            VENOUS_ECTASIA: 'ECTASIA VENOSA'
                        };
                        if (EXACT_FLAG_MAP[cleanKey]) return EXACT_FLAG_MAP[cleanKey];

                        const TOKEN_MAP = {
                            RETICULAR: 'RETICULAR',
                            ERYTHEMA: 'ERITEMA',
                            PUNCTATE: 'PUNTIFORME',
                            MACULES: 'MÁCULAS',
                            MACULAS: 'MÁCULAS',
                            MACULAR: 'MACULAR',
                            MICROPAPULAR: 'MICROPAPULAR',
                            PAPULAR: 'PAPULAR',
                            ERUPTION: 'ERUPCIÓN',
                            ERUPCION: 'ERUPCIÓN',
                            PERIFOLLICULAR: 'PERIFOLICULAR',
                            FOLLICULAR: 'FOLICULAR',
                            INVOLVEMENT: 'COMPROMISO',
                            CUTANEOUS: 'CUTÁNEO',
                            CUTANEO: 'CUTÁNEO',
                            CUTANEA: 'CUTÁNEA',
                            DERMAL: 'DÉRMICO',
                            DERMICO: 'DÉRMICO',
                            DERMICA: 'DÉRMICA',
                            SKIN: 'CUTÁNEO',
                            EDEMA: 'EDEMA',
                            SUPERFICIAL: 'SUPERFICIAL',
                            DEEP: 'PROFUNDO',
                            CHRONIC: 'CRÓNICA',
                            CRONICA: 'CRÓNICA',
                            CRONICO: 'CRÓNICO',
                            VENOUS: 'VENOSA',
                            INSUFFICIENCY: 'INSUFICIENCIA',
                            DETECTED: 'DETECTADA',
                            VARICOSE: 'VARICOSAS',
                            VEINS: 'VENAS',
                            HIGH: 'ALTO',
                            MODERATE: 'MODERADO',
                            MILD: 'LEVE',
                            LOW: 'BAJO',
                            RISK: 'RIESGO',
                            STASIS: 'ESTASIS',
                            DERMATITIS: 'DERMATITIS',
                            PERIPHERAL: 'PERIFÉRICO',
                            PERIFERICO: 'PERIFÉRICO',
                            PERIFERICA: 'PERIFÉRICA',
                            LESION: 'LESIÓN',
                            LESIONS: 'LESIONES',
                            ULCER: 'ÚLCERA',
                            ULCERA: 'ÚLCERA',
                            ATROPHY: 'ATROFIA',
                            DRYNESS: 'SEQUEDAD',
                            INFLAMMATION: 'INFLAMACIÓN',
                            INFLAMACION: 'INFLAMACIÓN',
                            PIGMENTACION: 'PIGMENTACIÓN',
                            HIPERPIGMENTACION: 'HIPERPIGMENTACIÓN',
                            CIRCULACION: 'CIRCULACIÓN',
                            MICROCIRCULACION: 'MICROCIRCULACIÓN',
                            EUTROFICO: 'EUTRÓFICO',
                            VASCULAR: 'VASCULAR'
                        };

                        const words = preCleaned.replace(/[_-]+/g, ' ').trim().split(/\s+/);
                        return words
                            .map(w => {
                                const plainUpper = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
                                return TOKEN_MAP[plainUpper] || w.toUpperCase();
                            })
                            .join(' ');
                    };

                    const globalSeverityEs = translateSomaticSeverity(vm?.severity);

                    return (
                        <>
                            <button 
                                type="button"
                                onClick={() => toggleSection('somatic')}
                                className="w-full p-4 min-h-[48px] flex items-center justify-between bg-slate-50/60 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition-colors text-left select-none focus:outline-none cursor-pointer"
                                aria-expanded={openSections.somatic}
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="text-base">📸</span>
                                    <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider">Evidencia Somática Documentada</h4>
                                    <ChevronDown className={`w-5 h-5 text-[#334155] dark:text-[#CBD5E1] transition-transform duration-200 ${openSections.somatic ? 'rotate-180' : ''}`} />
                                </div>
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tabular-nums ${
                                    hasSomatic
                                        ? 'bg-blue-50 text-[#1C75BC] border border-blue-200 dark:bg-blue-950/60 dark:text-[#93C5FD] dark:border-blue-800'
                                        : 'bg-slate-100 text-[#334155] border border-slate-300 dark:bg-slate-800 dark:text-[#CBD5E1] dark:border-[#334155]'
                                }`}>
                                    {hasSomatic ? `EVIDENCIA VERIFICADA (${somaticItems.length} FOTO${somaticItems.length > 1 ? 'S' : ''})` : 'EVALUACIÓN OMITIDA'}
                                </span>
                            </button>

                            <div className={`grid transition-all duration-300 ease-in-out ${openSections.somatic ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-[#334155]' : 'grid-rows-[0fr] opacity-0 border-t-0'}`}>
                                <div className="overflow-hidden">
                                    <div className="p-5 space-y-5 bg-[#F8FAFC] dark:bg-[#0F172A]">
                                        {hasSomatic ? (
                                            <>
                                                {/* 1. CABECERA EJECUTIVA MULTI-FOTOGRAFÍA SOMÁTICA */}
                                                <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200/80 dark:border-[#334155] space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base">📸</span>
                                                            <h5 className="text-xs font-extrabold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider tabular-nums">
                                                                Galería e Inferencia Morfológica Somática ({somaticItems.length} Evidencia{somaticItems.length > 1 ? 's' : ''})
                                                            </h5>
                                                        </div>
                                                        <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase border ${
                                                            globalSeverityEs === 'ALTA' || globalSeverityEs === 'CRÍTICA'
                                                                ? 'bg-red-50 text-[#B70E0C] border-red-200'
                                                                : globalSeverityEs === 'MODERADA'
                                                                    ? 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800]'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                        }`}>
                                                            Severidad Global: {globalSeverityEs}
                                                        </span>
                                                    </div>

                                                    {/* Galería de Miniaturas de todas las fotos capturadas */}
                                                    <div className="flex flex-wrap items-center gap-4 pt-1">
                                                        {somaticItems.map((it, idx) => (
                                                            <div key={idx} className="flex flex-col items-center gap-1 tabular-nums">
                                                                <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-[#334155] shadow-sm bg-[#0F172A]">
                                                                    <img
                                                                        src={getValidImageUrl(it.imageUrl)}
                                                                        onError={handleImageError}
                                                                        alt={sanitizeUiWhiteLabelText(it.region || `Evidencia ${idx + 1}`)}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                    <span className="absolute bottom-0 inset-x-0 bg-[#0F172A]/85 text-white text-[8px] font-black text-center py-0.5 tracking-wider uppercase">
                                                                        FOTO #{idx + 1}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-extrabold text-[#334155] dark:text-[#CBD5E1] uppercase max-w-[95px] truncate">
                                                                    {sanitizeUiWhiteLabelText(it.region || `F-#${idx + 1}`)}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase">
                                                                    Sev: {translateSomaticSeverity(it.severity)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Síntesis Morfológica Global */}
                                                    {vm?.findings && (
                                                        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-3.5 rounded-xl border border-slate-200/80 dark:border-[#334155] shadow-2xs">
                                                            <p className="text-xs text-[#334155] dark:text-[#CBD5E1] italic leading-relaxed">
                                                                "{sanitizeUiWhiteLabelText(vm.findings)}"
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 2. PILA DE TARJETAS BENTO CLÍNICAS POR FOTOGRAFÍA */}
                                                <div className="space-y-4">
                                                    {somaticItems.map((item, idx) => {
                                                        const itemSeverityEs = translateSomaticSeverity(item.severity);
                                                        const isHigh = itemSeverityEs === 'ALTA' || itemSeverityEs === 'CRÍTICA';
                                                        const isMed = itemSeverityEs === 'MODERADA';
                                                        const isOptimal = !isHigh && !isMed;
                                                        const pct = isOptimal ? 50 : isMed ? 74 : 88;

                                                        const badge = isOptimal
                                                            ? {
                                                                bg: 'bg-emerald-50 text-[#3AAA35] border-emerald-200 font-bold',
                                                                borderLeft: 'border-l-[#3AAA35]',
                                                                calloutBg: 'bg-[#3AAA35] text-white',
                                                                calloutArrow: 'border-b-[#3AAA35]',
                                                                label: 'INTEGRIDAD CONSERVADA',
                                                                icon: <CheckCircle2 size={12} strokeWidth={2} className="text-[#3AAA35]" />
                                                            }
                                                            : isMed
                                                                ? {
                                                                    bg: 'bg-[#FFCC00] text-[#0F172A] border-[#E6B800] font-extrabold',
                                                                    borderLeft: 'border-l-[#FFCC00]',
                                                                    calloutBg: 'bg-[#FFCC00] text-[#0F172A] border border-[#E6B800]',
                                                                    calloutArrow: 'border-b-[#FFCC00]',
                                                                    label: 'OBSERVACIÓN MODERADA',
                                                                    icon: <AlertTriangle size={12} strokeWidth={2} className="text-[#0F172A]" />
                                                                }
                                                                : {
                                                                    bg: 'bg-red-50 text-[#B70E0C] border-red-200 font-extrabold',
                                                                    borderLeft: 'border-l-[#B70E0C]',
                                                                    calloutBg: 'bg-[#B70E0C] text-white',
                                                                    calloutArrow: 'border-b-[#B70E0C]',
                                                                    label: 'ALERTA MORFOLÓGICA ALTA',
                                                                    icon: <AlertTriangle size={12} strokeWidth={2} className="text-[#B70E0C]" />
                                                                };

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/90 dark:border-[#334155] border-l-4 ${badge.borderLeft} p-5 shadow-2xs hover:shadow-md transition-all tabular-nums`}
                                                            >
                                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                                    <div className="flex items-start gap-3.5 flex-1">
                                                                        <img
                                                                            src={getValidImageUrl(item.imageUrl)}
                                                                            onError={handleImageError}
                                                                            alt={sanitizeUiWhiteLabelText(item.region || `Evidencia ${idx + 1}`)}
                                                                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-[#334155] shrink-0 shadow-2xs"
                                                                        />
                                                                        <div className="space-y-1.5 flex-1">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <h5 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                                                                                    Fotografía #{idx + 1}: {sanitizeUiWhiteLabelText(item.region || 'Región Somática Evaluada')}
                                                                                </h5>
                                                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] border uppercase tracking-wider ${badge.bg}`}>
                                                                                    {badge.icon}
                                                                                    <span>{badge.label}</span>
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                                                                                {sanitizeUiWhiteLabelText(item.finding)}
                                                                            </p>
                                                                            {Array.isArray(item.clinical_flags) && item.clinical_flags.length > 0 && (
                                                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                                                    {item.clinical_flags.map((fl, fIdx) => (
                                                                                        <span key={fIdx} className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] border border-slate-200 dark:border-[#334155]">
                                                                                            ⚑ {translateSomaticFlag(fl)}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="sm:text-right shrink-0">
                                                                        <span className={`text-lg font-black tracking-tight uppercase ${
                                                                            isOptimal ? 'text-[#0F172A] dark:text-[#F8FAFC]' : isMed ? 'text-[#0F172A] dark:text-[#FFCC00]' : 'text-[#B70E0C]'
                                                                        }`}>
                                                                            FOTO #{idx + 1}
                                                                        </span>
                                                                        <span className="block text-[10px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider">
                                                                            Severidad: {itemSeverityEs}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Barra Termodinámica Morfológica */}
                                                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#334155]">
                                                                    <div className="grid grid-cols-3 text-[9px] font-extrabold uppercase tracking-wider mb-1.5">
                                                                        <span className="text-[#334155] dark:text-[#CBD5E1] text-left">Hipotrofismo</span>
                                                                        <span className="text-[#3AAA35] text-center">Integridad Tisular Óptima</span>
                                                                        <span className="text-[#334155] dark:text-[#CBD5E1] text-right">Compromiso / Estasis</span>
                                                                    </div>
                                                                    <div className="relative pt-1 pb-7">
                                                                        <div className="h-2.5 w-full rounded-full overflow-hidden grid grid-cols-3 gap-0.5 bg-slate-100 dark:bg-[#0F172A] p-0.5">
                                                                            <div className="bg-[#FFCC00]/65 dark:bg-[#FFCC00]/45 rounded-l-full" />
                                                                            <div className="bg-[#3AAA35]/75 dark:bg-[#3AAA35]/65" />
                                                                            <div className="bg-[#B70E0C]/65 dark:bg-[#B70E0C]/50 rounded-r-full" />
                                                                        </div>
                                                                        <div
                                                                            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                                                                            style={{ left: `${pct}%` }}
                                                                        >
                                                                            <div className={`w-4 h-4 rounded-full border-2 border-white dark:border-[#0F172A] shadow-md ${
                                                                                isOptimal ? 'bg-[#3AAA35]' : isMed ? 'bg-[#FFCC00]' : 'bg-[#B70E0C]'
                                                                            }`} />
                                                                            <div className={`w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] ${badge.calloutArrow} mt-0.5`} />
                                                                            <div className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap shadow-xs ${badge.calloutBg}`}>
                                                                                {isOptimal ? 'Tejido Eutrófico' : isMed ? 'Vigilancia Clínica' : 'Atención Prioritaria'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {renderCortexCorrelationControl(`cortex_somatic_${idx}`, 'somatic_vascular')}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-[#334155] rounded-xl p-3.5 text-xs text-[#334155] dark:text-[#CBD5E1] font-medium flex items-start gap-2.5">
                                                <span className="text-base shrink-0 mt-0.5">📸</span>
                                                <div>
                                                    <strong className="text-[#0F172A] dark:text-[#F8FAFC] block font-bold mb-0.5 uppercase tracking-wider text-[10px]">Constancia Asentada (NOM-004-SSA3-2012):</strong>
                                                    <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-[11px]">
                                                        Evidencia visual somática omitida por el evaluado o especialista. No se cargó registro fotográfico somático complementario para este folio de cita.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* Modal */}
            {renderModalContent()}
        </div>
    );
};

export default TabBiochemicals;
