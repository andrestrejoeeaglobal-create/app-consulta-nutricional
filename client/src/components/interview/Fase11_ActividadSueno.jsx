import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { formatText } from '../../utils/utils';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

const parseTcx = (xmlText) => {
    if (!xmlText || !xmlText.trim()) {
        throw new Error("El archivo está vacío.");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Validar parsererror de DOMParser
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
        throw new Error("Formato de archivo o XML no reconocido. Por favor adjunte un archivo telemétrico .TCX / .GPX válido.");
    }
    
    const activities = xmlDoc.getElementsByTagName("Activity");
    const totalActivities = activities.length;
    const laps = xmlDoc.getElementsByTagName("Lap");
    const trkPoints = xmlDoc.getElementsByTagName("trkpt");
    const trkElements = xmlDoc.getElementsByTagName("trk");
    
    if (laps.length === 0 && trkPoints.length === 0 && trkElements.length === 0 && totalActivities === 0) {
        throw new Error("El archivo no contiene telemetría legible de entrenamiento (.TCX / .GPX).");
    }
    
    let mainSport = "Entrenamiento";
    if (totalActivities > 0) {
        mainSport = activities[0].getAttribute("Sport") || "Entrenamiento";
    } else if (trkElements.length > 0) {
        const typeEl = trkElements[0].getElementsByTagName("type")[0];
        if (typeEl && typeEl.textContent) mainSport = typeEl.textContent;
    }
    
    const sportMap = {
        "Running": "Carrera / Trote",
        "Biking": "Ciclismo",
        "Cycling": "Ciclismo",
        "Swimming": "Natación",
        "Walking": "Caminata",
        "Other": "Entrenamiento"
    };
    if (sportMap[mainSport]) {
        mainSport = sportMap[mainSport];
    }
    
    let totalSeconds = 0;
    let totalDistance = 0;
    let totalCalories = 0;
    
    let hrSum = 0;
    let hrCount = 0;
    let maxHr = 0;
    
    if (laps.length > 0) {
        for (let i = 0; i < laps.length; i++) {
            const lap = laps[i];
            
            const timeEl = lap.getElementsByTagName("TotalTimeSeconds")[0];
            if (timeEl) totalSeconds += parseFloat(timeEl.textContent || "0");
            
            const distEl = lap.getElementsByTagName("DistanceMeters")[0];
            if (distEl) totalDistance += parseFloat(distEl.textContent || "0");
            
            const calEl = lap.getElementsByTagName("Calories")[0];
            if (calEl) totalCalories += parseFloat(calEl.textContent || "0");
            
            const avgHrEl = lap.getElementsByTagName("AverageHeartRateBpm")[0];
            if (avgHrEl) {
                const valEl = avgHrEl.getElementsByTagName("Value")[0];
                if (valEl) {
                    hrSum += parseFloat(valEl.textContent || "0");
                    hrCount++;
                }
            }
            
            const maxHrEl = lap.getElementsByTagName("MaximumHeartRateBpm")[0];
            if (maxHrEl) {
                const valEl = maxHrEl.getElementsByTagName("Value")[0];
                if (valEl) {
                    const lapMax = parseFloat(valEl.textContent || "0");
                    if (lapMax > maxHr) maxHr = lapMax;
                }
            }
        }
    } else if (trkPoints.length > 0) {
        let firstTime = null;
        let lastTime = null;
        for (let i = 0; i < trkPoints.length; i++) {
            const pt = trkPoints[i];
            const timeNode = pt.getElementsByTagName("time")[0];
            if (timeNode) {
                const t = new Date(timeNode.textContent).getTime();
                if (!firstTime) firstTime = t;
                lastTime = t;
            }
            const hrNode = pt.getElementsByTagName("hr")[0] || pt.getElementsByTagName("gpxtpx:hr")[0];
            if (hrNode) {
                const val = parseFloat(hrNode.textContent || "0");
                if (val > 0) {
                    hrSum += val;
                    hrCount++;
                    if (val > maxHr) maxHr = val;
                }
            }
        }
        if (firstTime && lastTime && lastTime > firstTime) {
            totalSeconds = Math.round((lastTime - firstTime) / 1000);
        }
    }
    
    const avgHr = hrCount > 0 ? Math.round(hrSum / hrCount) : 0;
    const durationMinutes = Math.max(1, Math.round(totalSeconds / 60));
    
    if (totalCalories === 0 && durationMinutes > 0) {
        const calPerMin = mainSport.includes("Ciclismo") || mainSport.includes("Carrera") ? 9 : 6;
        totalCalories = Math.round(durationMinutes * calPerMin);
    }
    
    return {
        sport: mainSport,
        activitiesCount: totalActivities || 1,
        durationMinutes,
        calories: totalCalories,
        distanceMeters: totalDistance,
        averageHeartRate: avgHr,
        maximumHeartRate: maxHr
    };
};

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
    const { patientName: pName, patientSex, isMinor, isLactante, isPediatrico, patientAge: age } = usePatientLinguistics(patientData);

    console.log("🔍 Fase11_ActividadSueno Mount/Render. Props:", {
        hasMessages: !!messages,
        messagesLength: messages?.length,
        typeofSetMessages: typeof setMessages,
        hasRegisterInput: !!registerInputHandler,
        hasSetPatientData: !!setPatientData
    });

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
    const [lifeStyle, setLifeStyle] = useState(() => {
        const lp = patientData?.lifestyle_profile || patientData?.lifeStyleInfo || {};
        const cc = patientData?.clinical_context || {};
        
        return {
            environment: { 
                altitude: lp.environment?.altitude || cc.environment?.altitude || initialAltitude, 
                hypoxiaRisk: (lp.environment?.altitude || cc.environment?.altitude || initialAltitude) > 2000, 
                city: lp.environment?.city || cc.environment?.city || initialCity 
            },
            circadian: { 
                sleepHours: lp.sleep?.hours_avg || cc.habits?.sleep?.hours || 0, 
                quality: lp.sleep?.quality || cc.habits?.sleep?.quality || "", 
                issue_type: lp.sleep?.issue_type || cc.habits?.sleep?.issue_type || null 
            },
            hormonal: { 
                cyclePhase: lp.hormonal?.cyclePhase || "N/A", 
                lastPeriod: lp.hormonal?.lastPeriod || "" 
            },
            stress: { 
                level: lp.stress?.level || cc.habits?.stress || "", 
                origin: lp.stress?.origin || cc.habits?.stress_origin || null, 
                cortisol_management_needed: lp.stress?.cortisol_management_needed || (cc.habits?.stress === "alto")
            },
            activity: { 
                has_scheduled_exercise: lp.activity?.has_scheduled_exercise ?? cc.activity?.exercise?.has_scheduled_exercise ?? null, 
                neat_level: lp.activity?.neat_level ?? cc.activity?.exercise?.neat_level ?? null, 
                source_type: lp.activity?.source_type || cc.activity?.exercise?.source_type || "MANUAL",
                log: lp.activity?.log || cc.activity?.exercise?.log || [], 
                duration_history: lp.activity?.duration_history || cc.activity?.exercise?.duration_history || "" 
            }
        };
    });

    const [tempItem, setTempItem] = useState({});
    const [tempTelemetry, setTempTelemetry] = useState(null);
    const [tempNeatTelemetry, setTempNeatTelemetry] = useState(null);
    const [currentStep, setCurrentStep] = useState(() => {
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && msg.content.includes("evaluación de estilo de vida, actividad y sueño"));
        const lp = patientData?.lifestyle_profile || patientData?.lifeStyleInfo;
        const hasLife = lp && (lp.circadian?.sleepHours > 0 || lp.activity?.neat_level);
        if (hasSummary || hasLife) {
            return 'correct_menu';
        }
        return 'ACTIVITY_GATE';
    });
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasGreeted, setHasGreeted] = useState(false);

    const messagesRef = useRef(messages);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Rescate conversacional ante F5/recargas o restauración de sesión (Carga de Anexos / SQLite Recovery)
    useEffect(() => {
        if (!messages || messages.length === 0) return;

        const lastMsg = messages[messages.length - 1];
        if (!lastMsg || !lastMsg.content) return;

        const isAnnexMsg = lastMsg.role === 'assistant' && (
            lastMsg.content.includes("Documento(s) integrado(s) con éxito") ||
            lastMsg.content.includes("Carga de documento cancelada de forma segura")
        );
        const isRecoveryMsg = lastMsg.role === 'assistant' && lastMsg.content.includes("Sesión Recuperada Exitosamente");

        if (isAnnexMsg || isRecoveryMsg) {
            const alreadyHasContinuer = messages.slice(-2).some(msg => 
                msg.role === 'assistant' && 
                msg.content && 
                msg.content.includes("Para continuar, elija")
            );

            const hasExercise = lifeStyle.activity?.has_scheduled_exercise !== null && lifeStyle.activity?.has_scheduled_exercise !== undefined;
            const hasNeat = lifeStyle.activity?.neat_level !== null && lifeStyle.activity?.neat_level !== undefined;

            if (alreadyHasContinuer) {
                console.log("♻️ [Fase11 Rescue] Already has continuer. Restoring step only.");
                if (!hasExercise) {
                    setCurrentStep('AWAITING_TCX_FILE');
                } else if (!hasNeat) {
                    setCurrentStep('AWAITING_NEAT_TCX_FILE');
                }
                return;
            }

            console.log("♻️ [Fase11 Rescue] Last message is trigger. Appending Continuer.");
            if (!hasExercise) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Para continuar, elija una de las siguientes opciones para su Actividad Física:",
                    options: [
                        { label: "🏋️ Cargar Archivo Device (.TCX)", value: "TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "Sí" },
                        { label: "❌ No realizo ejercicio", value: "No" }
                    ]
                }]);
                setCurrentStep('AWAITING_TCX_FILE');
            } else if (!hasNeat) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Para continuar, elija una de las siguientes opciones para su Actividad Diaria (NEAT):",
                    options: [
                        { label: "🏋️ Cargar Archivo Device (.TCX)", value: "NEAT_TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "NEAT_MANUAL" },
                        { label: "❌ No aplica / Sin registro", value: "NEAT_NONE" }
                    ]
                }]);
                setCurrentStep('AWAITING_NEAT_TCX_FILE');
            }
        }
    }, [messages, lifeStyle.activity]);

    // Auto-recuperación de respuestas colgadas (dangling user messages)
    const hasRecoveredDangling = useRef(false);
    useEffect(() => {
        if (hasRecoveredDangling.current) return;
        if (!messages || messages.length < 2) return;

        const lastMsg = messages[messages.length - 1];
        const prevMsg = messages[messages.length - 2];

        if (lastMsg.role === 'user' && prevMsg.role === 'assistant') {
            hasRecoveredDangling.current = true;
            console.log("🔄 [FASE 11 RECOVERY] Re-procesando respuesta colgada:", lastMsg.content);
            setTimeout(() => {
                if (handleSendRef.current) {
                    handleSendRef.current(lastMsg.content);
                }
            }, 300);
        }
    }, [messages]);

    // Inicialización del mensaje de bienvenida (Compuerta de Ejercicio y NEAT)
    useEffect(() => {
        if (hasGreeted) {
            console.log("🔥 [Fase11] hasGreeted is true. Aborting initializer useEffect.");
            return;
        }

        console.log("🔥 [Fase11] useEffect triggered. currentStep:", currentStep, "pName:", pName, "age:", age);

        if (currentStep === 'correct_menu') {
            const greetingMsg = {
                role: 'assistant',
                content: "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de actividad física y descanso?",
                options: [
                    { label: "✏️ Modificar nivel de actividad (NEAT)", value: "MODIFY_NEAT" },
                    { label: "✏️ Modificar horas de descanso y sueño", value: "MODIFY_SLEEP" },
                    { label: "🔄 Limpiar estilo de vida", value: "CLEAR_ALL" },
                    { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                ]
            };
            setMessages(prev => {
                const alreadyGreeted = prev.some(msg => 
                    msg.role === 'assistant' && 
                    msg.content && 
                    msg.content.includes("historial de actividad física y descanso")
                );
                console.log("🔥 [Fase11] correct_menu check. alreadyGreeted:", alreadyGreeted, "prevMessagesCount:", prev.length);
                if (alreadyGreeted) return prev;
                return [...prev, greetingMsg];
            });
            setHasGreeted(true);
            return;
        }

        let greeting = "";

        if (isMinor) {
            const isPediatric = age < 12;
            const phaseSourceText = isPediatric ? "salud digestiva" : "hábitos de consumo";
            const baseConf = initialAltitude > 2000
                ? `He registrado y sellado el perfil de ${phaseSourceText} de **${pName}** de manera exitosa. Al analizar su entorno geográfico en **${initialCity}** a **${initialAltitude} msnm**, identifico un factor de hipoxia ambiental moderada que incrementa la secreción basal de cortisol e influye en el gasto biológico diario.`
                : `He registrado y sellado el perfil de ${phaseSourceText} de **${pName}** de manera exitosa. Con este bloque asegurado en el expediente clínico de **${pName}**, procedemos a evaluar la actividad física diaria y el descanso de ${patientSex === 'Femenino' ? 'la menor' : 'el menor'}.`;
            
            if (isLactante) {
                greeting = `${baseConf}\n\nPara calibrar con precisión el gasto energético de **${pName}**, iniciemos con el juego y movement diario: **¿Realiza ${pName} actividades de estimulación temprana, juego activo o movimiento libre programado?**`;
            } else {
                greeting = `${baseConf}\n\nPara calibrar con precisión el gasto energético de **${pName}**, iniciemos con la actividad física: **¿Realiza ${pName} ejercicio físico programado?** (Ej. ir al gimnasio, clases deportivas, correr o nadar de forma constante).`;
            }
        } else {
            const baseConf = initialAltitude > 2000
                ? `He registrado y sellado su perfil de hábitos de consumo de manera exitosa. Al analizar su entorno geográfico en **${initialCity}** a **${initialAltitude} msnm**, identifico un factor de hipoxia ambiental moderada que incrementa la secreción basal de cortisol e influye en su gasto biológico diario.`
                : `He registrado y sellado su perfil de hábitos de consumo de manera exitosa. Con el perfil de consumo y toxicología asegurado en su expediente, procedemos a colocar la bio-arquitectura de su día a día y calcular su gasto energético total.`;
            
            greeting = `${baseConf}\n\nPara calcular con precisión cuántas calorías quema su cuerpo: **¿Realiza ejercicio físico programado o cuenta con registros telemétricos en su dispositivo portátil (Amazfit, Garmin, Zepp)?**`;
        }

        const options = isMinor
            ? [
                { label: "✅ Sí, realiza", value: "Sí" },
                { label: "❌ No realiza", value: "No" }
            ]
            : [
                { label: "🏋️ Cargar Archivo Device (.TCX)", value: "TCX_LOAD" },
                { label: "📝 Declaración Manual", value: "Sí" },
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
                    (msg.content.includes("realiza ejercicio físico programado o cuenta con registros telemétricos en su dispositivo portátil") || 
                     msg.content.includes("actividades de estimulación temprana, juego activo") || 
                     msg.content.includes("ejercicio físico programado? (Ej. ir al gimnasio") ||
                     msg.content.includes("¿Realiza ejercicio físico programado o cuenta con registros telemétricos"))
                );
                console.log("🔥 [Fase11] standard greeting check. alreadyGreeted:", alreadyGreeted, "prevMessagesCount:", prev.length);
                if (alreadyGreeted) return prev;
                return [...prev, greetingMsg];
            });
            setHasGreeted(true);
        } else {
            console.error("❌ setMessages is not a function in Fase11_ActividadSueno!", { setMessages });
        }
    }, [isMinor, isLactante, pName, patientSex, initialCp, initialAltitude, initialCity, setMessages, age, currentStep, hasGreeted]);

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
                        source_type: lifeStyle.activity.source_type || "MANUAL",
                        telemetry_metadata: lifeStyle.activity.telemetry_metadata || null,
                        log: lifeStyle.activity.log.map(item => {
                            if (typeof item === 'object' && item !== null) {
                                return item;
                            }
                            const match = item.match(/^([^(]+)\((\d+)\s*días\/sem,\s*(\d+)\s*min\)$/);
                            if (match) {
                                return {
                                    type: match[1].trim(),
                                    frequency: parseInt(match[2], 10),
                                    duration: parseInt(match[3], 10)
                                };
                            }
                            return { type: item, frequency: 3, duration: 30 };
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
                                neat_level: lifeStyle.activity.neat_level,
                                duration_history: lifeStyle.activity.duration_history || ""
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
    const handleSend = async (text, label = 'text') => {
        const isFile = label === 'file' || text instanceof File || Array.isArray(text);
        const isButton = label === 'button';

        if (isFile) {
            setIsAnalyzing(true);
            console.log("📥 [Fase11] handleSend received files payload:", text);
            const files = Array.isArray(text) ? text : [text];

            const readAndParseFile = (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const xmlText = event.target.result;
                            const parsed = parseTcx(xmlText);
                            resolve({ fileName: file.name, ...parsed });
                        } catch (err) {
                            reject(new Error(`Archivo "${file.name}": ${err.message}`));
                        }
                    };
                    reader.onerror = () => reject(new Error(`Error de lectura en "${file.name}".`));
                    reader.readAsText(file);
                });
            };

            try {
                const results = await Promise.all(files.map(f => readAndParseFile(f)));
                console.log("🔥 [Fase11] Successfully parsed all files:", results);

                // Combinador Clínico Telemétrico
                let totalActivities = 0;
                let totalMinutes = 0;
                let totalCalories = 0;
                let totalDistance = 0;
                
                let hrWeightedSum = 0;
                let hrDurationSum = 0;
                let maxHrAbsolute = 0;
                
                const sportsDetected = new Set();
                const durationBySport = {};

                results.forEach(res => {
                    totalActivities += res.activitiesCount;
                    totalMinutes += res.durationMinutes;
                    totalCalories += res.calories;
                    totalDistance += res.distanceMeters;

                    if (res.averageHeartRate > 0 && res.durationMinutes > 0) {
                        hrWeightedSum += res.averageHeartRate * res.durationMinutes;
                        hrDurationSum += res.durationMinutes;
                    }
                    if (res.maximumHeartRate > maxHrAbsolute) {
                        maxHrAbsolute = res.maximumHeartRate;
                    }

                    if (res.sport) {
                        sportsDetected.add(res.sport);
                        durationBySport[res.sport] = (durationBySport[res.sport] || 0) + res.durationMinutes;
                    }
                });

                const finalAvgHr = hrDurationSum > 0 ? Math.round(hrWeightedSum / hrDurationSum) : 0;
                
                // Determinar deporte predominante basado en la duración
                let primarySport = "Entrenamiento";
                let maxSportDuration = -1;
                Object.keys(durationBySport).forEach(sp => {
                    if (durationBySport[sp] > maxSportDuration) {
                        maxSportDuration = durationBySport[sp];
                        primarySport = sp;
                    }
                });

                const consolidatedData = {
                    sport: primarySport,
                    activitiesCount: totalActivities,
                    durationMinutes: totalMinutes,
                    calories: totalCalories,
                    distanceMeters: totalDistance,
                    averageHeartRate: finalAvgHr,
                    maximumHeartRate: maxHrAbsolute
                };

                if (currentStep === 'AWAITING_SLEEP_TCX_FILE') {
                    const sleepHoursCalculated = Math.min(12, Math.max(4, Math.round(totalMinutes / 60) || 7));
                    const sleepQualityCalculated = finalAvgHr > 0 && finalAvgHr < 65 ? 'GOOD' : 'REGULAR';
                    
                    const updatedLife = { 
                        ...lifeStyle, 
                        sleep: { 
                            ...lifeStyle.sleep, 
                            hours_avg: sleepHoursCalculated, 
                            quality: sleepQualityCalculated,
                            source_type: "TELEMETRY_TCX"
                        },
                        circadian: {
                            ...lifeStyle.circadian,
                            sleepHours: sleepHoursCalculated
                        }
                    };
                    setLifeStyle(updatedLife);
                    if (setPatientData) {
                        setPatientData(prev => ({
                            ...prev,
                            lifestyle: updatedLife,
                            lifestyle_profile: updatedLife
                        }));
                    }

                    const summaryMetabolic = `
---
### 📊 Ingesta Telemétrica de Descanso y Sueño
*   🌙 **Tiempo de Descanso Registrado**: **${sleepHoursCalculated} horas**.
*   📈 **Frecuencia Cardíaca Reposo (FC)**: **${finalAvgHr || 60} BPM**.`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Se ha analizado la telemetría de descanso de su dispositivo portátil.\n${summaryMetabolic}\n\n¿Confirma que este bloque refleja fielmente su patrón de sueño?`,
                        options: [
                            { label: "Sí, es correcto", value: "CONFIRM_SLEEP_TELEMETRY" },
                            { label: "No, prefiero declarar manualmente", value: "CORRECT_SLEEP_TELEMETRY" }
                        ]
                    }]);

                    setCurrentStep('SLEEP_TELEMETRY_CONFIRM');
                    setIsAnalyzing(false);
                    return;
                }

                if (currentStep === 'AWAITING_NEAT_TCX_FILE') {
                    setTempNeatTelemetry(consolidatedData);

                    let parsedNeatLevel = "SEDENTARY";
                    if (totalCalories >= 400 || totalMinutes >= 90) parsedNeatLevel = "HEAVY";
                    else if (totalCalories >= 200 || totalMinutes >= 45) parsedNeatLevel = "MODERATE";
                    else if (totalCalories >= 80 || totalMinutes >= 20) parsedNeatLevel = "LIGHT";

                    const neatLabelMap = {
                        HEAVY: "Pesado (Construcción / Trabajo físico duro)",
                        MODERATE: "Moderado (Mesero / Movimiento constante)",
                        LIGHT: "Ligero (De pie o caminando poco)",
                        SEDENTARY: "Sedentario (Todo el día sentado)"
                    };

                    const summaryMetabolic = `
---
### 📊 Ingesta Telemétrica de Actividad Diaria (NEAT)
*   🔋 **Gasto Calórico de Wearable**: **${totalCalories.toFixed(0)} kcal**.
*   ⏱️ **Tiempo Activo Registrado**: **${totalMinutes} minutos**.
*   📈 **Nivel Calculado de NEAT**: **${neatLabelMap[parsedNeatLevel]}**.`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Se ha analizado la telemetría diaria de su dispositivo portátil.\n${summaryMetabolic}\n\n¿Confirma que este nivel clasifica adecuadamente su movimiento diario habitual?`,
                        options: [
                            { label: "Sí, es correcto", value: `CONFIRM_NEAT_TELEMETRY_${parsedNeatLevel}` },
                            { label: "No, prefiero declarar manualmente", value: "CORRECT_NEAT_TELEMETRY" }
                        ]
                    }]);

                    setCurrentStep('NEAT_TELEMETRY_CONFIRM');
                    setIsAnalyzing(false);
                    return;
                }

                setTempTelemetry(consolidatedData);

                const telemetryMetadata = {
                    device_name: "Wearable Device",
                    total_parsed_sessions: results.length,
                    total_calories: totalCalories,
                    total_minutes: totalMinutes,
                    total_distance: totalDistance,
                    average_hr: finalAvgHr,
                    max_hr: maxHrAbsolute,
                    sessions: results.map(r => ({
                        sport: r.sport,
                        durationMinutes: r.durationMinutes,
                        calories: r.calories,
                        distanceMeters: r.distanceMeters,
                        averageHeartRate: r.averageHeartRate,
                        maximumHeartRate: r.maximumHeartRate
                    }))
                };

                const updatedLife = {
                    ...lifeStyle,
                    activity: {
                        ...lifeStyle.activity,
                        has_scheduled_exercise: true,
                        source_type: "TELEMETRY_TCX",
                        telemetry_metadata: telemetryMetadata,
                        log: [{
                            type: primarySport || 'Entrenamiento',
                            frequency: results.length,
                            duration: totalMinutes,
                            intensity: 'Moderado',
                            heart_rate_avg: finalAvgHr,
                            heart_rate_max: maxHrAbsolute,
                            distance_meters: totalDistance,
                            calories_device: totalCalories
                        }]
                    }
                };

                setLifeStyle(updatedLife);
                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        lifestyle: updatedLife,
                        lifestyle_profile: updatedLife
                    }));
                }

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "He analizado los registros de su dispositivo y proyectado el resumen metabólico en su panel clínico lateral.\n\nPara dar cumplimiento a la NOM-004, ¿confirma que la información reflejada en pantalla describe fielmente su esfuerzo físico?",
                    options: [
                        { label: "Sí, es correcto", value: "CONFIRM_TELEMETRY" },
                        { label: "No, quiero corregir algo", value: "CORRECT_TELEMETRY" }
                    ]
                }]);

                setCurrentStep('TELEMETRY_CONFIRM');
                setIsAnalyzing(false);
            } catch (err) {
                console.error("❌ [Fase11] Error en pipeline de ingesta:", err);
                const retryStep = currentStep === 'AWAITING_NEAT_TCX_FILE' ? 'NEAT_GATE' : 'ACTIVITY_GATE';
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `⚠️ **Falla en el Pipeline de Ingesta:**\n\n${err.message}\n\nPor favor, asegúrese de adjuntar únicamente archivos \`.tcx\` de wearables válidos o realice una declaración manual.`,
                    options: currentStep === 'AWAITING_NEAT_TCX_FILE' ? [
                        { label: "🏋️ Reintentar cargar archivos", value: "NEAT_TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "NEAT_MANUAL" }
                    ] : [
                        { label: "🏋️ Reintentar cargar archivos", value: "TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "Sí" }
                    ]
                }]);
                setCurrentStep(retryStep);
                setIsAnalyzing(false);
            }
            return;
        }

        const textToProcess = text || inputValue;
        if (!textToProcess.trim()) return;

        if (textToProcess === "REFRESH_CURRENT_STEP") {
            const alreadyHasContinuer = messages && messages.slice(-2).some(msg => 
                msg.role === 'assistant' && 
                msg.content && 
                msg.content.includes("Para continuar, elija")
            );
            if (alreadyHasContinuer) {
                console.log("♻️ [Fase11 handleSend] Already has continuer. Aborting append.");
                return;
            }
            if (currentStep === 'AWAITING_TCX_FILE') {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Para continuar, elija una de las siguientes opciones para su Actividad Física:",
                    options: [
                        { label: "🏋️ Cargar Archivo Device (.TCX)", value: "TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "Sí" },
                        { label: "❌ No realizo ejercicio", value: "No" }
                    ]
                }]);
            } else if (currentStep === 'AWAITING_NEAT_TCX_FILE') {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Para continuar, elija una de las siguientes opciones para su Actividad Diaria (NEAT):",
                    options: [
                        { label: "🏋️ Cargar Archivo Device (.TCX)", value: "NEAT_TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "NEAT_MANUAL" },
                        { label: "❌ No aplica / Sin registro", value: "NEAT_NONE" }
                    ]
                }]);
            }
            return;
        }

        let userLabel = textToProcess;
        if (textToProcess === "MODIFY_NEAT") userLabel = "✏️ Modificar nivel de actividad (NEAT)";
        if (textToProcess === "MODIFY_SLEEP") userLabel = "✏️ Modificar horas de descanso y sueño";
        if (textToProcess === "CLEAR_ALL") userLabel = "🔄 Limpiar estilo de vida";
        if (textToProcess === "FINISH") userLabel = "❌ Cancelar (Volver al resumen)";
        if (textToProcess === "NEAT_TCX_LOAD") userLabel = "🏋️ Cargar Archivo Device (.TCX)";
        if (textToProcess === "NEAT_MANUAL") userLabel = "📝 Declaración Manual";
        if (textToProcess === "NEAT_NONE") userLabel = "❌ No aplica / Sin registro";
        if (textToProcess.startsWith("CONFIRM_NEAT_TELEMETRY_")) userLabel = "Sí, es correcto";
        if (textToProcess === "CORRECT_NEAT_TELEMETRY") userLabel = "No, prefiero declarar manualmente";
        if (currentStep === 'NEAT' || currentStep === 'NEAT_MANUAL_SELECT') {
            if (textToProcess === "SEDENTARY") userLabel = isLactante ? "Tranquilo / Acostado la mayor parte del tiempo" : "Sedentario (Todo el día sentado)";
            if (textToProcess === "LIGHT") userLabel = isLactante ? "Gateo inicial / Juego sentado" : "Ligero (De pie o caminando poco)";
            if (textToProcess === "MODERATE") userLabel = isLactante ? "Gateo activo / Ya camina con apoyo" : "Moderado (Mesero / Movimiento constante)";
            if (textToProcess === "HEAVY") userLabel = isLactante ? "Explora activamente / Corre / Salta" : "Pesado (Construcción / Trabajo físico duro)";
        } else if (currentStep === 'SLEEP_HOURS') {
            if (textToProcess === "14") userLabel = "14 horas o más (Adecuado para lactantes)";
            if (textToProcess === "11") userLabel = "Entre 11 y 13 horas";
            if (textToProcess === "9") userLabel = "Menos de 10 horas";
            if (textToProcess === "8") userLabel = "8 horas o más";
            if (textToProcess === "6") userLabel = "Entre 6 y 7 horas";
            if (textToProcess === "5") userLabel = "Entre 5 y 6 horas";
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
            if (textToProcess === "TCX_LOAD") userLabel = "🏋️ Cargar Archivo Device (.TCX)";
            if (textToProcess === "Sí" || textToProcess === "Si") userLabel = "Sí, declaración manual";
            if (textToProcess === "No") userLabel = "No";
        } else if (currentStep === 'TELEMETRY_CONFIRM') {
            if (textToProcess === "CONFIRM_TELEMETRY") userLabel = "Sí, es correcto";
            if (textToProcess === "CORRECT_TELEMETRY") userLabel = "No, quiero corregir algo";
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
                case 'correct_menu': {
                    const lowerText = textToProcess.toLowerCase();
                    if (textToProcess === "MODIFY_NEAT" || lowerText.includes("neat") || lowerText.includes("actividad")) {
                        askNeatQuestion();
                    } else if (textToProcess === "MODIFY_SLEEP" || lowerText.includes("sueño") || lowerText.includes("descanso")) {
                        triggerManualSleepQuestions(lifeStyle);
                    } else if (textToProcess === "CLEAR_ALL" || lowerText.includes("limpiar")) {
                        setLifeStyle({
                            environment: { altitude: initialAltitude, hypoxiaRisk: initialAltitude > 2000, city: initialCity },
                            circadian: { sleepHours: 0, quality: "", issue_type: null },
                            hormonal: { cyclePhase: "N/A", lastPeriod: "" },
                            stress: { level: "", origin: null, cortisol_management_needed: false },
                            activity: { has_scheduled_exercise: null, neat_level: null, log: [], duration_history: "" }
                        });
                        
                        let resetGreeting = isLactante
                            ? `Historial de actividad física y descanso reiniciado. ¿Realiza **${pName}** actividades de estimulación temprana o juego activo programado?`
                            : 'Historial de actividad física y descanso reiniciado. ¿Realiza usted ejercicio físico programado?';

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: resetGreeting,
                            options: isMinor
                                ? [
                                    { label: "✅ Sí, realiza", value: "Sí" },
                                    { label: "❌ No realiza", value: "No" }
                                ]
                                : [
                                    { label: "✅ Sí, realizo", value: "Sí" },
                                    { label: "❌ No realizo", value: "No" }
                                ]
                        }]);
                        setCurrentStep('ACTIVITY_GATE');
                    } else {
                        // Ante cualquier otra entrada (FINISH, No aplica, Sin registro, Continuar), sellar y avanzar de fase
                        console.log("✅ [Fase11 correct_menu] Finalizando fase con selección:", textToProcess);
                        syncLifeData(lifeStyle).then((finalState) => {
                            if (onPhaseComplete) onPhaseComplete(finalState, messagesRef.current);
                        });
                    }
                    break;
                }

                // --- 1. EJERCICIO GATE (Q34) ---
                case 'ACTIVITY_GATE': {
                    if (textToProcess === "TCX_LOAD") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Por favor, **haga clic en el botón de adjuntar (clip 📎) en la parte inferior** de la pantalla y seleccione su archivo de entrenamiento `.tcx`."
                        }]);
                        setCurrentStep('AWAITING_TCX_FILE');
                        break;
                    }

                    const hasExercise = lower === 'sí' || lower === 'si';
                    const updatedLife = { ...lifeStyle, activity: { ...lifeStyle.activity, has_scheduled_exercise: hasExercise, source_type: "MANUAL", log: [] } };
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

                case 'AWAITING_TCX_FILE': {
                    if (textToProcess === "TCX_LOAD") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, seleccione el archivo `.tcx` utilizando el botón de clip 📎."
                        }]);
                        break;
                    }
                    const hasExercise = lower === 'sí' || lower === 'si';
                    const updatedLife = { ...lifeStyle, activity: { ...lifeStyle.activity, has_scheduled_exercise: hasExercise, source_type: "MANUAL", log: [] } };
                    setLifeStyle(updatedLife);
                    if (hasExercise) {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Excelente. ¿Qué actividad practica? (Ej. Correr, Natación, Gimnasio)` }]);
                        setCurrentStep('ACTIVITY_TYPE');
                    } else {
                        askNeatQuestion();
                    }
                    break;
                }

                case 'TELEMETRY_CONFIRM': {
                    if (textToProcess === "CONFIRM_TELEMETRY") {
                        const intensityMapeada = tempTelemetry.averageHeartRate > 140 ? "VIGOROUS" : (tempTelemetry.averageHeartRate > 110 ? "MODERATE" : "LOW");
                        const newLogItem = {
                            type: tempTelemetry.sport,
                            frequency: tempTelemetry.activitiesCount,
                            duration: tempTelemetry.durationMinutes,
                            intensity: intensityMapeada,
                            heart_rate_avg: tempTelemetry.averageHeartRate,
                            heart_rate_max: tempTelemetry.maximumHeartRate,
                            distance_meters: tempTelemetry.distanceMeters,
                            calories_device: tempTelemetry.calories
                        };

                        const updatedLife = {
                            ...lifeStyle,
                            activity: {
                                ...lifeStyle.activity,
                                has_scheduled_exercise: true,
                                source_type: "TELEMETRY_TCX",
                                telemetry_metadata: {
                                    device_name: "Wearable Device",
                                    total_parsed_sessions: tempTelemetry.activitiesCount
                                },
                                log: [newLogItem]
                            }
                        };
                        setLifeStyle(updatedLife);
                        
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Métricas telemétricas integradas exitosamente a su expediente clínico. Procedamos con el resto de su rutina diaria."
                        }]);
                        
                        setTimeout(() => {
                            askNeatQuestion(updatedLife);
                        }, 500);
                    } else if (textToProcess === "CORRECT_TELEMETRY") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Vamos a ajustar sus datos de actividad. ¿Cómo desea proceder?",
                            options: [
                                { label: "📝 Declarar Actividad Manualmente", value: "Sí" },
                                { label: "🏋️ Reintentar Cargar Archivo .TCX", value: "TCX_LOAD" },
                                { label: "❌ No realizo ejercicio", value: "No" }
                            ]
                        }]);
                        setCurrentStep('ACTIVITY_GATE');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir." }]);
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
                        const durationMsg = isLactante
                            ? `¿Desde cuándo realiza **${pName}** este tipo de actividades?`
                            : `¿Desde cuándo realiza este tipo de actividad?`;
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: durationMsg,
                            options: [
                                { label: "Menos de 3 meses", value: "Menos de 3 meses" },
                                { label: "De 3 a 6 meses", value: "De 3 a 6 meses" },
                                { label: "De 6 a 12 meses", value: "De 6 a 12 meses" },
                                { label: "Más de 1 año", value: "Más de 1 año" }
                            ]
                        }]);
                        setCurrentStep('ACTIVITY_DURATION_HISTORY');
                    }
                    break;
                }

                // --- 5b. DURACIÓN DE HISTORIAL DE ACTIVIDAD (Q34d2) ---
                case 'ACTIVITY_DURATION_HISTORY': {
                    const updatedLife = {
                        ...lifeStyle,
                        activity: {
                            ...lifeStyle.activity,
                            duration_history: cleanText
                        }
                    };
                    setLifeStyle(updatedLife);
                    askNeatQuestion();
                    break;
                }

                // --- 6. COMPUERTA TRIPARTITA NEAT (Q34e_gate) ---
                case 'NEAT_GATE': {
                    if (textToProcess === "NEAT_TCX_LOAD") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Por favor, **haga clic en el botón de adjuntar (clip 📎) en la parte inferior** de la pantalla y seleccione su archivo de actividad diaria general `.tcx`."
                        }]);
                        setCurrentStep('AWAITING_NEAT_TCX_FILE');
                    } else if (textToProcess === "NEAT_MANUAL") {
                        const neatMsg = `Independientemente del ejercicio programado, ¿cómo describiría su actividad diaria habitual (trabajo, oficina o casa)?`;
                        const neatOptions = [
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
                        setCurrentStep('NEAT_MANUAL_SELECT');
                    } else if (textToProcess === "NEAT_NONE") {
                        const updatedLife = { 
                            ...lifeStyle, 
                            activity: { ...lifeStyle.activity, neat_level: 'SEDENTARY' } 
                        };
                        setLifeStyle(updatedLife);
                        askSleepQuestion(updatedLife);
                    }
                    break;
                }

                case 'AWAITING_NEAT_TCX_FILE': {
                    if (textToProcess === "NEAT_TCX_LOAD") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, seleccione el archivo `.tcx` de actividad diaria habitual utilizando el botón de clip 📎."
                        }]);
                    }
                    break;
                }

                case 'NEAT_TELEMETRY_CONFIRM': {
                    if (textToProcess.startsWith("CONFIRM_NEAT_TELEMETRY_")) {
                        const level = textToProcess.replace("CONFIRM_NEAT_TELEMETRY_", "");
                        const updatedLife = { 
                            ...lifeStyle, 
                            activity: { ...lifeStyle.activity, neat_level: level } 
                        };
                        setLifeStyle(updatedLife);
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Métricas de movimiento diario integradas exitosamente a su expediente clínico."
                        }]);
                        setTimeout(() => {
                            askSleepQuestion(updatedLife);
                        }, 500);
                    } else if (textToProcess === "CORRECT_NEAT_TELEMETRY") {
                        const neatMsg = `Entendido. Vamos a registrar su nivel de actividad de forma manual: ¿cómo describiría su actividad diaria habitual?`;
                        const neatOptions = [
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
                        setCurrentStep('NEAT_MANUAL_SELECT');
                    }
                    break;
                }

                case 'NEAT_MANUAL_SELECT':
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
                                { label: 'Pesado (Construcción / Trabajo físico duro)', value: 'HEAVY' }
                            ]
                        }]);
                        return;
                    }

                    const updatedLife = { 
                        ...lifeStyle, 
                        activity: { ...lifeStyle.activity, neat_level: cleanText } 
                    };
                    setLifeStyle(updatedLife);
                    askSleepQuestion(updatedLife);
                    break;
                }

                case 'SLEEP_GATE': {
                    if (textToProcess === "SLEEP_TCX_LOAD" || lower.includes("tcx") || lower.includes("archivo")) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Por favor, **haga clic en el botón de adjuntar (clip 📎) en la parte inferior** de la pantalla y seleccione su archivo de descanso/sueño `.tcx` / wearable."
                        }]);
                        setCurrentStep('AWAITING_SLEEP_TCX_FILE');
                    } else if (textToProcess === "SLEEP_MANUAL" || lower.includes("manual")) {
                        triggerManualSleepQuestions(lifeStyle);
                    } else if (textToProcess === "SLEEP_NONE" || lower.includes("no aplica") || lower.includes("sin registro") || lower.includes("omitir")) {
                        const updatedLife = { 
                            ...lifeStyle, 
                            sleep: { ...lifeStyle.sleep, hours_avg: isLactante ? 14 : 7, quality: 'GOOD' } 
                        };
                        setLifeStyle(updatedLife);
                        askStressQuestion(updatedLife);
                    } else {
                        triggerManualSleepQuestions(lifeStyle);
                    }
                    break;
                }

                case 'AWAITING_SLEEP_TCX_FILE': {
                    if (textToProcess === "SLEEP_TCX_LOAD") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, seleccione el archivo `.tcx` de descanso utilizando el botón de clip 📎."
                        }]);
                    }
                    break;
                }

                case 'SLEEP_TELEMETRY_CONFIRM': {
                    if (textToProcess.startsWith("CONFIRM_SLEEP_TELEMETRY")) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Métricas de descanso integradas exitosamente a su expediente clínico."
                        }]);
                        setTimeout(() => {
                            askStressQuestion(lifeStyle);
                        }, 500);
                    } else if (textToProcess === "CORRECT_SLEEP_TELEMETRY") {
                        triggerManualSleepQuestions(lifeStyle);
                    }
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
                    const isConfirm = textToProcess === "CONFIRM_DATA" || 
                                      lower.includes("es_correcta") || 
                                      lower.includes("es correcta") || 
                                      lower === "sí" || 
                                      lower === "si" || 
                                      lower.includes("correcto");
                    const isCorrectData = textToProcess === "CORRECT_DATA" || 
                                          lower.includes("corregir") || 
                                          lower.includes("no, quiero");

                    if (isConfirm) {
                        // Guardar datos y completar
                        syncLifeData(lifeStyle).then((finalState) => {
                            onPhaseComplete?.(finalState, messagesRef.current);
                        });
                    } else if (isCorrectData) {
                        // Reiniciar al paso innegociable de ejercicio
                        setLifeStyle({
                            environment: { altitude: initialAltitude, hypoxiaRisk: initialAltitude > 2000, city: initialCity },
                            circadian: { sleepHours: 0, quality: "", issue_type: null },
                            hormonal: { cyclePhase: "N/A", lastPeriod: "" },
                            stress: { level: "", origin: null, cortisol_management_needed: false },
                            activity: { has_scheduled_exercise: null, neat_level: null, log: [], duration_history: "" }
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
        if (isMinor) {
            const neatMsg = isLactante
                ? `Independientemente de la estimulación programada, ¿cómo describiría el nivel de movimiento o actividad espontánea diaria de **${pName}**?`
                : `Independientemente del deporte, ¿cómo describiría la actividad diaria habitual de **${pName}** (trabajo, escuela o casa)?`;
            
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
        } else {
            // Compuerta Tripartita para Adultos
            const neatMsg = `Independientemente del ejercicio programado: **¿Cómo registrará su actividad o movimiento diario habitual (NEAT)?**`;
            const neatOptions = [
                { label: "🏋️ Cargar Archivo Device (.TCX)", value: "NEAT_TCX_LOAD" },
                { label: "📝 Declaración Manual", value: "NEAT_MANUAL" },
                { label: "❌ No aplica / Sin registro", value: "NEAT_NONE" }
            ];

            setMessages(prev => [...prev, {
                role: 'assistant', 
                content: neatMsg, 
                options: neatOptions
            }]);
            setCurrentStep('NEAT_GATE');
        }
    };

    const triggerManualSleepQuestions = (state) => {
        const sleepMsg = isMinor
            ? `Entendido. Evaluemos el descanso. ¿Cuántas horas duerme **${pName}** en promedio al día?`
            : `Entendido. Pasemos al descanso. **¿Cuántas horas duerme en promedio al día?**`;
        
        const sleepOptions = isLactante
            ? [
                { label: "14 horas o más", value: "14" },
                { label: "Entre 11 y 13 horas", value: "11" },
                { label: "Entre 9 y 10 horas", value: "9" },
                { label: "Menos de 9 horas", value: "8" }
            ]
            : (isMinor
                ? [
                    { label: "9 horas o más", value: "9" },
                    { label: "Entre 8 y 9 horas", value: "8" },
                    { label: "Entre 7 y 8 horas", value: "7" },
                    { label: "Menos de 7 horas", value: "6" }
                ]
                : [
                    { label: "9 horas o más", value: "9" },
                    { label: "Entre 7 y 8 horas", value: "7" },
                    { label: "Entre 6 y 7 horas", value: "6" },
                    { label: "Entre 5 y 6 horas", value: "5" },
                    { label: "Menos de 5 horas", value: "4" }
                ]
            );

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: sleepMsg,
            options: sleepOptions
        }]);
        setCurrentStep('SLEEP_HOURS');
        
        if (state) {
            syncLifeData(state);
        }
    };

    const askSleepQuestion = (state) => {
        const sleepMsg = isMinor
            ? `Entendido. Evaluemos el descanso de **${pName}**. ¿Desea cargar los datos de descanso de su dispositivo o realizar una declaración manual?`
            : `Entendido. Pasemos al descanso. **¿Desea registrar su patrón de sueño cargando un archivo de su dispositivo wearable (.TCX / .GPX) o prefiere una declaración manual?**`;
        
        const sleepOptions = isMinor
            ? [
                { label: "📝 Declaración Manual", value: "SLEEP_MANUAL" },
                { label: "❌ No aplica / Sin registro", value: "SLEEP_NONE" }
            ]
            : [
                { label: "🏋️ Cargar Archivo Device (.TCX)", value: "SLEEP_TCX_LOAD" },
                { label: "📝 Declaración Manual", value: "SLEEP_MANUAL" },
                { label: "❌ No aplica / Sin registro", value: "SLEEP_NONE" }
            ];

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: sleepMsg,
            options: sleepOptions
        }]);
        setCurrentStep('SLEEP_GATE');
        
        if (state) {
            syncLifeData(state);
        }
    };

    const askStressQuestion = (state) => {
        const stressMsg = isLactante
            ? `Sincronizado. Para estructurar su perfil de neuro-desarrollo, ¿cuál es el nivel de irritabilidad diaria en promedio de **${pName}** (su bebé)?`
            : (isMinor
                ? `Sincronizado. Para estructurar su perfil de descanso, ¿cuál es el nivel de irritabilidad/estrés diario en promedio de **${pName}**?`
                : `Sincronizado. Para estructurar su perfil de estrés y cortisol, **¿cómo percibe su nivel actual de estrés?**`);

        const stressOptions = isLactante
            ? [
                { label: "Bajo (Tranquilo / Llantos ocasionales)", value: "Bajo" },
                { label: "Moderado (Irritabilidad ocasional)", value: "Moderado" },
                { label: "Alto (Llanto frecuente / Difícil de consolar)", value: "Alto" }
            ]
            : [
                { label: "Bajo", value: "Bajo" },
                { label: "Moderado", value: "Moderado" },
                { label: "Alto", value: "Alto" }
            ];

        setMessages(prev => [...prev, {
            role: 'assistant', 
            content: stressMsg, 
            options: stressOptions
        }]);
        setCurrentStep('STRESS_LEVEL');

        if (state) {
            syncLifeData(state);
        }
    };

    // Helper para estructurar y renderizar la síntesis final NOM-004 de Estilo de Vida
    const buildAndShowSummary = (state) => {
        let summaryText = isLactante
            ? `Como protocolo de seguridad clínica y de estricto apego a la **NOM-004**, le presento la síntesis consolidada del entorno y estilo de vida de **${pName}**:\n\n`
            : `Como protocolo de seguridad clínica y de estricto apego a la **NOM-004**, le presento la síntesis consolidada de su entorno y estilo de vida:\n\n`;
        
        // 1. Actividad Física / Ejercicio
        let activityStr = "";
        if (state.activity.has_scheduled_exercise) {
            activityStr = "Sí";
            if (state.activity.log && state.activity.log.length > 0) {
                const formattedActivities = state.activity.log.map((item, idx) => {
                    if (typeof item === 'object' && item !== null) {
                        let sportEmoji = "🏋️";
                        let sportName = item.type || "Entrenamiento";
                        const lowerSport = sportName.toLowerCase();
                        if (lowerSport.includes("natación") || lowerSport.includes("swim") || lowerSport.includes("swimming")) {
                            sportEmoji = "🏊";
                            sportName = "Natación en Piscina";
                        } else if (lowerSport.includes("ciclismo") || lowerSport.includes("bike") || lowerSport.includes("cycl")) {
                            sportEmoji = "🚴";
                            sportName = lowerSport.includes("interior") || lowerSport.includes("indoor") ? "Ciclismo de Interior" : "Ciclismo de Exterior";
                        } else if (lowerSport.includes("carrera") || lowerSport.includes("run") || lowerSport.includes("trote")) {
                            sportEmoji = "🏃";
                            sportName = lowerSport.includes("interior") || lowerSport.includes("cinta") ? "Carrera en Cinta" : "Carrera / Trote";
                        } else if (lowerSport.includes("caminata") || lowerSport.includes("walk")) {
                            sportEmoji = "🚶";
                            sportName = "Caminata";
                        } else if (lowerSport.includes("elíptica") || lowerSport.includes("ellip")) {
                            sportEmoji = "🏃";
                            sportName = "Elíptica";
                        } else if (lowerSport.includes("libre") || lowerSport.includes("other") || lowerSport.includes("fuerza") || lowerSport.includes("fitness")) {
                            sportEmoji = "🧘";
                            sportName = "Entrenamiento Libre";
                        }

                        const parts = [];
                        if (item.distance_meters > 0) {
                            const distFormatted = item.distance_meters >= 1000 
                                ? `${(item.distance_meters / 1000).toFixed(2).replace('.', ',')} km` 
                                : `${Math.round(item.distance_meters)} m`;
                            parts.push(`Distancia: ${distFormatted}`);
                        }
                        parts.push(`Duración: ${item.duration || item.durationMinutes || 0} min`);
                        if (item.calories_device > 0 || item.calories > 0) {
                            const cal = item.calories_device || item.calories;
                            parts.push(`Calorías: ${Math.round(cal)} kcal`);
                        }
                        if (item.heart_rate_avg > 0) {
                            parts.push(`FC Promedio: ${item.heart_rate_avg} BPM`);
                        }
                        if (item.heart_rate_max > 0) {
                            parts.push(`FC Máxima: ${item.heart_rate_max} BPM`);
                        }
                        return `\n  - ${sportEmoji} **${sportName}**: ${parts.join(", ")}`;
                    } else {
                        let sportEmoji = "🏋️";
                        const lowerItem = String(item).toLowerCase();
                        if (lowerItem.includes("natacion") || lowerItem.includes("swim")) sportEmoji = "🏊";
                        else if (lowerItem.includes("ciclismo") || lowerItem.includes("bici") || lowerItem.includes("cycl")) sportEmoji = "🚴";
                        else if (lowerItem.includes("correr") || lowerItem.includes("run") || lowerItem.includes("trote") || lowerItem.includes("carrera")) sportEmoji = "🏃";
                        else if (lowerItem.includes("caminar") || lowerItem.includes("walk") || lowerItem.includes("caminata")) sportEmoji = "🚶";
                        else if (lowerItem.includes("eliptica") || lowerItem.includes("ellip")) sportEmoji = "🏃";
                        else if (lowerItem.includes("libre") || lowerItem.includes("fuerza") || lowerItem.includes("flexibilidad") || lowerItem.includes("gimnasio")) sportEmoji = "🧘";
                        return `\n  - ${sportEmoji} ${item}`;
                    }
                });
                activityStr += formattedActivities.join("");
            } else {
                activityStr += " (Sin detalles)";
            }
            if (state.activity.duration_history) {
                activityStr += `\n  - ⏱️ **Antigüedad:** ${state.activity.duration_history}`;
            }
        } else {
            activityStr = "No";
        }

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

        // 6. Resumen de Carga Física / Metabólica Dinámica
        let metabolicSummary = "";
        if (state.activity.source_type === "TELEMETRY_TCX" || (state.activity.log && state.activity.log.some(x => typeof x === 'object'))) {
            let totalCal = 0;
            let totalMin = 0;
            let maxHr = 0;
            let sumHr = 0;
            let countHr = 0;
            state.activity.log.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    totalCal += (item.calories_device || item.calories || 0);
                    totalMin += (item.duration || item.durationMinutes || 0);
                    if ((item.heart_rate_max || 0) > maxHr) maxHr = item.heart_rate_max;
                    if (item.heart_rate_avg > 0) {
                        sumHr += item.heart_rate_avg * (item.duration || item.durationMinutes || 0);
                        countHr += (item.duration || item.durationMinutes || 0);
                    }
                }
            });
            const avgHr = countHr > 0 ? Math.round(sumHr / countHr) : 0;
            metabolicSummary = `\n📊 **Resumen de Carga Física (Vía Telemetría):**\n- 🔥 **Gasto Calórico Total:** ${totalCal.toFixed(0)} kcal\n- ⏱️ **Tiempo de Ejercicio Total:** ${totalMin} minutos\n- 📈 **Carga Cardiovascular:** Promedio de ${avgHr} BPM (Máx: ${maxHr} BPM)`;
        } else if (state.activity.has_scheduled_exercise) {
            let totalWeeklyMin = 0;
            state.activity.log.forEach(item => {
                if (typeof item === 'string') {
                    const daysMatch = item.match(/(\d+)\s*(?:días|dias|d\/sem|días\/sem)/i);
                    const minsMatch = item.match(/(\d+)\s*min/i);
                    if (daysMatch && minsMatch) {
                        const days = parseInt(daysMatch[1], 10);
                        const mins = parseInt(minsMatch[1], 10);
                        totalWeeklyMin += (days * mins);
                    } else if (minsMatch) {
                        totalWeeklyMin += parseInt(minsMatch[1], 10);
                    }
                }
            });
            if (totalWeeklyMin > 0) {
                metabolicSummary = `\n📊 **Resumen de Carga Física (Vía Reporte Manual):**\n- ⏱️ **Tiempo de Ejercicio Semanal:** ${totalWeeklyMin} minutos/semana\n- ⚡ **Nivel de Actividad Estimado:** ${totalWeeklyMin >= 150 ? 'Cumple recomendación OMS (>=150 min/sem)' : 'Menor a recomendación OMS (<150 min/sem)'}`;
            }
        }
        
        if (metabolicSummary) {
            summaryText += `${metabolicSummary}\n`;
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

    const handleSendRef = useRef(handleSend);
    useEffect(() => {
        handleSendRef.current = handleSend;
    });

    // Registrar manejador de entrada
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, label) => handleSendRef.current(text, label));
        }
        return () => {
            if (registerInputHandler) {
                registerInputHandler(null);
            }
        };
    }, [registerInputHandler]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(isAnalyzing);
        }
    }, [isAnalyzing, setIsGlobalTyping]);

    return null;
};

export default Fase11_ActividadSueno;
