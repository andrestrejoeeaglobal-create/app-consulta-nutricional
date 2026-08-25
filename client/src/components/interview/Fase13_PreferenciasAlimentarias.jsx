import React, { useState, useEffect, useRef } from 'react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { formatText, strictBooleanValidator } from '../../utils/utils';

/**
 * T.I.L.O. - MÓDULO FASE 13 (PREFERENCIAS ALIMENTARIAS)
 * Versión: v5.1 - Orthopedically Aligned, Rule V & Callback Constructor Fix
 */
export default function Fase13_PreferenciasAlimentarias({
    patientData,
    setPatientData,
    onPhaseComplete,
    registerInputHandler,
    messages,
    setMessages,
    setIsGlobalTyping
}) {
    const { patientName: pName, isMinor } = usePatientLinguistics(patientData);
    const [internalStep, setInternalStep] = useState(() => {
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && msg.content.includes("preferencias y aversiones alimentarias"));
        const p = patientData?.nutrition?.preferences;
        const hasPrefs = p && (p.excluded_ingredients?.length > 0 || p.favorite_foods?.length > 0);
        if (hasSummary || hasPrefs) {
            return 'correct_menu';
        }
        return 'AVERSIONS_GATE';
    });
    
    const isTcaRoute = patientData?.clinical_context?.goal === 'GOAL_MENTAL_HEALTH' || 
                       patientData?.clinical_context?.ai_analysis?.primaryRoute === 'GOAL_MENTAL_HEALTH';
    const containsTrigger = (text) => /grasa|calor|dieta|carbo|peso|engorda|lípido/i.test(text || "");
    const hasGreeted = useRef(false);
    
    const [preferences, setPreferences] = useState({
        aversiones: patientData?.evaluacionDietetica?.preferencias?.aversiones || "",
        favoritos: patientData?.evaluacionDietetica?.preferencias?.favoritos || ""
    });

    // Inicialización - Mitigación absoluta de doble render en StrictMode
    useEffect(() => {
        if (hasGreeted.current) return;

        if (internalStep === 'correct_menu') {
            hasGreeted.current = true;
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de preferencias y aversiones alimentarias?",
                options: [
                    { label: "✏️ Modificar alimentos favoritos", value: "MODIFY_FAVORITES" },
                    { label: "✏️ Modificar aversiones / exclusiones", value: "MODIFY_AVERSIONS" },
                    { label: "🔄 Limpiar preferencias", value: "CLEAR_ALL" },
                    { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                ]
            }]);
            return;
        }

        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.toLowerCase().includes("preferencias alimentarias"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;
            const initialMsg = isMinor
                ? `He registrado y sellado el perfil de actividad física y descanso de **${pName}** de manera exitosa.\n\nIniciemos la evaluación de **Preferencias Alimentarias**.\n\n¿Cuáles son los alimentos que **NO** le gustan a **${pName}** (aversiones)? Si no tiene, por favor indique 'Ninguno'.`
                : "He registrado y sellado su perfil de actividad física y descanso de manera exitosa.\n\nIniciemos la evaluación de sus **Preferencias Alimentarias**.\n\n¿Cuáles son los alimentos que **NO** le gustan (aversiones)? Si no tiene, por favor indique 'Ninguno'.";
            
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: initialMsg
            }]);
        }
    }, [messages, isMinor, pName, setMessages, internalStep]);


    // Sincronización en tiempo real de preferencias con el expediente global y dashboard (TabNutrition)
    useEffect(() => {
        if (setPatientData) {
            const filterNoneValues = (item) => {
                const clean = item.toLowerCase().trim();
                return clean !== 'ninguno' && clean !== 'ninguna' && clean !== 'no' && clean !== 'no tiene' && clean !== 'niega' && clean !== 'n/a';
            };

            const excluded_ingredients = preferences.aversiones
                ? preferences.aversiones.split(',')
                    .map(item => item.trim())
                    .filter(item => item && filterNoneValues(item))
                : [];
            const favorite_foods = preferences.favoritos
                ? preferences.favoritos.split(',')
                    .map(item => item.trim())
                    .filter(item => item && filterNoneValues(item))
                : [];

            setPatientData(prev => {
                const currentEval = prev.evaluacionDietetica?.preferencias;
                const currentNut = prev.nutrition?.preferences;

                const hasEvalChanged = currentEval?.aversiones !== preferences.aversiones || 
                                       currentEval?.favoritos !== preferences.favoritos;
                
                const hasNutChanged = JSON.stringify(currentNut?.excluded_ingredients) !== JSON.stringify(excluded_ingredients) ||
                                      JSON.stringify(currentNut?.favorite_foods) !== JSON.stringify(favorite_foods);

                if (!hasEvalChanged && !hasNutChanged) {
                    return prev;
                }

                return {
                    ...prev,
                    evaluacionDietetica: {
                        ...(prev.evaluacionDietetica || {}),
                        preferencias: {
                            aversiones: preferences.aversiones || "Ninguna",
                            favoritos: preferences.favoritos || "Ninguno"
                        }
                    },
                    nutrition: {
                        ...(prev.nutrition || {}),
                        preferences: {
                            ...(prev.nutrition?.preferences || {}),
                            excluded_ingredients,
                            favorite_foods
                        }
                    }
                };
            });
        }
    }, [preferences, setPatientData]);

    const processStep = async (input, label = null) => {
        let userText = input;
        if (input === "MODIFY_FAVORITES") userText = "✏️ Modificar alimentos favoritos";
        if (input === "MODIFY_AVERSIONS") userText = "✏️ Modificar aversiones / exclusiones";
        if (input === "CLEAR_ALL") userText = "🔄 Limpiar preferencias";
        if (input === "FINISH") userText = "❌ Cancelar (Volver al resumen)";

        if (label !== 'button') {
            setMessages(prev => [...prev, { role: 'user', content: userText }]);
        }
        
        const userMsg = input;
        const lower = userMsg.toLowerCase();
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const addBotMsg = (msg, options = null) => {
            setMessages(prev => [...prev, { role: 'assistant', content: msg, options }]);
        };

        if (internalStep === 'correct_menu') {
            if (input === "MODIFY_FAVORITES") {
                const favoritesMsg = isMinor 
                    ? `¿Cuáles son los alimentos favoritos o preferidos de **${pName}**?` 
                    : "¿Cuáles son sus alimentos favoritos o preferidos?";
                addBotMsg(favoritesMsg);
                setInternalStep('FAVORITES_GATE');
            } else if (input === "MODIFY_AVERSIONS") {
                const aversionsMsg = isMinor
                    ? `¿Cuáles son los alimentos que **NO** le gustan a **${pName}** (aversiones)?`
                    : "¿Cuáles son los alimentos que **NO** le gustan (aversiones)?";
                addBotMsg(aversionsMsg);
                setInternalStep('AVERSIONS_GATE');
            } else if (input === "CLEAR_ALL") {
                setPreferences({ aversiones: "", favoritos: "" });
                const initialMsg = isMinor
                    ? `Preferencias reiniciadas.\n\n¿Cuáles son los alimentos que **NO** le gustan a **${pName}** (aversiones)? Si no tiene, por favor indique 'Ninguno'.`
                    : "Preferencias reiniciadas.\n\n¿Cuáles son los alimentos que **NO** le gustan (aversiones)? Si no tiene, por favor indique 'Ninguno'.";
                addBotMsg(initialMsg);
                setInternalStep('AVERSIONS_GATE');
            } else if (input === "FINISH") {
                onPhaseComplete(preferences, messages);
            }
        } else if (internalStep === 'AVERSIONS_GATE') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                const favoritesMsg = isMinor 
                    ? `Entendido, se ha registrado que **${pName}** no presenta aversiones alimentarias.\n\n¿Cuáles son los alimentos favoritos o preferidos de **${pName}**?` 
                    : "Entendido, se ha registrado que no presenta aversiones alimentarias.\n\n¿Cuáles son sus alimentos favoritos o preferidos?";
                addBotMsg(favoritesMsg);
                setInternalStep('FAVORITES_GATE');
            } else if (isBool === true) {
                addBotMsg(isMinor ? `Entendido, tomamos nota de las aversiones.\n\n¿Cuáles alimentos evita **${pName}**?` : "Entendido, tomamos nota de las aversiones.\n\n¿Cuáles alimentos evita?");
            } else {
                setPreferences(prev => ({
                    ...prev,
                    aversiones: formatText(userMsg)
                }));
                const safeAversionText = (isTcaRoute && containsTrigger(userMsg)) ? "las restricciones indicadas" : formatText(userMsg);
                const avoidMsg = isMinor
                    ? `He registrado **${safeAversionText}** como aversión en la matriz de **${pName}**.\n\n¿Algún otro alimento que evite **${pName}**?`
                    : `He registrado **${safeAversionText}** como aversión en su matriz.\n\n¿Algún otro alimento que evite?`;
                addBotMsg(avoidMsg);
                setInternalStep('AVERSIONS_LOOP');
            }
        } else if (internalStep === 'AVERSIONS_LOOP') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false || lower.includes("ningun") || lower === "no") {
                const favoritesMsg = isMinor 
                    ? `Se han guardado todas las aversiones en el perfil de **${pName}**.\n\n¿Cuáles son los alimentos favoritos o preferidos de **${pName}**?` 
                    : "Se han guardado todas las aversiones en su perfil.\n\n¿Cuáles son sus alimentos favoritos o preferidos?";
                addBotMsg(favoritesMsg);
                setInternalStep('FAVORITES_GATE');
            } else if (isBool === true) {
                addBotMsg("Entendido.\n\n¿Cuál?");
            } else {
                setPreferences(prev => ({
                    ...prev,
                    aversiones: prev.aversiones ? prev.aversiones + ", " + formatText(userMsg) : formatText(userMsg)
                }));
                const safeAversionText = (isTcaRoute && containsTrigger(userMsg)) ? "las restricciones indicadas" : formatText(userMsg);
                addBotMsg(`Añadido **${safeAversionText}** a la lista de restricciones.\n\n¿Otro?`);
            }
        } else if (internalStep === 'FAVORITES_GATE') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                showSummary({ ...preferences });
                setInternalStep('REVIEW_SUMMARY');
            } else if (isBool === true) {
                addBotMsg(isMinor ? `Entendido.\n\n¿Cuáles son los favoritos de **${pName}**?` : "Entendido.\n\n¿Cuáles son sus favoritos?");
            } else {
                setPreferences(prev => ({
                    ...prev,
                    favoritos: formatText(userMsg)
                }));
                addBotMsg(`He registrado **${formatText(userMsg)}** como alimento preferido.\n\n¿Algún otro favorito?`);
                setInternalStep('FAVORITES_LOOP');
            }
        } else if (internalStep === 'FAVORITES_LOOP') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false || lower.includes("ningun") || lower === "no") {
                showSummary({ ...preferences });
                setInternalStep('REVIEW_SUMMARY');
            } else if (isBool === true) {
                addBotMsg("Entendido.\n\n¿Cuál?");
            } else {
                setPreferences(prev => ({
                    ...prev,
                    favoritos: prev.favoritos ? prev.favoritos + ", " + formatText(userMsg) : formatText(userMsg)
                }));
                addBotMsg(`Añadido **${formatText(userMsg)}** a la lista de favoritos.\n\n¿Otro?`);
            }
        } else if (internalStep === 'REVIEW_SUMMARY') {
            if (userMsg === "CONFIRM_DATA") {
                // Persistir
                const filterNoneValues = (item) => {
                    const clean = item.toLowerCase().trim();
                    return clean !== 'ninguno' && clean !== 'ninguna' && clean !== 'no' && clean !== 'no tiene' && clean !== 'niega' && clean !== 'n/a';
                };

                const excluded_ingredients = preferences.aversiones
                    ? preferences.aversiones.split(',')
                        .map(item => item.trim())
                        .filter(item => item && filterNoneValues(item))
                    : [];
                const favorite_foods = preferences.favoritos
                    ? preferences.favoritos.split(',')
                        .map(item => item.trim())
                        .filter(item => item && filterNoneValues(item))
                    : [];

                setPatientData(prev => ({
                    ...prev,
                    evaluacionDietetica: {
                        ...(prev.evaluacionDietetica || {}),
                        preferencias: {
                            aversiones: preferences.aversiones || "Ninguna",
                            favoritos: preferences.favoritos || "Ninguno"
                        }
                    },
                    nutrition: {
                        ...(prev.nutrition || {}),
                        preferences: {
                            ...(prev.nutrition?.preferences || {}),
                            excluded_ingredients,
                            favorite_foods
                        }
                    }
                }));
                
                addBotMsg("✅ Preferencias Alimentarias registradas exitosamente.");
                setTimeout(() => {
                    onPhaseComplete('PHASE_14_R24H');
                }, 1000);
            } else {
                // Resetear para corregir
                setPreferences({ aversiones: "", favoritos: "" });
                addBotMsg(isMinor 
                    ? `Reconfigurando perfil. ¿Cuáles alimentos **NO** le gustan a **${pName}**?` 
                    : "Reconfigurando perfil. ¿Cuáles alimentos **NO** le gustan?");
                setInternalStep('AVERSIONS_GATE');
            }
        }

        setIsGlobalTyping(false);
    };

    // Middleware de enrutamiento: callback constructor para corregir la ejecución prematura en App.jsx
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

    const showSummary = (finalPrefs) => {
        const cleanAversions = (isTcaRoute && containsTrigger(finalPrefs.aversiones)) 
            ? "Restricciones específicas de macronutrientes" 
            : (finalPrefs.aversiones || "Ninguna");

        const summary = `Para cerrar este bloque de preferencias y dar cumplimiento a la **NOM-004**, verifique los datos registrados:\n\n` +
            `- 🚫 **Aversiones:** ${cleanAversions}\n` +
            `- ❤️ **Alimentos Favoritos:** ${finalPrefs.favoritos || "Ninguno"}\n\n` +
            `Por favor, verifique si este reporte de preferencias alimentarias es correcto. ¿Es correcta y verídica toda esta información?`;

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: summary,
            options: [
                { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                { label: "❌ No, quiero corregir", value: "CORRECT_DATA" }
            ]
        }]);
    };

    return null; // Headless component
}
