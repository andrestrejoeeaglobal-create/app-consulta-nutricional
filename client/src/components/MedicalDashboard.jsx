import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import Accordion from './Accordion';
import { useClinicalGenome } from '../store/useClinicalGenome';
import { User, Activity, FlaskConical, FileText, Utensils, Calendar, MapPin, HeartPulse, Check, Edit2, ChevronDown, AlertTriangle, AlertCircle, Dna, Stethoscope, Salad, Search, Save, Scissors, Shield, Clipboard as PrescriptionBoard, Lock, Unlock, Clock, Heart, XCircle } from 'lucide-react';

// Tabs Modulares (V15.5)
import { TabIdentity } from './DashboardTabs/TabIdentity';
import { TabClinicalHistory } from './DashboardTabs/TabClinicalHistory';

import { TabNutrition } from './DashboardTabs/TabNutrition';
import { TabVitals } from './DashboardTabs/TabVitals';
import { TabLogistics } from './DashboardTabs/TabLogistics';
import { TabBiochemicals } from './DashboardTabs/TabBiochemicals';
import { TabNotes } from './DashboardTabs/TabNotes';
import { TabIntervention } from './DashboardTabs/TabIntervention';
import TabDiagnosis from './DashboardTabs/TabDiagnosis';
import { TabCalendar } from './DashboardTabs/TabCalendar';
import { formatPhoneNumber } from '../utils/utils';

// SUB-COMPONENTE PARA CAMPOS (NOM-004)
const NomField = ({ label, name, value, onChange, placeholder, isEditing, activeField, width = "col-span-1", isLongText = false }) => (
    <motion.div
        className={`flex flex-col gap-1 ${width}`}
        layout
    >
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {label}
        </label>
        <div className={`relative transition-all duration-300 ${isEditing ? 'ring-2 ring-blue-400 rounded-lg' : ''} ${(activeField === name && !isEditing) ? 'ring-2 ring-blue-400 bg-blue-50 rounded-lg shadow-sm scale-[1.02]' : ''}`}>
            {isEditing ? (
                isLongText ? (
                    <textarea
                        name={name}
                        value={value || ''}
                        onChange={onChange}
                        placeholder={placeholder}
                        rows={3}
                        className="w-full bg-white border border-blue-300 rounded-lg p-2 text-sm text-slate-700 font-medium focus:outline-none resize-none"
                    />
                ) : (
                    <input
                        type="text"
                        name={name}
                        value={value || ''}
                        onChange={onChange}
                        placeholder={placeholder}
                        className="w-full bg-white border border-blue-300 rounded-lg p-2 text-sm text-slate-700 font-medium focus:outline-none"
                    />
                )
            ) : (
                <div className={`rounded-lg p-2 text-sm text-slate-700 font-medium min-h-[38px] flex items-center transition-colors ${activeField === name ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 border border-slate-200'} ${isLongText ? 'items-start whitespace-pre-wrap' : ''}`}>
                    {value || <span className="text-slate-300 italic font-normal">{placeholder}</span>}
                </div>
            )}
        </div>
    </motion.div>
);

// COMPONENTE INFOROW (Simple)
const InfoRow = ({ label, value, icon }) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
        <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-sm font-bold text-slate-700 text-right">{value}</span>
    </div>
);

// --- DEFINICIÓN DE ICONOS (COMPLETA) ---
const Icons = {
    User,
    Pulse: Activity,      // Mapeamos Pulse a Activity (mismo trazo)
    Flask: FlaskConical,  // Mapeamos Flask a FlaskConical
    File: FileText,       // Mapeamos File a FileText
    Utensils,
    Calendar,
    Dna,
    Stethoscope,
    Salad,
    Activity,            // Agregamos explícitamente Activity
    AlertTriangle
};

// CONFIGURACIÓN DE TAGS VISUALES (NLP) - UX-F3
// DICCIONARIO DE INTERPRETACIÓN VISUAL (NLP TAGS)
const TAG_CONFIG = {
    // 🔴 RIESGOS FÍSICOS / ESTRUCTURALES
    "HERNIA_RISK": {
        label: "⛔ RIESGO: CARGAS / HERNIA",
        style: "bg-red-100 text-red-700 border-red-200",
        icon: "🏋️‍♂️"
    },
    "POST_SURGERY": {
        label: "🏥 POST-QUIRÚRGICO",
        style: "bg-red-50 text-red-600 border-red-100",
        icon: "🩹"
    },

    // 🟡 RIESGOS DIGESTIVOS / METABÓLICOS
    "DIGESTIVE_BLOATING": {
        label: "⚠️ INFLAMACIÓN / GASES",
        style: "bg-amber-100 text-amber-700 border-amber-200",
        icon: "🐡"
    },
    "COLITIS_PROFILE": {
        label: "⚠️ PERFIL COLITIS",
        style: "bg-orange-100 text-orange-700 border-orange-200",
        icon: "🔥"
    },
    "DIABETES_RISK": {
        label: "🩸 VIGILANCIA GLUCÉMICA",
        style: "bg-blue-100 text-blue-700 border-blue-200",
        icon: "🍬"
    },

    // 🟣 PSICONUTRICIÓN
    "ANXIETY_EATING": {
        label: "🧠 ANSIEDAD POR COMER",
        style: "bg-purple-100 text-purple-700 border-purple-200",
        icon: "🍩"
    },
    "MIGRAINE_HISTORY": {
        label: "⚡ MIGRAÑA",
        style: "bg-indigo-100 text-indigo-700 border-indigo-200",
        icon: "🤕"
    }
};

export const MedicalDashboard = ({
    patientData, currentStep, // <--- Renamed from activeSection
    activeTab,   // <--- New controlled props
    isEditing, onEditToggle, setPatientData,
    onTriggerEdit, // V3.5
    fase3State, // Prop del estado interactivo de la Fase 3
    fase4State,
    fase5State,
    fase6State
}) => {
    // --- CONEXIÓN AL GENOMA (Stack Sagrado V1.0) ---
    const pendingAlerts = useClinicalGenome(state => state.pendingAlerts);
    const metabolicAxis = useClinicalGenome(state => state.metabolicAxis);

    // --- ESTADO DE ACORDEÓN (Anidados V15.5) ---
    const [openSections, setOpenSections] = useState({
        parentProfile: true,
        childIdentity: true,
        childAddress: false,
        childSecurity: false,
        childMotive: false,

        parentClinical: false,
        childAhf: false,
        childApp: false,
        childFarma: false,
        childAllergies: false,
        childDigestive: false,
        childPhysio: false,
        childHabits: false, // Added for Phase 7 (Habits)

        parentLifestyle: false,

        diet: false
    });
    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // --- EFECTO DE SCROLL AUTOMÁTICO PARA ACORDEÓN ---
    // --- EFECTO DE SCROLL AUTOMÁTICO PARA ACORDEÓN (OPTIMIZADO) ---
    // --- ESTADOS DE DATOS ---
    const [localPatientData, setLocalPatientData] = useState({ name: "Paciente Nuevo", age: "--", weight: "--", files: [] });

    // Unificamos la data
    const displayData = {
        ...localPatientData,
        ...patientData,
        files: localPatientData.files
    };
    const [processedDocs, setProcessedDocs] = useState({});
    const [selectedFileToView, setSelectedFileToView] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- ESTADO DE NAVEGACIÓN ELIMINADO (AHORA ES PROP) ---
    // const [activeTab, setActiveTab] = useState('profile');

    // --- TRIGGER MAP V2.0: NAVEGACIÓN INTELLIGENTE (Protocolos 1 & 2) ---
    // --- TRIGGER MAP V2.0: NAVEGACIÓN INTELLIGENTE (Protocolos 1 & 2) ---
    useEffect(() => {
        if (!currentStep) return;

        // --- DETECCIÓN AUTOMÁTICA DE SECCIÓN (V2.2 - Enhanced Scroll) ---
        const step = currentStep.toLowerCase();
        console.log(`[Dashboard] Syncing to step: ${step}`);

        // Define step groups for accordions
        const stepsClinical = [
            'ph2_', 'ph3_', 'ahf_', 'app_', 'meds_', 'supp_', 'digestive_', 'allergies_',
            'ipas_', 'clinica_', 'intro_triage', 'intro_triage_surgery', 'clinica_body_map', 'clinica_intensity',
            'habit', 'substance_', 'phase_4_', 'phase_6_', 'phase_7_', 'phase_8_', 'phase_9_'
        ];
        const stepsLifestyle = ['lifestyle_', 'activity_', 'sleep_', 'stress_', 'logistics_'];
        const stepsDiet = ['diet_', 'r24h_', 'ffq_', 'food_'];
        const stepsVitals = ['vitals', 'antropometria', 'imc', 'bio_'];

        const isStepIn = (group) => group.some(s => step.startsWith(s) || step.includes(s));

        let targetParent = null;
        let targetChild = null;
        let targetCardId = null;

        // --- MAPPING LOGIC ---
        // 1. PERFIL DEL PACIENTE
        if (isStepIn(['address_', 'domicilio', 'zipcode', 'colony', 'street', 'state_manual', 'municipality_manual', 'map_validation'])) {
            targetParent = 'parentProfile';
            targetChild = 'childAddress';
            targetCardId = 'card-address';
        }
        else if (isStepIn(['emergency_', 'seguridad', 'phase_2_'])) {
            targetParent = 'parentProfile';
            targetChild = 'childSecurity';
            targetCardId = 'card-emergency';
        }
        else if (isStepIn(['intro_', 'appointment', 'identidad', 'phase_0_'])) { // Phase 0
            // DO NOTHING
            targetParent = null;
        }
        else if (isStepIn(['phase_1_', 'ph1_'])) {
            targetParent = 'parentProfile';
            targetChild = 'childIdentity';
            targetCardId = 'card-intro';
        }
        else if (isStepIn(['phase_3_'])) {
            targetParent = 'parentClinical';
            targetChild = 'childMotive';
            targetCardId = 'card-motivo';
        }
        else if (isStepIn(['ipas_', 'motivo', 'sympt', 'triage'])) {
            targetParent = 'parentClinical';
            targetChild = 'childMotive';
            targetCardId = 'card-motivo';
        }
        else if (isStepIn(stepsClinical)) {
            targetParent = 'parentClinical';
            if (step.includes('ahf_') || step.includes('family') || step.includes('phase_4_') || step.includes('ph4_')) { targetChild = 'childAhf'; targetCardId = 'card-ahf'; }
            else if (step.includes('app_') || step.includes('patho')) { targetChild = 'childApp'; targetCardId = 'card-app'; }
            else if (step.includes('meds_') || step.includes('supp_') || step.includes('phase_6_')) { targetChild = 'childFarma'; targetCardId = 'card-meds'; }
            else if (step.includes('allergies_')) { targetChild = 'childAllergies'; targetCardId = 'card-allergy'; }
            else if (step.includes('digestive_') || step.includes('digestive') || step.includes('phase_8_')) { targetChild = 'childDigestive'; targetCardId = 'card-digestive'; }
            else if (step.includes('physio_') || step.includes('menstrual_') || step.includes('preg_') || step.includes('phase_9_')) {
                targetChild = 'childPhysio'; targetCardId = 'card-physio';
            }
            else if (step.includes('habit') || step.includes('activity_') || step.includes('sleep_') || step.includes('substance_') || step.includes('phase_7_')) {
                targetChild = 'childHabits'; targetCardId = 'card-habit';
            }
            else { targetChild = 'childAhf'; targetCardId = 'card-ahf'; } // Fallback for general clinical
        }
        // 3. ESTILO DE VIDA Y ENTORNO
        else if (isStepIn(stepsLifestyle) || step.includes('phase_5_')) {
            targetParent = 'parentLifestyle';
            targetChild = null; // No child accordion in TabLogistics
            targetCardId = 'card-lifestyle';
        }
        // 4. DIETA
        else if (isStepIn(stepsDiet)) {
            targetCardId = step.includes('r24h_') ? 'card-r24h' : (step.includes('ffq_') ? 'card-ffq' : 'card-prefs');
        }
        // 5. VITALES
        else if (isStepIn(stepsVitals)) {
            targetCardId = 'card-j';
        }

        // --- EXECUTION ---
        if (targetParent) {
            setTimeout(() => {
                setOpenSections(prev => {
                    // Si ya están abiertos el padre y el hijo exactos, no hacer nada para evitar re renders
                    if (prev[targetParent] && prev[targetChild]) return prev;

                    return {
                        // Keep diet state
                        diet: prev.diet,
                        // Reseteamos todo a false primero
                        parentProfile: false, childIdentity: false, childAddress: false, childSecurity: false, childMotive: false,
                        parentClinical: false, childAhf: false, childApp: false, childFarma: false, childAllergies: false, childDigestive: false, childPhysio: false, childHabits: false,
                        parentLifestyle: false,
                        // Abrimos los que corresponden
                        [targetParent]: true,
                        ...(targetChild ? { [targetChild]: true } : {}),
                        // Fix for Phase 4: Keep Motivo de Consulta open alongside AHF
                        ...(step.includes('ahf_') || step.includes('phase_4_') || step.includes('ph4_') ? { childAhf: true } : {})
                    };
                });
            }, 0);
        }

        // --- SCROLL & HIGHLIGHT ---
        if (targetCardId) {
            console.log(`[Dashboard] Scrolls to: ${targetCardId}`);
            // Small delay to allow Accordion animation to start/finish
            setTimeout(() => {
                const element = document.getElementById(targetCardId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' }); // 'center' often better for visibility

                    // Visual Focus Effect
                    element.classList.add('ring-4', 'ring-blue-300', 'ring-offset-2', 'transition-all', 'duration-500');
                    setTimeout(() => {
                        element.classList.remove('ring-4', 'ring-blue-300', 'ring-offset-2');
                    }, 2000);
                } else {
                    console.warn(`[Dashboard] Target element ${targetCardId} not found in DOM.`);
                }
            }, 300);
        }

    }, [currentStep]); // Removed activeField to prevent jumpiness when typing

    // Función para GUARDAR y VALIDAR 


    // --- LÓGICA DE SEMÁFORO ---
    const analyzeStatus = (valStr, refStr) => {
        if (!valStr || !refStr) return 'normal';
        try {
            const cleanVal = valStr.replace(/[^\d.-]/g, '');
            const value = parseFloat(cleanVal);
            const parts = refStr.split('-').map(s => parseFloat(s.trim()));
            if (parts.length === 2) {
                const [min, max] = parts;
                if (value < min) return value < min * 0.9 ? 'critical_low' : 'low';
                if (value > max) return value > max * 1.1 ? 'critical_high' : 'high';
            }
        } catch { return 'normal'; }
        return 'normal';
    };

    // --- SUBIDA DE ARCHIVOS (BACKEND) ---
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (!files.length) return;
        setIsProcessing(true);

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const response = await fetch('http://localhost:3000/api/upload', { method: 'POST', body: formData });
                if (response.ok) {
                    const data = await response.json();
                    setProcessedDocs(prev => ({ ...prev, [file.name]: data }));
                    const newFile = {
                        name: file.name, type: data.type, date: new Date().toLocaleDateString(), status: 'Listo',
                        icon: data.type === 'quantum' ? '🧪' : '📄'
                    };
                    setLocalPatientData(prev => ({
                        ...prev,
                        name: (data.patient && data.patient !== "Paciente Detectado") ? data.patient : prev.name,
                        files: [...prev.files, newFile]
                    }));
                    setSelectedFileToView(newFile);
                } else { alert("Error en el servidor backend."); }
            } catch { alert("No se pudo conectar al Backend (Puerto 3000)."); }
        }
        setIsProcessing(false);
        event.target.value = '';
    };

    // --- RENDERIZADORES DE SECCIÓN ---



    // Manejador especial para cambio de fecha


    // Helper de Capitalización (V4.2 Polish)
    const capitalizeFirst = (str) => {
        if (!str || typeof str !== 'string') return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // 📅 UTILIDAD DE FORMATO DE FECHA (V2.6)
    const formatDateFriendly = (dateString) => {
        if (!dateString) return "";
        // Soporte para DD/MM/AAAA
        if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const [day, month, year] = dateString.split('/').map(Number);
            const date = new Date(year, month - 1, day);
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            // "12 de mayo de 1990" -> Capitalizar mes si se desea, o dejar nativo.
            // El usuario pidió: "12 de [Mes] de YYYY" (Ej: 12 de Octubre de 1985)
            const formatted = date.toLocaleDateString('es-ES', options);
            // Ajuste para capitalizar mes si es necesario
            return formatted.replace(/ de ([a-z])/, (match, p1) => ` de ${p1.toUpperCase()}`);
        }
        return dateString;
    };

    // Helper de saneamiento visual
    const normalizeString = (str) => {
        if (!str) return '';
        if (typeof str !== 'string') return str;
        let s = str.trim();
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    const renderEditableField = (label, key, placeholder = '--', group = null, isLongText = false, customClass = '') => {
        let val;
        if (group) {
            val = patientData[group]?.[key];
        } else {
            val = patientData[key];
        }

        const isArray = Array.isArray(val);
        let displayValRaw = val;

        if (isArray) {
            displayValRaw = val.map(item => {
                if (typeof item === 'object' && item !== null) {
                    // AHF: { familiar, enfermedad }
                    if (item.familiar) return `${capitalizeFirst(item.familiar)}: ${capitalizeFirst(item.enfermedad)}`;
                    // Meds/Supps: { nombre, dosis, frecuencia }
                    if (item.nombre) return `${capitalizeFirst(item.nombre)} (${item.dosis || ''}${item.frecuencia ? ' - ' + item.frecuencia : ''})`;
                    // Fallback para otros objetos
                    return item.label || item.summary || item.text || JSON.stringify(item);
                }
                return capitalizeFirst(item);
            }).join(', ');
        } else if (typeof val === 'object' && val !== null) {
            // V6.2: Object Support (Alcohol/FFQ)
            displayValRaw = val.label || val.summary || val.text || JSON.stringify(val);
        } else if (typeof val === 'string') {
            displayValRaw = capitalizeFirst(val);
        }

        // Logic de formateo de fecha específico
        if (key === 'fechanac' && typeof displayValRaw === 'string') {
            displayValRaw = formatDateFriendly(displayValRaw);
        }

        // Logic de enmascaramiento telefónico (Dashboard)
        if ((key === 'phone' || key === 'telefono') && typeof displayValRaw === 'string') {
            displayValRaw = formatPhoneNumber(displayValRaw);
        }

        const isNegation = typeof displayValRaw === 'string' && (displayValRaw.toLowerCase() === 'niega' || displayValRaw.toLowerCase() === 'no');

        // Aplicar normalización si no es código CSS específico y es string
        const displayVal = (customClass.includes('code') || customClass.includes('dashboard-data-code'))
            ? displayValRaw
            : normalizeString(displayValRaw);

        const activeField = isEditing;

        // V15.6 GLOW EFFECT ENCAPSULATION
        const GlowDisplay = ({ val, isNeg, cClass }) => {
            const [glow, setGlow] = useState(false);
            const prevVal = useRef(val);

            useEffect(() => {
                if (val !== prevVal.current) {
                    if (val && val !== '--' && val !== '---' && typeof val === 'string') {
                        setGlow(true);
                        const timer = setTimeout(() => setGlow(false), 2000);
                        prevVal.current = val;
                        return () => clearTimeout(timer);
                    }
                    prevVal.current = val;
                }
            }, [val]);

            return (
                <div className={`p-3 rounded-xl border min-h-[50px] flex ${cClass ? 'items-start' : 'items-center'} transition-all duration-700 transform ${glow ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200 shadow-md scale-[1.02] text-blue-800' : `bg-slate-50 border-slate-200 ${cClass ? cClass : 'text-slate-700 font-medium'}`}`}>
                    {val ? (
                        <span className={`w-full transition-colors duration-500 ${isNeg ? "text-slate-400 italic" : ""}`}>
                            {val}
                        </span>
                    ) : (
                        <span className="text-slate-300 font-light select-none">---</span>
                    )}
                </div>
            );
        };

        return (
            <div className={`flex flex-col gap-1 ${isLongText ? 'col-span-full' : ''}`}>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex justify-between">
                    {label}

                    {/* {group && <span className="text-[8px] text-slate-300">{group}.{key}</span>} Debug Hidden */}
                </label>
                {activeField ? (
                    <input
                        type="text"
                        value={val || ''} // Usamos raw val para edición
                        onChange={(e) => {
                            const newValue = e.target.value;
                            if (setPatientData) {
                                if (group) {
                                    setPatientData({
                                        ...patientData,
                                        [group]: { ...patientData[group], [key]: newValue }
                                    });
                                } else {
                                    setPatientData({ ...patientData, [key]: newValue });
                                }
                            }
                        }}
                        placeholder={placeholder}
                        className={`p-2 rounded-lg bg-white border border-blue-200 text-slate-700 text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all ${customClass}`}
                    />
                ) : (
                    <GlowDisplay val={displayVal} isNeg={isNegation} cClass={customClass} />
                )}
            </div>
        );
    };

    // Helper para Header de Tarjeta con Botón Editar (V4.2 Polish)
    const CardHeader = ({ icon, title, colorClass = "text-slate-500", onEdit }) => {
        const Icon = icon;
        return (
            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2">
                <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 font-prototype ${colorClass}`}>
                    <Icon className="w-4 h-4" /> {title}
                </h3>
                <button
                    onClick={onEdit || onEditToggle}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 font-sansation"
                    title="Editar Sección"
                >
                    <Edit2 className="w-3 h-3" /> EDITAR
                </button>
            </div>
        );
    };

    // --- RENDERIZADO DEL MODAL (REPORTE) ---
    const renderModalContent = () => {
        if (!selectedFileToView) return null;
        const docData = processedDocs[selectedFileToView.name];
        if (!docData) return null;

        const hasAnyAlert = docData.isGrouped && Object.values(docData.findings).some(rows => rows.some(r => analyzeStatus(r.value, r.ref) !== 'normal'));

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 font-sans">
                    <div className="bg-[#1e293b] p-5 flex justify-between items-center text-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg">
                                <span className="text-xl">🧪</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg tracking-wide">{docData.title}</h3>
                                <div className="flex gap-3 text-xs opacity-80 mt-1">
                                    <span className="flex items-center gap-1">👤 {docData.patient}</span>
                                    <span>|</span>
                                    <span className="bg-blue-500/20 px-2 rounded border border-blue-500/30">IA VERIFIED</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedFileToView(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-xl">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-6">
                        {!hasAnyAlert && (
                            <div className="p-8 text-center bg-white rounded-xl border border-green-200 shadow-sm">
                                <div className="text-4xl mb-2">🌿</div>
                                <h3 className="text-green-700 font-bold">Sin hallazgos patológicos</h3>
                                <p className="text-green-600 text-sm">Todo en orden.</p>
                            </div>
                        )}
                        {docData.isGrouped && Object.entries(docData.findings).map(([section, rows], idx) => {
                            const abnormalRows = rows.filter(row => analyzeStatus(row.value, row.ref) !== 'normal');
                            if (abnormalRows.length === 0) return null;
                            return (
                                <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-red-50 px-6 py-3 border-b border-red-100 flex justify-between items-center">
                                        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> {section}
                                        </h4>
                                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold border border-red-200">{abnormalRows.length} ALERTAS</span>
                                    </div>
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-slate-50">
                                            {abnormalRows.map((row, rIdx) => {
                                                const status = analyzeStatus(row.value, row.ref);
                                                return (
                                                    <tr key={rIdx} className="hover:bg-red-50/10 transition-colors">
                                                        <td className="px-6 py-3 font-medium text-slate-600 w-[40%]">{row.label}</td>
                                                        <td className="px-6 py-3 font-bold text-slate-800 text-base">{row.value}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            {status.includes('critical') ?
                                                                <span className="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm">CRÍTICO</span> :
                                                                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${status === 'high' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{status === 'high' ? 'ALTO ⬆' : 'BAJO ⬇'}</span>
                                                            }
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

    // --- RENDERIZADO PRINCIPAL (LAYOUT NUEVO) ---
    return (
        <div className="h-full bg-slate-50 p-6 overflow-y-auto font-sansation custom-scrollbar">

            {/* BOTÓN FLOTANTE O FIJO PARA GUARDAR REMOVIDO PARA EVITAR DUPLICIDAD CON EL HEADER */}

            {/* 2. ÁREA DE CONTENIDO */}
            <div className="max-w-5xl mx-auto pb-20">
                {/* VISTAS ACTIVAS */}
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        <TabIdentity
                            patientData={patientData}
                            setPatientData={setPatientData}
                            isEditing={isEditing}
                            onTriggerEdit={onTriggerEdit}
                            renderEditableField={renderEditableField}
                            CardHeader={CardHeader}
                            Accordion={Accordion}
                            openSections={openSections}
                            toggleSection={toggleSection}
                        />
                        <TabClinicalHistory
                            patientData={patientData}
                            setPatientData={setPatientData}
                            isEditing={isEditing}
                            onTriggerEdit={onTriggerEdit}
                            renderEditableField={renderEditableField}
                            CardHeader={CardHeader}
                            Accordion={Accordion}
                            openSections={openSections}
                            toggleSection={toggleSection}
                            TAG_CONFIG={TAG_CONFIG}
                            fase3State={fase3State}
                            fase4State={fase4State}
                            fase5State={fase5State}
                            fase6State={fase6State}
                            pendingAlerts={pendingAlerts}
                            metabolicAxis={metabolicAxis}
                            currentStep={currentStep}
                        />

                        <TabLogistics
                            patientData={patientData}
                            isEditing={isEditing}
                            onTriggerEdit={onTriggerEdit}
                            renderEditableField={renderEditableField}
                            CardHeader={CardHeader}
                            Accordion={Accordion}
                            openSections={openSections}
                            toggleSection={toggleSection}
                        />
                    </div>
                )}

                {activeTab === 'diet' && (
                    <TabNutrition
                        patientData={patientData}
                        isEditing={isEditing}
                        onTriggerEdit={onTriggerEdit}
                        renderEditableField={renderEditableField}
                        CardHeader={CardHeader}
                        Accordion={Accordion}
                        openSections={openSections}
                        toggleSection={toggleSection}
                    />
                )}

                {activeTab === 'vitals' && (
                    <TabVitals
                        patientData={patientData}
                        onTriggerEdit={onTriggerEdit}
                        setPatientData={setPatientData}
                        CardHeader={CardHeader}
                    />
                )}

                {activeTab === 'lab' && (
                    <TabBiochemicals
                        isProcessing={isProcessing}
                        displayData={displayData}
                        handleFileUpload={handleFileUpload}
                        setSelectedFileToView={setSelectedFileToView}
                    />
                )}

                {activeTab === 'notes' && (
                    <TabNotes
                        patientData={patientData}
                        isEditing={isEditing}
                    />
                )}

                {activeTab === 'intervention' && (
                    <TabIntervention
                        patientData={patientData}
                        isEditing={isEditing}
                    />
                )}

                {activeTab === 'diagnosis' && (
                    <TabDiagnosis
                        patientData={patientData}
                        CardHeader={CardHeader}
                    />
                )}

                {/* Pestaña de Calendario y Sprint */}
                {activeTab === 'schedule' && (
                    <TabCalendar
                        patientData={patientData}
                    />
                )}
            </div>



            {/* MODAL GLOBAL */}
            {renderModalContent()}
        </div>
    );
};

export default MedicalDashboard;
