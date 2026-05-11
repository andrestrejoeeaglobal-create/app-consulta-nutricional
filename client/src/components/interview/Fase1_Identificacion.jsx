import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { Send } from 'lucide-react';
import { formatText } from '../../utils/utils';
import { calculateAge, classifyLifeStage, getBinaryGateLabels } from '../../utils/ageClassifier';
import tiloImg from '../../assets/tilo.png';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';

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
                    responseMsg = "Correcto. ¿Cuál es su **Apellido Materno**? (Si no tiene, seleccione la opción abajo)";
                    options = [
                        { label: '➖ No uso Apellido Materno', value: 'CONFIRM_MAT_NONE' }
                    ];
                    nextStep = 'intro_materno';
                    break;

                case 'intro_materno':
                    updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, apellidoMaterno: (cleanText === 'X' || cleanText === 'CONFIRM_MAT_NONE' || directValue === 'CONFIRM_MAT_NONE') ? '' : cleanText } });
                    responseMsg = "Gracias. Por favor, proporcione su **número de teléfono personal** a 10 dígitos.";
                    nextStep = 'intro_phone';
                    break;

                case 'intro_phone': {
                    const phoneInput = cleanText.replace(/\D/g, '');
                    if (phoneInput.length !== 10) {
                        responseMsg = "El número ingresado no tiene 10 dígitos. Por favor, verifíquelo e intente nuevamente:";
                        break;
                    }
                    updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, phone: phoneInput } });
                    responseMsg = "Número registrado. Pasemos a su Fecha de Nacimiento.\n\n¿En qué **DÍA** nació? (Ej: 12)";
                    nextStep = 'intro_dob_day';
                    break;
                }

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
                        { label: "Femenino", value: "Femenino" },
                        { label: "Masculino", value: "Masculino" }
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
                            { label: "Femenino", value: "Femenino" },
                            { label: "Masculino", value: "Masculino" }
                        ];
                    } else {
                        updateIdentityLock({ patientInfo: { ...identityLock.patientInfo, sex } });

                        // BYPASS LOGIC (Lógica Kinética)
                        const currentAge = identityLock.patientInfo?.age || 20; // fallback safety
                        if (currentAge < 18) {
                            // Si es menor de 18, setear soltero y omitir ocupación
                            updateSocioculturalProfile({ civilStatus: "Soltero", occupation: "Estudiante/Menor" });
                            responseMsg = "Debido a su edad, he omitido los datos laborales. ¿Profesa alguna **religión**? (Importante para determinar dietas, Ej: Mormón, Católico. Seleccione 'Ninguna' si no aplica)";
                            options = [
                                { label: "Católico", value: "Católico" },
                                { label: "Cristiano / Evangélico", value: "Cristiano" },
                                { label: "Mormón / SUD", value: "Mormón" },
                                { label: "Ninguna / Ateo / Agnóstico", value: "Ninguna" },
                                { label: "Otra", value: "Otra" },
                                { label: "Testigo de Jehová", value: "Testigo de Jehová" }
                            ];
                            nextStep = 'intro_religion';
                        } else {
                            responseMsg = "¿Cuál es su **estado civil** actual?";
                            options = [
                                { label: "Casado", value: "Casado" },
                                { label: "Divorciado", value: "Divorciado" },
                                { label: "Soltero", value: "Soltero" },
                                { label: "Unión Libre", value: "Unión Libre" },
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
                    responseMsg = "¿Profesa alguna **religión**? (Importante para determinaciones dietéticas como restricciones de carne/suplementos. Si no tiene, seleccione 'Ninguna')";
                    options = [
                        { label: "Adventista del Séptimo Día", value: "Adventista" },
                        { label: "Budista / Hinduista", value: "Budista/Hinduista" },
                        { label: "Católico", value: "Católico" },
                        { label: "Cristiano / Evangélico", value: "Cristiano" },
                        { label: "Judío", value: "Judío" },
                        { label: "Mormón / SUD", value: "Mormón" },
                        { label: "Musulmán", value: "Musulmán" },
                        { label: "Ninguna / Ateo / Agnóstico", value: "Ninguna" },
                        { label: "Otra", value: "Otra" },
                        { label: "Testigo de Jehová", value: "Testigo de Jehová" }
                    ];
                    nextStep = 'intro_religion';
                    break;

                case 'intro_religion': {
                    updateSocioculturalProfile({ religion: cleanText });
                    
                    const pInfo = identityLock.patientInfo;
                    const socio = useClinicalGenome.getState().socioculturalProfile;
                    const currentAge = pInfo.age || 20;
                    const currentSex = pInfo.sex || "Femenino";
                    
                    const { confirmLabel, rejectLabel } = getBinaryGateLabels(currentAge, currentSex);
                    
                    responseMsg = `A continuación, le presento un resumen de los datos capturados:\n\n` +
                                  `**Apellidos:** ${pInfo.apellidoPaterno} ${pInfo.apellidoMaterno}\n` +
                                  `**Fecha de Nacimiento:** ${pInfo.dob_day}/${pInfo.dob_month}/${pInfo.dob_year} (${currentAge} años)\n` +
                                  `**Sexo Biológico:** ${currentSex}\n` +
                                  `**Estado Civil:** ${socio.civilStatus || 'No especificado'}\n` +
                                  `**Ocupación:** ${socio.occupation || 'No especificada'}\n` +
                                  `**Religión:** ${cleanText}\n\n` +
                                  `¿Son correctos estos datos?`;
                                  
                    options = [
                        { label: confirmLabel, value: "CONFIRM_DATA" },
                        { label: rejectLabel, value: "CORRECT_DATA" }
                    ];
                    nextStep = 'intro_review';
                    break;
                }

                case 'intro_review': {
                    if (directValue === 'CONFIRM_DATA') {
                        responseMsg = "Perfil Sociocultural completado. Transfiriendo control...";
                        nextStep = 'completed';
                    } else {
                        responseMsg = "Entendido, vamos a corregir los datos.\n\n¿Cuál es su **Apellido Paterno**?";
                        nextStep = 'intro_paterno';
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

    const isInputDisabled = isAnalyzing || step === 'completed';

    return (
        <div className="flex h-full w-full bg-[#F8FAFC] overflow-hidden font-sans">
            <div className="w-full flex flex-col border-r border-slate-200 bg-white">
                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/10 custom-scrollbar pb-32">
                    {messages.map((msg, idx) => (
                        <div key={idx}>
                            <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm flex-shrink-0 ${msg.role === 'user' ? 'bg-[#1C75BC] text-white' : 'bg-white border border-slate-200 overflow-hidden'}`}>
                                    {msg.role === 'user' ? 'YO' : <img src={tiloImg} alt="Tilo" className="w-6 h-6 object-contain" />}
                                </div>
                                <div className={`p-4 rounded-2xl text-sm shadow-sm leading-relaxed max-w-[80%] whitespace-pre-line ${msg.role === 'user' ? 'bg-[#1C75BC] text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-700'}`}>
                                    {msg.content}
                                    
                                </div>
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
                        
                        {messages[messages.length - 1]?.options?.length > 0 && messages[messages.length - 1]?.options?.length <= 3 && !isAnalyzing && step !== 'completed' && (
                            <div className="flex flex-col gap-2 mb-3 w-full">
                                {messages[messages.length - 1].options.map((opt, oIdx) => (
                                    <button
                                        key={oIdx}
                                        onClick={() => handleSend(opt.label, opt.value)}
                                        className="w-full px-5 py-3 bg-white border-2 border-blue-100 text-slate-700 text-sm font-medium rounded-xl hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all flex items-center justify-between group"
                                        disabled={isAnalyzing || step === 'completed'}
                                    >
                                        <span>{opt.label}</span>
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0 ml-3">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex items-center gap-3 w-full bg-slate-50 p-2 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-inner relative z-10">
                        <input
                            type={step.includes('phone') ? 'tel' : 'text'}
                            value={inputValue} onChange={step.includes('phone') ? handlePhoneChange : (e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend(inputValue)}
                            placeholder={step.includes('phone') ? "(123) 456-7890" : "Escribe tu respuesta..."} className="flex-1 bg-transparent border-none focus:ring-0 px-6 text-sm py-2 outline-none"
                            disabled={isInputDisabled}
                        />
                        <button onClick={() => handleSend(inputValue)} disabled={isInputDisabled} className="w-10 h-10 bg-[#1C75BC] text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform hover:bg-[#155a8a]">
                            <Send size={18} />
                        </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Fase1_Identificacion;
