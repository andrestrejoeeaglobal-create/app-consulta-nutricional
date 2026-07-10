import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import tiloImg from "../../assets/tilo.png";
import { Send } from 'lucide-react';
import { applyCortexCalibration, calculateAge, generateStandardPhaseGate } from '../../utils/utils';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';

export default function Fase11_ActividadYSueno({ messages, setMessages, patientData, setPatientData, onPhaseComplete }) {
    const ptCtx = patientData?.profile?.pediatric_profile || {};
    const isYouth = ptCtx?.ui_controls?.tone_key === 'YOUTH_EMP_TONE';
    
    // Extracción de variables requeridas por el Standard Gate
    const age = patientData?.profile?.age ?? (patientData?.profile?.birthdate ? calculateAge(patientData.profile.birthdate) : (patientData?.fechanac ? calculateAge(patientData.fechanac) : 25));
    const nameStr = (patientData?.identificacion?.nombre?.split(' ')[0]) || "Paciente";
    const targetName = (age < 18) ? "Tutor" : nameStr;
    
    // Initial dialog for Q34


    // Local messages state removed

    const [inputValue, setInputValue] = useState("");
    const [step, setStep] = useState('exercise_gate');
    const [currentOptions, setCurrentOptions] = useState([
        { label: "✅ Sí", value: "Sí" },
        { label: "❌ No", value: "No" }
    ]);
    const [exerciseLog, setExerciseLog] = useState([]);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim() && currentOptions.length === 0) return;
        const userInput = inputValue.trim();
        setMessages(prev => [...prev, { sender: 'user', text: userInput }]);
        setInputValue("");
        processStep(userInput);
    };

    const handleOptionSelect = (optionValue) => {
        setMessages(prev => [...prev, { sender: 'user', text: optionValue }]);
        processStep(optionValue);
    };

    const processStep = (input) => {
        switch (step) {
            case 'exercise_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: applyCortexCalibration("Excelente. ¿Qué actividad o entrenamiento realiza específicamente?", isYouth)
                    }]);
                    setStep('exercise_type');
                    setCurrentOptions([]);
                } else if (input === "No") {
                    setPatientData(prev => ({
                        ...prev,
                        lifestyle_profile: { ...(prev.lifestyle_profile || {}), exercise: [] }
                    }));
                    askNeat();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Por favor seleccione Sí o No." }]);
                }
                break;
            }
            case 'exercise_type': {
                setTempExercise(prev => ({ ...prev, type: input }));
                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: applyCortexCalibration("¿Cuántos **días a la semana** realiza este entrenamiento?", isYouth)
                }]);
                setStep('exercise_days');
                break;
            }
            case 'exercise_days': {
                const days = parseInt(input, 10);
                if (isNaN(days) || days < 1 || days > 7) {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Por favor, ingrese un número del 1 al 7." }]);
                    return;
                }
                setTempExercise(prev => ({ ...prev, daysPerWeek: days }));
                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: applyCortexCalibration("¿Cuántos **minutos u horas** por sesión (en promedio)?", isYouth)
                }]);
                setStep('exercise_duration');
                break;
            }
            case 'exercise_duration': {
                const newExercise = { ...tempExercise, duration: input };
                const newLog = [...exerciseLog, newExercise];
                setExerciseLog(newLog);
                
                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: applyCortexCalibration(`Registrado: ${newExercise.type} (${newExercise.daysPerWeek} días/sem, ${newExercise.duration}/sesión).\n\n¿Realiza **alguna otra** actividad física o deporte?`, isYouth)
                }]);
                setStep('exercise_more_gate');
                setCurrentOptions([
                    { label: "✅ Sí, agrego otra", value: "Sí" },
                    { label: "❌ No, es todo", value: "No" }
                ]);
                break;
            }
            case 'exercise_more_gate': {
                if (input === "Sí") {
                    setTempExercise({});
                    setMessages(prev => [...prev, {
                        sender: 'tilo',
                        text: applyCortexCalibration("¿Qué otra actividad o entrenamiento realiza?", isYouth)
                    }]);
                    setStep('exercise_type');
                    setCurrentOptions([]);
                } else if (input === "No") {
                    setPatientData(prev => ({
                        ...prev,
                        lifestyle_profile: { ...(prev.lifestyle_profile || {}), exercise: exerciseLog }
                    }));
                    askNeat();
                } else {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Por favor seleccione una opción." }]);
                }
                break;
            }
            case 'neat_gate': {
                if (!["Sedentario", "Ligero", "Activo", "Muy Activo"].includes(input)) {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Por favor, seleccione una opción válida." }]);
                    return;
                }
                setPatientData(prev => ({
                    ...prev,
                    lifestyle_profile: { ...(prev.lifestyle_profile || {}), neat_level: input }
                }));
                // Preguntar Sueño
                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: applyCortexCalibration("Pasemos a su recuperación. ¿Cuántas **horas en promedio** duerme por la noche?", isYouth)
                }]);
                setStep('sleep_hours');
                setCurrentOptions([]);
                break;
            }
            case 'sleep_hours': {
                const hours = parseFloat(input);
                if (isNaN(hours) || hours < 0 || hours > 24) {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Por favor, ingrese un número de horas válido (Ej: 6.5, 8)." }]);
                    return;
                }
                setPatientData(prev => ({
                    ...prev,
                    lifestyle_profile: { ...(prev.lifestyle_profile || {}), sleep: { ...(prev.lifestyle_profile?.sleep || {}), hours: hours } }
                }));
                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: applyCortexCalibration("Del 1 al 10, ¿cómo calificaría la **calidad de su descanso**? (Donde 1 es Pésimo y 10 es Excelente, amanece con energía total).", isYouth)
                }]);
                setStep('sleep_quality');
                break;
            }
            case 'sleep_quality': {
                const quality = parseInt(input, 10);
                if (isNaN(quality) || quality < 1 || quality > 10) {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Por favor, ingrese una calificación válida del 1 al 10." }]);
                    return;
                }
                setPatientData(prev => ({
                    ...prev,
                    lifestyle_profile: { ...(prev.lifestyle_profile || {}), sleep: { ...(prev.lifestyle_profile?.sleep || {}), quality: quality } }
                }));
                
                // Stress
                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: applyCortexCalibration("Finalmente, evaluemos su carga alostática.\n\nDel 1 al 10, ¿cuál es su **nivel de Estrés Promedio** diario? (Físico, mental o emocional).", isYouth)
                }]);
                setStep('stress_level');
                break;
            }
            case 'stress_level': {
                const stress = parseInt(input, 10);
                if (isNaN(stress) || stress < 1 || stress > 10) {
                    setMessages(prev => [...prev, { sender: 'tilo', text: "Por favor, ingrese una calificación válida del 1 al 10." }]);
                    return;
                }
                setPatientData(prev => ({
                    ...prev,
                    lifestyle_profile: { ...(prev.lifestyle_profile || {}), stress_level: stress }
                }));

                // 🧠 MOTOR IA: GENERACIÓN PÁRRAFO DE PODER (CIERRE FASE 11)
                const neat = patientData?.lifestyle_profile?.neat_level || "No definido";
                const sleepHours = patientData?.lifestyle_profile?.sleep?.hours || 0;
                const sleepQual = patientData?.lifestyle_profile?.sleep?.quality || 0;
                const exercises = patientData?.lifestyle_profile?.exercise || exerciseLog || [];
                
                let summaryBlock = `\n\n📌 **Resumen de Actividad y Descanso:**\n`;
                if (exercises.length > 0) {
                    summaryBlock += `\n\n\n\n- **Ejercicio:** ` + exercises.map(e => `${e.type} (${e.daysPerWeek} días/sem, ${e.duration})`).join(', ') + `\n`;
                } else {
                    summaryBlock += `\n\n\n\n- **Ejercicio:** Ninguno estructurado\n`;
                }
                summaryBlock += `\n\n\n\n- **NEAT:** ${neat}\n`;
                summaryBlock += `\n\n\n\n- **Sueño:** ${sleepHours} hrs (Calidad: ${sleepQual}/10)\n`;
                summaryBlock += `\n\n\n\n- **Nivel de Estrés:** ${stress}/10`;

                const p1Justification = stress >= 7 
                    ? `Los niveles de carga alostática y sueño exigen una compensación metabólica en su matriz final${summaryBlock}` 
                    : `Su homeostasis de recuperación basal ha sido documentada para la parametrización energética${summaryBlock}`;
                    
                const subject = "el reporte de actividad física, sueño y estrés refleja su estado fisiológico actual";
                
                const gate = generateStandardPhaseGate(
                    "Bloque de Actividad y Descanso",
                    p1Justification,
                    targetName,
                    subject,
                    true
                );

                setMessages(prev => [...prev, {
                    sender: 'tilo',
                    text: applyCortexCalibration(gate.narrative, isYouth),
                    options: gate.options
                }]);
                setStep('FINISH_GATE');
                setCurrentOptions(gate.options);
                break;
            }
            case 'FINISH_GATE': {
                if (input === "CONFIRM_PHASE_GATE") {
                    finishPhase();
                } else if (input === "REJECT_PHASE_GATE") {
                    setStep('exercise_gate');
                    setMessages([{
                        sender: 'tilo', 
                        text: applyCortexCalibration("📍 Rectificación activada. El registro previo de actividad y descanso ha sido descartado.\n\n¿Realiza ejercicio estructurado o algún deporte de manera formal?", isYouth)
                    }]);
                    setCurrentOptions([
                        { label: "✅ Sí", value: "Sí" },
                        { label: "❌ No", value: "No" }
                    ]);
                    setExerciseLog([]);
                }
                break;
            }
            default:
                break;
        }
    };

    const [tempExercise, setTempExercise] = useState({});

    const askNeat = () => {
        setMessages(prev => [...prev, {
            sender: 'tilo',
            text: applyCortexCalibration("Independientemente del ejercicio, analicemos su NEAT (Termogénesis por Actividad No Estructurada).\n\n¿Cómo describiría su movimiento general en el día a día? (Ej. Tipo de trabajo, pasos, uso de escaleras).", isYouth)
        }]);
        setStep('neat_gate');
        setCurrentOptions([
            { label: "Sedentario (Home office, paso mínimo)", value: "Sedentario" },
            { label: "Ligero (Movimiento ocasional, oficina)", value: "Ligero" },
            { label: "Activo (Caminatas, trabajo de pie)", value: "Activo" },
            { label: "Muy Activo (Trabajo físico pesado)", value: "Muy Activo" }
        ]);
    };

    const finishPhase = () => {
        const nextMsg = `Perfecto, su perfil de Actividad y Descanso ha sido mapeado con éxito.\n\nPasemos ahora a la matriz de **Evaluación Dietética**.`;

        const finalMessages = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text || msg.content
        }));

        finalMessages.push({
            role: 'assistant',
            content: applyCortexCalibration(nextMsg, isYouth)
        });

        // La siguiente es la evaluación dietética (Phase 11 en el archivo viejo, pero aquí lo mapearemos en App.jsx)
        onPhaseComplete(finalMessages, 'PHASE_12_LOGISTICA_START'); 
    };

    return (
        <div className="flex-col flex h-full bg-tilo-bg-base relative text-tilo-text-base">
            <div className="bg-white px-6 py-4 border-b border-tilo-border shrink-0 flex items-center justify-between z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <img src={tiloImg} alt="Tilo" className="w-10 h-10 object-contain drop-shadow-sm" />
                    <div>
                        <h2 className="text-lg font-bold text-tilo-text-dark">Estilo de Vida</h2>
                        <p className="text-sm text-tilo-text-muted">Actividad y Sueño</p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-tilo-bg-chat-sys text-tilo-primary rounded-full font-bold text-xs tracking-wide border border-tilo-border">
                    Fase 11
                </div>
            </div>

            <div className="flex-1 h-full overflow-y-auto p-8 space-y-6 custom-scrollbar relative z-10">
                {messages.map((msg, index) => {
                    const isBot = msg.sender === "tilo" || msg.role === "assistant";
                    const isSystem = msg.sender === "system";

                    if (isSystem) {
                        return (
<React.Fragment key={index}>
                            <div  className="flex justify-center my-4">
                                <div className="bg-tilo-bg-chat-sys text-tilo-text-muted text-xs px-4 py-2 rounded-full font-medium inline-flex items-center gap-2 border border-tilo-border">
                                    <i className="fi fi-rr-info text-tilo-primary"></i>
                                    {msg.text}
                                </div>
                            </div>
                        
                            {isBot && index === messages.length - 1 && currentOptions.length > 0 && (
                                <div className="ml-[52px] mt-3 flex flex-col gap-2 max-w-[80%] mb-6">
                                    {currentOptions.map((opt, oIdx) => (
                                        <button
                                            key={oIdx}
                                            onClick={() => handleOptionSelect(opt.value)}
                                            className="px-4 py-3 bg-slate-50 border border-slate-200 text-[#1C75BC] text-sm text-left rounded-xl shadow-sm hover:bg-[#1C75BC] hover:text-white hover:border-[#1C75BC] transition-colors uppercase font-medium w-full"
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}</React.Fragment>
);
                    }

                    return (
                        <div key={index} className={`flex ${isBot ? "justify-start" : "justify-end"} mb-6 items-start gap-3`}>
                            {isBot ? (
                                <div className="w-10 h-10 rounded-full bg-white flex-shrink-0 border border-tilo-border shadow-sm flex items-center justify-center overflow-hidden">
                                    <img src={tiloImg} alt="Tilo" className="w-8 h-8 object-contain" />
                                </div>
                            ) : null}

                            <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${
                                isBot
                                    ? "bg-white border text-tilo-text-dark rounded-tl-none border-tilo-border"
                                    : "bg-tilo-primary text-white rounded-tr-none"
                            }`}>
                                <div className={`prose prose-sm max-w-none ${isBot ? "prose-slate" : "prose-invert"}`}>
                                    <ReactMarkdown>{msg.text || msg.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {currentOptions.length > 0 && currentOptions.length <= 3 && (
                    <div className="flex justify-start mb-6 items-start gap-3">
                        <div className="w-10 h-10 flex-shrink-0"></div>
                        <div className="flex flex-col gap-2 w-full max-w-[80%]">
                            {currentOptions.map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleOptionSelect(opt.value)}
                                    className="px-4 py-3 bg-white text-tilo-primary font-bold rounded-xl text-left text-sm hover:bg-tilo-bg-chat-sys transition-colors shadow-sm border border-tilo-primary uppercase w-full"
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            <div className="p-6 bg-white border-t border-tilo-border shrink-0 z-20">
                <div className="max-w-2xl mx-auto flex flex-col gap-3 relative">
                    {/* Componente Restrictivo Inyectado si N > 3 */}
                    {currentOptions.length > 3 ? (
                        <div className="w-full relative">
                            <SearchableVerticalMenu 
                                options={currentOptions}
                                onSelect={(val) => {
                                    handleOptionSelect(val);
                                }}
                                embedded={true}
                            />
                        </div>
                    ) : (
                        <div className="relative flex items-center gap-2 bg-white border border-tilo-border rounded-full px-2 py-2 shadow-sm focus-within:ring-2 focus-within:ring-tilo-primary focus-within:border-tilo-primary transition-all w-full">
                            {currentOptions.length > 0 ? (
                                <div className="flex-1 px-3 py-2 text-tilo-text-muted text-sm italic border-l border-tilo-bg-base flex items-center gap-2 cursor-not-allowed">
                                    <i className="fi fi-rr-lock"></i> Por favor, seleccione una opción en el menú.
                                </div>
                            ) : (
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Escribe tu respuesta..."
                                className="flex-1 bg-transparent outline-none text-tilo-text-dark placeholder:text-tilo-text-muted text-sm h-10 px-2"
                            />
                        )}

                        {currentOptions.length === 0 && (
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim()}
                                className="bg-tilo-primary font-bold hover:bg-tilo-secondary text-white p-2 rounded-full transition-colors flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-10 h-10"
                            >
                                <Send className="w-5 h-5 ml-1" />
                            </button>
                        )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
