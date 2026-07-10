import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Activity } from 'lucide-react';
import tiloImg from '../../assets/tilo.png';
export const Fase16_Biometria = ({
    onPhaseComplete,
    patientData,
    setPatientData,
    messages, setMessages, setGlobalIsAnalyzing, initialChatHistory = []
}) => {

    const isMale = patientData?.identificacion?.sexo === 'MASCULINO' || patientData?.profile?.sex === 'MASCULINO' || patientData?.identificacion?.genero === 'HOMBRE';

    const chatEndRef = useRef(null);

    // Local messages state removed
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [internalStep, setInternalStep] = useState('WEIGHT');

    // Numeric metrics
    const [metrics, setMetrics] = useState({
        peso: '',
        estatura: '',
        cintura: '',
        cadera: ''
    });

    const [calcState, setCalcState] = useState({
        bmi: null,
        icc: null,
        bmiStatus: '',
        iccStatus: '',
        flags: []
    });

    // Helper para actualizar live el patientData
    const dispatchLiveUpdate = (key, value) => {
        if (setPatientData) {
            setPatientData(prev => ({
                ...prev,
                vitales_antropometria: {
                    ...prev.vitales_antropometria,
                    [key]: value
                }
            }));
        }
    };

    const handleSend = (text, directValue = null) => {
        const rawMsg = directValue !== null ? directValue : text;
        if (!rawMsg.trim()) return;

        // Mostrar botones o valor escrito
        const displayMsg = rawMsg;
        const newMessages = [...messages, { role: 'user', content: displayMsg }];
        setMessages(newMessages);
        setInputValue("");
        if(setGlobalIsAnalyzing) setGlobalIsAnalyzing(true);
        setIsAnalyzing(true);

        setTimeout(() => {
            let nextStep = internalStep;
            let responseMsg = "";
            let options = null;
            let currentFlags = [...calcState.flags];

            // GATE PHASE HANDLING
            if (internalStep === 'FINISH_GATE') {
                if (directValue === 'CONFIRM_PHASE_GATE') {
                    // Update final computed values in anthropometry object
                    const whtr = parseFloat(metrics.cintura) / parseFloat(metrics.estatura);
                    if (setPatientData) {
                        setPatientData(prev => ({
                            ...prev,
                            anthropometry: {
                                ...prev.anthropometry,
                                measurement_date: new Date().toISOString(),
                                weight_kg: parseFloat(metrics.peso),
                                height_cm: parseFloat(metrics.estatura),
                                waist_cm: parseFloat(metrics.cintura),
                                hip_cm: parseFloat(metrics.cadera),
                                bmi: parseFloat(calcState.bmi),
                                bmi_classification: calcState.bmiStatus,
                                whr: parseFloat(calcState.icc),
                                whtr: parseFloat(whtr.toFixed(3)),
                                body_shape: calcState.iccStatus.includes('ANDROIDE') ? 'ANDROID' : 'GYNOID'
                            },
                            clinical_flags: [...(prev.clinical_flags || []), ...calcState.flags]
                        }));
                    }
                    if (onPhaseComplete) onPhaseComplete(newMessages, 'PHASE_17_VITALS_START');
                    if(setGlobalIsAnalyzing) setGlobalIsAnalyzing(false);
                    setIsAnalyzing(false);
                    return;
                } else if (directValue === 'REJECT_PHASE_GATE') {
                    setInternalStep('WEIGHT');
                    setMetrics({ peso: '', estatura: '', cintura: '', cadera: '' });
                    setCalcState({ bmi: null, icc: null, bmiStatus: '', iccStatus: '', flags: [] });
                    setMessages(prev => [...prev, { role: "assistant", content: "De acuerdo, reiniciaremos la captura de las métricas.\n\nPor favor suba a la báscula. Quítese los zapatos y objetos pesados de los bolsillos." }]);
                    if(setGlobalIsAnalyzing) setGlobalIsAnalyzing(false);
                    setIsAnalyzing(false);
                    return;
                }
            }

            const currentVal = parseFloat(rawMsg);
            
            if (isNaN(currentVal) || currentVal <= 0) {
                responseMsg = "Por favor, introduzca un valor numérico válido.";
                setMessages(prev => [...prev, { role: 'assistant', content: responseMsg }]);
                if(setGlobalIsAnalyzing) setGlobalIsAnalyzing(false);
                setIsAnalyzing(false);
                return;
            }

            if (internalStep === 'WEIGHT') {
                let currentPeso = currentVal;
                setMetrics(prev => ({ ...prev, peso: currentPeso }));
                dispatchLiveUpdate('peso_kg', currentPeso);
                
                responseMsg = "Colóquese mirando al frente, con los talones juntos y la espalda recta.";
                nextStep = 'HEIGHT';
            } 
            else if (internalStep === 'HEIGHT') {
                let currentEstatura = currentVal;
                setMetrics(prev => ({ ...prev, estatura: currentEstatura }));
                dispatchLiveUpdate('talla_m', currentEstatura / 100);

                // Autocalc BMI since we have weight and height now
                const peso = parseFloat(metrics.peso);
                const estaturaM = currentEstatura / 100;
                const bmiNumber = parseFloat((peso / (estaturaM * estaturaM)).toFixed(1));
                let bStatus = '';
                
                if (bmiNumber < 18.5) { bStatus = 'BAJO PESO'; currentFlags.push('UNDERWEIGHT_ALERT'); }
                else if (bmiNumber < 24.9) { bStatus = 'NORMOPESO'; }
                else if (bmiNumber < 29.9) { bStatus = 'SOBREPESO'; }
                else if (bmiNumber < 34.9) { bStatus = 'OBESIDAD I'; currentFlags.push('OBESITY_I'); }
                else if (bmiNumber < 39.9) { bStatus = 'OBESIDAD II'; currentFlags.push('OBESITY_II'); }
                else { bStatus = 'OBESIDAD III (MÓRBIDA)'; currentFlags.push('OBESITY_MORBID'); }

                setCalcState(prev => ({ ...prev, bmi: bmiNumber, bmiStatus: bStatus, flags: currentFlags }));
                
                // Add intermediary message with BMI
                let bmiEmoji = '🟢';
                if (bStatus.includes('SOBREPESO')) bmiEmoji = '🟡';
                if (bStatus.includes('OBESIDAD')) bmiEmoji = '🔴';
                if (bStatus.includes('BAJO PESO')) bmiEmoji = '🔵';

                setMessages(prev => [
                    ...prev, 
                    { role: 'assistant', content: `> [!NOTE]\n> **ANÁLISIS DE PESO CORPORAL**\n> IMC: ${bmiNumber} (${bmiEmoji} ${bStatus})` }
                ]);
                
                responseMsg = "Voy a medir su circunferencia de cintura. Por favor cruce los brazos en el pecho y respire normal.";
                nextStep = 'WAIST';

            } else if (internalStep === 'WAIST') {
                setMetrics(prev => ({ ...prev, cintura: currentVal }));
                dispatchLiveUpdate('cintura_cm', currentVal);
                
                if ((isMale && currentVal > 102) || (!isMale && currentVal > 88)) {
                    currentFlags.push('ABDOMINAL_OBESITY');
                }
                
                setCalcState(prev => ({ ...prev, flags: currentFlags }));
                responseMsg = "Junte los pies. Mediré la parte más prominente de su cadera.";
                nextStep = 'HIP';
                
            } else if (internalStep === 'HIP') {
                setMetrics(prev => ({ ...prev, cadera: currentVal }));
                dispatchLiveUpdate('cadera_cm', currentVal);

                const cintura = parseFloat(metrics.cintura);
                const iccNumber = parseFloat((cintura / currentVal).toFixed(2));
                let iStatus = 'GINECOIDE / NORMAL';
                let iccEmoji = '🟢';
                
                if ((isMale && iccNumber > 0.90) || (!isMale && iccNumber > 0.85)) {
                    iStatus = 'ANDROIDE / RIESGO CARDIOVASCULAR';
                    iccEmoji = '🔴';
                    currentFlags.push('ANDROID_DISTRIBUTION_RISK');
                }

                setCalcState(prev => ({ ...prev, icc: iccNumber, iccStatus: iStatus, flags: currentFlags }));
                
                setMessages(prev => [
                    ...prev, 
                    { role: 'assistant', content: `> [!NOTE]\n> **ANÁLISIS DE TEJIDO ADIPOSO**\n> Relación Cintura/Cadera (ICC): ${iccNumber} (${iccEmoji} ${iStatus})` }
                ]);

                // Mensaje final de la Biometría antes de los Signos Vitales
                let summaryBlock = `\n\n📌 **Resumen Antropométrico:**\n`;
                summaryBlock += `\n\n\n\n- **Peso / Estatura:** ${metrics.peso} kg / ${metrics.estatura} cm\n`;
                summaryBlock += `\n\n\n\n- **Cintura / Cadera:** ${metrics.cintura} cm / ${currentVal} cm`;

                responseMsg = `Listo, baje de la báscula con cuidado. Tome asiento y descruce las piernas para relajarse un momento.${summaryBlock}`;
                
                // Generate Standard Gate for Signos Vitales
                const gateOptions = [
                    { label: "Continuar a Signos Vitales", value: "CONFIRM_PHASE_GATE" },
                    { label: "Corregir Medición", value: "REJECT_PHASE_GATE" }
                ];

                responseMsg += `\n\n*(Pausa intencionada antes de Signos Vitales).*`;
                options = gateOptions;
                nextStep = 'FINISH_GATE';
            }

            if (internalStep !== 'HIP' && responseMsg) { 
                setMessages(prev => [...prev, { role: 'assistant', content: responseMsg, options }]);
            } else if (internalStep === 'HIP') {
                // In HIP, responseMsg is the final conclusion before gate
                setMessages(prev => [...prev, { role: 'assistant', content: responseMsg, options }]);
            }

            setInternalStep(nextStep);
            if(setGlobalIsAnalyzing) setGlobalIsAnalyzing(false);
            setIsAnalyzing(false);

        }, 800);
    };

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const getPlaceholderText = () => {
        if (internalStep === 'WEIGHT') return "Ingrese su peso en kg (ej: 75.5)...";
        if (internalStep === 'HEIGHT') return "Ingrese su estatura en cm (ej: 170)...";
        if (internalStep === 'WAIST') return "Ingrese su cintura en cm (ej: 80)...";
        if (internalStep === 'HIP') return "Ingrese su cadera en cm (ej: 95)...";
        return "Escribe aquí...";
    };

    return (
        <div className="flex h-full w-full bg-[#F8FAFC] overflow-hidden font-sans">
            <div className="w-full flex flex-col border-r border-slate-200 bg-white">
                <div className="hidden flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/10">
                    {messages.map((msg, idx) => {
                        const isNewMessage = idx >= (messages, setMessages, setGlobalIsAnalyzing, initialChatHistory?.length || 0);
                        return (
                            <React.Fragment key={idx}>
<div className={isNewMessage ? `animate-in fade-in slide-in-from-bottom-2` : ''}>
                                <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    {msg.role !== 'user' && (
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm flex-shrink-0 bg-white border border-slate-200 overflow-hidden`}>
                                            <img src={tiloImg} alt="Tilo" className="w-6 h-6 object-contain" />
                                        </div>
                                    )}
                                    <div className={`p-4 rounded-2xl text-sm shadow-sm leading-relaxed max-w-[80%] ${msg.role === 'user' ? 'bg-[#1C75BC] text-white rounded-tr-none whitespace-pre-line' : 'bg-white border border-slate-200 rounded-tl-none text-slate-700 prose prose-sm max-w-none prose-slate'}`}>
                                        {msg.role === 'assistant' ? (
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                    {isAnalyzing && (
                        <div className="flex gap-4 animate-pulse ml-11 mt-4">
                            <div className="bg-slate-100 border border-slate-200 w-20 h-8 rounded-2xl rounded-tl-none"></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* INPUT ZONE (Standard UI Mode) */}
                <div className="p-6 bg-white border-t border-slate-100 z-20 relative">
                    {(() => {
                        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
                        const expectingButtonsOnly = lastMsg?.options && lastMsg.options.length > 0;

                        if (expectingButtonsOnly) {
                            return (
                                
                        <div className="flex flex-col w-full gap-2 px-2 mb-2">
                            {messages[messages.length - 1].options.map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleSend(opt.label, opt.value);
                                    }}
                                    disabled={typeof isAnalyzing !== 'undefined' ? isAnalyzing : false}
                                    className="w-full text-left px-5 py-4 rounded-xl border-2 border-slate-100 bg-white hover:border-tilo-primary hover:bg-slate-50 transition-all font-medium text-slate-700 shadow-sm disabled:opacity-50 uppercase"
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                            );
                        }

                        return (
                            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-inner">
                                <input
                                    type={internalStep === 'FINISH_GATE' ? 'text' : 'number'}
                                    value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSend(inputValue);
                                        }
                                    }}
                                    placeholder={getPlaceholderText()} 
                                    className="flex-1 bg-transparent border-none focus:ring-0 px-6 text-sm py-2 outline-none"
                                    disabled={isAnalyzing || internalStep === 'FINISH_GATE'}
                                />
                                <button onClick={() => handleSend(inputValue)} disabled={isAnalyzing || internalStep === 'FINISH_GATE'} className="w-10 h-10 bg-[#1C75BC] text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform hover:bg-[#155a8a]">
                                    <Send size={18} />
                                </button>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default Fase16_Biometria;
