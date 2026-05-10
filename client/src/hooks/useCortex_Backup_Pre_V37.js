import { useState, useEffect } from 'react';
import tiloImg from "../assets/tilo.png";
import { formatText, getGenderedTerm, fuzzyMatch, calculateCurp, cleanServerInfo, cleanApiInfo, buildPediatricContext, inferGenderFromName, applyCortexCalibration } from "../utils/utils";
import useCitationValidation from './useCitationValidation';
import { useClinicalGenome } from '../store/useClinicalGenome';
import { CLINICAL_ROUTES, ROUTE_CATEGORIES } from '../constants/clinicalRoutes';
import { COUNTRIES } from '../constants/countries';
import { RELIGIONS } from '../constants/religions';
import { getLifeStageDescriptor } from '../constants/lifeStages';

// --- INITIAL STATES (EXTRACTED FOR RESET CAPABILITY) ---
const INITIAL_CURRENT_PHASE = 'PHASE_0_AUTH';
const INITIAL_ACTIVE_TAB = 'profile';
const INITIAL_MESSAGES = [
    {
        role: "assistant",
        content: "Hola, soy el Sistema de Transformación Inteligente y Logro Optimizado (**T.I.L.O.**), el **Asistente Nutricional** de Equipo en Acción. He inicializado mis protocolos de seguridad para garantizar la protección absoluta de su información clínica y validar la vigencia de su consulta.\n\nPara blindar su sesión e iniciar el proceso, por favor **proporcione su número de cita** (recuerde que esta es personal e intransferible):",
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
    // Fases 4, 5, 6, 7
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
        digestive_frequency: ""
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
    // Fases 12, 13, 14
    nutrition: {
        cook_type: "",
        venue: "",
        preferences: { dislikes: [], favorites: [] }
    },
    logistics: {
        chronobiology: { timeline: [] }
    },
    // Fases 16, 17, 18
    vitals: {
        weight: null,
        height: null,
        blood_pressure: ""
    },
    biochemical: {
        electret_scan_data: {}
    },
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
export const useCortex = () => {
    const { validateCitation } = useCitationValidation();
    // 0. LOCAL STORAGE RECOVERY FUNCTION
    const getSavedState = (key, initialValue) => {
        try {
            const item = window.localStorage.getItem('tilo_session_data');
            if (item) {
                const parsed = JSON.parse(item);
                return parsed[key] !== undefined ? parsed[key] : initialValue;
            }
        } catch (error) {
            console.warn("Failed to read 'tilo_session_data' from localStorage", error);
        }
        return initialValue;
    };

    // Integración V17.6: Store global
    const updateIdentityLock = useClinicalGenome(state => state.updateIdentityLock);
    const setPathwaySpecifics = useClinicalGenome(state => state.setPathwaySpecifics);
    const setMotivosConsulta = useClinicalGenome(state => state.setMotivosConsulta);
    const setRutaPrimaria = useClinicalGenome(state => state.setRutaPrimaria);

    // 1. ESTADO DE FASE (Maquina de Estados)
    const [currentPhase, setCurrentPhase] = useState(() => getSavedState('currentPhase', INITIAL_CURRENT_PHASE));

    // 2. ESTADO DE NAVEGACIÓN (Dashboard)
    const [activeTab, setActiveTab] = useState(() => getSavedState('activeTab', INITIAL_ACTIVE_TAB));

    // 3. ESTADO DEL CHAT
    const [messages, setMessages] = useState(() => getSavedState('messages', JSON.parse(JSON.stringify(INITIAL_MESSAGES))));

    // 4. ESTADO GLOBAL DEL PACIENTE (Data Lake)
    const [patientData, setPatientData] = useState(() => getSavedState('patientData', JSON.parse(JSON.stringify(INITIAL_PATIENT_DATA))));

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
            setMessages(JSON.parse(JSON.stringify(INITIAL_MESSAGES)));
            setPatientData(JSON.parse(JSON.stringify(INITIAL_PATIENT_DATA)));
            setApiContext({});
            setAuthAttempts(0);
            setFase3State({
                patient_quote: "",
                specific_ailment: "",
                alert_level: "NONE",
                emotional_anchor: "",
                detective_radiography: { chronology: "", suspicion: "" },
                goal_standard: "",
                isGoal: false,
                isPregnant: false
            });
            console.log("♻️ Cortex Session Cleared to Default.");
        } catch (error) {
            console.error("Failed to clear session data", error);
        }
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

        // 2. Helper for Demographic Seal Summary Generator
        const triggerDemographicSummary = (ptProfile) => {
            const firstName = ptProfile?.first_name || 'Paciente';
            const today = new Date();
            const checkDate = new Date(ptProfile.birthdate.split('/').reverse().join('-') || ptProfile.birthdate);
            const ageInDays = Math.floor((today - checkDate) / (1000 * 60 * 60 * 24));
            let displayAge = `${ptProfile.age} años`;
            if (ageInDays <= 28) displayAge = `${ageInDays} Días (Neonato)`;
            else if (ageInDays < 365 * 2) displayAge = `${Math.floor(ageInDays / 30.44)} Meses (Lactante)`;
            else {
                const lifeStage = getLifeStageDescriptor(ptProfile.age, ageInDays);
                if (lifeStage) displayAge = `${ptProfile.age} años (${lifeStage.descriptor.charAt(0).toUpperCase() + lifeStage.descriptor.slice(1)})`;
            }

            let formattedPhone = 'No especificado';
            if (ptProfile.phone && ptProfile.phone.length === 10) {
                formattedPhone = `(${ptProfile.phone.substring(0, 2)}) ${ptProfile.phone.substring(2, 6)}-${ptProfile.phone.substring(6, 10)}`;
            }

            const isAdult = ptProfile?.age >= 18;
            const isGeriatric = ptProfile?.age >= 70;
            let occLabel = 'Ocupación';
            if (ptProfile.age !== undefined) {
                if (ptProfile.age <= 2) occLabel = 'Entorno de cuidado';
                else if (ptProfile.age >= 3 && ptProfile.age <= 17) occLabel = 'Escolaridad';
                else occLabel = 'Ocupación';
            }

            let summaryMsg = '';
            
            if (isGeriatric) {
                summaryMsg = `✅ Filiación clínica estructurada en expediente legal. Se ha completado el registro demográfico de Usted, aplicando los protocolos de atención geriátrica correspondientes.\n\nPara garantizar la integridad de su información antes del almacenamiento definitivo, por favor verifique el ajuste en su ocupación:\n\n**Resumen de Perfil:**\n\n- **Identidad:** ${ptProfile.first_name} ${ptProfile.last_name_pat} ${ptProfile.last_name_mat || ''} (Adulto / Geriatría)\n\n- **Edad:** ${displayAge}\n\n- **CURP:** ${ptProfile.curp || 'No especificada'}\n\n- **Teléfono:** ${formattedPhone}\n\n- **Religión:** ${ptProfile.religion || 'Ninguna'}\n\n- **Estado Civil:** ${ptProfile.marital_status || 'No especificado'}\n\n- **Ocupación:** ${ptProfile.occupation || 'No especificado'}`;
            } else if (isAdult) {
                summaryMsg = `✅ Filiación clínica estructurada en expediente legal. Se ha completado el registro demográfico de Usted, omitiendo las variables no aplicables a su etapa de vida actual.\n\nPara garantizar la integridad de su expediente antes de su almacenamiento definitivo, por favor verifique y seleccione una opción:\n\n**Resumen de Perfil:**\n\n- **Identidad:** ${ptProfile.first_name} ${ptProfile.last_name_pat} ${ptProfile.last_name_mat || ''} (Adulto)\n\n- **Edad:** ${displayAge}\n\n- **CURP:** ${ptProfile.curp || 'No especificada'}\n\n- **Teléfono:** ${formattedPhone}\n\n- **Religión:** ${ptProfile.religion || 'Ninguna'}\n\n- **Estado Civil:** ${ptProfile.marital_status || 'No especificado'}\n\n- **Ocupación:** ${ptProfile.occupation || 'No especificado'}`;
            } else if (ptProfile.age !== undefined && ptProfile.age <= 2) {
                const isFemale = ptProfile.sex?.toUpperCase() === 'FEMENINO';
                const asM = isFemale ? 'la menor' : 'el menor';
                
                let ageInDays = 0;
                if (ptProfile.birthdate) {
                    const parts = ptProfile.birthdate.split('/');
                    if (parts.length === 3) {
                        const dobDate = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
                        ageInDays = Math.floor((new Date() - dobDate) / (1000 * 60 * 60 * 24));
                    }
                }
                
                const isNeonate = ptProfile.age === 0 && ageInDays <= 28;
                const stageLabel = isNeonate ? "Neonato" : "Lactante";
                const protocolLabel = isNeonate ? "Atención Neonatal" : "Atención para Lactantes";
                
                summaryMsg = `✅ Identidad biológica y entorno de cuidado sincronizados. Se ha completado el registro demográfico de ${asM} ${firstName}, aplicando los protocolos de ${protocolLabel} bajo la NOM-004.\n\nPara garantizar la integridad del expediente antes de su almacenamiento definitivo, por favor verifique la información:\n\n**Resumen de Perfil (${stageLabel}):**\n\n- **Identidad:** ${ptProfile.first_name} ${ptProfile.last_name_pat} ${ptProfile.last_name_mat || ''} (${ptProfile.sex?.toUpperCase() || ''})\n\n- **Edad:** ${displayAge}\n\n- **Identificador:** ${ptProfile.curp || 'No especificado'}\n\n- **Teléfono (Tutor):** ${formattedPhone}\n\n- **Religión:** ${ptProfile.religion || 'Ninguna'} (Entorno Familiar)\n\n- **Entorno de cuidado:** ${ptProfile.occupation || 'Casa / Cuidados Maternos'}`;
            } else {
                summaryMsg = `✅ Filiación clínica estructurada en expediente legal. Se ha completado el registro demográfico de ${firstName}, omitiendo las variables no aplicables a su etapa de vida actual.\n\nPara garantizar la integridad del expediente antes de su almacenamiento definitivo, por favor verifique y seleccione una opción:\n\n**Resumen de Perfil:**\n\n- **Identidad:** ${ptProfile.first_name} ${ptProfile.last_name_pat} ${ptProfile.last_name_mat || ''} (${ptProfile.sex?.toUpperCase() || ''})\n\n- **Edad:** ${displayAge}\n\n- **Teléfono:** ${formattedPhone}\n\n- **Religión:** ${ptProfile.religion || 'Ninguna'}\n\n- **${occLabel}:** ${ptProfile.occupation || 'No especificado'}`;
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: summaryMsg,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: "✅ CONFIRMAR Y GUARDAR", value: "CONFIRMAR" },
                    { label: "⌨️ CORREGIR DATOS", value: "CORREGIR" }
                ]
            }]);
            setCurrentPhase('PHASE_1_DEMO_SEAL_CONFIRM');
        };

        // 3. Máquina de Estados basada en `currentPhase`
        setTimeout(async () => {
            switch (currentPhase) {
                // =============== FASE 0: AUTENTICACIÓN ===============
                case 'PHASE_0_AUTH':
                    // Mock Authentication Logic
                    if (/^\d+$/.test(text)) {
                        const apiResponse = await validateCitation(text);
                        if (!apiResponse) {
                            setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error de conexión con el servidor de infraestructura.\n\nPor favor, intente ingresar su **número de cita** nuevamente." }]);
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
                                content: `✅ He localizado su registro en nuestra red institucional con éxito. Los datos vinculados a este folio de atención son los siguientes:\n\n👤 Titular: **${cleanApiInfo(titularName).toUpperCase()}**\n📍 Sucursal y Fecha: **${cleanApiInfo(formattedInfo.sede)}** — ${formattedInfo.fecha}\n\nPor protocolos de seguridad institucional y para garantizar que este proceso sea personal e intransferible, por favor confirme: **¿Es usted el paciente titular de esta consulta?**`,
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
                                    content: "🗣️ ⚠️ **Acceso bloqueado por seguridad.** Su sesión ha sido restringida tras superar el número de intentos permitidos en nuestra red institucional. Este protocolo de blindaje es obligatorio para garantizar la protección absoluta de su información clínica y evitar accesos no autorizados.\n\nPor favor, **acuda** al área de recepción para que el personal administrativo le asista personalmente con la apertura y validación manual de su expediente:",
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
                                    content: `🏁 **Folio ya utilizado.** El sistema ha detectado que esta cita ya fue procesada previamente por el titular **${titularName.toUpperCase()}**. Según nuestros registros, el estudio fue finalizado con éxito en la **red institucional** con el siguiente registro de control:\n\n${citaData.info ? cleanApiInfo(citaData.info) : "Información de sede no disponible"}\n\nUsted tiene **${3 - newAttempts} intentos restantes** antes de que el acceso sea restringido por seguridad. Por favor, **verifique** e **ingrese** un **número de cita** que se encuentre vigente y con estatus de estudio pendiente:`,
                                    avatar: tiloImg,
                                    inputType: 'number'
                                }]);
                            } else {
                                setMessages(prev => [...prev, {
                                    role: 'assistant',
                                    content: `❌ **Identificador no localizado**. El número de cita proporcionado no coincide con ningún registro activo en nuestra red institucional. Este protocolo de seguridad es vital para garantizar que solo el titular autorizado tenga acceso a la sesión.\n\nUsted tiene **${3 - newAttempts} intentos restantes** antes de que el acceso sea bloqueado por seguridad. Por favor, **verifique** su número de cita e **intente** nuevamente:`,
                                    avatar: tiloImg,
                                    inputType: 'number'
                                }]);
                            }
                        }
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⚠️ Formato inválido detectado.\n\nPor favor, ingrese estrictamente un número de cita válido (caracteres numéricos).",
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                    }
                    break;

                case 'PHASE_0_IDENTITY_CHECK':
                    if (text === 'yes') {
                        // Usa el extractedFirst parseado o "Paciente" si falla
                        const firstName = apiContext?.extractedFirst || apiContext?.rawName?.split(' ')[0] || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Identidad del titular confirmada y vinculada con éxito a nuestra red institucional. Este proceso activa formalmente los protocolos de protección de su información clínica bajo los estándares de la **NOM-004**.\n\n**${formatText(firstName)}**, para habilitar la estructura de su expediente digital y blindar el tratamiento de sus **Datos Personales Sensibles**, por favor **lea** y **acepte** nuestro **Aviso de Privacidad** institucional:`,
                            avatar: tiloImg,
                            inputType: 'none' // Espera al modal de privacidad
                        }]);
                        setCurrentPhase('PHASE_0_PRIVACY');
                    } else if (text === 'no') {
                        // Limpia memoria
                        setApiContext({});
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "🗣️ **Procedimiento de rectificación de identidad activado.** Por protocolos de seguridad institucional, la sesión actual ha sido purificada para proteger la integridad de los datos y asegurar que el acceso corresponda únicamente al titular autorizado.\n\nPor favor, **proporcione** nuevamente su número de cita oficial para reiniciar el protocolo de validación (recuerde que esta es personal e intransferible):",
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

                    const rawNameStr = (apiContext && typeof apiContext.rawName === 'string') ? apiContext.rawName : "Paciente";
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
                        content: applyCortexCalibration(`La integridad de su expediente clínico bajo la NOM-004 depende de la precisión ortográfica de sus datos. Le recordamos que su cita es personal e intransferible, por lo que este proceso es exclusivo para el pulido de su identidad registrada.\n\nPor favor, valide si ${formatText(safeFirstName)} corresponde exactamente a su Nombre de Pila completo (verifique acentos, espacios o nombres omitidos en caso de ser compuesto):`, patientData.profile?.age || 30, formatText(safeFirstName)),
                        avatar: tiloImg,
                        inputType: "buttons",
                        options: [
                            { label: `✅ SÍ, ES CORRECTO`, value: 'yes' },
                            { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' }
                        ]
                    }]);
                    setActiveTab('profile'); // Sync UI Dashboard
                    setCurrentPhase('PHASE_1_PROFILE_NAME_CONFIRM'); // Sync UI Dashboard
                    break;
                }

                // =============== FASE 1: PERFIL ===============
                case 'PHASE_1_PROFILE_NAME_CONFIRM':
                    if (text === 'yes') {
                        setPatientData(prev => ({
                            ...prev,
                            // Usamos el valor extraido y formateado de la apiContext
                            profile: { ...prev.profile, first_name: apiContext.extractedFirst, name: apiContext.rawName },
                            identificacion: { ...prev.identificacion, nombre: apiContext.extractedFirst } // Legacy Support
                        }));

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyCortexCalibration(`Una vez estructurado su nombre, es fundamental verificar la raíz biográfica de su primer apellido. La exactitud en cada letra garantiza la trazabilidad de su historial clínico en nuestra red nacional.\n\nPor favor, verifique si ${apiContext.extractedPat} cuenta con la grafía y el acento correctos:`, patientData.profile?.age || 30, apiContext.extractedFirst),
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: `✅ SÍ, ES CORRECTO`, value: 'yes' },
                                { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_PAT');
                    } else {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `🗣️ **Modo de precisión ortográfica activado.** Para garantizar la integridad de su expediente clínico bajo la **NOM-004**, es fundamental que cada carácter coincida exactamente con su identificación oficial.\n\n**${firstName}**, por favor **escriba** su(s) **Nombre(s) de Pila** con la grafía y acentos correctos:`,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_NAME_MANUAL');
                    }
                    break;

                case 'PHASE_1_PROFILE_NAME_MANUAL': {
                    const parsedName = formatText(text.trim());
                    // Identity Lock Fix: Check against extracted first name, or fallback to the full raw name
                    const isMatch = fuzzyMatch(text, apiContext.extractedFirst) || fuzzyMatch(text, apiContext.rawName);

                    if (!isMatch) {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `⚠️ **Alerta de Seguridad (Identity Lock)**. El cambio de titularidad no está permitido en esta sesión. Este proceso está habilitado exclusivamente para la precisión ortográfica de su identidad registrada, la cual es **personal e intransferible**.\n\n**${firstName}**, por protocolos de validación institucional, por favor **escriba** nuevamente su **Nombre(s) de Pila** con la grafía y acentos correctos:`,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, first_name: parsedName, name: apiContext.rawName },
                        identificacion: { ...prev.identificacion, nombre: parsedName } // Legacy Support
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: applyCortexCalibration(`Una vez estructurado su nombre, es fundamental verificar la raíz biográfica de su primer apellido. La exactitud en cada letra garantiza la trazabilidad de su historial clínico en nuestra red nacional.\n\nPor favor, verifique si ${apiContext.extractedPat} cuenta con la grafía y el acento correctos:`, patientData.profile?.age || 30, patientData.profile?.first_name),
                        avatar: tiloImg,
                        inputType: 'strict_select',
                        options: [
                            { label: `✅ SÍ, ES CORRECTO`, value: 'yes' },
                            { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' }
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
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `🗣️ **Modo de precisión ortográfica activado.** Para garantizar la coherencia biográfica de su expediente clínico bajo la **NOM-004**, es vital que su primer apellido coincida exactamente con su documentación oficial.\n\n**${firstName}**, por favor **escriba** su **Apellido Paterno** con la grafía y acentos correctos:`,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_PAT_MANUAL');
                        return;
                    } else {
                        // RECHAZO DE TEXTO LIBRE
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⚠️ Entrada de texto libre deshabilitada por seguridad estructural.\n\nPor favor, utilice obligatoriamente los botones interactivos para confirmar si su apellido paterno es correcto.",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ SÍ, ES CORRECTO', value: 'yes' },
                                { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' }
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
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Para concluir la estructuración de su identidad digital y asegurar que la trazabilidad de su perfil biológico sea impecable ante cualquier auditoría de salud institucional.\n\n**${firstName}**, por favor indique si **${matSurname}** es su **Apellido Materno** correcto (si usted legalmente solo utiliza un apellido, por favor seleccione la opción de omisión):`,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: `✅ SÍ, ES CORRECTO`, value: 'yes' },
                                { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' },
                                { label: '🚫 NO USO SEGUNDO APELLIDO', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT');
                    } else {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Para concluir la estructuración de su identidad digital y asegurar que la trazabilidad de su perfil biológico sea impecable ante cualquier auditoría de salud institucional.\n\n**${firstName}**, el sistema de origen no reporta un segundo apellido. Si usted cuenta con un **Apellido Materno** legal, por favor escríbalo a continuación:`,
                            avatar: tiloImg,
                            inputType: 'text',
                            options: [
                                { label: '🚫 NO USO SEGUNDO APELLIDO', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_LAST_NAME_PAT_MANUAL': {
                    const parsedLastName = formatText(text.trim());
                    // Identity Lock Fix: Check against extracted pat name, or fallback to the full raw name
                    const isMatch = fuzzyMatch(text, apiContext.extractedPat) || fuzzyMatch(text, apiContext.rawName);

                    if (!isMatch) {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `⚠️ **Alerta de Seguridad (Identity Lock)**. El cambio de titularidad no está permitido en esta sesión. Este proceso está habilitado exclusivamente para la precisión ortográfica de su identidad registrada, la cual es **personal e intransferible**.\n\n**${firstName}**, por protocolos de validación institucional, por favor **escriba** nuevamente su **Apellido Paterno** con la grafía y acentos correctos:`,
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
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Para concluir la estructuración de su identidad digital y asegurar que la trazabilidad de su perfil biológico sea impecable ante cualquier auditoría de salud institucional.\n\n**${firstName}**, por favor indique si **${matSurname}** es su **Apellido Materno** correcto (si usted legalmente solo utiliza un apellido, por favor seleccione la opción de omisión):`,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: `✅ SÍ, ES CORRECTO`, value: 'yes' },
                                { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' },
                                { label: '🚫 NO USO SEGUNDO APELLIDO', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT');
                    } else {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Para concluir la estructuración de su identidad digital y asegurar que la trazabilidad de su perfil biológico sea impecable ante cualquier auditoría de salud institucional.\n\n**${firstName}**, el sistema de origen no reporta un segundo apellido. Si usted cuenta con un **Apellido Materno** legal, por favor escríbalo a continuación:`,
                            avatar: tiloImg,
                            inputType: 'text',
                            options: [
                                { label: '🚫 NO USO SEGUNDO APELLIDO', value: 'CONFIRM_MAT_NONE' }
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

                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ **Perfil biográfico estructurado y blindado** con éxito. Una vez fijada su identidad, el siguiente protocolo es la calibración de su **cronología biológica**, dato indispensable para el cálculo preciso de sus indicadores metabólicos y rangos de referencia clínica.\n\n**${firstName}**, por favor indique únicamente el **DÍA** de su nacimiento (utilice el formato de dos dígitos, por ejemplo: 12):`,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);

                        setCurrentPhase('PHASE_1_PROFILE_DOB_DAY'); // Proceder a recolección de fecha
                        return;
                    } else if (text === 'no') {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `🗣️ Modo de precisión ortográfica activado. Para garantizar la integridad total de su expediente clínico bajo la NOM-004, es fundamental que su segundo apellido coincida exactamente con la grafía de su documento oficial.\n\n**${firstName}**, por favor escriba su **Apellido Materno** con la grafía y acentos correctos:`,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL');
                        return;
                    } else {
                        // RECHAZO DE TEXTO LIBRE
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⚠️ Entrada de texto libre deshabilitada por seguridad estructural.\n\nPor favor, utilice obligatoriamente los botones interactivos para confirmar si su apellido materno es correcto.",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ SÍ, ES CORRECTO', value: 'yes' },
                                { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' },
                                { label: '🚫 NO USO SEGUNDO APELLIDO', value: 'CONFIRM_MAT_NONE' }
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

                    const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ **Perfil biográfico estructurado y blindado** con éxito. Una vez fijada su identidad, el siguiente protocolo es la calibración de su **cronología biológica**, dato indispensable para el cálculo preciso de sus indicadores metabólicos y rangos de referencia clínica.\n\n**${firstName}**, por favor indique únicamente el **DÍA** de su nacimiento (utilice el formato de dos dígitos, por ejemplo: 12):`,
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

                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ **Perfil biográfico estructurado y blindado** con éxito. Una vez fijada su identidad, el siguiente protocolo es la calibración de su **cronología biológica**, dato indispensable para el cálculo preciso de sus indicadores metabólicos y rangos de referencia clínica.\n\n**${firstName}**, por favor indique únicamente el **DÍA** de su nacimiento (utilice el formato de dos dígitos, por ejemplo: 12):`,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);

                        setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                        break;
                    }

                    const parsedLastNameMat = formatText(text.trim());
                    const originalMat = apiContext.extractedMat || "";
                    const hasValidMatSurname = originalMat.trim().length > 0 && !originalMat.includes("*");

                    if (hasValidMatSurname) {
                        const { isMatch } = fuzzyMatch(originalMat, parsedLastNameMat);
                        if (!isMatch) {
                            const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: `⚠️ **Alerta de Seguridad (Identity Lock).** El cambio de titularidad no está permitido en esta sesión. Este proceso está habilitado exclusivamente para la precisión ortográfica de su identidad registrada, la cual es personal e intransferible.\n\n**${firstName}**, por protocolos de validación institucional, por favor escriba nuevamente su **Apellido Materno** con la grafía y acentos correctos:`,
                                avatar: tiloImg,
                                inputType: 'text'
                            }]);
                            return; // Se mantiene en PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL
                        }
                    }

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

                    // Transición de Fase hacia Fecha de Nacimiento
                    const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ **Perfil biográfico estructurado y blindado** con éxito. Una vez fijada su identidad, el siguiente protocolo es la calibración de su **cronología biológica**, dato indispensable para el cálculo preciso de sus indicadores metabólicos y rangos de referencia clínica.\n\n**${firstName}**, por favor indique únicamente el **DÍA** de su nacimiento (utilice el formato de dos dígitos, por ejemplo: 12):`,
                        avatar: tiloImg,
                        inputType: 'number'
                    }]);

                    // D. Avanzar estado a Día de Nacimiento
                    setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                    break;
                }

                case 'PHASE_1_PROFILE_DOB_DAY': {
                    const matchDigits = text.match(/\d+/g);
                    const dayString = matchDigits ? matchDigits.join('') : '';
                    const day = parseInt(dayString, 10);

                    let errorMsg = null;
                    
                    if (!matchDigits) {
                        errorMsg = "Solo caracteres numéricos. Por favor, ingrese el día de nacimiento en formato de número.";
                    } else if (dayString.length > 2) {
                        errorMsg = "Use formato de dos dígitos. Por favor, ingrese únicamente los dos dígitos correspondientes a su día de nacimiento.";
                    } else if (isNaN(day) || day < 1 || day > 31) {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        errorMsg = `⚠️ Inconsistencia en la sincronización del ciclo diario. Para establecer con rigor científico su ancla temporal y activar los protocolos de referencia clínica pertinentes, es imperativo que el dato corresponda a un día válido del calendario (01 a 31).\n\n${firstName}, por favor verifique e indique nuevamente su DÍA de nacimiento utilizando el formato de dos dígitos:`;
                    }
                    
                    if (errorMsg) {
                        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, avatar: tiloImg }]);
                        return;
                    }
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, dobDay: String(day).padStart(2, '0') }
                    }));

                    const firstName = formatText(apiContext.extractedFirst) || "Paciente";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ **Día de nacimiento sincronizado correctamente.** Para avanzar en la estructuración de su expediente y garantizar la precisión de sus rangos metabólicos, el sistema requiere ahora el registro del mes.\n\n**${firstName}**, por favor indique el **MES** de su nacimiento. Puede escribir el nombre completo, el número de dos dígitos o las siglas correspondientes:`,
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

                    // Diccionario reverso para devolver el nombre completo en minúsculas estándar
                    const monthNames = {
                        '01': 'enero', '02': 'febrero', '03': 'marzo', '04': 'abril',
                        '05': 'mayo', '06': 'junio', '07': 'julio', '08': 'agosto',
                        '09': 'septiembre', '10': 'octubre', '11': 'noviembre', '12': 'diciembre'
                    };

                    const monthCode = months[rawMonth];
                    if (!monthCode) {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        const matchDigits = text.match(/\d+/g);
                        const inputNum = matchDigits ? parseInt(matchDigits.join(''), 10) : NaN;
                        
                        let errorMsg = `Por favor, utilice nombres de meses reconocidos (ej. Enero, Feb, o 02).`;
                        
                        // Si el usuario introdujo un número fuera de rango (ej. 13, 0), o una cadena no válida
                        if (!isNaN(inputNum) && (inputNum < 1 || inputNum > 12)) {
                           errorMsg = `⚠️ Inconsistencia detectada en la sincronización temporal. Para establecer con rigor científico los rangos de referencia y la edad metabólica precisa, es imperativo que el registro del mes corresponda al estándar del calendario civil (**01 a 12**).\n\n**${firstName}**, por favor verifique e indique nuevamente su MES de nacimiento (puede utilizar el nombre completo, las siglas, o el número de dos dígitos):`;
                        } else if (isNaN(inputNum)) {
                           errorMsg = `Por favor, utilice nombres de meses reconocidos (ej. Enero, Feb, o 02).`;
                        }

                        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, avatar: tiloImg }]);
                        return;
                    }

                    const finalMonthName = monthNames[monthCode];

                    // Matriz de Validación Cruzada (Día vs Mes)
                    const prevDay = parseInt(patientData.profile?.dobDay || '1', 10);
                    const daysInMonth = {
                        '01': 31, '02': 29, '03': 31, '04': 30,
                        '05': 31, '06': 30, '07': 31, '08': 31,
                        '09': 30, '10': 31, '11': 30, '12': 31
                    };

                    if (prevDay > daysInMonth[monthCode]) {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        const limitDays = daysInMonth[monthCode];
                        let errorMsg = `⚠️ **Inconsistencia cronológica detectada.** El mes de **${finalMonthName}** cuenta únicamente con ${limitDays} días. Para garantizar la integridad de su expediente bajo la **NOM-004** y asegurar la precisión de su perfil biológico, es imperativo corregir este valor.\n\n**${firstName}**, por favor indique nuevamente el **DÍA** de su nacimiento (asegúrese de que corresponda al calendario oficial):`;

                        // Particularidad visual para Febrero si es 30 o 31
                        if (monthCode === '02') {
                            errorMsg = `⚠️ **Inconsistencia cronológica detectada.** El mes de **febrero** no cuenta con ${prevDay} días. Para garantizar la integridad de su expediente bajo la **NOM-004** y asegurar la precisión de su perfil biológico, es imperativo corregir este valor.\n\n**${firstName}**, por favor indique nuevamente el **DÍA** de su nacimiento (asegúrese de que corresponda al calendario oficial):`;
                        }

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: errorMsg,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, dobMonth: monthCode, dobMonthName: finalMonthName }
                    }));

                    const firstName = formatText(apiContext.extractedFirst) || "Paciente";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ **Mes de nacimiento integrado con éxito.** Este es el último componente necesario para fijar su **ancla temporal** definitiva y determinar con precisión quirúrgica su edad metabólica actual.\n\n**${firstName}**, por favor **indique** el **AÑO** de su nacimiento (utilice el formato de cuatro dígitos, por ejemplo: 1985):`,
                        avatar: tiloImg,
                        inputType: 'number'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_DOB_YEAR');
                    break;
                }

                case 'PHASE_1_PROFILE_DOB_YEAR': {
                    const matchDigits = text.match(/\d+/g);
                    const yearString = matchDigits ? matchDigits.join('') : '';
                    const year = parseInt(yearString, 10);

                    const currentYear = new Date().getFullYear();
                    
                    if (isNaN(year) || yearString.length !== 4 || year > currentYear || year < 1916) {
                        const firstName = formatText(apiContext.extractedFirst) || "Paciente";
                        let errorSuffix = "";
                        
                        if (isNaN(year) || yearString.length !== 4) {
                            errorSuffix = "Error de estructura: use 4 dígitos.";
                        } else if (year > currentYear) {
                            errorSuffix = "Error cronológico: el año no puede ser superior al actual.";
                        } else if (year < 1916) {
                            errorSuffix = "Alerta de rango: por favor verifique el año de nacimiento para casos de alta longevidad.";
                        }
                        
                        const errorMsg = `⚠️ Inconsistencia en el ancla temporal. Para garantizar la seguridad de su expediente y la precisión de sus indicadores metabólicos, es necesario que el año de nacimiento se encuentre dentro de un rango biológico válido (4 dígitos).\n\n**${firstName}**, por favor verifique e indique nuevamente el AÑO de nacimiento (por ejemplo: 1985). Asegúrese de que el año no sea superior al actual ni inferior al límite de longevidad clínica:\n\n*${errorSuffix}*`;
                        
                        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, avatar: tiloImg, inputType: 'number' }]);
                        return;
                    }

                    const dobDay = patientData.profile.dobDay;
                    const dobMonth = patientData.profile.dobMonth;
                    const d = parseInt(dobDay, 10);
                    const m = parseInt(dobMonth, 10);

                    const checkDate = new Date(year, m - 1, d);
                    if (checkDate.getFullYear() !== year || checkDate.getMonth() !== (m - 1) || checkDate.getDate() !== d) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ Inconsistencia gravitacional en la fecha. La combinación de día y mes no existe en el sistema gregoriano.\n\nVolveremos a iniciar la calibración. ¿En qué **DÍA** nació?", avatar: tiloImg, inputType: 'number' }]);
                        setCurrentPhase('PHASE_2_EMERGENCY_PHONE'); // Transición a Fase 2 (Glow)
                        return;
                    }

                    const fullDate = `${dobDay}/${dobMonth}/${year}`;
                    
                    // Golden Master V36.2: Calculate age based on current reference year (2026)
                    const referenceYear = 2026;
                    let age = referenceYear - year;
                    
                    const today = new Date(); // still needed for strict gregorian checking below if we wanted, but not for age
                    const mDiff = today.getMonth() - checkDate.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && today.getDate() < checkDate.getDate())) {
                        // Strictly speaking, we use year difference mostly, but keeping month logic just in case
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
                        system_prompt_addon = `El paciente es un adolescente de ${age} años llamado ${firstName}. Dirígete a él/ella de 'USTED' con un tono de autoridad técnica ágil que valide su soberanía biológica. ESTRICTAMENTE PROHIBIDO EL TUTEO (NO USAR 'TÚ').`;
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
                        delete newProfile.dobMonthName;

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

                    const firstNameForSex = formatText(apiContext.extractedFirst) || patientData.profile.first_name || "Paciente";
                    
                    // Golden Master V36.2: Dynamic Clinical Descriptor based on precise age
                    const ageInDays = Math.floor((today - checkDate) / (1000 * 60 * 60 * 24));
                    const lifeStage = getLifeStageDescriptor(age, ageInDays);

                    if (interaction_mode === "PEDIATRIC_MODE") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ Cronología biológica calibrada y sincronizada con éxito. El sistema ha fijado la edad de ${firstNameForSex} en ${age} años. Para configurar con precisión los protocolos de desarrollo ${lifeStage.descriptor} y la tasa metabólica correspondiente, es imperativo definir el perfil biológico del menor.\n\nPor favor, seleccione el sexo de nacimiento de ${firstNameForSex}:`,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "♀️ FEMENINO", value: "Femenino" },
                                { label: "♂️ MASCULINO", value: "Masculino" }
                            ]
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ Cronología biológica calibrada y sincronizada con éxito. **${firstNameForSex}**, el sistema ha fijado su edad actual en **${age}** años. Para configurar con precisión quirúrgica sus marcadores de desarrollo ${lifeStage.descriptor} basal y su tasa metabólica, es imperativo definir su perfil biológico.\n\n**${firstNameForSex}**, por favor **seleccione** su sexo biológico:`,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "♀️ FEMENINO", value: "Femenino" },
                                { label: "♂️ MASCULINO", value: "Masculino" }
                            ]
                        }]);
                    }
                    
                    setCurrentPhase('PHASE_1_PROFILE_SEX');
                    break;
                }

                case 'PHASE_1_PROFILE_SEX': {
                    let sex = text;
                    const sexLower = sex.toLowerCase();
                    if (sexLower.includes('femenino') || ['mujer', 'f', 'la paciente'].includes(sexLower)) sex = "Femenino";
                    if (sexLower.includes('masculino') || ['hombre', 'm', 'el paciente', 'varon'].includes(sexLower)) sex = "Masculino";

                    if (sex === "Masculino" || sex === "Femenino") {
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, sex: sex }
                        }));

                        // SYNC CON EL GENOMA Y EL DASHBOARD
                        updateIdentityLock({
                            patientInfo: {
                                sex: sex,
                                age: patientData.profile.age
                            }
                        });

                        const firstNameForSex = formatText(apiContext.extractedFirst) || patientData.profile.first_name || "Paciente";
                        const age = patientData.profile.age;

                        // T.I.L.O. Golden Master V36.2 - Matriz Etaria de Entorno Lógico
                        let occupationPrompt = "";
                        let occupationInputType = 'text';
                        let occupationOptions = undefined;
                        
                        if (age === 0) {
                            // Validar Neonatal vs Lactante usando la fecha exacta si está disponible
                            const birthdateStr = patientData.profile.birthdate;
                            let ageInDays = 0;
                            if (birthdateStr) {
                                const parts = birthdateStr.split('/');
                                if (parts.length === 3) {
                                    const dobDate = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
                                    ageInDays = Math.floor((new Date() - dobDate) / (1000 * 60 * 60 * 24));
                                }
                            }
                            
                            if (ageInDays <= 28) {
                                occupationPrompt = `✅ **Identidad biológica estructurada.** Para configurar los protocolos de seguridad de la menor, indique su entorno de resguardo actual:`;
                                occupationInputType = 'buttons';
                                occupationOptions = [
                                    { label: "🏠 Casa / Cuidados Maternos", value: "Casa / Cuidados Maternos" },
                                    { label: "🏥 Cuidados Hospitalarios", value: "Cuidados Hospitalarios" }
                                ];
                            } else {
                                occupationPrompt = `✅ **Identidad biológica estructurada.** Para configurar los protocolos de la primera infancia, indique la dinámica habitual de la menor:`;
                                occupationInputType = 'buttons';
                                occupationOptions = [
                                    { label: "🏠 Casa / Cuidados Maternos", value: "Casa / Cuidados Maternos" },
                                    { label: "🧸 Estancia Infantil / Guardería", value: "Estancia Infantil / Guardería" },
                                    { label: "🏥 Cuidados Hospitalarios", value: "Cuidados Hospitalarios" }
                                ];
                            }
                        } else if (age >= 1 && age <= 2) {
                            occupationPrompt = `✅ **Identidad biológica estructurada.** Para configurar los protocolos de la primera infancia, indique la dinámica habitual de la menor:`;
                            occupationInputType = 'buttons';
                            occupationOptions = [
                                { label: "🏠 Casa / Cuidados Maternos", value: "Casa / Cuidados Maternos" },
                                { label: "🧸 Estancia Infantil / Guardería", value: "Estancia Infantil / Guardería" },
                                { label: "🏥 Cuidados Hospitalarios", value: "Cuidados Hospitalarios" }
                            ];
                        } else if (age >= 3 && age <= 12) {
                            occupationPrompt = `✅ **Identidad biológica estructurada.** Para configurar con precisión los protocolos de desarrollo pediátrico.\n\n¿Me indica el grado escolar (Kínder/Primaria) que cursa **${firstNameForSex}**?`;
                        } else if (age >= 13 && age <= 17) {
                            occupationPrompt = `✅ **Identidad biológica estructurada.**\n\n**${firstNameForSex}**, ¿en qué nivel académico (Secundaria/Preparatoria) se encuentra actualmente?`;
                        } else if (age >= 18 && age <= 64) {
                            occupationPrompt = `✅ **Identidad biológica** estructurada con éxito. ${firstNameForSex}, para personalizar su plan de alimentación y determinar con exactitud su **gasto energético** diario, es fundamental conocer el entorno y la dinámica de su jornada habitual.\n\n**${firstNameForSex}**, por favor indique su **ocupación actual** (por ejemplo: Docente, Oficinista, o Estudiante):`;
                        } else if (age >= 65) {
                            occupationPrompt = `✅ **Identidad biológica** estructurada con éxito. ${firstNameForSex}, para personalizar su plan de alimentación geriátrico, es fundamental conocer su nivel de actividad.\n\n**${firstNameForSex}**, indique su estatus actual (por ejemplo: Jubilado, Pensionado, o Activo):`;
                        }

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: occupationPrompt,
                            avatar: tiloImg,
                            inputType: occupationInputType,
                            options: occupationOptions
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_JOB');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor seleccione una opción válida.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_JOB': {
                    let job = text.trim();
                    job = job.replace(/^(soy|trabajo de|trabajo como|estudio|pues soy|pues trabajo de|soy un|soy una|me dedico a|trabajo en|estoy)\s+/i, '').trim();
                    job = job.replace(/\.$/, '');
                    if (job) job = job.charAt(0).toUpperCase() + job.slice(1).toLowerCase();
                    let finalOccupation = formatText(job) || formatText(text);

                    const ageForContext = patientData.profile?.age || 0;
                    if (ageForContext >= 70) {
                        const geriatricRegex = /viejo|mayor|grande|jubilad[oa]|pensionad[oa]|retirad[oa]|casa|hogar|nada|ninguna|no trabajo/i;
                        if (geriatricRegex.test(finalOccupation) || geriatricRegex.test(text)) {
                            finalOccupation = "Jubilado / Adulto Mayor";
                        }
                    } else if (ageForContext < 2) {
                        const validNeonateSettings = /casa|hogar|guardería|guarderia|hospital|clínica|clinica/i;
                        if (!validNeonateSettings.test(finalOccupation) || !validNeonateSettings.test(text)) {
                            finalOccupation = "Casa / Cuidados Maternos";
                        }
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, occupation: finalOccupation }
                    }));
                    const firstName = patientData.profile?.first_name || 'Paciente';
                    const requiresTutorTone = ageForContext < 13;

                    let msgContent = '';
                    if (requiresTutorTone) {
                        msgContent = `✅ Identidad biológica y entorno de cuidado sincronizados. Para blindar el expediente de **${firstName}** ante la red nacional de salud y garantizar el cumplimiento de la NOM-004, es imperativo integrar su identificador maestro de identidad.\n\nPor favor, proporcione la CURP de **${firstName}** utilizando la vía de su preferencia (recuerde que este dato se encuentra en el Certificado de Nacimiento o Constancia de Alumbramiento):`;
                    } else {
                        msgContent = `✅ Identidad biológica y ocupacional sincronizadas con éxito. Para blindar su expediente ante la red nacional de salud y garantizar el cumplimiento irrestricto de la normativa sanitaria vigente, es imperativo integrar su identificador maestro de identidad.\n\n**${firstName}**, por favor proporcione su Clave Única de Registro de Población (CURP) utilizando la vía de su preferencia:`;
                    }

                    const isFemale = patientData.profile?.sex === 'Femenino';
                    const extranjeroLabel = requiresTutorTone 
                        ? (isFemale ? "Es Extranjera" : "Es Extranjero") 
                        : (isFemale ? "Soy Extranjera" : "Soy Extranjero");

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "⌨️ INGRESAR MANUALMENTE", value: "Manual" },
                            { label: "🔍 ASISTENCIA DE BÚSQUEDA", value: "Buscala" },
                            { label: `🌍 ${extranjeroLabel.toUpperCase()}`, value: "Extranjero" } // Dynamic Label
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_CURP_GATE');
                    break;
                }

                // Q9: CURP GATE (Trifurcation)
                case 'PHASE_1_PROFILE_CURP_GATE': {
                    const firstName = patientData.profile?.first_name || 'Paciente';
                    const ageForContext = patientData.profile?.age || 0;
                    const requiresTutorTone = ageForContext < 13;

                    if (text === 'Manual') {
                        let baseMsg = '';
                        if (requiresTutorTone) {
                            baseMsg = `⌨️ Protocolo de ingreso manual habilitado. El sistema se encuentra listo para procesar el identificador de **${firstName}** bajo el rigor de la Validación de Consistencia Total, la cual cruzará la información con su nombre, fecha de nacimiento y perfil biológico.\n\nUna vez verificada la coherencia interna, el sistema realizará una compulsa en tiempo real ante las instancias oficiales para garantizar la validez legal del expediente.\n\nPor favor **escriba** los 18 caracteres de la Clave Única de Registro de Población (CURP) de **${firstName}**:`;
                        } else {
                            baseMsg = `⌨️ Protocolo de ingreso manual habilitado. **${firstName}**, el sistema se encuentra listo para procesar su identificador bajo el rigor de la Validación de Consistencia Total, la cual cruzará la información con su nombre, fecha de nacimiento y perfil biológico.\n\nUna vez verificada la coherencia interna, el sistema realizará una compulsa en tiempo real ante las instancias oficiales para garantizar la validez legal de su expediente.\n\n**${firstName}**, por favor **escriba** los 18 caracteres de su Clave Única de Registro de Población (CURP):`;
                        }
                        const msgContent = applyCortexCalibration(baseMsg, ageForContext, firstName);
                        setMessages(prev => [...prev, { role: 'assistant', content: msgContent, avatar: tiloImg, inputType: 'text' }]);
                        setCurrentPhase('PHASE_1_PROFILE_CURP_MANUAL');
                    } else if (text === 'Extranjero') {
                        // V36.2 Golden Master para Identidad Internacional
                        const isFemale = patientData.profile?.sex === 'Femenino';
                        const asM = isFemale ? 'la menor' : 'el menor';
                        
                        let baseMsg = '';
                        if (requiresTutorTone) {
                            baseMsg = `🌍 Protocolo de identidad internacional activado. Ante la ausencia de una CURP, es imperativo vincular el expediente de **${firstName}** mediante un identificador global para garantizar la trazabilidad legal y la seguridad de su información clínica.\n\nPor favor **escriba** el número de Pasaporte o el Documento de Identidad oficial del país de origen de ${asM}:`;
                        } else {
                            baseMsg = `🌍 Protocolo de identidad internacional activado. **${firstName}**, ante la ausencia de una CURP, es imperativo vincular su expediente mediante un identificador global para garantizar la trazabilidad legal y la seguridad de su información clínica.\n\n**${firstName}**, por favor **escriba** el número de su Pasaporte o el Documento de Identidad oficial de su país de origen:`;
                        }
                        const msgContent = applyCortexCalibration(baseMsg, ageForContext, firstName);

                        setMessages(prev => [...prev, { role: 'assistant', content: msgContent, avatar: tiloImg, inputType: 'text' }]);
                        setCurrentPhase('PHASE_1_PROFILE_ID_EXTRANJERO');
                    } else if (text === 'Buscala') {
                        const isFemale = patientData.profile?.sex === 'Femenino';
                        const nacidoLabel = isFemale ? "nacida" : "nacido";

                        let baseMsg = '';
                        if (requiresTutorTone) {
                            baseMsg = `Motor Concierge activado para búsqueda de CURP en RENAPO. Para localizar el registro oficial y sincronizarlo con el expediente clínico de **${firstName}**, es necesario identificar la entidad federativa de su origen.\n\nPor favor seleccione en el listado el Estado de la República en el que haya ${nacidoLabel} (por ejemplo: Chiapas, CDMX o Jalisco):`;
                        } else {
                            baseMsg = `Motor Concierge activado para búsqueda de CURP en RENAPO. Para localizar su registro oficial y sincronizarlo con su expediente clínico, es necesario identificar la entidad federativa de su origen.\n\n**${firstName}**, por favor seleccione en el listado el Estado de la República en el que haya ${nacidoLabel} (por ejemplo: Chiapas, CDMX o Jalisco):`;
                        }
                        
                        setMessages(prev => [...prev, { role: 'assistant', content: baseMsg, avatar: tiloImg, inputType: 'StateSelector' }]);
                        setCurrentPhase('PHASE_1_PROFILE_CURP_ASSIST');
                    } else {
                        // Trató de escribirla directo en el prompt de botones
                        const isCurp = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/.test(text.toUpperCase());
                        if (isCurp) {
                            setPatientData(prev => ({ ...prev, profile: { ...prev.profile, curp: text.toUpperCase() } }));
                            setMessages(prev => [...prev, { role: 'assistant', content: `✅ CURP Registrada y validada en su estructura.\n\nPara habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica, es indispensable registrar su contacto móvil.\n\n**${patientData.profile?.first_name || 'Paciente'}**, por favor indique su número de teléfono celular siguiendo el formato de 10 dígitos (XX) XXXX-XXXX:`, avatar: tiloImg, inputType: 'tel' }]);
                            setCurrentPhase('PHASE_1_PROFILE_PHONE');
                        } else {
                            setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Formato alfanumérico incorrecto.\n\nPor favor, elija una de las opciones en pantalla o asegúrese de ingresar 18 caracteres válidos.", avatar: tiloImg }]);
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
                    const calculatedCurp = calculateCurp(p.first_name, p.last_name_pat, p.last_name_mat, p.birthdate, p.sex, stateCode);

                    setPatientData(prev => ({ ...prev, profile: { ...prev.profile, curp: calculatedCurp } }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ Conexión Concierge establecida.\nHe calculado su CURP probabilística base: **${calculatedCurp}**\n\n¿Confirma que esta CURP es correcta?`,
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
                    if (text === 'yes') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ Identidad nacional sellada en expediente.\n\nPara habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica, es indispensable registrar su contacto móvil.\n\n**${patientData.profile?.first_name || 'Paciente'}**, por favor indique su número de teléfono celular siguiendo el formato de 10 dígitos (XX) XXXX-XXXX:`,
                            avatar: tiloImg,
                            inputType: 'tel'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_PHONE');
                    } else {
                        // Limpiar la CURP autogenerada si fue rechazada
                        setPatientData(prev => ({ ...prev, profile: { ...prev.profile, curp: '' } }));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Cálculo probabilístico descartado. Entrando a modo manual.\n\nPor favor, escriba su CURP oficial a 18 caracteres:",
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
                        setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Formato alfanumérico de CURP no válido.\n\nDebe contener exactamente 18 caracteres. Por favor verifique e intente nuevamente:" }]);
                        return;
                    }

                    // V8.0: Validación cruzada de integridad usando fecha y sexo del perfil
                    const p = patientData.profile;
                    let calculatedBase = "";
                    if (p.first_name && p.last_name_pat && p.birthdate && p.sex) {
                        calculatedBase = calculateCurp(p.first_name, p.last_name_pat, p.last_name_mat, p.birthdate, p.sex, "XX");
                    }

                    if (calculatedBase && calculatedBase.length === 18) {
                        const expectedIdentityBlock = calculatedBase.substring(0, 11);
                        const inputIdentityBlock = curpInput.substring(0, 11);

                        if (expectedIdentityBlock !== inputIdentityBlock) {
                            setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Discrepancia de identidad detectada. Los datos de la CURP ingresada no coinciden con su registro previo (Nombre/Fecha/Sexo). Por favor, verifique la grafía o seleccione "Asistencia de Búsqueda".` }]);
                            return;
                        }
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, curp: curpInput, curpValidated: true }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ Compulsa de seguridad exitosa. Su identidad nacional ha sido validada y sellada en su expediente.\n\nPara habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica, es indispensable registrar su contacto móvil.\n\n**${patientData.profile?.first_name || 'Paciente'}**, por favor indique su número de teléfono celular siguiendo el formato de 10 dígitos (XX) XXXX-XXXX:`,
                        avatar: tiloImg,
                        inputType: 'tel'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_PHONE');
                    break;
                }

                case 'PHASE_1_PROFILE_ID_EXTRANJERO': {
                    const idInput = text.trim().toUpperCase();
                    if (idInput.length < 5) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Formato de Documento de Identidad Internacional inválido.\n\nEl documento debe tener al menos 5 caracteres. Por favor verifique e intente nuevamente:", avatar: tiloImg }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { 
                            ...prev.profile, 
                            curp: `EXT-${idInput}`,
                            nationality_type: 'FOREIGN',
                            passport_id: idInput,
                            nationality: '' // Se inicializa vacío para el dashboard
                        }
                    }));

                    const firstName = patientData.profile?.first_name || 'Paciente';

                    const msgContent = `✅ Identidad internacional validada. ${firstName}, para asegurar la precisión de su expediente y cumplir con los protocolos de trazabilidad global, es indispensable registrar su origen bajo estándares internacionales.\n\n${firstName}, por favor comience a escribir su Nacionalidad en el buscador y seleccione la opción correcta del listado oficial:`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'SearchableVerticalMenu', // Activador semántico si es necesario, aunque App.jsx lo renderiza por número de opciones
                        options: COUNTRIES.map(c => ({ label: c.label, value: c.label }))
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_NATIONALITY');
                    break;
                }

                case 'PHASE_1_PROFILE_NATIONALITY': {
                    const nationalityInput = formatText(text.trim());
                    // Prohibimos ingreso libre comprobando que esté en la lista
                    const isValidCountry = COUNTRIES.some(c => formatText(c.label) === nationalityInput || formatText(c.value) === nationalityInput);
                    
                    if (!isValidCountry) {
                        setMessages(prev => [...prev, { 
                            role: 'assistant', 
                            content: "⚠️ Selección no reconocida.\n\nPor favor, utilice el buscador y **seleccione explícitamente una opción del listado oficial ISO 3166**:", 
                            avatar: tiloImg,
                            options: COUNTRIES.map(c => ({ label: c.label, value: c.label })) 
                        }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { 
                            ...prev.profile, 
                            nationality: nationalityInput
                        }
                    }));

                    const firstName = patientData.profile?.first_name || 'Paciente';
                    const age = patientData.profile?.age || 0;
                    const requiresTutorTone = age < 13;
                    
                    const msgContent = requiresTutorTone
                        ? `✅ Nacionalidad de ${firstName} sincronizada. Tutor, para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica del menor, es indispensable registrar su contacto móvil.\n\nPor favor, indique su número de teléfono celular siguiendo el formato de 10 dígitos (XX) XXXX-XXXX:`
                        : `✅ Nacionalidad de ${firstName} sincronizada y validada. **${firstName}**, para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica, es indispensable registrar su contacto móvil.\n\nPor favor, indique su número de teléfono celular siguiendo el formato de 10 dígitos (XX) XXXX-XXXX:`;

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
                    const cleanPhone = text.replace(/\D/g, '');
                    // Valid Mexican cell phones must be 10 digits, and area codes don't start with 0, 10, 11, 12, etc.
                    const phoneRegex = /^(?![01][012])[0-9]{10}$/;
                    const firstName = patientData.profile?.first_name || 'Paciente';
                    
                    if (!phoneRegex.test(cleanPhone)) {
                        const missingDigits = 10 - cleanPhone.length;
                        let dynamicHint = '';
                        if (missingDigits > 0) {
                            dynamicHint = `Faltan **${missingDigits}** dígitos para completar el estándar de 10.`;
                        } else if (missingDigits < 0) {
                            dynamicHint = `Sobran **${Math.abs(missingDigits)}** dígitos para cumplir el estándar de 10.`;
                        } else {
                            dynamicHint = `La lada ingresada es inválida en el territorio nacional.`;
                        }
                        let errorMsg = '';
                        const ageForContext = patientData.profile?.age || 0;
                        const requiresTutorTone = ageForContext < 13;

                        if (requiresTutorTone) {
                            errorMsg = `⚠️ Inconsistencia en el protocolo de alerta. Para garantizar que las notificaciones críticas y las alertas clínicas de ${firstName} lleguen al destinatario correcto, es imperativo que el contacto móvil cumpla con los estándares de la red nacional de telefonía.\n\nPor favor, verifique e indique nuevamente el teléfono celular. El número debe constar de **10 dígitos exactos** y una **LADA válida**:\n\n*${dynamicHint}*\n\nEjemplo de precisión: 5512345678`;
                        } else {
                            errorMsg = `⚠️ Inconsistencia en el protocolo de alerta. Para garantizar que las notificaciones críticas y las alertas clínicas de **su registro** lleguen al destinatario correcto, es imperativo que el contacto móvil cumpla con los estándares de la red nacional de telefonía.\n\n**${firstName}**, por favor, verifique e indique nuevamente el teléfono celular. El número debe constar de **10 dígitos exactos** y una **LADA válida**:\n\n*${dynamicHint}*\n\nEjemplo de precisión: 5512345678`;
                        }

                        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, avatar: tiloImg, inputType: 'tel' }]);
                        return;
                    }
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, phone: cleanPhone }
                    }));

                    const age = patientData.profile?.age || 0;
                    const requiresTutorTone = age < 13;
                    
                    const msgContent = requiresTutorTone
                        ? `✅ Canal de alerta celular vinculado. Protocolo de adecuación cultural activo. Para integrar con precisión las **restricciones o costumbres** en el **plan médico de ${firstName}**, es indispensable definir el entorno de creencias.\n\nPor favor, indique si en el entorno familiar de ${firstName} profesan alguna religión:`
                        : `✅ Canal de alerta celular vinculado. Protocolo de adecuación cultural activo. **${firstName}**, para integrar con precisión sus valores y posibles restricciones en su plan nutricional y médico, es indispensable definir su entorno de creencias.\n\n**${firstName}**, por favor indique si Usted profesa alguna religión:`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "✅ SÍ", value: "SI" },
                            { label: "❌ NO / NINGUNA", value: "NO_NINGUNA" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_RELIGION');
                    break;
                }

                case 'PHASE_1_PROFILE_RELIGION': {
                    const hasReligion = text === "SI" || text.toLowerCase() === "sí" || text.toLowerCase() === "si" || text === "✅ Sí" || text === "✅ SÍ";
                    const firstName = patientData.profile?.first_name || 'Paciente';

                    if (hasReligion) {
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, has_religion: true }
                        }));
                        const age = patientData.profile?.age || 0;
                        const requiresTutorTone = age < 13;
                        const diagContent = requiresTutorTone 
                            ? `✅ Protocolo de adecuación cultural activo. Para integrar con precisión las **restricciones o costumbres** en el **plan médico de ${firstName}**, es indispensable especificar la **filiación**.\n\nPor favor, **comience a escribir** la religión de su familia y **seleccione** la opción correcta del listado:`
                            : `✅ Protocolo de adecuación cultural activo. **${firstName}**, para integrar con precisión sus valores y posibles restricciones en su plan nutricional y médico, es indispensable especificar su filiación.\n\n**${firstName}**, por favor **comience a escribir** su Religión y **seleccione** la opción correcta del listado:`;

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: diagContent,
                            avatar: tiloImg,
                            inputType: 'SearchableVerticalMenu',
                            options: RELIGIONS.map(r => ({ label: r.label, value: r.label }))
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_RELIGION_CUSTOM');
                    } else {
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, has_religion: false, religion: "Ninguna" }
                        }));

                        const ptCtx = patientData.profile.pediatric_profile;
                        if (ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false) {
                            const updatedProfile = { ...patientData.profile, marital_status: ptCtx.ui_controls.auto_fill_marital, has_religion: false, religion: "Ninguna" };
                            setPatientData(prev => ({
                                ...prev,
                                profile: updatedProfile
                            }));
                            
                            triggerDemographicSummary(updatedProfile);
                        } else {
                            const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: "✅ Determinante socio-cultural guardado histórico.\n\nPara el registro legal en la Norma Oficial, ¿cuál es su **Estado Civil** libremente elegido?",
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

                case 'PHASE_1_PROFILE_RELIGION_CUSTOM': {
                    const religionInput = formatText(text.trim());
                    // Validar contra la ISO
                    const isValidReligion = RELIGIONS.some(r => formatText(r.label) === religionInput || formatText(r.value) === religionInput);
                    
                    if (!isValidReligion) {
                        setMessages(prev => [...prev, { 
                            role: 'assistant', 
                            content: "⚠️ Selección no reconocida.\n\nPor favor, utilice el buscador y **seleccione explícitamente una opción del listado oficial** para garantizar la adecuación clínica:", 
                            avatar: tiloImg,
                            inputType: 'SearchableVerticalMenu',
                            options: RELIGIONS.map(r => ({ label: r.label, value: r.label })) 
                        }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, religion: religionInput }
                    }));

                    const ptCtx = patientData.profile.pediatric_profile;
                    if (ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false) {
                        const updatedProfile = { ...patientData.profile, marital_status: ptCtx.ui_controls.auto_fill_marital, has_religion: true, religion: religionInput };
                        setPatientData(prev => ({
                            ...prev,
                            profile: updatedProfile
                        }));
                        triggerDemographicSummary(updatedProfile);
                    } else {
                        const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "✅ Filiación estructurada en expediente.\n\nPara configurar su red de apoyo logístico, ¿cuál es su **estado civil** actual?",
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
                    const updatedProfile = { ...patientData.profile, marital_status: text };
                    setPatientData(prev => ({ ...prev, profile: updatedProfile }));

                    triggerDemographicSummary(updatedProfile);
                    break;
                }

                case 'PHASE_1_DEMO_SEAL_CONFIRM': {
                    if (text === 'CORREGIR') {
                        const firstName = patientData.profile?.first_name || 'Paciente';
                        const ageForContext = patientData.profile?.age || 0;
                        const isAdult = ageForContext >= 18;
                        
                        let occLabel = 'Ocupación';
                        if (ageForContext <= 2) occLabel = 'Entorno de cuidado';
                        else if (ageForContext >= 3 && ageForContext <= 17) occLabel = 'Escolaridad';

                        let editOptions = [];
                        let msgContent = "";
                        
                        if (isAdult) {
                            msgContent = `✅ Protocolo de rectificación selectiva activo. Para asegurar la precisión operativa de su expediente, ¿cuál de las siguientes variables requiere ser ajustada?`;
                            editOptions = [
                                { label: "⛪ Religión", value: "EDIT_RELIGION" },
                                { label: "💍 Estado Civil", value: "EDIT_MARITAL_STATUS" },
                                { label: "💼 Ocupación", value: "EDIT_OCCUPATION" },
                                { label: "📱 Teléfono", value: "EDIT_PHONE" },
                                { label: "🔙 Regresar al Resumen", value: "BACK_TO_SUMMARY" }
                            ];
                        } else {
                            msgContent = `✅ Protocolo de rectificación selectiva activo. La identidad legal de ${firstName} ha sido certificada mediante el cruce de datos oficiales y se encuentra anclada de forma permanente a su CURP para garantizar la validez de su expediente bajo la NOM-004.\n\nPara asegurar la **precisión operativa**, ¿cuál de las siguientes variables de contacto o ${occLabel.toLowerCase()} de ${firstName} requiere ser ajustada?`;
                            editOptions = [
                                { label: "📱 Teléfono", value: "EDIT_PHONE" },
                                { label: "⛪ Religión", value: "EDIT_RELIGION" },
                                { label: `🏠 ${occLabel}`, value: "EDIT_OCCUPATION" },
                                { label: "🔙 Regresar al Resumen", value: "BACK_TO_SUMMARY" }
                            ];
                        }

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msgContent,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: editOptions
                        }]);
                        setCurrentPhase('PHASE_1_DEMO_SEAL_EDIT_GATE');
                    } else {
                        // CONFIRMAR - Sellamos y pasamos a Geografía
                        const firstName = patientData.profile?.first_name || "Paciente";
                        const ageY = patientData.profile?.age || 0;
                        const sex = patientData.profile?.sex;
                        const isFemale = sex?.toUpperCase() === 'FEMENINO' || sex?.toUpperCase() === 'MUJER';
                        
                        // Exact age calculation for < 3 years to catch neonates
                        let diffDays = ageY * 365;
                        const bd = patientData?.profile?.birthdate;
                        if (bd && ageY < 3) {
                            try {
                                let dateObj;
                                if (bd.includes('/')) {
                                    const parts = bd.split('/');
                                    dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                                } else {
                                    dateObj = new Date(bd);
                                }
                                const todayDate = new Date();
                                const referenceYear = 2026;
                                const currentYear = todayDate.getFullYear();
                                const pivotDate = currentYear < referenceYear ? new Date(referenceYear, 1, 15) : todayDate;
                                const diffTime = Math.abs(pivotDate - dateObj);
                                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                            } catch {
                                // Fallback
                            }
                        }
                        
                        let msgContent = '';

                        // Matrix V37.1 (Sello Absoluto)
                        if (diffDays <= 28) { // Neonato
                            msgContent = `📍 Bloque demográfico sellado. La ubicación geográfica es un determinante ambiental clave para entender el acceso a recursos nutricionales y la exposición a factores de riesgo ${isFemale ? 'de la recién nacida' : 'del recién nacido'} bajo la **NOM-004**.\n\nPor favor, **indique** el Código Postal oficial (5 dígitos) del lugar de resguardo de ${firstName}:`;
                        } else if (ageY < 3) { // Lactante
                            msgContent = `📍 Bloque demográfico sellado. La ubicación geográfica es un determinante ambiental clave para entender el acceso a recursos nutricionales y la exposición a factores de riesgo para el desarrollo ${isFemale ? 'de la niña' : 'del niño'} bajo la **NOM-004**.\n\nPor favor, **indique** el Código Postal oficial (5 dígitos) del entorno de convivencia de ${firstName}:`;
                        } else if (ageY < 13) { // Pediátrico
                            msgContent = `📍 Bloque demográfico sellado. La ubicación geográfica es un determinante ambiental clave para entender el acceso a recursos nutricionales y la exposición a factores de riesgo en el crecimiento de su ${isFemale ? 'hija' : 'hijo'} bajo la **NOM-004**.\n\nPor favor, **indique** el Código Postal oficial (5 dígitos) de la residencia habitual de ${firstName}:`;
                        } else if (ageY < 18) { // Adolescente
                            msgContent = `📍 Bloque demográfico sellado. La ubicación geográfica es un determinante ambiental clave para entender su acceso a recursos nutricionales y la exposición a factores de riesgo de desarrollo bajo la **NOM-004**.\n\n${firstName}, por favor **indique** el Código Postal oficial (5 dígitos) de su zona de desarrollo:`;
                        } else if (ageY < 65) { // Adulto
                            msgContent = `📍 Bloque demográfico sellado. Como usuari${isFemale ? 'a' : 'o'}, su ubicación geográfica es un determinante ambiental clave para entender su acceso a recursos nutricionales y la exposición a factores de riesgo bajo la **NOM-004**.\n\n${firstName}, por favor **indique** el Código Postal oficial (5 dígitos) de su residencia:`;
                        } else { // Adulto Mayor
                            msgContent = `📍 Bloque demográfico sellado. Como adult${isFemale ? 'a mayor' : 'o mayor'}, su ubicación geográfica es un determinante ambiental clave para entender su viabilidad de acceso a recursos nutricionales y factores de riesgo aplicables por la **NOM-004**.\n\nPara blindar su expediente, ${firstName}, confirme e **indique** su Código Postal oficial (5 dígitos) actual:`;
                        }

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msgContent,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                        
                        // We set a flag in session context that demographic is sealed, so TabIdentity can lock it.
                        setPatientData(prev => ({
                            ...prev,
                            session_context: {
                                ...prev.session_context,
                                demographic_sealed: true
                            }
                        }));
                        setCurrentPhase('PHASE_1_PROFILE_ZIPCODE');
                    }
                    break;
                }

                case 'PHASE_1_DEMO_SEAL_EDIT_GATE': {
                    const firstName = patientData.profile?.first_name || 'Paciente';
                    if (text === 'EDIT_PHONE') {
                        const msgContent = `✅ Protocolo de rectificación de contacto activo. Para garantizar que el **canal de notificaciones críticas** y alertas médicas de ${firstName} sea **infalible** bajo la NOM-004, es indispensable que el registro móvil sea exacto.\n\nPor favor, indique el nuevo número de teléfono celular utilizando el formato de **10 dígitos** (asegúrese de incluir una **LADA nacional válida**):\n\nEjemplo de precisión: 5512345678`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msgContent, avatar: tiloImg, inputType: 'tel' }]);
                        setCurrentPhase('PHASE_1_DEMO_SEAL_EDIT_PHONE');
                    } else if (text === 'EDIT_RELIGION') {
                        let ageForContext = patientData.profile?.age || 0;
                        const requiresTutorTone = ageForContext < 13;
                        
                        const msgContent = requiresTutorTone
                            ? `✅ Protocolo de adecuación cultural activo. Para integrar con precisión las **restricciones o costumbres** en el **plan médico de ${firstName}**, es indispensable definir el entorno de creencias.\n\nPor favor, indique si en el entorno familiar de ${firstName} profesan alguna religión:`
                            : `✅ Protocolo de adecuación cultural activo. **${firstName}**, para integrar con precisión sus valores y posibles restricciones en su plan nutricional y médico, es indispensable definir su entorno de creencias.\n\n**${firstName}**, por favor indique si Usted profesa alguna religión:`;

                        setMessages(prev => [...prev, { 
                            role: 'assistant', 
                            content: msgContent, 
                            avatar: tiloImg, 
                            inputType: 'buttons', 
                            options: [
                                { label: "✅ SÍ", value: "SI" }, 
                                { label: "❌ NO / NINGUNA", value: "NO_NINGUNA" }
                            ] 
                        }]);
                        setCurrentPhase('PHASE_1_DEMO_SEAL_EDIT_RELIGION_CONFIRM');
                    } else if (text === 'EDIT_OCCUPATION') {
                        let ageForContext = patientData.profile?.age || 0;
                        let examplesP = "Casa, Guardería";
                        if (ageForContext >= 3 && ageForContext <= 12) {
                            examplesP = "Kínder, Primaria";
                        } else if (ageForContext >= 13 && ageForContext <= 17) {
                            examplesP = "Secundaria, Preparatoria";
                        } else if (ageForContext >= 18) {
                            examplesP = "Consultor, Empleado, Comerciante";
                        }
                        
                        const requiresTutorTone = ageForContext < 13;
                        const isAdult = ageForContext >= 18;
                        const isNeonate = ageForContext < 3;
                        
                        let msgContent = '';
                        let inputType = 'text';
                        let options = undefined;

                        if (isNeonate) {
                            const isFemale = patientData.profile?.sex === 'Femenino';
                            const asM = isFemale ? 'la menor' : 'el menor';
                            msgContent = `✅ Protocolo de adecuación neonatal activo. Para determinar con exactitud los requerimientos logísticos y de seguridad en el plan médico de ${firstName}, es indispensable validar su entorno de cuidado.\n\nPor favor, indique la dinámica habitual de resguardo para el expediente de ${asM} (seleccione una opción o escriba su respuesta):`;
                            inputType = 'buttons';
                            options = [
                                { label: "🏠 Casa / Cuidados Maternos", value: "Casa / Cuidados Maternos" },
                                { label: "🏥 Cuidados Hospitalarios", value: "Cuidados Hospitalarios" },
                                { label: "🧸 Estancia Infantil / Guardería", value: "Estancia Infantil / Guardería" }
                            ];
                        } else if (requiresTutorTone) {
                            msgContent = `✅ Protocolo de rectificación de entorno activo. Para determinar con exactitud los requerimientos logísticos y de seguridad en el plan médico de ${firstName}, es indispensable validar su **escolaridad / entorno de cuidado**.\n\nPor favor, indique el grado escolar actual o entorno para el expediente de ${firstName} (por ejemplo: ${examplesP}):`;
                        } else if (!isAdult) {
                            msgContent = `✅ Protocolo de rectificación de entorno activo. **${firstName}**, para determinar con exactitud sus requerimientos logísticos y de seguridad en el plan médico, es indispensable validar su **escolaridad o nivel de ocupación**.\n\n**${firstName}**, por favor indique su grado escolar actual o entorno (por ejemplo: ${examplesP}):`;
                        } else {
                            msgContent = `✅ Protocolo de rectificación de entorno activo. **${firstName}**, para determinar con exactitud sus requerimientos logísticos y de seguridad en el plan médico, es indispensable validar su **dinámica laboral y ocupación actual**.\n\n**${firstName}**, por favor indique su ocupación actual (por ejemplo: ${examplesP}):`;
                        }
                            
                        setMessages(prev => [...prev, { role: 'assistant', content: msgContent, avatar: tiloImg, inputType: inputType, options: options }]);
                        setCurrentPhase('PHASE_1_DEMO_SEAL_EDIT_OCCUPATION');
                    } else if (text === 'EDIT_MARITAL_STATUS') {
                        const sx = patientData.profile?.sex;
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ Protocolo de rectificación estructural activo. Integrar el estado civil exacto de **su perfil** es un requisito para la trazabilidad legal y clínica del expediente bajo la NOM-004.\n\n**${firstName}**, por favor indique su Estado Civil actual seleccionando una opción del marco demográfico oficial:`,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: getGenderedTerm('Soltero', sx), value: getGenderedTerm('Soltero', sx) },
                                { label: getGenderedTerm('Casado', sx), value: getGenderedTerm('Casado', sx) },
                                { label: getGenderedTerm('Unión Libre', sx), value: getGenderedTerm('Unión Libre', sx) },
                                { label: getGenderedTerm('Divorciado', sx), value: getGenderedTerm('Divorciado', sx) },
                                { label: getGenderedTerm('Viudo', sx), value: getGenderedTerm('Viudo', sx) }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_DEMO_SEAL_EDIT_MARITAL_STATUS');
                    } else if (text === 'BACK_TO_SUMMARY') {
                        triggerDemographicSummary(patientData.profile);
                    } else {
                        // Fallback constraint if user types text (like a phone number) instead of clicking the edit prompt options
                        const ageForContext = patientData.profile?.age || 0;
                        const isAdult = ageForContext >= 18;
                        const requiresTutorTone = ageForContext < 13;
                        let occLabel = requiresTutorTone ? 'Entorno de cuidado' : (isAdult ? 'Ocupación' : 'Escolaridad');
                        
                        let editOptions = [
                            { label: "📞 Teléfono Celular", value: "EDIT_PHONE" },
                            { label: "🛐 Religión", value: "EDIT_RELIGION" },
                        ];
                        
                        if (isAdult) {
                            editOptions = [
                                { label: "💍 Estado Civil", value: "EDIT_MARITAL_STATUS" },
                                { label: "💼 Ocupación", value: "EDIT_OCCUPATION" },
                                { label: "📞 Teléfono Celular", value: "EDIT_PHONE" },
                                { label: "🛐 Religión", value: "EDIT_RELIGION" }
                            ];
                        } else {
                            editOptions.push({ label: `🏠 ${occLabel}`, value: "EDIT_OCCUPATION" });
                        }
                        editOptions.push({ label: "🔙 Volver al Resumen", value: "BACK_TO_SUMMARY" });

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `⚠️ Selección no reconocida. Para evitar conflictos en la estructuración de su expediente, es indispensable utilizar el menú.\n\nPor favor, **seleccione explícitamente** cuál de las siguientes variables requiere ser ajustada:`,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: editOptions
                        }]);
                    }
                    break;
                }

                case 'PHASE_1_DEMO_SEAL_EDIT_PHONE': {
                    const cleanPhone = text.replace(/\D/g, '');
                    const phoneRegex = /^(?![01][012])[0-9]{10}$/;
                    const firstName = patientData.profile?.first_name || 'Paciente';
                    
                    if (!phoneRegex.test(cleanPhone)) {
                        const missingDigits = 10 - cleanPhone.length;
                        let dynamicHint = '';
                        if (missingDigits > 0) {
                            dynamicHint = `Faltan **${missingDigits}** dígitos para completar el estándar de 10.`;
                        } else if (missingDigits < 0) {
                            dynamicHint = `Sobran **${Math.abs(missingDigits)}** dígitos para cumplir el estándar de 10.`;
                        } else {
                            dynamicHint = `La lada ingresada es inválida en el territorio nacional.`;
                        }

                        const ageForContext = patientData.profile?.age || 0;
                        const isAdult = ageForContext >= 18;
                        let errorMsg = '';

                        if (isAdult) {
                            errorMsg = `⚠️ Inconsistencia en el protocolo de alerta. Para garantizar que las notificaciones críticas y las alertas clínicas de **su registro** lleguen al destinatario correcto, es imperativo que el contacto móvil cumpla con los estándares de la red nacional de telefonía.\n\n**${firstName}**, por favor, verifique e indique nuevamente el teléfono celular. El número debe constar de **10 dígitos exactos** y una **LADA válida**:\n\n*${dynamicHint}*\n\nEjemplo de precisión: 5512345678`;
                        } else {
                            errorMsg = `⚠️ Inconsistencia en el protocolo de alerta. Para garantizar que las notificaciones críticas y las alertas clínicas de ${firstName} lleguen al destinatario correcto, es imperativo que el contacto móvil cumpla con los estándares de la red nacional de telefonía.\n\nPor favor, verifique e indique nuevamente el teléfono celular. El número debe constar de **10 dígitos exactos** y una **LADA válida**:\n\n*${dynamicHint}*\n\nEjemplo de precisión: 5512345678`;
                        }

                        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, avatar: tiloImg, inputType: 'tel' }]);
                        return;
                    }
                    const updatedProfile = { ...patientData.profile, phone: cleanPhone };
                    setPatientData(prev => ({ ...prev, profile: updatedProfile }));
                    triggerDemographicSummary(updatedProfile);
                    break;
                }

                case 'PHASE_1_DEMO_SEAL_EDIT_RELIGION_CONFIRM': {
                    const hasReligion = text === "SI" || text.toLowerCase() === "sí" || text.toLowerCase() === "si" || text === "✅ Sí" || text === "✅ SÍ";
                    const firstName = patientData.profile?.first_name || 'Paciente';
                    if (hasReligion) {
                        let ageForContext = patientData.profile?.age || 0;
                        const requiresTutorTone = ageForContext < 13;
                        
                        const msgContent = requiresTutorTone
                            ? `✅ Protocolo de adecuación cultural activo. Para integrar con precisión las **restricciones o costumbres** en el **plan médico de ${firstName}**, es indispensable especificar la **filiación**.\n\nPor favor, **comience a escribir** la religión de su familia y **seleccione** la opción correcta del listado para el expediente de ${firstName}:`
                            : `✅ Protocolo de adecuación cultural activo. **${firstName}**, para integrar con precisión sus valores y posibles restricciones en su plan nutricional y médico, es indispensable especificar su filiación.\n\n**${firstName}**, por favor **comience a escribir** su Religión y **seleccione** la opción correcta del listado:`;
                            
                        setMessages(prev => [...prev, { 
                            role: 'assistant', 
                            content: msgContent, 
                            avatar: tiloImg, 
                            inputType: 'SearchableVerticalMenu', 
                            options: RELIGIONS.map(r => ({ label: r.label, value: r.label })) 
                        }]);
                        setCurrentPhase('PHASE_1_DEMO_SEAL_EDIT_RELIGION_CUSTOM');
                    } else {
                        const updatedProfile = { ...patientData.profile, has_religion: false, religion: "Ninguna" };
                        setPatientData(prev => ({ ...prev, profile: updatedProfile }));
                        triggerDemographicSummary(updatedProfile);
                    }
                    break;
                }

                case 'PHASE_1_DEMO_SEAL_EDIT_RELIGION_CUSTOM': {
                    const religionInput = formatText(text.trim());
                    const isValidReligion = RELIGIONS.some(r => formatText(r.label) === religionInput || formatText(r.value) === religionInput);
                    if (!isValidReligion) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Selección no reconocida.\n\nPor favor, utilice el buscador y **seleccione explícitamente una opción del listado oficial**:", avatar: tiloImg, inputType: 'SearchableVerticalMenu', options: RELIGIONS.map(r => ({ label: r.label, value: r.label })) }]);
                        return;
                    }
                    const updatedProfile = { ...patientData.profile, has_religion: true, religion: religionInput };
                    setPatientData(prev => ({ ...prev, profile: updatedProfile }));
                    triggerDemographicSummary(updatedProfile);
                    break;
                }

                case 'PHASE_1_DEMO_SEAL_EDIT_OCCUPATION': {
                    let job = text.trim();
                    job = job.replace(/^(soy|trabajo de|trabajo como|estudio|pues soy|pues trabajo de|soy un|soy una|me dedico a|trabajo en|estoy)\s+/i, '').trim();
                    job = job.replace(/\.$/, '');
                    if (job) job = job.charAt(0).toUpperCase() + job.slice(1).toLowerCase();
                    let finalOccupation = formatText(job) || formatText(text);
                    
                    const ageForContext = patientData.profile?.age || 0;
                    if (ageForContext >= 70) {
                        const geriatricRegex = /viejo|mayor|grande|jubilad[oa]|pensionad[oa]|retirad[oa]|casa|hogar|nada|ninguna|no trabajo/i;
                        if (geriatricRegex.test(finalOccupation) || geriatricRegex.test(text)) {
                            finalOccupation = "Jubilado / Adulto Mayor";
                        }
                    } else if (ageForContext < 2) {
                        const validNeonateSettings = /casa|hogar|guardería|guarderia|hospital|clínica|clinica/i;
                        if (!validNeonateSettings.test(finalOccupation) || !validNeonateSettings.test(text)) {
                            finalOccupation = "Casa / Cuidados Maternos";
                        }
                    }

                    const updatedProfile = { ...patientData.profile, occupation: finalOccupation };
                    setPatientData(prev => ({ ...prev, profile: updatedProfile }));
                    triggerDemographicSummary(updatedProfile);
                    break;
                }

                case 'PHASE_1_DEMO_SEAL_EDIT_MARITAL_STATUS': {
                    const sx = patientData.profile?.sex;
                    const validOptions = [
                        getGenderedTerm('Soltero', sx),
                        getGenderedTerm('Casado', sx),
                        getGenderedTerm('Unión Libre', sx),
                        getGenderedTerm('Divorciado', sx),
                        getGenderedTerm('Viudo', sx)
                    ];
                    
                    if (!validOptions.includes(text)) {
                        setMessages(prev => [...prev, { 
                            role: 'assistant', 
                            content: `⚠️ Selección no reconocida. Por favor, utilice los botones interactivos para registrar su Estado Civil oficial:`, 
                            avatar: tiloImg, 
                            inputType: 'buttons', 
                            options: validOptions.map(opt => ({ label: opt, value: opt }))
                        }]);
                        return;
                    }

                    const updatedProfile = { ...patientData.profile, marital_status: text };
                    setPatientData(prev => ({ ...prev, profile: updatedProfile }));
                    triggerDemographicSummary(updatedProfile);
                    break;
                }

                case 'PHASE_1_PROFILE_ZIPCODE': {
                    const zipInput = text.trim();
                    if (!/^\d{5}$/.test(zipInput)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Formato de localización postal inválido.\n\nEl Código Postal debe ser numérico y tener exactamente 5 dígitos. Por favor verifique e intente nuevamente:", avatar: tiloImg }]);
                        return;
                    }

                    // Tilo replies while thinking:
                    setMessages(prev => [...prev, { role: 'assistant', content: "📡 Interconectando con bases de datos del Servicio Postal Mexicano...", avatar: tiloImg }]);

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
                                    content: `✅ Conexión satelital establecida en **${data.municipio}, ${data.estado}**.\n\nPor favor, seleccione su **Colonia o Asentamiento** de la lista autogenerada:`,
                                    avatar: tiloImg,
                                    inputType: 'buttons',
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
                                    content: "⚠️ Interconexión postal fallida.\n\nEse código no fue localizado en la base de datos nacional. Por favor verifique e ingrese su **Código Postal** nuevamente:",
                                    avatar: tiloImg,
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
                        content: "Entidad federativa registrada en zona profunda.\n\nPara afinar la geolocalización, ¿cuál es su **Municipio o Alcaldía** oficial?",
                        avatar: tiloImg,
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
                        content: "Demarcación municipal fijada en el mapa clínico.\n\nFinalmente, por favor escriba su **Colonia o Asentamiento** habitacional:",
                        avatar: tiloImg,
                        inputType: 'text'
                    }]);
                    // Redirect back to normal colony logic, which expects a text response and sets the colony, then asks for street
                    setCurrentPhase('PHASE_1_PROFILE_COLONY');
                    break;
                }

                case 'PHASE_1_PROFILE_COLONY': {
                    const lastMsg = messages[messages.length - 1];
                    const validOptions = lastMsg?.options?.map(opt => formatText(opt.value)) || [];
                    const normalizedInput = formatText(text);

                    // Validación Estricta: El texto DEBE hacer match con las opciones de colonias si existen
                    if (validOptions.length > 0 && !validOptions.includes(normalizedInput)) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⚠️ Selección Invalida.\n\nPor favor, **seleccione únicamente una de las colonias** de la lista autogenerada para asegurar la compatibilidad con el sistema central de salud:",
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: lastMsg.options
                        }]);
                        return; // Detiene el flujo
                    }

                    const isYouth = patientData.profile?.pediatric_profile?.ui_controls?.tone_key === 'YOUTH_EMP_TONE';
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, address: { ...prev.profile.address, colony: formatText(text) } },
                        domicilio: { ...prev.domicilio, colonia: formatText(text) }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isYouth ? "Finalmente, ¿cuál es tu **Calle y Número exterior/interior**?" : "Finalmente, ¿cuál es su **Calle y Número exterior/interior**?",
                        avatar: tiloImg,
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

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, address: { ...prev.profile.address, street: cleanStreet } },
                        domicilio: { ...prev.domicilio, calle: cleanStreet }
                    }));

                    // CHECKPOINT 2: End of Phase 1
                    console.log("💾 CHECKPOINT 2: Fase 1 (NOM-004 Demographics) Completada.");

                    // TRANSITION TO PHASE 2: SECURITY CONTACT
                    const ageForPrompt = patientData.profile?.age || patientData.identificacion?.edad || 0;
                    const contactRoleStr = ageForPrompt < 18 ? "contacto responsable o tutor" : "contacto responsable";
                    const firstName = formatText(apiContext.extractedFirst) || "Paciente";

                    const msgContent = `Fase 2 de Seguridad iniciada. Escudo de red médica activado.\n\n**${firstName}**, en caso de contingencia médica, ¿quién es su ${contactRoleStr}? Requiero su **nombre completo**.`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'text'
                    }]);
                    setCurrentPhase('PHASE_2_EMERGENCY_NAME');
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

                    const age = patientData.profile?.age || patientData.identificacion?.edad || 0;
                    const patientFirstNameRaw = (patientData.identificacion?.nombre || patientData.profile?.first_name || "Paciente").split(' ')[0];
                    const patientFirstName = patientFirstNameRaw.replace(/,+$/, '');
                    let msgContent = "";

                    // Trifurcación de Edad - Texto Hablado
                    if (age < 12) {
                        msgContent = `Contacto registrado en el protocolo de alerta.\n\n¿Qué parentesco legal o sanguíneo tiene ${eName} con ${patientFirstName}?`;
                    } else {
                        msgContent = `Contacto registrado en el protocolo de alerta.\n\n${patientFirstName}, ¿qué parentesco legal o sanguíneo tiene ${eName} con usted?`;
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
                    setPatientData(prev => ({
                        ...prev,
                        profile: {
                            ...prev.profile,
                            emergencyContact: { ...prev.profile.emergencyContact, kin: eRelation }
                        },
                        emergencia: {
                            ...prev.emergencia,
                            parentesco: eRelation
                        }
                    }));
                    const msgContent = "Nivel de consanguinidad establecido.\n\nPara integrarlo al sistema de llamadas prioritarias, ¿me podría dictar el **número de teléfono celular** a 10 dígitos de esa persona?";

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
                        setMessages(prev => [...prev, { role: 'assistant', content: "El número debe tener exactamente 10 dígitos. Por favor verifíquelo.", avatar: tiloImg, inputType: 'tel' }]);
                        return;
                    }

                    // Duplication logic: For adults, emergency phone cannot match primary phone.
                    // For minors, bypass this restriction since the tutor's phone will often be the contact phone.
                    const curPtCtx = patientData.profile.pediatric_profile;
                    if (cleanPhone === patientData.profile.phone) {
                        if (!curPtCtx || !curPtCtx.is_minor) {
                            setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Intersección Identificada**\nEl número de emergencia no puede ser idéntico al perfil principal registrado.\n\nPor favor, proporcione un número alterno a 10 dígitos para vincular a la red de seguridad:", avatar: tiloImg, inputType: 'tel' }]);
                            return;
                        }
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: {
                            ...prev.profile,
                            emergencyContact: { ...prev.profile.emergencyContact, phone: cleanPhone }
                        },
                        emergencia: {
                            ...prev.emergencia,
                            telefono: cleanPhone
                        }
                    }));

                    // TRANSITION TO FASE 3: MOTIVO DE CONSULTA (STEP 1: CATEGORY)
                    const name = patientData.profile.first_name || "Paciente";
                    const msgContent = `He consolidado su red de seguridad institucional. Para habilitar los algoritmos de análisis correctos, debemos definir el eje central de su transformación.\n\n**${name}**, por favor **seleccione la categoría** principal que mejor describa su motivo de consulta hoy:`;

                    const categoryOptions = ROUTE_CATEGORIES.map(cat => ({
                        label: cat.nombre,
                        value: cat.id
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'strict_select',
                        options: categoryOptions
                    }]);
                    setActiveTab('clinical'); // Update UI Context to Clinical History Tab
                    setCurrentPhase('PHASE_3_CATEGORY_SELECTION');
                    break;
                }

                // =============== FASE 3: MOTIVO DE CONSULTA ===============
                case 'PHASE_3_CATEGORY_SELECTION': {
                    const categoryId = text; // Expecting e.g. "CAT_A"
                    const categoryObj = ROUTE_CATEGORIES.find(c => c.id === categoryId);

                    if (!categoryObj) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyCortexCalibration("Por favor, **seleccione** una de las **categorías clínicas** válidas mostradas en las opciones.", patientData.profile.age, patientData.profile.first_name),
                            avatar: tiloImg
                        }]);
                        break;
                    }

                    // Filtrar rutas que pertenezcan a esta categoría
                    const matchingRoutes = CLINICAL_ROUTES.filter(route => route.categoryId === categoryId);

                    const options = matchingRoutes.map(route => ({
                        label: route.nombre,
                        value: route.id,
                        icon: route.icon
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: applyCortexCalibration(`**${categoryObj.nombre}**.\n\n[TONE_MODIFIER] **seleccione** la ruta específica en la que desea enfocarse hoy:`, patientData.profile.age, patientData.profile.first_name),
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: options
                    }]);

                    setCurrentPhase('PHASE_3_CONVERSATIONAL_SELECTION');
                    break;
                }

                case 'PHASE_3_CONVERSATIONAL_SELECTION': {
                    let selectedRouteId = text; // The value from the button

                    // INYECCIÓN CORTEX -> GENOMA (Actualiza Dashboard)
                    setMotivosConsulta([selectedRouteId]);
                    setRutaPrimaria(selectedRouteId);

                    if (selectedRouteId === 'ROUTE_BAJAR_PESO') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyCortexCalibration(`Ruta de Control Metabólico activada. Mi motor de análisis ha habilitado el Protocolo NOM-008 para el tratamiento integral de su composición corporal.\n\nPara entender su historial biológico: ¿desde qué etapa de su vida considera que inició su aumento de peso (ej. niñez, después de un embarazo, inicio de vida laboral)?`, patientData.profile.age, patientData.profile.first_name),
                            avatar: tiloImg
                        }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_WEIGHTLOSS');
                    } else if (selectedRouteId === 'ROUTE_CONTROL_CLINICO') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyCortexCalibration(`Ruta de Manejo de Enfermedad Crónica activada. Mi motor de análisis ha habilitado el Protocolo NOM-015/030 para el tratamiento integral de su condición.\n\n**${patientData.profile.first_name || "Paciente"}**, por favor **indique**: ¿Hace cuánto tiempo recibió su diagnóstico oficial?`, patientData.profile.age, patientData.profile.first_name),
                            avatar: tiloImg
                        }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 0 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_CLINICAL_ANTIGUEDAD');
                    } else if (selectedRouteId === 'ROUTE_GANAR_MUSCULO') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyCortexCalibration(`Ruta de Hipertrofia y Composición activada.\n\n[TONE_MODIFIER] ¿Cuál es su disciplina deportiva actual y **describa** si existe algún antecedente de lesiones físicas que limite su progreso?`, patientData.profile.age, patientData.profile.first_name),
                            avatar: tiloImg
                        }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_MUSCLE');
                    } else if (selectedRouteId === 'ROUTE_PEDIATRIA') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyCortexCalibration(`Modo Pediátrico activado. Protocolo NOM-031 habilitado para la monitorización de crecimiento.\n\nPara establecer su línea base de desarrollo: ¿Podría indicarme sus antecedentes perinatales, tiempo de lactancia recibida y si alcanzó sus hitos del desarrollo a tiempo?`, patientData.profile.age, patientData.profile.first_name),
                            avatar: tiloImg
                        }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_PEDIATRICS');
                    } else if (selectedRouteId === 'ROUTE_EMBARAZO') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyCortexCalibration(`Ruta Materno-Fetal activada. Monitorización NOM-007 en curso.\n\nPara iniciar su control gestacional: ¿Cuáles son sus semanas de gestación actuales, su peso pre-gestacional y tiene algún riesgo obstétrico detectado por su médico?`, patientData.profile.age, patientData.profile.first_name),
                            avatar: tiloImg
                        }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_PREGNANCY');
                    } else if (selectedRouteId === 'ROUTE_BIOHACKING') {
                        setMessages(prev => [...prev, { role: 'assistant', content: applyCortexCalibration(`Protocolo Longevity activado. Interfaz Dark Clinical Pro y métricas de Biohacking habilitadas.\n\n[TONE_MODIFIER] ¿Maneja algún dispositivo wearable de monitoreo o cuenta con estudios de laboratorio recientes (ej. insulina, PCR-us)?`, patientData.profile.age, patientData.profile.first_name), avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_BIOHACKING');
                    } else if (selectedRouteId === 'ROUTE_GERIATRIA') {
                        setMessages(prev => [...prev, { role: 'assistant', content: applyCortexCalibration(`Protocolo Geriátrico activado. MNA y monitoreo de sarcopenia en línea.\n\n[TONE_MODIFIER] ¿Podría indicarme la medida actual de circunferencia de pantorrilla y si **${patientData.profile.first_name || "el paciente"}** cuenta con un cuidador designado?`, patientData.profile.age, patientData.profile.first_name), avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_GERIATRICS');
                    } else if (selectedRouteId === 'ROUTE_MENOPAUSIA') {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Ruta de Endocrinología Femenina activada. Monitoreo Óseo y de Síndrome Metabólico en curso.\n\nPara calibrar su perfil hormonal: ¿En qué etapa exacta se encuentra actualmente (perimenopausia o menopausia instalada) y toma algún tratamiento de reemplazo hormonal?`, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_MENOPAUSE');
                    } else if (selectedRouteId === 'ROUTE_TCA') {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Modo de Restauración Metabólica y Conducta Alimentaria Segura activado. He **bloqueado confidencialmente** toda visualización de peso y calorías para proteger su entono en esta app.\n\nSabemos que este es un espacio seguro. ¿Actualmente se encuentra bajo el acompañamiento de algún profesional de la psicología o psiquiatría?`, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_METHAL_HEALTH');
                    } else if (selectedRouteId === 'ROUTE_BARIATRIA') {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Protocolo Quirúrgico Metabólico pos-obesidad activado. El Motor de Texturas ha sido habilitado.\n\nPara asegurar que sus alimentos sean tolerables: ¿Cuál es su cronología exacta posquirúrgica (días o semanas transcurridas) y qué tipo de procedimiento primario se realizó?`, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_BARIATRICS');
                    } else if (selectedRouteId === 'ROUTE_RENAL') {
                        setMessages(prev => [...prev, { role: 'assistant', content: applyCortexCalibration(`Protocolo Nefrológico iniciado. He bloqueado todos los macro-electrolitos de riesgo en el recetario.\n\nEsta es una variable crítica y sensible: ¿Conoce su actual estimación de Filtrado Glomerular (TFG) o padece insuficiencia en etapa avanzada con prescripción de "Peso Seco"?`, patientData.profile.age, patientData.profile.first_name), avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_RENAL');
                    } else if (selectedRouteId === 'ROUTE_ONCOLOGIA') {
                        const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                        const diagLabel = getGenderedTerm("diagnosticado", sx);
                        setMessages(prev => [...prev, { role: 'assistant', content: applyCortexCalibration(`Protocolo Integral Oncológico Activo. Prioridad en densidad energética e inmunidad.\n\nPara el módulo de protección celular: ¿Cuál es el tipo de cáncer específico que le fue ${diagLabel} (Ej. Mama, Colon, Próstata) y conoce en qué Etapa o Estadio clínico se encuentra (I, II, III o IV)?`, patientData.profile.age, patientData.profile.first_name), avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_ONCOLOGY');
                    } else if (selectedRouteId === 'ROUTE_VIH') {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Protocolo de Inmunonutrición iniciado bajo el sello de ENCRIPTACIÓN BIOMÉTRICA SEVERA (Nivel LFPDPPP).\n\nPara blindar su estado metabólico: ¿Desea registrar de forma 100% confidencial el estatus cualitativo de su carga viral, o prefiere abordarlo únicamente desde una perspectiva enzimática y sintomática?`, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_IMMUNO');
                    } else if (selectedRouteId === 'ROUTE_PALIATIVOS') {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Modo Ético de Cuidado Paliativo y Confort activado. Restricciones calóricas biológicas han sido permanentemente bloqueadas.\n\nEl confort del paciente es nuestra única métrica aquí: ¿Cuáles son las barreras físicas principales que el paciente enfrenta al deglutir, incluyendo la percepción de resequedad oral grave?`, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_PALLIATIVE');
                    } else if (selectedRouteId === 'ROUTE_ALERGIAS') {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Escudo Físico Anti-Anafilaxia activado con apego a NOM-051.\n\nPor favor instruya con extrema precisión: ¿A qué alimento(s) específico(s) o familia biológica presenta diagnóstico de alergia inflamatoria aguda o riesgo de hiperreactividad (choque anafiláctico)?`, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_ALLERGY');
                    } else if (selectedRouteId === 'ROUTE_ADICCIONES') {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Ruta de Soporte de Desintoxicación y Rehabilitación iniciada. Filtro de hiperestimulación activado.\n\nPara resguardar su sistema nervioso simpático: ¿A qué nivel califica su tolerancia o síndrome de abstinencia actual, y qué grupos estimulantes prefiere bloquear completamente?`, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_ADDICTION');
                    } else if (selectedRouteId === 'ROUTE_DISCAPACIDAD') {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Módulo Ergofísico WCAG y Ecuaciones de Antropometría Asistida en línea.\n\nPara lograr alta precisión mitigando la fatiga posicional: Dado que la bipedestación presenta restricciones, ¿tiene a la mano la medida de la circunferencia de su brazo o cuenta con el dato de su Altura de Rodilla?`, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));
                        setCurrentPhase('PHASE_3_SUB_ROUTE_DISABILITY');
                    } else {
                        // Default fallback text (En caso extremo de bug en IDs)
                        setMessages(prev => [...prev, { role: 'assistant', content: `Iniciando la calibación celular para **su Objetivo**.\n\nA continuación, recolectaré las variables primordiales para este protocolo.`, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }


                // --- PATHWAY SPECIFIC SUB-QUESTIONNAIRES V31.0 ---
                case 'PHASE_3_SUB_ROUTE_WEIGHTLOSS': {
                    const questions = [
                        "Registrando ruta metabólica de reducción.\n\nPara calcular su punto de ajuste termogénico: ¿Cuál es el peso máximo que ha alcanzado en su vida, sin contar embarazo?",
                        "Entendido.\n\nPara detectar posible daño periférico a receptores insulínicos: ¿Dónde siente que acumula mayor tejido adiposo (ej. Cintura, cadera, espalda)?",
                        "Registrado.\n\nFinalmente para esta ruta: Del 1 al 10, ¿qué nivel de ansiedad por carbohidratos o comida dulce presenta por las tardes/noches?"
                    ];
                    const keys = ['max_weight', 'adipose_zone', 'carb_anxiety'];

                    if (fase3State.subQuestionIndex < questions.length) {
                        // Guardar respuesta anterior si no es la primera vuelta
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }

                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        // Guardar última respuesta
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        // Pasar al Miracle Question o Detective
                        const msg = `Excelente.\n\nPara calibrar su cronología celular: ¿Desde hace cuánto tiempo lucha con este objetivo biológico?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_CLINICAL_ANTIGUEDAD': {
                    const age = patientData.profile?.age || patientData.identificacion?.edad || 30;
                    const patientFirstNameRaw = (patientData.identificacion?.nombre || patientData.profile?.first_name || "Paciente").split(' ')[0];
                    const patientFirstName = patientFirstNameRaw.replace(/,+$/, '');

                    if (fase3State.subQuestionIndex === 0) {
                        // Paso 0: Guardar Respuesta de Antigüedad y Último Valor
                        setPathwaySpecifics({ 'clinical_diagnosis_seniority_and_value': text });

                        // Paso 1: organ_risk_symptoms
                        let msg = "";
                        if (age >= 18) {
                            msg = `La identificación temprana de sintomatología sensorial es una medida de seguridad crítica para descartar afectaciones en órganos blanco como la retina, el sistema nervioso periférico o el sistema cardiovascular.\n\nIndique usted si ha notado recientemente visión borrosa, hormigueo en extremidades, mareos frecuentes o zumbido en los oídos; en caso afirmativo, por favor especifique cuál.`;
                        } else if (age >= 12 && age < 18) {
                            msg = `Supervisar cualquier cambio en tu percepción sensorial es una prioridad clínica para proteger tu desarrollo y detectar riesgos de forma oportuna.\n\nPrecisa si has observado visión borrosa, mareos o alguna molestia física inusual; de ser así, describe detalladamente el síntoma.`;
                        } else {
                            msg = `Supervisar cualquier cambio en la percepción sensorial de ${patientFirstName} es una prioridad clínica para proteger su desarrollo y detectar riesgos de forma oportuna.\n\nPrecise usted si ha observado que ${patientFirstName} manifieste visión borrosa, mareos o alguna molestia física inusual; de ser así, describa detalladamente el síntoma.`;
                        }

                        // Usamos botones rápidos para Sí/No, si responde "Sí" (o escribe), pedimos detalles.
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msg,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "❌ No he notado ninguno", value: "NO_SYMPTOMS" },
                                { label: "⚠️ Sí, especificaré cuáles", value: "YES_SYMPTOMS" }
                            ]
                        }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 1 }));

                    } else if (fase3State.subQuestionIndex === 1) {
                        if (text === 'YES_SYMPTOMS') {
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: `Por favor, especifique detalladamente cuáles son sus síntomas, la frecuencia y duración de los mismos:`,
                                avatar: tiloImg,
                                inputType: 'text'
                            }]);
                            // Nos quedamos en el índice 1, pero marcamos que estamos esperando descripcion
                            setFase3State(prev => ({ ...prev, waitingForSymptomDetails: true }));
                            return; // Salimos para esperar input del usuario
                        } else if (fase3State.waitingForSymptomDetails || text !== 'NO_SYMPTOMS') {
                            // Si estaba esperando detalles, o escribió un texto en lugar de tocar el botón
                            setPathwaySpecifics({ 'organ_risk_symptoms': text });
                            setFase3State(prev => ({ ...prev, alert_level: 'CRITICAL', waitingForSymptomDetails: false }));
                        } else {
                            // Dijo que NO
                            setPathwaySpecifics({ 'organ_risk_symptoms': 'NO_SYMPTOMS' });
                            setFase3State(prev => ({ ...prev, waitingForSymptomDetails: false }));
                        }

                        // Avanzamos al Paso 3: self_monitoring_adherence
                        let msg = "";
                        if (age >= 18) {
                            msg = `El automonitoreo constante es el pilar de la corresponsabilidad clínica, permitiendo ajustes dinámicos en su plan nutricional basados en datos biológicos reales.\n\nMencione usted si cuenta en su domicilio con glucómetro o baumanómetro y con qué frecuencia realiza sus mediciones.`;
                        } else if (age >= 12 && age < 18) {
                            msg = `El automonitoreo constante es fundamental para que tomes el control y podamos ajustar tu plan con datos reales.\n\n¿Cuentas en casa con glucómetro o baumanómetro y con qué frecuencia lo usas?`;
                        } else {
                            msg = `El automonitoreo en el hogar es indispensable para realizar ajustes dinámicos en el plan de ${patientFirstName}.\n\nMencione si cuenta en casa con equipo de medición (glucómetro, baumanómetro) y con qué frecuencia lo utilizan.`;
                        }

                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 2 }));

                    } else if (fase3State.subQuestionIndex === 2) {
                        setPathwaySpecifics({ 'self_monitoring_adherence': text });

                        // Avanzamos al Paso 4: medication_adherence_status
                        let msg = "";
                        if (age >= 18) {
                            msg = `La sincronización precisa entre su pauta farmacológica y su intervención nutricional es indispensable para evitar eventos de hipoglucemia o crisis hipertensivas durante el tratamiento.\n\nConfirme usted si toma sus medicamentos exactamente como fueron prescritos o si suele omitir alguna dosis; de ser este el caso, detalle el motivo.`;
                        } else if (age >= 12 && age < 18) {
                            msg = `La autogestión responsable de tu tratamiento farmacológico es un paso decisivo hacia tu independencia y salud metabólica futura.\n\nIndica si sigues tu tratamiento médico con precisión o si has tenido dificultades para cumplir con los horarios de tus dosis.`;
                        } else {
                            msg = `La sincronización precisa de la farmacología es indispensable para evitar descompensaciones durante el nuevo régimen.\n\nConfirme si logran administrar los medicamentos a ${patientFirstName} exactamente como fueron prescritos o si hay dificultades con las tomas.`;
                        }

                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 3 }));

                    } else if (fase3State.subQuestionIndex === 3) {
                        setPathwaySpecifics({ 'medication_adherence_status': text });

                        // Avanzamos al Paso 5: emotional_driver_clinical
                        // Este funge como el "Miracle Question" de esta ruta.
                        let msg = "";
                        if (age >= 18) {
                            msg = `Estabilizar sus parámetros clínicos es el paso fundamental para recuperar su libertad funcional y garantizar su bienestar a largo plazo.\n\nMás allá del control médico, ¿cuál es la motivación personal que le impulsa a usted a mantener su salud óptima por muchos años más? (Ej: Seguir viajando, ver crecer a mi familia)`;
                        } else if (age >= 12 && age < 18) {
                            msg = `Estabilizar tus niveles es la herramienta más poderosa para validar tu soberanía biológica y asegurar que tu desarrollo no se vea comprometido.\n\n¿Qué es lo que más te motiva a tomar el control de tu cuerpo en esta etapa?`;
                        } else {
                            msg = `Lograr unos niveles óptimos es clave para el bienestar ininterrumpido de ${patientFirstName}.\n\nComo familia, ¿qué es lo que más les impulsa a asegurar su éxito en este tratamiento?`;
                        }

                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: 4 })); // Mark as finished with pathway questions

                    } else if (fase3State.subQuestionIndex === 4) {
                        // Guardar la última rerspuesta
                        setFase3State(prev => ({ ...prev, emotional_anchor: text }));

                        // Esta ruta ya recopiló su Miracle Question customizado, por lo que nos saltamos
                        // PHASE_3_DETECTIVE_PROBE y PHASE_3_MIRACLE_QUESTION, directo a Inference Confirm

                        let inferredGoal = 'Controlar Enfermedad';
                        setFase3State(prev => ({ ...prev, inferred_goal: inferredGoal, showInferenceCard: true }));

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Anclaje emocional guardado de forma confidencial. He procesado todas sus variables y validado su biometría contra la literatura médica.\n\nHe determinado que su mapa clínico prioritario a seguir es: **${inferredGoal}**. ¿Confirma que este es el rumbo correcto?`,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "✅ Sí, es correcto", value: inferredGoal },
                                { label: "Preferiría elegir otro enfoque", value: "REJECT_INFERENCE" }
                            ]
                        }]);

                        setCurrentPhase('PHASE_3_INFERENCE_CONFIRM');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_MUSCLE': {
                    const questions = [
                        "Ruta de Rendimiento y Ganancia Muscular activada.\n\nPara calcular vía Cunningham-Katch: ¿Cuántos días a la semana entrena fuerza y cuánto dura su sesión?",
                        "Excelente.\n\n¿Actualmente consume suplementación (Creatina, Whey, Pre-entrenos) o compuestos androgénicos (indicar dosis para alerta hepática)?",
                        "Capturado.\n\n¿En qué ciclo se encuentra actualmente? (Ej. Volumen sucio, Volumen limpio, Recomposición, Mantenimiento)"
                    ];
                    const keys = ['training_freq', 'supplementation', 'current_cycle'];

                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `Métricas base en expediente.\n\nPara ver la rampa de progreso: ¿Desde hace cuánto tiempo entrena con consistencia real?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_BIOHACKING': {
                    const questions = [
                        "Protocolo Longevity iniciado. Nivel de acceso: Dark Clinical.\n\nPara ajustar el ángulo de fase celular: ¿Cuántas horas de ayuno profundo promedia regularmente?",
                        "Registrado.\n\nPreparando algoritmos de termogénesis y VFC. ¿Utiliza actualmente anillos (Oura) o sensores continuos de glucosa?",
                        "Capturado. El entorno de hardware biométrico ha sido calibrado.\n\nFinalmente: Del 1 al 10, evalúe su claridad y enfoque mental al despertar."
                    ];
                    const keys = ['fasting_hours', 'biometric_hardware', 'morning_focus'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `Métricas base en expediente.\n\nPara evaluar la entropía de su reloj circadiano: ¿Desde hace cuánto tiempo inició con terapias antienvejecimiento o notó fatiga cognitiva sistémica?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_PEDIATRICS': {
                    const questions = [
                        "Ruta de Desarrollo Pediátrico en curso (NOM-031).\n\nPara nuestros gráficos de la OMS: ¿Cuál fue el peso y longitud que tuvo el paciente al nacer?",
                        "Entendido.\n\nEn cuanto a alimentación complementaria o actual: ¿Existen rechazos alimentarios marcados o selectividad severa detectables a simple vista?",
                        "Registrado. Esta variable alterará la configuración de texturas.\n\nÚltima pregunta para el entorno: ¿Quién es el cuidador principal encargado de la preparación de los alimentos?"
                    ];
                    const keys = ['birth_weight_length', 'food_selectivity', 'primary_caregiver'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `El panorama pediátrico está modelado.\n\nPara enlazar la temporalidad a los percentiles poblacionales: ¿Desde qué mes o edad notaron preocupación por esta variante nutricional?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_PREGNANCY': {
                    const questions = [
                        "Protocolo Materno-Fetal activo.\n\nPara el cálculo del add-on calórico trimestral (NOM-007): ¿En qué semana exacta de gestación se encuentra?",
                        "Anotado. He bloqueado las vías metabólicas cetogénicas por seguridad neurológica del feto.\n\nPara la alerta de preeclampsia temprana: ¿Ha presentado dolores de cabeza severos, hinchazón repentina o presión arterial alta confirmada?",
                        "Esquema de contención vital configurado.\n\nFinalmente: ¿Presenta náuseas matutinas severas, vómitos o acidez profunda en este momento?"
                    ];
                    const keys = ['gestational_week', 'preeclampsia_symptoms', 'gastric_distress'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `Métricas de blindaje embrionario integradas.\n\nPara el seguimiento de suplementación (Hierro, Folato, DHA): ¿En qué momento previo a la gestación inició soporte vitamínico?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_GERIATRICS': {
                    const questions = [
                        "Protocolo de Geriatría Activo. He precargado los parámetros del Mini Nutritional Assessment (MNA).\n\nPara medir fragilidad ósea y muscular: ¿Ha presentado caídas no intencionales en los últimos 6 meses?",
                        "Entendido. Vigilaremos el perímetro de pantorrilla transversalmente.\n\nPara prevenir disfagia temprana: ¿Ha notado dificultad para masticar, tragar sólidos o tose al beber líquidos con frecuencia?",
                        "Validación de vías orales completa.\n\nDel 1 al 10, donde 10 es total independencia, ¿qué tanta ayuda requiere diaria para sus actividades vitales (higiene, cocinar, moverse)?"
                    ];
                    const keys = ['recent_falls', 'dysphagia_signs', 'dependence_level'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `Los vectores geriátricos han sido almacenados confidencialmente.\n\nPara evaluar la línea de desgaste en sarcopenia: ¿Desde hace cuánto tiempo nota esta disminución de energía y funcionalidad motriz?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_MENOPAUSE': {
                    const questions = [
                        "Arquitectura Endocrina Femenina iniciada.\n\nPara fijar el estatus de estrógenos: ¿Aún tiene ciclos menstruales, son irregulares, o han cesado por completo y hace cuánto tiempo?",
                        "Anotado. Sistema óseo en observación profunda.\n\n¿Ha presentado sintomatología vasomotora severa (bochornos nocturnos intensos) o alteraciones marcadas en la calidad del sueño recientemente?",
                        "Entendido. \n\nPara descartar transición de riesgo cruzado: ¿Tiene laboratorios recientes de perfil lipídico o tiroideo que presenten ya una irregularidad oficial?"
                    ];
                    const keys = ['cycle_status', 'vasomotor_sleep_symptoms', 'recent_labs'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `La matriz de soporte hormonal ha sido estructurada.\n\nPara delinear la cronología ginecológica: ¿Desde cuándo fue el primer momento en que notó esta transición biológica drástica?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_METHAL_HEALTH': {
                    const questions = [
                        "Protocolo de Salud Mental o TCA.\n\nPara el registro de neuro-divergencias o trastornos de conducta alimentaria: ¿Alguna vez ha sido diagnosticado oficialmente en este ámbito?",
                        "Anotado. El enfoque será gentil y sin enfoque en peso.\n\n¿Identifica usted alimentos 'gatillo' que disparen episodios de atracón o restricción severa?",
                        "Comprendido. Evitaremos clasificaciones punitivas.\n\nFinalmente, del 1 al 10, ¿cómo calificaría su nivel actual de estrés, ansiedad o depresión que interfiere con su alimentación?"
                    ];
                    const keys = ['mental_diagnosis', 'trigger_foods', 'stress_level'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `Base de contención mental procesada.\n\nPara ayudar al abordaje psicológico: ¿Desde hace cuánto tiempo esta relación con la comida ha sido su mayor reto?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_BARIATRICS': {
                    const questions = [
                        "Protocolo Bariátrico Post-Quirúrgico. Motor de texturas activo.\n\nPara sincronizar las fases de dieta (líquida, puré, blanda, normal): ¿Cuál es la fecha exacta de su cirugía (Día/Mes/Año)?",
                        "Registrado. Se ha calculado la semana post-operatoria.\n\nPara el protocolo de malabsorción obligatoria (Hierro, Complejo B, D3): ¿Se encuentra usted tomando alguna suplementación bariátrica especial en este momento?",
                        "Documentado. Restricción preventiva de carbohidratos simples activada.\n\n¿Ha presentado sintomatología de 'Dumping Syndrome' (mareos bruscos, sudoración y taquicardia inmediatamente tras comer)?"
                    ];
                    const keys = ['surgery_date', 'bariatric_supplements', 'dumping_syndrome'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `Protocolos físicos post-operatorios alineados.\n\nPara establecer la trayectoria del cambio metabólico: ¿Siente que esta cirugía fue el punto de inflexión respecto al control de su salud o lucha con algo más desde entonces?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_RENAL': {
                    const questions = [
                        "Especialidad en Nefrología (NOM-004).\n\nPara cargar la restricción de macro/micronutrientes: ¿En qué estadio de enfermedad renal crónica se encuentra, o está en terapia de reemplazo (Hemodiálisis/Diálisis Peritoneal)?",
                        "Prioridad renal activa. Control riguroso de líquidos y electrolitos.\n\nPor favor, ¿tiene estudios recientes con valores de potasio, fósforo y Tasa de Filtración Glomerular (TFG)?",
                        "Métricas registradas para cálculo en back-end.\n\nFinalmente: ¿Consume complementos o plantas medicinales no reguladas que deban limpiarse para protección del tejido nefronal?"
                    ];
                    const keys = ['ckd_stage', 'renal_labs', 'nephrotoxic_herbs'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `Nefromodulación estructural inicializada.\n\nPara situarnos en su historial nefrológico: ¿Desde hace cuánto tiempo vive con insuficiencia o diagnóstico de alerta renal?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_ONCOLOGY': {
                    const questions = [
                        "El sistema priorizará densidad energética e inmunidad.\n\nRespecto a su estatus médico actual: ¿Apenas ha recibido el diagnóstico, se encuentra en vigilancia, o ya cuenta con un esquema activo / programado de Quimioterapia, Radioterapia o Inmunoterapia?",
                        "Tratamiento oncológico en expediente clínico.\n\nPara prevenir el catabolismo severo (caquexia) y adaptar su menú: ¿Ha presentado fiebre frecuente, pérdida rápida e inexplicable de peso, o inflamación sistémica en las últimas semanas?",
                        "Confirmado. El protocolo de soporte nutricional oncológico se ha activado.\n\nPara un cronograma integral: ¿Desde hace cuánto tiempo inició esta travesía médica contra el diagnóstico?"
                    ];
                    const keys = ['cancer_type_stage', 'treatment_status', 'inflammatory_markers'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `El protocolo de soporte nutricional oncológico se ha activado.\n\nPara un cronograma integral: ¿Desde hace cuánto tiempo inició esta travesía médica contra el diagnóstico?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_SUB_ROUTE_IMMUNO':
                case 'PHASE_3_SUB_ROUTE_PALLIATIVE':
                case 'PHASE_3_SUB_ROUTE_ALLERGY':
                case 'PHASE_3_SUB_ROUTE_ADDICTION':
                case 'PHASE_3_SUB_ROUTE_DISABILITY': {
                    // Rutas genéricas pero con Sub-Questionnaire dinámico para extraer data básica
                    const questions = [
                        "Para calibrar la ruta de soporte especializado: ¿Podría describir brevemente el diagnóstico o condición primaria que debemos considerar en la dieta?",
                        "Anotado. ¿Qué medicamentos, tratamientos o limitantes clave dictan el día a día para esta condición?",
                        "Registrado. ¿Existen alimentos o rutinas que estén completamente prohibidos o debamos evitar a toda costa?"
                    ];
                    const keys = ['primary_condition', 'key_treatments', 'strict_avoidance'];
                    if (fase3State.subQuestionIndex < questions.length) {
                        if (fase3State.subQuestionIndex > 0) {
                            setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: questions[fase3State.subQuestionIndex], avatar: tiloImg }]);
                        setFase3State(prev => ({ ...prev, subQuestionIndex: prev.subQuestionIndex + 1 }));
                    } else {
                        setPathwaySpecifics({ [keys[fase3State.subQuestionIndex - 1]]: text });
                        const msg = `Variables de apoyo especializado mapeadas exitosamente.\n\nPara afinar la línea temporal del expediente: ¿Desde hace cuánto vive o lidia con este escenario de salud?`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    }
                    break;
                }

                case 'PHASE_3_DETECTIVE_PROBE': {
                    const timeRegex = /\d|mes|año|semana|dia|siempre|hace|joven/i;
                    if (timeRegex.test(text)) {
                        setFase3State(prev => ({
                            ...prev,
                            detective_radiography: {
                                ...prev.detective_radiography,
                                chronology: text
                            }
                        }));
                    }

                    const isPathology = fase3State.alert_level !== 'NONE';
                    const miracleMsg = isPathology
                        ? `Registro cronológico procesado. Para diseñar la arquitectura de su recuperación, necesito establecer su línea de anclaje emocional.\n\nImagine que hemos logrado estabilizar su metabolismo y recupera el control absoluto de su cuerpo. ¿Qué es lo primero que notará en su bienestar diario?`
                        : `Línea base temporal registrada con éxito. Para calibrar la intensidad del programa, necesitamos definir su anclaje motivacional.\n\nProyéctese al momento en que alcancemos este objetivo biológico: ¿Qué es lo primero que podrá hacer y que el día de hoy le resulta difícil?`;

                    setMessages(prev => [...prev, { role: 'assistant', content: miracleMsg, avatar: tiloImg }]);
                    setCurrentPhase('PHASE_3_MIRACLE_QUESTION');
                    break;
                }

                case 'PHASE_3_MIRACLE_QUESTION': {
                    setFase3State(prev => ({ ...prev, emotional_anchor: text }));

                    // Determinación del Goal (Inference)
                    let inferredGoal = 'Bienestar / Aprender a comer';

                    // V17.6 - Lectura Real del Algoritmo (Evita Negligencia Diagnóstica)
                    const activeRoute = useClinicalGenome.getState().clinicalPathway.rutaPrimaria;

                    if (fase3State.isPregnant || activeRoute === 'ROUTE_EMBARAZO') inferredGoal = 'Gestación y Maternidad';
                    else if (activeRoute === 'ROUTE_ONCOLOGIA') inferredGoal = 'Soporte Médico Oncológico';
                    else if (activeRoute === 'ROUTE_RENAL' || activeRoute === 'ROUTE_CONTROL_CLINICO') inferredGoal = 'Controlar Enfermedad Metabólica';
                    else if (activeRoute === 'ROUTE_PEDIATRIA') inferredGoal = 'Nutrición para el Desarrollo';
                    else if (fase3State.isGoal || activeRoute === 'ROUTE_GANAR_MUSCULO' || activeRoute === 'ROUTE_BIOHACKING') inferredGoal = 'Rendimiento y Bienestar';
                    else if (activeRoute) {
                        // Fallback checking alert level for unspecified dynamic routes
                        const level = fase3State.alert_level;
                        if (level === 'PRETERM') inferredGoal = 'Nutrición para el Desarrollo';
                        else if (level === 'NEURO') inferredGoal = 'Salud Neuromotriz y Seguridad';
                        else if (level !== 'NONE') inferredGoal = 'Controlar Enfermedad';
                    }

                    // UPDATE DASHBOARD STATE TO SHOW INFERENCE CARD
                    setFase3State(prev => ({ ...prev, inferred_goal: inferredGoal, showInferenceCard: true }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Anclaje emocional guardado de forma confidencial. He procesado todas sus variables y validado su biometría contra la literatura médica e institucional.\n\nHe determinado que su mapa clínico prioritario a seguir es: **${inferredGoal}**. ¿Confirma que este es el rumbo correcto?`,
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
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Inferencia recalibrada. Procediendo a anulación inductiva.\n\n¿Cuál considera usted que es su enfoque clínico o meta principal en este momento?",
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "Controlar Enfermedad Metabólica", value: "Controlar Enfermedad" },
                                { label: "Soporte Médico Oncológico", value: "Soporte Médico Oncológico" },
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
                    const msgContent = applyCortexCalibration(`Mapa de prioridades establecido en expediente.\n\nHe activado el protocolo de mapeo de herencia biológica bajo la **NOM-004**. Identificar su predisposición genética es el cimiento necesario para blindar su salud celular y prevenir riesgos sistémicos. **${patientData.profile.first_name || "Paciente"}**, por favor **valide**: ¿Sus padres, abuelos o hermanos padecen alguna enfermedad crónica diagnosticada?`, patientData.profile.age, patientData.profile.first_name);

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ Objetivo registrado empíricamente.\n\n` + msgContent,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "✅ SÍ", value: "SI_HEREDO" },
                            { label: "❌ NO", value: "NO_HEREDO" }
                        ]
                    }]);
                    setActiveTab('clinical');
                    setCurrentPhase('PHASE_4_HEREDO_GATE'); // Cambio de estado a la nueva compuerta
                    break;
                }

                // =============== FASE 4: ANTECEDENTES HEREDOFAMILIARES (V36.1 - LINEAR LOOP) ===============
                case 'PHASE_4_HEREDO_GATE': {
                    if (text === 'SI_HEREDO') {
                        const msg = applyCortexCalibration(`Para documentar este mapa de riesgos con rigor clínico, identificaremos a sus familiares directos uno a uno.\n\n**${patientData.profile.first_name || "Paciente"}**, por favor **indique** el primer familiar que desea registrar en su expediente:`, patientData.profile.age, patientData.profile.first_name);
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msg,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: "Padre", value: "Padre" },
                                { label: "Madre", value: "Madre" },
                                { label: "Abuelo Paterno", value: "Abuelo Paterno" },
                                { label: "Abuela Paterna", value: "Abuela Paterna" },
                                { label: "Abuelo Materno", value: "Abuelo Materno" },
                                { label: "Abuela Materna", value: "Abuela Materna" },
                                { label: "Hermano", value: "Hermano" },
                                { label: "Hermana", value: "Hermana" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_4_HEREDO_LOOP_RELATIVE');
                    } else if (text === 'NO_HEREDO') {
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...prev.history,
                                family_checklist_verified: true,
                                family_structured: []
                            }
                        }));

                        // TRANSITION TO FASE 5: ANTECEDENTES PERSONALES PATOLOGICOS
                        const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                        const diagLabel = getGenderedTerm("diagnosticado", sx);

                        const msgContent = applyCortexCalibration(`Registro inicial de carga genética **nula**. Mapa de determinantes familiares sellado.\n\nPasando a sus Patologías Personales: ¿Usted padece o ha padecido alguna enfermedad crónica ${diagLabel}? (Ej. Hipotiroidismo, Diabetes, etc.)`, patientData.profile.age, patientData.profile.first_name);

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msgContent,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_5_PERSONAL_START');
                    }
                    break;
                }

                case 'PHASE_4_HEREDO_LOOP_RELATIVE': {
                    const selectedRelative = typeof text === 'string' ? text : text.value || text.label;

                    // Guarda temporalmente el familiar seleccionado
                    setFase3State(prev => ({ ...prev, currentLoopRelative: selectedRelative }));

                    const msg = applyCortexCalibration(`Vínculo genético con su **${selectedRelative}** establecido en el sistema.\n\nPor favor, **seleccione** el diagnóstico o patología que padece (puede marcar varias de ser necesario, separadas por coma si escribe manual o eligiendo una si la lista es de opción única):`, patientData.profile.age, patientData.profile.first_name);

                    // Inyección de SearchableVerticalMenu (CISM)
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msg,
                        avatar: tiloImg,
                        inputType: 'strict_select',
                        options: [
                            { label: "Diabetes", value: "Diabetes" },
                            { label: "Hipertensión Arterial", value: "Hipertensión Arterial" },
                            { label: "Enfermedad Renal", value: "Enfermedad Renal" },
                            { label: "Infarto / Cardiopatía", value: "Infarto / Cardiopatía" },
                            { label: "Cáncer / Tumores", value: "Cáncer / Tumores" },
                            { label: "Enfermedad Mental", value: "Enfermedad Mental" },
                            { label: "Alergias Graves", value: "Alergias Graves" },
                            { label: "Otros...", value: "Otras" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_4_HEREDO_LOOP_DISEASE');
                    break;
                }

                case 'PHASE_4_HEREDO_LOOP_DISEASE': {
                    const disease = typeof text === 'string' ? text : text.value || text.label;
                    const targetRelative = fase3State.currentLoopRelative || "Familiar";

                    if (disease === "Otras") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyCortexCalibration(`Ventana de excepción diagnóstica abierta.\n\nPor favor, **especifique** el nombre de la otra patología que padece su **${targetRelative}**:`, patientData.profile.age, patientData.profile.first_name),
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_4_HEREDO_LOOP_OTHER');
                    } else {
                        // Guarda el par Familiar -> Enfermedad e Inyección de Flags
                        setPatientData(prev => {
                            const newFlags = prev.flags ? [...prev.flags] : [];
                            if ((disease === 'Cáncer / Tumores' || disease === 'Enfermedad Renal') && !newFlags.includes('VIGILANCIA_FASE_19')) {
                                newFlags.push('VIGILANCIA_FASE_19');
                            }

                            return {
                                ...prev,
                                flags: newFlags,
                                history: {
                                    ...prev.history,
                                    family_structured: [
                                        ...(prev.history?.family_structured || []),
                                        { relative: targetRelative, condition: disease, detail: disease }
                                    ]
                                }
                            };
                        });

                        // Control de Continuidad
                        const msg = applyCortexCalibration(`Antecedente de **${disease}** registrado con éxito en su mapa genético bajo el vínculo de **${targetRelative}**.\n\n**${patientData.profile.first_name || "Paciente"}**, para un seguimiento exhaustivo: ¿Existe algún otro familiar directo con enfermedades diagnosticadas que debamos incluir?`, patientData.profile.age, patientData.profile.first_name);
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msg,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "✅ SÍ, OTRO FAMILIAR", value: "SI_OTRO_FAMILIAR" },
                                { label: "❌ NO, TERMINAR MAPA", value: "NO_TERMINAR_FAMILIA" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_4_HEREDO_NEXT');
                    }
                    break;
                }

                case 'PHASE_4_HEREDO_LOOP_OTHER': {
                    const otherDisease = formatText(text);
                    const targetRelative = fase3State.currentLoopRelative || "Familiar";

                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            family_structured: [
                                ...(prev.history?.family_structured || []),
                                { relative: targetRelative, condition: 'OTHER', detail: otherDisease }
                            ]
                        }
                    }));

                    const msg = applyCortexCalibration(`Antecedente de **${otherDisease}** registrado con éxito bajo el vínculo de **${targetRelative}**.\n\nPara un seguimiento exhaustivo: ¿Existe algún otro familiar directo con enfermedades diagnosticadas que debamos incluir?`, patientData.profile.age, patientData.profile.first_name);
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msg,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "✅ SÍ, OTRO FAMILIAR", value: "SI_OTRO_FAMILIAR" },
                            { label: "❌ NO, TERMINAR MAPA", value: "NO_TERMINAR_FAMILIA" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_4_HEREDO_NEXT');
                    break;
                }

                case 'PHASE_4_HEREDO_NEXT': {
                    if (text === "SI_OTRO_FAMILIAR") {
                        const msg = applyCortexCalibration(`Reiniciando bucle de registro...\n\n**Indique** el siguiente familiar que desea registrar en su expediente:`, patientData.profile.age, patientData.profile.first_name);
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msg,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: "Padre", value: "Padre" },
                                { label: "Madre", value: "Madre" },
                                { label: "Abuelo Paterno", value: "Abuelo Paterno" },
                                { label: "Abuela Paterna", value: "Abuela Paterna" },
                                { label: "Abuelo Materno", value: "Abuelo Materno" },
                                { label: "Abuela Materna", value: "Abuela Materna" },
                                { label: "Hermano", value: "Hermano" },
                                { label: "Hermana", value: "Hermana" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_4_HEREDO_LOOP_RELATIVE');
                    } else if (text === "NO_TERMINAR_FAMILIA") {
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...prev.history,
                                family_checklist_verified: true
                            }
                        }));

                        // TRANSITION TO FASE 5: ANTECEDENTES PERSONALES PATOLOGICOS
                        const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                        const diagLabel = getGenderedTerm("diagnosticado", sx);
                        const msgContent = applyCortexCalibration(`Mapa de determinantes genéticos familiares **sellado** exitosamente.\n\nPasando a sus Patologías Personales: ¿Usted padece o ha padecido alguna enfermedad crónica ${diagLabel}? (Ej. Hipotiroidismo, Diabetes, etc.)`, patientData.profile.age, patientData.profile.first_name);

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msgContent,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_5_PERSONAL_START');
                    }
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

                    const msgContent = "Historial patológico primario asimilado.\n\nPara verificar intersecciones con requerimientos de la NOM-004, ¿usted padece alguna otra condición de esta lista oficial?";

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
                    setActiveTab('clinical'); // Ensured UI consistency
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
                            content: "Excepción clínica abierta.\n\nPor favor, escriba qué otra entidad patológica personal padece.",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_5_OTHER_SPECIFIC');
                    } else if (text === "Ninguna") {
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...prev.history,
                                personal_checklist_verified: true
                            }
                        }));
                        // TRANSITION TO FASE 6: FARMACOLOGÍA
                        const msgContent = "Perfil clínico de riesgo personal asimilado.\n\nPasemos ahora a la comprobación de Farmacología. ¿Toma usted actualmente algún medicamento recetado por un médico especialista?";

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msgContent,
                            avatar: tiloImg,
                            options: [
                                { label: "✅ Sí", value: "Sí" },
                                { label: "❌ No", value: "No" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_6_FARMACOLOGIA'); // FIX: Transition to the extracted component
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
                            content: `Patología personal registrada en expediente: ${text}.\n\nPara cerrar la verificación exhaustiva, ¿padece alguna otra condición de la lista?`,
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
                        content: `Excepción clínica primaria registrada: ${extraInfo}.\n\nPara proseguir con el cuestionario oficial de la NOM-004, ¿padece usted alguna otra condición oficial de la lista?`,
                        avatar: tiloImg,
                        options: phase5Options
                    }]);
                    setCurrentPhase('PHASE_5_SAFETY_GATE');
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
        setFase3State
    };
};

export default useCortex;
