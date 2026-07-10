import React, { useEffect, useState } from 'react';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';

export default function Fase13_ContextoEspecial({
    patientData,
    setPatientData,
    onPhaseComplete,
    registerInputHandler,
    messages,
    setMessages,
    setIsGlobalTyping
}) {
    const { pName, isMinor } = usePatientLinguistics(patientData);
    const [internalStep, setInternalStep] = useState('INIT');

    useEffect(() => {
        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Fase 7: Contexto Especial."));
        if (!alreadyGreeted) {
            setIsGlobalTyping(true);
            const timer = setTimeout(() => {
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: `Entendido.\n\nFase 7: Contexto Especial.\n\n${isMinor ? `¿Ha tenido ${pName} cirugías recientes, padece algún síndrome o situación particular importante para su plan nutricional?` : `¿Ha tenido cirugías recientes, padece algún síndrome o situación particular importante para su plan nutricional?`}`
                    }
                ]);
                setIsGlobalTyping(false);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(processStep);
        }
        return () => {
            if (registerInputHandler) registerInputHandler(null);
        };
    }, [internalStep, registerInputHandler]);

    const processStep = async (input) => {
        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsGlobalTyping(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        setPatientData(prev => ({
            ...prev,
            history: {
                ...prev.history,
                special_context: userMsg
            }
        }));

        const finalReply = {
            role: "assistant",
            content: `Excelente. He terminado de recabar todos los datos. Iniciare el análisis para generar el Diagnóstico Integral${isMinor ? ` de ${pName}` : ''}.`,
            inputType: 'analyzing'
        };

        setMessages(prev => [...prev, finalReply]);
        
        setTimeout(() => {
            if (onPhaseComplete) {
                onPhaseComplete('PHASE_14_ORCHESTRATION_START');
            }
        }, 2000);

        setIsGlobalTyping(false);
    };

    return null;
}
