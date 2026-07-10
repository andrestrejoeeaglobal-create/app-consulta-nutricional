import React, { useState, useEffect } from 'react';
import tiloImg from '../../assets/tilo.png';
import { strictBooleanValidator } from '../../utils/utils';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

const normalizeMetricMatch = (text) => {
    const match = text.match(/\d+(\.\d+)?/);
    if (!match) return null;
    let val = parseFloat(match[0]);
    if (val > 3 && text.toLowerCase().includes('m') === false) {
        val = val / 100;
    }
    return val;
};

const Fase12_Biometria = ({
    onPhaseComplete,
    patientData,
    setPatientData,
    messages,
    setMessages,
    registerInputHandler,
    setIsGlobalTyping
}) => {
    const { pName, isMinor, patientSex } = usePatientLinguistics(patientData);

    const [internalStep, setInternalStep] = useState('BIO_START');
    const [clinicalFlags, setClinicalFlags] = useState([]);
    
    const [biometria, setBiometria] = useState({
        vitals: {
            height: patientData?.vitals?.height || null,
            weight: patientData?.vitals?.weight || null,
            max_weight: patientData?.vitals?.max_weight || null,
            waist: patientData?.vitals?.waist || null,
            hip: patientData?.vitals?.hip || null,
            blood_pressure: patientData?.vitals?.blood_pressure || "",
            spo2: patientData?.vitals?.spo2 || null,
            hr: patientData?.vitals?.hr || null,
            temperature: patientData?.vitals?.temperature || null,
            rr: patientData?.vitals?.rr || null,
            glucose: patientData?.vitals?.glucose || null
        }
    });

    useEffect(() => {
        if (messages.length === 0) {
            setMessages([
                {
                    role: "assistant",
                    content: isMinor
                        ? `¿Cuenta con algún registro reciente del peso o estatura de ${pName} que podamos ingresar al sistema? (Sí / No)`
                        : "¿Cuenta con algún registro reciente de su peso o estatura que podamos ingresar al sistema? (Sí / No)",
                    avatar: tiloImg
                }
            ]);
        }
    }, []);

    const handleSend = (userMsg) => {
        const lower = userMsg.toLowerCase();

        const addBotMsg = (msg) => setMessages(prev => [...prev, { role: "assistant", content: msg, avatar: tiloImg }]);

        if (internalStep === 'BIO_START') {
            const isValid = strictBooleanValidator(userMsg);
            if (isValid === false) {
                const isFemale = patientSex === 'FEMENINO' || patientSex === 'F' || patientSex === 'Mujer';
                const extraPregnancyInstruction = isFemale ? ", sin contar embarazo," : "";
                
                addBotMsg(isMinor 
                    ? `Entendido, omitiremos las mediciones actuales.\n\nSin embargo, para calcular el punto de ajuste termogénico de ${pName}: ¿Cuál es el peso máximo que ha alcanzado en su vida${extraPregnancyInstruction} en kilogramos? (Ej: 80)` 
                    : `Entendido, omitiremos las mediciones actuales.\n\nSin embargo, para calcular su punto de ajuste termogénico: ¿Cuál es el peso máximo que ha alcanzado en su vida${extraPregnancyInstruction} en kilogramos? (Ej: 80)`);
                setInternalStep('MAX_WEIGHT_SKIP_REST');
            } else if (isValid === true) {
                addBotMsg(isMinor ? `¿Cuál es la estatura de ${pName} en metros? (Ej: 1.65)` : "¿Cuál es su estatura en metros? (Ej: 1.65)");
                setInternalStep('HEIGHT');
            } else {
                addBotMsg(isMinor ? "Por favor, responde Sí o No." : "Por favor, responda Sí o No.");
            }
        }
        else if (internalStep === 'HEIGHT') {
            const val = normalizeMetricMatch(userMsg);
            if (!val) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 1.65)" : "Por favor ingrese un número válido (ej: 1.65)");
                return;
            }
            setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, height: val } }));
            addBotMsg(isMinor ? `¿Cuál es el peso de ${pName} en kilogramos? (Ej: 65 o 65.5)` : "¿Cuál es su peso en kilogramos? (Ej: 65 o 65.5)");
            setInternalStep('WEIGHT');
        }
        else if (internalStep === 'WEIGHT') {
            const val = normalizeMetricMatch(userMsg);
            if (!val) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 65.5)" : "Por favor ingrese un número válido (ej: 65.5)");
                return;
            }
            setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, weight: val } }));
            
            const isFemale = patientSex === 'FEMENINO' || patientSex === 'F' || patientSex === 'Mujer';
            const extraPregnancyInstruction = isFemale ? ", sin contar embarazo," : "";
            
            addBotMsg(isMinor 
                ? `Para calcular el punto de ajuste termogénico de ${pName}: ¿Cuál es el peso máximo que ha alcanzado en su vida${extraPregnancyInstruction} en kilogramos? (Ej: 80)` 
                : `Para calcular su punto de ajuste termogénico: ¿Cuál es el peso máximo que ha alcanzado en su vida${extraPregnancyInstruction} en kilogramos? (Ej: 80)`);
            setInternalStep('MAX_WEIGHT');
        }
        else if (internalStep === 'MAX_WEIGHT') {
            const val = normalizeMetricMatch(userMsg);
            if (!val && !lower.includes("no") && !lower.includes("na") && !lower.includes("se")) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 80) o di 'No lo sé'." : "Por favor ingrese un número válido (ej: 80) o diga 'No lo sé'.");
                return;
            }
            
            if (val) {
                setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, max_weight: val } }));
            }
            
            addBotMsg(isMinor ? `¿Cuál es la circunferencia de cintura de ${pName} en centímetros? (Ej: 80)` : "¿Cuál es su circunferencia de cintura en centímetros? (Ej: 80)");
            setInternalStep('WAIST');
        }
        else if (internalStep === 'MAX_WEIGHT_SKIP_REST') {
            const val = normalizeMetricMatch(userMsg);
            if (!val && !lower.includes("no") && !lower.includes("na") && !lower.includes("se")) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 80) o di 'No lo sé'." : "Por favor ingrese un número válido (ej: 80) o diga 'No lo sé'.");
                return;
            }
            
            const finalBio = { ...biometria };
            if (val) {
                finalBio.vitals.max_weight = val;
                setBiometria(finalBio);
            }
            
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, ...finalBio.vitals },
                    clinical_flags: [...(prev.clinical_flags || []), ...clinicalFlags]
                }));
            }
            addBotMsg("Entendido. Pasando a la siguiente sección...");
            setInternalStep('FINALIZED');
            if (onPhaseComplete) onPhaseComplete('PHASE_13_SPECIAL_CONTEXT');
        }
        else if (internalStep === 'WAIST') {
            const val = normalizeMetricMatch(userMsg);
            if (!val) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 80)" : "Por favor ingrese un número válido (ej: 80)");
                return;
            }
            setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, waist: val } }));
            addBotMsg(isMinor ? `¿Cuál es la circunferencia de cadera de ${pName} en centímetros? (Ej: 95)` : "¿Cuál es su circunferencia de cadera en centímetros? (Ej: 95)");
            setInternalStep('HIP');
        }
        else if (internalStep === 'HIP') {
            const val = normalizeMetricMatch(userMsg);
            if (!val) {
                addBotMsg(isMinor ? "Por favor ingresa un número válido (ej: 95)" : "Por favor ingrese un número válido (ej: 95)");
                return;
            }
            setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, hip: val } }));
            addBotMsg(isMinor ? `¿Cuál es la presión arterial de ${pName}? (Ej: 120/80)` : "¿Cuál es su presión arterial? (Ej: 120/80)");
            setInternalStep('BP');
        }
        else if (internalStep === 'BP') {
            let finalBP = userMsg;
            if (userMsg.match(/^\d{2,3} \d{2,3}$/)) {
                finalBP = userMsg.replace(" ", "/");
            } else if (userMsg.match(/^\d{5,6}$/)) {
                const mid = 3;
                finalBP = userMsg.slice(0, mid) + "/" + userMsg.slice(mid);
            }

            const regexBP = /^\d{2,3}\/\d{2,3}$/;
            if (!regexBP.test(finalBP) && !finalBP.toLowerCase().includes("na") && !finalBP.toLowerCase().includes("no")) {
                addBotMsg(isMinor ? "Formato inválido. Use '120/80' o '120 80' (Con espacio)." : "Formato inválido. Use '120/80' o '120 80' (Con espacio).");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (regexBP.test(finalBP)) {
                const [sys, dia] = finalBP.split('/').map(Number);
                if (sys > 160 || dia > 100) {
                    newFlags.push("URGENCIA_HIPERTENSIVA");
                    alertMsg = "🚨 ALERTA ROJA: CRISIS HIPERTENSIVA DETECTADA (>160/100). SUGIERA ATENCIÓN MÉDICA INMEDIATA.\n\n";
                }
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, blood_pressure: finalBP } }));

            addBotMsg(`${alertMsg}${isMinor ? `¿Cuál es la saturación de oxígeno de ${pName}? (Ej: 98)` : "¿Cuál es su saturación de oxígeno? (Ej: 98)"}`);
            setInternalStep('SPO2');
        }
        else if (internalStep === 'SPO2') {
            const val = parseInt(userMsg);
            if ((isNaN(val) || val < 50 || val > 100) && !lower.includes("na") && !lower.includes("no")) {
                addBotMsg(isMinor ? "Valor inválido (50-100%). O di 'NO' o 'NA' si no tienes el dato." : "Valor inválido (50-100%). O diga 'NO' o 'NA' si no tiene el dato.");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (!isNaN(val)) {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, spo2: val } }));
                if (val < 90) {
                    newFlags.push("HIPOXIA");
                    alertMsg = "🚨 ALERTA: HIPOXIA (SpO2 < 90%).\n\n";
                }
            } else {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, spo2: null } }));
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            addBotMsg(`${alertMsg}${isMinor ? `¿Cuál es la frecuencia cardíaca de ${pName}? (Ej: 75)` : "¿Cuál es su frecuencia cardíaca? (Ej: 75)"}`);
            setInternalStep('FC');
        }
        else if (internalStep === 'FC') {
            const val = parseInt(userMsg);
            if ((isNaN(val) || val < 30 || val > 250) && !lower.includes("na") && !lower.includes("no")) {
                addBotMsg(isMinor ? "Valor inválido (30-250 bpm). O di 'NO' o 'NA' si no tienes el dato." : "Valor inválido (30-250 bpm). O diga 'NO' o 'NA' si no tiene el dato.");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (!isNaN(val)) {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, hr: val } }));
                if (val > 100) {
                    newFlags.push("TAQUICARDIA");
                    alertMsg = "🚨 ALERTA: TAQUICARDIA (FC > 100).\n\n";
                }
            } else {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, hr: null } }));
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            addBotMsg(`${alertMsg}${isMinor ? `¿Cuál es la temperatura de ${pName}? (Ej: 36.5)` : "¿Cuál es su temperatura? (Ej: 36.5)"}`);
            setInternalStep('TEMP');
        }
        else if (internalStep === 'TEMP') {
            const val = parseFloat(userMsg);
            if ((isNaN(val) || val < 30 || val > 45) && !lower.includes("na") && !lower.includes("no")) {
                addBotMsg(isMinor ? "Valor inválido (30-45 °C). O di 'NO' o 'NA' si no tienes el dato." : "Valor inválido (30-45 °C). O diga 'NO' o 'NA' si no tiene el dato.");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (!isNaN(val)) {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, temperature: val } }));
                if (val > 37.5) {
                    newFlags.push("FIEBRE");
                    alertMsg = "🚨 ALERTA: FIEBRE (> 37.5°C).\n\n";
                }
            } else {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, temperature: null } }));
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            addBotMsg(`${alertMsg}${isMinor ? `¿Cuál es la frecuencia respiratoria de ${pName}? (Ej: 16)` : "¿Cuál es su frecuencia respiratoria? (Ej: 16)"}`);
            setInternalStep('FR');
        }
        else if (internalStep === 'FR') {
            const val = parseInt(userMsg);
            if ((isNaN(val) || val < 8 || val > 60) && !lower.includes("na") && !lower.includes("no")) {
                addBotMsg(isMinor ? "Valor inválido (8-60 rpm). O di 'NO' o 'NA' si no tienes el dato." : "Valor inválido (8-60 rpm). O diga 'NO' o 'NA' si no tiene el dato.");
                return;
            }

            let alertMsg = "";
            let newFlags = [];
            if (!isNaN(val)) {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, rr: val } }));
                if (val > 24) {
                    newFlags.push("TAQUIPNEA");
                    alertMsg = "🚨 ALERTA: TAQUIPNEA (> 24 rpm).\n\n";
                }
            } else {
                setBiometria((prev) => ({ ...prev, vitals: { ...prev.vitals, rr: null } }));
            }

            if (newFlags.length > 0) setClinicalFlags(prev => [...prev, ...newFlags]);
            addBotMsg(`${alertMsg}${isMinor ? `¿Conoces el nivel de glucosa capilar reciente de ${pName} o se lo tomaremos ahora? (Si aplica, ingresa en mg/dL. Si no, di 'No').` : "¿Conoce su nivel de glucosa capilar reciente o la tomaremos ahora? (Si aplica, ingrese en mg/dL. Si no, diga 'No')."}`);
            setInternalStep('GLUCOSE');
        }
        else if (internalStep === 'GLUCOSE') {
            const val = parseInt(userMsg);
            let alertMsg = "";
            let newFlags = [];

            if (!isNaN(val)) {
                if (val < 70) {
                    newFlags.push("HIPOGLUCEMIA");
                    alertMsg = "🚨 ALERTA: HIPOGLUCEMIA (< 70 mg/dL).\n\n";
                }
                else if (val > 250) {
                    newFlags.push("URGENCIA_HIPERGLUCEMIA");
                    alertMsg = "🚨 ALERTA ROJA: GLUCOSA CRÍTICA (>250 mg/dL). RIESGO DE CETOACIDOSIS. ACUDA A URGENCIAS.\n\n";
                }
                else if (val > 180) {
                    newFlags.push("HIPERGLUCEMIA");
                    alertMsg = "🚨 ALERTA: HIPERGLUCEMIA (> 180 mg/dL).\n\n";
                }
            }

            const glucosaVal = (isNaN(val)) ? null : val;

            const finalBio = {
                ...biometria,
                vitals: { ...biometria.vitals, glucose: glucosaVal }
            };
            setBiometria(finalBio);

            const finalFlags = [...clinicalFlags, ...newFlags];
            setClinicalFlags(finalFlags);

            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, ...finalBio.vitals },
                    clinical_flags: [...(prev.clinical_flags || []), ...finalFlags]
                }));
            }

            addBotMsg(`${alertMsg}📢 ${isMinor ? "Dile al paciente:\n\n'Perfecto, terminamos las mediciones. Regresemos al escritorio para unas últimas preguntas.'" : "Diga al paciente:\n\n'Perfecto, terminamos las mediciones. Regresemos al escritorio para unas últimas preguntas.'"}`);
            setInternalStep('FINALIZED');
            if (onPhaseComplete) onPhaseComplete('PHASE_13_SPECIAL_CONTEXT');
        }
    };

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => handleSend);
        }
    }, [registerInputHandler, internalStep, biometria, clinicalFlags]);

    return null; // Headless component
};

export default Fase12_Biometria;
