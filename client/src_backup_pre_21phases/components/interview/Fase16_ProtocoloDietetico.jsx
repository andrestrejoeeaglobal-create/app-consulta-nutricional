import React, { useState, useEffect } from 'react';
import tiloImg from '../../assets/tilo.png';

const Fase16_ProtocoloDietetico = ({ onPhaseComplete, setPatientData, messages, setMessages, registerInputHandler }) => {
    const [internalStep, setInternalStep] = useState('TDEE'); // TDEE, TARGET, CARBS, PROTEIN, FAT, CONSTRAINTS, FINAL
    const [tdee, setTdee] = useState('2200');
    const [target, setTarget] = useState('2000');
    const [macros, setMacros] = useState({ carbs: 40, protein: 30, fat: 30 });
    const [constraints, setConstraints] = useState({
        fodmaps: false, shelfStable: false, noDairy: false, noGluten: false
    });

    useEffect(() => {
        if (messages.length === 0 && internalStep === 'TDEE') {
            setMessages([
                {
                    role: 'assistant',
                    content: "⚖️ **Protocolo Dietético**\n\nVamos a definir los requerimientos energéticos y distribución de macronutrientes.\n\n¿Cuál es el TDEE Calculado (Gasto Energético Total) en kcal? (Ej: 2200)",
                    avatar: tiloImg
                }
            ]);
        }
    }, []);

    const handleSend = (userMsg) => {
        const addBotMsg = (msg, options = null) => {
            const newMsg = { role: "assistant", content: msg, avatar: tiloImg };
            if (options) newMsg.options = options;
            setMessages(prev => [...prev, newMsg]);
        };

        const val = parseInt(userMsg, 10);

        if (internalStep === 'TDEE') {
            if (isNaN(val) || val < 500) {
                addBotMsg("Por favor, ingresa un valor numérico válido para el TDEE (Ej: 2200).");
                return;
            }
            setTdee(val.toString());
            setInternalStep('TARGET');
            addBotMsg(`TDEE guardado: ${val} kcal.\n\n¿Cuál es la **Prescripción Final** (Déficit/Superávit) en kcal? (Ej: 2000)`);
        } 
        else if (internalStep === 'TARGET') {
            if (isNaN(val) || val < 500) {
                addBotMsg("Por favor, ingresa un valor numérico válido (Ej: 2000).");
                return;
            }
            setTarget(val.toString());
            setInternalStep('CARBS');
            addBotMsg(`Prescripción guardada: ${val} kcal.\n\nAhora la distribución de macros. ¿Qué **porcentaje de Carbohidratos**? (Ej: 40)`);
        }
        else if (internalStep === 'CARBS') {
            if (isNaN(val) || val < 0 || val > 100) {
                addBotMsg("Porcentaje inválido. Ingresa un número del 0 al 100.");
                return;
            }
            setMacros(prev => ({ ...prev, carbs: val }));
            setInternalStep('PROTEIN');
            addBotMsg(`Carbohidratos: ${val}%\n\n¿Qué **porcentaje de Proteínas**? (Ej: 30)`);
        }
        else if (internalStep === 'PROTEIN') {
            if (isNaN(val) || val < 0 || val > 100) {
                addBotMsg("Porcentaje inválido. Ingresa un número del 0 al 100.");
                return;
            }
            setMacros(prev => ({ ...prev, protein: val }));
            setInternalStep('FAT');
            addBotMsg(`Proteínas: ${val}%\n\n¿Qué **porcentaje de Lípidos**? (Ej: 30)`);
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

            setMacros(prev => ({ ...prev, fat: val }));
            setInternalStep('CONSTRAINTS');
            addBotMsg(
                `✅ Distribución perfecta (100%).\n\n` + 
                `Finalmente, ¿desea agregar alguna restricción logística o alimentaria dura? Puede seleccionar varias si es necesario. Si no, seleccione 'Ninguna'.`,
                [
                    { label: 'Protocolo Bajo en FODMAPS', value: 'FODMAPS' },
                    { label: "Logística 'Shelf Stable'", value: 'SHELF' },
                    { label: 'Sin Lácteos', value: 'NODAIRY' },
                    { label: 'Sin Gluten', value: 'NOGLUTEN' },
                    { label: 'Terminar y Consolidar Plan', value: 'DONE' }
                ]
            );
        }
        else if (internalStep === 'CONSTRAINTS') {
            if (userMsg === 'DONE') {
                setInternalStep('FINAL');
                
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
                setTimeout(() => onPhaseComplete('PHASE_17_DASHBOARD_RENDER'), 2000);
            } else {
                let label = "";
                setConstraints(prev => {
                    const next = { ...prev };
                    if (userMsg === 'FODMAPS') { next.fodmaps = true; label = "Bajo en FODMAPS"; }
                    if (userMsg === 'SHELF') { next.shelfStable = true; label = "Shelf Stable"; }
                    if (userMsg === 'NODAIRY') { next.noDairy = true; label = "Sin Lácteos"; }
                    if (userMsg === 'NOGLUTEN') { next.noGluten = true; label = "Sin Gluten"; }
                    return next;
                });
                addBotMsg(`Restricción **${label}** agregada. ¿Alguna más?`, [
                    { label: 'Protocolo Bajo en FODMAPS', value: 'FODMAPS' },
                    { label: "Logística 'Shelf Stable'", value: 'SHELF' },
                    { label: 'Sin Lácteos', value: 'NODAIRY' },
                    { label: 'Sin Gluten', value: 'NOGLUTEN' },
                    { label: 'Terminar y Consolidar Plan', value: 'DONE' }
                ]);
            }
        }
    };

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => handleSend);
        }
    }, [registerInputHandler, internalStep, tdee, target, macros, constraints]);

    return null;
};

export default Fase16_ProtocoloDietetico;
