import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import tiloImg from '../../assets/tilo.png';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

const Fase13_ContextoEspecial = ({ patientData, setPatientData, onPhaseComplete }) => {
    const ptCtx = patientData?.profile?.pediatric_profile;
    const isMinor = ptCtx?.is_minor === true;
    const pName = (patientData?.identityLock?.name || patientData?.identificacion?.nombres || "la menor").split(' ')[0];
    // ------------------------------------------------------------------------
    // STATE: Mantenemos un array local de mensajes estilo chat
    // ------------------------------------------------------------------------
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(true);

    // Auto-scroll
    const messagesEndRef = useRef(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // ------------------------------------------------------------------------
    // INICIALIZACIÓN: Pregunta de entrada ("Fase 7: Contexto Especial")
    // ------------------------------------------------------------------------
    useEffect(() => {
        const timer = setTimeout(() => {
            setMessages([
                {
                    role: "assistant",
                    content: `Entendido.\n\nFase 7: Contexto Especial.\n\n${isMinor ? `¿Ha tenido ${pName} cirugías recientes, padece algún síndrome o situación particular importante para su plan nutricional?` : `¿Ha tenido cirugías recientes, padece algún síndrome o situación particular importante para su plan nutricional?`}`,
                    avatar: tiloImg
                }
            ]);
            setIsTyping(false);
        }, 600);
        return () => clearTimeout(timer);
    }, [isMinor, pName]);

    // ------------------------------------------------------------------------
    // MANEJO DE LA RESPUESTA
    // ------------------------------------------------------------------------
    const handleSend = (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const userText = inputValue;
        setInputValue("");

        // 1. Mostrar mensaje del usuario
        setMessages(prev => [...prev, { role: "user", content: userText }]);
        setIsTyping(true);

        // 2. Guardar el contexto en patientData
        setPatientData(prev => ({
            ...prev,
            history: {
                ...prev.history,
                special_context: userText
            }
        }));

        // 3. Simular procesamiento y finalizar
        setTimeout(() => {
            const finalReply = {
                role: "assistant",
                content: `Excelente. He terminado de recabar todos los datos. Iniciare el análisis para generar el Diagnóstico Integral${isMinor ? ` de ${pName}` : ''}.`,
                avatar: tiloImg,
                inputType: 'analyzing'
            };

            setMessages(prev => {
                const newMessages = [...prev, finalReply];
                // Pasar los mensajes de vuelta a App.jsx si se necesita rendering final,
                // e indicar la transición a la siguiente etapa de orquestación (Fase 14/15)
                setTimeout(() => {
                    if (onPhaseComplete) {
                        onPhaseComplete(newMessages, 'PHASE_14_ORCHESTRATION_START');
                    }
                }, 2000); // 2 segundos para ver el spinner de 'analyzing'
                return newMessages;
            });
            setIsTyping(false);
        }, 1000);
    };

    // ------------------------------------------------------------------------
    // RENDER UI (Mismo estilo que App.jsx chat)
    // ------------------------------------------------------------------------
    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Contenedor de Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar z-10 relative">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"} items-start gap-3`}
                    >
                        {msg.role === "assistant" && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden"
                            >
                                <img src={msg.avatar || tiloImg} alt="Tilo" className="w-full h-full object-cover" />
                            </motion.div>
                        )}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-2xl max-w-[85%] md:max-w-[75%] shadow-sm ${msg.role === "assistant"
                                ? "bg-white border text-slate-700 rounded-tl-none"
                                : "bg-blue-600 text-white rounded-tr-none"
                                }`}
                        >
                            <div className={`prose prose-sm max-w-none ${msg.role === "assistant" ? "prose-slate" : "prose-invert"}`}>
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>

                            {/* Mostrar spinner si estamos en estado analyzing */}
                            {msg.inputType === 'analyzing' && (
                                <div className="flex flex-col items-center py-4 space-y-3 animate-pulse mt-4 border-t pt-4 border-slate-100">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Sintetizando diagnóstico...</p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start items-start gap-3 fade-in">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden">
                            <img src={tiloImg} alt="Tilo" className="w-full h-full object-cover" />
                        </div>
                        <div className="p-4 bg-white border text-slate-700 rounded-2xl rounded-tl-none flex items-center gap-1 shadow-sm">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <form onSubmit={handleSend} className="relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Escribe tu respuesta..."
                        className="w-full p-4 pr-16 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm md:text-base transition-shadow"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="absolute right-2 top-2 bottom-2 aspect-square bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 flex items-center justify-center transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Fase13_ContextoEspecial;
