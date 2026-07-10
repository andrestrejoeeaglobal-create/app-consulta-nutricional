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
    const { patientName: pName, isMinor } = usePatientLinguistics(patientData);
    
    // Lista ordenada de los pasos de la FFQ
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

    const [stepIndex, setStepIndex] = useState(0);
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
    }, [messages, isMinor, pName, setMessages]);

    useEffect(() => {
        const handler = () => processStep;
        if (registerInputHandler) {
            registerInputHandler(() => handler);
        }
        return () => {
            if (registerInputHandler) {
                registerInputHandler(prev => prev === handler ? null : prev);
            }
        };
    }, [stepIndex, ffqData, clinicalFlags, registerInputHandler]);

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
        if (stepIndex === STEPS.length) {
            // Already finished all steps, waiting for confirmation
            return;
        }

        const currentStep = STEPS[stepIndex];
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
                ? "⚠️ Entrada no válida. Por favor, introduzca un número de vasos del **0 al 20**:"
                : "⚠️ Entrada no válida. Por favor, introduzca un número del **0 al 7**:";
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: errorMsg,
                inputType: 'number'
            }]);
            setIsGlobalTyping(false);
            return;
        }

        if (label !== 'button') {
            const displayContent = currentStep.key === 'agua' ? `${freqVal} vasos/día` : `${freqVal} días`;
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

        if (nextIndex < STEPS.length) {
            setStepIndex(nextIndex);
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: STEPS[nextIndex].label,
                inputType: nextIndex === 12 ? 'text' : 'number' // Agua es vasos de agua
            }]);
        } else {
            showSummary(updatedFfq);
            setStepIndex(STEPS.length); // Final de pasos
        }

        setIsGlobalTyping(false);
    };

    const showSummary = (finalFfq) => {
        const summary = `Para cerrar este bloque de Frecuencia de Consumo y dar cumplimiento a la **NOM-004**, verifique las frecuencias registradas (días/semana):\n\n` +
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
        if (stepIndex === STEPS.length) {
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
