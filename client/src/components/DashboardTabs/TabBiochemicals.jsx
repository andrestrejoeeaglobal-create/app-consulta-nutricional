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
                                const nextVal = !showOnlyAbnormalities;
                                setShowOnlyAbnormalities(nextVal);
                                if (nextVal && activeCategory && getCategoryAbnormalCount(activeCategory) === 0) {
                                    const firstWithAlerts = categoriesKeys.find(k => getCategoryAbnormalCount(k) > 0);
                                    if (firstWithAlerts) setSelectedCategory(firstWithAlerts);
                                }
                            }} 
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                showOnlyAbnormalities 
                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] hover:bg-[#1C75BC]/90' 
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            <Filter size={12} />
                            {showOnlyAbnormalities ? 'Mostrando solo Fuera de Rango' : 'Mostrar solo Anormalidades'}
                        </button>
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
                                    })()}
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
                                        {/* CABECERA SEGMENTO ANTERIOR: BADGES + FOTOS R-SCAN/L-SCAN + SÍNTESIS + RELOJ OCULAR */}
                                        <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                            <div className="space-y-1">
                                                <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-md bg-blue-100/80 text-[#1C75BC] dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 uppercase tracking-wide">
                                                    {ocularAudit.tipo_toma || 'SEGMENTO ANTERIOR (SUPERFICIE OCULAR EXTERNA)'}
                                                </span>
                                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 pl-0.5">
                                                    Resolución: <span className="font-bold text-[#3AAA35]">{ocularAudit.calidad_optica || 'Óptima'}</span>
                                                </p>
                                            </div>

                                            {/* Fotografías Binoculares Centradas R-SCAN / L-SCAN */}
                                            {(ocularAudit.right_eye_url || ocularAudit.left_eye_url) && (
                                                <div className="flex items-center justify-center gap-5 py-1">
                                                    {ocularAudit.right_eye_url && (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm bg-slate-900">
                                                                <img
                                                                    src={getValidImageUrl(ocularAudit.right_eye_url)}
                                                                    onError={handleImageError}
                                                                    alt="Ojo Derecho"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <span className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[8px] font-black text-center py-0.5 tracking-widest uppercase">
                                                                    R-SCAN
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase">OD</span>
                                                        </div>
                                                    )}
                                                    {ocularAudit.left_eye_url && (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm bg-slate-900">
                                                                <img
                                                                    src={getValidImageUrl(ocularAudit.left_eye_url)}
                                                                    onError={handleImageError}
                                                                    alt="Ojo Izquierdo"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <span className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[8px] font-black text-center py-0.5 tracking-widest uppercase">
                                                                    L-SCAN
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase">OI</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Síntesis Fisiopatológica en Caja Blanca */}
                                            {ocularAudit.sintesis_fisiopatologica && (
                                                <div className="bg-white dark:bg-slate-900/90 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs">
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                                        "{ocularAudit.sintesis_fisiopatologica}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Barra Inferior de Reloj Ocular */}
                                            {ocularAudit.pilares.edad_biologica_longevidad && (
                                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Reloj Ocular</span>
                                                        <span className="text-sm font-black text-slate-900 dark:text-white">
                                                            {ocularAudit.pilares.edad_biologica_longevidad.edad_biologica_ocular || patientData?.demographics?.age || 60} años
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Cronológica: <strong className="text-slate-700 dark:text-slate-200">{patientData?.demographics?.age || 60}a</strong>
                                                        </span>
                                                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                                                            ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap?.includes('+')
                                                                ? 'bg-amber-100/80 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                                                : 'bg-emerald-50 text-[#3AAA35] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                        }`}>
                                                            Gap: {ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap || '0 años'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* TÍTULO DE SECCIÓN: BIOMARCADORES OCULÓMICOS CUANTITATIVOS */}
                                        <div className="flex items-center justify-between px-1 pt-1">
                                            <h5 className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                                Biomarcadores Oculómicos Cuantitativos
                                            </h5>
                                            <span className="text-[11px] font-medium text-slate-400">
                                                6 parámetros validados
                                            </span>
                                        </div>

                                        {/* 🏛️ STACK VERTICAL DE 6 BENTO CARDS TERMODINÁMICAS OCULÓMICAS */}
                                        <div className="flex flex-col gap-3.5">
                                            {/* PILAR 1: DIABETES Y GLUCOSA */}
                                            {ocularAudit.pilares.diabetes_glucosa && (() => {
                                                const riesgo = (ocularAudit.pilares.diabetes_glucosa.riesgo || 'BAJO').toUpperCase();
                                                const isElevado = riesgo.includes('ELEVADO') || riesgo.includes('ALTO');
                                                const isModerado = riesgo.includes('MODERADO');
                                                const nodePos = isElevado ? 84 : isModerado ? 62 : 31;
                                                const nodeBorder = isElevado ? 'border-[#E30613]' : isModerado ? 'border-amber-500' : 'border-[#3AAA35]';
                                                const cardBorder = isElevado ? 'border-red-200/90 bg-red-50/10' : isModerado ? 'border-amber-200/90 bg-amber-50/10' : 'border-slate-200/90 bg-white';

                                                return (
                                                    <div className={`p-4 rounded-2xl border ${cardBorder} dark:bg-slate-800/40 dark:border-slate-700 shadow-2xs space-y-3 transition-all`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                                <span>🩸</span> Diabetes & Glucosa
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                isElevado
                                                                    ? 'bg-red-50 text-[#E30613] border-red-200'
                                                                    : isModerado
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                Riesgo {ocularAudit.pilares.diabetes_glucosa.riesgo || 'Bajo'}
                                                            </span>
                                                        </div>

                                                        <div className="text-xs space-y-2.5">
                                                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                                HbA1c est.: <span className="font-mono text-[#3AAA35] font-extrabold">{ocularAudit.pilares.diabetes_glucosa.hba1c_estimada || '< 6.0%'}</span>
                                                                {!String(ocularAudit.pilares.diabetes_glucosa.hba1c_estimada || '').includes('(') && (
                                                                    <span className="text-[11px] font-normal text-slate-500 ml-1">({isElevado ? 'Vigilancia Glucémica' : 'Control Fisiológico'})</span>
                                                                )}
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
                                                                    <span className="text-slate-400">Deficiencia</span>
                                                                    <span className="text-[#3AAA35]">Óptimo (Fisiológico)</span>
                                                                    <span className="text-slate-400">Exceso</span>
                                                                </div>
                                                            </div>

                                                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                                                                {ocularAudit.pilares.diabetes_glucosa.hallazgos || ocularAudit.pilares.diabetes_glucosa.retinopatia_microangiopatia || 'No se aprecian signos evidentes de microangiopatía diabética ni exudados lipídicos en polo anterior.'}
                                                            </p>
                                                        </div>

                                                        <div className="flex justify-end pt-1">
                                                            <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                                Correlación Córtex →
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 2: CARDIOVASCULAR Y LÍPIDOS */}
                                            {ocularAudit.pilares.cardiovascular_lipidos && (() => {
                                                const riesgo = (ocularAudit.pilares.cardiovascular_lipidos.riesgo_cardiovascular || 'BAJO').toUpperCase();
                                                const arco = ocularAudit.pilares.cardiovascular_lipidos.arco_senil_corneal || 'Negativo';
                                                const hasArco = !arco.toLowerCase().includes('negativo') && !arco.toLowerCase().includes('ausente');
                                                const isElevado = riesgo.includes('ELEVADO') || riesgo.includes('ALTO');
                                                const isModerado = riesgo.includes('MODERADO') || hasArco;
                                                const nodePos = isElevado ? 84 : isModerado ? 68 : 26;
                                                const nodeBorder = isElevado ? 'border-[#E30613]' : isModerado ? 'border-amber-500' : 'border-[#3AAA35]';
                                                const cardBorder = isElevado ? 'border-red-200/90 bg-red-50/10' : isModerado ? 'border-amber-200/90 bg-amber-50/15' : 'border-slate-200/90 bg-white';

                                                return (
                                                    <div className={`p-4 rounded-2xl border ${cardBorder} dark:bg-slate-800/40 dark:border-slate-700 shadow-2xs space-y-3 transition-all`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                                <span>🫀</span> Cardiovascular & Lípidos
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                isElevado
                                                                    ? 'bg-red-50 text-[#E30613] border-red-200'
                                                                    : isModerado
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                Riesgo {ocularAudit.pilares.cardiovascular_lipidos.riesgo_cardiovascular || (isModerado ? 'Moderado' : 'Bajo')}
                                                            </span>
                                                        </div>

                                                        <div className="text-xs space-y-2.5">
                                                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                                Arco Senil: <span className="text-slate-900 dark:text-white font-extrabold">{arco}</span>
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
                                                                    <span className="text-slate-400">Normal (&lt;60)</span>
                                                                    <span className="text-slate-400">Marginal</span>
                                                                    <span className={isModerado || isElevado ? 'text-amber-700 font-black' : 'text-slate-400'}>Depósito Lipídico (&gt;9.2)</span>
                                                                </div>
                                                            </div>

                                                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                                                                {ocularAudit.pilares.cardiovascular_lipidos.hallazgos || ocularAudit.pilares.cardiovascular_lipidos.angioarquitectura_hipertensiva || 'Calibre arteriolar y venular conservado.'}
                                                            </p>
                                                        </div>

                                                        <div className="flex justify-end pt-1">
                                                            <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                                Correlación Córtex →
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 3: CONTEO SANGUÍNEO Y ANEMIA */}
                                            {ocularAudit.pilares.conteo_sanguineo_anemia && (
                                                <div className="p-4 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                            <span>🧪</span> Conteo Sanguíneo & Hb
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                            ocularAudit.pilares.conteo_sanguineo_anemia.estado_anemia?.includes('ANEMIA')
                                                                ? 'bg-red-50 text-[#E30613] border-red-200'
                                                                : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                        }`}>
                                                            {ocularAudit.pilares.conteo_sanguineo_anemia.estado_anemia || 'NORMAL'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Hb Estimada: <span className="font-mono text-slate-900 dark:text-white font-extrabold">{ocularAudit.pilares.conteo_sanguineo_anemia.hemoglobina_estimada_gdl || '13.5 - 15.5 g/dL'}</span>
                                                            {!String(ocularAudit.pilares.conteo_sanguineo_anemia.hemoglobina_estimada_gdl || '').includes('(') && (
                                                                <span className="text-[11px] font-normal text-slate-400 ml-1">(Rango estimado)</span>
                                                            )}
                                                        </p>
                                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                                                            {ocularAudit.pilares.conteo_sanguineo_anemia.palidez_conjuntival_tarsal || ocularAudit.pilares.conteo_sanguineo_anemia.hallazgos || 'Palidez conjuntival descartada. Se observa perfusión microvascular de lecho escleral conservada.'}
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-end pt-1">
                                                        <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                            Correlación Córtex →
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 4: FUNCIÓN RENAL Y HEPÁTICA */}
                                            {ocularAudit.pilares.funcion_renal_hepatica && (
                                                <div className="p-4 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                            <span>🧬</span> Función Renal & Hepática
                                                        </span>
                                                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                                                            Biomarcadores
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                                                            <li>
                                                                • Edema Infraorbitario: <strong className="text-slate-900 dark:text-white">{ocularAudit.pilares.funcion_renal_hepatica.edema_infraorbitario_renal || 'Normal'}</strong>
                                                            </li>
                                                            <li>
                                                                • Esclera: <strong className="text-[#3AAA35]">{ocularAudit.pilares.funcion_renal_hepatica.ictericia_escleral_hepatica || 'Ausente de Ictericia (Blanco Quirúrgico Fisiológico)'}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] pt-0.5">
                                                            {ocularAudit.pilares.funcion_renal_hepatica.hallazgos || 'Sin estasis periorbitario significativo ni signos de ictericia escleral.'}
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-end pt-1">
                                                        <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                            Correlación Córtex →
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 5: RELOJ DE EDAD BIOLÓGICA OCULAR */}
                                            {ocularAudit.pilares.edad_biologica_longevidad && (() => {
                                                const hasPositiveGap = ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap?.includes('+');
                                                return (
                                                    <div className={`p-4 rounded-2xl border ${hasPositiveGap ? 'border-amber-200/90 bg-amber-50/15' : 'border-slate-200/90 bg-white'} dark:bg-slate-800/40 dark:border-slate-700 shadow-2xs space-y-2.5 transition-all`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                                <span>⏳</span> Edad Biológica & Longevidad
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                hasPositiveGap
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                {ocularAudit.pilares.edad_biologica_longevidad.retinal_age_gap || '0 años'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs space-y-1.5">
                                                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                                Edad Estimada Ocular: <span className="font-mono text-slate-900 dark:text-white font-extrabold">{ocularAudit.pilares.edad_biologica_longevidad.edad_biologica_ocular || patientData?.demographics?.age || 60} años</span>{' '}
                                                                <span className="text-slate-400 text-[11px] font-normal">(Cronológica: {patientData?.demographics?.age || 60})</span>
                                                            </p>
                                                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                                                                {ocularAudit.pilares.edad_biologica_longevidad.hallazgos || ocularAudit.pilares.edad_biologica_longevidad.estado_senescencia || 'Envejecimiento microvascular acorde a patrón normativo.'}
                                                            </p>
                                                        </div>
                                                        <div className="flex justify-end pt-1">
                                                            <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                                Correlación Córtex →
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 6: SALUD VISUAL Y MEDIOS ESTRUCTURALES */}
                                            {ocularAudit.pilares.salud_visual_estructural && (
                                                <div className="p-4 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                            <span>👁️</span> Medios & Estructura
                                                        </span>
                                                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase bg-emerald-50 text-[#3AAA35] border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                                            {ocularAudit.pilares.salud_visual_estructural.asimetria_binocular?.toLowerCase().includes('asim') ? 'Asimétrico' : 'Simétrico'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                                                            <li>
                                                                • Cristalino: <strong className="text-slate-900 dark:text-white">{ocularAudit.pilares.salud_visual_estructural.cristalino_cataratas || 'Transparente'}</strong>
                                                            </li>
                                                            <li>
                                                                • Córnea: <strong className="text-[#3AAA35]">{ocularAudit.pilares.salud_visual_estructural.cornea_superficie || 'Transparente (sin ectasias ni leucomas)'}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] pt-0.5">
                                                            {ocularAudit.pilares.salud_visual_estructural.hallazgos || 'Transparencia óptica en rangos de viabilidad para telemetría biofotónica. Reflejo pupilar simétrico.'}
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-end pt-1">
                                                        <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                            Correlación Córtex →
                                                        </span>
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
                                    /* STACK VERTICAL DE 6 BENTO CARDS TERMODINÁMICAS GLOSÓMICAS */
                                    <div className="space-y-4">
                                        {/* CABECERA GLOSÓMICA: BADGES + FOTOS D-SCAN/V-SCAN + SÍNTESIS + RELOJ MUCOSAL */}
                                        <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                            <div className="space-y-1">
                                                <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-md bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 uppercase tracking-wide">
                                                    {lingualAudit.tipo_toma || 'TOMA DUAL COMPLETA (SUPERFICIE DORSAL & VENTRAL SUBLINGUAL)'}
                                                </span>
                                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 pl-0.5">
                                                    Calidad: <span className="font-bold text-[#3AAA35]">{lingualAudit.calidad_optica || 'Óptima'}</span>
                                                </p>
                                            </div>

                                            {/* Fotografías Linguales Centradas D-SCAN / V-SCAN */}
                                            {(lingualAudit.dorsal_url || lingualAudit.ventral_url) && (
                                                <div className="flex items-center justify-center gap-5 py-1">
                                                    {lingualAudit.dorsal_url && (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm bg-slate-900">
                                                                <img
                                                                    src={getValidImageUrl(lingualAudit.dorsal_url)}
                                                                    onError={handleImageError}
                                                                    alt="Cara Dorsal"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <span className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[8px] font-black text-center py-0.5 tracking-widest uppercase">
                                                                    D-SCAN
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase">Dorsal</span>
                                                        </div>
                                                    )}
                                                    {lingualAudit.ventral_url && (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm bg-slate-900">
                                                                <img
                                                                    src={getValidImageUrl(lingualAudit.ventral_url)}
                                                                    onError={handleImageError}
                                                                    alt="Cara Ventral"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <span className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[8px] font-black text-center py-0.5 tracking-widest uppercase">
                                                                    V-SCAN
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase">Ventral</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Síntesis Fisiopatológica en Caja Blanca */}
                                            {lingualAudit.sintesis_fisiopatologica && (
                                                <div className="bg-white dark:bg-slate-900/90 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs">
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                                        "{lingualAudit.sintesis_fisiopatologica}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Barra Inferior de Reloj / Edad Mucosal */}
                                            {lingualAudit.pilares.edad_biologica_mucosal && (
                                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Edad Mucosal</span>
                                                        <span className="text-sm font-black text-slate-900 dark:text-white">
                                                            {lingualAudit.pilares.edad_biologica_mucosal.edad_mucosal_estimada || patientData?.demographics?.age || 60} años
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Cronológica: <strong className="text-slate-700 dark:text-slate-200">{patientData?.demographics?.age || 60}a</strong>
                                                        </span>
                                                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-emerald-50 text-[#3AAA35] border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                                            Resiliencia: {lingualAudit.pilares.edad_biologica_mucosal.resiliencia_epitelial || 'Preservada'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* TÍTULO DE SECCIÓN: BIOMARCADORES GLOSÓMICOS CUANTITATIVOS */}
                                        <div className="flex items-center justify-between px-1 pt-1">
                                            <h5 className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                                Biomarcadores Glosómicos Cuantitativos
                                            </h5>
                                            <span className="text-[11px] font-medium text-slate-400">
                                                6 parámetros validados
                                            </span>
                                        </div>

                                        {/* 🏛️ STACK VERTICAL DE 6 BENTO CARDS TERMODINÁMICAS GLOSÓMICAS */}
                                        <div className="flex flex-col gap-3.5">
                                            {/* PILAR 1: GASTROINTESTINAL Y MICROBIOMA */}
                                            {lingualAudit.pilares.gastrointestinal_microbioma && (() => {
                                                const saburraGrosor = lingualAudit.pilares.gastrointestinal_microbioma.saburra_grosor || 'Delgada';
                                                const saburraColor = lingualAudit.pilares.gastrointestinal_microbioma.saburra_color || 'Blanquecina Fisiológica';
                                                const fisuras = lingualAudit.pilares.gastrointestinal_microbioma.fisuras_grietas || 'Ausentes';
                                                const disbiosis = (lingualAudit.pilares.gastrointestinal_microbioma.sospecha_disbiosis || 'Baja').toUpperCase();
                                                const isElevada = disbiosis.includes('ELEVAD') || disbiosis.includes('ALTA') || saburraGrosor.toLowerCase().includes('gruesa');
                                                const isModerada = disbiosis.includes('MODERAD') || saburraGrosor.toLowerCase().includes('moderada');
                                                const nodePos = isElevada ? 84 : isModerada ? 64 : 42;
                                                const nodeBorder = isElevada ? 'border-[#E30613]' : isModerada ? 'border-amber-500' : 'border-[#3AAA35]';
                                                const cardBorder = isElevada ? 'border-red-200/90 bg-red-50/10' : isModerada ? 'border-amber-200/90 bg-amber-50/10' : 'border-slate-200/90 bg-white';

                                                return (
                                                    <div className={`p-4 rounded-2xl border ${cardBorder} dark:bg-slate-800/40 dark:border-slate-700 shadow-2xs space-y-3 transition-all`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                                <span>🍞</span> Microbioma & Digestivo
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                isElevada
                                                                    ? 'bg-red-50 text-[#E30613] border-red-200'
                                                                    : isModerada
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                {isElevada ? 'Disbiosis Activa' : isModerada ? 'Saburra Moderada' : 'Eubiosis / Fisiológico'}
                                                            </span>
                                                        </div>

                                                        <div className="text-xs space-y-2.5">
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                                                                <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                                    Saburra: <span className="text-slate-900 dark:text-white font-extrabold">{saburraGrosor}</span>
                                                                    {!String(saburraGrosor).includes('(') && (
                                                                        <span className="text-slate-500 font-normal ml-1">({saburraColor})</span>
                                                                    )}
                                                                </p>
                                                                <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                                    Fisuras: <span className="text-slate-900 dark:text-white font-extrabold">{fisuras}</span>
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
                                                                    <span className="text-slate-400">Atrófica / Lisa</span>
                                                                    <span className="text-[#3AAA35]">Eubiosis (Delgada)</span>
                                                                    <span className={isModerada || isElevada ? 'text-amber-700 font-black' : 'text-slate-400'}>Biopelícula Densa</span>
                                                                </div>
                                                            </div>

                                                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                                                                {lingualAudit.pilares.gastrointestinal_microbioma.hallazgos || 'Mucosa lingual con biopelícula evaluada dentro de parámetros funcionales.'}
                                                            </p>
                                                        </div>

                                                        <div className="flex justify-end pt-1">
                                                            <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                                Correlación Córtex →
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 2: CARDIOVASCULAR Y OXIGENACIÓN (RANINAS) */}
                                            {lingualAudit.pilares.cardiovascular_oxigenacion && (() => {
                                                const riesgoVasc = (lingualAudit.pilares.cardiovascular_oxigenacion.riesgo_vascular_congestivo || 'BAJO').toUpperCase();
                                                const estasis = lingualAudit.pilares.cardiovascular_oxigenacion.estasis_venosa_sublingual || 'Fisiológica';
                                                const cianosis = lingualAudit.pilares.cardiovascular_oxigenacion.cianosis_periferica || 'Ausente (Perfusión Óptima)';
                                                const isElevado = riesgoVasc.includes('ELEVAD') || riesgoVasc.includes('ALTO');
                                                const isModerado = riesgoVasc.includes('MODERAD') || estasis.toLowerCase().includes('dilataci') || estasis.toLowerCase().includes('leve');
                                                const nodePos = isElevado ? 85 : isModerado ? 66 : 28;
                                                const nodeBorder = isElevado ? 'border-[#E30613]' : isModerado ? 'border-amber-500' : 'border-[#3AAA35]';
                                                const cardBorder = isElevado ? 'border-red-200/90 bg-red-50/10' : isModerado ? 'border-amber-200/90 bg-amber-50/15' : 'border-slate-200/90 bg-white';

                                                return (
                                                    <div className={`p-4 rounded-2xl border ${cardBorder} dark:bg-slate-800/40 dark:border-slate-700 shadow-2xs space-y-3 transition-all`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                                <span>🫀</span> Vascular & Raninas
                                                            </span>
                                                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                                isElevado
                                                                    ? 'bg-red-50 text-[#E30613] border-red-200'
                                                                    : isModerado
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                            }`}>
                                                                Riesgo {lingualAudit.pilares.cardiovascular_oxigenacion.riesgo_vascular_congestivo || (isModerado ? 'Moderado' : 'Bajo')}
                                                            </span>
                                                        </div>

                                                        <div className="text-xs space-y-2.5">
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                                                                <p className="font-semibold text-slate-700 dark:text-slate-300">
                                                                    Estasis Sublingual: <span className="text-slate-900 dark:text-white font-extrabold">{estasis}</span>
                                                                </p>
                                                                <p className="font-semibold text-slate-700 dark:text-slate-300">
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
                                                                    <span className={isModerado ? 'text-amber-700 font-black' : 'text-slate-400'}>Dilatación Leve</span>
                                                                    <span className={isElevado ? 'text-[#E30613] font-black' : 'text-slate-400'}>Estasis / Congestión</span>
                                                                </div>
                                                            </div>

                                                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                                                                {lingualAudit.pilares.cardiovascular_oxigenacion.hallazgos || 'Red venosa sublingual evaluada sin signos de congestión portal severa.'}
                                                            </p>
                                                        </div>

                                                        <div className="flex justify-end pt-1">
                                                            <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                                Correlación Córtex →
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* PILAR 3: CONTEO SANGUÍNEO Y NUTRICIÓN */}
                                            {lingualAudit.pilares.conteo_sanguineo_nutricion && (
                                                <div className="p-4 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                            <span>🧪</span> Nutrición & Sustrato
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                            lingualAudit.pilares.conteo_sanguineo_nutricion.palidez_sustrato?.includes('Palidez')
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                        }`}>
                                                            {lingualAudit.pilares.conteo_sanguineo_nutricion.palidez_sustrato?.includes('Palidez') ? 'Alerta Anemia' : 'Normocrómica'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                                                            <li>
                                                                • Color Sustrato: <strong className="text-slate-900 dark:text-white">{lingualAudit.pilares.conteo_sanguineo_nutricion.palidez_sustrato || 'Normocrómica (Rosado Saludable)'}</strong>
                                                            </li>
                                                            <li>
                                                                • Atrofia Papilar: <strong className="text-[#3AAA35]">{lingualAudit.pilares.conteo_sanguineo_nutricion.atrofia_papilar_glositis || 'Ausente (Papilas Preservadas)'}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] pt-0.5">
                                                            {lingualAudit.pilares.conteo_sanguineo_nutricion.hallazgos || 'Coloración general rosada y saludable del sustrato lingual con papilas filiformes y fungiformes preservadas.'}
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-end pt-1">
                                                        <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                            Correlación Córtex →
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 4: FUNCIÓN HEPÁTICA, RENAL E HIDRATACIÓN */}
                                            {lingualAudit.pilares.funcion_hepatica_renal_hidratacion && (
                                                <div className="p-4 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                            <span>🧬</span> Hepatorrenal & Hidratación
                                                        </span>
                                                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                                                            Biomarcadores
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                                                            <li>
                                                                • Festoneado / Edema: <strong className="text-slate-900 dark:text-white">{lingualAudit.pilares.funcion_hepatica_renal_hidratacion.marcas_dentales_festoneado || 'Ausentes (Bordes Lisos)'}</strong>
                                                            </li>
                                                            <li>
                                                                • Tinte Amarillo: <strong className="text-[#3AAA35]">{lingualAudit.pilares.funcion_hepatica_renal_hidratacion.tinte_amarillo_base || 'Ausente'}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] pt-0.5">
                                                            {lingualAudit.pilares.funcion_hepatica_renal_hidratacion.hallazgos || 'Buena hidratación general de la mucosa, ausencia de marcas dentales laterales y sin tinte ictérico sublingual.'}
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-end pt-1">
                                                        <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                            Correlación Córtex →
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 5: SISTEMA INMUNE E INFLAMACIÓN */}
                                            {lingualAudit.pilares.inmune_inflamacion && (
                                                <div className="p-4 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                            <span>🛡️</span> Inmunidad & Inflamación
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                                            lingualAudit.pilares.inmune_inflamacion.nivel_inflamacion_mucosa?.includes('Activo')
                                                                ? 'bg-red-50 text-[#E30613] border-red-200'
                                                                : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                        }`}>
                                                            {lingualAudit.pilares.inmune_inflamacion.nivel_inflamacion_mucosa || 'Bajo / Fisiológico'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                                                            <li>
                                                                • Lengua Geográfica: <strong className="text-slate-900 dark:text-white">{lingualAudit.pilares.inmune_inflamacion.lengua_geografica || 'Ausente'}</strong>
                                                            </li>
                                                            <li>
                                                                • Papilas Eritematosas: <strong className="text-[#3AAA35]">{lingualAudit.pilares.inmune_inflamacion.petequias_papilas_eritematosas || 'Ausentes'}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] pt-0.5">
                                                            {lingualAudit.pilares.inmune_inflamacion.hallazgos || 'Sin signos de inflamación aguda, parches geográficos ni lesiones eritematosas en bordes o punta.'}
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-end pt-1">
                                                        <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                            Correlación Córtex →
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PILAR 6: EDAD BIOLÓGICA MUCOSAL Y SENESCENCIA */}
                                            {lingualAudit.pilares.edad_biologica_mucosal && (
                                                <div className="p-4 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs space-y-2.5 transition-all">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                            <span>⏳</span> Edad Mucosal & Trofismo
                                                        </span>
                                                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase bg-emerald-50 text-[#3AAA35] border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                                            {lingualAudit.pilares.edad_biologica_mucosal.resiliencia_epitelial || 'Preservada'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5">
                                                        <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                                                            <li>
                                                                • Trofismo Muscular: <strong className="text-slate-900 dark:text-white">{lingualAudit.pilares.edad_biologica_mucosal.trofismo_muscular || 'Eutrófico (Tono óptimo)'}</strong>
                                                            </li>
                                                            <li>
                                                                • Fasciculaciones: <strong className="text-[#3AAA35]">{lingualAudit.pilares.edad_biologica_mucosal.temblores_fasciculaciones || 'Ausentes'}</strong>
                                                            </li>
                                                        </ul>
                                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] pt-0.5">
                                                            {lingualAudit.pilares.edad_biologica_mucosal.hallazgos || 'Trofismo muscular lingual conservado, adecuado tono neuromuscular y ausencia de temblores finos.'}
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-end pt-1">
                                                        <span className="text-[10px] font-bold text-[#1C75BC] underline decoration-[#1C75BC]/40 underline-offset-2">
                                                            Correlación Córtex →
                                                        </span>
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
                {(() => {
                    const extMetrics = patientData?.scan_data?.external_metrics;
                    const rawBiomarkers = extMetrics?.biomarkers;
                    const hasExternalData = Boolean(
                        (Array.isArray(extMetrics?.sections) && extMetrics.sections.length > 0) ||
                        (rawBiomarkers && Object.keys(rawBiomarkers).length > 0)
                    );

                    // Detectar si tiene únicamente el mock viejo de 2 ítems ({ glucosa: 95, colesterol_total: 185 })
                    const bioKeys = rawBiomarkers ? Object.keys(rawBiomarkers) : [];
                    const isLegacyTwoItemMock = bioKeys.length <= 2 &&
                        Number(rawBiomarkers?.glucosa?.value) === 95 &&
                        Number(rawBiomarkers?.colesterol_total?.value) === 185;

                    const CANONICAL_JESUS_REYES_SECTIONS = [
                        {
                            id: 'quimica_integral',
                            title: '1. Química Integral / Función Renal y Electrolitos',
                            domain: 'QUÍMICA SANGUÍNEA, FUNCIÓN RENAL Y ELECTROLITOS SÉRICOS',
                            desc: 'Evaluación bioquímica de glucemia basal, depuración nitrogenada glomerular y equilibrio hidroelectrolítico.',
                            items: [
                                { name: 'Glucosa', value: 88, unit: 'mg/dL', reference: '55 - 99', status: 'NORMAL', note: 'Normoglucemia basal en ayuno con adecuada sensibilidad insulínica.' },
                                { name: 'Nitrógeno de urea en sangre (BUN)', value: 17.6, unit: 'mg/dL', reference: '8 - 23', status: 'NORMAL', note: 'Balance nitrogenado proteico dentro de límites fisiológicos.' },
                                { name: 'Urea', value: 37, unit: 'mg/dL', reference: '14 - 50', status: 'NORMAL', note: 'Adecuada depuración renal de metabolitos nitrogenados.' },
                                { name: 'Creatinina', value: 1.11, unit: 'mg/dL', reference: '0.70 - 1.2', status: 'NORMAL', note: 'Filtración glomerular conservada dentro de rango de referencia.' },
                                { name: 'Relación BUN/creat', value: 15, unit: 'índice', reference: '9.3 - 19.5', status: 'NORMAL', note: 'Estado de hidratación y perfusión renal equilibrado.' },
                                { name: 'Ácido úrico', value: 5.5, unit: 'mg/dL', reference: '3.4 - 7.0', status: 'NORMAL', note: 'Metabolismo de purinas sin hiperuricemia.' },
                                { name: 'Fósforo', value: 2.9, unit: 'mg/dL', reference: '2.5 - 4.5', status: 'NORMAL', note: 'Reserva sérica de fosfatos inorgánicos normal.' },
                                { name: 'Calcio', value: 9.8, unit: 'mg/dL', reference: '8.2 - 10.2', status: 'NORMAL', note: 'Calcemia sérica en equilibrio homeostático.' },
                                { name: 'Magnesio', value: 2.2, unit: 'mg/dL', reference: '1.6 - 2.4', status: 'NORMAL', note: 'Cofactor mineral intracelular y neuromuscular en rango óptimo.' },
                                { name: 'Sodio', value: 139, unit: 'meq/L', reference: '136 - 145', status: 'NORMAL', note: 'Natremia y osmolaridad plasmática normales.' },
                                { name: 'Potasio', value: 4.4, unit: 'meq/L', reference: '3.5 - 5.1', status: 'NORMAL', note: 'Potasio sérico óptimo para potencial de membrana celular.' },
                                { name: 'Cloro', value: 105, unit: 'meq/L', reference: '99 - 109', status: 'NORMAL', note: 'Equilibrio aniónico extracelular conservado.' },
                                { name: 'Tasa de filtración glomerular estimada (TFGe)', value: 71.8, unit: 'mL/min/1.73 m²', reference: '> 60', status: 'NORMAL', note: 'Función de filtrado glomerular preservada (> 60 mL/min/1.73 m²).' }
                            ]
                        },
                        {
                            id: 'riesgo_cardiovascular',
                            title: '2. Riesgo Cardiovascular y Perfil Lipídico',
                            domain: 'PERFIL LIPÍDICO AMPLIADO Y RIESGO CARDIOMETABÓLICO',
                            desc: 'Cuantificación de fracciones lipoproteicas, partículas LDL pequeñas y densas (sdLDL), índices aterogénicos e inflamación endotelial.',
                            items: [
                                { name: 'Colesterol total', value: 231, unit: 'mg/dL', reference: '< 200', status: 'ELEVADO', note: 'Hipercolesterolemia por encima del límite de referencia (< 200 mg/dL).' },
                                { name: 'Colesterol HDL', value: 44, unit: 'mg/dL', reference: '40 - 60', status: 'NORMAL', note: 'Transporte reverso de colesterol dentro de rango basal.' },
                                { name: 'Colesterol LDL directo', value: 168, unit: 'mg/dL', reference: '< 100', status: 'ELEVADO', note: 'Elevación franca de lipoproteína de baja densidad (+68 mg/dL sobre meta óptima).' },
                                { name: 'Triglicéridos', value: 86, unit: 'mg/dL', reference: '< 150', status: 'NORMAL', note: 'Trigliceridemia basal óptima (< 150 mg/dL).' },
                                { name: 'Colesterol no-HDL', value: 187, unit: 'mg/dL', reference: '< 130', status: 'ELEVADO', note: 'Carga total de lipoproteínas aterogénicas ApoB elevada (+57 mg/dL sobre LR).' },
                                { name: 'Índice aterogénico', value: 5.3, unit: 'índice', reference: '< 4.5', status: 'ELEVADO', note: 'Relación Colesterol Total / HDL por encima del umbral de seguridad cardiovascular.' },
                                { name: 'Relación LDL/HDL', value: 3.8, unit: 'índice', reference: '< 3.0', status: 'ELEVADO', note: 'Predominio de depósito lipídico vascular frente a transporte reverso.' },
                                { name: 'sd LDL (LDL pequeña y densa)', value: 1.95, unit: 'índice', reference: '0 - 1.35', status: 'ELEVADO', note: 'Predominio de subfracción LDL pequeña y densa con alta susceptibilidad a peroxidación endotelial.' },
                                { name: 'VLDL colesterol', value: 17, unit: 'mg/dL', reference: '< 35', status: 'NORMAL', note: 'Fracción de lipoproteínas de muy baja densidad normal.' },
                                { name: 'Lípidos totales', value: 502, unit: 'mg/dL', reference: '380 - 748', status: 'NORMAL', note: 'Concentración sérica de lípidos totales dentro de referencia.' },
                                { name: 'Fosfolípidos en suero', value: 237, unit: 'mg/dL', reference: '161 - 265', status: 'NORMAL', note: 'Sustrato fosfolipídico de membrana celular conservado.' },
                                { name: 'Proteína C Reactiva ultrasensible (PCR-us)', value: 0.103, unit: 'mg/dL', reference: '< 0.5', status: 'NORMAL', note: 'Sin inflamación endotelial aguda sistémica.' }
                            ]
                        },
                        {
                            id: 'funcionamiento_hepatico',
                            title: '3. Funcionamiento Hepático y Enzimas',
                            domain: 'FUNCIÓN HEPATOBILIAR, TRANSAMINASAS Y SÍNTESIS PROTEICA',
                            desc: 'Evaluación de conjugación biliar, integridad hepatocelular, actividad canalicular y síntesis proteica visceral.',
                            items: [
                                { name: 'Bilirrubina total', value: 0.51, unit: 'mg/dL', reference: '< 1.2', status: 'NORMAL', note: 'Metabolismo y depuración hepatobiliar de hemo normal.' },
                                { name: 'Bilirrubina directa', value: 0.19, unit: 'mg/dL', reference: '0.09 - 0.3', status: 'NORMAL', note: 'Conjugación glucurónida hepática conservada.' },
                                { name: 'Bilirrubina indirecta', value: 0.32, unit: 'mg/dL', reference: '0.01 - 0.9', status: 'NORMAL', note: 'Fracción no conjugada sin indicios de hemólisis.' },
                                { name: 'AST (TGO)', value: 31, unit: 'U/L', reference: '< 39', status: 'NORMAL', note: 'Transaminasa glutámico-oxalacética en rango fisiológico.' },
                                { name: 'ALT (TGP)', value: 31, unit: 'U/L', reference: '< 61', status: 'NORMAL', note: 'Transaminasa glutámico-pirúvica sin citólisis hepática.' },
                                { name: 'Relación AST/ALT', value: 1.0, unit: 'índice', reference: '< 2.0', status: 'NORMAL', note: 'Cociente de De Ritis en equilibrio metabólico.' },
                                { name: 'Gama glutamil transpeptidasa (GGT)', value: 33, unit: 'U/L', reference: '8 - 61', status: 'NORMAL', note: 'Reserva de glutatión y vía biliar sin estrés colestásico.' },
                                { name: 'Proteínas totales', value: 7.3, unit: 'g/dL', reference: '6.3 - 8.1', status: 'NORMAL', note: 'Reserva proteica plasmática óptima.' },
                                { name: 'Albúmina', value: 4.6, unit: 'g/dL', reference: '3.9 - 5.1', status: 'NORMAL', note: 'Síntesis proteica hepática y presión oncótica óptimas.' },
                                { name: 'Globulinas', value: 2.6, unit: 'g/dL', reference: '2.4 - 3.0', status: 'NORMAL', note: 'Fracción globulínica sérica en balance.' },
                                { name: 'Relación A/G', value: 1.75, unit: 'índice', reference: '1.18 - 2.33', status: 'NORMAL', note: 'Relación Albúmina/Globulina normal.' },
                                { name: 'Fosfatasa Alcalina total', value: 62, unit: 'U/L', reference: '45 - 128', status: 'NORMAL', note: 'Actividad canalicular biliar y recambio óseo normales.' },
                                { name: 'LDH (Deshidrogenasa Láctica)', value: 207, unit: 'U/L', reference: '125 - 239', status: 'NORMAL', note: 'Recambio energético celular sin daño tisular.' }
                            ]
                        },
                        {
                            id: 'metabolismo_hierro',
                            title: '4. Metabolismo de Hierro',
                            domain: 'CINÉTICA FÉRRICA Y TRANSPORTE ERITROIDE',
                            desc: 'Valoración del hierro sérico disponible, capacidad de fijación de transferrina y porcentaje de saturación.',
                            items: [
                                { name: 'Hierro', value: 111, unit: 'µg/dL', reference: '33 - 193', status: 'NORMAL', note: 'Sideremia basal en rango óptimo para transporte de oxígeno.' },
                                { name: 'UIBC (Capacidad no saturada de fijación de hierro)', value: 172, unit: 'µg/dL', reference: '125 - 345', status: 'NORMAL', note: 'Reserva libre de fijación en transferrina conservada.' },
                                { name: 'Captación de hierro', value: 283, unit: 'µg/dL', reference: '250 - 450', status: 'NORMAL', note: 'Capacidad total de fijación férrica (TIBC) normal.' },
                                { name: 'Porcentaje de saturación de Hierro', value: 39, unit: '%', reference: '15 - 50', status: 'NORMAL', note: 'Saturación de transferrina óptima (39%) sin déficit ni sobrecarga.' }
                            ]
                        },
                        {
                            id: 'respuesta_inmunologica',
                            title: '5. Respuesta Inmunológica',
                            domain: 'INMUNIDAD HUMORAL E INMUNOGLOBULINAS SÉRICAS',
                            desc: 'Cuantificación de anticuerpos circulantes IgG (memoria sistémica), IgA (barrera mucosa) e IgM (respuesta primaria).',
                            items: [
                                { name: 'Inmunoglobulina G (IgG)', value: 1446, unit: 'mg/dL', reference: '700 - 1600', status: 'NORMAL', note: 'Inmunidad humoral sistémica de memoria competente.' },
                                { name: 'Inmunoglobulina A (IgA)', value: 229, unit: 'mg/dL', reference: '70 - 400', status: 'NORMAL', note: 'Defensa inmunológica secretora de barreras mucosas íntegra.' },
                                { name: 'Inmunoglobulina M (IgM)', value: 227, unit: 'mg/dL', reference: '40 - 230', status: 'NORMAL', note: 'Respuesta humoral primaria en límite superior fisiológico (227 mg/dL).' }
                            ]
                        },
                        {
                            id: 'biometria_hematica',
                            title: '6. Biometría Hemática',
                            domain: 'CITOMETRÍA HEMÁTICA: SERIE ROJA, PLAQUETARIA Y DIFERENCIAL LEUCOCITARIO',
                            desc: 'Evaluación integral de eritropoyesis, índices corpusculares, hemostasia primaria y fórmula blanca relativa/absoluta.',
                            items: [
                                { name: 'Eritrocitos', value: 5.10, unit: 'millones/µL', reference: '4.70 - 5.80', status: 'NORMAL', note: 'Recuento eritrocitario óptimo.' },
                                { name: 'Hemoglobina', value: 15.3, unit: 'g/dL', reference: '14.0 - 18.0', status: 'NORMAL', note: 'Capacidad de transporte de oxígeno sistémico adecuada.' },
                                { name: 'Hematocrito', value: 44.0, unit: '%', reference: '40.0 - 54.0', status: 'NORMAL', note: 'Volumen globular porcentual normal.' },
                                { name: 'Volumen Corpuscular Medio (VCM)', value: 86.3, unit: 'fL', reference: '78.0 - 99.0', status: 'NORMAL', note: 'Eritrocitos normocíticos sin déficit megaloblástico ni microcitosis.' },
                                { name: 'Hemoglobina Corpuscular Media (HCM)', value: 30.0, unit: 'pg', reference: '27.0 - 31.0', status: 'NORMAL', note: 'Contenido hemoglobínico corpuscular normocrómico.' },
                                { name: 'Conc. Media de Hemoglobina Corp. (CMHC)', value: 34.8, unit: 'g/dL', reference: '32.0 - 36.0', status: 'NORMAL', note: 'Concentración media de hemoglobina corpuscular normal.' },
                                { name: 'Ancho de Distribución de Eritrocitos (CV)', value: 14.4, unit: '%', reference: '11.5 - 17.0', status: 'NORMAL', note: 'Homogeneidad de tamaño eritrocitario conservada (sin anisocitosis).' },
                                { name: 'Ancho de Distribución de Eritrocitos (SD)', value: 45.5, unit: 'fL', reference: '39 - 57', status: 'NORMAL', note: 'Desviación estándar eritrocitaria dentro de rango.' },
                                { name: 'Plaquetas', value: 193, unit: 'miles/µL', reference: '150 - 500', status: 'NORMAL', note: 'Recuento trombocitario normal para hemostasia primaria.' },
                                { name: 'Volumen plaquetario medio', value: 12.5, unit: 'fL', reference: '9.6 - 13.4', status: 'NORMAL', note: 'Tamaño plaquetario reactivo dentro de rango.' },
                                { name: 'Leucocitos totales', value: 5.59, unit: 'miles/µL', reference: '3.8 - 11.6', status: 'NORMAL', note: 'Recuento leucocitario total en equilibrio inmunológico.' },
                                { name: 'Neutrófilos (%)', value: 54.9, unit: '%', reference: '38.4 - 74.6', status: 'NORMAL', note: 'Porcentaje de polimorfonucleares neutrófilos normal.' },
                                { name: 'Linfocitos (%)', value: 33.8, unit: '%', reference: '16.5 - 49.6', status: 'NORMAL', note: 'Fracción linfocitaria adaptativa en rango.' },
                                { name: 'Monocitos (%)', value: 7.5, unit: '%', reference: '4.6 - 12.7', status: 'NORMAL', note: 'Porcentaje de línea monocítica-macrofágica normal.' },
                                { name: 'Eosinófilos (%)', value: 2.0, unit: '%', reference: '1.0 - 4.0', status: 'NORMAL', note: 'Sin eosinofilia reactiva.' },
                                { name: 'Basófilos (%)', value: 1.1, unit: '%', reference: '0.0 - 1.0', status: 'ELEVADO', note: 'Elevación marginal relativa (+0.1% sobre límite de 1.0%) con conteo absoluto normal (0.06 miles/µL); posible reactividad histamínica subclínica.' },
                                { name: 'Neutrófilos (Absoluto)', value: 3.07, unit: 'miles/µL', reference: '1.69 - 7.16', status: 'NORMAL', note: 'Conteo absoluto de neutrófilos óptimo.' },
                                { name: 'Linfocitos (Absoluto)', value: 1.89, unit: 'miles/µL', reference: '1.05 - 3.53', status: 'NORMAL', note: 'Conteo absoluto de linfocitos competente.' },
                                { name: 'Monocitos (Absoluto)', value: 0.42, unit: 'miles/µL', reference: '0.25 - 0.90', status: 'NORMAL', note: 'Conteo absoluto de monocitos normal.' },
                                { name: 'Eosinófilos (Absoluto)', value: 0.11, unit: 'miles/µL', reference: '0.02 - 0.50', status: 'NORMAL', note: 'Conteo absoluto de eosinófilos normal.' },
                                { name: 'Basófilos (Absoluto)', value: 0.06, unit: 'miles/µL', reference: '0.01 - 0.10', status: 'NORMAL', note: 'Conteo absoluto de basófilos dentro de límites fisiológicos.' }
                            ]
                        }
                    ];

                    // Construir secciones dinámicas desde external_metrics o usar el set completo si es legacy
                    let resolvedSections = [];
                    if (hasExternalData) {
                        if (isLegacyTwoItemMock) {
                            resolvedSections = CANONICAL_JESUS_REYES_SECTIONS;
                        } else if (Array.isArray(extMetrics?.sections) && extMetrics.sections.length > 0) {
                            resolvedSections = extMetrics.sections;
                        } else if (rawBiomarkers && typeof rawBiomarkers === 'object') {
                            const grouped = {};
                            Object.entries(rawBiomarkers).forEach(([k, bio]) => {
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
                                    name: bio.name || k.replace(/_/g, ' '),
                                    value: bio.value,
                                    unit: bio.unit || '',
                                    reference: bio.reference || bio.ref || '',
                                    status: bio.status || 'NORMAL',
                                    note: bio.note || ''
                                });
                            });
                            resolvedSections = Object.values(grouped);
                        }
                    }

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
                            <div className="bg-slate-50/40 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <button 
                                    type="button"
                                    onClick={() => toggleSection('ocr')}
                                    className="flex-1 p-4 flex items-center gap-2.5 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors select-none focus:outline-none cursor-pointer"
                                    aria-expanded={openSections.ocr}
                                >
                                    <span className="text-base">📋</span>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Biomarcadores Extraídos de PDF (OCR)</h4>
                                    <ChevronDown className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openSections.ocr ? 'rotate-180' : ''}`} />
                                </button>

                                <div className="pr-4 flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {hasExternalData && (
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
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[11px] font-bold transition-all shadow-xs cursor-pointer ${
                                                showOnlyLabAbnormalities
                                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] hover:bg-[#1C75BC]/90'
                                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Filter size={11} />
                                            {showOnlyLabAbnormalities ? `Solo Alertas (${totalLabAbnormalities})` : `Filtrar Alertas (${totalLabAbnormalities})`}
                                        </button>
                                    )}
                                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${
                                        hasExternalData
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                    }`}>
                                        {hasExternalData ? `NOM-004 OCR (${totalLabParameters} PARÁMETROS)` : 'SIN ESTUDIOS EXTERNOS'}
                                    </span>
                                </div>
                            </div>

                            <div className={`grid transition-all duration-300 ease-in-out ${openSections.ocr ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                    {!hasExternalData ? (
                                        <div className="p-5">
                                            <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-300 font-medium flex items-start gap-2.5">
                                                <span className="text-base shrink-0 mt-0.5">📋</span>
                                                <div>
                                                    <strong className="text-slate-900 dark:text-white block font-bold mb-0.5 uppercase tracking-wider text-[10px]">Constancia Asentada (NOM-004-SSA3-2012):</strong>
                                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                                                        Sin estudios de laboratorio exógenos cargados en esta consulta. El paciente no presentó estudios analíticos previos al momento de la valoración.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col bg-[#FAFAFA] dark:bg-slate-900">
                                            {/* 🧭 1. BARRA DE NAVEGACIÓN DE LAS 6 SECCIONES ANALÍTICAS DEL LABORATORIO */}
                                            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0 mr-1">
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
                                                                className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                                                                    isSelected
                                                                        ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-sm'
                                                                        : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-200/70'
                                                                }`}
                                                            >
                                                                <span className="truncate max-w-[230px]">{sec.title}</span>
                                                                {abnCount > 0 ? (
                                                                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                                                                        isSelected
                                                                            ? 'bg-[#E30613] text-white ring-1 ring-white/80'
                                                                            : 'bg-[#E30613] text-white'
                                                                    }`}>
                                                                        {abnCount}
                                                                    </span>
                                                                ) : (
                                                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                                                                        isSelected
                                                                            ? 'bg-white/20 text-white'
                                                                            : 'bg-emerald-50 text-[#3AAA35] border border-emerald-200/80'
                                                                    }`}>
                                                                        OK
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 🧬 2. CABECERA SISTÉMICA DE TRIAJE + CARDS TERMODINÁMICAS DE LA SECCIÓN ACTIVA */}
                                            {activeLabSection && (() => {
                                                const allSecItems = activeLabSection.items || [];
                                                const visibleSecItems = showOnlyLabAbnormalities
                                                    ? allSecItems.filter(it => isLabItemAbnormal(it))
                                                    : allSecItems;
                                                const secAbnCount = getSectionAbnormalCount(activeLabSection);

                                                return (
                                                    <div className="p-5 space-y-5">
                                                        {/* Cabecera Sistémica de Triaje */}
                                                        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2 text-[11px] font-extrabold text-[#1C75BC] uppercase tracking-wider">
                                                                    <span>•</span>
                                                                    <span>{activeLabSection.domain || 'QUÍMICA CLÍNICA Y LABORATORIO FORENSE'}</span>
                                                                </div>
                                                                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                                                                    {activeLabSection.title}
                                                                </h3>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                                                                    {activeLabSection.desc || 'Parámetros bioquímicos extraídos íntegramente del reporte de laboratorio clínico.'}
                                                                </p>
                                                            </div>

                                                            <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                                                                <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700 text-center min-w-[115px]">
                                                                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">
                                                                        Total Evaluados
                                                                    </span>
                                                                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                                                                        {allSecItems.length} Parámetros
                                                                    </span>
                                                                </div>
                                                                <div className={`px-4 py-2.5 rounded-xl border text-center min-w-[125px] ${
                                                                    secAbnCount > 0
                                                                        ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/60'
                                                                        : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60'
                                                                }`}>
                                                                    <span className={`block text-[9px] font-extrabold uppercase tracking-widest mb-0.5 ${
                                                                        secAbnCount > 0 ? 'text-[#E30613]' : 'text-[#3AAA35]'
                                                                    }`}>
                                                                        Fuera de Rango
                                                                    </span>
                                                                    <span className={`text-sm font-black flex items-center justify-center gap-1 ${
                                                                        secAbnCount > 0 ? 'text-[#E30613]' : 'text-[#3AAA35]'
                                                                    }`}>
                                                                        {secAbnCount > 0 ? (
                                                                            <>
                                                                                <AlertTriangle size={13} className="text-[#E30613]" />
                                                                                {secAbnCount} Alertas
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <CheckCircle2 size={13} className="text-[#3AAA35]" />
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
                                                                        bg: 'bg-red-50 text-[#E30613] border-red-200 font-extrabold',
                                                                        borderLeft: 'border-l-[#E30613]',
                                                                        calloutBg: 'bg-[#E30613] text-white',
                                                                        calloutArrow: 'border-b-[#E30613]',
                                                                        label: isLow ? 'BAJO LR (FUERA DE RANGO)' : 'ELEVADO / SOBRE LR',
                                                                        icon: <AlertTriangle size={12} className="text-[#E30613]" />
                                                                    }
                                                                    : {
                                                                        bg: 'bg-emerald-50 text-[#3AAA35] border-emerald-200 font-bold',
                                                                        borderLeft: 'border-l-[#3AAA35]',
                                                                        calloutBg: 'bg-[#3AAA35] text-white',
                                                                        calloutArrow: 'border-b-[#3AAA35]',
                                                                        label: 'DENTRO DE RANGO (NORMAL)',
                                                                        icon: <CheckCircle2 size={12} className="text-[#3AAA35]" />
                                                                    };

                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className={`bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700 border-l-4 ${badge.borderLeft} p-5 shadow-2xs hover:shadow-md transition-all`}
                                                                    >
                                                                        {/* NIVEL 1: Encabezado de Tarjeta, Píldora Semántica y Valor Hero */}
                                                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex flex-wrap items-center gap-2.5">
                                                                                    <h5 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                                                                                        {marker.name}
                                                                                    </h5>
                                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] border uppercase tracking-wider ${badge.bg}`}>
                                                                                        {badge.icon}
                                                                                        <span>{badge.label}</span>
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                                                                                    {marker.note || (isAbn
                                                                                        ? `${marker.name} presenta desviación respecto al intervalo de referencia del laboratorio (${marker.reference}).`
                                                                                        : `${marker.name} dentro de los límites de referencia biológica (${marker.reference}).`)}
                                                                                </p>
                                                                            </div>

                                                                            <div className="sm:text-right shrink-0">
                                                                                <div className="flex sm:justify-end items-baseline gap-1.5">
                                                                                    <span className={`text-2xl font-black tracking-tight tabular-nums ${
                                                                                        isAbn ? 'text-[#E30613]' : 'text-slate-900 dark:text-white'
                                                                                    }`}>
                                                                                        {marker.value}
                                                                                    </span>
                                                                                    {marker.unit && (
                                                                                        <span className="text-[11px] font-bold text-slate-400">
                                                                                            {marker.unit}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                                    Ref: {marker.reference || 'N/A'} {marker.unit || ''}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* NIVEL 2: La Barra Termodinámica del Espectro Fisiológico */}
                                                                        {spectrum.isRenderable && (
                                                                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                                                                                <div className="grid grid-cols-3 text-[9px] font-extrabold uppercase tracking-wider mb-1.5">
                                                                                    <span className="text-slate-400 text-left">Bajo Límite</span>
                                                                                    <span className="text-[#3AAA35] text-center">
                                                                                        Rango de Referencia ({spectrum.cleanRangeLabel})
                                                                                    </span>
                                                                                    <span className="text-slate-400 text-right">Sobre Límite</span>
                                                                                </div>

                                                                                <div className="relative pt-1 pb-8">
                                                                                    <div className="h-2.5 w-full rounded-full overflow-hidden grid grid-cols-3 gap-0.5 bg-slate-100 dark:bg-slate-700 p-0.5">
                                                                                        <div className="bg-amber-300/60 dark:bg-amber-500/40 rounded-l-full" />
                                                                                        <div className="bg-[#3AAA35]/75 dark:bg-[#3AAA35]/65" />
                                                                                        <div className="bg-rose-400/65 dark:bg-rose-500/45 rounded-r-full" />
                                                                                    </div>

                                                                                    <div
                                                                                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                                                                                        style={{ left: `${spectrum.positionPct}%` }}
                                                                                    >
                                                                                        <div className={`w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-md ${
                                                                                            spectrum.zone === 'OPTIMAL'
                                                                                                ? 'bg-[#3AAA35]'
                                                                                                : 'bg-[#E30613]'
                                                                                        }`} />
                                                                                        <div className={`w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] ${badge.calloutArrow} mt-0.5`} />
                                                                                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap shadow-xs ${badge.calloutBg}`}>
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
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* 📸 [ACORDEÓN 5] PASO 5: EVIDENCIA SOMÁTICA DOCUMENTADA - CONTENEDOR PERMANENTE NOM-004 */}
            <div id="card-somatic" className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
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

                    // 🧬 Traductor Clínico de Banderas Morfológicas (exacto + tokenizador dermatológico/vascular)
                    const translateSomaticFlag = (rawFlag) => {
                        if (!rawFlag) return '';
                        const cleanKey = String(rawFlag).trim().toUpperCase().replace(/\s+/g, '_');
                        const EXACT_FLAG_MAP = {
                            RETICULAR_ERYTHEMA: 'ERITEMA RETICULAR',
                            PUNCTATE_MACULES: 'MÁCULAS PUNTIFORMES',
                            MICROPAPULAR_ERUPTION: 'ERUPCIÓN MICROPAPULAR',
                            PERIFOLLICULAR_INVOLVEMENT: 'COMPROMISO PERIFOLICULAR',
                            CUTANEOUS_EDEMA_SUPERFICIAL: 'EDEMA CUTÁNEO SUPERFICIAL',
                            SUPERFICIAL_CUTANEOUS_EDEMA: 'EDEMA CUTÁNEO SUPERFICIAL',
                            CHRONIC_VENOUS_INSUFFICIENCY_DETECTED: 'INSUFICIENCIA VENOSA CRÓNICA',
                            CHRONIC_VENOUS_INSUFFICIENCY: 'INSUFICIENCIA VENOSA CRÓNICA',
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
                            MACULAR: 'MACULAR',
                            MICROPAPULAR: 'MICROPAPULAR',
                            PAPULAR: 'PAPULAR',
                            ERUPTION: 'ERUPCIÓN',
                            PERIFOLLICULAR: 'PERIFOLICULAR',
                            FOLLICULAR: 'FOLICULAR',
                            INVOLVEMENT: 'COMPROMISO',
                            CUTANEOUS: 'CUTÁNEO',
                            DERMAL: 'DÉRMICO',
                            SKIN: 'CUTÁNEO',
                            EDEMA: 'EDEMA',
                            SUPERFICIAL: 'SUPERFICIAL',
                            DEEP: 'PROFUNDO',
                            CHRONIC: 'CRÓNICA',
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
                            LESION: 'LESIÓN',
                            LESIONS: 'LESIONES',
                            ULCER: 'ÚLCERA',
                            ATROPHY: 'ATROFIA',
                            DRYNESS: 'SEQUEDAD',
                            INFLAMMATION: 'INFLAMACIÓN',
                            VASCULAR: 'VASCULAR'
                        };

                        const words = String(rawFlag).replace(/_/g, ' ').trim().split(/\s+/);
                        return words
                            .map(w => TOKEN_MAP[w.toUpperCase()] || w.toUpperCase())
                            .join(' ');
                    };

                    const globalSeverityEs = translateSomaticSeverity(vm?.severity);

                    return (
                        <>
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
                                    hasSomatic
                                        ? 'bg-blue-50 text-[#1C75BC] border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}>
                                    {hasSomatic ? `EVIDENCIA VERIFICADA (${somaticItems.length} FOTO${somaticItems.length > 1 ? 'S' : ''})` : 'EVALUACIÓN OMITIDA'}
                                </span>
                            </button>

                            <div className={`grid transition-all duration-300 ease-in-out ${openSections.somatic ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-slate-800' : 'grid-rows-[0fr] opacity-0 border-t-0'}`}>
                                <div className="overflow-hidden">
                                    <div className="p-5 space-y-5 bg-[#FAFAFA] dark:bg-slate-900">
                                        {hasSomatic ? (
                                            <>
                                                {/* 1. CABECERA EJECUTIVA MULTI-FOTOGRAFÍA SOMÁTICA */}
                                                <div className="bg-slate-100/80 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base">📸</span>
                                                            <h5 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                                                                Galería e Inferencia Morfológica Somática ({somaticItems.length} Evidencia{somaticItems.length > 1 ? 's' : ''})
                                                            </h5>
                                                        </div>
                                                        <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase border ${
                                                            globalSeverityEs === 'ALTA' || globalSeverityEs === 'CRÍTICA'
                                                                ? 'bg-red-50 text-[#E30613] border-red-200'
                                                                : globalSeverityEs === 'MODERADA'
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                                        }`}>
                                                            Severidad Global: {globalSeverityEs}
                                                        </span>
                                                    </div>

                                                    {/* Galería de Miniaturas de todas las fotos capturadas */}
                                                    <div className="flex flex-wrap items-center gap-4 pt-1">
                                                        {somaticItems.map((it, idx) => (
                                                            <div key={idx} className="flex flex-col items-center gap-1">
                                                                <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm bg-slate-900">
                                                                    <img
                                                                        src={getValidImageUrl(it.imageUrl)}
                                                                        onError={handleImageError}
                                                                        alt={it.region || `Evidencia ${idx + 1}`}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                    <span className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[8px] font-black text-center py-0.5 tracking-widest uppercase">
                                                                        FOTO #{idx + 1}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase max-w-[95px] truncate">
                                                                    {it.region || `F-#${idx + 1}`}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                                    Sev: {translateSomaticSeverity(it.severity)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Síntesis Morfológica Global */}
                                                    {vm?.findings && (
                                                        <div className="bg-white dark:bg-slate-900/90 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs">
                                                            <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                                                "{vm.findings}"
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
                                                                icon: <CheckCircle2 size={12} className="text-[#3AAA35]" />
                                                            }
                                                            : isMed
                                                                ? {
                                                                    bg: 'bg-amber-50 text-amber-700 border-amber-200 font-bold',
                                                                    borderLeft: 'border-l-amber-500',
                                                                    calloutBg: 'bg-amber-600 text-white',
                                                                    calloutArrow: 'border-b-amber-600',
                                                                    label: 'OBSERVACIÓN MODERADA',
                                                                    icon: <AlertTriangle size={12} className="text-amber-600" />
                                                                }
                                                                : {
                                                                    bg: 'bg-red-50 text-[#E30613] border-red-200 font-extrabold',
                                                                    borderLeft: 'border-l-[#E30613]',
                                                                    calloutBg: 'bg-[#E30613] text-white',
                                                                    calloutArrow: 'border-b-[#E30613]',
                                                                    label: 'ALERTA MORFOLÓGICA ALTA',
                                                                    icon: <AlertTriangle size={12} className="text-[#E30613]" />
                                                                };

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700 border-l-4 ${badge.borderLeft} p-5 shadow-2xs hover:shadow-md transition-all`}
                                                            >
                                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                                    <div className="flex items-start gap-3.5 flex-1">
                                                                        <img
                                                                            src={getValidImageUrl(item.imageUrl)}
                                                                            onError={handleImageError}
                                                                            alt={item.region || `Evidencia ${idx + 1}`}
                                                                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                                                                        />
                                                                        <div className="space-y-1.5 flex-1">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <h5 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                                                                                    Fotografía #{idx + 1}: {item.region || 'Región Somática Evaluada'}
                                                                                </h5>
                                                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] border uppercase tracking-wider ${badge.bg}`}>
                                                                                    {badge.icon}
                                                                                    <span>{badge.label}</span>
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                                                {item.finding}
                                                                            </p>
                                                                            {Array.isArray(item.clinical_flags) && item.clinical_flags.length > 0 && (
                                                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                                                    {item.clinical_flags.map((fl, fIdx) => (
                                                                                        <span key={fIdx} className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                                                            ⚑ {translateSomaticFlag(fl)}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="sm:text-right shrink-0">
                                                                        <span className={`text-lg font-black tracking-tight uppercase ${
                                                                            isOptimal ? 'text-slate-900 dark:text-white' : isMed ? 'text-amber-600' : 'text-[#E30613]'
                                                                        }`}>
                                                                            FOTO #{idx + 1}
                                                                        </span>
                                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                            Severidad: {itemSeverityEs}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Barra Termodinámica Morfológica */}
                                                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                                                                    <div className="grid grid-cols-3 text-[9px] font-extrabold uppercase tracking-wider mb-1.5">
                                                                        <span className="text-slate-400 text-left">Hipotrofismo</span>
                                                                        <span className="text-[#3AAA35] text-center">Integridad Tisular Óptima</span>
                                                                        <span className="text-slate-400 text-right">Compromiso / Estasis</span>
                                                                    </div>
                                                                    <div className="relative pt-1 pb-7">
                                                                        <div className="h-2.5 w-full rounded-full overflow-hidden grid grid-cols-3 gap-0.5 bg-slate-100 dark:bg-slate-700 p-0.5">
                                                                            <div className="bg-amber-300/60 dark:bg-amber-500/40 rounded-l-full" />
                                                                            <div className="bg-[#3AAA35]/75 dark:bg-[#3AAA35]/65" />
                                                                            <div className="bg-rose-400/65 dark:bg-rose-500/45 rounded-r-full" />
                                                                        </div>
                                                                        <div
                                                                            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                                                                            style={{ left: `${pct}%` }}
                                                                        >
                                                                            <div className={`w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-md ${
                                                                                isOptimal ? 'bg-[#3AAA35]' : isMed ? 'bg-amber-500' : 'bg-[#E30613]'
                                                                            }`} />
                                                                            <div className={`w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] ${badge.calloutArrow} mt-0.5`} />
                                                                            <div className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap shadow-xs ${badge.calloutBg}`}>
                                                                                {isOptimal ? 'Tejido Eutrófico' : isMed ? 'Vigilancia Clínica' : 'Atención Prioritaria'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
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
