import React, { useState, useEffect } from 'react';
import usePatientLinguistics from '../../hooks/usePatientLinguistics';

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

    // Inicialización
    useEffect(() => {
        if (messages.length === 0) {
            const initialMsg = isMinor
                ? `Pasemos a la salud digestiva. En los últimos 30 días, ¿ha padecido ${pName} inflamación, gases, acidez, o estreñimiento recurrente?`
                : "Pasemos a su salud digestiva. En los últimos 30 días, ¿ha padecido inflamación, gases, acidez, o estreñimiento recurrente?";
            
            setMessages([
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
    }, []);

    // Middleware de enrutamiento
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(processStep);
        }
        return () => {
            if (registerInputHandler) registerInputHandler(null);
        };
    }, [step, registerInputHandler]);

    const processStep = async (input, label = null) => {
        const userText = label || input;
        
        setMessages(prev => [...prev, { role: 'user', content: userText }]);
        
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        switch (step) {
            case 'digestive_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor ? `¿Cuáles de los siguientes síntomas presenta ${pName} con mayor frecuencia? (Puede elegir varios)` : "¿Cuáles de los siguientes síntomas presenta con mayor frecuencia? (Puede elegir varios)",
                        options: symptomOptions,
                        isMultiSelect: true
                    }]);
                    setStep('digestive_symptoms');
                } else if (input === "No") {
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...(prev.history || {}),
                            digestive_symptoms: [],
                            digestive_frequency: "Ninguna"
                        }
                    }));
                    finishPhase();
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No.", options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }] }]);
                }
                break;
            }
            case 'digestive_symptoms': {
                const symptomsArray = input.split(',').map(s => s.trim()).filter(s => s);

                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...(prev.history || {}),
                        digestive_symptoms: symptomsArray
                    }
                }));

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor ? `¿Con qué frecuencia presenta ${pName} estas molestias?` : "¿Con qué frecuencia presenta estas molestias?",
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
                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...(prev.history || {}),
                        digestive_frequency: input
                    }
                }));
                finishPhase(true);
                break;
            }
            default:
                break;
        }
        setIsGlobalTyping(false);
    };

    const finishPhase = (hadSymptoms = false) => {
        const isFemale = patientGender && patientGender.startsWith('F');

        const introText = hadSymptoms
            ? (isMinor ? `Entendido, los síntomas digestivos de ${pName} han sido registrados.` : "Entendido, sus síntomas digestivos han sido registrados.")
            : (isMinor ? `Excelente. Perfil digestivo de ${pName} registrado sin alteraciones.` : "Excelente. Perfil digestivo registrado sin alteraciones.");

        let nextMsg = "";
        let nextPhase = "";

        if (!isFemale || isGeriatric) {
            nextMsg = isMinor ? `${introText}\n\nPasemos a la Evaluación Dietética.` : `${introText}\n\nPasemos a su Evaluación Dietética.`;
            nextPhase = 'PHASE_11_DIETARY_EVALUATION';
        } else {
            nextMsg = isMinor ? `${introText}\n\nPara ajustar los requerimientos de energía: ¿Se encuentra ${pName} embarazada actualmente?` : `${introText}\n\nPara ajustar sus requerimientos de energía: ¿Se encuentra embarazada actualmente?`;
            nextPhase = 'PHASE_9_PREG_GATE';
        }

        setMessages(prev => [...prev, { role: 'assistant', content: nextMsg }]);
        
        setTimeout(() => {
            onPhaseComplete(nextPhase);
        }, 1500);
    };

    return null;
}
