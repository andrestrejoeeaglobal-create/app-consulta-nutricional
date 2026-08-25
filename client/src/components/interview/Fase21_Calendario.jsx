import React, { useState, useEffect } from 'react';
import tiloImg from '../../assets/tilo.png';

const Fase16_ProtocoloDietetico = ({ onPhaseComplete, setPatientData, messages, setMessages, registerInputHandler, patientData }) => {
    const ageCandidate = patientData?.identificacion?.edad ?? patientData?.identityLock?.patientInfo?.age ?? patientData?.edad ?? 30;

    const isLactante = ageCandidate < 2 || patientData?.isLactante;
    const isJuvenilAdolescente = !isLactante && (ageCandidate < 18 || patientData?.isPediatrico);
    const isGeriatric = ageCandidate >= 65 || patientData?.isGeriatrico;

    // Valores por defecto dinámicos por franja de edad:
    const defaultTdee = isLactante ? '950' : isJuvenilAdolescente ? '1800' : isGeriatric ? '1600' : '2200';
    const defaultTarget = isLactante ? '950' : isJuvenilAdolescente ? '1800' : isGeriatric ? '1600' : '2000';
    const defaultMacros = isLactante 
        ? { carbs: 50, protein: 15, fat: 35 } // Grasas 30-40%, Carbs 45-55%, Prot 10-15% (~13g)
        : isJuvenilAdolescente 
        ? { carbs: 50, protein: 20, fat: 30 } 
        : isGeriatric 
        ? { carbs: 45, protein: 25, fat: 30 } 
        : { carbs: 40, protein: 30, fat: 30 };

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
                let promptText = "";
                if (isLactante) {
                    promptText = "⚖️ **Protocolo Dietético Pediátrico (Primeros 1,000 Días)**\n\nDefiniremos los requerimientos energéticos y distribución de macronutrientes adaptados al desarrollo infantil.\n\nPara un bebé de 1 año (12 meses), el requerimiento calórico promedio es de **900 a 1,000 kcal/día** (80-90 kcal/kg/día).\n• **Aporte Lácteo:** 400-500 ml/día (14-16 oz) = ~300-350 kcal.\n• **Sólidos variados (BLW/papillas):** 600-700 kcal.\n\n¿Cuál es el TDEE Calculado en kcal? (Ej: 950)";
                } else if (isJuvenilAdolescente) {
                    promptText = "⚖️ **Protocolo Dietético Juvenil**\n\nDefiniremos los requerimientos energéticos para crecimiento óseo y desarrollo escolar/deportivo.\n\n¿Cuál es el TDEE Calculado en kcal? (Ej: 1800)";
                } else if (isGeriatric) {
                    promptText = "⚖️ **Protocolo Dietético Geriátrico**\n\nDefiniremos la energía y distribución proteica fraccionada para protección anti-sarcopenia y preservación renal (TFG).\n\n¿Cuál es el TDEE Calculado en kcal? (Ej: 1600)";
                } else {
                    promptText = "⚖️ **Protocolo Dietético Metabólico**\n\nVamos a definir los requerimientos energéticos y distribución de macronutrientes.\n\n¿Cuál es el TDEE Calculado (Gasto Energético Total) en kcal? (Ej: 2200)";
                }

                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: promptText,
                        avatar: tiloImg
                    }
                ]);
            }
        }
    }, [internalStep, isLactante, isJuvenilAdolescente, isGeriatric]);

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
                ? `TDEE Pediátrico guardado: ${val} kcal.\n\nEstructura del día recomendada: 3 comidas principales + 2 colaciones saludables + 400-500 ml de leche (materna/entera/fórmula).\n\n¿Cuál es la **Prescripción Final** en kcal? (Ej: ${val})`
                : `TDEE guardado: ${val} kcal.\n\n¿Cuál es la **Prescripción Final** (Déficit/Superávit) en kcal? (Ej: ${defaultTarget})`;
            
            addBotMsg(targetPrompt);
        } 
        else if (internalStep === 'TARGET') {
            if (isNaN(val) || val < minVal) {
                addBotMsg(`Por favor, ingresa un valor numérico válido (Ej: ${defaultTarget}).`);
                return;
            }
            setTarget(val.toString());
            setInternalStep('CARBS');
            
            const carbsPrompt = isLactante
                ? `Prescripción Pediátrica guardada: ${val} kcal.\n\nDistribución de macronutrientes recomendada para lactantes: Grasas 30-40%, Carbs 45-55%, Prot 10-15% (~13g/día).\n\n¿Qué **porcentaje de Carbohidratos Complejos**? (Ej: ${defaultMacros.carbs})`
                : `Prescripción guardada: ${val} kcal.\n\nAhora la distribución de macros. ¿Qué **porcentaje de Carbohidratos**? (Ej: ${defaultMacros.carbs})`;

            addBotMsg(carbsPrompt);
        }
        else if (internalStep === 'CARBS') {
            if (isNaN(val) || val < 0 || val > 100) {
                addBotMsg("Porcentaje inválido. Ingresa un número del 0 al 100.");
                return;
            }
            setMacros(prev => ({ ...prev, carbs: val }));
            setInternalStep('PROTEIN');
            
            const proteinPrompt = isLactante
                ? `Carbohidratos: ${val}%\n\n¿Qué **porcentaje de Proteínas** (~13g/día para crecimiento)? (Ej: ${defaultMacros.protein})`
                : `Carbohidratos: ${val}%\n\n¿Qué **porcentaje de Proteínas**? (Ej: ${defaultMacros.protein})`;

            addBotMsg(proteinPrompt);
        }
        else if (internalStep === 'PROTEIN') {
            if (isNaN(val) || val < 0 || val > 100) {
                addBotMsg("Porcentaje inválido. Ingresa un número del 0 al 100.");
                return;
            }
            setMacros(prev => ({ ...prev, protein: val }));
            setInternalStep('FAT');

            const fatPrompt = isLactante
                ? `Proteínas: ${val}%\n\n¿Qué **porcentaje de Grasas Saludables** (esenciales para mielinización y desarrollo cerebral 30-40%)? (Ej: ${defaultMacros.fat})`
                : `Proteínas: ${val}%\n\n¿Qué **porcentaje de Lípidos**? (Ej: ${defaultMacros.fat})`;

            addBotMsg(fatPrompt);
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
                                protocol: { tdee, target, macros, constraints: updatedConstraints }
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
