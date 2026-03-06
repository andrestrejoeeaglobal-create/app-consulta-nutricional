import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { Zap, ShieldCheck, User, Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import { formatText } from '../../utils/utils';
import tiloImg from '../../assets/tilo.png';

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

    const handleSend = (text) => {
        if (!text.trim()) return;

        const newMessages = [...messages, { role: 'user', content: text }];
        setMessages(newMessages);
        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            const cleanText = formatText(text.trim());
            let nextStep = step;
            let responseMsg = "";

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
                    updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, phone: cleanText } });
                    responseMsg = "Queda registrado.\n\nPerfil de identidad completado transitoriamente. Transferiendo control...";
                    nextStep = 'completed';
                    break;
                }
                default:
                    responseMsg = "Esta sección ha concluido.";
                    break;
            }

            setMessages(prev => [...prev, { role: 'assistant', content: responseMsg }]);
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
                <div className="p-6 bg-white border-t border-slate-100">
                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-inner">
                        <input
                            type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend(inputValue)}
                            placeholder="Escribe tu respuesta..." className="flex-1 bg-transparent border-none focus:ring-0 px-6 text-sm py-2 outline-none"
                            disabled={isAnalyzing || step === 'completed'}
                        />
                        <button onClick={() => handleSend(inputValue)} disabled={isAnalyzing || step === 'completed'} className="w-10 h-10 bg-[#1C75BC] text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform hover:bg-[#155a8a]">
                            <Zap size={18} fill="currentColor" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Fase0_Identidad;
