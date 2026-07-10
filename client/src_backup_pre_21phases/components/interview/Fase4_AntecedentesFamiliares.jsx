import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { formatText } from '../../utils/utils';
import { motion as Motion } from 'framer-motion';

import tiloImg from '../../assets/tilo.png';
import ReactMarkdown from 'react-markdown';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';
import { Send } from 'lucide-react';

/**
 * T.I.L.O. - FASE 4 (ANTECEDENTES FAMILIARES)
 * Versión: v4.4 - Genómica Universal
 * * DRILL-DOWN: Máquina de estados para capturar Patología -> Familiar -> Detalle
 */

const CAT_PATOLOGIAS = [
    { label: "Diabetes (Azúcar alta)", value: "Diabetes" },
    { label: "Hipertensión (Presión alta)", value: "Hipertension" },
    { label: "Obesidad / Sobrepeso", value: "Obesidad" },
    { label: "Cáncer / Tumor", value: "Cancer" },
    { label: "Enfermedad Renal / Diálisis", value: "Renal" },
    { label: "Asma / Problemas respiratorios", value: "Asma" },
    { label: "Problemas de Tiroides", value: "Tiroides" },
    { label: "Enfermedades Cardíacas / Infartos", value: "Cardiopatia" },
    { label: "Depresión / Ansiedad / Psiquiátrico", value: "Psiquiatrico" },
    { label: "Otras / Manual (Tipear)", value: "Otras" }
];

const Fase4_AntecedentesFamiliares = ({ messages, setMessages, patientData, setPatientData, onPhaseComplete, registerInputHandler, setIsGlobalTyping }) => {
    // NUEVA ESTRUCTURA DE DATOS
    const [familyTree, setFamilyTree] = useState(() => {
        return patientData?.familyTree || {
            antecedentes: [],
            alert_detected: false
        };
    });

    const ptCtx = patientData?.profile?.pediatric_profile;
    const isMinor = ptCtx?.is_minor === true;
    let pName = patientData?.profile?.first_name || patientData?.identificacion?.nombre || patientData?.identificacion?.nombres || patientData?.identityLock?.patientInfo?.firstName;
    pName = pName ? pName.split(' ')[0] : null;
    
    // Calcular edad para filtro
    const ageStr = patientData?.profile?.pediatric_profile?.age || patientData?.identificacion?.edad || "0";
    const age = parseInt(ageStr, 10) || 0;

    // Máquina de estados
    // ASK_START -> SELECT_DISEASE -> TYPE_DETAIL (if Cancer/Otras) -> SELECT_RELATIVE -> ASK_MORE
    const [flowState, setFlowState] = useState(() => {
        if (patientData?.familyTree?.antecedentes?.length > 0) return 'ASK_MORE';
        return 'ASK_START';
    });
    const [currentAntecedente, setCurrentAntecedente] = useState(null); // { patologia, detalle, familiar }

    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            if (patientData?.familyTree?.antecedentes?.length > 0) {
                const resumeMsg = {
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué acción desea tomar respecto a los antecedentes familiares?",
                    options: [
                        { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                        { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                    ]
                };
                setMessages(prev => [...prev, resumeMsg]);
            } else {
                const greeting = isMinor 
                    ? `Entendido. Para complementar el mapa de salud de **${pName || "su menor"}**, ¿podría indicarme si existen antecedentes de enfermedades importantes en su familia directa (padres, abuelos, tíos o hermanos)?`
                    : `Entendido. Para complementar ${pName ? `el mapa de salud de **${pName}**` : 'su mapa de salud'}, ¿podría indicarme si existen antecedentes de enfermedades importantes en su familia directa (padres, abuelos, tíos o hermanos)?`;
                
                const greetingMsg = {
                    role: 'assistant', content: greeting, options: [
                        { label: "❌ SIN ANTECEDENTES / LO IGNORO", value: "NO_ANTECEDENTES" },
                        { label: "✅ SÍ, REGISTRAR ANTECEDENTES", value: "SI_ANTECEDENTES" }
                    ]
                };
                setMessages(prev => [...prev, greetingMsg]);
            }
        }
    }, []);

    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const addAlert = useClinicalGenome(state => state.addAlert);

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
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                newMsgs[newMsgs.length - 1].options = undefined;
                newMsgs[newMsgs.length - 1].showMenu = undefined;
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

        // Find label if coming from menu
        if (type === "disease") userLabel = CAT_PATOLOGIAS.find(o => o.value === textToProcess)?.label || textToProcess;
        if (type === "relative") userLabel = getRelativesMenu().find(o => o.value === textToProcess)?.label || textToProcess;

        pushMessage({ role: 'user', content: formatText(userLabel) });
        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            processState(textToProcess, type);
        }, 600);
    };

    const processState = (val) => {
        if (flowState === 'ASK_START') {
            if (val === "NO_ANTECEDENTES") {
                // Not returning messages, Phase handles its own state
                onPhaseComplete?.(familyTree, null);
                setIsAnalyzing(false);
                return;
            } else if (val === "SI_ANTECEDENTES") {
                setFlowState('SELECT_DISEASE');
                pushMessage({
                    role: 'assistant',
                    content: "Por favor, seleccione la condición o enfermedad que desea registrar:",
                    showMenu: 'disease'
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
                    content: `¿Qué familiar directo de ${pName} padece ${CAT_PATOLOGIAS.find(o=>o.value===val)?.label}?`,
                    showMenu: 'relative'
                });
            }
        }
        else if (flowState === 'TYPE_DETAIL') {
            const updated = { ...currentAntecedente, detalle: val };
            setCurrentAntecedente(updated);
            setFlowState('SELECT_RELATIVE');
            const disLabel = updated.patologia === "Otras" ? val : `${updated.patologia} (${val})`;
            pushMessage({
                role: 'assistant',
                content: `¿Qué familiar directo de ${pName} padece ${disLabel}?`,
                showMenu: 'relative'
            });
        }
        else if (flowState === 'SELECT_RELATIVE') {
            const finalAnt = { ...currentAntecedente, familiar: val };
            
            // Evaluar Alertas
            const isOnco = finalAnt.patologia === "Cancer";
            const isMetabolic = finalAnt.patologia === "Diabetes" || finalAnt.patologia === "Obesidad";
            const isCardio = finalAnt.patologia === "Hipertension" || finalAnt.patologia === "Cardiopatia";
            
            let hasAlert = familyTree.alert_detected;
            if (isOnco) {
                addAlert({
                    type: 'ALERTA ONCOLÓGICA FAMILIAR',
                    message: `Antecedente de Cáncer (${finalAnt.detalle || 'No especificado'}) en ${val}. Ajustar plan con dieta anti-inflamatoria.`
                });
                hasAlert = true;
            }
            if (isMetabolic) {
                addAlert({
                    type: 'RIESGO METABÓLICO HEREDITARIO',
                    message: `Carga genética para Síndrome Metabólico (${finalAnt.patologia} en ${val}). Pre-establecer monitoreo glucémico.`
                });
            }
            if (isCardio) {
                addAlert({
                    type: 'RIESGO CARDIOVASCULAR',
                    message: `Vigilar marcadores de estrés endotelial debido a ${finalAnt.patologia} en ${val}.`
                });
            }

            const newTree = {
                ...familyTree,
                antecedentes: [...familyTree.antecedentes, finalAnt],
                alert_detected: hasAlert
            };

            setFamilyTree(newTree);
            setPatientData(prev => ({ ...prev, familyTree: newTree }));

            setFlowState('ASK_MORE');
            pushMessage({
                role: 'assistant',
                content: "Antecedente registrado correctamente en el expediente. ¿Desea agregar otro antecedente?",
                options: [
                    { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                    { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                ]
            });
        }
        else if (flowState === 'ASK_MORE') {
            if (val === "FINISH") {
                setFlowState('REVIEW_SUMMARY');
                const summaryText = familyTree.antecedentes.length > 0
                    ? familyTree.antecedentes.map(a => `- **${a.familiar || a.parentesco || 'Familiar no especificado'}**: ${a.patologia || a.diagnostico || 'Condición no especificada'}`).join('\n')
                    : "Ningún antecedente registrado.";
                
                pushMessage({
                    role: 'assistant',
                    content: `A continuación, le presento un resumen de los Antecedentes Heredofamiliares capturados:\n\n${summaryText}\n\n¿Son correctos estos datos?`,
                    options: [
                        { label: "✅ SÍ, CONFIRMAR DATOS", value: "CONFIRM_DATA" },
                        { label: "❌ NO, CORREGIR DATOS", value: "CORRECT_DATA" }
                    ]
                });
            } else if (val === "ADD_MORE") {
                setFlowState('SELECT_DISEASE');
                pushMessage({
                    role: 'assistant',
                    content: "Por favor, seleccione la condición o enfermedad que desea registrar:",
                    showMenu: 'disease'
                });
            }
        }
        else if (flowState === 'REVIEW_SUMMARY') {
            if (val === "CONFIRM_DATA") {
                onPhaseComplete?.(familyTree, null);
            } else if (val === "CORRECT_DATA") {
                setFlowState('ASK_MORE');
                pushMessage({
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué acción desea tomar?",
                    options: [
                        { label: "➕ AGREGAR OTRO ANTECEDENTE", value: "ADD_MORE" },
                        { label: "➡️ CONTINUAR AL HISTORIAL", value: "FINISH" }
                    ]
                });
            }
        }
        
        setIsAnalyzing(false);
    };

    // Register Handler
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, val) => handleSend(text, val));
        }
    }, [registerInputHandler, flowState, isAnalyzing, inputValue]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(isAnalyzing);
        }
    }, [isAnalyzing, setIsGlobalTyping]);

    // Headless UI: Check if we need to return the showMenu embedded in ChatView
    const showMenu = messages[messages.length - 1]?.showMenu;
    if (showMenu && !isAnalyzing) {
        return (
            <div className="w-full relative z-50">
                <SearchableVerticalMenu 
                    options={showMenu === 'disease' ? CAT_PATOLOGIAS : getRelativesMenu()} 
                    onSelect={(val) => handleSend(val, showMenu)} 
                    embedded={true}
                />
            </div>
        );
    }

    return null;
};

export default Fase4_AntecedentesFamiliares;
