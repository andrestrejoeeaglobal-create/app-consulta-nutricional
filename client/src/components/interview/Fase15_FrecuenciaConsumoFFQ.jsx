import React, { useState, useEffect, useRef } from 'react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

/**
 * T.I.L.O. - MÓDULO FASE 15 (FRECUENCIA DE CONSUMO / FFQ)
 * Versión: v5.1 - Orthopedically Aligned, Rule V & Callback Constructor Fix
 */
export default function Fase15_FrecuenciaConsumoFFQ({
    patientData,
    setPatientData,
    onPhaseComplete,
    registerInputHandler,
    messages,
    setMessages,
    setIsGlobalTyping
}) {
    const { patientName: pName, isMinor, isLactante } = usePatientLinguistics(patientData);
    
    // Lista ordenada de los pasos de la FFQ Estándar (Adultos y Niños Mayores)
    const STEPS = [
        { key: 'leche', label: '1. **Lácteos** (Leche, Queso, Yogurt):', internalKey: 'FFQ_DAIRY', type: 'risk', flag: 'high_dairy_intake' },
        { key: 'carne_magra', label: '2. **Carnes Rojas Magras** (Bistec, Molida, Cuete):', internalKey: 'FFQ_RED_LEAN', type: 'magra' },
        { key: 'carne_grasa', label: '3. **Carnes Rojas Grasas** (Asada, Barbacoa, Cortes, Chicharrón):', internalKey: 'FFQ_RED_FAT', type: 'risk', flag: 'limit_red_meat_fat' },
        { key: 'carne_procesada', label: '4. **Carnes Procesadas** (Salchicha, Jamón, Tocino):', internalKey: 'FFQ_MEAT_PROC', type: 'protective', flag: 'good_processed_meat_control' },
        { key: 'pollo', label: '5. **Carnes Blancas** (Pollo, Pescado, Atún):', internalKey: 'FFQ_WHITE_MEAT' },
        { key: 'cereales', label: '6. **Cereales y Tubérculos** (Arroz, Pasta, Papa, Pan):', internalKey: 'FFQ_CEREALS' },
        { key: 'leguminosas', label: '7. **Leguminosas** (Frijol, Lenteja, Habas):', internalKey: 'FFQ_LEGUMES', type: 'risk', flag: 'warning_fodmap_colitis' },
        { key: 'verduras', label: '8. **Verduras** (Crudas o cocidas):', internalKey: 'FFQ_VEGGIES', type: 'protective', flag: 'low_fiber_risk' },
        { key: 'frutas', label: '9. **Frutas**:', internalKey: 'FFQ_FRUITS', type: 'optimal', flag: 'good_fruit_intake' },
        { key: 'grasas', label: '10. **Grasas Saludables** (Aguacate, Nueces, Aceite Oliva):', internalKey: 'FFQ_FATS', type: 'optimal', flag: 'good_fats_intake' },
        { key: 'azucares', label: '11. **Azúcares** (Refrescos, Dulces, Postres):', internalKey: 'FFQ_SUGARS', type: 'risk', flag: 'high_sugar_risk_CRITICAL' },
        { key: 'chatarra', label: '12. **Comida Rápida / Fritos** (Pizzas, Tacos fritos, etc):', internalKey: 'FFQ_JUNK', type: 'risk', flag: 'high_sodium_trans' },
        { key: 'agua', label: '13. **Agua Natural** (Vasos de 250ml al día):', internalKey: 'FFQ_WATER' }
    ];

    // Lista adaptada para Lactantes (0-2 años)
    const PEDIATRIC_LACTANTE_STEPS = [
        { key: 'leche', label: '1. **Lactancia y Lácteos Pediátricos** (Leche materna, Fórmula infantil):', internalKey: 'FFQ_DAIRY', type: 'protective' },
        { key: 'papillas_fruta_verdura', label: '2. **Papillas y Purés de Fruta / Verdura**:', internalKey: 'FFQ_VEGGIES', type: 'protective' },
        { key: 'cereales_infantiles', label: '3. **Cereales Infantiles y Papillas de Grano**:', internalKey: 'FFQ_CEREALS' },
        { key: 'proteina_triturada', label: '4. **Proteína / Papillas de Carne o Pollo**:', internalKey: 'FFQ_WHITE_MEAT' },
        { key: 'leguminosas_coladas', label: '5. **Leguminosas Coladas / Frijol triturado**:', internalKey: 'FFQ_LEGUMES' },
        { key: 'agua', label: '6. **Agua Natural o Hidratación Pediátrica** (Tomas o onzas al día):', internalKey: 'FFQ_WATER' }
    ];

    const ACTIVE_STEPS = isLactante ? PEDIATRIC_LACTANTE_STEPS : STEPS;

    const [stepIndex, setStepIndex] = useState(() => {
        const hasSummary = messages && messages.some(msg => msg.role === 'assistant' && (msg.content.includes("verifique las frecuencias registradas") || msg.content.includes("Cuestionario de Frecuencia de Consumo (FFQ) completado")));
        const f = patientData?.evaluacionDietetica?.ffq;
        if (hasSummary || (f && f.leche !== undefined && hasSummary)) {
            return -1;
        }
        return 0;
    });
    const [ffqData, setFfqData] = useState({});
    const [clinicalFlags, setClinicalFlags] = useState([]);
    const hasGreeted = useRef(false);

    // Auto-transition on mount if already completed (resilience against page reloads/crashes)
    useEffect(() => {
        const alreadyCompleted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Cuestionario de Frecuencia de Consumo (FFQ) completado con éxito"));
        if (alreadyCompleted) {
            onPhaseComplete('PHASE_16_BIOMETRICS');
        }
    }, [messages, onPhaseComplete]);

    // Inicialización - Mitigación absoluta de doble render en StrictMode
    useEffect(() => {
        if (hasGreeted.current) return;

        if (stepIndex === -1) {
            hasGreeted.current = true;
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "De acuerdo. ¿Qué cambio o acción desea realizar en su cuestionario de Frecuencia de Consumo de Alimentos (FFQ)?",
                options: [
                    { label: "✏️ Modificar frecuencia de consumo", value: "MODIFY_FFQ" },
                    { label: "🔄 Limpiar y reiniciar FFQ", value: "CLEAR_ALL" },
                    { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                ]
            }]);
            return;
        }

        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Frecuencia de Consumo"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;
            const initialMsg = isMinor
                ? `He registrado y sellado el recordatorio de consumo de 24 horas de **${pName}** de manera exitosa.\n\nPara finalizar la evaluación dietética, completaremos el **Cuestionario de Frecuencia de Consumo (FFQ)** de **${pName}**.\n\nPor favor, responda para cada grupo de alimentos con un número del **0 al 7** (días a la semana, donde 0=Nunca, 7=Diario):\n\n1. **Lácteos** (Leche, Queso, Yogurt):`
                : `He registrado y sellado su recordatorio de consumo de 24 horas de manera exitosa.\n\nPara finalizar la evaluación dietética, completaremos el **Cuestionario de Frecuencia de Consumo (FFQ)**.\n\nPor favor, responda para cada grupo de alimentos con un número del **0 al 7** (días a la semana, donde 0=Nunca, 7=Diario):\n\n1. **Lácteos** (Leche, Queso, Yogurt):`;

            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: initialMsg,
                inputType: 'number'
            }]);
        }
    }, [messages, isMinor, pName, setMessages, stepIndex]);


    // Sincronización en tiempo real con el expediente global
    useEffect(() => {
        if (setPatientData) {
            setPatientData(prev => {
                const currentFfq = prev.evaluacionDietetica?.ffq;
                if (JSON.stringify(currentFfq) === JSON.stringify(ffqData)) {
                    return prev;
                }
                return {
                    ...prev,
                    evaluacionDietetica: {
                        ...(prev.evaluacionDietetica || {}),
                        ffq: ffqData
                    }
                };
            });
        }
    }, [ffqData, setPatientData]);

    const checkFreq = (respuestaStr, type) => {
        const freq = parseInt(respuestaStr, 10);
        if (isNaN(freq)) return false;

        if (type === 'risk') return freq >= 3;
        if (type === 'protective') return freq <= 1;
        if (type === 'optimal') return freq >= 5;
        return false;
    };

    async function processStep(input, label = null) {
        let userText = (label && label !== 'text' && label !== 'button') ? label : input;
        if (input === "MODIFY_FFQ") userText = "✏️ Modificar frecuencia de consumo";
        if (input === "CLEAR_ALL") userText = "🔄 Limpiar y reiniciar FFQ";
        if (input === "FINISH") userText = "❌ Cancelar (Volver al resumen)";

        if (stepIndex === -1) {
            if (label !== 'button') {
                setMessages(prev => [...prev, { role: 'user', content: userText }]);
            }
            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            if (input === "MODIFY_FFQ") {
                setStepIndex(0);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: STEPS[0].label,
                    inputType: 'number'
                }]);
            } else if (input === "CLEAR_ALL") {
                setFfqData({});
                setClinicalFlags([]);
                setStepIndex(0);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Historial de FFQ reiniciado.\n\n1. **Lácteos** (Leche, Queso, Yogurt):",
                    inputType: 'number'
                }]);
            } else if (input === "FINISH") {
                onPhaseComplete(ffqData, messages);
            }
            setIsGlobalTyping(false);
            return;
        }

        if (stepIndex === ACTIVE_STEPS.length) {
            // Already finished all steps, waiting for confirmation
            return;
        }

        const currentStep = ACTIVE_STEPS[stepIndex];
        const userMsg = input;
        const freqVal = parseInt(userMsg, 10);
        const maxVal = currentStep.key === 'agua' ? 20 : 7;

        if (isNaN(freqVal) || freqVal < 0 || freqVal > maxVal) {
            if (label !== 'button') {
                setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
            }
            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));
            const errorMsg = currentStep.key === 'agua'
                ? "⚠️ Entrada no válida. Por favor, introduzca un número de vasos o tomas del **0 al 20**:"
                : "⚠️ Entrada no válida. Por favor, introduzca un número del **0 al 7** (días a la semana):";
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: errorMsg,
                inputType: 'number'
            }]);
            setIsGlobalTyping(false);
            return;
        }

        if (label !== 'button') {
            const displayContent = currentStep.key === 'agua' ? `${freqVal} vasos/tomas al día` : `${freqVal} días/semana`;
            setMessages(prev => [...prev, { role: 'user', content: displayContent }]);
        }
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const nextIndex = stepIndex + 1;

        // Registrar dato
        const updatedFfq = { ...ffqData, [currentStep.key]: freqVal };
        setFfqData(updatedFfq);

        // Evaluar banderas clínicas
        const newFlags = [...clinicalFlags];
        if (currentStep.type && currentStep.flag) {
            const meetsCondition = checkFreq(freqVal, currentStep.type);
            if (meetsCondition) {
                newFlags.push(currentStep.flag);
            }
        }
        setClinicalFlags(newFlags);

        if (nextIndex < ACTIVE_STEPS.length) {
            setStepIndex(nextIndex);
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: ACTIVE_STEPS[nextIndex].label,
                inputType: 'number'
            }]);
        } else {
            showSummary(updatedFfq);
            setStepIndex(ACTIVE_STEPS.length); // Final de pasos
        }

        setIsGlobalTyping(false);
    };

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

    const showSummary = (finalFfq) => {
        let summary = "";
        if (isLactante) {
            summary = `Para cerrar este bloque de Evaluación Dietética Pediátrica y dar cumplimiento a la **NOM-004**, verifique los registros de alimentación de **${pName}** (su bebé):\n\n` +
                `- 🥛 **Lactancia / Lácteos:** ${finalFfq.leche || 0} días/semana\n` +
                `- 🥣 **Papillas / Purés (Fruta/Verdura):** ${finalFfq.papillas_fruta_verdura || 0} días/semana\n` +
                `- 🌾 **Cereales Infantiles:** ${finalFfq.cereales_infantiles || 0} días/semana\n` +
                `- 🍗 **Proteína / Papillas de Carne:** ${finalFfq.proteina_triturada || 0} días/semana\n` +
                `- 🫘 **Leguminosas Coladas:** ${finalFfq.leguminosas_coladas || 0} días/semana\n` +
                `- 💧 **Tomas de Agua / Hidratación:** ${finalFfq.agua || 0} tomas/día\n\n` +
                `---\n\n` +
                `¿Es correcta esta información?`;
        } else {
            summary = `Para cerrar este bloque de Frecuencia de Consumo y dar cumplimiento a la **NOM-004**, verifique las frecuencias registradas (días/semana):\n\n` +
                `- 🥛 **Lácteos:** ${finalFfq.leche || 0} días\n` +
                `- 🥩 **C. Rojas (Magras/Grasas):** ${finalFfq.carne_magra || 0}/${finalFfq.carne_grasa || 0} días\n` +
                `- 🥓 **C. Procesadas:** ${finalFfq.carne_procesada || 0} días\n` +
                `- 🍗 **C. Blancas:** ${finalFfq.pollo || 0} días\n` +
                `- 🌾 **Cereales:** ${finalFfq.cereales || 0} días\n` +
                `- 🫘 **Leguminosas:** ${finalFfq.leguminosas || 0} días\n` +
                `- 🥦 **Verduras:** ${finalFfq.verduras || 0} días\n` +
                `- 🍎 **Frutas:** ${finalFfq.frutas || 0} días\n` +
                `- 🥑 **Grasas Saludables:** ${finalFfq.grasas || 0} días\n` +
                `- 🍬 **Azúcares:** ${finalFfq.azucares || 0} días\n` +
                `- 🍕 **Comida Rápida:** ${finalFfq.chatarra || 0} días\n` +
                `- 💧 **Agua:** ${finalFfq.agua || 0} vasos/día\n\n` +
                `---\n\n` +
                `¿Es correcta esta información?`;
        }

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: summary,
            options: [
                { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                { label: "❌ No, quiero corregir", value: "CORRECT_DATA" }
            ]
        }]);
    };

    // Manejar confirmación de resumen
    useEffect(() => {
        if (stepIndex === ACTIVE_STEPS.length) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
                const userVal = lastMsg.content;
                if (userVal.includes("Sí") || userVal.includes("CONFIRM")) {
                    saveAndFinish();
                } else if (userVal.includes("No") || userVal.includes("CORRECT")) {
                    setFfqData({});
                    setClinicalFlags([]);
                    setStepIndex(0);
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: "Reconfigurando frecuencias. 1. **Lácteos** (Leche, Queso, Yogurt):",
                        inputType: 'number'
                    }]);
                }
            }
        }
    }, [messages, stepIndex]);

    const saveAndFinish = () => {
        // Persistir
        setPatientData(prev => ({
            ...prev,
            evaluacionDietetica: {
                ...(prev.evaluacionDietetica || {}),
                ffq: ffqData
            },
            clinical_flags: [...new Set([...(prev.clinical_flags || []), ...clinicalFlags])]
        }));

        setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "✅ **Cuestionario de Frecuencia de Consumo (FFQ) completado con éxito.**"
        }]);

        setTimeout(() => {
            onPhaseComplete('PHASE_16_BIOMETRICS');
        }, 1000);
    };

    return null; // Headless component
}
