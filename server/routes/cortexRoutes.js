const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

// T.I.L.O. Clinical IFM Matrix System Prompt
const SYSTEM_PROMPT = `
ROL: Eres el Cortex de T.I.L.O., un Motor de Inteligencia Clínica Avanzada basado en los principios de Medicina Funcional (Matriz IFM).
TAREA: Analizar los motivos de consulta, telemetría y síntomas del paciente para determinar la ruta clínica principal y secundaria.

INSTRUCCIONES Y REGLAS DE RAZONAMIENTO:
1. Análisis Forense: Evalúa la "freeText" (síntomas), "telemetry" (edad, sexo, ubicación geográfica/altitud) y "bodyMapZones" (zonas de dolor).
2. Modelo ATM (Antecedentes, Desencadenantes y Mediadores): Identifica posibles predisposiciones, triggers y mantenedores del cuadro clínico basado en los pocos datos disponibles.
3. Nodos de la Matriz IFM: Tu razonamiento DEBE hacer referencia explícita a qué nodos están afectados. Usa estrictamente estos 7 nodos:
   - Asimilación (Digestión, Respiración)
   - Defensa y Reparación (Inmunidad, Infección, Inflamación)
   - Energía (Función Mitocondrial, Hipoxia)
   - Biotransformación y Eliminación (Toxicidad, Detox)
   - Transporte (Cardiovascular, Linfático)
   - Comunicación (Hormonas, Neurotransmisores)
   - Integridad Estructural (Barreras, Membranas, Musculoesquelético)
4. Rutas Clínicas (1-17): Asigna una Ruta Primaria y opcionalmente una Secundaria. Usa el identificador explícito (ej. "ROUTE_13" o "ROUTE_4") o el nombre estandarizado (ej. "Ruta 13 - Fisiología de la Altitud", "Ruta 4 - Disfunción Cardiometabólica", "Ruta 7 - Inmunomodulación"). 
5. Red Flags: Si detectas una emergencia inminente (ej. dolor de pecho opresivo, dificultad severa para respirar, sangrado profuso), marca redFlag como true.
6. Categorización Dinámica: Determina la categoría del paciente (CLINICAL, WELLNESS, PEDIATRICS, ONCOLOGY, SURGICAL, GERIATRICS), si está embarazada (isPregnant) o si su consulta es una meta de rendimiento/bienestar sin patología aparente (isGoal).
7. Compliance (NOM-004): Todas tus deducciones clínicas deben considerarse "soporte metabólico coadyuvante". No debes prescribir curas mágicas ni diagnósticos alopáticos definitivos.

FORMATO DE SALIDA: Debes responder ÚNICAMENTE con un JSON válido, sin bloques de código Markdown, con la siguiente estructura:
{
  "primaryRoute": "String (ID o Nombre de la Ruta principal)",
  "secondaryRoute": "String o null",
  "reasoning": "String (Explicación profunda mencionando los ATMs, Nodos de la Matriz IFM afectados y el cruce forense de telemetría y síntomas)",
  "redFlag": boolean,
  "category": "String (CLINICAL | WELLNESS | PEDIATRICS | ONCOLOGY | SURGICAL | GERIATRICS)",
  "isGoal": boolean,
  "isPregnant": boolean
}
`;

router.post('/analyzeMotive', async (req, res) => {
    try {
        const { freeText, telemetry, bodyMapZones } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY no configurada. Simulando respuesta de desarrollo.");
            // Fallback si no hay API KEY
            return res.json({
                primaryRoute: "Ruta 0 - Control Clínico General",
                secondaryRoute: null,
                reasoning: "**Nodos de la Matriz IFM afectados:**\nNo evaluable por falta de API KEY. (Modo Fallback)",
                redFlag: false,
                category: "CLINICAL",
                isGoal: false,
                isPregnant: false,
                isSimulated: true
            });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const prompt = `
Contexto del Paciente:
- Telemetría: ${JSON.stringify(telemetry || {})}
- Zonas de Dolor: ${JSON.stringify(bodyMapZones || [])}
- Síntomas / Motivo de consulta (texto libre): "${freeText || ''}"

Analiza este caso y devuelve el JSON correspondiente.
`;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: "application/json",
            }
        });

        let jsonResponse;
        try {
            jsonResponse = JSON.parse(response.text);
        } catch (parseError) {
            console.error("Error parseando respuesta JSON de Gemini:", response.text);
            jsonResponse = {
                primaryRoute: "Ruta 0 - Control Clínico General",
                secondaryRoute: null,
                reasoning: "Error interno al decodificar la respuesta del LLM. Por favor, intente de nuevo.",
                redFlag: false,
                category: "CLINICAL",
                isGoal: false,
                isPregnant: false
            };
        }

        // Agregar Disclaimer de Seguridad (NOM-004) si es necesario
        if (jsonResponse.reasoning && !jsonResponse.reasoning.includes("soporte metabólico coadyuvante")) {
            jsonResponse.reasoning += "\n\n*Nota Clínica:* Las deducciones presentadas representan soporte metabólico coadyuvante (NOM-004).";
        }

        res.json(jsonResponse);

    } catch (error) {
        console.error("🔥 Error en /api/cortex/analyzeMotive:", error.message);
        res.status(500).json({
            success: false,
            message: "Error de comunicación con GEM Semantic Intelligence."
        });
    }
});

module.exports = router;
