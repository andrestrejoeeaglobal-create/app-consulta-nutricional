import React, { useState, useEffect, useRef } from 'react';
import { formatText } from '../../utils/utils';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { Send } from 'lucide-react';

/**
 * T.I.L.O. - FASE 6 (FARMACOLOGÍA)
 * 
 * Componente interactivo estructurado con el "Clinical Look".
 * Maneja el bucle de recolección de medicamentos (Nombre, Dosis/Frecuencia, Duración).
 * Almacena los resultados en patientData.history.medications.
 */
const Fase6_Farmacologia = ({ messages, setMessages, registerInputHandler, setIsGlobalTyping, patientData, setPatientData, onPhaseComplete, onStateChange }) => {

    const { patientName: pName, patientAge } = usePatientLinguistics(patientData);
    const ptCtx = patientData?.profile?.pediatric_profile;
    const isMinor = ptCtx?.is_minor === true || patientAge < 18;

    // Estado Local Initialize
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            // Solo si messages está vacío
            if (messages.length === 0) {
                const initialMsg = isMinor
                    ? `Entendido. Perfil clínico actualizado.\n\nPasemos ahora a la Farmacología. ¿Toma ${pName} actualmente algún medicamento recetado por un médico?`
                    : "Entendido. Perfil clínico actualizado.\n\nPasemos ahora a la Farmacología. ¿Toma usted actualmente algún medicamento recetado por un médico?";
                
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: initialMsg,
                    options: [
                        { label: "✅ Sí", value: "Sí" },
                        { label: "❌ No", value: "No" },
                    ]
                }]);
            }
        }
    }, []);

    const [step, setStep] = useState('meds_gate');
    const [tempItem, setTempItem] = useState({ name: '', details: '', duration: '', type: '' });

    // Update parent state (fase6State) when patientData changes
    useEffect(() => {
        if (onStateChange) {
            onStateChange({
                medications: patientData?.history?.medications || [],
                supplements: patientData?.history?.supplements || []
            });
        }
    }, [patientData?.history?.medications, patientData?.history?.supplements, onStateChange]);

    const handleSend = (val, label) => {
        const inputToSave = label || val;
        if (!inputToSave) return;

        setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                newMsgs[newMsgs.length - 1].options = undefined;
            }
            return [...newMsgs, { role: 'user', content: formatText(inputToSave) }];
        });

        setTimeout(() => processStep(val), 100);
    };

    const processStep = (input) => {
        switch (step) {
            // ================= MEDICAMENTOS =================
            case 'meds_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor ? "Correcto. Escribe el nombre del primer medicamento:" : "Correcto. Escriba el nombre del primer medicamento:"
                    }]);
                    setStep('meds_name');
                } else if (input === "No") {
                    transitionToSupps();
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No." }]);
                }
                break;
            }
            case 'meds_name': {
                setTempItem(prev => ({ ...prev, name: input, type: 'MED' }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Entendido (${input}). ¿Cuál es la dosis exacta y con qué frecuencia la toma? (Ej. 1 tableta cada 12 horas).`
                }]);
                setStep('meds_dose');
                break;
            }
            case 'meds_dose': {
                setTempItem(prev => ({ ...prev, details: input }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor
                        ? `¿Desde hace cuánto tiempo toma este medicamento? (Ej. 1 semana, 3 años).\n\nEsto es importante para calcular los riesgos nutricionales de ${pName}.`
                        : `¿Desde hace cuánto tiempo toma este medicamento? (Ej. 1 semana, 3 años).\n\nEsto es importante para calcular sus riesgos nutricionales.`
                }]);
                setStep('meds_time');
                break;
            }
            case 'meds_time': {
                const newMedication = {
                    name: tempItem.name,
                    dose_frequency: tempItem.details,
                    duration: input,
                    status: 'ACTIVE'
                };

                setPatientData(prev => ({
                    ...prev,
                    history: { ...(prev.history || {}), medications: [...(prev.history?.medications || []), newMedication] }
                }));

                setTempItem({ name: '', details: '', duration: '', type: '' });

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor ? `Registrado. ¿Toma ${pName} algún otro medicamento prescrito?` : "Registrado. ¿Toma usted algún otro medicamento prescrito?",
                    options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }]
                }]);
                setStep('meds_next');
                break;
            }
            case 'meds_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor ? "Escribe el nombre del siguiente medicamento:" : "Escriba el nombre del siguiente medicamento:"
                    }]);
                    setStep('meds_name');
                } else if (input === "No") {
                    transitionToSupps();
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No." }]);
                }
                break;
            }

            // ================= SUPLEMENTOS =================
            case 'supp_start': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "¿Cuál es el nombre del producto o ingrediente principal?"
                    }]);
                    setStep('supp_name');
                } else if (input === "No") {
                    handleFinish();
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No." }]);
                }
                break;
            }
            case 'supp_name': {
                setTempItem(prev => ({ ...prev, name: input, type: 'SUPP' }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "¿Cuál es la dosis y frecuencia? (Ej. 1 scoop en la mañana)."
                }]);
                setStep('supp_details');
                break;
            }
            case 'supp_details': {
                setTempItem(prev => ({ ...prev, details: input }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "¿Desde hace cuánto tiempo consume este producto? (Ej. Recién empecé, Llevo 6 meses)."
                }]);
                setStep('supp_duration');
                break;
            }
            case 'supp_duration': {
                const newSupplement = {
                    name: tempItem.name,
                    frequency: tempItem.details,
                    duration: input,
                    type: 'OTHER'
                };

                setPatientData(prev => ({
                    ...prev,
                    history: { ...(prev.history || {}), supplements: [...(prev.history?.supplements || []), newSupplement] }
                }));

                setTempItem({ name: '', details: '', duration: '', type: '' });

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor 
                        ? `Registrado ✅.\n\n¿Consume ${pName} algún otro producto natural o vitamina?` 
                        : "Registrado ✅.\n\n¿Consume usted algún otro producto natural o vitamina?",
                    options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }]
                }]);
                setStep('supp_next');
                break;
            }
            case 'supp_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "¿Cuál es el nombre del producto?"
                    }]);
                    setStep('supp_name');
                } else if (input === "No") {
                    handleFinish();
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: isMinor ? "Responde SÍ o NO." : "Responda SÍ o NO." }]);
                }
                break;
            }

            default:
                break;
        }
    };

    const transitionToSupps = () => {
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: isMinor 
                ? `Entendido. Pasemos a los productos de venta libre.\n\n¿Consume ${pName} vitaminas, proteínas, tés o suplementos 'naturistas'?`
                : "Entendido. Pasemos a los productos de venta libre.\n\n¿Consume usted vitaminas, proteínas, tés o suplementos 'naturistas'?",
            options: [
                { label: "✅ Sí", value: "Sí" },
                { label: "❌ No", value: "No" },
            ]
        }]);
        setStep('supp_start');
    };

    const handleFinish = () => {
        onPhaseComplete(null);
    };

    // Register Handler
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, val) => handleSend(text, val));
        }
    }, [registerInputHandler, step]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(false);
        }
    }, [setIsGlobalTyping]);

    // Headless UI: Phase 6 only uses standard text input and simple options
    return null;
};

export default Fase6_Farmacologia;
