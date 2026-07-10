import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { Zap, ShieldCheck, Send } from 'lucide-react';
import { formatText, applyPhoneMask } from '../../utils/utils';
import { getBinaryGateLabels } from '../../utils/ageClassifier';
import tiloImg from '../../assets/tilo.png';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';

export const Fase2_Seguridad = ({
    onPhaseComplete,
    initialChatHistory = []
}) => {
    const chatEndRef = useRef(null);
    const identityLock = useClinicalGenome(state => state.identityLock);
    const updateIdentityLock = useClinicalGenome(state => state.updateIdentityLock);

    const patientAge = identityLock.patientInfo?.age || 30;
    const patientPhone = identityLock.patientInfo?.phone || "";

    const getStarterMessage = () => {
        if (patientAge < 12) {
            return "Para garantizar la integridad del menor conforme a los lineamientos de asistencia clínica infantil, requerimos documentar una Red de Apoyo Primario.\n\n---\n\n¿Cuál es el nombre completo del tutor o responsable a contactar?";
        } else if (patientAge >= 12 && patientAge <= 17) {
            return "Para asegurar tu bienestar bajo el protocolo de asistencia a menores, requerimos establecer tu Red de Apoyo Primario.\n\n---\n\n¿Cuál es el nombre completo de la persona a contactar?";
        } else {
            return "Para garantizar su respaldo clínico conforme a la normatividad de seguridad de pacientes, requerimos documentar su Red de Apoyo Primario.\n\n---\n\n¿Cuál es el nombre completo de la persona a contactar?";
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
                        responseMsg = `Para establecer el nivel de autoridad clínica sobre las decisiones del paciente, es necesario definir la relación familiar.\n\n---\n\n¿Qué parentesco tiene ${cleanText} con el menor?`;
                    } else if (patientAge >= 12 && patientAge <= 17) {
                        responseMsg = `Para establecer la vía de comunicación principal de su Red de Apoyo Primario, es necesario definir la relación familiar.\n\n---\n\n¿Qué parentesco tiene ${cleanText} con usted?`;
                    } else {
                        responseMsg = `Para establecer la vía de comunicación principal de su Red de Apoyo Primario, es necesario definir la relación familiar.\n\n---\n\n¿Qué parentesco tiene ${cleanText} con usted?`;
                    }

                    options = getKinshipOptions();
                    nextStep = 'emergency_rel';
                    break;

                case 'emergency_rel':
                    updateIdentityLock({ emergencyContact: { ...identityLock.emergencyContact, relation: cleanText } });

                    if (patientAge < 18) {
                        responseMsg = `Para habilitar la vía de comunicación de emergencia, requerimos registrar el número telefónico de ${identityLock.emergencyContact.name}.\n\n---\n\nPor favor, escriba el **número de teléfono** a 10 dígitos.`;
                    } else {
                        responseMsg = `Para habilitar la vía de comunicación de emergencia, requerimos registrar el número telefónico de ${identityLock.emergencyContact.name}.\n\n---\n\nPor favor, escriba el **número de teléfono** a 10 dígitos.`;
                    }
                    nextStep = 'emergency_phone';
                    break;

                case 'emergency_phone': {
                    // Limpiar teléfono
                    const phoneInput = cleanText.replace(/\D/g, '');

                    if (phoneInput.length !== 10) {
                        responseMsg = "El número ingresado no cumple con el formato de 10 dígitos requerido para contacto de emergencia.\n\n---\n\nPor favor, verifíquelo e intente nuevamente:";
                        break;
                    }

                    // 4. Validación de Redundancia (Inmunidad)
                    if (phoneInput === patientPhone) {
                        if (patientAge >= 12) {
                            // Hard Stop para Adolescentes y Adultos
                            responseMsg = "🚫 **Alerta de Redundancia**\n\nEl número ingresado es idéntico a su número personal. Las normativas de seguridad exigen proveer un número de contacto **distinto** al suyo.\n\n---\n\nPor favor, intente con otro número:";
                            break;
                        } else {
                            // Bifurcación Empática para Lactantes y Escolares (< 12)
                            responseMsg = "Se ha detectado coincidencia con el número principal registrado. Para menores de edad, es aceptable utilizar la misma vía de contacto.\n\n---\n\n¿Desea mantener este mismo número para contactar al tutor?";
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
                    
                    responseMsg = `Hemos recopilado la información necesaria para establecer su Red de Apoyo conforme al protocolo clínico.\n\n---\n\n**Contacto:** ${eContact.name}\n**Relación:** ${eContact.relation}\n**Teléfono:** ${applyPhoneMask(eContact.phone)}\n\n¿Confirma que estos datos son correctos?`;
                                  
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
                        
                        responseMsg = `Hemos recopilado la información necesaria para establecer su Red de Apoyo conforme al protocolo clínico.\n\n---\n\n**Contacto:** ${eContact.name}\n**Relación:** ${eContact.relation}\n**Teléfono:** ${applyPhoneMask(eContact.phone)}\n\n¿Confirma que estos datos son correctos?`;
                                      
                        options = [
                            { label: confirmLabel, value: "CONFIRM_DATA" },
                            { label: rejectLabel, value: "CORRECT_DATA" }
                        ];
                        nextStep = 'emergency_review';
                    } else {
                        responseMsg = "Procederemos a registrar un número alternativo para la Red de Apoyo.\n\n---\n\nPor favor, escriba el **nuevo número** telefónico de emergencia a 10 dígitos:";
                        nextStep = 'emergency_phone';
                    }
                    break;

                case 'emergency_review': {
                    if (directValue === 'CONFIRM_DATA') {
                        responseMsg = "Red de Apoyo Primario establecida exitosamente. Identidad Blindada completada. ✅";
                        nextStep = 'completed';
                    } else {
                        responseMsg = "Procederemos a rectificar la información de la Red de Apoyo Primario.\n\n---\n\n¿Cuál es el nombre completo de la persona a contactar?";
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
        setInputValue(applyPhoneMask(e.target.value));
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
                        </div>
                    ))}
                    {isAnalyzing && (
                        <div className="flex gap-4 animate-pulse ml-11 mt-4">
                            <div className="bg-slate-100 border border-slate-200 w-20 h-8 rounded-2xl rounded-tl-none"></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

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
                            placeholder={isAnalyzing || step === 'completed' ? "Seleccione una opción arriba..." : (step.includes('phone') ? "(123) 456-7890" : "Escribe tu respuesta...")} className="flex-1 bg-transparent border-none focus:ring-0 px-6 text-sm py-2 outline-none disabled:opacity-50"
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

export default Fase2_Seguridad;
