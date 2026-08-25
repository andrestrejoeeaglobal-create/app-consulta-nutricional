import React, { useState, useEffect, useRef } from 'react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

/**
 * T.I.L.O. - MÓDULO FASE 14 (CRONONUTRICIÓN / R24H)
 * Versión: v5.1 - Orthopedically Aligned, Rule V, Spelling Fix & Callback Constructor Fix
 */
export default function Fase14_CrononutricionR24H({
    patientData,
    setPatientData,
    onPhaseComplete,
    registerInputHandler,
    messages,
    setMessages,
    setIsGlobalTyping
}) {
    const { patientName: pName, isMinor } = usePatientLinguistics(patientData);
    const [internalStep, setInternalStep] = useState(() => {
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && msg.content.includes("Crononutrición y Recordatorio de 24 Horas"));
        const r = patientData?.evaluacionDietetica?.r24h;
        if (hasSummary || (r && r.length > 0)) {
            return 'correct_menu';
        }
        return 'R24H_TIME';
    });
    const [r24hList, setR24hList] = useState(patientData?.evaluacionDietetica?.r24h || []);
    const [tempTime, setTempTime] = useState("");
    const hasGreeted = useRef(false);

    // Auto-transition on mount if already completed (resilience against page reloads/crashes)
    useEffect(() => {
        const alreadyCompleted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Recordatorio de 24 Horas registrado con éxito"));
        if (alreadyCompleted) {
            onPhaseComplete('PHASE_15_FFQ');
        }
    }, [messages, onPhaseComplete]);

    // Inicialización - Mitigación absoluta de doble render en StrictMode
    useEffect(() => {
        if (hasGreeted.current) return;

        if (internalStep === 'correct_menu') {
            hasGreeted.current = true;
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de Crononutrición y Recordatorio de 24 Horas (R24H)?",
                options: [
                    { label: "✏️ Modificar/Agregar consumos", value: "MODIFY_R24H" },
                    { label: "🔄 Reiniciar y limpiar R24H", value: "CLEAR_ALL" },
                    { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                ]
            }]);
            return;
        }

        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Recordatorio de 24 Horas"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;
            const initialMsg = isMinor
                ? `He registrado y sellado el perfil de preferencias alimentarias de **${pName}** de manera exitosa.\n\nPasemos a la **Crononutrición y Recordatorio de 24 Horas**.\n\nDime, ¿a qué hora consumió **${pName}** su primer alimento el día de ayer? (Ej. 8:00 am).`
                : "He registrado y sellado su perfil de preferencias alimentarias de manera exitosa.\n\nPasemos a su **Crononutrición y Recordatorio de 24 Horas**.\n\nDígame, ¿a qué hora consumió su primer alimento el día de ayer? (Ej. 8:00 am).";

            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: initialMsg,
                inputType: 'time_picker'
            }]);
        }
    }, [messages, isMinor, pName, setMessages, internalStep]);


    // Sincronización en tiempo real con el expediente global
    useEffect(() => {
        if (setPatientData) {
            setPatientData(prev => {
                const currentList = prev.evaluacionDietetica?.r24h;
                if (JSON.stringify(currentList) === JSON.stringify(r24hList)) {
                    return prev;
                }
                return {
                    ...prev,
                    evaluacionDietetica: {
                        ...(prev.evaluacionDietetica || {}),
                        r24h: r24hList
                    }
                };
            });
        }
    }, [r24hList, setPatientData]);

    const processStep = async (input, label = null) => {
        let userText = (label && label !== 'text' && label !== 'button') ? label : input;
        if (input === "MODIFY_R24H") userText = "✏️ Modificar/Agregar consumos";
        if (input === "CLEAR_ALL") userText = "🔄 Reiniciar y limpiar R24H";
        if (input === "FINISH") userText = "❌ Cancelar (Volver al resumen)";

        if (label !== 'button') {
            setMessages(prev => [...prev, { role: 'user', content: userText }]);
        }
        
        const userMsg = input;
        const lower = userMsg.toLowerCase();
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const addBotMsg = (msg, options = null, inputType = null) => {
            setMessages(prev => [...prev, { role: 'assistant', content: msg, options, inputType }]);
        };

        if (internalStep === 'correct_menu') {
            if (input === "MODIFY_R24H") {
                const retryMsg = isMinor 
                    ? `Entendido. ¿A qué hora consumió **${pName}** su siguiente/primer alimento ayer?` 
                    : "Entendido. ¿A qué hora consumió su siguiente/primer alimento ayer?";
                addBotMsg(retryMsg, null, 'time_picker');
                setInternalStep('R24H_TIME');
            } else if (input === "CLEAR_ALL") {
                setR24hList([]);
                const initialMsg = isMinor
                    ? `Historial de recordatorio de 24 horas reiniciado.\n\n¿A qué hora consumió **${pName}** su primer alimento ayer?`
                    : "Historial de recordatorio de 24 horas reiniciado.\n\n¿A qué hora consumió su primer alimento ayer?";
                addBotMsg(initialMsg, null, 'time_picker');
                setInternalStep('R24H_TIME');
            } else if (input === "FINISH") {
                onPhaseComplete(r24hList, messages);
            }
        } else if (internalStep === 'R24H_TIME') {
            const isDeclining = /^\s*(no|nada|ninguno|ninguna|no comi nada|no consumi nada|ayuno|ningun alimento|no, nada|no, ninguno)\s*$/i.test(lower) || lower === 'fin' || lower === 'terminar' || lower.includes('termina');
            if (isDeclining) {
                if (r24hList.length === 0) {
                    addBotMsg(
                        isMinor 
                            ? `¿Seguro que **${pName}** no consumió ningún alimento en todo el día de ayer?` 
                            : "¿Seguro que no consumió ningún alimento en todo el día de ayer?",
                        [
                            { label: "✅ Sí, estoy seguro / Ayuno", value: "CONFIRM_EMPTY" },
                            { label: "❌ No, quiero registrar", value: "RETRY_R24H" }
                        ]
                    );
                    setInternalStep('CONFIRM_EMPTY_GATE');
                } else {
                    showSummary(r24hList);
                    setInternalStep('REVIEW_SUMMARY');
                }
            } else {
                setTempTime(userMsg);
                addBotMsg(isMinor ? `¿Qué comió o bebió **${pName}** a las **${userMsg}**?` : `¿Qué comió o bebió a las **${userMsg}**?`);
                setInternalStep('R24H_CONTENT');
            }
        } else if (internalStep === 'CONFIRM_EMPTY_GATE') {
            if (userMsg === "CONFIRM_EMPTY" || lower === "si" || lower === "sí" || lower === "yes") {
                setPatientData(prev => ({
                    ...prev,
                    evaluacionDietetica: {
                        ...(prev.evaluacionDietetica || {}),
                        r24h: []
                    }
                }));
                addBotMsg("✅ Se ha registrado un día de ayuno / sin consumo de alimentos.");
                setTimeout(() => {
                    onPhaseComplete('PHASE_15_FFQ');
                }, 1000);
            } else {
                addBotMsg(
                    isMinor 
                        ? `Entendido. ¿A qué hora consumió **${pName}** su primer alimento ayer?` 
                        : "Entendido. ¿A qué hora consumió su primer alimento ayer?",
                    null,
                    'time_picker'
                );
                setInternalStep('R24H_TIME');
            }
        } else if (internalStep === 'R24H_CONTENT') {
            const newItem = { hora: tempTime, alimento: userMsg };
            const newList = [...r24hList, newItem];
            setR24hList(newList);

            addBotMsg(
                isMinor 
                    ? "¿Cuál fue la siguiente hora de consumo? (O indique '**Fin**' si hemos terminado el día)." 
                    : "¿Cuál fue la siguiente hora de consumo? (O indique '**Fin**' si hemos terminado el día).",
                null,
                'time_picker'
            );
            setInternalStep('R24H_TIME');
        } else if (internalStep === 'REVIEW_SUMMARY') {
            if (userMsg === "CONFIRM_DATA") {
                // Persistir
                setPatientData(prev => ({
                    ...prev,
                    evaluacionDietetica: {
                        ...(prev.evaluacionDietetica || {}),
                        r24h: r24hList
                    }
                }));

                addBotMsg("✅ Recordatorio de 24 Horas registrado con éxito.");
                setTimeout(() => {
                    onPhaseComplete('PHASE_15_FFQ');
                }, 1000);
            } else {
                // Reiniciar
                setR24hList([]);
                addBotMsg(
                    isMinor 
                        ? `Reconfigurando. ¿A qué hora consumió **${pName}** su primer alimento ayer?` 
                        : "Reconfigurando. ¿A qué hora consumió su primer alimento ayer?",
                    null,
                    'time_picker'
                );
                setInternalStep('R24H_TIME');
            }
        }

        setIsGlobalTyping(false);
    };

    // Middleware de enrutamiento: callback constructor para corregir la ejecución prematura en App.jsx
    const processStepRef = useRef(processStep);
    useEffect(() => {
        processStepRef.current = processStep;
    });

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, label) => processStepRef.current(text, label));
        }
        return () => {
            if (registerInputHandler) {
                registerInputHandler(null);
            }
        };
    }, [registerInputHandler]);

    const showSummary = (list) => {
        const itemsStr = list.map(item => `- ⏰ **${item.hora}**: ${item.alimento}`).join('\n');
        const summary = `Para cerrar este bloque de Crononutrición y dar cumplimiento a la **NOM-004**, verifique los consumos registrados:\n\n` +
            `${itemsStr}\n\n` +
            `---\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: summary,
            options: [
                { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                { label: "❌ No, quiero corregir", value: "CORRECT_DATA" }
            ]
        }]);
    };

    return null; // Headless component
}
