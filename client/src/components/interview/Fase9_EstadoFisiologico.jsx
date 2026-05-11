import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import tiloImg from "../../assets/tilo.png";
import { Send } from 'lucide-react';
import usePatientLinguistics from '../../hooks/usePatientLinguistics';

export default function Fase9_EstadoFisiologico({ initialChatHistory, patientData, setPatientData, onPhaseComplete }) {
    const { patientName: pName, isMinor } = usePatientLinguistics(patientData);

    const [messages, setMessages] = useState(() => {
        if (initialChatHistory && initialChatHistory.length > 0) {
            return initialChatHistory;
        }
        // Este componente solo se monta si la paciente es mujer, 
        // y el mensaje inicial ya debió ser insertado por la transición previa
        return [];
    });

    const [inputValue, setInputValue] = useState("");
    const [step, setStep] = useState('preg_gate');
    const [currentOptions, setCurrentOptions] = useState([
        { label: "❌ No", value: "No" },
        { label: "✅ Sí", value: "Sí" }
    ]);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim() && currentOptions.length === 0) return;

        const userInput = inputValue.trim();
        setMessages(prev => [...prev, { sender: 'user', text: userInput }]);
        setInputValue("");
        processStep(userInput);
    };

    const handleOptionSelect = (optionValue) => {
        setMessages(prev => [...prev, { sender: 'user', text: optionValue }]);
        processStep(optionValue);
    };

    const processStep = (input) => {
        switch (step) {
            case 'preg_gate': {
                if (input === "Sí") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_pregnant: true }
                    }));
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isMinor ? `¿Cuántas semanas de gestación tiene ${pName}?` : "¿Cuántas semanas de gestación tiene?"
                    }]);
                    setStep('preg_weeks');
                    setCurrentOptions([]);
                } else if (input === "No") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_pregnant: false }
                    }));
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isMinor ? `¿Actualmente se encuentra ${pName} en periodo de lactancia?` : "¿Actualmente se encuentra en periodo de lactancia?"
                    }]);
                    setStep('lact_gate');
                    setCurrentOptions([
                        { label: "❌ No", value: "No" },
                        { label: "✅ Sí", value: "Sí" }
                    ]);
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No." }]);
                }
                break;
            }
            case 'preg_weeks': {
                const weeks = parseInt(input, 10);
                if (isNaN(weeks) || weeks < 1 || weeks > 42) {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isMinor ? "Por favor, ingresa un número válido de semanas (1-42)." : "Por favor, ingrese un número válido de semanas (1-42)."
                    }]);
                } else {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), preg_weeks: weeks }
                    }));
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isMinor ? `¿Actualmente se encuentra ${pName} en periodo de lactancia (además de estar embarazada)?` : "¿Actualmente se encuentra en periodo de lactancia (además de estar embarazada)?"
                    }]);
                    setStep('lact_gate');
                    setCurrentOptions([
                        { label: "❌ No", value: "No" },
                        { label: "✅ Sí", value: "Sí" }
                    ]);
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
                        sender: 'tilo',
                        text: "¿Es lactancia materna exclusiva o mixta?"
                    }]);
                    setStep('lact_type');
                    setCurrentOptions([
                        { label: "Exclusiva", value: "Exclusiva" },
                        { label: "Mixta", value: "Mixta" }
                    ]);
                } else if (input === "No") {
                    setPatientData(prev => ({
                        ...prev,
                        physio: { ...(prev.physio || {}), is_lactating: false }
                    }));
                    finishPhase();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No." }]);
                }
                break;
            }
            case 'lact_type': {
                if (input !== "Exclusiva" && input !== "Mixta") {
                    setMessages(prev => [...prev, { sender: 'tilo', text: isMinor ? "Selecciona Exclusiva o Mixta." : "Seleccione Exclusiva o Mixta." }]);
                    return;
                }
                setPatientData(prev => ({
                    ...prev,
                    physio: { ...(prev.physio || {}), lactation_type: input }
                }));
                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: isMinor ? `¿Qué edad tiene el bebé de ${pName} (en meses)?` : "¿Qué edad tiene su bebé (en meses)?"
                }]);
                setStep('baby_age');
                setCurrentOptions([]);
                break;
            }
            case 'baby_age': {
                const months = parseInt(input, 10);
                if (isNaN(months) || months < 0 || months > 48) {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isMinor ? "Por favor, ingresa un número válido de meses (0-48)." : "Por favor, ingrese un número válido de meses (0-48)."
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
    };

    const finishPhase = () => {
        const nextMsg = isMinor
            ? `Registrado.\n\nPasemos al Estilo de Vida.\n\n¿Fuma ${pName} tabaco o utiliza vapeadores?`
            : "Registrado.\n\nPasemos a su Estilo de Vida.\n\n¿Fuma tabaco o utiliza vapeadores?";

        const finalMessages = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));

        finalMessages.push({
            role: 'assistant',
            content: nextMsg
        });

        onPhaseComplete(finalMessages, 'PHASE_10_SMOKE_GATE');
    };

    return (
        <div className="flex-col flex h-full bg-slate-50 relative">
            <div className="bg-white px-6 py-4 border-b border-slate-200 shrink-0 flex items-center justify-between z-10">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Estado Fisiológico</h2>
                    <p className="text-sm text-slate-500">Embarazo y Lactancia</p>
                </div>
                <div className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full font-bold text-xs border border-amber-200">
                    Fase 9
                </div>
            </div>

            <div className="flex-1 h-full overflow-y-auto p-8 space-y-6 custom-scrollbar relative z-10">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.sender === "tilo" || msg.role === "assistant" ? "justify-start" : "justify-end"} mb-6 items-start gap-3`}
                    >
                        {(msg.sender === "tilo" || msg.role === "assistant") && (
                            <div className="w-12 h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden">
                                <img src={tiloImg} alt="Tilo" className="w-10 h-10 object-contain" />
                            </div>
                        )}

                        <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${(msg.sender === "tilo" || msg.role === 'assistant')
                                ? msg.isBio
                                    ? 'bg-purple-50 border-l-4 border-purple-500 text-purple-900 rounded-tl-none font-medium'
                                    : msg.isAcute
                                        ? 'bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-tl-none font-medium'
                                        : msg.isCritical
                                            ? 'bg-red-50 border-l-4 border-red-500 text-red-900 rounded-tl-none font-bold'
                                            : 'bg-white border text-slate-700 rounded-tl-none border-slate-100'
                                : 'bg-indigo-600 text-white rounded-tr-none'
                                }`}>
                            <div className={`prose prose-sm max-w-none ${(msg.sender === "tilo" || msg.role === "assistant") ? "prose-slate" : "prose-invert"}`}>
                                <ReactMarkdown>{msg.text || msg.content}</ReactMarkdown>
                            </div>

                            {(msg.sender === 'tilo' || msg.role === "assistant") && index === messages.length - 1 && currentOptions.length > 0 && (
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
                            {isMinor ? "Por favor, selecciona una opción superior." : "Por favor, seleccione una opción superior."}
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder={isMinor ? "Escribe aquí..." : "Escriba aquí..."}
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
