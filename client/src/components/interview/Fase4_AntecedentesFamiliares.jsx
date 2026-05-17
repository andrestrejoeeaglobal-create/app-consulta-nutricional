import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { formatText } from '../../utils/utils';
import { motion as Motion } from 'framer-motion';

import tiloImg from '../../assets/tilo.png';
import ReactMarkdown from 'react-markdown';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';
import { Send } from 'lucide-react';

/**
 * T.I.L.O. - FASE 4 (ANTECEDENTES FAMILIARES)
 * Versión: v4.4 - Genómica Universal
 * * DRILL-DOWN: Máquina de estados para capturar Patología -> Familiar -> Detalle
 */

const CAT_PATOLOGIAS = [
    { label: "Diabetes (Azúcar alta)", value: "Diabetes" },
    { label: "Hipertensión (Presión alta)", value: "Hipertension" },
    { label: "Obesidad / Sobrepeso", value: "Obesidad" },
    { label: "Cáncer / Tumor", value: "Cancer" },
    { label: "Enfermedad Renal / Diálisis", value: "Renal" },
    { label: "Asma / Problemas respiratorios", value: "Asma" },
    { label: "Problemas de Tiroides", value: "Tiroides" },
    { label: "Enfermedades Cardíacas / Infartos", value: "Cardiopatia" },
    { label: "Depresión / Ansiedad / Psiquiátrico", value: "Psiquiatrico" },
    { label: "Otras / Manual (Tipear)", value: "Otras" }
];

const Fase4_AntecedentesFamiliares = ({ patientData, setPatientData, onPhaseComplete, initialChatHistory }) => {
    // NUEVA ESTRUCTURA DE DATOS
    const [familyTree, setFamilyTree] = useState(() => {
        return patientData?.familyTree || {
            antecedentes: [],
            alert_detected: false
        };
    });

    const ptCtx = patientData?.profile?.pediatric_profile;
    const isMinor = ptCtx?.is_minor === true;
    const pName = (patientData?.identityLock?.name || patientData?.identificacion?.nombres || (isMinor ? "la menor" : "usted")).split(' ')[0];
    
    // Calcular edad para filtro
    const ageStr = patientData?.profile?.pediatric_profile?.age || patientData?.identificacion?.edad || "0";
    const age = parseInt(ageStr, 10) || 0;

    // Máquina de estados
    // ASK_START -> SELECT_DISEASE -> TYPE_DETAIL (if Cancer/Otras) -> SELECT_RELATIVE -> ASK_MORE
    const [flowState, setFlowState] = useState(() => {
        if (patientData?.familyTree?.antecedentes?.length > 0) return 'ASK_MORE';
        return 'ASK_START';
    });
    const [currentAntecedente, setCurrentAntecedente] = useState(null); // { patologia, detalle, familiar }

    const [initialMessageCount] = useState(initialChatHistory?.length || 0);
    const [messages, setMessages] = useState(() => {
        if (patientData?.familyTree?.antecedentes?.length > 0) {
            const resumeMsg = {
                role: 'assistant',
                content: "De acuerdo. ¿Qué acción desea tomar respecto a los antecedentes familiares?",
                options: [
                    { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                    { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                ]
            };
            return [...(initialChatHistory || []), resumeMsg];
        }

        const greeting = isMinor 
            ? `Entendido. Para complementar el mapa de salud de la menor ${pName}, ¿podría indicarme si existen antecedentes de enfermedades importantes en su familia directa (padres, abuelos, tíos o hermanos)?`
            : `Entendido. Para complementar el mapa de salud de ${pName}, ¿podría indicarme si existen antecedentes de enfermedades importantes en su familia directa (padres, abuelos, tíos o hermanos)?`;
        
        const greetingMsg = {
            role: 'assistant', content: greeting, options: [
                { label: "❌ NO / DESCONOCE", value: "NO_ANTECEDENTES" },
                { label: "✅ SÍ, HAY ANTECEDENTES", value: "SI_ANTECEDENTES" }
            ]
        };

        if (initialChatHistory && initialChatHistory.length > 0) {
            return [...initialChatHistory, greetingMsg];
        }
        return [greetingMsg];
    });

    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const chatEndRef = useRef(null);
    const addAlert = useClinicalGenome(state => state.addAlert);

    // Dynamic relatives based on age
    const getRelativesMenu = () => {
        const base = [
            { label: "Madre", value: "Madre" },
            { label: "Padre", value: "Padre" },
            { label: "Abuela Materna", value: "Abuela Materna" },
            { label: "Abuelo Materno", value: "Abuelo Materno" },
            { label: "Abuela Paterna", value: "Abuela Paterna" },
            { label: "Abuelo Paterno", value: "Abuelo Paterno" },
            { label: "Hermano(a)", value: "Hermano/a" },
            { label: "Tío(a) Materno(a)", value: "Tio/a Materno/a" },
            { label: "Tío(a) Paterno(a)", value: "Tio/a Paterno/a" }
        ];
        if (age >= 18) base.push({ label: "Hijo(a)", value: "Hijo/a" });
        if (age >= 45) base.push({ label: "Nieto(a)", value: "Nieto/a" });
        return base;
    };

    const pushMessage = (msg) => {
        setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                newMsgs[newMsgs.length - 1].options = undefined;
                newMsgs[newMsgs.length - 1].showMenu = undefined;
            }
            return [...newMsgs, msg];
        });
    };

    const handleSend = (text, type = "text") => {
        const textToProcess = text || inputValue;
        if (!textToProcess.trim()) return;

        let userLabel = textToProcess;
        if (textToProcess === "SI_ANTECEDENTES") userLabel = "Sí, hay antecedentes";
        if (textToProcess === "NO_ANTECEDENTES") userLabel = "No / Desconoce";
        if (textToProcess === "FINISH") userLabel = "Continuar al historial";
        if (textToProcess === "ADD_MORE") userLabel = "Agregar otro antecedente";

        // Find label if coming from menu
        if (type === "disease") userLabel = CAT_PATOLOGIAS.find(o => o.value === textToProcess)?.label || textToProcess;
        if (type === "relative") userLabel = getRelativesMenu().find(o => o.value === textToProcess)?.label || textToProcess;

        pushMessage({ role: 'user', content: formatText(userLabel) });
        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            processState(textToProcess, type);
        }, 600);
    };

    const processState = (val) => {
        if (flowState === 'ASK_START') {
            if (val === "NO_ANTECEDENTES") {
                onPhaseComplete?.(familyTree, [...messages, { role: 'user', content: "No / Desconoce" }, { role: 'assistant', content: "Entendido, sin antecedentes registrados." }]);
                setIsAnalyzing(false);
                return;
            } else if (val === "SI_ANTECEDENTES") {
                setFlowState('SELECT_DISEASE');
                pushMessage({
                    role: 'assistant',
                    content: "Por favor, seleccione la condición o enfermedad que desea registrar:",
                    showMenu: 'disease'
                });
            }
        } 
        else if (flowState === 'SELECT_DISEASE') {
            const isCustom = val === "Otras" || val === "Cancer";
            if (isCustom) {
                setFlowState('TYPE_DETAIL');
                setCurrentAntecedente({ patologia: val, detalle: "", familiar: "" });
                pushMessage({
                    role: 'assistant',
                    content: val === "Cancer" 
                        ? "¿Qué tipo de cáncer? Escríbalo brevemente (Ej. Cáncer de mama, Leucemia)."
                        : "Por favor, escriba el nombre de la enfermedad o condición."
                });
            } else {
                setFlowState('SELECT_RELATIVE');
                setCurrentAntecedente({ patologia: val, detalle: "", familiar: "" });
                pushMessage({
                    role: 'assistant',
                    content: `¿Qué familiar directo de ${pName} padece ${CAT_PATOLOGIAS.find(o=>o.value===val)?.label}?`,
                    showMenu: 'relative'
                });
            }
        }
        else if (flowState === 'TYPE_DETAIL') {
            const updated = { ...currentAntecedente, detalle: val };
            setCurrentAntecedente(updated);
            setFlowState('SELECT_RELATIVE');
            const disLabel = updated.patologia === "Otras" ? val : `${updated.patologia} (${val})`;
            pushMessage({
                role: 'assistant',
                content: `¿Qué familiar directo de ${pName} padece ${disLabel}?`,
                showMenu: 'relative'
            });
        }
        else if (flowState === 'SELECT_RELATIVE') {
            const finalAnt = { ...currentAntecedente, familiar: val };
            
            // Evaluar Alertas
            const isOnco = finalAnt.patologia === "Cancer";
            const isMetabolic = finalAnt.patologia === "Diabetes" || finalAnt.patologia === "Obesidad";
            const isCardio = finalAnt.patologia === "Hipertension" || finalAnt.patologia === "Cardiopatia";
            
            let hasAlert = familyTree.alert_detected;
            if (isOnco) {
                addAlert({
                    type: 'ALERTA ONCOLÓGICA FAMILIAR',
                    message: `Antecedente de Cáncer (${finalAnt.detalle || 'No especificado'}) en ${val}. Ajustar plan con dieta anti-inflamatoria.`
                });
                hasAlert = true;
            }
            if (isMetabolic) {
                addAlert({
                    type: 'RIESGO METABÓLICO HEREDITARIO',
                    message: `Carga genética para Síndrome Metabólico (${finalAnt.patologia} en ${val}). Pre-establecer monitoreo glucémico.`
                });
            }
            if (isCardio) {
                addAlert({
                    type: 'RIESGO CARDIOVASCULAR',
                    message: `Vigilar marcadores de estrés endotelial debido a ${finalAnt.patologia} en ${val}.`
                });
            }

            const newTree = {
                ...familyTree,
                antecedentes: [...familyTree.antecedentes, finalAnt],
                alert_detected: hasAlert
            };

            setFamilyTree(newTree);
            setPatientData(prev => ({ ...prev, familyTree: newTree }));

            setFlowState('ASK_MORE');
            pushMessage({
                role: 'assistant',
                content: "Antecedente registrado correctamente en el expediente. ¿Desea agregar otro antecedente?",
                options: [
                    { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                    { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                ]
            });
        }
        else if (flowState === 'ASK_MORE') {
            if (val === "FINISH") {
                setFlowState('REVIEW_SUMMARY');
                const summaryText = familyTree.antecedentes.length > 0
                    ? familyTree.antecedentes.map(a => `- **${a.familiar || a.parentesco || 'Familiar no especificado'}**: ${a.patologia || a.diagnostico || 'Condición no especificada'}`).join('\n')
                    : "Ningún antecedente registrado.";
                
                pushMessage({
                    role: 'assistant',
                    content: `A continuación, le presento un resumen de los Antecedentes Heredofamiliares capturados:\n\n${summaryText}\n\n¿Son correctos estos datos?`,
                    options: [
                        { label: "Sí, los datos son correctos", value: "CONFIRM_DATA" },
                        { label: "No, quiero agregar o corregir algo", value: "CORRECT_DATA" }
                    ]
                });
            } else if (val === "ADD_MORE") {
                setFlowState('SELECT_DISEASE');
                pushMessage({
                    role: 'assistant',
                    content: "Por favor, seleccione la condición o enfermedad que desea registrar:",
                    showMenu: 'disease'
                });
            }
        }
        else if (flowState === 'REVIEW_SUMMARY') {
            if (val === "CONFIRM_DATA") {
                onPhaseComplete?.(familyTree, [...messages, { role: 'user', content: "Sí, los datos son correctos" }, { role: 'assistant', content: "Perfecto. Avancemos a la siguiente fase." }]);
            } else if (val === "CORRECT_DATA") {
                setFlowState('ASK_MORE');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué acción desea tomar?",
                    options: [
                        { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                        { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                    ]
                });
            }
        }
        
        setIsAnalyzing(false);
    };

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const isInputDisabled = isAnalyzing || (flowState !== 'TYPE_DETAIL');

    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="flex-1 overflow-y-auto w-full px-4 md:px-12 py-8 relative custom-scrollbar">
                <div className="max-w-2xl mx-auto space-y-6 pb-40">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'} mb-6 items-start gap-3 animate-fade-in-up relative`}>
                            {msg.role === "assistant" && (
                                <Motion.div
                                    initial={idx >= initialMessageCount ? { scale: 0 } : { scale: 1 }}
                                    animate={{ scale: 1 }}
                                    className="w-12 h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden"
                                >
                                    <img src={tiloImg} alt="Tilo" className="w-10 h-10 object-contain" />
                                </Motion.div>
                            )}
                            <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${msg.role === 'assistant'
                                ? 'bg-white border border-slate-100 text-slate-700 rounded-tl-none relative'
                                : 'bg-indigo-600 text-white rounded-tr-none'
                                }`}>
                                <div className="w-full prose prose-sm max-w-none prose-slate [&>p]:mb-2 [&>p:last-child]:mb-0 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>

                                {msg.options && msg.role === 'assistant' && idx === messages.length - 1 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {msg.options.map((opt, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSend(opt.value, "text")}
                                                className={`px-4 py-2 font-bold rounded-full text-xs shadow-sm border transition-colors ${
                                                    opt.value === 'SI_ANTECEDENTES' || opt.value === 'ADD_MORE'
                                                        ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                                                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Mostrar Menús */}
                                {msg.showMenu && msg.role === 'assistant' && idx === messages.length - 1 && (
                                    <div className="mt-4 w-full relative h-12">
                                        {/* Espacio reservado para que el popup no tape todo, SearchableVerticalMenu es absolute bottom-[calc(100%+12px)] */}
                                        <SearchableVerticalMenu 
                                            options={msg.showMenu === 'disease' ? CAT_PATOLOGIAS : getRelativesMenu()} 
                                            onSelect={(val) => handleSend(val, msg.showMenu)} 
                                        />
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
                    onSubmit={(e) => { e.preventDefault(); handleSend(inputValue, "text"); }}
                    className="max-w-2xl mx-auto flex gap-3 relative"
                >
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={isInputDisabled ? "Seleccione una opción arriba..." : "Escriba aquí..."}
                        className="flex-1 px-5 py-4 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1C75BC] focus:bg-white transition-all font-sansation text-slate-700 shadow-sm disabled:opacity-50 disabled:bg-gray-100"
                        disabled={isInputDisabled}
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isInputDisabled}
                        className="bg-blue-600 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-700 transition-transform active:scale-95 shadow-md flex-shrink-0"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
                <div className="text-center mt-3 text-xs text-gray-400 font-sansation flex items-center justify-center gap-2">
                    <i className="fi fi-rr-shield-check"></i>
                    Terminal A - Comunicación Clínica Encriptada Extremo a Extremo (Genómica V4.4)
                </div>
            </div>
        </div>
    );
};

export default Fase4_AntecedentesFamiliares;
