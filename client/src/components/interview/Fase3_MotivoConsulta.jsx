import React, { useState, useEffect, useRef } from 'react';
import { formatText } from '../../utils/utils';
import VisualBodyMap from '../VisualBodyMap';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';
import { Send } from 'lucide-react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { analyzeClinicalMotive } from '../../hooks/useCortex';
import ReactMarkdown from 'react-markdown';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import tiloImg from '../../assets/tilo.png';

const routeToSpanish = (route) => {
    const map = {
        'GOAL_ADDICTIONS': 'Adicciones y Sustancias',
        'GOAL_GERIATRICS': 'Geriatría',
        'GOAL_ALLERGIES': 'Alergias Graves',
        'GOAL_WEIGHT_LOSS': 'Pérdida de Peso',
        'GOAL_BARIATRIC': 'Bariátrica / Quirúrgico',
        'GOAL_MENOPAUSE': 'Climaterio y Menopausia',
        'GOAL_CLINICAL': 'Control Clínico',
        'GOAL_PALLIATIVE': 'Cuidados Paliativos',
        'GOAL_DISABILITY': 'Discapacidad y Rehabilitación',
        'GOAL_PREGNANCY': 'Embarazo y Lactancia',
        'GOAL_MUSCLE': 'Deporte / Rendimiento',
        'GOAL_ONCOLOGY': 'Oncología Nutricional',
        'GOAL_PEDIATRICS': 'Pediatría',
        'GOAL_LONGEVITY': 'Longevidad',
        'GOAL_MENTAL_HEALTH': 'Salud Mental',
        'GOAL_RENAL': 'Salud Renal',
        'GOAL_IMMUNE': 'Inmunodeficiencias'
    };
    const cleanRoute = (route || "").replace('@ ', '');
    return map[cleanRoute] || cleanRoute;
};

const riskToSpanish = (risk) => {
    const map = {
        'LOW': 'Base',
        'MEDIUM': 'Moderado',
        'HIGH': 'Alto',
        'SEVERE': 'Crítico (Red Flag)'
    };
    const cleanRisk = (risk || "").toUpperCase();
    return map[cleanRisk] || risk;
};

const motiveOptions = [
    { label: "Adicciones y Sustancias", value: "GOAL_ADDICTIONS" },
    { label: "Adulto Mayor (Geriatría)", value: "GOAL_GERIATRICS" },
    { label: "Alergias Graves (Protocolo Anafilaxia)", value: "GOAL_ALLERGIES" },
    { label: "Bajar de Peso / Sobrepeso", value: "GOAL_WEIGHT_LOSS" },
    { label: "Bariátrica / Quirúrgico", value: "GOAL_BARIATRIC" },
    { label: "Climaterio y Menopausia", value: "GOAL_MENOPAUSE" },
    { label: "Control Clínico (Patologías Crónicas)", value: "GOAL_CLINICAL" },
    { label: "Cuidados Paliativos", value: "GOAL_PALLIATIVE" },
    { label: "Discapacidad y Rehabilitación", value: "GOAL_DISABILITY" },
    { label: "Embarazo y Lactancia", value: "GOAL_PREGNANCY" },
    { label: "Ganar Músculo / Deporte (Rendimiento)", value: "GOAL_MUSCLE" },
    { label: "Oncología Nutricional", value: "GOAL_ONCOLOGY" },
    { label: "Pediatría (Crecimiento y Desarrollo)", value: "GOAL_PEDIATRICS" },
    { label: "Prevención y Longevidad (Biohacking)", value: "GOAL_LONGEVITY" },
    { label: "Salud Mental / TCA (Seguridad Conductual)", value: "GOAL_MENTAL_HEALTH" },
    { label: "Salud Renal (Nefropatía)", value: "GOAL_RENAL" },
    { label: "VIH e Inmunodeficiencias", value: "GOAL_IMMUNE" }
];

const goalMap = {
    'GOAL_WEIGHT_LOSS': { avatar: 'METABOLIC', risk: 'LOW' },
    'GOAL_MUSCLE': { avatar: 'PERFORMANCE', risk: 'LOW' },
    'GOAL_LONGEVITY': { avatar: 'LONGEVITY', risk: 'LOW' },
    'GOAL_CLINICAL': { avatar: 'CLINICAL', risk: 'MEDIUM' },
    'GOAL_PEDIATRICS': { avatar: 'CLINICAL', risk: 'MEDIUM' },
    'GOAL_PREGNANCY': { avatar: 'CLINICAL', risk: 'MEDIUM' },
    'GOAL_GERIATRICS': { avatar: 'CLINICAL', risk: 'MEDIUM' },
    'GOAL_MENOPAUSE': { avatar: 'CLINICAL', risk: 'MEDIUM' },
    'GOAL_MENTAL_HEALTH': { avatar: 'CLINICAL', risk: 'HIGH' },
    'GOAL_BARIATRIC': { avatar: 'CLINICAL', risk: 'HIGH' },
    'GOAL_RENAL': { avatar: 'CLINICAL', risk: 'HIGH' },
    'GOAL_ONCOLOGY': { avatar: 'CLINICAL', risk: 'HIGH' },
    'GOAL_IMMUNE': { avatar: 'CLINICAL', risk: 'HIGH' },
    'GOAL_PALLIATIVE': { avatar: 'CLINICAL', risk: 'HIGH' },
    'GOAL_ALLERGIES': { avatar: 'CLINICAL', risk: 'HIGH' },
    'GOAL_ADDICTIONS': { avatar: 'CLINICAL', risk: 'HIGH' },
    'GOAL_DISABILITY': { avatar: 'CLINICAL', risk: 'MEDIUM' }
};

const Fase3_MotivoConsulta = ({ messages, setMessages, onPhaseComplete, patientData, setPatientData, registerInputHandler, setIsGlobalTyping, onStepChange }) => {
    const chatEndRef = useRef(null);
    const initialMessageCountRef = useRef(messages?.length || 0);
    const identityLock = useClinicalGenome(state => state.identityLock);
    const { patientAge: age, patientSex: gender, patientName } = usePatientLinguistics(patientData);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const getBinaryGateReviewMsg = () => {
        const sxUpper = String(gender).toUpperCase();
        const genderChar = (sxUpper === 'F' || sxUpper === 'FEMENINO' || sxUpper === 'MUJER') ? 'F' : 'M';
        const cleanName = patientName !== "NOM" ? patientName : "el paciente";
        const firstName = cleanName.split(' ')[0];

        let positiveLabel = "✅ SÍ, CONFIRMAR EVALUACIÓN";
        let p2Text = "";

        if (age <= 2.99) {
            positiveLabel = "✅ SÍ, CONFIRMAR DATOS";
            p2Text = `Para blindar el expediente clínico bajo los lineamientos de la NOM-004, por favor confirme si la evaluación consolidada del lactante es correcta:`;
        } else if (age < 13) {
            positiveLabel = "✅ SÍ, CONFIRMAR DATOS";
            p2Text = `Para blindar el expediente clínico de su hij${genderChar === 'M' ? 'o' : 'a'}, por favor confirme si la evaluación consolidada es correcta:`;
        } else if (age < 18) {
            positiveLabel = "✅ SÍ, CONFIRMAR EVALUACIÓN";
            p2Text = `${firstName}, por favor indique si la evaluación consolidada de su motivo de consulta es correcta y precisa:`;
        } else if (age < 65) {
            positiveLabel = "✅ SÍ, CONFIRMAR EVALUACIÓN";
            p2Text = `${firstName}, por favor confirme si la evaluación clínica en pantalla refleja con exactitud su situación actual:`;
        } else {
            positiveLabel = "✅ SÍ, CONFIRMAR EVALUACIÓN";
            p2Text = `Para blindar su expediente clínico, por favor confirme si la evaluación mostrada en pantalla es correcta y precisa:`;
        }

        return {
            role: "assistant",
            content: `📍 **Bloque de triage clínico preliminar sellado.** La información capturada y el análisis de T.I.L.O. formarán la base de su abordaje clínico bajo los lineamientos de la NOM-004.\n\n---\n\n${p2Text}`,
            options: [
                { label: positiveLabel, value: "CONFIRM_DATA" },
                { label: "❌ NO, CORREGIR DATOS", value: "CORRECT_DATA" }
            ]
        };
    };

    const updateClinicalContext = (updates) => {
        setPatientData(prev => ({
            ...prev,
            clinical_context: {
                ...(prev.clinical_context || {}),
                ...updates,
                ai_analysis: {
                    ...(prev.clinical_context?.ai_analysis || {}),
                    ...(updates.ai_analysis || {})
                }
            }
        }));
    };

    const getFilteredOptions = () => {
        const sxUpper = String(gender).toUpperCase();
        const genderChar = (sxUpper === 'F' || sxUpper === 'FEMENINO' || sxUpper === 'MUJER') ? 'F' : 'M';
        const isPediatric = age < 12;
        const isMinor = age < 18;

        return motiveOptions.filter(opt => {
            if (opt.value === 'GOAL_PREGNANCY' && (genderChar === 'M' || age < 10 || age > 60)) return false;
            if (opt.value === 'GOAL_MENOPAUSE' && (genderChar === 'M' || age < 35)) return false;
            if (opt.value === 'GOAL_GERIATRICS' && age < 60) return false;
            
            if (isPediatric) {
                const allowedForPediatric = [
                    'GOAL_PEDIATRICS', 
                    'GOAL_CLINICAL', 
                    'GOAL_ALLERGIES', 
                    'GOAL_DISABILITY', 
                    'GOAL_MENTAL_HEALTH'
                ];
                if (!allowedForPediatric.includes(opt.value)) return false;
            } else if (isMinor) {
                const excludedForMinors = ['GOAL_LONGEVITY', 'GOAL_BARIATRIC', 'GOAL_ADDICTIONS'];
                if (excludedForMinors.includes(opt.value)) return false;
            } else {
                if (opt.value === 'GOAL_PEDIATRICS') return false;
            }

            return true;
        }).map(opt => {
            if (isMinor && opt.value === 'GOAL_IMMUNE') {
                return { ...opt, label: "Inmunología Pediátrica" };
            }
            return opt;
        }).sort((a, b) => a.label.localeCompare(b.label));
    };

    const [inputValue, setInputValue] = useState("");
    const [step, setStep] = useState(() => {
        const context = patientData?.clinical_context || {};
        if (context.goal) {
            const requiresPainMap = [
                'GOAL_CLINICAL',
                'GOAL_GERIATRICS',
                'GOAL_DISABILITY',
                'GOAL_BARIATRIC',
                'GOAL_ONCOLOGY',
                'GOAL_PALLIATIVE',
                'GOAL_RENAL',
                'GOAL_IMMUNE',
                'GOAL_ALLERGIES'
            ].includes(context.goal);

            if (!requiresPainMap) {
                const hasSymptoms = context.secondary_symptoms || context.sintomas;
                return hasSymptoms ? 'clinica_triage_ai_complete' : 'clinica_triage_symptoms';
            }

            const hasPainZones = context.pain_zones && context.pain_zones.length > 0;
            const hasSymptoms = context.secondary_symptoms || context.sintomas;
            if (hasPainZones && hasSymptoms) {
                return 'clinica_triage_ai_complete';
            }
            if (hasPainZones) {
                const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
                const isGateMsg = lastMsg && lastMsg.inputType === 'strict_select' && lastMsg.options && lastMsg.options.some(o => o.value === 'ADD_DETAIL_YES');
                if (isGateMsg) {
                    return 'clinica_triage_symptoms_gate';
                }
                return 'clinica_triage_symptoms';
            }
            return 'clinica_body_map';
        }
        return 'clinica_triage_start';
    });
    const [isTyping, setIsTyping] = useState(false);

    const hasStarted = useRef(
        step !== 'clinica_triage_start' || 
        (messages && messages.some(m => m.role === 'assistant' && (m.content.includes('Para diseñar el plan clínico de') || m.content.includes('Para comenzar a diseñar su plan clínico'))))
    );
    const filteredMotiveOptions = getFilteredOptions();

    // Initialize Flow
    useEffect(() => {
        if (!hasStarted.current && step === 'clinica_triage_start') {
            hasStarted.current = true;
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);

                let age = 30;
                if (identityLock?.patientInfo?.age) {
                    age = Number(identityLock.patientInfo.age);
                } else if (patientData) {
                    if (patientData.profile?.age) age = Number(patientData.profile.age);
                    else if (patientData.identificacion?.edad) age = Number(patientData.identificacion.edad);
                }

                const isMinor = age < 18;
                const patientName = (identityLock?.patientInfo?.name || patientData?.profile?.name || patientData?.identificacion?.nombre || "el paciente").split(' ')[0];
                const cleanName = patientName !== "NOM" ? patientName : "el paciente";

                const welcomeMsg = isMinor
                    ? `Para diseñar el plan clínico de **${cleanName}**, por favor seleccione la **Ruta Primaria** o Motivo de Consulta principal:`
                    : "Para comenzar a diseñar su plan clínico de precisión, por favor seleccione su **Ruta Primaria** o Motivo de Consulta principal:";

                setMessages(prev => [
                    ...prev,
                    {
                        role: "assistant",
                        content: welcomeMsg,
                        options: filteredMotiveOptions
                    }
                ]);
            }, 1000);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, patientData]);

    const completePhase3 = () => {
        let rawRoute = patientData.clinical_context?.goal || patientData.clinical_context?.ai_analysis?.primaryRoute;
        let rawReasoning = patientData.clinical_context?.ai_analysis?.gem_reasoning;

        // Sanitize string "undefined" or "null" returned by LLM or state engine
        if (!rawRoute || rawRoute === 'undefined' || rawRoute === 'null') rawRoute = 'GOAL_CLINICAL';
        if (!rawReasoning || rawReasoning === 'undefined' || rawReasoning === 'null') {
            rawReasoning = 'Análisis clínico de motivo de consulta integrado en matriz de evaluación NOM-004.';
        }

        const phase3Data = {
            primaryRoute: rawRoute,
            gem_reasoning: rawReasoning,
            secondaryRoutes: []
        };
        onPhaseComplete(phase3Data);
    };

    const handleSend = (text, directValue = null, inputSource = null) => {
        const textToDisplay = typeof text === 'string' ? text : (inputValue || "");
        const valueToProcess = directValue !== null ? directValue : textToDisplay;
        
        if (!textToDisplay?.trim() && step !== 'clinica_body_map') return;

        setInputValue("");
        if (valueToProcess !== 'BODY_MAP_COMPLETE') {
            const isGoalCode = typeof valueToProcess === 'string' && valueToProcess.startsWith('GOAL_');
            const isFromButton = inputSource === 'button' || directValue === 'button';
            if (!isGoalCode && !isFromButton) {
                let userBubbleText = formatText(textToDisplay);
                if (valueToProcess === 'CONFIRM_DATA') userBubbleText = "✅ SÍ, CONFIRMAR EVALUACIÓN";
                else if (valueToProcess === 'CORRECT_DATA') userBubbleText = "❌ NO, CORREGIR DATOS";

                setMessages(prev => [...prev, { role: "user", content: userBubbleText }]);
            }
        }

        setIsTyping(true);

        setTimeout(() => {
            setIsTyping(false);
            const userMsg = valueToProcess;
            const cleanText = formatText(userMsg);
            let nextStep = step;
            let responseMsg = "";

            switch (step) {
                case 'clinica_triage_start': {
                    const selectedOpt = motiveOptions.find(o => 
                        o.value === userMsg || 
                        o.label.toLowerCase() === userMsg.toLowerCase() ||
                        o.value.toLowerCase() === userMsg.toLowerCase()
                    );
                    
                    if (selectedOpt) {
                        const label = selectedOpt.label;
                        const config = goalMap[selectedOpt.value] || { avatar: 'METABOLIC', risk: 'LOW' };

                        updateClinicalContext({
                            primary_motive: label,
                            goal: selectedOpt.value,
                            secondary_motives: [],
                            ai_analysis: {
                                avatar_assigned: config.avatar,
                                risk_level: config.risk,
                                detected_tags: patientData.clinical_context?.ai_analysis?.detected_tags || []
                            },
                            history: [...(patientData.clinical_context?.history || []), {
                                question: "Ruta Primaria / Motivo de Consulta",
                                answer: label,
                                timestamp: new Date().toISOString()
                            }],
                            secondary_symptoms: ""
                        });

                        const requiresPainMap = [
                            'GOAL_CLINICAL',
                            'GOAL_GERIATRICS',
                            'GOAL_DISABILITY',
                            'GOAL_BARIATRIC',
                            'GOAL_ONCOLOGY',
                            'GOAL_PALLIATIVE',
                            'GOAL_RENAL',
                            'GOAL_IMMUNE',
                            'GOAL_ALLERGIES'
                        ].includes(selectedOpt.value);

                        if (requiresPainMap) {
                            responseMsg = `Entendido (${label}). Hemos configurado su perfil clínico.\n\n---\n\nPara ser más precisos, por favor **indique en el mapa** dónde siente mayor molestia o si hay zonas específicas a tratar.`;
                            nextStep = 'clinica_body_map';
                        } else {
                            // Salto directo a la Inferencia IA (Deducción Sugerida Matriz IFM)
                            setStep('clinica_triage_ai_analysis');
                            setMessages(prev => [
                                ...prev, 
                                { role: "assistant", content: `Entendido (${label}). Hemos configurado su perfil clínico.\n\n---\n\nT.I.L.O. está procesando sus biosensores y evaluación clínica...`, avatar: tiloImg }
                            ]);
                            
                            const freeText = label;
                            const telemetry = { 
                                age: age, 
                                gender: gender, 
                                location: patientData?.profile?.address?.state || "No especificado" 
                            };
                            const bodyMapZones = []; // Sin zonas de dolor
                            
                            analyzeClinicalMotive(freeText, telemetry, bodyMapZones).then(aiResult => {
                                 updateClinicalContext({
                                     goal: aiResult.primaryRoute,
                                     ai_analysis: {
                                         ...(patientData.clinical_context?.ai_analysis || {}),
                                         gem_reasoning: aiResult.reasoning,
                                         primaryRoute: aiResult.primaryRoute,
                                         secondaryRoute: aiResult.secondaryRoute,
                                         redFlag: aiResult.redFlag,
                                         risk_level: aiResult.risk_level,
                                         detected_tags: aiResult.detected_tags || patientData.clinical_context?.ai_analysis?.detected_tags || []
                                     }
                                 });
                                 
                                 const bentoMsg = { 
                                     role: "assistant", 
                                     content: aiResult.redFlag ? `⚠️ ${aiResult.patientMessage}\n\nActivando protocolo de derivación y evaluación médica prioritaria.` : `✅ ${aiResult.patientMessage}`, 
                                     isAiAnalysisResult: true, 
                                     aiData: aiResult 
                                 };
                                 const reviewMsg = getBinaryGateReviewMsg();
                                 
                                 setMessages(prev => [...prev, bentoMsg, reviewMsg]);
                                 setStep('clinica_triage_review');
                            });
                            return;
                        }
                    } else {
                        // Entrada de texto libre (Bypass GEM)
                        const cleanText = formatText(userMsg);
                        
                        updateClinicalContext({
                            primary_motive: "Inferencia Semántica GEM",
                            secondary_symptoms: cleanText,
                            history: [...(patientData.clinical_context?.history || []), {
                                question: "Motivo de Consulta (Texto Libre)",
                                answer: cleanText,
                                timestamp: new Date().toISOString()
                            }]
                        });

                        const highSeverityKeywords = ['cancer', 'cáncer', 'matriz', 'amputa', 'duelo', 'falleci', 'muerte', 'perdí', 'tumor', 'maligno', 'quimio'];
                        const isHighSeverity = highSeverityKeywords.some(kw => cleanText.toLowerCase().includes(kw));

                        if (isHighSeverity) {
                            nextStep = 'clinica_triage_containment'; 
                            setTimeout(() => handleContainmentSequence(cleanText), 100);
                            return; 
                        }

                        // AI Semantic Triage (GEM Integration)
                        setStep('clinica_triage_ai_analysis');
                        setMessages(prev => [...prev, { role: "assistant", content: "T.I.L.O. está procesando tus biosensores y realizando el cruce forense de tu motivo de consulta..." }]);
                        
                        const telemetry = { 
                            age: age, 
                            gender: gender, 
                            location: patientData?.profile?.address?.state || "No especificado" 
                        };
                        const bodyMapZones = patientData.clinical_context?.pain_zones || [];
                        
                        analyzeClinicalMotive(cleanText, telemetry, bodyMapZones).then(aiResult => {
                             updateClinicalContext({
                                  goal: aiResult.primaryRoute,
                                  primary_motive: routeToSpanish(aiResult.primaryRoute),
                                  ai_analysis: {
                                      ...(patientData.clinical_context?.ai_analysis || {}),
                                      gem_reasoning: aiResult.reasoning,
                                      primaryRoute: aiResult.primaryRoute,
                                      secondaryRoute: aiResult.secondaryRoute,
                                      redFlag: aiResult.redFlag,
                                      risk_level: aiResult.risk_level,
                                      detected_tags: aiResult.detected_tags || patientData.clinical_context?.ai_analysis?.detected_tags || []
                                  }
                             });
                             
                             let finalResponse = aiResult.patientMessage;
                             if (aiResult.redFlag) {
                                 finalResponse += "\n\n⚠️ **Protocolo de Derivación Activo por Alerta Clínica (Red Flag).**";
                             }
                             finalResponse += `\n\n---\n\nEntendido. Hemos activado la ruta clínica de **${routeToSpanish(aiResult.primaryRoute)}**.\n\nPara ser más precisos, por favor **indique en el mapa** dónde siente mayor molestia o si hay zonas específicas a tratar.`;

                             setMessages(prev => [...prev, { 
                                 role: "assistant", 
                                 content: finalResponse,
                                 inputType: 'body_map'
                             }]);
                             
                             setStep('clinica_body_map');
                        });
                        return;
                    }
                    break;
                }

                case 'clinica_body_map': {
                    if (userMsg === 'BODY_MAP_COMPLETE') {
                        responseMsg = "Entendido.\n\n---\n\n¿Presenta algún otro síntoma, molestia o detalle importante que debamos registrar?";
                        nextStep = 'clinica_triage_symptoms_gate';
                    }
                    break;
                }

                case 'clinica_triage_symptoms_gate': {
                    if (userMsg === 'ADD_DETAIL_YES') {
                        responseMsg = "Por favor, describa brevemente el síntoma o detalle adicional:";
                        nextStep = 'clinica_triage_symptoms';
                    } else if (userMsg === 'ADD_DETAIL_NO') {
                        responseMsg = "T.I.L.O. está procesando tus biosensores y evaluación clínica...";
                        nextStep = 'clinica_triage_ai_analysis';
                        
                        setStep('clinica_triage_ai_analysis');
                        
                        const freeText = (patientData.clinical_context?.primary_motive || "") + " " + (patientData.clinical_context?.secondary_symptoms || "") + " Ninguno";
                        const telemetry = { 
                            age: age, 
                            gender: gender, 
                            location: patientData?.profile?.address?.state || "No especificado" 
                        };
                        const bodyMapZones = patientData.clinical_context?.pain_zones || [];
                        
                        analyzeClinicalMotive(freeText, telemetry, bodyMapZones).then(aiResult => {
                             updateClinicalContext({
                                  goal: aiResult.primaryRoute,
                                  ai_analysis: {
                                      ...(patientData.clinical_context?.ai_analysis || {}),
                                      gem_reasoning: aiResult.reasoning,
                                      primaryRoute: aiResult.primaryRoute,
                                      secondaryRoute: aiResult.secondaryRoute,
                                      redFlag: aiResult.redFlag,
                                      risk_level: aiResult.risk_level,
                                      detected_tags: aiResult.detected_tags || patientData.clinical_context?.ai_analysis?.detected_tags || []
                                  }
                             });
                             
                             const bentoMsg = { 
                                 role: "assistant", 
                                 content: aiResult.redFlag ? `⚠️ ${aiResult.patientMessage}\n\nActivando protocolo de derivación y evaluación médica prioritaria.` : `✅ ${aiResult.patientMessage}`, 
                                 isAiAnalysisResult: true, 
                                 aiData: aiResult 
                             };
                             const reviewMsg = getBinaryGateReviewMsg();

                             setMessages(prev => [...prev, bentoMsg, reviewMsg]);
                             setStep('clinica_triage_review');
                        });
                        return;
                    }
                    break;
                }

                case 'clinica_triage_symptoms': {
                    const symptomsInput = cleanText;

                    updateClinicalContext({
                        secondary_symptoms: (patientData.clinical_context?.secondary_symptoms || "") + symptomsInput,
                        history: [...(patientData.clinical_context?.history || []), {
                            question: "Sintomatología Adicional",
                            answer: symptomsInput,
                            timestamp: new Date().toISOString()
                        }]
                    });

                    const highSeverityKeywords = ['cancer', 'cáncer', 'matriz', 'amputa', 'duelo', 'falleci', 'muerte', 'perdí', 'tumor', 'maligno', 'quimio'];
                    const sensitiveKeywords = ['quiste', 'biopsia', 'seno', 'mama', 'oncologo'];
                    const surgeryKeywords = ['operacion', 'cirugia', 'cesarea', 'apendice', 'vesicula', 'histerectomia'];

                    const isHighSeverity = highSeverityKeywords.some(kw => symptomsInput.toLowerCase().includes(kw));
                    const isSensitive = sensitiveKeywords.some(kw => symptomsInput.toLowerCase().includes(kw));
                    const isSurgery = surgeryKeywords.some(kw => symptomsInput.toLowerCase().includes(kw));

                    if (isHighSeverity) {
                        nextStep = 'clinica_triage_containment'; 
                        setTimeout(() => handleContainmentSequence(symptomsInput), 100);
                        return; 
                    } else if (isSensitive) {
                        responseMsg = "Entiendo la importancia de lo que menciona.\n\n---\n\nPara poder apoyarle mejor, ¿le gustaría compartir un poco más sobre este diagnóstico o prefiere que lo abordemos con detalle directamente en la consulta?";
                        nextStep = 'clinica_triage_sensitive_followup';
                    } else if (isSurgery) {
                        responseMsg = "Entendido. Dado que menciona un procedimiento quirúrgico, ¿hace cuánto tiempo fue o cuándo está programado?";
                        nextStep = 'intro_triage_surgery';
                    } else {
                        // AI Semantic Triage (GEM Integration)
                        setStep('clinica_triage_ai_analysis');
                        setMessages(prev => [...prev, { role: "assistant", content: "T.I.L.O. está procesando tus biosensores y evaluación clínica..." }]);
                        
                        const freeText = (patientData.clinical_context?.primary_motive || "") + " " + (patientData.clinical_context?.secondary_symptoms || "") + " " + symptomsInput;
                        const telemetry = { 
                            age: age, 
                            gender: gender, 
                            location: patientData?.profile?.address?.state || "No especificado" 
                        };
                        const bodyMapZones = patientData.clinical_context?.pain_zones || [];
                        
                        analyzeClinicalMotive(freeText, telemetry, bodyMapZones).then(aiResult => {
                             updateClinicalContext({
                                 goal: aiResult.primaryRoute,
                                 ai_analysis: {
                                     ...(patientData.clinical_context?.ai_analysis || {}),
                                     gem_reasoning: aiResult.reasoning,
                                     primaryRoute: aiResult.primaryRoute,
                                     secondaryRoute: aiResult.secondaryRoute,
                                     redFlag: aiResult.redFlag,
                                     risk_level: aiResult.risk_level,
                                     detected_tags: aiResult.detected_tags || patientData.clinical_context?.ai_analysis?.detected_tags || []
                                 }
                             });
                             
                             const bentoMsg = { 
                                 role: "assistant", 
                                 content: aiResult.redFlag ? `⚠️ ${aiResult.patientMessage}\n\nActivando protocolo de derivación y evaluación médica prioritaria.` : `✅ ${aiResult.patientMessage}`, 
                                 isAiAnalysisResult: true, 
                                 aiData: aiResult 
                             };
                             const reviewMsg = getBinaryGateReviewMsg();

                             setMessages(prev => [...prev, bentoMsg, reviewMsg]);
                             setStep('clinica_triage_review');
                        });
                        return;
                    }
                    break;
                }

                case 'clinica_triage_sensitive_followup': {
                    const freeText = (patientData.clinical_context?.primary_motive || "") + " " + (patientData.clinical_context?.secondary_symptoms || "") + ` [DETALLE SENSIBLE: ${cleanText}]`;
                    updateClinicalContext({
                        secondary_symptoms: patientData.clinical_context?.secondary_symptoms + ` [DETALLE SENSIBLE: ${cleanText}]`,
                        history: [...(patientData.clinical_context?.history || []), {
                            question: "Detalle Sensible (Seguimiento)",
                            answer: cleanText,
                            timestamp: new Date().toISOString()
                        }]
                    });

                    setStep('clinica_triage_ai_analysis');
                    setMessages(prev => [...prev, { role: "assistant", content: "T.I.L.O. está integrando estos detalles sensibles en su matriz de evaluación..." }]);
                    
                    const telemetry = { age: age, gender: gender, location: patientData?.profile?.address?.state || "No especificado" };
                    const bodyMapZones = patientData.clinical_context?.pain_zones || [];
                    
                    analyzeClinicalMotive(freeText, telemetry, bodyMapZones).then(aiResult => {
                         updateClinicalContext({
                             goal: aiResult.primaryRoute,
                             ai_analysis: {
                                 ...(patientData.clinical_context?.ai_analysis || {}),
                                 gem_reasoning: aiResult.reasoning,
                                 primaryRoute: aiResult.primaryRoute,
                                 secondaryRoute: aiResult.secondaryRoute,
                                 redFlag: aiResult.redFlag,
                                 risk_level: aiResult.risk_level,
                                 detected_tags: aiResult.detected_tags || patientData.clinical_context?.ai_analysis?.detected_tags || []
                             }
                         });
                         
                         const bentoMsg = { 
                             role: "assistant", 
                             content: `✅ ${aiResult.patientMessage}`, 
                             isAiAnalysisResult: true, 
                             aiData: aiResult 
                         };
                         const reviewMsg = getBinaryGateReviewMsg();

                         setMessages(prev => [...prev, bentoMsg, reviewMsg]);
                         setStep('clinica_triage_review');
                    });
                    return;
                }

                case 'intro_triage_surgery': {
                    const lowerMsg = userMsg.toLowerCase();
                    let status = "NONE";
                    let msg = "";

                    if (lowerMsg.includes('pre') || lowerMsg.includes('prepara') || lowerMsg.includes('antes') || lowerMsg.includes('programada')) {
                        status = "PRE";
                        msg = "⚠️ ALERTA: Suspender suplementos anticoagulantes (Ajo, Omega-3, Ginkgo) 7 días antes.";
                    } else if (lowerMsg.includes('ya') || lowerMsg.includes('post') || lowerMsg.includes('pasó') || lowerMsg.includes('paso')) {
                        status = "POST";
                        msg = "⚠️ ALERTA: Validar alta médica antes de iniciar esfuerzo físico.";
                    }

                    updateClinicalContext({
                        history: [...(patientData.clinical_context?.history || []), {
                            question: "Estatus Quirúrgico",
                            answer: msg ? `${status} (${msg})` : "Sin Intervenciones Recientes",
                            timestamp: new Date().toISOString()
                        }]
                    });

                    if (msg) {
                        setMessages(prev => [...prev, { role: "assistant", content: `${msg}\n\nTomado en cuenta. He registrado su estatus.` }]);
                        setTimeout(() => completePhase3(), 1500);
                        return;
                    } else {
                        completePhase3();
                        return;
                    }
                }

                case 'clinica_triage_review': {
                    const cleanUpper = String(userMsg || '').toUpperCase();
                    const isConfirmation = cleanUpper.includes('CONFIRM') || cleanUpper.includes('SI') || cleanUpper.includes('SÍ') || cleanUpper.includes('EVALUACION') || cleanUpper.includes('EVALUACIÓN') || cleanUpper.includes('CORRECTO') || cleanUpper.includes('DATOS');
                    const isRejection = cleanUpper.includes('NO') || cleanUpper.includes('CORREGIR') || cleanUpper.includes('CAMBIAR');

                    if (isConfirmation && !isRejection) {
                        setMessages(prev => [
                            ...prev,
                            { role: "assistant", content: "Excelente. Transfiriendo su información al historial clínico..." }
                        ]);
                        setTimeout(() => completePhase3(), 1000);
                        return;
                    } else {
                        responseMsg = "De acuerdo, ¿qué más le gustaría agregar o corregir sobre su motivo de consulta?";
                        nextStep = 'clinica_triage_symptoms';
                    }
                    break;
                }

                case 'clinica_triage_ai_complete':
                case 'clinica_triage_containment_complete':
                    completePhase3();
                    return;

                default:
                    responseMsg = "Fase 3 Completada.";
                    completePhase3();
                    return;
            }

            if (responseMsg) {
                const isBodyMap = nextStep === 'clinica_body_map';
                const isSymptomsGate = nextStep === 'clinica_triage_symptoms_gate';
                setMessages(prev => [...prev, { 
                    role: "assistant", 
                    content: responseMsg, 
                    ...(isBodyMap ? { inputType: 'body_map' } : {}),
                    ...(isSymptomsGate ? {
                        inputType: 'strict_select',
                        options: [
                            { label: '✅ Sí, agregar detalle', value: 'ADD_DETAIL_YES' },
                            { label: '❌ No, continuar', value: 'ADD_DETAIL_NO' }
                        ]
                    } : {})
                }]);
            }
            setStep(nextStep);

            if (nextStep === 'clinica_triage_ai_complete' || nextStep === 'clinica_triage_containment_complete') {
                setTimeout(() => {
                    completePhase3();
                }, 1500);
            }

        }, 600);
    };

    const handleContainmentSequence = (triggerText) => {
        const sensitiveKeywords = ['cancer', 'cáncer', 'tumor', 'falleci', 'muerte', 'matriz', 'duelo', 'luto', 'perdida', 'pérdida'];
        const matchedKw = sensitiveKeywords.find(kw => triggerText.toLowerCase().includes(kw)) || "Tema Sensible";

        updateClinicalContext({
            history: [...(patientData.clinical_context?.history || []), {
                question: "⚠️ Reporte de Sensibilidad",
                answer: `Tema identificado: "${matchedKw.toUpperCase()}". Protocolo de contención activado.`,
                timestamp: new Date().toISOString()
            }]
        });

        const firstName = patientName.split(' ')[0];
        const nameStr = firstName !== "NOM" && firstName !== "Paciente" ? firstName : "";

        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: `${nameStr}, agradezco profundamente su confianza al compartirme algo tan personal.\n\n---\n\nLamento mucho que esté pasando por este proceso de incertidumbre; entiendo que una noticia así genera mucha preocupación.`
            }]);

            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: "He marcado este dato como Prioridad Máxima en su expediente.\n\n---\n\nSu nutriólogo abordará el tema con toda la sensibilidad y el cuidado que usted merece desde el primer minuto de la consulta."
                }]);

                setTimeout(() => {
                    setStep('clinica_triage_containment_complete');
                }, 2000);
            }, 5000);
        }, 1000);
    };

    const handleBodyMapComplete = (payload) => {
        const { zones, intensity } = payload;

        const tagMap = {
            'M_HEAD': 'HEADACHE_RISK', 'M_NECK': 'CERVICAL_RISK', 'M_SHOULDERS': 'JOINT_SHOULDER',
            'M_CHEST': 'CARDIO_RISK', 'M_STOMACH': 'GASTRIC_RISK', 'M_ABDOMEN_LOW': 'INTESTINAL_RISK',
            'M_LOWER_BACK': 'LUMBAR_RISK',
            'M_LUNGS_R': 'RESPIRATORY_RISK', 'M_LUNGS_L': 'RESPIRATORY_RISK',
            'M_KIDNEY_R': 'RENAL_RISK', 'M_KIDNEY_L': 'RENAL_RISK',
            'M_ELBOW_R': 'JOINT_ELBOW', 'M_ELBOW_L': 'JOINT_ELBOW',
            'M_WRIST_R': 'JOINT_WRIST', 'M_WRIST_L': 'JOINT_WRIST',
            'M_HAND_R': 'JOINT_WRIST', 'M_HAND_L': 'JOINT_WRIST',
            'M_KNEE_R': 'JOINT_KNEE', 'M_KNEE_L': 'JOINT_KNEE',
            'M_LEG_R': 'CIRCULATION_RISK', 'M_LEG_L': 'CIRCULATION_RISK',
            'M_ANKLE_R': 'JOINT_ANKLE', 'M_ANKLE_L': 'JOINT_ANKLE',
            'M_FOOT_R': 'JOINT_FOOT', 'M_FOOT_L': 'JOINT_FOOT',
            'F_HEAD': 'HEADACHE_RISK', 'F_NECK': 'CERVICAL_RISK', 'F_UPPER_BACK': 'POSTURAL_RISK',
            'F_STOMACH_UP': 'GASTRIC_RISK', 'F_STOMACH_LOW': 'INTESTINAL_RISK',
            'F_HIPS': 'JOINT_HIP', 'F_LOWER_BACK': 'LUMBAR_RISK',
            'F_LUNG_R': 'RESPIRATORY_RISK', 'F_LUNG_L': 'RESPIRATORY_RISK',
            'F_BREAST_R': 'BREAST_RISK', 'F_BREAST_L': 'BREAST_L',
            'F_OVARY_R': 'GYNECO_RISK', 'F_OVARY_L': 'GYNECO_RISK',
            'F_KIDNEY_R': 'RENAL_RISK', 'F_KIDNEY_L': 'RENAL_RISK',
            'F_HAND_R': 'JOINT_WRIST', 'F_HAND_L': 'JOINT_WRIST',
            'F_KNEE_R': 'JOINT_KNEE', 'F_KNEE_L': 'JOINT_KNEE',
            'F_LEG_R': 'CIRCULATION_RISK', 'F_LEG_L': 'CIRCULATION_RISK',
            'F_FOOT_R': 'JOINT_FOOT', 'F_FOOT_L': 'JOINT_FOOT'
        };

        const zoneLabels = {
            'M_HEAD': 'Cabeza', 
            'F_HEAD': 'Cabeza',
            'M_NECK': 'Cuello', 
            'F_NECK': 'Cuello',
            'M_SHOULDERS': 'Hombros',
            'F_UPPER_BACK': 'Espalda Alta',
            'M_CHEST': 'Pecho',
            'M_LUNGS_R': 'Pulmón Derecho', 
            'M_LUNGS_L': 'Pulmón Izquierdo',
            'F_LUNG_R': 'Pulmón Derecho', 
            'F_LUNG_L': 'Pulmón Izquierdo',
            'F_BREAST_R': 'Seno Derecho', 
            'F_BREAST_L': 'Seno Izquierdo',
            'M_STOMACH': 'Boca del Estómago', 
            'F_STOMACH_UP': 'Boca del Estómago',
            'M_ABDOMEN_LOW': 'Abdomen Bajo', 
            'F_STOMACH_LOW': 'Vientre Bajo',
            'F_OVARY_R': 'Ovario Derecho', 
            'F_OVARY_L': 'Ovario Izquierdo',
            'M_LOWER_BACK': 'Espalda Baja', 
            'F_LOWER_BACK': 'Cintura / Lumbares',
            'F_HIPS': 'Caderas',
            'M_KIDNEY_R': 'Riñón Derecho', 
            'M_KIDNEY_L': 'Riñón Izquierdo',
            'F_KIDNEY_R': 'Riñón Derecho', 
            'F_KIDNEY_L': 'Riñón Izquierdo',
            'M_ELBOW_R': 'Codo Derecho', 
            'M_ELBOW_L': 'Codo Izquierdo',
            'M_WRIST_R': 'Muñeca Derecha', 
            'M_WRIST_L': 'Muñeca Izquierda',
            'M_HAND_R': 'Mano Derecha', 
            'M_HAND_L': 'Mano Izquierda',
            'F_HAND_R': 'Mano Derecha', 
            'F_HAND_L': 'Mano Izquierda',
            'M_KNEE_R': 'Rodilla Derecha', 
            'M_KNEE_L': 'Rodilla Izquierda',
            'F_KNEE_R': 'Rodilla Derecha', 
            'F_KNEE_L': 'Rodilla Izquierda',
            'M_LEG_R': 'Pierna Derecha', 
            'M_LEG_L': 'Pierna Izquierda',
            'F_LEG_R': 'Pierna Derecha', 
            'F_LEG_L': 'Pierna Izquierda',
            'M_ANKLE_R': 'Tobillo Derecho', 
            'M_ANKLE_L': 'Tobillo Izquierdo',
            'M_FOOT_R': 'Pie Derecho', 
            'M_FOOT_L': 'Pie Izquierdo',
            'F_FOOT_R': 'Pie Derecho', 
            'F_FOOT_L': 'Pie Izquierdo'
        };

        const newTags = zones.map(z => tagMap[z] || 'PAIN_GENERAL');
        let isRedFlag = false;

        if (intensity >= 8 && (newTags.includes('CARDIO_RISK') || newTags.includes('GASTRIC_RISK') || newTags.includes('HEADACHE_RISK'))) {
            isRedFlag = true;
            newTags.push('red_flag_symptom');
        }

        updateClinicalContext({
            intensity: intensity,
            pain_zones: zones,
            ai_analysis: {
                ...patientData.clinical_context?.ai_analysis,
                detected_tags: [...(patientData.clinical_context?.ai_analysis?.detected_tags || []), ...newTags]
            }
        });

        const summary = zones.length > 0 ? zones.map(z => zoneLabels[z] || z).join(', ') : "Ninguna";
        setMessages(prev => [...prev, { role: "user", content: `Zonas: ${summary} | Intensidad: ${intensity}/10` }]);

        const alertMsg = "⚠️ **ALERTA DE SEGURIDAD**: He detectado un nivel de dolor severo en una zona sensible.\n\n---\n\n¿Presenta algún otro síntoma, molestia o detalle importante que debamos registrar?";
        const normalMsg = "Entendido.\n\n---\n\n¿Presenta algún otro síntoma, molestia o detalle importante que debamos registrar?";
        
        setMessages(prev => [...prev, { 
            role: "assistant", 
            content: isRedFlag ? alertMsg : normalMsg,
            inputType: 'strict_select',
            options: [
                { label: '✅ Sí, agregar detalle', value: 'ADD_DETAIL_YES' },
                { label: '❌ No, continuar', value: 'ADD_DETAIL_NO' }
            ]
        }]);
        setStep('clinica_triage_symptoms_gate');
    };

    const handleSendRef = useRef(handleSend);
    useEffect(() => {
        handleSendRef.current = handleSend;
    });

    useEffect(() => {
        if (onStepChange) {
            onStepChange(step);
        }
    }, [step, onStepChange]);

    // Register handler and typing state with parent ChatView
    useEffect(() => {
        if (registerInputHandler) {
            if (step === 'clinica_body_map') {
                registerInputHandler(() => (payload, type) => handleBodyMapComplete(payload));
            } else {
                registerInputHandler(() => (text, val) => {
                    const directVal = (val === 'button' || val === 'text') ? null : val;
                    handleSendRef.current(text, directVal, val);
                });
            }
        }
    }, [registerInputHandler, step]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(isTyping);
        }
    }, [isTyping, setIsGlobalTyping]);

    return null;
};

export default Fase3_MotivoConsulta;
