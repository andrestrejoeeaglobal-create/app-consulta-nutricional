import { useState, useEffect } from 'react';
import tiloImg from "../assets/tilo.png";
import { formatText, getGenderedTerm, fuzzyMatch, calculateCurp, cleanServerInfo, buildPediatricContext, inferGenderFromName } from "../utils/utils";
import useCitationValidation from './useCitationValidation';

// --- INITIAL STATES (EXTRACTED FOR RESET CAPABILITY) ---
const INITIAL_CURRENT_PHASE = 'PHASE_0_AUTH';
const INITIAL_ACTIVE_TAB = 'profile';
const INITIAL_MESSAGES = [
    {
        role: "assistant",
        content: "Hola, soy el Sistema de **T**ransformación **I**nteligente y **L**ogro **O**ptimizado (T.I.L.O.), el Asistente Nutricional de Equipo en Acción. Estoy listo para procesar una nueva consulta. ¿Podría proporcionarme su número de cita para validarlo aquí en el sistema, por favor?",
        avatar: tiloImg,
        inputType: 'number' // Explicit declaration of expected input type
    },
];

const INITIAL_PATIENT_DATA = {
    // Fases 1, 2, 4
    profile: {
        first_name: "",
        last_name_pat: "",
        last_name_mat: "",
        name: "", // Full name
        birthdate: "",
        pediatric_profile: null,
        age: 0,
        sex: "",
        occupation: "",
        phone: "",
        emergencyContact: { name: "", kin: "", phone: "" },
        curp: "",
        religion: "",
        marital_status: "",
        address: { zip_code: "", colony: "", street: "" }
    },
    // Fases 1, 2, 4 (Legacy Compatibility)
    identificacion: {
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechanac: "",
        sexo: "",
        ocupacion: "",
        curp: "",
        telefono: "",
        religion: ""
    },
    domicilio: {
        cp: "",
        colonia: "",
        calle: ""
    },
    evaluacionDietetica: {
        preferencias: { aversiones: "", favoritos: "" },
        r24h: [],
        ffq: {}
    },
    // Fases 4, 5, 6, 7, 13
    history: {
        family_raw_text: "",
        family_checklist_verified: false,
        family_structured: [],
        personal_raw_text: "",
        personal_checklist_verified: false,
        personal_structured: [],
        medications: [],
        allergies: {
            food: [],
            drug: []
        },
        // Fase 8
        digestive_symptoms: [],
        digestive_frequency: "",
        // Fase 13
        special_context: ""
    },
    // Fase 9
    physio: {
        is_pregnant: false,
        gestation_weeks: null,
        is_lactating: false,
        lactation_type: "",
        baby_age_months: null
    },
    // Fases 10, 11
    habits: {
        smoking: { is_smoker: false, details: "" },
        alcohol: { is_drinker: false, log: [], total_kcal_per_occasion: 0 },
        drugs: { has_usage: false, log: [] },
        sleep: { hours: null, quality: "" },
        stress: ""
    },
    activity: {
        exercise: { has_scheduled_exercise: false, log: [] }
    },
    // Fases 12, 13, 14, 16
    nutrition: {
        cook_type: "",
        venue: "",
        preferences: { dislikes: [], favorites: [] },
        protocol: {}
    },
    logistics: {
        chronobiology: { timeline: [] }
    },
    // Fase 15
    advanced_supplementation: [],
    // Fases 12, 16, 17, 18
    vitals: {
        weight: null,
        height: null,
        blood_pressure: "",
        waist: null,
        hip: null,
        hr: null,
        spo2: null,
        temperature: null,
        rr: null,
        glucose: null
    },
    biochemical: {
        electret_scan_data: {}
    },
    clinical_flags: [], // Acoplamiento estabilizado para alertas Fase 12
    // FASE 13 (Biométricos legacy Fase 6)
    peso: "",
    talla: "",
    imc: "",
    imcEstado: "",
    cintura: "",
    cadera: "",
    icc: "",
    iccRiesgo: "",
    signosVitales: {
        ta: "", spo2: "", fc: "", temp: "", fr: "", glucosa: ""
    },
    // Contexto Global (Tone of Voice Engine)
    session_context: {
        calculated_age: 0,
        interaction_mode: "",
        system_prompt_addon: ""
    },
    // Fase 3 (Motivo de Consulta)
    clinical_context: {
        patient_quote: "",
        specific_ailment: "",
        alert_level: "NONE",
        emotional_anchor: "",
        detective_radiography: { chronology: "", suspicion: "" },
        goal_standard: "",
        isGoal: false,
        isPregnant: false,
        pain_zones: [],
        intensity: 0,
        ai_analysis: { detected_tags: [] }
    }
};


/**
 * useCortex - Motor de Lógica Conversacional T.I.L.O.
 * Maneja el estado de la entrevista clínica interactiva y sincroniza el Dashboard.
 */

export const analyzeClinicalMotive = async (freeText, telemetry, bodyMapZones = []) => {
    try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        const response = await fetch(`${apiUrl}/api/cortex/analyzeMotive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                freeText,
                telemetry,
                bodyMapZones
            })
        });

        if (!response.ok) {
            throw new Error('Cortex API responded with an error');
        }

        const data = await response.json();
        
        let alertLevel = data.redFlag ? "CRITICAL" : "NONE";
        
        // Escalar alertas de forma estructural si el motor IA detecta categorías de alto riesgo
        if (data.category === "ONCOLOGY") alertLevel = "CRITICAL";
        else if (data.category === "SURGICAL" && alertLevel === "NONE") alertLevel = "WARNING";

        return {
            category: data.category || "CLINICAL",
            alert: alertLevel,
            suspicion: data.primaryRoute, // Usamos la ruta devuelta por IA como sospecha principal
            isGoal: data.isGoal || false,
            isPregnant: data.isPregnant || false,
            primaryRoute: data.primaryRoute,
            secondaryRoute: data.secondaryRoute,
            reasoning: data.reasoning,
            patientMessage: data.patientMessage
        };

    } catch (error) {
        console.error("Neural Cortex Analysis Error:", error);
        return {
            category: "CLINICAL",
            alert: "NONE",
            suspicion: "Inferencia Semántica",
            isGoal: false,
            isPregnant: false,
            primaryRoute: "GOAL_EDUCATION",
            secondaryRoute: null,
            reasoning: "Fallback preventivo por falla en Neural Cortex",
            patientMessage: "Entendido. He analizado la información y he trazado una ruta clínica de evaluación para continuar."
        };
    }
};

export const useCortex = () => {
    const { validateCitation } = useCitationValidation();
    // 0. LOCAL STORAGE RECOVERY FUNCTION
    const getSavedState = (key, initialValue) => {
        try {
            const item = window.localStorage.getItem('tilo_session_data');
            if (item) {
                const parsed = JSON.parse(item);
                if (key === 'patientData' && parsed[key] !== undefined) {
                    const savedData = parsed[key];
                    // Deep merge for critical top-level structures to prevent undefined crashes
                    return {
                        ...initialValue,
                        ...savedData,
                        identificacion: { ...initialValue.identificacion, ...(savedData.identificacion || {}) },
                        profile: { ...initialValue.profile, ...(savedData.profile || {}) },
                        domicilio: { ...initialValue.domicilio, ...(savedData.domicilio || {}) },
                        evaluacionDietetica: { ...initialValue.evaluacionDietetica, ...(savedData.evaluacionDietetica || {}) },
                        history: { ...initialValue.history, ...(savedData.history || {}) },
                        habits: { ...initialValue.habits, ...(savedData.habits || {}) },
                        nutrition: { ...initialValue.nutrition, ...(savedData.nutrition || {}) },
                        vitals: { ...initialValue.vitals, ...(savedData.vitals || {}) },
                        clinical_context: { ...initialValue.clinical_context, ...(savedData.clinical_context || {}) }
                    };
                }
                return parsed[key] !== undefined ? parsed[key] : initialValue;
            }
        } catch (error) {
            console.warn("Failed to read 'tilo_session_data' from localStorage", error);
        }
        return initialValue;
    };

    // 1. ESTADO DE FASE (Maquina de Estados)
    const [currentPhase, setCurrentPhase] = useState(() => getSavedState('currentPhase', INITIAL_CURRENT_PHASE));

    // 2. ESTADO DE NAVEGACIÓN (Dashboard)
    const [activeTab, setActiveTab] = useState(() => getSavedState('activeTab', INITIAL_ACTIVE_TAB));

    // 3. ESTADO DEL CHAT
    const [messages, setMessages] = useState(() => getSavedState('messages', INITIAL_MESSAGES));

    // 4. ESTADO GLOBAL DEL PACIENTE (Data Lake)
    const [patientData, setPatientData] = useState(() => getSavedState('patientData', INITIAL_PATIENT_DATA));

    // ESTADO TEMPORAL: Guardar payload del API
    const [apiContext, setApiContext] = useState(() => getSavedState('apiContext', {}));

    // --- NEW: PHASE 3 NATIVE STATE ---
    const [fase3State, setFase3State] = useState(() => getSavedState('fase3State', {
        patient_quote: "",
        specific_ailment: "",
        alert_level: "NONE",
        emotional_anchor: "",
        detective_radiography: { chronology: "", suspicion: "" },
        goal_standard: "",
        isGoal: false,
        isPregnant: false
    }));

    // ESTADO DE SEGURIDAD: Intentos de Autenticación
    const [authAttempts, setAuthAttempts] = useState(() => getSavedState('authAttempts', 0));


    // --- AUTO-SAVE EFFECT ---
    useEffect(() => {
        try {
            const sessionData = {
                currentPhase,
                activeTab,
                messages,
                patientData,
                apiContext,
                authAttempts,
                fase3State
            };
            window.localStorage.setItem('tilo_session_data', JSON.stringify(sessionData));
            console.log("💾 Cortex State Auto-Saved.");
        } catch (e) {
            console.error("Failed to save session data to localStorage", e);
        }
    }, [currentPhase, activeTab, messages, patientData, apiContext, authAttempts, fase3State]);

    // --- SESSION RESET FUNCTION ---
    const clearSession = () => {
        try {
            window.localStorage.removeItem('tilo_session_data');
            setCurrentPhase(INITIAL_CURRENT_PHASE);
            setActiveTab(INITIAL_ACTIVE_TAB);
            setMessages(INITIAL_MESSAGES);
            setPatientData(INITIAL_PATIENT_DATA);
            setApiContext({});
            setAuthAttempts(0);
            console.log("♻️ Cortex Session Cleared to Default.");
        } catch (error) {
            console.error("Failed to clear session data", error);
        }
    };

    // --- MOTOR CORTEX: PROCESAMIENTO DE RESPUESTAS FASE 3 ---
    const analyzeWithNeuralCortex = async (text) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            
            // Construir telemetría para el LLM
            const telemetry = {
                age: patientData.profile.age,
                sex: patientData.profile.sex,
                location: `${patientData.profile.address?.municipality || ''}, ${patientData.profile.address?.state || ''}`,
                occupation: patientData.profile.occupation
            };
            
            const bodyMapZones = []; // En el futuro se llenará desde el UI del cuerpo

            const response = await fetch(`${apiUrl}/api/cortex/analyzeMotive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    freeText: text,
                    telemetry,
                    bodyMapZones
                })
            });

            if (!response.ok) {
                throw new Error('Cortex API responded with an error');
            }

            const data = await response.json();
            
            let alertLevel = data.redFlag ? "CRITICAL" : "NONE";
            
            // Escalar alertas de forma estructural si el motor IA detecta categorías de alto riesgo
            if (data.category === "ONCOLOGY") alertLevel = "CRITICAL";
            else if (data.category === "SURGICAL" && alertLevel === "NONE") alertLevel = "WARNING";

            return {
                category: data.category || "CLINICAL",
                alert: alertLevel,
                suspicion: data.primaryRoute, // Usamos la ruta devuelta por IA como sospecha principal
                isGoal: data.isGoal || false,
                isPregnant: data.isPregnant || false,
                primaryRoute: data.primaryRoute,
                secondaryRoute: data.secondaryRoute,
                reasoning: data.reasoning,
                patientMessage: data.patientMessage
            };

        } catch (error) {
            console.error("🔥 Error en Neural Cortex:", error);
            // Fallback robusto en caso de error de red
            return {
                category: "CLINICAL",
                alert: "NONE",
                suspicion: "Ruta 0 - Control Clínico General",
                isGoal: false,
                isPregnant: false,
                primaryRoute: "Ruta 0 - Control Clínico General",
                secondaryRoute: null,
                reasoning: "Error de conexión con el motor de IA. Se ha asignado la ruta clínica por defecto.",
                patientMessage: "Entendido. He analizado la información y he trazado una ruta de evaluación general para continuar."
            };
        }
    };

    const triggerPhase1Summary = (updatedPatientData) => {
        const p = updatedPatientData.profile || {};
        const id = updatedPatientData.identificacion || {};
        const name = p.name || `${p.first_name || id.nombre || ''} ${p.last_name_pat || id.apellidoPaterno || ''} ${p.last_name_mat || id.apellidoMaterno || ''}`.trim();
        const tel = p.phone || updatedPatientData.cita?.phone || id.telefono || "";
        const curp = p.curp || id.curp || "";
        const sex = p.sex || id.sexo || "";
        const dob = p.birthdate || id.fechanac || `${p.dobDay || ''}/${p.dobMonth || ''}/${p.dobYear || ''}`;
        const rel = p.religion || id.religion || "";

        const ptCtx = p.pediatric_profile || id.pediatric_profile;
        const showMarital = !(ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false);
        const marital = p.marital_status || id.estadoCivil || "";

        const summary = `Excelente. Hemos terminado de capturar su perfil. Por regulaciones de la NOM-004, verifique que esta información de identificación sea correcta:\n\n` +
            `- 👤 **Nombre:** ${name}\n` +
            `- 📞 **Teléfono:** ${tel}\n` +
            `- 🆔 **CURP:** ${curp}\n` +
            `- ⚥ **Sexo:** ${sex}\n` +
            `- 📅 **Fecha Nacimiento:** ${dob}\n` +
            `- 🙏 **Religión:** ${rel}\n` +
            (showMarital ? `- 💍 **Estado Civil:** ${marital}\n\n` : '\n') +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.content === summary) return prev;
            return [...prev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_1_SUMMARY_CONFIRM');
    };

    const triggerPhase2Summary = (updatedPatientData) => {
        const e = updatedPatientData.profile?.emergencyContact || updatedPatientData.emergencia || {};
        const summary = `Perfecto. He registrado a su contacto de emergencia. Verifique que los datos sean correctos:\n\n` +
            `- 👤 **Nombre:** ${e.name || e.nombre || ''}\n` +
            `- 🤝 **Parentesco:** ${e.kin || e.parentesco || ''}\n` +
            `- 📞 **Teléfono:** ${e.phone || e.telefono || ''}\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.content === summary) return prev;
            return [...prev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_2_SUMMARY_CONFIRM');
    };

    const triggerPhase3Summary = (updatedFase3State) => {
        const motiveOptionsMap = {
            "GOAL_ADDICTIONS": "Adicciones y Sustancias",
            "GOAL_GERIATRICS": "Geriatría",
            "GOAL_ALLERGIES": "Alergias Graves",
            "GOAL_WEIGHT_LOSS": "Pérdida de Peso",
            "GOAL_BARIATRIC": "Bariátrica / Quirúrgico",
            "GOAL_MENOPAUSE": "Climaterio y Menopausia",
            "GOAL_CLINICAL": "Control Clínico",
            "GOAL_PALLIATIVE": "Cuidados Paliativos",
            "GOAL_DISABILITY": "Discapacidad y Rehabilitación",
            "GOAL_PREGNANCY": "Embarazo y Lactancia",
            "GOAL_MUSCLE": "Deporte / Rendimiento",
            "GOAL_ONCOLOGY": "Oncología Nutricional",
            "GOAL_PEDIATRICS": "Pediatría (Crecimiento y Desarrollo)",
            "GOAL_LONGEVITY": "Longevidad",
            "GOAL_MENTAL_HEALTH": "Salud Mental",
            "GOAL_RENAL": "Salud Renal",
            "GOAL_IMMUNE": "Inmunodeficiencias"
        };

        const rawRoute = updatedFase3State?.primaryRoute || updatedFase3State?.goal_standard || 'No especificado';
        const primaryRoute = motiveOptionsMap[rawRoute] || rawRoute;
        
        const reasoning = updatedFase3State?.gem_reasoning || updatedFase3State?.patient_quote || updatedFase3State?.specific_ailment || 'No especificado';

        const summary = `Perfecto. Hemos terminado la fase de Motivo de Consulta. Verifique que este resumen sea correcto:\n\n` +
            `🎯 **Objetivo Principal:** ${primaryRoute}\n` +
            `🗣️ **Motivo reportado:** ${reasoning}\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.content === summary) return prev;
            return [...prev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_3_SUMMARY_CONFIRM');
    };

    const triggerPhase4Summary = (updatedPatientData, overrideMessages = null) => {
        const h = updatedPatientData.familyTree?.antecedentes || [];
        const conditions = h.map(a => `${a.patologia || a.diagnostico || 'Condición no especificada'} (${a.familiar || a.parentesco || 'Familiar no especificado'})`);

        let heredoStr = conditions.length > 0 ? conditions.join(', ') : "Ninguna reportada";

        const summary = `Perfecto. Hemos terminado la fase de Antecedentes Heredofamiliares. Verifique que este resumen sea correcto:\n\n` +
            `🧬 **A. Heredofamiliares:** ${heredoStr}\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const baseMsgs = overrideMessages || prev;
            const lastMsg = baseMsgs[baseMsgs.length - 1];
            if (lastMsg && lastMsg.content === summary) return baseMsgs;
            return [...baseMsgs, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_4_SUMMARY_CONFIRM');
    };

    const triggerPhase5Summary = () => {
        const summary = `Perfecto. Hemos terminado la fase de Estilo de Vida y Personales. Verifique que este resumen sea correcto:\n\n` +
            `🩺 **A. Personales:** Guardados en expediente.\n` +
            `🏃‍♂️ **Estilo de Vida:** Registrado exitosamente.\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.content === summary) return prev;
            return [...prev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_5_SUMMARY_CONFIRM');
    };

    const triggerPhase6Summary = () => {
        const summary = `Perfecto. Hemos terminado la fase de Farmacología. Verifique que este resumen sea correcto:\n\n` +
            `💊 **Farmacología:** Suplementos y medicamentos registrados.\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.content === summary) return prev;
            return [...prev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_6_SUMMARY_CONFIRM');
    };

    const triggerPhase7Summary = () => {
        const summary = `Perfecto. Hemos terminado la fase de Hábitos y Estilo de Vida. Verifique que este resumen sea correcto:\n\n` +
            `🚭 **Hábitos:** Tabaquismo, Alcohol, Sueño, etc.\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.content === summary) return prev;
            return [...prev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_7_SUMMARY_CONFIRM');
    };

    /**
     * CORE ENGINE: Procesa la entrada del usuario y determina el siguiente paso.
     * @param {string} input - Texto ingresado por el usuario
     * @param {boolean} isInternalCall - Flag para evitar eco doble cuando viene de botones programáticos
     */
    const processUserInput = (input, isInternalCall = false) => {
        const text = input.trim();
        if (!text) return;

        let displayText = text;
        try {
            const payload = JSON.parse(text);
            if (payload.identity_extraction && payload.identity_extraction.birth_entity) {
                displayText = payload.identity_extraction.birth_entity.full_name;
            }
        } catch {
            // Not a JSON payload, fallback to raw text
        }

        // 1. Agregar el mensaje del usuario al chat visual solo si no es interno
        if (!isInternalCall) {
            setMessages(prev => [...prev, { role: 'user', content: displayText }]);
        }

        // 2. Máquina de Estados basada en `currentPhase`
        setTimeout(async () => {
            switch (currentPhase) {
                // =============== FASE 0: AUTENTICACIÓN ===============
                case 'PHASE_0_AUTH':
                    // Mock Authentication Logic
                    if (/^\d+$/.test(text)) {
                        const apiResponse = await validateCitation(text);
                        if (!apiResponse) {
                            setMessages(prev => [...prev, { role: "assistant", content: "⚠️  Error de conexión con el servidor de citas. Intente nuevamente." }]);
                            return;
                        }

                        const citaData = apiResponse.dataSet && apiResponse.dataSet[0];
                        const status = citaData ? citaData.estatus : 'ERROR_NET';

                        if (status === "ESTUDIO_PENDIENTE") {
                            // Extract and format info
                            const formattedInfo = cleanServerInfo(citaData.info);

                            // Prioritize the full string extracted from the info field ONLY if it matches the base name
                            let extractedName = citaData.name || citaData.paciente || "";
                            if (formattedInfo.patientName) {
                                if (extractedName) {
                                    const firstWord = extractedName.trim().split(' ')[0].toLowerCase();
                                    if (formattedInfo.patientName.toLowerCase().includes(firstWord)) {
                                        extractedName = formattedInfo.patientName;
                                    }
                                } else {
                                    extractedName = formattedInfo.patientName;
                                }
                            }

                            // Saneamiento estricto para eliminar la "Coma Fantasma" y espacios dobles
                            extractedName = extractedName.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

                            // Save context for fuzzy match and checkpoints
                            setApiContext({
                                rawName: extractedName,
                                userId: citaData.userId,
                                idCita: citaData.idCita, // internal citation ID
                                citaId: citaData.cita || citaData.folio, // visual citation ID
                                sucursal: formattedInfo.sede
                            });

                            const titularName = formatText(extractedName);

                            setAuthAttempts(0); // Reset on success

                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: `✅ Cita Encontrada.\n\n👤 Titular: ${titularName}\n📍 Sucursal y Fecha: ${formattedInfo.sede} — ${formattedInfo.display}\n\nPor protocolos de seguridad, confirme:\n**¿Es usted el paciente titular mencionado arriba?**`,
                                avatar: tiloImg,
                                inputType: 'buttons',
                                options: [
                                    { label: '✅ SÍ, SOY YO', value: 'yes' },
                                    { label: '❌ NO, ES UN ERROR', value: 'no' }
                                ]
                            }]);
                            setCurrentPhase('PHASE_0_IDENTITY_CHECK');
                        } else {
                            const newAttempts = authAttempts + 1;
                            setAuthAttempts(newAttempts);

                            if (newAttempts >= 3) {
                                setMessages(prev => [...prev, {
                                    role: 'assistant',
                                    content: "🗣️ ⚠️ **Validación bloqueada por seguridad.**\nHemos superado el número de intentos permitidos. Por favor, acuda a la recepción para que uno de nuestros compañeros le asista directamente con su registro.",
                                    avatar: tiloImg,
                                    inputType: 'none' // Bloquea el input
                                }]);
                                return;
                            }

                            if (status === "ESTUDIO_REALIZADO" || status === "ESTUDIO_COMPLETO") {
                                const formattedInfoErr = cleanServerInfo(citaData.info);

                                let extractedNameErr = citaData.name || citaData.paciente || "";
                                if (formattedInfoErr.patientName) {
                                    if (extractedNameErr) {
                                        const firstWordErr = extractedNameErr.trim().split(' ')[0].toLowerCase();
                                        if (formattedInfoErr.patientName.toLowerCase().includes(firstWordErr)) {
                                            extractedNameErr = formattedInfoErr.patientName;
                                        }
                                    } else {
                                        extractedNameErr = formattedInfoErr.patientName;
                                    }
                                }

                                const titularName = formatText(extractedNameErr);

                                setMessages(prev => [...prev, {
                                    role: 'assistant',
                                    content: `🏁 **Folio ya utilizado.**\n\nNuestros registros indican que esta cita ya fue utilizada previamente por el titular ${titularName} y el estudio aparece como completado. Este folio ha caducado.\n\nLe quedan ${3 - newAttempts} intento(s). Por favor, verifique su número de cita.`,
                                    avatar: tiloImg,
                                    inputType: 'number'
                                }]);
                            } else {
                                setMessages(prev => [...prev, {
                                    role: 'assistant',
                                    content: `❌ **Cita No Encontrada.**\nEl número que ingresó no es válido para realizar el estudio.\n\nLe quedan ${3 - newAttempts} intento(s). Por favor, verifique el número e intente nuevamente.`,
                                    avatar: tiloImg,
                                    inputType: 'number'
                                }]);
                            }
                        }
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, ingrese un número de cita válido (numérico).",
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                    }
                    break;

                case 'PHASE_0_IDENTITY_CHECK':
                    if (text === 'yes') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Excelente. Para activar su expediente, es obligatorio leer y aceptar nuestro **Aviso de Privacidad**.",
                            avatar: tiloImg,
                            inputType: 'none' // Espera al modal de privacidad
                        }]);
                        setCurrentPhase('PHASE_0_PRIVACY');
                    } else if (text === 'no') {
                        // Limpia memoria
                        setApiContext({});
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Limpiando datos en memoria...\nPor favor, vuelva a proporcionar su número de cita correcto.",
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                        setCurrentPhase('PHASE_0_AUTH');
                    }
                    break;

                case 'PHASE_0_PRIVACY': {
                    // This is triggered by App.jsx when the modal is accepted
                    // CHECKPOINT 1: Guardado Inicial
                    console.log("💾 CHECKPOINT 1: Fase 0 Completada. Progreso guardado.");

                    // Remove ghost commas from the initial payload to ensure all extracted parts are clean
                    const rawNameStr = (apiContext && typeof apiContext.rawName === 'string') ? apiContext.rawName.replace(/,/g, '').replace(/\s+/g, ' ').trim() : "Paciente";
                    const safeName = rawNameStr || "Paciente";

                    const partsTemp = safeName.split(' ');
                    // Heurística básica: si tiene 3 o más palabras, asumimos que los primeros (hasta n-2) son nombres y los últimos 2 son apellidos
                    let safeFirstName = "Paciente";
                    let safeLastNamePat = "";
                    let safeLastNameMat = "";

                    if (partsTemp.length >= 3) {
                        safeLastNameMat = partsTemp.pop();
                        safeLastNamePat = partsTemp.pop();
                        safeFirstName = partsTemp.join(' ');
                    } else if (partsTemp.length === 2) {
                        safeLastNamePat = partsTemp[1];
                        safeFirstName = partsTemp[0];
                    } else if (partsTemp.length === 1) {
                        safeFirstName = partsTemp[0];
                    }

                    // Guardamos los valores extraídos en el apiContext temporal extra para las siguientes fases
                    setApiContext(prev => ({
                        ...prev,
                        extractedFirst: formatText(safeFirstName),
                        extractedPat: formatText(safeLastNamePat),
                        extractedMat: formatText(safeLastNameMat)
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Comencemos. El sistema tiene registrado el nombre:\n${formatText(safeName)}\n\nVamos a validar sus datos personales uno a uno por la NOM-004.\n¿Es ${formatText(safeFirstName)} su Primer Nombre de Pila (sin apellidos)?`,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: '✅ Sí', value: 'yes' },
                            { label: '❌ No, corregir', value: 'no' }
                        ]
                    }]);
                    setActiveTab('profile'); // Sync UI Dashboard
                    setCurrentPhase('PHASE_1_PROFILE_NAME_CONFIRM');
                    break;
                }

                // =============== FASE 1: PERFIL ===============
                case 'PHASE_1_PROFILE_NAME_CONFIRM':
                    if (text === 'yes') {
                        const cleanFirstName = (apiContext.extractedFirst || "").replace(/,/g, '').trim();
                        setPatientData(prev => ({
                            ...prev,
                            // Usamos el valor extraido y formateado de la apiContext (limpio de comas fantasmas)
                            profile: { ...prev.profile, first_name: cleanFirstName, name: apiContext.rawName },
                            identificacion: { ...prev.identificacion, nombre: cleanFirstName } // Legacy Support
                        }));

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Excelente. ¿Es ${apiContext.extractedPat} su Apellido Paterno?`,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: '✅ Sí', value: 'yes' },
                                { label: '❌ No, corregir', value: 'no' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_PAT');
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba estrictamente su **Nombre(s) de Pila** (sin apellidos):",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_NAME_MANUAL');
                    }
                    break;

                case 'PHASE_1_PROFILE_NAME_MANUAL': {
                    const parsedName = formatText(text).replace(/,/g, '').trim();
                    // Identity Lock Fix: Check against extracted first name, or fallback to the full raw name
                    const isMatch = fuzzyMatch(text, apiContext.extractedFirst) || fuzzyMatch(text, apiContext.rawName);

                    if (!isMatch) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⚠️ **Alerta de Seguridad (Identity Lock)**\nEl nombre ingresado es drásticamente distinto al de la cita. Por protocolos de validación, por favor vuelva a escribir su **Nombre(s) de Pila** con cuidado:",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        // Stay in same phase to retry
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, first_name: parsedName, name: apiContext.rawName },
                        identificacion: { ...prev.identificacion, nombre: parsedName } // Legacy Support
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Entendido. ¿Es ${apiContext.extractedPat} su Apellido Paterno?`,
                        avatar: tiloImg,
                        inputType: 'strict_select',
                        options: [
                            { label: '✅ Sí', value: 'yes' },
                            { label: '❌ No, corregir', value: 'no' }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_PAT');
                    break;
                }

                case 'PHASE_1_PROFILE_LAST_NAME_PAT': {
                    let finalLastNamePat = "";

                    if (text === 'yes') {
                        finalLastNamePat = apiContext.extractedPat;
                    } else if (text === 'no') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba su **Apellido Paterno** correcto:",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_PAT_MANUAL');
                        return;
                    } else {
                        // RECHAZO DE TEXTO LIBRE
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⚠️ Por favor, seleccione una de las opciones con los botones para confirmar si el apellido es correcto.",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ Sí', value: 'yes' },
                                { label: '❌ No, corregir', value: 'no' }
                            ]
                        }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, last_name_pat: finalLastNamePat },
                        identificacion: { ...prev.identificacion, apellidoPaterno: finalLastNamePat } // Legacy Support
                    }));

                    const matSurname = apiContext.extractedMat || "";
                    const hasValidMatSurname = matSurname.trim().length > 0 && !matSurname.includes("*");

                    if (hasValidMatSurname) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Y por último, ¿Es ${matSurname} su Apellido Materno?`,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ Sí', value: 'yes' },
                                { label: '❌ No, corregir', value: 'no' },
                                { label: '➖ No uso Apellido Materno', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT');
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Y por último, el sistema no me muestra un segundo apellido. Si usted cuenta con un Apellido Materno, por favor dígame cuál es.`,
                            avatar: tiloImg,
                            inputType: 'text',
                            options: [
                                { label: '➖ No uso Apellido Materno', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_LAST_NAME_PAT_MANUAL': {
                    const parsedLastName = formatText(text);
                    // Identity Lock Fix: Check against extracted pat name, or fallback to the full raw name
                    const isMatch = fuzzyMatch(text, apiContext.extractedPat) || fuzzyMatch(text, apiContext.rawName);

                    if (!isMatch) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⚠️ **Identity Lock:** El apellido paterno difiere significativamente de la cita. Por favor verifique e ingrese su **Apellido Paterno** nuevamente:",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, last_name_pat: parsedLastName },
                        identificacion: { ...prev.identificacion, apellidoPaterno: parsedLastName }
                    }));

                    const matSurname = apiContext.extractedMat || "";
                    const hasValidMatSurname = matSurname.trim().length > 0 && !matSurname.includes("*");

                    if (hasValidMatSurname) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Entendido. ¿Y es ${matSurname} su Apellido Materno?`,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ Sí', value: 'yes' },
                                { label: '❌ No, corregir', value: 'no' },
                                { label: '➖ No uso Apellido Materno', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT');
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Entendido. Y por último, el sistema no me muestra un segundo apellido. Si usted cuenta con un Apellido Materno, por favor dígame cuál es.`,
                            avatar: tiloImg,
                            inputType: 'text',
                            options: [
                                { label: '➖ No uso Apellido Materno', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_LAST_NAME_MAT': {
                    let finalLastNameMat = "";

                    if (text === 'yes') {
                        finalLastNameMat = apiContext.extractedMat;
                    } else if (text === 'CONFIRM_MAT_NONE') {
                        setPatientData(prev => {
                            const newProfile = { ...prev.profile, last_name_mat: null };
                            newProfile.name = `${newProfile.first_name} ${newProfile.last_name_pat}`.trim().toUpperCase();

                            const newIdentificacion = {
                                ...prev.identificacion,
                                apellidoMaterno: null
                            };

                            return { ...prev, profile: newProfile, identificacion: newIdentificacion };
                        });

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ Identidad Estructurada Correctamente (Sin Apellido Materno).\n\nPasemos a su Fecha de Nacimiento.\n\n¿En qué **DÍA** nació? (Ej: 12)`,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);

                        setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                        break;
                    } else if (text === 'no') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba su **Apellido Materno** correcto:",
                            avatar: tiloImg,
                            inputType: 'text',
                            options: [
                                { label: '➖ No uso Apellido Materno', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL');
                        return;
                    } else {
                        // RECHAZO DE TEXTO LIBRE
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⚠️ Por favor, seleccione una de las opciones con los botones para confirmar si el apellido es correcto.",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ Sí', value: 'yes' },
                                { label: '❌ No, corregir', value: 'no' },
                                { label: '➖ No uso Apellido Materno', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        return;
                    }

                    // Proceeding after confirmation
                    setPatientData(prev => {
                        const newProfile = { ...prev.profile, last_name_mat: finalLastNameMat };
                        newProfile.name = `${newProfile.first_name} ${newProfile.last_name_pat} ${newProfile.last_name_mat}`.trim();

                        const newIdentificacion = {
                            ...prev.identificacion,
                            apellidoMaterno: finalLastNameMat
                        };

                        return { ...prev, profile: newProfile, identificacion: newIdentificacion };
                    });

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ Identidad Estructurada Correctamente.\n\nPasemos a su Fecha de Nacimiento.\n\n¿En qué **DÍA** nació? (Ej: 12)`,
                        avatar: tiloImg,
                        inputType: 'number'
                    }]);

                    setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                    break;
                }

                case 'PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL': {
                    if (text === 'CONFIRM_MAT_NONE') {
                        // Bypassing maternal surname logic
                        setPatientData(prev => {
                            const newProfile = { ...prev.profile, last_name_mat: null };
                            newProfile.name = `${newProfile.first_name} ${newProfile.last_name_pat}`.trim().toUpperCase();

                            const newIdentificacion = {
                                ...prev.identificacion,
                                apellidoMaterno: null
                            };

                            return { ...prev, profile: newProfile, identificacion: newIdentificacion };
                        });

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ Identidad Estructurada Correctamente (Sin Apellido Materno).\n\nPasemos a su Fecha de Nacimiento.\n\n¿En qué **DÍA** nació? (Ej: 12)`,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);

                        setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                        break;
                    }

                    const parsedLastNameMat = formatText(text);

                    // Solo actualizamos el nombre completo de forma estructurada
                    setPatientData(prev => {
                        const newProfile = { ...prev.profile, last_name_mat: parsedLastNameMat };
                        newProfile.name = `${newProfile.first_name} ${newProfile.last_name_pat} ${newProfile.last_name_mat}`.trim().toUpperCase();

                        const newIdentificacion = {
                            ...prev.identificacion,
                            apellidoMaterno: parsedLastNameMat
                        };

                        return { ...prev, profile: newProfile, identificacion: newIdentificacion };
                    });

                    // C. Siguiente pregunta de Tilo (Q4)
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ Identidad Estructurada Correctamente.\n\nPasemos a su Fecha de Nacimiento.\n\n¿En qué **DÍA** nació? (Ej: 12)`,
                        avatar: tiloImg,
                        inputType: 'number'
                    }]);

                    // D. Avanzar estado
                    setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                    break;
                }

                case 'PHASE_1_PROFILE_DOB_DAY': {
                    const day = parseInt(text, 10);
                    if (isNaN(day) || day < 1 || day > 31) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor indique un día válido (1-31).", avatar: tiloImg }]);
                        return;
                    }
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, dobDay: text.padStart(2, '0') }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "¿En qué **mes**? (Ej: Mayo)",
                        avatar: tiloImg,
                        inputType: 'text'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_DOB_MONTH');
                    break;
                }

                case 'PHASE_1_PROFILE_DOB_MONTH': {
                    const rawMonth = text.trim().toLowerCase();
                    const months = {
                        'enero': '01', 'ene': '01', '01': '01', '1': '01',
                        'febrero': '02', 'feb': '02', '02': '02', '2': '02',
                        'marzo': '03', 'mar': '03', '03': '03', '3': '03',
                        'abril': '04', 'abr': '04', '04': '04', '4': '04',
                        'mayo': '05', 'may': '05', '05': '05', '5': '05',
                        'junio': '06', 'jun': '06', '06': '06', '6': '06',
                        'julio': '07', 'jul': '07', '07': '07', '7': '07',
                        'agosto': '08', 'ago': '08', '08': '08', '8': '08',
                        'septiembre': '09', 'sep': '09', '09': '09', '9': '09',
                        'octubre': '10', 'oct': '10', '10': '10',
                        'noviembre': '11', 'nov': '11', '11': '11',
                        'diciembre': '12', 'dic': '12', '12': '12'
                    };
                    const monthCode = months[rawMonth];
                    if (!monthCode) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "No reconocí ese mes. Intente escribirlo completo (ej: Enero) o el número.", avatar: tiloImg }]);
                        return;
                    }
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, dobMonth: monthCode }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "¿De qué **año**? (Ej: 1990)",
                        avatar: tiloImg,
                        inputType: 'number'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_DOB_YEAR');
                    break;
                }

                case 'PHASE_1_PROFILE_DOB_YEAR': {
                    const year = parseInt(text, 10);
                    const currentYear = new Date().getFullYear();
                    if (isNaN(year) || year < 1920 || year > currentYear) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor indique un año válido (4 dígitos).", avatar: tiloImg }]);
                        return;
                    }

                    const dobDay = patientData.profile.dobDay;
                    const dobMonth = patientData.profile.dobMonth;
                    const d = parseInt(dobDay, 10);
                    const m = parseInt(dobMonth, 10);

                    const checkDate = new Date(year, m - 1, d);
                    if (checkDate.getFullYear() !== year || checkDate.getMonth() !== (m - 1) || checkDate.getDate() !== d) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ Fecha inexistente. Verifique día/mes.\n\n¿En qué **DÍA** nació?", avatar: tiloImg, inputType: 'number' }]);
                        setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                        return;
                    }

                    const fullDate = `${dobDay}/${dobMonth}/${year}`;
                    const today = new Date();
                    let age = today.getFullYear() - checkDate.getFullYear();
                    const mDiff = today.getMonth() - checkDate.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && today.getDate() < checkDate.getDate())) {
                        age--;
                    }

                    // Compute pediatric context
                    const pediatricContext = buildPediatricContext(fullDate);

                    // --- TONE OF VOICE ENGINE ---
                    // Asignación de Personalidad Dinámica al Motor (Cortex)
                    let interaction_mode = "ADULT_MODE";
                    let system_prompt_addon = "";
                    const firstName = patientData.profile.first_name || apiContext.extractedFirst || "el paciente";

                    if (age < 12) {
                        interaction_mode = "PEDIATRIC_MODE";
                        system_prompt_addon = `El paciente es un niño/a de ${age} años llamado ${firstName}. El usuario interactuando con la pantalla es su padre/tutor. Dirígete al tutor de 'USTED' de forma respetuosa, y refiérete al paciente por su nombre en tercera persona.`;
                    } else if (age >= 12 && age < 18) {
                        interaction_mode = "TEENAGER_MODE";
                        system_prompt_addon = `El paciente es un adolescente de ${age} años llamado ${firstName}. Dirígete a él/ella directamente de 'TÚ', usando un tono empático, amigable y accesible, sin perder la autoridad clínica.`;
                    } else {
                        interaction_mode = "ADULT_MODE";
                        system_prompt_addon = `El paciente es un adulto de ${age} años llamado ${firstName}. Dirígete a él/ella directamente de 'USTED', usando un tono profesional, empático y respetuoso en todo momento.`;
                    }

                    // Remove temporary variables to keep Data Lake clean
                    setPatientData(prev => {
                        const newProfile = {
                            ...prev.profile,
                            birthdate: fullDate,
                            age: age,
                            pediatric_profile: pediatricContext
                        };
                        delete newProfile.dobDay;
                        delete newProfile.dobMonth;

                        return {
                            ...prev,
                            profile: newProfile,
                            session_context: {
                                calculated_age: age,
                                interaction_mode: interaction_mode,
                                system_prompt_addon: system_prompt_addon
                            }
                        };
                    });

                    const formatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
                    const formattedDOB = checkDate.toLocaleDateString('es-ES', formatOptions);

                    let sexMsg = "";
                    if (age < 18) sexMsg = `Registrado: ${formattedDOB}.\n\n¿Cuál es el sexo biológico de ${firstName}?`;
                    else sexMsg = `Registrado: ${formattedDOB}.\n\n¿Cuál es su sexo biológico?`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: sexMsg,
                        avatar: tiloImg,
                        options: [
                            { label: "Masculino", value: "Masculino" },
                            { label: "Femenino", value: "Femenino" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_SEX');
                    break;
                }

                case 'PHASE_1_PROFILE_SEX': {
                    let sex = text;
                    if (['mujer', 'femenino', 'f', 'la paciente'].includes(sex.toLowerCase())) sex = "Femenino";
                    if (['hombre', 'masculino', 'm', 'el paciente', 'varon'].includes(sex.toLowerCase())) sex = "Masculino";

                    if (sex === "Masculino" || sex === "Femenino") {
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, sex: sex }
                        }));

                        const ptCtx = patientData.profile.pediatric_profile;
                        let occupationPrompt = "¿Cuál es su ocupación actual?"; // Default ADULT

                        if (ptCtx && ptCtx.is_minor) {
                            if (ptCtx.category === 'ADOLESCENTE') {
                                occupationPrompt = "Para tu registro oficial, ¿en qué semestre de secundaria o preparatoria te encuentras?";
                            } else if (ptCtx.category === 'ESCOLAR') {
                                occupationPrompt = `Para el expediente de ${patientData.profile.first_name || "el menor"}, ¿me indican en qué grado escolar va?`;
                            } else if (ptCtx.category === 'PREESCOLAR' || ptCtx.category === 'LACTANTE') {
                                occupationPrompt = `¿${patientData.profile.first_name || "El menor"} asiste a guardería o kínder actualmente?`;
                            }
                        }

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: occupationPrompt,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_JOB');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor seleccione una opción válida.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_JOB': {
                    const job = formatText(text);
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, occupation: job }
                    }));
                    const age = patientData.profile?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (patientData.profile?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    
                    let curpPromptMsg = "";
                    if (isMinor) curpPromptMsg = `¿Podría indicarme la Clave Única de Registro de Población (CURP) de ${firstName}? (Escríbala o elija una opción)`;
                    else curpPromptMsg = `¿Podría indicarme su Clave Única de Registro de Población (CURP)? (Escríbala o elija una opción)`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: curpPromptMsg,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "Manual (Tipear)", value: "Manual" },
                            { label: "Búscala por mí (Asistencia)", value: "Buscala" },
                            { label: "Soy Extranjero", value: "Extranjero" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_CURP_GATE');
                    break;
                }

                // Q9: CURP GATE (Trifurcation)
                case 'PHASE_1_PROFILE_CURP_GATE': {
                    const age = patientData.profile?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (patientData.profile?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    
                    if (text === 'Manual') {
                        let msg = "";
                        if (isMinor) msg = `Entendido. Por favor, escriba la CURP de ${firstName} a 18 caracteres:`;
                        else msg = "Entendido. Por favor, escriba su CURP a 18 caracteres:";
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg, inputType: 'text' }]);
                        setCurrentPhase('PHASE_1_PROFILE_CURP_MANUAL');
                    } else if (text === 'Extranjero') {
                        let msg = "";
                        if (isMinor) msg = `Ingrese el ID de Pasaporte o ID oficial del país de origen de ${firstName}:`;
                        else msg = "Ingrese su ID de Pasaporte o ID oficial de su país:";
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg, inputType: 'text' }]);
                        setCurrentPhase('PHASE_1_PROFILE_ID_EXTRANJERO');
                    } else if (text === 'Buscala') {
                        let msg = "";
                        if (isMinor) msg = `¿En qué **Estado de la República** nació ${firstName}? (Ej. Chiapas, CDMX, Jalisco)`;
                        else msg = "¿En qué **Estado de la República** nació? (Ej. Chiapas, CDMX, Jalisco)";
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg, inputType: 'StateSelector' }]);
                        setCurrentPhase('PHASE_1_PROFILE_CURP_ASSIST');
                    } else {
                        // Trató de escribirla directo en el prompt de botones
                        const isCurp = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/.test(text.toUpperCase());
                        if (isCurp) {
                            setPatientData(prev => ({ ...prev, profile: { ...prev.profile, curp: text.toUpperCase() } }));
                            
                            let phoneMsg = "";
                            if (isMinor) phoneMsg = `CURP Registrada. ¿Cuál es el número de teléfono celular de contacto para ${firstName} a 10 dígitos?`;
                            else phoneMsg = "CURP Registrada. ¿Cuál es su número de teléfono celular a 10 dígitos?";

                            setMessages(prev => [...prev, { role: 'assistant', content: phoneMsg, avatar: tiloImg, inputType: 'tel' }]);
                            setCurrentPhase('PHASE_1_PROFILE_PHONE');
                        } else {
                            setMessages(prev => [...prev, { role: 'assistant', content: "Formato incorrecto o respuesta inválida. Elija una opción.", avatar: tiloImg }]);
                        }
                    }
                    break;
                }


                case 'PHASE_1_PROFILE_CURP_ASSIST': {
                    let stateCode = '';
                    try {
                        const payload = JSON.parse(text);
                        if (payload.identity_extraction && payload.identity_extraction.birth_entity) {
                            stateCode = payload.identity_extraction.birth_entity.renapo_code;
                        }
                    } catch {
                        // ignore JSON error
                    }
                    if (!stateCode) {
                        stateCode = text.substring(0, 2).toUpperCase(); // Simplification: in a real app, mapping table is used
                    }

                    const p = patientData.profile;
                    const age = p?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (p?.first_name || p?.name || "el paciente").split(' ')[0];
                    const calculatedCurp = calculateCurp(p.first_name, p.last_name_pat, p.last_name_mat, p.birthdate, p.sex, stateCode);

                    setPatientData(prev => ({ ...prev, profile: { ...prev.profile, curp: calculatedCurp } }));
                    
                    let curpMsg = "";
                    if (isMinor) curpMsg = `He calculado la CURP base de ${firstName}: ${calculatedCurp}\n\n¿Es correcta esta CURP?`;
                    else curpMsg = `He calculado su CURP base: ${calculatedCurp}\n\n¿Es correcta esta CURP?`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ Motor Concierge activado.\n\n${curpMsg}`,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: '✅ Sí, es correcta', value: 'yes' },
                            { label: '❌ No, ingresar manualmente', value: 'no' }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_CURP_CONFIRM');
                    break;
                }

                case 'PHASE_1_PROFILE_CURP_CONFIRM': {
                    const age = patientData.profile?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (patientData.profile?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    if (text === 'yes') {
                        let phoneMsg = "";
                        if (isMinor) phoneMsg = `Perfecto. ¿Cuál es el **número de teléfono celular** de contacto para ${firstName} a 10 dígitos?`;
                        else phoneMsg = "Perfecto. ¿Cuál es su **número de teléfono celular** a 10 dígitos?";

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: phoneMsg,
                            avatar: tiloImg,
                            inputType: 'tel'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_PHONE');
                    } else {
                        // Limpiar la CURP autogenerada si fue rechazada
                        setPatientData(prev => ({ ...prev, profile: { ...prev.profile, curp: '' } }));
                        
                        let manualMsg = "";
                        if (isMinor) manualMsg = `Entendido. Por favor, escriba la CURP de ${firstName} a 18 caracteres:`;
                        else manualMsg = "Entendido. Por favor, escriba su CURP a 18 caracteres:";

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: manualMsg,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_CURP_MANUAL');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_CURP_MANUAL': {
                    const curpInput = text.trim().toUpperCase();
                    // Regex Oficial CURP
                    const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/;

                    if (!curpRegex.test(curpInput)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "El formato de la CURP no es válido. Debe tener 18 caracteres alfanuméricos.\nPor favor intente nuevamente:" }]);
                        return;
                    }

                    // V8.0: Validación cruzada de integridad usando fecha y sexo del perfil
                    const p = patientData.profile;
                    let calculatedBase = "";
                    if (p.first_name && p.last_name_pat && p.birthdate && p.sex) {
                        calculatedBase = calculateCurp(p.first_name, p.last_name_pat, p.last_name_mat, p.birthdate, p.sex, "XX");
                    }

                    if (calculatedBase && calculatedBase.length === 18) {
                        const expectedDateAndSex = calculatedBase.substring(4, 11);
                        const inputDateAndSex = curpInput.substring(4, 11);

                        if (expectedDateAndSex !== inputDateAndSex) {
                            setMessages((prev) => [...prev, { role: "assistant", content: `⛔ **Error de Validación**\n\nEl año, mes, día o sexo de la CURP introducida no coincide con los datos biológicos que registramos previamente.\n\nPor favor verifique e intente nuevamente:` }]);
                            return;
                        }
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, curp: curpInput }
                    }));

                    const age = p?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (p?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    let msgContentPhone = "";
                    if (isMinor) msgContentPhone = `✅ CURP Confirmada.\n\nPasemos ahora a los datos de contacto. ¿Cuál es el **número de teléfono celular** de contacto para ${firstName} a 10 dígitos?`;
                    else msgContentPhone = "✅ CURP Confirmada.\n\nPasemos ahora a sus datos de contacto. ¿Cuál es su **número de teléfono celular** a 10 dígitos?";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContentPhone,
                        avatar: tiloImg,
                        inputType: 'tel'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_PHONE');
                    break;
                }

                case 'PHASE_1_PROFILE_ID_EXTRANJERO': {
                    const idInput = text.trim().toUpperCase();
                    if (idInput.length < 5) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "El ID o Pasaporte debe tener al menos 5 caracteres. Por favor verifique e intente nuevamente:", avatar: tiloImg }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, curp: `EXT-${idInput}` }
                    }));


                    const age = patientData.profile?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (patientData.profile?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    
                    let msgContent = "";
                    if (isMinor) msgContent = `✅ Identificación Registrada.\n\nPasemos ahora a los datos de contacto. ¿Cuál es el **número de teléfono celular** de contacto para ${firstName} a 10 dígitos?`;
                    else msgContent = "✅ Identificación Registrada.\n\nPasemos ahora a sus datos de contacto. ¿Cuál es su **número de teléfono celular** a 10 dígitos?";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'tel'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_PHONE');
                    break;
                }

                case 'PHASE_1_PROFILE_PHONE': {
                    const phoneRegex = /^[0-9]{10}$/;
                    if (!phoneRegex.test(text.replace(/\D/g, ''))) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "El número debe tener exactamente 10 dígitos. Por favor verifíquelo.", avatar: tiloImg }]);
                        return;
                    }
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, phone: text.replace(/\D/g, '') }
                    }));

                    const ptCtx = patientData.profile.pediatric_profile;
                    const firstName = patientData.profile.first_name || patientData.identificacion?.nombres || "el paciente";
                    
                    const msgContent = (ptCtx && ptCtx.is_minor)
                        ? `Protocolo de entorno pediátrico activo. Como tutor legal de ${firstName}, le informamos que el entorno cultural impacta la adherencia nutricional infantil. Para la integración de su expediente NOM-004, ¿la familia profesa alguna religión con restricciones dietéticas?`
                        : `Protocolo de adecuación cultural activo. ${firstName}, para garantizar que su plan metabólico respete sus principios éticos o espirituales, ¿profesa alguna religión que debamos registrar en su expediente bajo la NOM-004?`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "✅ Sí", value: "SI" },
                            { label: "❌ No / Ninguna", value: "NO_NINGUNA" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_RELIGION');
                    break;
                }

                case 'PHASE_1_PROFILE_RELIGION': {
                    const hasReligion = text === "SI" || text.toLowerCase() === "sí" || text.toLowerCase() === "si" || text === "✅ Sí";

                    const ptCtx = patientData.profile?.pediatric_profile;
                    if (hasReligion) {
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, has_religion: true }
                        }));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: (ptCtx && ptCtx.is_minor) ? `Para considerar cualquier restricción alimentaria en el menú de ${patientData.profile?.first_name || "el paciente"}, ¿me podría indicar cuál es?` : "Para considerar cualquier restricción alimentaria en su menú, ¿me podría indicar cuál es?",
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "Adventista", value: "Adventista" },
                                { label: "Budista", value: "Budista" },
                                { label: "Católico", value: "Católico" },
                                { label: "Cristiano", value: "Cristiano" },
                                { label: "Judío", value: "Judío" },
                                { label: "Mormón", value: "Mormón" },
                                { label: "Musulmán", value: "Musulmán" },
                                { label: "Otra", value: "Otra" },
                                { label: "Testigo de Jehová", value: "Testigo de Jehová" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_RELIGION_SPEC');
                    } else {
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, has_religion: false, religion: "Ninguna" }
                        }));

                        const ptCtx = patientData.profile.pediatric_profile;
                        if (ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false) {
                            const newData = {
                                ...patientData,
                                profile: { ...patientData.profile, has_religion: false, religion: "Ninguna", marital_status: ptCtx.ui_controls.auto_fill_marital }
                            };
                            setPatientData(newData);
                            triggerPhase1Summary(newData);
                        } else {
                            const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: (ptCtx && ptCtx.is_minor) ? `¿Cuál es el **Estado Civil** legal de ${patientData.profile?.first_name || "el paciente"}?` : "¿Cuál es su **Estado Civil** legal?",
                                avatar: tiloImg,
                                options: [
                                    { label: getGenderedTerm('Soltero', sx), value: getGenderedTerm('Soltero', sx) },
                                    { label: getGenderedTerm('Casado', sx), value: getGenderedTerm('Casado', sx) },
                                    { label: "Unión Libre", value: "Unión Libre" },
                                    { label: getGenderedTerm('Divorciado', sx), value: getGenderedTerm('Divorciado', sx) },
                                    { label: getGenderedTerm('Viudo', sx), value: getGenderedTerm('Viudo', sx) }
                                ]
                            }]);
                            setCurrentPhase('PHASE_1_PROFILE_MARITAL');
                        }
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_RELIGION_SPEC': {
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, religion: formatText(text) }
                    }));

                    const ptCtx = patientData.profile.pediatric_profile;
                    if (ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false) {
                        const newData = {
                            ...patientData,
                            profile: { ...patientData.profile, religion: formatText(text), marital_status: ptCtx.ui_controls.auto_fill_marital }
                        };
                        setPatientData(newData);
                        triggerPhase1Summary(newData);
                    } else {
                        const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: (ptCtx && ptCtx.is_minor) ? `¿Cuál es el **Estado Civil** legal de ${patientData.profile?.first_name || "el paciente"}?` : "¿Cuál es su **Estado Civil** legal?",
                            avatar: tiloImg,
                            options: [
                                { label: getGenderedTerm('Soltero', sx), value: getGenderedTerm('Soltero', sx) },
                                { label: getGenderedTerm('Casado', sx), value: getGenderedTerm('Casado', sx) },
                                { label: "Unión Libre", value: "Unión Libre" },
                                { label: getGenderedTerm('Divorciado', sx), value: getGenderedTerm('Divorciado', sx) },
                                { label: getGenderedTerm('Viudo', sx), value: getGenderedTerm('Viudo', sx) }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_MARITAL');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_MARITAL': {
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, marital_status: text }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_PROFILE_ZIPCODE': {
                    const zipInput = text.trim();
                    if (!/^\d{5}$/.test(zipInput)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "El Código Postal debe ser numérico y tener exactamente 5 dígitos. Por favor intente nuevamente:", avatar: tiloImg }]);
                        return;
                    }

                    // Tilo replies while thinking:
                    setMessages(prev => [...prev, { role: 'assistant', content: "Buscando colonias...", avatar: tiloImg }]);

                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                    fetch(`${apiUrl}/api/cp/${zipInput}`)
                        .then(res => res.json())
                        .then(data => {
                            if (!data.colonias || data.colonias.length === 0) {
                                throw new Error("No colonies found");
                            }

                            setPatientData(prev => ({
                                ...prev,
                                profile: {
                                    ...prev.profile,
                                    address: {
                                        ...prev.profile.address,
                                        zip_code: zipInput,
                                        municipality: data.municipio,
                                        state: data.estado
                                    }
                                },
                                domicilio: {
                                    ...prev.domicilio,
                                    cp: zipInput,
                                    municipio: data.municipio, // Legacy support
                                    estado: data.estado
                                }
                            }));

                            setMessages(prev => {
                                const withoutThinking = prev.slice(0, prev.length - 1);
                                return [...withoutThinking, {
                                    role: 'assistant',
                                    content: `He encontrado estas colonias en ${data.municipio}, ${data.estado}. Por favor seleccione la correspondiente:`,
                                    inputType: 'strict_select',
                                    options: data.colonias.map(c => ({ label: c, value: c }))
                                }];
                            });
                            setCurrentPhase('PHASE_1_PROFILE_COLONY');
                        })
                        .catch(err => {
                            console.error("CP Lookup Error:", err);
                            setMessages(prev => {
                                const withoutThinking = prev.slice(0, prev.length - 1);
                                return [...withoutThinking, {
                                    role: 'assistant',
                                    content: (patientData.profile?.pediatric_profile?.is_minor) ? `Ese código postal no se encuentra en la base de datos nacional. Por favor verifique e ingrese el **Código Postal** de ${patientData.profile?.first_name || "el paciente"} nuevamente:` : "Ese código postal no se encuentra en la base de datos nacional. Por favor verifique e ingrese su **Código Postal** nuevamente:",
                                    inputType: 'number'
                                }];
                            });
                            // No cambiamos la fase, nos quedamos en PHASE_1_PROFILE_ZIPCODE
                        });

                    return; // Retornamos para evitar fallthrough porque la consulta es asíncrona
                }

                case 'PHASE_1_PROFILE_STATE_MANUAL': {
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, address: { ...prev.profile.address, state: formatText(text) } },
                        domicilio: { ...prev.domicilio, estado: formatText(text) }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: (patientData.profile?.pediatric_profile?.is_minor) ? `¿Cuál es el **Municipio / Delegación** de residencia de ${patientData.profile?.first_name || "el paciente"}?` : "¿Cuál es su **Municipio / Delegación**?",
                        inputType: 'text'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_MUNICIPALITY_MANUAL');
                    break;
                }

                case 'PHASE_1_PROFILE_MUNICIPALITY_MANUAL': {
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, address: { ...prev.profile.address, municipality: formatText(text) } },
                        domicilio: { ...prev.domicilio, municipio: formatText(text) }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: (patientData.profile?.pediatric_profile?.is_minor) ? `Entendido. Ahora, por favor escriba la **Colonia/Asentamiento** de residencia de ${patientData.profile?.first_name || "el paciente"}:` : "Entendido. Ahora, por favor escriba su **Colonia/Asentamiento**:",
                        inputType: 'text'
                    }]);
                    // Redirect back to normal colony logic, which expects a text response and sets the colony, then asks for street
                    setCurrentPhase('PHASE_1_PROFILE_COLONY');
                    break;
                }

                case 'PHASE_1_PROFILE_COLONY': {
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, address: { ...prev.profile.address, colony: formatText(text) } },
                        domicilio: { ...prev.domicilio, colonia: formatText(text) }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: (patientData.profile?.pediatric_profile?.is_minor) ? `Finalmente, ¿cuál es la **Calle y Número exterior/interior** de la residencia de ${patientData.profile?.first_name || "el paciente"}?` : "Finalmente, ¿cuál es su **Calle y Número exterior/interior**?",
                        inputType: 'text'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_STREET');
                    break;
                }

                case 'PHASE_1_PROFILE_STREET': {
                    const cleanStreet = formatText(text);

                    // Validación explícita de Calle y Número 
                    // Permite letras, números y espacios (e.g. "morelos 13")
                    if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ0-9\s#\-.,]+$/.test(cleanStreet) || cleanStreet.length < 3) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, ingrese un nombre de calle y número válidos (ej. Morelos 13).",
                            avatar: tiloImg
                        }]);
                        return; // No avanza si falla la validación
                    }

                    // Tilo replies while thinking:
                    setMessages(prev => [...prev, { role: 'assistant', content: "Sincronizando coordenadas cartográficas...", avatar: tiloImg }]);

                    const fullAddressToSearch = `${cleanStreet}, ${patientData.domicilio?.colonia || ''}, ${patientData.domicilio?.cp || ''}, ${patientData.domicilio?.municipio || ''}, ${patientData.domicilio?.estado || ''}, México`;

                    // V37.6 Auto-Geocoding with Cartographic Validation Gate
                    try {
                        const geocodeAsync = (address) => {
                            return new Promise((resolve, reject) => {
                                if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
                                    return reject(new Error("Google Maps API no disponible."));
                                }
                                const geocoder = new window.google.maps.Geocoder();
                                geocoder.geocode({ address }, (results, status) => {
                                    if (status === 'OK' && results && results.length > 0) {
                                        resolve(results);
                                    } else {
                                        reject(new Error("Geocode status: " + status));
                                    }
                                });
                            });
                        };

                        // Race contra timeout de 4 segundos para evitar freeze si Google Maps no responde
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error("Geocoding timeout - La API tardó demasiado")), 4000)
                        );

                        const results = await Promise.race([
                            geocodeAsync(fullAddressToSearch),
                            timeoutPromise
                        ]);
                        
                        console.log("📍 [Córtex Geocoder] Resolve results:", results);
                        const lat = results[0].geometry.location.lat();
                        const lng = results[0].geometry.location.lng();
                        const coords = { lat, lng };
                        const formattedAddress = results[0].formatted_address;

                        setPatientData(prev => ({
                            ...prev,
                            profile: { 
                                ...prev.profile, 
                                address: { 
                                    ...prev.profile.address, 
                                    street: cleanStreet // Keep user input intact
                                } 
                            },
                            domicilio: { 
                                ...prev.domicilio, 
                                calle: cleanStreet, // Keep user input intact
                                direccion_capturada_usuario: fullAddressToSearch,
                                direccion_googlemaps: formattedAddress,
                                coordinates: coords,
                                addressStatus: 'VERIFIED'
                            }
                        }));
                        console.log("📍 [Córtex Geocoder] Coordenadas obtenidas y guardadas exitosamente:", coords);
                        
                        // GATE VALIDATION: Pide que el usuario lo verifique visualmente
                        const ptCtx = patientData.profile?.pediatric_profile;
                        const patientFirstName = patientData.profile?.first_name || 'Paciente';
                        const tutorName = ptCtx?.tutor_first_name ? ptCtx.tutor_first_name : 'Tutor';
                        const addressedName = ptCtx?.is_minor ? tutorName : patientFirstName;
                        
                        setMessages(prev => {
                            const withoutThinking = prev.slice(0, prev.length - 1);
                            return [...withoutThinking, {
                                role: 'assistant',
                                content: `🗺️ Ubicación cartográfica sincronizada. **${addressedName}**, he vinculado las coordenadas de su residencia al análisis de determinantes ambientales para ${ptCtx?.is_minor ? 'el expediente clínico del paciente' : 'su expediente clínico'}.\n\nPor favor, revise el Domicilio Geográfico en el panel lateral. Esta es la dirección que nos entregó Google Maps:\n\n📍 Google Maps: **${formattedAddress || "No disponible"}**\n\n¿La ubicación marcada en el mapa y los datos en el panel son correctos?`,
                                avatar: tiloImg,
                                inputType: 'strict_select',
                                options: [
                                    { label: '✅ CONFIRMAR Y GUARDAR', value: 'MAP_VALID' },
                                    { label: '⚠️ CORREGIR DATOS', value: 'MAP_INVALID' }
                                ]
                            }];
                        });
                        setCurrentPhase('PHASE_1_MAP_VALIDATION');
                        return;

                    } catch (err) {
                        console.error("📍 [Córtex Geocoder] Fallo en Geocoding automático, fallback a validación manual:", err);
                        
                        // Fallback manual si Google falla
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, address: { ...prev.profile.address, street: cleanStreet } },
                            domicilio: { ...prev.domicilio, calle: cleanStreet, addressStatus: 'PENDING' }
                        }));
                        
                        setMessages(prev => {
                            const withoutThinking = prev.slice(0, prev.length - 1);
                            return [...withoutThinking, {
                                role: 'assistant',
                                content: "No he podido sincronizar automáticamente las coordenadas del mapa con precisión. Por favor, **valide manualmente su ubicación** rellenando la Calle en el Domicilio Geográfico del panel lateral o arrastrando el marcador, ya que es requerido bajo la NOM-004.\n\n¿Ha completado la validación manual o desea capturar su calle otra vez?",
                                avatar: tiloImg,
                                inputType: 'strict_select',
                                options: [
                                    { label: '✅ Sí, ya lo revisé y está correcto', value: 'MAP_VALID' },
                                    { label: '⚠️ Corregir nuevamente', value: 'MAP_INVALID' }
                                ]
                            }];
                        });
                        setCurrentPhase('PHASE_1_MAP_VALIDATION');
                        return;
                    }
                }

                case 'PHASE_1_MAP_VALIDATION': {
                    const ptCtx = patientData.profile?.pediatric_profile;
                    const patientFirstName = patientData.profile?.first_name || 'Paciente';
                    const tutorName = ptCtx?.tutor_first_name ? ptCtx.tutor_first_name : 'Tutor';
                    const addressedName = ptCtx?.is_minor ? tutorName : patientFirstName;
                    
                    if (text === 'MAP_INVALID') {
                        // Resets address logic
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, address: {} },
                            domicilio: { ...prev.domicilio, cp: "", estado: "", municipio: "", colonia: "", calle: "", direccion_googlemaps: "", coordinates: null, addressStatus: 'PENDING' }
                        }));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Entendido **${addressedName}**. Reiniciando la captura cartográfica para garantizar precisión legal. Por favor, ingrese su **Código Postal** nuevamente:`,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_ZIPCODE');
                        break;
                    }

                    // MAP_VALID
                    console.log("💾 CHECKPOINT 3: Domicilio Completado y Validado por Google Maps.");
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || 'el paciente';
                    const msgContent = isMinor
                        ? `En caso de emergencia, ¿quién es el contacto responsable o tutor de ${pName}? Necesito su **nombre completo**.`
                        : "En caso de emergencia, ¿quién es su contacto responsable? Necesito su **nombre completo**.";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'text'
                    }]);
                    setCurrentPhase('PHASE_2_EMERGENCY_NAME');
                    break;
                }

                // =============== FASE 1: CICLO DE CORRECCIÓN ===============
                case 'PHASE_1_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        console.log("💾 CHECKPOINT 2: Fase 1 (NOM-004 Demographics) Identificación Validada.");
                        const ptCtx = patientData.profile.pediatric_profile;
                        const isMinor = ptCtx?.is_minor;
                        const pName = patientData.profile.first_name || 'paciente';
                        const tName = ptCtx?.tutor_first_name || patientData.identificacion?.emergency_contact_name?.split(' ')[0] || 'Tutor';
                        const introStr = isMinor ? `${tName}, e` : `E`;
                        
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: isMinor ? `${introStr}ntendido. Pasemos al domicilio de ${pName}. ¿Podría indicarme el **Código Postal**?` : "Entendido. Pasemos a su domicilio. ¿Podría indicarme su **Código Postal**?",
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_ZIPCODE');
                    } else if (text === 'no') {
                        const p = patientData.profile || patientData.identificacion || {};
                        const ptCtx = p.pediatric_profile;
                        const showMarital = !(ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false);

                        const options = [
                                { label: 'Teléfono', value: 'PHONE' },
                                { label: 'Religión', value: 'RELIGION' }
                        ];
                        
                        if (showMarital) {
                            options.push({ label: 'Estado Civil', value: 'MARITAL' });
                        }
                        
                        options.push(
                                { label: '⚠️ Error en Identidad (Nombre, CURP, Sexo, Fecha)', value: 'INVALIDATE_IDENTITY' },
                                { label: 'Cancelar Corrección', value: 'CANCEL' }
                        );

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Qué dato necesita corregir?",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: options
                        }]);
                        setCurrentPhase('PHASE_1_CORRECTION_SELECT');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_1_CORRECTION_SELECT': {
                    if (text === 'CANCEL') {
                        triggerPhase1Summary(patientData);
                    } else if (text === 'INVALIDATE_IDENTITY') {
                        clearSession();
                        setMessages([{
                            role: 'assistant',
                            content: "⚠️ **Protocolo de Invalidación Activado**\n\nDirector, si la identidad base (Nombre, CURP, Sexo o Fecha de Nacimiento) es incorrecta en esta etapa, el expediente pierde validez legal. Se ha forzado el cierre del folio para protección de la NOM-004. Por favor, reinicie la toma de datos.",
                            avatar: tiloImg
                        }]);
                        break;
                    } else if (text === 'PHONE') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba su **Teléfono Correcto** a 10 dígitos:",
                            avatar: tiloImg,
                            inputType: 'tel'
                        }]);
                        setCurrentPhase('PHASE_1_CORRECT_PHONE');
                    } else if (text === 'RELIGION') {
                        const ptCtx = patientData.profile?.pediatric_profile;
                        const isMinor = ptCtx?.is_minor;
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: isMinor ? "¿Qué **Religión** profesan en su hogar?" : "¿Qué **Religión** profesa?",
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "Adventista", value: "Adventista" },
                                { label: "Budista", value: "Budista" },
                                { label: "Católico", value: "Católico" },
                                { label: "Cristiano", value: "Cristiano" },
                                { label: "Judío", value: "Judío" },
                                { label: "Mormón", value: "Mormón" },
                                { label: "Musulmán", value: "Musulmán" },
                                { label: "Ninguna", value: "Ninguna" },
                                { label: "Otra", value: "Otra" },
                                { label: "Testigo de Jehová", value: "Testigo de Jehová" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_CORRECT_RELIGION');
                    } else if (text === 'MARITAL') {
                        const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Cuál es su **Estado Civil** legal?",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: getGenderedTerm('Soltero', sx), value: getGenderedTerm('Soltero', sx) },
                                { label: getGenderedTerm('Casado', sx), value: getGenderedTerm('Casado', sx) },
                                { label: "Unión Libre", value: "Unión Libre" },
                                { label: getGenderedTerm('Divorciado', sx), value: getGenderedTerm('Divorciado', sx) },
                                { label: getGenderedTerm('Viudo', sx), value: getGenderedTerm('Viudo', sx) }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_CORRECT_MARITAL');
                    }
                    break;
                }

                case 'PHASE_1_CORRECT_PHONE': {
                    const phoneRegex = /^[0-9]{10}$/;
                    const cleanPhone = text.replace(/\D/g, '');
                    if (!phoneRegex.test(cleanPhone)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "El número debe tener exactamente 10 dígitos. Por favor intente nuevamente.", avatar: tiloImg }]);
                        return;
                    }
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, phone: cleanPhone }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_CORRECT_ADDRESS': {
                     const cleanAddr = formatText(text);
                     if(cleanAddr.length < 10) {
                          setMessages(prev => [...prev, { role: 'assistant', content: "Por favor, escriba el domicilio completo.", avatar: tiloImg }]);
                          return;
                     }
                     const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, address: { ...patientData.profile.address, street: cleanAddr, colony: "", zip_code: "", municipality: "", state: "" } },
                        domicilio: { ...patientData.domicilio, calle: cleanAddr, colonia: "", cp: "", municipio: "", estado: "" }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_CORRECT_SEX': {
                    const sx = (text === 'Masculino') ? 'Masculino' : 'Femenino';
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, sex: sx },
                        identificacion: { ...patientData.identificacion, sexo: sx }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_CORRECT_RELIGION': {
                    const rlg = formatText(text);
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, religion: rlg },
                        identificacion: { ...patientData.identificacion, religion: rlg }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_CORRECT_MARITAL': {
                    const mar = text;
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, civil_status: mar },
                        identificacion: { ...patientData.identificacion, estadoCivil: mar }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                // =============== FASE 2: SEGURIDAD ===============
                case 'PHASE_2_EMERGENCY_NAME': {
                    const eName = formatText(text);
                    const inferredGender = inferGenderFromName(eName);

                    setPatientData(prev => ({
                        ...prev,
                        profile: {
                            ...prev.profile,
                            emergencyContact: {
                                ...prev.profile.emergencyContact,
                                name: eName,
                                inferred_sex: inferredGender
                            }
                        },
                        emergencia: {
                            ...prev.emergencia,
                            nombre: eName
                        }
                    }));

                    const age = patientData.profile.age || 0;
                    const patientFirstName = (patientData.identificacion.nombre || "Paciente").split(' ')[0];
                    let msgContent = "";

                    // Trifurcación de Edad - Texto Hablado
                    if (age < 12) {
                        msgContent = `¿Qué parentesco tiene ${eName} con ${patientFirstName}?`;
                    } else if (age >= 12 && age < 18) {
                        msgContent = `${patientFirstName}, ¿qué parentesco tiene ${eName} contigo?`;
                    } else {
                        msgContent = `${patientFirstName}, ¿qué parentesco tiene ${eName} con usted?`;
                    }

                    // Dinámica de Botones (Cruce de Edad + Género)
                    let kinshipOptions = [];
                    if (inferredGender === 'FEMALE') {
                        if (age < 12 || (age >= 12 && age < 18)) {
                            kinshipOptions = ['Madre', 'Abuela', 'Tía', 'Hermana Mayor', 'Otra Familiar'];
                        } else {
                            kinshipOptions = ['Esposa / Pareja', 'Madre', 'Hija', 'Hermana', 'Amiga', 'Otra Familiar'];
                        }
                    } else {
                        if (age < 12 || (age >= 12 && age < 18)) {
                            kinshipOptions = ['Padre', 'Abuelo', 'Tío', 'Hermano Mayor', 'Otro Familiar'];
                        } else {
                            kinshipOptions = ['Esposo / Pareja', 'Padre', 'Hijo', 'Hermano', 'Amigo', 'Otro Familiar'];
                        }
                    }

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'KinshipSlider',
                        options: kinshipOptions.map(opt => ({ label: opt, value: opt }))
                    }]);

                    setCurrentPhase('PHASE_2_EMERGENCY_RELATION');
                    break;
                }

                case 'PHASE_2_EMERGENCY_RELATION': {
                    const eRelation = formatText(text);
                    setPatientData(prev => {
                        const isTutor = ['tutor', 'madre', 'padre'].includes(eRelation.toLowerCase());
                        const emergencyName = prev.profile?.emergencyContact?.name || "";
                        const tutorFirstName = isTutor && emergencyName ? emergencyName.split(' ')[0] : null;

                        const updatedProfile = {
                            ...prev.profile,
                            emergencyContact: { ...prev.profile.emergencyContact, kin: eRelation }
                        };

                        if (tutorFirstName && updatedProfile.pediatric_profile) {
                            updatedProfile.pediatric_profile.tutor_first_name = tutorFirstName;
                        }

                        return {
                            ...prev,
                            profile: updatedProfile,
                            emergencia: {
                                ...prev.emergencia,
                                parentesco: eRelation
                            }
                        };
                    });
                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const msgContent = isMinor
                        ? "¿Me dicta el **teléfono** a 10 dígitos de esa persona?"
                        : "¿Me dicta el **número de teléfono** a 10 dígitos de esa persona?";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'tel'
                    }]);
                    setCurrentPhase('PHASE_2_EMERGENCY_PHONE');
                    break;
                }

                case 'PHASE_2_EMERGENCY_PHONE': {
                    const phoneRegex = /^[0-9]{10}$/;
                    const cleanPhone = text.replace(/\D/g, '');

                    if (!phoneRegex.test(cleanPhone)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "El número debe tener exactamente 10 dígitos. Por favor verifíquelo.", avatar: tiloImg }]);
                        return;
                    }

                    // Duplication logic: For adults, emergency phone cannot match primary phone.
                    // For minors, bypass this restriction since the tutor's phone will often be the contact phone.
                    const curPtCtx = patientData.profile.pediatric_profile;
                    if (cleanPhone === patientData.profile.phone) {
                        if (!curPtCtx || !curPtCtx.is_minor) {
                            setMessages(prev => [...prev, { role: 'assistant', content: "El número de emergencia no puede ser el mismo que su número personal celular. Por favor proporcione otro:", avatar: tiloImg }]);
                            return;
                        }
                    }

                    const newData = {
                        ...patientData,
                        profile: {
                            ...patientData.profile,
                            emergencyContact: { ...patientData.profile.emergencyContact, phone: cleanPhone }
                        },
                        emergencia: {
                            ...patientData.emergencia,
                            telefono: cleanPhone
                        }
                    };
                    setPatientData(newData);
                    triggerPhase2Summary(newData);
                    break;
                }

                // =============== FASE 2: CICLO DE CORRECCIÓN ===============
                case 'PHASE_2_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        console.log("💾 CHECKPOINT 3: Fase 2 (Security Contact) Completada y Validada.");
                        // TRANSITION TO FASE 3: MOTIVO DE CONSULTA
                        setActiveTab('profile'); // Update UI Context to Clinical History Tab
                        setCurrentPhase('PHASE_3_MOTIVO_CONSULTA');
                    } else if (text === 'no') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Qué dato del contacto de emergencia necesita corregir?",
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: 'Nombre', value: 'NAME' },
                                { label: 'Parentesco', value: 'RELATION' },
                                { label: 'Teléfono', value: 'PHONE' },
                                { label: 'Cancelar', value: 'CANCEL' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_2_CORRECTION_SELECT');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_2_CORRECTION_SELECT': {
                    if (text === 'CANCEL') {
                        triggerPhase2Summary(patientData);
                    } else if (text === 'NAME') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba el **Nombre Completo Correcto** de su contacto de emergencia:",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_2_CORRECT_NAME');
                    } else if (text === 'RELATION') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba el **Parentesco Correcto** (Ej. Madre, Hermano, Amigo):",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_2_CORRECT_RELATION');
                    } else if (text === 'PHONE') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba el **Teléfono Correcto** a 10 dígitos:",
                            avatar: tiloImg,
                            inputType: 'tel'
                        }]);
                        setCurrentPhase('PHASE_2_CORRECT_PHONE');
                    }
                    break;
                }

                case 'PHASE_2_CORRECT_NAME': {
                    const cleanName = formatText(text).replace(/,/g, '').trim();
                    const inferredGender = inferGenderFromName(cleanName);
                    const newData = {
                        ...patientData,
                        profile: {
                            ...patientData.profile,
                            emergencyContact: { ...patientData.profile.emergencyContact, name: cleanName, inferred_sex: inferredGender }
                        },
                        emergencia: { ...patientData.emergencia, nombre: cleanName }
                    };
                    setPatientData(newData);
                    triggerPhase2Summary(newData);
                    break;
                }

                case 'PHASE_2_CORRECT_RELATION': {
                    const cleanRel = formatText(text);
                    const newData = {
                        ...patientData,
                        profile: {
                            ...patientData.profile,
                            emergencyContact: { ...patientData.profile.emergencyContact, kin: cleanRel }
                        },
                        emergencia: { ...patientData.emergencia, parentesco: cleanRel }
                    };
                    setPatientData(newData);
                    triggerPhase2Summary(newData);
                    break;
                }

                case 'PHASE_2_CORRECT_PHONE': {
                    const phoneRegex = /^[0-9]{10}$/;
                    const cleanPhone = text.replace(/\D/g, '');
                    if (!phoneRegex.test(cleanPhone)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "El número debe tener exactamente 10 dígitos. Por favor intente nuevamente.", avatar: tiloImg }]);
                        return;
                    }
                    const newData = {
                        ...patientData,
                        profile: {
                            ...patientData.profile,
                            emergencyContact: { ...patientData.profile.emergencyContact, phone: cleanPhone }
                        },
                        emergencia: { ...patientData.emergencia, telefono: cleanPhone }
                    };
                    setPatientData(newData);
                    triggerPhase2Summary(newData);
                    break;
                }

                // =============== FASE 3: MOTIVO DE CONSULTA ===============
                case 'PHASE_3_OPEN_PROMPT': {
                    // Extract text for analysis
                    setFase3State(prev => ({ ...prev, patient_quote: text }));

                    const analysis = await analyzeWithNeuralCortex(text);
                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || "Rosa";
                    const tName = ptCtx?.tutor_first_name || "Tutor";

                    setFase3State(prev => ({
                        ...prev,
                        alert_level: analysis.alert,
                        'detective_radiography.suspicion': analysis.suspicion,
                        clinical_category: analysis.category,
                        isGoal: analysis.isGoal,
                        isPregnant: analysis.isPregnant
                    }));

                    // Escudo Óptico de Crisis
                    if (analysis.alert === 'CRITICAL') {
                        const response = isMinor
                            ? `${tName}, lamento mucho leer esto. Entiendo que una noticia así genera mucha incertidumbre y preocupación. He marcado el caso de ${pName} como **Prioridad Médica Máxima**. Nuestro nutriólogo revisará esto con especial cuidado para diseñar un plan 100% seguro para ${pName}.\n\nAhora, imagine que logramos controlar este malestar y ${pName} recupera la tranquilidad. ¿Qué es lo primero que notará en su bienestar diario?`
                            : `${pName}, lamento mucho leer esto. Entiendo que una noticia así genera mucha incertidumbre y preocupación. He marcado su caso como **Prioridad Médica Máxima**. Su nutriólogo revisará esto con especial cuidado para diseñarle un plan 100% seguro.\n\nAhora, imagine que logramos controlar este malestar y usted recupera su tranquilidad. ¿Qué es lo primero que va a notar en su bienestar diario?`;
                        setFase3State(prev => ({ ...prev, specific_ailment: text }));

                        setMessages(prev => [...prev, { role: 'assistant', content: response, isCritical: true, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_MIRACLE_QUESTION');
                        break;
                    }

                    // Flujo Normal
                    let response = isMinor 
                        ? `Entiendo. Manejar temas de tipo **${analysis.suspicion.toLowerCase()}** en pediatría requiere mucha precisión. ¿Desde hace cuánto tiempo nota estos cambios en la vitalidad de ${pName}?`
                        : `Entiendo. Manejar temas de tipo **${analysis.suspicion.toLowerCase()}** requiere mucha precisión. ¿Desde hace cuánto tiempo nota estos cambios en su vitalidad?`;

                    if (analysis.isGoal) response = isMinor ? `Iniciar una arquitectura de optimización para la condición física de ${pName} es el primer paso hacia su desarrollo biológico óptimo. ¿Desde hace cuánto tiempo tienen este objetivo en mente?` : `Iniciar una arquitectura de optimización para su condición física es el primer paso hacia su soberanía biológica. ¿Desde hace cuánto tiempo tiene este objetivo en mente?`;
                    if (analysis.isPregnant) response = `Felicidades por esta etapa, ${pName}. ¿Desde hace cuántas semanas inició este hermoso proceso para sincronizar su arquitectura?`;
                    else if (analysis.category === 'PEDIATRICS') response = `Entiendo perfectamente, ${tName}. En el desarrollo de ${pName}, cada detalle es vital. ¿Desde hace cuánto tiempo notan estas molestias?`;
                    else if (analysis.category === 'SURGICAL') response = isMinor ? `Entiendo perfectamente, ${tName}. Los temas de cirugía o afecciones específicas requieren un enfoque nutricional muy preciso para reducir la inflamación y preparar el cuerpo de ${pName}.\n\n¿Desde hace cuánto tiempo notan estos cambios?` : `Entiendo perfectamente, ${pName}. Los temas de cirugía o afecciones específicas requieren un enfoque nutricional muy preciso para reducir la inflamación y preparar su cuerpo.\n\n¿Desde hace cuánto tiempo nota estos cambios?`;

                    setMessages(prev => [...prev, { role: 'assistant', content: response, avatar: tiloImg }]);
                    setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    break;
                }

                case 'PHASE_3_DETECTIVE_PROBE': {
                    const timeRegex = /\d|mes|año|semana|dia|siempre|hace|joven/i;
                    if (timeRegex.test(text)) {
                        setFase3State(prev => ({ ...prev, 'detective_radiography.chronology': text }));
                    }

                    const isPathology = fase3State.alert_level !== 'NONE';
                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || "el paciente";
                    
                    let miracleMsg = "";
                    if (isPathology) {
                        miracleMsg = isMinor
                            ? `Gracias por la claridad. Ahora, imagine que logramos estabilizar la salud de ${pName} y recuperar la tranquilidad. ¿Qué es lo primero que van a notar en su bienestar diario?`
                            : `Gracias por la claridad. Ahora, imagine que logramos estabilizar su salud y recuperar su tranquilidad. ¿Qué es lo primero que va a notar en su bienestar diario?`;
                    } else {
                        miracleMsg = isMinor
                            ? `Perfecto. Imagine que logran este objetivo. ¿Qué es lo primero que ${pName} va a poder hacer que hoy le cuesta trabajo?`
                            : `Perfecto. Imagine que logramos este objetivo. ¿Qué es lo primero que va a poder hacer que hoy le cuesta trabajo?`;
                    }

                    setMessages(prev => [...prev, { role: 'assistant', content: miracleMsg, avatar: tiloImg }]);
                    setCurrentPhase('PHASE_3_MIRACLE_QUESTION');
                    break;
                }

                case 'PHASE_3_MIRACLE_QUESTION': {
                    setFase3State(prev => ({ ...prev, emotional_anchor: text }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Gracias por su confianza. He analizado su reporte y he determinado su enfoque ideal.",
                        avatar: tiloImg
                    }]);

                    // Determinación del Goal (Inference)
                    let inferredGoal = 'Bienestar / Aprender a comer';
                    if (fase3State.isPregnant) inferredGoal = 'Gestación y Maternidad';
                    else if (fase3State.isGoal) inferredGoal = 'Rendimiento y Bienestar';
                    else {
                        const level = fase3State.alert_level;
                        if (level === 'PRETERM') inferredGoal = 'Nutrición para el Desarrollo';
                        else if (level === 'NEURO') inferredGoal = 'Salud Neuromotriz y Seguridad';
                        else if (level !== 'NONE') inferredGoal = 'Controlar Enfermedad';
                    }

                    // UPDATE DASHBOARD STATE TO SHOW INFERENCE CARD
                    setFase3State(prev => ({ ...prev, inferred_goal: inferredGoal, showInferenceCard: true }));

                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || 'el paciente';

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `Basado en el reporte de ${pName}, he determinado que el enfoque prioritario es:\n\n**${inferredGoal}**\n\n¿Están de acuerdo?`
                            : `Basado en su reporte, he determinado que su enfoque prioritario es:\n\n**${inferredGoal}**\n\n¿Es correcto?`,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "✅ Sí, es correcto", value: inferredGoal },
                            { label: "Preferiría elegir otro enfoque", value: "REJECT_INFERENCE" }
                        ]
                    }]);

                    setCurrentPhase('PHASE_3_INFERENCE_CONFIRM');
                    break;
                }

                case 'PHASE_3_INFERENCE_CONFIRM': {
                    // Esperando que el usuario haga click en los botones de "Sí, es correcto" o "Cambiar" generados por InputType
                    // En App.jsx hay lógica para los botones de inference_card. Asumiendo que mandan el string literal del approach:
                    if (text === 'REJECT_INFERENCE') {
                        const ptCtx = patientData.profile.pediatric_profile;
                        const isMinor = ptCtx?.is_minor;
                        const pName = patientData.profile.first_name || 'el paciente';

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: isMinor 
                                ? `¿Cuál considerarían que es el enfoque principal para ${pName}?`
                                : "¿Cuál consideraría usted que es su enfoque principal?",
                            avatar: tiloImg,
                            options: [
                                { label: "Controlar Enfermedad", value: "Controlar Enfermedad" },
                                { label: "Gestación y Maternidad", value: "Gestación y Maternidad" },
                                { label: "Rendimiento y Bienestar", value: "Rendimiento y Bienestar" },
                                { label: "Bienestar / Aprender a comer", value: "Bienestar / Aprender a comer" },
                                { label: "Nutrición Pediátrica", value: "Nutrición para el Desarrollo" }
                            ]
                        }]);
                        // Stay in same phase but next text will not trigger REJECT_INFERENCE
                        break;
                    }

                    // Aceptó o eligió otro
                    setFase3State(prev => ({ ...prev, goal_standard: text }));

                    // TRANSITION TO FASE 4: ANTECEDENTES HEREDOFAMILIARES
                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || 'el paciente';
                    const msgContent = isMinor
                        ? `Anotado. Mapa de prioridades establecido.\n\nPasemos a los Antecedentes Heredofamiliares.\n\n¿Los padres, abuelos o hermanos de ${pName} padecen alguna enfermedad crónica diagnosticada?`
                        : "Anotado. Mapa de prioridades establecido.\n\nPasemos a sus Antecedentes Heredofamiliares.\n\n¿Sus padres, abuelos o hermanos padecen alguna enfermedad crónica diagnosticada?";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ Objetivo registrado: **${text}**.\n\n` + msgContent,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "✅ Sí", value: "SI_HEREDO" },
                            { label: "❌ No", value: "NO_HEREDO" }
                        ]
                    }]);
                    setActiveTab('profile');
                    setCurrentPhase('PHASE_4_HEREDO_CONFIRM');
                    break;
                }

                // =============== FASE 4: ANTECEDENTES HEREDOFAMILIARES ===============
                case 'PHASE_4_HEREDO_CONFIRM': {
                    if (text === 'SI_HEREDO') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Por favor, descríbame ¿qué familiares padecen qué enfermedades? (Ej: Mi madre tiene hipertensión y mi abuelo materno diabetes).",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_4_HEREDO_START');
                    } else if (text === 'NO_HEREDO') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Comprendo. Aún así, para cumplir con la normativa clínica obligatoria, verifiquemos esta lista rápida. ¿Algún familiar directo padece alguna de estas?",
                            avatar: tiloImg,
                            options: [
                                { label: "Diabetes", value: "Diabetes" },
                                { label: "Hipertensión", value: "Hipertensión" },
                                { label: "Cáncer", value: "Cáncer" },
                                { label: "Enfermedades Cardíacas", value: "Enfermedades Cardíacas" },
                                { label: "Otras", value: "Otras" },
                                { label: "Ninguna", value: "Ninguna" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_4_SAFETY_GATE');
                    }
                    break;
                }

                case 'PHASE_4_HEREDO_START': {
                    const rawText = formatText(text);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            family_raw_text: rawText,
                            family_structured: prev.history?.family_structured || []
                        }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Para cumplir con la normativa clínica, ¿algún familiar directo padece alguna otra enfermedad de esta lista oficial?",
                        avatar: tiloImg,
                        options: [
                            { label: "Diabetes", value: "Diabetes" },
                            { label: "Hipertensión", value: "Hipertensión" },
                            { label: "Cáncer", value: "Cáncer" },
                            { label: "Enfermedades Cardíacas", value: "Enfermedades Cardíacas" },
                            { label: "Otras", value: "Otras" },
                            { label: "Ninguna", value: "Ninguna" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_4_SAFETY_GATE');
                    break;
                }

                case 'PHASE_4_SAFETY_GATE': {
                    if (text === "Otras") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor escriba qué otra enfermedad y qué familiar la padece.",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_4_OTHER_SPECIFIC');
                    } else if (text === "Ninguna") {
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...prev.history,
                                family_checklist_verified: true
                            }
                        }));
                        // TRANSITION TO FASE 5: ANTECEDENTES PERSONALES PATOLOGICOS
                        const ptCtx = patientData.profile.pediatric_profile;
                        const isMinor = ptCtx?.is_minor;
                        const pName = patientData.profile.first_name || 'el paciente';
                        const msgContent = isMinor
                            ? `Anotado. Mapa de riesgos familiares actualizado.\n\nPasemos al historial clínico de ${pName}, ¿padece o ha padecido alguna enfermedad crónica diagnosticada? (Ej. Hipotiroidismo, Resistencia a la Insulina, etc.)`
                            : "Anotado. Mapa de riesgos familiares actualizado.\n\nPasemos a su historial personal, ¿usted padece o ha padecido alguna enfermedad crónica diagnosticada? (Ej. Hipotiroidismo, Resistencia a la Insulina, etc.)";

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msgContent,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_5_PERSONAL_START');
                    } else {
                        // User selected a predefined pathology
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...prev.history,
                                family_structured: [
                                    ...(prev.history?.family_structured || []),
                                    { relative: 'UNKNOWN', condition: text, detail: text }
                                ]
                            }
                        }));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Registrado: ${text}. ¿Algún familiar padece otra de la lista?`,
                            avatar: tiloImg,
                            options: [
                                { label: "Diabetes", value: "Diabetes" },
                                { label: "Hipertensión", value: "Hipertensión" },
                                { label: "Cáncer", value: "Cáncer" },
                                { label: "Enfermedades Cardíacas", value: "Enfermedades Cardíacas" },
                                { label: "Otras", value: "Otras" },
                                { label: "Ninguna", value: "Ninguna" }
                            ]
                        }]);
                    }
                    break;
                }

                case 'PHASE_4_OTHER_SPECIFIC': {
                    const extraInfo = formatText(text);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            family_structured: [
                                ...(prev.history?.family_structured || []),
                                { relative: 'UNKNOWN', condition: 'OTHER', detail: extraInfo }
                            ]
                        }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Registrado: ${extraInfo}. ¿Algún familiar padece otra de la lista?`,
                        avatar: tiloImg,
                        options: [
                            { label: "Diabetes", value: "Diabetes" },
                            { label: "Hipertensión", value: "Hipertensión" },
                            { label: "Cáncer", value: "Cáncer" },
                            { label: "Enfermedades Cardíacas", value: "Enfermedades Cardíacas" },
                            { label: "Otras", value: "Otras" },
                            { label: "Ninguna", value: "Ninguna" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_4_SAFETY_GATE');
                    break;
                }

                // =============== FASE 5: ANTECEDENTES PERSONALES PATOLÓGICOS (APP) ===============
                case 'PHASE_5_PERSONAL_START': {
                    const rawText = formatText(text);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            personal_raw_text: rawText,
                            personal_structured: prev.history?.personal_structured || []
                        }
                    }));

                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const msgContent = isMinor
                        ? "Para asegurar que el expediente esté completo: Además de lo que ya mencionamos, ¿padece alguna otra condición de esta lista oficial?"
                        : "Para asegurar que su expediente esté completo: Además de lo que ya mencionamos, ¿padece alguna otra condición de esta lista oficial?";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        options: [
                            { label: "Diabetes (Tipo 1 o 2)", value: "Diabetes (Tipo 1 o 2)" },
                            { label: "Hipertensión Arterial", value: "Hipertensión Arterial" },
                            { label: "Hipotiroidismo / Tiroides", value: "Hipotiroidismo / Tiroides" },
                            { label: "Dislipidemia", value: "Dislipidemia" },
                            { label: "SOP", value: "SOP" },
                            { label: "Gastritis / Colitis", value: "Gastritis / Colitis" },
                            { label: "Artritis", value: "Artritis" },
                            { label: "Otras", value: "Otras" },
                            { label: "Ninguna", value: "Ninguna" }
                        ]
                    }]);
                    setActiveTab('profile'); // Ensured UI consistency
                    setCurrentPhase('PHASE_5_SAFETY_GATE');
                    break;
                }

                case 'PHASE_5_SAFETY_GATE': {
                    const phase5Options = [
                        { label: "Diabetes (Tipo 1 o 2)", value: "Diabetes (Tipo 1 o 2)" },
                        { label: "Hipertensión Arterial", value: "Hipertensión Arterial" },
                        { label: "Hipotiroidismo / Tiroides", value: "Hipotiroidismo / Tiroides" },
                        { label: "Dislipidemia", value: "Dislipidemia" },
                        { label: "SOP", value: "SOP" },
                        { label: "Gastritis / Colitis", value: "Gastritis / Colitis" },
                        { label: "Artritis", value: "Artritis" },
                        { label: "Otras", value: "Otras" },
                        { label: "Ninguna", value: "Ninguna" }
                    ];

                    if (text === "Otras") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor escriba qué otra enfermedad padece.",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_5_OTHER_SPECIFIC');
                    } else if (text === "Ninguna") {
                        const newData = {
                            ...patientData,
                            history: {
                                ...patientData.history,
                                personal_checklist_verified: true
                            }
                        };
                        setPatientData(newData);
                        triggerPhase5Summary(newData, fase3State);
                    } else {
                        // User selected a predefined pathology
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...prev.history,
                                personal_structured: [
                                    ...(prev.history?.personal_structured || []),
                                    { condition_category: text, specific_condition: text, status: 'ACTIVE', source: 'CHECKLIST' }
                                ]
                            }
                        }));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Registrado: ${text}. ¿Padece alguna otra condición de la lista?`,
                            avatar: tiloImg,
                            options: phase5Options
                        }]);
                    }
                    break;
                }

                case 'PHASE_5_OTHER_SPECIFIC': {
                    const extraInfo = formatText(text);
                    const phase5Options = [
                        { label: "Diabetes (Tipo 1 o 2)", value: "Diabetes (Tipo 1 o 2)" },
                        { label: "Hipertensión Arterial", value: "Hipertensión Arterial" },
                        { label: "Hipotiroidismo / Tiroides", value: "Hipotiroidismo / Tiroides" },
                        { label: "Dislipidemia", value: "Dislipidemia" },
                        { label: "SOP", value: "SOP" },
                        { label: "Gastritis / Colitis", value: "Gastritis / Colitis" },
                        { label: "Artritis", value: "Artritis" },
                        { label: "Otras", value: "Otras" },
                        { label: "Ninguna", value: "Ninguna" }
                    ];

                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            personal_structured: [
                                ...(prev.history?.personal_structured || []),
                                { condition_category: 'OTHER', specific_condition: extraInfo, status: 'ACTIVE', source: 'CHECKLIST' }
                            ]
                        }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Registrado: ${extraInfo}. ¿Padece alguna otra condición de la lista?`,
                        avatar: tiloImg,
                        options: phase5Options
                    }]);
                    setCurrentPhase('PHASE_5_SAFETY_GATE');
                    break;
                }

                // =============== SUMMARY CONFIRMATIONS (PHASES 3 - 6) ===============
                case 'PHASE_3_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setCurrentPhase('PHASE_4_FAMILY_HISTORY');
                    } else if (text === 'no') {
                        setCurrentPhase('PHASE_3_MOTIVO_CONSULTA');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_4_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setCurrentPhase('PHASE_5_LIFESTYLE');
                    } else if (text === 'no') {
                        setCurrentPhase('PHASE_4_FAMILY_HISTORY');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_5_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setCurrentPhase('PHASE_6_PHARMACOLOGY');
                    } else if (text === 'no') {
                        setCurrentPhase('PHASE_5_LIFESTYLE');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_6_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setCurrentPhase('PHASE_7_HABITS');
                    } else if (text === 'no') {
                        setCurrentPhase('PHASE_6_PHARMACOLOGY');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_7_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setCurrentPhase('PHASE_8_DIGESTIVE');
                    } else if (text === 'no') {
                        setCurrentPhase('PHASE_7_HABITS');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                // =============== FASE 7: ALERGIAS (MIGRADO) ===============
                // La Fase 7 (Alergias Alimentarias y de Medicamentos) ha sido extraída
                // a su propio componente modular Fase7_Alergias.jsx

                // =============== FASE 8: SALUD DIGESTIVA (MIGRADO) ===============
                // Fase 8 extraída al componente Fase8_SaludDigestiva.jsx

                // =============== FASE 9: ESTADO FISIOLÓGICO (MIGRADO) ===============
                // Fase 9 extraída al componente Fase9_EstadoFisiologico.jsx



                // =============== FASE 10: HÁBITOS Y ESTILO DE VIDA (MIGRADO) ===============
                // Toda la Fase 10 (tabaco) y Fase 11 (alcohol, drogas, ejercicio, sueño) 
                // extraídas al componente Fase10_Habitos.jsx

                // ==========================================
                // FASE 12: NUTRICIÓN Y DIETA (Legacy Fase 5) - MIGRADO
                // Toda la lógica `PHASE_12_*` de aversiones, favoritos, R24H y FFQ
                // se ha pasado al componente independiente: Fase11_EvaluacionDietetica.jsx
                // ==========================================

                // ----------------------------------------------------------------------------------
                // FASE 13: BIOMÉTRICOS Y SIGNOS VITALES (LEGACY FASE 6)
                // ----------------------------------------------------------------------------------



                default:
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Lo siento, me he perdido en mis procesos mentales. ¿Podría repetir?",
                        avatar: tiloImg
                    }]);
                    break;
            }
        }, 500); // Pequeño retraso para dar sensación de "pensamiento"
    };

    return {
        currentPhase,
        messages,
        patientData,
        activeTab,
        processUserInput,
        setActiveTab,
        setPatientData, // Expose for MedicalDashboard direct edits
        setMessages,     // Expose for advanced UI manipulations (e.g. typing indicators)
        clearSession,
        setCurrentPhase,
        apiContext,       // <--- NEW EXPORT for Header & Persistence
        fase3State,
        setFase3State,
        triggerPhase1Summary,
        triggerPhase2Summary,
        triggerPhase3Summary,
        triggerPhase4Summary,
        triggerPhase5Summary,
        triggerPhase6Summary,
        triggerPhase7Summary
    };
};

export default useCortex;
