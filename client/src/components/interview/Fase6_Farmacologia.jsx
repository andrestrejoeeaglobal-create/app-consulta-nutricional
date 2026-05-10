import React, { useState, useEffect, useRef } from 'react';
import { formatText } from '../../utils/utils';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

/**
 * T.I.L.O. - FASE 6 (FARMACOLOGÍA)
 * 
 * Componente interactivo estructurado con el "Clinical Look".
 * Maneja el bucle de recolección de medicamentos (Nombre, Dosis/Frecuencia, Duración).
 * Almacena los resultados en patientData.history.medications.
 */
const Fase6_Farmacologia = ({ initialChatHistory, onPhaseComplete, patientData, setPatientData }) => {

    const { patientName: pName, patientAge } = usePatientLinguistics(patientData);
    const ptCtx = patientData?.profile?.pediatric_profile;
    const isMinor = ptCtx?.is_minor === true || patientAge < 18;

    // Estado Local Initialize
    const [messages, setMessages] = useState(() => {
        if (initialChatHistory && initialChatHistory.length > 0) {
            return initialChatHistory;
        }
        const initialMsg = isMinor
            ? `Entendido. Perfil clínico actualizado.\n\nPasemos ahora a la Farmacología. ¿Toma ${pName} actualmente algún medicamento recetado por un médico?`
            : "Entendido. Perfil clínico actualizado.\n\nPasemos ahora a la Farmacología. ¿Toma usted actualmente algún medicamento recetado por un médico?";
        return [{ role: 'assistant', content: initialMsg }];
    });

    const [inputValue, setInputValue] = useState("");
    const [step, setStep] = useState('meds_gate');
    const [currentOptions, setCurrentOptions] = useState([
        { label: "❌ No", value: "No" },
        { label: "✅ Sí", value: "Sí" }
    ]);

    const [tempItem, setTempItem] = useState({ name: '', details: '', duration: '', type: '' });

    const messagesEndRef = useRef(null);

    // Auto-scroll a la base de la conversación
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim() && currentOptions.length === 0) return;

        const userInput = inputValue.trim();
        const inputToSave = formatText(userInput);

        setMessages(prev => [...prev, { role: 'user', content: inputToSave }]);
        setInputValue("");

        processStep(inputToSave);
    };

    const handleOptionSelect = (optionValue) => {
        setMessages(prev => [...prev, { role: 'user', content: optionValue }]);
        processStep(optionValue);
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
                    setCurrentOptions([]);
                } else if (input === "No") {
                    transitionToSupps();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No." }]);
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
                    content: isMinor ? `Registrado. ¿Toma ${pName} algún otro medicamento prescrito?` : "Registrado. ¿Toma usted algún otro medicamento prescrito?"
                }]);
                setStep('meds_next');
                setCurrentOptions([{ label: "❌ No", value: "No" }, { label: "✅ Sí", value: "Sí" }]);
                break;
            }
            case 'meds_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor ? "Escribe el nombre del siguiente medicamento:" : "Escriba el nombre del siguiente medicamento:"
                    }]);
                    setStep('meds_name');
                    setCurrentOptions([]);
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
                    setCurrentOptions([]);
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
                        : "Registrado ✅.\n\n¿Consume usted algún otro producto natural o vitamina?"
                }]);
                setStep('supp_next');
                setCurrentOptions([{ label: "❌ No", value: "No" }, { label: "✅ Sí", value: "Sí" }]);
                break;
            }
            case 'supp_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "¿Cuál es el nombre del producto?"
                    }]);
                    setStep('supp_name');
                    setCurrentOptions([]);
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
                : "Entendido. Pasemos a los productos de venta libre.\n\n¿Consume usted vitaminas, proteínas, tés o suplementos 'naturistas'?"
        }]);
        setStep('supp_start');
        setCurrentOptions([
            { label: "❌ No", value: "No" },
            { label: "✅ Sí", value: "Sí" }
        ]);
    };

    const handleFinish = () => {
        onPhaseComplete(messages);
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header / Titular */}
            <div className="flex items-center p-4 border-b border-gray-100 bg-gray-50/50">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mr-4">
                    <span className="text-xl">💊</span>
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">Farmacología y Suplementos</h2>
                    <p className="text-sm text-gray-500">Mapeo de interacciones - Fase 6</p>
                </div>
            </div>

            {/* Chat Area (Burbujas Limpias) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            max-w-[80%] rounded-2xl px-5 py-3 shadow-sm
                            ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-gray-100 text-gray-800 rounded-bl-none'}
                        `}>
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {/* Renderizado de Botones Opciones */}
                {currentOptions.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-start mt-2">
                        {currentOptions.map((opt, i) => (
                            <button
                                key={i}
                                onClick={() => handleOptionSelect(opt.value)}
                                className="px-4 py-2 bg-white border-2 border-blue-100 rounded-xl text-blue-700 font-medium hover:bg-blue-50 transition-colors shadow-sm"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {currentOptions.length === 0 && (
                <div className="p-4 border-t border-gray-100 bg-white shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)]">
                    <div className="h-14 bg-gray-50 rounded-2xl flex items-center px-4 border border-gray-200">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Escriba aquí..."
                            className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 text-[15px]"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="ml-3 w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-50 disabled:bg-gray-300 transition-colors"
                        >
                            <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Fase6_Farmacologia;
