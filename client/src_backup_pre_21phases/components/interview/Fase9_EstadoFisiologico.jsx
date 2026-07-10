import React, { useState, useEffect } from 'react';
import usePatientLinguistics from '../../hooks/usePatientLinguistics';

export default function Fase9_EstadoFisiologico({ patientData, setPatientData, onPhaseComplete, registerInputHandler, messages, setMessages, setIsGlobalTyping }) {
    const { patientName: pName, isMinor } = usePatientLinguistics(patientData);

    const [step, setStep] = useState('preg_gate');

    // Inicialización
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([
                {
                    role: 'assistant',
                    content: isMinor ? `Para ajustar los requerimientos de energía: ¿Se encuentra ${pName} embarazada actualmente?` : "Para ajustar sus requerimientos de energía: ¿Se encuentra embarazada actualmente?",
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
            case 'preg_gate': {
                if (input === "Sí") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_pregnant: true }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor ? `¿Cuántas semanas de gestación tiene ${pName}?` : "¿Cuántas semanas de gestación tiene?",
                        inputType: 'number'
                    }]);
                    setStep('preg_weeks');
                } else if (input === "No") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_pregnant: false }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor ? `¿Actualmente se encuentra ${pName} en periodo de lactancia?` : "¿Actualmente se encuentra en periodo de lactancia?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                    setStep('lact_gate');
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No.", options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }] }]);
                }
                break;
            }
            case 'preg_weeks': {
                const weeks = parseInt(input, 10);
                if (isNaN(weeks) || weeks < 1 || weeks > 42) {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor ? "Por favor, ingresa un número válido de semanas (1-42)." : "Por favor, ingrese un número válido de semanas (1-42).",
                        inputType: 'number'
                    }]);
                } else {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), preg_weeks: weeks }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor ? `¿Actualmente se encuentra ${pName} en periodo de lactancia (además de estar embarazada)?` : "¿Actualmente se encuentra en periodo de lactancia (además de estar embarazada)?",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                    setStep('lact_gate');
                }
                break;
            }
            case 'lact_gate': {
                if (input === "Sí") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_lactating: true }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "¿Es lactancia materna exclusiva o mixta?",
                        options: [
                            { label: "Exclusiva", value: "Exclusiva" },
                            { label: "Mixta", value: "Mixta" }
                        ]
                    }]);
                    setStep('lact_type');
                } else if (input === "No") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_lactating: false }
                    }));
                    finishPhase();
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No.", options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }] }]);
                }
                break;
            }
            case 'lact_type': {
                if (input !== "Exclusiva" && input !== "Mixta") {
                    setMessages(prev => [...prev, { role: 'assistant', content: isMinor ? "Selecciona Exclusiva o Mixta." : "Seleccione Exclusiva o Mixta.", options: [{ label: "Exclusiva", value: "Exclusiva" }, { label: "Mixta", value: "Mixta" }] }]);
                    return;
                }
                setPatientData(prev => ({
                    ...prev,
                    physio: { ...(prev.physio || {}), lactation_type: input }
                }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor ? `¿Qué edad tiene el bebé de ${pName} (en meses)?` : "¿Qué edad tiene su bebé (en meses)?",
                    inputType: 'number'
                }]);
                setStep('baby_age');
                break;
            }
            case 'baby_age': {
                const months = parseInt(input, 10);
                if (isNaN(months) || months < 0 || months > 48) {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor ? "Por favor, ingresa un número válido de meses (0-48)." : "Por favor, ingrese un número válido de meses (0-48).",
                        inputType: 'number'
                    }]);
                } else {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), baby_age_months: months }
                    }));
                    finishPhase();
                }
                break;
            }
            default:
                break;
        }
        setIsGlobalTyping(false);
    };

    const finishPhase = () => {
        const nextMsg = isMinor
            ? `Registrado.\n\nPasemos a la Evaluación Dietética.`
            : "Registrado.\n\nPasemos a su Evaluación Dietética.";

        setMessages(prev => [...prev, { role: 'assistant', content: nextMsg }]);
        
        setTimeout(() => {
            onPhaseComplete('PHASE_11_DIETARY_EVALUATION');
        }, 1500);
    };

    return null; // Headless
}
