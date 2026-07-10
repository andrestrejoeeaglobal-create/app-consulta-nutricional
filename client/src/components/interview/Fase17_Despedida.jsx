import React, { useEffect } from 'react';
import tiloImg from "../../assets/tilo.png";

const Fase17_Despedida = ({ patientData, messages, setMessages, registerInputHandler }) => {

    useEffect(() => {
        const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Consulta Finalizada"));
        if (!alreadyGreeted) {
            setMessages(prev => [
                ...prev,
                {
                    role: "assistant",
                    content: "✅ **Consulta Finalizada**\n\nEl expediente ha sido cerrado y guardado correctamente.\n\nCediendo el control total al Bio-Arquitecto para la explicación final del plan al paciente.\n\n---\n**Estatus del Sistema:**\n- Sincronización de Datos: Completa\n- Protocolo Dietético: Generado\n- Esclusa Legal: Firmada",
                    avatar: tiloImg,
                    inputType: 'none' // Disable input
                }
            ]);
            console.log("Consulta finalizada. Datos consolidados:", patientData);
        }
    }, []);

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => () => {}); // No-op handler
        }
    }, [registerInputHandler]);

    return null;
};

export default Fase17_Despedida;
