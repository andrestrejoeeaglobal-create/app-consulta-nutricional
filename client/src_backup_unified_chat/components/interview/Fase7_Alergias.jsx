import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import tiloImg from "../../assets/tilo.png";
import { Send } from 'lucide-react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

const formatText = (text) => {
    return text
        .toLowerCase()
        .replace(/(^\w|\s\w)/g, m => m.toUpperCase()); // Capitalize words
};

export default function Fase7_Alergias({ initialChatHistory, patientData, setPatientData, onPhaseComplete }) {
    const { patientName: pName, patientAge, patientSex } = usePatientLinguistics(patientData);
    const ptCtx = patientData?.profile?.pediatric_profile;
    const isMinor = ptCtx?.is_minor === true || patientAge < 18;
    const isFemale = patientSex?.toUpperCase().startsWith('F');
    const allergicSuf = isFemale ? 'a' : 'o';

    // Estado Local Initialize
    const [messages, setMessages] = useState(() => {
        if (initialChatHistory && initialChatHistory.length > 0) {
            return initialChatHistory;
        }
        const initialMsg = isMinor
            ? `Entendido. Pasemos a las alergias e intolerancias.\n\n¿Es ${pName} alérgic${allergicSuf} a algún alimento? (Ej. Mariscos, Nuez, Lácteos).`
            : `Entendido. Pasemos a sus alergias e intolerancias.\n\n¿Es usted alérgic${allergicSuf} a algún alimento? (Ej. Mariscos, Nuez, Lácteos).`;
        return [{ sender: 'tilo', text: initialMsg }];
    });

    const [inputValue, setInputValue] = useState("");
    const [step, setStep] = useState('food_gate');
    const [currentOptions, setCurrentOptions] = useState([
        { label: "❌ No", value: "No" },
        { label: "✅ Sí", value: "Sí" }
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
                        text: isMinor ? `¿A qué alimento es alérgic${allergicSuf} ${pName}?` : `¿A qué alimento es alérgic${allergicSuf}?`
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
                    text: isMinor ? `Entendido (${input}). ¿Qué reacción le provoca a ${pName}? (Ej. Inflamación, ronchas, anafilaxia, picazón).` : `Entendido (${input}). ¿Qué reacción le provoca? (Ej. Inflamación, ronchas, anafilaxia, picazón).`
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
                    text: isMinor ? `Registrado. ¿Es alérgic${allergicSuf} a algún otro alimento?` : `Registrado. ¿Es alérgic${allergicSuf} a algún otro alimento?`
                }]);
                setStep('food_next');
                setCurrentOptions([{ label: "❌ No", value: "No" }, { label: "✅ Sí", value: "Sí" }]);
                break;
            }
            case 'food_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isMinor ? `¿A qué otro alimento es alérgic${allergicSuf}?` : `¿A qué otro alimento es alérgic${allergicSuf}?`
                    }]);
                    setStep('food_agent');
                    setCurrentOptions([]);
                } else if (input === "No") {
                    transitionToDrugs();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: isMinor ? "Responde SÍ o NO." : "Responda SÍ o NO." }]);
                }
                break;
            }

            // ================= MEDICAMENTOS =================
            case 'drug_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isMinor ? `¿A qué medicamento es alérgic${allergicSuf} ${pName}?` : `¿A qué medicamento es alérgic${allergicSuf}?`
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
                    text: isMinor ? `Entendido (${input}). ¿Qué reacción le provoca a ${pName}?` : `Entendido (${input}). ¿Qué reacción le provoca?`
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
                    text: isMinor ? `Registrado. ¿Es alérgic${allergicSuf} a algún otro medicamento?` : `Registrado. ¿Es alérgic${allergicSuf} a algún otro medicamento?`
                }]);
                setStep('drug_next');
                setCurrentOptions([{ label: "❌ No", value: "No" }, { label: "✅ Sí", value: "Sí" }]);
                break;
            }
            case 'drug_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isMinor ? `¿A qué otro medicamento es alérgic${allergicSuf}?` : `¿A qué otro medicamento es alérgic${allergicSuf}?`
                    }]);
                    setStep('drug_agent');
                    setCurrentOptions([]);
                } else if (input === "No") {
                    handleFinish();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: isMinor ? "Responde SÍ o NO." : "Responda SÍ o NO." }]);
                }
                break;
            }

            default:
                break;
        }
    };

    const transitionToDrugs = () => {
        const msgContent = isMinor
            ? `Perfecto. Ahora pasemos a los medicamentos.\n\n¿Es ${pName} alérgic${allergicSuf} a algún fármaco, antibiótico o sustancia activa? (Ej. Penicilina, Aspirina).`
            : `Perfecto. Ahora pasemos a los medicamentos.\n\n¿Es usted alérgic${allergicSuf} a algún fármaco, antibiótico o sustancia activa? (Ej. Penicilina, Aspirina).`;

        setMessages(prev => [...prev, {
            sender: 'tilo',
            text: msgContent
        }]);
        setStep('drug_gate');
        setCurrentOptions([
            { label: "❌ No", value: "No" },
            { label: "✅ Sí", value: "Sí" }
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

                        <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${(msg.sender === "tilo" || msg.role === "assistant")
                                ? msg.isBio
                                    ? "bg-purple-50 border-l-4 border-purple-500 text-purple-900 rounded-tl-none font-medium"
                                    : msg.isAcute
                                        ? "bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-tl-none font-medium"
                                        : msg.isCritical
                                            ? "bg-red-50 border-l-4 border-red-500 text-red-900 rounded-tl-none font-bold"
                                            : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
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
                                            className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-full text-xs hover:bg-blue-200 transition-colors shadow-sm border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            placeholder="Escriba aquí..."
                            className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-sm h-10 px-2"
                        />
                    )}

                    {currentOptions.length === 0 && (
                        <button
  onClick={handleSend}
  disabled={!inputValue.trim()}
  className="bg-[#1C75BC] text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#155a8a] transition-transform active:scale-95 shadow-md flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
>
  <Send className="w-5 h-5" />
</button>
                    )}
                </div>
            </div>
        </div>
    );
}
