import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Check } from 'lucide-react';
import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import tiloImg from '../../assets/tilo.png';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

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
export default function Fase7_Habitos({ messages, setMessages, registerInputHandler, setIsGlobalTyping, patientData, onPhaseComplete }) {
    const { updateClinicalContext } = useClinicalGenome();
    const { patientName: pName, isMinor } = usePatientLinguistics(patientData);

    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            if (messages.length === 0) {
                const initialMsg = isMinor
                    ? `Excelente, ahora evaluaremos algunos hábitos y estilo de vida de ${pName}.\n\n¿Fuma o tiene antecedentes de tabaquismo?`
                    : 'Excelente, ahora evaluaremos algunos hábitos y estilo de vida.\n\n¿Fuma actualmente o tiene antecedentes de tabaquismo?';
                    
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: initialMsg,
                    options: [
                        { label: '✅ Sí', value: 'Sí' },
                        { label: '❌ No', value: 'No' }
                    ]
                }]);
            }
        }
    }, []);

    const [currentStep, setCurrentStep] = useState('SMOKE_GATE');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

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

    const addMessage = (role, content, extra = {}) => {
        setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                newMsgs[newMsgs.length - 1].options = undefined;
                newMsgs[newMsgs.length - 1].inputType = undefined;
            }
            return [...newMsgs, { role, content, ...extra }];
        });
    };

    // Función principal para manejar los inputs del usuario
    const handleInput = (val, label) => {
        const text = label || val;
        if (!text) return;

        // Agregar mensaje del usuario a la pantalla
        addMessage('user', text);
        setIsAnalyzing(true);

        const cleanText = formatText(text);
        const boolVal = strictBooleanValidator(cleanText);

        setTimeout(() => {
            switch (currentStep) {

                // --- TABAQUISMO ---
                case 'SMOKE_GATE': {
                    if (boolVal === true) {
                        setHabitsData(prev => ({ ...prev, smoking: { ...prev.smoking, is_smoker: true } }));
                        addMessage('assistant', isMinor ? `¿Con qué frecuencia y qué cantidad consume ${pName} aproximadamente?` : '¿Con qué frecuencia y qué cantidad consume aproximadamente?', { avatar: tiloImg });
                        setCurrentStep('SMOKE_DETAILS');
                    } else if (boolVal === false) {
                        setHabitsData(prev => ({ ...prev, smoking: { ...prev.smoking, is_smoker: false } }));
                        addMessage('assistant', isMinor ? `Excelente, registrado. Ahora pasemos al alcohol...\n\n¿${pName} consume bebidas alcohólicas?` : 'Excelente, registrado. Ahora pasemos al alcohol...\n\n¿Consume bebidas alcohólicas?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('ALCOHOL_GATE');
                    } else {
                        addMessage('assistant', isMinor ? 'Por favor selecciona Sí o No.' : 'Por favor seleccione Sí o No.', {
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
                    addMessage('assistant', isMinor ? `Excelente, registrado. Ahora pasemos al alcohol...\n\n¿${pName} consume bebidas alcohólicas?` : 'Excelente, registrado. Ahora pasemos al alcohol...\n\n¿Consume bebidas alcohólicas?', {
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
                        addMessage('assistant', isMinor ? `¿Qué tipo de bebida alcohólica suele consumir ${pName} con mayor frecuencia?` : '¿Qué tipo de bebida alcohólica suele consumir con mayor frecuencia?', {
                            avatar: tiloImg,
                            options: [
                                { label: 'Caguama', value: '2' },
                                { label: 'Cerveza', value: '1' },
                                { label: 'Coctelería', value: '5' },
                                { label: 'Destilados', value: '4' },
                                { label: 'Vino', value: '3' }
                            ]
                        });
                        setCurrentStep('ALCOHOL_TYPE');
                    } else if (boolVal === false) {
                        setHabitsData(prev => ({ ...prev, alcohol: { ...prev.alcohol, is_drinker: false } }));
                        addMessage('assistant', isMinor ? `Entendido.\n\n¿${pName} consume alguna sustancia recreativa (drogas)?` : 'Entendido.\n\n¿Consume alguna sustancia recreativa (drogas)?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('DRUGS_GATE');
                    } else {
                        addMessage('assistant', isMinor ? 'Por favor indica Sí o No.' : 'Por favor indique Sí o No.', {
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
                        "2": { label: "Caguama", unit: "Envase 940ml", kcal: 380 },
                        "1": { label: "Cerveza", unit: "Lata 355ml", kcal: 150 },
                        "5": { label: "Coctelería", unit: "Vaso Estándar", kcal: 250 },
                        "4": { label: "Destilados", unit: "Shot 45ml", kcal: 100 },
                        "3": { label: "Vino", unit: "Copa 150ml", kcal: 120 },
                        "Caguama": { label: "Caguama", unit: "Envase 940ml", kcal: 380 },
                        "Cerveza": { label: "Cerveza", unit: "Lata 355ml", kcal: 150 },
                        "Coctelería": { label: "Coctelería", unit: "Vaso Estándar", kcal: 250 },
                        "Destilados": { label: "Destilados", unit: "Shot 45ml", kcal: 100 },
                        "Vino": { label: "Vino", unit: "Copa 150ml", kcal: 120 }
                    };
                    const selected = map[cleanText];
                    if (!selected) {
                        addMessage('assistant', isMinor ? 'Por favor selecciona una de las opciones válidas.' : 'Por favor seleccione una de las opciones válidas.', { avatar: tiloImg });
                        return;
                    }
                    setTempItem({ current_alc: selected });
                    addMessage('assistant', isMinor ? `Entendido. ¿Cuántas unidades de ${selected.unit} suele tomar ${pName} por ocasión?` : `Entendido. ¿Cuántas unidades de ${selected.unit} suele tomar por ocasión?`, {
                        avatar: tiloImg,
                        inputType: 'number'
                    });
                    setCurrentStep('ALCOHOL_QTY');
                    break;
                }

                case 'ALCOHOL_QTY': {
                    const qty = parseFloat(cleanText);
                    if (isNaN(qty) || qty < 0) {
                        addMessage('assistant', isMinor ? 'Por favor indica un número válido.' : 'Por favor indique un número válido.', {
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

                    addMessage('assistant', isMinor ? `Registrado. ¿${pName} consume algún otro tipo de bebida alcohólica?` : 'Registrado. ¿Consume algún otro tipo de bebida alcohólica?', {
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
                        addMessage('assistant', isMinor ? 'Selecciona el tipo de bebida:' : 'Seleccione el tipo de bebida:', {
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
                        addMessage('assistant', isMinor ? `¿${pName} consume alguna sustancia recreativa (drogas)?` : '¿Consume alguna otra sustancia recreativa (drogas)?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('DRUGS_GATE');
                    } else {
                        addMessage('assistant', isMinor ? 'Responde Sí o No.' : 'Responda Sí o No.', {
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
                        addMessage('assistant', isMinor ? `¿${pName} realiza ejercicio físico?` : '¿Realiza ejercicio físico?', {
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
                        addMessage('assistant', isMinor ? 'Disculpa, no te entendí. ¿Consume alguna otra sustancia? (Responde Sí o No).' : 'Disculpe, no le entendí. ¿Consume alguna otra sustancia? (Responda Sí o No).', {
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
                        addMessage('assistant', isMinor ? `¿${pName} realiza ejercicio físico?` : '¿Realiza ejercicio físico?', {
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
                        addMessage('assistant', isMinor ? 'Disculpa, no te entendí. ¿Alguna otra sustancia? (Responde Sí o No).' : 'Disculpe, no le entendí. ¿Alguna otra sustancia? (Responda Sí o No).', {
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
                        addMessage('assistant', isMinor ? `¿Cuántas horas duerme ${pName} en promedio al día?` : '¿Cuántas horas duerme en promedio al día?', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        setCurrentStep('SLEEP_HOURS');
                    } else if (boolVal === true) {
                        setActivityData(prev => ({ ...prev, exercise: { ...prev.exercise, has_scheduled_exercise: true } }));
                        setTempItem({}); // Limpiamos
                        addMessage('assistant', isMinor ? `Muy bien. ¿Qué actividad realiza ${pName}? (Ej. Correr, Natación)` : 'Muy bien. ¿Qué actividad realiza? (Ej. Correr, Natación)', { avatar: tiloImg });
                        setCurrentStep('ACTIVITY_TYPE');
                    } else {
                        addMessage('assistant', isMinor ? 'Disculpa, no te entendí. ¿Realiza alguna actividad física? (Responde Sí o No).' : 'Disculpe, no le entendí. ¿Realiza alguna actividad física? (Responda Sí o No).', {
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
                    addMessage('assistant', isMinor ? `¿Cuántos **días** a la semana la practica ${pName}? (Número 1-7)` : '¿Cuántos **días** a la semana la practica? (Número 1-7)', {
                        avatar: tiloImg,
                        inputType: 'number'
                    });
                    setCurrentStep('ACTIVITY_DAYS');
                    break;
                }

                case 'ACTIVITY_DAYS': {
                    const days = parseInt(cleanText, 10);
                    if (isNaN(days) || days < 1 || days > 7) {
                        addMessage('assistant', isMinor ? 'Por favor indica un número de días válido (1-7).' : 'Por favor indique un número de días válido (1-7).', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        return;
                    }
                    setTempItem(prev => ({ ...prev, dias: days }));

                    addMessage('assistant', isMinor ? `Y por último, ¿cuántos **minutos** dura su sesión promedio?` : 'Y por último, ¿cuántos **minutos** dura su sesión promedio?', {
                        avatar: tiloImg,
                        inputType: 'number'
                    });
                    setCurrentStep('ACTIVITY_MINS');
                    break;
                }

                case 'ACTIVITY_MINS': {
                    const mins = parseInt(cleanText, 10);
                    if (isNaN(mins) || mins < 1) {
                        addMessage('assistant', isMinor ? 'Por favor indica una duración en minutos válida.' : 'Por favor indique una duración en minutos válida.', {
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

                    addMessage('assistant', isMinor ? `¿Realiza ${pName} alguna **otra** actividad física?` : '¿Realiza alguna **otra** actividad física?', {
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
                        addMessage('assistant', isMinor ? `¿Cuántas horas duerme ${pName} en promedio al día?` : '¿Cuántas horas duerme en promedio al día?', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        setCurrentStep('SLEEP_HOURS');
                    } else if (boolVal === true) {
                        setTempItem({});
                        addMessage('assistant', '¿Qué actividad?', { avatar: tiloImg });
                        setCurrentStep('ACTIVITY_TYPE');
                    } else {
                        addMessage('assistant', isMinor ? 'Disculpa, no te entendí. ¿Realiza alguna otra actividad física? (Responde Sí o No).' : 'Disculpe, no le entendí. ¿Realiza alguna otra actividad física? (Responda Sí o No).', {
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
                        addMessage('assistant', isMinor ? 'Por favor indica un número de horas válido (entre 1 y 24).' : 'Por favor indique un número de horas válido (entre 1 y 24).', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        return;
                    }

                    setHabitsData(prev => ({ ...prev, sleep: { ...prev.sleep, hours: val } }));

                    addMessage('assistant', isMinor ? `¿Cómo calificaría la calidad de sueño de ${pName}?` : '¿Cómo calificaría su calidad de sueño?', {
                        avatar: tiloImg,
                        options: [
                            { label: 'Buena', value: 'Buena' },
                            { label: 'Mala', value: 'Mala' },
                            { label: 'Regular', value: 'Regular' }
                        ]
                    });
                    setCurrentStep('SLEEP_QUALITY');
                    break;
                }

                case 'SLEEP_QUALITY': {
                    setHabitsData(prev => ({ ...prev, sleep: { ...prev.sleep, quality: cleanText } }));

                    addMessage('assistant', isMinor ? `¿Cuál es el nivel de estrés diario en promedio de ${pName}?` : '¿Cuál es su nivel de estrés diario en promedio?', {
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

                    const finalMsg = isMinor 
                        ? `Auditoría completada. Revise el panel derecho para confirmar que los hábitos de ${pName} están capturados correctamente.\n\n¿Son correctos estos datos?`
                        : `Auditoría completada. Revise el panel derecho para confirmar que sus hábitos están capturados correctamente.\n\n¿Son correctos estos datos?`;

                    addMessage('assistant', finalMsg, {
                        avatar: tiloImg,
                        options: [
                            { label: "Sí, los datos son correctos", value: "CONFIRM_DATA" },
                            { label: "No, quiero corregir algo", value: "CORRECT_DATA" }
                        ]
                    });
                    setCurrentStep('REVIEW_SUMMARY');
                    break;
                }

                case 'REVIEW_SUMMARY': {
                    if (text === "CONFIRM_DATA") {
                        // Finalizando la recolección, actualizamos el Genoma Global
                        updateClinicalContext({
                            habits: habitsData,
                            activity: activityData
                        });
                        
                        addMessage('user', "Sí, los datos son correctos");
                        addMessage('assistant', "Perfecto. Avancemos a la siguiente fase.");

                        setTimeout(() => {
                            onPhaseComplete?.(habitsData, null);
                        }, 1000);
                    } else if (text === "CORRECT_DATA") {
                        setHabitsData({
                            smoking: { is_smoker: false, details: '' },
                            alcohol: { is_drinker: false, log: [], total_kcal_per_occasion: 0 },
                            drugs: { has_usage: false, log: [] },
                            sleep: { hours: 0, quality: '' },
                            stress: ''
                        });
                        setActivityData({
                            exercise: { has_scheduled_exercise: false, log: [] }
                        });
                        
                        addMessage('assistant', isMinor 
                            ? `De acuerdo, vamos a corregir. ¿${pName} fuma o tiene antecedentes de tabaquismo?` 
                            : 'De acuerdo, vamos a corregir. ¿Fuma actualmente o tiene antecedentes de tabaquismo?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('SMOKE_GATE');
                    }
                    break;
                }

                default:
                    break;
            }
        setIsAnalyzing(false);
        }, 400); // Simulamos retraso de red/Cortex
    };

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, val) => handleInput(val, text));
        }
    }, [registerInputHandler, currentStep, tempItem, habitsData, activityData]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(isAnalyzing);
        }
    }, [isAnalyzing, setIsGlobalTyping]);

    // Headless UI: Return the right-side summary panel to be rendered by ChatView layout if supported.
    // We wrap it so the host component (App.jsx) can render it alongside ChatView.
    // Headless UI: Phase 7 uses the Markdown-Pill Protocol (tilo-phase-closure-standard)
    return null;
}
