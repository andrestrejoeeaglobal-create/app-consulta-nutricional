import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { formatText } from '../../utils/utils';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

/**
 * T.I.L.O. - MÓDULO FASE 11 (ACTIVIDAD Y SUEÑO)
 * Versión: v5.1 - Refactored for NEAT, Drill-downs, Enums and Metabolic Tags
 */
const Fase11_ActividadSueno = ({ 
    messages, 
    setMessages, 
    registerInputHandler, 
    setIsGlobalTyping, 
    db, 
    user, 
    appId, 
    patientProfile, 
    patientData, 
    setPatientData,
    onStateChange, 
    onPhaseComplete 
}) => {
    // Hook de lingüística para unificar nombres y contextos
    const { patientName: pName, patientSex, isMinor } = usePatientLinguistics(patientData);

    console.log("🔍 Fase11_ActividadSueno Mount/Render. Props:", {
        hasMessages: !!messages,
        messagesLength: messages?.length,
        typeofSetMessages: typeof setMessages,
        hasRegisterInput: !!registerInputHandler,
        hasSetPatientData: !!setPatientData
    });

    // Calcular edad para filtro
    const ageStr = patientData?.profile?.pediatric_profile?.age || patientData?.identificacion?.edad || "0";
    const age = parseInt(ageStr, 10) || 0;

    // Identificar lactantes
    const babyMonths = patientData?.profile?.baby_age_months !== undefined ? patientData.profile.baby_age_months : (patientData?.identificacion?.baby_age_months !== undefined ? patientData.identificacion.baby_age_months : null);
    const isLactante = age === 0 || (babyMonths !== null && babyMonths < 24);

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

    // Estado principal del estilo de vida consolidado
    const [lifeStyle, setLifeStyle] = useState({
        environment: { altitude: initialAltitude, hypoxiaRisk: initialAltitude > 2000, city: initialCity },
        circadian: { sleepHours: 0, quality: "", issue_type: null },
        hormonal: { cyclePhase: "N/A", lastPeriod: "" },
        stress: { level: "", origin: null, cortisol_management_needed: false },
        activity: { has_scheduled_exercise: null, neat_level: null, log: [] }
    });

    const [tempItem, setTempItem] = useState({});
    const [currentStep, setCurrentStep] = useState('ACTIVITY_GATE');
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const hasInitializedRef = useRef(false);
    const messagesRef = useRef(messages);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Inicialización del mensaje de bienvenida (Compuerta de Ejercicio y NEAT)
    useEffect(() => {
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            let greeting = "";

            if (isMinor) {
                const isPediatric = age < 12;
                const phaseSourceText = isPediatric ? "salud digestiva" : "hábitos de consumo";
                const baseConf = initialAltitude > 2000
                    ? `He registrado y sellado el perfil de ${phaseSourceText} de **${pName}** de manera exitosa. Al analizar su entorno geográfico en **${initialCity}** a **${initialAltitude} msnm**, identifico un factor de hipoxia ambiental moderada que incrementa la secreción basal de cortisol e influye en el gasto biológico diario.`
                    : `He registrado y sellado el perfil de ${phaseSourceText} de **${pName}** de manera exitosa. Con este bloque asegurado en el expediente clínico de **${pName}**, procedemos a evaluar la actividad física diaria y el descanso de ${patientSex === 'Femenino' ? 'la menor' : 'el menor'}.`;
                
                if (isLactante) {
                    greeting = `${baseConf}\n\nPara calibrar con precisión el gasto energético de **${pName}**, iniciemos con el juego y movimiento diario: **¿Realiza ${pName} actividades de estimulación temprana, juego activo o movimiento libre programado?**`;
                } else {
                    greeting = `${baseConf}\n\nPara calibrar con precisión el gasto energético de **${pName}**, iniciemos con la actividad física: **¿Realiza ${pName} ejercicio físico programado?** (Ej. ir al gimnasio, clases deportivas, correr o nadar de forma constante).`;
                }
            } else {
                const baseConf = initialAltitude > 2000
                    ? `He registrado y sellado su perfil de hábitos de consumo de manera exitosa. Al analizar su entorno geográfico en **${initialCity}** a **${initialAltitude} msnm**, identifico un factor de hipoxia ambiental moderada que incrementa la secreción basal de cortisol e influye en su gasto biológico diario.`
                    : `He registrado y sellado su perfil de hábitos de consumo de manera exitosa. Con el perfil de consumo y toxicología asegurado en su expediente, procedemos a colocar la bio-arquitectura de su día a día y calcular su gasto energético total.`;
                
                greeting = `${baseConf}\n\nPara calcular con precisión cuántas calorías quema su cuerpo, iniciemos con su nivel de actividad programada: **¿Realiza usted ejercicio físico programado?** (Ej. ir al gimnasio, correr, nadar, practicar algún deporte de forma constante).`;
            }

            const options = isMinor
                ? [
                    { label: "✅ Sí, realiza", value: "Sí" },
                    { label: "❌ No realiza", value: "No" }
                ]
                : [
                    { label: "✅ Sí, realizo", value: "Sí" },
                    { label: "❌ No realizo", value: "No" }
                ];

            const greetingMsg = {
                role: 'assistant', 
                content: greeting, 
                options: options
            };

            if (typeof setMessages === 'function') {
                setMessages(prev => {
                    const alreadyGreeted = prev.some(msg => 
                        msg.role === 'assistant' && 
                        msg.content && 
                        (msg.content.includes("ejercicio físico programado") || 
                         msg.content.includes("gasto energético total") || 
                         msg.content.includes("entorno geográfico") ||
                         msg.content.includes("estimulación temprana"))
                    );
                    if (alreadyGreeted) return prev;
                    return [...prev, greetingMsg];
                });
            } else {
                console.error("❌ setMessages is not a function in Fase11_ActividadSueno!", { setMessages });
            }
        }
    }, [isMinor, isLactante, pName, patientSex, initialCp, initialAltitude, initialCity, setMessages, age]);

    // Sincronización en tiempo real con el estado global patientData (raíz y clinical_context)
    useEffect(() => {
        if (setPatientData) {
            console.log("🔄 Fase11_ActividadSueno: useEffect running. currentStep:", currentStep, "lifeStyle:", lifeStyle);
            setPatientData(prev => {
                let updatedTags = [...(prev.clinical_context?.ai_analysis?.detected_tags || [])];
                if (lifeStyle.circadian.sleepHours > 0 && lifeStyle.circadian.sleepHours < 6) {
                    if (!updatedTags.includes("GHRELIN_SPIKE_RISK")) {
                        updatedTags.push("GHRELIN_SPIKE_RISK");
                    }
                }

                const nextLifestyleProfile = {
                    ...prev.lifestyle_profile,
                    activity: {
                        ...prev.lifestyle_profile?.activity,
                        has_scheduled_exercise: lifeStyle.activity.has_scheduled_exercise,
                        neat_level: lifeStyle.activity.neat_level,
                        log: lifeStyle.activity.log.map(itemStr => {
                            const match = itemStr.match(/^([^(]+)\((\d+)\s*días\/sem,\s*(\d+)\s*min\)$/);
                            if (match) {
                                return {
                                    type: match[1].trim(),
                                    frequency: parseInt(match[2], 10),
                                    duration: parseInt(match[3], 10)
                                };
                            }
                            return { type: itemStr, frequency: 3, duration: 30 };
                        })
                    },
                    sleep: {
                        hours_avg: lifeStyle.circadian.sleepHours,
                        quality: lifeStyle.circadian.quality,
                        issue_type: lifeStyle.circadian.issue_type
                    },
                    stress: {
                        level: lifeStyle.stress.level,
                        origin: lifeStyle.stress.origin,
                        cortisol_management_needed: lifeStyle.stress.cortisol_management_needed
                    }
                };

                console.log("   nextLifestyleProfile:", nextLifestyleProfile);
                console.log("   prev.lifestyle_profile:", prev.lifestyle_profile);

                // Comparar para evitar ciclos infinitos de renderizado
                if (JSON.stringify(prev.lifestyle_profile) === JSON.stringify(nextLifestyleProfile)) {
                    console.log("   No change detected. Returning prev state.");
                    return prev;
                }

                console.log("   State change detected! Returning updated patientData.");
                return {
                    ...prev,
                    lifestyle_profile: nextLifestyleProfile,
                    habits: {
                        ...prev.habits,
                        sleep: {
                            hours: lifeStyle.circadian.sleepHours,
                            quality: lifeStyle.circadian.quality === 'GOOD' ? 'Buena' : 
                                     lifeStyle.circadian.quality === 'POOR' ? 'Mala' : 'Regular',
                            issue_type: lifeStyle.circadian.issue_type
                        },
                        stress: lifeStyle.stress.level === 'HIGH' ? 'alto' : 
                                lifeStyle.stress.level === 'LOW' ? 'bajo' : 'moderado',
                        stress_origin: lifeStyle.stress.origin
                    },
                    clinical_context: {
                        ...prev.clinical_context,
                        ai_analysis: {
                            ...(prev.clinical_context?.ai_analysis || {}),
                            detected_tags: updatedTags
                        },
                        habits: {
                            ...prev.clinical_context?.habits,
                            sleep: {
                                hours: lifeStyle.circadian.sleepHours,
                                quality: lifeStyle.circadian.quality === 'GOOD' ? 'Buena' : 
                                         lifeStyle.circadian.quality === 'POOR' ? 'Mala' : 'Regular',
                                issue_type: lifeStyle.circadian.issue_type
                            },
                            stress: lifeStyle.stress.level === 'HIGH' ? 'alto' : 
                                    lifeStyle.stress.level === 'LOW' ? 'bajo' : 'moderado',
                            stress_origin: lifeStyle.stress.origin
                        },
                        activity: {
                            ...prev.clinical_context?.activity,
                            exercise: {
                                has_scheduled_exercise: lifeStyle.activity.has_scheduled_exercise,
                                log: lifeStyle.activity.log,
                                neat_level: lifeStyle.activity.neat_level
                            }
                        }
                    }
                };
            });
        }
    }, [lifeStyle, setPatientData]);

    // Sincronización de datos con el estado global y Firebase al confirmar
    const syncLifeData = async (updates) => {
        const newState = { ...lifeStyle, ...updates };
        setLifeStyle(newState);
        if (onStateChange) onStateChange(newState);

        if (user && db && appId) {
            let updatedTags = [];
            if (patientData?.clinical_context?.ai_analysis?.detected_tags) {
                updatedTags = [...patientData.clinical_context.ai_analysis.detected_tags];
            }
            if (newState.circadian.sleepHours > 0 && newState.circadian.sleepHours < 6) {
                if (!updatedTags.includes("GHRELIN_SPIKE_RISK")) {
                    updatedTags.push("GHRELIN_SPIKE_RISK");
                }
            }

            try {
                const firebasePayload = {
                    ...newState,
                    detected_tags: updatedTags
                };
                await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/clinical_context`, "phase5_lifestyle"), firebasePayload, { merge: true });
            } catch (error) {
                console.error("Firebase Sync error:", error);
            }
        }
        return newState;
    };

    // Helper para decidir si preguntar ciclo hormonal o mostrar síntesis
    const checkHormonalOrSummary = (state) => {
        buildAndShowSummary(state);
    };

    // Procesamiento de respuestas y flujo conversacional
    const handleSend = async (text, isButton = false) => {
        const textToProcess = text || inputValue;
        if (!textToProcess.trim()) return;

        let userLabel = textToProcess;
        if (currentStep === 'NEAT') {
            if (textToProcess === "SEDENTARY") userLabel = isLactante ? "Tranquilo / Acostado la mayor parte del tiempo" : "Sedentario (Todo el día sentado)";
            if (textToProcess === "LIGHT") userLabel = isLactante ? "Gateo inicial / Juego sentado" : "Ligero (Caminando poco)";
            if (textToProcess === "MODERATE") userLabel = isLactante ? "Gateo activo / Ya camina con apoyo" : "Moderado (Movimiento constante)";
            if (textToProcess === "HEAVY") userLabel = isLactante ? "Explora activamente / Corre / Salta" : "Pesado (Trabajo físico duro)";
        } else if (currentStep === 'SLEEP_HOURS') {
            if (textToProcess === "14") userLabel = "14 horas o más (Adecuado para lactantes)";
            if (textToProcess === "11") userLabel = "Entre 11 y 13 horas";
            if (textToProcess === "9") userLabel = "Menos de 10 horas";
            if (textToProcess === "8") userLabel = "8 horas o más";
            if (textToProcess === "6") userLabel = "Entre 6 y 7 horas";
            if (textToProcess === "4") userLabel = "Menos de 5 horas";
        } else if (currentStep === 'SLEEP_QUALITY') {
            if (textToProcess === "Buena") userLabel = isLactante ? "Buena (Duerme tranquilo)" : "Buena";
            if (textToProcess === "Regular") userLabel = isLactante ? "Regular (Se despierta ocasionalmente)" : "Regular";
            if (textToProcess === "Mala") userLabel = isLactante ? "Mala (Llanto constante / Muy fragmentado)" : "Mala";
        } else if (currentStep === 'SLEEP_ISSUE') {
            if (textToProcess === "INSOMNIA") userLabel = isLactante ? "Dificultad para conciliar el sueño (Insomnio inicial)" : "Me cuesta quedarme dormido";
            if (textToProcess === "FRAGMENTED") userLabel = isLactante ? "Despertares frecuentes (Lactancia nocturna o llanto)" : "Me despierto varias veces";
            if (textToProcess === "APNEA") userLabel = isLactante ? "Dificultad respiratoria o congestión" : "Falta de aire o ronco";
            if (textToProcess === "SHIFT_WORK") userLabel = isLactante ? "Cólicos o reflujo nocturno" : "Trabajo en turnos nocturnos";
        } else if (currentStep === 'STRESS_LEVEL') {
            if (textToProcess === "Bajo") userLabel = isLactante ? "Bajo (Casi no llora / Tranquilo)" : "Bajo";
            if (textToProcess === "Moderado") userLabel = isLactante ? "Moderado (Llora ocasionalmente por hambre/sueño)" : "Moderado";
            if (textToProcess === "Alto") userLabel = isLactante ? "Alto (Irritabilidad constante / Llanto difícil de consolar)" : "Alto";
        } else if (currentStep === 'STRESS_ORIGIN') {
            if (textToProcess === "EMOTIONAL") userLabel = isLactante ? "Gases / Cólicos / Malestar digestivo" : "Emocional / Ansiedad";
            if (textToProcess === "PHYSICAL") userLabel = isLactante ? "Dentición / Calor o factores ambientales" : "Carga de Trabajo / Físico";
            if (textToProcess === "BOTH") userLabel = "Ambos";
        } else if (currentStep === 'HORMONAL') {
            if (textToProcess === "Folicular_Lutea") userLabel = "Folicular / Lútea";
            if (textToProcess === "Menstruacion") userLabel = "Menstruación / Transición";
            if (textToProcess === "Pospausia") userLabel = "Posmenopausia / Irregular";
        } else if (currentStep === 'ACTIVITY_GATE' || currentStep === 'ACTIVITY_LOOP') {
            if (textToProcess === "Sí" || textToProcess === "Si") userLabel = "Sí";
            if (textToProcess === "No") userLabel = "No";
        }

        setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                newMsgs[newMsgs.length - 1].options = undefined;
            }
            if (!isButton) {
                return [...newMsgs, { role: 'user', content: formatText(userLabel) }];
            }
            return newMsgs;
        });

        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            const lower = textToProcess.toLowerCase();
            const cleanText = textToProcess.trim();

            switch (currentStep) {
                // --- 1. EJERCICIO GATE (Q34) ---
                case 'ACTIVITY_GATE': {
                    const hasExercise = lower === 'sí' || lower === 'si';
                    const updatedLife = { ...lifeStyle, activity: { ...lifeStyle.activity, has_scheduled_exercise: hasExercise, log: [] } };
                    setLifeStyle(updatedLife);

                    if (hasExercise) {
                        const actMsg = isLactante
                            ? `Excelente. ¿Qué tipo de juego activo o actividades de estimulación realiza **${pName}**? (Ej. Estimulación temprana, gateo guiado, natación para bebés)`
                            : (isMinor
                                ? `Excelente. ¿Qué actividad, deporte o disciplina física practica **${pName}**? (Ej. Correr, Natación, Gimnasio)`
                                : `Excelente. ¿Qué actividad, deporte o disciplina física practica? (Ej. Correr, Natación, Gimnasio)`);
                        setMessages(prev => [...prev, { role: 'assistant', content: actMsg }]);
                        setCurrentStep('ACTIVITY_TYPE');
                    } else {
                        askNeatQuestion();
                    }
                    break;
                }

                // --- 2. TIPO DE EJERCICIO (Q34b) ---
                case 'ACTIVITY_TYPE': {
                    setTempItem({ actividad: textToProcess });
                    const daysMsg = isMinor
                        ? `¿Cuántos **días** a la semana practica **${pName}** esta actividad? (Número del 1 al 7)`
                        : `¿Cuántos **días** a la semana practica esta actividad? (Número del 1 al 7)`;
                    setMessages(prev => [...prev, { role: 'assistant', content: daysMsg, inputType: 'number' }]);
                    setCurrentStep('ACTIVITY_DAYS');
                    break;
                }

                // --- 3. DÍAS DE EJERCICIO (Q34c) ---
                case 'ACTIVITY_DAYS': {
                    const days = parseInt(textToProcess.match(/\d+/)?.[0] || "3", 10);
                    if (isNaN(days) || days < 1 || days > 7) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor, indique un número de días válido del 1 al 7:", inputType: 'number' }]);
                        return;
                    }
                    setTempItem(prev => ({ ...prev, dias: days }));

                    const minsMsg = isLactante
                        ? `¿Cuántos **minutos** dura en promedio cada sesión de juego o estimulación de **${pName}**?`
                        : (isMinor
                            ? `¿Cuántos **minutos** de duración promedio tiene cada sesión de **${pName}**?`
                            : `¿Cuántos **minutos** de duración promedio tiene cada una de sus sesiones?`);
                    setMessages(prev => [...prev, { role: 'assistant', content: minsMsg, inputType: 'number' }]);
                    setCurrentStep('ACTIVITY_MINS');
                    break;
                }

                // --- 4. MINUTOS DE EJERCICIO (Q34c - Duración) ---
                case 'ACTIVITY_MINS': {
                    const mins = parseInt(textToProcess.match(/\d+/)?.[0] || "45", 10);
                    if (isNaN(mins) || mins < 1) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor, indique una duración válida en minutos:", inputType: 'number' }]);
                        return;
                    }

                    const { actividad, dias } = tempItem;
                    if (!actividad) {
                        setCurrentStep('ACTIVITY_GATE');
                        return;
                    }

                    const finalString = `${actividad} (${dias} días/sem, ${mins} min)`;
                    const newLog = [...lifeStyle.activity.log, finalString];
                    const updatedLife = { ...lifeStyle, activity: { ...lifeStyle.activity, log: newLog } };
                    setLifeStyle(updatedLife);

                    const loopMsg = isLactante
                        ? `Registrado ✅. ¿Realiza **${pName}** alguna **otra** actividad física o de estimulación distinta?`
                        : (isMinor
                            ? `Registrado ✅. ¿Realiza **${pName}** alguna **otra** actividad o deporte físico?`
                            : `Registrado ✅. ¿Realiza alguna **otra** actividad deportiva distinta?`);
                    setMessages(prev => [...prev, {
                        role: 'assistant', 
                        content: loopMsg, 
                        options: [
                            { label: "✅ Sí, otra", value: "Sí" },
                            { label: "❌ No, es todo", value: "No" }
                        ]
                    }]);
                    setCurrentStep('ACTIVITY_LOOP');
                    break;
                }

                // --- 5. EJERCICIO LOOP (Q34d) ---
                case 'ACTIVITY_LOOP': {
                    const hasMore = lower === 'sí' || lower === 'si';
                    if (hasMore) {
                        setTempItem({});
                        const actMsg = isLactante
                            ? `¿Cuál es la siguiente actividad o estimulación de **${pName}**?`
                            : (isMinor
                                ? `¿Cuál es la siguiente actividad de **${pName}**?`
                                : "¿Cuál es su siguiente actividad?");
                        setMessages(prev => [...prev, { role: 'assistant', content: actMsg }]);
                        setCurrentStep('ACTIVITY_TYPE');
                    } else {
                        askNeatQuestion();
                    }
                    break;
                }

                // --- 6. FACTOR NEAT (Q34e) ---
                case 'NEAT': {
                    const validNeat = ['SEDENTARY', 'LIGHT', 'MODERATE', 'HEAVY'];
                    if (!validNeat.includes(cleanText)) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: 'Por favor seleccione una opción válida de la lista:',
                            options: [
                                { label: 'Sedentario (Todo el día sentado)', value: 'SEDENTARY' },
                                { label: 'Ligero (De pie o caminando poco)', value: 'LIGHT' },
                                { label: 'Moderado (Mesero / Movimiento constante)', value: 'MODERATE' },
                                { label: 'Pesado (Agricultor / Trabajo duro)', value: 'HEAVY' }
                            ]
                        }]);
                        return;
                    }

                    const updatedLife = { 
                        ...lifeStyle, 
                        activity: { ...lifeStyle.activity, neat_level: cleanText } 
                    };
                    setLifeStyle(updatedLife);

                    // Avanzamos al descanso y sueño (Q35)
                    const sleepMsg = isMinor
                        ? `Entendido. Evaluemos el descanso. ¿Cuántas horas duerme **${pName}** en promedio al día?`
                        : `Entendido. Pasemos al descanso. **¿Cuántas horas duerme en promedio al día?**`;
                    setMessages(prev => [...prev, {
                        role: 'assistant', 
                        content: sleepMsg, 
                        options: isLactante
                            ? [
                                { label: "14 horas o más", value: "14" },
                                { label: "Entre 11 y 13 horas", value: "11" },
                                { label: "Menos de 10 horas", value: "9" }
                            ]
                            : [
                                { label: "8 horas o más", value: "8" },
                                { label: "Entre 6 y 7 horas", value: "6" },
                                { label: "Menos de 5 horas", value: "4" }
                            ]
                    }]);
                    setCurrentStep('SLEEP_HOURS');
                    break;
                }

                // --- 7. HORAS DE SUEÑO (Q35) ---
                case 'SLEEP_HOURS': {
                    const hours = parseInt(textToProcess.match(/\d+/)?.[0] || "7", 10);
                    const updatedLife = { ...lifeStyle, circadian: { ...lifeStyle.circadian, sleepHours: hours } };
                    setLifeStyle(updatedLife);

                    const qualityMsg = isMinor
                        ? `Registrado. ¿Cómo calificaría la calidad del descanso de **${pName}**?`
                        : `Registrado. **¿Cómo calificaría su calidad de sueño?**`;
                    setMessages(prev => [...prev, {
                        role: 'assistant', 
                        content: qualityMsg, 
                        options: [
                            { label: "Buena", value: "Buena" },
                            { label: "Regular", value: "Regular" },
                            { label: "Mala", value: "Mala" }
                        ]
                    }]);
                    setCurrentStep('SLEEP_QUALITY');
                    break;
                }

                // --- 8. CALIDAD DE SUEÑO (Q36) ---
                case 'SLEEP_QUALITY': {
                    let quality = 'FAIR';
                    if (lower.includes('buena')) quality = 'GOOD';
                    if (lower.includes('mala')) quality = 'POOR';

                    const updatedLife = { ...lifeStyle, circadian: { ...lifeStyle.circadian, quality } };
                    setLifeStyle(updatedLife);

                    if (quality === 'FAIR' || quality === 'POOR') {
                        const issueMsg = isMinor
                            ? `Entendido. ¿Cuál es el principal problema con el sueño de **${pName}**?`
                            : `Entendido. **¿Cuál es el principal problema con su sueño?**`;
                        setMessages(prev => [...prev, {
                            role: 'assistant', 
                            content: issueMsg, 
                            options: isLactante
                                ? [
                                    { label: "Dificultad para conciliar el sueño (Insomnio inicial)", value: "INSOMNIA" },
                                    { label: "Despertares frecuentes (Lactancia nocturna o llanto)", value: "FRAGMENTED" },
                                    { label: "Dificultad respiratoria o congestión", value: "APNEA" },
                                    { label: "Cólicos o reflujo nocturno", value: "SHIFT_WORK" }
                                ]
                                : [
                                    { label: "Me cuesta quedarme dormido (Insomnio inicial)", value: "INSOMNIA" },
                                    { label: "Me despierto varias veces en la noche (Fragmentado)", value: "FRAGMENTED" },
                                    { label: "Ronco o siento que me falta el aire (Apnea)", value: "APNEA" },
                                    { label: "Trabajo en turnos nocturnos (Disrupción Circadiana)", value: "SHIFT_WORK" }
                                ]
                        }]);
                        setCurrentStep('SLEEP_ISSUE');
                    } else {
                        const stressMsg = isMinor
                            ? `Sincronizado. Para estructurar su perfil de estrés y cortisol, ¿cuál es el nivel de estrés diario en promedio de **${pName}**?`
                            : `Sincronizado. Para estructurar su perfil de estrés y cortisol, **¿cómo percibe su nivel actual de estrés?**`;
                        setMessages(prev => [...prev, {
                            role: 'assistant', 
                            content: stressMsg, 
                            options: [
                                { label: "Bajo", value: "Bajo" },
                                { label: "Moderado", value: "Moderado" },
                                { label: "Alto", value: "Alto" }
                            ]
                        }]);
                        setCurrentStep('STRESS_LEVEL');
                    }
                    break;
                }

                // --- 8b. DETALLE DEL PROBLEMA DE SUEÑO (Q36b) ---
                case 'SLEEP_ISSUE': {
                    const updatedLife = { 
                        ...lifeStyle, 
                        circadian: { ...lifeStyle.circadian, issue_type: cleanText } 
                    };
                    setLifeStyle(updatedLife);

                    const stressMsg = isMinor
                        ? `Anotado. ¿Cuál es el nivel de estrés diario en promedio de **${pName}**?`
                        : `Anotado. **¿cómo percibe su nivel actual de estrés?**`;
                    setMessages(prev => [...prev, {
                        role: 'assistant', 
                        content: stressMsg, 
                        options: [
                            { label: "Bajo", value: "Bajo" },
                            { label: "Moderado", value: "Moderado" },
                            { label: "Alto", value: "Alto" }
                        ]
                    }]);
                    setCurrentStep('STRESS_LEVEL');
                    break;
                }

                // --- 9. ESTRÉS (Q37) ---
                case 'STRESS_LEVEL': {
                    let stressLabel = 'MODERATE';
                    if (lower.includes('bajo')) stressLabel = 'LOW';
                    if (lower.includes('alto')) stressLabel = 'HIGH';

                    const updatedLife = { 
                        ...lifeStyle, 
                        stress: { 
                            level: stressLabel, 
                            origin: null, 
                            cortisol_management_needed: stressLabel === 'HIGH' 
                        } 
                    };
                    setLifeStyle(updatedLife);

                    if (stressLabel === 'HIGH') {
                        const originMsg = isMinor
                            ? `Entendido. Para apoyarle con nutrientes específicos (como Magnesio o Adaptógenos), ¿el estrés de **${pName}** es principalmente emocional o físico/laboral?`
                            : `Entendido. Para apoyarle con nutrientes específicos (como Magnesio o Adaptógenos), **¿su estrés es principalmente emocional o físico/laboral?**`;
                        setMessages(prev => [...prev, {
                            role: 'assistant', 
                            content: originMsg, 
                            options: isLactante
                                ? [
                                    { label: "Gases / Cólicos / Malestar digestivo", value: "EMOTIONAL" },
                                    { label: "Dentición / Calor o factores ambientales", value: "PHYSICAL" },
                                    { label: "Ambos", value: "BOTH" }
                                ]
                                : [
                                    { label: "Ansiedad / Emocional", value: "EMOTIONAL" },
                                    { label: "Trabajo / Físico", value: "PHYSICAL" },
                                    { label: "Ambos", value: "BOTH" }
                                ]
                        }]);
                        setCurrentStep('STRESS_ORIGIN');
                    } else {
                        checkHormonalOrSummary(updatedLife);
                    }
                    break;
                }

                // --- 9b. ORIGEN DEL ESTRÉS (Q37b) ---
                case 'STRESS_ORIGIN': {
                    const updatedLife = { 
                        ...lifeStyle, 
                        stress: { 
                            ...lifeStyle.stress, 
                            origin: cleanText 
                        } 
                    };
                    setLifeStyle(updatedLife);
                    checkHormonalOrSummary(updatedLife);
                    break;
                }

                // --- 10. CICLO HORMONAL (Opcional) ---
                case 'HORMONAL': {
                    let phase = 'En transición';
                    if (lower.includes('lutea') || lower.includes('folicular')) phase = 'Folicular / Lútea';
                    if (lower.includes('pospausia') || lower.includes('irregular') || lower.includes('menopausia')) phase = 'Tránsito / Posmenopausia';
                    if (lower.includes('menstruacion')) phase = 'Menstruación';

                    const updatedLife = { ...lifeStyle, hormonal: { ...lifeStyle.hormonal, cyclePhase: phase } };
                    setLifeStyle(updatedLife);
                    buildAndShowSummary(updatedLife);
                    break;
                }

                // --- 11. REVISIÓN DE SÍNTESIS (NOM-004) ---
                case 'REVIEW_SUMMARY': {
                    if (textToProcess === "CONFIRM_DATA") {
                        // Guardar datos y completar
                        syncLifeData(lifeStyle).then((finalState) => {
                            onPhaseComplete?.(finalState, messagesRef.current);
                        });
                    } else if (textToProcess === "CORRECT_DATA") {
                        // Reiniciar al paso innegociable de ejercicio
                        setLifeStyle({
                            environment: { altitude: initialAltitude, hypoxiaRisk: initialAltitude > 2000, city: initialCity },
                            circadian: { sleepHours: 0, quality: "", issue_type: null },
                            hormonal: { cyclePhase: "N/A", lastPeriod: "" },
                            stress: { level: "", origin: null, cortisol_management_needed: false },
                            activity: { has_scheduled_exercise: null, neat_level: null, log: [] }
                        });
                        
                        const resetGreeting = isLactante
                            ? `De acuerdo, iniciemos de nuevo la evaluación. Para calibrar con precisión el gasto energético de **${pName}**, ¿realiza **${pName}** actividades de estimulación temprana o juego activo programado?`
                            : (isMinor
                                ? `De acuerdo, iniciemos de nuevo la evaluación. Para calibrar con precisión el gasto energético de **${pName}**, ¿realiza **${pName}** ejercicio físico programado?`
                                : `De acuerdo, iniciemos de nuevo la evaluación. Para calcular con precisión cuántas calorías quema su cuerpo, ¿realiza usted ejercicio físico programado?`);
                        
                        const resetOptions = isMinor
                            ? [
                                { label: "✅ Sí, realiza", value: "Sí" },
                                { label: "❌ No realiza", value: "No" }
                            ]
                            : [
                                { label: "✅ Sí, realizo", value: "Sí" },
                                { label: "❌ No realizo", value: "No" }
                            ];
                        
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: resetGreeting,
                            options: resetOptions
                        }]);
                        setCurrentStep('ACTIVITY_GATE');
                    }
                    break;
                }
            }

            setIsAnalyzing(false);
        }, 600);
    };

    const askNeatQuestion = () => {
        const neatMsg = isLactante
            ? `Independientemente de la estimulación programada, ¿cómo describiría el nivel de movimiento o actividad espontánea diaria de **${pName}**?`
            : (isMinor
                ? `Independientemente del deporte, ¿cómo describiría la actividad diaria habitual de **${pName}** (trabajo, escuela o casa)?`
                : `Independientemente del deporte, ¿cómo describiría su actividad diaria habitual (trabajo, oficina o casa)?`);
        
        const neatOptions = isLactante
            ? [
                { label: 'Tranquilo / Acostado la mayor parte del tiempo', value: 'SEDENTARY' },
                { label: 'Gateo inicial / Juego sentado', value: 'LIGHT' },
                { label: 'Gateo activo / Ya camina con apoyo', value: 'MODERATE' },
                { label: 'Explora activamente / Corre / Salta', value: 'HEAVY' }
            ]
            : [
                { label: 'Sedentario (Todo el día sentado)', value: 'SEDENTARY' },
                { label: 'Ligero (De pie o caminando poco)', value: 'LIGHT' },
                { label: 'Moderado (Mesero / Movimiento constante)', value: 'MODERATE' },
                { label: 'Pesado (Construcción / Trabajo físico duro)', value: 'HEAVY' }
            ];

        setMessages(prev => [...prev, {
            role: 'assistant', 
            content: neatMsg, 
            options: neatOptions
        }]);
        setCurrentStep('NEAT');
    };

    // Helper para estructurar y renderizar la síntesis final NOM-004 de Estilo de Vida
    const buildAndShowSummary = (state) => {
        let summaryText = isLactante
            ? `Como protocolo de seguridad clínica y de estricto apego a la **NOM-004**, le presento la síntesis consolidada del entorno y estilo de vida de **${pName}**:\n\n`
            : `Como protocolo de seguridad clínica y de estricto apego a la **NOM-004**, le presento la síntesis consolidada de su entorno y estilo de vida:\n\n`;
        
        // 1. Actividad Física / Ejercicio
        const activityStr = state.activity.has_scheduled_exercise 
            ? `Sí (${state.activity.log.join(', ') || 'Sin detalles adicionales'})` 
            : "No";
        summaryText += isLactante
            ? `- 🏃 **Estimulación / Juego Activo:** ${activityStr}\n`
            : `- 🏃 **Actividad Física / Ejercicio:** ${activityStr}\n`;
        
        // 2. Actividad Diaria (NEAT)
        const neatMap = isLactante
            ? { SEDENTARY: 'Tranquilo / Acostado', LIGHT: 'Gateo inicial / Juego sentado', MODERATE: 'Gateo activo / Camina', HEAVY: 'Explora / Corre / Salta' }
            : { SEDENTARY: 'Sedentario', LIGHT: 'Ligero', MODERATE: 'Moderado', HEAVY: 'Pesado' };
        summaryText += isLactante
            ? `- 👶 **Actividad Diaria / Movimiento:** ${neatMap[state.activity.neat_level] || state.activity.neat_level}\n`
            : `- 💼 **Actividad Diaria (NEAT):** ${neatMap[state.activity.neat_level] || state.activity.neat_level}\n`;
        
        // 3. Descanso / Sueño
        const qualityMap = { GOOD: 'Buena', FAIR: 'Regular', POOR: 'Mala' };
        const qualityStr = qualityMap[state.circadian.quality] || 'N/A';
        
        let sleepDetail = `${state.circadian.sleepHours} horas en promedio (${qualityStr})`;
        if (state.circadian.issue_type) {
            const issueMap = isLactante
                ? {
                    INSOMNIA: 'Dificultad para conciliar el sueño',
                    FRAGMENTED: 'Despertares nocturnos frecuentes / Lactancia nocturna',
                    APNEA: 'Dificultad respiratoria o congestión',
                    SHIFT_WORK: 'Cólicos o reflujo'
                }
                : {
                    INSOMNIA: 'Insomnio inicial',
                    FRAGMENTED: 'Sueño fragmentado',
                    APNEA: 'Posible Apnea / Ronquidos',
                    SHIFT_WORK: 'Trabajo nocturno / Disrupción circadiana'
                };
            sleepDetail += ` - [Foco: ${issueMap[state.circadian.issue_type] || state.circadian.issue_type}]`;
        }
        summaryText += `- 💤 **Sueño y Descanso:** ${sleepDetail}\n`;
        
        // 4. Nivel de Estrés
        const stressLevelMap = isLactante
            ? { LOW: 'Bajo (Tranquilo)', MODERATE: 'Moderado', HIGH: 'Alto (Irritable)' }
            : { LOW: 'Bajo', MODERATE: 'Moderado', HIGH: 'Alto' };
        let stressDetail = stressLevelMap[state.stress.level] || state.stress.level;
        if (state.stress.level === 'HIGH' && state.stress.origin) {
            const originMap = isLactante
                ? { EMOTIONAL: 'Cólicos/Gases', PHYSICAL: 'Dentición/Ambiente', BOTH: 'Mixto' }
                : { EMOTIONAL: 'Ansiedad/Emocional', PHYSICAL: 'Carga de trabajo/Físico', BOTH: 'Mixto' };
            stressDetail += ` (Origen: ${originMap[state.stress.origin] || state.stress.origin})`;
        }
        summaryText += isLactante
            ? `- 🧠 **Nivel de Irritabilidad:** ${stressDetail}\n`
            : `- 🧠 **Nivel de Estrés:** ${stressDetail}\n`;
        
        // 5. Sincronía Hormonal (opcional)
        const isAppropriateAgeForCycle = age >= 10;
        const isFemale = patientData?.profile?.sex === 'Femenino';
        if (isFemale && isAppropriateAgeForCycle) {
            const hormonalData = patientData.physio?.last_menstruation_period || patientData.physio?.menstrual_status || 'No refiere';
            summaryText += `- 🌸 **Sincronía Hormonal:** ${hormonalData}\n`;
        }
        
        summaryText += `\n`;
        summaryText += `---\n\n`;
        summaryText += `Por favor, verifique este reporte clínico. ¿Es correcta y verídica toda esta información?`;

        setMessages(prev => [...prev, {
            role: 'assistant', 
            content: summaryText, 
            options: [
                { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                { label: "❌ No, quiero corregir algo", value: "CORRECT_DATA" }
            ]
        }]);
        setCurrentStep('REVIEW_SUMMARY');
    };

    // Registrar manejador de entrada
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, label) => handleSend(text, label === 'button'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registerInputHandler, currentStep, isAnalyzing, inputValue, lifeStyle]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(isAnalyzing);
        }
    }, [isAnalyzing, setIsGlobalTyping]);

    return null;
};

export default Fase11_ActividadSueno;
