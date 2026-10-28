import React, { useState, useEffect } from 'react';
import tiloImg from '../../assets/tilo.png';

const mockSuggestions = [
    {
        id: 'sup_33plus',
        cortex: '33Plus (Ignición Mitocondrial)',
        name: '33 PLUS - Semilla de Uva, Cromo (200mcg) y L-Teanina (200mg)',
        dosage: '1 toma al día (disuelto en agua temp. ambiente)',
        timing: 'Por la mañana con el primer alimento',
        rationale: 'Optimización de microcirculación, oxigenación tisular diurna y regulación de sensibilidad a la insulina.',
        status: 'approved'
    },
    {
        id: 'sup_34plus',
        cortex: '34Plus (Ingeniería Tisular)',
        name: '34 PLUS - Colágeno Hidrolizado, Vit C, L-Arginina e Inulina de Agave',
        dosage: '1 toma al día (disuelto en MÍNIMO 500 ml de agua 💧)',
        timing: 'Por la noche (60 min antes de dormir)',
        rationale: 'Reparación de matriz extracelular durante el sueño. La hidratación en 500ml es obligatoria para prevenir retraso del vaciado gástrico y no interrumpir el sistema glinfático cerebral.',
        status: 'approved'
    }
];

// Diccionario de traducción clínica de contingencia (Cero enums/variables en inglés en UI)
const SOMATIC_TRANSLATE_MAP = {
    'RETICULAR_ERYTHEMA': 'Eritema Reticular',
    'PUNCTATE_MACULES': 'Máculas Puntiformes',
    'MICROPAPULAR_ERUPTION': 'Erupción Micropapular',
    'PERIFOLLICULAR_INVOLVEMENT': 'Compromiso Perifolicular',
    'CUTANEOUS_EDEMA_SUPERFICIAL': 'Edema Cutáneo Superficial',
    'SUPERFICIAL_CUTANEOUS_EDEMA': 'Edema Cutáneo Superficial',
    'CHRONIC_VENOUS_INSUFFICIENCY_DETECTED': 'Insuficiencia Venosa Crónica',
    'CHRONIC_VENOUS_INSUFFICIENCY': 'Insuficiencia Venosa Crónica',
    'VARICOSE_VEINS_HIGH_RISK': 'Riesgo Elevado de Várices',
    'VENOUS_STASIS_DERMATITIS': 'Dermatitis por Estasis Venosa',
    'EDEMA_PERIPHERAL_MODERATE': 'Edema Periférico Moderado',
    'PERIPHERAL_EDEMA': 'Edema Periférico',
    'HYPERPIGMENTATION': 'Hiperpigmentación Cutánea',
    'HEMOSIDERIN_PIGMENTATION': 'Pigmentación por Hemosiderina',
    'FOLLICULAR_HYPERKERATOSIS': 'Hiperqueratosis Folicular',
    'XEROSIS_CUTIS': 'Xerosis Cutánea (Piel Seca)',
    'TELANGIECTASIA': 'Telangiectasias Superficiales',
    'VENOUS_ECTASIA': 'Ectasia Venosa'
};

function cleanClinicalRationale(text) {
    if (!text) return '';
    let str = String(text);
    Object.entries(SOMATIC_TRANSLATE_MAP).forEach(([key, val]) => {
        const regex = new RegExp('\\b' + key + '\\b', 'gi');
        str = str.replace(regex, val);
    });
    return str;
}

const Fase15_SuplementacionAv = ({ patientData, onPhaseComplete, setPatientData, messages, setMessages, registerInputHandler }) => {
    const [suggestions, setSuggestions] = useState(mockSuggestions);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [internalStep, setInternalStep] = useState('INTRO'); // INTRO, REVIEWING, ADJUST_DOSAGE, ADJUST_TIMING, FINAL

    // Cruce de Seguridad (Fase 20): Bloqueo de Energizantes y Cafeína (NOM-028 / NOM-004)
    const hasStimulantsConflict = () => {
        const habits = patientData?.habits || patientData?.clinical_context?.habits;
        const hasCaffeineHistory = habits?.caffeine?.consumed === 'yes' || 
                                   habits?.stimulants?.consumed === 'yes' ||
                                   habits?.drugs?.stimulants === 'yes' ||
                                   habits?.consumption?.stimulants === true;
        
        const medications = patientData?.history?.medications || [];
        const hasConflictMeds = medications.some(m => {
            const mName = (m.name || '').toLowerCase();
            return mName.includes('estimulante') || 
                   mName.includes('metilfenidato') || 
                   mName.includes('anfetamina') || 
                   mName.includes('antidepresivo') ||
                   mName.includes('ansiolítico') ||
                   mName.includes('ansiolitico') ||
                   mName.includes('clonazepam') ||
                   mName.includes('diazepam') ||
                   mName.includes('fluoxetina') ||
                   mName.includes('sertralina') ||
                   mName.includes('acidosis') ||
                   mName.includes('metformina');
        });

        return hasCaffeineHistory || hasConflictMeds;
    };

    useEffect(() => {
        const backendSupplements = patientData?.clinical_dossier?.orthomolecular_prescription?.supplements;
        const baseList = Array.isArray(backendSupplements) && backendSupplements.length > 0
            ? backendSupplements
            : mockSuggestions;

        const conflict = hasStimulantsConflict();
        if (conflict) {
            // Reemplazar energizantes o té verde por alternativas libres de cafeína (Maca/L-Teanina pura)
            const filtered = baseList.map(s => {
                const sName = (s.name || '').toLowerCase();
                if (sName.includes('té verde') || sName.includes('guaraná') || sName.includes('cafeína') || sName.includes('taurina')) {
                    return {
                        ...s,
                        name: 'L-Teanina Pura (Nootrópico Libre de Estimulantes)',
                        rationale: '⚠️ BLOQUEO DE SEGURIDAD (NOM-028): Se suspendió el Extracto de Té Verde/Cafeína por cruce de riesgos con su historial de fármacos activos o estimulantes. Se receta L-Teanina pura para soporte cognitivo y control de estrés sin sobreestimular el SNC.',
                        dosage: '150mg al día'
                    };
                }
                return s;
            });
            setSuggestions(filtered);
        } else {
            setSuggestions(baseList);
        }
    }, [patientData]);

    useEffect(() => {
        if (internalStep === 'INTRO' && setMessages) {
            setMessages(prev => {
                const targetText = "Suplementación Avanzada (33Plus / 34Plus)";
                // Deduplicación atómica y purga de mensajes gemelos en historial
                let seen = false;
                const cleaned = prev.filter(msg => {
                    if (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.includes(targetText)) {
                        if (seen) return false;
                        seen = true;
                        return true;
                    }
                    return true;
                });

                if (seen) {
                    return cleaned.length !== prev.length ? cleaned : prev;
                }

                return [
                    ...cleaned,
                    {
                        role: 'assistant',
                        content: "🔬 **Cortex de Suplementación Avanzada (33Plus / 34Plus)**\n\n---\n\nHe formulado un protocolo de suplementación sugerido para el paciente. Recuerde que la IA actúa únicamente como soporte a la decisión clínica (CANDADO LEGAL COFEPRIS / NOM-004).\n\n¿Desea revisar las sugerencias una por una para aprobarlas, rechazarlas o ajustarlas?",
                        avatar: tiloImg,
                        options: [
                            { label: 'Iniciar Revisión', value: 'INICIAR' },
                            { label: 'Omitir Suplementación', value: 'OMITIR' }
                        ]
                    }
                ];
            });
        }
    }, [internalStep, setMessages]);

    const handleSend = (userMsg) => {
        const addBotMsg = (msg, options = null) => {
            const newMsg = { role: "assistant", content: msg, avatar: tiloImg };
            if (options) newMsg.options = options;
            setMessages(prev => [...prev, newMsg]);
        };

        if (internalStep === 'INTRO') {
            if (userMsg === 'OMITIR') {
                addBotMsg("Entendido. Omitiendo la suplementación avanzada.");
                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        advanced_supplementation: []
                    }));
                }
                setInternalStep('FINAL');
                setTimeout(() => onPhaseComplete('PHASE_16_DIETARY_PROTOCOL'), 1000);
            } else {
                setInternalStep('REVIEWING');
                presentSuggestion(0);
            }
        } else if (internalStep === 'REVIEWING') {
            const current = suggestions[currentIndex];
            if (userMsg === 'APROBAR') {
                const newSugs = [...suggestions];
                newSugs[currentIndex].status = 'approved';
                setSuggestions(newSugs);
                addBotMsg(`✅ Aprobado: ${current.name}`);
                goToNextSuggestion(newSugs);
            } else if (userMsg === 'RECHAZAR') {
                const newSugs = [...suggestions];
                newSugs[currentIndex].status = 'rejected';
                setSuggestions(newSugs);
                addBotMsg(`❌ Rechazado: ${current.name}`);
                goToNextSuggestion(newSugs);
            } else if (userMsg === 'AJUSTAR') {
                setInternalStep('ADJUST_DOSAGE');
                addBotMsg(`¿Cuál es la nueva dosis para **${current.name}**? (Actual: ${current.dosage})`);
            }
        } else if (internalStep === 'ADJUST_DOSAGE') {
            const newSugs = [...suggestions];
            newSugs[currentIndex].dosage = userMsg;
            setSuggestions(newSugs);
            setInternalStep('ADJUST_TIMING');
            addBotMsg(`¿Cuál es la nueva indicación/horario para **${newSugs[currentIndex].name}**? (Actual: ${newSugs[currentIndex].timing})`);
        } else if (internalStep === 'ADJUST_TIMING') {
            const newSugs = [...suggestions];
            newSugs[currentIndex].timing = userMsg;
            newSugs[currentIndex].status = 'approved';
            setSuggestions(newSugs);
            setInternalStep('REVIEWING');
            addBotMsg(`✅ Ajuste Guardado: ${newSugs[currentIndex].name} - ${newSugs[currentIndex].dosage}, ${newSugs[currentIndex].timing}`);
            goToNextSuggestion(newSugs);
        }
    };

    const presentSuggestion = (index) => {
        const current = suggestions[index];
        const addBotMsg = (msg, options = null) => {
            const newMsg = { role: "assistant", content: msg, avatar: tiloImg };
            if (options) newMsg.options = options;
            setMessages(prev => [...prev, newMsg]);
        };

        const cleanRationale = cleanClinicalRationale(current.rationale);
        const cleanName = cleanClinicalRationale(current.name);

        addBotMsg(
            `💊 **Sugerencia ${index + 1} de ${suggestions.length}**\n\n` +
            `• **Motor:** ${current.cortex}\n\n` +
            `• **Suplemento:** ${cleanName}\n\n` +
            `• **Dosis:** ${current.dosage}\n\n` +
            `• **Indicación:** ${current.timing}\n\n` +
            `🧠 **Racional Clínico:**\n${cleanRationale}\n\n` +
            `¿Qué acción desea tomar?`,
            [
                { label: 'Aprobar', value: 'APROBAR' },
                { label: 'Rechazar', value: 'RECHAZAR' },
                { label: 'Ajustar', value: 'AJUSTAR' }
            ]
        );
    };

    const goToNextSuggestion = (currentSuggestions) => {
        const nextIndex = currentIndex + 1;
        if (nextIndex < currentSuggestions.length) {
            setCurrentIndex(nextIndex);
            setTimeout(() => {
                presentSuggestion(nextIndex);
            }, 500);
        } else {
            setInternalStep('FINAL');
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "✅ **Revisión Completada**\n\nEl protocolo de suplementación ha sido consolidado y será incluido en el plan de acción.",
                avatar: tiloImg
            }]);
            
            if (setPatientData) {
                setPatientData(prev => ({
                    ...prev,
                    advanced_supplementation: currentSuggestions.filter(s => s.status === 'approved')
                }));
            }
            setTimeout(() => onPhaseComplete('PHASE_16_DIETARY_PROTOCOL'), 2000);
        }
    };

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => handleSend);
        }
    }, [registerInputHandler, internalStep, currentIndex, suggestions]);

    return null;
};

export default Fase15_SuplementacionAv;
