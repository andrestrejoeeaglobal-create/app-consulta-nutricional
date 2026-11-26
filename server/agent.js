const express = require('express');
const router = express.Router();

// Estado en memoria (para demo simple, idealmente DB)
// En producción, esto debe ser stateless o usar Redis
const sessions = {};

const SYSTEM_PROMPT = `
Eres NutriGenius (T.I.L.O.), Companion Clínico de Élite diseñado para el Triaje y la Extracción de Motivos de Consulta.
Su objetivo AHORA es analizar el MOTIVO DE CONSULTA (Texto Libre) proporcionado por el paciente y generar una "Síntesis Diagnóstica" profunda bajo trato estricto de "Usted Global".

**DIRECTIVAS MAESTRAS DE ANÁLISIS (FASE 3):**
1. **Sistema de Detección de Impacto de Vida (SDIV)**: No solo lea el síntoma, detecte CÓMO afecta su vida (dolor, frustración, pérdida de función).
2. **Protocolo Detective**: Identifique la raíz estructural. Si indica "quiero bajar de peso para mi boda", el objetivo es estético/ganar confianza. Si indica "me duelen las rodillas al subir escaleras por mi peso", el objetivo es funcional/salud articular.
3. **Escudo Psiquiátrico**: Si detecta desesperación severa, trauma activo, ideación suicida o TCA (Trastorno de Conducta Alimentaria) severo, levante una bandera roja en "ecosystem_alerts".
4. **Ancla Emocional**: Formule UNA frase empática y potente en segunda persona formal ("Usted") que valide su esfuerzo por buscar ayuda y le brinde esperanza realista.

**SALIDA REQUERIDA (OBLIGATORIO JSON, SIN MARKDOWN, SIN TEXTO FUERA DEL JSON):**
{
  "detective_radiography": {
    "intensity_perceived": "Leve | Moderada | Severa | Crítica",
    "core_driver": "Estético | Funcional | Clínico | Emocional",
    "urgency": "Rutina | Atención Prioritaria | Red Flag"
  },
  "emotional_anchor": "Frase empática, cálida y resolutiva en trato de Usted (máx 2 líneas).",
  "ecosystem_alerts": {
    "psychiatric_flag": boolean,
    "metabolic_red_flag": boolean,
    "pain_amplifier": boolean
  }
}
`;

// Simulación de respuesta IA (O conexión a Gemini API aquí)
async function generateAIResponse(history, userMessage, session_context) {
    // INYECCIÓN AL LLM (System Prompt Injection)
    let currentSystemPrompt = SYSTEM_PROMPT;
    if (session_context && session_context.system_prompt_addon) {
        currentSystemPrompt = session_context.system_prompt_addon + "\n\n" + SYSTEM_PROMPT;
    }
    // 1. Detección de RED FLAGS (Regex simple por seguridad)
    const redFlags = /suicidi|morir|matarme|dolor de pecho|no puedo respirar|asfixia|desmayo/i;
    if (redFlags.test(userMessage)) {
        return {
            content: "⚠️ **ALERTA MÉDICA DETECTADA**\n\nHe detectado una situación de riesgo vital. Por seguridad, **debo suspender esta consulta**.\n\nPor favor, comuníquese inmediatamente al **911** o acuda al servicio de urgencias más cercano.\n\n[SISTEMA BLOQUEADO]",
            action: "LOCK_CHAT"
        };
    }

    // 2. Lógica de Simulación (Fallback si no hay LLM)
    const lowerMsg = userMessage.toLowerCase();

    let intensity = "Moderada";
    let driver = "Metabólico";
    let urgency = "Rutina";
    let anchor = "He leído atentamente lo que usted nos comparte. Comprendo perfectamente lo importante que es esto para usted en este momento. Nuestra misión a partir de hoy es brindarle las herramientas clínicas y nutricionales para que recupere el equilibrio integral de su organismo.";
    let painAmplifier = false;
    let metabolic = false;
    let psych = false;

    if (lowerMsg.includes("dolor") || lowerMsg.includes("sufro")) {
        intensity = "Severa";
        driver = "Clínico";
        urgency = "Atención Prioritaria";
        painAmplifier = true;
        anchor = "El malestar que usted describe requiere atención estructurada. Analizaremos su historial completo para identificar los factores inflamatorios y metabólicos, acompañando la recuperación funcional de su organismo.";
    } else if (lowerMsg.includes("depresi") || lowerMsg.includes("ansi") || lowerMsg.includes("ansiedad")) {
        intensity = "Severa";
        driver = "Emocional";
        psych = true;
        anchor = "Su bienestar emocional y metabólico están estrechamente vinculados. Reconocerlo es el primer gran pilar; construiremos un protocolo que acompañe tanto su metabolismo como su equilibrio neuroendocrino.";
    }

    const mockJsonResponse = {
        detective_radiography: {
            intensity_perceived: intensity,
            core_driver: driver,
            urgency: urgency
        },
        emotional_anchor: anchor,
        ecosystem_alerts: {
            psychiatric_flag: psych,
            metabolic_red_flag: metabolic,
            pain_amplifier: painAmplifier
        }
    };

    return { content: JSON.stringify(mockJsonResponse), action: "CONTINUE_PHASE_3" };
}

router.post('/chat', async (req, res) => {
    const { message, sessionId, session_context } = req.body;

    if (!sessions[sessionId]) {
        sessions[sessionId] = [];
    }

    // Guardar mensaje usuario
    sessions[sessionId].push({ role: 'user', content: message });

    // Generar respuesta
    try {
        const aiResponse = await generateAIResponse(sessions[sessionId], message, session_context);

        // Guardar respuesta IA
        sessions[sessionId].push({ role: 'assistant', content: aiResponse.content });

        res.json({
            reply: aiResponse.content,
            action: aiResponse.action
        });

    } catch (error) {
        console.error("Error AI:", error);
        res.status(500).json({ reply: "Disculpe, ocurrió una interrupción temporal de comunicación. ¿Podría repetir su mensaje, por favor?" });
    }
});

module.exports = router;
