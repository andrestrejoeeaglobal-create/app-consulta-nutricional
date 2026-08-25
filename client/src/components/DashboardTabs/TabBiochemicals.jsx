import React, { useState, useEffect } from 'react';
import { FlaskConical, AlertTriangle, Filter, CheckCircle2 } from 'lucide-react';
import parsedResults from '../../data/parsed_results.json';

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

    const isScanned = patientData?.scan_data?.electret_scanned;
    const electretMetrics = isScanned ? patientData?.scan_data?.electret_metrics : null;
    const activeMetrics = electretMetrics || {};
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

    const getBadgeStyle = (status) => {
        const s = status ? status.toUpperCase() : 'NORMAL';
        if (s === 'ANORMAL LEVE' || s === 'WARNING' || s === 'warning' || s === '+') {
            return {
                bg: "bg-amber-50 text-amber-700 border-amber-200",
                label: "Anormal Leve (+)",
                icon: <span className="text-amber-500 text-xs">⚠️</span>
            };
        } else if (s === 'ANORMAL MODERADO' || s === 'CRITICAL' || s === 'critical' || s === '++') {
            return {
                bg: "bg-orange-50 text-orange-700 border-orange-200 font-bold",
                label: "Anormal Moderado (++)",
                icon: <AlertTriangle size={12} className="text-orange-550 text-orange-500" />
            };
        } else if (s === 'ANORMAL SEVERO' || s === 'SEVERE' || s === 'severe' || s === '+++') {
            return {
                bg: "bg-red-50 text-red-700 border-red-200 font-extrabold",
                label: "Anormal Severo (+++)",
                icon: <AlertTriangle size={12} className="text-red-550 text-red-500 animate-pulse" />
            };
        }
        return {
            bg: "bg-green-50 text-green-700 border-green-200",
            label: "Normal (-)",
            icon: <CheckCircle2 size={12} className="text-green-500" />
        };
    };

    const getCategoryAbnormalCount = (catKey) => {
        const items = activeMetrics?.[catKey] || {};
        return Object.values(items).reduce((acc, item) => {
            const s = item.status ? item.status.toUpperCase() : 'NORMAL';
            if (s !== 'NORMAL' && s !== 'NORMAL (-)' && s !== '-') {
                return acc + 1;
            }
            return acc;
        }, 0);
    };

    const activeSubstep = patientData?.scan_data?.active_substep;

    useEffect(() => {
        if (!activeSubstep) return;
        let targetId = null;
        if (activeSubstep === 'OCULAR' || activeSubstep.includes('OCULAR')) targetId = 'card-ocular';
        else if (activeSubstep === 'LINGUAL') targetId = 'card-lingual';
        else if (activeSubstep === 'EXTERNAL') targetId = 'card-pdf';
        else if (activeSubstep === 'VISUAL') targetId = 'card-somatic';
        else if (activeSubstep === 'ELECTRET') targetId = 'card-electret';

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

    const hasOcularData = Boolean(patientData?.scan_data?.ocular_metrics) || activeSubstep === 'OCULAR';
    const hasLingualData = Boolean(patientData?.scan_data?.lingual_metrics) || activeSubstep === 'LINGUAL';
    const hasExternalData = Boolean(patientData?.scan_data?.external_metrics) || activeSubstep === 'EXTERNAL';
    const hasVisualData = Boolean(patientData?.scan_data?.visual_metrics) || activeSubstep === 'VISUAL';

    return (
        <div className="space-y-6 font-sans" id="card-lab">
            {/* 👁️ 👅 📋 📸 TARJETAS MULTIMODALES DE FASE 18 (IMÁGENES Y DATOS REALES) */}
            {hasOcularData && (
                <div id="card-ocular" className="bg-white rounded-2xl border border-blue-200 shadow-sm p-4 space-y-3 font-sans ring-2 ring-blue-500/20 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-base">👁️</span>
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Auditoría Visual Ocular Binocular</h4>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${patientData?.scan_data?.ocular_metrics === 'OMITTED' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>
                            {patientData?.scan_data?.ocular_metrics === 'OMITTED' ? 'EVALUACIÓN OMITIDA' : 'GEMINI VISION ACTIVE'}
                        </span>
                    </div>
                    {patientData?.scan_data?.ocular_metrics === 'OMITTED' ? (
                        <p className="text-xs text-slate-500 italic">Evaluación de microcirculación foveal omitida por el evaluado/especialista.</p>
                    ) : typeof patientData?.scan_data?.ocular_metrics === 'object' && patientData?.scan_data?.ocular_metrics !== null ? (
                        <div className="flex flex-wrap items-center gap-4">
                            {patientData.scan_data.ocular_metrics.right_eye_url && (
                                <div className="flex flex-col items-center gap-1">
                                    <img 
                                        src={(import.meta.env.VITE_API_URL || 'http://localhost:5000') + patientData.scan_data.ocular_metrics.right_eye_url} 
                                        alt="Ojo Derecho" 
                                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs" 
                                    />
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Ojo Derecho</span>
                                </div>
                            )}
                            {patientData.scan_data.ocular_metrics.left_eye_url && (
                                <div className="flex flex-col items-center gap-1">
                                    <img 
                                        src={(import.meta.env.VITE_API_URL || 'http://localhost:5000') + patientData.scan_data.ocular_metrics.left_eye_url} 
                                        alt="Ojo Izquierdo" 
                                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs" 
                                    />
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Ojo Izquierdo</span>
                                </div>
                            )}
                            <div className="flex-1 text-xs text-slate-700 space-y-1">
                                <p><span className="font-bold text-slate-900">Palidez Conjuntival:</span> {patientData.scan_data.ocular_metrics.predictions?.hemoglobin?.value || 'Fisiológica'}</p>
                                <p><span className="font-bold text-slate-900">Microcirculación Foveal:</span> {patientData.scan_data.ocular_metrics.predictions?.foveal_microcirculation?.value || 'Conservada'}</p>
                                <p><span className="font-bold text-slate-900">Asimetría Vascular:</span> {patientData.scan_data.ocular_metrics.asymmetry_findings || 'Bilateral Simétrica'}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Evaluación en proceso de captura desde el sensor óptico...</p>
                    )}
                </div>
            )}

            {hasLingualData && (
                <div id="card-lingual" className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4 space-y-3 font-sans ring-2 ring-indigo-500/20 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-base">👅</span>
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Topografía Lingual CYTOS</h4>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${patientData?.scan_data?.lingual_metrics === 'OMITTED' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700'}`}>
                            {patientData?.scan_data?.lingual_metrics === 'OMITTED' ? 'EVALUACIÓN OMITIDA' : 'CYTOS SPECTRUM'}
                        </span>
                    </div>
                    {patientData?.scan_data?.lingual_metrics === 'OMITTED' ? (
                        <p className="text-xs text-slate-500 italic">Evaluación de topografía lingual omitida por el evaluado/especialista.</p>
                    ) : typeof patientData?.scan_data?.lingual_metrics === 'object' && patientData?.scan_data?.lingual_metrics !== null ? (
                        <div className="flex items-center gap-4">
                            {patientData.scan_data.lingual_metrics.imageUrl && (
                                <img 
                                    src={(import.meta.env.VITE_API_URL || 'http://localhost:5000') + patientData.scan_data.lingual_metrics.imageUrl} 
                                    alt="Superficie Lingual" 
                                    className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs" 
                                />
                            )}
                            <div className="flex-1 text-xs text-slate-700 space-y-1">
                                <p><span className="font-bold text-slate-900">Saburra Lingual:</span> {patientData.scan_data.lingual_metrics.saburra_thickness || 'Normal'}</p>
                                <p><span className="font-bold text-slate-900">Hidratación Epitelial:</span> {patientData.scan_data.lingual_metrics.epithelial_hydration || 'Adecuada'}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Evaluación en proceso de captura tisular lingual...</p>
                    )}
                </div>
            )}

            {hasExternalData && (
                <div id="card-pdf" className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4 space-y-3 font-sans ring-2 ring-emerald-500/20 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-base">📋</span>
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Biomarcadores Extraídos de PDF (OCR)</h4>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${patientData?.scan_data?.external_metrics === 'OMITTED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                            {patientData?.scan_data?.external_metrics === 'OMITTED' ? 'SIN ESTUDIOS EXTERNOS' : 'NOM-004 OCR VERIFIED'}
                        </span>
                    </div>
                    {patientData?.scan_data?.external_metrics === 'OMITTED' ? (
                        <p className="text-xs text-slate-500 italic">Sin estudios de laboratorio exógenos cargados en esta consulta.</p>
                    ) : patientData?.scan_data?.external_metrics?.biomarkers ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(patientData.scan_data.external_metrics.biomarkers).map(([key, bio], idx) => (
                                <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">{key.replace('_', ' ')}</span>
                                    <span className="font-extrabold text-slate-900">{bio.value} {bio.unit}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Carga de laboratorio exógeno lista para recepción OCR...</p>
                    )}
                </div>
            )}

            {hasVisualData && (
                <div id="card-somatic" className="bg-white rounded-2xl border border-blue-200 shadow-sm p-4 space-y-3 font-sans ring-2 ring-blue-500/20 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-base">📸</span>
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Evidencia Somática Documentada</h4>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${patientData?.scan_data?.visual_metrics === 'OMITTED' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>
                            {patientData?.scan_data?.visual_metrics === 'OMITTED' ? 'EVALUACIÓN OMITIDA' : 'SOMATIC VERIFIED'}
                        </span>
                    </div>
                    {patientData?.scan_data?.visual_metrics === 'OMITTED' ? (
                        <p className="text-xs text-slate-500 italic">Evidencia visual somática omitida por el evaluado/especialista.</p>
                    ) : typeof patientData?.scan_data?.visual_metrics === 'object' && patientData?.scan_data?.visual_metrics !== null ? (
                        <div className="flex items-center gap-4">
                            {patientData.scan_data.visual_metrics.imageUrl && (
                                <img 
                                    src={(import.meta.env.VITE_API_URL || 'http://localhost:5000') + patientData.scan_data.visual_metrics.imageUrl} 
                                    alt="Evidencia Somática" 
                                    className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs" 
                                />
                            )}
                            <div className="flex-1 text-xs text-slate-700 space-y-1">
                                <p><span className="font-bold text-slate-900">Estatus:</span> Registro fotográfico somático guardado</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Evidencia somática en proceso de foto-documentación...</p>
                    )}
                </div>
            )}

            {/* 🧬 ELECTRET METRICS SECTION */}
            <div id="card-electret" className="bg-white rounded-2xl border border-[#1C75BC]/40 ring-4 ring-[#1C75BC]/5 shadow-md overflow-hidden font-sans">
                <div className="p-4 border-b border-[#1C75BC]/20 bg-[#1C75BC]/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🧬</span>
                        <h4 className="font-bold text-[#1C75BC] text-sm">Escáner Bioeléctrico y Biorresonancia (Electret)</h4>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setShowOnlyAbnormalities(!showOnlyAbnormalities)} 
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-all shadow-sm ${
                                showOnlyAbnormalities 
                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] hover:bg-[#1C75BC]/90' 
                                    : 'bg-white text-slate-650 border-slate-200 hover:border-slate-350 hover:bg-slate-50'
                            }`}
                        >
                            <Filter size={12} />
                            {showOnlyAbnormalities ? 'Mostrando Anormalidades' : 'Mostrar solo Anormalidades'}
                        </button>
                        <span className="text-[10px] bg-[#1C75BC]/10 text-[#1C75BC] px-2 py-0.5 rounded-full font-bold border border-[#1C75BC]/30 uppercase tracking-wider">
                            Biosensores Activos
                        </span>
                    </div>
                </div>

                {!electretMetrics ? (
                    <div className="p-12 text-center bg-slate-50/50 my-6 mx-4 rounded-2xl border border-dashed border-[#1C75BC]/30">
                        <div className="w-14 h-14 rounded-2xl bg-[#1C75BC]/10 text-[#1C75BC] flex items-center justify-center mx-auto mb-3 text-2xl shadow-sm">
                            ⚡
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1">
                            Escáner Bioeléctrico y Biorresonancia (Electret) Pendiente
                        </h4>
                        <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
                            Para procesar y desplegar la telemetría en tiempo real, inicie la toma de bioseñales presionando el botón <strong>"⚡ Iniciar Escaneo Electret"</strong> en la <strong>Fase 18</strong> del panel izquierdo.
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
                                    onClick={() => setSelectedCategory(catKey)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all ${
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
                        {activeCategory && activeMetrics[activeCategory] ? (
                            <div className="space-y-4">
                                <h5 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center justify-between uppercase tracking-wide">
                                    <span>{CATEGORIAS_CLINICAS[activeCategory] || activeCategory.replace(/_/g, ' ')}</span>
                                    <span className="text-xs text-slate-400 font-medium font-mono">{Object.keys(activeMetrics[activeCategory]).length} Parámetros</span>
                                </h5>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    {Object.entries(activeMetrics[activeCategory])
                                        .filter(([key, marker]) => {
                                            if (!showOnlyAbnormalities) return true;
                                            const s = marker.status ? marker.status.toUpperCase() : 'NORMAL';
                                            return s !== 'NORMAL' && s !== 'NORMAL (-)' && s !== '-';
                                        })
                                        .map(([key, marker]) => {
                                            const badge = getBadgeStyle(marker.status);
                                            return (
                                                <div key={key} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#1C75BC]/40 transition-colors font-sans">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold text-slate-700">{marker.name}</span>
                                                        </div>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-base font-extrabold text-slate-900">{marker.value}</span>
                                                            <span className="text-[10px] text-slate-400 font-mono">Ref: {marker.reference}</span>
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
                                        {showOnlyAbnormalities && Object.values(activeMetrics[activeCategory]).filter(item => {
                                            const s = item.status ? item.status.toUpperCase() : 'NORMAL';
                                            return s !== 'NORMAL' && s !== 'NORMAL (-)' && s !== '-';
                                        }).length === 0 && (
                                            <div className="py-12 text-center text-slate-400">
                                                <CheckCircle2 size={36} className="text-[#3AAA35] mx-auto mb-2 opacity-80" />
                                                <p className="text-sm font-bold text-slate-500">¡Perfecto estado metabólico en esta área!</p>
                                                <p className="text-xs">Todos los parámetros se encuentran dentro del rango fisiológico normal.</p>
                                            </div>
                                        )}
                                </div>
                            </div>
                        ) : (
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

            {/* Modal */}
            {renderModalContent()}
        </div>
    );
};

export default TabBiochemicals;
