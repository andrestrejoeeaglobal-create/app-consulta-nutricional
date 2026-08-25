import React, { useState, useEffect, useRef } from 'react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

export default function Fase9_EstadoFisiologico({ patientData, setPatientData, onPhaseComplete, registerInputHandler, messages, setMessages, setIsGlobalTyping }) {
    const { patientName: pName, isMinor, isLactante, isPediatrico } = usePatientLinguistics(patientData);

    const [step, setStep] = useState(() => {
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && msg.content.includes("detalles biológicos"));
        const p = patientData.physio;
        const hasPhysio = p && (p.is_completed === true || p.user_declared === true || p.menstrual_status || p.is_pregnant === true || p.is_lactating === true || p.gestation_weeks > 0);
        if (hasSummary || hasPhysio) {
            return 'correct_menu';
        }
        return 'preg_gate';
    });
    const hasGreeted = useRef(false);

    useEffect(() => {
        if (hasGreeted.current) return;

        if (step === 'correct_menu') {
            hasGreeted.current = true;
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de estado fisiológico y reproductivo?",
                    options: [
                        { label: "✏️ Modificar estado de embarazo", value: "MODIFY_PREGNANCY" },
                        { label: "✏️ Modificar estado de lactancia", value: "MODIFY_LACTATION" },
                        { label: "✏️ Modificar ciclo menstrual", value: "MODIFY_MENSTRUAL" },
                        { label: "🔄 Limpiar estado fisiológico", value: "CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                    ]
                }
            ]);
            return;
        }

        const isPregnancyRoute = 
            patientData.clinical_context?.goal === 'GOAL_PREGNANCY' || 
            patientData.clinical_context?.primary_motive === 'Embarazo y Lactancia';

        const symptomsText = (patientData.clinical_context?.secondary_symptoms || "").toLowerCase();

        const isDelayDeclared = isPregnancyRoute && (
            symptomsText.includes('retraso') || 
            symptomsText.includes('amenorrea')
        );

        const isPregnantDeclared = isPregnancyRoute && !isDelayDeclared && (
            symptomsText.includes('embaraz') || 
            symptomsText.includes('gesta') || 
            symptomsText.includes('semana')
        );

        const isLactatingDeclared = isPregnancyRoute && (
            symptomsText.includes('lacta') || 
            symptomsText.includes('pecho') || 
            symptomsText.includes('bebe') || 
            symptomsText.includes('bébé')
        );

        const shouldIgnorePrefill = patientData.physio?.ignorePhase3PreFill === true;

        if (!shouldIgnorePrefill && isPregnantDeclared) {
            hasGreeted.current = true;
            setPatientData(prev => ({
                ...prev,
                physio: { ignorePhase3PreFill: false, is_pregnant: true }
            }));

            const welcomeMsg = isMinor
                ? `He registrado y sellado el perfil de salud gastrointestinal de **${pName}** de manera exitosa.\n\nEl sistema ha detectado y pre-confirmado el estado de gestación activa de **${pName}** a partir de los datos consolidados en el motivo de consulta. Para ajustar con precisión los requerimientos energéticos y sincronizar el expediente clínico de la menor, indique: ¿Cuántas semanas de gestación tiene **${pName}** actualmente?`
                : `He registrado y sellado su perfil de salud gastrointestinal de manera exitosa.\n\nEl sistema ha detectado y pre-confirmado su estado de gestación activa a partir de los datos consolidados en su motivo de consulta. Para ajustar con precisión sus requerimientos energéticos y sincronizar su expediente clínico, indique: ¿Cuántas semanas de gestación tiene actualmente?`;

            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: welcomeMsg,
                    inputType: 'number'
                }
            ]);
            setStep('preg_weeks');
        } else if (!shouldIgnorePrefill && isDelayDeclared) {
            hasGreeted.current = true;
            const welcomeMsg = isMinor
                ? `He registrado y sellado el perfil de salud gastrointestinal de **${pName}** de manera exitosa.\n\nHe tomado nota del retraso en el ciclo menstrual de **${pName}** reportado en el motivo de consulta principal. Para asegurar el rigor clínico y legal de su expediente bajo la **NOM-004**, por favor declare: ¿cuenta **${pName}** actualmente con confirmación médica o prueba positiva de embarazo?`
                : `He registrado y sellado su perfil de salud gastrointestinal de manera exitosa.\n\nHe tomado nota del retraso en su ciclo menstrual reportado en su motivo de consulta principal. Para asegurar el rigor clínico y legal de su expediente bajo la **NOM-004**, por favor declare: ¿cuenta actualmente con confirmación médica o prueba positiva de embarazo?`;

            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: welcomeMsg,
                    options: [
                        { label: "✅ Sí", value: "Sí" },
                        { label: "❌ No", value: "No" }
                    ]
                }
            ]);
            setStep('confirm_preg_gate');
        } else if (!shouldIgnorePrefill && isLactatingDeclared) {
            hasGreeted.current = true;
            setPatientData(prev => ({
                ...prev,
                physio: { ignorePhase3PreFill: false, is_pregnant: false, is_lactating: true }
            }));

            const welcomeMsg = isMinor
                ? `He registrado y sellado el perfil de salud gastrointestinal de **${pName}** de manera exitosa.\n\nEl sistema ha detectado y pre-confirmado la etapa de lactancia activa de **${pName}** a partir de los datos consolidados en el motivo de consulta. Para calibrar con precisión la matriz de nutrientes y requerimientos de energía de la menor, por favor indique: ¿es lactancia materna exclusiva o mixta para **${pName}**?`
                : `He registrado y sellado su perfil de salud gastrointestinal de manera exitosa.\n\nEl sistema ha detectado y pre-confirmado su etapa de lactancia activa a partir de los datos consolidados en su motivo de consulta. Para calibrar con precisión su matriz de nutrientes y requerimientos de energía, por favor indique: ¿es lactancia materna exclusiva o mixta?`;

            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: welcomeMsg,
                    options: [
                        { label: "Exclusiva", value: "Exclusiva" },
                        { label: "Mixta", value: "Mixta" }
                    ]
                }
            ]);
            setStep('lact_type');
        } else if (isPediatrico) {
            hasGreeted.current = true;
            const pediatricPhysio = { is_completed: true, user_declared: false, is_pregnant: false, is_lactating: false, note: "Pediátrico en etapa de desarrollo" };
            setPatientData(prev => ({
                ...prev,
                physio: pediatricPhysio
            }));

            if (isLactante) {
                // Inyectar Pregunta Pediátrica ATM 4 (Mediadores de Desarrollo & Ablactación BLW)
                const atm4Msg = {
                    role: 'assistant',
                    content: `Para evaluar los **Mediadores de Desarrollo de ${pName}** (su bebé - ATM 4): ¿Cómo se lleva a cabo la ablactación o introducción de alimentos sólidos?`,
                    options: [
                        { label: "🍼 Lactancia / Fórmula Exclusiva (Sin sólidos)", value: "WEANING_NOT_STARTED" },
                        { label: "🥣 Papillas y Purés tradicionales", value: "WEANING_PAPILLAS" },
                        { label: "🥦 Baby-Led Weaning (BLW / Sólidos autorregulados)", value: "WEANING_BLW" },
                        { label: "⚠️ Rechazo a texturas / Dificultad en deglución", value: "WEANING_SENSITIVE" }
                    ]
                };
                setMessages(prev => [...prev, atm4Msg]);
                setStep('PEDIATRIC_ATM_4');
            } else {
                const pediatricMsg = {
                    role: 'assistant',
                    content: `✅ Estado fisiológico y desarrollo pediátrico de **${pName}** registrado y sellado con éxito.`
                };
                setMessages(prev => [...prev, pediatricMsg]);
                setTimeout(() => {
                    onPhaseComplete?.(pediatricPhysio, messages);
                }, 800);
            }
            return;
        }

        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("embarazada actualmente"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;
            const initialMsg = isMinor
                ? `He registrado y sellado el perfil de salud gastrointestinal de **${pName}** de manera exitosa.\n\nPara ajustar los requerimientos de energía: ¿se encuentra **${pName}** embarazada actualmente?`
                : `He registrado y sellado su perfil de salud gastrointestinal de manera exitosa.\n\nPara ajustar sus requerimientos de energía: ¿se encuentra embarazada actualmente?`;

            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: initialMsg,
                    options: [
                        { label: "✅ Sí", value: "Sí" },
                        { label: "❌ No", value: "No" },
                    ]
                }
            ]);
        }
    }, [messages, isMinor, pName, setMessages, patientData, setPatientData, step]);

    // Middleware de enrutamiento: callback constructor para corregir la ejecución prematura en App.jsx
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => processStep);
        }
        return () => {
            if (registerInputHandler) registerInputHandler(null);
        };
    }, [step, registerInputHandler]);

    async function processStep(input, label = null) {
        let userText = (label && label !== 'text' && label !== 'select' && label !== 'number' && label !== 'tel' && label !== 'button') ? label : input;
        
        if (input === "MODIFY_PREGNANCY") userText = "✏️ Modificar estado de embarazo";
        if (input === "MODIFY_LACTATION") userText = "✏️ Modificar estado de lactancia";
        if (input === "MODIFY_MENSTRUAL") userText = "✏️ Modificar ciclo menstrual";
        if (input === "CLEAR_ALL") userText = "🔄 Limpiar estado fisiológico";
        if (input === "FINISH") userText = "❌ Cancelar (Volver al resumen)";

        if (label !== 'button') {
            setMessages(prev => [...prev, { role: 'user', content: userText }]);
        }
        
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        switch (step) {
            case 'PEDIATRIC_ATM_4': {
                const atm4Map = {
                    WEANING_NOT_STARTED: "Lactancia / Fórmula Exclusiva (Sin sólidos)",
                    WEANING_PAPILLAS: "Papillas y Purés tradicionales",
                    WEANING_BLW: "Baby-Led Weaning (BLW / Sólidos autorregulados)",
                    WEANING_SENSITIVE: "Rechazo a texturas / Dificultad en deglución"
                };
                const weaningLabel = atm4Map[input] || userText;
                const updatedPhysio = {
                    is_completed: true,
                    user_declared: true,
                    is_pregnant: false,
                    is_lactating: false,
                    pediatric_weaning: weaningLabel
                };

                setPatientData(prev => ({
                    ...prev,
                    physio: updatedPhysio,
                    pediatric_atm: { ...(prev.pediatric_atm || {}), weaning: weaningLabel }
                }));

                const finishMsg = {
                    role: 'assistant',
                    content: `✅ Mediadores de desarrollo y ablactación de **${pName}** (${weaningLabel}) registrados y sellados con éxito en el expediente.`
                };
                setMessages(prev => [...prev, finishMsg]);

                setTimeout(() => {
                    onPhaseComplete?.(updatedPhysio, messages);
                }, 800);
                setIsGlobalTyping(false);
                break;
            }
            case 'correct_menu': {
                if (input === "MODIFY_PREGNANCY") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `Para ajustar los requerimientos de energía: ¿se encuentra **${pName}** embarazada actualmente?`
                            : "Para ajustar sus requerimientos de energía: ¿se encuentra embarazada actualmente?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                    setStep('preg_gate');
                } else if (input === "MODIFY_LACTATION") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `¿Actualmente se encuentra **${pName}** en periodo de lactancia?`
                            : "¿Actualmente se encuentra en periodo de lactancia?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                    setStep('lact_gate');
                } else if (input === "MODIFY_MENSTRUAL") {
                    askMenstrualCycle();
                } else if (input === "CLEAR_ALL") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ignorePhase3PreFill: true }
                    }));
                    setStep('preg_gate');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `Historial de estado fisiológico reiniciado.\n\nPara ajustar los requerimientos de energía: ¿se encuentra **${pName}** embarazada actualmente?`
                            : "Historial de estado fisiológico reiniciado.\n\nPara ajustar sus requerimientos de energía: ¿se encuentra embarazada actualmente?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                } else if (input === "FINISH") {
                    finishPhase(patientData);
                }
                break;
            }
            case 'preg_gate': {
                if (input === "Sí") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_pregnant: true }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `Anotado. Se inicia el registro de gestación activa para **${pName}**.\n\n¿Cuántas semanas de gestación tiene **${pName}**?` 
                            : "Anotado. Se inicia el registro de gestación activa en su expediente.\n\n¿Cuántas semanas de gestación tiene?",
                        inputType: 'number'
                    }]);
                    setStep('preg_weeks');
                } else if (input === "No") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_pregnant: false }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `Se descarta gestación activa de **${pName}** para este protocolo.\n\n¿Actualmente se encuentra **${pName}** en periodo de lactancia?` 
                            : "Se descarta gestación activa para este protocolo.\n\n¿Actualmente se encuentra en periodo de lactancia?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                    setStep('lact_gate');
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: isMinor 
                            ? "Declaración de estado requerida.\n\nPor favor seleccione Sí o No." 
                            : "Declaración de estado requerida.\n\nPor favor seleccione Sí o No.", 
                        options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }] 
                    }]);
                }
                break;
            }
            case 'confirm_preg_gate': {
                if (input === "Sí") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_pregnant: true }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `Confirmación registrada para el expediente clínico de **${pName}**.\n\nPara ajustar sus requerimientos, ¿cuántas semanas de gestación tiene **${pName}**?`
                            : "Confirmación de gestación activa registrada para su expediente clínico.\n\nPara ajustar con precisión sus requerimientos energéticos, indique: ¿Cuántas semanas de gestación tiene?",
                        inputType: 'number'
                    }]);
                    setStep('preg_weeks');
                } else if (input === "No") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_pregnant: false }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `Se descarta gestación activa de **${pName}** de acuerdo con el reporte.\n\nPara calibrar sus requerimientos: ¿Actualmente se encuentra **${pName}** en periodo de lactancia?`
                            : "Se descarta gestación activa de acuerdo con su declaración.\n\nPara calibrar sus requerimientos de energía: ¿Actualmente se encuentra en periodo de lactancia?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                    setStep('lact_gate');
                } else {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `Por favor declare el estado de confirmación de **${pName}**.\n\n¿Cuenta con confirmación médica o prueba positiva?`
                            : "Por favor declare el estado de confirmación.\n\n¿Cuenta con confirmación médica o prueba positiva?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" }
                        ]
                    }]);
                }
                break;
            }
            case 'preg_weeks': {
                const weeks = parseInt(input, 10);
                if (isNaN(weeks) || weeks < 1 || weeks > 42) {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? "Valor fuera de rango clínico (1-42 semanas).\n\nPor favor, ingresa un número válido de semanas de gestación:" 
                            : "Valor fuera de rango clínico (1-42 semanas).\n\nPor favor, ingrese un número válido de semanas de gestación:",
                        inputType: 'number'
                    }]);
                } else {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), preg_weeks: weeks }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `Semanas de gestación registradas correctamente para **${pName}**.\n\n¿Actualmente se encuentra **${pName}** en periodo de lactancia (además de estar embarazada)?` 
                            : "Semanas de gestación registradas correctamente en su expediente.\n\n¿Actualmente se encuentra en periodo de lactancia (además de estar embarazada)?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                    setStep('lact_gate');
                }
                break;
            }
            case 'lact_gate': {
                if (input === "Sí") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_lactating: true }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `Registro de lactancia activa iniciado para **${pName}**.\n\n¿Es lactancia materna exclusiva o mixta para el bebé de **${pName}**?`
                            : "Registro de lactancia activa iniciado en su expediente.\n\n¿Es lactancia materna exclusiva o mixta?",
                        options: [
                            { label: "Exclusiva", value: "Exclusiva" },
                            { label: "Mixta", value: "Mixta" }
                        ]
                    }]);
                    setStep('lact_type');
                } else if (input === "No") {
                    const updated = {
                        ...patientData,
                        physio: { ...(patientData.physio || {}), is_lactating: false }
                    };
                    setPatientData(updated);
                    const isPregnant = updated.physio?.is_pregnant === true;
                    if (isPregnant) {
                        finishPhase(updated);
                    } else {
                        askMenstrualCycle();
                    }
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: isMinor 
                            ? "Selección requerida.\n\nPor favor indica si está lactando o no." 
                            : "Selección requerida.\n\nPor favor indique si se encuentra lactando o no.", 
                        options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }] 
                    }]);
                }
                break;
            }
            case 'lact_type': {
                if (input !== "Exclusiva" && input !== "Mixta") {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: isMinor 
                            ? "Opción no reconocida.\n\nPor favor selecciona Exclusiva o Mixta." 
                            : "Opción no reconocida.\n\nPor favor seleccione Exclusiva o Mixta.", 
                        options: [{ label: "Exclusiva", value: "Exclusiva" }, { label: "Mixta", value: "Mixta" }] 
                    }]);
                    return;
                }

                setPatientData(prev => ({
                    ...prev,
                    physio: { ...(prev.physio || {}), lactation_type: input }
                }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor 
                        ? `Modalidad de lactancia registrada con éxito para **${pName}**.\n\n¿Qué edad tiene el bebé de **${pName}** (en meses)?` 
                        : "Modalidad de lactancia registrada con éxito en su expediente.\n\n¿Qué edad tiene su bebé (en meses)?",
                    inputType: 'number'
                }]);
                setStep('baby_age');
                break;
            }
            case 'baby_age': {
                const months = parseInt(input, 10);
                if (isNaN(months) || months < 0 || months > 48) {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? "Edad fuera de rango de lactancia (0-48 meses).\n\nPor favor, ingresa una edad de meses válida para el bebé:" 
                            : "Edad fuera de rango de lactancia (0-48 meses).\n\nPor favor, ingrese una edad de meses válida para su bebé:",
                        inputType: 'number'
                    }]);
                } else {
                    const updated = {
                        ...patientData,
                        physio: { ...(patientData.physio || {}), baby_age_months: months }
                    };
                    setPatientData(updated);
                    const isPregnant = updated.physio?.is_pregnant === true;
                    if (isPregnant) {
                        finishPhase(updated);
                    } else {
                        askMenstrualCycle();
                    }
                }
                break;
            }
            case 'menstrual_status_gate': {
                const statusMap = {
                    'Regular': 'Regular',
                    'Irregular': 'Irregular',
                    'Amenorrea': 'Amenorrea / Sin Ciclo',
                    'Menopausia': 'Menopausia / Climaterio'
                };
                
                const resolvedStatus = statusMap[input] || input;

                if (input === "Regular" || input === "Irregular") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { 
                            ...(prev.physio || {}), 
                            menstrual_status: resolvedStatus
                        }
                    }));
                    
                    const daysMsg = isMinor
                        ? `Para saber en qué fase metabólica se encuentra hoy **${pName}**, ¿hace cuántos días comenzó su último sangrado menstrual? (Escriba el número de días).`
                        : "Para saber en qué fase metabólica se encuentra hoy, ¿hace cuántos días comenzó su último sangrado menstrual? (Escriba el número de días).";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: daysMsg,
                        inputType: 'number'
                    }]);
                    setStep('menstrual_days_gate');
                } else if (input === "Amenorrea" || input === "Menopausia") {
                    const updated = {
                        ...patientData,
                        physio: { 
                            ...(patientData.physio || {}), 
                            menstrual_status: resolvedStatus,
                            last_menstruation_period: resolvedStatus
                        }
                    };
                    setPatientData(updated);
                    finishPhase(updated);
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: isMinor 
                            ? "Estatus no reconocido.\n\nPor favor seleccione una de las opciones:" 
                            : "Estatus no reconocido.\n\nPor favor seleccione una de las opciones:", 
                        options: [
                            { label: "Regular", value: "Regular" },
                            { label: "Irregular", value: "Irregular" },
                            { label: "Amenorrea / Sin Ciclo", value: "Amenorrea" },
                            { label: "Menopausia / Climaterio", value: "Menopausia" }
                        ] 
                    }]);
                }
                break;
            }
            case 'menstrual_days_gate': {
                let days = NaN;
                const cleanedInput = input.toLowerCase().trim();
                
                // Mapeos textuales comunes
                if (cleanedInput.includes("una semana") || cleanedInput.includes("1 semana") || cleanedInput === "hace una semana" || cleanedInput === "hace 1 semana") {
                    days = 7;
                } else if (cleanedInput.includes("dos semanas") || cleanedInput.includes("2 semanas") || cleanedInput.includes("quincena") || cleanedInput === "hace dos semanas" || cleanedInput === "hace 2 semanas") {
                    days = 14;
                } else if (cleanedInput.includes("tres semanas") || cleanedInput.includes("3 semanas") || cleanedInput === "hace tres semanas" || cleanedInput === "hace 3 semanas") {
                    days = 21;
                } else if (cleanedInput.includes("un mes") || cleanedInput.includes("1 mes") || cleanedInput === "hace un mes" || cleanedInput === "hace 1 mes") {
                    days = 30;
                } else {
                    // Extracción con regex
                    const match = cleanedInput.match(/\d+/);
                    if (match) {
                        days = parseInt(match[0], 10);
                        if (cleanedInput.includes('semana') || cleanedInput.includes('sem')) {
                            days = days * 7;
                        } else if (cleanedInput.includes('mes')) {
                            days = days * 30;
                        }
                    }
                }

                if (isNaN(days) || days < 0 || days > 365) {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? "Por favor, ingresa un número de días válido (0-365) o una frase descriptiva (ej. 'hace 2 semanas'):" 
                            : "Por favor, ingrese un número de días válido (0-365) o una frase descriptiva (ej. 'hace 2 semanas'):",
                        inputType: 'number'
                    }]);
                } else {
                    const currentStatus = patientData.physio?.menstrual_status || "Regular";
                    const periodString = `${currentStatus} (Hace ${days} ${days === 1 ? 'día' : 'días'})`;
                    
                    const updated = {
                        ...patientData,
                        physio: { 
                            ...(patientData.physio || {}), 
                            menstrual_days: days,
                            last_menstruation_period: periodString
                        }
                    };
                    setPatientData(updated);
                    finishPhase(updated);
                }
                break;
            }
            default:
                break;
        }
        setIsGlobalTyping(false);
    };

    const askMenstrualCycle = () => {
        const cycleMsg = isMinor
            ? `Para adaptar la nutrición de **${pName}** a su cronobiología reproductiva, ¿cómo describiría el estatus general de su ciclo menstrual?`
            : "Para adaptar su nutrición a su cronobiología reproductiva, ¿cómo describiría el estatus general de su ciclo menstrual?";

        setMessages(prev => [
            ...prev,
            {
                role: 'assistant',
                content: cycleMsg,
                options: [
                    { label: "Regular", value: "Regular" },
                    { label: "Irregular", value: "Irregular" },
                    { label: "Amenorrea / Sin Ciclo", value: "Amenorrea" },
                    { label: "Menopausia / Climaterio", value: "Menopausia" }
                ],
                inputType: 'select'
            }
        ]);
        setStep('menstrual_status_gate');
    };

    const finishPhase = (customData = null) => {
        if (onPhaseComplete) {
            const dataToPass = customData 
                ? (customData.physio || customData) 
                : (patientData?.physio || patientData);
            onPhaseComplete({ ...dataToPass, is_completed: true });
        }
    };

    return null; // Headless
}
