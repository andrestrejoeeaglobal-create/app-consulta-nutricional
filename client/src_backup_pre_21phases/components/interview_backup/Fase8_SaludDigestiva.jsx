import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import tiloImg from "../../assets/tilo.png";
import { Send, Check } from 'lucide-react';
import usePatientLinguistics from '../../hooks/usePatientLinguistics';

const symptomOptions = [
    { label: "Colitis / Inflamación", value: "Colitis / Inflamación" },
    { label: "Diarrea", value: "Diarrea" },
    { label: "Estreñimiento", value: "Estreñimiento" },
    { label: "Gastritis / Acidez", value: "Gastritis / Acidez" },
    { label: "Reflujo", value: "Reflujo" }
];

export default function Fase8_SaludDigestiva({ initialChatHistory, patientData, setPatientData, onPhaseComplete }) {
    const { patientName: pName, isMinor, isGeriatric, patientGender } = usePatientLinguistics(patientData);

    const [messages, setMessages] = useState(() => {
        if (initialChatHistory && initialChatHistory.length > 0) {
            return initialChatHistory;
        }
        const initialMsg = isMinor
            ? `Pasemos a la salud digestiva. En los últimos 30 días, ¿ha padecido ${pName} inflamación, gases, acidez, o estreñimiento recurrente?`
            : "Pasemos a su salud digestiva. En los últimos 30 días, ¿ha padecido inflamación, gases, acidez, o estreñimiento recurrente?";
        return [{ sender: 'tilo', text: initialMsg }];
    });

    const [inputValue, setInputValue] = useState("");
    const [step, setStep] = useState('digestive_gate');
    const [currentOptions, setCurrentOptions] = useState([
        { label: "❌ No", value: "No" },
        { label: "✅ Sí", value: "Sí" }
    ]);
    const [isMultiSelect, setIsMultiSelect] = useState(false);
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim() && !isMultiSelect && currentOptions.length === 0) return;

        const userInput = inputValue.trim();
        setMessages(prev => [...prev, { sender: 'user', text: userInput }]);
        setInputValue("");
        processStep(userInput);
    };

    const handleOptionSelect = (optionValue) => {
        if (isMultiSelect) {
            setSelectedSymptoms(prev =>
                prev.includes(optionValue)
                    ? prev.filter(item => item !== optionValue)
                    : [...prev, optionValue]
            );
            return;
        }

        setMessages(prev => [...prev, { sender: 'user', text: optionValue }]);
        processStep(optionValue);
    };

    const handleConfirmSelection = () => {
        if (selectedSymptoms.length === 0) return;
        const joinedSymptoms = selectedSymptoms.join(", ");
        setMessages(prev => [...prev, { sender: 'user', text: joinedSymptoms }]);
        setIsMultiSelect(false);
        setCurrentOptions([]);
        processStep(joinedSymptoms, true);
    };

    const processStep = (input, fromMultiSelect = false) => {
        switch (step) {
            case 'digestive_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: isMinor ? `¿Cuáles de los siguientes síntomas presenta ${pName} con mayor frecuencia? (Puede elegir varios)` : "¿Cuáles de los siguientes síntomas presenta con mayor frecuencia? (Puede elegir varios)"
                    }]);
                    setStep('digestive_symptoms');
                    setCurrentOptions(symptomOptions);
                    setIsMultiSelect(true);
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
                    setMessages(prev => [...prev, { sender: 'tilo', text: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No." }]);
                }
                break;
            }
            case 'digestive_symptoms': {
                let symptomsArray = [];
                if (fromMultiSelect) {
                    symptomsArray = selectedSymptoms;
                } else {
                    symptomsArray = input.split(',').map(s => s.trim()).filter(s => s);
                }

                setPatientData(prev => ({
                    ...prev,
                    history: {
                        ...(prev.history || {}),
                        digestive_symptoms: symptomsArray
                    }
                }));

                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: isMinor ? `¿Con qué frecuencia presenta ${pName} estas molestias?` : "¿Con qué frecuencia presenta estas molestias?"
                }]);
                setStep('digestive_freq');
                setCurrentOptions([
                    { label: "2 a 3 veces por semana", value: "2 a 3 veces por semana" },
                    { label: "Diario", value: "Diario" },
                    { label: "Rara vez", value: "Rara vez" }
                ]);
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
    };

    const finishPhase = (hadSymptoms = false) => {
        const isFemale = patientGender && patientGender.startsWith('F');

        const introText = hadSymptoms
            ? (isMinor ? `Entendido, los síntomas digestivos de ${pName} han sido registrados.` : "Entendido, sus síntomas digestivos han sido registrados.")
            : (isMinor ? `Excelente. Perfil digestivo de ${pName} registrado sin alteraciones.` : "Excelente. Perfil digestivo registrado sin alteraciones.");

        let nextMsg = "";
        let nextPhase = "";

        if (!isFemale || isGeriatric) {
            nextMsg = isMinor ? `${introText}\n\nPasemos al Estilo de Vida.\n\n¿Fuma ${pName} tabaco o utiliza vapeadores?` : `${introText}\n\nPasemos a su Estilo de Vida.\n\n¿Fuma tabaco o utiliza vapeadores?`;
            nextPhase = 'PHASE_10_SMOKE_GATE';
        } else {
            nextMsg = isMinor ? `${introText}\n\nPara ajustar los requerimientos de energía: ¿Se encuentra ${pName} embarazada actualmente?` : `${introText}\n\nPara ajustar sus requerimientos de energía: ¿Se encuentra embarazada actualmente?`;
            nextPhase = 'PHASE_9_PREG_GATE';
        }

        const finalMessages = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));

        // Añadimos el mensaje puente hacia la siguiente fase para que aparezca en el historial
        finalMessages.push({
            role: 'assistant',
            content: nextMsg
        });

        onPhaseComplete(finalMessages, nextPhase);
    };

    return (
        <div className="flex-col flex h-full bg-slate-50 relative">
            <div className="bg-white px-6 py-4 border-b border-slate-200 shrink-0 flex items-center justify-between z-10">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Salud Digestiva</h2>
                    <p className="text-sm text-slate-500">Síntomas y Frecuencia</p>
                </div>
                <div className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full font-bold text-xs border border-amber-200">
                    Fase 8
                </div>
            </div>

            <div className="flex-1 h-full overflow-y-auto p-8 space-y-6 custom-scrollbar relative z-10">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.sender === "tilo" || msg.role === 'assistant' ? "justify-start" : "justify-end"} mb-6 items-start gap-3`}
                    >
                        {(msg.sender === "tilo" || msg.role === 'assistant') && (
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
                            <div className={`prose prose-sm max-w-none ${(msg.sender === "tilo" || msg.role === 'assistant') ? "prose-slate" : "prose-invert"}`}>
                                <ReactMarkdown>{msg.text || msg.content}</ReactMarkdown>
                            </div>

                            {(msg.sender === 'tilo' || msg.role === 'assistant') && index === messages.length - 1 && currentOptions.length > 0 && (
                                <div className="mt-4">
                                    <div className="flex flex-wrap gap-2">
                                        {currentOptions.map((opt, i) => {
                                            const isSelected = isMultiSelect && selectedSymptoms.includes(opt.value);
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => handleOptionSelect(opt.value)}
                                                    className={`px-4 py-2 font-bold rounded-full text-xs transition-colors shadow-sm border ${isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {isMultiSelect && (
                                        <button
                                            onClick={handleConfirmSelection}
                                            disabled={selectedSymptoms.length === 0}
                                            className="mt-3 w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <Check className="w-4 h-4" /> Confirmar Selección
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-6 bg-white border-t border-slate-50 shrink-0">
                <div className="relative flex items-center gap-2 bg-white border border-slate-200 rounded-full px-2 py-2 shadow-sm focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-400 transition-all w-full">
                    {currentOptions.length > 0 && !isMultiSelect ? (
                        <div className="flex-1 px-3 py-2 text-slate-400 text-sm italic border-l border-slate-100 flex items-center">
                            {isMinor ? "Por favor, selecciona una opción superior." : "Por favor, seleccione una opción superior."}
                        </div>
                    ) : isMultiSelect ? (
                        <div className="flex-1 px-3 py-2 text-slate-400 text-sm italic border-l border-slate-100 flex items-center">
                            {isMinor ? "Selecciona uno o más síntomas y presiona Confirmar." : "Seleccione uno o más síntomas y presione Confirmar."}
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

                    {(!isMultiSelect && currentOptions.length === 0) && (
                        <button
  onClick={handleSend}
  disabled={!inputValue.trim()}
  className="bg-blue-600 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-700 transition-transform active:scale-95 shadow-md flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
>
  <Send className="w-5 h-5" />
</button>
                    )}
                </div>
            </div>
        </div>
    );
}
