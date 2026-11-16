import React, { useState, useEffect, useRef } from 'react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { toSentenceCase } from '../../utils/utils';
import { resolvePatientSex, stripNegatedSentinels } from '../../utils/genderConcordance';

export default function Fase7_Alergias({ messages, setMessages, patientData, setPatientData, onPhaseComplete, registerInputHandler, setIsGlobalTyping, onStateChange }) {
    const { patientName: pName, patientAge } = usePatientLinguistics(patientData);
    const ptCtx = patientData?.profile?.pediatric_profile;
    // Para efectos de diálogo, solo consideramos menor (3ra persona) si tiene menos de 12 años (pediátricos).
    // Para adolescentes (12-17) el protocolo exige tratamiento directo ("Usted").
    const isMinor = ptCtx?.is_minor === true && patientAge < 12;
    const { isFemale } = resolvePatientSex(patientData);
    const allergicSuf = isFemale ? 'a' : 'o';

    // Integración de Genoma Clínico y Alertas
    const addAlert = useClinicalGenome(state => state.addAlert);
    const updateAxis = useClinicalGenome(state => state.updateAxis);
    const removeAlertByType = useClinicalGenome(state => state.removeAlertByType);

    const syncClinicalGenomeAlerts = (allergiesObj) => {
        const food = allergiesObj?.food || [];
        const drug = allergiesObj?.drug || [];

        const hasNuts = food.some(f => {
            const agent = String(f.agent).toUpperCase();
            return agent.includes("NUEZ") || agent.includes("ALMENDRA") || agent.includes("CACAHUATE") || agent.includes("FRUTO SEC");
        });
        if (!hasNuts) {
            removeAlertByType('CRÍTICO: SENSIBILIDAD ANAFILÁCTICA A FRUTOS SECOS');
        }

        const hasLact = food.some(f => {
            const agent = String(f.agent).toUpperCase();
            return agent.includes("LACT") || agent.includes("LECHE") || agent.includes("QUESO") || agent.includes("YOGUR");
        });
        if (!hasLact) {
            removeAlertByType('SENSIBILIDAD DE MUCOSA - REACTIVIDAD A LÁCTEOS');
        }

        const hasSeafood = food.some(f => {
            const agent = String(f.agent).toUpperCase();
            return agent.includes("MARISCO") || agent.includes("CAMARON") || agent.includes("PESCADO") || agent.includes("ALGA");
        });
        if (!hasSeafood) {
            removeAlertByType('ALERGIA ALIMENTARIA CO-FACTOR: MARISCOS');
        }

        const hasPenicillin = drug.some(d => {
            const agent = String(d.agent).toUpperCase();
            return agent.includes("PENICILINA") || agent.includes("AMPICILINA") || agent.includes("AMOXI");
        });
        if (!hasPenicillin) {
            removeAlertByType('CONTRAINDICACIÓN FARMACOLÓGICA - BETA-LACTÁMICOS');
        }

        const hasSalicilates = drug.some(d => {
            const agent = String(d.agent).toUpperCase();
            return agent.includes("ASPIRINA") || agent.includes("SALICIL") || agent.includes("ACETIL");
        });
        if (!hasSalicilates) {
            removeAlertByType('FARMACOVIGILANCIA - SALICILATOS');
        }
    };

    const [step, setStep] = useState(() => {
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && msg.content?.includes("detalles inmuno-alérgicos"));
        const hasFood = stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']).length > 0;
        const hasDrug = stripNegatedSentinels(patientData.history?.allergies?.drug || [], ['agent']).length > 0;
        if (patientData?.allergies_edit_mode || hasSummary || hasFood || hasDrug) {
            return 'correct_menu';
        }
        return 'food_gate';
    });
    const [isSingleLineEdit, setIsSingleLineEdit] = useState(false);

    const [tempAllergy, setTempAllergy] = useState({ agent: '', reaction: '', type: '' });

    useEffect(() => {
        if (step === 'correct_menu') {
            setMessages(prev => {
                const lastAssistant = [...prev].reverse().find(m => m.role === 'assistant');
                if (lastAssistant?.content?.includes("¿Qué cambio o acción desea realizar en su historial de alergias?")) return prev;
                return [...prev, {
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de alergias?",
                    inputType: 'strict_select',
                    options: [
                        { label: "➕ Registrar alergia alimentaria", value: "ADD_FOOD" },
                        { label: "➕ Registrar alergia farmacológica", value: "ADD_DRUG" },
                        { label: "✏️ Modificar registro existente", value: "MODIFY_SELECT" },
                        { label: "🗑️ Eliminar registro de la lista", value: "DELETE_SELECT" },
                        { label: "🔄 Limpiar lista completa (Reiniciar)", value: "CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                    ]
                }];
            });
            return;
        }

        const initialMsg = isMinor
            ? `He registrado y sellado el perfil farmacológico de **${pName || "su menor"}** de manera exitosa.\n\nPasemos a la evaluación de sensibilidades inmunológicas. ¿Es **${pName || "su menor"}** alérgic${allergicSuf} a algún alimento? (Ej. Mariscos, Lácteos, Nuez).`
            : `He registrado y sellado su perfil farmacológico de manera exitosa.\n\nPasemos a la evaluación de sensibilidades inmunológicas. ¿Es usted alérgic${allergicSuf} a algún alimento? (Ej. Mariscos, Lácteos, Nuez).`;
        
        setMessages(prev => {
            const alreadyGreeted = prev.some(msg => msg.role === 'assistant' && msg.content.includes("sensibilidades inmunológicas"));
            if (alreadyGreeted) return prev;
            return [...prev, { 
                role: 'assistant', 
                content: initialMsg,
                inputType: 'strict_select',
                options: [
                    { label: "✅ Sí", value: "Sí" },
                    { label: "❌ No", value: "No" }
                ]
            }];
        });
    }, [isMinor, pName, allergicSuf, setMessages, step]);

    const handleSend = (text, directValue = null) => {
        const val = directValue || text;
        let userLabel = text;

        if (val === "ADD_FOOD") userLabel = "➕ Registrar alergia alimentaria";
        if (val === "ADD_DRUG") userLabel = "➕ Registrar alergia farmacológica";
        if (val === "MODIFY_SELECT") userLabel = "✏️ Modificar registro existente";
        if (val === "DELETE_SELECT") userLabel = "🗑️ Eliminar registro de la lista";
        if (val === "CLEAR_ALL") userLabel = "🔄 Limpiar lista completa (Reiniciar)";
        if (val === "FINISH") userLabel = "❌ Cancelar (Volver al resumen)";
        if (val === "BACK_TO_CORRECT") userLabel = "⬅️ Volver al menú anterior";
        if (typeof val === 'string') {
            if (val.startsWith("DELETE_FOOD_INDEX_")) {
                const idx = parseInt(val.replace("DELETE_FOOD_INDEX_", ""), 10);
                const food = patientData.history?.allergies?.food?.[idx];
                userLabel = food ? `🗑️ Eliminar Alergia: ${food.agent}` : "Eliminar alergia alimentaria";
            }
            else if (val.startsWith("DELETE_DRUG_INDEX_")) {
                const idx = parseInt(val.replace("DELETE_DRUG_INDEX_", ""), 10);
                const drug = patientData.history?.allergies?.drug?.[idx];
                userLabel = drug ? `🗑️ Eliminar Alergia: ${drug.agent}` : "Eliminar alergia farmacológica";
            }
            else if (val.startsWith("MODIFY_FOOD_INDEX_")) {
                const idx = parseInt(val.replace("MODIFY_FOOD_INDEX_", ""), 10);
                const food = patientData.history?.allergies?.food?.[idx];
                userLabel = food ? `✏️ Modificar Alergia: ${food.agent}` : "Modificar alergia alimentaria";
            }
            else if (val.startsWith("MODIFY_DRUG_INDEX_")) {
                const idx = parseInt(val.replace("MODIFY_DRUG_INDEX_", ""), 10);
                const drug = patientData.history?.allergies?.drug?.[idx];
                userLabel = drug ? `✏️ Modificar Alergia: ${drug.agent}` : "Modificar alergia farmacológica";
            }
        }

        const inputToSave = userLabel;
        const newUserMsg = { role: 'user', content: inputToSave };

        setMessages(prev => [...prev, newUserMsg]);
        processStep(val, newUserMsg);
    };

    const processStep = (input, newUserMsg) => {
        switch (step) {
            case 'correct_menu': {
                if (input === "ADD_FOOD") {
                    setIsSingleLineEdit(true);
                    setStep('food_agent');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `He registrado la presencia de reacciones alérgicas alimentarias en el expediente de **${pName || "su menor"}**.\n\nPara proteger su plan metabólico, por favor especifique: ¿A qué alimento en particular es alérgic${allergicSuf} **${pName || "su menor"}**?` 
                            : `He registrado la presencia de reacciones alérgicas alimentarias en su expediente.\n\nPara proteger su plan metabólico, por favor especifique: ¿A qué alimento en particular es alérgic${allergicSuf}?`
                    }]);
                } else if (input === "ADD_DRUG") {
                    setIsSingleLineEdit(true);
                    setStep('drug_agent');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `He registrado la presencia de sensibilidades farmacológicas en el expediente de **${pName || "su menor"}**.\n\nPara salvaguardar la integridad clínica, por favor especifique: ¿A qué fármaco o sustancia activa en particular es alérgic${allergicSuf} **${pName || "su menor"}**?` 
                            : `He registrado la presencia de sensibilidades farmacológicas en su expediente.\n\nPara salvaguardar la integridad clínica, por favor especifique: ¿A qué fármaco o sustancia activa en particular es alérgic${allergicSuf}?`
                    }]);
                } else if (input === "MODIFY_SELECT") {
                    const food = stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']);
                    const drug = stripNegatedSentinels(patientData.history?.allergies?.drug || [], ['agent']);
                    
                    if (food.length > 0 || drug.length > 0) {
                        setStep('SELECT_MODIFY_ITEM');
                        const opts = [];
                        food.forEach((f, idx) => {
                            opts.push({ label: `🍏 Alimento: ${f.agent}`, value: `MODIFY_FOOD_INDEX_${idx}` });
                        });
                        drug.forEach((d, idx) => {
                            opts.push({ label: `💊 Fármaco: ${d.agent}`, value: `MODIFY_DRUG_INDEX_${idx}` });
                        });
                        opts.push({ label: "⬅️ Volver al menú anterior", value: "BACK_TO_CORRECT" });

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Qué alergia desea modificar? Seleccione de la lista:",
                            options: opts
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "No existen registros activos para modificar.",
                            options: [
                                { label: "➕ Registrar alergia alimentaria", value: "ADD_FOOD" },
                                { label: "➕ Registrar alergia farmacológica", value: "ADD_DRUG" },
                                { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                            ]
                        }]);
                    }
                } else if (input === "DELETE_SELECT") {
                    const food = stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']);
                    const drug = stripNegatedSentinels(patientData.history?.allergies?.drug || [], ['agent']);
                    
                    if (food.length > 0 || drug.length > 0) {
                        setStep('SELECT_DELETE_ITEM');
                        const opts = [];
                        food.forEach((f, idx) => {
                            opts.push({ label: `🍏 Alimento: ${f.agent}`, value: `DELETE_FOOD_INDEX_${idx}` });
                        });
                        drug.forEach((d, idx) => {
                            opts.push({ label: `💊 Fármaco: ${d.agent}`, value: `DELETE_DRUG_INDEX_${idx}` });
                        });
                        opts.push({ label: "⬅️ Volver al menú anterior", value: "BACK_TO_CORRECT" });

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Qué alergia desea eliminar? Seleccione de la lista:",
                            options: opts
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "No existen registros activos para eliminar.",
                            options: [
                                { label: "➕ Registrar alergia alimentaria", value: "ADD_FOOD" },
                                { label: "➕ Registrar alergia farmacológica", value: "ADD_DRUG" },
                                { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                            ]
                        }]);
                    }
                } else if (input === "CLEAR_ALL") {
                    setIsSingleLineEdit(false);
                    setPatientData(prev => ({
                        ...prev,
                        allergies_edit_mode: false,
                        history: {
                            ...(prev.history || {}),
                            allergies: { food: [], drug: [], negated: true }
                        }
                    }));
                    syncClinicalGenomeAlerts({ food: [], drug: [] });
                    setStep('food_gate');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `Historial de alergias reiniciado.\n\n¿Es **${pName || "su menor"}** alérgic${allergicSuf} a algún alimento?`
                            : `Historial de alergias reiniciado.\n\n¿Es usted alérgic${allergicSuf} a algún alimento?`,
                        inputType: 'strict_select',
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" }
                        ]
                    }]);
                } else if (input === "FINISH") {
                    setIsSingleLineEdit(false);
                    const cleanFood = stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']);
                    const cleanDrug = stripNegatedSentinels(patientData.history?.allergies?.drug || [], ['agent']);
                    if (onPhaseComplete) {
                        onPhaseComplete({ food: cleanFood, drug: cleanDrug, negated: cleanFood.length === 0 && cleanDrug.length === 0 }, messages);
                    }
                }
                break;
            }

            case 'SELECT_MODIFY_ITEM': {
                if (input === "BACK_TO_CORRECT") {
                    setIsSingleLineEdit(false);
                    setStep('correct_menu');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "De acuerdo. ¿Qué cambio o acción desea realizar?",
                        options: [
                            { label: "➕ Registrar alergia alimentaria", value: "ADD_FOOD" },
                            { label: "➕ Registrar alergia farmacológica", value: "ADD_DRUG" },
                            { label: "✏️ Modificar registro existente", value: "MODIFY_SELECT" },
                            { label: "🗑️ Eliminar registro de la lista", value: "DELETE_SELECT" },
                            { label: "🔄 Limpiar lista completa (Reiniciar)", value: "CLEAR_ALL" },
                            { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                        ]
                    }]);
                    return;
                }
                if (input.startsWith("MODIFY_FOOD_INDEX_")) {
                    const idx = parseInt(input.replace("MODIFY_FOOD_INDEX_", ""), 10);
                    const food = stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']);
                    if (food[idx]) {
                        const target = food[idx];
                        const updated = food.filter((_, i) => i !== idx);

                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...(prev.history || {}),
                                allergies: {
                                    ...(prev.history?.allergies || {}),
                                    food: updated
                                }
                            }
                        }));

                        setIsSingleLineEdit(true);
                        setTempAllergy({ agent: target.agent, reaction: '', type: 'FOOD' });
                        setStep('food_agent');

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Modificando alergia alimentaria. Por favor confirme si conserva **${target.agent}** o escriba el alimento:`,
                            options: [
                                { label: `✅ Conservar: ${target.agent}`, value: target.agent },
                                { label: "✍️ Escribir otro alimento", value: "__EDIT_FOOD_AGENT__" }
                            ]
                        }]);
                    }
                }
                else if (input.startsWith("MODIFY_DRUG_INDEX_")) {
                    const idx = parseInt(input.replace("MODIFY_DRUG_INDEX_", ""), 10);
                    const drug = stripNegatedSentinels(patientData.history?.allergies?.drug || [], ['agent']);
                    if (drug[idx]) {
                        const target = drug[idx];
                        const updated = drug.filter((_, i) => i !== idx);

                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...(prev.history || {}),
                                allergies: {
                                    ...(prev.history?.allergies || {}),
                                    drug: updated
                                }
                            }
                        }));

                        setIsSingleLineEdit(true);
                        setTempAllergy({ agent: target.agent, reaction: '', type: 'DRUG' });
                        setStep('drug_agent');

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Modificando alergia farmacológica. Por favor confirme si conserva **${target.agent}** o escriba la sustancia:`,
                            options: [
                                { label: `✅ Conservar: ${target.agent}`, value: target.agent },
                                { label: "✍️ Escribir otro fármaco", value: "__EDIT_DRUG_AGENT__" }
                            ]
                        }]);
                    }
                }
                break;
            }

            case 'SELECT_DELETE_ITEM': {
                if (input === "BACK_TO_CORRECT") {
                    setIsSingleLineEdit(false);
                    setStep('correct_menu');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "De acuerdo. ¿Qué cambio o acción desea realizar?",
                        options: [
                            { label: "➕ Registrar alergia alimentaria", value: "ADD_FOOD" },
                            { label: "➕ Registrar alergia farmacológica", value: "ADD_DRUG" },
                            { label: "✏️ Modificar registro existente", value: "MODIFY_SELECT" },
                            { label: "🗑️ Eliminar registro de la lista", value: "DELETE_SELECT" },
                            { label: "🔄 Limpiar lista completa (Reiniciar)", value: "CLEAR_ALL" },
                            { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                        ]
                    }]);
                    return;
                }
                if (input.startsWith("DELETE_FOOD_INDEX_")) {
                    const idx = parseInt(input.replace("DELETE_FOOD_INDEX_", ""), 10);
                    const food = stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']);
                    const drug = stripNegatedSentinels(patientData.history?.allergies?.drug || [], ['agent']);
                    if (food[idx]) {
                        const updated = food.filter((_, i) => i !== idx);
                        setIsSingleLineEdit(false);

                        const newAllergies = {
                            food: updated,
                            drug: drug,
                            negated: updated.length === 0 && drug.length === 0
                        };

                        setPatientData(prev => ({
                            ...prev,
                            allergies_edit_mode: false,
                            history: {
                                ...(prev.history || {}),
                                allergies: newAllergies
                            }
                        }));
                        syncClinicalGenomeAlerts(newAllergies);

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Alergia alimentaria eliminada con éxito."
                        }]);

                        setTimeout(() => {
                            if (onPhaseComplete) {
                                onPhaseComplete(newAllergies, messages);
                            }
                        }, 500);
                    }
                }
                else if (input.startsWith("DELETE_DRUG_INDEX_")) {
                    const idx = parseInt(input.replace("DELETE_DRUG_INDEX_", ""), 10);
                    const food = stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']);
                    const drug = stripNegatedSentinels(patientData.history?.allergies?.drug || [], ['agent']);
                    if (drug[idx]) {
                        const updated = drug.filter((_, i) => i !== idx);
                        setIsSingleLineEdit(false);

                        const newAllergies = {
                            food: food,
                            drug: updated,
                            negated: food.length === 0 && updated.length === 0
                        };

                        setPatientData(prev => ({
                            ...prev,
                            allergies_edit_mode: false,
                            history: {
                                ...(prev.history || {}),
                                allergies: newAllergies
                            }
                        }));
                        syncClinicalGenomeAlerts(newAllergies);

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Alergia farmacológica eliminada con éxito."
                        }]);

                        setTimeout(() => {
                            if (onPhaseComplete) {
                                onPhaseComplete(newAllergies, messages);
                            }
                        }, 500);
                    }
                }
                break;
            }

            // ================= ALIMENTOS =================
            case 'food_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `He registrado la presencia de reacciones alérgicas alimentarias en el expediente de **${pName || "su menor"}**.\n\nPara proteger su plan metabólico, por favor especifique: ¿A qué alimento en particular es alérgic${allergicSuf} **${pName || "su menor"}**?` 
                            : `He registrado la presencia de reacciones alérgicas alimentarias en su expediente.\n\nPara proteger su plan metabólico, por favor especifique: ¿A qué alimento en particular es alérgic${allergicSuf}?`
                    }]);
                    setStep('food_agent');
                } else if (input === "No") {
                    const newAllergies = {
                        ...(patientData.history?.allergies || {}),
                        food: []
                    };
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...(prev.history || {}),
                            allergies: newAllergies
                        }
                    }));
                    syncClinicalGenomeAlerts(newAllergies);
                    transitionToDrugs();
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: "Verificación de entrada de seguridad.\n\nPor favor seleccione Sí o No.",
                        inputType: 'strict_select',
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" }
                        ]
                    }]);
                }
                break;
            }
            case 'food_agent': {
                if (input === "__EDIT_FOOD_AGENT__") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Por favor escriba el nombre del alimento al que presenta alergia:"
                    }]);
                    setStep('food_agent');
                    break;
                }
                const cleanAgent = toSentenceCase(input.trim());
                setTempAllergy(prev => ({ ...prev, agent: cleanAgent, type: 'FOOD' }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor 
                        ? `Entendido. Hemos etiquetado **${cleanAgent}** como restricción absoluta en la matriz nutricional de **${pName || "su menor"}**.\n\nPara determinar el nivel de riesgo clínico, ¿qué reacción específica le provoca el consumo de este alimento a **${pName || "su menor"}**? (Ej. Inflamación, ronchas, anafilaxia, picazón).` 
                        : `Entendido. Hemos etiquetado **${cleanAgent}** como restricción absoluta en su matriz nutricional.\n\nPara determinar el nivel de riesgo clínico, ¿qué reacción específica le provoca el consumo de este alimento? (Ej. Inflamación, ronchas, anafilaxia, picazón).`
                }]);
                setStep('food_reaction');
                break;
            }
            case 'food_reaction': {
                const cleanReaction = toSentenceCase(input.trim());
                const newFoodAllergy = {
                    agent: tempAllergy.agent,
                    reaction: cleanReaction,
                    status: 'ACTIVE'
                };

                const cleanExistingFood = stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']);
                const cleanExistingDrug = stripNegatedSentinels(patientData.history?.allergies?.drug || [], ['agent']);
                const updatedAllergies = {
                    food: [...cleanExistingFood, newFoodAllergy],
                    drug: cleanExistingDrug,
                    negated: false
                };

                setPatientData(prev => ({
                    ...prev,
                    allergies_edit_mode: false,
                    history: {
                        ...(prev.history || {}),
                        allergies: updatedAllergies
                    }
                }));

                // --- INTEGRACIÓN SINFÓNICA CON EL SAFETY ENGINE ---
                const finalAgent = String(tempAllergy.agent).toUpperCase();
                
                if (finalAgent.includes("MARISCO") || finalAgent.includes("CAMARON") || finalAgent.includes("PULPO") || finalAgent.includes("LANGOS")) {
                    addAlert({
                        type: 'BANDERA ROJA - ALERGIA INMUNOLÓGICA DE ALTO RIESGO (IgE)',
                        message: `El paciente presenta alergia declarada a MARISCOS con reacción de ${input.toLowerCase()}. Se prohíbe de forma absoluta la prescripción de suplementos que contengan quitosano, extracto de cartílago marino o derivados de algas no purificados.`
                    });
                    updateAxis('immuneAxis', { hyperReactivity: true });
                }
                else if (finalAgent.includes("LACT") || finalAgent.includes("LECHE") || finalAgent.includes("QUESO") || finalAgent.includes("YOGUR")) {
                    addAlert({
                        type: 'SENSIBILIDAD DE MUCOSA - REACTIVIDAD A LÁCTEOS',
                        message: `Alergia/Intolerancia a Lácteos activa. Restringir proteínas de suero de leche (Whey) y modular la ingesta de inmunoglobulinas. Se aconseja priorizar proteínas vegetales o hidrolizados libres de caseína.`
                    });
                    updateAxis('digestiveAxis', { mucosalInflammation: true });
                }
                else if (finalAgent.includes("NUEZ") || finalAgent.includes("ALMENDRA") || finalAgent.includes("CACAHUATE") || finalAgent.includes("FRUTO SEC")) {
                    addAlert({
                        type: 'CRÍTICO: SENSIBILIDAD ANAFILÁCTICA A FRUTOS SECOS',
                        message: `Riesgo crítico de anafilaxia por exposición a frutos secos (${finalAgent}). Excluir grasas vegetales derivadas de estas oleaginosas del recetario.`
                    });
                    updateAxis('immuneAxis', { hyperReactivity: true });
                }

                setTempAllergy({ agent: '', reaction: '', type: '' });
                syncClinicalGenomeAlerts(updatedAllergies);

                if (isSingleLineEdit) {
                    setIsSingleLineEdit(false);
                    if (onPhaseComplete) {
                        onPhaseComplete(updatedAllergies, messages);
                    }
                    break;
                }

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor 
                        ? `Alergia alimentaria registrada de forma satisfactoria.\n\n¿Existe algún otro alimento al que **${pName || "su menor"}** presente sensibilidades o reacciones adversas?` 
                        : `Alergia alimentaria registrada de forma satisfactoria.\n\n¿Existe algún otro alimento al que presente sensibilidades o reacciones adversas?`,
                    inputType: 'strict_select',
                    options: [
                        { label: "✅ Sí", value: "Sí" },
                        { label: "❌ No", value: "No" }
                    ]
                }]);
                setStep('food_next');
                break;
            }
            case 'food_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `Panel de antígenos alimentarios reactivado de forma exitosa.\n\n¿A qué otro alimento en particular es alérgic${allergicSuf} **${pName || "su menor"}**?` 
                            : `Panel de antígenos alimentarios reactivado de forma exitosa.\n\n¿A qué otro alimento en particular es alérgic${allergicSuf}?`
                    }]);
                    setStep('food_agent');
                } else if (input === "No") {
                    transitionToDrugs();
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: "Verificación de entrada.\n\nResponda SÍ o NO.",
                        inputType: 'strict_select',
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" }
                        ]
                    }]);
                }
                break;
            }

            // ================= MEDICAMENTOS =================
            case 'drug_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `He registrado la presencia de sensibilidades farmacológicas en el expediente de **${pName || "su menor"}**.\n\nPara salvaguardar la integridad clínica, por favor especifique: ¿A qué fármaco o sustancia activa en particular es alérgic${allergicSuf} **${pName || "su menor"}**?` 
                            : `He registrado la presencia de sensibilidades farmacológicas en su expediente.\n\nPara salvaguardar la integridad clínica, por favor especifique: ¿A qué fármaco o sustancia activa en particular es alérgic${allergicSuf}?`
                    }]);
                    setStep('drug_agent');
                } else if (input === "No") {
                    const newAllergies = {
                        food: stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']),
                        drug: [],
                        negated: stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']).length === 0
                    };
                    setPatientData(prev => ({
                        ...prev,
                        allergies_edit_mode: false,
                        history: {
                            ...(prev.history || {}),
                            allergies: newAllergies
                        }
                    }));
                    syncClinicalGenomeAlerts(newAllergies);
                    handleFinish(newUserMsg, newAllergies);
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: "Verificación de entrada de seguridad.\n\nPor favor seleccione Sí o No.",
                        inputType: 'strict_select',
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" }
                        ]
                    }]);
                }
                break;
            }
            case 'drug_agent': {
                if (input === "__EDIT_DRUG_AGENT__") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Por favor escriba el nombre del fármaco o sustancia activa:"
                    }]);
                    setStep('drug_agent');
                    break;
                }
                const cleanAgent = toSentenceCase(input.trim());
                setTempAllergy(prev => ({ ...prev, agent: cleanAgent, type: 'DRUG' }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor 
                        ? `Entendido. Hemos registrado **${cleanAgent}** como contraindicación farmacológica crítica en el expediente.\n\nPara determinar la severidad del riesgo clínico, ¿qué reacción específica le provoca el contacto o consumo de esta sustancia a **${pName || "su menor"}**?` 
                        : `Entendido. Hemos registrado **${cleanAgent}** como contraindicación farmacológica crítica en su expediente.\n\nPara determinar la severidad del riesgo clínico, ¿qué reacción específica le provoca el contacto o consumo de esta sustancia?`
                }]);
                setStep('drug_reaction');
                break;
            }
            case 'drug_reaction': {
                const cleanReaction = toSentenceCase(input.trim());
                const newDrugAllergy = {
                    agent: tempAllergy.agent,
                    reaction: cleanReaction,
                    status: 'ACTIVE'
                };

                const cleanExistingFood = stripNegatedSentinels(patientData.history?.allergies?.food || [], ['agent']);
                const cleanExistingDrug = stripNegatedSentinels(patientData.history?.allergies?.drug || [], ['agent']);
                const updatedAllergies = {
                    food: cleanExistingFood,
                    drug: [...cleanExistingDrug, newDrugAllergy],
                    negated: false
                };

                setPatientData(prev => ({
                    ...prev,
                    allergies_edit_mode: false,
                    history: {
                        ...(prev.history || {}),
                        allergies: updatedAllergies
                    }
                }));

                // --- INTEGRACIÓN SINFÓNICA CON EL SAFETY ENGINE ---
                const finalAgent = String(tempAllergy.agent).toUpperCase();

                if (finalAgent.includes("PENICILINA") || finalAgent.includes("AMPICILINA") || finalAgent.includes("AMOXI")) {
                    addAlert({
                        type: 'CONTRAINDICACIÓN FARMACOLÓGICA - BETA-LACTÁMICOS',
                        message: `Alergia crítica a Penicilina / Beta-lactámicos declarada. Red-flag activa en el expediente de farmacia digital para evitar prescripciones cruzadas.`
                    });
                    updateAxis('immuneAxis', { hyperReactivity: true });
                }
                else if (finalAgent.includes("ASPIRINA") || finalAgent.includes("SALICIL") || finalAgent.includes("ACETIL")) {
                    addAlert({
                        type: 'FARMACOVIGILANCIA - SALICILATOS',
                        message: `Sensibilidad declarada a Salicilatos (Aspirina). Evitar fitoterapéuticos con alta carga de ácido salicílico (como extracto de sauce blanco) y vigilar mucosa gástrica.`
                    });
                    updateAxis('digestiveAxis', { mucosalInflammation: true });
                }

                setTempAllergy({ agent: '', reaction: '', type: '' });
                syncClinicalGenomeAlerts(updatedAllergies);

                if (isSingleLineEdit) {
                    setIsSingleLineEdit(false);
                    if (onPhaseComplete) {
                        onPhaseComplete(updatedAllergies, messages);
                    }
                    break;
                }

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor 
                        ? `Sensibilidad farmacológica registrada exitosamente en el expediente base.\n\n¿Existe alguna otra sustancia activa o medicamento al que **${pName || "su menor"}** presente una reacción adversa?` 
                        : `Sensibilidad farmacológica registrada exitosamente en el expediente base.\n\n¿Existe alguna otra sustancia activa o medicamento al que presente una reacción adversa?`,
                    inputType: 'strict_select',
                    options: [
                        { label: "✅ Sí", value: "Sí" },
                        { label: "❌ No", value: "No" }
                    ]
                }]);
                setStep('drug_next');
                break;
            }
            case 'drug_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `Panel de antígenos farmacológicos reactivado de forma exitosa.\n\n¿A qué otro medicamento o sustancia activa en particular es alérgic${allergicSuf} **${pName || "su menor"}**?` 
                            : `Panel de antígenos farmacológicos reactivado de forma exitosa.\n\n¿A qué otro medicamento o sustancia activa en particular es alérgic${allergicSuf}?`
                    }]);
                    setStep('drug_agent');
                } else if (input === "No") {
                    handleFinish(newUserMsg);
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: "Verificación de entrada.\n\nResponda SÍ o NO.",
                        inputType: 'strict_select',
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" }
                        ]
                    }]);
                }
                break;
            }

            default:
                break;
        }
    };

    const transitionToDrugs = () => {
        const msgContent = isMinor
            ? `He consolidado el registro de sensibilidades alimentarias en el expediente de **${pName || "su menor"}**.\n\nPasemos a la evaluación de sensibilidades farmacológicas. ¿Es **${pName || "su menor"}** alérgic${allergicSuf} a algún fármaco, antibiótico o sustancia activa? (Ej. Penicilina, Aspirina).`
            : `He consolidado el registro de sensibilidades alimentarias en su expediente.\n\nPasemos a la evaluación de sensibilidades farmacológicas. ¿Es usted alérgic${allergicSuf} a algún fármaco, antibiótico o sustancia activa? (Ej. Penicilina, Aspirina).`;

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: msgContent,
            inputType: 'strict_select',
            options: [
                { label: "✅ Sí", value: "Sí" },
                { label: "❌ No", value: "No" }
            ]
        }]);
        setStep('drug_gate');
    };

    const handleFinish = (newUserMsg, explicitAllergies = null) => {
        setIsSingleLineEdit(false);
        const finalMsgs = newUserMsg ? [...messages, newUserMsg] : messages;
        const source = explicitAllergies || patientData.history?.allergies || {};
        const cleanFood = stripNegatedSentinels(source.food || [], ['agent']);
        const cleanDrug = stripNegatedSentinels(source.drug || [], ['agent']);
        onPhaseComplete({ food: cleanFood, drug: cleanDrug, negated: cleanFood.length === 0 && cleanDrug.length === 0 }, finalMsgs);
    };

    const handleSendRef = useRef(handleSend);
    useEffect(() => {
        handleSendRef.current = handleSend;
    });

    // Register Handler
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, label) => handleSendRef.current(text, null));
        }
    }, [registerInputHandler]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(false);
        }
    }, [setIsGlobalTyping]);

    return null;
}
