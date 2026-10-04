import React, { useState, useEffect } from 'react';
import { FlaskConical, AlertTriangle, Filter, CheckCircle2, ChevronDown } from 'lucide-react';
import parsedResults from '../../data/parsed_results.json';
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
    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
};

export const TabBiochemicals = ({
    isProcessing,
    displayData,
    handleFileUpload,
    selectedFileToView,
    setSelectedFileToView,
    processedDocs,
    analyzeStatus,
    patientData
}) => {

    // ⚙️ Estado Reactivo de Acordeones (Fase 18)
    const [openSections, setOpenSections] = useState({
        electret: true,   // Paso 1: Abierto por defecto
        ocular: true,     // Paso 2: Abierto por defecto
        lingual: true,    // Paso 3: Abierto por defecto
        ocr: false,       // Paso 4: Colapsado por defecto si no hay PDF
        somatic: false    // Paso 5: Colapsado por defecto si fue omitido
    });

    // 🔒 Sincronización del Ciclo de Vida y Rehidratación Asíncrona
    useEffect(() => {
        if (patientData?.scan_data) {
            const hasRealOcr = Boolean(
                patientData?.scan_data?.external_metrics?.biomarkers && 
                Object.keys(patientData.scan_data.external_metrics.biomarkers).length > 0
            );
            const hasRealSomatic = Boolean(
                typeof patientData?.scan_data?.visual_metrics === 'object' && 
                patientData?.scan_data?.visual_metrics?.imageUrl
            );
            setOpenSections(prev => ({
                ...prev,
                ocr: hasRealOcr,
                somatic: hasRealSomatic
            }));
        }
    }, [patientData?.scan_data]);

    const toggleSection = (sectionKey) => {
        setOpenSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    const areAllOpen = Object.values(openSections).every(Boolean);

    const toggleAllSections = () => {
        const nextState = !areAllOpen;
        setOpenSections({
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

    const isScanned = patientData?.scan_data?.electret_scanned || genomeTelemetry?.isScanned;
    const electretMetrics = isScanned ? (patientData?.scan_data?.electret_metrics || genomeTelemetry?.categories) : null;

    // Sanitización estricta NOM-004 de electretMetrics contra contaminación de expediente
    const activePatientFirstName = (patientData?.profile?.name || patientData?.identificacion?.nombre || '').trim().toLowerCase().split(' ')[0];
    
    const isElectretValidForCurrentPatient = React.useMemo(() => {
        if (!electretMetrics) return false;
        const jsonStr = JSON.stringify(electretMetrics).toLowerCase();
        if (jsonStr.includes('nombre:')) {
            if (activePatientFirstName && !jsonStr.includes(activePatientFirstName)) {
                console.warn(`🛡️ NOM-004: Descartando electretMetrics de folio previo que no corresponden a ${activePatientFirstName}`);
                return false;
            }
        }
        return true;
    }, [electretMetrics, activePatientFirstName]);

    const validElectretMetrics = isElectretValidForCurrentPatient ? electretMetrics : null;

    const genomeTelemetry = useClinicalGenome(state => state.electretTelemetry);

    // INYECCIÓN ANTIGRAVITY: Rehidratación de estado global (Prevención de Amnesia F5)
    React.useEffect(() => {
        if (validElectretMetrics && !genomeTelemetry?.isScanned) {
            useClinicalGenome.getState().setElectretTelemetry({
                categories: validElectretMetrics,
                patientName: activePatientFirstName,
                isScanned: true
            });
        }
    }, [validElectretMetrics, genomeTelemetry?.isScanned, activePatientFirstName]);

    // INYECCIÓN ANTIGRAVITY: Actualización de SSOT y renderizado optimizado
    const activeMetrics = React.useMemo(() => {
        let rawSource = null;
        
        // 1. SSOT: Zustand manda si el escaneo está validado
        if (genomeTelemetry?.isScanned && Object.keys(genomeTelemetry.categories || {}).length > 0) {
            rawSource = genomeTelemetry.categories;
        } 
        // 2. Respaldo local
        else if (validElectretMetrics) {
            rawSource = validElectretMetrics;
        }

        if (!rawSource) return {};
        
        // 3. Procesamiento protegido por el cortocircuito del parser
        const parsed = parseElectretData(rawSource);
        return parsed?.categories || rawSource;
    }, [validElectretMetrics, genomeTelemetry]);

    const categoriesKeys = Object.keys(activeMetrics);
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
        ndice_de_crecimiento_seo: "Índice de Crecimiento Óseo",
        blood_glucose: "Glucosa en la Sangre",
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
        prostate: "Próstata",
        male_sexual: "Función Sexual Masculina",
        sperm_semen: "Esperma y Semen",
        body_composition: "Análisis Componencial Corporal",
        informe_de_anlisis_de_expertos: "Informe de Análisis de Expertos",
        informe_de_anlisis_de_la_mano: "Informe de Análisis de la Mano"
    };

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
                label: "Informativo / Métrica Base",
                icon: <span className="text-slate-400 text-xs">📊</span>
            };
        }
        const s = status.toUpperCase().trim();
        if (s.includes('SEVERO') || s === 'CRITICAL' || s === '+++') {
            return {
                bg: "bg-red-50 text-red-700 border-red-200 font-extrabold",
                label: "Anormal Severo (+++)",
                icon: <AlertTriangle size={12} className="text-red-500 animate-pulse" />
            };
        } else if (s.includes('MODERADO') || s === 'WARNING' || s === '++') {
            return {
                bg: "bg-orange-50 text-orange-700 border-orange-200 font-bold",
                label: "Anormal Moderado (++)",
                icon: <AlertTriangle size={12} className="text-orange-500" />
            };
        } else if (s.includes('LEVE') || s === '+') {
            return {
                bg: "bg-amber-50 text-amber-700 border-amber-200",
                label: "Anormal Leve (+)",
                icon: <span className="text-amber-500 text-xs">⚠️</span>
            };
        } else if (s.includes('NORMAL') || s === '-') {
            return {
                bg: "bg-green-50 text-green-700 border-green-200",
                label: "Normal (-)",
                icon: <CheckCircle2 size={12} className="text-green-500" />
            };
        }
        return {
            bg: "bg-slate-100 text-slate-700 border-slate-200",
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
        const base = rawOcular.ocular_audit || rawOcular;
        return {
            right_eye_url: rawOcular?.right_eye_url || base.right_eye_url || base.rightEyeUrl || null,
            left_eye_url: rawOcular?.left_eye_url || base.left_eye_url || base.leftEyeUrl || null,
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

    const lingualTopography = React.useMemo(() => {
        if (!rawLingual || rawLingual === 'OMITTED' || typeof rawLingual !== 'object') return null;
        const base = rawLingual.lingual_topography || rawLingual;
        return {
            imageUrl: rawLingual?.imageUrl || base.imageUrl || base.image_url || null,
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
                                <h4 className="font-bold text-slate-800 text-sm mb-1">
                                    Escáner Bioeléctrico y Biorresonancia (Electret) Pendiente
                                </h4>
                                <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
                                    {activePatientFirstName ? (
                                        <>Para procesar y desplegar la telemetría en tiempo real de <strong className="text-slate-700">{patientData?.profile?.name || patientData?.identificacion?.nombre || 'Paciente Activo'}</strong>, inicie la toma de bioseñales presionando el botón <strong>"⚡ Iniciar Escaneo Electret"</strong> en la <strong>Fase 18</strong> del panel izquierdo.</>
                                    ) : (
                                        <>Para procesar y desplegar la telemetría en tiempo real, inicie la toma de bioseñales presionando el botón <strong>"⚡ Iniciar Escaneo Electret"</strong> en la <strong>Fase 18</strong> del panel izquierdo.</>
                                    )}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col md:flex-row h-[750px] divide-y md:divide-y-0 md:divide-x divide-slate-150">
                                {/* Sidebar Left: Categories */}
                                <div className="w-full md:w-1/3 overflow-y-auto p-3 bg-slate-50 space-y-1 custom-scrollbar">
                                    {categoriesKeys.map(catKey => {
                                        const title = CATEGORIAS_CLINICAS[catKey] || catKey.replace(/_/g, ' ');
                                        const abnormalCount = getCategoryAbnormalCount(catKey);
                                        const isSelected = catKey === activeCategory;
                                        
                                        return (
                                            <button
                                                key={catKey}
                                                type="button"
                                                onClick={() => setSelectedCategory(catKey)}
                                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                                                    isSelected 
                                                        ? 'bg-[#1C75BC]/10 text-[#1C75BC] shadow-sm border-l-4 border-[#1C75BC]' 
                                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-l-4 border-transparent'
                                                }`}
                                            >
                                                <span className="truncate">{title}</span>
                                                {abnormalCount > 0 && (
                                                    <span className="bg-[#E30613] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-sm ml-2 shrink-0">
                                                        {abnormalCount}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Content Right: Parameters list */}
                                <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                                    {activeCategory && activeMetrics[activeCategory] ? (() => {
                                        const categoryItems = getCategoryItems(activeMetrics[activeCategory]);
                                        const displayedItems = categoryItems.filter(marker => {
                                            if (!showOnlyAbnormalities) return true;
                                            const s = marker?.status ? String(marker.status).toUpperCase() : 'NORMAL';
                                            return s !== 'NORMAL' && s !== 'NORMAL (-)' && s !== '-' && s !== 'INFORMATIVO';
                                        });
                                        const categoryTitle = CATEGORIAS_CLINICAS[activeCategory] || activeCategory.replace(/_/g, ' ');

                                        return (
                                            <div className="space-y-4">
                                                <h5 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center justify-between uppercase tracking-wide">
                                                    <span>{categoryTitle}</span>
                                                    <span className="text-xs text-slate-400 font-medium font-mono">{categoryItems.length} Parámetros</span>
                                                </h5>
                                                
                                                <div className="grid grid-cols-1 gap-3">
                                                    {displayedItems.map((marker, idx) => {
                                                        const badge = getBadgeStyle(marker.status);
                                                        const valText = marker.val !== undefined ? marker.val : (marker.value !== undefined ? marker.value : '-');
                                                        const refText = marker.ref !== undefined ? marker.ref : (marker.reference !== undefined ? marker.reference : '-');
                                                        return (
                                                            <div key={marker.name || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#1C75BC]/40 transition-colors font-sans">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-xs font-bold text-slate-700">{marker.name}</span>
                                                                    </div>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="text-base font-extrabold text-slate-900">{valText}</span>
                                                                        <span className="text-[10px] text-slate-400 font-mono">Ref: {refText}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 self-start md:self-center">
                                                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${badge.bg}`}>
                                                                        {badge.icon}
                                                                        {badge.label}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {showOnlyAbnormalities && displayedItems.length === 0 && (
                                                        <div className="py-12 text-center text-slate-400">
                                                            <CheckCircle2 size={36} className="text-[#3AAA35] mx-auto mb-2 opacity-80" />
                                                            <p className="text-sm font-bold text-slate-500">¡Perfecto estado metabólico en esta área!</p>
                                                            <p className="text-xs">Todos los parámetros se encuentran dentro del rango fisiológico normal.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })() : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                            <span className="text-4xl mb-2">🧬</span>
                                            <p className="text-sm font-bold">Seleccione un sistema biológico</p>
                                            <p className="text-xs">Elija una categoría de la columna izquierda para explorar la telemetría.</p>
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

            {/* 👅 [ACORDEÓN 3] PASO 3: TOPOGRAFÍA LINGUAL CYTOS */}
            <div id="card-lingual" className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden font-sans">
                <button 
                    type="button"
                    onClick={() => toggleSection('lingual')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/40 hover:bg-slate-100/70 dark:bg-slate-800/20 dark:hover:bg-slate-800/50 transition-colors text-left select-none focus:outline-none cursor-pointer"
                    aria-expanded={openSections.lingual}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">👅</span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Topografía Lingual CYTOS</h4>
                        <ChevronDown className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openSections.lingual ? 'rotate-180' : ''}`} />
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${patientData?.scan_data?.lingual_metrics === 'OMITTED' ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' : (lingualTopography ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700')}`}>
                        {patientData?.scan_data?.lingual_metrics === 'OMITTED' ? 'EVALUACIÓN OMITIDA' : (lingualTopography ? 'CYTOS SPECTRUM' : 'EVALUACIÓN PENDIENTE')}
                    </span>
                </button>

                <div className={`grid transition-all duration-300 ease-in-out ${openSections.lingual ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-slate-800' : 'grid-rows-[0fr] opacity-0 border-t-0'}`}>
                    <div className="overflow-hidden">
                        <div className="p-5 space-y-4">
                            {patientData?.scan_data?.lingual_metrics === 'OMITTED' ? (
                                <p className="text-xs text-slate-500 italic py-1">Evaluación de topografía lingual omitida por el evaluado/especialista.</p>
                            ) : lingualTopography ? (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-4">
                                        {lingualTopography.imageUrl && (
                                            <img 
                                                src={getValidImageUrl(lingualTopography.imageUrl)} 
                                                onError={handleImageError}
                                                alt="Superficie Lingual" 
                                                className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs shrink-0" 
                                            />
                                        )}
                                        <div className="flex-1 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                                            {typeof lingualTopography.cuerpo_lingual === 'object' ? (
                                                <div className="bg-indigo-50/40 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100/60 dark:border-indigo-900/40 space-y-1 text-[11px]">
                                                    <span className="font-bold text-indigo-950 dark:text-indigo-300 uppercase tracking-wider text-[10px] block">Cuerpo Lingual & Trofismo:</span>
                                                    <p><strong className="text-slate-800 dark:text-slate-200">Sustrato & Color:</strong> {lingualTopography.cuerpo_lingual?.coloracion_sustrato || 'Normal / Rosado'}</p>
                                                    <p><strong className="text-slate-800 dark:text-slate-200">Trofismo/Volumen:</strong> {lingualTopography.cuerpo_lingual?.trofismo_volumen || 'Normotrófico'}</p>
                                                    <p><strong className="text-slate-800 dark:text-slate-200">Indentaciones Dentales Laterales:</strong> <span className="font-bold text-amber-700 dark:text-amber-400">{lingualTopography.cuerpo_lingual?.indentaciones_dentales || 'Ausentes'}</span></p>
                                                    <p><strong className="text-slate-800 dark:text-slate-200">Fisuras Epiteliales:</strong> {lingualTopography.cuerpo_lingual?.fisuras_mucosa || 'Sin fisuras'}</p>
                                                </div>
                                            ) : null}

                                            <p>
                                                <span className="font-bold text-slate-900 dark:text-white">Saburra Lingual & Microbiota: </span>
                                                {typeof lingualTopography.saburra_microbiota === 'object'
                                                    ? `Grosor: ${lingualTopography.saburra_microbiota?.grosor || 'Delgada / Fisiológica'} | Color: ${lingualTopography.saburra_microbiota?.color || 'Normocoloreada'} | Humectación: ${lingualTopography.saburra_microbiota?.humectacion || 'Normo-humectada'}`
                                                    : (lingualTopography.saburra_thickness || 'Delgada / Fisiológica')
                                                }
                                            </p>

                                            {typeof lingualTopography.saburra_microbiota?.distribucion_topografica === 'object' && lingualTopography.saburra_microbiota.distribucion_topografica !== null && (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-[10px]">
                                                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <strong className="text-slate-900 dark:text-white block uppercase font-bold mb-0.5">Centro (Gástrico):</strong>
                                                        <span className="text-slate-600 dark:text-slate-300">{lingualTopography.saburra_microbiota.distribucion_topografica.centro}</span>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <strong className="text-slate-900 dark:text-white block uppercase font-bold mb-0.5">Raíz (Colónico/Renal):</strong>
                                                        <span className="text-slate-600 dark:text-slate-300">{lingualTopography.saburra_microbiota.distribucion_topografica.raiz}</span>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <strong className="text-slate-900 dark:text-white block uppercase font-bold mb-0.5">Bordes (Hepato-Biliar):</strong>
                                                        <span className="text-slate-600 dark:text-slate-300">{lingualTopography.saburra_microbiota.distribucion_topografica.bordes}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {!lingualTopography.cuerpo_lingual && (
                                                <p><span className="font-bold text-slate-900 dark:text-white">Hidratación Epitelial:</span> {lingualTopography.epithelial_hydration || 'Adecuada'}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-slate-50/50 my-1 rounded-xl border border-dashed border-indigo-200/80">
                                    <span className="text-3xl block mb-2">👅</span>
                                    <h5 className="font-bold text-slate-800 text-xs mb-1 uppercase tracking-wider">Topografía Lingual CYTOS Pendiente</h5>
                                    <p className="text-slate-500 text-[11px] max-w-md mx-auto leading-relaxed">
                                        {activePatientFirstName ? (
                                            <>Para procesar y desplegar la evaluación de saburra y textura tisular CYTOS de <strong className="text-slate-700">{activePatientFirstName}</strong>, ejecute la toma fotográfica en el <strong>Paso 3 de la Fase 18</strong>.</>
                                        ) : (
                                            <>Para procesar y desplegar la evaluación de saburra y textura tisular CYTOS, ejecute la toma fotográfica en el <strong>Paso 3 de la Fase 18</strong>.</>
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
