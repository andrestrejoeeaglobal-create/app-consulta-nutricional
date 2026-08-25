import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { formatText, toSentenceCase } from '../../utils/utils';
import { motion as Motion } from 'framer-motion';

import tiloImg from '../../assets/tilo.png';
import ReactMarkdown from 'react-markdown';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';
import { Send, AlertCircle } from 'lucide-react';

/**
 * T.I.L.O. - MÓDULO FASE 5 (ANTECEDENTES PERSONALES PATOLÓGICOS - APP)
 * Versión: v5.0 - Estandarizado bajo el Protocolo Nuclear Cleaning y NOM-004-SSA3-2012
 * * Alinea la comunicación estratégica mediante Párrafos de Poder clínicos.
 * * Realiza calibración dinámica de autoridad para perfiles de adultos y tutores pediátricos.
 * * Ejecuta sincronización asíncrona directa con los Ejes Clínicos de useClinicalGenome.
 */

const BASE_OPTIONS = [
    { label: "Diabetes (Tipo 1 o 2)", value: "Diabetes" },
    { label: "Hipertensión Arterial", value: "Hipertension" },
    { label: "Hipotiroidismo / Tiroides", value: "Tiroides" },
    { label: "Dislipidemia (Colesterol/Triglicéridos)", value: "Dislipidemia" },
    { label: "Gastritis / Colitis", value: "Gastritis" },
    { label: "Artritis", value: "Artritis" },
    { label: "Otras / Diagnóstico manual", value: "Otras" }
];

const getInitialFlowState = (messages, patientData) => {
    if (!messages || messages.length === 0) return 'ASK_START';
    
    // Filtrar mensajes del asistente generados específicamente en la Fase 5 para evitar colisiones con resúmenes de fases previas (ej. Fase 4)
    const fase5Messages = messages.filter(m => 
        m.role === 'assistant' && 
        (m.content?.includes("expediente patológico personal") || 
         m.content?.includes("antecedentes personales patológicos") ||
         m.content?.includes("Integridad del expediente restablecida") ||
         m.content?.includes("seleccione una condición médica") ||
         m.content?.includes("escriba brevemente el nombre de la patología") ||
         m.content?.includes("agregada. ¿Qué desea hacer?") ||
         m.content?.includes("¿Qué acción desea tomar") ||
         m.content?.includes("cierre de validación bajo la firma del clínico") ||
         m.content?.includes("historial de intervenciones") ||
         m.content?.includes("buscador predictivo clínico") ||
         m.content?.includes("antecedentes quirúrgicos"))
    );
    
    if (fase5Messages.length === 0) return 'ASK_START';
    
    const lastMsg = fase5Messages[fase5Messages.length - 1];
    const content = lastMsg.content || "";
    
    if (content.includes("sellar el bloque de antecedentes quirúrgicos") || (content.includes("¿Es correcta esta información?") && content.includes("quirúrgicos"))) {
        return 'quirurgicos_review';
    }
    if (content.includes("¿Qué acción desea tomar respecto a su historial quirúrgico?")) {
        return 'quirurgicos_more';
    }
    if (content.includes("escriba el nombre de la cirugía u operación") || content.includes("Registro manual habilitado")) {
        return 'quirurgicos_capture_manual';
    }
    if (content.includes("buscador predictivo clínico") || content.includes("seleccione la cirugía o procedimiento") || lastMsg.inputType === 'strict_select') {
        return 'quirurgicos_capture';
    }
    if (content.includes("historial de intervenciones") || content.includes("sometido/a a alguna cirugía u operación")) {
        return 'quirurgicos_start';
    }
    
    if (content.includes("¿Es correcta esta información?") || content.includes("verifique los datos declarados")) {
        return 'REVIEW_SUMMARY';
    }
    if (content.includes("¿Qué desea hacer?") || content.includes("¿Qué acción desea tomar respecto a sus antecedentes")) {
        return 'ASK_MORE';
    }
    if (content.includes("escriba brevemente el nombre de la patología")) {
        return 'TYPE_DETAIL';
    }
    if (content.includes("seleccione una condición médica") || lastMsg.showMenu === 'disease') {
        return 'SELECT_DISEASES';
    }
    
    if (patientData?.history?.personal_structured?.length > 0) return 'ASK_MORE';
    return 'ASK_START';
};

const Fase5_PatologicosPersonales = ({ 
    patientData, 
    setPatientData, 
    onPhaseComplete, 
    messages, 
    setMessages, 
    registerInputHandler, 
    setIsGlobalTyping,
    onStateChange
}) => {
    // Sincronización de store de Genoma Clínico
    const addAlert = useClinicalGenome(state => state.addAlert);
    const updateAxis = useClinicalGenome(state => state.updateAxis);

    // Eje Clínico Pediátrico & Soberanía de Género
    const ptCtx = patientData?.profile?.pediatric_profile || patientData?.identificacion?.pediatric_profile;
    const ageStr = patientData?.profile?.pediatric_profile?.age || patientData?.identificacion?.edad || "0";
    const age = parseInt(ageStr, 10) || 0;
    // Para efectos de diálogo, solo usamos tercera persona en menores de 12 años (pediátricos).
    const isMinor = ptCtx?.is_minor === true && age < 12;
    let pName = patientData?.profile?.first_name || patientData?.identificacion?.nombre || patientData?.identificacion?.nombres || patientData?.identityLock?.patientInfo?.firstName;
    pName = pName ? pName.split(' ')[0] : null;
    const pNameFormatted = pName || (isMinor ? "el menor" : "el paciente");

    const pSex = patientData?.identificacion?.sexo || patientData?.profile?.sex || 'Femenino';
    const isFemale = pSex === 'Femenino' || pSex === 'FEMALE' || pSex === '2';

    const prnPatient = isMinor
        ? (isFemale ? 'la menor' : 'el menor')
        : (isFemale ? 'la paciente' : 'el paciente');

    const prnEvaluated = isFemale ? 'evaluada' : 'evaluado';

    // Obtener catálogo adaptativo con bloqueo de SOP para sexo masculino
    const getOptionsList = () => {
        const list = [...BASE_OPTIONS];
        if (isFemale) {
            // SOP es exclusivo de perfiles femeninos
            list.splice(4, 0, { label: "SOP (Síndrome de Ovario Poliquístico)", value: "SOP" });
        }
        return list;
    };

    // Inicializar estado de antecedentes
    const [personalStructured, setPersonalStructured] = useState(() => {
        return patientData?.history?.personal_structured || [];
    });

    // Inicializar estado de cirugías previas
    const [surgicalStructured, setSurgicalStructured] = useState(() => {
        return Array.isArray(patientData?.history?.surgical) ? patientData.history.surgical : [];
    });

    // Máquina de Estados Clínicos
    // ASK_START -> SELECT_DISEASES -> TYPE_DETAIL -> ASK_MORE -> REVIEW_SUMMARY -> quirurgicos_start -> quirurgicos_capture -> quirurgicos_review
    const [flowState, setFlowState] = useState(() => {
        return getInitialFlowState(messages, patientData);
    });

    // Sincronización de sub-pasos hacia el Dashboard
    useEffect(() => {
        if (onStateChange) {
            onStateChange(flowState);
        }
    }, [flowState, onStateChange]);

    const [currentCondition, setCurrentCondition] = useState(null);

    const getSurgicalOptions = () => {
        const list = [
            // Gastrointestinales
            { label: "Apendicectomía", value: "SURG_APENDICE" },
            { label: "Colecistectomía (Vesícula)", value: "SURG_COLECISTECTOMIA" },
            { label: "Hernioplastia", value: "SURG_HERNIOPLASTIA" },
            { label: "Bypass Gástrico / Manga", value: "SURG_BYPASS_MANGA" },
        ];

        if (isFemale) {
            list.push(
                { label: "Cesárea", value: "SURG_CESAREA" },
                { label: "Histerectomía", value: "SURG_HISTERECTOMIA" },
                { label: "Salpingoclasia (OTB)", value: "SURG_SALPINGOCLASIA" }
            );
        }

        list.push(
            // Cardiovasculares / Otros
            { label: "Angioplastia", value: "SURG_ANGIOPLASTIA" },
            { label: "Cateterismo", value: "SURG_CATETERISMO" },
            { label: "Amigdalectomía", value: "SURG_AMIGDALECTOMIA" },
            { label: "Rinoplastia", value: "SURG_RINOPLASTIA" },
            { label: "Cirugía Láser Ocular", value: "SURG_LASER_OCULAR" },
            // Escape Hatch
            { label: "📝 Otra cirugía (Ingreso Manual)", value: "SURG_OTHER" }
        );

        return list;
    };
    const chatEndRef = useRef(null);
    const setChatEndRef = React.useCallback((node) => {
        if (node) {
            chatEndRef.current = node;
            node.scrollIntoView({ behavior: 'auto' }); // Instant scroll on mount
        }
    }, []);
    const isConfirming = useRef(false);
    const isFirstRender = useRef(true);

    // Helper constructor de Párrafos de Poder
    const makeP1P2 = (p1, p2) => `${p1}\n\n${p2}`;

    // Inicializar diálogo de Fase 5 en el estado global
    useEffect(() => {
        // Si estamos en algún flujo de cirugías al reentrar, delegamos la inicialización al propio estado de cirugías
        if (flowState && flowState.startsWith('quirurgicos')) {
            setMessages(prev => {
                const alreadySurgical = prev.some(msg => 
                    msg.role === 'assistant' && msg.content.includes("historial de intervenciones")
                );
                if (alreadySurgical) return prev;

                const greetingMsg = {
                    role: 'assistant',
                    content: makeP1P2(
                        "El bloque de patologías ha sido sellado con éxito en su expediente digital.",
                        `Pasemos ahora a su historial de intervenciones. Como ${isMinor ? 'tutor responsable de este expediente' : 'titular de este expediente'}, por favor declare: **¿Ha sido ${isMinor ? pNameFormatted : 'usted'} sometido/a a alguna cirugía u operación médica en el pasado?**`
                    ),
                    options: [
                        { label: `❌ NINGUNA / DECLARAR SAN${isFemale ? 'A' : 'O'}`, value: "SURG_NONE" },
                        { label: "✅ SÍ, REGISTRAR CIRUGÍA", value: "SURG_YES" }
                    ]
                };
                return [...prev, greetingMsg];
            });
            return;
        }

        setMessages(prev => {
            const alreadyGreetedInPrev = prev.some(msg => 
                msg.role === 'assistant' && 
                (msg.content.includes("expediente patológico personal") || 
                 msg.content.includes("antecedentes personales patológicos") ||
                 msg.content.includes("Integridad del expediente restablecida") ||
                 msg.content.includes("historial de intervenciones"))
            );
            if (alreadyGreetedInPrev) return prev;

            if (patientData?.history?.personal_structured?.length > 0) {
                const resumeMsg = {
                    role: 'assistant',
                    content: makeP1P2(
                        "Integridad del expediente restablecida. El sistema mantiene cargada su información biológica previa en la sesión activa.",
                        "¿Qué acción desea tomar respecto a sus antecedentes personales patológicos?"
                    ),
                    options: [
                        { label: "➕ REGISTRAR OTRA CONDICIÓN", value: "ADD_MORE" },
                        { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                    ]
                };
                return [...prev, resumeMsg];
            } else {
                const initialContent = makeP1P2(
                    isMinor 
                        ? `El perfil genómico y la carga heredofamiliar de **${pNameFormatted}** han sido consolidados exitosamente en nuestro núcleo de datos. En cumplimiento estricto de la **NOM-004-SSA3-2012**, procedemos a la calibración del expediente patológico personal para modular con precisión celular la terapéutica nutricional.`
                        : `Su perfil genómico y la carga heredofamiliar han sido consolidados exitosamente en nuestro núcleo de datos. En cumplimiento estricto de la **NOM-004-SSA3-2012**, procedemos a la calibración de su expediente patológico personal para modular con precisión celular la terapéutica nutricional.`,
                    `Como ${isMinor ? 'tutor responsable de la cuenta' : 'titular de este expediente'}, por favor **declare** si ${isMinor ? `**${pNameFormatted}**` : 'usted'} padece o ha recibido un diagnóstico clínico formal para alguna enfermedad crónica o patología activa:`
                );

                const greetingMsg = {
                    role: 'assistant',
                    content: initialContent,
                    options: [
                        { label: `❌ NINGUNA / DECLARAR SAN${isFemale ? 'A' : 'O'}`, value: "NO_DIAGNOSIS" },
                        { label: "✅ SÍ, SELECCIONAR DIAGNÓSTICOS", value: "YES_DIAGNOSIS" }
                    ]
                };
                return [...prev, greetingMsg];
            }
        });
    }, [isMinor, isFemale, pNameFormatted, patientData, setMessages, flowState]);

    useEffect(() => { 
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
        const timer = setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timer);
    }, [messages]);

    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const pushMessage = (msg) => {
        setMessages(prev => {
            const newMsgs = [...prev];
            for (let i = newMsgs.length - 1; i >= 0; i--) {
                if (newMsgs[i].role === 'assistant') {
                    newMsgs[i] = {
                        ...newMsgs[i],
                        options: undefined,
                        showMenu: undefined
                    };
                    break;
                }
            }
            return [...newMsgs, msg];
        });
    };

    const handleSend = (text, type = "text") => {
        const textToProcess = text || inputValue;
        console.log("➡️ [Fase5 handleSend] textToProcess:", textToProcess, "type:", type, "inputValue:", inputValue);
        if (!textToProcess.trim()) {
            console.warn("⚠️ [Fase5 handleSend] Empty input, returning.");
            return;
        }

        let userLabel = textToProcess;
        if (textToProcess === "YES_DIAGNOSIS") userLabel = "Sí, seleccionar diagnósticos";
        if (textToProcess === "NO_DIAGNOSIS") userLabel = `Ninguna / Declarar san${isFemale ? 'a' : 'o'}`;
        if (textToProcess === "FINISH") userLabel = "Continuar al historial";
        if (textToProcess === "ADD_MORE") userLabel = "Registrar otra condición";
        if (textToProcess === "CONFIRM_DATA") userLabel = "Sí, es correcta";
        if (textToProcess === "CORRECT_DATA") userLabel = "No, quiero corregir algo";
        if (textToProcess === "MODIFY_SELECT") userLabel = "✏️ Modificar patología registrada";
        if (textToProcess === "DELETE_SELECT") userLabel = "🗑️ Eliminar patología de la lista";
        if (textToProcess === "CANCEL_REVIEW") userLabel = "❌ Cancelar (Volver)";
        if (textToProcess === "BACK_TO_CORRECT") userLabel = "⬅️ Volver al menú anterior";
        if (textToProcess.startsWith("DELETE_INDEX_")) {
            const idx = parseInt(textToProcess.replace("DELETE_INDEX_", ""), 10);
            const pat = personalStructured[idx];
            userLabel = pat ? `🗑️ Eliminar: ${pat.specific_condition}` : "Eliminar patología";
        }
        if (textToProcess.startsWith("MODIFY_INDEX_")) {
            const idx = parseInt(textToProcess.replace("MODIFY_INDEX_", ""), 10);
            const pat = personalStructured[idx];
            userLabel = pat ? `✏️ Modificar: ${pat.specific_condition}` : "Modificar patología";
        }
        
        // Botoneras quirúrgicas
        if (textToProcess === "SURG_NONE") userLabel = `Ninguna / Declarar san${isFemale ? 'a' : 'o'}`;
        if (textToProcess === "SURG_YES") userLabel = "Sí, registrar cirugía";
        if (textToProcess === "SURG_FINISH") userLabel = "Continuar al historial";
        if (textToProcess === "SURG_ADD_MORE") userLabel = "Registrar otra cirugía";
        if (textToProcess === "SURG_CONFIRM") userLabel = "Sí, es correcta";
        if (textToProcess === "SURG_CORRECT") userLabel = "No, quiero corregir algo";
        if (textToProcess === "SURG_MODIFY_SELECT") userLabel = "✏️ Modificar cirugía registrada";
        if (textToProcess === "SURG_DELETE_SELECT") userLabel = "🗑️ Eliminar cirugía de la lista";
        if (textToProcess === "SURG_CANCEL_REVIEW") userLabel = "❌ Cancelar (Volver)";
        if (textToProcess === "SURG_BACK_TO_CORRECT") userLabel = "⬅️ Volver al menú anterior";
        if (textToProcess.startsWith("SURG_DELETE_INDEX_")) {
            const idx = parseInt(textToProcess.replace("SURG_DELETE_INDEX_", ""), 10);
            const surg = surgicalStructured[idx];
            userLabel = surg ? `🗑️ Eliminar: ${surg.label}` : "Eliminar cirugía";
        }
        if (textToProcess.startsWith("SURG_MODIFY_INDEX_")) {
            const idx = parseInt(textToProcess.replace("SURG_MODIFY_INDEX_", ""), 10);
            const surg = surgicalStructured[idx];
            userLabel = surg ? `✏️ Modificar: ${surg.label}` : "Modificar cirugía";
        }
        if (textToProcess === "SURG_OTHER") userLabel = "Otra cirugía (Ingreso Manual)";

        // Mapear etiqueta en caso de menú clínico
        if (type === "disease") {
            const foundSurg = getSurgicalOptions().find(o => o.value === textToProcess);
            if (foundSurg) {
                userLabel = foundSurg.label;
            } else {
                userLabel = getOptionsList().find(o => o.value === textToProcess)?.label || textToProcess;
            }
        }

        const newUserMsg = { role: 'user', content: type === 'text' ? toSentenceCase(userLabel) : userLabel };
        let nextMsgs;

        setMessages(prev => {
            const newMsgs = [...prev];
            for (let i = newMsgs.length - 1; i >= 0; i--) {
                if (newMsgs[i].role === 'assistant') {
                    newMsgs[i] = {
                        ...newMsgs[i],
                        options: undefined,
                        showMenu: undefined
                    };
                    break;
                }
            }
            if (type === 'text') {
                nextMsgs = [...newMsgs, newUserMsg];
            } else {
                nextMsgs = newMsgs;
            }
            console.log("💬 [Fase5 handleSend] setMessages callback nextMsgs size:", nextMsgs.length);
            return nextMsgs;
        });

        setInputValue("");
        setIsAnalyzing(true);

        console.log("⏳ [Fase5 handleSend] Scheduling processState in 600ms...");
        setTimeout(() => {
            processState(textToProcess, type, nextMsgs || messages);
        }, 600);
    };

    const processState = (val, type, currentMsgs = messages) => {
        console.log("⚙️ [Fase5 processState] Entering with flowState:", flowState, "val:", val, "type:", type);
        const normalizedVal = String(val).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        if (flowState === 'ASK_START') {
            const isNo = val === "NO_DIAGNOSIS" || 
                         normalizedVal.includes("NO_DIAGNOSIS") || 
                         normalizedVal.includes("NINGUNA") || 
                         normalizedVal.includes("DECLARAR SANO") || 
                         normalizedVal.includes("DECLARAR SANA") || 
                         normalizedVal === "NO";
            
            const isYes = val === "YES_DIAGNOSIS" || 
                          normalizedVal.includes("YES_DIAGNOSIS") || 
                          normalizedVal.includes("SI, SELECCIONAR DIAGNOSTICOS") || 
                          normalizedVal.includes("SI SELECCIONAR DIAGNOSTICOS") || 
                          normalizedVal.includes("SI, SELECCIONAR") || 
                          normalizedVal === "SI" ||
                          normalizedVal.includes("SELECCIONAR DIAGNOSTICOS");

            if (isNo) {
                const updatedList = [];
                setPersonalStructured(updatedList);
                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...prev.history,
                        personal_structured: updatedList,
                        personal_raw_text: 'Niega antecedentes personales patológicos.',
                        personal_checklist_verified: true
                    }
                }));

                // Mutar al paso de cirugías (Q24 - Antecedentes Quirúrgicos)
                setFlowState('quirurgicos_start');

                const greetingMsg = {
                    role: 'assistant',
                    content: makeP1P2(
                        "Declaratoria de salud óptima registrada en el expediente base. Procedemos al cierre de validación bajo la firma del clínico.",
                        `Pasemos ahora a su historial de intervenciones. Como ${isMinor ? 'tutor responsable de este expediente' : 'titular de este expediente'}, por favor declare: **¿Ha sido ${isMinor ? pNameFormatted : 'usted'} sometido/a a alguna cirugía u operación médica en el pasado?**`
                    ),
                    options: [
                        { label: `❌ NINGUNA / DECLARAR SAN${isFemale ? 'A' : 'O'}`, value: "SURG_NONE" },
                        { label: "✅ SÍ, REGISTRAR CIRUGÍA", value: "SURG_YES" }
                    ]
                };

                setMessages([...currentMsgs, greetingMsg]);
                setIsAnalyzing(false);
                return;
            } else if (isYes) {
                setFlowState('SELECT_DISEASES');
                pushMessage({
                    role: 'assistant',
                    content: makeP1P2(
                        "Alineación de datos en proceso. El sistema ha habilitado el panel de selección patológica del ecosistema central para mapear de manera detallada el historial clínico.",
                        "Por favor, seleccione una condición médica diagnosticada de la siguiente lista oficial:"
                    ),
                    showMenu: 'disease',
                    options: getOptionsList()
                });
            }
        } 
        else if (flowState === 'SELECT_DISEASES') {
            const isOtras = val === "Otras" || normalizedVal === "OTRAS" || normalizedVal === "OTRA";
            if (isOtras) {
                setFlowState('TYPE_DETAIL');
                pushMessage({
                    role: 'assistant',
                    content: makeP1P2(
                        "Entrada analógica detectada. Procedemos a registrar una condición clínica no listada para salvaguardar la exactitud del expediente médico.",
                        "Por favor, escriba brevemente el nombre de la patología o condición diagnosticada:"
                    )
                });
            } else {
                // Registrar patología y evaluar alertas. 
                // Encontrarla en el catálogo usando coincidencia por valor o por etiqueta normalizada
                const foundOpt = getOptionsList().find(opt => 
                    opt.value === val || 
                    String(opt.value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === normalizedVal ||
                    String(opt.label).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === normalizedVal
                );
                const resolvedVal = foundOpt ? foundOpt.value : val;

                const newCondition = {
                    condition_category: resolvedVal,
                    specific_condition: resolvedVal,
                    status: 'ACTIVE',
                    source: 'CHECKLIST'
                };
                
                triggerClinicalIntegrations(resolvedVal);
                
                const updatedList = [...personalStructured, newCondition];
                setPersonalStructured(updatedList);
                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...prev.history,
                        personal_structured: updatedList,
                        personal_raw_text: `Presenta antecedentes de: ${updatedList.map(a => a.specific_condition).join(', ')}.`,
                        personal_checklist_verified: true
                    }
                }));

                setFlowState('ASK_MORE');
                pushMessage({
                    role: 'assistant',
                    content: `Condición **${foundOpt?.label || val}** agregada. ¿Qué desea hacer?`,
                    options: [
                        { label: "➕ REGISTRAR OTRA CONDICIÓN", value: "ADD_MORE" },
                        { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                    ]
                });
            }
        }
        else if (flowState === 'TYPE_DETAIL') {
            const newCondition = {
                condition_category: 'Otras',
                specific_condition: val,
                status: 'ACTIVE',
                source: 'MANUAL'
            };

            triggerClinicalIntegrations(val, true);

            const updatedList = [...personalStructured, newCondition];
            setPersonalStructured(updatedList);
            setPatientData(prev => ({
                ...prev,
                history: {
                    ...prev.history,
                    personal_structured: updatedList,
                    personal_raw_text: `Presenta antecedentes de: ${updatedList.map(a => a.specific_condition).join(', ')}.`,
                    personal_checklist_verified: true
                }
            }));

            setFlowState('ASK_MORE');
            pushMessage({
                role: 'assistant',
                content: `Condición **${val}** agregada. ¿Qué desea hacer?`,
                options: [
                    { label: "➕ REGISTRAR OTRA CONDICIÓN", value: "ADD_MORE" },
                    { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" },
                    { label: "🛠️ MODIFICAR REGISTROS", value: "MODIFY_SELECT" },
                    { label: "🗑️ ELIMINAR REGISTROS", value: "DELETE_SELECT" }
                ]
            });
        }
        else if (flowState === 'ASK_MORE') {
            const isFinish = val === "FINISH" || 
                             normalizedVal.includes("FINISH") || 
                             normalizedVal.includes("CONTINUAR") || 
                             normalizedVal.includes("HISTORIAL") || 
                             normalizedVal.includes("TERMINAR") ||
                             val === "CANCEL_REVIEW";
                             
            const isAddMore = val === "ADD_MORE" || 
                              normalizedVal.includes("ADD_MORE") || 
                              normalizedVal.includes("REGISTRAR OTRA") || 
                              normalizedVal.includes("OTRA CONDICION") || 
                              normalizedVal.includes("MAS") || 
                              normalizedVal.includes("AGREGAR");

            if (isFinish) {
                setFlowState('REVIEW_SUMMARY');

                const summaryText = personalStructured.length > 0
                    ? personalStructured.map(a => `- 📋 **${a.specific_condition}**`).join('\n')
                    : "Ningún antecedente personal patológico registrado.";

                pushMessage({
                    role: 'assistant',
                    content: makeP1P2(
                        "Para dar cumplimiento a la NOM-004-SSA3-2012 y consolidar formalmente su expediente patológico, por favor verifique los datos declarados:",
                        summaryText + "\n\n¿Es correcta esta información?"
                    ),
                    options: [
                        { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                        { label: "❌ No, quiero corregir algo", value: "CORRECT_DATA" }
                    ]
                });
            } else if (isAddMore) {
                setFlowState('SELECT_DISEASES');
                
                // Filtrar opciones ya seleccionadas
                const selectedCats = personalStructured.map(i => i.condition_category);
                const filteredOptions = getOptionsList().filter(opt => !selectedCats.includes(opt.value) || opt.value === "Otras");

                pushMessage({
                    role: 'assistant',
                    content: "Por favor, seleccione otra patología o condición clínica activa:",
                    options: filteredOptions,
                    showMenu: filteredOptions.length > 3 ? 'disease' : undefined
                });
            } else if (val === "CLEAR_ALL") {
                setFlowState('ASK_START');
                setPersonalStructured([]);
                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...prev.history,
                        personal_structured: [],
                        personal_raw_text: '',
                        personal_checklist_verified: false
                    }
                }));
                pushMessage({
                    role: 'assistant',
                    content: makeP1P2(
                        "Sistemas clínicos reiniciados. Se ha limpiado el mapa patológico de la sesión para evitar contaminación cruzada de datos.",
                        `Por favor declare nuevamente si ${isMinor ? `**${pNameFormatted}**` : 'usted'} padece alguna patología diagnosticada:`
                    ),
                    options: [
                        { label: `❌ NINGUNA / DECLARAR SAN${isFemale ? 'A' : 'O'}`, value: "NO_DIAGNOSIS" },
                        { label: "✅ SÍ, SELECCIONAR DIAGNÓSTICOS", value: "YES_DIAGNOSIS" }
                    ]
                });
            } else if (val === "MODIFY_SELECT") {
                if (personalStructured.length > 0) {
                    setFlowState('SELECT_MODIFY_ITEM');
                    const opts = personalStructured.map((p, idx) => ({
                        label: `👤 ${p.specific_condition}`,
                        value: `MODIFY_INDEX_${idx}`
                    })).concat([{ label: "⬅️ Volver al menú anterior", value: "BACK_TO_CORRECT" }]);

                    pushMessage({
                        role: 'assistant',
                        content: "¿Qué patología desea modificar? Seleccione de la lista:",
                        options: opts
                    });
                } else {
                    pushMessage({
                        role: 'assistant',
                        content: "No existen patologías registradas para modificar.",
                        options: [
                            { label: "➕ Registrar otra condición", value: "ADD_MORE" },
                            { label: "❌ Cancelar (Volver)", value: "FINISH" }
                        ]
                    });
                }
            } else if (val === "DELETE_SELECT") {
                if (personalStructured.length > 0) {
                    setFlowState('SELECT_DELETE_ITEM');
                    const opts = personalStructured.map((p, idx) => ({
                        label: `👤 ${p.specific_condition}`,
                        value: `DELETE_INDEX_${idx}`
                    })).concat([{ label: "⬅️ Volver al menú anterior", value: "BACK_TO_CORRECT" }]);

                    pushMessage({
                        role: 'assistant',
                        content: "¿Qué patología desea eliminar del expediente? Seleccione de la lista:",
                        options: opts
                    });
                } else {
                    pushMessage({
                        role: 'assistant',
                        content: "No existen patologías registradas para eliminar.",
                        options: [
                            { label: "➕ Registrar otra condición", value: "ADD_MORE" },
                            { label: "❌ Cancelar (Volver)", value: "FINISH" }
                        ]
                    });
                }
            }
        }
        else if (flowState === 'REVIEW_SUMMARY') {
            const isConfirm = val === "CONFIRM_DATA" || 
                              normalizedVal.includes("CONFIRM_DATA") || 
                              normalizedVal.includes("SI, ES CORRECTA") || 
                              normalizedVal.includes("SI ES CORRECTA") || 
                              normalizedVal.includes("CORRECTA") || 
                              normalizedVal === "SI" || 
                              normalizedVal === "ACEPTAR";
                              
            const isCorrect = val === "CORRECT_DATA" || 
                              normalizedVal.includes("CORRECT_DATA") || 
                              normalizedVal.includes("NO, QUIERO CORREGIR") || 
                              normalizedVal.includes("NO QUIERO CORREGIR") || 
                              normalizedVal.includes("CORREGIR") || 
                              normalizedVal === "NO";

            if (isConfirm) {
                // Sellar patologías crónicas temporalmente en el expediente
                const rawTextSummary = personalStructured.length > 0
                    ? `Presenta antecedentes de: ${personalStructured.map(a => a.specific_condition).join(', ')}.`
                    : 'Niega antecedentes personales patológicos.';

                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...prev.history,
                        personal_structured: personalStructured,
                        personal_raw_text: rawTextSummary,
                        personal_checklist_verified: true
                    }
                }));

                const currentMessages = [...currentMsgs];
                if (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant') {
                    currentMessages[currentMessages.length - 1] = {
                        ...currentMessages[currentMessages.length - 1],
                        options: undefined,
                        showMenu: undefined
                    };
                }

                // Mutar al paso de cirugías
                setFlowState('quirurgicos_start');
                
                const greetingMsg = {
                    role: 'assistant',
                    content: makeP1P2(
                        "El bloque de patologías ha sido sellado con éxito en su expediente digital.",
                        `Pasemos ahora a su historial de intervenciones. Como ${isMinor ? 'tutor responsable de este expediente' : 'titular de este expediente'}, por favor declare: **¿Ha sido ${isMinor ? pNameFormatted : 'usted'} sometido/a a alguna cirugía u operación médica en el pasado?**`
                    ),
                    options: [
                        { label: `❌ NINGUNA / DECLARAR SAN${isFemale ? 'A' : 'O'}`, value: "SURG_NONE" },
                        { label: "✅ SÍ, REGISTRAR CIRUGÍA", value: "SURG_YES" }
                    ]
                };

                setMessages([...currentMessages, greetingMsg]);
                setIsAnalyzing(false);
                return;
            } else if (isCorrect) {
                setFlowState('ASK_MORE');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en la lista de patologías?",
                    options: [
                        { label: "➕ Agregar otra patología", value: "ADD_MORE" },
                        { label: "✏️ Modificar patología registrada", value: "MODIFY_SELECT" },
                        { label: "🗑️ Eliminar patología de la lista", value: "DELETE_SELECT" },
                        { label: "🔄 Limpiar lista completa (Reiniciar)", value: "CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver)", value: "FINISH" }
                    ]
                });
            }
        }
        else if (flowState === 'SELECT_MODIFY_ITEM') {
            if (val === "BACK_TO_CORRECT") {
                setFlowState('ASK_MORE');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en la lista de patologías?",
                    options: [
                        { label: "➕ Agregar otra patología", value: "ADD_MORE" },
                        { label: "✏️ Modificar patología registrada", value: "MODIFY_SELECT" },
                        { label: "🗑️ Eliminar patología de la lista", value: "DELETE_SELECT" },
                        { label: "🔄 Limpiar lista completa (Reiniciar)", value: "CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver)", value: "FINISH" }
                    ]
                });
                setIsAnalyzing(false);
                return;
            }
            if (val.startsWith("MODIFY_INDEX_")) {
                const idx = parseInt(val.replace("MODIFY_INDEX_", ""), 10);
                if (!isNaN(idx) && personalStructured[idx]) {
                    const target = personalStructured[idx];
                    const updated = personalStructured.filter((_, i) => i !== idx);
                    
                    setPersonalStructured(updated);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            personal_structured: updated,
                            personal_raw_text: `Presenta antecedentes de: ${updated.map(a => a.specific_condition).join(', ')}.`,
                            personal_checklist_verified: true
                        }
                    }));

                    setFlowState('SELECT_DISEASES');
                    
                    const selectedCats = updated.map(i => i.condition_category);
                    const filteredOptions = getOptionsList().filter(opt => !selectedCats.includes(opt.value) || opt.value === "Otras");

                    pushMessage({
                        role: 'assistant',
                        content: `Entendido. Vamos a reconfigurar la patología. Por favor, seleccione la condición médica de la siguiente lista oficial:`,
                        options: filteredOptions,
                        showMenu: filteredOptions.length > 3 ? 'disease' : undefined
                    });
                }
            }
        }
        else if (flowState === 'SELECT_DELETE_ITEM') {
            if (val === "BACK_TO_CORRECT") {
                setFlowState('ASK_MORE');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en la lista de patologías?",
                    options: [
                        { label: "➕ Agregar otra patología", value: "ADD_MORE" },
                        { label: "✏️ Modificar patología registrada", value: "MODIFY_SELECT" },
                        { label: "🗑️ Eliminar patología de la lista", value: "DELETE_SELECT" },
                        { label: "🔄 Limpiar lista completa (Reiniciar)", value: "CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver)", value: "FINISH" }
                    ]
                });
                setIsAnalyzing(false);
                return;
            }
            if (val.startsWith("DELETE_INDEX_")) {
                const idx = parseInt(val.replace("DELETE_INDEX_", ""), 10);
                if (!isNaN(idx) && personalStructured[idx]) {
                    const updated = personalStructured.filter((_, i) => i !== idx);
                    
                    setPersonalStructured(updated);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            personal_structured: updated,
                            personal_raw_text: `Presenta antecedentes de: ${updated.map(a => a.specific_condition).join(', ')}.`,
                            personal_checklist_verified: true
                        }
                    }));

                    pushMessage({
                        role: 'assistant',
                        content: "Patología eliminada con éxito."
                    });

                    setTimeout(() => {
                        setFlowState('REVIEW_SUMMARY');
                        
                        const summaryText = updated.length > 0
                            ? updated.map(a => `- 📋 **${a.specific_condition}**`).join('\n')
                            : "Ningún antecedente personal patológico registrado.";
                        
                        pushMessage({
                            role: 'assistant',
                            content: makeP1P2(
                                "Para dar cumplimiento a la NOM-004-SSA3-2012 y consolidar formalmente su expediente patológico, por favor verifique los datos declarados:",
                                summaryText + "\n\n¿Es correcta esta información?"
                            ),
                            options: [
                                { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                                { label: "❌ No, quiero corregir algo", value: "CORRECT_DATA" }
                            ]
                        });
                    }, 500);
                }
            }
        }
        else if (flowState === 'quirurgicos_start') {
            const isNo = val === "SURG_NONE" || normalizedVal.includes("SURG_NONE") || normalizedVal.includes("NINGUNA") || normalizedVal.includes("DECLARAR SANO") || normalizedVal.includes("DECLARAR SANA") || normalizedVal === "NO";
            const isYes = val === "SURG_YES" || normalizedVal.includes("SURG_YES") || normalizedVal.includes("REGISTRAR CIRUGIA") || normalizedVal === "SI";

            if (isNo) {
                // Inyectar "Niega" en patientData y avanzar a Fase 6
                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...prev.history,
                        surgical: 'Niega'
                    }
                }));

                const finalMessages = [
                    ...currentMsgs,
                    {
                        role: 'assistant',
                        content: makeP1P2(
                            "Declaratoria de ausencia de intervenciones quirúrgicas registrada bajo la NOM-004.",
                            "Confirmación exitosa. Avanzamos hacia la sección de farmacología del triage."
                        )
                    }
                ];

                if (onPhaseComplete) {
                    onPhaseComplete(personalStructured, 'Niega', finalMessages);
                }
                setIsAnalyzing(false);
                return;
            } else if (isYes) {
                setFlowState('quirurgicos_capture');
                pushMessage({
                    role: 'assistant',
                    content: makeP1P2(
                        "Alineación de datos quirúrgicos en proceso. Se ha habilitado el buscador predictivo clínico para registrar sus intervenciones en el expediente.",
                        `Como ${isMinor ? 'tutor' : 'titular'}, por favor **seleccione** la cirugía o procedimiento realizado de la siguiente lista oficial:`
                    ),
                    showMenu: 'disease',
                    inputType: 'strict_select',
                    options: getSurgicalOptions()
                });
            }
        }
        else if (flowState === 'quirurgicos_capture') {
            const isOther = val === "SURG_OTHER" || normalizedVal.includes("OTRA CIRUGIA") || normalizedVal === "SURG_OTHER";
            if (isOther) {
                setFlowState('quirurgicos_capture_manual');
                pushMessage({
                    role: 'assistant',
                    content: makeP1P2(
                        "Registro manual habilitado. Escriba el nombre del procedimiento quirúrgico de manera concisa para añadirlo a su historial.",
                        "Por favor, **escriba** el nombre de la cirugía u operación realizada:"
                    )
                });
            } else {
                const foundOpt = getSurgicalOptions().find(opt => 
                    opt.value === val || 
                    String(opt.value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === normalizedVal ||
                    String(opt.label).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === normalizedVal
                );
                const resolvedVal = foundOpt ? foundOpt.value : val;
                const resolvedLabel = foundOpt ? foundOpt.label : val;

                const newSurgical = {
                    id: resolvedVal,
                    label: resolvedLabel,
                    type: "PREDICTIVE"
                };

                const updatedList = [...surgicalStructured, newSurgical];
                setSurgicalStructured(updatedList);
                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...prev.history,
                        surgical: updatedList
                    }
                }));

                setFlowState('quirurgicos_more');
                pushMessage({
                    role: 'assistant',
                    content: `Cirugía **${resolvedLabel}** registrada. ¿Qué desea hacer?`,
                    options: [
                        { label: "➕ REGISTRAR OTRA CIRUGÍA", value: "SURG_ADD_MORE" },
                        { label: "⏩ CONTINUAR AL HISTORIAL", value: "SURG_FINISH" },
                        { label: "🛠️ MODIFICAR REGISTROS", value: "SURG_MODIFY_SELECT" },
                        { label: "🗑️ ELIMINAR REGISTROS", value: "SURG_DELETE_SELECT" }
                    ]
                });
            }
        }
        else if (flowState === 'quirurgicos_capture_manual') {
            const newSurgical = {
                id: `SURG_CUSTOM_${Date.now()}`,
                label: val,
                type: "CUSTOM"
            };

            const updatedList = [...surgicalStructured, newSurgical];
            setSurgicalStructured(updatedList);
            setPatientData(prev => ({
                ...prev,
                history: {
                    ...prev.history,
                    surgical: updatedList
                }
            }));

            setFlowState('quirurgicos_more');
            pushMessage({
                role: 'assistant',
                content: `Cirugía **${val}** registrada de forma manual. ¿Qué desea hacer?`,
                options: [
                    { label: "➕ REGISTRAR OTRA CIRUGÍA", value: "SURG_ADD_MORE" },
                    { label: "⏩ CONTINUAR AL HISTORIAL", value: "SURG_FINISH" },
                    { label: "🛠️ MODIFICAR REGISTROS", value: "SURG_MODIFY_SELECT" },
                    { label: "🗑️ ELIMINAR REGISTROS", value: "SURG_DELETE_SELECT" }
                ]
            });
        }
        else if (flowState === 'quirurgicos_more') {
            const isFinish = val === "SURG_FINISH" || normalizedVal.includes("SURG_FINISH") || normalizedVal.includes("CONTINUAR") || normalizedVal.includes("HISTORIAL") || val === "SURG_CANCEL_REVIEW";
            const isAddMore = val === "SURG_ADD_MORE" || normalizedVal.includes("SURG_ADD_MORE") || normalizedVal.includes("REGISTRAR OTRA") || normalizedVal.includes("OTRA CIRUGIA");

            if (isFinish) {
                setFlowState('quirurgicos_review');
                const summaryText = surgicalStructured.length > 0
                    ? surgicalStructured.map(s => `- 🩺 **${s.label}**`).join('\n')
                    : "Ninguna cirugía registrada.";

                pushMessage({
                    role: 'assistant',
                    content: makeP1P2(
                        "Para dar cumplimiento a la NOM-004-SSA3-2012 y sellar formalmente su expediente quirúrgico, por favor verifique los datos declarados:",
                        `${summaryText}\n\n---\n\n¿Es correcta esta información?`
                    ),
                    options: [
                        { label: "✅ Sí, es correcta", value: "SURG_CONFIRM" },
                        { label: "❌ No, quiero corregir algo", value: "SURG_CORRECT" }
                    ]
                });
            } else if (isAddMore) {
                setFlowState('quirurgicos_capture');
                const selectedIds = surgicalStructured.map(i => i.id);
                const filteredOptions = getSurgicalOptions().filter(opt => !selectedIds.includes(opt.value) || opt.value === "SURG_OTHER");

                pushMessage({
                    role: 'assistant',
                    content: "Por favor, seleccione otra cirugía o procedimiento realizado de la siguiente lista:",
                    options: filteredOptions,
                    showMenu: filteredOptions.length > 3 ? 'disease' : undefined,
                    inputType: 'strict_select'
                });
            } else if (val === "SURG_CLEAR_ALL") {
                setFlowState('quirurgicos_start');
                setSurgicalStructured([]);
                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...prev.history,
                        surgical: []
                    }
                }));
                pushMessage({
                    role: 'assistant',
                    content: makeP1P2(
                        "Sistemas clínicos de antecedentes quirúrgicos reiniciados.",
                        `Por favor declare nuevamente si ${isMinor ? `**${pNameFormatted}**` : 'usted'} ha sido sometido/a a alguna cirugía u operación en el pasado:`
                    ),
                    options: [
                        { label: `❌ NINGUNA / DECLARAR SAN${isFemale ? 'A' : 'O'}`, value: "SURG_NONE" },
                        { label: "✅ SÍ, REGISTRAR CIRUGÍA", value: "SURG_YES" }
                    ]
                });
            } else if (val === "SURG_MODIFY_SELECT") {
                if (surgicalStructured.length > 0) {
                    setFlowState('SELECT_SURG_MODIFY_ITEM');
                    const opts = surgicalStructured.map((s, idx) => ({
                        label: `👤 ${s.label}`,
                        value: `SURG_MODIFY_INDEX_${idx}`
                    })).concat([{ label: "⬅️ Volver al menú anterior", value: "SURG_BACK_TO_CORRECT" }]);

                    pushMessage({
                        role: 'assistant',
                        content: "¿Qué cirugía desea modificar? Seleccione de la lista:",
                        options: opts
                    });
                } else {
                    pushMessage({
                        role: 'assistant',
                        content: "No existen cirugías registradas para modificar.",
                        options: [
                            { label: "➕ Registrar otra cirugía", value: "SURG_ADD_MORE" },
                            { label: "❌ Cancelar (Volver)", value: "SURG_FINISH" }
                        ]
                    });
                }
            } else if (val === "SURG_DELETE_SELECT") {
                if (surgicalStructured.length > 0) {
                    setFlowState('SELECT_SURG_DELETE_ITEM');
                    const opts = surgicalStructured.map((s, idx) => ({
                        label: `👤 ${s.label}`,
                        value: `SURG_DELETE_INDEX_${idx}`
                    })).concat([{ label: "⬅️ Volver al menú anterior", value: "SURG_BACK_TO_CORRECT" }]);

                    pushMessage({
                        role: 'assistant',
                        content: "¿Qué cirugía desea eliminar del expediente? Seleccione de la lista:",
                        options: opts
                    });
                } else {
                    pushMessage({
                        role: 'assistant',
                        content: "No existen cirugías registradas para eliminar.",
                        options: [
                            { label: "➕ Registrar otra cirugía", value: "SURG_ADD_MORE" },
                            { label: "❌ Cancelar (Volver)", value: "SURG_FINISH" }
                        ]
                    });
                }
            }
        }
        else if (flowState === 'quirurgicos_review') {
            const isConfirm = val === "SURG_CONFIRM" || normalizedVal.includes("SURG_CONFIRM") || normalizedVal.includes("SI, ES CORRECTA") || normalizedVal.includes("CORRECTA") || normalizedVal === "SI";
            const isCorrect = val === "SURG_CORRECT" || normalizedVal.includes("SURG_CORRECT") || normalizedVal.includes("NO, QUIERO CORREGIR") || normalizedVal.includes("CORREGIR") || normalizedVal === "NO";

            if (isConfirm) {
                if (isConfirming.current) return;
                isConfirming.current = true;

                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...prev.history,
                        surgical: surgicalStructured
                    }
                }));

                const currentMessages = [...currentMsgs];
                if (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant') {
                    currentMessages[currentMessages.length - 1] = {
                        ...currentMessages[currentMessages.length - 1],
                        options: undefined,
                        showMenu: undefined
                    };
                }
                const updatedMessagesList = currentMessages;

                if (onPhaseComplete) {
                    onPhaseComplete(personalStructured, surgicalStructured, updatedMessagesList);
                }
                return;
            } else if (isCorrect) {
                setFlowState('quirurgicos_more');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en la lista de cirugías?",
                    options: [
                        { label: "➕ Agregar otra cirugía", value: "SURG_ADD_MORE" },
                        { label: "✏️ Modificar cirugía registrada", value: "SURG_MODIFY_SELECT" },
                        { label: "🗑️ Eliminar cirugía de la lista", value: "SURG_DELETE_SELECT" },
                        { label: "🔄 Limpiar lista quirúrgica", value: "SURG_CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver)", value: "SURG_FINISH" }
                    ]
                });
            }
        }
        else if (flowState === 'SELECT_SURG_MODIFY_ITEM') {
            if (val === "SURG_BACK_TO_CORRECT") {
                setFlowState('quirurgicos_more');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en la lista de cirugías?",
                    options: [
                        { label: "➕ Agregar otra cirugía", value: "SURG_ADD_MORE" },
                        { label: "✏️ Modificar cirugía registrada", value: "SURG_MODIFY_SELECT" },
                        { label: "🗑️ Eliminar cirugía de la lista", value: "SURG_DELETE_SELECT" },
                        { label: "🔄 Limpiar lista quirúrgica", value: "SURG_CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver)", value: "SURG_FINISH" }
                    ]
                });
                setIsAnalyzing(false);
                return;
            }
            if (val.startsWith("SURG_MODIFY_INDEX_")) {
                const idx = parseInt(val.replace("SURG_MODIFY_INDEX_", ""), 10);
                if (!isNaN(idx) && surgicalStructured[idx]) {
                    const updated = surgicalStructured.filter((_, i) => i !== idx);

                    setSurgicalStructured(updated);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            surgical: updated
                        }
                    }));

                    setFlowState('quirurgicos_capture');
                    const selectedIds = updated.map(i => i.id);
                    const filteredOptions = getSurgicalOptions().filter(opt => !selectedIds.includes(opt.value) || opt.value === "SURG_OTHER");

                    pushMessage({
                        role: 'assistant',
                        content: "Entendido. Vamos a reconfigurar esta cirugía. Por favor, selecciónela de la lista oficial:",
                        options: filteredOptions,
                        showMenu: filteredOptions.length > 3 ? 'disease' : undefined,
                        inputType: 'strict_select'
                    });
                }
            }
        }
        else if (flowState === 'SELECT_SURG_DELETE_ITEM') {
            if (val === "SURG_BACK_TO_CORRECT") {
                setFlowState('quirurgicos_more');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en la lista de cirugías?",
                    options: [
                        { label: "➕ Agregar otra cirugía", value: "SURG_ADD_MORE" },
                        { label: "✏️ Modificar cirugía registrada", value: "SURG_MODIFY_SELECT" },
                        { label: "🗑️ Eliminar cirugía de la lista", value: "SURG_DELETE_SELECT" },
                        { label: "🔄 Limpiar lista quirúrgica", value: "SURG_CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver)", value: "SURG_FINISH" }
                    ]
                });
                setIsAnalyzing(false);
                return;
            }
            if (val.startsWith("SURG_DELETE_INDEX_")) {
                const idx = parseInt(val.replace("SURG_DELETE_INDEX_", ""), 10);
                if (!isNaN(idx) && surgicalStructured[idx]) {
                    const updated = surgicalStructured.filter((_, i) => i !== idx);

                    setSurgicalStructured(updated);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            surgical: updated
                        }
                    }));

                    pushMessage({
                        role: 'assistant',
                        content: "Cirugía eliminada con éxito del expediente."
                    });

                    setTimeout(() => {
                        setFlowState('quirurgicos_review');
                        const summaryText = updated.length > 0
                            ? updated.map(s => `- 🩺 **${s.label}**`).join('\n')
                            : "Ninguna cirugía registrada.";

                        pushMessage({
                            role: 'assistant',
                            content: makeP1P2(
                                "Para dar cumplimiento a la NOM-004-SSA3-2012 y sellar formalmente su expediente quirúrgico, por favor verifique los datos declarados:",
                                `${summaryText}\n\n---\n\n¿Es correcta esta información?`
                            ),
                            options: [
                                { label: "✅ Sí, es correcta", value: "SURG_CONFIRM" },
                                { label: "❌ No, quiero corregir algo", value: "SURG_CORRECT" }
                            ]
                        });
                    }, 500);
                }
            }
        }
        
        setIsAnalyzing(false);
    };

    // Orquestación del Genoma Clínico y alertas médicas
    const triggerClinicalIntegrations = (conditionValue, isManual = false) => {
        const cond = String(conditionValue).toUpperCase();

        if (cond.includes("DIABETES") || cond.includes("GLUCOSA")) {
            addAlert({
                type: 'EVALUACIÓN GLUCÉMICA / DISFUNCIÓN METABÓLICA',
                message: `Paciente ${prnEvaluated} con antecedente de Diabetes. Rigor en la prescripción de hidratos de carbono simples y acoplamiento de control glucémico.`
            });
            updateAxis('metabolicAxis', { glucoseRisk: true });
        }
        else if (cond.includes("HIPERTENS") || cond.includes("PRESI")) {
            addAlert({
                type: 'MONITOREO DE TENSIÓN ARTERIAL',
                message: `Presencia de Hipertensión Arterial en ${prnPatient}. Restricción estricta de sodio en preparaciones y control de suplementación con cafeína o termogénicos.`
            });
        }
        else if (cond.includes("TIROI") || cond.includes("HIPOTIRO")) {
            addAlert({
                type: 'ADAPTACIÓN ENDÓCRINA TIROIDEA',
                message: `Hipotiroidismo diagnosticado. Sincronizar ingesta matutina de Levotiroxina (ayuno completo) y evitar bociógenos crudos en el plan nutricional.`
            });
        }
        else if (cond.includes("SOP") || cond.includes("OVARIO POLIQUIS")) {
            addAlert({
                type: 'MODULACIÓN HORMONAL DE ALTO RANGO',
                message: `Diagnóstico de SOP en la paciente. Prescribir estrategias de modulación de resistencia a la insulina y control de andrógenos.`
            });
            updateAxis('metabolicAxis', { insulinResistance: true });
        }
        else if (cond.includes("GASTRIT") || cond.includes("COLIT") || cond.includes("INTESTINO")) {
            addAlert({
                type: 'INTEGRIDAD DE MUCOSA INTESTINAL',
                message: `Manifestación de inflamación en tubo digestivo. Modular ingesta de fibra insoluble, prohibir irritantes de alto impacto y valorar L-Glutamina.`
            });
        }
        else if (cond.includes("DISLIPIDEMIA") || cond.includes("COLESTEROL") || cond.includes("TRIGLICERID")) {
            addAlert({
                type: 'RIESGO DISLIPIDÉMICO ACTIVO',
                message: `Niveles lipídicos alterados reportados. Optimizar perfil de ácidos grasos (Omega 3/9) y suprimir grasas trans en el recetario terapéutico.`
            });
        }
    };

    // Registrar manejador de inputs con la aplicación global para entrada de texto libre
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, val) => handleSend(text, val));
        }
    }, [registerInputHandler, flowState, isAnalyzing, inputValue, personalStructured]);

    return null;
};

export default Fase5_PatologicosPersonales;
