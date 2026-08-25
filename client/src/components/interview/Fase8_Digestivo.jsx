import React, { useState, useEffect, useRef } from 'react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

const symptomOptions = [
    { label: "Colitis / Inflamación", value: "Colitis / Inflamación" },
    { label: "Diarrea", value: "Diarrea" },
    { label: "Estreñimiento", value: "Estreñimiento" },
    { label: "Gastritis / Acidez", value: "Gastritis / Acidez" },
    { label: "Reflujo", value: "Reflujo" }
];

export default function Fase8_SaludDigestiva({ patientData, setPatientData, onPhaseComplete, registerInputHandler, messages, setMessages, setIsGlobalTyping, onStateChange }) {
    const { patientName: pName, isMinor, isLactante, isPediatrico, isGeriatric, patientGender } = usePatientLinguistics(patientData);

    const [step, setStep] = useState(() => {
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && msg.content.includes("salud digestiva en nuestro núcleo de datos"));
        const hasSymptoms = patientData.history?.digestive_symptoms && patientData.history.digestive_symptoms.length > 0;
        const hasFrequency = patientData.history?.digestive_frequency && patientData.history.digestive_frequency !== "Ninguna";
        if (hasSummary || hasSymptoms || hasFrequency) {
            return 'correct_menu';
        }
        return 'digestive_gate';
    });
    const hasGreeted = useRef(false);

    useEffect(() => {
        if (hasGreeted.current) return;

        if (step === 'correct_menu') {
            hasGreeted.current = true;
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de salud digestiva?",
                    options: [
                        { label: "✏️ Modificar síntomas digestivos", value: "MODIFY_SYMPTOMS" },
                        { label: "✏️ Cambiar frecuencia de molestias", value: "MODIFY_FREQUENCY" },
                        { label: "🔄 Limpiar historial digestivo", value: "CLEAR_ALL" },
                        { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                    ]
                }
            ]);
            return;
        }

        const alreadyGreeted = (messages || []).some(msg => msg.role === 'assistant' && msg.content.includes("salud digestiva"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;
            const initialMsg = isLactante
                ? `He registrado y sellado el perfil de sensibilidades inmunológicas de **${pName}** (su bebé).\n\nPara evaluar los **Desencadenantes de Disbiosis e Inmunidad Mucosa** (ATM 3): ¿Ha presentado **${pName}** alguno de los siguientes antecedentes o molestias recurrentes?`
                : (isMinor
                    ? `He registrado y sellado el perfil de sensibilidades inmunológicas de **${pName}** de manera exitosa.\n\nPasemos a la salud digestiva. En los últimos 30 días, ¿ha padecido **${pName}** inflamación, gases, acidez, o estreñimiento recurrente?`
                    : "He registrado y sellado su perfil de sensibilidades inmunológicas de manera exitosa.\n\nPasemos a su salud digestiva. En los últimos 30 días, ¿ha padecido inflamación, gases, acidez, o estreñimiento recurrente?");
            
            const initialOptions = isLactante
                ? [
                    { label: "🟢 Sin molestias / Microbioma estable", value: "ATM_DIGEST_STABLE" },
                    { label: "💊 Exposición a Antibióticos en primeros meses", value: "ATM_DIGEST_ANTIBIOTICS" },
                    { label: "🟡 Cólicos del Lactante / Llanto vespertino", value: "ATM_DIGEST_COLIC" },
                    { label: "🔴 Reflujo / Regurgitación constante", value: "ATM_DIGEST_REFLUX" },
                    { label: "🌸 Eczema / Dermatitis atópica en piel", value: "ATM_DIGEST_ECZEMA" }
                ]
                : [
                    { label: "✅ Sí", value: "Sí" },
                    { label: "❌ No", value: "No" },
                ];

            setMessages(prev => [
                ...prev,
                { 
                    role: 'assistant', 
                    content: initialMsg,
                    options: initialOptions
                }
            ]);
        }
    }, [messages, isMinor, isLactante, pName, setMessages, step]);

    // Middleware de enrutamiento: Registro del callback constructor para evitar la ejecución prematura en App.jsx
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => processStep);
        }
        return () => {
            if (registerInputHandler) registerInputHandler(null);
        };
    }, [step, registerInputHandler]);

    const processStep = async (input, label = null) => {
        let userText = (label && label !== 'text' && label !== 'select' && label !== 'number' && label !== 'tel' && label !== 'button') ? label : input;
        
        if (input === "MODIFY_SYMPTOMS") userText = "✏️ Modificar síntomas digestivos";
        if (input === "MODIFY_FREQUENCY") userText = "✏️ Cambiar frecuencia de molestias";
        if (input === "CLEAR_ALL") userText = "🔄 Limpiar historial digestivo";
        if (input === "FINISH") userText = "❌ Cancelar (Volver al resumen)";

        if (label !== 'button') {
            setMessages(prev => [...prev, { role: 'user', content: userText }]);
        }
        
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        switch (step) {
            case 'correct_menu': {
                if (input === "MODIFY_SYMPTOMS") {
                    const contentMsg = isMinor
                        ? `He habilitado el panel de evaluación de la salud gástrica e intestinal de **${pName}**.\n\nPara determinar el grado de inflamación, ¿cuáles de los siguientes síntomas presenta con mayor frecuencia? (Puede elegir varios).`
                        : "He habilitado el panel de evaluación de su salud gástrica e intestinal.\n\nPara determinar el grado de inflamación, ¿cuáles de los siguientes síntomas presenta con mayor frecuencia? (Puede elegir varios).";
                    
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: contentMsg,
                        options: symptomOptions,
                        isMultiSelect: true
                    }]);
                    setStep('digestive_symptoms');
                } else if (input === "MODIFY_FREQUENCY") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Para evaluar la cronicidad del cuadro, ¿con qué frecuencia presenta estas molestias?",
                        options: [
                            { label: "2 a 3 veces por semana", value: "2 a 3 veces por semana" },
                            { label: "Diario", value: "Diario" },
                            { label: "Rara vez", value: "Rara vez" }
                        ]
                    }]);
                    setStep('digestive_freq');
                } else if (input === "CLEAR_ALL") {
                    const updatedData = {
                        ...patientData,
                        history: {
                            ...(patientData.history || {}),
                            digestive_symptoms: [],
                            digestive_frequency: "Ninguna"
                        }
                    };
                    setPatientData(updatedData);
                    setStep('digestive_gate');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `Historial digestivo reiniciado.\n\nEn los últimos 30 días, ¿ha padecido **${pName}** inflamación, gases, acidez, o estreñimiento recurrente?`
                            : "Historial digestivo reiniciado.\n\nEn los últimos 30 días, ¿ha padecido inflamación, gases, acidez, o estreñimiento recurrente?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                } else if (input === "FINISH") {
                    finishPhase(patientData);
                }
                break;
            }
            case 'digestive_gate': {
                if (input.startsWith('ATM_DIGEST_') || isLactante) {
                    const atmMap = {
                        ATM_DIGEST_STABLE: "Sin molestias / Microbioma estable",
                        ATM_DIGEST_ANTIBIOTICS: "Exposición a Antibióticos en primeros meses",
                        ATM_DIGEST_COLIC: "Cólicos del Lactante / Llanto vespertino",
                        ATM_DIGEST_REFLUX: "Reflujo / Regurgitación constante",
                        ATM_DIGEST_ECZEMA: "Eczema / Dermatitis atópica en piel"
                    };
                    const digestLabel = atmMap[input] || userText;
                    const updatedData = {
                        ...patientData,
                        history: {
                            ...(patientData.history || {}),
                            digestive_symptoms: [digestLabel],
                            digestive_frequency: "Evaluado en Lactante"
                        },
                        pediatric_atm: {
                            ...(patientData.pediatric_atm || {}),
                            dysbiosis: digestLabel
                        }
                    };
                    setPatientData(updatedData);

                    const summaryMsg = `He consolidado el perfil de salud digestiva y desencadenantes de **${pName}** (su bebé):\n\n🦠 **Estado Gastrointestinal / ATM 3**: ${digestLabel}\n\n¿Es correcta y verídica toda esta información?`;
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: summaryMsg,
                        options: [
                            { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" }
                        ]
                    }]);
                    setStep('REVIEW_SUMMARY');
                    setIsGlobalTyping(false);
                    break;
                }
                if (input === "Sí") {
                    const contentMsg = isMinor
                        ? `He habilitado el panel de evaluación de la salud gástrica e intestinal de **${pName}**.\n\nPara determinar el grado de inflamación, ¿cuáles de los siguientes síntomas presenta con mayor frecuencia? (Puede elegir varios).`
                        : "He habilitado el panel de evaluación de su salud gástrica e intestinal.\n\nPara determinar el grado de inflamación, ¿cuáles de los siguientes síntomas presenta con mayor frecuencia? (Puede elegir varios).";
                    
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: contentMsg,
                        options: symptomOptions,
                        isMultiSelect: true
                    }]);
                    setStep('digestive_symptoms');
                } else if (input === "No") {
                    const updatedData = {
                        ...patientData,
                        history: {
                            ...(patientData.history || {}),
                            digestive_symptoms: [],
                            digestive_frequency: "Ninguna"
                        }
                    };
                    setPatientData(updatedData);
                    finishPhase(updatedData);
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No.", 
                        options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }] 
                    }]);
                }
                break;
            }
            case 'digestive_symptoms': {
                const symptomsArray = input.split(',').map(s => s.trim()).filter(s => s);
                const symptomsText = symptomsArray.join(', ');

                const updatedData = {
                    ...patientData,
                    history: {
                        ...(patientData.history || {}),
                        digestive_symptoms: symptomsArray
                    }
                };
                setPatientData(updatedData);

                const contentMsg = isMinor
                    ? `Entendido. He registrado la presencia de **${symptomsText}** en la evaluación de **${pName}**.\n\nPara evaluar la cronicidad del cuadro, ¿con qué frecuencia presenta estas molestias?`
                    : `Entendido. He registrado la presencia de **${symptomsText}** en su evaluación.\n\nPara evaluar la cronicidad del cuadro, ¿con qué frecuencia presenta estas molestias?`;

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: contentMsg,
                    options: [
                        { label: "2 a 3 veces por semana", value: "2 a 3 veces por semana" },
                        { label: "Diario", value: "Diario" },
                        { label: "Rara vez", value: "Rara vez" }
                    ]
                }]);
                setStep('digestive_freq');
                break;
            }
            case 'digestive_freq': {
                const updatedData = {
                    ...patientData,
                    history: {
                        ...(patientData.history || {}),
                        digestive_frequency: input
                    }
                };
                setPatientData(updatedData);
                finishPhase(updatedData);
                break;
            }
            case 'REVIEW_SUMMARY': {
                finishPhase(patientData);
                break;
            }
            default:
                break;
        }
        setIsGlobalTyping(false);
    };

    const finishPhase = (updatedData) => {
        const symptoms = updatedData?.history?.digestive_symptoms || [];
        const freq = updatedData?.history?.digestive_frequency || "Ninguna";
        let profile = updatedData?.digestive_profile;

        if (!profile) {
            if (symptoms.length > 0) {
                const phen = symptoms.some(s => s.toLowerCase().includes('estreñ')) ? 'CONSTIPATION' :
                             symptoms.some(s => s.toLowerCase().includes('diarr')) ? 'DIARRHEA' :
                             symptoms.some(s => s.toLowerCase().includes('inflam') || s.toLowerCase().includes('colit')) ? 'BLOATING' : 'MIXED';
                profile = {
                    has_issues: true,
                    phenotype: phen,
                    details: { symptoms: symptoms.join(', '), frequency: freq }
                };
            } else {
                profile = {
                    has_issues: false,
                    phenotype: 'EUBIOSIS'
                };
            }
        }

        const dataWithProfile = {
            ...updatedData,
            history: {
                ...(updatedData?.history || {}),
                digestive_verified: true
            },
            digestive_profile: profile
        };

        if (onStateChange) {
            onStateChange({
                verified: true,
                completed: true,
                has_issues: profile.has_issues,
                phenotype: profile.phenotype,
                symptoms,
                frequency: freq
            });
        }

        // En lugar de inyectar mensajes y saltar de fase, pasamos el control a App.jsx para desplegar el Pill de Resumen NOM-004
        if (onPhaseComplete) {
            onPhaseComplete(dataWithProfile);
        }
    };

    return null;
}
