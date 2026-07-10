import React, { useState, useEffect, useRef } from 'react';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { ShieldAlert, AlertTriangle, Check } from 'lucide-react';
import tiloImg from '../../assets/tilo.png';

const parseBP = (text) => {
    let cleaned = text.trim();
    // Auto-fix "120 80" -> "120/80"
    if (cleaned.match(/^\d{2,3} \d{2,3}$/)) {
        cleaned = cleaned.replace(" ", "/");
    } else if (cleaned.match(/^\d{2,3}-\d{2,3}$/)) {
        cleaned = cleaned.replace("-", "/");
    } else if (cleaned.match(/^\d{5,6}$/)) {
        const mid = cleaned.length === 5 ? 3 : 3;
        cleaned = cleaned.slice(0, mid) + "/" + cleaned.slice(mid);
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

    const hasGreeted = useRef(false);

    // Auto-transition on mount if already completed (resilience against page reloads/crashes)
    useEffect(() => {
        const alreadyCompleted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Signos Vitales registrados y sellados con éxito"));
        if (alreadyCompleted) {
            if (onPhaseComplete) onPhaseComplete('PHASE_18_ELECTRET');
        }
    }, [messages, onPhaseComplete]);

    // Initial greeting
    useEffect(() => {
        if (hasGreeted.current) return;

        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("procederemos a tomar y registrar sus Signos Vitales"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p1Text = `He registrado y sellado sus mediciones biométricas de manera exitosa para la calibración de su expediente clínico bajo la **NOM-004-SSA3-2012**. Ahora procederemos a tomar y registrar sus Signos Vitales.`;
            let p2Text = `📢 Diga al paciente:\n\n'Por favor siéntese erguido, con la espalda apoyada y los pies planos sobre el suelo. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 120/80):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p1Text = `He registrado y sellado las mediciones biométricas de **${pName}** de manera exitosa para la calibración de su expediente clínico bajo la **NOM-004-SSA3-2012**. Ahora procederemos a tomar y registrar los Signos Vitales de **${pName}**.`;
                p2Text = `📢 Solicite al tutor:\n\n'Por favor siente a **${pName}** erguido, con la espalda apoyada. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial de **${pName}** y regístrela como Sistólica/Diastólica en mmHg, ej. 100/60):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p1Text = `He registrado y sellado sus mediciones biométricas de manera exitosa para la calibración de su expediente clínico bajo la **NOM-004-SSA3-2012**. Ahora procederemos a tomar y registrar sus Signos Vitales.`;
                p2Text = `📢 Diga a **${pName}**:\n\n'Por favor siéntate erguido, con la espalda apoyada. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 110/70):`;
            }

            const initialMsg = `<binary_gate_execution>\n` +
                `P1: ${p1Text}\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [
                ...prev,
                {
                    role: "assistant",
                    content: initialMsg,
                    avatar: tiloImg,
                    inputType: 'bp'
                }
            ]);
            setInternalStep('BP');
        }
    }, [messages, pName, patientSex, patientAge, setMessages]);

    const advanceToGlucoseStep = async (oxVal) => {
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
        let target = 'Adulto';
        let p2Text = `📢 Pregunte al paciente:\n\n'¿Conoce su nivel de glucosa capilar reciente o la tomaremos en este momento?'\n\n(Tome la muestra si aplica y registre la glucosa en mg/dL, o diga 'Omitir'):`;

        if (patientAge < 13) {
            target = 'Tutor';
            p2Text = `📢 Pregunte al tutor:\n\n'¿Cuenta **${pName}** con un registro de glucosa capilar reciente o la tomaremos en este momento?'\n\n(Tome la muestra si aplica y registre la glucosa de **${pName}** en mg/dL, o diga 'Omitir'):`;
        } else if (patientAge >= 13 && patientAge < 18) {
            target = 'Adolescente';
            p2Text = `📢 Pregunte a **${pName}**:\n\n'¿Cuentas con un registro de glucosa capilar reciente o la tomaremos ahora?'\n\n(Tome la muestra si aplica y registre la glucosa en mg/dL, o diga 'Omitir'):`;
        }

        const nextMsg = `<binary_gate_execution>\n` +
            `P1: Registro del biomarcador de glucosa capilar para la evaluación del metabolismo de carbohidratos.\n\n` +
            `P2: ${p2Text}\n\n` +
            `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
            `</binary_gate_execution>`;

        setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'text' }]);
        setInternalStep('GLUCOSE');
        setIsGlobalTyping(false);
    };

    const promptForSpo2Again = () => {
        const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
        let target = 'Adulto';
        let p2Text = `📢 Diga al paciente:\n\n'Colocaré el oxímetro de nuevo. Respire profundo por favor.'\n\n(Ingrese la Saturación SpO2 en %, ej. 98):`;
        if (patientAge < 13) {
            target = 'Tutor';
            p2Text = `📢 Solicite al tutor:\n\n'Por favor solicite que **${pName}** respire profundo. Colocaré el oxímetro de nuevo.'\n\n(Ingrese la Saturación SpO2 de **${pName}** en %, ej. 98):`;
        } else if (patientAge >= 13 && patientAge < 18) {
            target = 'Adolescente';
            p2Text = `📢 Diga a **${pName}**:\n\n'Respira profundo por favor. Colocaré el oxímetro de nuevo.'\n\n(Ingrese la Saturación SpO2 en %, ej. 98):`;
        }
        const nextMsg = `<binary_gate_execution>\n` +
            `P1: Recalibración del sensor de saturación de oxígeno.\n\n` +
            `P2: ${p2Text}\n\n` +
            `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
            `</binary_gate_execution>`;
        setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
        setInternalStep('SPO2');
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

        // Update local State
        setPatientData(prev => ({
            ...prev,
            vitals: finalVitals,
            clinical_flags: [...new Set([...(prev.clinical_flags || []), ...newFlags])]
        }));

        // Update Zustand Global State
        updateVitalSigns({
            bloodPressure: { systolic: sysVal, diastolic: diaVal },
            heartRate: null,
            respiratoryRate: null,
            temperature: null,
            spo2: null,
            glucose: null,
            glucoseContext: null
        });

        // Add audit trail message
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
        const lower = userMsg.toLowerCase();
        const addBotMsg = (msg, inputType = 'number') => setMessages(prev => [...prev, { role: "assistant", content: msg, avatar: tiloImg, inputType }]);

        if (internalStep === 'BP') {
            const bp = parseBP(userMsg);
            if (!bp || bp.systolic < 50 || bp.systolic > 250 || bp.diastolic < 30 || bp.diastolic > 150) {
                addBotMsg("⚠️ Presión arterial inusual o formato incorrecto. Por favor ingrese un valor válido como Sistólica/Diastólica (ej: 120/80):", 'bp');
                return;
            }

            setSystolic(bp.systolic);
            setDiastolic(bp.diastolic);

            // Real-time synchronization
            const alertLevel = bp.systolic > 180 || bp.diastolic > 120 ? 'CRISIS' : (bp.systolic > 140 || bp.diastolic > 90 ? 'ELEVATED' : 'NORMAL');
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
                    }
                }));
            }

            if (bp.systolic > 180 || bp.diastolic > 120) {
                setShowCrisisOverlay(true);
                return;
            }

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

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Frecuencia cardíaca como indicador de perfusión tisular y gasto cardíaco.\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('HR');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'HR') {
            const val = parseInteger(userMsg);
            if (!val || val < 30 || val > 250) {
                addBotMsg("⚠️ Frecuencia Cardíaca inusual. Verifique el valor en LPM (30-250) e ingréselo nuevamente:");
                return;
            }

            setHeartRate(val);

            // Real-time synchronization
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    vitals: {
                        ...(prev.vitals || {}),
                        heart_rate: val
                    }
                }));
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Respire de forma natural.'\n\n(Observe discretamente los movimientos de tórax durante 30s. Si lo desea, puede utilizar el temporizador de la derecha o registrar directamente la Frecuencia Respiratoria en RPM, ej. 16):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Por favor mantenga a **${pName}** respirando de forma natural.'\n\n(Observe discretamente los movimientos de tórax durante 30s. Registre la Frecuencia Respiratoria de **${pName}** en RPM, ej. 20):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Respira de forma natural.'\n\n(Observe discretamente los movimientos de tórax durante 30s. Registre la Frecuencia Respiratoria en RPM, ej. 16):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Frecuencia respiratoria para la evaluación de ventilación pulmonar y patrón respiratorio.\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'respiratory_timer' }]);
            setInternalStep('RR');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'RR') {
            const val = parseInteger(userMsg);
            if (!val || val < 8 || val > 60) {
                addBotMsg("⚠️ Frecuencia Respiratoria inusual. Verifique el valor en RPM (8-60) e ingréselo nuevamente:", 'respiratory_timer');
                return;
            }

            setRespiratoryRate(val);

            // Real-time synchronization
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    vitals: {
                        ...(prev.vitals || {}),
                        respiratory_rate: val
                    }
                }));
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Colocaré el termómetro en su axila.'\n\n(Mida y registre la temperatura en °C, ej. 36.5):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Colocaré el termómetro en la axila de **${pName}**.'\n\n(Mida y registre la temperatura de **${pName}** en °C, ej. 36.5):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Colocaré el termómetro en tu axila.'\n\n(Mida y registre la temperatura en °C, ej. 36.5):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Temperatura corporal para la detección de procesos febriles o alteraciones térmicas.\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('TEMP');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'TEMP') {
            const val = parseFloatVal(userMsg);
            if (!val || val < 30 || val > 45) {
                addBotMsg("⚠️ Temperatura inusual. Verifique el valor en °C (30-45) e ingréselo nuevamente:");
                return;
            }

            setTemperature(val);

            // Real-time synchronization
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    vitals: {
                        ...(prev.vitals || {}),
                        temperature: val
                    }
                }));
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Colocaré el oxímetro en su dedo índice para verificar la saturación de oxígeno.'\n\n(Ingrese la Saturación SpO2 en %, ej. 98):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Colocaré el oxímetro en el dedo de **${pName}**.'\n\n(Ingrese la Saturación SpO2 de **${pName}** en %, ej. 98):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Colócate el oxímetro en tu dedo para verificar la saturación.'\n\n(Ingrese la Saturación SpO2 en %, ej. 98):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Saturación de oxígeno capilar (SpO2) para monitorizar el estado de oxigenación arterial.\n\n` +
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
                addBotMsg("⚠️ Saturación inusual. Verifique el valor en % (50-100) e ingréselo nuevamente:");
                return;
            }

            setSpo2(val);

            // Real-time synchronization
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    vitals: {
                        ...(prev.vitals || {}),
                        spo2: val
                    }
                }));
            }

            if (val < 90 && !dismissedHypoxia) {
                setShowHypoxiaOverlay(true);
                return;
            }

            await advanceToGlucoseStep(val);
        }
        else if (internalStep === 'GLUCOSE') {
            if (lower.includes("omitir") || lower.includes("no") || lower.includes("na") || lower.includes("ninguno")) {
                setGlucose('OMITTED');
                setGlucoseContext('OMITTED');

                // Real-time synchronization
                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        biochemical: {
                            ...prev.biochemical,
                            glucose: null
                        }
                    }));
                }

                setIsGlobalTyping(true);
                await new Promise(resolve => setTimeout(resolve, 800));

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
                setIsGlobalTyping(false);
            } else {
                const val = parseInteger(userMsg);
                if (!val || val < 20 || val > 600) {
                    addBotMsg("⚠️ Glucosa inusual. Verifique el valor en mg/dL (20-600) o diga 'Omitir':", 'text');
                    return;
                }

                setGlucose(val);

                // Real-time synchronization
                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        biochemical: {
                            ...prev.biochemical,
                            glucose: {
                                value: val,
                                context: null
                            }
                        }
                    }));
                }

                setIsGlobalTyping(true);
                await new Promise(resolve => setTimeout(resolve, 800));

                const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
                let target = 'Adulto';
                if (patientAge < 13) target = 'Tutor';
                else if (patientAge >= 13 && patientAge < 18) target = 'Adolescente';

                const nextMsg = `<binary_gate_execution>\n` +
                    `P1: Contexto metabólico de la toma de glucosa.\n\n` +
                    `P2: Por favor declare si la medición fue en **Ayuno** o de manera **Casual**:\n\n` +
                    `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                    `</binary_gate_execution>`;

                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: nextMsg,
                    avatar: tiloImg,
                    options: [
                        { label: "Ayuno", value: "FASTING" },
                        { label: "Casual", value: "CASUAL" }
                    ]
                }]);
                setInternalStep('GLUCOSE_CONTEXT');
                setIsGlobalTyping(false);
            }
        }
        else if (internalStep === 'GLUCOSE_CONTEXT') {
            let ctx = 'CASUAL';
            if (lower.includes("fasting") || lower.includes("ayuno")) {
                ctx = 'FASTING';
            }

            setGlucoseContext(ctx);

            // Real-time synchronization
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    biochemical: {
                        ...prev.biochemical,
                        glucose: {
                            value: glucose,
                            context: ctx
                        }
                    }
                }));
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

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
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'REVIEW_SUMMARY') {
            if (userMsg === "CONFIRM_DATA") {
                const sys = systolic;
                const dia = diastolic;
                const hr = heartRate;
                const rr = respiratoryRate;
                const temp = temperature;
                const ox = spo2;
                const gl = glucose === 'OMITTED' ? NaN : parseInt(glucose);
                const glucoseCtx = glucoseContext === 'OMITTED' ? null : glucoseContext;

                // Calculate Flags
                const newFlags = [];
                if (sys > 140 || dia > 90) newFlags.push('URGENCIA_HIPERTENSIVA');
                if (hr < 50) {
                    newFlags.push('BRADICARDIA');
                    newFlags.push('BRADYCARDIA');
                }
                if (hr > 100) {
                    newFlags.push('TAQUICARDIA');
                    newFlags.push('TACHYCARDIA');
                }
                if (rr > 20) {
                    newFlags.push('TAQUIPNEA');
                    newFlags.push('HYPERVENTILATION');
                }
                if (temp > 37.5) {
                    newFlags.push('FIEBRE');
                    newFlags.push('FEVER_FACTOR');
                }
                if (ox < 90) {
                    newFlags.push('HIPOXIA');
                    newFlags.push('HYPOXIA_ALERT');
                }
                if (!isNaN(gl)) {
                    if (gl < 70) newFlags.push('HIPOGLUCEMIA');
                    if (glucoseCtx === 'FASTING' && gl > 125) {
                        newFlags.push('HIPERGLUCEMIA');
                        newFlags.push('DIABETES_FLAG');
                    }
                    if (glucoseCtx === 'CASUAL' && gl > 200) {
                        newFlags.push('URGENCIA_HIPERGLUCEMIA');
                        newFlags.push('HIPERGLUCEMIA');
                    }
                    if (gl > 125) newFlags.push('DIABETES_FLAG');
                }

                const finalVitals = {
                    ...patientData.vitals,
                    status: 'COMPLETED',
                    blood_pressure: {
                        systolic: sys,
                        diastolic: dia,
                        alert_level: sys > 140 || dia > 90 ? 'ELEVATED' : 'NORMAL'
                    },
                    heart_rate: hr,
                    respiratory_rate: rr,
                    temperature: temp,
                    spo2: ox
                };

                const finalBiochemical = {
                    ...patientData.biochemical,
                    glucose: {
                        value: isNaN(gl) ? null : gl,
                        context: glucoseCtx
                    }
                };

                // Update local State
                setPatientData(prev => ({
                    ...prev,
                    vitals: finalVitals,
                    biochemical: finalBiochemical,
                    clinical_flags: [...new Set([...(prev.clinical_flags || []), ...newFlags])]
                }));

                // Update Zustand Global State
                updateVitalSigns({
                    bloodPressure: { systolic: sys, diastolic: dia },
                    heartRate: hr,
                    respiratoryRate: rr,
                    temperature: temp,
                    spo2: ox,
                    glucose: isNaN(gl) ? null : gl,
                    glucoseContext: glucoseCtx
                });

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "✅ **Signos Vitales registrados y sellados con éxito.**",
                    avatar: tiloImg
                }]);

                setTimeout(() => {
                    if (onPhaseComplete) onPhaseComplete('PHASE_18_ELECTRET');
                }, 1000);
            }
            else if (userMsg === "CORRECT_DATA") {
                // Restart
                setSystolic('');
                setDiastolic('');
                setHeartRate('');
                setRespiratoryRate('');
                setTemperature('');
                setSpo2('');
                setGlucose('');
                setGlucoseContext('OMITTED');
                setDismissedHypoxia(false);

                // Real-time synchronization reset
                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        vitals: {
                            ...(prev.vitals || {}),
                            blood_pressure: null,
                            heart_rate: null,
                            respiratory_rate: null,
                            temperature: null,
                            spo2: null
                        },
                        biochemical: {
                            ...prev.biochemical,
                            glucose: null
                        }
                    }));
                }

                const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
                let target = 'Adulto';
                let p2Text = `📢 Diga al paciente:\n\n'Por favor siéntese erguido, con la espalda apoyada y los pies planos sobre el suelo. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 120/80):`;

                if (patientAge < 13) {
                    target = 'Tutor';
                    p2Text = `📢 Solicite al tutor:\n\n'Por favor siente a **${pName}** erguido, con la espalda apoyada. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial de **${pName}** y regístrela como Sistólica/Diastólica en mmHg, ej. 100/60):`;
                } else if (patientAge >= 13 && patientAge < 18) {
                    target = 'Adolescente';
                    p2Text = `📢 Diga a **${pName}**:\n\n'Por favor siéntate erguido, con la espalda apoyada. Voy a colocar el brazalete de presión.'\n\n(Mida la presión arterial y regístrela como Sistólica/Diastólica en mmHg, ej. 110/70):`;
                }

                const nextMsg = `<binary_gate_execution>\n` +
                    `P1: Reiniciando el registro de Signos Vitales. Asegure la correcta calibración de los dispositivos.\n\n` +
                    `P2: ${p2Text}\n\n` +
                    `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                    `</binary_gate_execution>`;

                setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'text' }]);
                setInternalStep('BP');
            }
        }
    }

    useEffect(() => {
        const handler = () => handleSend;
        if (registerInputHandler) {
            registerInputHandler(() => handler);
        }
        return () => {
            if (registerInputHandler) {
                registerInputHandler(prev => prev === handler ? null : prev);
            }
        };
    }, [registerInputHandler, internalStep, systolic, diastolic, heartRate, respiratoryRate, temperature, spo2, glucose, glucoseContext]);

    // RENDER EMERGENCIES ONLY (Otherwise Headless, letting standard chat display)
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
                        className="w-full py-3.5 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-950/30 hover:opacity-90 active:scale-95 transition-all text-sm uppercase tracking-wide"
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
                            className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors"
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
                            className="w-full py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
                        >
                            Recalibrar sensor / Corregir dato
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null; // Headless component
}
