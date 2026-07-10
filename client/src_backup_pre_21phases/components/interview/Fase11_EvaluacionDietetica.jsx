import React, { useState, useEffect } from 'react';
import usePatientLinguistics from '../../hooks/usePatientLinguistics';

// --- UTILS LOCALES ---
const formatText = (text) => {
    return text.split(/[\s,]+/).map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(", ");
};

const strictBooleanValidator = (text) => {
    const truthy = ["si", "sí", "claro", "por supuesto", "afirmativo", "simon", "s", "ok"];
    const falsy = ["no", "ni hablar", "negativo", "n", "nunca", "jamas", "jamás", "nop", "ninguno", "nada"];
    const lower = text.toLowerCase().trim();

    if (truthy.some(t => lower === t || lower.startsWith(t + " "))) return true;
    if (falsy.some(f => lower === f || lower.startsWith(f + " "))) return false;
    return null; // Return null if not boolean (it might be actual content)
};

function checkFreq(respuestaStr, tipoAlimento = 'risk') {
    const lower = respuestaStr.toLowerCase();
    let freq = null;

    if (lower.match(/diario|todos los d[ií]as|7/)) freq = 7;
    else if (lower.match(/6/)) freq = 6;
    else if (lower.match(/5/)) freq = 5;
    else if (lower.match(/4/)) freq = 4;
    else if (lower.match(/3/)) freq = 3;
    else if (lower.match(/2/)) freq = 2;
    else if (lower.match(/1|una vez/)) freq = 1;
    else if (lower.match(/nunca|jam[aá]s|0|ninguna/)) freq = 0;
    else return false;

    if (tipoAlimento === 'risk') return freq >= 3;
    if (tipoAlimento === 'protective') return freq <= 1;
    if (tipoAlimento === 'optimal') return freq >= 5;

    return false;
}

export default function Fase11_EvaluacionDietetica({
    patientData,
    setPatientData,
    onPhaseComplete,
    registerInputHandler,
    messages,
    setMessages,
    setIsGlobalTyping
}) {
    const { patientName: pName, isMinor } = usePatientLinguistics(patientData);
    const [internalStep, setInternalStep] = useState('AVERSIONS_GATE');
    
    const [evaluacionDietetica, setEvaluacionDietetica] = useState({
        preferencias: {
            aversiones: patientData?.evaluacionDietetica?.preferencias?.aversiones || "",
            favoritos: patientData?.evaluacionDietetica?.preferencias?.favoritos || ""
        },
        r24h: patientData?.evaluacionDietetica?.r24h || [],
        ffq: patientData?.evaluacionDietetica?.ffq || {}
    });

    const [tempItem, setTempItem] = useState({});
    const [clinicalFlags, setClinicalFlags] = useState([]);

    useEffect(() => {
        if (messages.length === 0) {
            setMessages([
                { 
                    role: 'assistant', 
                    content: isMinor ? `Pasemos a la Evaluación Dietética.\n\n¿Cuáles son los alimentos que NO le gustan a ${pName} (aversiones)? Si no tiene, responde 'Ninguno'.` : "Pasemos a su Evaluación Dietética.\n\n¿Cuáles son sus alimentos que NO le gustan (aversiones)? Si no tiene, diga 'Ninguno'." 
                }
            ]);
        }
    }, []);

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(processStep);
        }
        return () => {
            if (registerInputHandler) registerInputHandler(null);
        };
    }, [internalStep, evaluacionDietetica, tempItem, clinicalFlags, registerInputHandler]);

    const processStep = async (input, label = null) => {
        const userMsg = label || input;
        const lower = userMsg.toLowerCase();

        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const addBotMsg = (msg, inputType = 'text') => {
            setMessages(prev => [...prev, { role: 'assistant', content: msg, inputType }]);
        };

        if (internalStep === 'AVERSIONS_GATE') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                addBotMsg(isMinor ? `¿Cuáles son los alimentos favoritos o preferidos de ${pName}?` : "¿Cuáles son sus alimentos favoritos o preferidos?");
                setInternalStep('FAVORITES_GATE');
            } else if (isBool === true) {
                addBotMsg(isMinor ? `¿Cuáles alimentos evita ${pName}?` : "¿Cuáles alimentos evita?");
            } else {
                setEvaluacionDietetica(prev => ({
                    ...prev,
                    preferencias: { ...prev.preferencias, aversiones: formatText(userMsg) }
                }));
                addBotMsg(isMinor ? `¿Algún otro alimento que evite ${pName}?` : "¿Algún otro alimento que evite?");
                setInternalStep('AVERSIONS_LOOP');
            }
        } else if (internalStep === 'AVERSIONS_LOOP') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                addBotMsg(isMinor ? `¿Cuáles son los alimentos favoritos o preferidos de ${pName}?` : "¿Cuáles son sus alimentos favoritos o preferidos?");
                setInternalStep('FAVORITES_GATE');
            } else if (isBool === true) {
                addBotMsg("¿Cuál?");
            } else {
                setEvaluacionDietetica(prev => ({
                    ...prev,
                    preferencias: {
                        ...prev.preferencias,
                        aversiones: prev.preferencias.aversiones ? prev.preferencias.aversiones + ", " + formatText(userMsg) : formatText(userMsg)
                    }
                }));
                addBotMsg("¿Otro?");
            }
        } else if (internalStep === 'FAVORITES_GATE') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                addBotMsg(isMinor ? `Entendido.\n\nPasemos al Recordatorio de 24 Horas.\n\nDime, ¿a qué hora consumió ${pName} su primer alimento ayer? (Ej. 8:00 am).` : "Entendido.\n\nPasemos al Recordatorio de 24 Horas.\n\nDígame, ¿a qué hora consumió su primer alimento ayer? (Ej. 8:00 am).");
                setInternalStep('R24H_TIME');
            } else if (isBool === true) {
                addBotMsg(isMinor ? `¿Cuáles son los favoritos de ${pName}?` : "¿Cuáles son sus favoritos?");
            } else {
                setEvaluacionDietetica(prev => ({
                    ...prev,
                    preferencias: { ...prev.preferencias, favoritos: formatText(userMsg) }
                }));
                addBotMsg("¿Algún otro favorito?");
                setInternalStep('FAVORITES_LOOP');
            }
        } else if (internalStep === 'FAVORITES_LOOP') {
            const isBool = strictBooleanValidator(userMsg);
            if (isBool === false) {
                addBotMsg(isMinor ? `Entendido.\n\nPasemos al Recordatorio de 24 Horas.\n\nDime, ¿a qué hora consumió ${pName} su primer alimento ayer? (Ej. 8:00 am).` : "Entendido.\n\nPasemos al Recordatorio de 24 Horas.\n\nDígame, ¿a qué hora consumió su primer alimento ayer? (Ej. 8:00 am).");
                setInternalStep('R24H_TIME');
            } else if (isBool === true) {
                addBotMsg("¿Cuál?");
            } else {
                setEvaluacionDietetica(prev => ({
                    ...prev,
                    preferencias: {
                        ...prev.preferencias,
                        favoritos: prev.preferencias.favoritos ? prev.preferencias.favoritos + ", " + formatText(userMsg) : formatText(userMsg)
                    }
                }));
                addBotMsg("¿Otro?");
            }
        } else if (internalStep === 'R24H_TIME') {
            if (lower.includes("nada") || lower.includes("fin") || lower.includes("dormir") || lower.includes("todo") || (lower.includes("no") && userMsg.length < 5)) {
                addBotMsg(isMinor ? "Registro de 24h completado.\n\n**Frecuencia de Consumo.**\n\nPara cada grupo de alimentos, responde con un número del **0 al 7** (días a la semana, donde 0=Nunca, 7=Diario).\n\n1. **Lácteos** (Leche, Queso, Yogurt):" : "Registro de 24h completado.\n\n**Frecuencia de Consumo.**\n\nPara cada grupo de alimentos, responda con un número del **0 al 7** (días a la semana, donde 0=Nunca, 7=Diario).\n\n1. **Lácteos** (Leche, Queso, Yogurt):", 'number');
                setInternalStep('FFQ_DAIRY');
            } else {
                setTempItem({ hora: userMsg });
                addBotMsg(isMinor ? `¿Qué comió ${pName} a esa hora?` : "¿Qué comió a esa hora?");
                setInternalStep('R24H_CONTENT');
            }
        } else if (internalStep === 'R24H_CONTENT') {
            const newItem = { hora: tempItem.hora, alimento: userMsg };
            setEvaluacionDietetica(prev => ({
                ...prev,
                r24h: [...prev.r24h, newItem]
            }));
            addBotMsg(isMinor ? "¿Cuál fue la siguiente hora de comida? (O di 'Fin' si terminaste)." : "¿Cuál fue la siguiente hora de comida? (O diga 'Fin' si terminó).");
            setInternalStep('R24H_TIME');
        } else if (internalStep === 'FFQ_DAIRY') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, leche: userMsg } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "high_dairy_intake"]);
            addBotMsg("2. **Carnes Rojas Magras** (Bistec, Molida, Cuete):", 'number');
            setInternalStep('FFQ_RED_LEAN');
        } else if (internalStep === 'FFQ_RED_LEAN') {
            setTempItem(prev => ({ ...prev, meat_lean: userMsg }));
            addBotMsg("3. **Carnes Rojas Grasas** (Asada, Barbacoa, Cortes, Chicharrón):", 'number');
            setInternalStep('FFQ_RED_FAT');
        } else if (internalStep === 'FFQ_RED_FAT') {
            const lean = tempItem.meat_lean || "?";
            const combined = `Magra: ${lean} | Grasa: ${userMsg}`;
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, carne_roja: combined } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "limit_red_meat_fat", "cardio_risk_diet"]);
            addBotMsg("4. **Carnes Procesadas** (Salchicha, Jamón, Tocino):", 'number');
            setInternalStep('FFQ_MEAT_PROC');
        } else if (internalStep === 'FFQ_MEAT_PROC') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, carne_procesada: userMsg } }));
            if (checkFreq(userMsg, 'protective')) setClinicalFlags(prev => [...prev, "good_processed_meat_control"]);
            addBotMsg("5. **Carnes Blancas** (Pollo, Pescado, Atún):", 'number');
            setInternalStep('FFQ_WHITE_MEAT');
        } else if (internalStep === 'FFQ_WHITE_MEAT') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, pollo: userMsg } }));
            addBotMsg("6. **Cereales y Tubérculos** (Arroz, Pasta, Papa, Pan):", 'number');
            setInternalStep('FFQ_CEREALS');
        } else if (internalStep === 'FFQ_CEREALS') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, cereales: userMsg } }));
            addBotMsg("7. **Leguminosas** (Frijol, Lenteja, Habas):", 'number');
            setInternalStep('FFQ_LEGUMES');
        } else if (internalStep === 'FFQ_LEGUMES') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, leguminosas: userMsg } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "warning_fodmap_colitis"]);
            addBotMsg("8. **Verduras** (Crudas o cocidas):", 'number');
            setInternalStep('FFQ_VEGGIES');
        } else if (internalStep === 'FFQ_VEGGIES') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, verduras: userMsg } }));
            if (checkFreq(userMsg, 'protective')) setClinicalFlags(prev => [...prev, "low_fiber_risk"]);
            else if (checkFreq(userMsg, 'optimal')) setClinicalFlags(prev => [...prev, "good_fiber_intake"]);
            addBotMsg("9. **Frutas**:", 'number');
            setInternalStep('FFQ_FRUITS');
        } else if (internalStep === 'FFQ_FRUITS') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, frutas: userMsg } }));
            if (checkFreq(userMsg, 'optimal')) setClinicalFlags(prev => [...prev, "good_fruit_intake", "monitor_fructose_load"]);
            addBotMsg("10. **Grasas Saludables** (Aguacate, Nueces, Aceite Oliva):", 'number');
            setInternalStep('FFQ_FATS');
        } else if (internalStep === 'FFQ_FATS') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, grasas: userMsg } }));
            if (checkFreq(userMsg, 'optimal')) setClinicalFlags(prev => [...prev, "good_fats_intake"]);
            addBotMsg("11. **Azúcares** (Refrescos, Dulces, Postres):", 'number');
            setInternalStep('FFQ_SUGARS');
        } else if (internalStep === 'FFQ_SUGARS') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, azucares: userMsg } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "high_sugar_risk_CRITICAL"]);
            else if (checkFreq(userMsg, 'protective')) setClinicalFlags(prev => [...prev, "good_sugar_control"]);
            addBotMsg("12. **Comida Rápida / Fritos** (Pizzas, Tacos fritos, etc):", 'number');
            setInternalStep('FFQ_JUNK');
        } else if (internalStep === 'FFQ_JUNK') {
            setEvaluacionDietetica(prev => ({ ...prev, ffq: { ...prev.ffq, chatarra: userMsg } }));
            if (checkFreq(userMsg, 'risk')) setClinicalFlags(prev => [...prev, "high_sodium_trans"]);
            else if (checkFreq(userMsg, 'protective')) setClinicalFlags(prev => [...prev, "good_junk_control"]);
            addBotMsg("13. **Agua Natural** (Vasos al día):", 'number');
            setInternalStep('FFQ_WATER');
        } else if (internalStep === 'FFQ_WATER') {
            const finalDiet = { ...evaluacionDietetica, ffq: { ...evaluacionDietetica.ffq, agua: userMsg } };
            
            setPatientData(prev => ({
                ...prev,
                evaluacionDietetica: finalDiet,
                clinical_flags: [...(prev.clinical_flags || []), ...clinicalFlags]
            }));

            setInternalStep('FINALIZED');
            finishPhase();
        }

        setIsGlobalTyping(false);
    };

    const finishPhase = () => {
        const nextMsg = isMinor ? `Registro de Evaluación Dietética completado para ${pName}.` : "Registro de Evaluación Dietética completado.";
        setMessages(prev => [...prev, { role: 'assistant', content: nextMsg }]);
        
        setTimeout(() => {
            onPhaseComplete('PHASE_12_BIOMETRICS_GATE');
        }, 1500);
    };

    return null;
}
