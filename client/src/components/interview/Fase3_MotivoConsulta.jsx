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

const Fase3_MotivoConsulta = ({ messages, setMessages, onPhaseComplete, patientData, setPatientData }) => {
    const chatEndRef = useRef(null);
    const identityLock = useClinicalGenome(state => state.identityLock);
    const { patientAge: age, patientSex: gender, patientName } = usePatientLinguistics(patientData);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
            if (context.secondary_symptoms || context.sintomas) {
                if (context.pain_zones && context.pain_zones.length > 0) {
                    return 'clinica_triage_ai_complete';
                }
                return 'clinica_body_map';
            }
            return 'clinica_triage_symptoms';
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
                        content: welcomeMsg
                    }
                ]);
            }, 1000);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, patientData]);

    const completePhase3 = () => {
        const phase3Data = {
            primaryRoute: patientData.clinical_context?.goal || patientData.clinical_context?.ai_analysis?.primaryRoute || 'No especificado',
            gem_reasoning: patientData.clinical_context?.ai_analysis?.gem_reasoning || '',
            secondaryRoutes: []
        };
        onPhaseComplete(phase3Data);
    };

    const handleSend = (text, directValue = null) => {
        const textToDisplay = typeof text === 'string' ? text : (inputValue || "");
        const valueToProcess = directValue !== null ? directValue : textToDisplay;
        
        if (!textToDisplay?.trim() && step !== 'clinica_body_map') return;

        setInputValue("");
        if (valueToProcess !== 'BODY_MAP_COMPLETE') {
            if (step !== 'clinica_triage_start') {
                setMessages(prev => [...prev, { role: "user", content: formatText(textToDisplay) }]);
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
                    const selectedOpt = motiveOptions.find(o => o.value === userMsg);
                    
                    if (selectedOpt) {
                        const label = selectedOpt.label;
                        const config = goalMap[userMsg] || { avatar: 'METABOLIC', risk: 'LOW' };

                        setMessages(prev => [...prev, { role: "user", content: label }]);

                        updateClinicalContext({
                            primary_motive: label,
                            goal: userMsg,
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

                        responseMsg = `Entendido. Hemos activado la ruta clínica de **${label}**.\n\nAhora, por favor descríbame a detalle qué síntomas o molestias específicas ha presentado relacionados a este motivo:`;
                        nextStep = 'clinica_triage_symptoms';
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
                                 ai_analysis: {
                                     ...(patientData.clinical_context?.ai_analysis || {}),
                                     gem_reasoning: aiResult.reasoning,
                                     primaryRoute: aiResult.primaryRoute,
                                     secondaryRoute: aiResult.secondaryRoute,
                                     redFlag: aiResult.redFlag
                                 }
                             });
                             
                             let finalResponse = aiResult.patientMessage;
                             if (aiResult.redFlag) {
                                 finalResponse += "\n\n⚠️ **Protocolo de Derivación Activo por Alerta Clínica (Red Flag).**";
                             }
                             finalResponse += "\n\nAhora, por favor descríbame a detalle qué síntomas o molestias específicas ha presentado relacionados a este motivo:";

                             setMessages(prev => [...prev, { role: "assistant", content: finalResponse }]);
                             
                             setStep('clinica_triage_symptoms');
                        });
                        return;
                    }
                    break;
                }

                case 'clinica_body_map': {
                    if (userMsg === 'BODY_MAP_COMPLETE') {
                        responseMsg = "Entendido. ¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?";
                        nextStep = 'clinica_triage_symptoms';
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
                        responseMsg = "Entiendo la importancia de lo que menciona. Para poder apoyarle mejor, ¿le gustaría compartir un poco más sobre este diagnóstico o prefiere que lo abordemos con detalle directamente en la consulta?";
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
                                     redFlag: aiResult.redFlag
                                 }
                             });
                             
                             const bentoMsg = { 
                                 role: "assistant", 
                                 content: aiResult.redFlag ? `⚠️ ${aiResult.patientMessage}\n\nActivando protocolo de derivación y evaluación médica prioritaria.` : `✅ ${aiResult.patientMessage}`, 
                                 isAiAnalysisResult: true, 
                                 aiData: aiResult 
                             };
                             const reviewMsg = {
                                 role: "assistant",
                                 content: "¿Es correcta esta información o desea agregar algo más antes de continuar con su historial clínico?",
                                 options: [
                                     { label: "Sí, todo es correcto", value: "CONFIRM_DATA" },
                                     { label: "Quiero agregar algo", value: "CORRECT_DATA" }
                                 ]
                             };

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
                                 redFlag: aiResult.redFlag
                             }
                         });
                         
                         const bentoMsg = { 
                             role: "assistant", 
                             content: `✅ ${aiResult.patientMessage}`, 
                             isAiAnalysisResult: true, 
                             aiData: aiResult 
                         };
                         const reviewMsg = {
                             role: "assistant",
                             content: "¿Es correcta esta información o desea agregar algo más antes de continuar con su historial clínico?",
                             options: [
                                 { label: "Sí, todo es correcto", value: "CONFIRM_DATA" },
                                 { label: "Quiero agregar algo", value: "CORRECT_DATA" }
                             ]
                         };

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
                    if (userMsg === 'CONFIRM_DATA') {
                        responseMsg = "Excelente. Transfiriendo su información al historial clínico...";
                        nextStep = 'clinica_triage_ai_complete';
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
                setMessages(prev => [...prev, { role: "assistant", content: responseMsg }]);
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
                content: `${nameStr}, agradezco profundamente su confianza al compartirme algo tan personal. Lamento mucho que esté pasando por este proceso de incertidumbre; entiendo que una noticia así genera mucha preocupación.`
            }]);

            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: "He marcado este dato como Prioridad Máxima en su expediente. Su nutriólogo abordará el tema con toda la sensibilidad y el cuidado que usted merece desde el primer minuto de la consulta."
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
            'M_HEAD': 'Cabeza', 'F_HEAD': 'Cabeza',
            'M_LUNGS_R': 'Pulmón Derecho', 'M_LUNGS_L': 'Pulmón Izquierdo',
            'F_LUNG_R': 'Pulmón Derecho', 'F_LUNG_L': 'Pulmón Izquierdo',
            'F_BREAST_R': 'Seno Derecho', 'F_BREAST_L': 'Seno Izquierdo',
            'F_OVARY_R': 'Ovario Derecho', 'F_OVARY_L': 'Ovario Izquierdo',
            'F_KIDNEY_R': 'Riñón Derecho', 'F_KIDNEY_L': 'Riñón Izquierdo',
            'M_KIDNEY_R': 'Riñón Derecho', 'M_KIDNEY_L': 'Riñón Izquierdo'
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

        if (isRedFlag) {
            setMessages(prev => [...prev, { role: "assistant", content: "⚠️ **ALERTA DE SEGURIDAD**: He detectado un nivel de dolor severo en una zona sensible. \n\n¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?" }]);
            setStep('clinica_triage_symptoms');
        } else {
            setMessages(prev => [...prev, { role: "assistant", content: "Entendido. ¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?" }]);
            setStep('clinica_triage_symptoms');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="flex-1 overflow-y-auto w-full px-4 md:px-12 py-8 relative custom-scrollbar">
                <div className="max-w-2xl mx-auto space-y-6 pb-32">
                    {messages && messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'} mb-6 items-start gap-3 animate-fade-in-up`}>
                            {msg.role === "assistant" && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-12 h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden"
                                >
                                    <img src={tiloImg} alt="Tilo" className="w-10 h-10 object-contain" />
                                </motion.div>
                            )}
                            <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${msg.role === 'assistant'
                                ? msg.isBio
                                    ? 'bg-purple-50 border-l-4 border-purple-500 text-purple-900 rounded-tl-none font-medium'
                                    : msg.isAcute
                                        ? 'bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-tl-none font-medium'
                                        : msg.isCritical
                                            ? 'bg-red-50 border-l-4 border-red-500 text-red-900 rounded-tl-none font-bold'
                                            : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                                : 'bg-indigo-600 text-white rounded-tr-none'
                                }`}>
                                <div className={`prose prose-sm max-w-none ${msg.role === "assistant" ? "prose-slate" : "prose-invert"}`}>
                                    {msg.isAiAnalysisResult ? (
                                        <div className="flex flex-col gap-3">
                                            {/* Attributes List Container */}
                                            <div className="flex flex-col gap-2 mb-3 w-full">
                                                <div className="px-4 py-2.5 bg-slate-50/80 backdrop-blur-sm border border-slate-200/50 rounded-xl text-sm font-semibold text-slate-700 shadow-sm flex items-center gap-3">
                                                    <span className="text-xl">👤</span> 
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Perfil</span>
                                                        <span>{age < 18 ? `Pediátrico (${age} años)` : `Adulto (${age} años)`}</span>
                                                    </div>
                                                </div>
                                                <div className="px-4 py-2.5 bg-blue-50/80 backdrop-blur-sm border border-blue-100 rounded-xl text-sm font-semibold text-blue-700 shadow-sm flex items-center gap-3">
                                                    <span className="text-xl">🎯</span> 
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Eje Clínico</span>
                                                        <span>{routeToSpanish(msg.aiData?.primaryRoute || patientData.clinical_context?.goal || "Análisis Clínico")}</span>
                                                    </div>
                                                </div>
                                                <div className={`px-4 py-2.5 backdrop-blur-sm border rounded-xl text-sm font-semibold shadow-sm flex items-center gap-3 ${
                                                    msg.aiData?.redFlag ? 'bg-red-50/90 border-red-200 text-red-700' : 
                                                    (msg.aiData?.risk_level === 'HIGH' ? 'bg-amber-50/90 border-amber-200 text-amber-700' : 'bg-emerald-50/90 border-emerald-200 text-emerald-700')
                                                }`}>
                                                    <span className="text-xl">⚠️</span> 
                                                    <div className="flex flex-col">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                            msg.aiData?.redFlag ? 'text-red-400' : 
                                                            (msg.aiData?.risk_level === 'HIGH' ? 'text-amber-400' : 'text-emerald-500')
                                                        }`}>Nivel de Riesgo</span>
                                                        <span>{msg.aiData?.redFlag ? 'Crítico (Red Flag)' : riskToSpanish(msg.aiData?.risk_level || 'Base')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Main Suspicion */}
                                            <div className="text-sm text-slate-700">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>

                                            {/* Technical Detail (Glassmorphism Bento) */}
                                            {msg.aiData?.reasoning && (
                                                <div className="mt-2 p-3 bg-slate-50/40 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] relative overflow-hidden group">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-purple-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                                    <details className="relative z-10 group/details">
                                                        <summary className="text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors list-none flex items-center gap-2">
                                                            <svg className="w-3 h-3 text-slate-400 group-open/details:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                            Deducción Sugerida (Matriz IFM)
                                                        </summary>
                                                        <div className="mt-2 text-xs text-slate-600 leading-relaxed border-l-2 border-slate-200/80 pl-3 ml-1 bg-white/50 p-2 rounded-r-lg">
                                                            <ReactMarkdown>{msg.aiData.reasoning}</ReactMarkdown>
                                                        </div>
                                                    </details>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start animate-fade-in mb-4">
                            <div className="bg-gray-100 p-4 rounded-xl rounded-bl-none border border-gray-200 shadow-sm">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* Input Form */}
            <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-4 py-4 md:px-12 backdrop-blur-md bg-opacity-90">
                <div className="max-w-2xl mx-auto flex flex-col gap-3 relative">
                    
                    {step === 'clinica_triage_start' && !isTyping && (
                        <div className="w-full relative animate-in fade-in zoom-in duration-300">
                            {filteredMotiveOptions.length <= 3 ? (
                                <div className="flex flex-wrap gap-2 justify-center mb-2">
                                    {filteredMotiveOptions.map(opt => (
                                        <button 
                                            key={opt.value}
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); handleSend(opt.label, opt.value); }}
                                            className="px-5 py-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white text-sm font-medium rounded-full transition-colors shadow-sm"
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="relative w-full mb-2 z-50">
                                    <SearchableVerticalMenu 
                                        options={filteredMotiveOptions} 
                                        onSelect={(val) => {
                                            const opt = filteredMotiveOptions.find(o => o.value === val);
                                            handleSend(opt ? opt.label : val, val);
                                        }}
                                        embedded={true}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'clinica_body_map' && !isTyping && (
                        <div className="flex justify-center w-full mb-4">
                            <div className="bg-gray-50 border border-gray-200 p-2 sm:p-4 rounded-xl w-full shadow-sm flex justify-center">
                                <VisualBodyMap
                                    gender={gender}
                                    onComplete={handleBodyMapComplete}
                                />
                            </div>
                        </div>
                    )}

                    {messages[messages.length - 1]?.options?.length > 0 && !isTyping && step !== 'clinica_triage_ai_complete' && step !== 'clinica_triage_containment_complete' && (
                        <div className="flex flex-col gap-2 mb-3 w-full">
                            {messages[messages.length - 1].options.map((opt, oIdx) => (
                                <button
                                    key={oIdx}
                                    onClick={(e) => { e.preventDefault(); handleSend(opt.label, opt.value); }}
                                    className="w-full px-5 py-3 bg-white border-2 border-blue-100 text-slate-700 text-sm font-medium rounded-xl hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all flex items-center justify-between group"
                                    disabled={isTyping || step === 'clinica_triage_ai_complete'}
                                >
                                    <span>{opt.label}</span>
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0 ml-3">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {(!messages[messages.length - 1]?.options || messages[messages.length - 1]?.options?.length === 0) && step !== 'clinica_triage_ai_complete' && step !== 'clinica_triage_containment_complete' && (
                        <div className="w-full flex gap-3 relative">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && inputValue.trim() && !isTyping && step !== 'clinica_body_map' && step !== 'clinica_triage_containment' && step !== 'clinica_triage_ai_analysis') {
                                        handleSend(inputValue);
                                    }
                                }}
                                placeholder={step === 'clinica_body_map' ? "Seleccione una opción..." : (step === 'clinica_triage_start' ? "Seleccione o escriba su motivo libremente..." : "Escriba aquí...")}
                                className="flex-1 px-5 py-4 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1C75BC] focus:bg-white transition-all font-sansation text-slate-700 shadow-sm disabled:opacity-50 disabled:bg-gray-100"
                                disabled={isTyping || step === 'clinica_body_map' || step === 'clinica_triage_containment' || step === 'clinica_triage_ai_analysis'}
                            />
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); handleSend(inputValue); }}
                                disabled={!inputValue.trim() || isTyping || step === 'clinica_body_map' || step === 'clinica_triage_containment' || step === 'clinica_triage_ai_analysis'}
                                className="px-6 py-4 bg-[#1C75BC] text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center min-w-[60px]"
                            >
                                <i className="fi fi-rr-paper-plane text-xl"></i>
                            </button>
                        </div>
                    )}

                    <div className="text-center mt-3 text-xs text-gray-400 font-sansation flex items-center justify-center gap-2">
                        <i className="fi fi-rr-shield-check"></i>
                        Terminal A - Comunicación Clínica Encriptada Extremo a Extremo
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Fase3_MotivoConsulta;
