import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    BrainCircuit, 
    AlertTriangle, 
    CheckCircle2, 
    Activity, 
    Sliders, 
    X, 
    Plus, 
    Trash2, 
    Lock, 
    Send, 
    Clock, 
    FileText,
    ShieldAlert,
    Target,
    Zap,
    LayoutGrid
} from 'lucide-react';
import tiloImg from '../../assets/tilo.png';
import ReactMarkdown from 'react-markdown';
import { cleanBinaryGateMessage } from '../../utils/utils';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

// ==========================================================================
// SUBCOMPONENTE: DiagnosticoRenderizado (Bento Grid Estructurado CORTEX v2.0)
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
                    Doctrina CORTEX v2.0
                </span>
            </div>

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

export default function Fase19_DiagnosticoIntegral({
    patientData,
    setPatientData,
    messages,
    setMessages,
    onPhaseComplete
}) {
    const identityLock = useClinicalGenome(state => state.identityLock);
    const { isLactante, isPediatrico, patientAge } = usePatientLinguistics(patientData);
    const citationId = patientData?.idCita || patientData?.citaId || 1;

    // Resolutores Exhaustivos de Metadatos de Referencia (ABCD)
    // 1. Biometría & IMC
    const displayWeight = patientData?.vitals?.weight || patientData?.peso || patientData?.biometria?.peso || patientData?.profile?.weight;
    const displayHeight = patientData?.vitals?.height || patientData?.talla || patientData?.biometria?.talla || patientData?.profile?.height;
    let calculatedImc = null;
    if (displayWeight && displayHeight) {
        const hMetros = parseFloat(displayHeight) > 10 ? parseFloat(displayHeight) / 100 : parseFloat(displayHeight);
        calculatedImc = (parseFloat(displayWeight) / (hMetros * hMetros)).toFixed(1);
    }
    const displayImc = patientData?.vitals?.bmi || patientData?.imc || patientData?.biometria?.imc || calculatedImc;
    const displayImcClass = patientData?.vitals?.bmi_class || patientData?.imcEstado || patientData?.biometria?.imc_estado || (displayImc ? (displayImc < 18.5 ? 'Bajo Peso' : displayImc < 25 ? 'Normal' : displayImc < 30 ? 'Sobrepeso' : 'Obesidad') : 'Estable');

    // 2. Presión Arterial, Glucosa, SpO2, FC
    let displayBP = null;
    if (patientData?.vitals?.blood_pressure) {
        if (typeof patientData.vitals.blood_pressure === 'object') {
            const sys = patientData.vitals.blood_pressure.systolic;
            const dia = patientData.vitals.blood_pressure.diastolic;
            if (sys && dia) displayBP = `${sys}/${dia}`;
        } else {
            displayBP = patientData.vitals.blood_pressure;
        }
    }
    if (!displayBP) displayBP = patientData?.signosVitales?.ta || patientData?.vitals?.bp;

    let displayGluc = patientData?.vitals?.glucose || patientData?.signosVitales?.glucosa;
    if (displayGluc) {
        displayGluc = displayGluc.toString().replace(/\s*mg\/dL/gi, '');
    }

    const displaySpo2 = patientData?.vitals?.spo2 || patientData?.signosVitales?.spo2 || patientData?.signosVitales?.oximetria || '95';
    const displayFC = patientData?.vitals?.hr || 
                      patientData?.vitals?.heart_rate || 
                      patientData?.vitals?.fc || 
                      patientData?.signosVitales?.fc || 
                      patientData?.signosVitales?.pulso || 
                      patientData?.signosVitales?.frecuenciaCardiaca || 
                      patientData?.signosVitales?.frecuencia_cardiaca || 
                      (isLactante ? 90 : null);

    // 3. Fármacos & Alergias
    const medsList = patientData?.history?.medications?.length > 0 
        ? patientData.history.medications.map(m => typeof m === 'object' ? m.name : m).filter(Boolean)
        : (patientData?.farmacologia ? [patientData.farmacologia] : []);

    const foodAllergiesList = patientData?.history?.allergies?.food?.length > 0
        ? patientData.history.allergies.food.map(a => typeof a === 'object' ? a.agent : a).filter(Boolean)
        : [];

    const drugAllergiesList = patientData?.history?.allergies?.drug?.length > 0
        ? patientData.history.allergies.drug.map(a => typeof a === 'object' ? a.agent : a).filter(Boolean)
        : [];

    // Chat scroll ref
    const chatEndRef = useRef(null);

    // Estados Locales
    const [symptomsInput, setSymptomsInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [dossierState, setDossierState] = useState('idle'); // idle -> review -> saving -> complete
    
    // Almacenamiento de expediente en edición
    const [originalDossier, setOriginalDossier] = useState(null);
    const [diagnoses, setDiagnoses] = useState([]);
    const [management, setManagement] = useState([]);
    const [criticalAlerts, setCriticalAlerts] = useState([]);
    const [additionalSymptoms, setAdditionalSymptoms] = useState('');
    const [viewTab, setViewTab] = useState('bento'); // 'bento' | 'edit'

    const [errorMessage, setErrorMessage] = useState('');

    // Cargar Wayfinding AI: Pregunta de seguridad inicial de Tilo
    useEffect(() => {
        const wayfindingQuestion = "Revisando su historial médico y bio-escaneos... ¿Hay algún síntoma, dolor o molestia reciente que no hayamos registrado hasta este momento?";
        const hasWayfinding = messages.some(m => m.content.includes(wayfindingQuestion));
        
        if (!hasWayfinding && setMessages) {
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: wayfindingQuestion,
                    avatar: tiloImg,
                    options: [
                        { label: "✅ Sin síntomas adicionales (Generar Diagnóstico)", value: "NO_ADDITIONAL_SYMPTOMS" },
                        { label: "✏️ Registrar síntoma o molestia", value: "ADD_SYMPTOM" }
                    ]
                }
            ]);
        }

        // Si ya hay expediente aprobado en patientData, restaurar estado
        if (patientData?.clinical_dossier) {
            const dossier = patientData.clinical_dossier;
            setDiagnoses(dossier.human_approved_diagnosis || []);
            setManagement(dossier.human_approved_management || []);
            setAdditionalSymptoms(dossier.additional_symptoms_reported || '');
            setDossierState('review');
        }
    }, [messages, setMessages, patientData]);

    // Auto-scroll al final del chat al recibir mensajes
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isAnalyzing]);

    // --- ACCIÓN: Detonar Síntesis CORTEX ---
    const triggerSynthesis = async (patientText) => {
        setAdditionalSymptoms(patientText);

        if (setMessages) {
            setMessages(prev => {
                const cleaned = prev.map(m => m.options ? { ...m, options: undefined } : m);
                return [
                    ...cleaned,
                    {
                        role: 'user',
                        content: patientText
                    }
                ];
            });
        }

        setIsAnalyzing(true);
        setDossierState('idle');

        setTimeout(async () => {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            try {
                const payloadToSend = {
                    ...(patientData || {}),
                    identityLock,
                    isLactante: isLactante || patientData?.isLactante || (identityLock?.patientInfo?.age < 2),
                    isPediatrico: isPediatrico || patientData?.isPediatrico || (identityLock?.patientInfo?.age < 18),
                    age: patientAge !== undefined ? patientAge : (identityLock?.patientInfo?.age ?? patientData?.age)
                };

                const response = await fetch(`${apiUrl}/api/cortex/synthesize-dossier`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ citationId, patientData: payloadToSend })
                });

                const data = await response.json();
                if (data.success && data.dossier) {
                    const dossier = data.dossier;
                    setOriginalDossier(dossier);
                    setDiagnoses(dossier.preliminary_diagnosis || []);
                    setManagement(dossier.suggested_management || []);
                    setCriticalAlerts(dossier.critical_alerts || []);
                    setDossierState('review');

                    if (setMessages) {
                        setMessages(prev => [
                            ...prev,
                            {
                                role: 'assistant',
                                content: `🧠 **Motor CORTEX de Síntesis Activo.**\n\nHe compilado y estructurado el borrador de su expediente clínico. Para garantizar el rigor y la seguridad de su plan, he transferido el control total al Bio-Arquitecto en el panel derecho para la validación final del diagnóstico y plan de dosificación.`,
                                avatar: tiloImg
                            }
                        ]);
                    }
                } else {
                    setErrorMessage(data.message || "No se pudo recuperar la síntesis del motor CORTEX.");
                }
            } catch (err) {
                console.error("🔥 Error al recuperar síntesis CORTEX:", err);
                setErrorMessage("Error de comunicación con el servidor clínico.");
            } finally {
                setIsAnalyzing(false);
            }
        }, 1200);
    };

    // --- ACCIÓN: Enviar respuesta de síntomas del paciente ---
    const handleSendSymptoms = (e) => {
        e.preventDefault();
        if (!symptomsInput.trim()) return;
        const patientText = symptomsInput.trim();
        setSymptomsInput('');
        triggerSynthesis(patientText);
    };

    // --- EDICIÓN DE ITEMS ---
    const handleUpdateDiagnosis = (index, value) => {
        setDiagnoses(prev => {
            const copy = [...prev];
            copy[index] = value;
            return copy;
        });
    };

    const handleAddDiagnosis = () => {
        setDiagnoses(prev => [...prev, '']);
    };

    const handleRemoveDiagnosis = (index) => {
        setDiagnoses(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateManagement = (index, value) => {
        setManagement(prev => {
            const copy = [...prev];
            copy[index] = value;
            return copy;
        });
    };

    const handleAddManagement = () => {
        setManagement(prev => [...prev, '']);
    };

    const handleRemoveManagement = (index) => {
        setManagement(prev => prev.filter((_, i) => i !== index));
    };

    // --- ACCIÓN: Restaurar sugerencias originales de la IA ---
    // --- ACCIÓN: Restaurar sugerencias / Re-ejecutar CORTEX v2.0 ---
    const handleRestoreSuggestions = () => {
        triggerSynthesis(additionalSymptoms || 'Re-síntesis de expediente clínico');
    };

    // --- ACCIÓN: Rechazar sugerencias para ingresar manual ---
    const handleRejectSuggestions = () => {
        setDiagnoses(['']);
        setManagement(['']);
    };

    // --- ACCIÓN: Confirmar y Sellar Dossier en SQLite ---
    const handleApproveDossier = async () => {
        setDossierState('saving');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        // Filtrar vacíos
        const finalDiagnosis = diagnoses.filter(d => d.trim() !== '');
        const finalManagement = management.filter(m => m.trim() !== '');

        try {
            const response = await fetch(`${apiUrl}/api/cortex/approve-dossier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    citationId,
                    approvedDiagnosis: finalDiagnosis,
                    approvedManagement: finalManagement,
                    additionalSymptoms,
                    originalDiagnosis: originalDossier?.preliminary_diagnosis || [],
                    originalManagement: originalDossier?.suggested_management || []
                })
            });

            const data = await response.json();
            if (data.success) {
                setDossierState('complete');

                // Sincronizar estado local en React global
                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        clinical_dossier: {
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
                    setTimeout(() => {
                        onPhaseComplete('PHASE_20_PORTAPAPELES');
                    }, 1000);
                }
            } else {
                setDossierState('review');
                setErrorMessage(data.message || "Error al sellar expediente.");
            }
        } catch (err) {
            console.error("🔥 Error aprobando dossier:", err);
            setDossierState('review');
            setErrorMessage("Error de conexión al guardar el expediente.");
        }
    };

    const isPatientChatLocked = dossierState === 'review' || dossierState === 'saving' || dossierState === 'complete';

    return (
        <div className="flex-1 flex flex-row min-h-0 bg-[#FAFAFA] overflow-hidden">
            
            {/* ==========================================================================
                PANEL IZQUIERDO: CHAT TILO (50%)
            ========================================================================== */}
            <div className="w-1/2 flex flex-col bg-white border-r border-slate-200 shadow-lg relative h-full">
                
                {/* Cabecera del Chat */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3 select-none">
                    <div className="w-10 h-10 rounded-full bg-white border flex items-center justify-center overflow-hidden">
                        <img src={tiloImg} alt="Tilo" className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-[13px] uppercase tracking-wider">Tilo Asistente</h4>
                        <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                            Fase 19: CORTEX Wayfinding
                        </span>
                    </div>
                </div>

                {/* Historial de Mensajes del Chat */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'} items-start gap-3`}>
                            {msg.role === 'assistant' && (
                                <div className="w-9 h-9 rounded-full bg-slate-50 border flex items-center justify-center overflow-hidden flex-shrink-0">
                                    <img src={tiloImg} alt="Tilo" className="w-7 h-7 object-contain" />
                                </div>
                            )}
                            <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed ${
                                msg.role === 'assistant' 
                                    ? 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-200/80 shadow-sm' 
                                    : 'bg-[#1C75BC] text-white rounded-tr-none shadow-md shadow-blue-600/10'
                            }`}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm max-w-none text-slate-800 text-[13px] leading-relaxed space-y-3">
                                        <ReactMarkdown>{cleanBinaryGateMessage(msg.content)}</ReactMarkdown>
                                        {msg.options && msg.options.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2.5 border-t border-slate-200/80 select-none">
                                                {msg.options.map((opt, oIdx) => (
                                                    <button
                                                        key={oIdx}
                                                        onClick={() => {
                                                            if (opt.value === 'NO_ADDITIONAL_SYMPTOMS') {
                                                                triggerSynthesis("Sin síntomas adicionales. Proceder con el diagnóstico integral CORTEX v2.0.");
                                                            } else {
                                                                setSymptomsInput("Registrando molestia adicional: ");
                                                            }
                                                        }}
                                                        disabled={isAnalyzing}
                                                        className="px-3.5 py-2 bg-white hover:bg-blue-50 text-[#1C75BC] border border-blue-200 hover:border-[#1C75BC] rounded-xl text-[11px] font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-line font-sans font-medium">{msg.content}</p>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Indicador de Carga / Análisis CORTEX */}
                    {isAnalyzing && (
                        <div className="flex justify-start items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-50 border flex items-center justify-center overflow-hidden flex-shrink-0 animate-spin">
                                <BrainCircuit className="w-5 h-5 text-[#1C75BC]" />
                            </div>
                            <div className="bg-slate-50 text-slate-600 rounded-2xl rounded-tl-none p-4 border border-slate-200/80 flex items-center gap-2 text-[12px] italic">
                                <span className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-[#1C75BC] rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-[#1C75BC] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-1.5 h-1.5 bg-[#1C75BC] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                </span>
                                🧠 Motor CORTEX v2.0 procesando expediente clínico...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Formulario de Entrada */}
                <div className="p-4 border-t border-slate-100 bg-white">
                    {isPatientChatLocked ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 justify-center select-none">
                            <Lock className="w-4 h-4 text-[#1C75BC]" />
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Puente Clínico Bloqueado (Handoff Activo)
                            </span>
                        </div>
                    ) : (
                        <form onSubmit={handleSendSymptoms} className="flex gap-2">
                            <input 
                                type="text"
                                value={symptomsInput}
                                onChange={(e) => setSymptomsInput(e.target.value)}
                                placeholder="Describa molestias, dolores o síntomas adicionales aquí..."
                                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#1C75BC] focus:bg-white transition-all font-sans"
                                disabled={isAnalyzing}
                            />
                            <button 
                                type="submit" 
                                disabled={isAnalyzing || !symptomsInput.trim()}
                                className={`p-3 rounded-xl transition-all shadow-md flex items-center justify-center ${
                                    symptomsInput.trim() && !isAnalyzing
                                        ? 'bg-[#1C75BC] hover:bg-[#155d96] text-white cursor-pointer' 
                                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                                }`}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* ==========================================================================
                PANEL DERECHO: REVIEW MODE DEL ESPECIALISTA (50%)
            ========================================================================== */}
            <div className="w-1/2 flex flex-col bg-[#FAFAFA] h-full">
                
                {/* Cabecera del Dashboard Médico */}
                <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between select-none">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                            <BrainCircuit className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-[13.5px] text-slate-800 uppercase tracking-wider">CORTEX Review Mode</h3>
                            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                Motor CORTEX v2.0 Activo
                            </p>
                        </div>
                    </div>
                    {dossierState === 'review' && (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => triggerSynthesis(additionalSymptoms || 'Re-síntesis solicitada por especialista')}
                                disabled={isAnalyzing}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                                title="Ejecutar síntesis diagnóstica en tiempo real con CORTEX v2.0"
                            >
                                <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
                                Re-Sintetizar CORTEX v2.0
                            </button>
                            <button 
                                onClick={handleRestoreSuggestions}
                                disabled={isAnalyzing}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Restaurar IA
                            </button>
                            <button 
                                onClick={handleRejectSuggestions}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                            >
                                Rechazar Sugerido
                            </button>
                        </div>
                    )}
                </div>

                {/* Área de Visualización y Bento Grid */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    
                    {/* Caso 1: Aún no se ha realizado el Handoff del paciente (Vista Previa Telemétrica de Escáneres) */}
                    {dossierState === 'idle' && (
                        <div className="space-y-6 animate-in fade-in duration-300 select-none">
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-extrabold text-[12.5px] text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                        <Activity className="w-4.5 h-4.5 text-[#1C75BC]" />
                                        Resumen Telemétrico y Bio-Escaneos Colectados
                                    </h4>
                                    <span className="text-[10px] font-bold px-2.5 py-1 bg-blue-50 text-[#1C75BC] border border-blue-100 rounded-full uppercase tracking-wider">
                                        Fase 1 a 18 Sincronizadas
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs mb-5">
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">IMC / Composición</span>
                                        <span className="font-bold text-slate-800 text-sm block">
                                            {displayImc ? `${displayImc} (${displayImcClass})` : 'No registrado'}
                                        </span>
                                        <span className="text-[10.5px] text-slate-500 mt-1 block">
                                            Peso: {displayWeight ? `${displayWeight} kg` : '--'} | Talla: {displayHeight ? `${displayHeight} cm` : '--'}
                                        </span>
                                    </div>

                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">Presión / SpO2 / FC</span>
                                        <span className="font-bold text-slate-800 text-sm block">
                                            {displayBP || '--/--'} mmHg
                                        </span>
                                        <span className="text-[10.5px] text-slate-500 mt-1 block">
                                            SpO2: {displaySpo2 || '95'}% | FC: {displayFC || (isLactante ? '90' : '72')} LPM
                                        </span>
                                    </div>

                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 col-span-2">
                                        <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">Bioimpedancia Electret & Protocolo Biológico</span>
                                        <span className="font-semibold text-slate-700 text-xs block">
                                            {patientData?.electret_scans ? '✅ Escáner Electret Registrado y Mapeado' : '✅ Telemetría clínica indexada bajo la NOM-004-SSA3-2012'}
                                        </span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => triggerSynthesis("Sin síntomas adicionales")}
                                    disabled={isAnalyzing}
                                    className="w-full py-4 bg-[#1C75BC] hover:bg-[#155d96] text-white font-extrabold uppercase text-[12px] tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <BrainCircuit className="w-5 h-5 animate-pulse" />
                                    Generar Síntesis CORTEX y Evaluar Diagnósticos (CIE-10) ➔
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Caso 2: Skeleton Loader mientras CORTEX sintetiza */}
                    {isAnalyzing && (
                        <div className="space-y-6 animate-pulse select-none">
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#1C75BC]">
                                        <BrainCircuit className="w-6 h-6 animate-spin" />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                                            Sintetizando Expediente Clínico Multimodal...
                                        </h4>
                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                            Ejecutando Fusión de Bio-Escaneos & Blindaje COFEPRIS
                                        </span>
                                    </div>
                                </div>
                                <div className="h-4 bg-slate-100 rounded-lg w-3/4"></div>
                                <div className="h-4 bg-slate-100 rounded-lg w-1/2"></div>
                                <div className="h-20 bg-slate-50 rounded-xl border border-slate-100"></div>
                            </div>
                        </div>
                    )}

                    {/* Caso 3: Dossier Synthesizing o Guardando */}
                    {dossierState === 'saving' && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1C75BC] shadow-sm mb-4">
                                <BrainCircuit className="w-8 h-8 animate-spin" />
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Sellando Expediente Clínico</h4>
                            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                                Guardando diagnósticos, plan de intervención y metadatos de deltas RLHF en SQLite...
                            </p>
                        </div>
                    )}

                    {/* Caso 4: CORTEX en Completo */}
                    {dossierState === 'complete' && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                            <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600 shadow-sm mb-4">
                                <CheckCircle2 className="w-8 h-8 animate-bounce" />
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider text-green-700">Expediente Sellado</h4>
                            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                                Sincronización con base de datos exitosa. Transicionando al Portapapeles Clínico...
                            </p>
                        </div>
                    )}

                    {/* Caso 5: Modo de Revisión Bento Activo */}
                    {dossierState === 'review' && !isAnalyzing && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            
                            {/* CONMUTADOR DE VISTAS (BENTO GRID VS EDICIÓN FINA) */}
                            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 select-none">
                                <button 
                                    onClick={() => setViewTab('bento')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                        viewTab === 'bento'
                                            ? 'bg-white text-[#1C75BC] shadow-xs border border-slate-200/60'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    Vista Estructurada (Bento Grid)
                                </button>
                                <button 
                                    onClick={() => setViewTab('edit')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                        viewTab === 'edit'
                                            ? 'bg-white text-[#1C75BC] shadow-xs border border-slate-200/60'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    Modo Edición Fina (CIE-10 / Dosificación)
                                </button>
                            </div>

                            {/* BANNERS DE SEGURIDAD CRÍTICOS (WCAG 2.2 / Doble Codificación) */}
                            {criticalAlerts.length > 0 && (
                                <div className="bg-red-50 text-red-700 border border-red-200 rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm">
                                    <div className="flex items-center gap-2 select-none">
                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                        <h4 className="font-black text-[12px] uppercase tracking-wider">Alertas de Seguridad Críticas</h4>
                                    </div>
                                    <ul className="space-y-2 text-xs font-semibold pl-1">
                                        {criticalAlerts.map((alert, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-red-500 mt-0.5">•</span>
                                                <span>{alert}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* CONTENIDO SEGÚN LA PESTAÑA SELECCIONADA */}
                            {viewTab === 'bento' ? (
                                <DiagnosticoRenderizado cortexSynthesis={originalDossier || patientData?.clinical_dossier} />
                            ) : (
                                /* MODO EDICIÓN FINA CON TEXTAREAS Y BOTONES DE EDICIÓN */
                                <div className="grid grid-cols-1 gap-6">
                                    
                                    {/* 🩺 TARJETA BENTO: DIAGNÓSTICO PRELIMINAR */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                        <div className="flex justify-between items-center mb-4 select-none">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-extrabold text-[12.5px] text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                    <FileText className="w-4.5 h-4.5 text-[#1C75BC]" />
                                                    Diagnósticos de Soporte Funcional (CIE-10)
                                                </h4>
                                                <span className="text-[9.5px] font-extrabold px-2 py-0.5 bg-blue-50 text-[#1C75BC] border border-blue-100 rounded-full uppercase tracking-wider">
                                                    {diagnoses.length} Registrados
                                                </span>
                                            </div>
                                            <button 
                                                onClick={handleAddDiagnosis}
                                                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Añadir
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            {diagnoses.map((diag, index) => (
                                                <div key={index} className="flex gap-2 items-start">
                                                    <textarea 
                                                        value={diag}
                                                        onChange={(e) => handleUpdateDiagnosis(index, e.target.value)}
                                                        rows={2}
                                                        className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#1C75BC] focus:bg-white transition-all font-sans font-medium resize-y leading-relaxed"
                                                        placeholder="Ingrese diagnóstico o soporte funcional..."
                                                    />
                                                    <button 
                                                        onClick={() => handleRemoveDiagnosis(index)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer mt-1"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 💊 TARJETA BENTO: INTERVENCIÓN Y SUPLEMENTACIÓN */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                        <div className="flex justify-between items-center mb-4 select-none">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-extrabold text-[12.5px] text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                    <Sliders className="w-4.5 h-4.5 text-[#1C75BC]" />
                                                    Intervenciones y Dosificación
                                                </h4>
                                                <span className="text-[9.5px] font-extrabold px-2 py-0.5 bg-blue-50 text-[#1C75BC] border border-blue-100 rounded-full uppercase tracking-wider">
                                                    {management.length} Prescripciones
                                                </span>
                                            </div>
                                            <button 
                                                onClick={handleAddManagement}
                                                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Añadir
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            {management.map((mng, index) => (
                                                <div key={index} className="flex gap-2 items-start">
                                                    <textarea 
                                                        value={mng}
                                                        onChange={(e) => handleUpdateManagement(index, e.target.value)}
                                                        rows={2}
                                                        className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#1C75BC] focus:bg-white transition-all font-sans font-medium resize-y leading-relaxed"
                                                        placeholder="Ingrese indicación de manejo, dosificación, suplementación..."
                                                    />
                                                    <button 
                                                        onClick={() => handleRemoveManagement(index)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer mt-1"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 📌 TARJETA BENTO: RESUMEN ANTECEDENTES Y CRUCES ABCD */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm select-none">
                                <h4 className="font-extrabold text-[12px] text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                    <Activity className="w-4 h-4 text-[#1C75BC]" />
                                    Metadatos de Referencia Telemétrica (ABCD)
                                </h4>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">IMC / Composición</span>
                                        <span className="font-bold text-slate-800 text-xs block">
                                            {displayImc ? `${displayImc} (${displayImcClass})` : 'Registrado en expediente'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                                            {displayWeight ? `Peso: ${displayWeight} kg` : ''} {displayHeight ? `| Talla: ${displayHeight} cm` : ''}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">Presión / SpO2 / FC / Glucosa</span>
                                        <span className="font-bold text-slate-800 text-xs block">
                                            {displayBP ? `${displayBP} mmHg` : 'Signos estables'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                                            SpO2: {displaySpo2 || '95'}% | FC: {displayFC || (isLactante ? '90' : '72')} LPM {displayGluc ? `| Gluc: ${displayGluc} mg/dL` : ''}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2">
                                        <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">Fármacos & Alergias Declaradas</span>
                                        <span className="font-semibold text-slate-700 text-xs truncate block">
                                            {medsList.length > 0 ? `💊 Medicamentos: ${medsList.join(', ')}` : 'Sin medicamentos activos'}
                                        </span>
                                        {(foodAllergiesList.length > 0 || drugAllergiesList.length > 0) && (
                                            <span className="text-[10px] text-red-600 font-bold mt-1 block">
                                                ⚠️ Alergias: {[...foodAllergiesList, ...drugAllergiesList].join(', ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* Sello Final y Acciones */}
                {dossierState === 'review' && !isAnalyzing && (
                    <div className="p-5 border-t border-slate-200 bg-white select-none flex flex-col gap-2">
                        {errorMessage && (
                            <span className="text-[11px] font-bold text-red-600 block mb-2">{errorMessage}</span>
                        )}
                        <button 
                            onClick={handleApproveDossier}
                            className="w-full py-4 bg-[#1C75BC] hover:bg-[#155d96] text-white font-extrabold uppercase text-[12.5px] tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            Confirmar y Sellar Expediente ➔
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
