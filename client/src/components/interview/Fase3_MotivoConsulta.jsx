import React, { useState, useEffect, useRef } from 'react';
import { formatText } from '../../utils/utils';
import VisualBodyMap from '../VisualBodyMap';

const Fase3_MotivoConsulta = ({ initialChatHistory, onPhaseComplete, patientData, setPatientData }) => {
    const updateClinicalContext = (updates) => {
        setPatientData(prev => ({
            ...prev,
            clinical_context: {
                ...(prev.clinical_context || {}),
                ...updates,
                ai_analysis: {
                    ...(prev.clinical_context?.ai_analysis || {}),
                    ...(updates.ai_analysis || {})
                }
            }
        }));
    };

    const [messages, setMessages] = useState(initialChatHistory || []);
    const [inputValue, setInputValue] = useState("");
    const [step, setStep] = useState('clinica_triage_start');
    const [currentOptions, setCurrentOptions] = useState([
        { label: "⚖️ Bajar de Peso", value: "GOAL_WEIGHT_LOSS" },
        { label: "💪 Ganar Músculo", value: "GOAL_MUSCLE" },
        { label: "🏅 Rendimiento Deportivo", value: "GOAL_SPORT" },
        { label: "🩺 Control Clínico", value: "GOAL_CLINICAL" },
        { label: "🤰 Etapa de Vida", value: "GOAL_LIFE_STAGE" },
        { label: "🥗 Aprender a Comer", value: "GOAL_EDUCATION" }
    ]);
    const [isTyping, setIsTyping] = useState(false);

    // Auto-scroll
    const messagesEndRef = useRef(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping, step]);

    // Initial setup if options are needed    // Initialize Flow
    useEffect(() => {
        // If we want any specific initialization logic later
    }, [step]);

    const handleSend = (value) => {
        const textToProcess = value || inputValue;
        if (!textToProcess.trim() && step !== 'clinica_body_map') return;

        // Limpiar input y enviar mensaje del usuario (excepto para body map completion)
        setInputValue("");
        if (textToProcess !== 'BODY_MAP_COMPLETE') {
            setMessages(prev => [...prev, { role: "user", content: formatText(textToProcess) }]);
        }

        setCurrentOptions([]);
        setIsTyping(true);

        setTimeout(() => {
            setIsTyping(false);
            const userMsg = textToProcess;
            const cleanText = formatText(userMsg);
            let nextStep = step;
            let responseMsg = "";
            let newOptions = [];

            switch (step) {
                // PASO A: DEFINICIÓN DE OBJETIVO (PH3-GOAL)
                case 'clinica_triage_start': {
                    const goalMap = {
                        'GOAL_WEIGHT_LOSS': { avatar: 'METABOLIC', risk: 'LOW', label: 'Bajar de Peso' },
                        'GOAL_MUSCLE': { avatar: 'PERFORMANCE', risk: 'LOW', label: 'Ganar Músculo' },
                        'GOAL_SPORT': { avatar: 'PERFORMANCE', risk: 'HIGH', label: 'Rendimiento Deportivo' },
                        'GOAL_CLINICAL': { avatar: 'CLINICAL', risk: 'MEDIUM', label: 'Control Clínico' },
                        'GOAL_LIFE_STAGE': { avatar: 'CLINICAL', risk: 'MEDIUM', label: 'Etapa de Vida' },
                        'GOAL_EDUCATION': { avatar: 'LONGEVITY', risk: 'LOW', label: 'Aprender a Comer' }
                    };

                    // Allow free text or mapping
                    let config;
                    if (goalMap[userMsg]) {
                        // User clicked an option
                        config = goalMap[userMsg];
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            newMsgs[newMsgs.length - 1].content = config.label;
                            return newMsgs;
                        });
                    } else {
                        config = { avatar: 'METABOLIC', risk: 'LOW', label: cleanText };
                    }

                    updateClinicalContext({
                        primary_motive: config.label,
                        goal: userMsg,
                        ai_analysis: {
                            avatar_assigned: config.avatar,
                            risk_level: config.risk,
                            detected_tags: patientData.clinical_context?.ai_analysis?.detected_tags || []
                        },
                        history: [...(patientData.clinical_context?.history || []), {
                            question: "Objetivo Principal",
                            answer: config.label,
                            timestamp: new Date().toISOString()
                        }],
                        secondary_symptoms: ""
                    });

                    responseMsg = `Entendido (${config.label}). Hemos configurado su perfil clínico.\n\nPara ser más precisos, por favor **indique en el mapa** dónde siente mayor molestia o si hay zonas específicas a tratar. Haga clic en *Completar Mapa* cuando termine.`;
                    nextStep = 'clinica_body_map';
                    break;
                }

                // PASO B: MAPA DEL DOLOR
                case 'clinica_body_map': {
                    // Logic is handled by handleBodyMapComplete below.
                    // But if fallback button is clicked:
                    if (userMsg === 'BODY_MAP_COMPLETE') {
                        responseMsg = "Entendido. ¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?";
                        nextStep = 'clinica_triage_symptoms';
                    }
                    break;
                }

                // PASO C: SINTOMATOLOGÍA ADICIONAL Y MOTOR DE EMPATÍA
                case 'clinica_triage_symptoms': {
                    const symptomsInput = cleanText;

                    updateClinicalContext({
                        secondary_symptoms: (patientData.clinical_context?.secondary_symptoms || "") + symptomsInput,
                        history: [...(patientData.clinical_context?.history || []), {
                            question: "Sintomatología Adicional",
                            answer: symptomsInput,
                            timestamp: new Date().toISOString()
                        }]
                    });

                    // Empathy Engine V3.0
                    const highSeverityKeywords = ['cancer', 'cáncer', 'matriz', 'amputa', 'duelo', 'falleci', 'muerte', 'perdí', 'tumor', 'maligno', 'quimio'];
                    const sensitiveKeywords = ['quiste', 'biopsia', 'seno', 'mama', 'oncologo'];
                    const surgeryKeywords = ['operacion', 'cirugia', 'cesarea', 'apendice', 'vesicula', 'histerectomia'];

                    const isHighSeverity = highSeverityKeywords.some(kw => symptomsInput.toLowerCase().includes(kw));
                    const isSensitive = sensitiveKeywords.some(kw => symptomsInput.toLowerCase().includes(kw));
                    const isSurgery = surgeryKeywords.some(kw => symptomsInput.toLowerCase().includes(kw));

                    if (isHighSeverity) {
                        nextStep = 'clinica_triage_containment'; // Trigger containment immediately without msg here
                        setTimeout(() => handleContainmentSequence(symptomsInput), 100);
                        return; // Exit early to avoid sending empty responseMsg
                    } else if (isSensitive) {
                        responseMsg = "Entiendo la importancia de lo que menciona. Para poder apoyarle mejor, ¿le gustaría compartir un poco más sobre este diagnóstico o prefiere que lo abordemos con detalle directamente en la consulta?";
                        nextStep = 'clinica_triage_sensitive_followup';
                    } else if (isSurgery) {
                        responseMsg = "Entendido. Dado que menciona un procedimiento quirúrgico, ¿hace cuánto tiempo fue o cuándo está programado?";
                        nextStep = 'intro_triage_surgery';
                    } else {
                        // Flujo Normal -> Cerrar Fase 3
                        onPhaseComplete(messages);
                        return;
                    }
                    break;
                }

                // SUB-RUTINA A: DETALLE SENSIBLE
                case 'clinica_triage_sensitive_followup': {
                    updateClinicalContext({
                        secondary_symptoms: patientData.clinical_context?.secondary_symptoms + ` [DETALLE SENSIBLE: ${cleanText}]`,
                        history: [...(patientData.clinical_context?.history || []), {
                            question: "Detalle Sensible (Seguimiento)",
                            answer: cleanText,
                            timestamp: new Date().toISOString()
                        }]
                    });

                    onPhaseComplete(messages);
                    return;
                }

                // SUB-RUTINA B: QUIRÚRGICA
                case 'intro_triage_surgery': {
                    const lowerMsg = userMsg.toLowerCase();
                    let status = "NONE";
                    let msg = "";

                    if (lowerMsg.includes('pre') || lowerMsg.includes('prepara') || lowerMsg.includes('antes') || lowerMsg.includes('programada')) {
                        status = "PRE";
                        msg = "⚠️ ALERTA: Suspender suplementos anticoagulantes (Ajo, Omega-3, Ginkgo) 7 días antes.";
                    } else if (lowerMsg.includes('ya') || lowerMsg.includes('post') || lowerMsg.includes('pasó') || lowerMsg.includes('paso')) {
                        status = "POST";
                        msg = "⚠️ ALERTA: Validar alta médica antes de iniciar esfuerzo físico.";
                    }

                    updateClinicalContext({
                        history: [...(patientData.clinical_context?.history || []), {
                            question: "Estatus Quirúrgico",
                            answer: msg ? `${status} (${msg})` : "Sin Intervenciones Recientes",
                            timestamp: new Date().toISOString()
                        }]
                    });

                    // Add the alert as an assistant message directly before closing Phase 3,
                    // so the transition to Phase 4 makes sense.
                    if (msg) {
                        setMessages(prev => [...prev, { role: "assistant", content: `${msg}\n\nTomado en cuenta. He registrado su estatus.` }]);
                        setTimeout(() => onPhaseComplete(messages), 1500);
                        return;
                    } else {
                        onPhaseComplete(messages);
                        return;
                    }
                }

                default:
                    responseMsg = "Fase 3 Completada.";
                    onPhaseComplete(messages);
                    return;
            }

            if (responseMsg) {
                setMessages(prev => [...prev, { role: "assistant", content: responseMsg, options: newOptions }]);
            }
            setStep(nextStep);
            setCurrentOptions(newOptions);

        }, 600);
    };

    const handleContainmentSequence = (triggerText) => {
        // Sub-Rutina de Contención Temporizada
        const sensitiveKeywords = ['cancer', 'cáncer', 'tumor', 'falleci', 'muerte', 'matriz', 'duelo', 'luto', 'perdida', 'pérdida'];
        const matchedKw = sensitiveKeywords.find(kw => triggerText.toLowerCase().includes(kw)) || "Tema Sensible";

        updateClinicalContext({
            history: [...(patientData.clinical_context?.history || []), {
                question: "⚠️ Reporte de Sensibilidad",
                answer: `Tema identificado: "${matchedKw.toUpperCase()}". Protocolo de contención activado.`,
                timestamp: new Date().toISOString()
            }]
        });

        const firstName = (patientData.identityLock?.name || patientData.profile?.name || "Paciente").split(' ')[0];
        const nameStr = firstName !== "NOM" ? firstName : "";

        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: `${nameStr}, agradezco profundamente su confianza al compartirme algo tan personal. Lamento mucho que esté pasando por este proceso de incertidumbre; entiendo que una noticia así genera mucha preocupación.`
            }]);

            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: "He marcado este dato como Prioridad Máxima en su expediente. Su nutriólogo abordará el tema con toda la sensibilidad y el cuidado que usted merece desde el primer minuto de la consulta."
                }]);

                setTimeout(() => {
                    onPhaseComplete(messages); // Avanza a Fase 4 (Heredofamiliares)
                }, 2000);
            }, 5000);
        }, 1000);
    };

    const handleBodyMapComplete = (payload) => {
        const { zones, intensity } = payload;

        const tagMap = {
            // MALE
            'M_HEAD': 'HEADACHE_RISK', 'M_NECK': 'CERVICAL_RISK', 'M_SHOULDERS': 'JOINT_SHOULDER',
            'M_CHEST': 'CARDIO_RISK', 'M_STOMACH': 'GASTRIC_RISK', 'M_ABDOMEN_LOW': 'INTESTINAL_RISK',
            'M_LOWER_BACK': 'LUMBAR_RISK',
            'M_LUNGS_R': 'RESPIRATORY_RISK', 'M_LUNGS_L': 'RESPIRATORY_RISK',
            'M_KIDNEY_R': 'RENAL_RISK', 'M_KIDNEY_L': 'RENAL_RISK',
            'M_ELBOW_R': 'JOINT_ELBOW', 'M_ELBOW_L': 'JOINT_ELBOW',
            'M_WRIST_R': 'JOINT_WRIST', 'M_WRIST_L': 'JOINT_WRIST',
            'M_HAND_R': 'JOINT_WRIST', 'M_HAND_L': 'JOINT_WRIST',
            'M_KNEE_R': 'JOINT_KNEE', 'M_KNEE_L': 'JOINT_KNEE',
            'M_LEG_R': 'CIRCULATION_RISK', 'M_LEG_L': 'CIRCULATION_RISK',
            'M_ANKLE_R': 'JOINT_ANKLE', 'M_ANKLE_L': 'JOINT_ANKLE',
            'M_FOOT_R': 'JOINT_FOOT', 'M_FOOT_L': 'JOINT_FOOT',
            // FEMALE
            'F_HEAD': 'HEADACHE_RISK', 'F_NECK': 'CERVICAL_RISK', 'F_UPPER_BACK': 'POSTURAL_RISK',
            'F_STOMACH_UP': 'GASTRIC_RISK', 'F_STOMACH_LOW': 'INTESTINAL_RISK',
            'F_HIPS': 'JOINT_HIP', 'F_LOWER_BACK': 'LUMBAR_RISK',
            'F_LUNG_R': 'RESPIRATORY_RISK', 'F_LUNG_L': 'RESPIRATORY_RISK',
            'F_BREAST_R': 'BREAST_RISK', 'F_BREAST_L': 'BREAST_RISK',
            'F_OVARY_R': 'GYNECO_RISK', 'F_OVARY_L': 'GYNECO_RISK',
            'F_KIDNEY_R': 'RENAL_RISK', 'F_KIDNEY_L': 'RENAL_RISK',
            'F_HAND_R': 'JOINT_WRIST', 'F_HAND_L': 'JOINT_WRIST',
            'F_KNEE_R': 'JOINT_KNEE', 'F_KNEE_L': 'JOINT_KNEE',
            'F_LEG_R': 'CIRCULATION_RISK', 'F_LEG_L': 'CIRCULATION_RISK',
            'F_FOOT_R': 'JOINT_FOOT', 'F_FOOT_L': 'JOINT_FOOT'
        };

        const zoneLabels = {
            'M_HEAD': 'Cabeza', 'F_HEAD': 'Cabeza',
            'M_LUNGS_R': 'Pulmón Derecho', 'M_LUNGS_L': 'Pulmón Izquierdo',
            'F_LUNG_R': 'Pulmón Derecho', 'F_LUNG_L': 'Pulmón Izquierdo',
            'F_BREAST_R': 'Seno Derecho', 'F_BREAST_L': 'Seno Izquierdo',
            'F_OVARY_R': 'Ovario Derecho', 'F_OVARY_L': 'Ovario Izquierdo',
            'F_KIDNEY_R': 'Riñón Derecho', 'F_KIDNEY_L': 'Riñón Izquierdo',
            'M_KIDNEY_R': 'Riñón Derecho', 'M_KIDNEY_L': 'Riñón Izquierdo'
        };

        const newTags = zones.map(z => tagMap[z] || 'PAIN_GENERAL');
        let isRedFlag = false;

        if (intensity >= 8 && (newTags.includes('CARDIO_RISK') || newTags.includes('GASTRIC_RISK') || newTags.includes('HEADACHE_RISK'))) {
            isRedFlag = true;
            newTags.push('red_flag_symptom');
        }

        updateClinicalContext({
            intensity: intensity,
            pain_zones: zones,
            ai_analysis: {
                ...patientData.clinical_context?.ai_analysis,
                detected_tags: [...(patientData.clinical_context?.ai_analysis?.detected_tags || []), ...newTags]
            }
        });

        const summary = zones.length > 0 ? zones.map(z => zoneLabels[z] || z).join(', ') : "Ninguna";
        setMessages(prev => [...prev, { role: "user", content: `Zonas: ${summary} | Intensidad: ${intensity}/10` }]);

        if (isRedFlag) {
            setMessages(prev => [...prev, { role: "assistant", content: "⚠️ **ALERTA DE SEGURIDAD**: He detectado un nivel de dolor severo en una zona sensible. \n\n¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?" }]);
            setStep('clinica_triage_symptoms');
        } else {
            setMessages(prev => [...prev, { role: "assistant", content: "Entendido. ¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?" }]);
            setStep('clinica_triage_symptoms');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="flex-1 overflow-y-auto w-full px-4 md:px-12 py-8 relative custom-scrollbar">
                <div className="max-w-2xl mx-auto space-y-6 pb-32">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                            <div className={`p-4 rounded-xl max-w-[85%] sm:max-w-[75%] font-sansation text-sm sm:text-base leading-relaxed ${msg.role === 'user'
                                ? 'bg-[#1C75BC] text-white rounded-br-none shadow-md'
                                : 'bg-gray-100 text-slate-700 rounded-bl-none border border-gray-200'
                                }`}>
                                <div className="whitespace-pre-wrap">{msg.content}</div>

                                {msg.options && msg.role === 'assistant' && currentOptions.length > 0 && idx === messages.length - 1 && (
                                    <div className="mt-4 flex flex-col gap-2">
                                        {currentOptions.map((opt, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSend(opt.value)}
                                                className="w-full text-left px-4 py-3 rounded-lg border border-[#1C75BC] text-[#1C75BC] hover:bg-[#1C75BC] hover:text-white transition-all duration-200 font-medium"
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {step === 'clinica_body_map' && !isTyping && (
                        <div className="flex justify-center my-6 animate-fade-in-up w-full max-w-[500px] mx-auto">
                            <div className="bg-gray-50 border border-gray-200 p-2 sm:p-4 rounded-xl w-full shadow-sm flex justify-center">
                                <VisualBodyMap
                                    gender={patientData?.profile?.sex || patientData?.identificacion?.sexo || 'M'}
                                    onComplete={handleBodyMapComplete}
                                />
                            </div>
                        </div>
                    )}

                    {isTyping && (
                        <div className="flex justify-start animate-fade-in">
                            <div className="bg-gray-100 p-4 rounded-xl rounded-bl-none border border-gray-200">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Form */}
            <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-4 py-4 md:px-12 backdrop-blur-md bg-opacity-90">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="max-w-2xl mx-auto flex gap-3 relative"
                >
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={(step === 'clinica_body_map') ? "Seleccione áreas en el mapa..." : "Escriba su respuesta..."}
                        className="flex-1 px-5 py-4 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1C75BC] focus:bg-white transition-all font-sansation text-slate-700 shadow-sm"
                        disabled={isTyping || currentOptions.length > 0 || step === 'clinica_body_map' || step === 'clinica_triage_containment'}
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isTyping || currentOptions.length > 0 || step === 'clinica_body_map' || step === 'clinica_triage_containment'}
                        className="px-6 py-4 bg-[#1C75BC] text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center min-w-[60px]"
                    >
                        <i className="fi fi-rr-paper-plane text-xl"></i>
                    </button>
                </form>
                <div className="text-center mt-3 text-xs text-gray-400 font-sansation flex items-center justify-center gap-2">
                    <i className="fi fi-rr-shield-check"></i>
                    Terminal A - Comunicación Clínica Encriptada Extremo a Extremo
                </div>
            </div>
        </div>
    );
};

export default Fase3_MotivoConsulta;
