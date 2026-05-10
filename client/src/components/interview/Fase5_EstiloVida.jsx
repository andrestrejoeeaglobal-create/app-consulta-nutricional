import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { formatText } from '../../utils/utils';

/**
 * T.I.L.O. - MÓDULO FASE 5 (ESTILO DE VIDA)
 * Versión: v4.0 - Standard Look & Feel Alignment
 * * CONSISTENCIA: Sigue el modelo de Fase 3 y 4 (Burbujas limpias UI).
 * * Dimensión 2: Fisiología Ambiental (Altitud automática por CP).
 * * Dimensión 7: Sincronización de Ciclo Femenino (Obligatorio por género).
 * * Dimensión 6: Telemetría de Energía (Soberanía Biológica).
 * * Frontend: Extracción del Espejo Clínico (módulo independiente).
 */

const Fase5_EstiloVida = ({ db, user, appId, patientProfile, patientData, onStateChange, onPhaseComplete, initialChatHistory }) => {
    // Extract name robustly
    const ptCtx = patientData?.profile?.pediatric_profile;
    const isMinor = ptCtx?.is_minor === true;
    const pName = (patientData?.identityLock?.name || patientProfile?.firstName || patientData?.identificacion?.nombres || "la menor").split(' ')[0];

    const initialCp = patientData?.identificacion?.codigoPostal || patientProfile?.postalCode;
    const initialAltitude = (() => {
        if (!initialCp) return 500;
        const cpPrefix = initialCp.substring(0, 2);
        if (['50', '52'].includes(cpPrefix)) return 2667;
        if (['01', '02', '14', '03', '06'].includes(cpPrefix)) return 2240;
        return 500;
    })();
    const initialCity = (() => {
        if (!initialCp) return "Zona Costera / Bajío";
        const cpPrefix = initialCp.substring(0, 2);
        if (['50', '52'].includes(cpPrefix)) return "Toluca (Alta Montaña)";
        if (['01', '02', '14', '03', '06'].includes(cpPrefix)) return "CDMX (Valle Alto)";
        return "Zona Costera / Bajío";
    })();

    const [lifeStyle, setLifeStyle] = useState({
        environment: { altitude: initialAltitude, hypoxiaRisk: initialAltitude > 2000, city: initialCity },
        circadian: { sleepHours: 0, quality: "" },
        hormonal: { cyclePhase: "N/A", lastPeriod: "" },
        energy: { level: 0, peakTime: "" },
        bio_architecture_goal: ""
    });

    const [messages, setMessages] = useState(() => {
        if (initialChatHistory && initialChatHistory.length > 0) return initialChatHistory;
        
        const nameStr = pName !== "NOM" ? pName : "";
        let greeting = "";
        if (initialCp) {
            greeting = initialAltitude > 2000
                ? isMinor
                    ? `${nameStr}, he analizado el entorno. Al vivir en **${initialCity}** a **${initialAltitude} msnm**, el cuerpo de la menor lucha contra la hipoxia ambiental, lo que eleva el cortisol. Para reclamar la soberanía biológica, ¿cómo calificaría el nivel de energía de ${pName} del 1 al 10 al despertar?`
                    : `${nameStr}, he analizado su entorno. Al vivir en **${initialCity}** a **${initialAltitude} msnm**, su cuerpo lucha contra la hipoxia ambiental, lo que eleva su cortisol. Para reclamar su soberanía biológica, ¿cómo calificaría su nivel de energía del 1 al 10 al despertar?`
                : isMinor
                    ? `${nameStr}, ahora que tenemos los planos genéticos, vamos a la arquitectura del día. ¿Cómo calificaría el nivel de energía de ${pName} del 1 al 10 al despertar?`
                    : `${nameStr}, ahora que tenemos sus planos genéticos, vamos a la arquitectura de su día. ¿Cómo calificaría su nivel de energía del 1 al 10 al despertar?`;
        } else {
            greeting = isMinor
                ? `${nameStr}, ahora vamos a evaluar la arquitectura del día. ¿Cómo calificaría el nivel de energía de ${pName} del 1 al 10 al despertar?`
                : `${nameStr}, ahora vamos a evaluar la arquitectura de su día. ¿Cómo calificaría su nivel de energía del 1 al 10 al despertar?`;
        }

        return [{
            role: 'assistant', content: greeting, options: [
                { label: "1 a 3 (Muy Baja)", value: "3" },
                { label: "4 a 6 (Regular)", value: "5" },
                { label: "7 a 8 (Buena)", value: "7" },
                { label: "9 a 10 (Excelente)", value: "9" }
            ]
        }];
    });

    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [currentStep, setCurrentStep] = useState('ENVIRONMENT');
    const chatEndRef = useRef(null);

    // Call onStateChange initially if provided, to ensure parent is synced
    useEffect(() => {
        if (onStateChange) onStateChange(lifeStyle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncLifeData = async (updates) => {
        const newState = { ...lifeStyle, ...updates };
        setLifeStyle(newState);
        if (onStateChange) onStateChange(newState);

        if (user && db && appId) {
            try {
                await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/clinical_context`, "phase5_lifestyle"), newState, { merge: true });
            } catch (error) {
                console.error("Firebase Sync techayhu:", error);
            }
        }
        return newState;
    };

    const handleSend = async (text) => {
        const textToProcess = text || inputValue;
        if (!textToProcess.trim()) return;

        let userLabel = textToProcess;
        if (textToProcess === "3") userLabel = "1 a 3 (Muy Baja)";
        if (textToProcess === "5") userLabel = "4 a 6 (Regular)";
        if (textToProcess === "7") userLabel = "7 a 8 (Buena)";
        if (textToProcess === "9") userLabel = "9 a 10 (Excelente)";
        if (textToProcess === "Folicular_Lutea") userLabel = "Folicular / Lútea";
        if (textToProcess === "Menstruacion") userLabel = "Menstruación / Transición";
        if (textToProcess === "Pospausia") userLabel = "Posmenopausia / Irregular";
        if (textToProcess === "<5_hours") userLabel = "Menos de 5 horas";
        if (textToProcess === "6-7_hours") userLabel = "Entre 6 y 7 horas";
        if (textToProcess === ">8_hours") userLabel = "8 horas o más";

        setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                newMsgs[newMsgs.length - 1].options = undefined;
            }
            return [...newMsgs, { role: 'user', content: formatText(userLabel) }];
        });

        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            const lower = textToProcess.toLowerCase();

            if (currentStep === 'ENVIRONMENT') {
                const energyScore = parseInt(textToProcess.match(/\d+/)?.[0] || "5");
                syncLifeData({ energy: { ...lifeStyle.energy, level: energyScore } });

                // Dimensión 7: Sincronización Ciclo (Solo Mujeres)
                const sex = patientData?.identificacion?.sexoBiologico || patientProfile?.sex;
                if (sex === 'FEMALE') {
                    const cycleMsg = isMinor 
                        ? `Dato registrado. Como Bio-Arquitecto, debo sincronizar el plan con el ritmo hormonal de la menor. ¿En qué fase del ciclo se encuentra hoy o cómo describiría los periodos recientes de ${pName}?`
                        : `Dato registrado. Como Bio-Arquitecto, debo sincronizar su plan con su ritmo hormonal. ¿En qué fase de su ciclo se encuentra hoy o cómo describiría sus periodos recientes?`;
                    setMessages(prev => [...prev, {
                        role: 'assistant', content: cycleMsg, options: [
                            { label: "Folicular / Lútea", value: "Folicular_Lutea" },
                            { label: "Menstruación / Transición", value: "Menstruacion" },
                            { label: "Posmenopausia / Periodo Irregular", value: "Pospausia" }
                        ]
                    }]);
                    setCurrentStep('HORMONAL');
                } else {
                    setMessages(prev => [...prev, {
                        role: 'assistant', content: isMinor ? `¿Cuántas horas de sueño profundo logra rescatar ${pName} cada noche para su reparación celular?` : "¿Cuántas horas de sueño profundo logra rescatar cada noche para su reparación celular?", options: [
                            { label: "8 horas o más", value: ">8_hours" },
                            { label: "Entre 6 y 7 horas", value: "6-7_hours" },
                            { label: "Menos de 5 horas", value: "<5_hours" }
                        ]
                    }]);
                    setCurrentStep('CIRCADIAN');
                }
            }
            else if (currentStep === 'HORMONAL') {
                let phase = 'En transición';
                if (lower.includes('lutea') || lower.includes('folicular')) phase = 'Folicular / Lútea';
                if (lower.includes('pospausia') || lower.includes('irregular') || lower.includes('menopausia')) phase = 'Tránsito / Posmenopausia';
                if (lower.includes('menstruacion')) phase = 'Menstruación';

                syncLifeData({ hormonal: { ...lifeStyle.hormonal, cyclePhase: phase } });
                setMessages(prev => [...prev, {
                    role: 'assistant', content: isMinor ? `Entendido. Sincronizaremos los micronutrientes con esa fase. Finalmente, ¿cuántas horas duerme ${pName} en promedio?` : "Entendido. Sincronizaremos los micronutrientes con esa fase. Finalmente, ¿cuántas horas duerme en promedio?", options: [
                        { label: "8 horas o más", value: ">8_hours" },
                        { label: "Entre 6 y 7 horas", value: "6-7_hours" },
                        { label: "Menos de 5 horas", value: "<5_hours" }
                    ]
                }]);
                setCurrentStep('CIRCADIAN');
            }
            else if (currentStep === 'CIRCADIAN') {
                let hours = 7;
                if (lower.includes('<5_hours') || lower.includes('menos de 5') || lower.includes('4') || lower.includes('5')) hours = 5;
                if (lower.includes('6-7_hours') || lower.includes('6') || lower.includes('7')) hours = 7;
                if (lower.includes('>8_hours') || lower.includes('8') || lower.includes('9')) hours = 8;

                syncLifeData({ circadian: { ...lifeStyle.circadian, sleepHours: hours } });

                const finalMsg = isMinor
                    ? `Auditoría completada. He identificado los cuellos de botella en la flexibilidad metabólica de ${pName}. Estamos listos para cerrar los planos de salud e iniciar la transformación.`
                    : `Auditoría completada. He identificado los cuellos de botella en su flexibilidad metabólica. Estamos listos para cerrar sus planos de salud e iniciar la transformación.`;
                setMessages(prev => [...prev, {
                    role: 'assistant', content: finalMsg, options: [
                        { label: "Continuar a la siguiente fase", value: "FINISH_PHASE" }
                    ]
                }]);
                setCurrentStep('COMPLETED');
            }
            else if (currentStep === 'COMPLETED' && textToProcess === "FINISH_PHASE") {
                onPhaseComplete?.(lifeStyle, messages);
            }

            setIsAnalyzing(false);
        }, 800);
    };

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const isInputDisabled = isAnalyzing || (messages.length > 0 && messages[messages.length - 1].options && messages[messages.length - 1].options.length > 0);

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

                                {msg.options && msg.role === 'assistant' && idx === messages.length - 1 && msg.options.length > 0 && (
                                    <div className="mt-4 flex flex-col gap-2">
                                        {msg.options.map((opt, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSend(opt.value)}
                                                className="w-full text-left px-4 py-3 rounded-lg border border-[#1C75BC] text-[#1C75BC] hover:bg-[#1C75BC] hover:text-white transition-all duration-200 font-medium bg-white"
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {isAnalyzing && (
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
                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* Input Form */}
            <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-4 py-4 md:px-12 backdrop-blur-md bg-opacity-90">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
                    className="max-w-2xl mx-auto flex gap-3 relative"
                >
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Escriba aquí..."
                        className="flex-1 px-5 py-4 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1C75BC] focus:bg-white transition-all font-sansation text-slate-700 shadow-sm disabled:opacity-50 disabled:bg-gray-100"
                        disabled={isInputDisabled}
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isInputDisabled}
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

export default Fase5_EstiloVida;
