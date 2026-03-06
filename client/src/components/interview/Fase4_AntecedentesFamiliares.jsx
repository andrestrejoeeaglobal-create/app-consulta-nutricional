import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { formatText } from '../../utils/utils';

/**
 * T.I.L.O. - FASE 4 (ANTECEDENTES FAMILIARES)
 * Versión: v3.1 - Standard Look & Feel Alignment
 * * CONSISTENCIA: Sigue el modelo de Fase 3 (Burbujas sin Avatares UI pesada).
 * * INTERACCIÓN: Uso de Opciones dinámicas inyectadas como botones debajo del grid.
 */

const Fase4_AntecedentesFamiliares = ({ patientData, setPatientData, onPhaseComplete, initialChatHistory }) => {
    const [messages, setMessages] = useState(initialChatHistory || []);
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [pendingBranchData, setPendingBranchData] = useState(null);
    const chatEndRef = useRef(null);

    const [familyTree, setFamilyTree] = useState({
        parents: { diabetes: false, hypertension: false, cancer: false, obesity: false, renal: false },
        grandparentsMaternal: { diabetes: false, hypertension: false, cancer: false, obesity: false, renal: false },
        grandparentsPaternal: { diabetes: false, hypertension: false, cancer: false, obesity: false, renal: false },
        siblings: { diabetes: false, hypertension: false, cancer: false, obesity: false, renal: false },
        summary: "",
        alert_detected: false
    });

    // Extract name robustly from identityLock or identificacion
    const firstName = (patientData?.identityLock?.name || patientData?.identificacion?.nombres || "Paciente").split(' ')[0];

    // 1. SALUDO HUMANO
    useEffect(() => {
        let isMounted = true;
        const nameStr = firstName !== "NOM" ? firstName : "";
        const greeting = `Entendido. Ahora, para complementar su mapa de salud, ${nameStr}, ¿podría contarme si sus padres o abuelos padecen alguna enfermedad como diabetes, hipertensión, obesidad o problemas renales?`;

        setTimeout(() => {
            if (isMounted) {
                setMessages(prev => {
                    const alreadyGreeted = prev.some(m => m.content.includes("complementar su mapa"));
                    if (!alreadyGreeted) {
                        return [...prev, {
                            role: 'assistant', content: greeting, options: [
                                { label: "Sí, hay antecedentes", value: "SI_ANTECEDENTES" },
                                { label: "No, ninguno", value: "NO_ANTECEDENTES" }
                            ]
                        }];
                    }
                    return prev;
                });
            }
        }, 300);

        return () => { isMounted = false; };
    }, [firstName]);

    const addAlert = useClinicalGenome(state => state.addAlert);

    const syncGeneticData = (updates) => {
        const newTree = { ...familyTree, ...updates };

        // Evaluar Riesgos para emitir Alertas Pasivas al Espejo
        const hasCancerRisk = updates.parents?.cancer || updates.grandparentsMaternal?.cancer || updates.grandparentsPaternal?.cancer || updates.siblings?.cancer || updates.cancer;
        const hasDiabetesRisk = updates.parents?.diabetes || updates.grandparentsMaternal?.diabetes || updates.grandparentsPaternal?.diabetes || updates.siblings?.diabetes || updates.diabetes;
        const hasCardioRisk = updates.parents?.hypertension || updates.grandparentsMaternal?.hypertension || updates.grandparentsPaternal?.hypertension || updates.siblings?.hypertension || updates.hypertension;

        if (hasCancerRisk) {
            newTree.alert_detected = true;
            addAlert({
                type: 'ALERTA ONCOLÓGICA FAMILIAR',
                message: 'Antecedentes oncológicos detectados. Ajustar plan con dieta anti-inflamatoria de precisión.'
            });
        }
        if (hasDiabetesRisk) {
            addAlert({
                type: 'RIESGO METABÓLICO HEREDITARIO',
                message: 'Carga genética para Síndrome Metabólico. Pre-establecer monitoreo glucémico estructurado.'
            });
        }
        if (hasCardioRisk) {
            addAlert({
                type: 'RIESGO CARDIOVASCULAR',
                message: 'Vigilar marcadores de estrés endotelial y controlar ingesta de sodio (SAD).'
            });
        }

        setFamilyTree(newTree);
        setPatientData(prev => ({ ...prev, familyTree: newTree }));
        return newTree;
    };

    const handleSend = (text) => {
        const textToProcess = text || inputValue;
        if (!textToProcess.trim()) return;

        let userLabel = textToProcess;
        // Map SI_ANTECEDENTES / NO_ANTECEDENTES back to text for display
        if (textToProcess === "SI_ANTECEDENTES") userLabel = "Sí, hay antecedentes";
        if (textToProcess === "NO_ANTECEDENTES") userLabel = "No, ninguno";

        setMessages(prev => {
            const newMsgs = [...prev];
            // Remove options from last assistant message to prevent double-clicking later
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                newMsgs[newMsgs.length - 1].options = undefined;
            }
            return [...newMsgs, { role: 'user', content: formatText(userLabel) }];
        });

        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            const lower = textToProcess.toLowerCase();

            if (textToProcess === "NO_ANTECEDENTES" || (/no hay|ninguno|nadie|sanos|no/i.test(lower) && !lower.includes("si ") && lower.length < 15)) {
                // Avanzar directamente
                onPhaseComplete?.(familyTree, [...messages, { role: 'user', content: formatText(userLabel) }, { role: 'assistant', content: "Entendido, sin antecedentes registrados." }]);
                setIsAnalyzing(false);
                return;
            }

            if (textToProcess === "SI_ANTECEDENTES") {
                setMessages(prev => [...prev, { role: 'assistant', content: "¿Qué familiares y qué padecimientos detectó? Puede escribirlos libremente o mencionarlos uno por uno (Ej. 'Mi mamá tiene diabetes')." }]);
                setIsAnalyzing(false);
                return;
            }

            // LÓGICA DE RAMAS PARA MATERNA/PATERNA
            if (pendingBranchData) {
                const isMat = /materna|mama/i.test(lower) || textToProcess === "Materna";
                const isPat = /paterna|papa/i.test(lower) || textToProcess === "Paterna";

                if (isMat) syncGeneticData({ grandparentsMaternal: pendingBranchData });
                else if (isPat) syncGeneticData({ grandparentsPaternal: pendingBranchData });
                else syncGeneticData({ grandparentsMaternal: pendingBranchData }); // Default fallback

                setMessages(prev => [...prev, {
                    role: 'assistant', content: "Registrado correctamente. ¿Desea agregar algún otro antecedente o podemos avanzar?", options: [
                        { label: "Avanzar a Estilo de Vida", value: "NO_ANTECEDENTES" }
                    ]
                }]);
                setPendingBranchData(null);
                setIsAnalyzing(false);
                return;
            }

            // INFERENCIA CLÍNICA
            const hasD = /diabetes|azucar|glucosa/i.test(lower);
            const hasH = /presion|hipertension|infarto|corazon|cardio/i.test(lower);
            const hasO = /obesidad|sobrepeso/i.test(lower);
            const hasR = /renal|riñon|dialisis/i.test(lower);
            const hasC = /cancer|tumor|maligno|leucemia/i.test(lower);
            const data = { diabetes: hasD, hypertension: hasH, obesity: hasO, renal: hasR, cancer: hasC };

            if (hasD || hasH || hasO || hasR || data.cancer) {
                if (/abuelo|abuela/i.test(lower) && !/materna|paterna/i.test(lower)) {
                    setPendingBranchData(data);
                    setMessages(prev => [...prev, {
                        role: 'assistant', content: "¿Es su abuelita(o) materna o paterna?", options: [
                            { label: "Materna", value: "Materna" },
                            { label: "Paterna", value: "Paterna" }
                        ]
                    }]);
                } else {
                    let isAssigned = false;
                    if (/padre|madre|papa|mama/i.test(lower)) { syncGeneticData({ parents: data }); isAssigned = true; }
                    if (/hermano|hermana/i.test(lower)) { syncGeneticData({ siblings: data }); isAssigned = true; }
                    if (/abuelo|abuela/i.test(lower) && /materna|mama/i.test(lower)) { syncGeneticData({ grandparentsMaternal: data }); isAssigned = true; }
                    if (/abuelo|abuela/i.test(lower) && /paterna|papa/i.test(lower)) { syncGeneticData({ grandparentsPaternal: data }); isAssigned = true; }

                    if (!isAssigned) syncGeneticData({ parents: data });

                    setMessages(prev => [...prev, {
                        role: 'assistant', content: "Dato guardado en su expediente. ¿Algún otro detalle de su familia que debamos registrar?", options: [
                            { label: "No, avanzar", value: "NO_ANTECEDENTES" }
                        ]
                    }]);
                }
            } else {
                setMessages(prev => [...prev, {
                    role: 'assistant', content: "Lo tendré en cuenta. ¿Desea reportar diabetes, hipertensión, cáncer u obesidad en algún familiar cercano?", options: [
                        { label: "No, avanzar", value: "NO_ANTECEDENTES" }
                    ]
                }]);
            }
            setIsAnalyzing(false);
        }, 800);
    };

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const isInputDisabled = isAnalyzing || (messages.length > 0 && messages[messages.length - 1].options && messages[messages.length - 1].options.length > 0 && !messages[messages.length - 1].options.some(o => o.value === 'NO_ANTECEDENTES'));

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
                        placeholder="Escriba su respuesta..."
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

export default Fase4_AntecedentesFamiliares;
