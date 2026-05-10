import React, { useState, useEffect, useRef } from 'react';
import { Send, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import tiloImg from '../../assets/tilo.png';
import { strictBooleanValidator } from '../../utils/utils';

// Helper to extract numbers from metric input
const normalizeMetricMatch = (text) => {
    const match = text.match(/\d+(\.\d+)?/);
    if (!match) return null;
    let val = parseFloat(match[0]);
    // Normalizar si se ingreso en centimetros en lugar de metros para la talla
    // Asumimos que cualquier valor > 3 para talla es probablemente cms.
    if (val > 3 && text.toLowerCase().includes('m') === false) { // heuristica basica
        val = val / 100;
    }
    return val;
};

const Fase12_Biometria = ({
    onPhaseComplete,
    patientData,
    setPatientData
}) => {
    const ptCtx = patientData?.profile?.pediatric_profile;
    const isMinor = ptCtx?.is_minor === true;
    const pName = (patientData?.identityLock?.name || patientData?.identificacion?.nombres || "la menor").split(' ')[0];

    // ESTADO DEL COMPONENTE
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: isMinor
                ? `¿Cuenta con algún registro reciente del peso o estatura de ${pName} que podamos ingresar al sistema? (Sí / No)`
                : "¿Cuenta con algún registro reciente de su peso o estatura que podamos ingresar al sistema? (Sí / No)",
            avatar: tiloImg
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [internalStep, setInternalStep] = useState('BIO_START');

    // DATOS RECOLECTADOS (ESTADO LOCAL)
    const [biometria, setBiometria] = useState({
        vitals: {
            height: patientData?.vitals?.height || null,
            weight: patientData?.vitals?.weight || null,
            waist: patientData?.vitals?.waist || null,
            hip: patientData?.vitals?.hip || null,
            blood_pressure: patientData?.vitals?.blood_pressure || "",
            spo2: patientData?.vitals?.spo2 || null,
            hr: patientData?.vitals?.hr || null,
            temperature: patientData?.vitals?.temperature || null,
            rr: patientData?.vitals?.rr || null,
            glucose: patientData?.vitals?.glucose || null
        }
    });

    const [clinicalFlags, setClinicalFlags] = useState([]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll a últimos mensajes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // HANDLER DE ENTRADA (MÁQUINA DE ESTADOS COMPLEJA)
    const handleSend = () => {
        if (!inputValue.trim()) return;

        const userMsg = inputValue.trim();
        const lower = userMsg.toLowerCase();

        // Agregar mensaje de usuario al layout
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setInputValue("");
        inputRef.current?.focus();

        const addBotMsg = (msg) => setMessages(prev => [...prev, { role: "assistant", content: msg, avatar: tiloImg }]);

        // -------------------------------------------------------------
        // BIO_START
        // -------------------------------------------------------------
        if (internalStep === 'BIO_START') {
            const isValid = strictBooleanValidator(userMsg);
            if (isValid === false) {
                // Skips biometrics completely
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, ...biometria.vitals },
                    clinical_flags: [...(prev.clinical_flags || []), ...clinicalFlags]
                }));
            }
                addBotMsg("Entendido. Pasando a la siguiente sección...");
                setInternalStep('FINALIZED');
                if (onPhaseComplete) onPhaseComplete('PHASE_13_SPECIAL_CONTEXT');
            } else if (isValid === true) {
                addBotMsg(isMinor ? `¿Cuál es la estatura de ${pName} en metros? (Ej: 1.65)` : "¿Cuál es su estatura en metros? (Ej: 1.65)");
                setInternalStep('HEIGHT');
            } else {
                addBotMsg(isMinor ? "Por favor, responde Sí o No." : "Por favor, responda Sí o No.");
            }
        }

        // -------------------------------------------------------------
        // HEIGHT
        // -------------------------------------------------------------
        else if (internalStep === 'HEIGHT') {
            const val = normalizeMetricMatch(userMsg);
            if (!val) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 1.65)" : "Por favor ingrese un número válido (ej: 1.65)");
                return;
            }
            setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, height: val } }));
            addBotMsg(isMinor ? `¿Cuál es el peso de ${pName} en kilogramos? (Ej: 65 o 65.5)` : "¿Cuál es su peso en kilogramos? (Ej: 65 o 65.5)");
            setInternalStep('WEIGHT');
        }

        // -------------------------------------------------------------
        // WEIGHT
        // -------------------------------------------------------------
        else if (internalStep === 'WEIGHT') {
            const val = normalizeMetricMatch(userMsg);
            if (!val) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 65.5)" : "Por favor ingrese un número válido (ej: 65.5)");
                return;
            }
            setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, weight: val } }));
            addBotMsg(isMinor ? `¿Cuál es la circunferencia de cintura de ${pName} en centímetros? (Ej: 80)` : "¿Cuál es su circunferencia de cintura en centímetros? (Ej: 80)");
            setInternalStep('WAIST');
        }

        // -------------------------------------------------------------
        // WAIST
        // -------------------------------------------------------------
        else if (internalStep === 'WAIST') {
            const val = normalizeMetricMatch(userMsg);
            if (!val) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 80)" : "Por favor ingrese un número válido (ej: 80)");
                return;
            }
            setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, waist: val } }));
            addBotMsg(isMinor ? `¿Cuál es la circunferencia de cadera de ${pName} en centímetros? (Ej: 95)` : "¿Cuál es su circunferencia de cadera en centímetros? (Ej: 95)");
            setInternalStep('HIP');
        }

        // -------------------------------------------------------------
        // HIP
        // -------------------------------------------------------------
        else if (internalStep === 'HIP') {
            const val = normalizeMetricMatch(userMsg);
            if (!val) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 95)" : "Por favor ingrese un número válido (ej: 95)");
                return;
            }
            setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, hip: val } }));
            addBotMsg(isMinor ? `¿Cuál es la presión arterial de ${pName}? (Ej: 120/80)` : "¿Cuál es su presión arterial? (Ej: 120/80)");
            setInternalStep('BP');
        }

        // -------------------------------------------------------------
        // BP (Blood Pressure)
        // -------------------------------------------------------------
        else if (internalStep === 'BP') {
            let finalBP = userMsg;

            // Auto-fix: "120 80" -> "120/80"
            if (userMsg.match(/^\d{2,3} \d{2,3}$/)) {
                finalBP = userMsg.replace(" ", "/");
            } else if (userMsg.match(/^\d{5,6}$/)) {
                const mid = 3;
                finalBP = userMsg.slice(0, mid) + "/" + userMsg.slice(mid);
            }

            const regexBP = /^\d{2,3}\/\d{2,3}$/;
            if (!regexBP.test(finalBP) && !finalBP.toLowerCase().includes("na") && !finalBP.toLowerCase().includes("no")) {
                addBotMsg(isMinor ? "Formato inválido. Use '120/80' o '120 80' (Con espacio)." : "Formato inválido. Use '120/80' o '120 80' (Con espacio).");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (regexBP.test(finalBP)) {
                const [sys, dia] = finalBP.split('/').map(Number);
                if (sys > 160 || dia > 100) {
                    newFlags.push("URGENCIA_HIPERTENSIVA");
                    alertMsg = "🚨 ALERTA ROJA: CRISIS HIPERTENSIVA DETECTADA (>160/100). SUGIERA ATENCIÓN MÉDICA INMEDIATA.\\n\\n";
                }
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, blood_pressure: finalBP } }));

            addBotMsg(`${alertMsg}${isMinor ? `¿Cuál es la saturación de oxígeno de ${pName}? (Ej: 98)` : "¿Cuál es su saturación de oxígeno? (Ej: 98)"}`);
            setInternalStep('SPO2');
        }

        // -------------------------------------------------------------
        // SPO2
        // -------------------------------------------------------------
        else if (internalStep === 'SPO2') {
            const val = parseInt(userMsg);
            if ((isNaN(val) || val < 50 || val > 100) && !lower.includes("na") && !lower.includes("no")) {
                addBotMsg(isMinor ? "Valor inválido (50-100%). O di 'NO' o 'NA' si no tienes el dato." : "Valor inválido (50-100%). O diga 'NO' o 'NA' si no tiene el dato.");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (!isNaN(val)) {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, spo2: val } }));
                if (val < 90) {
                    newFlags.push("HIPOXIA");
                    alertMsg = "🚨 ALERTA: HIPOXIA (SpO2 < 90%).\\n\\n";
                }
            } else {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, spo2: null } }));
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            addBotMsg(`${alertMsg}${isMinor ? `¿Cuál es la frecuencia cardíaca de ${pName}? (Ej: 75)` : "¿Cuál es su frecuencia cardíaca? (Ej: 75)"}`);
            setInternalStep('FC');
        }

        // -------------------------------------------------------------
        // FC (Heart Rate)
        // -------------------------------------------------------------
        else if (internalStep === 'FC') {
            const val = parseInt(userMsg);
            if ((isNaN(val) || val < 30 || val > 250) && !lower.includes("na") && !lower.includes("no")) {
                addBotMsg(isMinor ? "Valor inválido (30-250 bpm). O di 'NO' o 'NA' si no tienes el dato." : "Valor inválido (30-250 bpm). O diga 'NO' o 'NA' si no tiene el dato.");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (!isNaN(val)) {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, hr: val } }));
                if (val > 100) {
                    newFlags.push("TAQUICARDIA");
                    alertMsg = "🚨 ALERTA: TAQUICARDIA (FC > 100).\\n\\n";
                }
            } else {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, hr: null } }));
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            addBotMsg(`${alertMsg}${isMinor ? `¿Cuál es la temperatura de ${pName}? (Ej: 36.5)` : "¿Cuál es su temperatura? (Ej: 36.5)"}`);
            setInternalStep('TEMP');
        }

        // -------------------------------------------------------------
        // TEMP
        // -------------------------------------------------------------
        else if (internalStep === 'TEMP') {
            const val = parseFloat(userMsg);
            if ((isNaN(val) || val < 30 || val > 45) && !lower.includes("na") && !lower.includes("no")) {
                addBotMsg(isMinor ? "Valor inválido (30-45 °C). O di 'NO' o 'NA' si no tienes el dato." : "Valor inválido (30-45 °C). O diga 'NO' o 'NA' si no tiene el dato.");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (!isNaN(val)) {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, temperature: val } }));
                if (val > 37.5) {
                    newFlags.push("FIEBRE");
                    alertMsg = "🚨 ALERTA: FIEBRE (> 37.5°C).\\n\\n";
                }
            } else {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, temperature: null } }));
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            addBotMsg(`${alertMsg}${isMinor ? `¿Cuál es la frecuencia respiratoria de ${pName}? (Ej: 16)` : "¿Cuál es su frecuencia respiratoria? (Ej: 16)"}`);
            setInternalStep('FR');
        }

        // -------------------------------------------------------------
        // FR (Respiratory Rate)
        // -------------------------------------------------------------
        else if (internalStep === 'FR') {
            const val = parseInt(userMsg);
            if ((isNaN(val) || val < 8 || val > 60) && !lower.includes("na") && !lower.includes("no")) {
                addBotMsg(isMinor ? "Valor inválido (8-60 rpm). O di 'NO' o 'NA' si no tienes el dato." : "Valor inválido (8-60 rpm). O diga 'NO' o 'NA' si no tiene el dato.");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (!isNaN(val)) {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, rr: val } }));
                if (val > 24) {
                    newFlags.push("TAQUIPNEA");
                    alertMsg = "🚨 ALERTA: TAQUIPNEA (> 24 rpm).\\n\\n";
                }
            } else {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, rr: null } }));
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            addBotMsg(`${alertMsg}${isMinor ? `¿Conoces el nivel de glucosa capilar reciente de ${pName} o se lo tomaremos ahora? (Si aplica, ingresa en mg/dL. Si no, di 'No').` : "¿Conoce su nivel de glucosa capilar reciente o la tomaremos ahora? (Si aplica, ingrese en mg/dL. Si no, diga 'No')."}`);
            setInternalStep('GLUCOSE');
        }

        // -------------------------------------------------------------
        // GLUCOSE
        // -------------------------------------------------------------
        else if (internalStep === 'GLUCOSE') {
            const val = parseInt(userMsg);
            let alertMsg = "";
            let newFlags = [];

            if (!isNaN(val)) {
                if (val < 70) {
                    newFlags.push("HIPOGLUCEMIA");
                    alertMsg = "🚨 ALERTA: HIPOGLUCEMIA (< 70 mg/dL).\\n\\n";
                }
                else if (val > 250) {
                    newFlags.push("URGENCIA_HIPERGLUCEMIA");
                    alertMsg = "🚨 ALERTA ROJA: GLUCOSA CRÍTICA (>250 mg/dL). RIESGO DE CETOACIDOSIS. ACUDA A URGENCIAS.\\n\\n";
                }
                else if (val > 180) {
                    newFlags.push("HIPERGLUCEMIA");
                    alertMsg = "🚨 ALERTA: HIPERGLUCEMIA (> 180 mg/dL).\\n\\n";
                }
            }

            const glucosaVal = (isNaN(val)) ? null : val;

            // Build the final internal state before committing externally
            const finalBio = {
                ...biometria,
                vitals: { ...biometria.vitals, glucose: glucosaVal }
            };
            setBiometria(finalBio);

            const finalFlags = [...clinicalFlags, ...newFlags];
            setClinicalFlags(finalFlags);

            // Inyectamos todo el progreso al estado de la APP
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, ...finalBio.vitals },
                    clinical_flags: [...(prev.clinical_flags || []), ...finalFlags]
                }));
            }

            addBotMsg(`${alertMsg}📢 ${isMinor ? "Dile al paciente:\\n\\n'Perfecto, terminamos las mediciones. Regresemos al escritorio para unas últimas preguntas.'" : "Diga al paciente:\\n\\n'Perfecto, terminamos las mediciones. Regresemos al escritorio para unas últimas preguntas.'"}`);
            setInternalStep('FINALIZED');
            if (onPhaseComplete) onPhaseComplete('PHASE_13_SPECIAL_CONTEXT');
        }
    };

    // HANDLER BÁSICO TECLAS
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    };


    // -------------------------------------------------------------
    // RENDERIZADO DEL CHAT
    // -------------------------------------------------------------
    return (
        <div className="flex h-full w-full bg-white">
            <div className="flex-1 flex flex-col pt-8 max-w-3xl mx-auto h-[100vh] relative">

                {/* HEADER - Indicador de Fase */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-sm z-10 flex items-center px-8 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-sm font-medium tracking-wide text-gray-500">FASE 12: SIGNOS VITALES Y BIOMETRÍA</span>
                    </div>
                </div>

                {/* ÁREA DE MENSAJES */}
                <div className="flex-1 overflow-y-auto px-8 pt-20 pb-32 scroll-smooth">
                    <div className="flex flex-col space-y-6 max-w-2xl mx-auto">
                        {messages.map((msg, idx) => {
                            const isBot = msg.role === 'assistant';
                            return (
                                <div key={idx} className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'} animate-fade-in-up`}>
                                    <div className={`flex gap-3 max-w-[85%] ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
                                        {/* Avatar IA */}
                                        {isBot && (
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 border border-gray-100 shadow-sm overflow-hidden bg-white">
                                                <img src={msg.avatar || tiloImg} alt="Tilo" className="w-full h-full object-cover" />
                                            </div>
                                        )}

                                        {/* Burbuja de Texto */}
                                        <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed relative group ${isBot
                                            ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                                            : 'bg-blue-600 text-white rounded-tr-sm'
                                            }`}>
                                            <ReactMarkdown className={`prose prose-sm max-w-none ${isBot ? 'prose-p:leading-relaxed prose-p:mb-2 prose-strong:text-blue-700' : 'text-white'}`}>
                                                {msg.content}
                                            </ReactMarkdown>

                                            {/* Timestamp sutil */}
                                            {!isBot && (
                                                <div className="absolute -bottom-5 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                    <Check className="w-3 h-3 text-blue-500" />
                                                    <span className="text-[10px] text-gray-400 font-medium">✓ Enviado</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* ÁREA DE ENTRADA (INPUT) */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pb-8 pt-12 px-8">
                    <div className="max-w-2xl mx-auto relative group">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={internalStep === 'FINALIZED' ? "Módulo completado..." : "Escribe tu respuesta..."}
                            disabled={internalStep === 'FINALIZED'}
                            className="w-full pl-6 pr-14 py-4 bg-white border border-gray-200 rounded-full focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-700 shadow-sm placeholder:text-gray-400 text-[15px] disabled:opacity-50 disabled:bg-gray-50"
                            autoFocus
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || internalStep === 'FINALIZED'}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-all shadow-sm flex items-center justify-center h-10 w-10 active:scale-95"
                        >
                            <Send size={18} className="ml-0.5" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Fase12_Biometria;
