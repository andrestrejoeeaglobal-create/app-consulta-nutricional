import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { ShieldAlert, AlertTriangle, Check } from 'lucide-react';
import tiloImg from '../../assets/tilo.png';
import { evaluateVitalSignsSafety } from '../../ClinicalRules';

const parseBP = (text) => {
    let cleaned = text.trim();
    // Auto-fix "120 80" -> "120/80", "120-80" -> "120/80"
    if (cleaned.match(/^\d{2,3} \d{2,3}$/)) {
        cleaned = cleaned.replace(" ", "/");
    } else if (cleaned.match(/^\d{2,3}-\d{2,3}$/)) {
        cleaned = cleaned.replace("-", "/");
    } else if (cleaned.match(/^\d{5}$/)) {
        const sys3 = parseInt(cleaned.slice(0, 3), 10);
        const dia2 = parseInt(cleaned.slice(3), 10);
        if (sys3 >= 40 && sys3 <= 300 && dia2 >= 20 && dia2 <= 200) {
            cleaned = `${sys3}/${dia2}`;
        } else {
            const sys2 = parseInt(cleaned.slice(0, 2), 10);
            const dia3 = parseInt(cleaned.slice(2), 10);
            cleaned = `${sys2}/${dia3}`;
        }
    } else if (cleaned.match(/^\d{6}$/)) {
        cleaned = cleaned.slice(0, 3) + "/" + cleaned.slice(3);
    }
    const match = cleaned.match(/^(\d{2,3})\/(\d{2,3})$/);
    if (!match) return null;
    return {
        systolic: parseInt(match[1], 10),
        diastolic: parseInt(match[2], 10)
    };
};

const parseInteger = (text) => {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
};

const parseFloatVal = (text) => {
    const match = text.match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
};

export default function Fase17_SignosVitales({
    patientData,
    setPatientData,
    messages,
    setMessages,
    setIsGlobalTyping,
    registerInputHandler,
    onPhaseComplete
}) {
    const { pName, isMinor, patientSex, patientAge } = usePatientLinguistics(patientData);
    const updateVitalSigns = useClinicalGenome(state => state.updateVitalSigns);

    const [internalStep, setInternalStep] = useState('BP');
    
    // Local values cache
    const [systolic, setSystolic] = useState('');
    const [diastolic, setDiastolic] = useState('');
    const [heartRate, setHeartRate] = useState('');
    const [respiratoryRate, setRespiratoryRate] = useState('');
    const [temperature, setTemperature] = useState('');
    const [spo2, setSpo2] = useState('');
    const [glucose, setGlucose] = useState('');
    const [glucoseContext, setGlucoseContext] = useState('OMITTED');

    // Alert overlays state
    const [showCrisisOverlay, setShowCrisisOverlay] = useState(false);
    const [showHypoxiaOverlay, setShowHypoxiaOverlay] = useState(false);
    const [dismissedHypoxia, setDismissedHypoxia] = useState(false);

    // 🔒 Compuerta de Verificación en 2 Pasos para Presión Arterial Atípica
    const [showBpConfirmOverlay, setShowBpConfirmOverlay] = useState(false);
    const [pendingBp, setPendingBp] = useState(null);
    const [pendingBpConfirmed, setPendingBpConfirmed] = useState(false);

    // Rest countdown state (Anti-Bata Blanca)
    const [showRestCountdownOverlay, setShowRestCountdownOverlay] = useState(false);
    const [restCountdown, setRestCountdown] = useState(180);
    const [isRetakingHR, setIsRetakingHR] = useState(false);

    useEffect(() => {
        let timer = null;
        if (showRestCountdownOverlay && restCountdown > 0) {
            timer = setInterval(() => {
                setRestCountdown(prev => prev - 1);
            }, 1000);
        } else if (showRestCountdownOverlay && restCountdown === 0) {
            setShowRestCountdownOverlay(false);
            setIsRetakingHR(true);

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            if (patientAge < 13) target = 'Tutor';
            else if (patientAge >= 13 && patientAge < 18) target = 'Adolescente';

            const retryMsg = `<binary_gate_execution>\n` +
                `P1: El tiempo de reposo de 3 minutos ha concluido exitosamente.\n\n` +
                `P2: Por favor tome de nuevo su frecuencia cardíaca e ingrese la lectura de confirmación en LPM:\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: retryMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('HR');
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [showRestCountdownOverlay, restCountdown, patientSex, patientAge, setMessages]);

    // 🔒 MOUNT EFFECT: Emite el prompt inicial para Tensión Arterial al cargar la Fase 17
    const hasMountedRef = useRef(false);
    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
            const hasBpPrompt = lastMsg && (lastMsg.inputType === 'bp' || (lastMsg.content && (lastMsg.content.includes('brazalete de presión') || lastMsg.content.includes('Tensión Arterial'))));
            if (!hasBpPrompt) {
                const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
                let target = 'Adulto';
                let p2Text = `📢 Diga al paciente:\n\n'Por favor siéntate erguido, con la espalda apoyada. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 110/70):`;

                if (patientAge < 13) {
                    target = 'Tutor';
                    p2Text = `📢 Solicite al tutor:\n\n'Por favor mantenga a **${pName}** sentado y tranquilo mientras coloco el brazalete.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 100/65):`;
                } else if (patientAge >= 13 && patientAge < 18) {
                    target = 'Adolescente';
                    p2Text = `📢 Diga a **${pName}**:\n\n'Por favor siéntate erguido, con la espalda apoyada. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 110/70):`;
                }

                const initialBpMsg = `<binary_gate_execution>\n` +
                    `P1: Registro de Signos Vitales bajo norma **NOM-004-SSA3-2012**. Evaluación hemodinámica inicial.\n\n` +
                    `P2: ${p2Text}\n\n` +
                    `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                    `</binary_gate_execution>`;

                setMessages(prev => [...prev, { role: "assistant", content: initialBpMsg, avatar: tiloImg, inputType: 'bp' }]);
            }
        }
    }, [messages, patientSex, patientAge, pName, setMessages]);

    const handleBpRectify = () => {
        setShowBpConfirmOverlay(false);
        setPendingBp(null);
        setPendingBpConfirmed(false);
        setTimeout(() => {
            const inputEl = document.querySelector('input[type="text"]') || document.querySelector('input');
            if (inputEl) {
                inputEl.focus();
                inputEl.select();
            }
        }, 50);
    };

    const handleBpConfirm = () => {
        setShowBpConfirmOverlay(false);
        if (pendingBp) {
            setPendingBpConfirmed(true);
            processValidBp(pendingBp);
        }
    };

    const processValidBp = async (bp) => {
        setSystolic(bp.systolic);
        setDiastolic(bp.diastolic);

        const alertLevel = (bp.systolic > 180 || bp.diastolic > 120 || bp.systolic < 70 || bp.diastolic < 40) ? 'CRISIS' : (bp.systolic > 140 || bp.diastolic > 90 ? 'ELEVATED' : 'NORMAL');
        
        if (setPatientData) {
            setPatientData(prev => ({
                ...prev,
                vitals: {
                    ...(prev.vitals || {}),
                    blood_pressure: {
                        systolic: bp.systolic,
                        diastolic: bp.diastolic,
                        alert_level: alertLevel
                    }
                },
                clinical_flags: alertLevel === 'CRISIS' 
                    ? [...new Set([...(prev.clinical_flags || []), 'ALERTA_ROJA_BP', 'CRISIS_BP_CONFIRMED'])]
                    : prev.clinical_flags
            }));
        }

        updateVitalSigns({
            bloodPressure: { systolic: bp.systolic, diastolic: bp.diastolic }
        });

        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
        let target = 'Adulto';
        let p2Text = `📢 Diga al paciente:\n\n'Permanezca quieto y en silencio mientras tomo su pulso.'\n\n(Mida el pulso y registre la Frecuencia Cardíaca en LPM, ej. 75):`;

        if (patientAge < 13) {
            target = 'Tutor';
            p2Text = `📢 Solicite al tutor:\n\n'Por favor mantenga a **${pName}** quieto y en silencio mientras tomo su pulso.'\n\n(Mida el pulso y registre la Frecuencia Cardíaca en LPM, ej. 85):`;
        } else if (patientAge >= 13 && patientAge < 18) {
            target = 'Adolescente';
            p2Text = `📢 Diga a **${pName}**:\n\n'Permanece quieto y en silencio mientras tomo tu pulso.'\n\n(Mida el pulso y registre la Frecuencia Cardíaca en LPM, ej. 75):`;
        }

        let alertNotice = '';
        if (alertLevel === 'CRISIS') {
            alertNotice = `🚨 **ATENCIÓN CLÍNICA**: Presión arterial de **${bp.systolic}/${bp.diastolic} mmHg** confirmada y asentada en el expediente con Alerta Roja. El estudio continúa para registrar los signos vitales complementarios.\n\n`;
        }

        const nextMsg = `<binary_gate_execution>\n` +
            `P1: ${alertNotice}Frecuencia cardíaca como indicador de perfusión tisular y gasto cardíaco.\n\n` +
            `P2: ${p2Text}\n\n` +
            `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
            `</binary_gate_execution>`;

        setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
        setInternalStep('HR');
        setIsGlobalTyping(false);
        setPendingBpConfirmed(false);
        setPendingBp(null);
    };

    const showSummary = (v) => {
        let bpText = `${v.sys}/${v.dia} mmHg`;
        let hrText = `${v.hr} LPM`;
        let rrText = `${v.rr} RPM`;
        let tempText = `${v.temp} °C`;
        let spo2Text = `${v.ox} %`;
        let glucText = !isNaN(v.gl) ? `${v.gl} mg/dL (${v.glCtx === 'FASTING' ? 'Ayuno' : 'Casual'})` : 'No registrada';

        const summaryMsg = `<binary_gate_execution>\n` +
            `P1: Verifique los Signos Vitales registrados para cerrar este bloque en cumplimiento con la **NOM-004**:\n\n` +
            `- 💓 **Tensión Arterial**: ${bpText}\n` +
            `- 🫀 **Frecuencia Cardíaca**: ${hrText}\n` +
            `- 🫁 **Frecuencia Respiratoria**: ${rrText}\n` +
            `- 🌡️ **Temperatura**: ${tempText}\n` +
            `- 🩸 **Saturación SpO2**: ${spo2Text}\n` +
            `- 🍭 **Glucosa Capilar**: ${glucText}\n\n` +
            `P2: ¿Es correcta y verídica toda esta información?\n\n` +
            `<!-- meta user_target: Adulto gender_lock: M triage_mode: Inactivo -->\n` +
            `</binary_gate_execution>`;

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: summaryMsg,
            avatar: tiloImg,
            inputType: 'strict_select',
            options: [
                { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                { label: "❌ No, quiero corregir", value: "CORRECT_DATA" }
            ]
        }]);
        setInternalStep('REVIEW_SUMMARY');
    };

    const handleEmergencyStop = () => {
        const sysVal = systolic;
        const diaVal = diastolic;
        const newFlags = ['URGENCIA_HIPERTENSIVA', 'CRISIS_BLOCKED'];
        const finalVitals = {
            ...patientData.vitals,
            status: 'CRISIS_BLOCKED',
            blood_pressure: {
                systolic: sysVal,
                diastolic: diaVal,
                alert_level: 'CRISIS'
            }
        };

        setPatientData(prev => ({
            ...prev,
            vitals: finalVitals,
            clinical_flags: [...new Set([...(prev.clinical_flags || []), ...newFlags])]
        }));

        updateVitalSigns({
            bloodPressure: { systolic: sysVal, diastolic: diaVal }
        });

        const alertMsg = `<binary_gate_execution>\n` +
            `P1: **PARADA DE EMERGENCIA INVOCADA**. Presión arterial crítica de **${systolic}/${diastolic} mmHg** detectada. Se activa bloqueo de seguridad y derivación médica.\n\n` +
            `P2: El médico ha sellado el expediente en estado de crisis. Se cancela la consulta clínica nutricional y se activa el protocolo de urgencias.\n\n` +
            `<!-- meta user_target: Adulto gender_lock: M triage_mode: Activo -->\n` +
            `</binary_gate_execution>`;

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: alertMsg
        }]);

        setShowCrisisOverlay(false);
        if (onPhaseComplete) {
            onPhaseComplete('PHASE_19_DIAGNOSIS');
        }
    };

    async function handleSend(userMsg) {
        const isInternalOption = ['FASTING', 'CASUAL', 'CONFIRM_DATA', 'CORRECT_DATA'].includes(userMsg);
        if (!isInternalOption) {
            setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        }
        const addBotMsg = (msg, inputType = 'number') => setMessages(prev => [...prev, { role: "assistant", content: msg, avatar: tiloImg, inputType }]);

        if (internalStep === 'BP') {
            const bp = parseBP(userMsg);
            if (!bp) {
                addBotMsg("⚠️ Formato de presión arterial no reconocido. Por favor ingrese la lectura como Sistólica/Diastólica en mmHg (ej: 120/80):", 'bp');
                return;
            }

            // 🔒 NIVEL 1: Errores Físicamente Imposibles (Reject & Re-focus inmediato)
            if (bp.systolic < 40 || bp.systolic > 300 || bp.diastolic < 20 || bp.diastolic > 200) {
                addBotMsg(`⚠️ La presión arterial ingresada (${bp.systolic}/${bp.diastolic} mmHg) se encuentra fuera de los límites fisiológicos válidos (Sistólica 40-300 / Diastólica 20-200 mmHg). Por favor verifique la medición e ingrese el valor en formato Sistólica/Diastólica (ej: 120/80):`, 'bp');
                setTimeout(() => {
                    const inputEl = document.querySelector('input[type="text"]') || document.querySelector('input');
                    if (inputEl) {
                        inputEl.focus();
                        inputEl.select();
                    }
                }, 50);
                return;
            }

            // 🔒 NIVEL 2: Rango Crítico Fisiológico Plausible (Compuerta de Verificación en 2 Pasos)
            const isPlausibleCritical = (bp.systolic > 180 || bp.diastolic > 120 || bp.systolic < 70 || bp.diastolic < 40);

            if (isPlausibleCritical && !pendingBpConfirmed) {
                setPendingBp(bp);
                setShowBpConfirmOverlay(true);
                return;
            }

            await processValidBp(bp);
        }
        else if (internalStep === 'HR') {
            const val = parseInteger(userMsg);
            if (!val || val < 30 || val > 250) {
                addBotMsg("⚠️ Frecuencia Cardíaca inusual. Verifique el valor en LPM (30-250) e ingréselo nuevamente:");
                return;
            }

            setHeartRate(val);

            if (val > 100 && !isRetakingHR) {
                setRestCountdown(180);
                setShowRestCountdownOverlay(true);
                return;
            }

            const safety = evaluateVitalSignsSafety({
                bloodPressure: { systolic, diastolic },
                heartRate: val,
                allergies: patientData?.history?.allergies?.food || [],
                medications: patientData?.history?.medications || [],
                age: patientAge
            });

            if (safety.alertLevel === 'CRITICAL') {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `⚠️ **ALERTA HEMODINÁMICA**: ${safety.reason}`,
                    avatar: tiloImg
                }]);
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Inhale y exhale normalmente por favor.'\n\n(Mida la Frecuencia Respiratoria en RPM, ej. 16):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Observe la respiración de **${pName}** en reposo.'\n\n(Mida la Frecuencia Respiratoria en RPM, ej. 20):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Respira de forma natural por favor.'\n\n(Mida la Frecuencia Respiratoria en RPM, ej. 16):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Frecuencia respiratoria para evaluar ventilación pulmonar y equilibrio ácido-base.\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('RR');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'RR') {
            const val = parseInteger(userMsg);
            if (!val || val < 8 || val > 60) {
                addBotMsg("⚠️ Frecuencia Respiratoria inusual. Verifique el valor en RPM (8-60) e ingréselo nuevamente:");
                return;
            }

            setRespiratoryRate(val);

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Colocaré el termómetro. Permanezca inmóvil por un momento.'\n\n(Ingrese la Temperatura Corporal en °C, ej. 36.5):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Sostenga a **${pName}** mientras coloco el termómetro.'\n\n(Ingrese la Temperatura Corporal en °C, ej. 36.8):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Un momento para tomar tu temperatura corporal.'\n\n(Ingrese la Temperatura Corporal en °C, ej. 36.5):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Temperatura corporal para descartar procesos infecciosos o metabólicos agudos.\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('TEMP');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'TEMP') {
            const val = parseFloatVal(userMsg);
            if (!val || val < 30.0 || val > 45.0) {
                addBotMsg("⚠️ Temperatura inusual. Verifique el valor en °C (30.0-45.0) e ingréselo nuevamente:");
                return;
            }

            setTemperature(val);

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Colocaré el oxímetro en su dedo. Mantenga la mano quieta.'\n\n(Ingrese la Saturación SpO2 en %, ej. 98):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Ayude a **${pName}** a mantener la mano quieta para colocar el oxímetro.'\n\n(Ingrese la Saturación SpO2 en %, ej. 98):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Mantén tu mano quieta mientras coloco el oxímetro.'\n\n(Ingrese la Saturación SpO2 en %, ej. 98):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Saturación de oxígeno (SpO2) como biomarcador de oxigenación periférica.\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('SPO2');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'SPO2') {
            const val = parseInteger(userMsg);
            if (!val || val < 50 || val > 100) {
                addBotMsg("⚠️ Saturación SpO2 inusual. Verifique el valor en % (50-100) e ingréselo nuevamente:");
                return;
            }

            setSpo2(val);

            if (val < 90 && !dismissedHypoxia) {
                setShowHypoxiaOverlay(true);
                return;
            }

            advanceToGlucoseStep(val);
        }
        else if (internalStep === 'GLUCOSE_VAL') {
            if (userMsg === 'OMIT') {
                setGlucose('OMITTED');
                setGlucoseContext('OMITTED');
                showSummary({
                    sys: systolic,
                    dia: diastolic,
                    hr: heartRate,
                    rr: respiratoryRate,
                    temp: temperature,
                    ox: spo2,
                    gl: NaN,
                    glCtx: 'OMITTED'
                });
                return;
            }

            const val = parseInteger(userMsg);
            if (!val || val < 20 || val > 600) {
                addBotMsg("⚠️ Glucosa capilar inusual. Verifique el valor en mg/dL (20-600) o seleccione Omitir:");
                return;
            }

            setGlucose(val);

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            if (patientAge < 13) target = 'Tutor';
            else if (patientAge >= 13 && patientAge < 18) target = 'Adolescente';

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Contexto de toma de glucosa capilar.\n\n` +
                `P2: Indique la condición de toma de glucosa:\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, {
                role: "assistant",
                content: nextMsg,
                avatar: tiloImg,
                inputType: 'strict_select',
                options: [
                    { label: "🌅 Ayuno (> 8 hrs)", value: "FASTING" },
                    { label: "🥪 Casual / Postprandial", value: "CASUAL" }
                ]
            }]);
            setInternalStep('GLUCOSE_CTX');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'GLUCOSE_CTX') {
            const ctx = userMsg === 'FASTING' ? 'FASTING' : 'CASUAL';
            setGlucoseContext(ctx);
            showSummary({
                sys: systolic,
                dia: diastolic,
                hr: heartRate,
                rr: respiratoryRate,
                temp: temperature,
                ox: spo2,
                gl: glucose,
                glCtx: ctx
            });
        }
        else if (internalStep === 'REVIEW_SUMMARY') {
            if (userMsg === 'CONFIRM_DATA') {
                const finalVitals = {
                    ...patientData.vitals,
                    blood_pressure: {
                        systolic: parseInt(systolic, 10),
                        diastolic: parseInt(diastolic, 10),
                        alert_level: (systolic > 180 || diastolic > 120 || systolic < 70 || diastolic < 40) ? 'CRISIS' : (systolic > 140 || diastolic > 90 ? 'ELEVATED' : 'NORMAL')
                    },
                    heart_rate: parseInt(heartRate, 10),
                    respiratory_rate: parseInt(respiratoryRate, 10),
                    temperature: parseFloat(temperature),
                    spo2: parseInt(spo2, 10),
                    glucose: !isNaN(glucose) ? parseInt(glucose, 10) : null,
                    glucose_context: glucoseContext
                };

                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        vitals: finalVitals
                    }));
                }

                updateVitalSigns({
                    bloodPressure: { systolic: parseInt(systolic, 10), diastolic: parseInt(diastolic, 10) },
                    heartRate: parseInt(heartRate, 10),
                    respiratoryRate: parseInt(respiratoryRate, 10),
                    temperature: parseFloat(temperature),
                    spo2: parseInt(spo2, 10),
                    glucose: !isNaN(glucose) ? parseInt(glucose, 10) : null,
                    glucoseContext: glucoseContext
                });

                if (onPhaseComplete) {
                    onPhaseComplete('PHASE_18_ELECTRET');
                }
            } else if (userMsg === 'CORRECT_DATA') {
                const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
                let target = 'Adulto';
                let p2Text = `📢 Diga al paciente:\n\n'Por favor siéntate erguido, con la espalda apoyada. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 110/70):`;

                if (patientAge < 13) {
                    target = 'Tutor';
                    p2Text = `📢 Solicite al tutor:\n\n'Por favor mantenga a **${pName}** sentado y tranquilo mientras coloco el brazalete.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 100/65):`;
                } else if (patientAge >= 13 && patientAge < 18) {
                    target = 'Adolescente';
                    p2Text = `📢 Diga a **${pName}**:\n\n'Por favor siéntate erguido, con la espalda apoyada. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 110/70):`;
                }

                const nextMsg = `<binary_gate_execution>\n` +
                    `P1: Reiniciando el registro de Signos Vitales. Asegure la correcta calibración de los dispositivos.\n\n` +
                    `P2: ${p2Text}\n\n` +
                    `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                    `</binary_gate_execution>`;

                setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'bp' }]);
                setInternalStep('BP');
            }
        }
    }

    const advanceToGlucoseStep = (oxVal) => {
        setIsGlobalTyping(true);
        setTimeout(() => {
            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Realizaré una punción capilar rápida en la yema del dedo.'\n\n(Ingrese la Glucosa Capilar en mg/dL o seleccione 'Omitir'):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Sostenga la mano de **${pName}** para tomar la muestra de glucosa.'\n\n(Ingrese la Glucosa Capilar en mg/dL o seleccione 'Omitir'):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Una pequeña punción en el dedo para tomar tu glucosa.'\n\n(Ingrese la Glucosa Capilar en mg/dL o seleccione 'Omitir'):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Glucosa capilar como biomarcador de la homeostasis glucídica.\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, {
                role: "assistant",
                content: nextMsg,
                avatar: tiloImg,
                inputType: 'number',
                options: [{ label: "⏩ Omitir medición de glucosa", value: "OMIT" }]
            }]);
            setInternalStep('GLUCOSE_VAL');
            setIsGlobalTyping(false);
        }, 800);
    };

    const handleSendRef = useRef(handleSend);
    useEffect(() => {
        handleSendRef.current = handleSend;
    });

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, label) => handleSendRef.current(text, label));
        }
        return () => {
            if (registerInputHandler) {
                registerInputHandler(null);
            }
        };
    }, [registerInputHandler]);

    // 🔒 COMPUERTA DE VERIFICACIÓN EN 2 PASOS (Presión Arterial Atípica / Soft Warning)
    if (showBpConfirmOverlay && pendingBp) {
        return (
            <div className="fixed inset-0 bg-slate-900/90 z-[9999] flex items-center justify-center p-6 text-center animate-in fade-in duration-200 font-sans">
                <div className="bg-white border border-amber-500/40 rounded-3xl p-6 max-w-md shadow-2xl flex flex-col items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                        <AlertTriangle className="w-7 h-7" />
                    </div>

                    <h3 className="text-base font-extrabold text-amber-700 uppercase tracking-wide">
                        Verificación de Signo Vital Fuera de Rango
                    </h3>

                    <p className="text-xs text-slate-700 leading-relaxed">
                        Se ingresó una presión arterial de <strong className="text-amber-800 text-sm font-extrabold">{pendingBp.systolic}/{pendingBp.diastolic} mmHg</strong>, la cual se encuentra fuera de los rangos fisiológicos habituales.
                    </p>

                    <div className="w-full bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 text-left text-xs text-amber-900 leading-relaxed">
                        <strong>💡 Nota de Usabilidad Médica:</strong> Si cometió un error tipográfico al ingresar los dígitos, presione <strong>"Corregir Valor"</strong> para reescribir la cifra. Si la cifra es verídica, presione <strong>"Confirmar: El Valor es Real"</strong>.
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full mt-1">
                        <button
                            type="button"
                            onClick={handleBpRectify}
                            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl border border-slate-300 text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <span>✏️</span>
                            <span>Corregir Valor</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleBpConfirm}
                            className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <span>⚠️</span>
                            <span>Confirmar: El Valor es Real</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // RENDER EMERGENCIES ONLY (Otherwise Headless)
    if (showCrisisOverlay) {
        return (
            <div className="fixed inset-0 bg-red-950/95 z-[9999] flex items-center justify-center p-6 text-center animate-[pulse_3s_infinite]">
                <div className="bg-white border border-red-500/40 rounded-3xl p-8 max-w-md shadow-2xl flex flex-col items-center gap-6">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 border border-red-200">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    
                    <h2 className="text-xl font-extrabold text-red-600 uppercase tracking-wide">
                        Parada de Emergencia Activa (NOM-004)
                    </h2>
                    
                    <p className="text-sm text-slate-700 leading-relaxed">
                        Se ha registrado una Tensión Arterial de <strong className="text-red-600 text-base">{systolic}/{diastolic} mmHg</strong>.
                    </p>
                    
                    <p className="text-xs text-slate-500 leading-relaxed">
                        De acuerdo con los criterios legales de la **NOM-004-SSA3-2012**, las cifras hemodinámicas actuales representan una crisis hipertensiva crítica. La consulta queda bloqueada permanentemente.
                    </p>

                    <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 text-left">
                        <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider block mb-1">Directiva Clínica</span>
                        <span className="text-xs font-semibold text-slate-700 block">
                            • Suspenda toda actividad física y plan dietético.<br />
                            • Remita al paciente de urgencia al hospital más cercano.
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleEmergencyStop}
                        className="w-full py-3.5 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-950/30 hover:opacity-90 active:scale-95 transition-all text-sm uppercase tracking-wide cursor-pointer"
                    >
                        Sellar Parada de Emergencia (NOM-004)
                    </button>
                </div>
            </div>
        );
    }

    if (showHypoxiaOverlay) {
        return (
            <div className="fixed inset-0 bg-slate-900/90 z-[9999] flex items-center justify-center p-6 text-center">
                <div className="bg-white border border-red-500/30 rounded-3xl p-6 max-w-sm shadow-xl flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-base font-bold text-red-600 uppercase tracking-wide">
                        Alerta de Hipoxia Severa
                    </h3>
                    
                    <p className="text-xs text-slate-700 leading-relaxed">
                        Saturación de Oxígeno (SpO2) registrada: <strong className="text-red-600">{spo2}%</strong>.
                    </p>
                    
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Cifras menores a 90% representan un riesgo respiratorio. Verifique la colocación del oxímetro, pida al paciente respirar profundo y evalúe signos clínicos secundarios.
                    </p>

                    <div className="flex flex-col gap-2 w-full mt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setDismissedHypoxia(true);
                                setShowHypoxiaOverlay(false);
                                advanceToGlucoseStep(spo2);
                            }}
                            className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                            Entendido, proceder con precaución
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSpo2('');
                                setShowHypoxiaOverlay(false);
                                setDismissedHypoxia(false);
                                promptForSpo2Again();
                            }}
                            className="w-full py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
                        >
                            Recalibrar sensor / Corregir dato
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (showRestCountdownOverlay) {
        const minutes = Math.floor(restCountdown / 60);
        const seconds = restCountdown % 60;
        const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

        return (
            <div className="fixed inset-0 bg-slate-900/90 z-[9999] flex items-center justify-center p-6 text-center">
                <div className="bg-white border border-amber-500/30 rounded-3xl p-6 max-w-sm shadow-xl flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100 animate-pulse">
                        <span className="text-2xl font-bold font-mono">⏱️</span>
                    </div>
                    
                    <h3 className="text-base font-bold text-amber-600 uppercase tracking-wide">
                        Protocolo de Reposo (Anti-Bata Blanca)
                    </h3>
                    
                    <p className="text-xs text-slate-600 leading-relaxed">
                        T.I.L.O. ha detectado una variación basal en su frecuencia cardíaca (<strong>{heartRate} LPM</strong>).
                    </p>
                    
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Por favor, permanezca sentado, en reposo y con los brazos apoyados durante el tiempo de reposo para realizar la lectura de confirmación.
                    </p>

                    <div className="my-2 py-3 px-6 bg-slate-900 text-amber-400 rounded-2xl border border-slate-800 shadow-inner">
                        <span className="text-3xl font-bold font-mono tracking-widest">{formattedTime}</span>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Tiempo de Reposo Restante</div>
                    </div>

                    <p className="text-[10px] text-slate-400 italic">
                        El sistema solicitará su nueva lectura automáticamente al finalizar el conteo.
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
