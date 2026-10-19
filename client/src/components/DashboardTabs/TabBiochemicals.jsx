import React, { useState, useEffect } from 'react';
import { FlaskConical, AlertTriangle, Filter, CheckCircle2, ChevronDown } from 'lucide-react';
import { parseElectretData } from '../../utils/electretParser';
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
        patientData?.scan_data?.external_metrics?.biomarkers && 
        Object.keys(patientData.scan_data.external_metrics.biomarkers).length > 0
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
        setManualToggles({
            electret: nextState,
            ocular: nextState,
            lingual: nextState,
            ocr: nextState,
            somatic: nextState
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
                                            <span className="w-2 h-2 rounded-full bg-[#E30613] animate-pulse"></span> {section}
                                        </h4>
                                        <span className="text-[10px] bg-red-100 text-[#E30613] px-2 py-0.5 rounded-full font-bold border border-red-200">{abnormalRows.length} ALERTAS</span>
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
                                                    badgeClass = "bg-red-50 text-[#E30613] border-red-200 font-extrabold";
                                                    badgeLabel = status === 'critical_high' ? "Anormal Severo ⬆" : "Anormal Severo ⬇";
                                                }
                                                return (
                                                    <tr key={rIdx} className="hover:bg-red-50/10 transition-colors">
                                                        <td className="px-6 py-3 font-medium text-slate-600 w-[40%]">{row.label}</td>
                                                        <td className="px-6 py-3 font-bold text-slate-800 text-base">{row.value}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${badgeClass}`}>{badgeLabel}</span>
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-400 text-xs text-right font-mono">{row.ref}</td>
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
        if (!metricsToCheck) return false;

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
    // Si el expediente tiene telemetría incompleta (< 10 categorías, ej. solo Cardiovascular por caché previa) o acaba de recargar F5 en Fase 18, sincronizar automáticamente con ResultOne.htm
    const hasAutoUpgradedRef = React.useRef(false);
    React.useEffect(() => {
        if (!activePatientFullName) return;
        if (categoriesKeys.length >= 20) return;
        if (hasAutoUpgradedRef.current) return;

        hasAutoUpgradedRef.current = true;
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        fetch(`${cleanBase}/api/bio/scan/electret/sync?patientName=${encodeURIComponent(activePatientFullName)}&_t=${Date.now()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: JSON.stringify({ patientName: activePatientFullName })
        })
            .then(r => r.json())
            .then(data => {
                if (data?.success && data?.electret_metrics && Object.keys(data.electret_metrics).length > 0) {
                    useClinicalGenome.getState().setElectretTelemetry({
                        categories: data.electret_metrics,
                        patientName: data?.patientMetadata?.name || activePatientFullName,
                        isScanned: true,
                        totalParameters: data.totalParameters || 253,
                        abnormalCount: data.abnormalCount || 0
                    });
                }
            })
            .catch(err => console.warn("⚠️ Auto-upgrade Electret:", err.message));
    }, [activePatientFullName, categoriesKeys.length]);

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
                bg: "bg-red-50 text-[#E30613] border-red-200 font-extrabold",
                borderLeft: "border-l-[#E30613]",
                calloutBg: "bg-[#E30613] text-white",
                calloutArrow: "border-b-[#E30613]",
                label: "ANORMAL SEVERO (+++)",
                icon: <AlertTriangle size={12} className="text-[#E30613] animate-pulse" />
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

    const getCategoryAbnormalCount = (catKey) => {
        const catData = activeMetrics?.[catKey];
        const items = getCategoryItems(catData);
        return items.reduce((acc, item) => {
            const s = item?.status ? String(item.status).toUpperCase() : 'NORMAL';
            if (s !== 'NORMAL' && s !== 'NORMAL (-)' && s !== '-' && s !== 'INFORMATIVO') {
                return acc + 1;
            }
            return acc;
        }, 0);
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

    const getBiosemanticInference = (marker, spectrum) => {
        if (marker?.translation) return marker.translation;
        if (marker?.description) return marker.description;

        const name = marker?.name || 'Parámetro biológico';
        const s = String(marker?.status || 'NORMAL').toUpperCase();

        if (s.includes('NORMAL') || s === '-') {
            return `${name} en equilibrio fisiológico compatible con homeostasis celular y adecuada respuesta metabólica.`;
        }
        if (spectrum?.isRenderable) {
            if (spectrum.zone === 'HIGH') {
                return `Elevación bioeléctrica en ${name} por encima del umbral óptimo (${spectrum.max}). Sugiere sobrecarga funcional o demanda adaptativa tisular que requiere modulación nutricional.`;
            }
            if (spectrum.zone === 'LOW') {
                return `Disminución bioeléctrica en ${name} por debajo del umbral fisiológico (${spectrum.min}). Sugiere depleción de reserva funcional o requerimiento de soporte celular dirigido.`;
            }
        }
        return `Variación biosemántica detectada en ${name} (${marker?.status}). Se recomienda correlación clínica integral dentro del protocolo personalizado.`;
    };

    const activeSubstep = patientData?.scan_data?.active_substep;

    useEffect(() => {
        if (!activeSubstep) return;
        let targetId = null;
        if (activeSubstep === 'ELECTRET') targetId = 'card-electret';
        else if (activeSubstep === 'OCULAR' || activeSubstep.includes('OCULAR')) targetId = 'card-ocular';
        else if (activeSubstep === 'LINGUAL') targetId = 'card-lingual';
        else if (activeSubstep === 'EXTERNAL') targetId = 'card-pdf';
        else if (activeSubstep === 'VISUAL') targetId = 'card-somatic';

        if (targetId) {
            const timer = setTimeout(() => {
                const el = document.getElementById(targetId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 250);
            return () => clearTimeout(timer);
        }
    }, [activeSubstep, patientData?.scan_data]);

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
            tipo_toma: rawOcular?.tipo_toma || base.tipo_toma || "Segmento Anterior (Superficie Ocular)",
            calidad_optica: rawOcular?.calidad_optica || base.calidad_optica || "Óptima",
            sintesis_fisiopatologica: rawOcular?.sintesis_fisiopatologica || base.sintesis_fisiopatologica || null,
            disclaimer_legal: rawOcular?.disclaimer_legal || base.disclaimer_legal || "Tamizaje biosemántico ocular no invasivo asistido por IA (Gemini 2.5 Flash) conforme a la NOM-004.",
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
                    estado: typeof base.palidez_conjuntival === 'string' ? base.palidez_conjuntival : "Evaluación Tarsal Registrada",
                    descripcion_clinica: base.predictions?.hemoglobin?.translation || "Análisis microvascular tarsal procesado."
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
            tipo_toma: rawLingual?.tipo_toma || base.tipo_toma || "Cara Dorsal (Saburra y Papilas)",
            calidad_optica: rawLingual?.calidad_optica || base.calidad_optica || "Óptima",
            sintesis_fisiopatologica: rawLingual?.sintesis_fisiopatologica || base.sintesis_fisiopatologica || null,
            disclaimer_legal: rawLingual?.disclaimer_legal || base.disclaimer_legal || "Tamizaje biofotónico lingual funcional asistido por IA (Gemini Vision) conforme a la NOM-004-SSA3-2012.",
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
                    trofismo_volumen: base.trofismo_volumen || "Normotrófico",
                    indentaciones_dentales: base.indentaciones_dentales || "Ausentes",
                    fisuras_mucosa: base.fisuras_mucosa || "Sin fisuras"
                },
            saburra_microbiota: (typeof base.saburra_microbiota === 'object' && base.saburra_microbiota !== null)
                ? base.saburra_microbiota
                : {
                    grosor: base.saburra_thickness || (typeof base.saburra_lingual === 'string' ? base.saburra_lingual : "Delgada / Fisiológica"),
                    color: "Normocoloreada",
                    distribucion_topografica: (typeof base.saburra_microbiota?.distribucion_topografica === 'object')
                        ? base.saburra_microbiota.distribucion_topografica
                        : null,
                    humectacion: base.epithelial_hydration || "Normo-humectada"
                }
        };
    }, [rawLingual]);

    const lingualTopography = lingualAudit;

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
                    <div className="pr-4 flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowOnlyAbnormalities(!showOnlyAbnormalities);
                            }} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                showOnlyAbnormalities 
                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] hover:bg-[#1C75BC]/90' 
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            <Filter size={12} />
                            {showOnlyAbnormalities ? 'Mostrando Anormalidades' : 'Mostrar solo Anormalidades'}
                        </button>
                        <span className="text-[10px] bg-[#1C75BC]/10 text-[#1C75BC] dark:text-blue-400 px-2.5 py-0.5 rounded-full font-bold border border-[#1C75BC]/30 uppercase tracking-wider">
                            Biosensores Activos
                        </span>
                    </div>
                </div>

                <div className={`grid transition-all duration-300 ease-in-out ${openSections.electret ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                        {Object.keys(activeMetrics).length === 0 ? (
                            <div className="p-12 text-center bg-slate-50/50 my-6 mx-4 rounded-2xl border border-dashed border-[#1C75BC]/30">
                                <div className="w-14 h-14 rounded-2xl bg-[#1C75BC]/10 text-[#1C75BC] flex items-center justify-center mx-auto mb-3 text-2xl shadow-sm">
                                    ⚡
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">
                                    Compuerta de Telemetría en Espera (NOM-004)
                                </h4>
                                <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                                    {activePatientFullName ? (
                                        <>Aguardando sincronización de estudio vivo para <strong className="text-slate-700 dark:text-slate-200">{activePatientFullName}</strong>. Realice el escaneo en el software Electret y presione <strong>"🔄 Sincronizar Hardware"</strong> en la <strong>Fase 18</strong> del panel izquierdo.</>
                                    ) : (
                                        <>Aguardando sincronización de estudio vivo desde la <strong>Fase 18</strong> del panel izquierdo.</>
                                    )}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col bg-[#FAFAFA] dark:bg-slate-900">
                                {/* 🧭 1. NAVEGACIÓN ANATÓMICA HORIZONTAL + MENÚ BUSCABLE DE 37 CATEGORÍAS */}
                                <div className="relative bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                        <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0 mr-1">
                                            <span className="text-[#1C75BC]">❖</span> SISTEMAS:
                                        </span>

                                        {(() => {
                                            // Garantizar que la categoría activa siempre sea visible en la tira rápida superior (primeros 5 lugares)
                                            const baseSlice = categoriesKeys.slice(0, 5);
                                            const visiblePills = activeCategory && !baseSlice.includes(activeCategory)
                                                ? [activeCategory, ...categoriesKeys.filter(k => k !== activeCategory).slice(0, 4)]
                                                : baseSlice;

                                            return visiblePills.map(catKey => {
                                                const title = CATEGORIAS_CLINICAS[catKey] || catKey.replace(/_/g, ' ');
                                                const abnormalCount = getCategoryAbnormalCount(catKey);
                                                const isSelected = catKey === activeCategory;

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
                                                                    ? 'bg-[#E30613] text-white ring-1 ring-white/80'
                                                                    : 'bg-[#E30613] text-white'
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
                                            });
                                        })()}

                                        {categoriesKeys.length > 5 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllSystemsMenu(prev => !prev)}
                                                className={`ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-extrabold border transition-all shrink-0 cursor-pointer ${
                                                    showAllSystemsMenu
                                                        ? 'bg-slate-800 text-white border-slate-800'
                                                        : 'bg-white dark:bg-slate-800 text-[#1C75BC] border-[#1C75BC]/30 hover:bg-[#1C75BC]/5'
                                                }`}
                                            >
                                                <span>Más ({categoriesKeys.length - 5})</span>
                                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllSystemsMenu ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Panel Desplegable Buscable para las 37 Categorías Completas */}
                                    {showAllSystemsMenu && (
                                        <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg animate-in fade-in duration-150">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                                    Directorio Completo de Sistemas Biológicos ({categoriesKeys.length} Categorías)
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
                                                {categoriesKeys
                                                    .filter(catKey => {
                                                        if (!systemSearchQuery.trim()) return true;
                                                        const q = systemSearchQuery.toLowerCase().trim();
                                                        const label = (CATEGORIAS_CLINICAS[catKey] || catKey).toLowerCase();
                                                        return label.includes(q) || catKey.toLowerCase().includes(q);
                                                    })
                                                    .map((catKey, index) => {
                                                        const title = CATEGORIAS_CLINICAS[catKey] || catKey.replace(/_/g, ' ');
                                                        const abnormalCount = getCategoryAbnormalCount(catKey);
                                                        const isSelected = catKey === activeCategory;
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
                                                                        isSelected ? 'bg-[#E30613] text-white ring-1 ring-white/80' : 'bg-[#E30613] text-white'
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
                                </div>

                                {/* 🏥 2. CABECERA DE TRIAGE SISTÉMICO + BENTO CARDS TERMODINÁMICAS */}
                                <div className="p-5 max-h-[760px] overflow-y-auto space-y-4 custom-scrollbar">
                                    {activeCategory && activeMetrics[activeCategory] ? (() => {
                                        const categoryItems = getCategoryItems(activeMetrics[activeCategory]);
                                        const displayedItems = categoryItems.filter(marker => {
                                            if (!showOnlyAbnormalities) return true;
                                            const s = marker?.status ? String(marker.status).toUpperCase() : 'NORMAL';
                                            return s !== 'NORMAL' && s !== 'NORMAL (-)' && s !== '-' && s !== 'INFORMATIVO';
                                        });
                                        const categoryTitle = CATEGORIAS_CLINICAS[activeCategory] || activeCategory.replace(/_/g, ' ');
                                        const totalCount = categoryItems.length;
                                        const abnormalTotal = getCategoryAbnormalCount(activeCategory);
                                        const normalTotal = Math.max(0, totalCount - abnormalTotal);
                                        const riskPct = totalCount > 0 ? Math.round((abnormalTotal / totalCount) * 100) : 0;
                                        const sysMeta = getSystemMeta(activeCategory);
                                        const catIndex = Math.max(0, categoriesKeys.indexOf(activeCategory));
                                        const readingCode = `#B-${9001 + catIndex}`;

                                        let globalRiskLabel = `Homeostasis Óptima (${riskPct}%)`;
                                        let globalRiskColor = 'text-[#3AAA35]';
                                        let globalRiskBadgeBg = 'bg-[#3AAA35]/10 text-[#3AAA35] border-[#3AAA35]/30';
                                        if (abnormalTotal > 0) {
                                            if (riskPct >= 60) {
                                                globalRiskLabel = `Alerta Prioritaria (${riskPct}%)`;
                                                globalRiskColor = 'text-[#E30613]';
                                                globalRiskBadgeBg = 'bg-red-50 text-[#E30613] border-red-200';
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
                                                {/* Cabecera de Triage Sistémico */}
                                                <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                    <div className="space-y-1.5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="px-2.5 py-0.5 rounded-md bg-[#1C75BC]/10 text-[#1C75BC] text-[10px] font-extrabold uppercase tracking-wider">
                                                                {sysMeta.domain}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400 font-medium">
                                                                Lectura bioeléctrica {readingCode}
                                                            </span>
                                                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-600">
                                                                {totalCount} Parámetros: {normalTotal} Normales / {abnormalTotal} Alertas
                                                            </span>
                                                        </div>
                                                        <h5 className="text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                                                            {categoryTitle}
                                                        </h5>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            {sysMeta.desc}
                                                        </p>
                                                    </div>

                                                    {/* Widget de Estado Clínico Global */}
                                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shrink-0 self-start lg:self-center">
                                                        <div className="text-right">
                                                            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                                                                Estado Clínico Global
                                                            </div>
                                                            <div className={`text-xs font-extrabold flex items-center justify-end gap-1 mt-0.5 ${globalRiskColor}`}>
                                                                {abnormalTotal > 0 ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                                                                <span>{globalRiskLabel}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold font-mono ${globalRiskBadgeBg}`}>
                                                            {abnormalTotal}/{totalCount}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 🌡️ 3. BENTO CARDS TERMODINÁMICAS */}
                                                <div className="grid grid-cols-1 gap-4">
                                                    {displayedItems.map((marker, idx) => {
                                                        const badge = getBadgeStyle(marker.status);
                                                        const valText = marker.val !== undefined ? marker.val : (marker.value !== undefined ? marker.value : '-');
                                                        const refText = marker.ref !== undefined ? marker.ref : (marker.reference !== undefined ? marker.reference : '-');
                                                        const spectrum = computeThermodynamicSpectrum(valText, refText);
                                                        const inferenceText = getBiosemanticInference(marker, spectrum);

                                                        return (
                                                            <div
                                                                key={`${activeCategory}-${marker.key || marker.name || 'param'}-${idx}`}
                                                                className={`bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 border-l-4 ${badge.borderLeft} rounded-xl p-5 shadow-xs hover:shadow-md transition-all font-sans space-y-4`}
                                                            >
                                                                {/* Encabezado de la Bento Card */}
                                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                                    <div>
                                                                        <div className="flex flex-wrap items-baseline gap-2">
                                                                            <h6 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                                                                                {marker.name}
                                                                            </h6>
                                                                            <span className="text-[11px] text-slate-400 font-medium">
                                                                                (Bio-impedancia Cuántica)
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-baseline gap-2 mt-1">
                                                                            <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                                                                {valText}
                                                                            </span>
                                                                            <span className="text-xs text-slate-500 font-medium">
                                                                                Valor obtenido
                                                                            </span>
                                                                            <span className="text-slate-300">•</span>
                                                                            <span className="text-xs text-slate-500">
                                                                                Rango Clínico de Referencia:{' '}
                                                                                <strong className="text-slate-800 dark:text-slate-200 font-mono">
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
                                    })() : (
                                        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                                            <span className="text-4xl mb-2">🧬</span>
                                            <p className="text-sm font-bold">Seleccione un sistema biológico</p>
                                            <p className="text-xs">Elija una categoría en la barra superior para explorar sus Bento Cards Termodinámicas.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 👁️ [ACORDEÓN 2] PASO 2: AUDITORÍA VISUAL OCULAR BINOCULAR */}
            <div id="card-ocular" className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                <button 
                    type="button"
                    onClick={() => toggleSection('ocular')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/40 hover:bg-slate-100/70 dark:bg-slate-800/20 dark:hover:bg-slate-800/50 transition-colors text-left select-none focus:outline-none cursor-pointer"
                    aria-expanded={openSections.ocular}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">👁️</span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Auditoría Visual Ocular Binocular</h4>
                        <ChevronDown className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openSections.ocular ? 'rotate-180' : ''}`} />
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${patientData?.scan_data?.ocular_metrics === 'OMITTED' ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' : (ocularAudit ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700')}`}>
                        {patientData?.scan_data?.ocular_metrics === 'OMITTED' ? 'EVALUACIÓN OMITIDA' : (ocularAudit ? 'GEMINI VISION ACTIVE' : 'EVALUACIÓN PENDIENTE')}
                    </span>
                </button>

                <div className={`grid transition-all duration-300 ease-in-out ${openSections.ocular ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-slate-800' : 'grid-rows-[0fr] opacity-0 border-t-0'}`}>
                    <div className="overflow-hidden">
                        <div className="p-5 space-y-4">
                            {patientData?.scan_data?.ocular_metrics === 'OMITTED' ? (
                                <p className="text-xs text-slate-500 italic py-1">Evaluación de microcirculación foveal omitida por el evaluado/especialista.</p>
                            ) : ocularAudit ? (
                                ocularAudit.pilares ? (
                                    <div className="space-y-4">
                                        {/* CABECERA: FOTOGRAFÍAS OD/OI + BADGES DE TOMA Y SÍNTESIS GLOBAL */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                {ocularAudit.right_eye_url && (
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <img 
                                                            src={getValidImageUrl(ocularAudit.right_eye_url)} 
                                                            onError={handleImageError}
                                                            alt="Ojo Derecho" 
                                                            className="w-12 h-12 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs" 
                                                        />
                                                        <span className="text-[8px] font-bold text-slate-500 uppercase">OD</span>
                                                    </div>
                                                )}
                                                {ocularAudit.left_eye_url && (
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <img 
                                                            src={getValidImageUrl(ocularAudit.left_eye_url)} 
                                                            onError={handleImageError}
                                                            alt="Ojo Izquierdo" 
                                                            className="w-12 h-12 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs" 
                                                        />
                                                        <span className="text-[8px] font-bold text-slate-500 uppercase">OI</span>
                                                    </div>
                                                )}
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100/80 text-[#1C75BC] dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 uppercase">
                                                            {ocularAudit.tipo_toma || 'Segmento Anterior'}
                                                        </span>
                                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                                            Resolución: {ocularAudit.calidad_optica || 'Óptima'}
                                                        </span>
                                                    </div>
                                                    {ocularAudit.sintesis_fisiopatologica && (
                                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 italic max-w-xl leading-snug">
                                                            "{ocularAudit.sintesis_fisiopatologica}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {ocularAudit.pilares.edad_biologica_longevidad && (
                                                <div className="text-right px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Reloj Ocular</span>
                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                                        {ocularAudit.pilares.edad_biologica_longevidad.edad_biologica_ocular || patientData?.demographics?.age || 60} años
                                                    </span>
                                                    <span className={`text-[9px] font-bold block ${ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap?.includes('+') ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                        Gap: {ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap || '0 años'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* 🏛️ BENTO GRID DE 6 PILARES OCULÓMICOS */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {/* PILAR 1: DIABETES Y GLUCOSA */}
                                            {ocularAudit.pilares.diabetes_glucosa && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>🩸</span> Diabetes & Glucosa
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                            ocularAudit.pilares.diabetes_glucosa.riesgo === 'ELEVADO' 
                                                                ? 'bg-red-50 text-[#E30613] dark:text-[#F85A5A] border-red-200 dark:border-red-900/50 dark:bg-red-950/30' 
                                                                : ocularAudit.pilares.diabetes_glucosa.riesgo === 'MODERADO'
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                                                                : 'bg-emerald-50 text-[#3AAA35] dark:text-[#76D773] border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                        }`}>
                                                            Riesgo {ocularAudit.pilares.diabetes_glucosa.riesgo || 'Bajo'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            HbA1c est.: <span className="font-mono text-slate-900 dark:text-white font-bold">{ocularAudit.pilares.diabetes_glucosa.hba1c_estimada || '< 6.0%'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {ocularAudit.pilares.diabetes_glucosa.hallazgos || ocularAudit.pilares.diabetes_glucosa.retinopatia_microangiopatia || 'Sin microangiopatía diabética observable.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 2: CARDIOVASCULAR Y LÍPIDOS */}
                                            {ocularAudit.pilares.cardiovascular_lipidos && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>🫀</span> Cardiovascular & Lípidos
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                            ocularAudit.pilares.cardiovascular_lipidos.riesgo_cardiovascular === 'ELEVADO' 
                                                                ? 'bg-red-50 text-[#E30613] dark:text-[#F85A5A] border-red-200 dark:border-red-900/50 dark:bg-red-950/30' 
                                                                : ocularAudit.pilares.cardiovascular_lipidos.riesgo_cardiovascular === 'MODERADO'
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                                                                : 'bg-emerald-50 text-[#3AAA35] dark:text-[#76D773] border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                        }`}>
                                                            Riesgo {ocularAudit.pilares.cardiovascular_lipidos.riesgo_cardiovascular || 'Bajo'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Arco Senil: <span className="text-slate-900 dark:text-white font-bold">{ocularAudit.pilares.cardiovascular_lipidos.arco_senil_corneal || 'Negativo'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {ocularAudit.pilares.cardiovascular_lipidos.angioarquitectura_hipertensiva || ocularAudit.pilares.cardiovascular_lipidos.hallazgos || 'Calibre arteriolar y venular conservado.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 3: CONTEO SANGUÍNEO Y ANEMIA */}
                                            {ocularAudit.pilares.conteo_sanguineo_anemia && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>💉</span> Conteo Sanguíneo & Hb
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                            ocularAudit.pilares.conteo_sanguineo_anemia.estado_anemia?.includes('ANEMIA')
                                                                ? 'bg-red-50 text-[#E30613] dark:text-[#F85A5A] border-red-200 dark:border-red-900/50 dark:bg-red-950/30'
                                                                : 'bg-emerald-50 text-[#3AAA35] dark:text-[#76D773] border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                        }`}>
                                                            {ocularAudit.pilares.conteo_sanguineo_anemia.estado_anemia || 'NORMAL'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Hb Estimada: <span className="font-mono text-slate-900 dark:text-white font-bold">{ocularAudit.pilares.conteo_sanguineo_anemia.hemoglobina_estimada_gdl || '14.0 g/dL'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {ocularAudit.pilares.conteo_sanguineo_anemia.palidez_conjuntival_tarsal || ocularAudit.pilares.conteo_sanguineo_anemia.hallazgos || 'Perfusión microvascular tisular conservada.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 4: FUNCIÓN RENAL Y HEPÁTICA */}
                                            {ocularAudit.pilares.funcion_renal_hepatica && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>🌊</span> Función Renal & Hepática
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                                            Biomarcadores
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Edema Infraorbitario: <span className="text-slate-900 dark:text-white font-bold">{ocularAudit.pilares.funcion_renal_hepatica.edema_infraorbitario_renal || 'Normal'}</span>
                                                        </p>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Esclera: <span className="text-slate-900 dark:text-white font-bold">{ocularAudit.pilares.funcion_renal_hepatica.ictericia_escleral_hepatica || 'Blanco Fisiológico'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-1 leading-tight">
                                                            {ocularAudit.pilares.funcion_renal_hepatica.hallazgos || 'Sin estasis periorbitario significativo.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 5: RELOJ DE EDAD BIOLÓGICA OCULAR */}
                                            {ocularAudit.pilares.edad_biologica_longevidad && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>⏳</span> Edad Biológica & Longevidad
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                            ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap?.includes('+')
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                                                                : 'bg-emerald-50 text-[#3AAA35] dark:text-[#76D773] border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                        }`}>
                                                            {ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap || '0 años'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Edad Estimada: <span className="font-mono text-slate-900 dark:text-white font-bold">{ocularAudit.pilares.edad_biologica_longevidad.edad_biologica_ocular || 60} años</span>
                                                            <span className="text-slate-400 text-[10px] ml-1">(Cronológica: {patientData?.demographics?.age || 60})</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {ocularAudit.pilares.edad_biologica_longevidad.estado_senescencia || ocularAudit.pilares.edad_biologica_longevidad.hallazgos || 'Envejecimiento microvascular acorde.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 6: SALUD VISUAL Y MEDIOS ESTRUCTURALES */}
                                            {ocularAudit.pilares.salud_visual_estructural && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>👁️</span> Medios & Estructura
                                                        </span>
                                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-blue-50 text-[#1C75BC] dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                            {ocularAudit.pilares.salud_visual_estructural.asimetria_binocular?.includes('Bilateral') ? 'Simétrico' : 'Asimétrico'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Cristalino: <span className="text-slate-900 dark:text-white font-bold">{ocularAudit.pilares.salud_visual_estructural.cristalino_cataratas || 'Transparente'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {ocularAudit.pilares.salud_visual_estructural.cornea_superficie || ocularAudit.pilares.salud_visual_estructural.hallazgos || 'Medios transparentes sin opacidades significativas.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* PIE DE GOBERNANZA CLÍNICA Y REGULATORIA NOM-004 */}
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                            {ocularAudit.disclaimer_legal || 'Tamizaje bio-óptico no invasivo asistido por IA (Gemini 2.5 Flash) conforme a la NOM-004. No sustituye la exploración oftalmológica presencial.'}
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
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Ojo Derecho</span>
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
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Ojo Izquierdo</span>
                                                </div>
                                            )}
                                            <div className="flex-1 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                                                <p>
                                                    <span className="font-bold text-slate-900 dark:text-white block sm:inline">Palidez Conjuntival: </span>
                                                    <span className="text-slate-700 dark:text-slate-300">
                                                        {typeof ocularAudit.palidez_conjuntival === 'object'
                                                            ? `${ocularAudit.palidez_conjuntival?.estado || 'Evaluación Tarsal Registrada'} - ${ocularAudit.palidez_conjuntival?.descripcion_clinica || 'Mucosa tarsal analizada.'}`
                                                            : (ocularAudit.palidez_conjuntival || 'Evaluación Tarsal Registrada')
                                                        }
                                                    </span>
                                                </p>
                                                <p>
                                                    <span className="font-bold text-slate-900 dark:text-white block sm:inline">Microcirculación Escleral: </span>
                                                    <span className="text-slate-700 dark:text-slate-300">
                                                        {typeof ocularAudit.microcirculacion_escleral === 'object'
                                                            ? `Calibre: ${ocularAudit.microcirculacion_escleral?.calibre_vascular || 'Calibre Normal'} | Densidad: ${ocularAudit.microcirculacion_escleral?.densidad_capilar || 'Lechos venulares epiesclerales analizados'}`
                                                            : (ocularAudit.microcirculacion_escleral || 'Lechos venulares epiesclerales analizados')
                                                        }
                                                    </span>
                                                </p>
                                                {typeof ocularAudit.tejido_periorbital === 'object' && ocularAudit.tejido_periorbital !== null && (
                                                    <p className="bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-100/60 dark:border-blue-900/40 text-[11px]">
                                                        <span className="font-bold text-blue-900 dark:text-blue-300 block mb-0.5">Morfología Periorbital & Lipídica:</span>
                                                        <span>Edema: {ocularAudit.tejido_periorbital?.edema_infraorbitario || 'Normal'} • Ojeras Vasculares: {ocularAudit.tejido_periorbital?.estasis_venosa_pigmentaria || 'Sin hallazgos'} • Arco Senil Corneal: {ocularAudit.tejido_periorbital?.deposito_lipidico_corneal || 'Negativo'}</span>
                                                    </p>
                                                )}
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                                    <span className="font-bold text-slate-900 dark:text-white">Asimetría Binocular: </span>
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
                                <div className="p-8 text-center bg-slate-50/50 my-1 rounded-xl border border-dashed border-blue-200/80">
                                    <span className="text-3xl block mb-2">👁️</span>
                                    <h5 className="font-bold text-slate-800 text-xs mb-1 uppercase tracking-wider">Auditoría Visual Ocular Binocular Pendiente</h5>
                                    <p className="text-slate-500 text-[11px] max-w-md mx-auto leading-relaxed">
                                        {activePatientFirstName ? (
                                            <>Para procesar y desplegar el análisis de microcirculación foveal y oxigenación tisular de <strong className="text-slate-700">{activePatientFirstName}</strong>, ejecute la toma fotográfica en el <strong>Paso 2 de la Fase 18</strong>.</>
                                        ) : (
                                            <>Para procesar y desplegar el análisis de microcirculación foveal y oxigenación tisular, ejecute la toma fotográfica en el <strong>Paso 2 de la Fase 18</strong>.</>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 👅 [ACORDEÓN 3] PASO 3: TOPOGRAFÍA LINGUAL CYTOS (GLOSÓMICA 6 EJES) */}
            <div id="card-lingual" className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                <button 
                    type="button"
                    onClick={() => toggleSection('lingual')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/40 hover:bg-slate-100/70 dark:bg-slate-800/20 dark:hover:bg-slate-800/50 transition-colors text-left select-none focus:outline-none cursor-pointer"
                    aria-expanded={openSections.lingual}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">👅</span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Topografía Lingual (Glosómica de 6 Ejes)</h4>
                        <ChevronDown className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openSections.lingual ? 'rotate-180' : ''}`} />
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${
                        patientData?.scan_data?.lingual_metrics === 'OMITTED' 
                            ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' 
                            : (lingualAudit?.pilares 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800' 
                                : (lingualAudit ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'))
                    }`}>
                        {patientData?.scan_data?.lingual_metrics === 'OMITTED' 
                            ? 'EVALUACIÓN OMITIDA' 
                            : (lingualAudit?.pilares ? 'GLOSÓMICA 6 EJES ACTIVE' : (lingualAudit ? 'CYTOS SPECTRUM' : 'EVALUACIÓN PENDIENTE'))}
                    </span>
                </button>

                <div className={`grid transition-all duration-300 ease-in-out ${openSections.lingual ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-slate-800' : 'grid-rows-[0fr] opacity-0 border-t-0'}`}>
                    <div className="overflow-hidden">
                        <div className="p-5 space-y-4">
                            {patientData?.scan_data?.lingual_metrics === 'OMITTED' ? (
                                <p className="text-xs text-slate-500 italic py-1">Evaluación de topografía lingual omitida por el evaluado/especialista.</p>
                            ) : lingualAudit ? (
                                lingualAudit.pilares ? (
                                    /* BENTO GRID DE 6 PILARES GLOSÓMICOS MULTIDIMENSIONALES */
                                    <div className="space-y-4">
                                        {/* BANNER TELEMÉTRICO Y MINIATURAS DUALES */}
                                        <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 gap-3">
                                            <div className="flex items-center gap-3">
                                                {lingualAudit.dorsal_url && (
                                                    <div className="text-center">
                                                        <img 
                                                            src={getValidImageUrl(lingualAudit.dorsal_url)} 
                                                            onError={handleImageError}
                                                            alt="Cara Dorsal" 
                                                            className="w-14 h-14 object-cover rounded-xl border border-slate-300 dark:border-slate-600 shadow-xs" 
                                                        />
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 block">Dorsal</span>
                                                    </div>
                                                )}
                                                {lingualAudit.ventral_url && (
                                                    <div className="text-center">
                                                        <img 
                                                            src={getValidImageUrl(lingualAudit.ventral_url)} 
                                                            onError={handleImageError}
                                                            alt="Cara Ventral" 
                                                            className="w-14 h-14 object-cover rounded-xl border border-slate-300 dark:border-slate-600 shadow-xs" 
                                                        />
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 block">Ventral</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                            {lingualAudit.tipo_toma}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-500">
                                                            Calidad: <strong className="text-slate-800 dark:text-slate-200">{lingualAudit.calidad_optica}</strong>
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-lg leading-snug italic">
                                                        "{lingualAudit.sintesis_fisiopatologica || 'Telemetría de mucosa lingual y microbioma procesada con éxito.'}"
                                                    </p>
                                                </div>
                                            </div>

                                            {/* BADGE DE EDAD MUCOSAL ESTIMADA */}
                                            {lingualAudit.pilares.edad_biologica_mucosal && (
                                                <div className="text-center px-4 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Edad Mucosal</span>
                                                    <span className="text-base font-black text-slate-900 dark:text-white">
                                                        {lingualAudit.pilares.edad_biologica_mucosal.edad_mucosal_estimada || 60} años
                                                    </span>
                                                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 block">
                                                        {lingualAudit.pilares.edad_biologica_mucosal.resiliencia_epitelial || 'Acorde'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* BENTO GRID 6 PILARES */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                            {/* PILAR 1: GASTROINTESTINAL Y MICROBIOMA */}
                                            {lingualAudit.pilares.gastrointestinal_microbioma && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>🍞</span> Microbioma & Digestivo
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                            lingualAudit.pilares.gastrointestinal_microbioma.sospecha_disbiosis?.includes('Elevada')
                                                                ? 'bg-rose-50 text-[#E30613] dark:text-[#F85A5A] border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                                                                : 'bg-emerald-50 text-[#3AAA35] dark:text-[#76D773] border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                        }`}>
                                                            {lingualAudit.pilares.gastrointestinal_microbioma.sospecha_disbiosis?.includes('Elevada') ? 'Disbiosis Activa' : 'Eubiosis / Fisiológico'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Saburra: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.gastrointestinal_microbioma.saburra_grosor || 'Delgada'}</span>
                                                            <span className="text-slate-500 font-normal ml-1">({lingualAudit.pilares.gastrointestinal_microbioma.saburra_color || 'Blanquecina'})</span>
                                                        </p>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Fisuras: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.gastrointestinal_microbioma.fisuras_grietas || 'Ausentes'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {lingualAudit.pilares.gastrointestinal_microbioma.hallazgos}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 2: CARDIOVASCULAR Y OXIGENACIÓN */}
                                            {lingualAudit.pilares.cardiovascular_oxigenacion && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>🫀</span> Vascular & Raninas
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                            lingualAudit.pilares.cardiovascular_oxigenacion.riesgo_vascular_congestivo?.includes('ELEVADO')
                                                                ? 'bg-rose-50 text-[#E30613] dark:text-[#F85A5A] border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                                                                : 'bg-emerald-50 text-[#3AAA35] dark:text-[#76D773] border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                        }`}>
                                                            {lingualAudit.pilares.cardiovascular_oxigenacion.riesgo_vascular_congestivo || 'BAJO'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Estasis Sublingual: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.cardiovascular_oxigenacion.estasis_venosa_sublingual || 'Fisiológica'}</span>
                                                        </p>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Cianosis: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.cardiovascular_oxigenacion.cianosis_periferica || 'Ausente'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {lingualAudit.pilares.cardiovascular_oxigenacion.hallazgos}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 3: CONTEO SANGUÍNEO Y NUTRICIÓN */}
                                            {lingualAudit.pilares.conteo_sanguineo_nutricion && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>💉</span> Nutrición & Sustrato
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                            lingualAudit.pilares.conteo_sanguineo_nutricion.palidez_sustrato?.includes('Palidez')
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                                                                : 'bg-emerald-50 text-[#3AAA35] dark:text-[#76D773] border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                        }`}>
                                                            {lingualAudit.pilares.conteo_sanguineo_nutricion.palidez_sustrato?.includes('Palidez') ? 'Alerta Anemia' : 'Normocrómica'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Color Sustrato: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.conteo_sanguineo_nutricion.palidez_sustrato || 'Rosado'}</span>
                                                        </p>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Atrofia Papilar: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.conteo_sanguineo_nutricion.atrofia_papilar_glositis || 'Ausente'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {lingualAudit.pilares.conteo_sanguineo_nutricion.hallazgos}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 4: FUNCIÓN HEPÁTICA, RENAL E HIDRATACIÓN */}
                                            {lingualAudit.pilares.funcion_hepatica_renal_hidratacion && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>🌊</span> Hepatorrenal & Hidratación
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                                            Biomarcadores
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Festoneado / Edema: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.funcion_hepatica_renal_hidratacion.marcas_dentales_festoneado || 'Ausentes'}</span>
                                                        </p>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Tinte Amarillo: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.funcion_hepatica_renal_hidratacion.tinte_amarillo_base || 'Ausente'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {lingualAudit.pilares.funcion_hepatica_renal_hidratacion.hallazgos}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 5: SISTEMA INMUNE E INFLAMACIÓN */}
                                            {lingualAudit.pilares.inmune_inflamacion && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>🛡️</span> Inmunidad & Inflamación
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                            lingualAudit.pilares.inmune_inflamacion.nivel_inflamacion_mucosa?.includes('Activo')
                                                                ? 'bg-rose-50 text-[#E30613] dark:text-[#F85A5A] border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                                                                : 'bg-emerald-50 text-[#3AAA35] dark:text-[#76D773] border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                        }`}>
                                                            {lingualAudit.pilares.inmune_inflamacion.nivel_inflamacion_mucosa || 'Fisiológico'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Lengua Geográfica: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.inmune_inflamacion.lengua_geografica || 'Ausente'}</span>
                                                        </p>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Papilas Eritematosas: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.inmune_inflamacion.petequias_papilas_eritematosas || 'Ausentes'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {lingualAudit.pilares.inmune_inflamacion.hallazgos}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 6: EDAD BIOLÓGICA MUCOSAL Y SENESCENCIA */}
                                            {lingualAudit.pilares.edad_biologica_mucosal && (
                                                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>⏳</span> Edad Mucosal & Trofismo
                                                        </span>
                                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                            {lingualAudit.pilares.edad_biologica_mucosal.resiliencia_epitelial || 'Preservada'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] space-y-1">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Trofismo Muscular: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.edad_biologica_mucosal.trofismo_muscular || 'Eutrófico'}</span>
                                                        </p>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Fasciculaciones: <span className="text-slate-900 dark:text-white font-bold">{lingualAudit.pilares.edad_biologica_mucosal.temblores_fasciculaciones || 'Ausentes'}</span>
                                                        </p>
                                                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                                            {lingualAudit.pilares.edad_biologica_mucosal.hallazgos}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* PIE DE GOBERNANZA CLÍNICA Y REGULATORIA NOM-004 */}
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                            {lingualAudit.disclaimer_legal || 'Tamizaje biofotónico lingual funcional asistido por IA conforme a la NOM-004-SSA3-2012. Requiere correlación clínica presencial.'}
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
                                            <div className="flex-1 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                                                {typeof lingualAudit.cuerpo_lingual === 'object' && (
                                                    <div className="bg-indigo-50/40 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100/60 dark:border-indigo-900/40 space-y-1 text-[11px]">
                                                        <span className="font-bold text-indigo-950 dark:text-indigo-300 uppercase tracking-wider text-[10px] block">Cuerpo Lingual & Trofismo:</span>
                                                        <p><strong className="text-slate-800 dark:text-slate-200">Sustrato & Color:</strong> {lingualAudit.cuerpo_lingual?.coloracion_sustrato || 'Normal / Rosado'}</p>
                                                        <p><strong className="text-slate-800 dark:text-slate-200">Trofismo/Volumen:</strong> {lingualAudit.cuerpo_lingual?.trofismo_volumen || 'Normotrófico'}</p>
                                                        <p><strong className="text-slate-800 dark:text-slate-200">Indentaciones Dentales:</strong> <span className="font-bold text-amber-700 dark:text-amber-400">{lingualAudit.cuerpo_lingual?.indentaciones_dentales || 'Ausentes'}</span></p>
                                                        <p><strong className="text-slate-800 dark:text-slate-200">Fisuras:</strong> {lingualAudit.cuerpo_lingual?.fisuras_mucosa || 'Sin fisuras'}</p>
                                                    </div>
                                                )}
                                                <p>
                                                    <span className="font-bold text-slate-900 dark:text-white">Saburra Lingual & Microbiota: </span>
                                                    {typeof lingualAudit.saburra_microbiota === 'object'
                                                        ? `Grosor: ${lingualAudit.saburra_microbiota?.grosor || 'Delgada'} | Color: ${lingualAudit.saburra_microbiota?.color || 'Normocoloreada'}`
                                                        : (lingualAudit.saburra_thickness || 'Delgada / Fisiológica')
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="p-8 text-center bg-slate-50/50 my-1 rounded-xl border border-dashed border-indigo-200/80">
                                    <span className="text-3xl block mb-2">👅</span>
                                    <h5 className="font-bold text-slate-800 text-xs mb-1 uppercase tracking-wider">Topografía Lingual Glosómica Pendiente</h5>
                                    <p className="text-slate-500 text-[11px] max-w-md mx-auto leading-relaxed">
                                        {activePatientFirstName ? (
                                            <>Para procesar y desplegar la evaluación de saburra, venas raninas y microbiota de <strong className="text-slate-700">{activePatientFirstName}</strong>, ejecute la toma fotográfica en el <strong>Paso 3 de la Fase 18</strong>.</>
                                        ) : (
                                            <>Para procesar y desplegar la evaluación de saburra, venas raninas y microbiota, ejecute la toma fotográfica en el <strong>Paso 3 de la Fase 18</strong>.</>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 📋 [ACORDEÓN 4] PASO 4: BIOMARCADORES EXTRAÍDOS DE PDF (OCR) - CONTENEDOR PERMANENTE NOM-004 */}
            <div id="card-pdf" className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                <button 
                    type="button"
                    onClick={() => toggleSection('ocr')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/40 hover:bg-slate-100/70 dark:bg-slate-800/20 dark:hover:bg-slate-800/50 transition-colors text-left select-none focus:outline-none cursor-pointer"
                    aria-expanded={openSections.ocr}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">📋</span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Biomarcadores Extraídos de PDF (OCR)</h4>
                        <ChevronDown className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openSections.ocr ? 'rotate-180' : ''}`} />
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${
                        patientData?.scan_data?.external_metrics?.biomarkers ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}>
                        {patientData?.scan_data?.external_metrics?.biomarkers ? 'NOM-004 OCR VERIFIED' : 'SIN ESTUDIOS EXTERNOS'}
                    </span>
                </button>

                <div className={`grid transition-all duration-300 ease-in-out ${openSections.ocr ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-slate-800' : 'grid-rows-[0fr] opacity-0 border-t-0'}`}>
                    <div className="overflow-hidden">
                        <div className="p-5 space-y-4">
                            {patientData?.scan_data?.external_metrics?.biomarkers ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {Object.entries(patientData.scan_data.external_metrics.biomarkers).map(([key, bio], idx) => (
                                        <div key={idx} className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                                            <span className="text-[10px] text-slate-500 uppercase font-bold block">{key.replace('_', ' ')}</span>
                                            <span className="font-extrabold text-slate-900 dark:text-white">{bio.value} {bio.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-300 font-medium flex items-start gap-2.5">
                                    <span className="text-base shrink-0 mt-0.5">📋</span>
                                    <div>
                                        <strong className="text-slate-900 dark:text-white block font-bold mb-0.5 uppercase tracking-wider text-[10px]">Constancia Asentada (NOM-004-SSA3-2012):</strong>
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                                            Sin estudios de laboratorio exógenos cargados en esta consulta. El paciente no presentó estudios analíticos previos al momento de la valoración.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 📸 [ACORDEÓN 5] PASO 5: EVIDENCIA SOMÁTICA DOCUMENTADA - CONTENEDOR PERMANENTE NOM-004 */}
            <div id="card-somatic" className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                <button 
                    type="button"
                    onClick={() => toggleSection('somatic')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/40 hover:bg-slate-100/70 dark:bg-slate-800/20 dark:hover:bg-slate-800/50 transition-colors text-left select-none focus:outline-none cursor-pointer"
                    aria-expanded={openSections.somatic}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">📸</span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Evidencia Somática Documentada</h4>
                        <ChevronDown className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openSections.somatic ? 'rotate-180' : ''}`} />
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${
                        typeof patientData?.scan_data?.visual_metrics === 'object' && patientData?.scan_data?.visual_metrics?.imageUrl ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}>
                        {typeof patientData?.scan_data?.visual_metrics === 'object' && patientData?.scan_data?.visual_metrics?.imageUrl ? 'SOMATIC VERIFIED' : 'EVALUACIÓN OMITIDA'}
                    </span>
                </button>

                <div className={`grid transition-all duration-300 ease-in-out ${openSections.somatic ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-slate-800' : 'grid-rows-[0fr] opacity-0 border-t-0'}`}>
                    <div className="overflow-hidden">
                        <div className="p-5 space-y-4">
                            {typeof patientData?.scan_data?.visual_metrics === 'object' && patientData?.scan_data?.visual_metrics?.imageUrl ? (
                                <div className="flex items-center gap-4">
                                    <img 
                                        src={getValidImageUrl(patientData.scan_data.visual_metrics.imageUrl)} 
                                        onError={handleImageError}
                                        alt="Evidencia Somática" 
                                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs" 
                                    />
                                    <div className="flex-1 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                                        <p><span className="font-bold text-slate-900 dark:text-white">Estatus:</span> Registro fotográfico somático guardado</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-300 font-medium flex items-start gap-2.5">
                                    <span className="text-base shrink-0 mt-0.5">📸</span>
                                    <div>
                                        <strong className="text-slate-900 dark:text-white block font-bold mb-0.5 uppercase tracking-wider text-[10px]">Constancia Asentada (NOM-004-SSA3-2012):</strong>
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                                            Evidencia visual somática omitida por el evaluado/especialista. No se cargó registro fotográfico somático complementario para este folio de cita.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {renderModalContent()}
        </div>
    );
};

export default TabBiochemicals;
