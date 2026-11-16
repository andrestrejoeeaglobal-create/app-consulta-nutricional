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
    const [isSingleLineEdit, setIsSingleLineEdit] = useState(false);
    const [editingMealIndex, setEditingMealIndex] = useState(null);
    const hasGreeted = useRef(false);

    const buildR24hCorrectOptions = (list, returnCode = "FINISH") => {
        const opts = [
            { label: "➕ Agregar tiempo de comida", value: "ADD_MEAL" }
        ];
        if (Array.isArray(list) && list.length > 0) {
            opts.push({ label: "✏️ Modificar un consumo específico", value: "MODIFY_SELECT" });
            opts.push({ label: "🗑️ Eliminar un registro", value: "DELETE_SELECT" });
        }
        opts.push({ label: "🔄 Reiniciar y limpiar R24H", value: "CLEAR_ALL" });
        opts.push({ label: "❌ Volver al resumen", value: returnCode });
        return opts;
    };

    // Auto-transition on mount if already completed (resilience against page reloads/crashes)
    useEffect(() => {
        const alreadyCompleted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Recordatorio de 24 Horas registrado con éxito"));
        if (alreadyCompleted && internalStep !== 'correct_menu') {
            onPhaseComplete('PHASE_15_FFQ');
        }
    }, [messages, onPhaseComplete, internalStep]);

    // Inicialización - Mitigación absoluta de doble render en StrictMode
    useEffect(() => {
        if (hasGreeted.current) return;

        if (internalStep === 'correct_menu') {
            hasGreeted.current = true;
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de Crononutrición y Recordatorio de 24 Horas (R24H)?",
                options: buildR24hCorrectOptions(r24hList, "FINISH")
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
        if (input === "ADD_MEAL" || input === "MODIFY_R24H") userText = "➕ Agregar tiempo de comida";
        if (input === "MODIFY_SELECT") userText = "✏️ Modificar un consumo específico";
        if (input === "DELETE_SELECT") userText = "🗑️ Eliminar un registro";
        if (input === "CLEAR_ALL") userText = "🔄 Reiniciar y limpiar R24H";
        if (input === "FINISH" || input === "RETURN_SUMMARY") userText = "❌ Volver al resumen";
        if (input === "BACK_MENU") userText = "⬅️ Volver al menú de corrección";

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
            if (input === "ADD_MEAL" || input === "MODIFY_R24H") {
                setIsSingleLineEdit(true);
                setEditingMealIndex(null);
                const retryMsg = isMinor 
                    ? `Entendido. ¿A qué hora consumió **${pName}** este alimento?` 
                    : "Entendido. ¿A qué hora consumió este alimento?";
                addBotMsg(retryMsg, null, 'time_picker');
                setInternalStep('R24H_TIME');
            } else if (input === "MODIFY_SELECT") {
                const opts = r24hList.map((item, idx) => ({
                    label: `⏰ ${item.hora}: ${item.alimento}`,
                    value: `EDIT_IDX_${idx}`
                }));
                opts.push({ label: "⬅️ Volver", value: "BACK_MENU" });
                addBotMsg("Seleccione el tiempo de comida que desea modificar:", opts);
                setInternalStep('SELECT_MEAL_TO_EDIT');
            } else if (input === "DELETE_SELECT") {
                const opts = r24hList.map((item, idx) => ({
                    label: `🗑️ ${item.hora}: ${item.alimento}`,
                    value: `DEL_IDX_${idx}`
                }));
                opts.push({ label: "⬅️ Volver", value: "BACK_MENU" });
                addBotMsg("Seleccione el registro que desea eliminar:", opts);
                setInternalStep('SELECT_MEAL_TO_DELETE');
            } else if (input === "CLEAR_ALL") {
                setIsSingleLineEdit(false);
                setEditingMealIndex(null);
                setR24hList([]);
                const initialMsg = isMinor
                    ? `Historial de recordatorio de 24 horas reiniciado.\n\n¿A qué hora consumió **${pName}** su primer alimento ayer?`
                    : "Historial de recordatorio de 24 horas reiniciado.\n\n¿A qué hora consumió su primer alimento ayer?";
                addBotMsg(initialMsg, null, 'time_picker');
                setInternalStep('R24H_TIME');
            } else if (input === "RETURN_SUMMARY") {
                setIsSingleLineEdit(false);
                setEditingMealIndex(null);
                showSummary(r24hList);
                setInternalStep('REVIEW_SUMMARY');
            } else if (input === "FINISH") {
                setIsSingleLineEdit(false);
                setEditingMealIndex(null);
                onPhaseComplete(r24hList, messages);
            }
        } else if (internalStep === 'SELECT_MEAL_TO_EDIT') {
            if (userMsg === "BACK_MENU") {
                addBotMsg("¿Qué cambio desea realizar en su Recordatorio de 24 Horas?", buildR24hCorrectOptions(r24hList, "RETURN_SUMMARY"));
                setInternalStep('correct_menu');
            } else if (userMsg.startsWith("EDIT_IDX_")) {
                const idx = parseInt(userMsg.replace("EDIT_IDX_", ""), 10);
                if (!isNaN(idx) && r24hList[idx]) {
                    setEditingMealIndex(idx);
                    setIsSingleLineEdit(true);
                    addBotMsg(`Modificando registro (**${r24hList[idx].hora}**: ${r24hList[idx].alimento}).\n\nIndique la hora corregida:`, null, 'time_picker');
                    setInternalStep('R24H_TIME');
                }
            }
        } else if (internalStep === 'SELECT_MEAL_TO_DELETE') {
            if (userMsg === "BACK_MENU") {
                addBotMsg("¿Qué cambio desea realizar en su Recordatorio de 24 Horas?", buildR24hCorrectOptions(r24hList, "RETURN_SUMMARY"));
                setInternalStep('correct_menu');
            } else if (userMsg.startsWith("DEL_IDX_")) {
                const idx = parseInt(userMsg.replace("DEL_IDX_", ""), 10);
                const updatedList = r24hList.filter((_, i) => i !== idx);
                setR24hList(updatedList);
                setIsSingleLineEdit(false);
                setEditingMealIndex(null);
                showSummary(updatedList);
                setInternalStep('REVIEW_SUMMARY');
            }
        } else if (internalStep === 'R24H_TIME') {
            const isDeclining = /^\s*(no|nada|ninguno|ninguna|no comi nada|no consumi nada|ayuno|ningun alimento|no, nada|no, ninguno)\s*$/i.test(lower) || lower === 'fin' || lower === 'terminar' || lower.includes('termina');
            if (isDeclining && editingMealIndex === null) {
                if (isSingleLineEdit) {
                    setIsSingleLineEdit(false);
                    showSummary(r24hList);
                    setInternalStep('REVIEW_SUMMARY');
                } else if (r24hList.length === 0) {
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
                setIsSingleLineEdit(false);
                setEditingMealIndex(null);
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
            let newList;
            if (editingMealIndex !== null && r24hList[editingMealIndex]) {
                newList = r24hList.map((item, idx) => idx === editingMealIndex ? newItem : item);
            } else {
                newList = [...r24hList, newItem];
            }
            setR24hList(newList);

            if (isSingleLineEdit) {
                setIsSingleLineEdit(false);
                setEditingMealIndex(null);
                showSummary(newList);
                setInternalStep('REVIEW_SUMMARY');
            } else {
                addBotMsg(
                    isMinor 
                        ? "¿Cuál fue la siguiente hora de consumo? (O indique '**Fin**' si hemos terminado el día)." 
                        : "¿Cuál fue la siguiente hora de consumo? (O indique '**Fin**' si hemos terminado el día).",
                    null,
                    'time_picker'
                );
                setInternalStep('R24H_TIME');
            }
        } else if (internalStep === 'REVIEW_SUMMARY') {
            if (userMsg === "CONFIRM_DATA") {
                setIsSingleLineEdit(false);
                setEditingMealIndex(null);
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
                setIsSingleLineEdit(false);
                setEditingMealIndex(null);
                addBotMsg(
                    "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de Crononutrición y Recordatorio de 24 Horas (R24H)?",
                    buildR24hCorrectOptions(r24hList, "RETURN_SUMMARY")
                );
                setInternalStep('correct_menu');
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
        const itemsStr = (Array.isArray(list) && list.length > 0)
            ? list.map(item => `- ⏰ **${item.hora}**: ${item.alimento}`).join('\n')
            : `- ⏰ **Sin registros declarados**: Ninguno (Ayuno / Sin consumo reportado)`;
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
