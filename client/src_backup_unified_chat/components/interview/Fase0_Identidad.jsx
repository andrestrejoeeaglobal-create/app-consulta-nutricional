import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { ShieldCheck, User, Calendar, MapPin, CheckCircle2, Zap, Send } from 'lucide-react';
import { formatText, applyPhoneMask } from '../../utils/utils';
import tiloImg from '../../assets/tilo.png';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';

export const Fase0_Identidad = ({
    onPhaseComplete,
    initialChatHistory = []
}) => {
    const chatEndRef = useRef(null);
    const starterMessage = {
        role: 'assistant',
        content: "Hola. Soy el Asistente Clínico. Para aperturar su expediente bajo la NOM-004, necesito validar su identidad.\n\n¿Podría proporcionarme su **Nombre Completo** (comenzando por nombres)?"
    };

    const [messages, setMessages] = useState(initialChatHistory.length > 0 ? initialChatHistory : [starterMessage]);
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [step, setStep] = useState('intro_name');

    // CONEXION ASINCRONA
    const identityLock = useClinicalGenome(state => state.identityLock);
    const updateIdentityLock = useClinicalGenome(state => state.updateIdentityLock);

    const handleSend = (text, directValue = null) => {
        const rawMsg = directValue !== null ? directValue : text;
        if (!rawMsg.trim()) return;

        const displayMsg = rawMsg;
        const newMessages = [...messages, { role: 'user', content: displayMsg }];
        setMessages(newMessages);
        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            const cleanText = formatText(rawMsg.trim());
            let nextStep = step;
            let responseMsg = "";
            let options = null;

            switch (step) {
                case 'intro_name':
                    updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, name: cleanText } });
                    responseMsg = "Por norma oficial requerimos su **CURP** para su validación en RENAPO. ¿Podría escribírmela a continuación?";
                    nextStep = 'intro_curp';
                    break;
                case 'intro_curp':
                    // Integridad conectada en Hooks
                    updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, curp: cleanText.toUpperCase() }, curpValidated: true });
                    responseMsg = "Validando identidad con RENAPO... ¿Cuál es su **teléfono celular** a 10 dígitos?";
                    nextStep = 'intro_phone';
                    break;
                case 'intro_phone': {
                    const phoneInput = cleanText.replace(/\D/g, '');
                    if (phoneInput.length !== 10) {
                        responseMsg = "Por favor ingrese un número de teléfono celular válido a 10 dígitos.";
                        nextStep = 'intro_phone';
                        break;
                    }
                    updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, phone: phoneInput } });
                    const pInfo = { ...identityLock.patientInfo, phone: phoneInput };
                    responseMsg = `A continuación, le presento un resumen de los datos capturados:\n\n` +
                                  `**Nombre Completo:** ${pInfo.name}\n` +
                                  `**CURP:** ${pInfo.curp}\n` +
                                  `**Teléfono Celular:** ${applyPhoneMask(pInfo.phone)}\n\n` +
                                  `¿Son correctos estos datos?`;
                    options = [
                        { label: "✅ SÍ, SON CORRECTOS", value: "CONFIRM_DATA" },
                        { label: "❌ NO, CORREGIR DATOS", value: "CORRECT_DATA" }
                    ];
                    nextStep = 'intro_review';
                    break;
                }
                case 'intro_review': {
                    if (directValue === 'CONFIRM_DATA') {
                        responseMsg = "Perfil de identidad completado transitoriamente. Transfiriendo control...";
                        nextStep = 'completed';
                    } else {
                        responseMsg = "Entendido, vamos a corregir los datos.\n\n¿Podría proporcionarme su **Nombre Completo** (comenzando por nombres) nuevamente?";
                        nextStep = 'intro_name';
                    }
                    break;
                }
                default:
                    responseMsg = "Esta sección ha concluido.";
                    break;
            }

            setMessages(prev => [...prev, { role: 'assistant', content: responseMsg, options }]);
            setStep(nextStep);
            setIsAnalyzing(false);

            if (nextStep === 'completed') {
                setTimeout(() => {
                    onPhaseComplete && onPhaseComplete();
                }, 1500);
            }
        }, 800);
    };

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handlePhoneChange = (e) => {
        setInputValue(applyPhoneMask(e.target.value));
    };

    return (
        <div className="flex h-full w-full bg-[#F8FAFC] overflow-hidden font-sans">
            <div className="w-full flex flex-col border-r border-slate-200 bg-white">
                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/10">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm flex-shrink-0 ${msg.role === 'user' ? 'bg-[#1C75BC] text-white' : 'bg-white border border-slate-200 overflow-hidden'}`}>
                                {msg.role === 'user' ? 'YO' : <img src={tiloImg} alt="Tilo" className="w-6 h-6 object-contain" />}
                            </div>
                            <div className={`p-4 rounded-2xl text-sm shadow-sm leading-relaxed max-w-[80%] whitespace-pre-line ${msg.role === 'user' ? 'bg-[#1C75BC] text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-700'}`}>
                                {msg.content}
                                {msg.role === 'assistant' && idx === messages.length - 1 && messages[messages.length - 1].options?.length > 0 && messages[messages.length - 1].options?.length <= 3 && !isAnalyzing && step !== 'completed' && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {messages[messages.length - 1].options.map((opt, oIdx) => (
                                            <button
                                                key={oIdx}
                                                onClick={() => handleSend(opt.label, opt.value)}
                                                className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-full text-xs hover:bg-blue-200 transition-colors shadow-sm border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={isAnalyzing || step === 'completed'}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isAnalyzing && (
                        <div className="flex gap-4 animate-pulse ml-11">
                            <div className="bg-slate-100 border border-slate-200 w-20 h-8 rounded-2xl rounded-tl-none"></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* INPUT ZONE */}
                <div className="p-6 bg-white border-t border-slate-100 relative z-[60]">
                    <div className="relative w-full max-w-3xl mx-auto flex flex-col items-center">
                        {messages[messages.length - 1]?.options?.length > 3 && !isAnalyzing && step !== 'completed' && (
                            <SearchableVerticalMenu
                                options={messages[messages.length - 1].options}
                                onSelect={(val) => {
                                    const opt = messages[messages.length - 1].options.find(o => o.value === val);
                                    handleSend(opt.label, opt.value);
                                }}
                            />
                        )}
                        

                        
                        <form onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }} className="flex items-center gap-3 w-full bg-slate-50 p-2 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-inner relative z-10">
                        <input
                            type={step.includes('phone') ? 'tel' : 'text'}
                            value={inputValue} onChange={step.includes('phone') ? handlePhoneChange : (e) => setInputValue(e.target.value)}
                            placeholder={step.includes('phone') ? "(123) 456-7890" : "Escribe tu respuesta..."} className="flex-1 bg-transparent border-none focus:ring-0 px-6 text-sm py-2 outline-none disabled:opacity-50"
                            disabled={isAnalyzing || step === 'completed'}
                        />
                        <button type="submit" disabled={!inputValue.trim() || isAnalyzing || step === 'completed'} className="w-10 h-10 bg-[#1C75BC] text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform hover:bg-[#155a8a] disabled:opacity-50 flex-shrink-0">
                            <Send size={18} />
                        </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Fase0_Identidad;
