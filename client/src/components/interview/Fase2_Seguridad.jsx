import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { Zap, ShieldCheck, Send } from 'lucide-react';
import { formatText } from '../../utils/utils';
import { getBinaryGateLabels } from '../../utils/ageClassifier';
import tiloImg from '../../assets/tilo.png';

export const Fase2_Seguridad = ({
    onPhaseComplete,
    initialChatHistory = []
}) => {
    const chatEndRef = useRef(null);
    const identityLock = useClinicalGenome(state => state.identityLock);
    const updateIdentityLock = useClinicalGenome(state => state.updateIdentityLock);

    const patientAge = identityLock.patientInfo?.age || 30;
    const patientPhone = identityLock.patientInfo?.phone || "";

    // 1. Trifurcación de Tono
    const getStarterMessage = () => {
        if (patientAge < 12) {
            return "Por seguridad del menor, necesitamos registrar un contacto responsable. ¿Cuál es el nombre completo de la persona a contactar en caso de emergencia?";
        } else if (patientAge >= 12 && patientAge <= 17) {
            return "Por tu seguridad, necesitamos registrar un contacto responsable. ¿A quién podemos contactar por ti en caso de emergencia? (Dime su nombre completo)";
        } else {
            return "Por protocolo de seguridad clínica, requerimos un contacto de emergencia. ¿Cuál es el nombre completo de la persona a contactar?";
        }
    };

    const starterMessage = {
        role: 'assistant',
        content: getStarterMessage()
    };

    const [messages, setMessages] = useState(initialChatHistory.length > 0 ? initialChatHistory : [starterMessage]);
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [step, setStep] = useState('emergency_name');

    // Infieren relación sugerida basados en edad
    const getKinshipOptions = () => {
        if (patientAge < 18) {
            return [
                { label: "Abuelo(a)", value: "Abuelo/a" },
                { label: "Hermano(a) Mayor", value: "Hermano/a" },
                { label: "Madre", value: "Madre" },
                { label: "Padre", value: "Padre" },
                { label: "Tutor(a) Legal", value: "Tutor Legal" }
            ];
        }
        return [
            { label: "Amigo(a)", value: "Amigo/a" },
            { label: "Esposo(a) / Pareja", value: "Pareja" },
            { label: "Hermano(a)", value: "Hermano/a" },
            { label: "Hijo(a)", value: "Hijo/a" },
            { label: "Madre", value: "Madre" },
            { label: "Padre", value: "Padre" }
        ];
    };

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
                case 'emergency_name':
                    updateIdentityLock({ emergencyContact: { ...identityLock.emergencyContact, name: cleanText } });

                    if (patientAge < 12) {
                        responseMsg = `¿Qué parentesco tiene ${cleanText} con el o la menor?`;
                    } else if (patientAge >= 12 && patientAge <= 17) {
                        responseMsg = `¿Qué es ${cleanText} tuyo?`;
                    } else {
                        responseMsg = `¿Qué parentesco tiene ${cleanText} con usted?`;
                    }

                    options = getKinshipOptions();
                    nextStep = 'emergency_rel';
                    break;

                case 'emergency_rel':
                    updateIdentityLock({ emergencyContact: { ...identityLock.emergencyContact, relation: cleanText } });

                    if (patientAge < 18) {
                        responseMsg = `Por favor, escríbeme el **número de teléfono** a 10 dígitos de ${identityLock.emergencyContact.name}.`;
                    } else {
                        responseMsg = `Para finalizar este bloque, ¿me proporciona el **número de teléfono** de ${identityLock.emergencyContact.name}? (10 dígitos)`;
                    }
                    nextStep = 'emergency_phone';
                    break;

                case 'emergency_phone': {
                    // Limpiar teléfono
                    const phoneInput = cleanText.replace(/\D/g, '');

                    if (phoneInput.length !== 10) {
                        responseMsg = "El número ingresado no tiene 10 dígitos. Por favor, verifíquelo e intente nuevamente:";
                        break;
                    }

                    // 4. Validación de Redundancia (Inmunidad)
                    if (phoneInput === patientPhone) {
                        if (patientAge >= 12) {
                            // Hard Stop para Adolescentes y Adultos
                            responseMsg = "🚫 **Alerta de Redundancia**\n\nEl número ingresado es idéntico a su número personal. Por normativas de seguridad en emergencias, debe proveer un número de contacto **distinto** al suyo. Intente de nuevo:";
                            break;
                        } else {
                            // Bifurcación Empática para Lactantes y Escolares (< 12)
                            responseMsg = "He notado que el número de emergencia es el mismo que el registrado inicialmente. ¿Desea mantener este mismo número para contactar a su tutor?";
                            options = [
                                { label: "No, usar otro", value: "CHANGE_PHONE" },
                                { label: "Sí, mantener número", value: "CONFIRM_SAME_PHONE" }
                            ];
                            nextStep = 'emergency_phone_confirm_same';
                            break;
                        }
                    }

                    updateIdentityLock({ emergencyContact: { ...identityLock.emergencyContact, phone: phoneInput }, verified: true });
                    const eContact = { ...identityLock.emergencyContact, phone: phoneInput };
                    const { confirmLabel, rejectLabel } = getBinaryGateLabels(patientAge, identityLock.patientInfo?.sex || 'Femenino');
                    
                    responseMsg = `A continuación, le presento un resumen de la Red de Apoyo capturada:\n\n` +
                                  `**Contacto de Emergencia:** ${eContact.name}\n` +
                                  `**Parentesco/Relación:** ${eContact.relation}\n` +
                                  `**Teléfono de Emergencia:** ${eContact.phone}\n\n` +
                                  `¿Son correctos estos datos?`;
                                  
                    options = [
                        { label: confirmLabel, value: "CONFIRM_DATA" },
                        { label: rejectLabel, value: "CORRECT_DATA" }
                    ];
                    nextStep = 'emergency_review';
                    break;
                }

                case 'emergency_phone_confirm_same':
                    if (directValue === "CONFIRM_SAME_PHONE") {
                        const previousPhone = identityLock.patientInfo?.phone;
                        updateIdentityLock({ emergencyContact: { ...identityLock.emergencyContact, phone: previousPhone }, verified: true });
                        const eContact = { ...identityLock.emergencyContact, phone: previousPhone };
                        const { confirmLabel, rejectLabel } = getBinaryGateLabels(patientAge, identityLock.patientInfo?.sex || 'Femenino');
                        
                        responseMsg = `A continuación, le presento un resumen de la Red de Apoyo capturada:\n\n` +
                                      `**Contacto de Emergencia:** ${eContact.name}\n` +
                                      `**Parentesco/Relación:** ${eContact.relation}\n` +
                                      `**Teléfono de Emergencia:** ${eContact.phone}\n\n` +
                                      `¿Son correctos estos datos?`;
                                      
                        options = [
                            { label: confirmLabel, value: "CONFIRM_DATA" },
                            { label: rejectLabel, value: "CORRECT_DATA" }
                        ];
                        nextStep = 'emergency_review';
                    } else {
                        responseMsg = "De acuerdo. Por favor, escriba el **nuevo número** telefónico de emergencia (10 dígitos):";
                        nextStep = 'emergency_phone';
                    }
                    break;

                case 'emergency_review': {
                    if (directValue === 'CONFIRM_DATA') {
                        responseMsg = "Red de apoyo establecida exitosamente. Identidad Blindada completada. ✅";
                        nextStep = 'completed';
                    } else {
                        responseMsg = "Entendido, vamos a corregir los datos.\n\n" + getStarterMessage();
                        nextStep = 'emergency_name';
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
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 10) val = val.slice(0, 10);
        let formatted = val;
        if (val.length > 6) {
            formatted = `(${val.slice(0, 3)}) ${val.slice(3, 6)}-${val.slice(6)}`;
        } else if (val.length > 3) {
            formatted = `(${val.slice(0, 3)}) ${val.slice(3)}`;
        } else if (val.length > 0) {
            formatted = `(${val}`;
        }
        setInputValue(formatted);
    };

    return (
        <div className="flex h-full w-full bg-[#F8FAFC] overflow-hidden font-sans">
            <div className="w-full flex flex-col border-r border-slate-200 bg-white">
                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/10">
                    <div className="flex w-full items-center justify-center pb-4">
                        <div className="bg-blue-50 text-[#1C75BC] text-xs font-semibold px-4 py-1.5 rounded-full border border-blue-100 flex items-center gap-2">
                            <ShieldCheck size={14} /> FASE 2: RED DE APOYO NOM-004
                        </div>
                    </div>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`animate-in fade-in slide-in-from-bottom-2`}>
                            <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm flex-shrink-0 ${msg.role === 'user' ? 'bg-[#1C75BC] text-white' : 'bg-white border border-slate-200 overflow-hidden'}`}>
                                    {msg.role === 'user' ? 'YO' : <img src={tiloImg} alt="Tilo" className="w-6 h-6 object-contain" />}
                                </div>
                                <div className={`p-4 rounded-2xl text-sm shadow-sm leading-relaxed max-w-[80%] whitespace-pre-line ${msg.role === 'user' ? 'bg-[#1C75BC] text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-700'}`}>
                                    {msg.content}
                                    
                                    {/* Render Options if any (Only for the latest message from assistant) */}
                                    {msg.options && msg.role === 'assistant' && idx === messages.length - 1 && msg.options.length > 0 && (
                                        <div className="mt-4 flex flex-col gap-2">
                                            {msg.options.map((opt, oIdx) => (
                                                <button
                                                    key={oIdx}
                                                    onClick={() => handleSend(opt.label, opt.value)}
                                                    className="w-full text-left px-4 py-3 rounded-lg border border-[#1C75BC] text-[#1C75BC] hover:bg-[#1C75BC] hover:text-white transition-all duration-200 font-medium bg-white"
                                                    disabled={isAnalyzing || step === 'completed'}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isAnalyzing && (
                        <div className="flex gap-4 animate-pulse ml-11 mt-4">
                            <div className="bg-slate-100 border border-slate-200 w-20 h-8 rounded-2xl rounded-tl-none"></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-6 bg-white border-t border-slate-100">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }} className="flex items-center gap-3 bg-slate-50 p-2 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-inner">
                        <input
                            type={step.includes('phone') ? 'tel' : 'text'}
                            value={inputValue} onChange={step.includes('phone') ? handlePhoneChange : (e) => setInputValue(e.target.value)}
                            placeholder={step.includes('phone') ? "(123) 456-7890" : "Escribe tu respuesta..."} className="flex-1 bg-transparent border-none focus:ring-0 px-6 text-sm py-2 outline-none"
                            disabled={isAnalyzing || step === 'completed'}
                        />
                        <button type="submit" disabled={isAnalyzing || step === 'completed'} className="bg-blue-600 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-700 transition-transform active:scale-95 shadow-md flex-shrink-0">
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Fase2_Seguridad;
