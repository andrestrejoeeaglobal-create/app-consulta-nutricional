import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Send } from 'lucide-react';
import tiloImg from '../../assets/tilo.png';
import SearchableVerticalMenu from './SearchableVerticalMenu';

const routeToSpanish = (route) => {
    const map = {
        'GOAL_ADDICTIONS': 'Adicciones y Sustancias',
        'GOAL_GERIATRICS': 'Geriatría',
        'GOAL_ALLERGIES': 'Alergias Graves',
        'GOAL_WEIGHT_LOSS': 'Pérdida de Peso',
        'GOAL_BARIATRIC': 'Bariátrica / Quirúrgico',
        'GOAL_MENOPAUSE': 'Climaterio y Menopausia',
        'GOAL_CLINICAL': 'Control Clínico',
        'GOAL_PALLIATIVE': 'Cuidados Paliativos',
        'GOAL_DISABILITY': 'Discapacidad y Rehabilitación',
        'GOAL_PREGNANCY': 'Embarazo y Lactancia',
        'GOAL_MUSCLE': 'Deporte / Rendimiento',
        'GOAL_ONCOLOGY': 'Oncología Nutricional',
        'GOAL_PEDIATRICS': 'Pediatría',
        'GOAL_LONGEVITY': 'Longevidad',
        'GOAL_MENTAL_HEALTH': 'Salud Mental',
        'GOAL_RENAL': 'Salud Renal',
        'GOAL_IMMUNE': 'Inmunodeficiencias'
    };
    const cleanRoute = (route || "").replace('@ ', '');
    return map[cleanRoute] || cleanRoute;
};

const riskToSpanish = (risk) => {
    const map = {
        'LOW': 'Estable',
        'BASE': 'Estable',
        'MEDIUM': 'Moderado',
        'HIGH': 'Riesgo Alto / Límite',
        'SEVERE': 'Crítico (Red Flag)'
    };
    const cleanRisk = (risk || "").toUpperCase();
    return map[cleanRisk] || risk;
};

const ChatView = ({ 
    messages, 
    onSend, 
    isTyping, 
    currentPhase, 
    patientAge, 
    patientSex, 
    patientData, 
    customInputSlot, // Slot for things like VisualBodyMap
    identityBifurcationSlot // Slot for Identity Gate bifurcations
}) => {
    const chatEndRef = useRef(null);
    const [inputValue, setInputValue] = useState("");
    const [localPhase, setLocalPhase] = useState(currentPhase);
    const [fadeState] = useState('visible'); // Always visible to prevent reloading transition
    const [localMultiSelect, setLocalMultiSelect] = useState([]); // Array of selected values

    // Handle Phase Change instantly without reload transition
    useEffect(() => {
        if (currentPhase !== localPhase) {
            setLocalPhase(currentPhase);
        }
    }, [currentPhase, localPhase]);

    useEffect(() => {
        if (fadeState === 'visible') {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            const timer = setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [messages, fadeState]);

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (inputValue.trim() && !isTyping) {
            onSend(inputValue);
            setInputValue("");
        }
    };

    const handleOptionSelect = (msg, val, label) => {
        if (isTyping) return;
        if (msg.isMultiSelect) {
            setLocalMultiSelect(prev => {
                const isSelected = prev.some(item => item.value === val);
                if (isSelected) {
                    return prev.filter(item => item.value !== val);
                } else {
                    return [...prev, { value: val, label: label }];
                }
            });
            return;
        }
        onSend(val, label);
    };

    const handleMultiSelectConfirm = () => {
        if (localMultiSelect.length === 0) return;
        const joinedValues = localMultiSelect.map(item => item.value).join(", ");
        const joinedLabels = localMultiSelect.map(item => item.label).join(", ");
        onSend(joinedValues, joinedLabels);
        setLocalMultiSelect([]);
    };

    const isInputDisabled = isTyping;

    // Only get the messages for the current phase? 
    // The user wants the screen to clear on phase change.
    // If the global 'messages' array contains ALL history, we need to filter or the backend/App.jsx should clear it?
    // Actually, if App.jsx clears the 'messages' array on phase change, it's easier.
    // But if 'messages' has everything, we could filter by a phase marker.
    // The prompt said: "Implementen el vaciado de mensajes con una transición suave (fade-out/fade-in) por cada cambio de fase."
    // Let's assume App.jsx or the controller manages 'messages' array to only contain the current phase's messages, 
    // OR we just render the messages array as is, trusting the parent clears it.

    return (
        <div className="flex flex-col h-full bg-white relative w-full border-r border-slate-200 shadow-xl z-10">
            {/* MESSAGES AREA */}
            <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-6 bg-slate-50 custom-scrollbar z-10 relative overflow-x-hidden">
                <AnimatePresence mode="wait">
                    {fadeState === 'visible' && (
                        <motion.div 
                            key="chat-content"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6 pb-10"
                        >
                            {messages.map((msg, index) => {
                                const isLastMessage = index === messages.length - 1;
                                return (
                                <div
                                    key={index}
                                    className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"} mb-6 items-start gap-3`}
                                >
                                    {/* TILO AVATAR */}
                                    {msg.role === "assistant" && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="w-12 h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden"
                                        >
                                            <img src={tiloImg} alt="Tilo" className="w-10 h-10 flex-shrink-0 object-contain" />
                                        </motion.div>
                                    )}

                                    <div
                                        className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${msg.role === "assistant"
                                            ? msg.isBio
                                                ? "bg-purple-50 border-l-4 border-purple-500 text-purple-900 rounded-tl-none font-medium"
                                                : msg.isAcute
                                                    ? "bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-tl-none font-medium"
                                                    : msg.isCritical
                                                        ? "bg-red-50 border-l-4 border-red-500 text-red-900 rounded-tl-none font-bold"
                                                        : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                                            : "bg-blue-600 text-white rounded-tr-none"
                                            }`}
                                    >
                                        <div className={`prose prose-sm max-w-none ${msg.role === "assistant" ? "prose-slate" : "prose-invert"} w-full`}>
                                            {/* AI Bento Box for Triage/Analysis */}
                                            {msg.isAiAnalysisResult ? (
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex flex-col gap-2 mb-3 w-full">
                                                        <div className="px-4 py-2.5 bg-slate-50/80 backdrop-blur-sm border border-slate-200/50 rounded-xl text-sm font-semibold text-slate-700 shadow-sm flex items-center gap-3">
                                                            <span className="text-xl">👤</span> 
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Perfil</span>
                                                                <span>{patientAge < 18 ? `Pediátrico (${patientAge} años)` : `Adulto (${patientAge} años)`}</span>
                                                            </div>
                                                        </div>
                                                        <div className="px-4 py-2.5 bg-blue-50/80 backdrop-blur-sm border border-blue-100 rounded-xl text-sm font-semibold text-blue-700 shadow-sm flex items-center gap-3">
                                                            <span className="text-xl">🎯</span> 
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Eje Clínico</span>
                                                                <span>{routeToSpanish(msg.aiData?.primaryRoute || patientData?.clinical_context?.goal || "Análisis Clínico")}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`px-4 py-2.5 backdrop-blur-sm border rounded-xl text-sm font-semibold shadow-sm flex items-center gap-3 ${
                                                            msg.aiData?.redFlag ? 'bg-red-50/90 border-red-200 text-red-700' : 
                                                            (msg.aiData?.risk_level === 'HIGH' ? 'bg-amber-50/90 border-amber-200 text-amber-700' : 'bg-emerald-50/90 border-emerald-200 text-emerald-700')
                                                        }`}>
                                                            <span className="text-xl">⚠️</span> 
                                                            <div className="flex flex-col">
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                                    msg.aiData?.redFlag ? 'text-red-400' : 
                                                                    (msg.aiData?.risk_level === 'HIGH' ? 'text-amber-400' : 'text-emerald-500')
                                                                }`}>Nivel de Riesgo</span>
                                                                <span>{msg.aiData?.redFlag ? 'Crítico (Red Flag)' : riskToSpanish(msg.aiData?.risk_level || 'Base')}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-sm text-slate-700 mb-2">
                                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                    </div>

                                                    {msg.aiData?.reasoning && (
                                                        <div className="mt-2 p-3 bg-slate-50/40 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] relative overflow-hidden group">
                                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-purple-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                                            <details className="relative z-10 group/details">
                                                                <summary className="text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors list-none flex items-center gap-2">
                                                                    <svg className="w-3 h-3 text-slate-400 group-open/details:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                    </svg>
                                                                    Deducción Sugerida (Matriz IFM)
                                                                </summary>
                                                                <div className="mt-2 text-xs text-slate-600 leading-relaxed border-l-2 border-slate-200/80 pl-3 ml-1 bg-white/50 p-2 rounded-r-lg">
                                                                    <ReactMarkdown>{msg.aiData.reasoning}</ReactMarkdown>
                                                                </div>
                                                            </details>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            )}
                                        </div>

                                        {/* INLINE BUTTONS */}
                                        {msg.role === 'assistant' && msg.options && msg.options.length > 0 && (msg.options.length <= 3 || msg.isMultiSelect) && isLastMessage && (
                                            <div className="mt-4 flex flex-col gap-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {msg.options.map((opt, i) => {
                                                        const isSelected = msg.isMultiSelect && localMultiSelect.some(item => item.value === opt.value);
                                                        return (
                                                            <button
                                                                key={i}
                                                                disabled={isInputDisabled}
                                                                onClick={(e) => { e.preventDefault(); handleOptionSelect(msg, opt.value, opt.label); }}
                                                                className={`px-4 py-2 font-bold rounded-full text-xs transition-colors shadow-sm border disabled:opacity-50 disabled:cursor-not-allowed ${isSelected
                                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                                                                }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {msg.isMultiSelect && (
                                                    <button
                                                        onClick={handleMultiSelectConfirm}
                                                        disabled={localMultiSelect.length === 0 || isInputDisabled}
                                                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 max-w-sm"
                                                    >
                                                        Confirmar Selección
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* MENU SELECTOR FOR DISEASE OR RELATIVES (Fase 4 legacy) */}
                                        {msg.role === 'assistant' && msg.showMenu && isLastMessage && (
                                            <div className="mt-4 w-full relative z-50">
                                                 <SearchableVerticalMenu 
                                                    options={msg.options || []} 
                                                    onSelect={(val) => {
                                                        const opt = msg.options.find(o => o.value === val);
                                                        handleOptionSelect(msg, val, opt ? opt.label : val);
                                                    }}
                                                    embedded={true}
                                                />
                                            </div>
                                        )}

                                        {/* INFERENCE SPINNER */}
                                        {msg.inputType === 'analyzing' && (
                                            <div className="flex flex-col items-center py-4 space-y-3 animate-pulse mt-4">
                                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Sintetizando diagnóstico...</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                );
                            })}

                            {/* TYPING INDICATOR */}
                            {isTyping && (
                                <div className="flex justify-start mb-6 items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-12 h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden z-10"
                                    >
                                        <img src={tiloImg} alt="Tilo" className="w-10 h-10 flex-shrink-0 object-contain" />
                                    </motion.div>
                                    <div className="flex gap-4 animate-pulse">
                                        <div className="bg-white border border-slate-100 w-16 h-10 rounded-2xl rounded-tl-none shadow-sm flex items-center justify-center space-x-1">
                                            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {messages.length > 0 && (
                                messages[messages.length - 1].options?.length > 3 ||
                                messages[messages.length - 1].inputType === 'StateSelector' ||
                                messages[messages.length - 1].content.includes('Estado de la República')
                            ) && !messages[messages.length - 1].isMultiSelect && !isTyping && (
                                <div className="h-72 sm:h-80 w-full pointer-events-none" />
                            )}
                            <div ref={chatEndRef} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* INPUT AREA */}
            <div className="p-6 bg-white border-t border-slate-50 shrink-0 relative z-[60]">
                <div className="relative w-full max-w-3xl mx-auto flex flex-col items-center">
                    
                    {/* IDENTITY BIFURCATION SLOT */}
                    {identityBifurcationSlot && fadeState === 'visible' && (
                        <div className="w-full mb-2">
                            {identityBifurcationSlot}
                        </div>
                    )}

                    {/* CUSTOM INJECTED COMPONENT (E.g. VisualBodyMap) */}
                    {customInputSlot && fadeState === 'visible' && (
                        <div className="w-full mb-4">
                            {customInputSlot}
                        </div>
                    )}

                    {/* SEARCHABLE VERTICAL MENU (If > 3 options and not multi-select) */}
                    {messages.length > 0 && messages[messages.length - 1].options?.length > 3 && !messages[messages.length - 1].isMultiSelect && !isTyping && fadeState === 'visible' && (
                        <div className="w-full relative px-2 mb-2">
                            <SearchableVerticalMenu 
                                options={messages[messages.length - 1].options} 
                                onSelect={(val) => {
                                    const opt = messages[messages.length - 1].options.find(o => o.value === val);
                                    handleOptionSelect(messages[messages.length - 1], val, opt ? opt.label : val);
                                }}
                                searchQuery={inputValue}
                                setSearchQuery={setInputValue}
                            />
                        </div>
                    )}

                    {/* STANDARD TEXT INPUT */}
                    {(!messages[messages.length - 1]?.options || messages[messages.length - 1]?.options?.length === 0) && !customInputSlot && (
                        <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2 bg-white border border-slate-200 rounded-full px-2 py-2 shadow-sm focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-400 transition-all w-full z-10">
                            {messages.length > 0 && messages[messages.length - 1].inputType === 'none' ? (
                                <div className="flex-1 px-3 py-2 text-slate-400 text-sm italic flex items-center justify-center">
                                    Entrada bloqueada temporalmente.
                                </div>
                            ) : messages.length > 0 && messages[messages.length - 1].inputType === 'strict_select' ? (
                                <div className="flex-1 px-3 py-2 text-slate-400 text-sm italic border-l border-slate-100 flex items-center">
                                    Por favor, seleccione una opción de los botones de arriba.
                                </div>
                            ) : (
                                <input
                                    type={(messages.length > 0 && messages[messages.length - 1].inputType === 'tel') || (currentPhase && currentPhase.includes('_PHONE')) ? 'tel' : 'text'}
                                    value={inputValue}
                                    onChange={(e) => {
                                        if ((messages.length > 0 && messages[messages.length - 1].inputType === 'tel') || (currentPhase && currentPhase.includes('_PHONE'))) {
                                            let val = e.target.value.replace(/\D/g, '');
                                            if (val.length > 10) val = val.slice(0, 10);
                                            if (val.length > 6) {
                                                val = `(${val.slice(0,3)}) ${val.slice(3,6)}-${val.slice(6)}`;
                                            } else if (val.length > 3) {
                                                val = `(${val.slice(0,3)}) ${val.slice(3)}`;
                                            } else if (val.length > 0) {
                                                val = `(${val}`;
                                            }
                                            setInputValue(val);
                                        } else {
                                            setInputValue(e.target.value);
                                        }
                                    }}
                                    placeholder={isInputDisabled ? "Cargando..." : "Escribe aquí..."}
                                    className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-sm h-10 px-2 disabled:opacity-50"
                                    disabled={isInputDisabled}
                                />
                            )}
                            {messages.length === 0 || (messages[messages.length - 1].inputType !== 'strict_select' && messages[messages.length - 1].inputType !== 'none') ? (
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isInputDisabled}
                                    className="bg-[#1C75BC] text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#155a8a] transition-transform active:scale-95 shadow-md flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            ) : null}
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatView;
