import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { toSentenceCase } from '../../utils/utils';
import { motion as Motion } from 'framer-motion';

import tiloImg from '../../assets/tilo.png';
import ReactMarkdown from 'react-markdown';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';
import { Send } from 'lucide-react';

import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

/**
 * T.I.L.O. - FASE 4 (ANTECEDENTES FAMILIARES)
 * Versión: v4.4 - Genómica Universal
 * * DRILL-DOWN: Máquina de estados para capturar Patología -> Familiar -> Detalle
 */

const CAT_PATOLOGIAS = [
    { label: "Diabetes (Azúcar Alta)", value: "Diabetes" },
    { label: "Hipertensión (Presión Alta)", value: "Hipertension" },
    { label: "Obesidad / Sobrepeso", value: "Obesidad" },
    { label: "Cáncer / Tumor", value: "Cancer" },
    { label: "Enfermedad Renal / Diálisis", value: "Renal" },
    { label: "Asma / Problemas respiratorios", value: "Asma" },
    { label: "Problemas de Tiroides", value: "Tiroides" },
    { label: "Enfermedades Cardíacas / Infartos", value: "Cardiopatia" },
    { label: "Depresión / Ansiedad / Psiquiátrico", value: "Psiquiatrico" },
    { label: "Otras / Manual (Tipear)", value: "Otras" }
];

const getLocalizedPathValue = (a) => {
    if (a.patologia === "Otras") {
        return a.detalle || "Otras";
    }
    if (a.patologia === "Cancer") {
        return a.detalle ? `Cáncer (${a.detalle})` : "Cáncer";
    }
    const match = CAT_PATOLOGIAS.find(o => o.value === a.patologia);
    if (match) {
        return match.label.split(' (')[0].split(' / ')[0];
    }
    return a.patologia || "Condición no especificada";
};

const getPathologyEmoji = (patologia) => {
    switch (patologia) {
        case "Diabetes": return "🩸";
        case "Hipertension": return "📈";
        case "Obesidad": return "⚖️";
        case "Cancer": return "🎗️";
        case "Renal": return "🧬";
        case "Asma": return "🫁";
        case "Tiroides": return "🦋";
        case "Cardiopatia": return "❤️";
        case "Psiquiatrico": return "🧠";
        default: return "📋";
    }
};

const syncAlertsWithStore = (currentAntecedentes) => {
    const oncoItems = currentAntecedentes.filter(a => a.patologia === "Cancer");
    const metabolicItems = currentAntecedentes.filter(a => a.patologia === "Diabetes" || a.patologia === "Obesidad");
    const cardioItems = currentAntecedentes.filter(a => a.patologia === "Hipertension" || a.patologia === "Cardiopatia");

    useClinicalGenome.setState(state => {
        let nextAlerts = state.pendingAlerts.filter(a => 
            a.type !== 'ALERTA ONCOLÓGICA FAMILIAR' && 
            a.type !== 'RIESGO METABÓLICO HEREDITARIO' && 
            a.type !== 'RIESGO CARDIOVASCULAR'
        );

        if (oncoItems.length > 0) {
            const message = oncoItems.length === 1
                ? `Antecedente de Cáncer (${oncoItems[0].detalle || 'No especificado'}) en ${oncoItems[0].familiar}. Ajustar plan con dieta anti-inflamatoria.`
                : `Antecedente de Cáncer (${oncoItems.map(a => `${a.detalle || 'No especificado'} en ${a.familiar}`).join(', ')}). Ajustar plan con dieta anti-inflamatoria.`;
            nextAlerts.push({
                id: Date.now() - 3,
                type: 'ALERTA ONCOLÓGICA FAMILIAR',
                message
            });
        }

        if (metabolicItems.length > 0) {
            const message = `Carga genética para Síndrome Metabólico (${metabolicItems.map(item => `${getLocalizedPathValue(item)} en ${item.familiar}`).join(', ')}). Pre-establecer monitoreo glucémico.`;
            nextAlerts.push({
                id: Date.now() - 2,
                type: 'RIESGO METABÓLICO HEREDITARIO',
                message
            });
        }

        if (cardioItems.length > 0) {
            const message = `Vigilar marcadores de estrés endotelial debido a ${cardioItems.map(item => `${getLocalizedPathValue(item)} en ${item.familiar}`).join(', ')}.`;
            nextAlerts.push({
                id: Date.now() - 1,
                type: 'RIESGO CARDIOVASCULAR',
                message
            });
        }

        return { pendingAlerts: nextAlerts };
    });
};

const getFase4StateObj = (currentTree) => {
    const defaultMember = { diabetes: false, hypertension: false, cancer: false, obesity: false, renal: false };
    const stateObj = {
        parents: { ...defaultMember },
        grandparentsMaternal: { ...defaultMember },
        grandparentsPaternal: { ...defaultMember },
        siblings: { ...defaultMember },
        alert_detected: currentTree?.alert_detected || false,
        antecedentes: currentTree?.antecedentes || []
    };

    (currentTree?.antecedentes || []).forEach(ant => {
        const rel = ant.familiar;
        const pat = ant.patologia;
        
        let key = null;
        if (pat === 'Diabetes') key = 'diabetes';
        else if (pat === 'Hipertension') key = 'hypertension';
        else if (pat === 'Cancer') key = 'cancer';
        else if (pat === 'Obesidad') key = 'obesity';
        else if (pat === 'Renal') key = 'renal';

        if (!key) return;

        if (rel === 'Madre' || rel === 'Padre') {
            stateObj.parents[key] = true;
        } else if (rel === 'Abuela Materna' || rel === 'Abuelo Materno') {
            stateObj.grandparentsMaternal[key] = true;
        } else if (rel === 'Abuela Paterna' || rel === 'Abuelo Paterno') {
            stateObj.grandparentsPaternal[key] = true;
        } else if (rel === 'Hermano/a') {
            stateObj.siblings[key] = true;
        }
    });

    return stateObj;
};

const getInitialFlowState = (messages, patientData) => {
    if (!messages || messages.length === 0) return 'ASK_START';
    
    // Filtrar mensajes del asistente generados específicamente en la Fase 4 para evitar colisiones con fases previas
    const fase4Messages = messages.filter(m => 
        m.role === 'assistant' && 
        (m.content?.includes("antecedentes de enfermedades importantes en su familia directa") || 
         m.content?.includes("Antecedente registrado") || 
         m.content?.includes("Último antecedente") || 
         m.content?.includes("Se han eliminado todos los registros") ||
         m.content?.includes("De acuerdo. ¿Qué acción desea tomar") ||
         m.content?.includes("seleccione la condición o enfermedad") ||
         m.content?.includes("por favor verifique los datos registrados") ||
         m.content?.includes("antecedentes heredofamiliares"))
    );
    
    if (fase4Messages.length === 0) return 'ASK_START';
    
    const lastMsg = fase4Messages[fase4Messages.length - 1];
    const content = lastMsg.content || "";
    
    if (content.includes("¿Es correcta esta información?")) {
        return 'REVIEW_SUMMARY';
    }
    if (content.includes("Antecedente registrado") || 
        content.includes("Último antecedente") || 
        content.includes("Se han eliminado todos los registros") ||
        content.includes("De acuerdo. ¿Qué acción desea tomar")) {
        return 'ASK_MORE';
    }
    if (content.includes("padece") && (content.includes("familiar directo") || lastMsg.showMenu === 'relative')) {
        return 'SELECT_RELATIVE';
    }
    if (content.includes("¿Qué tipo de cáncer?") || content.includes("escriba el nombre de la enfermedad")) {
        return 'TYPE_DETAIL';
    }
    if (content.includes("seleccione la condición o enfermedad") || lastMsg.showMenu === 'disease') {
        return 'SELECT_DISEASE';
    }
    
    if (patientData?.familyTree?.antecedentes?.length > 0) return 'ASK_MORE';
    return 'ASK_START';
};

const Fase4_AntecedentesFamiliares = ({ patientData, setPatientData, onPhaseComplete, messages, setMessages, registerInputHandler, setIsGlobalTyping, onStateChange }) => {
    // NUEVA ESTRUCTURA DE DATOS
    const [familyTree, setFamilyTree] = useState(() => {
        return patientData?.familyTree || {
            antecedentes: [],
            alert_detected: false
        };
    });

    const { patientName: pName, isMinor, isLactante, isPediatrico, patientAge: age } = usePatientLinguistics(patientData);

    // Máquina de estados
    // ASK_START -> SELECT_DISEASE -> TYPE_DETAIL (if Cancer/Otras) -> SELECT_RELATIVE -> ASK_MORE
    const [flowState, setFlowState] = useState(() => {
        return getInitialFlowState(messages, patientData);
    });
    const [currentAntecedente, setCurrentAntecedente] = useState(null); // { patologia, detalle, familiar }

    useEffect(() => {
        if (onStateChange) {
            onStateChange(getFase4StateObj(familyTree));
        }
        syncAlertsWithStore(familyTree.antecedentes || []);
    }, [familyTree, onStateChange]);

    const updatePatientState = (newTree) => {
        setFamilyTree(newTree);
        setPatientData(prev => {
            const mappedStructured = (newTree.antecedentes || []).map(ant => ({
                relative: ant.familiar,
                condition: ant.patologia === 'Otras' ? 'OTHER' : ant.patologia,
                detail: ant.detalle || ant.patologia,
                source: 'CHECKLIST'
            }));
            return {
                ...prev,
                familyTree: newTree,
                history: {
                    ...prev?.history,
                    family_structured: mappedStructured,
                    family_checklist_verified: true
                }
            };
        });
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

    // Inicializar diálogo de Fase 4 en el estado global
    useEffect(() => {
        setMessages(prev => {
            const alreadyGreetedInPrev = prev.some(msg => 
                msg.role === 'assistant' && 
                (msg.content.includes("antecedentes de enfermedades importantes") || 
                 msg.content.includes("antecedentes familiares") ||
                 msg.content.includes("De acuerdo. ¿Qué acción desea tomar respecto a los antecedentes familiares?"))
            );
            if (alreadyGreetedInPrev) return prev;

            if (patientData?.familyTree?.antecedentes?.length > 0) {
                const resumeMsg = {
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué acción desea tomar respecto a los antecedentes familiares?",
                    options: [
                        { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                        { label: "↩️ BORRAR ÚLTIMO REGISTRO", value: "DELETE_LAST" },
                        { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                    ]
                };
                return [...prev, resumeMsg];
            } else {
                const greeting = isMinor 
                    ? `Entendido. Para complementar el mapa de salud de **${pName || "su menor"}**, ¿podría indicarme si existen antecedentes de enfermedades importantes en su familia directa (padres, abuelos, tíos o hermanos)?`
                    : `Entendido. Para complementar su mapa de salud, ¿podría indicarme si existen antecedentes de enfermedades importantes en su familia directa (padres, abuelos, tíos o hermanos)?`;
                
                const greetingMsg = {
                    role: 'assistant', content: greeting, options: [
                        { label: "❌ SIN ANTECEDENTES / LO IGNORO", value: "NO_ANTECEDENTES" },
                        { label: "✅ SÍ, REGISTRAR ANTECEDENTES", value: "SI_ANTECEDENTES" }
                    ]
                };
                return [...prev, greetingMsg];
            }
        });
    }, [isMinor, pName, patientData, setMessages]);

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

    // Dynamic relatives based on age
    const getRelativesMenu = () => {
        const base = [
            { label: "Madre", value: "Madre" },
            { label: "Padre", value: "Padre" },
            { label: "Abuela Materna", value: "Abuela Materna" },
            { label: "Abuelo Materno", value: "Abuelo Materno" },
            { label: "Abuela Paterna", value: "Abuela Paterna" },
            { label: "Abuelo Paterno", value: "Abuelo Paterno" },
            { label: "Hermano(a)", value: "Hermano/a" },
            { label: "Tío(a) Materno(a)", value: "Tio/a Materno/a" },
            { label: "Tío(a) Paterno(a)", value: "Tio/a Paterno/a" }
        ];
        if (age >= 18) base.push({ label: "Hijo(a)", value: "Hijo/a" });
        if (age >= 45) base.push({ label: "Nieto(a)", value: "Nieto/a" });
        return base;
    };

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
        if (!textToProcess.trim()) return;

        let userLabel = textToProcess;
        if (textToProcess === "SI_ANTECEDENTES") userLabel = "Sí, registrar antecedentes";
        if (textToProcess === "NO_ANTECEDENTES") userLabel = "Sin antecedentes / Lo ignoro";
        if (textToProcess === "FINISH") userLabel = "Continuar al historial";
        if (textToProcess === "ADD_MORE") userLabel = "Agregar otro antecedente";
        if (textToProcess === "DELETE_LAST") userLabel = "Borrar último registro";
        if (textToProcess === "CLEAR_ALL") userLabel = "Limpiar todo y empezar de nuevo";
        if (textToProcess === "CONFIRM_DATA") userLabel = "Sí, es correcta";
        if (textToProcess === "CORRECT_DATA") userLabel = "No, quiero corregir algo";
        if (textToProcess === "MODIFY_SELECT") userLabel = "✏️ Modificar un antecedente";
        if (textToProcess === "DELETE_SELECT") userLabel = "🗑️ Eliminar un antecedente";
        if (textToProcess === "CANCEL_REVIEW") userLabel = "❌ Cancelar (Volver)";
        if (textToProcess === "BACK_TO_CORRECT") userLabel = "⬅️ Volver al menú anterior";
        if (textToProcess.startsWith("DELETE_INDEX_")) {
            const idx = parseInt(textToProcess.replace("DELETE_INDEX_", ""), 10);
            const ant = familyTree.antecedentes[idx];
            userLabel = ant ? `🗑️ Eliminar: ${ant.familiar} - ${getLocalizedPathValue(ant)}` : "Eliminar antecedente";
        }
        if (textToProcess.startsWith("MODIFY_INDEX_")) {
            const idx = parseInt(textToProcess.replace("MODIFY_INDEX_", ""), 10);
            const ant = familyTree.antecedentes[idx];
            userLabel = ant ? `✏️ Modificar: ${ant.familiar} - ${getLocalizedPathValue(ant)}` : "Modificar antecedente";
        }

        // Find label if coming from menu
        if (type === "disease") userLabel = CAT_PATOLOGIAS.find(o => o.value === textToProcess)?.label || textToProcess;
        if (type === "relative") userLabel = getRelativesMenu().find(o => o.value === textToProcess)?.label || textToProcess;

        // Synchronously construct next messages list to prevent state update lag (Ghost Input)
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
            return nextMsgs;
        });

        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            processState(textToProcess, type, nextMsgs || messages);
        }, 600);
    };

    const processState = (val, type, currentMsgs = messages) => {
        if (flowState === 'ASK_START') {
            if (val === "NO_ANTECEDENTES") {
                if (isLactante && !familyTree.pediatric_atm?.birth_type) {
                    setFlowState('PEDIATRIC_ATM_1');
                    pushMessage({
                        role: 'assistant',
                        content: `Para evaluar la siembra del microbioma primario de **${pName || "su bebé"}**: ¿Nació por Vía Vaginal o por Cesárea? ¿Fue a término o prematuro?`,
                        options: [
                            { label: "👶 Parto Vaginal a Término", value: "ATM_BIRTH_VAGINAL_TERM" },
                            { label: "✂️ Cesárea a Término", value: "ATM_BIRTH_CESAREAN_TERM" },
                            { label: "⚠️ Parto Prematuro (< 37 semanas)", value: "ATM_BIRTH_PREMATURE" },
                            { label: "🏥 Cesárea por Complicación", value: "ATM_BIRTH_CESAREAN_COMP" }
                        ]
                    });
                    setIsAnalyzing(false);
                    return;
                }
                const finalMessages = [...currentMsgs, { role: 'assistant', content: "Entendido, sin antecedentes registrados." }];
                onPhaseComplete?.(familyTree, finalMessages);
                setIsAnalyzing(false);
                return;
            } else if (val === "SI_ANTECEDENTES") {
                setFlowState('SELECT_DISEASE');
                pushMessage({
                    role: 'assistant',
                    content: "Por favor, seleccione la condición o enfermedad que desea registrar:",
                    showMenu: 'disease',
                    options: CAT_PATOLOGIAS
                });
            }
        } 
        else if (flowState === 'SELECT_DISEASE') {
            const isCustom = val === "Otras" || val === "Cancer";
            if (isCustom) {
                setFlowState('TYPE_DETAIL');
                setCurrentAntecedente({ patologia: val, detalle: "", familiar: "" });
                pushMessage({
                    role: 'assistant',
                    content: val === "Cancer" 
                        ? "¿Qué tipo de cáncer? Escríbalo brevemente (Ej. Cáncer de mama, Leucemia)."
                        : "Por favor, escriba el nombre de la enfermedad o condición."
                });
            } else {
                setFlowState('SELECT_RELATIVE');
                setCurrentAntecedente({ patologia: val, detalle: "", familiar: "" });
                pushMessage({
                    role: 'assistant',
                    content: `¿Qué familiar directo ${isMinor ? `de **${pName}**` : 'de usted'} padece ${CAT_PATOLOGIAS.find(o=>o.value===val)?.label}?`,
                    showMenu: 'relative',
                    options: getRelativesMenu()
                });
            }
        }
        else if (flowState === 'TYPE_DETAIL') {
            const updated = { ...currentAntecedente, detalle: val };
            setCurrentAntecedente(updated);
            setFlowState('SELECT_RELATIVE');
            const patLabel = updated.patologia === "Cancer" ? "Cáncer" : updated.patologia;
            const disLabel = updated.patologia === "Otras" ? val : `${patLabel} (${val})`;
            pushMessage({
                role: 'assistant',
                content: `¿Qué familiar directo ${isMinor ? `de **${pName}**` : 'de usted'} padece ${disLabel}?`,
                showMenu: 'relative',
                options: getRelativesMenu()
            });
        }
        else if (flowState === 'SELECT_RELATIVE') {
            const finalAnt = { ...currentAntecedente, familiar: val };
            
            const hasOnco = [...familyTree.antecedentes, finalAnt].some(a => a.patologia === "Cancer");

            const newTree = {
                ...familyTree,
                antecedentes: [...familyTree.antecedentes, finalAnt],
                alert_detected: hasOnco
            };

            updatePatientState(newTree);

            setFlowState('ASK_MORE');
            pushMessage({
                role: 'assistant',
                content: "Antecedente registrado correctamente en el expediente. ¿Qué desea hacer?",
                options: [
                    { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                    { label: "↩️ BORRAR ÚLTIMO REGISTRO", value: "DELETE_LAST" },
                    { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                ]
            });
        }
        else if (flowState === 'ASK_MORE') {
            if (val === "FINISH" || val === "CANCEL_REVIEW") {
                setFlowState('REVIEW_SUMMARY');
                
                const summaryText = familyTree.antecedentes.length > 0
                    ? familyTree.antecedentes.map(a => `- ${getPathologyEmoji(a.patologia)} **${a.familiar || a.parentesco || 'Familiar no especificado'}**: ${getLocalizedPathValue(a)}`).join('\n')
                    : "Ningún antecedente registrado.";
                
                const finalContent = `Para dar cumplimiento a la NOM-004 y sellar formalmente este bloque de antecedentes heredofamiliares, por favor verifique los datos registrados:

${summaryText}

---

¿Es correcta esta información?`;

                pushMessage({
                    role: 'assistant',
                    content: finalContent,
                    options: [
                        { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                        { label: "❌ No, quiero corregir algo", value: "CORRECT_DATA" }
                    ]
                });
            } else if (val === "ADD_MORE") {
                setFlowState('SELECT_DISEASE');
                pushMessage({
                    role: 'assistant',
                    content: "Por favor, seleccione la condición o enfermedad que desea registrar:",
                    showMenu: 'disease',
                    options: CAT_PATOLOGIAS
                });
            } else if (val === "DELETE_LAST") {
                if (familyTree.antecedentes.length > 0) {
                    const updatedAntecedentes = familyTree.antecedentes.slice(0, -1);
                    const hasOnco = updatedAntecedentes.some(a => a.patologia === "Cancer");
                    const newTree = {
                        ...familyTree,
                        antecedentes: updatedAntecedentes,
                        alert_detected: hasOnco
                    };
                    updatePatientState(newTree);

                    pushMessage({
                        role: 'assistant',
                        content: "Último antecedente eliminado. ¿Desea realizar alguna otra acción?",
                        options: [
                            { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                            { label: "↩️ BORRAR ÚLTIMO REGISTRO", value: "DELETE_LAST" },
                            { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                        ]
                    });
                } else {
                    pushMessage({
                        role: 'assistant',
                        content: "No existen antecedentes registrados para eliminar. ¿Qué desea hacer?",
                        options: [
                            { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                            { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                        ]
                    });
                }
            } else if (val === "CLEAR_ALL") {
                const newTree = {
                    antecedentes: [],
                    alert_detected: false
                };
                updatePatientState(newTree);

                setFlowState('ASK_START');
                pushMessage({
                    role: 'assistant',
                    content: "Se han eliminado todos los registros del expediente. ¿Desea registrar antecedentes familiares?",
                    options: [
                        { label: "❌ SIN ANTECEDENTES / LO IGNORO", value: "NO_ANTECEDENTES" },
                        { label: "✅ SÍ, REGISTRAR ANTECEDENTES", value: "SI_ANTECEDENTES" }
                    ]
                });
            } else if (val === "MODIFY_SELECT") {
                if (familyTree.antecedentes.length > 0) {
                    setFlowState('SELECT_MODIFY_ITEM');
                    const opts = familyTree.antecedentes.map((a, idx) => ({
                        label: `👤 ${a.familiar || 'Familiar'}: ${getLocalizedPathValue(a)}`,
                        value: `MODIFY_INDEX_${idx}`
                    })).concat([{ label: "⬅️ Volver al menú anterior", value: "BACK_TO_CORRECT" }]);
                    
                    pushMessage({
                        role: 'assistant',
                        content: "¿Qué antecedente desea modificar? Seleccione de la lista:",
                        options: opts
                    });
                } else {
                    pushMessage({
                        role: 'assistant',
                        content: "No existen antecedentes registrados para modificar.",
                        options: [
                            { label: "➕ Agregar familiar/condición", value: "ADD_MORE" },
                            { label: "❌ Cancelar (Volver)", value: "FINISH" }
                        ]
                    });
                }
            } else if (val === "DELETE_SELECT") {
                if (familyTree.antecedentes.length > 0) {
                    setFlowState('SELECT_DELETE_ITEM');
                    const opts = familyTree.antecedentes.map((a, idx) => ({
                        label: `👤 ${a.familiar || 'Familiar'}: ${getLocalizedPathValue(a)}`,
                        value: `DELETE_INDEX_${idx}`
                    })).concat([{ label: "⬅️ Volver al menú anterior", value: "BACK_TO_CORRECT" }]);
                    
                    pushMessage({
                        role: 'assistant',
                        content: "¿Qué antecedente desea eliminar del expediente? Seleccione de la lista:",
                        options: opts
                    });
                } else {
                    pushMessage({
                        role: 'assistant',
                        content: "No existen antecedentes registrados para eliminar.",
                        options: [
                            { label: "➕ Agregar familiar/condición", value: "ADD_MORE" },
                            { label: "❌ Cancelar (Volver)", value: "FINISH" }
                        ]
                    });
                }
            }
        }
        else if (flowState === 'REVIEW_SUMMARY') {
            if (val === "CONFIRM_DATA") {
                if (isConfirming.current) return;

                if (isLactante && !familyTree.pediatric_atm?.birth_type) {
                    setFlowState('PEDIATRIC_ATM_1');
                    pushMessage({
                        role: 'assistant',
                        content: `Para evaluar la siembra del microbioma primario de **${pName || "su bebé"}**: ¿Nació por Vía Vaginal o por Cesárea? ¿Fue a término o prematuro?`,
                        options: [
                            { label: "👶 Parto Vaginal a Término", value: "ATM_BIRTH_VAGINAL_TERM" },
                            { label: "✂️ Cesárea a Término", value: "ATM_BIRTH_CESAREAN_TERM" },
                            { label: "⚠️ Parto Prematuro (< 37 semanas)", value: "ATM_BIRTH_PREMATURE" },
                            { label: "🏥 Cesárea por Complicación", value: "ATM_BIRTH_CESAREAN_COMP" }
                        ]
                    });
                    setIsAnalyzing(false);
                    return;
                }

                isConfirming.current = true;

                // Sync messages list cleanly (already contains the user bubble from currentMsgs)
                const updatedMessagesList = [...currentMsgs];
                
                // Strip options from the last assistant message (which is at index length - 2)
                if (updatedMessagesList.length > 1) {
                    const secondToLast = updatedMessagesList[updatedMessagesList.length - 2];
                    if (secondToLast && secondToLast.role === 'assistant') {
                        updatedMessagesList[updatedMessagesList.length - 2] = {
                            ...secondToLast,
                            options: undefined,
                            showMenu: undefined
                        };
                    }
                }

                // Execute phase completion without duplicate transition bubbles (fixes Eco Conversacional)
                onPhaseComplete?.(familyTree, updatedMessagesList);
                return;
            } else if (val === "CORRECT_DATA") {
                setFlowState('ASK_MORE');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en la lista de antecedentes?",
                    options: [
                        { label: "➕ Agregar familiar/condición", value: "ADD_MORE" },
                        { label: "✏️ Modificar un antecedente", value: "MODIFY_SELECT" },
                        { label: "🗑️ Eliminar un antecedente", value: "DELETE_SELECT" },
                        { label: "🔄 Limpiar lista completa", value: "CLEAR_ALL" },
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
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en la lista de antecedentes?",
                    options: [
                        { label: "➕ Agregar familiar/condición", value: "ADD_MORE" },
                        { label: "✏️ Modificar un antecedente", value: "MODIFY_SELECT" },
                        { label: "🗑️ Eliminar un antecedente", value: "DELETE_SELECT" },
                        { label: "🔄 Limpiar lista completa", value: "CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver)", value: "FINISH" }
                    ]
                });
                setIsAnalyzing(false);
                return;
            }
            if (val.startsWith("MODIFY_INDEX_")) {
                const idx = parseInt(val.replace("MODIFY_INDEX_", ""), 10);
                if (!isNaN(idx) && familyTree.antecedentes[idx]) {
                    const updated = familyTree.antecedentes.filter((_, i) => i !== idx);
                    const hasOnco = updated.some(a => a.patologia === "Cancer");
                    updatePatientState({
                        ...familyTree,
                        antecedentes: updated,
                        alert_detected: hasOnco
                    });

                    setFlowState('SELECT_DISEASE');
                    pushMessage({
                        role: 'assistant',
                        content: "Entendido. Vamos a reconfigurar este antecedente. Por favor, seleccione la condición o enfermedad que padece el familiar:",
                        showMenu: 'disease',
                        options: CAT_PATOLOGIAS
                    });
                }
            }
        }
        else if (flowState === 'SELECT_DELETE_ITEM') {
            if (val === "BACK_TO_CORRECT") {
                setFlowState('ASK_MORE');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en la lista de antecedentes?",
                    options: [
                        { label: "➕ Agregar familiar/condición", value: "ADD_MORE" },
                        { label: "✏️ Modificar un antecedente", value: "MODIFY_SELECT" },
                        { label: "🗑️ Eliminar un antecedente", value: "DELETE_SELECT" },
                        { label: "🔄 Limpiar lista completa", value: "CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver)", value: "FINISH" }
                    ]
                });
                setIsAnalyzing(false);
                return;
            }
            if (val.startsWith("DELETE_INDEX_")) {
                const idx = parseInt(val.replace("DELETE_INDEX_", ""), 10);
                if (!isNaN(idx) && familyTree.antecedentes[idx]) {
                    const updated = familyTree.antecedentes.filter((_, i) => i !== idx);
                    const hasOnco = updated.some(a => a.patologia === "Cancer");
                    
                    const newTree = {
                        ...familyTree,
                        antecedentes: updated,
                        alert_detected: hasOnco
                    };
                    updatePatientState(newTree);

                    pushMessage({
                        role: 'assistant',
                        content: "Antecedente eliminado con éxito."
                    });

                    setTimeout(() => {
                        setFlowState('REVIEW_SUMMARY');
                        
                        const summaryText = newTree.antecedentes.length > 0
                            ? newTree.antecedentes.map(a => `- ${getPathologyEmoji(a.patologia)} **${a.familiar || a.parentesco || 'Familiar no especificado'}**: ${getLocalizedPathValue(a)}`).join('\n')
                            : "Ningún antecedente registrado.";
                        
                        const finalContent = `Para dar cumplimiento a la NOM-004 y sellar formalmente este bloque de antecedentes heredofamiliares, por favor verifique los datos registrados:

${summaryText}

---

¿Es correcta esta información?`;

                        pushMessage({
                            role: 'assistant',
                            content: finalContent,
                            options: [
                                { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                                { label: "❌ No, quiero corregir algo", value: "CORRECT_DATA" }
                            ]
                        });
                    }, 500);
                }
            }
        }
        else if (flowState === 'PEDIATRIC_ATM_1') {
            const birthMap = {
                ATM_BIRTH_VAGINAL_TERM: "Parto Vaginal a Término",
                ATM_BIRTH_CESAREAN_TERM: "Cesárea a Término",
                ATM_BIRTH_PREMATURE: "Parto Prematuro (< 37 sem)",
                ATM_BIRTH_CESAREAN_COMP: "Cesárea por Complicación"
            };
            const birthLabel = birthMap[val] || val;
            const updatedTree = {
                ...familyTree,
                pediatric_atm: { ...(familyTree.pediatric_atm || {}), birth_type: birthLabel }
            };
            updatePatientState(updatedTree);
            setPatientData?.(prev => ({
                ...prev,
                pediatric_atm: { ...(prev.pediatric_atm || {}), birth_type: birthLabel }
            }));

            setFlowState('PEDIATRIC_ATM_2');
            pushMessage({
                role: 'assistant',
                content: `En los primeros meses de vida de **${pName || "su bebé"}**: ¿Recibió Lactancia Materna Exclusiva, Fórmula Infantil o Alimentación Mixta?`,
                options: [
                    { label: "🤱 Lactancia Materna Exclusiva", value: "ATM_LACTATION_EXCLUSIVE" },
                    { label: "🍼 Fórmula Infantil Exclusiva", value: "ATM_LACTATION_FORMULA" },
                    { label: "🥣 Alimentación Mixta (Leche + Fórmula)", value: "ATM_LACTATION_MIXED" }
                ]
            });
            setIsAnalyzing(false);
            return;
        }
        else if (flowState === 'PEDIATRIC_ATM_2') {
            const lacMap = {
                ATM_LACTATION_EXCLUSIVE: "Lactancia Materna Exclusiva",
                ATM_LACTATION_FORMULA: "Fórmula Infantil Exclusiva",
                ATM_LACTATION_MIXED: "Alimentación Mixta (Leche + Fórmula)"
            };
            const lacLabel = lacMap[val] || val;
            const updatedTree = {
                ...familyTree,
                pediatric_atm: { ...(familyTree.pediatric_atm || {}), lactation: lacLabel }
            };
            updatePatientState(updatedTree);
            setPatientData?.(prev => ({
                ...prev,
                pediatric_atm: { ...(prev.pediatric_atm || {}), lactation: lacLabel }
            }));

            isConfirming.current = true;
            pushMessage({
                role: 'assistant',
                content: `✅ Antecedentes perinatales de **${pName || "su bebé"}** (Vía de parto: ${updatedTree.pediatric_atm.birth_type}, Alimentación inicial: ${lacLabel}) registrados y sellados con éxito.`
            });

            setTimeout(() => {
                onPhaseComplete?.(updatedTree, currentMsgs);
                setIsAnalyzing(false);
            }, 600);
            return;
        }
        
        setIsAnalyzing(false);
    };

    // Register Handler
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, val) => handleSend(text, val));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registerInputHandler, flowState, isAnalyzing, inputValue]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(isAnalyzing);
        }
    }, [isAnalyzing, setIsGlobalTyping]);

    return null;
};

export default Fase4_AntecedentesFamiliares;
