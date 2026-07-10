import React, { useState, useEffect, useRef } from 'react';
import { Send, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import tiloImg from '../../assets/tilo.png';
import usePatientLinguistics from '../../hooks/usePatientLinguistics';

// --- UTILS LOCALES ---
const formatText = (text) => {
    return text.split(/[\s,]+/).map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(", ");
};

const strictBooleanValidator = (text) => {
    const truthy = ["si", "sí", "claro", "por supuesto", "afirmativo", "simon", "s", "ok"];
    const falsy = ["no", "ni hablar", "negativo", "n", "nunca", "jamas", "jamás", "nop", "ninguno", "nada"];
    const lower = text.toLowerCase().trim();

    if (truthy.some(t => lower === t || lower.startsWith(t + " "))) return true;
    if (falsy.some(f => lower === f || lower.startsWith(f + " "))) return false;
    return null; // Return null if not boolean (it might be actual content)
};

// V9: Enhanced checkFreq module for FFQ
function checkFreq(respuestaStr, tipoAlimento = 'risk') {
    // tipoAlimento can be 'risk' (bad foods), 'protective' (good foods), 'optimal' (e.g. daily veggies)
    const lower = respuestaStr.toLowerCase();

    // Map keywords to approx numerical frequencies weekly
    let freq = null;

    if (lower.match(/diario|todos los d[ií]as|7/)) freq = 7;
    else if (lower.match(/6/)) freq = 6;
    else if (lower.match(/5/)) freq = 5;
    else if (lower.match(/4/)) freq = 4;
    else if (lower.match(/3/)) freq = 3;
    else if (lower.match(/2/)) freq = 2;
    else if (lower.match(/1|una vez/)) freq = 1;
    else if (lower.match(/nunca|jam[aá]s|0|ninguna/)) freq = 0;
    else return false; // Unable to parse exactly, fallback to string

    if (tipoAlimento === 'risk') {
        // High risk if consumption is >= 3 times a week of bad foods
        return freq >= 3;
    } else if (tipoAlimento === 'protective') {
        // Protective if consumption is low (e.g. eating junk food <= 1 time a week)
        return freq <= 1;
    } else if (tipoAlimento === 'optimal') {
        // Optimal if eating good things >= 5 times a week
        return freq >= 5;
    }

    return false;
}

const Fase11_EvaluacionDietetica = ({
    onPhaseComplete,
    patientData,
    setPatientData
}) => {
    const { patientName: pName, isMinor } = usePatientLinguistics(patientData);

    // ESTADO DEL COMPONENTE
    const [messages, setMessages] = useState([
        { role: "assistant", content: isMinor ? `¿Cuáles son los alimentos que NO le gustan a ${pName} (aversiones)? Si no tiene, responde 'Ninguno'.` : "¿Cuáles son sus alimentos que NO le gustan (aversiones)? Si no tiene, diga 'Ninguno'.", avatar: tiloImg }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [internalStep, setInternalStep] = useState('AVERSIONS_GATE');

    // DATOS RECOLECTADOS (ESTADO LOCAL)
    const [evaluacionDietetica, setEvaluacionDietetica] = useState({
        preferencias: {
            aversiones: patientData?.evaluacionDietetica?.preferencias?.aversiones || "",
            favoritos: patientData?.evaluacionDietetica?.preferencias?.favoritos || ""
        },
        r24h: patientData?.evaluacionDietetica?.r24h || [],
        ffq: patientData?.evaluacionDietetica?.ffq || {}
    });

    const [tempItem, setTempItem] = useState({});
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
        // LOGICA DE AVERSIONES
        // -------------------------------------------------------------
        if (internalStep === 'AVERSIONS_GATE') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                // "No tengo", "Ninguno"
                addBotMsg(isMinor ? `¿Cuáles son los alimentos favoritos o preferidos de ${pName}?` : "¿Cuáles son sus alimentos favoritos o preferidos?");
                setInternalStep('FAVORITES_GATE');
            } else if (isBool === true) {
                // "Sí tengo", etc
                addBotMsg(isMinor ? `¿Cuáles alimentos evita ${pName}?` : "¿Cuáles alimentos evita?");
            } else {
                // Dió contenido directamente (Ej: "El brócoli")
                setEvaluacionDietetica(prev => ({
                    ...prev,
                    preferencias: { ...prev.preferencias, aversiones: formatText(userMsg) }
                }));
                addBotMsg(isMinor ? `¿Algún otro alimento que evite ${pName}?` : "¿Algún otro alimento que evite?");
                setInternalStep('AVERSIONS_LOOP');
            }
        }
        else if (internalStep === 'AVERSIONS_LOOP') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                addBotMsg(isMinor ? `¿Cuáles son los alimentos favoritos o preferidos de ${pName}?` : "¿Cuáles son sus alimentos favoritos o preferidos?");
                setInternalStep('FAVORITES_GATE');
            } else if (isBool === true) {
                addBotMsg("¿Cuál?");
            } else {
                setEvaluacionDietetica(prev => ({
                    ...prev,
                    preferencias: {
                        ...prev.preferencias,
                        aversiones: prev.preferencias.aversiones ? prev.preferencias.aversiones + ", " + formatText(userMsg) : formatText(userMsg)
                    }
                }));
                addBotMsg("¿Otro?");
            }
        }

        // -------------------------------------------------------------
        // LOGICA DE FAVORITOS
        // -------------------------------------------------------------
        else if (internalStep === 'FAVORITES_GATE') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                addBotMsg(isMinor ? `Entendido.\\n\\nPasemos al Recordatorio de 24 Horas.\\n\\nDime, ¿a qué hora consumió ${pName} su primer alimento ayer? (Ej. 8:00 am).` : "Entendido.\\n\\nPasemos al Recordatorio de 24 Horas.\\n\\nDígame, ¿a qué hora consumió su primer alimento ayer? (Ej. 8:00 am).");
                setInternalStep('R24H_TIME');
            } else if (isBool === true) {
                addBotMsg(isMinor ? `¿Cuáles son los favoritos de ${pName}?` : "¿Cuáles son sus favoritos?");
            } else {
                setEvaluacionDietetica(prev => ({
                    ...prev,
                    preferencias: { ...prev.preferencias, favoritos: formatText(userMsg) }
                }));
                addBotMsg("¿Algún otro favorito?");
                setInternalStep('FAVORITES_LOOP');
            }
        }
        else if (internalStep === 'FAVORITES_LOOP') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                addBotMsg(isMinor ? `Entendido.\\n\\nPasemos al Recordatorio de 24 Horas.\\n\\nDime, ¿a qué hora consumió ${pName} su primer alimento ayer? (Ej. 8:00 am).` : "Entendido.\\n\\nPasemos al Recordatorio de 24 Horas.\\n\\nDígame, ¿a qué hora consumió su primer alimento ayer? (Ej. 8:00 am).");
                setInternalStep('R24H_TIME');
            } else if (isBool === true) {
                addBotMsg("¿Cuál?");
            } else {
                setEvaluacionDietetica(prev => ({
                    ...prev,
                    preferencias: {
                        ...prev.preferencias,
                        favoritos: prev.preferencias.favoritos ? prev.preferencias.favoritos + ", " + formatText(userMsg) : formatText(userMsg)
                    }
                }));
                addBotMsg("¿Otro?");
            }
        }

        // -------------------------------------------------------------
        // RECORDATORIO 24H
        // -------------------------------------------------------------
        else if (internalStep === 'R24H_TIME') {
            if (lower.includes("nada") || lower.includes("fin") || lower.includes("dormir") || lower.includes("todo") || (lower.includes("no") && userMsg.length < 5)) {
                addBotMsg(isMinor ? "Registro de 24h completado.\\n\\n**Frecuencia de Consumo.**\\n\\nPara cada grupo de alimentos, responde con un número del **0 al 7** (días a la semana, donde 0=Nunca, 7=Diario).\\n\\n1. **Lácteos** (Leche, Queso, Yogurt):" : "Registro de 24h completado.\\n\\n**Frecuencia de Consumo.**\\n\\nPara cada grupo de alimentos, responda con un número del **0 al 7** (días a la semana, donde 0=Nunca, 7=Diario).\\n\\n1. **Lácteos** (Leche, Queso, Yogurt):");
                setInternalStep('FFQ_DAIRY');
            } else {
                setTempItem({ hora: userMsg });
                addBotMsg(isMinor ? `¿Qué comió ${pName} a esa hora?` : "¿Qué comió a esa hora?");
                setInternalStep('R24H_CONTENT');
            }
        }
        else if (internalStep === 'R24H_CONTENT') {
            const newItem = { hora: tempItem.hora, alimento: userMsg };
            setEvaluacionDietetica(prev => ({
                ...prev,
                r24h: [...prev.r24h, newItem]
            }));
            addBotMsg(isMinor ? "¿Cuál fue la siguiente hora de comida? (O di 'Fin' si terminaste)." : "¿Cuál fue la siguiente hora de comida? (O diga 'Fin' si terminó).");
            setInternalStep('R24H_TIME');
        }

        // -------------------------------------------------------------
        // FFQ (FOOD FREQUENCY QUESTIONNAIRE)
        // -------------------------------------------------------------
        else if (internalStep === 'FFQ_DAIRY') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, leche: userMsg } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "high_dairy_intake"]);
            addBotMsg("2. **Carnes Rojas Magras** (Bistec, Molida, Cuete):");
            setInternalStep('FFQ_RED_LEAN');
        }
        else if (internalStep === 'FFQ_RED_LEAN') {
            setTempItem(prev => ({ ...prev, meat_lean: userMsg }));
            addBotMsg("3. **Carnes Rojas Grasas** (Asada, Barbacoa, Cortes, Chicharrón):");
            setInternalStep('FFQ_RED_FAT');
        }
        else if (internalStep === 'FFQ_RED_FAT') {
            const lean = tempItem.meat_lean || "?";
            const combined = `Magra: ${lean} | Grasa: ${userMsg}`;
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, carne_roja: combined } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "limit_red_meat_fat", "cardio_risk_diet"]);
            addBotMsg("4. **Carnes Procesadas** (Salchicha, Jamón, Tocino):");
            setInternalStep('FFQ_MEAT_PROC');
        }
        else if (internalStep === 'FFQ_MEAT_PROC') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, carne_procesada: userMsg } }));
            if (checkFreq(userMsg, 'protective')) setClinicalFlags(prev => [...prev, "good_processed_meat_control"]);
            addBotMsg("5. **Carnes Blancas** (Pollo, Pescado, Atún):");
            setInternalStep('FFQ_WHITE_MEAT');
        }
        else if (internalStep === 'FFQ_WHITE_MEAT') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, pollo: userMsg } }));
            addBotMsg("6. **Cereales y Tubérculos** (Arroz, Pasta, Papa, Pan):");
            setInternalStep('FFQ_CEREALS');
        }
        else if (internalStep === 'FFQ_CEREALS') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, cereales: userMsg } }));
            addBotMsg("7. **Leguminosas** (Frijol, Lenteja, Habas):");
            setInternalStep('FFQ_LEGUMES');
        }
        else if (internalStep === 'FFQ_LEGUMES') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, leguminosas: userMsg } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "warning_fodmap_colitis"]);
            addBotMsg("8. **Verduras** (Crudas o cocidas):");
            setInternalStep('FFQ_VEGGIES');
        }
        else if (internalStep === 'FFQ_VEGGIES') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, verduras: userMsg } }));
            if (checkFreq(userMsg, 'protective')) setClinicalFlags(prev => [...prev, "low_fiber_risk"]);
            else if (checkFreq(userMsg, 'optimal')) setClinicalFlags(prev => [...prev, "good_fiber_intake"]);
            addBotMsg("9. **Frutas**:");
            setInternalStep('FFQ_FRUITS');
        }
        else if (internalStep === 'FFQ_FRUITS') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, frutas: userMsg } }));
            if (checkFreq(userMsg, 'optimal')) setClinicalFlags(prev => [...prev, "good_fruit_intake", "monitor_fructose_load"]);
            addBotMsg("10. **Grasas Saludables** (Aguacate, Nueces, Aceite Oliva):");
            setInternalStep('FFQ_FATS');
        }
        else if (internalStep === 'FFQ_FATS') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, grasas: userMsg } }));
            if (checkFreq(userMsg, 'optimal')) setClinicalFlags(prev => [...prev, "good_fats_intake"]);
            addBotMsg("11. **Azúcares** (Refrescos, Dulces, Postres):");
            setInternalStep('FFQ_SUGARS');
        }
        else if (internalStep === 'FFQ_SUGARS') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, azucares: userMsg } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "high_sugar_risk_CRITICAL"]);
            else if (checkFreq(userMsg, 'protective')) setClinicalFlags(prev => [...prev, "good_sugar_control"]);
            addBotMsg("12. **Comida Rápida / Fritos** (Pizzas, Tacos fritos, etc):");
            setInternalStep('FFQ_JUNK');
        }
        else if (internalStep === 'FFQ_JUNK') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, chatarra: userMsg } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "high_sodium_trans"]);
            else if (checkFreq(userMsg, 'protective')) setClinicalFlags(prev => [...prev, "good_junk_control"]);
            addBotMsg("13. **Agua Natural** (Vasos al día):");
            setInternalStep('FFQ_WATER');
        }
        else if (internalStep === 'FFQ_WATER') {
            const finalDiet = { ...evaluacionDietetica, ffq: { ...evaluacionDietetica.ffq, agua: userMsg } };
            setEvaluacionDietetica(finalDiet);

            // Inyectamos todo el progreso al estado de la APP
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    evaluacionDietetica: finalDiet,
                    clinical_flags: [...(prev.clinical_flags || []), ...clinicalFlags]
                }));
            }

            setInternalStep('FINALIZED');
            if (onPhaseComplete) onPhaseComplete('PHASE_13_BIO_START');
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
                        <span className="text-sm font-medium tracking-wide text-gray-500">FASE 11: EVALUACIÓN DIETÉTICA</span>
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
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-700 transition-transform active:scale-95 shadow-md flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={18} className="ml-0.5" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Fase11_EvaluacionDietetica;
