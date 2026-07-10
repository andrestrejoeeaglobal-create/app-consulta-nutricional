import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { formatText } from '../../utils/utils';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

import tiloImg from '../../assets/tilo.png';
import ReactMarkdown from 'react-markdown';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';
import { Send } from 'lucide-react';
/**
 * T.I.L.O. - MÓDULO FASE 5 (ESTILO DE VIDA)
 * Versión: v4.1 - Standard Look & Feel Alignment + Pediatric Linguistics
 * * CONSISTENCIA: Sigue el modelo de Fase 3 y 4 (Burbujas limpias UI).
 * * Dimensión 2: Fisiología Ambiental (Altitud automática por CP).
 * * Dimensión 7: Sincronización de Ciclo Femenino (Obligatorio por género).
 * * Dimensión 6: Telemetría de Energía (Soberanía Biológica).
 * * Frontend: Extracción del Espejo Clínico (módulo independiente).
 */

const Fase5_EstiloVida = ({ messages, setMessages, registerInputHandler, setIsGlobalTyping, db, user, appId, patientProfile, patientData, onStateChange, onPhaseComplete }) => {
    // Uso del hook de lingüística para unificar nombres y contextos pediátricos
    const { patientName: pName, patientSex } = usePatientLinguistics(patientData);
    const ptCtx = patientData?.profile?.pediatric_profile;
    const isMinor = ptCtx?.is_minor === true;
    
    const isFemale = patientSex?.toUpperCase().startsWith('F');
    
    // Pronombres dinámicos
    const minorArticle = isFemale ? 'la menor' : 'el menor';

    // Calcular edad para filtro
    const ageStr = patientData?.profile?.pediatric_profile?.age || patientData?.identificacion?.edad || "0";
    const age = parseInt(ageStr, 10) || 0;

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

    const [lifeStyle, setLifeStyle] = useState({
        environment: { altitude: initialAltitude, hypoxiaRisk: initialAltitude > 2000, city: initialCity },
        circadian: { sleepHours: 0, quality: "" },
        hormonal: { cyclePhase: "N/A", lastPeriod: "" },
        energy: { level: 0, peakTime: "" },
        bio_architecture_goal: ""
    });

    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            let greeting = "";
            if (initialCp) {
                greeting = initialAltitude > 2000
                    ? isMinor
                        ? `${pName}, he analizado el entorno. Al vivir en **${initialCity}** a **${initialAltitude} msnm**, el cuerpo de ${pName} lucha contra la hipoxia ambiental, lo que eleva el cortisol. Para reclamar la soberanía biológica, ¿cómo calificaría el nivel de energía de ${pName} del 1 al 10 al despertar?`
                        : `${pName}, he analizado su entorno. Al vivir en **${initialCity}** a **${initialAltitude} msnm**, su cuerpo lucha contra la hipoxia ambiental, lo que eleva su cortisol. Para reclamar su soberanía biológica, ¿cómo calificaría su nivel de energía del 1 al 10 al despertar?`
                    : isMinor
                        ? `${pName}, ahora que tenemos los planos genéticos, vamos a la arquitectura del día. ¿Cómo calificaría el nivel de energía de ${pName} del 1 al 10 al despertar?`
                        : `${pName}, ahora que tenemos sus planos genéticos, vamos a la arquitectura de su día. ¿Cómo calificaría su nivel de energía del 1 al 10 al despertar?`;
            } else {
                greeting = isMinor
                    ? `${pName}, ahora vamos a evaluar la arquitectura del día. ¿Cómo calificaría el nivel de energía de ${pName} del 1 al 10 al despertar?`
                    : `${pName}, ahora vamos a evaluar la arquitectura de su día. ¿Cómo calificaría su nivel de energía del 1 al 10 al despertar?`;
            }

            const greetingMsg = {
                role: 'assistant', content: greeting, options: [
                    { label: "1 a 3 (Muy Baja)", value: "3" },
                    { label: "4 a 6 (Regular)", value: "5" },
                    { label: "7 a 8 (Buena)", value: "7" },
                    { label: "9 a 10 (Excelente)", value: "9" }
                ]
            };

            setMessages(prev => [...prev, greetingMsg]);
        }
    }, []);

    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [currentStep, setCurrentStep] = useState('ENVIRONMENT');
    const chatEndRef = useRef(null);

    // Call onStateChange initially if provided, to ensure parent is synced
    useEffect(() => {
        if (onStateChange) onStateChange(lifeStyle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncLifeData = async (updates) => {
        const newState = { ...lifeStyle, ...updates };
        setLifeStyle(newState);
        if (onStateChange) onStateChange(newState);

        if (user && db && appId) {
            try {
                await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/clinical_context`, "phase5_lifestyle"), newState, { merge: true });
            } catch (error) {
                console.error("Firebase Sync techayhu:", error);
            }
        }
        return newState;
    };

    const handleSend = async (text) => {
        const textToProcess = text || inputValue;
        if (!textToProcess.trim()) return;

        let userLabel = textToProcess;
        if (textToProcess === "3") userLabel = "1 a 3 (Muy Baja)";
        if (textToProcess === "5") userLabel = "4 a 6 (Regular)";
        if (textToProcess === "7") userLabel = "7 a 8 (Buena)";
        if (textToProcess === "9") userLabel = "9 a 10 (Excelente)";
        if (textToProcess === "Folicular_Lutea") userLabel = "Folicular / Lútea";
        if (textToProcess === "Menstruacion") userLabel = "Menstruación / Transición";
        if (textToProcess === "Pospausia") userLabel = "Posmenopausia / Irregular";
        if (textToProcess === "<5_hours") userLabel = "Menos de 5 horas";
        if (textToProcess === "6-7_hours") userLabel = "Entre 6 y 7 horas";
        if (textToProcess === ">8_hours") userLabel = "8 horas o más";

        setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                newMsgs[newMsgs.length - 1].options = undefined;
            }
            return [...newMsgs, { role: 'user', content: formatText(userLabel) }];
        });

        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            const lower = textToProcess.toLowerCase();

            if (currentStep === 'ENVIRONMENT') {
                const energyScore = parseInt(textToProcess.match(/\d+/)?.[0] || "5");
                syncLifeData({ energy: { ...lifeStyle.energy, level: energyScore } });

                // Dimensión 7: Sincronización Ciclo (Solo Mujeres, >= 10 años)
                const age = patientData?.identificacion?.edad || patientProfile?.age || 0;
                const isAppropriateAgeForCycle = age >= 10;

                if (isFemale && isAppropriateAgeForCycle) {
                    const cycleMsg = isMinor 
                        ? `Dato registrado. Como Bio-Arquitecto, debo sincronizar el plan con el ritmo hormonal de ${minorArticle}. ¿En qué fase del ciclo se encuentra hoy o cómo describiría los periodos recientes de ${pName}?`
                        : `Dato registrado. Como Bio-Arquitecto, debo sincronizar su plan con su ritmo hormonal. ¿En qué fase de su ciclo se encuentra hoy o cómo describiría sus periodos recientes?`;
                    setMessages(prev => [...prev, {
                        role: 'assistant', content: cycleMsg, options: [
                            { label: "Folicular / Lútea", value: "Folicular_Lutea" },
                            { label: "Menstruación / Transición", value: "Menstruacion" },
                            { label: "Posmenopausia / Periodo Irregular", value: "Pospausia" }
                        ]
                    }]);
                    setCurrentStep('HORMONAL');
                } else {
                    setMessages(prev => [...prev, {
                        role: 'assistant', content: isMinor ? `¿Cuántas horas de sueño profundo logra rescatar ${pName} cada noche para su reparación celular?` : "¿Cuántas horas de sueño profundo logra rescatar cada noche para su reparación celular?", options: [
                            { label: "8 horas o más", value: ">8_hours" },
                            { label: "Entre 6 y 7 horas", value: "6-7_hours" },
                            { label: "Menos de 5 horas", value: "<5_hours" }
                        ]
                    }]);
                    setCurrentStep('SLEEP');
                }
            }
            else if (currentStep === 'HORMONAL') {
                let phase = 'En transición';
                if (lower.includes('lutea') || lower.includes('folicular')) phase = 'Folicular / Lútea';
                if (lower.includes('pospausia') || lower.includes('irregular') || lower.includes('menopausia')) phase = 'Tránsito / Posmenopausia';
                if (lower.includes('menstruacion')) phase = 'Menstruación';

                syncLifeData({ hormonal: { ...lifeStyle.hormonal, cyclePhase: phase } });
                setMessages(prev => [...prev, {
                    role: 'assistant', content: isMinor ? `Entendido. Sincronizaremos los micronutrientes con esa fase. Finalmente, ¿cuántas horas duerme ${pName} en promedio?` : "Entendido. Sincronizaremos los micronutrientes con esa fase. Finalmente, ¿cuántas horas duerme en promedio?", options: [
                        { label: "8 horas o más", value: ">8_hours" },
                        { label: "Entre 6 y 7 horas", value: "6-7_hours" },
                        { label: "Menos de 5 horas", value: "<5_hours" }
                    ]
                }]);
                setCurrentStep('SLEEP');
            }
            else if (currentStep === 'SLEEP') {
                let hours = 7;
                if (lower.includes('<5_hours') || lower.includes('menos de 5') || lower.includes('4') || lower.includes('5')) hours = 5;
                if (lower.includes('6-7_hours') || lower.includes('6') || lower.includes('7')) hours = 7;
                if (lower.includes('>8_hours') || lower.includes('8') || lower.includes('9')) hours = 8;

                const newCircadian = { ...lifeStyle.circadian, sleepHours: hours };
                syncLifeData({ circadian: newCircadian });

                let summaryText = `Como protocolo de seguridad clínica y arquitectónica de su biología, le presento un resumen de los datos ambientales y cronobiológicos recopilados:\n\n`;
                summaryText += `- ⚡ **Nivel de Energía:** ${lifeStyle.energy.level}/10\n`;
                if (isFemale && age >= 10) {
                    summaryText += `- 🌸 **Sincronía Hormonal:** ${lifeStyle.hormonal.cyclePhase || 'No especificada'}\n`;
                }
                summaryText += `- 💤 **Horas de Sueño:** ${hours} horas\n\n`;
                summaryText += `¿Es correcta esta información?`;

                setMessages(prev => [...prev, {
                    role: 'assistant', content: summaryText, options: [
                        { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                        { label: "❌ No, quiero corregir algo", value: "CORRECT_DATA" }
                    ]
                }]);
                setCurrentStep('REVIEW_SUMMARY');
            }
            else if (currentStep === 'REVIEW_SUMMARY') {
                if (textToProcess === "CONFIRM_DATA") {
                    onPhaseComplete?.(lifeStyle, null);
                } else if (textToProcess === "CORRECT_DATA") {
                    const energyMsg = isMinor
                        ? `De acuerdo, vamos a corregir. ¿Cómo calificaría el nivel de energía de ${pName} del 1 al 10 al despertar?`
                        : `De acuerdo, vamos a corregir. ¿Cómo calificaría su nivel de energía del 1 al 10 al despertar?`;
                    setMessages(prev => [...prev, {
                        role: 'assistant', content: energyMsg, options: [
                            { label: "1 a 3 (Muy Baja)", value: "3" },
                            { label: "4 a 6 (Regular)", value: "5" },
                            { label: "7 a 8 (Buena)", value: "7" },
                            { label: "9 a 10 (Excelente)", value: "9" }
                        ]
                    }]);
                    setCurrentStep('ENVIRONMENT');
                }
            }

            setIsAnalyzing(false);
        }, 800);
    };

    // Register Handler
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text) => handleSend(text));
        }
    }, [registerInputHandler, currentStep, isAnalyzing, inputValue, lifeStyle]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(isAnalyzing);
        }
    }, [isAnalyzing, setIsGlobalTyping]);

    // Headless UI: Phase 5 only uses text/options, which are handled by ChatView.
    return null;
};

export default Fase5_EstiloVida;
