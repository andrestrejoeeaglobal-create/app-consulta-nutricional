import React, { useState, useEffect, useRef } from 'react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import tiloImg from '../../assets/tilo.png';

export default function Fase12_Logistica({
    patientData,
    setPatientData,
    onPhaseComplete,
    registerInputHandler,
    messages,
    setMessages,
    setIsGlobalTyping
}) {
    const { patientName: pName, isMinor } = usePatientLinguistics(patientData);
    const [internalStep, setInternalStep] = useState('COOK_GATE');
    const hasGreeted = useRef(false);

    const [logistics, setLogistics] = useState(() => {
        return patientData?.logistics_profile || {
            cook_type: '',
            cooking_time: '',
            buying_type: '',
            environment: { venue: '' },
            recipe_filters: { requires_reheating: true, requires_refrigeration: true },
            cooking_time_minutes: 20,
            social_company: '',
            sharing_dynamics: '',
            sharing_diners_count: null,
            sharing_demographics: ''
        };
    });

    const getStartIndex = (msgList) => {
        const idx = msgList.findIndex(m => m.role === 'assistant' && m.content.includes("¿Quién prepara regularmente sus comidas principales?"));
        return idx !== -1 ? idx : msgList.length;
    };

    // Inicialización - Saludo inicial con la Regla V
    useEffect(() => {
        if (hasGreeted.current) return;

        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("¿Quién prepara regularmente sus comidas principales?"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;
            const initialMsg = `He registrado y sellado su perfil de actividad física y descanso de manera exitosa.\n\nPara adaptar su plan a su estilo de vida, iniciemos con su logística de alimentación. ¿Quién prepara regularmente sus comidas principales?`;
            
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: initialMsg,
                avatar: tiloImg,
                options: [
                    { label: "🧑‍🍳 Cocino yo", value: "SELF" },
                    { label: "👪 Un familiar", value: "FAMILY" },
                    { label: "💼 Personal de cocina", value: "STAFF" },
                    { label: "🥡 Compro hecho", value: "BUYING" }
                ]
            }]);
        }
    }, [messages, setMessages]);

    // Registro del callback en el enrutador
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => processStep);
        }
        return () => {
            if (registerInputHandler) registerInputHandler(null);
        };
    }, [internalStep, logistics, registerInputHandler]);

    // Sincronización en tiempo real con el expediente global
    useEffect(() => {
        if (setPatientData) {
            setPatientData(prev => {
                if (JSON.stringify(prev.logistics_profile) === JSON.stringify(logistics)) {
                    return prev;
                }
                return {
                    ...prev,
                    logistics_profile: logistics
                };
            });
        }
    }, [logistics, setPatientData]);

    const processStep = async (input, label = null) => {
        // Evitar duplicación de mensajes del usuario
        if (label !== 'button') {
            setMessages(prev => [...prev, { role: 'user', content: input }]);
        }

        const userMsg = input;
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const addBotMsg = (msg, options = null) => {
            setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg, options }]);
        };

        switch (internalStep) {
            case 'COOK_GATE': {
                if (userMsg === 'SELF' || userMsg === 'FAMILY') {
                    setLogistics(prev => ({ ...prev, cook_type: userMsg }));
                    addBotMsg(
                        `Anotado. Diseñaremos recetas acordes a su disponibilidad.\n\n¿De cuánto tiempo dispone habitualmente para cocinar entre semana?`,
                        [
                            { label: "⏱️ Poco tiempo", value: "LOW" },
                            { label: "🍳 Mucho tiempo", value: "HIGH" },
                            { label: "📅 Solo fines de semana", value: "WEEKEND_ONLY" }
                        ]
                    );
                    setInternalStep('TIME_GATE');
                } else if (userMsg === 'STAFF') {
                    setLogistics(prev => ({ ...prev, cook_type: userMsg, cooking_time: '' }));
                    addBotMsg(
                        `Entendido. Ajustando los parámetros del entorno nutricional.\n\n¿Dónde acostumbra desayunar y comer en sus días de mayor actividad (lunes a viernes)?`,
                        [
                            { label: "🏠 En casa", value: "HOME" },
                            { label: "🏢 En el trabajo / oficina", value: "WORK" },
                            { label: "🚶 En la calle / al paso", value: "STREET" }
                        ]
                    );
                    setInternalStep('VENUE_GATE');
                } else if (userMsg === 'BUYING') {
                    setLogistics(prev => ({ ...prev, cook_type: userMsg, cooking_time: '' }));
                    addBotMsg(
                        `Entendido. Adaptaremos la guía de equivalentes a los establecimientos que frecuenta.\n\n¿Dónde acostumbra comprar su comida principalmente?`,
                        [
                            { label: "🍽️ Restaurantes", value: "RESTAURANTS" },
                            { label: "🏪 Fondas locales", value: "FONDAS" },
                            { label: "🍕 Comida rápida / al paso", value: "FAST_FOOD" }
                        ]
                    );
                    setInternalStep('BUY_GATE');
                } else {
                    addBotMsg("Por favor, seleccione quién prepara sus comidas utilizando las opciones:", [
                        { label: "🧑‍🍳 Cocino yo", value: "SELF" },
                        { label: "👪 Un familiar", value: "FAMILY" },
                        { label: "💼 Personal de cocina", value: "STAFF" },
                        { label: "🥡 Compro hecho", value: "BUYING" }
                    ]);
                }
                break;
            }

            case 'TIME_GATE': {
                if (userMsg === 'LOW' || userMsg === 'HIGH' || userMsg === 'WEEKEND_ONLY') {
                    const minutes = userMsg === 'LOW' ? 20 : userMsg === 'HIGH' ? 60 : 120;
                    setLogistics(prev => ({ ...prev, cooking_time: userMsg, cooking_time_minutes: minutes }));
                    addBotMsg(
                        `Registrado. Configurando los parámetros del entorno nutricional.\n\n¿Dónde acostumbra desayunar y comer en sus días de mayor actividad (lunes a viernes)?`,
                        [
                            { label: "🏠 En casa", value: "HOME" },
                            { label: "🏢 En el trabajo / oficina", value: "WORK" },
                            { label: "🚶 En la calle / al paso", value: "STREET" }
                        ]
                    );
                    setInternalStep('VENUE_GATE');
                } else {
                    addBotMsg("Por favor, seleccione el tiempo disponible utilizando las opciones:", [
                        { label: "⏱️ Poco tiempo", value: "LOW" },
                        { label: "🍳 Mucho tiempo", value: "HIGH" },
                        { label: "📅 Solo fines de semana", value: "WEEKEND_ONLY" }
                    ]);
                }
                break;
            }

            case 'BUY_GATE': {
                if (userMsg === 'RESTAURANTS' || userMsg === 'FONDAS' || userMsg === 'FAST_FOOD') {
                    setLogistics(prev => ({ ...prev, buying_type: userMsg }));
                    addBotMsg(
                        `Registrado. Configurando los parámetros del entorno nutricional.\n\n¿Dónde acostumbra desayunar y comer en sus días de mayor actividad (lunes a viernes)?`,
                        [
                            { label: "🏠 En casa", value: "HOME" },
                            { label: "🏢 En el trabajo / oficina", value: "WORK" },
                            { label: "🚶 En la calle / al paso", value: "STREET" }
                        ]
                    );
                    setInternalStep('VENUE_GATE');
                } else {
                    addBotMsg("Por favor, seleccione dónde compra su comida principalmente:", [
                        { label: "🍽️ Restaurantes", value: "RESTAURANTS" },
                        { label: "🏪 Fondas locales", value: "FONDAS" },
                        { label: "🍕 Comida rápida / al paso", value: "FAST_FOOD" }
                    ]);
                }
                break;
            }

            case 'VENUE_GATE': {
                if (userMsg === 'HOME' || userMsg === 'WORK' || userMsg === 'STREET') {
                    const nextLogistics = { ...logistics, environment: { venue: userMsg } };
                    setLogistics(nextLogistics);

                    if (userMsg === 'WORK') {
                        addBotMsg(
                            `Entendido. Ajustando la logística de empaques y alimentos.\n\n¿Con qué equipo cuenta en su lugar de trabajo para almacenar y calentar sus alimentos?`,
                            [
                                { label: "🔥 Horno y Refrigerador", value: "BOTH" },
                                { label: "❄️ Solo refrigerador", value: "FRIDGE" },
                                { label: "🚫 Sin equipamiento", value: "NONE" }
                            ]
                        );
                        setInternalStep('AMENITIES_GATE');
                    } else {
                        // Omitir amenities, poner valores por defecto para casa/calle
                        const finalLogistics = {
                            ...nextLogistics,
                            recipe_filters: { requires_reheating: true, requires_refrigeration: true }
                        };
                        setLogistics(finalLogistics);
                        addBotMsg(
                            `El entorno social es clave para su bienestar. ¿Con quién suele compartir sus comidas principales habitualmente?`,
                            [
                                { label: "👤 Principalmente solo", value: "ALONE" },
                                { label: "👨‍👩‍👧 Con mi familia / Pareja", value: "FAMILY" },
                                { label: "🤝 Con mi cuidador / Personal", value: "CAREGIVER" },
                                { label: "👥 Compañeros / Amigos", value: "FRIENDS" }
                            ]
                        );
                        setInternalStep('SOCIAL_GATE');
                    }
                } else {
                    addBotMsg("Por favor, seleccione el lugar de consumo habitual:", [
                        { label: "🏠 En casa", value: "HOME" },
                        { label: "🏢 En el trabajo / oficina", value: "WORK" },
                        { label: "🚶 En la calle / al paso", value: "STREET" }
                    ]);
                }
                break;
            }

            case 'AMENITIES_GATE': {
                if (userMsg === 'BOTH' || userMsg === 'FRIDGE' || userMsg === 'NONE') {
                    const reheating = userMsg === 'BOTH';
                    const refrigeration = userMsg === 'BOTH' || userMsg === 'FRIDGE';
                    const nextLogistics = {
                        ...logistics,
                        recipe_filters: { requires_reheating: reheating, requires_refrigeration: refrigeration }
                    };
                    setLogistics(nextLogistics);
                    addBotMsg(
                        `El entorno social es clave para su bienestar. ¿Con quién suele compartir sus comidas principales habitualmente?`,
                        [
                            { label: "👤 Principalmente solo", value: "ALONE" },
                            { label: "👨‍👩‍👧 Con mi familia / Pareja", value: "FAMILY" },
                            { label: "🤝 Con mi cuidador / Personal", value: "CAREGIVER" },
                            { label: "👥 Compañeros / Amigos", value: "FRIENDS" }
                        ]
                    );
                    setInternalStep('SOCIAL_GATE');
                } else {
                    addBotMsg("Por favor, seleccione el equipamiento disponible:", [
                        { label: "🔥 Horno y Refrigerador", value: "BOTH" },
                        { label: "❄️ Solo refrigerador", value: "FRIDGE" },
                        { label: "🚫 Sin equipamiento", value: "NONE" }
                    ]);
                }
                break;
            }

            case 'SOCIAL_GATE': {
                if (userMsg === 'ALONE') {
                    const finalLogistics = {
                        ...logistics,
                        social_company: userMsg,
                        sharing_dynamics: '',
                        sharing_diners_count: null,
                        sharing_demographics: ''
                    };
                    setLogistics(finalLogistics);
                    showSummary(finalLogistics);
                    setInternalStep('REVIEW_SUMMARY');
                } else if (userMsg === 'FAMILY' || userMsg === 'CAREGIVER' || userMsg === 'FRIENDS') {
                    const nextLogistics = { ...logistics, social_company: userMsg };
                    setLogistics(nextLogistics);
                    addBotMsg(
                        `Para estructurar correctamente su lista de compras y preparaciones: En estas comidas compartidas, ¿usted consume sus propios alimentos (separado) o todos en la mesa comparten el mismo menú familiar?`,
                        [
                            { label: "🍲 Compartimos el mismo menú", value: "SHARED_MENU" },
                            { label: "🍱 Cada quien su comida", value: "SEPARATE_FOOD" }
                        ]
                    );
                    setInternalStep('SOCIAL_DYNAMICS_GATE');
                } else {
                    addBotMsg("Por favor, seleccione con quién comparte sus comidas habitualmente utilizando las opciones:", [
                        { label: "👤 Principalmente solo", value: "ALONE" },
                        { label: "👨‍👩‍👧 Con mi familia / Pareja", value: "FAMILY" },
                        { label: "🤝 Con mi cuidador / Personal", value: "CAREGIVER" },
                        { label: "👥 Compañeros / Amigos", value: "FRIENDS" }
                    ]);
                }
                break;
            }

            case 'SOCIAL_DYNAMICS_GATE': {
                if (userMsg === 'SHARED_MENU') {
                    const nextLogistics = { ...logistics, sharing_dynamics: userMsg };
                    setLogistics(nextLogistics);
                    addBotMsg(
                        `Entendido. ¿Para cuántas personas en total (incluyéndolo a usted) debemos calcular la lista del supermercado y las porciones?`,
                        [
                            { label: "👥 2 personas", value: "2" },
                            { label: "👪 3 personas", value: "3" },
                            { label: "👨‍👩‍👧‍👦 4 personas", value: "4" },
                            { label: "🏰 5 o más personas", value: "5" }
                        ]
                    );
                    setInternalStep('SOCIAL_COUNT_GATE');
                } else if (userMsg === 'SEPARATE_FOOD') {
                    const finalLogistics = {
                        ...logistics,
                        sharing_dynamics: userMsg,
                        sharing_diners_count: null,
                        sharing_demographics: ''
                    };
                    setLogistics(finalLogistics);
                    showSummary(finalLogistics);
                    setInternalStep('REVIEW_SUMMARY');
                } else {
                    addBotMsg("Por favor, seleccione su dinámica de alimentos utilizando las opciones:", [
                        { label: "🍲 Compartimos el mismo menú", value: "SHARED_MENU" },
                        { label: "🍱 Cada quien su comida", value: "SEPARATE_FOOD" }
                    ]);
                }
                break;
            }

            case 'SOCIAL_COUNT_GATE': {
                if (userMsg === '2' || userMsg === '3' || userMsg === '4' || userMsg === '5') {
                    const nextLogistics = { ...logistics, sharing_diners_count: parseInt(userMsg, 10) };
                    setLogistics(nextLogistics);
                    addBotMsg(
                        `Finalmente, para asegurar que el menú sea amigable para todos, ¿hay niños pequeños o adultos mayores en esta mesa compartida?`,
                        [
                            { label: "👶 Niños", value: "KIDS" },
                            { label: "🧓 Adultos mayores", value: "ELDERLY" },
                            { label: "👨‍👩‍👧‍👦 Ambos", value: "BOTH" },
                            { label: "🚫 Ninguno", value: "NONE" }
                        ]
                    );
                    setInternalStep('SOCIAL_DEMO_GATE');
                } else {
                    addBotMsg("Por favor, seleccione el número de comensales utilizando las opciones:", [
                        { label: "👥 2 personas", value: "2" },
                        { label: "👪 3 personas", value: "3" },
                        { label: "👨‍👩‍👧‍👦 4 personas", value: "4" },
                        { label: "🏰 5 o más personas", value: "5" }
                    ]);
                }
                break;
            }

            case 'SOCIAL_DEMO_GATE': {
                if (userMsg === 'KIDS' || userMsg === 'ELDERLY' || userMsg === 'BOTH' || userMsg === 'NONE') {
                    const finalLogistics = { ...logistics, sharing_demographics: userMsg };
                    setLogistics(finalLogistics);
                    showSummary(finalLogistics);
                    setInternalStep('REVIEW_SUMMARY');
                } else {
                    addBotMsg("Por favor, seleccione el grupo demográfico utilizando las opciones:", [
                        { label: "👶 Niños", value: "KIDS" },
                        { label: "🧓 Adultos mayores", value: "ELDERLY" },
                        { label: "👨‍👩‍👧‍👦 Ambos", value: "BOTH" },
                        { label: "🚫 Ninguno", value: "NONE" }
                    ]);
                }
                break;
            }

            case 'REVIEW_SUMMARY': {
                if (userMsg === 'CONFIRM_DATA') {
                    // Persistencia en el perfil del paciente
                    setPatientData(prev => ({
                        ...prev,
                        logistics_profile: logistics
                    }));

                    addBotMsg("✅ Logística Alimentaria registrada y sellada con éxito.");
                    setTimeout(() => {
                        onPhaseComplete('PHASE_13_PREFERENCES');
                    }, 1000);
                } else if (userMsg === 'CORRECT_DATA') {
                    // PROTOCOLO DE REVERSIÓN RÍGIDO (Anti-Bucle)
                    setLogistics({
                        cook_type: '',
                        cooking_time: '',
                        buying_type: '',
                        environment: { venue: '' },
                        recipe_filters: { requires_reheating: true, requires_refrigeration: true },
                        cooking_time_minutes: 20,
                        social_company: '',
                        sharing_dynamics: '',
                        sharing_diners_count: null,
                        sharing_demographics: ''
                    });

                    // Rebanar la transcripción y re-iniciar COOK_GATE
                    setMessages(prev => {
                        const cutIndex = getStartIndex(prev);
                        const cleanList = prev.slice(0, cutIndex);
                        const initialMsg = `He registrado y sellado su perfil de actividad física y descanso de manera exitosa.\n\nPara adaptar su plan a su estilo de vida, iniciemos con su logística de alimentación. ¿Quién prepara regularmente sus comidas principales?`;
                        return [
                            ...cleanList,
                            {
                                role: 'assistant',
                                content: initialMsg,
                                avatar: tiloImg,
                                options: [
                                    { label: "🧑‍🍳 Cocino yo", value: "SELF" },
                                    { label: "👪 Un familiar", value: "FAMILY" },
                                    { label: "💼 Personal de cocina", value: "STAFF" },
                                    { label: "🥡 Compro hecho", value: "BUYING" }
                                ]
                            }
                        ];
                    });

                    setInternalStep('COOK_GATE');
                } else {
                    showSummary(logistics);
                }
                break;
            }

            default:
                break;
        }

        setIsGlobalTyping(false);
    };

    const showSummary = (data) => {
        const prepMap = {
            SELF: "Cocina Propia (Yo mismo)",
            FAMILY: "Familiar Cocina",
            STAFF: "Personal de Cocina",
            BUYING: "Comprada (Restablecimientos / Fuera)"
        };

        const timeMap = {
            LOW: "Tiempo Limitado (Express)",
            HIGH: "Tiempo Disponible (Estándar)",
            WEEKEND_ONLY: "Solo Fines de Semana"
        };

        const venueMap = {
            HOME: "En Casa",
            WORK: "En el Trabajo / Oficina",
            STREET: "En la Calle / Al paso"
        };

        const prepLabel = prepMap[data.cook_type] || "No especificado";
        const timeLabel = timeMap[data.cooking_time] || "No aplica";
        const venueLabel = venueMap[data.environment?.venue] || "No especificado";
        
        let amenitiesLabel = "No aplica";
        if (data.environment?.venue === 'WORK') {
            const reheating = data.recipe_filters?.requires_reheating;
            const refrigeration = data.recipe_filters?.requires_refrigeration;
            if (reheating && refrigeration) amenitiesLabel = "Refrigerador y Horno de microondas";
            else if (!reheating && refrigeration) amenitiesLabel = "Solo Refrigerador";
            else amenitiesLabel = "Sin equipamiento (Comida fría / Shelf stable)";
        }

        const socialMap = {
            ALONE: "Principalmente solo",
            FAMILY: "Con mi familia / Pareja",
            CAREGIVER: "Con mi cuidador / Personal",
            FRIENDS: "Compañeros / Amigos"
        };
        const socialLabel = socialMap[data.social_company] || "No especificado";

        const demoMap = {
            KIDS: "Incluye niños pequeños",
            ELDERLY: "Incluye adultos mayores",
            BOTH: "Incluye niños y adultos mayores",
            NONE: "Solo adultos contemporáneos"
        };
        const demoLabel = demoMap[data.sharing_demographics] || "No especificado";
 
        let socialSummaryLines = `- 👥 **Compañía en mesa:** ${socialLabel}\n\n`;
        if (data.social_company && data.social_company !== 'ALONE') {
            if (data.sharing_dynamics === 'SEPARATE_FOOD') {
                socialSummaryLines = `- 👥 **Compañía en mesa:** ${socialLabel} (Cada quien su comida)\n\n`;
            } else if (data.sharing_dynamics === 'SHARED_MENU') {
                const dinersText = data.sharing_diners_count ? `${data.sharing_diners_count} personas` : "No especificado";
                socialSummaryLines = `- 👥 **Compañía en mesa:** ${socialLabel} (Comparten mismo menú)\n` +
                    `- 🍽️ **Porciones a calcular:** ${dinersText}\n` +
                    `- 👪 **Entorno demográfico:** ${demoLabel}\n\n`;
            }
        }
 
        const summaryText = `Hemos consolidado el reporte de su logística diaria en nuestro expediente digital.\n\nPara dar cumplimiento a la **NOM-004** y sellar formalmente este bloque, por favor verifique los datos registrados:\n\n` +
            `- 🧑‍🍳 **Preparación:** ${prepLabel}\n` +
            `- ⏰ **Tiempo disponible:** ${timeLabel}\n` +
            `- 📍 **Lugar de consumo:** ${venueLabel}\n` +
            `- 🍱 **Equipamiento en trabajo:** ${amenitiesLabel}\n` +
            socialSummaryLines +
            `¿Es correcta y verídica toda esta información?`;

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: summaryText,
            avatar: tiloImg,
            options: [
                { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                { label: "❌ No, quiero corregir", value: "CORRECT_DATA" }
            ]
        }]);
    };

    return null; // Headless component
}
