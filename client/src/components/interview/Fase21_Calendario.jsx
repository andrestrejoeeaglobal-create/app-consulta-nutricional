import React, { useState, useEffect, useMemo } from 'react';
import tiloImg from '../../assets/tilo.png';

/**
 * Calcula el Peso Ideal (Fórmula de Devine Bidireccional + Referencia Lemmens)
 * y el Peso Ajustado para pacientes con obesidad (IMC >= 35).
 */
function calculatePrecisionWeights(weightKg, heightCm, gender) {
    const validWeight = Number(weightKg) > 0 ? Number(weightKg) : 70;
    const validHeight = Number(heightCm) > 0 ? Number(heightCm) : 165;
    const baseHeightCm = 152.4; // Base de 5 pies (60 pulgadas)
    const gStr = String(gender || '').toLowerCase();
    const isMale = gStr.startsWith('masc') || gStr === 'hombre' || gStr === 'm';
    const baseWeightKg = isMale ? 50.0 : 45.5;

    let idealWeight = baseWeightKg;
    if (validHeight >= baseHeightCm) {
        const inchesOverBase = (validHeight - baseHeightCm) / 2.54;
        idealWeight = baseWeightKg + (2.3 * inchesOverBase);
    } else {
        // Corrección bidireccional para estaturas bajas (< 152.4 cm):
        // Resta 1.5 kg por cada pulgada por debajo de los 5 pies
        const inchesUnderBase = (baseHeightCm - validHeight) / 2.54;
        idealWeight = Math.max(30.0, baseWeightKg - (1.5 * inchesUnderBase));
    }

    const heightM = validHeight / 100;
    const lemmensIdealWeight = 22.0 * (heightM * heightM);

    const adjustedWeight = idealWeight > 0 && validWeight > idealWeight
        ? idealWeight + 0.25 * (validWeight - idealWeight)
        : validWeight;

    return {
        idealWeight: Number(idealWeight.toFixed(2)),
        lemmensIdealWeight: Number(lemmensIdealWeight.toFixed(2)),
        adjustedWeight: Number(adjustedWeight.toFixed(2))
    };
}

function computeClientBioenergetics(patientData, ageYears, isLactante, isJuvenilAdolescente, isGeriatric) {
    if (patientData?.clinical_dossier?.bioenergetics) {
        return patientData.clinical_dossier.bioenergetics;
    }

    const rawWeight = parseFloat(patientData?.vitals?.weight || patientData?.peso || patientData?.biometria?.peso || patientData?.profile?.weight) || (isLactante ? 9.5 : 72);
    const rawHeight = parseFloat(patientData?.vitals?.height || patientData?.talla || patientData?.biometria?.talla || patientData?.profile?.height) || (isLactante ? 74 : 168);
    const heightCm = rawHeight < 3 ? rawHeight * 100 : rawHeight;
    const heightM = heightCm / 100;
    const bmi = heightM > 0 ? Number((rawWeight / (heightM * heightM)).toFixed(1)) : 24.0;

    const gender = patientData?.sex || patientData?.genero || patientData?.profile?.gender || patientData?.identificacion?.genero || 'Masculino';
    const gStr = String(gender).toLowerCase();
    const isMale = gStr.startsWith('masc') || gStr === 'hombre' || gStr === 'm';

    const weights = calculatePrecisionWeights(rawWeight, heightCm, gender);

    const bodyFatRaw = parseFloat(
        patientData?.vitals?.body_fat ||
        patientData?.biometria?.grasa_corporal ||
        patientData?.biometria?.porcentaje_grasa ||
        patientData?.metrics?.body_fat ||
        0
    );
    const hasBioimpedanceFat = !isNaN(bodyFatRaw) && bodyFatRaw >= 4 && bodyFatRaw <= 65;

    let bmr = 1500;
    let equationUsed = 'Mifflin-St Jeor Estándar';
    let formulaExplanation = '';

    if (isLactante || isJuvenilAdolescente || ageYears < 18) {
        equationUsed = 'OMS / Schofield Pediátrica';
        if (ageYears < 3) {
            bmr = isMale ? (59.512 * rawWeight) - 30.4 : (58.317 * rawWeight) - 31.1;
            bmr += isLactante ? 180 : 120;
        } else if (ageYears < 10) {
            bmr = isMale ? (22.706 * rawWeight) + 504.3 : (20.315 * rawWeight) + 485.9;
        } else {
            bmr = isMale ? (17.686 * rawWeight) + 658.2 : (13.384 * rawWeight) + 692.6;
        }
        formulaExplanation = `OMS/Schofield (${rawWeight} kg, ${ageYears} años)`;
    } else if (hasBioimpedanceFat) {
        equationUsed = 'Katch-McArdle (Masa Libre de Grasa)';
        const lbm = Number((rawWeight * (1 - (bodyFatRaw / 100))).toFixed(2));
        bmr = 370 + (21.6 * lbm);
        formulaExplanation = `MLG ${lbm} kg (Grasa ${bodyFatRaw}%)`;
    } else if (bmi >= 35) {
        equationUsed = 'Mifflin-St Jeor con Peso Ajustado (Devine Bidireccional)';
        const s = isMale ? 5 : -161;
        bmr = (10 * weights.adjustedWeight) + (6.25 * heightCm) - (5 * ageYears) + s;
        formulaExplanation = `IMC ${bmi} ≥ 35 → Peso Ajustado ${weights.adjustedWeight} kg (PI Devine: ${weights.idealWeight} kg)`;
    } else {
        equationUsed = 'Mifflin-St Jeor Estándar';
        const s = isMale ? 5 : -161;
        bmr = (10 * rawWeight) + (6.25 * heightCm) - (5 * ageYears) + s;
        formulaExplanation = `Peso ${rawWeight} kg | Estatura ${heightCm} cm | Edad ${ageYears} años`;
    }

    bmr = Math.max(isLactante ? 450 : 950, Math.round(bmr));
    const actStr = String(patientData?.activity_level || patientData?.physical_activity || patientData?.habits?.activity_level || 'LIGERO').toUpperCase();
    let pal = 1.375;
    if (isLactante) pal = 1.25;
    else if (actStr.includes('SEDENTARIO') || actStr.includes('NULA')) pal = 1.2;
    else if (actStr.includes('MODERAD') || actStr.includes('ACTIVO')) pal = 1.55;
    else if (actStr.includes('INTENS') || actStr.includes('ATLETA')) pal = 1.725;

    const tdee = Math.round(bmr * pal);
    let targetKcal = tdee;
    if (!isLactante && !isJuvenilAdolescente) {
        if (bmi >= 30) targetKcal = Math.max(1250, tdee - 450);
        else if (bmi >= 25.5) targetKcal = Math.max(1300, tdee - 300);
        else if (bmi < 18.5) targetKcal = tdee + 300;
    }

    const macros = isLactante
        ? { carbs: 50, protein: 15, fat: 35 }
        : isJuvenilAdolescente
        ? { carbs: 50, protein: 20, fat: 30 }
        : isGeriatric
        ? { carbs: 45, protein: 25, fat: 30 }
        : bmi >= 27
        ? { carbs: 35, protein: 35, fat: 30 }
        : { carbs: 40, protein: 30, fat: 30 };

    return {
        bmr,
        tdee,
        targetKcal,
        bmi,
        weights,
        equationUsed,
        formulaExplanation,
        macros
    };
}

const Fase16_ProtocoloDietetico = ({ onPhaseComplete, setPatientData, messages, setMessages, registerInputHandler, patientData }) => {
    const ageCandidate = Number(patientData?.identificacion?.edad ?? patientData?.identityLock?.patientInfo?.age ?? patientData?.edad ?? 30);

    const isLactante = ageCandidate < 2 || patientData?.isLactante;
    const isJuvenilAdolescente = !isLactante && (ageCandidate < 18 || patientData?.isPediatrico);
    const isGeriatric = ageCandidate >= 65 || patientData?.isGeriatrico;

    const bio = useMemo(
        () => computeClientBioenergetics(patientData, ageCandidate, isLactante, isJuvenilAdolescente, isGeriatric),
        [patientData, ageCandidate, isLactante, isJuvenilAdolescente, isGeriatric]
    );

    const defaultTdee = String(bio.tdee || (isLactante ? '950' : isJuvenilAdolescente ? '1800' : isGeriatric ? '1600' : '2200'));
    const defaultTarget = String(bio.targetKcal || (isLactante ? '950' : isJuvenilAdolescente ? '1800' : isGeriatric ? '1600' : '2000'));
    const defaultMacros = bio.macros || { carbs: 40, protein: 30, fat: 30 };

    const [internalStep, setInternalStep] = useState('TDEE'); // TDEE, TARGET, CARBS, PROTEIN, FAT, CONSTRAINTS, FINAL
    const [tdee, setTdee] = useState(defaultTdee);
    const [target, setTarget] = useState(defaultTarget);
    const [macros, setMacros] = useState(defaultMacros);
    const [constraints, setConstraints] = useState({
        fodmaps: false, shelfStable: false, noDairy: false, noGluten: false
    });

    useEffect(() => {
        if (internalStep === 'TDEE') {
            const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Protocolo Dietético"));
            if (!alreadyGreeted) {
                const promptText =
                    `⚖️ **Protocolo Dietético y Árbol Bioenergético (${bio.equationUsed})**\n\n` +
                    `• **Fórmula Aplicada:** ${bio.equationUsed}\n` +
                    `• **Detalle Antropométrico:** ${bio.formulaExplanation}\n` +
                    `• **Tasa Metabólica Basal (TMB):** **${bio.bmr} kcal/día**\n` +
                    `• **Gasto Energético Total Calculado (TDEE):** **${defaultTdee} kcal/día**\n` +
                    `• **Meta Calórica Sugerida:** **${defaultTarget} kcal/día**\n\n` +
                    `¿Confirma el **TDEE Calculado de ${defaultTdee} kcal** o desea ingresar otro valor en kcal?`;

                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: promptText,
                        avatar: tiloImg,
                        options: [
                            { label: `✅ Confirmar TDEE (${defaultTdee} kcal)`, value: defaultTdee }
                        ]
                    }
                ]);
            }
        }
    }, [internalStep, bio, defaultTdee, defaultTarget]);

    const handleSend = (userMsg) => {
        const addBotMsg = (msg, options = null) => {
            const newMsg = { role: "assistant", content: msg, avatar: tiloImg };
            if (options) newMsg.options = options;
            setMessages(prev => [...prev, newMsg]);
        };

        const val = parseInt(userMsg, 10);
        const minVal = isLactante ? 400 : 500;

        if (internalStep === 'TDEE') {
            if (isNaN(val) || val < minVal) {
                addBotMsg(`Por favor, ingresa un valor numérico válido para el TDEE (Ej: ${defaultTdee}).`);
                return;
            }
            setTdee(val.toString());
            setInternalStep('TARGET');

            const targetPrompt = isLactante
                ? `TDEE Pediátrico guardado: **${val} kcal**.\n\n¿Cuál es la **Prescripción Final** en kcal? (Sugerida: **${defaultTarget} kcal**)`
                : `TDEE guardado: **${val} kcal**.\n\n¿Cuál es la **Prescripción Calórica Final** en kcal? (Sugerida por CORTEX: **${defaultTarget} kcal**)`;

            addBotMsg(targetPrompt, [
                { label: `✅ Confirmar Meta (${defaultTarget} kcal)`, value: defaultTarget }
            ]);
        }
        else if (internalStep === 'TARGET') {
            if (isNaN(val) || val < minVal) {
                addBotMsg(`Por favor, ingresa un valor numérico válido (Ej: ${defaultTarget}).`);
                return;
            }
            setTarget(val.toString());
            setInternalStep('CARBS');

            const carbsPrompt =
                `Prescripción guardada: **${val} kcal**.\n\n` +
                `Distribución sugerida por CORTEX: **${defaultMacros.carbs}% Carbohidratos / ${defaultMacros.protein}% Proteínas / ${defaultMacros.fat}% Lípidos**.\n\n` +
                `¿Qué **porcentaje de Carbohidratos** desea asignar?`;

            addBotMsg(carbsPrompt, [
                { label: `✅ ${defaultMacros.carbs}% Carbohidratos`, value: String(defaultMacros.carbs) }
            ]);
        }
        else if (internalStep === 'CARBS') {
            if (isNaN(val) || val < 0 || val > 100) {
                addBotMsg("Porcentaje inválido. Ingresa un número del 0 al 100.");
                return;
            }
            setMacros(prev => ({ ...prev, carbs: val }));
            setInternalStep('PROTEIN');

            addBotMsg(
                `Carbohidratos: **${val}%**\n\n¿Qué **porcentaje de Proteínas** desea asignar? (Sugerido: **${defaultMacros.protein}%**)`,
                [{ label: `✅ ${defaultMacros.protein}% Proteínas`, value: String(defaultMacros.protein) }]
            );
        }
        else if (internalStep === 'PROTEIN') {
            if (isNaN(val) || val < 0 || val > 100) {
                addBotMsg("Porcentaje inválido. Ingresa un número del 0 al 100.");
                return;
            }
            setMacros(prev => ({ ...prev, protein: val }));
            setInternalStep('FAT');

            const remainingFat = Math.max(0, 100 - (macros.carbs + val));
            addBotMsg(
                `Proteínas: **${val}%**\n\n¿Qué **porcentaje de Lípidos** desea asignar? (Restante para 100%: **${remainingFat}%**)`,
                [{ label: `✅ ${remainingFat}% Lípidos`, value: String(remainingFat) }]
            );
        }
        else if (internalStep === 'FAT') {
            if (isNaN(val) || val < 0 || val > 100) {
                addBotMsg("Porcentaje inválido. Ingresa un número del 0 al 100.");
                return;
            }

            const currentCarbs = macros.carbs;
            const currentProtein = macros.protein;
            const total = currentCarbs + currentProtein + val;

            if (total !== 100) {
                addBotMsg(`⚠️ **Error de Distribución**\n\nLa suma de los macros es **${total}%** (Carbs: ${currentCarbs}%, Prot: ${currentProtein}%, Grasas: ${val}%). Debe sumar exactamente 100%.\n\nVamos a intentar de nuevo. ¿Qué **porcentaje de Carbohidratos**?`);
                setInternalStep('CARBS');
                return;
            }

            const getRemainingOptions = (curr) => {
                const opts = [{ label: '✅ Terminar y Consolidar Plan', value: 'DONE' }];
                if (!curr.fodmaps) opts.push({ label: 'Protocolo Bajo en FODMAPS', value: 'FODMAPS' });
                if (!curr.shelfStable) opts.push({ label: "Logística 'Shelf Stable'", value: 'SHELF' });
                if (!curr.noDairy) opts.push({ label: 'Sin Lácteos', value: 'NODAIRY' });
                if (!curr.noGluten) opts.push({ label: 'Sin Gluten', value: 'NOGLUTEN' });
                return opts;
            };

            setMacros(prev => ({ ...prev, fat: val }));
            setInternalStep('CONSTRAINTS');
            addBotMsg(
                `✅ Distribución perfecta (100%).\n\n` +
                `Finalmente, ¿desea agregar alguna restricción logística o alimentaria dura? Puede seleccionar varias si es necesario. Si no, seleccione 'Terminar y Consolidar Plan'.`,
                getRemainingOptions(constraints)
            );
        }
        else if (internalStep === 'CONSTRAINTS') {
            const normalizedMsg = String(userMsg || '').toUpperCase().trim();
            const isDoneSignal = ['DONE', 'NINGUNA', 'NINGUNO', 'NO', 'TERMINAR', 'FIN', 'LISTO', 'OK', 'CONSOLIDAR'].some(term => normalizedMsg.includes(term));

            if (isDoneSignal) {
                setInternalStep('FINAL');
                if (registerInputHandler) registerInputHandler(null);

                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        nutrition: {
                            ...prev.nutrition,
                            protocol: {
                                equationUsed: bio.equationUsed,
                                bmr: bio.bmr,
                                weights: bio.weights,
                                tdee,
                                target,
                                macros,
                                constraints
                            }
                        }
                    }));
                }

                addBotMsg("📋 **Plan Consolidado**\n\nEl protocolo dietético y la consulta médica han sido cerrados exitosamente.");
                setTimeout(() => onPhaseComplete && onPhaseComplete(), 600);
            } else {
                let label = "";
                let updatedConstraints = { ...constraints };
                if (userMsg === 'FODMAPS' || normalizedMsg.includes('FODMAP')) { updatedConstraints.fodmaps = true; label = "Bajo en FODMAPS"; }
                else if (userMsg === 'SHELF' || normalizedMsg.includes('SHELF')) { updatedConstraints.shelfStable = true; label = "Shelf Stable"; }
                else if (userMsg === 'NODAIRY' || normalizedMsg.includes('LÁCTEO') || normalizedMsg.includes('LACTEO')) { updatedConstraints.noDairy = true; label = "Sin Lácteos"; }
                else if (userMsg === 'NOGLUTEN' || normalizedMsg.includes('GLUTEN')) { updatedConstraints.noGluten = true; label = "Sin Gluten"; }
                else { label = userMsg; }

                setConstraints(updatedConstraints);

                const getRemainingOptions = (curr) => {
                    const opts = [{ label: '✅ Terminar y Consolidar Plan', value: 'DONE' }];
                    if (!curr.fodmaps) opts.push({ label: 'Protocolo Bajo en FODMAPS', value: 'FODMAPS' });
                    if (!curr.shelfStable) opts.push({ label: "Logística 'Shelf Stable'", value: 'SHELF' });
                    if (!curr.noDairy) opts.push({ label: 'Sin Lácteos', value: 'NODAIRY' });
                    if (!curr.noGluten) opts.push({ label: 'Sin Gluten', value: 'NOGLUTEN' });
                    return opts;
                };

                const remaining = getRemainingOptions(updatedConstraints);
                if (remaining.length <= 1) {
                    setInternalStep('FINAL');
                    if (registerInputHandler) registerInputHandler(null);

                    if (setPatientData) {
                        setPatientData(prev => ({
                            ...prev,
                            nutrition: {
                                ...prev.nutrition,
                                protocol: {
                                    equationUsed: bio.equationUsed,
                                    bmr: bio.bmr,
                                    weights: bio.weights,
                                    tdee,
                                    target,
                                    macros,
                                    constraints: updatedConstraints
                                }
                            }
                        }));
                    }
                    addBotMsg("📋 **Plan Consolidado**\n\nTodas las restricciones registradas. El protocolo dietético ha sido cerrado exitosamente.");
                    setTimeout(() => onPhaseComplete && onPhaseComplete(), 600);
                } else {
                    addBotMsg(`Restricción **${label}** agregada. ¿Desea agregar alguna otra restricción o finalizar?`, remaining);
                }
            }
        }
    };

    useEffect(() => {
        if (registerInputHandler) {
            if (internalStep === 'FINAL') {
                registerInputHandler(null);
            } else {
                registerInputHandler(() => handleSend);
            }
        }
    }, [registerInputHandler, internalStep, tdee, target, macros, constraints]);

    return null;
};

export default Fase16_ProtocoloDietetico;
