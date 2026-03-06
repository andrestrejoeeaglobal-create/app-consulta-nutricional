import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Check } from 'lucide-react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import tiloImg from '../../assets/tilo.png';

const formatText = (text) => text.trim();
const strictBooleanValidator = (text) => {
    const raw = text.toLowerCase().trim();
    if (raw === 'sí' || raw === 'si') return true;
    if (raw === 'no') return false;
    return null;
};

// ==========================================
// COMPONENTE: Fase 10 (Hábitos y Estilo de Vida)
// ==========================================
export default function Fase10_Habitos({ onPhaseComplete, isYouth }) {
    const { updateClinicalContext } = useClinicalGenome();

    // Estado principal del componente
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Excelente, ahora evaluaremos algunos hábitos y estilo de vida.\n\n¿Fumas actualmente o tienes antecedentes de tabaquismo?',
            avatar: tiloImg,
            options: [
                { label: '✅ Sí', value: 'Sí' },
                { label: '❌ No', value: 'No' }
            ]
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [currentStep, setCurrentStep] = useState('SMOKE_GATE');

    // Variables temporales para la recolección
    const [tempItem, setTempItem] = useState({});
    const [habitsData, setHabitsData] = useState({
        smoking: { is_smoker: false, details: '' },
        alcohol: { is_drinker: false, log: [], total_kcal_per_occasion: 0 },
        drugs: { has_usage: false, log: [] },
        sleep: { hours: 0, quality: '' },
        stress: ''
    });
    const [activityData, setActivityData] = useState({
        exercise: { has_scheduled_exercise: false, log: [] }
    });

    const messagesEndRef = useRef(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const addMessage = (role, content, extra = {}) => {
        setMessages(prev => [...prev, { role, content, ...extra }]);
        scrollToBottom();
    };

    // Función principal para manejar los inputs del usuario
    const handleInput = (text) => {
        if (!text.trim()) return;

        // Agregar mensaje del usuario a la pantalla
        addMessage('user', text);
        setInputValue('');

        const cleanText = formatText(text);
        const boolVal = strictBooleanValidator(cleanText);

        setTimeout(() => {
            switch (currentStep) {

                // --- TABAQUISMO ---
                case 'SMOKE_GATE': {
                    if (boolVal === true) {
                        setHabitsData(prev => ({ ...prev, smoking: { ...prev.smoking, is_smoker: true } }));
                        addMessage('assistant', isYouth ? '¿Con qué frecuencia y qué cantidad consumes aproximadamente?' : '¿Con qué frecuencia y qué cantidad consume aproximadamente?', { avatar: tiloImg });
                        setCurrentStep('SMOKE_DETAILS');
                    } else if (boolVal === false) {
                        setHabitsData(prev => ({ ...prev, smoking: { ...prev.smoking, is_smoker: false } }));
                        addMessage('assistant', isYouth ? 'Excelente, registrado. Ahora pasemos al alcohol...\n\n¿Consumes bebidas alcohólicas?' : 'Excelente, registrado. Ahora pasemos al alcohol...\n\n¿Consume bebidas alcohólicas?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('ALCOHOL_GATE');
                    } else {
                        addMessage('assistant', 'Por favor seleccione Sí o No.', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                    }
                    break;
                }

                case 'SMOKE_DETAILS': {
                    setHabitsData(prev => ({ ...prev, smoking: { ...prev.smoking, details: cleanText } }));
                    addMessage('assistant', isYouth ? 'Excelente, registrado. Ahora pasemos al alcohol...\n\n¿Consumes bebidas alcohólicas?' : 'Excelente, registrado. Ahora pasemos al alcohol...\n\n¿Consume bebidas alcohólicas?', {
                        avatar: tiloImg,
                        options: [
                            { label: '✅ Sí', value: 'Sí' },
                            { label: '❌ No', value: 'No' }
                        ]
                    });
                    setCurrentStep('ALCOHOL_GATE');
                    break;
                }

                // --- ALCOHOL ---
                case 'ALCOHOL_GATE': {
                    if (boolVal === true) {
                        setHabitsData(prev => ({ ...prev, alcohol: { ...prev.alcohol, is_drinker: true } }));
                        addMessage('assistant', '¿Qué tipo de bebida alcohólica suele consumir con mayor frecuencia?', {
                            avatar: tiloImg,
                            options: [
                                { label: 'Cerveza', value: '1' },
                                { label: 'Caguama', value: '2' },
                                { label: 'Vino', value: '3' },
                                { label: 'Destilados', value: '4' },
                                { label: 'Coctelería', value: '5' }
                            ]
                        });
                        setCurrentStep('ALCOHOL_TYPE');
                    } else if (boolVal === false) {
                        setHabitsData(prev => ({ ...prev, alcohol: { ...prev.alcohol, is_drinker: false } }));
                        addMessage('assistant', isYouth ? 'Entendido.\n\n¿Consumes alguna sustancia recreativa (drogas)?' : 'Entendido.\n\n¿Consume alguna sustancia recreativa (drogas)?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('DRUGS_GATE');
                    } else {
                        addMessage('assistant', 'Por favor indique Sí o No.', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                    }
                    break;
                }

                case 'ALCOHOL_TYPE': {
                    const map = {
                        "1": { label: "Cerveza", unit: "Lata 355ml", kcal: 150 },
                        "2": { label: "Caguama", unit: "Envase 940ml", kcal: 380 },
                        "3": { label: "Vino", unit: "Copa 150ml", kcal: 120 },
                        "4": { label: "Destilados", unit: "Shot 45ml", kcal: 100 },
                        "5": { label: "Coctelería", unit: "Vaso Estándar", kcal: 250 },
                        "Cerveza": { label: "Cerveza", unit: "Lata 355ml", kcal: 150 },
                        "Caguama": { label: "Caguama", unit: "Envase 940ml", kcal: 380 },
                        "Vino": { label: "Vino", unit: "Copa 150ml", kcal: 120 },
                        "Destilados": { label: "Destilados", unit: "Shot 45ml", kcal: 100 },
                        "Coctelería": { label: "Coctelería", unit: "Vaso Estándar", kcal: 250 }
                    };
                    const selected = map[cleanText];
                    if (!selected) {
                        addMessage('assistant', 'Por favor seleccione una de las opciones válidas.', { avatar: tiloImg });
                        return;
                    }
                    setTempItem({ current_alc: selected });
                    addMessage('assistant', isYouth ? `Entendido. ¿Cuántas unidades de ${selected.unit} sueles tomar por ocasión?` : `Entendido. ¿Cuántas unidades de ${selected.unit} suele tomar por ocasión?`, {
                        avatar: tiloImg,
                        inputType: 'number'
                    });
                    setCurrentStep('ALCOHOL_QTY');
                    break;
                }

                case 'ALCOHOL_QTY': {
                    const qty = parseFloat(cleanText);
                    if (isNaN(qty) || qty < 0) {
                        addMessage('assistant', 'Por favor indique un número válido.', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        return;
                    }

                    const { current_alc } = tempItem;
                    if (!current_alc) {
                        setCurrentStep('ALCOHOL_GATE');
                        return;
                    }

                    const subtotal = qty * current_alc.kcal;
                    const newItem = {
                        type: current_alc.label,
                        qty,
                        unit: current_alc.unit,
                        subtotal_kcal: subtotal
                    };

                    setHabitsData(prev => {
                        const newBucket = [...(prev.alcohol.log || []), newItem];
                        const newTotal = (prev.alcohol.total_kcal_per_occasion || 0) + subtotal;
                        return {
                            ...prev,
                            alcohol: {
                                ...prev.alcohol,
                                log: newBucket,
                                total_kcal_per_occasion: newTotal
                            }
                        };
                    });

                    addMessage('assistant', isYouth ? 'Registrado. ¿Consumes algún otro tipo de bebida alcohólica?' : 'Registrado. ¿Consume algún otro tipo de bebida alcohólica?', {
                        avatar: tiloImg,
                        options: [
                            { label: '✅ Sí', value: 'Sí' },
                            { label: '❌ No', value: 'No' }
                        ]
                    });
                    setCurrentStep('ALCOHOL_LOOP');
                    break;
                }

                case 'ALCOHOL_LOOP': {
                    if (boolVal === true) {
                        addMessage('assistant', 'Seleccione el tipo de bebida:', {
                            avatar: tiloImg,
                            options: [
                                { label: 'Cerveza', value: '1' },
                                { label: 'Caguama', value: '2' },
                                { label: 'Vino', value: '3' },
                                { label: 'Destilados', value: '4' },
                                { label: 'Coctelería', value: '5' }
                            ]
                        });
                        setCurrentStep('ALCOHOL_TYPE');
                    } else if (boolVal === false) {
                        addMessage('assistant', isYouth ? '¿Consumes alguna sustancia recreativa (drogas)?' : '¿Consume alguna otra sustancia recreativa (drogas)?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('DRUGS_GATE');
                    } else {
                        addMessage('assistant', 'Responda Sí o No.', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                    }
                    break;
                }

                // --- DROGAS ---
                case 'DRUGS_GATE': {
                    if (boolVal === false) {
                        setHabitsData(prev => ({ ...prev, drugs: { ...prev.drugs, has_usage: false, log: ["Niega"] } }));
                        addMessage('assistant', isYouth ? '¿Realizas ejercicio físico?' : '¿Realiza ejercicio físico?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('ACTIVITY_GATE');
                    } else if (boolVal === true) {
                        setHabitsData(prev => ({ ...prev, drugs: { ...prev.drugs, has_usage: true } }));
                        addMessage('assistant', '¿Cuál?', { avatar: tiloImg });
                        setCurrentStep('DRUGS_DRILLDOWN');
                    } else {
                        addMessage('assistant', isYouth ? 'Disculpa, no te entendí. ¿Consumes alguna otra sustancia? (Responda Sí o No).' : 'Disculpe, no le entendí. ¿Consume alguna otra sustancia? (Responda Sí o No).', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                    }
                    break;
                }

                case 'DRUGS_DRILLDOWN': {
                    setHabitsData(prev => ({ ...prev, drugs: { ...prev.drugs, log: [...(prev.drugs.log || []), cleanText] } }));
                    addMessage('assistant', '¿Alguna otra sustancia?', {
                        avatar: tiloImg,
                        options: [
                            { label: '✅ Sí', value: 'Sí' },
                            { label: '❌ No', value: 'No' }
                        ]
                    });
                    setCurrentStep('DRUGS_LOOP');
                    break;
                }

                case 'DRUGS_LOOP': {
                    if (boolVal === false) {
                        addMessage('assistant', isYouth ? '¿Realizas ejercicio físico?' : '¿Realiza ejercicio físico?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('ACTIVITY_GATE');
                    } else if (boolVal === true) {
                        addMessage('assistant', '¿Cuál?', { avatar: tiloImg });
                        setCurrentStep('DRUGS_DRILLDOWN');
                    } else {
                        addMessage('assistant', isYouth ? 'Disculpa, no te entendí. ¿Alguna otra sustancia? (Responda Sí o No).' : 'Disculpe, no le entendí. ¿Alguna otra sustancia? (Responda Sí o No).', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                    }
                    break;
                }

                // --- ACTIVIDAD FÍSICA ---
                case 'ACTIVITY_GATE': {
                    if (boolVal === false) {
                        setActivityData(prev => ({ ...prev, exercise: { ...prev.exercise, has_scheduled_exercise: false } }));
                        addMessage('assistant', isYouth ? '¿Cuántas horas duermes en promedio al día?' : '¿Cuántas horas duerme en promedio al día?', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        setCurrentStep('SLEEP_HOURS');
                    } else if (boolVal === true) {
                        setActivityData(prev => ({ ...prev, exercise: { ...prev.exercise, has_scheduled_exercise: true } }));
                        setTempItem({}); // Limpiamos
                        addMessage('assistant', isYouth ? 'Muy bien. ¿Qué actividad realizas? (Ej. Correr, Crossfit)' : 'Muy bien. ¿Qué actividad realiza? (Ej. Correr, Crossfit)', { avatar: tiloImg });
                        setCurrentStep('ACTIVITY_TYPE');
                    } else {
                        addMessage('assistant', isYouth ? 'Disculpa, no te entendí. ¿Realizas alguna actividad física? (Responda Sí o No).' : 'Disculpe, no le entendí. ¿Realiza alguna actividad física? (Responda Sí o No).', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                    }
                    break;
                }

                case 'ACTIVITY_TYPE': {
                    setTempItem({ actividad: cleanText });
                    addMessage('assistant', isYouth ? '¿Cuántos **días** a la semana la practicas? (Número 1-7)' : '¿Cuántos **días** a la semana la practica? (Número 1-7)', {
                        avatar: tiloImg,
                        inputType: 'number'
                    });
                    setCurrentStep('ACTIVITY_DAYS');
                    break;
                }

                case 'ACTIVITY_DAYS': {
                    const days = parseInt(cleanText, 10);
                    if (isNaN(days) || days < 1 || days > 7) {
                        addMessage('assistant', 'Por favor indique un número de días válido (1-7).', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        return;
                    }
                    setTempItem(prev => ({ ...prev, dias: days }));

                    addMessage('assistant', isYouth ? 'Y por último, ¿cuántos **minutos** dura tu sesión promedio?' : 'Y por último, ¿cuántos **minutos** dura su sesión promedio?', {
                        avatar: tiloImg,
                        inputType: 'number'
                    });
                    setCurrentStep('ACTIVITY_MINS');
                    break;
                }

                case 'ACTIVITY_MINS': {
                    const mins = parseInt(cleanText, 10);
                    if (isNaN(mins) || mins < 1) {
                        addMessage('assistant', 'Por favor indique una duración en minutos válida.', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        return;
                    }

                    const { actividad, dias } = tempItem;
                    if (!actividad) {
                        setCurrentStep('ACTIVITY_GATE');
                        return;
                    }

                    const finalString = `${actividad} (${dias} días/sem, ${mins} min)`;

                    setActivityData(prev => ({
                        ...prev,
                        exercise: {
                            ...prev.exercise,
                            log: [...(prev.exercise.log || []), finalString]
                        }
                    }));

                    addMessage('assistant', isYouth ? '¿Realizas alguna **otra** actividad física?' : '¿Realiza alguna **otra** actividad física?', {
                        avatar: tiloImg,
                        options: [
                            { label: '✅ Sí', value: 'Sí' },
                            { label: '❌ No', value: 'No' }
                        ]
                    });
                    setCurrentStep('ACTIVITY_LOOP');
                    break;
                }

                case 'ACTIVITY_LOOP': {
                    if (boolVal === false) {
                        addMessage('assistant', isYouth ? '¿Cuántas horas duermes en promedio al día?' : '¿Cuántas horas duerme en promedio al día?', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        setCurrentStep('SLEEP_HOURS');
                    } else if (boolVal === true) {
                        setTempItem({});
                        addMessage('assistant', '¿Qué actividad?', { avatar: tiloImg });
                        setCurrentStep('ACTIVITY_TYPE');
                    } else {
                        addMessage('assistant', isYouth ? 'Disculpa, no te entendí. ¿Realizas alguna otra actividad física? (Responda Sí o No).' : 'Disculpe, no le entendí. ¿Realiza alguna otra actividad física? (Responda Sí o No).', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                    }
                    break;
                }

                // --- SUEÑO ---
                case 'SLEEP_HOURS': {
                    const match = cleanText.match(/\d+/);
                    const val = match ? parseInt(match[0], 10) : NaN;

                    if (isNaN(val) || val < 1 || val > 24) {
                        addMessage('assistant', 'Por favor indique un número de horas válido (entre 1 y 24).', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        return;
                    }

                    setHabitsData(prev => ({ ...prev, sleep: { ...prev.sleep, hours: val } }));

                    addMessage('assistant', isYouth ? '¿Cómo calificarías tu calidad de sueño?' : '¿Cómo calificaría su calidad de sueño?', {
                        avatar: tiloImg,
                        options: [
                            { label: 'Buena', value: 'Buena' },
                            { label: 'Regular', value: 'Regular' },
                            { label: 'Mala', value: 'Mala' }
                        ]
                    });
                    setCurrentStep('SLEEP_QUALITY');
                    break;
                }

                case 'SLEEP_QUALITY': {
                    setHabitsData(prev => ({ ...prev, sleep: { ...prev.sleep, quality: cleanText } }));

                    addMessage('assistant', isYouth ? '¿Cuál es tu nivel de estrés diario en promedio?' : '¿Cuál es su nivel de estrés diario en promedio?', {
                        avatar: tiloImg,
                        options: [
                            { label: 'Bajo', value: 'Bajo' },
                            { label: 'Moderado', value: 'Moderado' },
                            { label: 'Alto', value: 'Alto' }
                        ]
                    });
                    setCurrentStep('STRESS_LEVEL');
                    break;
                }

                // --- ESTRÉS ---
                case 'STRESS_LEVEL': {
                    const stress = cleanText.toLowerCase();
                    const finalHabits = { ...habitsData, stress: stress };

                    setHabitsData(finalHabits);

                    // Finalizando la recolección, actualizamos el Genoma Global
                    updateClinicalContext({
                        habits: finalHabits,
                        activity: activityData
                    });

                    // Transicionar a la siguiente fase
                    onPhaseComplete();
                    break;
                }

                default:
                    break;
            }
        }, 400); // Simulamos retraso de red/Cortex
    };

    const handleOptionSelect = (value) => {
        handleInput(value);
    };

    const getCurrentOptions = () => {
        if (messages.length === 0) return null;
        return messages[messages.length - 1].options;
    };

    const hasInputTypeNumber = () => {
        if (messages.length === 0) return false;
        return messages[messages.length - 1].inputType === 'number';
    };

    return (
        <div className="w-full h-full flex flex-col lg:flex-row bg-[#f8f9fa] overflow-hidden">
            {/* 1. Panel Izquierdo: Chat Integrado */}
            <div className="w-full lg:w-1/2 h-full flex flex-col bg-white border-r border-gray-200">
                {/* Header Chat */}
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={tiloImg} alt="Tilo" className="w-10 h-10 rounded-full object-cover shadow-sm" />
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">Tilo Cortex</h2>
                            <p className="text-sm text-green-600 font-medium">Asistente Clínico Activo</p>
                        </div>
                    </div>
                    <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider">
                        Fase 10: Estilo de Vida
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <img src={msg.avatar} alt="Tilo" className="w-8 h-8 rounded-full mr-3 shadow-sm self-end mb-1" />
                            )}
                            <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-gray-100 text-gray-800 rounded-bl-none'
                                }`}>
                                <ReactMarkdown className="prose prose-sm max-w-none">
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="flex-shrink-0 p-4 bg-white border-t border-gray-200">
                    {getCurrentOptions() ? (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {getCurrentOptions().map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleOptionSelect(opt.value)}
                                    className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-full text-sm font-medium transition-colors border border-indigo-200"
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                type={hasInputTypeNumber() ? "number" : "text"}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleInput(inputValue)}
                                placeholder="Escribe tu respuesta..."
                                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-800"
                                autoFocus
                            />
                            <button
                                onClick={() => handleInput(inputValue)}
                                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                                disabled={!inputValue.trim()}
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Panel Derecho: Summary Tabular */}
            <div className="hidden lg:flex lg:w-1/2 bg-gray-50 p-8 flex-col overflow-y-auto">
                <div className="max-w-xl mx-auto w-full space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Resumen de Hábitos</h3>
                        <p className="text-gray-500 text-sm">Visualización en tiempo real del reporte de estilo de vida.</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
                        <div className="flex items-center justify-between border-b pb-4">
                            <span className="text-gray-600 font-medium">Tabaquismo</span>
                            <span className="text-gray-900 font-semibold">{habitsData.smoking.is_smoker ? 'Sí' : (habitsData.smoking.is_smoker === false ? 'No' : '-')}</span>
                        </div>
                        {habitsData.smoking.details && (
                            <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 mt-2">
                                <strong>Detalle:</strong> {habitsData.smoking.details}
                            </div>
                        )}

                        <div className="flex items-center justify-between border-b pb-4 pt-4">
                            <span className="text-gray-600 font-medium">Alcohol</span>
                            <span className="text-gray-900 font-semibold">{habitsData.alcohol.is_drinker ? 'Sí' : (habitsData.alcohol.is_drinker === false ? 'No' : '-')}</span>
                        </div>
                        {habitsData.alcohol.log.length > 0 && (
                            <div className="bg-blue-50 p-3 rounded-lg text-sm text-gray-700 mt-2 space-y-2">
                                <strong>Historial:</strong>
                                <ul className="list-disc pl-5">
                                    {habitsData.alcohol.log.map((item, idx) => (
                                        <li key={idx}>{item.type}: {item.qty} {item.unit} (~{item.subtotal_kcal} kcal)</li>
                                    ))}
                                </ul>
                                <div className="mt-2 text-right font-bold text-blue-800">
                                    Total Kcal por Ocasión: {habitsData.alcohol.total_kcal_per_occasion} kcal
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between border-b pb-4 pt-4">
                            <span className="text-gray-600 font-medium">Drogas / Recreativas</span>
                            <span className="text-gray-900 font-semibold">{habitsData.drugs.has_usage ? 'Sí' : (habitsData.drugs.has_usage === false ? 'No' : '-')}</span>
                        </div>
                        {habitsData.drugs.log.length > 0 && (
                            <div className="bg-red-50 p-3 rounded-lg text-sm text-gray-700 mt-2">
                                <strong>Historial:</strong> {habitsData.drugs.log.join(', ')}
                            </div>
                        )}

                        <div className="flex items-center justify-between border-b pb-4 pt-4">
                            <span className="text-gray-600 font-medium">Ejercicio</span>
                            <span className="text-gray-900 font-semibold">{activityData.exercise.has_scheduled_exercise ? 'Sí' : (activityData.exercise.has_scheduled_exercise === false ? 'No' : '-')}</span>
                        </div>
                        {activityData.exercise.log.length > 0 && (
                            <div className="bg-green-50 p-3 rounded-lg text-sm text-gray-700 mt-2">
                                <strong>Actividades:</strong>
                                <ul className="list-disc pl-5 mt-1">
                                    {activityData.exercise.log.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex items-center justify-between border-b pb-4 pt-4">
                            <span className="text-gray-600 font-medium">Sueño</span>
                            <span className="text-gray-900 font-semibold">
                                {habitsData.sleep.hours ? `${habitsData.sleep.hours} horas (${habitsData.sleep.quality || '-'})` : '-'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between pt-4">
                            <span className="text-gray-600 font-medium">Estrés</span>
                            <span className="text-gray-900 font-semibold capitalize">{habitsData.stress || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
