import React, { useState, useEffect, useRef } from 'react';
import tiloImg from '../../assets/tilo.png';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

// Parser helpers to normalize metrics mathematically and prevent stale errors
const parseWeight = (text) => {
    const match = text.match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
};

const parseHeight = (text) => {
    const match = text.match(/\d+(\.\d+)?/);
    if (!match) return null;
    let val = parseFloat(match[0]);
    // Si viene en metros (ej: 1.65), convertimos a centímetros (165)
    if (val < 3) {
        val = val * 100;
    }
    return val;
};

const parseCentimeters = (text) => {
    const match = text.match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
};

export default function Fase16_BiometriaGeneral({
    onPhaseComplete,
    patientData,
    setPatientData,
    messages,
    setMessages,
    registerInputHandler,
    setIsGlobalTyping
}) {
    const { pName, isMinor, patientSex, patientAge } = usePatientLinguistics(patientData);

    const [internalStep, setInternalStep] = useState('WEIGHT');
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

    const hasGreeted = useRef(false);

    // Auto-transition on mount if already completed (resilience against page reloads/crashes)
    useEffect(() => {
        const alreadyCompleted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Mediciones biométricas registradas y selladas con éxito"));
        if (alreadyCompleted) {
            if (onPhaseComplete) onPhaseComplete();
        }
    }, [messages, onPhaseComplete]);

    // Inicialización - Mitigación de doble render en StrictMode
    useEffect(() => {
        if (hasGreeted.current) return;

        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Hemos terminado la entrevista verbal"));
        if (!alreadyGreeted) {
            hasGreeted.current = true;

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p1Text = `He registrado y sellado su cuestionario de frecuencia de consumo (FFQ) de manera exitosa para la calibración de su expediente clínico bajo la **NOM-004-SSA3-2012**. Hemos terminado la entrevista verbal. Ahora pasaremos a tomar sus medidas físicas para calibrar el algoritmo.`;
            let p2Text = `📢 Diga al paciente:\n\n'Por favor suba a la báscula. Quítese los zapatos y retire objetos pesados de sus bolsillos.'\n\n(Espere a que el peso se estabilice y registre en kg):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p1Text = `He registrado y sellado el cuestionario de frecuencia de consumo (FFQ) de **${pName}** de manera exitosa para la calibración de su expediente clínico bajo la **NOM-004-SSA3-2012**. Hemos terminado la entrevista verbal. Ahora pasaremos a tomar sus medidas físicas de **${pName}** para calibrar el algoritmo.`;
                p2Text = `📢 Solicite al tutor:\n\n'Por favor solicite que **${pName}** suba a la báscula sin zapatos y retire objetos pesados de sus bolsillos.'\n\n(Espere a que el peso se estabilice y registre en kg):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p1Text = `He registrado y sellado su cuestionario de frecuencia de consumo (FFQ) de manera exitosa para la calibración de su expediente clínico bajo la **NOM-004-SSA3-2012**. Hemos terminado la entrevista verbal. Ahora pasaremos a tomar sus medidas físicas para calibrar el algoritmo.`;
                p2Text = `📢 Diga a **${pName}**:\n\n'Por favor sube a la báscula sin zapatos y retira objetos pesados de tus bolsillos.'\n\n(Espere a que el peso se estabilice y registre en kg):`;
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
                    inputType: 'number'
                }
            ]);
            setInternalStep('WEIGHT');
        }
    }, [messages, isMinor, pName, patientSex, patientAge, setMessages]);

    async function handleSend(userMsg) {
        const lower = userMsg.toLowerCase();
        const addBotMsg = (msg, inputType = 'number') => setMessages(prev => [...prev, { role: "assistant", content: msg, avatar: tiloImg, inputType }]);

        if (internalStep === 'WEIGHT') {
            const val = parseWeight(userMsg);
            if (!val || val < 10 || val > 300) {
                addBotMsg("⚠️ Peso inusual. Verifique el peso en kg (10-300) e ingréselo nuevamente:");
                return;
            }
            const updatedVitals = { ...biometria.vitals, weight: val };
            setBiometria(prev => ({ ...prev, vitals: updatedVitals }));

            // Real-time synchronization with Espejo Clínico (Panel Derecho)
            if (setPatientData) {
                setPatientData(prev => {
                    const currentVitals = prev.vitals || {};
                    const newVitals = {
                        ...currentVitals,
                        weight: val
                    };
                    if (newVitals.height) {
                        const heightMeters = newVitals.height / 100;
                        newVitals.bmi = parseFloat((val / (heightMeters * heightMeters)).toFixed(1));
                        if (newVitals.bmi < 18.5) newVitals.bmi_class = "Bajo Peso";
                        else if (newVitals.bmi < 24.9) newVitals.bmi_class = "Normopeso";
                        else if (newVitals.bmi < 29.9) newVitals.bmi_class = "Sobrepeso";
                        else newVitals.bmi_class = "Obesidad";
                    }
                    return {
                        ...prev,
                        vitals: newVitals
                    };
                });
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Colóquese de pie mirando al frente, con los talones juntos, hombros relajados y cabeza recta (alineada al plano de Frankfort).'\n\n(Realice la medición y registre la estatura en cm o m):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Por favor solicite que **${pName}** se coloque de pie mirando al frente, con los talones juntos, hombros relajados y cabeza recta (alineada al plano de Frankfort).'\n\n(Realice la medición y registre la estatura en cm o m):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Colócate de pie mirando al frente, con los talones juntos, hombros relajados y cabeza recta (alineada al plano de Frankfort).'\n\n(Realice la medición y registre la estatura en cm o m):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Procedemos con la medición de la talla física para el cálculo preciso del Índice de Masa Corporal (**IMC**).\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('HEIGHT');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'HEIGHT') {
            const val = parseHeight(userMsg);
            if (!val || val < 40 || val > 250) {
                addBotMsg("⚠️ Estatura inusual. Verifique la estatura en cm o m (40-250) e ingrésela nuevamente:");
                return;
            }
            const updatedVitals = { ...biometria.vitals, height: val };
            setBiometria(prev => ({ ...prev, vitals: updatedVitals }));

            // Real-time synchronization with Espejo Clínico (Panel Derecho)
            if (setPatientData) {
                setPatientData(prev => {
                    const currentVitals = prev.vitals || {};
                    const newVitals = {
                        ...currentVitals,
                        height: val
                    };
                    if (newVitals.weight) {
                        const heightMeters = val / 100;
                        newVitals.bmi = parseFloat((newVitals.weight / (heightMeters * heightMeters)).toFixed(1));
                        if (newVitals.bmi < 18.5) newVitals.bmi_class = "Bajo Peso";
                        else if (newVitals.bmi < 24.9) newVitals.bmi_class = "Normopeso";
                        else if (newVitals.bmi < 29.9) newVitals.bmi_class = "Sobrepeso";
                        else newVitals.bmi_class = "Obesidad";
                    }
                    return {
                        ...prev,
                        vitals: newVitals
                    };
                });
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const isFemale = patientSex === 'FEMENINO' || patientSex === 'F' || patientSex === 'Mujer';
            const extraPregnancyInstruction = isFemale ? ", sin contar embarazo," : "";

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Pregunte al paciente:\n\n'¿Cuál es el peso máximo que ha alcanzado en su vida${extraPregnancyInstruction} en kilogramos?'\n\n(Registre el peso en kg o responda 'No lo sé'):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Pregunte al tutor:\n\n'¿Cuál es el peso máximo que **${pName}** ha alcanzado en su vida en kilogramos?'\n\n(Registre el peso en kg o diga 'No lo sé'):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Pregunte a **${pName}**:\n\n'¿Cuál es el peso máximo que has alcanzado en tu vida en kilogramos?'\n\n(Registre el peso en kg o responde 'No lo sé'):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: El cálculo del punto de ajuste termogénico requiere el registro del peso histórico máximo del paciente.\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('MAX_WEIGHT');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'MAX_WEIGHT') {
            const val = parseWeight(userMsg);
            if (!val && !lower.includes("no") && !lower.includes("na") && !lower.includes("se")) {
                addBotMsg("⚠️ Entrada no válida. Ingrese un peso máximo válido en kg (ej: 80) o diga 'No lo sé':");
                return;
            }

            const updatedVitals = { ...biometria.vitals };
            if (val) {
                updatedVitals.max_weight = val;
                setBiometria(prev => ({ ...prev, vitals: { ...prev.vitals, max_weight: val } }));

                // Real-time synchronization with Espejo Clínico (Panel Derecho)
                if (setPatientData) {
                    setPatientData(prev => {
                        const currentVitals = prev.vitals || {};
                        return {
                            ...prev,
                            vitals: {
                                ...currentVitals,
                                max_weight: val
                            }
                        };
                    });
                }
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Permanezca de pie con los brazos cruzados sobre el pecho y el abdomen relajado.'\n\n(Mida la circunferencia de la cintura en el punto medio entre la última costilla y la cresta ilíaca en cm):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Por favor solicite que **${pName}** permanezca de pie con los brazos cruzados sobre el pecho y el abdomen relajado.'\n\n(Mida la circunferencia de la cintura en el punto medio entre la última costilla y la cresta ilíaca en cm):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Permanece de pie con los brazos cruzados sobre el pecho y el abdomen relajado.'\n\n(Mida la circunferencia de la cintura en el punto medio entre la última costilla y la cresta ilíaca en cm):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: La circunferencia de la cintura es un indicador crítico de riesgo cardiometabólico y distribución de tejido adiposo visceral.\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('WAIST');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'WAIST') {
            const val = parseCentimeters(userMsg);
            if (!val || val < 30 || val > 250) {
                addBotMsg("⚠️ Circunferencia inusual. Verifique el valor de la cintura en cm (30-250) e ingréselo nuevamente:");
                return;
            }
            const updatedVitals = { ...biometria.vitals, waist: val };
            setBiometria(prev => ({ ...prev, vitals: updatedVitals }));

            // Real-time synchronization with Espejo Clínico (Panel Derecho)
            if (setPatientData) {
                setPatientData(prev => {
                    const currentVitals = prev.vitals || {};
                    const newVitals = {
                        ...currentVitals,
                        waist: val
                    };
                    if (newVitals.hip) {
                        newVitals.whr = parseFloat((val / newVitals.hip).toFixed(2));
                        const isFemale = patientSex === 'FEMENINO' || patientSex === 'F' || patientSex === 'Mujer';
                        const limit = isFemale ? 0.85 : 0.90;
                        newVitals.whr_risk = newVitals.whr > limit ? 'HIGH' : 'LOW';
                    }
                    return {
                        ...prev,
                        vitals: newVitals
                    };
                });
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            let p2Text = `📢 Diga al paciente:\n\n'Junte los pies y manténgase erguido.'\n\n(Mida la circunferencia de la cadera en la zona más prominente de los glúteos en cm):`;

            if (patientAge < 13) {
                target = 'Tutor';
                p2Text = `📢 Solicite al tutor:\n\n'Por favor solicite que **${pName}** junte los pies y se mantenga erguido.'\n\n(Mida la circunferencia de la cadera en la zona más prominente de los glúteos en cm):`;
            } else if (patientAge >= 13 && patientAge < 18) {
                target = 'Adolescente';
                p2Text = `📢 Diga a **${pName}**:\n\n'Junta los pies y mantente erguido.'\n\n(Mida la circunferencia de la cadera en la zona más prominente de los glúteos en cm):`;
            }

            const nextMsg = `<binary_gate_execution>\n` +
                `P1: Medición de la circunferencia de cadera para la determinación final del Índice Cintura/Cadera (**ICC**).\n\n` +
                `P2: ${p2Text}\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, { role: "assistant", content: nextMsg, avatar: tiloImg, inputType: 'number' }]);
            setInternalStep('HIP');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'HIP') {
            const val = parseCentimeters(userMsg);
            if (!val || val < 30 || val > 250) {
                addBotMsg("⚠️ Circunferencia inusual. Verifique el valor de la cadera en cm (30-250) e ingréselo nuevamente:");
                return;
            }

            const updatedVitalsLocal = {
                ...biometria.vitals,
                hip: val
            };

            const weight = updatedVitalsLocal.weight;
            const height = updatedVitalsLocal.height; // this is in cm (e.g. 165)
            let bmi = null;
            let bmi_class = null;
            if (weight && height) {
                const heightMeters = height / 100;
                bmi = parseFloat((weight / (heightMeters * heightMeters)).toFixed(1));
                if (bmi < 18.5) bmi_class = "Bajo Peso";
                else if (bmi < 24.9) bmi_class = "Normopeso";
                else if (bmi < 29.9) bmi_class = "Sobrepeso";
                else bmi_class = "Obesidad";
            }

            const waist = updatedVitalsLocal.waist;
            const hip = val;
            let whr = null;
            let whr_risk = 'LOW';
            if (waist && hip) {
                whr = parseFloat((waist / hip).toFixed(2));
                const isFemale = patientSex === 'FEMENINO' || patientSex === 'F' || patientSex === 'Mujer';
                const limit = isFemale ? 0.85 : 0.90;
                if (whr > limit) {
                    whr_risk = 'HIGH';
                }
            }

            const finalVitals = {
                ...updatedVitalsLocal,
                bmi,
                bmi_class,
                whr,
                whr_risk
            };

            // Inyectar banderas clínicas de riesgo si aplica
            const newFlags = [];
            if (whr_risk === 'HIGH') {
                newFlags.push("HIGH_CARDIO_RISK");
            }

            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    vitals: { ...(prev.vitals || {}), ...finalVitals },
                    clinical_flags: [...new Set([...(prev.clinical_flags || []), ...newFlags])]
                }));
            }

            setIsGlobalTyping(true);
            await new Promise(resolve => setTimeout(resolve, 800));

            const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
            let target = 'Adulto';
            if (patientAge < 13) target = 'Tutor';
            else if (patientAge >= 13 && patientAge < 18) target = 'Adolescente';

            const summaryMsg = `<binary_gate_execution>\n` +
                `P1: Verifique las mediciones biométricas registradas para cerrar este bloque en cumplimiento con la **NOM-004-SSA3-2012**:\n\n` +
                `- ⚖️ **Peso**: ${weight} kg\n` +
                `- 📏 **Estatura**: ${height.toFixed(0)} cm\n` +
                `- 🧮 **IMC**: ${bmi} (${bmi_class})\n` +
                `- 📐 **Cintura/Cadera**: ${waist}/${hip} cm (ICC: ${whr} - ${whr_risk === 'HIGH' ? 'Android / Riesgo Elevado' : 'Ginoide / Riesgo Bajo'})\n\n` +
                `P2: ¿Es correcta y verídica toda esta información?\n\n` +
                `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                `</binary_gate_execution>`;

            setMessages(prev => [...prev, {
                role: "assistant",
                content: summaryMsg,
                avatar: tiloImg,
                inputType: 'strict_select',
                options: [
                    { label: "✅ Sí, es correcta", value: "CONFIRM_DATA" },
                    { label: "❌ No, quiero corregir", value: "CORRECT_DATA" }
                ]
            }]);
            setInternalStep('REVIEW_SUMMARY');
            setIsGlobalTyping(false);
        }
        else if (internalStep === 'REVIEW_SUMMARY') {
            if (userMsg === "CONFIRM_DATA") {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "✅ **Mediciones biométricas registradas y selladas con éxito.**",
                    avatar: tiloImg
                }]);
                setInternalStep('FINALIZED');
                setTimeout(() => {
                    if (onPhaseComplete) onPhaseComplete();
                }, 1000);
            }
            else if (userMsg === "CORRECT_DATA") {
                // Reset local state
                setBiometria(prev => ({
                    ...prev,
                    vitals: {
                        ...prev.vitals,
                        height: null,
                        weight: null,
                        waist: null,
                        hip: null,
                        bmi: null,
                        bmi_class: null,
                        whr: null,
                        whr_risk: null
                    }
                }));

                // Reset patientData.vitals and clear cardio flag
                if (setPatientData) {
                    setPatientData(prev => {
                        const currentFlags = prev.clinical_flags || [];
                        const updatedFlags = currentFlags.filter(f => f !== "HIGH_CARDIO_RISK");
                        return {
                            ...prev,
                            vitals: {
                                ...(prev.vitals || {}),
                                height: null,
                                weight: null,
                                waist: null,
                                hip: null,
                                bmi: null,
                                bmi_class: null,
                                whr: null,
                                whr_risk: null
                            },
                            clinical_flags: updatedFlags
                        };
                    });
                }

                const gender = (patientSex && patientSex.toLowerCase().startsWith('f')) ? 'F' : 'M';
                let target = 'Adulto';
                let p2Text = `📢 Diga al paciente:\n\n'Por favor suba a la báscula. Quítese los zapatos y retire objetos pesados de sus bolsillos.'\n\n(Espere a que el peso se estabilice y registre en kg):`;

                if (patientAge < 13) {
                    target = 'Tutor';
                    p2Text = `📢 Solicite al tutor:\n\n'Por favor solicite que **${pName}** suba a la báscula sin zapatos y retire objetos pesados de sus bolsillos.'\n\n(Espere a que el peso se estabilice y registre en kg):`;
                } else if (patientAge >= 13 && patientAge < 18) {
                    target = 'Adolescente';
                    p2Text = `📢 Diga a **${pName}**:\n\n'Por favor sube a la báscula sin zapatos y retira objetos pesados de tus bolsillos.'\n\n(Espere a que el peso se estabilice y registre en kg):`;
                }

                const resetMsg = `<binary_gate_execution>\n` +
                    `P1: Reiniciando el registro de mediciones biométricas. Asegure la correcta calibración de los dispositivos.\n\n` +
                    `P2: ${p2Text}\n\n` +
                    `<!-- meta user_target: ${target} gender_lock: ${gender} triage_mode: Inactivo -->\n` +
                    `</binary_gate_execution>`;

                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: resetMsg,
                    avatar: tiloImg,
                    inputType: 'number'
                }]);
                setInternalStep('WEIGHT');
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
    }, [registerInputHandler, internalStep, biometria]);

    return null; // Headless component
}
