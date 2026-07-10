import React, { useState, useEffect } from 'react';
import tiloImg from '../../assets/tilo.png';

const mockSuggestions = [
    {
        id: 'sup_1',
        cortex: '34Plus (Metabólico)',
        name: 'Inulina de Agave',
        dosage: '10g al día',
        timing: 'En ayuno con agua natural',
        rationale: 'Modulación de microbiota y mejora en sensibilidad a la insulina.',
        status: 'pending' // pending | approved | rejected | adjusted
    },
    {
        id: 'sup_2',
        cortex: '33Plus (Neuro-cognitivo)',
        name: 'L-Teanina + Extracto de Té Verde',
        dosage: '200mg',
        timing: 'Por la mañana',
        rationale: 'Neuroprotección y control de picos de cortisol inducidos por estrés.',
        status: 'pending'
    },
    {
        id: 'sup_3',
        cortex: '34Plus (Celular)',
        name: 'Picolinato de Cromo',
        dosage: '200mcg',
        timing: 'Con la comida principal',
        rationale: 'Manejo de picos glucémicos postprandiales (Evidencia NOM-043).',
        status: 'pending'
    }
];

const Fase15_SuplementacionAv = ({ onPhaseComplete, setPatientData, messages, setMessages, registerInputHandler }) => {
    const [suggestions, setSuggestions] = useState(mockSuggestions);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [internalStep, setInternalStep] = useState('INTRO'); // INTRO, REVIEWING, ADJUST_DOSAGE, ADJUST_TIMING, FINAL

    useEffect(() => {
        if (internalStep === 'INTRO') {
            const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Suplementación Avanzada"));
            if (!alreadyGreeted) {
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: "🔬 **Cortex de Suplementación Avanzada (33Plus / 34Plus)**\n\n---\n\nHe formulado un protocolo de suplementación sugerido para el paciente. Recuerde que la IA actúa únicamente como soporte a la decisión clínica (CANDADO LEGAL COFEPRIS / NOM-004).\n\n¿Desea revisar las sugerencias una por una para aprobarlas, rechazarlas o ajustarlas?",
                        avatar: tiloImg,
                        options: [
                            { label: 'Iniciar Revisión', value: 'INICIAR' },
                            { label: 'Omitir Suplementación', value: 'OMITIR' }
                        ]
                    }
                ]);
            }
        }
    }, [internalStep]);

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

        addBotMsg(
            `💊 **Sugerencia ${index + 1} de ${suggestions.length}**\n\n` +
            `**Motor:** ${current.cortex}\n` +
            `**Suplemento:** ${current.name}\n` +
            `**Dosis:** ${current.dosage}\n` +
            `**Indicación:** ${current.timing}\n\n` +
            `🧠 **Racional:** ${current.rationale}\n\n` +
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
