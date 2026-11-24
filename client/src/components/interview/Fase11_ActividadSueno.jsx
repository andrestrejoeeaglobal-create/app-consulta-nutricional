import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { formatText } from '../../utils/utils';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { resolvePatientSex, filterOrphanTelemetryAnnexes, resolveActiveExerciseTelemetry } from '../../utils/genderConcordance';

const normalizeTcxDisciplineLabel = (rawSport = "", rawNote = "") => {
    const cleanNote = String(rawNote || "").trim();
    const cleanSport = String(rawSport || "").trim();

    if (cleanNote) {
        const lowerNote = cleanNote
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        if (lowerNote.includes("treadmill") || lowerNote.includes("indoor run") || lowerNote.includes("caminadora") || lowerNote.includes("cinta")) {
            return "Caminadora";
        }
        if (lowerNote.includes("ellip") || lowerNote.includes("eliptic")) {
            return "Elíptica";
        }
        if (lowerNote.includes("core") || lowerNote.includes("troncal") || lowerNote.includes("abdom")) {
            return "Entrenamiento troncal";
        }
        if (lowerNote.includes("free") || lowerNote.includes("entrenamiento libre") || lowerNote === "libre") {
            return "Entrenamiento libre";
        }
        if (lowerNote.includes("spin") || lowerNote.includes("indoor cyc") || lowerNote.includes("bici fija")) {
            return "Ciclismo de interior";
        }
        if (lowerNote.includes("strength") || lowerNote.includes("weight") || lowerNote.includes("fuerza") || lowerNote.includes("pesas")) {
            return "Entrenamiento de fuerza";
        }
        if (lowerNote.includes("row") || lowerNote.includes("remo")) {
            return "Remo ergómetro";
        }
        if (lowerNote.includes("walk") || lowerNote.includes("caminata")) {
            return "Caminata";
        }
        if (!["other", "workout", "training"].includes(lowerNote)) {
            return cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
        }
    }

    const sportMap = {
        "Running": "Carrera / Trote",
        "Biking": "Ciclismo",
        "Cycling": "Ciclismo",
        "Swimming": "Natación",
        "Walking": "Caminata",
        "Other": "Entrenamiento"
    };
    return sportMap[cleanSport] || cleanSport || "Entrenamiento";
};

const extractLocalDateMetadata = (isoStr) => {
    if (!isoStr) return { startTimeIso: null, startTimeMs: null, dateKey: null, dateDisplay: null };
    const parsed = new Date(isoStr);
    if (isNaN(parsed.getTime())) {
        return { startTimeIso: null, startTimeMs: null, dateKey: null, dateDisplay: null };
    }
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return {
        startTimeIso: parsed.toISOString(),
        startTimeMs: parsed.getTime(),
        dateKey: `${yyyy}-${mm}-${dd}`,
        dateDisplay: `${dd}/${mm}/${yyyy}`
    };
};

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
    
    let rawSport = "Entrenamiento";
    let rawNote = "";
    let rawStartIso = null;
    let deviceName = null;

    if (totalActivities > 0) {
        const act0 = activities[0];
        rawSport = act0.getAttribute("Sport") || "Entrenamiento";
        const notesNode = act0.getElementsByTagName("Notes")[0] || xmlDoc.getElementsByTagName("Notes")[0];
        if (notesNode && notesNode.textContent) {
            rawNote = notesNode.textContent.trim();
        }
        const idNode = act0.getElementsByTagName("Id")[0];
        if (idNode && idNode.textContent) {
            rawStartIso = idNode.textContent.trim();
        }
        const creatorNode = act0.getElementsByTagName("Creator")[0] || xmlDoc.getElementsByTagName("Creator")[0];
        if (creatorNode) {
            const creatorNameNode = creatorNode.getElementsByTagName("Name")[0];
            if (creatorNameNode && creatorNameNode.textContent) {
                deviceName = creatorNameNode.textContent.trim();
            }
        }
    } else if (trkElements.length > 0) {
        const typeEl = trkElements[0].getElementsByTagName("type")[0];
        if (typeEl && typeEl.textContent) rawSport = typeEl.textContent.trim();
        const nameEl = trkElements[0].getElementsByTagName("name")[0];
        if (nameEl && nameEl.textContent) rawNote = nameEl.textContent.trim();
    }

    if (!deviceName) {
        const authorNode = xmlDoc.getElementsByTagName("Author")[0];
        const authorName = authorNode?.getElementsByTagName("Name")[0]?.textContent?.trim();
        if (authorName && !authorName.toLowerCase().includes("zepp app")) {
            deviceName = authorName;
        }
    }

    if (!rawStartIso && laps.length > 0) {
        rawStartIso = laps[0].getAttribute("StartTime") || null;
    }

    const mainSport = normalizeTcxDisciplineLabel(rawSport, rawNote);
    
    let totalSeconds = 0;
    let totalDistance = 0;
    let totalCalories = 0;
    
    let hrWeightedSum = 0;
    let hrWeightSeconds = 0;
    let hrSum = 0;
    let hrCount = 0;
    let maxHr = 0;
    
    if (laps.length > 0) {
        for (let i = 0; i < laps.length; i++) {
            const lap = laps[i];
            
            const timeEl = lap.getElementsByTagName("TotalTimeSeconds")[0];
            const lapSeconds = timeEl ? (parseFloat(timeEl.textContent || "0") || 0) : 0;
            totalSeconds += lapSeconds;
            
            const distEl = lap.getElementsByTagName("DistanceMeters")[0];
            if (distEl) totalDistance += parseFloat(distEl.textContent || "0") || 0;
            
            const calEl = lap.getElementsByTagName("Calories")[0];
            if (calEl) totalCalories += parseFloat(calEl.textContent || "0") || 0;
            
            const avgHrEl = lap.getElementsByTagName("AverageHeartRateBpm")[0];
            if (avgHrEl) {
                const valEl = avgHrEl.getElementsByTagName("Value")[0];
                if (valEl) {
                    const lapHr = parseFloat(valEl.textContent || "0") || 0;
                    if (lapHr > 0) {
                        const weightSec = lapSeconds > 0 ? lapSeconds : 1;
                        hrWeightedSum += lapHr * weightSec;
                        hrWeightSeconds += weightSec;
                        hrSum += lapHr;
                        hrCount++;
                    }
                }
            }
            
            const maxHrEl = lap.getElementsByTagName("MaximumHeartRateBpm")[0];
            if (maxHrEl) {
                const valEl = maxHrEl.getElementsByTagName("Value")[0];
                if (valEl) {
                    const lapMax = parseFloat(valEl.textContent || "0") || 0;
                    if (lapMax > maxHr) maxHr = Math.round(lapMax);
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
                if (!rawStartIso) rawStartIso = timeNode.textContent.trim();
                const t = new Date(timeNode.textContent).getTime();
                if (!firstTime) firstTime = t;
                lastTime = t;
            }
            const hrNode = pt.getElementsByTagName("hr")[0] || pt.getElementsByTagName("gpxtpx:hr")[0];
            if (hrNode) {
                const val = parseFloat(hrNode.textContent || "0") || 0;
                if (val > 0) {
                    hrSum += val;
                    hrCount++;
                    if (val > maxHr) maxHr = Math.round(val);
                }
            }
        }
        if (firstTime && lastTime && lastTime > firstTime) {
            totalSeconds = Math.round((lastTime - firstTime) / 1000);
        }
    }
    
    const avgHr = hrWeightSeconds > 0
        ? Math.round(hrWeightedSum / hrWeightSeconds)
        : (hrCount > 0 ? Math.round(hrSum / hrCount) : 0);
    const exactSeconds = Math.max(1, Math.round(totalSeconds));
    const durationMinutesExact = Number((exactSeconds / 60).toFixed(1));
    const durationMinutes = Math.max(1, Math.round(exactSeconds / 60));
    
    if (totalCalories === 0 && durationMinutes > 0) {
        const calPerMin = mainSport.includes("Ciclismo") || mainSport.includes("Carrera") || mainSport.includes("Caminadora") ? 9 : 6;
        totalCalories = Math.round(durationMinutes * calPerMin);
    }

    const dateMeta = extractLocalDateMetadata(rawStartIso);
    
    return {
        sport: mainSport,
        rawSport,
        note: rawNote || null,
        deviceName: deviceName || null,
        activitiesCount: totalActivities || 1,
        totalSeconds: exactSeconds,
        durationMinutesExact,
        durationMinutes,
        calories: Math.round(totalCalories),
        distanceMeters: Math.round(totalDistance),
        averageHeartRate: avgHr,
        maximumHeartRate: maxHr,
        ...dateMeta
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
    const { patientName: pName, patientSex, isMinor, isLactante, isPreescolar, isEscolar, isPediatrico, patientAge: age } = usePatientLinguistics(patientData);
    const { isFemale: isFemalePatient } = resolvePatientSex(patientData);
    const sedentaryAdultLabel = isFemalePatient
        ? 'Sedentaria (Jornada en escritorio o traslados mínimos)'
        : 'Sedentario (Jornada en escritorio o traslados mínimos)';
    const adultNeatOptions = [
        { label: sedentaryAdultLabel, value: 'SEDENTARY' },
        { label: 'Ligero (Caminatas breves o actividad de pie intermitente)', value: 'LIGHT' },
        { label: 'Moderado (Movimiento activo constante en jornada diaria)', value: 'MODERATE' },
        { label: 'Intenso (Actividad física ocupacional continua de alta demanda)', value: 'HEAVY' }
    ];

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
                level: ['LOW', 'MODERATE', 'HIGH'].includes(String(lp.stress?.level || '').toUpperCase())
                    ? String(lp.stress.level).toUpperCase()
                    : (cc.habits?.stress === 'alto' ? 'HIGH' : cc.habits?.stress === 'bajo' ? 'LOW' : ''), 
                origin: lp.stress?.origin || cc.habits?.stress_origin || null, 
                cortisol_management_needed: Boolean(lp.stress?.cortisol_management_needed || (cc.habits?.stress === "alto"))
            },
            activity: { 
                has_scheduled_exercise: lp.activity?.has_scheduled_exercise ?? cc.activity?.exercise?.has_scheduled_exercise ?? null, 
                neat_level: lp.activity?.neat_level ?? cc.activity?.exercise?.neat_level ?? null,
                preview_neat_pending: Boolean(lp.activity?.preview_neat_pending ?? cc.activity?.exercise?.preview_neat_pending ?? false),
                source_type: lp.activity?.source_type || cc.activity?.exercise?.source_type || "MANUAL",
                telemetry_metadata: resolveActiveExerciseTelemetry(patientData),
                log: lp.activity?.log || cc.activity?.exercise?.log || [], 
                duration_history: lp.activity?.duration_history || cc.activity?.exercise?.duration_history || "" 
            }
        };
    });

    const [tempItem, setTempItem] = useState({});
    const [tempTelemetry, setTempTelemetry] = useState(null);
    const [isSingleLineEdit, setIsSingleLineEdit] = useState(false);
    const isProcessingInputRef = useRef(false);
    const [tempNeatTelemetry, setTempNeatTelemetry] = useState(null);
    const [currentStep, setCurrentStep] = useState(() => {
        if (Array.isArray(messages) && messages.length > 0) {
            const lastAssistant = [...messages].reverse().find(m => m && m.role === 'assistant');
            if (lastAssistant) {
                const optVals = Array.isArray(lastAssistant.options)
                    ? lastAssistant.options.map(o => String(o?.value || ''))
                    : [];
                const txt = String(lastAssistant.content || '');
                if (optVals.includes('CONFIRM_TELEMETRY') || optVals.includes('CORRECT_TELEMETRY')) return 'TELEMETRY_CONFIRM';
                if (txt.includes('cuántos días por semana realiza habitualmente esta rutina')) return 'TELEMETRY_WEEKLY_DAYS';
                if (optVals.some(v => v.startsWith('CONFIRM_NEAT_TELEMETRY_')) || optVals.includes('CORRECT_NEAT_TELEMETRY')) return 'NEAT_TELEMETRY_CONFIRM';
                if (optVals.includes('CONFIRM_SLEEP_TELEMETRY') || optVals.includes('CORRECT_SLEEP_TELEMETRY')) return 'SLEEP_TELEMETRY_CONFIRM';
                if (optVals.includes('CONFIRM_DATA') && txt.includes('síntesis consolidada')) return 'REVIEW_SUMMARY';
                if (txt.includes('¿Qué línea específica desea modificar')) return 'correct_menu';
                if (optVals.includes('SEDENTARY') && optVals.includes('MODERATE')) return 'NEAT';
                if (optVals.includes('NEAT_TCX_LOAD') || optVals.includes('NEAT_MANUAL')) return 'NEAT_GATE';
                if (txt.includes('seleccione su archivo de entrenamiento') || txt.includes('seleccione el archivo `.tcx` utilizando')) return 'AWAITING_TCX_FILE';
                if (optVals.includes('SLEEP_TCX_LOAD') || optVals.includes('SLEEP_MANUAL')) return 'SLEEP_GATE';
                if (txt.includes('¿Cuántas horas duerme')) return 'SLEEP_HOURS';
                if (optVals.includes('Buena') && optVals.includes('Mala')) return 'SLEEP_QUALITY';
                if (optVals.includes('INSOMNIA') || optVals.includes('FRAGMENTED')) return 'SLEEP_ISSUE';
                if (txt.includes('nivel actual de estrés') || txt.includes('nivel de estrés diario') || txt.includes('nivel de irritabilidad')) return 'STRESS_LEVEL';
                if (optVals.includes('EMOTIONAL') && optVals.includes('PHYSICAL')) return 'STRESS_ORIGIN';
            }
        }
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && msg.content.includes("síntesis consolidada de su entorno y estilo de vida"));
        const lp = patientData?.lifestyle_profile || patientData?.lifeStyleInfo;
        const hasLife = lp && (lp.sleep?.hours_avg > 0 || lp.circadian?.sleepHours > 0) && Boolean(lp.activity?.neat_level);
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
                        { label: "📝 Declaración Manual", value: "NEAT_MANUAL" }
                    ]
                }]);
                setCurrentStep('AWAITING_NEAT_TCX_FILE');
            } else if (!lifeStyle.circadian?.sleepHours) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Para continuar, elija una de las siguientes opciones para su Patrón de Sueño:",
                    options: [
                        { label: "🏋️ Cargar Archivo Device (.TCX)", value: "SLEEP_TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "SLEEP_MANUAL" }
                    ]
                }]);
                setCurrentStep('AWAITING_SLEEP_TCX_FILE');
            }
        }
    }, [messages, lifeStyle.activity, lifeStyle.circadian]);


    // Inicialización del mensaje de bienvenida (Compuerta de Ejercicio y NEAT)
    useEffect(() => {
        if (hasGreeted) {
            console.log("🔥 [Fase11] hasGreeted is true. Aborting initializer useEffect.");
            return;
        }

        console.log("🔥 [Fase11] useEffect triggered. currentStep:", currentStep, "pName:", pName, "age:", age);

        if (currentStep === 'correct_menu') {
            const hasActiveTcx = lifeStyle.activity?.source_type === 'TELEMETRY_TCX' && Boolean(lifeStyle.activity?.telemetry_metadata);
            const menuOptions = [
                { label: "✏️ Modificar ejercicio físico / .TCX", value: "MODIFY_EXERCISE" },
                ...(hasActiveTcx ? [{ label: "🗑️ Eliminar archivo .TCX y pasar a manual", value: "DELETE_TCX_EXERCISE" }] : []),
                { label: "✏️ Modificar actividad diaria (NEAT)", value: "MODIFY_NEAT" },
                { label: "✏️ Modificar horas y calidad de sueño", value: "MODIFY_SLEEP" },
                { label: "✏️ Modificar nivel de estrés", value: "MODIFY_STRESS" },
                { label: "🔄 Reiniciar toda la fase", value: "CLEAR_ALL" },
                { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
            ];
            const greetingMsg = {
                role: 'assistant',
                content: "De acuerdo. ¿Qué línea específica desea modificar en su perfil de actividad física, descanso y estrés?",
                options: menuOptions
            };
            setMessages(prev => {
                const lastAssistant = [...prev].reverse().find(m => m.role === 'assistant');
                if (lastAssistant?.content?.includes("¿Qué línea específica desea modificar en su perfil de actividad física")) return prev;
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
                : `He registrado y sellado el perfil de ${phaseSourceText} de **${pName}** de manera exitosa. Con este bloque asegurado en el expediente clínico de **${pName}**, procedemos a evaluar la actividad física diaria y el descanso de ${isFemalePatient ? 'la menor' : 'el menor'}.`;
            
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
                { label: "⌚ Cargar archivo de dispositivo (.TCX)", value: "TCX_LOAD" },
                { label: "📝 Declaración manual", value: "Sí" },
                { label: "❌ No realizo ejercicio", value: "No" }
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

                const isManualExercise = (lifeStyle.activity.source_type || "MANUAL") !== "TELEMETRY_TCX";
                const activeTelemetryMetadata = isManualExercise ? null : (lifeStyle.activity.telemetry_metadata || null);

                const normalizedLog = lifeStyle.activity.log.map(item => {
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
                });

                const weeklyMinutesResolved = (() => {
                    if (!lifeStyle.activity.has_scheduled_exercise) return 0;
                    if (!isManualExercise && activeTelemetryMetadata) {
                        if (Number(activeTelemetryMetadata.weekly_minutes) > 0) {
                            return Number(activeTelemetryMetadata.weekly_minutes);
                        }
                        if (Number(activeTelemetryMetadata.daily_minutes) > 0 && Number(activeTelemetryMetadata.weekly_days) > 0) {
                            return Math.round(Number(activeTelemetryMetadata.daily_minutes) * Number(activeTelemetryMetadata.weekly_days));
                        }
                    }
                    let sum = 0;
                    normalizedLog.forEach(entry => {
                        if (entry && typeof entry === 'object') {
                            const dur = Number(entry.duration || entry.durationMinutes || 0);
                            const freq = Number(entry.weekly_days || entry.frequency || 0);
                            if (Number(entry.weekly_minutes) > 0) {
                                sum += Number(entry.weekly_minutes);
                            } else if (freq > 0 && dur > 0) {
                                sum += Math.round(dur * freq);
                            }
                        }
                    });
                    return sum;
                })();

                const weeklyCaloriesResolved = (() => {
                    if (isManualExercise || !activeTelemetryMetadata) return 0;
                    if (Number(activeTelemetryMetadata.weekly_calories) > 0) {
                        return Math.round(Number(activeTelemetryMetadata.weekly_calories));
                    }
                    if (Number(activeTelemetryMetadata.daily_calories) > 0 && Number(activeTelemetryMetadata.weekly_days) > 0) {
                        return Math.round(Number(activeTelemetryMetadata.daily_calories) * Number(activeTelemetryMetadata.weekly_days));
                    }
                    return 0;
                })();

                const hasEvaluatedActivityOrNeat =
                    lifeStyle.activity.has_scheduled_exercise !== null && lifeStyle.activity.has_scheduled_exercise !== undefined ||
                    Boolean(lifeStyle.activity.neat_level);

                let derivedActivityLevel = prev.activity_level || null;
                let derivedPal = prev.profile?.factor_pal ?? prev.identificacion?.factor_pal ?? null;
                if (hasEvaluatedActivityOrNeat) {
                    const neatUpper = String(lifeStyle.activity.neat_level || '').toUpperCase();
                    let basePal = 1.2;
                    if (neatUpper === 'HEAVY') basePal = 1.725;
                    else if (neatUpper === 'MODERATE') basePal = 1.55;
                    else if (neatUpper === 'LIGHT') basePal = 1.375;

                    if (weeklyMinutesResolved >= 300 || weeklyCaloriesResolved >= 1800) {
                        derivedPal = Math.max(basePal, 1.725);
                        derivedActivityLevel = 'INTENSO';
                    } else if (weeklyMinutesResolved >= 150 || weeklyCaloriesResolved >= 900) {
                        derivedPal = Math.max(basePal, 1.55);
                        derivedActivityLevel = derivedPal >= 1.725 ? 'INTENSO' : 'MODERADO';
                    } else if (weeklyMinutesResolved >= 60 || lifeStyle.activity.has_scheduled_exercise === true) {
                        derivedPal = Math.max(basePal, 1.375);
                        derivedActivityLevel = derivedPal >= 1.55 ? 'MODERADO' : 'LIGERO';
                    } else {
                        derivedPal = basePal;
                        derivedActivityLevel =
                            basePal >= 1.725 ? 'INTENSO' :
                            basePal >= 1.55 ? 'MODERADO' :
                            basePal >= 1.375 ? 'LIGERO' : 'SEDENTARIO';
                    }
                }

                const mappedStressLegacy =
                    lifeStyle.stress.level === 'HIGH' ? 'alto' :
                    lifeStyle.stress.level === 'LOW' ? 'bajo' :
                    (lifeStyle.stress.level === 'MODERATE' ? 'moderado' : '');

                const mappedSleepQualityLegacy =
                    lifeStyle.circadian.quality === 'GOOD' ? 'Buena' :
                    lifeStyle.circadian.quality === 'POOR' ? 'Mala' :
                    (lifeStyle.circadian.quality ? 'Regular' : '');

                const nextLifestyleProfile = {
                    ...prev.lifestyle_profile,
                    activity: {
                        ...prev.lifestyle_profile?.activity,
                        has_scheduled_exercise: lifeStyle.activity.has_scheduled_exercise,
                        neat_level: lifeStyle.activity.neat_level,
                        preview_neat_pending: Boolean(lifeStyle.activity.preview_neat_pending),
                        source_type: isManualExercise ? "MANUAL" : "TELEMETRY_TCX",
                        telemetry_metadata: activeTelemetryMetadata,
                        weekly_minutes: weeklyMinutesResolved > 0 ? weeklyMinutesResolved : null,
                        weekly_calories: weeklyCaloriesResolved > 0 ? weeklyCaloriesResolved : null,
                        duration_history: lifeStyle.activity.duration_history || "",
                        log: normalizedLog
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

                const nextLegacyLifestyle = prev.lifestyle
                    ? {
                        ...prev.lifestyle,
                        activity: {
                            ...(prev.lifestyle.activity || {}),
                            has_scheduled_exercise: lifeStyle.activity.has_scheduled_exercise,
                            neat_level: lifeStyle.activity.neat_level,
                            source_type: isManualExercise ? "MANUAL" : "TELEMETRY_TCX",
                            telemetry_metadata: activeTelemetryMetadata,
                            weekly_minutes: weeklyMinutesResolved > 0 ? weeklyMinutesResolved : null,
                            weekly_calories: weeklyCaloriesResolved > 0 ? weeklyCaloriesResolved : null,
                            log: nextLifestyleProfile.activity.log
                        }
                    }
                    : prev.lifestyle;

                const nextAnnexes = isManualExercise
                    ? filterOrphanTelemetryAnnexes(prev.clinical_context?.annexes || [], true)
                    : (prev.clinical_context?.annexes || []);

                // Comparar para evitar ciclos infinitos de renderizado
                const legacyTelemetryDirty = isManualExercise && Boolean(prev.lifestyle?.activity?.telemetry_metadata);
                const annexesDirty = nextAnnexes.length !== (prev.clinical_context?.annexes || []).length;
                const stalePrematureStress = !lifeStyle.stress.level && (prev.habits?.stress === 'moderado' || prev.clinical_context?.habits?.stress === 'moderado');
                const palChanged = derivedActivityLevel && (prev.activity_level !== derivedActivityLevel || prev.profile?.factor_pal !== derivedPal);
                if (JSON.stringify(prev.lifestyle_profile) === JSON.stringify(nextLifestyleProfile) && !legacyTelemetryDirty && !annexesDirty && !stalePrematureStress && !palChanged) {
                    return prev;
                }

                return {
                    ...prev,
                    ...(derivedActivityLevel ? {
                        activity_level: derivedActivityLevel,
                        physical_activity: derivedActivityLevel
                    } : {}),
                    profile: {
                        ...(prev.profile || {}),
                        ...(derivedActivityLevel ? { activity_level: derivedActivityLevel } : {}),
                        ...(derivedPal !== null ? { factor_pal: derivedPal } : {})
                    },
                    identificacion: {
                        ...(prev.identificacion || {}),
                        ...(derivedPal !== null ? { factor_pal: derivedPal } : {})
                    },
                    ...(nextLegacyLifestyle ? { lifestyle: nextLegacyLifestyle } : {}),
                    lifestyle_profile: nextLifestyleProfile,
                    habits: {
                        ...prev.habits,
                        ...(derivedActivityLevel ? { activity_level: derivedActivityLevel } : {}),
                        sleep: {
                            hours: lifeStyle.circadian.sleepHours,
                            quality: mappedSleepQualityLegacy,
                            issue_type: lifeStyle.circadian.issue_type
                        },
                        stress: mappedStressLegacy,
                        stress_origin: lifeStyle.stress.origin
                    },
                    clinical_context: {
                        ...prev.clinical_context,
                        annexes: nextAnnexes,
                        ai_analysis: {
                            ...(prev.clinical_context?.ai_analysis || {}),
                            detected_tags: updatedTags
                        },
                        habits: {
                            ...prev.clinical_context?.habits,
                            sleep: {
                                hours: lifeStyle.circadian.sleepHours,
                                quality: mappedSleepQualityLegacy,
                                issue_type: lifeStyle.circadian.issue_type
                            },
                            stress: mappedStressLegacy,
                            stress_origin: lifeStyle.stress.origin
                        },
                        activity: {
                            ...prev.clinical_context?.activity,
                            exercise: {
                                has_scheduled_exercise: lifeStyle.activity.has_scheduled_exercise,
                                source_type: isManualExercise ? "MANUAL" : "TELEMETRY_TCX",
                                telemetry_metadata: activeTelemetryMetadata,
                                weekly_minutes: weeklyMinutesResolved > 0 ? weeklyMinutesResolved : null,
                                weekly_calories: weeklyCaloriesResolved > 0 ? weeklyCaloriesResolved : null,
                                log: normalizedLog,
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

    // Purga quirúrgica exclusiva del dominio de telemetría de ejercicio (.TCX/.GPX)
    // Preserva intactos sueño, estrés, NEAT y anexos clínicos reales (PDFs, fotos, Electret).
    const purgeExerciseTelemetry = (baseLife = lifeStyle, extraActivityPatch = {}) => {
        setTempTelemetry(null);
        const cleanedLife = {
            ...baseLife,
            activity: {
                ...baseLife.activity,
                source_type: "MANUAL",
                telemetry_metadata: null,
                ...extraActivityPatch
            }
        };
        setLifeStyle(cleanedLife);

        if (setPatientData) {
            setPatientData(prev => ({
                ...prev,
                ...(prev.lifestyle ? {
                    lifestyle: {
                        ...prev.lifestyle,
                        activity: {
                            ...(prev.lifestyle.activity || {}),
                            source_type: "MANUAL",
                            telemetry_metadata: null,
                            ...extraActivityPatch
                        }
                    }
                } : {}),
                lifestyle_profile: {
                    ...(prev.lifestyle_profile || {}),
                    activity: {
                        ...(prev.lifestyle_profile?.activity || {}),
                        source_type: "MANUAL",
                        telemetry_metadata: null,
                        ...extraActivityPatch
                    }
                },
                clinical_context: {
                    ...(prev.clinical_context || {}),
                    annexes: filterOrphanTelemetryAnnexes(prev.clinical_context?.annexes || [], true),
                    activity: {
                        ...(prev.clinical_context?.activity || {}),
                        exercise: {
                            ...(prev.clinical_context?.activity?.exercise || {}),
                            source_type: "MANUAL",
                            telemetry_metadata: null,
                            ...extraActivityPatch
                        }
                    }
                }
            }));
        }
        return cleanedLife;
    };

    // Helper para decidir si preguntar ciclo hormonal o mostrar síntesis
    const checkHormonalOrSummary = (state) => {
        setIsSingleLineEdit(false);
        buildAndShowSummary(state);
    };

    // Procesamiento de respuestas y flujo conversacional
    const handleSend = async (text, label = 'text') => {
        if (isProcessingInputRef.current) {
            console.warn("⚠️ [Fase11] Ignorando entrada duplicada recibida en ventana de reentrada (debounce).");
            return;
        }
        isProcessingInputRef.current = true;
        setTimeout(() => {
            isProcessingInputRef.current = false;
        }, 600);

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
                const rawResults = await Promise.all(files.map(f => readAndParseFile(f)));
                const results = [...rawResults].sort((a, b) => (a.startTimeMs || 0) - (b.startTimeMs || 0));
                console.log("🔥 [Fase11] Successfully parsed all files:", results);

                // Combinador Clínico Telemétrico Cronobiológico (ponderación exacta en segundos)
                let totalActivities = 0;
                let totalSecondsAll = 0;
                let totalCalories = 0;
                let totalDistance = 0;
                
                let hrWeightedSumSec = 0;
                let hrSecondsSum = 0;
                let maxHrAbsolute = 0;
                let detectedDeviceName = null;
                
                const uniqueDatesMap = new Map();
                const disciplineMap = new Map();

                results.forEach(res => {
                    totalActivities += (res.activitiesCount || 1);
                    const sec = Number(res.totalSeconds) > 0 ? Number(res.totalSeconds) : ((res.durationMinutes || 1) * 60);
                    totalSecondsAll += sec;
                    totalCalories += (res.calories || 0);
                    totalDistance += (res.distanceMeters || 0);

                    if (!detectedDeviceName && res.deviceName) {
                        detectedDeviceName = res.deviceName;
                    }
                    if (res.dateKey && !uniqueDatesMap.has(res.dateKey)) {
                        uniqueDatesMap.set(res.dateKey, res.dateDisplay || res.dateKey);
                    }

                    if (res.averageHeartRate > 0 && sec > 0) {
                        hrWeightedSumSec += res.averageHeartRate * sec;
                        hrSecondsSum += sec;
                    }
                    if (res.maximumHeartRate > maxHrAbsolute) {
                        maxHrAbsolute = res.maximumHeartRate;
                    }

                    const spName = res.sport || "Entrenamiento";
                    const existingDisc = disciplineMap.get(spName) || {
                        sport: spName,
                        blocksCount: 0,
                        totalSeconds: 0,
                        calories: 0,
                        distanceMeters: 0,
                        hrWeightedSumSec: 0,
                        hrSecondsSum: 0,
                        maximumHeartRate: 0
                    };
                    existingDisc.blocksCount += 1;
                    existingDisc.totalSeconds += sec;
                    existingDisc.calories += (res.calories || 0);
                    existingDisc.distanceMeters += (res.distanceMeters || 0);
                    if (res.averageHeartRate > 0 && sec > 0) {
                        existingDisc.hrWeightedSumSec += res.averageHeartRate * sec;
                        existingDisc.hrSecondsSum += sec;
                    }
                    if ((res.maximumHeartRate || 0) > existingDisc.maximumHeartRate) {
                        existingDisc.maximumHeartRate = res.maximumHeartRate;
                    }
                    disciplineMap.set(spName, existingDisc);
                });

                const totalMinutes = Math.max(1, Math.round(totalSecondsAll / 60));
                const finalAvgHr = hrSecondsSum > 0 ? Math.round(hrWeightedSumSec / hrSecondsSum) : 0;
                const uniqueDaysCount = uniqueDatesMap.size > 0 ? uniqueDatesMap.size : 1;
                const blocksCount = results.length;
                const datesDisplayList = Array.from(uniqueDatesMap.values());

                const disciplinesList = Array.from(disciplineMap.values())
                    .map(d => ({
                        sport: d.sport,
                        blocksCount: d.blocksCount,
                        totalSeconds: d.totalSeconds,
                        durationMinutesExact: Number((d.totalSeconds / 60).toFixed(1)),
                        durationMinutes: Math.max(1, Math.round(d.totalSeconds / 60)),
                        calories: Math.round(d.calories),
                        distanceMeters: Math.round(d.distanceMeters),
                        averageHeartRate: d.hrSecondsSum > 0 ? Math.round(d.hrWeightedSumSec / d.hrSecondsSum) : 0,
                        maximumHeartRate: d.maximumHeartRate
                    }))
                    .sort((a, b) => b.totalSeconds - a.totalSeconds);

                const primarySport = disciplinesList.length > 0 ? disciplinesList[0].sport : "Entrenamiento";
                const combinedDisciplinesTitle = disciplinesList.length > 1
                    ? disciplinesList.map(d => d.sport).join(" + ")
                    : primarySport;

                const dailyMinutes = Math.max(1, Math.round(totalMinutes / uniqueDaysCount));
                const dailyCalories = Math.round(totalCalories / uniqueDaysCount);
                const dailyDistanceMeters = Math.round(totalDistance / uniqueDaysCount);

                const consolidatedData = {
                    sport: combinedDisciplinesTitle,
                    primarySport,
                    deviceName: detectedDeviceName || "Dispositivo Wearable (.TCX)",
                    uniqueDaysCount,
                    blocksCount,
                    activitiesCount: uniqueDaysCount,
                    totalSeconds: totalSecondsAll,
                    durationMinutes: totalMinutes,
                    dailyMinutes,
                    calories: Math.round(totalCalories),
                    dailyCalories,
                    distanceMeters: Math.round(totalDistance),
                    dailyDistanceMeters,
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
                            sleepHours: sleepHoursCalculated,
                            quality: sleepQualityCalculated
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
                    const existingExSessions = Array.isArray(lifeStyle.activity?.telemetry_metadata?.sessions)
                        ? lifeStyle.activity.telemetry_metadata.sessions
                        : [];
                    const existingStartIsos = new Set(existingExSessions.map(s => s?.startTimeIso).filter(Boolean));
                    const isDuplicateExerciseFile = existingStartIsos.size > 0 && results.some(r => r.startTimeIso && existingStartIsos.has(r.startTimeIso));

                    if (isDuplicateExerciseFile || lifeStyle.activity?.source_type === 'TELEMETRY_TCX') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Los archivos \`.tcx\` seleccionados corresponden a sesiones de **ejercicio programado (EAT)** que ya están integradas en su expediente. Para evitar duplicar esas **${Math.round(totalCalories)} kcal** en su cálculo metabólico, por favor **seleccione su nivel de movimiento ocupacional habitual fuera del ejercicio (NEAT)**:`,
                            inputType: 'strict_select',
                            options: adultNeatOptions
                        }]);
                        setCurrentStep('NEAT');
                        setIsAnalyzing(false);
                        return;
                    }

                    setTempNeatTelemetry(consolidatedData);

                    let parsedNeatLevel = "SEDENTARY";
                    if (totalCalories >= 400 || totalMinutes >= 90) parsedNeatLevel = "HEAVY";
                    else if (totalCalories >= 200 || totalMinutes >= 45) parsedNeatLevel = "MODERATE";
                    else if (totalCalories >= 80 || totalMinutes >= 20) parsedNeatLevel = "LIGHT";

                    const neatLabelMap = {
                        HEAVY: "Intenso (Actividad física ocupacional continua de alta demanda)",
                        MODERATE: "Moderado (Movimiento activo constante en jornada diaria)",
                        LIGHT: "Ligero (Caminatas breves o actividad de pie intermitente)",
                        SEDENTARY: sedentaryAdultLabel
                    };

                    // Sincronizar vista previa SSoTT inmediata en NEAT para TabLogistics
                    setLifeStyle(prev => ({
                        ...prev,
                        activity: {
                            ...prev.activity,
                            neat_level: parsedNeatLevel,
                            preview_neat_pending: true
                        }
                    }));

                    const summaryMetabolic = `
---
### 📊 Ingesta Telemétrica de Actividad Diaria (NEAT)
*   🔋 **Gasto Calórico Registrado:** ${Math.round(totalCalories)} kcal
*   ⏱️ **Tiempo Activo Registrado:** ${totalMinutes} min
*   📈 **Nivel Calculado de NEAT:** ${neatLabelMap[parsedNeatLevel]}`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Se ha analizado el registro de movimiento diario de su dispositivo portátil.\n${summaryMetabolic}\n\n¿Confirma que este nivel clasifica adecuadamente su movimiento diario habitual?`,
                        options: [
                            { label: "✅ Sí, es correcto", value: `CONFIRM_NEAT_TELEMETRY_${parsedNeatLevel}` },
                            { label: "❌ No, prefiero declarar manualmente", value: "CORRECT_NEAT_TELEMETRY" }
                        ]
                    }]);

                    setCurrentStep('NEAT_TELEMETRY_CONFIRM');
                    setIsAnalyzing(false);
                    return;
                }

                const inferredWeeklyDays = uniqueDaysCount >= 3 ? Math.min(7, uniqueDaysCount) : null;
                const telemetryMetadata = {
                    device_name: detectedDeviceName || "Dispositivo Wearable (.TCX)",
                    preview_pending_confirm: true,
                    unique_days_count: uniqueDaysCount,
                    total_blocks_count: blocksCount,
                    dates_detected: Array.from(uniqueDatesMap.keys()),
                    dates_display: datesDisplayList,
                    weekly_days: inferredWeeklyDays,
                    total_parsed_sessions: uniqueDaysCount,
                    daily_minutes: dailyMinutes,
                    daily_calories: dailyCalories,
                    daily_distance_meters: dailyDistanceMeters,
                    weekly_minutes: inferredWeeklyDays ? Math.round(dailyMinutes * inferredWeeklyDays) : null,
                    weekly_calories: inferredWeeklyDays ? Math.round(dailyCalories * inferredWeeklyDays) : null,
                    total_calories: Math.round(totalCalories),
                    total_minutes: totalMinutes,
                    total_seconds: totalSecondsAll,
                    total_distance: Math.round(totalDistance),
                    average_hr: finalAvgHr,
                    max_hr: maxHrAbsolute,
                    disciplines: disciplinesList,
                    sessions: results.map(r => ({
                        sport: r.sport,
                        rawSport: r.rawSport || null,
                        note: r.note || null,
                        deviceName: r.deviceName || detectedDeviceName || null,
                        dateKey: r.dateKey || null,
                        dateDisplay: r.dateDisplay || null,
                        startTimeIso: r.startTimeIso || null,
                        totalSeconds: r.totalSeconds,
                        durationMinutesExact: r.durationMinutesExact,
                        durationMinutes: r.durationMinutes,
                        calories: r.calories,
                        distanceMeters: r.distanceMeters,
                        averageHeartRate: r.averageHeartRate,
                        maximumHeartRate: r.maximumHeartRate
                    }))
                };

                const previewIntensity = finalAvgHr > 140 ? "VIGOROUS" : (finalAvgHr > 110 ? "MODERATE" : "LOW");
                const previewLogItem = {
                    type: combinedDisciplinesTitle,
                    frequency: inferredWeeklyDays || uniqueDaysCount,
                    weekly_days: inferredWeeklyDays,
                    duration: dailyMinutes,
                    daily_minutes: dailyMinutes,
                    weekly_minutes: inferredWeeklyDays ? Math.round(dailyMinutes * inferredWeeklyDays) : null,
                    intensity: previewIntensity,
                    heart_rate_avg: finalAvgHr,
                    heart_rate_max: maxHrAbsolute,
                    distance_meters: Math.round(totalDistance),
                    calories_device: dailyCalories,
                    weekly_calories: inferredWeeklyDays ? Math.round(dailyCalories * inferredWeeklyDays) : null
                };

                setTempTelemetry({ ...consolidatedData, telemetryMetadata });

                // Sincronizar vista previa SSoTT inmediata en el Espejo Clínico (marcada como preview_pending_confirm)
                setLifeStyle(prev => ({
                    ...prev,
                    activity: {
                        ...prev.activity,
                        has_scheduled_exercise: true,
                        source_type: "TELEMETRY_TCX",
                        telemetry_metadata: telemetryMetadata,
                        log: [previewLogItem]
                    }
                }));

                const groupingText = uniqueDaysCount === 1
                    ? (blocksCount > 1
                        ? `1 jornada diaria continua (${blocksCount} bloques${datesDisplayList[0] ? ` • ${datesDisplayList[0]}` : ''})`
                        : `1 sesión registrada${datesDisplayList[0] ? ` (${datesDisplayList[0]})` : ''}`)
                    : `${uniqueDaysCount} jornadas registradas (${blocksCount} bloques)`;

                const disciplinesSummaryLines = disciplinesList.map(d => {
                    const distTag = d.distanceMeters > 0
                        ? ` • ${d.distanceMeters >= 1000 ? `${(Math.round(d.distanceMeters / 10) / 100).toFixed(2)} km` : `${d.distanceMeters} m`}`
                        : '';
                    return `  • **${d.sport}**: ${d.durationMinutesExact} min (${d.calories} kcal${distTag} • FC ${d.averageHeartRate || '--'}/${d.maximumHeartRate || '--'} BPM)`;
                }).join("\n");

                const totalDistanceLine = totalDistance > 0
                    ? `\n- 📏 **Distancia Acumulada:** ${totalDistance >= 1000 ? `${(Math.round(totalDistance / 10) / 100).toFixed(2)} km` : `${Math.round(totalDistance)} m`}`
                    : '';

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `He analizado los registros telemétricos de su dispositivo:\n\n- ⌚ **Dispositivo:** ${telemetryMetadata.device_name}\n- 📅 **Agrupación cronobiológica:** ${groupingText}\n- 🏋️ **Disciplinas detectadas:**\n${disciplinesSummaryLines}\n- 🔥 **Gasto Calórico (${uniqueDaysCount === 1 ? 'por jornada' : 'total'}):** ${Math.round(totalCalories)} kcal\n- ⏱️ **Duración Activa (${uniqueDaysCount === 1 ? 'por jornada' : 'total'}):** ${totalMinutes} min${totalDistanceLine}\n- ❤️ **Respuesta Cardíaca:** FC Promedio ${finalAvgHr > 0 ? `${finalAvgHr} BPM` : 'N/A'}${maxHrAbsolute > 0 ? ` • FC Máxima ${maxHrAbsolute} BPM` : ''}\n\nPara dar cumplimiento a la NOM-004, ¿confirma que esta información describe fielmente su esfuerzo físico?`,
                    options: [
                        { label: "✅ Sí, es correcto", value: "CONFIRM_TELEMETRY" },
                        { label: "❌ No, quiero corregir algo", value: "CORRECT_TELEMETRY" }
                    ]
                }]);

                setCurrentStep('TELEMETRY_CONFIRM');
                setIsAnalyzing(false);
            } catch (err) {
                console.error("❌ [Fase11] Error en pipeline de ingesta:", err);
                const retryStep = currentStep === 'AWAITING_NEAT_TCX_FILE' 
                    ? 'NEAT_GATE' 
                    : (currentStep === 'AWAITING_SLEEP_TCX_FILE' ? 'SLEEP_GATE' : 'ACTIVITY_GATE');
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `⚠️ **Falla en el Pipeline de Ingesta:**\n\n${err.message}\n\nPor favor, asegúrese de adjuntar únicamente archivos \`.tcx\` de wearables válidos o realice una declaración manual.`,
                    options: currentStep === 'AWAITING_NEAT_TCX_FILE' ? [
                        { label: "🏋️ Reintentar cargar archivos", value: "NEAT_TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "NEAT_MANUAL" }
                    ] : (currentStep === 'AWAITING_SLEEP_TCX_FILE' ? [
                        { label: "🏋️ Reintentar cargar archivos", value: "SLEEP_TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "SLEEP_MANUAL" }
                    ] : [
                        { label: "🏋️ Reintentar cargar archivos", value: "TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "Sí" }
                    ])
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
                        { label: "📝 Declaración Manual", value: "NEAT_MANUAL" }
                    ]
                }]);
            } else if (currentStep === 'AWAITING_SLEEP_TCX_FILE') {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Para continuar, elija una de las siguientes opciones para su Patrón de Sueño:",
                    options: [
                        { label: "🏋️ Cargar Archivo Device (.TCX)", value: "SLEEP_TCX_LOAD" },
                        { label: "📝 Declaración Manual", value: "SLEEP_MANUAL" }
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
        if (textToProcess === "SLEEP_TCX_LOAD") userLabel = "🏋️ Cargar Archivo Device (.TCX)";
        if (textToProcess === "SLEEP_MANUAL") userLabel = "📝 Declaración Manual";
        if (textToProcess.startsWith("CONFIRM_NEAT_TELEMETRY_")) userLabel = "Sí, es correcto";
        if (textToProcess === "CORRECT_NEAT_TELEMETRY") userLabel = "No, prefiero declarar manualmente";
        if (textToProcess.startsWith("CONFIRM_SLEEP_TELEMETRY")) userLabel = "Sí, es correcto";
        if (textToProcess === "CORRECT_SLEEP_TELEMETRY") userLabel = "No, prefiero declarar manualmente";
        if (currentStep === 'NEAT' || currentStep === 'NEAT_MANUAL_SELECT') {
            if (textToProcess === "SEDENTARY") userLabel = isLactante ? "Tranquilo / Acostado la mayor parte del tiempo" : (isPreescolar || isEscolar || isMinor ? "Sedentario (Juego tranquilo / Sentado la mayor parte del tiempo)" : sedentaryAdultLabel);
            if (textToProcess === "LIGHT") userLabel = isLactante ? "Gateo inicial / Juego sentado" : (isPreescolar || isEscolar || isMinor ? "Ligero (Caminata tranquila / Juego suave en casa o escuela)" : "Ligero (Caminatas breves o actividad de pie intermitente)");
            if (textToProcess === "MODERATE") userLabel = isLactante ? "Gateo activo / Ya camina con apoyo" : (isPreescolar || isEscolar || isMinor ? "Moderado (Juego activo / Recreo / Corre en parque o jardín)" : "Moderado (Movimiento activo constante en jornada diaria)");
            if (textToProcess === "HEAVY") userLabel = isLactante ? "Explora activamente / Corre / Salta" : (isPreescolar || isEscolar || isMinor ? "Intenso / Muy Activo (Juego dinámico constante / Corre y salta todo el día)" : "Intenso (Actividad física ocupacional continua de alta demanda)");
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
            if (textToProcess === "CONFIRM_TELEMETRY") userLabel = "✅ Sí, es correcto";
            if (textToProcess === "CORRECT_TELEMETRY") userLabel = "❌ No, quiero corregir algo";
        } else if (currentStep === 'TELEMETRY_WEEKLY_DAYS') {
            const matchedDays = String(textToProcess || "").match(/\d+/)?.[0];
            if (matchedDays) {
                userLabel = `${matchedDays} ${matchedDays === "1" ? "día por semana" : "días por semana"}`;
            }
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

            // Interceptor blindado de corrección en Ejercicio: cualquier variante negativa regresa SIEMPRE a ACTIVITY_GATE limpio (Sin evaluar)
            const isExerciseCorrectionSignal =
                textToProcess === "CORRECT_TELEMETRY" ||
                textToProcess === "NO_CORRECT" ||
                (
                    ['ACTIVITY_GATE', 'AWAITING_TCX_FILE', 'TELEMETRY_CONFIRM', 'TELEMETRY_WEEKLY_DAYS'].includes(currentStep) &&
                    (lower.includes("corregir") || lower.includes("no, quiero"))
                );

            if (isExerciseCorrectionSignal) {
                purgeExerciseTelemetry(lifeStyle, { has_scheduled_exercise: null, log: [] });
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Entendido. Se ha restablecido el registro de ejercicio programado. ¿Cómo desea registrar su actividad física?",
                    options: isMinor
                        ? [
                            { label: "✅ Sí, realiza", value: "Sí" },
                            { label: "❌ No realiza", value: "No" }
                        ]
                        : [
                            { label: "⌚ Cargar archivo de dispositivo (.TCX)", value: "TCX_LOAD" },
                            { label: "📝 Declaración manual", value: "Sí" },
                            { label: "❌ No realizo ejercicio", value: "No" }
                        ]
                }]);
                setCurrentStep('ACTIVITY_GATE');
                setIsAnalyzing(false);
                return;
            }

            const effectiveStep = (textToProcess === "CONFIRM_TELEMETRY" && currentStep !== 'TELEMETRY_CONFIRM')
                ? 'TELEMETRY_CONFIRM'
                : currentStep;

            switch (effectiveStep) {
                case 'correct_menu': {
                    const lowerText = textToProcess.toLowerCase();
                    if (textToProcess === "MODIFY_EXERCISE" || lowerText.includes("ejercicio")) {
                        setIsSingleLineEdit(true);
                        const exOptions = isMinor
                            ? [
                                { label: "✅ Sí, realiza", value: "Sí" },
                                { label: "❌ No realiza", value: "No" }
                            ]
                            : [
                                { label: "🏋️ Cargar Archivo Device (.TCX)", value: "TCX_LOAD" },
                                { label: "📝 Declaración Manual", value: "Sí" },
                                { label: "❌ No realizo", value: "No" }
                            ];
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: isMinor
                                ? `Actualicemos el registro de actividad física de **${pName}**. ¿Realiza ejercicio físico programado?`
                                : "Actualicemos únicamente su actividad física. ¿Cómo desea registrarla?",
                            options: exOptions
                        }]);
                        setCurrentStep('ACTIVITY_GATE');
                    } else if (textToProcess === "DELETE_TCX_EXERCISE") {
                        const cleaned = purgeExerciseTelemetry(lifeStyle, { has_scheduled_exercise: false, log: [] });
                        setIsSingleLineEdit(true);
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Archivo `.TCX` eliminado del expediente. ¿Desea declarar ejercicio físico de forma manual o registrar que no realiza ejercicio?",
                            options: [
                                { label: "📝 Declarar Actividad Manualmente", value: "Sí" },
                                { label: "❌ No realizo ejercicio", value: "No" }
                            ]
                        }]);
                        setCurrentStep('ACTIVITY_GATE');
                        void cleaned;
                    } else if (textToProcess === "MODIFY_NEAT" || lowerText.includes("neat") || lowerText.includes("actividad diaria")) {
                        setIsSingleLineEdit(true);
                        askNeatQuestion();
                    } else if (textToProcess === "MODIFY_SLEEP" || lowerText.includes("sueño") || lowerText.includes("descanso")) {
                        setIsSingleLineEdit(true);
                        triggerManualSleepQuestions(lifeStyle);
                    } else if (textToProcess === "MODIFY_STRESS" || lowerText.includes("estrés") || lowerText.includes("estres")) {
                        setIsSingleLineEdit(true);
                        askStressQuestion(lifeStyle);
                    } else if (textToProcess === "CLEAR_ALL" || lowerText.includes("reiniciar")) {
                        setIsSingleLineEdit(false);
                        const resetLife = {
                            environment: { altitude: initialAltitude, hypoxiaRisk: initialAltitude > 2000, city: initialCity },
                            circadian: { sleepHours: 0, quality: "", issue_type: null },
                            hormonal: { cyclePhase: "N/A", lastPeriod: "" },
                            stress: { level: "", origin: null, cortisol_management_needed: false },
                            activity: { has_scheduled_exercise: null, neat_level: null, source_type: "MANUAL", telemetry_metadata: null, log: [], duration_history: "" }
                        };
                        purgeExerciseTelemetry(resetLife, { has_scheduled_exercise: null, neat_level: null, log: [], duration_history: "" });
                        
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
                                    { label: "🏋️ Cargar Archivo Device (.TCX)", value: "TCX_LOAD" },
                                    { label: "📝 Declaración Manual", value: "Sí" },
                                    { label: "❌ No realizo", value: "No" }
                                ]
                        }]);
                        setCurrentStep('ACTIVITY_GATE');
                    } else if (textToProcess === "RETURN_SUMMARY") {
                        setIsSingleLineEdit(false);
                        buildAndShowSummary(lifeStyle);
                    } else {
                        setIsSingleLineEdit(false);
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

                    const isExplicitYes = lower === 'sí' || lower === 'si' || lower.includes('declaración manual') || lower.includes('declaracion manual') || lower.includes('sí, realiza');
                    const isExplicitNo = lower === 'no' || lower.includes('no realizo') || lower.includes('no realiza');

                    if (!isExplicitYes && !isExplicitNo) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, seleccione una opción válida para continuar con su registro de actividad física:",
                            options: isMinor
                                ? [
                                    { label: "✅ Sí, realiza", value: "Sí" },
                                    { label: "❌ No realiza", value: "No" }
                                ]
                                : [
                                    { label: "⌚ Cargar archivo de dispositivo (.TCX)", value: "TCX_LOAD" },
                                    { label: "📝 Declaración manual", value: "Sí" },
                                    { label: "❌ No realizo ejercicio", value: "No" }
                                ]
                        }]);
                        break;
                    }

                    const hasExercise = isExplicitYes;
                    const updatedLife = purgeExerciseTelemetry(lifeStyle, {
                        has_scheduled_exercise: hasExercise,
                        log: [],
                        ...(hasExercise ? {} : { duration_history: "" })
                    });

                    if (hasExercise) {
                        const actMsg = isLactante
                            ? `Excelente. ¿Qué tipo de juego activo o actividades de estimulación realiza **${pName}**? (Ej. Estimulación temprana, gateo guiado, natación para bebés)`
                            : (isMinor
                                ? `Excelente. ¿Qué actividad, deporte o disciplina física practica **${pName}**? (Ej. Correr, Natación, Gimnasio)`
                                : `Excelente. ¿Qué actividad, deporte o disciplina física practica? (Ej. Correr, Natación, Gimnasio)`);
                        setMessages(prev => [...prev, { role: 'assistant', content: actMsg }]);
                        setCurrentStep('ACTIVITY_TYPE');
                    } else if (isSingleLineEdit && updatedLife.activity.neat_level) {
                        setIsSingleLineEdit(false);
                        buildAndShowSummary(updatedLife);
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
                    const isExplicitYes = lower === 'sí' || lower === 'si' || lower.includes('manual');
                    const isExplicitNo = lower === 'no' || lower.includes('no realizo');
                    if (!isExplicitYes && !isExplicitNo) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, utilice el botón de adjuntar (clip 📎) para cargar sus archivos `.tcx` o elija una opción:",
                            options: [
                                { label: "📝 Declaración manual", value: "Sí" },
                                { label: "❌ No realizo ejercicio", value: "No" }
                            ]
                        }]);
                        break;
                    }
                    const hasExercise = isExplicitYes;
                    const updatedLife = purgeExerciseTelemetry(lifeStyle, {
                        has_scheduled_exercise: hasExercise,
                        log: [],
                        ...(hasExercise ? {} : { duration_history: "" })
                    });
                    if (hasExercise) {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Excelente. ¿Qué actividad practica? (Ej. Correr, Natación, Gimnasio)` }]);
                        setCurrentStep('ACTIVITY_TYPE');
                    } else if (isSingleLineEdit && updatedLife.activity.neat_level) {
                        setIsSingleLineEdit(false);
                        buildAndShowSummary(updatedLife);
                    } else {
                        askNeatQuestion();
                    }
                    break;
                }

                case 'TELEMETRY_CONFIRM': {
                    if (textToProcess === "CONFIRM_TELEMETRY") {
                        const baseTelemetry = tempTelemetry || {};
                        const rawMeta = baseTelemetry.telemetryMetadata || lifeStyle.activity?.telemetry_metadata || {};
                        const uniqueDays = Number(rawMeta.unique_days_count) > 0 ? Number(rawMeta.unique_days_count) : 1;
                        const dailyMin = Number(rawMeta.daily_minutes || baseTelemetry.dailyMinutes || baseTelemetry.durationMinutes || 0);
                        const dailyCal = Math.round(Number(rawMeta.daily_calories || baseTelemetry.dailyCalories || baseTelemetry.calories || 0));
                        const avgHrVal = Number(rawMeta.average_hr || baseTelemetry.averageHeartRate || 0);
                        const maxHrVal = Number(rawMeta.max_hr || baseTelemetry.maximumHeartRate || 0);
                        const totalDistVal = Math.round(Number(rawMeta.total_distance || baseTelemetry.distanceMeters || 0));
                        const existingWeeklyDays = Number(rawMeta.weekly_days) > 0 ? Number(rawMeta.weekly_days) : (uniqueDays >= 3 ? Math.min(7, uniqueDays) : null);

                        const intensityMapeada = avgHrVal > 140 ? "VIGOROUS" : (avgHrVal > 110 ? "MODERATE" : "LOW");
                        const confirmedMetadata = {
                            device_name: rawMeta.device_name || baseTelemetry.deviceName || "Dispositivo Wearable (.TCX)",
                            preview_pending_confirm: false,
                            unique_days_count: uniqueDays,
                            total_blocks_count: Number(rawMeta.total_blocks_count) > 0 ? Number(rawMeta.total_blocks_count) : (Array.isArray(rawMeta.sessions) ? rawMeta.sessions.length : 1),
                            dates_detected: rawMeta.dates_detected || [],
                            dates_display: rawMeta.dates_display || [],
                            weekly_days: existingWeeklyDays,
                            total_parsed_sessions: uniqueDays,
                            daily_minutes: dailyMin,
                            daily_calories: dailyCal,
                            daily_distance_meters: Number(rawMeta.daily_distance_meters || totalDistVal || 0),
                            weekly_minutes: existingWeeklyDays ? Math.round(dailyMin * existingWeeklyDays) : null,
                            weekly_calories: existingWeeklyDays ? Math.round(dailyCal * existingWeeklyDays) : null,
                            total_calories: Number(rawMeta.total_calories || dailyCal || 0),
                            total_minutes: Number(rawMeta.total_minutes || dailyMin || 0),
                            total_seconds: Number(rawMeta.total_seconds || (dailyMin * 60) || 0),
                            total_distance: totalDistVal,
                            average_hr: avgHrVal,
                            max_hr: maxHrVal,
                            disciplines: Array.isArray(rawMeta.disciplines) ? rawMeta.disciplines : [],
                            sessions: Array.isArray(rawMeta.sessions) ? rawMeta.sessions : []
                        };

                        const newLogItem = {
                            type: baseTelemetry.sport || "Entrenamiento Multicomponente",
                            frequency: existingWeeklyDays || uniqueDays,
                            weekly_days: existingWeeklyDays,
                            duration: dailyMin,
                            daily_minutes: dailyMin,
                            weekly_minutes: existingWeeklyDays ? Math.round(dailyMin * existingWeeklyDays) : null,
                            intensity: intensityMapeada,
                            heart_rate_avg: avgHrVal,
                            heart_rate_max: maxHrVal,
                            distance_meters: totalDistVal,
                            calories_device: dailyCal,
                            weekly_calories: existingWeeklyDays ? Math.round(dailyCal * existingWeeklyDays) : null
                        };

                        const updatedLife = {
                            ...lifeStyle,
                            activity: {
                                ...lifeStyle.activity,
                                has_scheduled_exercise: true,
                                source_type: "TELEMETRY_TCX",
                                telemetry_metadata: confirmedMetadata,
                                log: [newLogItem]
                            }
                        };
                        setLifeStyle(updatedLife);

                        // Si los archivos corresponden a < 3 jornadas distintas, solicitar frecuencia semanal real para TDEE exacto
                        if (!existingWeeklyDays) {
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: `Métricas telemétricas validadas (**${confirmedMetadata.device_name}**). Dado que los archivos cargados corresponden a **${uniqueDays === 1 ? '1 jornada diaria' : `${uniqueDays} jornadas`}** (**${dailyMin} min/día** • **${dailyCal} kcal/día**), por favor **seleccione cuántos días por semana realiza habitualmente esta rutina** para calibrar con exactitud su Gasto Energético Total (**TDEE**):`,
                                inputType: 'strict_select',
                                options: [
                                    { label: "7 días por semana (Todos los días)", value: "7" },
                                    { label: "6 días por semana", value: "6" },
                                    { label: "5 días por semana", value: "5" },
                                    { label: "4 días por semana", value: "4" },
                                    { label: "3 días por semana", value: "3" },
                                    { label: "2 días por semana", value: "2" },
                                    { label: "1 día por semana", value: "1" }
                                ]
                            }]);
                            setCurrentStep('TELEMETRY_WEEKLY_DAYS');
                            break;
                        }
                        
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Métricas telemétricas integradas exitosamente a su expediente clínico."
                        }]);

                        if (isSingleLineEdit && updatedLife.activity.neat_level) {
                            setIsSingleLineEdit(false);
                            setTimeout(() => {
                                buildAndShowSummary(updatedLife);
                            }, 400);
                        } else {
                            setTimeout(() => {
                                askNeatQuestion(updatedLife);
                            }, 500);
                        }
                    } else if (textToProcess === "CORRECT_TELEMETRY") {
                        purgeExerciseTelemetry(lifeStyle, { has_scheduled_exercise: null, log: [] });
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Se ha descartado la vista previa telemétrica. ¿Cómo desea proceder con su actividad física?",
                            options: [
                                { label: "🏋️ Reintentar Cargar Archivo .TCX", value: "TCX_LOAD" },
                                { label: "📝 Declarar Actividad Manualmente", value: "Sí" },
                                { label: "❌ No realizo ejercicio", value: "No" }
                            ]
                        }]);
                        setCurrentStep('ACTIVITY_GATE');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir." }]);
                    }
                    break;
                }

                case 'TELEMETRY_WEEKLY_DAYS': {
                    const days = parseInt(String(textToProcess || "").match(/\d+/)?.[0] || "", 10);
                    if (isNaN(days) || days < 1 || days > 7) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, seleccione un número válido de días por semana (del 1 al 7):",
                            inputType: 'strict_select',
                            options: [
                                { label: "7 días por semana (Todos los días)", value: "7" },
                                { label: "6 días por semana", value: "6" },
                                { label: "5 días por semana", value: "5" },
                                { label: "4 días por semana", value: "4" },
                                { label: "3 días por semana", value: "3" },
                                { label: "2 días por semana", value: "2" },
                                { label: "1 día por semana", value: "1" }
                            ]
                        }]);
                        break;
                    }

                    const currentMeta = lifeStyle.activity?.telemetry_metadata || tempTelemetry?.telemetryMetadata || {};
                    const dailyMin = Number(currentMeta.daily_minutes || currentMeta.total_minutes || 0);
                    const dailyCal = Math.round(Number(currentMeta.daily_calories || currentMeta.total_calories || 0));
                    const weeklyMin = Math.round(dailyMin * days);
                    const weeklyCal = Math.round(dailyCal * days);

                    const updatedMetadata = {
                        ...currentMeta,
                        preview_pending_confirm: false,
                        weekly_days: days,
                        weekly_minutes: weeklyMin,
                        weekly_calories: weeklyCal
                    };

                    const updatedLog = (lifeStyle.activity?.log || []).map((entry, idx) => {
                        if (idx === 0 && entry && typeof entry === 'object') {
                            return {
                                ...entry,
                                frequency: days,
                                weekly_days: days,
                                duration: dailyMin,
                                daily_minutes: dailyMin,
                                weekly_minutes: weeklyMin,
                                calories_device: dailyCal,
                                weekly_calories: weeklyCal
                            };
                        }
                        return entry;
                    });

                    const updatedLife = {
                        ...lifeStyle,
                        activity: {
                            ...lifeStyle.activity,
                            has_scheduled_exercise: true,
                            source_type: "TELEMETRY_TCX",
                            telemetry_metadata: updatedMetadata,
                            log: updatedLog
                        }
                    };
                    setLifeStyle(updatedLife);

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Frecuencia semanal registrada (**${days} ${days === 1 ? 'día/semana' : 'días/semana'}** → **${weeklyMin} min/semana** • **${weeklyCal} kcal/semana**). Métricas telemétricas selladas en su expediente clínico.`
                    }]);

                    if (isSingleLineEdit && updatedLife.activity.neat_level) {
                        setIsSingleLineEdit(false);
                        setTimeout(() => {
                            buildAndShowSummary(updatedLife);
                        }, 400);
                    } else {
                        setTimeout(() => {
                            askNeatQuestion(updatedLife);
                        }, 500);
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
                    if (isSingleLineEdit && updatedLife.activity.neat_level) {
                        setIsSingleLineEdit(false);
                        buildAndShowSummary(updatedLife);
                    } else {
                        askNeatQuestion();
                    }
                    break;
                }

                // --- 6. COMPUERTA BINARIA RESTRINGIDA NEAT (Q34e_gate) ---
                case 'NEAT_GATE': {
                    if (textToProcess === "NEAT_TCX_LOAD" || lower.includes("tcx") || lower.includes("archivo")) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Por favor, **haga clic en el botón de adjuntar (clip 📎) en la parte inferior** de la pantalla y seleccione su archivo de actividad diaria general `.tcx`."
                        }]);
                        setCurrentStep('AWAITING_NEAT_TCX_FILE');
                    } else {
                        const neatMsg = `Independientemente del ejercicio programado, **¿cómo describiría su nivel de movimiento ocupacional y cotidiano habitual (NEAT)?**`;
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: neatMsg,
                            inputType: 'strict_select',
                            options: adultNeatOptions
                        }]);
                        setCurrentStep('NEAT_MANUAL_SELECT');
                    }
                    break;
                }

                case 'AWAITING_NEAT_TCX_FILE': {
                    if (textToProcess === "NEAT_TCX_LOAD") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, seleccione el archivo `.tcx` de actividad diaria habitual utilizando el botón de clip 📎."
                        }]);
                    } else if (textToProcess === "NEAT_MANUAL" || lower.includes("manual")) {
                        const neatMsg = `Independientemente del ejercicio programado, **¿cómo describiría su nivel de movimiento ocupacional y cotidiano habitual (NEAT)?**`;
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: neatMsg,
                            inputType: 'strict_select',
                            options: adultNeatOptions
                        }]);
                        setCurrentStep('NEAT_MANUAL_SELECT');
                    }
                    break;
                }

                case 'NEAT_TELEMETRY_CONFIRM': {
                    if (textToProcess.startsWith("CONFIRM_NEAT_TELEMETRY_")) {
                        const level = textToProcess.replace("CONFIRM_NEAT_TELEMETRY_", "");
                        const updatedLife = { 
                            ...lifeStyle, 
                            activity: { ...lifeStyle.activity, neat_level: level, preview_neat_pending: false } 
                        };
                        setLifeStyle(updatedLife);
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Métricas de movimiento diario integradas exitosamente a su expediente clínico."
                        }]);
                        if (isSingleLineEdit && updatedLife.circadian.sleepHours > 0) {
                            setIsSingleLineEdit(false);
                            setTimeout(() => {
                                buildAndShowSummary(updatedLife);
                            }, 400);
                        } else {
                            setTimeout(() => {
                                askSleepQuestion(updatedLife);
                            }, 500);
                        }
                    } else if (textToProcess === "CORRECT_NEAT_TELEMETRY") {
                        setLifeStyle(prev => ({
                            ...prev,
                            activity: { ...prev.activity, neat_level: null, preview_neat_pending: false }
                        }));
                        const neatMsg = `Entendido. Por favor **seleccione su nivel de movimiento ocupacional y cotidiano habitual (NEAT)**:`;
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: neatMsg,
                            inputType: 'strict_select',
                            options: adultNeatOptions
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
                            inputType: 'strict_select',
                            options: isLactante
                                ? [
                                    { label: 'Tranquilo / Acostado la mayor parte del tiempo', value: 'SEDENTARY' },
                                    { label: 'Gateo inicial / Juego sentado', value: 'LIGHT' },
                                    { label: 'Gateo activo / Ya camina con apoyo', value: 'MODERATE' },
                                    { label: 'Explora activamente / Corre / Salta', value: 'HEAVY' }
                                ]
                                : (isPreescolar || isEscolar || isMinor
                                    ? [
                                        { label: 'Sedentario (Juego tranquilo / Sentado la mayor parte del tiempo)', value: 'SEDENTARY' },
                                        { label: 'Ligero (Caminata tranquila / Juego suave en casa o escuela)', value: 'LIGHT' },
                                        { label: 'Moderado (Juego activo / Recreo / Corre en parque o jardín)', value: 'MODERATE' },
                                        { label: 'Intenso / Muy Activo (Juego dinámico constante / Corre y salta todo el día)', value: 'HEAVY' }
                                    ]
                                    : adultNeatOptions)
                        }]);
                        return;
                    }

                    const updatedLife = { 
                        ...lifeStyle, 
                        activity: { ...lifeStyle.activity, neat_level: cleanText, preview_neat_pending: false } 
                    };
                    setLifeStyle(updatedLife);
                    if (isSingleLineEdit && updatedLife.circadian.sleepHours > 0) {
                        setIsSingleLineEdit(false);
                        buildAndShowSummary(updatedLife);
                    } else {
                        askSleepQuestion(updatedLife);
                    }
                    break;
                }

                // --- 6b. COMPUERTA BINARIA RESTRINGIDA SUEÑO (SLEEP_GATE) ---
                case 'SLEEP_GATE': {
                    if (textToProcess === "SLEEP_TCX_LOAD" || lower.includes("tcx") || lower.includes("archivo")) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Por favor, **haga clic en el botón de adjuntar (clip 📎) en la parte inferior** de la pantalla y seleccione su archivo de descanso/sueño `.tcx` / wearable."
                        }]);
                        setCurrentStep('AWAITING_SLEEP_TCX_FILE');
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
                    } else if (textToProcess === "SLEEP_MANUAL" || lower.includes("manual")) {
                        triggerManualSleepQuestions(lifeStyle);
                    }
                    break;
                }

                case 'SLEEP_TELEMETRY_CONFIRM': {
                    if (textToProcess.startsWith("CONFIRM_SLEEP_TELEMETRY")) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Métricas de descanso integradas exitosamente a su expediente clínico."
                        }]);
                        if (isSingleLineEdit && lifeStyle.stress.level) {
                            setIsSingleLineEdit(false);
                            setTimeout(() => {
                                buildAndShowSummary(lifeStyle);
                            }, 400);
                        } else {
                            setTimeout(() => {
                                askStressQuestion(lifeStyle);
                            }, 500);
                        }
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

                    const updatedLife = { ...lifeStyle, circadian: { ...lifeStyle.circadian, quality, ...(quality === 'GOOD' ? { issue_type: null } : {}) } };
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
                                    { label: isFemalePatient ? "Me cuesta quedarme dormida (Insomnio inicial)" : "Me cuesta quedarme dormido (Insomnio inicial)", value: "INSOMNIA" },
                                    { label: "Me despierto varias veces en la noche (Fragmentado)", value: "FRAGMENTED" },
                                    { label: "Ronco o siento que me falta el aire (Apnea)", value: "APNEA" },
                                    { label: "Trabajo en turnos nocturnos (Disrupción Circadiana)", value: "SHIFT_WORK" }
                                ]
                        }]);
                        setCurrentStep('SLEEP_ISSUE');
                    } else if (isSingleLineEdit && updatedLife.stress.level) {
                        setIsSingleLineEdit(false);
                        buildAndShowSummary(updatedLife);
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

                    if (isSingleLineEdit && updatedLife.stress.level) {
                        setIsSingleLineEdit(false);
                        buildAndShowSummary(updatedLife);
                        break;
                    }

                    const stressMsg = isMinor
                        ? `Anotado. ¿Cuál es el nivel de estrés diario en promedio de **${pName}**?`
                        : `Anotado. **¿Cómo percibe su nivel actual de estrés?**`;
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
                        setIsSingleLineEdit(false);
                        // Guardar datos y completar
                        syncLifeData(lifeStyle).then((finalState) => {
                            onPhaseComplete?.(finalState, messagesRef.current);
                        });
                    } else if (isCorrectData) {
                        const hasActiveTcx = lifeStyle.activity?.source_type === 'TELEMETRY_TCX' && Boolean(lifeStyle.activity?.telemetry_metadata);
                        const menuOptions = [
                            { label: "✏️ Modificar ejercicio físico / .TCX", value: "MODIFY_EXERCISE" },
                            ...(hasActiveTcx ? [{ label: "🗑️ Eliminar archivo .TCX y pasar a manual", value: "DELETE_TCX_EXERCISE" }] : []),
                            { label: "✏️ Modificar actividad diaria (NEAT)", value: "MODIFY_NEAT" },
                            { label: "✏️ Modificar horas y calidad de sueño", value: "MODIFY_SLEEP" },
                            { label: "✏️ Modificar nivel de estrés", value: "MODIFY_STRESS" },
                            { label: "🔄 Reiniciar toda la fase", value: "CLEAR_ALL" },
                            { label: "❌ Volver al resumen", value: "RETURN_SUMMARY" }
                        ];
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "De acuerdo. ¿Qué línea específica desea modificar en su síntesis de estilo de vida?",
                            options: menuOptions
                        }]);
                        setCurrentStep('correct_menu');
                    }
                    break;
                }
            }

            setIsAnalyzing(false);
        }, 600);
    };

    const askNeatQuestion = (stateOverride = null) => {
        if (isMinor) {
            const neatMsg = isLactante
                ? `Independientemente de la estimulación programada, ¿cómo describiría el nivel de movimiento o actividad espontánea diaria de **${pName}**?`
                : (isPreescolar || isEscolar
                    ? `Independientemente del deporte o actividades estructuradas, ¿cómo describiría la actividad o juego espontáneo diario habitual de **${pName}** (escuela, jardín, casa)?`
                    : `Independientemente del deporte, ¿cómo describiría la actividad diaria habitual de **${pName}** (trabajo, escuela o casa)?`);
            
            const neatOptions = isLactante
                ? [
                    { label: 'Tranquilo / Acostado la mayor parte del tiempo', value: 'SEDENTARY' },
                    { label: 'Gateo inicial / Juego sentado', value: 'LIGHT' },
                    { label: 'Gateo activo / Ya camina con apoyo', value: 'MODERATE' },
                    { label: 'Explora activamente / Corre / Salta', value: 'HEAVY' }
                ]
                : (isPreescolar || isEscolar || isMinor
                    ? [
                        { label: 'Sedentario (Juego tranquilo / Sentado la mayor parte del tiempo)', value: 'SEDENTARY' },
                        { label: 'Ligero (Caminata tranquila / Juego suave en casa o escuela)', value: 'LIGHT' },
                        { label: 'Moderado (Juego activo / Recreo / Corre en parque o jardín)', value: 'MODERATE' },
                        { label: 'Intenso / Muy Activo (Juego dinámico constante / Corre y salta todo el día)', value: 'HEAVY' }
                    ]
                    : adultNeatOptions);

            setMessages(prev => [...prev, {
                role: 'assistant', 
                content: neatMsg,
                inputType: 'strict_select',
                options: neatOptions
            }]);
            setCurrentStep('NEAT');
        } else {
            // Evaluación clínica directa del movimiento ocupacional/cotidiano fuera del entrenamiento (NEAT)
            const neatMsg = `Independientemente de su ejercicio programado, **¿cómo describiría su nivel de movimiento ocupacional y cotidiano habitual (NEAT)?**`;
            setMessages(prev => [...prev, {
                role: 'assistant', 
                content: neatMsg,
                inputType: 'strict_select',
                options: adultNeatOptions
            }]);
            setCurrentStep('NEAT');
        }
        if (stateOverride) {
            syncLifeData(stateOverride);
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
            inputType: 'strict_select',
            options: sleepOptions
        }]);
        setCurrentStep('SLEEP_HOURS');
        
        if (state) {
            syncLifeData(state);
        }
    };

    const askSleepQuestion = (state) => {
        triggerManualSleepQuestions(state);
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
        const activeMeta = state.activity.source_type === "TELEMETRY_TCX" ? state.activity.telemetry_metadata : null;
        if (state.activity.has_scheduled_exercise) {
            activityStr = activeMeta?.device_name
                ? `Sí (Vía Telemetría • ${activeMeta.device_name})`
                : "Sí";
            if (activeMeta && Array.isArray(activeMeta.disciplines) && activeMeta.disciplines.length > 0) {
                const freqTag = activeMeta.weekly_days
                    ? `\n  - 📅 **Frecuencia Habitual:** ${activeMeta.weekly_days} ${activeMeta.weekly_days === 1 ? 'día/semana' : 'días/semana'} (${activeMeta.weekly_minutes || (activeMeta.daily_minutes * activeMeta.weekly_days)} min/semana • ${activeMeta.weekly_calories || (activeMeta.daily_calories * activeMeta.weekly_days)} kcal/semana)`
                    : '';
                const discLines = activeMeta.disciplines.map(d => {
                    const lowerSport = String(d.sport || '').toLowerCase();
                    const emoji = lowerSport.includes('cicl') ? '🚴'
                        : lowerSport.includes('nat') ? '🏊'
                        : lowerSport.includes('caminadora') || lowerSport.includes('carr') || lowerSport.includes('elípt') || lowerSport.includes('elipt') ? '🏃'
                        : lowerSport.includes('caminat') ? '🚶'
                        : '🧘';
                    const distChunk = d.distanceMeters > 0
                        ? `Distancia: ${d.distanceMeters >= 1000 ? `${(d.distanceMeters / 1000).toFixed(2)} km` : `${Math.round(d.distanceMeters)} m`}, `
                        : '';
                    return `\n  - ${emoji} **${d.sport}**: ${distChunk}Duración: ${d.durationMinutesExact || d.durationMinutes} min, Calorías: ${Math.round(d.calories || 0)} kcal, FC Promedio: ${d.averageHeartRate || '--'} BPM, FC Máxima: ${d.maximumHeartRate || '--'} BPM`;
                }).join("");
                activityStr += freqTag + discLines;
            } else if (state.activity.log && state.activity.log.length > 0) {
                const formattedActivities = state.activity.log.map((item) => {
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
                        } else if (lowerSport.includes("caminadora")) {
                            sportEmoji = "🏃";
                            sportName = "Caminadora";
                        } else if (lowerSport.includes("carrera") || lowerSport.includes("run") || lowerSport.includes("trote")) {
                            sportEmoji = "🏃";
                            sportName = lowerSport.includes("interior") || lowerSport.includes("cinta") ? "Carrera en Cinta" : "Carrera / Trote";
                        } else if (lowerSport.includes("caminata") || lowerSport.includes("walk")) {
                            sportEmoji = "🚶";
                            sportName = "Caminata";
                        } else if (lowerSport.includes("elíptica") || lowerSport.includes("ellip")) {
                            sportEmoji = "🏃";
                            sportName = "Elíptica";
                        } else if (lowerSport.includes("troncal")) {
                            sportEmoji = "🧘";
                            sportName = "Entrenamiento troncal";
                        } else if (lowerSport.includes("libre") || lowerSport.includes("other") || lowerSport.includes("fuerza") || lowerSport.includes("fitness")) {
                            sportEmoji = "🧘";
                            sportName = "Entrenamiento Libre";
                        }

                        const parts = [];
                        if (item.weekly_days > 0) {
                            parts.push(`Frecuencia: ${item.weekly_days} días/sem`);
                        }
                        if (item.distance_meters > 0) {
                            const distFormatted = item.distance_meters >= 1000 
                                ? `${(item.distance_meters / 1000).toFixed(2)} km` 
                                : `${Math.round(item.distance_meters)} m`;
                            parts.push(`Distancia: ${distFormatted}`);
                        }
                        parts.push(`Duración: ${item.duration || item.durationMinutes || 0} min/día`);
                        if (item.calories_device > 0 || item.calories > 0) {
                            const cal = item.calories_device || item.calories;
                            parts.push(`Calorías: ${Math.round(cal)} kcal/día`);
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
                        else if (lowerItem.includes("correr") || lowerItem.includes("run") || lowerItem.includes("trote") || lowerItem.includes("carrera") || lowerItem.includes("caminadora")) sportEmoji = "🏃";
                        else if (lowerItem.includes("caminar") || lowerItem.includes("walk") || lowerItem.includes("caminata")) sportEmoji = "🚶";
                        else if (lowerItem.includes("eliptica") || lowerItem.includes("ellip")) sportEmoji = "🏃";
                        else if (lowerItem.includes("libre") || lowerItem.includes("fuerza") || lowerItem.includes("flexibilidad") || lowerItem.includes("gimnasio") || lowerItem.includes("troncal")) sportEmoji = "🧘";
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
            : { SEDENTARY: isFemalePatient ? 'Sedentaria' : 'Sedentario', LIGHT: 'Ligero', MODERATE: 'Moderado', HEAVY: 'Pesado' };
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
        if (isFemalePatient && isAppropriateAgeForCycle) {
            const hormonalData = patientData.physio?.last_menstruation_period || patientData.physio?.menstrual_status || 'No refiere';
            summaryText += `- 🌸 **Sincronía Hormonal:** ${hormonalData}\n`;
        }

        // 6. Resumen de Carga Física / Metabólica Dinámica
        let metabolicSummary = "";
        if (state.activity.source_type === "TELEMETRY_TCX" && state.activity.telemetry_metadata) {
            const meta = state.activity.telemetry_metadata;
            const dailyCal = Math.round(Number(meta.daily_calories || meta.total_calories || 0));
            const dailyMin = Math.round(Number(meta.daily_minutes || meta.total_minutes || 0));
            const weeklyDays = Number(meta.weekly_days) > 0 ? Number(meta.weekly_days) : null;
            const weeklyCal = Number(meta.weekly_calories) > 0 ? Math.round(Number(meta.weekly_calories)) : (weeklyDays ? Math.round(dailyCal * weeklyDays) : dailyCal);
            const weeklyMin = Number(meta.weekly_minutes) > 0 ? Math.round(Number(meta.weekly_minutes)) : (weeklyDays ? Math.round(dailyMin * weeklyDays) : dailyMin);
            const avgHr = Number(meta.average_hr || 0);
            const maxHr = Number(meta.max_hr || 0);
            const distLine = Number(meta.total_distance) > 0
                ? `\n- 📏 **Distancia por Jornada:** ${meta.total_distance >= 1000 ? `${(meta.total_distance / 1000).toFixed(2)} km` : `${Math.round(meta.total_distance)} m`}`
                : '';
            const omsLine = weeklyDays
                ? `\n- ⚡ **Adherencia Semanal OMS:** ${weeklyMin >= 150 ? 'Cumple recomendación OMS (>=150 min/sem)' : 'En progresión hacia meta OMS (150 min/sem)'}`
                : '';
            metabolicSummary = `\n📊 **Resumen de Carga Física (Vía Telemetría • ${meta.device_name || 'Wearable'}):**\n- 🔥 **Gasto Calórico:** ${dailyCal} kcal/día${weeklyDays ? ` (${weeklyCal} kcal/semana)` : ''}\n- ⏱️ **Tiempo de Ejercicio:** ${dailyMin} min/día${weeklyDays ? ` × ${weeklyDays} d/sem = ${weeklyMin} min/semana` : ''}${distLine}\n- 📈 **Carga Cardiovascular:** Promedio de ${avgHr} BPM (Máx: ${maxHr} BPM)${omsLine}`;
        } else if (state.activity.has_scheduled_exercise) {
            let totalWeeklyMin = 0;
            state.activity.log.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    const dur = item.duration || item.durationMinutes || 0;
                    const freq = item.frequency || 1;
                    totalWeeklyMin += (freq * dur);
                } else if (typeof item === 'string') {
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
