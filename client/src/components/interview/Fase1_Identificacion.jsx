import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { Zap } from 'lucide-react';
import { formatText } from '../../utils/utils';
import { calculateAge, classifyLifeStage } from '../../utils/ageClassifier';
import tiloImg from '../../assets/tilo.png';

export const Fase1_Identificacion = ({
    onPhaseComplete,
    initialChatHistory = []
}) => {
    const chatEndRef = useRef(null);
    const starterMessage = {
        role: 'assistant',
        content: "Para comenzar con su historia clínica, validemos el resto de su identidad.\n\n¿Cuál es su **Apellido Paterno**?"
    };

    const [messages, setMessages] = useState(initialChatHistory.length > 0 ? initialChatHistory : [starterMessage]);
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [step, setStep] = useState('intro_paterno');

    // CONEXION ASINCRONA
    const identityLock = useClinicalGenome(state => state.identityLock);
    const updateIdentityLock = useClinicalGenome(state => state.updateIdentityLock);
    const updateSocioculturalProfile = useClinicalGenome(state => state.updateSocioculturalProfile);

    // Estado temporal para construir la fecha de nacimiento
    const [tempDob, setTempDob] = useState({ day: null, month: null, year: null });

    const handleSend = (text, directValue = null) => {
        const rawMsg = directValue !== null ? directValue : text;
        if (!rawMsg.trim()) return;

        // Mostrar botones como mensaje de usuario si se usaron
        const displayMsg = rawMsg;
        const newMessages = [...messages, { role: 'user', content: displayMsg }];
        setMessages(newMessages);
        setInputValue("");
        setIsAnalyzing(true);

        setTimeout(() => {
            const cleanText = formatText(rawMsg.trim());
            const lowerText = rawMsg.trim().toLowerCase();
            let nextStep = step;
            let responseMsg = "";
            let options = null;

            switch (step) {
                case 'intro_paterno':
                    updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, apellidoPaterno: cleanText } });
                    responseMsg = "Correcto. ¿Cuál es su **Apellido Materno**? (Si no tiene, escriba 'X')";
                    nextStep = 'intro_materno';
                    break;

                case 'intro_materno':
                    updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, apellidoMaterno: cleanText === 'X' ? '' : cleanText } });
                    responseMsg = "Gracias. Pasemos a su Fecha de Nacimiento.\n\n¿En qué **DÍA** nació? (Ej: 12)";
                    nextStep = 'intro_dob_day';
                    break;

                case 'intro_dob_day': {
                    const day = parseInt(cleanText);
                    if (isNaN(day) || day < 1 || day > 31) {
                        responseMsg = "Por favor indique un día válido (1-31).";
                    } else {
                        setTempDob(prev => ({ ...prev, day: day }));
                        responseMsg = "¿En qué **mes**? (Ej: 5 o Mayo)";
                        nextStep = 'intro_dob_month';
                    }
                    break;
                }

                case 'intro_dob_month': {
                    let monthCode = parseInt(cleanText);
                    const months = { 'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12 };
                    if (isNaN(monthCode)) {
                        const mStr = lowerText.substring(0, 3);
                        const match = Object.keys(months).find(k => k.startsWith(mStr));
                        if (match) monthCode = months[match];
                    }
                    if (!monthCode || monthCode < 1 || monthCode > 12) {
                        responseMsg = "Mes no válido. Intente escribir el número (Ej: 5) o el nombre completo.";
                    } else {
                        setTempDob(prev => ({ ...prev, month: monthCode }));
                        responseMsg = "¿De qué **año**? (Ej: 1990)";
                        nextStep = 'intro_dob_year';
                    }
                    break;
                }

                case 'intro_dob_year': {
                    const year = parseInt(cleanText);
                    const currentYear = new Date().getFullYear();
                    if (isNaN(year) || year < 1920 || year > currentYear) {
                        responseMsg = "Año no válido. Escriba 4 dígitos (Ej: 1990).";
                        break;
                    }

                    // Calcular Edad y LifeStage
                    const age = calculateAge(tempDob.day, tempDob.month, year);
                    const lifeStage = classifyLifeStage(age);

                    updateIdentityLock({
                        patientInfo: {
                            ...identityLock.patientInfo,
                            dob_day: tempDob.day, dob_month: tempDob.month, dob_year: year, age: age
                        }
                    });
                    updateSocioculturalProfile({ lifeStage });

                    responseMsg = `Registrado (${age} años - ${lifeStage}).\n\n¿Cuál es su **sexo biológico** al nacer?`;
                    options = [
                        { label: "Masculino", value: "Masculino" },
                        { label: "Femenino", value: "Femenino" }
                    ];
                    nextStep = 'intro_sex';
                    break;
                }

                case 'intro_sex': {
                    let sex = cleanText;
                    if (['mujer', 'femenino', 'f'].includes(lowerText)) sex = "Femenino";
                    if (['hombre', 'masculino', 'm', 'varon'].includes(lowerText)) sex = "Masculino";

                    if (sex !== "Masculino" && sex !== "Femenino") {
                        responseMsg = "Por favor seleccione una opción válida (Masculino o Femenino).";
                        options = [
                            { label: "Masculino", value: "Masculino" },
                            { label: "Femenino", value: "Femenino" }
                        ];
                    } else {
                        updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, sex } });

                        // BYPASS LOGIC (Lógica Kinética)
                        const currentAge = identityLock.patientInfo?.age || 20; // fallback safety
                        if (currentAge < 18) {
                            // Si es menor de 18, setear soltero y omitir ocupación
                            updateSocioculturalProfile({ civilStatus: "Soltero", occupation: "Estudiante/Menor" });
                            responseMsg = "Debido a su edad, he omitido los datos laborales. ¿Profesa alguna **religión**? (Importante para determinar dietas, Ej: Mormón, Católico. Escriba 'Ninguna' si no aplica)";
                            nextStep = 'intro_religion';
                        } else {
                            responseMsg = "¿Cuál es su **estado civil** actual?";
                            options = [
                                { label: "Soltero", value: "Soltero" },
                                { label: "Casado", value: "Casado" },
                                { label: "Unión Libre", value: "Unión Libre" },
                                { label: "Divorciado", value: "Divorciado" },
                                { label: "Viudo", value: "Viudo" }
                            ];
                            nextStep = 'intro_civil_status';
                        }
                    }
                    break;
                }

                case 'intro_civil_status':
                    updateSocioculturalProfile({ civilStatus: cleanText });
                    responseMsg = "¿A qué se dedica actualmente? (Ej: Docente, Estudiante, Ingeniero)";
                    nextStep = 'intro_job';
                    break;

                case 'intro_job':
                    updateSocioculturalProfile({ occupation: cleanText });
                    responseMsg = "¿Profesa alguna **religión**? (Importante para determinaciones dietéticas como restricciones de carne/suplementos. Si no tiene, escriba 'Ninguna')";
                    nextStep = 'intro_religion';
                    break;

                case 'intro_religion':
                    updateSocioculturalProfile({ religion: cleanText });
                    responseMsg = "Perfil Sociocultural completado. Transferiendo control...";
                    nextStep = 'completed';
                    break;

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

    return (
        <div className="flex h-full w-full bg-[#F8FAFC] overflow-hidden font-sans">
            <div className="w-full flex flex-col border-r border-slate-200 bg-white">
                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/10">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`animate-in fade-in slide-in-from-bottom-2`}>
                            <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm flex-shrink-0 ${msg.role === 'user' ? 'bg-[#1C75BC] text-white' : 'bg-white border border-slate-200 overflow-hidden'}`}>
                                    {msg.role === 'user' ? 'YO' : <img src={tiloImg} alt="Tilo" className="w-6 h-6 object-contain" />}
                                </div>
                                <div className={`p-4 rounded-2xl text-sm shadow-sm leading-relaxed max-w-[80%] whitespace-pre-line ${msg.role === 'user' ? 'bg-[#1C75BC] text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-700'}`}>
                                    {msg.content}
                                </div>
                            </div>

                            {/* Render Options if any (Only for the latest message from assistant) */}
                            {msg.options && msg.role === 'assistant' && idx === messages.length - 1 && (
                                <div className="ml-11 mt-3 flex flex-wrap gap-2">
                                    {msg.options.map((opt, oIdx) => (
                                        <button
                                            key={oIdx}
                                            onClick={() => handleSend(opt.label, opt.value)}
                                            className="px-4 py-2 bg-slate-50 border border-slate-200 text-[#1C75BC] text-sm rounded-full shadow-sm hover:bg-[#1C75BC] hover:text-white hover:border-[#1C75BC] transition-colors"
                                            disabled={isAnalyzing || step === 'completed'}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {isAnalyzing && (
                        <div className="flex gap-4 animate-pulse ml-11 mt-4">
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

export default Fase1_Identificacion;
