import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send } from 'lucide-react';
import tiloImg from '../../assets/tilo.png';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { checkInteractionsAndProceed } from '../../services/InteractionEngine';

const formatText = (text) => text.trim();
const strictBooleanValidator = (text) => {
    const raw = text.toLowerCase().trim();
    if (raw === 'sí' || raw === 'si') return true;
    if (raw === 'no') return false;
    return null;
};

// ==========================================
// COMPONENTE: Fase 10 (Hábitos y Consumo)
// ==========================================
export default function Fase10_HabitosConsumo({ messages, setMessages, patientData, setPatientData, onPhaseComplete, registerInputHandler, setIsGlobalTyping }) {
    const { patientName: pName, isMinor, isLactante, isPediatrico } = usePatientLinguistics(patientData);

    console.log("🔍 Fase10_HabitosConsumo Mount/Render. Props:", {
        hasMessages: !!messages,
        messagesLength: messages?.length,
        typeofSetMessages: typeof setMessages,
        hasSetPatientData: !!setPatientData
    });

    const updateClinicalContext = (updates) => {
        if (setPatientData) {
            setPatientData(prev => ({
                ...prev,
                clinical_context: {
                    ...(prev.clinical_context || {}),
                    ...updates,
                    ai_analysis: {
                        ...(prev.clinical_context?.ai_analysis || {}),
                        ...(updates.ai_analysis || {})
                    }
                }
            }));
        }
    };

    const hasGreeted = useRef(false);
    
    const [currentStep, _setCurrentStep] = useState(() => {
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && msg.content.includes("registro de hábitos de consumo"));
        const h = patientData?.habits;
        const hasHabits = h && (h.smoking?.is_smoker !== null || h.alcohol?.is_drinker !== null);
        if (hasSummary || hasHabits) {
            return 'correct_menu';
        }
        return 'SMOKE_GATE';
    });

    const setCurrentStep = (newStep) => {
        _setCurrentStep(newStep);
        setHabitsData(prev => ({
            ...prev,
            currentStep: newStep
        }));
    };

    useEffect(() => {
        if (hasGreeted.current) return;

        if (currentStep === 'correct_menu') {
            hasGreeted.current = true;
            const greetingMsg = {
                role: 'assistant',
                content: "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de hábitos de consumo?",
                avatar: tiloImg,
                options: [
                    { label: "✏️ Modificar consumo de tabaco", value: "MODIFY_SMOKING" },
                    { label: "✏️ Modificar consumo de alcohol", value: "MODIFY_ALCOHOL" },
                    { label: "🔄 Limpiar historial de hábitos", value: "CLEAR_ALL" },
                    { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                ]
            };
            setMessages(prev => [...prev, greetingMsg]);
            return;
        }

        // TIERED BYPASS PEDIÁTRICO (patientAge < 18): Omitir toxicología de adultos (Tabaco, Alcohol, Drogas)
        if (isPediatrico) {
            hasGreeted.current = true;
            const pediatricHabits = {
                smoking: { is_smoker: false, type: "NINGUNO", quantity_text: "NO_APLICA_PEDIATRICO", risk_level: "LOW" },
                alcohol: { is_drinker: false, preferred_drink: "NINGUNA", frequency_days: 0, units_per_session: 0, calculated_weekly_calories: 0, drinks: [] },
                drugs: { has_usage: false, substance_name: "NINGUNA", frequency: "NO_APLICA_PEDIATRICO" },
                sleep: { hours: isLactante ? 14 : 9, quality: "GOOD" },
                stress: "Bajo (Entorno Pediátrico)"
            };

            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    habits: pediatricHabits,
                    clinical_context: {
                        ...(prev.clinical_context || {}),
                        habits: pediatricHabits
                    }
                }));
            }

            if (isLactante) {
                // Inyectar Pregunta Pediátrica ATM 4 (Ablactación & Mediadores de Desarrollo)
                const atm4Msg = {
                    role: 'assistant',
                    content: `Para evaluar los **Mediadores de Desarrollo de ${pName}** (su bebé): ¿Cómo es el proceso de introducción de alimentos sólidos (ablactación)?`,
                    avatar: tiloImg,
                    options: [
                        { label: "🍼 Lactancia Exclusiva (Aún no inicia sólidos)", value: "WEANING_NOT_STARTED" },
                        { label: "🥣 Papillas / Purés tradicionales", value: "WEANING_PAPILLAS" },
                        { label: "🥦 Baby-Led Weaning (BLW / Autorregulación)", value: "WEANING_BLW" },
                        { label: "⚠️ Sensibilidad / Dificultad con texturas", value: "WEANING_SENSITIVE" }
                    ]
                };
                setMessages(prev => [...prev, atm4Msg]);
                setCurrentStep('PEDIATRIC_ATM_4');
            } else {
                // Pacientes pediátricos de 2 a 17 años: Sellar hábitos de entorno pediátrico
                const pediatricMsg = {
                    role: 'assistant',
                    content: `✅ Hábitos de entorno y desarrollo pediátrico de **${pName}** registrados y consolidados sin exposición a factores de riesgo adulto.`,
                    avatar: tiloImg
                };
                setMessages(prev => [...prev, pediatricMsg]);
                setTimeout(() => {
                    if (onPhaseComplete) onPhaseComplete(pediatricHabits, messages);
                }, 800);
            }
            return;
        }

        const alreadyGreeted = messages && messages.some(msg => msg.role === 'assistant' && msg.content.includes("vapeadores"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;
            const initialMsg = isMinor
                ? `Excelente, ahora evaluaremos algunos hábitos y estilo de vida de ${pName}.\n\n¿Fuma tabaco o utiliza vapeadores?`
                : 'Excelente, ahora evaluaremos algunos hábitos y estilo de vida.\n\n¿Fuma tabaco o utiliza vapeadores?';

            const greetingMsg = {
                role: 'assistant',
                content: initialMsg,
                avatar: tiloImg,
                options: [
                    { label: '✅ Sí', value: 'Sí' },
                    { label: '❌ No', value: 'No' }
                ]
            };
            if (typeof setMessages === 'function') {
                setMessages(prev => [...prev, greetingMsg]);
            } else {
                console.error("❌ setMessages is not a function in Fase10_HabitosConsumo!", { setMessages });
            }
        }
    }, [messages, isMinor, isLactante, isPediatrico, pName, setMessages, currentStep]);

    const [collectedDrinks, setCollectedDrinks] = useState(() => {
        return patientData?.habits?.alcohol?.drinks || [];
    });
    const [inputValue, setInputValue] = useState('');
    const [habitsData, setHabitsData] = useState(() => {
        const base = patientData?.habits || {};
        return {
            smoking: base.smoking || { is_smoker: null, type: null, quantity_text: "", risk_level: null },
            alcohol: base.alcohol || { is_drinker: null, preferred_drink: null, frequency_days: null, units_per_session: null, calculated_weekly_calories: null, drinks: [] },
            drugs: base.drugs || { has_usage: null, substance_name: "", frequency: "" },
            sleep: base.sleep || { hours: null, quality: "" },
            stress: base.stress || "",
            currentStep: base.currentStep || 'SMOKE_GATE'
        };
    });

    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Variables temporales para la recolección
    const [tempItem, setTempItem] = useState({});

    const messagesEndRef = useRef(null);
    const setMessagesEndRef = React.useCallback((node) => {
        if (node) {
            messagesEndRef.current = node;
            node.scrollIntoView({ behavior: 'auto' });
        }
    }, []);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Sincronizar en tiempo real el progreso de hábitos con el estado global patientData (raíz y clinical_context)
    useEffect(() => {
        if (setPatientData) {
            setPatientData(prev => {
                if (JSON.stringify(prev.habits) === JSON.stringify(habitsData)) {
                    return prev;
                }
                return {
                    ...prev,
                    habits: habitsData,
                    clinical_context: {
                        ...(prev.clinical_context || {}),
                        habits: habitsData
                    }
                };
            });
        }
    }, [habitsData, setPatientData]);

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
    const handleInput = (text, label = null) => {
        if (!text.trim()) return;

        let userText = text;
        if (text === "MODIFY_SMOKING") userText = "✏️ Modificar consumo de tabaco";
        if (text === "MODIFY_ALCOHOL") userText = "✏️ Modificar consumo de alcohol";
        if (text === "CLEAR_ALL") userText = "🔄 Limpiar historial de hábitos";
        if (text === "FINISH") userText = "❌ Cancelar (Volver al resumen)";

        // Agregar mensaje del usuario a la pantalla
        if (label !== 'button') {
            addMessage('user', userText);
        }
        setInputValue('');

        const cleanText = formatText(text);
        const boolVal = strictBooleanValidator(cleanText);

        setTimeout(() => {
            switch (currentStep) {
                case 'correct_menu': {
                    if (text === "MODIFY_SMOKING") {
                        addMessage('assistant', isMinor 
                            ? `¿Fuma tabaco o utiliza vapeadores?` 
                            : '¿Fuma tabaco o utiliza vapeadores?', { 
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('SMOKE_GATE');
                    } else if (text === "MODIFY_ALCOHOL") {
                        addMessage('assistant', isMinor 
                            ? `¿${pName} consume bebidas alcohólicas?` 
                            : '¿Consume bebidas alcohólicas?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('ALCOHOL_GATE');
                    } else if (text === "CLEAR_ALL") {
                        setCollectedDrinks([]);
                        setHabitsData({
                            smoking: { is_smoker: null, type: null, quantity_text: "", risk_level: null },
                            alcohol: { is_drinker: null, preferred_drink: null, frequency_days: null, units_per_session: null, calculated_weekly_calories: null, drinks: [] },
                            drugs: { has_usage: null, substance_name: "", frequency: "" },
                            sleep: { hours: null, quality: "" },
                            stress: "",
                            currentStep: 'SMOKE_GATE'
                        });
                        addMessage('assistant', isMinor
                            ? `Historial de hábitos reiniciado.\n\n¿Fuma tabaco o utiliza vapeadores?`
                            : 'Historial de hábitos reiniciado.\n\n¿Fuma tabaco o utiliza vapeadores?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('SMOKE_GATE');
                    } else if (text === "FINISH") {
                        if (onPhaseComplete) {
                            onPhaseComplete(habitsData, messagesRef.current);
                        }
                    }
                    break;
                }

                case 'PEDIATRIC_ATM_4': {
                    const atm4Map = {
                        WEANING_NOT_STARTED: "Lactancia Exclusiva (Sin sólidos)",
                        WEANING_PAPILLAS: "Papillas y Purés tradicionales",
                        WEANING_BLW: "Baby-Led Weaning (BLW / Autorregulación)",
                        WEANING_SENSITIVE: "Sensibilidad o Dificultad con texturas"
                    };
                    const weaningLabel = atm4Map[text] || text;
                    const updatedHabits = {
                        ...habitsData,
                        pediatric_atm: { ...(habitsData.pediatric_atm || {}), weaning: weaningLabel }
                    };
                    setHabitsData(updatedHabits);
                    updateClinicalContext({ habits: updatedHabits });

                    addMessage('assistant', `✅ Mediadores de desarrollo y ablactación de **${pName}** (${weaningLabel}) registrados con éxito.`, { avatar: tiloImg });
                    setTimeout(() => {
                        if (onPhaseComplete) onPhaseComplete(updatedHabits, messagesRef.current);
                    }, 800);
                    break;
                }

                // --- TABAQUISMO ---
                case 'SMOKE_GATE': {
                    if (boolVal === true) {
                        setHabitsData(prev => ({ 
                            ...prev, 
                            smoking: { ...prev.smoking, is_smoker: true } 
                        }));
                        addMessage('assistant', isMinor 
                            ? `¿Qué tipo de producto consume principalmente ${pName}?` 
                            : '¿Qué tipo de producto consume principalmente?', { 
                            avatar: tiloImg,
                            options: [
                                { label: '🚬 Cigarro Convencional', value: 'CIGARETTE' },
                                { label: '💨 Vapeador / Electrónico', value: 'VAPE' },
                                { label: '🔄 Ambos', value: 'BOTH' }
                            ]
                        });
                        setCurrentStep('SMOKE_TYPE');
                    } else if (boolVal === false) {
                        setHabitsData(prev => ({ 
                            ...prev, 
                            smoking: { is_smoker: false, type: null, quantity_text: "", risk_level: 'LOW' } 
                        }));
                        addMessage('assistant', isMinor 
                            ? `Excelente, registrado. Ahora pasemos al alcohol...\n\n¿${pName} consume bebidas alcohólicas?` 
                            : 'Excelente, registrado. Ahora pasemos al alcohol...\n\n¿Consume bebidas alcohólicas?', {
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

                case 'SMOKE_TYPE': {
                    const validTypes = ['CIGARETTE', 'VAPE', 'BOTH'];
                    if (!validTypes.includes(cleanText)) {
                        addMessage('assistant', 'Por favor seleccione una opción válida de la lista.', {
                            avatar: tiloImg,
                            options: [
                                { label: '🚬 Cigarro Convencional', value: 'CIGARETTE' },
                                { label: '💨 Vapeador / Electrónico', value: 'VAPE' },
                                { label: '🔄 Ambos', value: 'BOTH' }
                            ]
                        });
                        return;
                    }

                    setHabitsData(prev => ({ 
                        ...prev, 
                        smoking: { ...prev.smoking, type: cleanText } 
                    }));

                    addMessage('assistant', isMinor 
                        ? `¿Con qué frecuencia y qué cantidad consume ${pName} aproximadamente? (Ej. 5 cigarros al día, 1 pod a la semana)` 
                        : '¿Con qué frecuencia y qué cantidad consume aproximadamente? (Ej. 5 cigarros al día, 1 pod a la semana)', { 
                        avatar: tiloImg 
                    });
                    setCurrentStep('SMOKE_QTY');
                    break;
                }

                case 'SMOKE_QTY': {
                    const lText = cleanText.toLowerCase();
                    const isHeavy = lText.includes('día') || lText.includes('dia') || lText.includes('diari') || /\d+/.test(cleanText);
                    const parsedRisk = isHeavy ? 'HIGH' : 'LOW';

                    setHabitsData(prev => ({ 
                        ...prev, 
                        smoking: { ...prev.smoking, quantity_text: cleanText, risk_level: parsedRisk } 
                    }));

                    addMessage('assistant', isMinor 
                        ? `Excelente, registrado. Ahora pasemos al alcohol...\n\n¿${pName} consume bebidas alcohólicas?` 
                        : 'Excelente, registrado. Ahora pasemos al alcohol...\n\n¿Consume bebidas alcohólicas?', {
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
                        setHabitsData(prev => ({ 
                            ...prev, 
                            alcohol: { ...prev.alcohol, is_drinker: true } 
                        }));
                        addMessage('assistant', isMinor 
                            ? `¿Qué tipo de bebida alcohólica suele consumir ${pName} con mayor frecuencia?` 
                            : '¿Qué tipo de bebida alcohólica suele consumir con mayor frecuencia?', {
                            avatar: tiloImg,
                            options: [
                                { label: '🍺 Cerveza (Lata 355ml)', value: 'BEER_355' },
                                { label: '🍾 Caguama / Grande (940ml)', value: 'BEER_940' },
                                { label: '🍷 Vino (Copa 150ml)', value: 'WINE' },
                                { label: '🥃 Destilados (Tequila/Whisky)', value: 'SPIRITS' },
                                { label: '🍹 Coctelería Azucarada', value: 'COCKTAILS' }
                            ]
                        });
                        setCurrentStep('ALCOHOL_TYPE');
                    } else if (boolVal === false) {
                        setHabitsData(prev => ({ 
                            ...prev, 
                            alcohol: { is_drinker: false, preferred_drink: null, frequency_days: 0, units_per_session: 0, calculated_weekly_calories: 0 } 
                        }));
                        addMessage('assistant', isMinor 
                            ? `Entendido.\n\n¿${pName} consume alguna sustancia recreativa (drogas)?` 
                            : 'Entendido.\n\n¿Consume alguna sustancia recreativa (drogas)?', {
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
                    const validDrinks = ['BEER_355', 'BEER_940', 'WINE', 'SPIRITS', 'COCKTAILS'];
                    if (!validDrinks.includes(cleanText)) {
                        addMessage('assistant', 'Por favor seleccione una bebida válida de la lista.', {
                            avatar: tiloImg,
                            options: [
                                { label: '🍺 Cerveza (Lata 355ml)', value: 'BEER_355' },
                                { label: '🍾 Caguama / Grande (940ml)', value: 'BEER_940' },
                                { label: '🍷 Vino (Copa 150ml)', value: 'WINE' },
                                { label: '🥃 Destilados (Tequila/Whisky)', value: 'SPIRITS' },
                                { label: '🍹 Coctelería Azucarada', value: 'COCKTAILS' }
                            ]
                        });
                        return;
                    }

                    setTempItem({ preferred_drink: cleanText });

                    addMessage('assistant', isMinor 
                        ? `¿Cuántos días a la semana suele beber ${pName}? (Número del 0 al 7, donde 0 es ocasional)` 
                        : '¿Cuántos días a la semana suele beber? (Número del 0 al 7, donde 0 es ocasional)', {
                        avatar: tiloImg,
                        inputType: 'number'
                    });
                    setCurrentStep('ALCOHOL_FREQ');
                    break;
                }

                case 'ALCOHOL_FREQ': {
                    const days = parseInt(cleanText, 10);
                    if (isNaN(days) || days < 0 || days > 7) {
                        addMessage('assistant', 'Por favor indique un número válido de días de 0 a 7:', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        return;
                    }

                    setTempItem(prev => ({ ...prev, frequency_days: days }));

                    const drinkMapping = {
                        BEER_355: 'lata de 355ml',
                        BEER_940: 'envase de caguama (940ml)',
                        WINE: 'copa de 150ml',
                        SPIRITS: 'shot de 45ml',
                        COCKTAILS: 'vaso de coctel'
                    };
                    const unitLabel = drinkMapping[tempItem.preferred_drink] || 'unidad';

                    addMessage('assistant', isMinor 
                        ? `En un día de consumo, ¿cuántas unidades (${unitLabel}) suele tomar ${pName}?` 
                        : `En un día de consumo, ¿cuántas unidades (${unitLabel}) suele tomar?`, {
                        avatar: tiloImg,
                        inputType: 'number'
                    });
                    setCurrentStep('ALCOHOL_QTY');
                    break;
                }

                case 'ALCOHOL_QTY': {
                    const qty = parseFloat(cleanText);
                    if (isNaN(qty) || qty < 0) {
                        addMessage('assistant', 'Por favor indique un número válido de unidades:', {
                            avatar: tiloImg,
                            inputType: 'number'
                        });
                        return;
                    }

                    const { preferred_drink, frequency_days } = tempItem;
                    const kcalMap = {
                        BEER_355: 150,
                        BEER_940: 380,
                        WINE: 120,
                        SPIRITS: 100,
                        COCKTAILS: 250
                    };
                    const kcalUnit = kcalMap[preferred_drink] || 0;
                    const calculatedKcal = (frequency_days || 1) * qty * kcalUnit;

                    const newDrink = {
                        preferred_drink,
                        frequency_days,
                        units_per_session: qty,
                        calculated_weekly_calories: calculatedKcal
                    };

                    const updatedDrinks = [...collectedDrinks, newDrink];
                    setCollectedDrinks(updatedDrinks);

                    const drinkMapping = {
                        BEER_355: 'Cerveza (Lata 355ml)',
                        BEER_940: 'Cerveza Caguama (940ml)',
                        WINE: 'Vino (Copa 150ml)',
                        SPIRITS: 'Destilados (Tequila/Whisky)',
                        COCKTAILS: 'Coctelería Azucarada'
                    };
                    const totalWeeklyKcal = updatedDrinks.reduce((sum, d) => sum + d.calculated_weekly_calories, 0);
                    const preferredDrinkNames = updatedDrinks.map(d => drinkMapping[d.preferred_drink] || d.preferred_drink).join(", ");

                    setHabitsData(prev => ({ 
                        ...prev, 
                        alcohol: {
                            is_drinker: true,
                            preferred_drink: preferredDrinkNames,
                            frequency_days: updatedDrinks[0]?.frequency_days,
                            units_per_session: updatedDrinks[0]?.units_per_session,
                            calculated_weekly_calories: totalWeeklyKcal,
                            drinks: updatedDrinks
                        }
                    }));

                    addMessage('assistant', 'Bebida registrada. ¿Consume regularmente algún otro tipo de bebida alcohólica (ej. vino, destilados)?', {
                        avatar: tiloImg,
                        options: [
                            { label: '✅ Sí, agregar otra', value: 'Sí' },
                            { label: '❌ No, solo esa', value: 'No' }
                        ]
                    });
                    setCurrentStep('ALCOHOL_LOOP_GATE');
                    break;
                }

                case 'ALCOHOL_LOOP_GATE': {
                    if (boolVal === true) {
                        addMessage('assistant', isMinor 
                            ? `¿Qué otro tipo de bebida alcohólica suele consumir ${pName}?` 
                            : '¿Qué otro tipo de bebida alcohólica suele consumir?', {
                            avatar: tiloImg,
                            options: [
                                { label: '🍺 Cerveza (Lata 355ml)', value: 'BEER_355' },
                                { label: '🍾 Caguama / Grande (940ml)', value: 'BEER_940' },
                                { label: '🍷 Vino (Copa 150ml)', value: 'WINE' },
                                { label: '🥃 Destilados (Tequila/Whisky)', value: 'SPIRITS' },
                                { label: '🍹 Coctelería Azucarada', value: 'COCKTAILS' }
                            ]
                        });
                        setCurrentStep('ALCOHOL_TYPE');
                    } else if (boolVal === false) {
                        addMessage('assistant', isMinor 
                            ? `Entendido.\n\n¿${pName} consume alguna sustancia recreativa (drogas)?` 
                            : 'Entendido.\n\n¿Consume alguna sustancia recreativa (drogas)?', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                        setCurrentStep('DRUGS_GATE');
                    } else {
                        addMessage('assistant', 'Por favor seleccione Sí o No.', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí, agregar otra', value: 'Sí' },
                                { label: '❌ No, solo esa', value: 'No' }
                            ]
                        });
                    }
                    break;
                }

                // --- DROGAS ---
                case 'DRUGS_GATE': {
                    if (boolVal === false) {
                        const finalDrugs = { has_usage: false, substance_name: "", frequency: "" };
                        setHabitsData(prev => ({ ...prev, drugs: finalDrugs }));
                        showReviewSummary({ ...habitsData, drugs: finalDrugs });
                    } else if (boolVal === true) {
                        setHabitsData(prev => ({ ...prev, drugs: { ...prev.drugs, has_usage: true } }));
                        addMessage('assistant', '¿Cuál sustancia?', { avatar: tiloImg });
                        setCurrentStep('DRUGS_TYPE');
                    } else {
                        addMessage('assistant', isMinor ? 'Por favor responde Sí o No.' : 'Por favor responda Sí o No.', {
                            avatar: tiloImg,
                            options: [
                                { label: '✅ Sí', value: 'Sí' },
                                { label: '❌ No', value: 'No' }
                            ]
                        });
                    }
                    break;
                }

                case 'DRUGS_TYPE': {
                    setTempItem({ substance_name: cleanText });
                    addMessage('assistant', '¿Con qué frecuencia la consume?', { avatar: tiloImg });
                    setCurrentStep('DRUGS_FREQ');
                    break;
                }

                case 'DRUGS_FREQ': {
                    const finalDrugs = {
                        has_usage: true,
                        substance_name: tempItem.substance_name,
                        frequency: cleanText
                    };
                    const finalHabits = { ...habitsData, drugs: finalDrugs };
                    setHabitsData(finalHabits);
                    showReviewSummary(finalHabits);
                    break;
                }

                case 'REVIEW_SUMMARY': {
                    if (text === "CONFIRM_DATA") {
                        // 1. Ejecutar el Motor de Interacciones Clínicas de Seguridad
                        const hasDrugsReported = habitsData.drugs.has_usage;
                        const drugNameReported = habitsData.drugs.substance_name || "";
                        
                        const { flags, critical } = checkInteractionsAndProceed(patientData, hasDrugsReported, drugNameReported);

                        // 2. Guardar las banderas de seguridad en el estado global
                        if (setPatientData) {
                            setPatientData(prev => ({
                                ...prev,
                                safety: {
                                    ...prev.safety,
                                    interaction_check_timestamp: new Date().toISOString(),
                                    interaction_flags: flags
                                }
                            }));
                        }

                        // 3. Romper la cuarta pared si hay alerta crítica
                        if (critical) {
                            addMessage('assistant', `⚠️ **ALERTA DE SEGURIDAD CRÍTICA:** ${critical.user_message}\n\n*Esta combinación presenta un riesgo severo. El sistema adaptará su plan nutricional bloqueando y restringiendo cualquier suplemento estimulante o compuesto hepatotóxico.*`, {
                                isCritical: true,
                                avatar: tiloImg
                            });
                            
                            setTimeout(() => {
                                updateClinicalContext({
                                    habits: habitsData
                                });
                                addMessage('assistant', "Información registrada. Pasemos a la actividad física.", { avatar: tiloImg });
                                setTimeout(() => {
                                    onPhaseComplete?.(habitsData, messagesRef.current);
                                }, 1500);
                            }, 4500);
                        } else {
                            // Flujo normal
                            updateClinicalContext({
                                habits: habitsData
                            });
                            addMessage('assistant', "Información registrada. Pasemos a la actividad física.", { avatar: tiloImg });
                            setTimeout(() => {
                                onPhaseComplete?.(habitsData, messagesRef.current);
                            }, 1000);
                        }
                    } else if (text === "CORRECT_DATA") {
                        setCollectedDrinks([]);
                        setHabitsData({
                            smoking: { is_smoker: null, type: null, quantity_text: "", risk_level: null },
                            alcohol: { is_drinker: null, preferred_drink: null, frequency_days: null, units_per_session: null, calculated_weekly_calories: null, drinks: [] },
                            drugs: { has_usage: null, substance_name: "", frequency: "" },
                            sleep: { hours: null, quality: "" },
                            stress: "",
                            currentStep: 'SMOKE_GATE'
                        });
                        addMessage('assistant', isMinor 
                            ? `De acuerdo, vamos a corregir. ¿${pName} fuma tabaco o utiliza vapeadores?` 
                            : 'De acuerdo, vamos a corregir. ¿Fuma tabaco o utiliza vapeadores?', {
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
        }, 400);
    };

    const showReviewSummary = (habs) => {
        const typeMapping = {
            CIGARETTE: 'Cigarro Convencional',
            VAPE: 'Vapeador / Electrónico',
            BOTH: 'Ambos'
        };
        const drinkMapping = {
            BEER_355: 'Cerveza (Lata 355ml)',
            BEER_940: 'Cerveza Caguama (940ml)',
            WINE: 'Vino (Copa 150ml)',
            SPIRITS: 'Destilados (Tequila/Whisky)',
            COCKTAILS: 'Coctelería Azucarada'
        };

        const smokeStr = habs.smoking.is_smoker 
            ? `Sí (Tipo: ${typeMapping[habs.smoking.type] || 'No especificado'} - Cantidad: ${habs.smoking.quantity_text || 'No especificada'})` 
            : "No";
            
        let alcoholStr = "No";
        if (habs.alcohol.is_drinker) {
            if (habs.alcohol.drinks && habs.alcohol.drinks.length > 0) {
                const drinksDetails = habs.alcohol.drinks.map(d => {
                    const name = drinkMapping[d.preferred_drink] || d.preferred_drink;
                    return `${name} (${d.frequency_days} d/sem, ${d.units_per_session} u/sesión)`;
                }).join("; ");
                alcoholStr = `Sí (Detalles: ${drinksDetails}, Total: ~${habs.alcohol.calculated_weekly_calories} kcal/sem)`;
            } else {
                alcoholStr = `Sí (Bebida: ${drinkMapping[habs.alcohol.preferred_drink] || habs.alcohol.preferred_drink}, Frecuencia: ${habs.alcohol.frequency_days} d/sem, Cantidad: ${habs.alcohol.units_per_session} u/sesión, ~${habs.alcohol.calculated_weekly_calories} kcal/sem)`;
            }
        }
        
        const drugsStr = habs.drugs.has_usage 
            ? `Sí (Sustancia: ${habs.drugs.substance_name} - Frecuencia: ${habs.drugs.frequency})` 
            : "No";

        const summary = isMinor
            ? `He consolidado el perfil de los hábitos de consumo de **${pName}** en nuestro expediente digital. Para dar estricto cumplimiento legal a la **NOM-004** y sellar formalmente este bloque, se ha estructurado la síntesis de su evaluación:\n\n` +
              `- 🚬 **Tabaco / Vape:** ${smokeStr}\n` +
              `- 🍺 **Alcohol:** ${alcoholStr}\n` +
              `- 💊 **Recreativas / Tóxicos:** ${drugsStr}\n\n` +
              `Por favor, verifique este reporte clínico. ¿Es correcta y verídica toda esta información?`
            : `He consolidado el perfil de sus hábitos de consumo en nuestro expediente digital. Para dar estricto cumplimiento legal a la **NOM-004** y sellar formalmente este bloque, se ha estructurado la síntesis de su evaluación:\n\n` +
              `- 🚬 **Tabaco / Vape:** ${smokeStr}\n` +
              `- 🍺 **Alcohol:** ${alcoholStr}\n` +
              `- 💊 **Recreativas / Tóxicos:** ${drugsStr}\n\n` +
              `Por favor, verifique este reporte clínico. ¿Es correcta y verídica toda esta información?`;

        addMessage('assistant', summary, {
            avatar: tiloImg,
            options: [
                { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                { label: "❌ No, quiero corregir algo", value: "CORRECT_DATA" }
            ]
        });
        setCurrentStep('REVIEW_SUMMARY');
    };

    const handleOptionSelect = (value) => {
        const options = getCurrentOptions();
        const option = options ? options.find(opt => opt.value === value) : null;
        const displayLabel = option ? option.label : value;
        handleInput(value, displayLabel);
    };

    const getCurrentOptions = () => {
        if (messages.length === 0) return null;
        return messages[messages.length - 1].options;
    };

    const hasInputTypeNumber = () => {
        if (messages.length === 0) return false;
        return messages[messages.length - 1].inputType === 'number';
    };

    const handleInputRef = useRef(handleInput);
    useEffect(() => {
        handleInputRef.current = handleInput;
    });

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, val) => handleInputRef.current(text, val));
        }
        return () => {
            if (registerInputHandler) {
                registerInputHandler(null);
            }
        };
    }, [registerInputHandler]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(false);
        }
    }, [setIsGlobalTyping]);

    return null;
}
