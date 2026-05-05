import React, { useState, useEffect, useRef } from 'react';
import { formatText } from '../../utils/utils';
import VisualBodyMap from '../VisualBodyMap';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';
import { Send } from 'lucide-react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { analyzeClinicalMotive } from '../../hooks/useCortex';

const motiveOptions = [
    // A. Control Metab├│lico y Estilo de Vida
    { label: "Bajar de Peso / Sobrepeso", value: "GOAL_WEIGHT_LOSS" },
    { label: "Control Cl├¡nico (Patolog├¡as Cr├│nicas)", value: "GOAL_CLINICAL" },
    { label: "Ganar M├║sculo / Deporte (Rendimiento)", value: "GOAL_MUSCLE" },
    { label: "Prevenci├│n y Longevidad (Biohacking)", value: "GOAL_LONGEVITY" },
    // B. Etapa de Vida y Condici├│n Fisiol├│gica
    { label: "Pediatr├¡a (Crecimiento y Desarrollo)", value: "GOAL_PEDIATRICS" },
    { label: "Embarazo y Lactancia", value: "GOAL_PREGNANCY" },
    { label: "Adulto Mayor (Geriatr├¡a)", value: "GOAL_GERIATRICS" },
    { label: "Climaterio y Menopausia", value: "GOAL_MENOPAUSE" },
    // C. Alta Especialidad y Riesgo Cl├¡nico
    { label: "Salud Mental / TCA (Seguridad Conductual)", value: "GOAL_MENTAL_HEALTH" },
    { label: "Bari├ítrica / Quir├║rgico", value: "GOAL_BARIATRIC" },
    { label: "Salud Renal (Nefropat├¡a)", value: "GOAL_RENAL" },
    { label: "Oncolog├¡a Nutricional", value: "GOAL_ONCOLOGY" },
    { label: "VIH e Inmunodeficiencias", value: "GOAL_IMMUNE" },
    { label: "Cuidados Paliativos", value: "GOAL_PALLIATIVE" },
    // D. Seguridad y Accesibilidad
    { label: "Alergias Graves (Protocolo Anafilaxia)", value: "GOAL_ALLERGIES" },
    { label: "Adicciones y Sustancias", value: "GOAL_ADDICTIONS" },
    { label: "Discapacidad y Rehabilitaci├│n", value: "GOAL_DISABILITY" }
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

const Fase3_MotivoConsulta = ({ setMessages, onPhaseComplete, patientData, setPatientData }) => {
    const identityLock = useClinicalGenome(state => state.identityLock);
    const { patientAge: age, patientSex: gender, patientName, placeholder: dynamicPlaceholder } = usePatientLinguistics(patientData);

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
                return { ...opt, label: "Inmunolog├¡a Pedi├ítrica" };
            }
            return opt;
        });
    };

    const [inputValue, setInputValue] = useState("");
    const [step, setStep] = useState('clinica_triage_start');
    const [isTyping, setIsTyping] = useState(false);

    const hasStarted = useRef(false);
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
                    ? `Para dise├▒ar el plan cl├¡nico de **${cleanName}**, por favor seleccione la **Ruta Primaria** o Motivo de Consulta principal:`
                    : "Para comenzar a dise├▒ar su plan cl├¡nico de precisi├│n, por favor seleccione su **Ruta Primaria** o Motivo de Consulta principal:";

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
            primaryRoute: patientData.clinical_context?.goal || 'No especificado',
            secondaryRoutes: []
        };
        onPhaseComplete(phase3Data);
    };

    const handleSend = (value) => {
        const textToProcess = typeof value === 'string' ? value : (inputValue || "");
        
        if (!textToProcess?.trim() && step !== 'clinica_body_map') return;

        setInputValue("");
        if (textToProcess !== 'BODY_MAP_COMPLETE') {
            if (step !== 'clinica_triage_start') {
                setMessages(prev => [...prev, { role: "user", content: formatText(textToProcess) }]);
            }
        }

        setIsTyping(true);

        setTimeout(() => {
            setIsTyping(false);
            const userMsg = textToProcess;
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

                        const SKIP_BODY_MAP_GOALS = [
                            'GOAL_PEDIATRICS',
                            'GOAL_WEIGHT_LOSS',
                            'GOAL_MUSCLE',
                            'GOAL_LONGEVITY',
                            'GOAL_MENTAL_HEALTH',
                            'GOAL_ADDICTIONS',
                            'GOAL_ALLERGIES',
                            'GOAL_PREGNANCY'
                        ];

                        if (SKIP_BODY_MAP_GOALS.includes(userMsg)) {
                            responseMsg = `Entendido. Hemos activado la ruta cl├¡nica de **${label}**.\n\n┬┐Podr├¡a describir brevemente cualquier s├¡ntoma o detalle importante que debamos considerar para la consulta?`;
                            nextStep = 'clinica_triage_symptoms';
                        } else {
                            responseMsg = `Entendido. Hemos activado la ruta cl├¡nica de **${label}**.\n\nPara ser m├ís precisos, por favor **indique en el mapa** d├│nde siente mayor molestia o si hay zonas espec├¡ficas a tratar. Haga clic en *Completar Mapa* cuando termine.`;
                            nextStep = 'clinica_body_map';
                        }
                    } else {
                        // Entrada de texto libre (Bypass GEM)
                        const cleanText = formatText(userMsg);
                        
                        updateClinicalContext({
                            primary_motive: "Inferencia Sem├íntica GEM",
                            secondary_symptoms: cleanText,
                            history: [...(patientData.clinical_context?.history || []), {
                                question: "Motivo de Consulta (Texto Libre)",
                                answer: cleanText,
                                timestamp: new Date().toISOString()
                            }]
                        });

                        const highSeverityKeywords = ['cancer', 'c├íncer', 'matriz', 'amputa', 'duelo', 'falleci', 'muerte', 'perd├¡', 'tumor', 'maligno', 'quimio'];
                        const isHighSeverity = highSeverityKeywords.some(kw => cleanText.toLowerCase().includes(kw));

                        if (isHighSeverity) {
                            nextStep = 'clinica_triage_containment'; 
                            setTimeout(() => handleContainmentSequence(cleanText), 100);
                            return; 
                        }

                        // AI Semantic Triage (GEM Integration)
                        setStep('clinica_triage_ai_analysis');
                        setMessages(prev => [...prev, { role: "assistant", content: "T.I.L.O. est├í procesando tus biosensores y realizando el cruce forense de tu motivo de consulta..." }]);
                        
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
                             
                             let finalResponse = aiResult.reasoning;
                             if (aiResult.redFlag) {
                                 finalResponse += "\n\nÔÜá´©Å **Protocolo de Derivaci├│n Activo por Alerta Cl├¡nica (Red Flag).**";
                             }

                             setMessages(prev => [...prev, { role: "assistant", content: finalResponse }]);
                             
                             setStep('clinica_triage_ai_complete');
                        });
                        return;
                    }
                    break;
                }

                case 'clinica_body_map': {
                    if (userMsg === 'BODY_MAP_COMPLETE') {
                        responseMsg = "Entendido. ┬┐Podr├¡a describir brevemente cualquier otro s├¡ntoma o detalle importante que no aparezca en el mapa?";
                        nextStep = 'clinica_triage_symptoms';
                    }
                    break;
                }

                case 'clinica_triage_symptoms': {
                    const symptomsInput = cleanText;

                    updateClinicalContext({
                        secondary_symptoms: (patientData.clinical_context?.secondary_symptoms || "") + symptomsInput,
                        history: [...(patientData.clinical_context?.history || []), {
                            question: "Sintomatolog├¡a Adicional",
                            answer: symptomsInput,
                            timestamp: new Date().toISOString()
                        }]
                    });

                    const highSeverityKeywords = ['cancer', 'c├íncer', 'matriz', 'amputa', 'duelo', 'falleci', 'muerte', 'perd├¡', 'tumor', 'maligno', 'quimio'];
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
                        responseMsg = "Entiendo la importancia de lo que menciona. Para poder apoyarle mejor, ┬┐le gustar├¡a compartir un poco m├ís sobre este diagn├│stico o prefiere que lo abordemos con detalle directamente en la consulta?";
                        nextStep = 'clinica_triage_sensitive_followup';
                    } else if (isSurgery) {
                        responseMsg = "Entendido. Dado que menciona un procedimiento quir├║rgico, ┬┐hace cu├ínto tiempo fue o cu├índo est├í programado?";
                        nextStep = 'intro_triage_surgery';
                    } else {
                        // AI Semantic Triage (GEM Integration)
                        setStep('clinica_triage_ai_analysis');
                        setMessages(prev => [...prev, { role: "assistant", content: "T.I.L.O. est├í procesando tus biosensores y evaluaci├│n cl├¡nica..." }]);
                        
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
                             
                             if (aiResult.redFlag) {
                                 setMessages(prev => [...prev, { role: "assistant", content: `ÔÜá´©Å ${aiResult.reasoning}\n\nActivando protocolo de derivaci├│n y evaluaci├│n m├®dica prioritaria.` }]);
                             } else {
                                 setMessages(prev => [...prev, { role: "assistant", content: `Ô£à ${aiResult.reasoning}` }]);
                             }
                             setStep('clinica_triage_ai_complete');
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
                    setMessages(prev => [...prev, { role: "assistant", content: "T.I.L.O. est├í integrando estos detalles sensibles en su matriz de evaluaci├│n..." }]);
                    
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
                         
                         setMessages(prev => [...prev, { role: "assistant", content: `Ô£à ${aiResult.reasoning}` }]);
                         setStep('clinica_triage_ai_complete');
                    });
                    return;
                }

                case 'intro_triage_surgery': {
                    const lowerMsg = userMsg.toLowerCase();
                    let status = "NONE";
                    let msg = "";

                    if (lowerMsg.includes('pre') || lowerMsg.includes('prepara') || lowerMsg.includes('antes') || lowerMsg.includes('programada')) {
                        status = "PRE";
                        msg = "ÔÜá´©Å ALERTA: Suspender suplementos anticoagulantes (Ajo, Omega-3, Ginkgo) 7 d├¡as antes.";
                    } else if (lowerMsg.includes('ya') || lowerMsg.includes('post') || lowerMsg.includes('pas├│') || lowerMsg.includes('paso')) {
                        status = "POST";
                        msg = "ÔÜá´©Å ALERTA: Validar alta m├®dica antes de iniciar esfuerzo f├¡sico.";
                    }

                    updateClinicalContext({
                        history: [...(patientData.clinical_context?.history || []), {
                            question: "Estatus Quir├║rgico",
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

        }, 600);
    };

    const handleContainmentSequence = (triggerText) => {
        const sensitiveKeywords = ['cancer', 'c├íncer', 'tumor', 'falleci', 'muerte', 'matriz', 'duelo', 'luto', 'perdida', 'p├®rdida'];
        const matchedKw = sensitiveKeywords.find(kw => triggerText.toLowerCase().includes(kw)) || "Tema Sensible";

        updateClinicalContext({
            history: [...(patientData.clinical_context?.history || []), {
                question: "ÔÜá´©Å Reporte de Sensibilidad",
                answer: `Tema identificado: "${matchedKw.toUpperCase()}". Protocolo de contenci├│n activado.`,
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
                content: `${nameStr}, agradezco profundamente su confianza al compartirme algo tan personal. Lamento mucho que est├® pasando por este proceso de incertidumbre; entiendo que una noticia as├¡ genera mucha preocupaci├│n.`
            }]);

            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: "He marcado este dato como Prioridad M├íxima en su expediente. Su nutri├│logo abordar├í el tema con toda la sensibilidad y el cuidado que usted merece desde el primer minuto de la consulta."
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
            'M_LUNGS_R': 'Pulm├│n Derecho', 'M_LUNGS_L': 'Pulm├│n Izquierdo',
            'F_LUNG_R': 'Pulm├│n Derecho', 'F_LUNG_L': 'Pulm├│n Izquierdo',
            'F_BREAST_R': 'Seno Derecho', 'F_BREAST_L': 'Seno Izquierdo',
            'F_OVARY_R': 'Ovario Derecho', 'F_OVARY_L': 'Ovario Izquierdo',
            'F_KIDNEY_R': 'Ri├▒├│n Derecho', 'F_KIDNEY_L': 'Ri├▒├│n Izquierdo',
            'M_KIDNEY_R': 'Ri├▒├│n Derecho', 'M_KIDNEY_L': 'Ri├▒├│n Izquierdo'
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
            setMessages(prev => [...prev, { role: "assistant", content: "ÔÜá´©Å **ALERTA DE SEGURIDAD**: He detectado un nivel de dolor severo en una zona sensible. \n\n┬┐Podr├¡a describir brevemente cualquier otro s├¡ntoma o detalle importante que no aparezca en el mapa?" }]);
            setStep('clinica_triage_symptoms');
        } else {
            setMessages(prev => [...prev, { role: "assistant", content: "Entendido. ┬┐Podr├¡a describir brevemente cualquier otro s├¡ntoma o detalle importante que no aparezca en el mapa?" }]);
            setStep('clinica_triage_symptoms');
        }
    };

    return (
        <div className="p-4 flex flex-col justify-end w-full relative shrink-0">
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

            <div className="max-w-3xl mx-auto w-full flex flex-col items-center gap-2">
                
                {step === 'clinica_triage_start' && !isTyping && (
                    <div className="w-full relative px-2 mb-2 animate-in fade-in zoom-in duration-300">
                        <SearchableVerticalMenu 
                            options={filteredMotiveOptions} 
                            onSelect={(val) => handleSend(val)}
                            embedded={true}
                        />
                    </div>
                )}

                {step === 'clinica_body_map' && !isTyping && (
                    <div className="flex justify-center w-full max-w-[500px] mb-4">
                        <div className="bg-gray-50 border border-gray-200 p-2 sm:p-4 rounded-xl w-full shadow-sm flex justify-center">
                            <VisualBodyMap
                                gender={gender}
                                onComplete={handleBodyMapComplete}
                            />
                        </div>
                    </div>
                )}

                {(step === 'clinica_triage_ai_complete' || step === 'clinica_triage_containment_complete') && !isTyping && (
                    <div className="w-full relative px-2 mb-2 animate-in fade-in zoom-in duration-300 flex justify-end">
                        <button
                            onClick={(e) => { e.preventDefault(); handleSend(); }}
                            className="px-6 py-3 bg-tilo-primary text-white rounded-2xl font-medium shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                        >
                            Continuar a Historial Cl├¡nico <Send className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="relative flex items-center gap-2 bg-tilo-bg-base border border-tilo-border rounded-full px-2 py-2 shadow-inner focus-within:ring-2 focus-within:ring-tilo-primary transition-all w-full">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={step === 'clinica_body_map' ? "Seleccione una opci├│n..." : (step === 'clinica_triage_start' ? "Seleccione o escriba su s├¡ntoma libremente..." : dynamicPlaceholder)}
                        className="flex-1 bg-transparent outline-none text-tilo-text-main placeholder:text-tilo-text-muted text-sm h-10 px-4"
                        disabled={isTyping || step === 'clinica_body_map' || step === 'clinica_triage_containment' || step === 'clinica_triage_ai_analysis' || step === 'clinica_triage_ai_complete' || step === 'clinica_triage_containment_complete'}
                    />
                    <button
                        onClick={(e) => { e.preventDefault(); handleSend(); }}
                        disabled={!inputValue.trim() || isTyping || step === 'clinica_body_map' || step === 'clinica_triage_containment' || step === 'clinica_triage_ai_analysis' || step === 'clinica_triage_ai_complete' || step === 'clinica_triage_containment_complete'}
                        className="bg-tilo-primary hover:bg-blue-700 text-white p-2 rounded-full transition-colors flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-10 h-10"
                    >
                        <Send size={18} className="ml-[2px]" />
                    </button>
                </div>

                <div className="text-center mt-2 text-xs text-tilo-text-muted font-sansation flex items-center justify-center gap-2">
                    <i className="fi fi-rr-shield-check"></i>
                    Terminal A - Comunicaci├│n Cl├¡nica Encriptada Extremo a Extremo
                </div>
            </div>
        </div>
    );
};

export default Fase3_MotivoConsulta;
