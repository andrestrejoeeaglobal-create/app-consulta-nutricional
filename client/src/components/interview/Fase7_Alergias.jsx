import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import tiloImg from "../../assets/tilo.png";
import { Send } from 'lucide-react';

const formatText = (text) => {
    return text
        .toLowerCase()
        .replace(/(^\w|\s\w)/g, m => m.toUpperCase()); // Capitalize words
};

export default function Fase7_Alergias({ initialChatHistory, patientData, setPatientData, onPhaseComplete }) {
    const ptCtx = patientData?.profile?.pediatric_profile;
    const isYouth = ptCtx?.ui_controls?.tone_key === 'YOUTH_EMP_TONE';

    // Estado Local Initialize
    const [messages, setMessages] = useState(() => {
        if (initialChatHistory && initialChatHistory.length > 0) {
            return initialChatHistory;
        }
        const initialMsg = isYouth
            ? "Entendido. Pasemos a tus alergias e intolerancias.\n\n¿Eres alérgico/a a algún alimento? (Ej. Mariscos, Nuez, Lácteos)."
            : "Entendido. Pasemos a sus alergias e intolerancias.\n\n¿Es usted alérgico/a a algún alimento? (Ej. Mariscos, Nuez, Lácteos).";
        return [{ sender: 'tilo', text: initialMsg }];
    });

    const [inputValue, setInputValue] = useState("");
    const [step, setStep] = useState('food_gate');
    const [currentOptions, setCurrentOptions] = useState([
        { label: "✅ Sí", value: "Sí" },
        { label: "❌ No", value: "No" }
    ]);

    // Almacenamiento temporal para el ítem actual (comida o medicamento)
    const [tempAllergy, setTempAllergy] = useState({ agent: '', reaction: '', type: '' });

    const messagesEndRef = useRef(null);

    // Auto-scroll a la base de la conversación
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim() && currentOptions.length === 0) return;

        const userInput = inputValue.trim();
        const inputToSave = formatText(userInput);

        setMessages(prev => [...prev, { sender: 'user', text: inputToSave }]);
        setInputValue("");

        processStep(inputToSave);
    };

    const handleOptionSelect = (optionValue) => {
        setMessages(prev => [...prev, { sender: 'user', text: optionValue }]);
        processStep(optionValue);
    };

    const processStep = (input) => {
        switch (step) {
            // ================= ALIMENTOS =================
            case 'food_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isYouth ? "¿A qué alimento eres alérgico?" : "¿A qué alimento es alérgico?"
                    }]);
                    setStep('food_agent');
                    setCurrentOptions([]);
                } else if (input === "No") {
                    transitionToDrugs();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Por favor seleccione Sí o No." }]);
                }
                break;
            }
            case 'food_agent': {
                setTempAllergy(prev => ({ ...prev, agent: input, type: 'FOOD' }));
                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: isYouth ? `Entendido (${input}). ¿Qué reacción te provoca? (Ej. Inflamación, ronchas, anafilaxia, picazón).` : `Entendido (${input}). ¿Qué reacción le provoca? (Ej. Inflamación, ronchas, anafilaxia, picazón).`
                }]);
                setStep('food_reaction');
                break;
            }
            case 'food_reaction': {
                const newFoodAllergy = {
                    agent: tempAllergy.agent,
                    reaction: input,
                    status: 'ACTIVE'
                };

                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...(prev.history || {}),
                        allergies: {
                            ...(prev.history?.allergies || {}),
                            food: [...(prev.history?.allergies?.food || []), newFoodAllergy]
                        }
                    }
                }));

                setTempAllergy({ agent: '', reaction: '', type: '' });

                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: isYouth ? `Registrado. ¿Eres alérgico a algún otro alimento?` : `Registrado. ¿Es alérgico a algún otro alimento?`
                }]);
                setStep('food_next');
                setCurrentOptions([{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }]);
                break;
            }
            case 'food_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isYouth ? "¿A qué otro alimento eres alérgico?" : "¿A qué otro alimento es alérgico?"
                    }]);
                    setStep('food_agent');
                    setCurrentOptions([]);
                } else if (input === "No") {
                    transitionToDrugs();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Responda SÍ o NO." }]);
                }
                break;
            }

            // ================= MEDICAMENTOS =================
            case 'drug_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isYouth ? "¿A qué medicamento eres alérgico?" : "¿A qué medicamento es alérgico?"
                    }]);
                    setStep('drug_agent');
                    setCurrentOptions([]);
                } else if (input === "No") {
                    handleFinish();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Por favor seleccione Sí o No." }]);
                }
                break;
            }
            case 'drug_agent': {
                setTempAllergy(prev => ({ ...prev, agent: input, type: 'DRUG' }));
                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: isYouth ? `Entendido (${input}). ¿Qué reacción te provoca?` : `Entendido (${input}). ¿Qué reacción le provoca?`
                }]);
                setStep('drug_reaction');
                break;
            }
            case 'drug_reaction': {
                const newDrugAllergy = {
                    agent: tempAllergy.agent,
                    reaction: input,
                    status: 'ACTIVE'
                };

                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...(prev.history || {}),
                        allergies: {
                            ...(prev.history?.allergies || {}),
                            drug: [...(prev.history?.allergies?.drug || []), newDrugAllergy]
                        }
                    }
                }));

                setTempAllergy({ agent: '', reaction: '', type: '' });

                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: isYouth ? `Registrado. ¿Eres alérgico a algún otro medicamento?` : `Registrado. ¿Es alérgico a algún otro medicamento?`
                }]);
                setStep('drug_next');
                setCurrentOptions([{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }]);
                break;
            }
            case 'drug_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isYouth ? "¿A qué otro medicamento eres alérgico?" : "¿A qué otro medicamento es alérgico?"
                    }]);
                    setStep('drug_agent');
                    setCurrentOptions([]);
                } else if (input === "No") {
                    handleFinish();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Responda SÍ o NO." }]);
                }
                break;
            }

            default:
                break;
        }
    };

    const transitionToDrugs = () => {
        const msgContent = isYouth
            ? "Perfecto. Ahora pasemos a los medicamentos.\n\n¿Eres alérgico a algún fármaco, antibiótico o sustancia activa? (Ej. Penicilina, Aspirina)."
            : "Perfecto. Ahora pasemos a los medicamentos.\n\n¿Es alérgico a algún fármaco, antibiótico o sustancia activa? (Ej. Penicilina, Aspirina).";

        setMessages(prev => [...prev, {
            sender: 'tilo',
            text: msgContent
        }]);
        setStep('drug_gate');
        setCurrentOptions([
            { label: "✅ Sí", value: "Sí" },
            { label: "❌ No", value: "No" }
        ]);
    };

    const handleFinish = () => {
        // Enviar historial final y pasar a Fase 8 (Salud Digestiva)
        const finalMessages = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));

        onPhaseComplete(finalMessages);
    };

    return (
        <div className="flex-col flex h-full bg-slate-50 relative">
            <div className="flex-1 h-full overflow-y-auto p-8 space-y-6 custom-scrollbar relative z-10">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.sender === "tilo" ? "justify-start" : "justify-end"} mb-6 items-start gap-3`}
                    >
                        {msg.sender === "tilo" && (
                            <div className="w-12 h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden">
                                <img src={tiloImg} alt="Tilo" className="w-10 h-10 object-contain" />
                            </div>
                        )}

                        <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${msg.sender === "tilo"
                            ? "bg-white border text-slate-700 rounded-tl-none border-slate-100"
                            : "bg-indigo-600 text-white rounded-tr-none"
                            }`}>
                            <div className={`prose prose-sm max-w-none ${msg.sender === "tilo" ? "prose-slate" : "prose-invert"}`}>
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>

                            {/* Opciones interactivas si es el último mensaje */}
                            {msg.sender === 'tilo' && index === messages.length - 1 && currentOptions.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {currentOptions.map((opt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleOptionSelect(opt.value)}
                                            className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-full text-xs hover:bg-blue-200 transition-colors shadow-sm border border-blue-200"
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-6 bg-white border-t border-slate-50 shrink-0">
                <div className="relative flex items-center gap-2 bg-white border border-slate-200 rounded-full px-2 py-2 shadow-sm focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-400 transition-all w-full">
                    {currentOptions.length > 0 ? (
                        <div className="flex-1 px-3 py-2 text-slate-400 text-sm italic border-l border-slate-100 flex items-center">
                            Por favor, seleccione una opción superior.
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Escribe tu respuesta..."
                            className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-sm h-10 px-2"
                        />
                    )}

                    {currentOptions.length === 0 && (
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="bg-blue-600 font-bold hover:bg-blue-700 text-white p-2 rounded-full transition-colors flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-10 h-10"
                        >
                            <Send className="w-5 h-5 ml-1" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
