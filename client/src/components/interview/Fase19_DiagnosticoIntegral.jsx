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
    FileText 
} from 'lucide-react';
import tiloImg from '../../assets/tilo.png';

export default function Fase19_DiagnosticoIntegral({
    patientData,
    setPatientData,
    messages,
    setMessages,
    onPhaseComplete
}) {
    const citationId = patientData?.idCita || patientData?.citaId || 1;

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
                    avatar: tiloImg
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

    // --- ACCIÓN: Enviar respuesta de síntomas del paciente ---
    const handleSendSymptoms = async (e) => {
        e.preventDefault();
        if (!symptomsInput.trim()) return;

        const patientText = symptomsInput.trim();
        setAdditionalSymptoms(patientText);
        setSymptomsInput('');

        // 1. Agregar respuesta del paciente al chat
        if (setMessages) {
            setMessages(prev => [
                ...prev,
                {
                    role: 'user',
                    content: patientText
                }
            ]);
        }

        setIsAnalyzing(true);
        setDossierState('idle');

        // Simular delay de procesamiento cognitivo de CORTEX (1.5 segundos)
        setTimeout(async () => {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            try {
                const response = await fetch(`${apiUrl}/api/cortex/synthesize-dossier`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ citationId })
                });

                const data = await response.json();
                if (data.success && data.dossier) {
                    const dossier = data.dossier;
                    setOriginalDossier(dossier);
                    setDiagnoses(dossier.preliminary_diagnosis || []);
                    setManagement(dossier.suggested_management || []);
                    setCriticalAlerts(dossier.critical_alerts || []);
                    setDossierState('review');

                    // 2. Agregar mensaje de Handoff de Tilo
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
        }, 1800);
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
    const handleRestoreSuggestions = () => {
        if (originalDossier) {
            setDiagnoses(originalDossier.preliminary_diagnosis || []);
            setManagement(originalDossier.suggested_management || []);
        }
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
                        <span className="text-[9px] font-bold text-purple-600 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
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
                            <div className={`max-w-[80%] p-4 rounded-2xl text-[13px] leading-relaxed ${
                                msg.role === 'assistant' 
                                    ? 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50' 
                                    : 'bg-purple-600 text-white rounded-tr-none shadow-md shadow-purple-600/10'
                            }`}>
                                <p className="whitespace-pre-line font-sans">{msg.content}</p>
                            </div>
                        </div>
                    ))}

                    {/* Indicador de Carga / Análisis CORTEX */}
                    {isAnalyzing && (
                        <div className="flex justify-start items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-50 border flex items-center justify-center overflow-hidden flex-shrink-0 animate-spin">
                                <BrainCircuit className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-tl-none p-4 border border-slate-200/50 flex items-center gap-2 text-[12px] italic">
                                <span className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                </span>
                                🧠 Motor CORTEX procesando expediente clínico...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Formulario de Entrada */}
                <div className="p-4 border-t border-slate-100 bg-white">
                    {isPatientChatLocked ? (
                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3.5 flex items-center gap-3 justify-center select-none">
                            <Lock className="w-4 h-4 text-purple-600" />
                            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
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
                                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-purple-600 focus:bg-white transition-all font-sans"
                                disabled={isAnalyzing}
                            />
                            <button 
                                type="submit" 
                                disabled={isAnalyzing || !symptomsInput.trim()}
                                className={`p-3 rounded-xl transition-all shadow-md flex items-center justify-center ${
                                    symptomsInput.trim() && !isAnalyzing
                                        ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer' 
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
                        <div className="w-9 h-9 rounded-xl bg-purple-55 bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                            <BrainCircuit className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-[13.5px] text-slate-800 uppercase tracking-wider">CORTEX Review Mode</h3>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                Triage Aumentado por Humano (Sello Clínico)
                            </p>
                        </div>
                    </div>
                    {dossierState === 'review' && (
                        <div className="flex gap-2">
                            <button 
                                onClick={handleRestoreSuggestions}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                            >
                                Restaurar IA
                            </button>
                            <button 
                                onClick={handleRejectSuggestions}
                                className="px-3 py-1.5 bg-red-55 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                            >
                                Rechazar Sugerido
                            </button>
                        </div>
                    )}
                </div>

                {/* Área de Visualización y Bento Grid */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    
                    {/* Caso 1: Aún no se ha realizado el Handoff del paciente */}
                    {dossierState === 'idle' && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                            <div className="w-16 h-16 rounded-2xl bg-white border flex items-center justify-center text-slate-300 shadow-sm mb-4">
                                <Clock className="w-8 h-8 animate-pulse" />
                            </div>
                            <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Esperando Handoff Clínico</h4>
                            <p className="text-slate-400 text-xs max-w-xs mt-2 leading-relaxed">
                                El paciente debe responder la pregunta de seguridad final en el chat de Tilo para activar la síntesis del motor CORTEX.
                            </p>
                        </div>
                    )}

                    {/* Caso 2: Dossier Synthesizing o Cargando */}
                    {dossierState === 'saving' && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                            <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm mb-4">
                                <BrainCircuit className="w-8 h-8 animate-spin" />
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Sellando Expediente Clínico</h4>
                            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                                Guardando diagnósticos, plan de intervención y metadatos de deltas RLHF en SQLite...
                            </p>
                        </div>
                    )}

                    {/* Caso 3: CORTEX en Completo */}
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

                    {/* Caso 4: Modo de Revisión Bento Activo */}
                    {dossierState === 'review' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            
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

                            {/* BENTO GRID PRINCIPAL */}
                            <div className="grid grid-cols-1 gap-6">
                                
                                {/* 🩺 TARJETA BENTO: DIAGNÓSTICO PRELIMINAR */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-4 select-none">
                                        <h4 className="font-extrabold text-[12.5px] text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <FileText className="w-4.5 h-4.5 text-purple-600" />
                                            Diagnósticos de Soporte Funcional
                                        </h4>
                                        <button 
                                            onClick={handleAddDiagnosis}
                                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Añadir
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {diagnoses.map((diag, index) => (
                                            <div key={index} className="flex gap-2 items-center">
                                                <input 
                                                    type="text"
                                                    value={diag}
                                                    onChange={(e) => handleUpdateDiagnosis(index, e.target.value)}
                                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-purple-600 focus:bg-white transition-all font-sans font-medium"
                                                    placeholder="Ingrese diagnóstico o soporte funcional..."
                                                />
                                                <button 
                                                    onClick={() => handleRemoveDiagnosis(index)}
                                                    className="p-2 text-slate-400 hover:text-red-650 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
                                        <h4 className="font-extrabold text-[12.5px] text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <Sliders className="w-4.5 h-4.5 text-purple-600" />
                                            Intervenciones y Dosificación
                                        </h4>
                                        <button 
                                            onClick={handleAddManagement}
                                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Añadir
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {management.map((mng, index) => (
                                            <div key={index} className="flex gap-2 items-center">
                                                <input 
                                                    type="text"
                                                    value={mng}
                                                    onChange={(e) => handleUpdateManagement(index, e.target.value)}
                                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-purple-600 focus:bg-white transition-all font-sans font-medium"
                                                    placeholder="Ingrese indicación de manejo, dosificación, suplementación..."
                                                />
                                                <button 
                                                    onClick={() => handleRemoveManagement(index)}
                                                    className="p-2 text-slate-400 hover:text-red-650 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 📌 TARJETA BENTO: RESUMEN ANTECEDENTES Y CRUCES ABCD */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm select-none">
                                    <h4 className="font-extrabold text-[12px] text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                        <Activity className="w-4 h-4" />
                                        Metadatos de Referencia (ABCD)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">IMC / Composición</span>
                                            <span className="font-semibold text-slate-700">
                                                {patientData?.imc ? `${patientData.imc} (${patientData.imcEstado || 'Estable'})` : 'No registrado'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">Presión / Glucosa</span>
                                            <span className="font-semibold text-slate-700">
                                                {patientData?.signosVitales?.ta ? `${patientData.signosVitales.ta} mmHg / ${patientData.signosVitales.glucosa || '--'} mg/dL` : 'No registrado'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2">
                                            <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">Fármacos Registrados</span>
                                            <span className="font-semibold text-slate-700 truncate block">
                                                {patientData?.history?.medications?.length > 0 
                                                    ? patientData.history.medications.map(m => m.name).join(', ') 
                                                    : 'Ninguno'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>

                {/* Sello Final y Acciones */}
                {dossierState === 'review' && (
                    <div className="p-5 border-t border-slate-200 bg-white select-none flex flex-col gap-2">
                        {errorMessage && (
                            <span className="text-[11px] font-bold text-red-600 block mb-2">{errorMessage}</span>
                        )}
                        <button 
                            onClick={handleApproveDossier}
                            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-extrabold uppercase text-[12.5px] tracking-wider rounded-xl transition-all shadow-lg shadow-purple-600/10 hover:shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            Confirmar y Sellar Expediente ➔
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
