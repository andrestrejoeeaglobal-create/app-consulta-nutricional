import React, { useState, useEffect, useRef } from 'react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

const symptomOptions = [
    { label: "Colitis / Inflamación", value: "Colitis / Inflamación" },
    { label: "Diarrea", value: "Diarrea" },
    { label: "Estreñimiento", value: "Estreñimiento" },
    { label: "Gastritis / Acidez", value: "Gastritis / Acidez" },
    { label: "Reflujo", value: "Reflujo" }
];

export default function Fase8_SaludDigestiva({ patientData, setPatientData, onPhaseComplete, registerInputHandler, messages, setMessages, setIsGlobalTyping }) {
    const { patientName: pName, isMinor, isGeriatric, patientGender } = usePatientLinguistics(patientData);

    const [step, setStep] = useState('digestive_gate');
    const hasGreeted = useRef(false);

    // Inicialización - Mitigación absoluta de doble render en StrictMode
    useEffect(() => {
        if (hasGreeted.current) return;

        const alreadyGreeted = (messages || []).some(msg => msg.role === 'assistant' && msg.content.includes("salud digestiva"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;
            const initialMsg = isMinor
                ? `He registrado y sellado el perfil de sensibilidades inmunológicas de **${pName}** de manera exitosa.\n\nPasemos a la salud digestiva. En los últimos 30 días, ¿ha padecido **${pName}** inflamación, gases, acidez, o estreñimiento recurrente?`
                : "He registrado y sellado su perfil de sensibilidades inmunológicas de manera exitosa.\n\nPasemos a su salud digestiva. En los últimos 30 días, ¿ha padecido inflamación, gases, acidez, o estreñimiento recurrente?";
            
            setMessages(prev => [
                ...prev,
                { 
                    role: 'assistant', 
                    content: initialMsg,
                    options: [
                        { label: "✅ Sí", value: "Sí" },
                        { label: "❌ No", value: "No" },
                    ]
                }
            ]);
        }
    }, [messages, isMinor, pName, setMessages]);

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
        if (label !== 'button') {
            const isGeneric = label === 'text' || label === 'select' || label === 'number' || label === 'tel';
            const userText = (label && !isGeneric) ? label : input;
            setMessages(prev => [...prev, { role: 'user', content: userText }]);
        }
        
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        switch (step) {
            case 'digestive_gate': {
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
            default:
                break;
        }
        setIsGlobalTyping(false);
    };

    const finishPhase = (updatedData) => {
        // En lugar de inyectar mensajes y saltar de fase, pasamos el control a App.jsx para desplegar el Pill de Resumen NOM-004
        if (onPhaseComplete) {
            onPhaseComplete(updatedData);
        }
    };

    return null;
}
