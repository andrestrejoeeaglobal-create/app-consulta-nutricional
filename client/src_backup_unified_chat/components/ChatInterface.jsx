import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Mic, Send } from 'lucide-react';
import SearchableVerticalMenu from './ui/SearchableVerticalMenu';
import { applyPhoneMask } from '../utils/utils';

const ChatInterface = ({
    messages = [],
    onSendMessage,
    isTyping = false,
    currentInputType = 'text',
    inputAreaTopAddon = null, // Controles adicionales encima del input
    customInputControl = null, // Reemplaza solo el campo de texto interno
    hideDefaultInputArea = false // Oculta TODO el área de input
}) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Auto-scroll smooth al recibir nuevos mensajes o cuando Tilo está tipeando
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = () => {
        if (!input.trim() && !customInputControl) return;
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        } else {
            onSendMessage(); // Allows parent component to handle logic when customInputControl is used
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleQuickReply = (reply) => {
        onSendMessage(reply);
    };

    const handleFileChange = (e) => {
        // Lógica de archivo (Placeholder visual por ahora)
        if (e.target.files && e.target.files[0]) {
            console.log("Archivo seleccionado:", e.target.files[0].name);
        }
    };

    const lastMsg = messages[messages.length - 1];
    const hasOptions = !isTyping && lastMsg && lastMsg.role === 'assistant' && (lastMsg.options || lastMsg.quickReplies);
    const optionsArray = hasOptions ? (lastMsg.options || lastMsg.quickReplies) : [];

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 font-sans shadow-inner relative z-10">

            {/* Área de Mensajes */}
            <div className="flex-1 h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 custom-scrollbar z-10 relative pb-32">
                {messages.map((msg, index) => {
                    const isUser = msg.role === 'user';

                    return (
                        <div key={index} className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}>
                            {/* Burbuja Principal */}
                            <div className={`shadow-sm text-sm leading-relaxed whitespace-pre-wrap max-w-[85%] md:max-w-[75%] p-4 ${isUser
                                ? 'bg-[#1C75BC] text-white rounded-2xl rounded-tr-none'
                                : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-none'
                                }`}>
                                {msg.content}
                                {!isUser && index === messages.length - 1 && !isTyping && (msg.options || msg.quickReplies) && (msg.options || msg.quickReplies).length > 0 && (msg.options || msg.quickReplies).length <= 3 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {(msg.options || msg.quickReplies).map((opt, oIdx) => {
                                            const label = opt.label || opt;
                                            const value = opt.value || opt;
                                            return (
                                                <button
                                                    key={oIdx}
                                                    onClick={(e) => { e.preventDefault(); handleQuickReply(value); }}
                                                    className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-full text-xs hover:bg-blue-200 transition-colors shadow-sm border border-blue-200"
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Indicador de Escritura (Typing) */}
                {isTyping && (
                    <div className="flex items-start w-full">
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-4 shadow-sm flex items-center justify-center gap-1.5 h-[52px]">
                            {/* Simulando hexágonos rebotando en cascada */}
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-[#1C75BC] animate-bounce"
                                    style={{
                                        animationDelay: `${(i - 1) * 0.15}s`,
                                        animationDuration: '1s'
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Elemento ancla para auto-scroll */}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area (Barra inferior anclada) */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
                <div className="relative w-full max-w-3xl mx-auto flex flex-col items-center">
                    {/* Render Options according to Rule */}
                    {optionsArray.length > 3 && (
                        <SearchableVerticalMenu 
                            options={optionsArray.map(opt => ({ label: opt.label || opt, value: opt.value || opt }))} 
                            onSelect={handleQuickReply} 
                        />
                    )}

                    {inputAreaTopAddon && (
                        <div className="mb-3 w-full">
                            {inputAreaTopAddon}
                        </div>
                    )}

                    {hideDefaultInputArea ? null : (
                        <div className="w-full bg-white border border-slate-200 rounded-full px-2 py-2 flex items-center gap-2 shadow-md focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-400 transition-all relative z-10">
                        {/* Botón Clip para adjuntos */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 text-slate-400 hover:text-[#1C75BC] hover:bg-blue-50 rounded-full transition-colors flex-shrink-0"
                            title="Adjuntar archivo clínico"
                        >
                            <Paperclip size={20} />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".pdf,.html,.htm,.png,.jpg,.jpeg"
                            className="hidden"
                        />

                        {/* Input Principal / Custom Control */}
                        {customInputControl ? (
                            customInputControl
                        ) : (
                            <input
                                type={currentInputType === 'date' ? 'text' : currentInputType}
                                value={input}
                                onChange={(e) => {
                                    if (currentInputType === 'tel') {
                                        setInput(applyPhoneMask(e.target.value));
                                    } else {
                                        setInput(e.target.value);
                                    }
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={currentInputType === 'date' ? "DD/MM/AAAA" : "Escribe un mensaje al Asistente..."}
                                className={`flex-1 bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 text-sm outline-none px-2 h-10 ${currentInputType === 'date' ? 'font-mono text-[#1C75BC] tracking-widest' : ''}`}
                                disabled={isTyping}
                                autoComplete="off"
                            />
                        )}

                        {/* Controles Derechos */}
                        <div className="flex items-center gap-1 pr-1">
                            {/* Botón Micrófono Placeholder */}
                            <button
                                disabled
                                className="p-2 text-slate-300 opacity-50 cursor-not-allowed rounded-full flex-shrink-0"
                                title="Dictado por voz (Próximamente)"
                            >
                                <Mic size={20} />
                            </button>

                            {/* Botón Enviar */}
                            <button
                                onClick={handleSend}
                                disabled={(!input.trim() && !customInputControl) || isTyping}
                                className="bg-blue-600 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-700 transition-transform active:scale-95 shadow-md flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Enviar mensaje"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
