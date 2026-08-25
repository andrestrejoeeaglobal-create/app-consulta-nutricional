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
    const { patientName: pName, isMinor, isLactante } = usePatientLinguistics(patientData);
    const [internalStep, setInternalStep] = useState(() => {
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && msg.content.includes("perfil logístico y operativo"));
        const lp = patientData?.logistics_profile;
        const hasLogistics = lp && (lp.cook_type || lp.budget || lp.eating_location);
        if (hasSummary || hasLogistics) {
            return 'correct_menu';
        }
        return 'COOK_GATE';
    });
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
        const idx = msgList.findIndex(m => m.role === 'assistant' && (m.content.includes("¿Quién prepara") || m.content.includes("preparación de comidas")));
        return idx !== -1 ? idx : msgList.length;
    };

    // Inicialización - Saludo inicial con la Regla V
    useEffect(() => {
        if (hasGreeted.current) return;

        if (internalStep === 'correct_menu') {
            hasGreeted.current = true;
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "De acuerdo. ¿Qué cambio o acción desea realizar en su perfil logístico y operativo de alimentación?",
                avatar: tiloImg,
                options: [
                    { label: "✏️ Modificar preparación de comidas", value: "MODIFY_COOK" },
                    { label: "✏️ Modificar presupuesto / compras", value: "MODIFY_BUYING" },
                    { label: "🔄 Limpiar perfil logístico", value: "CLEAR_ALL" },
                    { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                ]
            }]);
            return;
        }

        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && (msg.content.includes("¿Quién prepara") || msg.content.includes("logística de alimentación")));
        if (!alreadyGreeted) {
            hasGreeted.current = true;
            const initialMsg = isLactante
                ? `He registrado y sellado el perfil de descanso y desarrollo de **${pName}** (su bebé).\n\nPara adaptar su plan alimentario y de lactancia a la rutina del hogar, iniciemos con la logística de preparación. ¿Quién prepara o administra habitualmente los alimentos o biberones de su bebé?`
                : `He registrado y sellado su perfil de actividad física y descanso de manera exitosa.\n\nPara adaptar su plan a su estilo de vida, iniciemos con su logística de alimentación. ¿Quién prepara regularmente sus comidas principales?`;
            
            const initialOptions = isLactante
                ? [
                    { label: "🤱 Mamá / Papá", value: "FAMILY" },
                    { label: "👵 Familiar / Cuidador", value: "STAFF" },
                    { label: "🏫 Guardería / Estancia", value: "BUYING" }
                ]
                : [
                    { label: "🧑‍🍳 Cocino yo", value: "SELF" },
                    { label: "👪 Un familiar", value: "FAMILY" },
                    { label: "💼 Personal de cocina", value: "STAFF" },
                    { label: "🥡 Compro hecho", value: "BUYING" }
                ];

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: initialMsg,
                avatar: tiloImg,
                options: initialOptions
            }]);
        }
    }, [messages, setMessages, internalStep, isLactante, pName]);


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
        let userText = input;
        if (input === "MODIFY_COOK") userText = "✏️ Modificar preparación de comidas";
        if (input === "MODIFY_BUYING") userText = "✏️ Modificar presupuesto / compras";
        if (input === "CLEAR_ALL") userText = "🔄 Limpiar perfil logístico";
        if (input === "FINISH") userText = "❌ Cancelar (Volver al resumen)";

        // Evitar duplicación de mensajes del usuario
        if (label !== 'button') {
            setMessages(prev => [...prev, { role: 'user', content: userText }]);
        }

        const userMsg = input;
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const addBotMsg = (msg, options = null) => {
            setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg, options }]);
        };

        switch (internalStep) {
            case 'correct_menu': {
                if (input === "MODIFY_COOK") {
                    addBotMsg(
                        `¿Quién prepara regularmente sus comidas principales?`,
                        [
                            { label: "🧑‍🍳 Cocino yo", value: "SELF" },
                            { label: "👪 Un familiar", value: "FAMILY" },
                            { label: "💼 Personal de cocina", value: "STAFF" },
                            { label: "🥡 Compro hecho", value: "BUYING" }
                        ]
                    );
                    setInternalStep('COOK_GATE');
                } else if (input === "MODIFY_BUYING") {
                    addBotMsg(
                        `¿Quién realiza las compras del supermercado habitualmente?`,
                        [
                            { label: "🧑‍🍳 Yo personalmente", value: "SELF" },
                            { label: "👪 Un familiar o pareja", value: "FAMILY" },
                            { label: "🛒 Aplicaciones de delivery", value: "APP" }
                        ]
                    );
                    setInternalStep('BUYING_GATE');
                } else if (input === "CLEAR_ALL") {
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
                    addBotMsg(
                        `Perfil logístico reiniciado.\n\n¿Quién prepara regularmente sus comidas principales?`,
                        [
                            { label: "🧑‍🍳 Cocino yo", value: "SELF" },
                            { label: "👪 Un familiar", value: "FAMILY" },
                            { label: "💼 Personal de cocina", value: "STAFF" },
                            { label: "🥡 Compro hecho", value: "BUYING" }
                        ]
                    );
                    setInternalStep('COOK_GATE');
                } else if (input === "FINISH") {
                    onPhaseComplete(logistics, messages);
                }
                break;
            }

            case 'COOK_GATE': {
                if (userMsg === 'SELF' || userMsg === 'FAMILY') {
                    setLogistics(prev => ({ ...prev, cook_type: userMsg }));
                    const timeMsg = isLactante
                        ? `Anotado. Diseñaremos pautas de alimentación acordes a la rutina del bebé.\n\n¿De cuánto tiempo se dispone habitualmente para la preparación de papillas y biberones entre semana?`
                        : `Anotado. Diseñaremos recetas acordes a su disponibilidad.\n\n¿De cuánto tiempo dispone habitualmente para cocinar entre semana?`;
                    
                    const timeOptions = isLactante
                        ? [
                            { label: "⏱️ Poco tiempo (Preparación rápida)", value: "LOW" },
                            { label: "🍳 Tiempo amplio", value: "HIGH" }
                        ]
                        : [
                            { label: "⏱️ Poco tiempo", value: "LOW" },
                            { label: "🍳 Mucho tiempo", value: "HIGH" },
                            { label: "📅 Solo fines de semana", value: "WEEKEND_ONLY" }
                        ];

                    addBotMsg(timeMsg, timeOptions);
                    setInternalStep('TIME_GATE');
                } else if (userMsg === 'STAFF') {
                    setLogistics(prev => ({ ...prev, cook_type: userMsg, cooking_time: '' }));
                    const venueMsg = isLactante
                        ? `Entendido. Ajustando los parámetros del entorno nutricional de **${pName}**.\n\n¿En qué entorno principal pasa su bebé sus días de mayor actividad (lunes a viernes)?`
                        : `Entendido. Ajustando los parámetros del entorno nutricional.\n\n¿Dónde acostumbra desayunar y comer en sus días de mayor actividad (lunes a viernes)?`;

                    const venueOptions = isLactante
                        ? [
                            { label: "🏠 En casa con la familia", value: "HOME" },
                            { label: "🏫 En guardería / estancia infantil", value: "WORK" }
                        ]
                        : [
                            { label: "🏠 En casa", value: "HOME" },
                            { label: "🏢 En el trabajo / oficina", value: "WORK" },
                            { label: "🚶 En la calle / al paso", value: "STREET" }
                        ];

                    addBotMsg(venueMsg, venueOptions);
                    setInternalStep('VENUE_GATE');
                } else if (userMsg === 'BUYING') {
                    setLogistics(prev => ({ ...prev, cook_type: userMsg, cooking_time: '' }));
                    const buyMsg = isLactante
                        ? `Entendido. Ajustaremos la guía de fórmulas y papillas comerciales.\n\n¿Dónde acostumbra adquirir los insumos principales de su bebé?`
                        : `Entendido. Adaptaremos la guía de equivalentes a los establecimientos que frecuenta.\n\n¿Dónde acostumbra comprar su comida principalmente?`;
                    
                    const buyOptions = isLactante
                        ? [
                            { label: "🏪 Farmacias / Tiendas infantiles", value: "FONDAS" },
                            { label: "🛒 Supermercado", value: "RESTAURANTS" }
                        ]
                        : [
                            { label: "🍽️ Restaurantes", value: "RESTAURANTS" },
                            { label: "🏪 Fondas locales", value: "FONDAS" },
                            { label: "🍕 Comida rápida / al paso", value: "FAST_FOOD" }
                        ];

                    addBotMsg(buyMsg, buyOptions);
                    setInternalStep('BUY_GATE');
                } else {
                    const defaultMsg = isLactante
                        ? `Por favor, seleccione quién administra los alimentos de **${pName}**:`
                        : "Por favor, seleccione quién prepara sus comidas utilizando las opciones:";
                    
                    const defaultOpts = isLactante
                        ? [
                            { label: "🤱 Mamá / Papá", value: "FAMILY" },
                            { label: "👵 Familiar / Cuidador", value: "STAFF" },
                            { label: "🏫 Guardería / Estancia", value: "BUYING" }
                        ]
                        : [
                            { label: "🧑‍🍳 Cocino yo", value: "SELF" },
                            { label: "👪 Un familiar", value: "FAMILY" },
                            { label: "💼 Personal de cocina", value: "STAFF" },
                            { label: "🥡 Compro hecho", value: "BUYING" }
                        ];
                    addBotMsg(defaultMsg, defaultOpts);
                }
                break;
            }

            case 'TIME_GATE': {
                if (userMsg === 'LOW' || userMsg === 'HIGH' || userMsg === 'WEEKEND_ONLY') {
                    const minutes = userMsg === 'LOW' ? 20 : userMsg === 'HIGH' ? 60 : 120;
                    setLogistics(prev => ({ ...prev, cooking_time: userMsg, cooking_time_minutes: minutes }));
                    
                    const venueMsg = isLactante
                        ? `Registrado. Configurando los parámetros del entorno nutricional de **${pName}**.\n\n¿En qué entorno principal pasa su bebé sus días de mayor actividad (lunes a viernes)?`
                        : `Registrado. Configurando los parámetros del entorno nutricional.\n\n¿Dónde acostumbra desayunar y comer en sus días de mayor actividad (lunes a viernes)?`;

                    const venueOptions = isLactante
                        ? [
                            { label: "🏠 En casa con la familia", value: "HOME" },
                            { label: "🏫 En guardería / estancia infantil", value: "WORK" }
                        ]
                        : [
                            { label: "🏠 En casa", value: "HOME" },
                            { label: "🏢 En el trabajo / oficina", value: "WORK" },
                            { label: "🚶 En la calle / al paso", value: "STREET" }
                        ];

                    addBotMsg(venueMsg, venueOptions);
                    setInternalStep('VENUE_GATE');
                } else {
                    addBotMsg("Por favor, seleccione el tiempo disponible utilizando las opciones:", [
                        { label: "⏱️ Poco tiempo", value: "LOW" },
                        { label: "🍳 Mucho tiempo", value: "HIGH" }
                    ]);
                }
                break;
            }

            case 'BUY_GATE': {
                if (userMsg === 'RESTAURANTS' || userMsg === 'FONDAS' || userMsg === 'FAST_FOOD') {
                    setLogistics(prev => ({ ...prev, buying_type: userMsg }));
                    const venueMsg = isLactante
                        ? `Registrado. Configurando el entorno nutricional de **${pName}**.\n\n¿En qué entorno principal pasa su bebé sus días de mayor actividad (lunes a viernes)?`
                        : `Registrado. Configurando los parámetros del entorno nutricional.\n\n¿Dónde acostumbra desayunar y comer en sus días de mayor actividad (lunes a viernes)?`;

                    const venueOptions = isLactante
                        ? [
                            { label: "🏠 En casa con la familia", value: "HOME" },
                            { label: "🏫 En guardería / estancia infantil", value: "WORK" }
                        ]
                        : [
                            { label: "🏠 En casa", value: "HOME" },
                            { label: "🏢 En el trabajo / oficina", value: "WORK" },
                            { label: "🚶 En la calle / al paso", value: "STREET" }
                        ];

                    addBotMsg(venueMsg, venueOptions);
                    setInternalStep('VENUE_GATE');
                } else {
                    addBotMsg("Por favor, seleccione dónde adquiere los insumos principalmente:", [
                        { label: "🏪 Farmacias / Tiendas infantiles", value: "FONDAS" },
                        { label: "🛒 Supermercado", value: "RESTAURANTS" }
                    ]);
                }
                break;
            }

            case 'VENUE_GATE': {
                if (userMsg === 'HOME' || userMsg === 'WORK' || userMsg === 'STREET') {
                    const nextLogistics = { ...logistics, environment: { venue: userMsg } };
                    setLogistics(nextLogistics);

                    if (userMsg === 'WORK') {
                        const amenMsg = isLactante
                            ? `Entendido. Ajustando la logística para estancia/guardería.\n\n¿Con qué equipo cuenta la estancia para entibiar y almacenar biberones o papillas de **${pName}**?`
                            : `Entendido. Ajustando la logística de empaques y alimentos.\n\n¿Con qué equipo cuenta en su lugar de trabajo para almacenar y calentar sus alimentos?`;

                        const amenOptions = isLactante
                            ? [
                                { label: "🔥 Calentador y Refrigerador", value: "BOTH" },
                                { label: "❄️ Solo refrigerador", value: "FRIDGE" },
                                { label: "🚫 Sin equipamiento", value: "NONE" }
                            ]
                            : [
                                { label: "🔥 Horno y Refrigerador", value: "BOTH" },
                                { label: "❄️ Solo refrigerador", value: "FRIDGE" },
                                { label: "🚫 Sin equipamiento", value: "NONE" }
                            ];

                        addBotMsg(amenMsg, amenOptions);
                        setInternalStep('AMENITIES_GATE');
                    } else {
                        const finalLogistics = {
                            ...nextLogistics,
                            recipe_filters: { requires_reheating: true, requires_refrigeration: true }
                        };
                        setLogistics(finalLogistics);

                        const socialMsg = isLactante
                            ? `El entorno social es clave para el desarrollo del bebé. ¿Con quién suele compartir **${pName}** las tomas o papillas habitualmente?`
                            : `El entorno social es clave para su bienestar. ¿Con quién suele compartir sus comidas principales habitualmente?`;

                        const socialOptions = isLactante
                            ? [
                                { label: "👨‍👩‍👧 Con la familia", value: "FAMILY" },
                                { label: "🤝 Con su cuidador/a", value: "CAREGIVER" }
                            ]
                            : [
                                { label: "👤 Principalmente solo", value: "ALONE" },
                                { label: "👨‍👩‍👧 Con mi familia / Pareja", value: "FAMILY" },
                                { label: "🤝 Con mi cuidador / Personal", value: "CAREGIVER" },
                                { label: "👥 Compañeros / Amigos", value: "FRIENDS" }
                            ];

                        addBotMsg(socialMsg, socialOptions);
                        setInternalStep('SOCIAL_GATE');
                    }
                } else {
                    const defaultVenueOpts = isLactante
                        ? [
                            { label: "🏠 En casa con la familia", value: "HOME" },
                            { label: "🏫 En guardería / estancia infantil", value: "WORK" }
                        ]
                        : [
                            { label: "🏠 En casa", value: "HOME" },
                            { label: "🏢 En el trabajo / oficina", value: "WORK" },
                            { label: "🚶 En la calle / al paso", value: "STREET" }
                        ];
                    addBotMsg("Por favor, seleccione el entorno de consumo habitual:", defaultVenueOpts);
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

                    const socialMsg = isLactante
                        ? `El entorno social es clave para el desarrollo del bebé. ¿Con quién suele compartir **${pName}** las tomas o papillas habitualmente?`
                        : `El entorno social es clave para su bienestar. ¿Con quién suele compartir sus comidas principales habitualmente?`;

                    const socialOptions = isLactante
                        ? [
                            { label: "👨‍👩‍👧 Con la familia", value: "FAMILY" },
                            { label: "🤝 Con su cuidador/a", value: "CAREGIVER" }
                        ]
                        : [
                            { label: "👤 Principalmente solo", value: "ALONE" },
                            { label: "👨‍👩‍👧 Con mi familia / Pareja", value: "FAMILY" },
                            { label: "🤝 Con mi cuidador / Personal", value: "CAREGIVER" },
                            { label: "👥 Compañeros / Amigos", value: "FRIENDS" }
                        ];

                    addBotMsg(socialMsg, socialOptions);
                    setInternalStep('SOCIAL_GATE');
                } else {
                    addBotMsg("Por favor, seleccione el equipamiento disponible:", [
                        { label: "🔥 Calentador y Refrigerador", value: "BOTH" },
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

                    const dynamicsMsg = isLactante
                        ? `Para estructurar el plan de lactancia y ablactación: En estas comidas compartidas, ¿consume **${pName}** preparaciones exclusivas de lactante o papillas adaptadas del menú familiar?`
                        : `Para estructurar correctamente su lista de compras y preparaciones: En estas comidas compartidas, ¿usted consume sus propios alimentos (separado) o todos en la mesa comparten el mismo menú familiar?`;

                    const dynamicsOptions = isLactante
                        ? [
                            { label: "🍼 Preparaciones exclusivas para el bebé", value: "SEPARATE_FOOD" },
                            { label: "🍲 Papillas adaptadas del menú familiar", value: "SHARED_MENU" }
                        ]
                        : [
                            { label: "🍲 Compartimos el mismo menú", value: "SHARED_MENU" },
                            { label: "🍱 Cada quien su comida", value: "SEPARATE_FOOD" }
                        ];

                    addBotMsg(dynamicsMsg, dynamicsOptions);
                    setInternalStep('SOCIAL_DYNAMICS_GATE');
                } else {
                    const defaultSocialOpts = isLactante
                        ? [
                            { label: "👨‍👩‍👧 Con la familia", value: "FAMILY" },
                            { label: "🤝 Con su cuidador/a", value: "CAREGIVER" }
                        ]
                        : [
                            { label: "👤 Principalmente solo", value: "ALONE" },
                            { label: "👨‍👩‍👧 Con mi familia / Pareja", value: "FAMILY" },
                            { label: "🤝 Con mi cuidador / Personal", value: "CAREGIVER" },
                            { label: "👥 Compañeros / Amigos", value: "FRIENDS" }
                        ];
                    addBotMsg("Por favor, seleccione con quién comparte las comidas:", defaultSocialOpts);
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

    // Registro del callback en el enrutador
    const processStepRef = useRef(processStep);
    useEffect(() => {
        processStepRef.current = processStep;
    });

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, label) => processStepRef.current(text, label));
        }
        return () => {
            if (registerInputHandler) {
                registerInputHandler(null);
            }
        };
    }, [registerInputHandler]);

    const showSummary = (data) => {
        const prepMap = isLactante ? {
            SELF: "Padres / Familiares directos",
            FAMILY: "Mamá / Papá en el hogar",
            STAFF: "Familiar o Cuidador asignado",
            BUYING: "Guardería / Estancia infantil"
        } : {
            SELF: "Cocina Propia (Yo mismo)",
            FAMILY: "Familiar Cocina",
            STAFF: "Personal de Cocina",
            BUYING: "Comprada (Restablecimientos / Fuera)"
        };

        const timeMap = isLactante ? {
            LOW: "Preparación rápida / Biberones e insumos listos",
            HIGH: "Tiempo amplio para papillas caseras",
            WEEKEND_ONLY: "Preparación de fórmula / papillas en fines de semana"
        } : {
            LOW: "Tiempo Limitado (Express)",
            HIGH: "Tiempo Disponible (Estándar)",
            WEEKEND_ONLY: "Solo Fines de Semana"
        };

        const venueMap = isLactante ? {
            HOME: "En Casa con la familia",
            WORK: "En Guardería / Estancia Infantil",
            STREET: "En Casa / Guardería"
        } : {
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
            if (reheating && refrigeration) amenitiesLabel = isLactante ? "Calentador y Refrigerador pediátrico" : "Refrigerador y Horno de microondas";
            else if (!reheating && refrigeration) amenitiesLabel = "Solo Refrigerador";
            else amenitiesLabel = "Sin equipamiento";
        }

        const socialMap = isLactante ? {
            ALONE: "Con cuidador asignado",
            FAMILY: "Con la familia en el hogar",
            CAREGIVER: "Con su cuidador/a",
            FRIENDS: "Con compañeros en guardería"
        } : {
            ALONE: "Principalmente solo",
            FAMILY: "Con mi familia / Pareja",
            CAREGIVER: "Con mi cuidador / Personal",
            FRIENDS: "Compañeros / Amigos"
        };
        const socialLabel = socialMap[data.social_company] || "No especificado";

        let socialSummaryLines = `- 👥 **Compañía en mesa:** ${socialLabel}\n\n`;
        if (data.social_company && data.social_company !== 'ALONE') {
            if (data.sharing_dynamics === 'SEPARATE_FOOD') {
                socialSummaryLines = isLactante
                    ? `- 👥 **Compañía en mesa:** ${socialLabel} (Preparaciones exclusivas de lactante)\n\n`
                    : `- 👥 **Compañía en mesa:** ${socialLabel} (Cada quien su comida)\n\n`;
            } else if (data.sharing_dynamics === 'SHARED_MENU') {
                const dinersText = data.sharing_diners_count ? `${data.sharing_diners_count} personas` : "No especificado";
                socialSummaryLines = isLactante
                    ? `- 👥 **Compañía en mesa:** ${socialLabel} (Papillas adaptadas del menú familiar)\n\n`
                    : `- 👥 **Compañía en mesa:** ${socialLabel} (Comparten mismo menú)\n` +
                        `- 🍽️ **Porciones a calcular:** ${dinersText}\n\n`;
            }
        }
 
        const summaryText = isLactante
            ? `Hemos consolidado el reporte de logística alimentaria de **${pName}** (su bebé) en nuestro expediente digital.\n\nPara dar cumplimiento a la **NOM-004** y sellar formalmente este bloque pediátrico, por favor verifique los datos registrados:\n\n` +
                `- 🤱 **Administración de alimentos:** ${prepLabel}\n` +
                `- ⏰ **Tiempo de preparación:** ${timeLabel}\n` +
                `- 📍 **Entorno principal:** ${venueLabel}\n` +
                (data.environment?.venue === 'WORK' ? `- 🍼 **Equipamiento en estancia:** ${amenitiesLabel}\n` : '') +
                socialSummaryLines +
                `¿Es correcta y verídica toda esta información?`
            : `Hemos consolidado el reporte de su logística diaria en nuestro expediente digital.\n\nPara dar cumplimiento a la **NOM-004** y sellar formalmente este bloque, por favor verifique los datos registrados:\n\n` +
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
