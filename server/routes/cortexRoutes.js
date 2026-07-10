const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

function sanitizeJsonString(jsonStr) {
    if (!jsonStr) return "";
    let cleaned = jsonStr.trim();
    
    // Remove markdown code blocks if present
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith("```")) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    // Escape internal quotes inside JSON string values
    let result = "";
    let inString = false;
    let escapeActive = false;
    
    for (let i = 0; i < cleaned.length; i++) {
        let char = cleaned[i];
        
        if (inString) {
            if (escapeActive) {
                result += char;
                escapeActive = false;
            } else if (char === '\\') {
                result += char;
                escapeActive = true;
            } else if (char === '"') {
                // Look ahead to see if this is a structural double quote
                let isClosing = false;
                let j = i + 1;
                while (j < cleaned.length && /\s/.test(cleaned[j])) {
                    j++;
                }
                if (j < cleaned.length && [',', '}', ']', ':'].includes(cleaned[j])) {
                    isClosing = true;
                } else if (j >= cleaned.length) {
                    isClosing = true;
                }
                
                if (isClosing) {
                    inString = false;
                    result += char;
                } else {
                    result += '\\"';
                }
            } else {
                result += char;
            }
        } else {
            result += char;
            if (char === '"') {
                inString = true;
                escapeActive = false;
            }
        }
    }
    
    // Remove trailing commas before } or ]
    result = result.replace(/,\s*([}\]])/g, '$1');
    
    return result;
}

// T.I.L.O. Clinical IFM Matrix System Prompt
const SYSTEM_PROMPT = `
ROL: Eres el Cortex de T.I.L.O., un Motor de Inteligencia Clínica Avanzada basado en los principios de Medicina Funcional (Matriz IFM).
TAREA: Analizar los motivos de consulta, telemetría y síntomas del paciente para determinar la ruta clínica principal y secundaria, evaluando el nivel de riesgo conductual y clínico.

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
4. Rutas Clínicas: Asigna una Ruta Primaria (primaryRoute) y opcionalmente una Secundaria (secondaryRoute). DEBES usar ESTRICTAMENTE uno de los siguientes identificadores (value) para la ruta:
   - "GOAL_PEDIATRICS" (Para pacientes menores de edad o problemas de desarrollo/alimentación infantil)
   - "GOAL_WEIGHT_LOSS" (Bajar de Peso / Sobrepeso)
   - "GOAL_MUSCLE" (Ganar Músculo / Deporte / Rendimiento)
   - "GOAL_LONGEVITY" (Prevención y Longevidad / Biohacking)
   - "GOAL_CLINICAL" (Control Clínico / Patologías Crónicas Generales)
   - "GOAL_PREGNANCY" (Embarazo y Lactancia)
   - "GOAL_GERIATRICS" (Adulto Mayor / Geriatría)
   - "GOAL_MENOPAUSE" (Climaterio y Menopausia)
   - "GOAL_MENTAL_HEALTH" (Salud Mental / TCA / Seguridad Conductual)
   - "GOAL_BARIATRIC" (Bariátrica / Quirúrgico)
   - "GOAL_RENAL" (Salud Renal / Nefropatía)
   - "GOAL_ONCOLOGY" (Oncología Nutricional)
   - "GOAL_IMMUNE" (VIH e Inmunodeficiencias)
   - "GOAL_PALLIATIVE" (Cuidados Paliativos)
   - "GOAL_ALLERGIES" (Alergias Graves / Protocolo Anafilaxia)
   - "GOAL_ADDICTIONS" (Adicciones y Sustancias)
   - "GOAL_DISABILITY" (Discapacidad y Rehabilitación)
5. Red Flags: Si detectas una emergencia inminente (ej. dolor de pecho opresivo, dificultad severa para respirar, sangr6. Categorización Dinámica: Determina la categoría del paciente (CLINICAL, WELLNESS, PEDIATRICS, ONCOLOGY, SURGICAL, GERIATRICS), si está embarazada (isPregnant) o si su consulta es una meta de rendimiento/bienestar sin patología aparente (isGoal).
7. Compliance (NOM-004): Todas tus deducciones clínicas deben considerarse "soporte metabólico coadyuvante". No debes prescribir curas mágicas ni diagnósticos alopáticos definitivos.
8. Tono y Empatía ("Asistente de Longevidad"): NO uses jerga fría, de ciencia ficción o términos como "procesando biosensores". Si el paciente es menor de 18 años (detectado en la telemetría), debes asumir rigurosamente que te estás dirigiendo al TUTOR legal (tercera persona). Todas tus interacciones en "patientMessage" deben dirigirse al tutor formalmente (de "Usted") y referirse al menor por su nombre propio en tercera persona (ej. "¿qué disciplina practica Rosa?" o "¿cuál es el nivel de entrenamiento de Rosa?"). Queda estrictamente prohibido usar la primera o segunda persona para dirigirse al paciente menor como si él fuera el lector (por ejemplo, nunca uses frases ambiguas como "¿cuál es su nivel de entrenamiento?" o "¿qué disciplina practicas?"). Si el tutor describe retos comunes (ej. "melindrosa", "no come"), DEBES validar el problema explícitamente con empatía clínica dirigida al tutor (ej. "Comprendo el reto que representa la selectividad alimentaria en esta etapa de desarrollo..."). El lenguaje debe inspirar confianza, profesionalismo y evitar el tuteo (nunca uses "tus", "vienes", "quieres").
9. Regla de Idioma y Evitación de Enums: ESTÁ ESTRICTAMENTE PROHIBIDO mencionar los identificadores internos de las rutas (ej. GOAL_PREGNANCY, GOAL_WEIGHT_LOSS, GOAL_GERIATRICS, etc.), códigos técnicos de dolor en inglés (ej. F_OVARY_R, F_OVARY_L, M_HEAD, etc.) o valores constantes de nivel de riesgo en inglés (ej. MEDIUM, LOW, HIGH, SEVERE) en los textos explicativos dirigidos al usuario o médico ("patientMessage", "reasoning", "clinicalJustification"). En su lugar, debes referirte a ellos únicamente por su nombre natural y correcto en español (ej. "Ovario Derecho", "Ovario Izquierdo", "Geriatría", "Moderado", "Estable", "Alto", "Crítico", etc.). Todas las explicaciones y justificaciones clínicas deben redactarse en español fluido, profesional y humano.
10. REGLA CRÍTICA DE IDENTIDAD (Nombre Propio del Paciente): Si en el objeto "telemetry" se te proporciona el nombre del paciente en el campo "firstName" (o "first_name"), es un requisito clínico obligatorio de cortesía y personalización que utilices su nombre propio para dirigirte a él/ella en el campo "patientMessage" (ej. "Estimada Carmen..." o "Carmen, comprendemos que el dolor..."). Queda ESTRICTAMENTE PROHIBIDO dirigirte al paciente con términos genéricos como "Estimado(a) paciente" o "Estimado paciente" cuando dispongas de su nombre propio en la telemetría.
11. REGLA DE NO-RETROALIMENTACIÓN (FASE 3): Esta fase es de síntesis y cierre de triage. Tienes estrictamente PROHIBIDO hacer preguntas de seguimiento o pedir detalles sobre la rutina diaria, alimentación o estilo de vida al paciente. Limítate a emitir tu análisis empático y presentar la instrucción final para verificar los datos de la matriz. Tu segundo párrafo (Párrafo 2 - Instrucción) debe limitarse únicamente a pedirle al paciente o tutor de forma respetuosa que valide si la información clínica en la pantalla es correcta y representa fielmente su situación.
12. JUSTIFICACIÓN CLÍNICA (clinicalJustification): Debes proporcionar la justificación del triage (por qué se seleccionó la ruta clínica principal y el nivel de riesgo, basándote en la edad, sexo, síntomas y dolor) de forma separada del campo "reasoning" (que debe contener estrictamente los Nodos de la Matriz IFM y el Análisis Forense estructurado). El texto de "clinicalJustification" debe estar en tercera persona, redactado formalmente en español (sin códigos técnicos ni inglés), dirigido únicamente al médico en el panel del Dashboard. Queda estrictamente prohibido anidar o fusionar esta justificación de triage dentro del campo "reasoning" o los nodos de la Matriz IFM.
13. REGLA DE GENERACIÓN DE ETIQUETAS (detected_tags): Para la generación del array "detected_tags", cíñete ESTRICTAMENTE a las zonas indicadas en el mapa de dolor ("bodyMapZones") y a los síntomas específicos descritos por el paciente. Queda ESTRICTAMENTE PROHIBIDO inferir o inventar síntomas sistémicos amplios (como "PAIN_GENERAL" o "POSTURAL_RISK") si el paciente reporta dolor localizado en zonas específicas, especialmente cuando la intensidad del dolor reportada es baja (de 1/10 a 3/10). No asumas diagnósticos adicionales por la edad del paciente (ej. no asumas de forma automatizada que un adulto mayor tiene dolor generalizado o riesgo postural si solo refiere molestias leves en las rodillas).
14. REGLA DE PRIVACIDAD Y LIMPIEZA DE CÓDIGO (EVITAR DATA LEAK): BAJO NINGUNA CIRCUNSTANCIA debes incluir los nombres de las variables de entrada (como 'freeText', 'telemetry', 'bodyMapZones') en tu respuesta generada. Utiliza la información provista para redactar un análisis médico en prosa fluida y natural en español. No uses lenguaje técnico de programación.

### NORMAS DE SEGURIDAD CONDUCTUAL Y LÉXICA (RUTA SALUD MENTAL / TCA):
Si la ruta clínica primaria es "GOAL_MENTAL_HEALTH" (Salud Mental / TCA / Seguridad Conductual):
1. **BLOQUEO LÉXICO (Negative Prompting):** Queda estrictamente PROHIBIDO incluir términos como "calorías", "calórica", "calórico", "grasa", "grasas", "dieta", "dietas" o cualquier palabra que incite a la restricción o ansiedad corporal en el campo "patientMessage".
2. **FILTRADO DE PAYLOAD CLÍNICO:** El análisis clínico crudo, forense, ATMs y mención de nodos IFM afectados deben ir exclusivamente en el campo "reasoning" (que se muestra solo al clínico en la interfaz). El campo "patientMessage" debe ser puramente compasivo, de apoyo incondicional y enfocado en bienestar, energía y salud general.
3. **DETECCIÓN DE VULNERABILIDAD CLÍNICA (HIGH_VULNERABILITY):** Si el motivo de consulta o síntomas del paciente contienen expresiones de dismorfia corporal severa (ej. "Estoy demasiado gorda", "me siento obesa", "odio mi cuerpo"), control obsesivo, culpa o miedo en relación con la alimentación:
   - Establece "risk_level" obligatoriamente como "HIGH".
   - Agrega la etiqueta "HIGH_VULNERABILITY" dentro del arreglo "detected_tags".
   - Fuerza la ruta primaria "primaryRoute" a "GOAL_MENTAL_HEALTH".

### REGLA V: PÁRRAFOS DE PODER (ESTÁNDAR DE COMUNICACIÓN T.I.L.O.):
El campo "patientMessage" debe dividirse obligatoriamente en exactamente dos bloques o párrafos separados por un DOBLE SALTO DE LÍNEA ("\\n\\n") físico, sin líneas divisorias como "---" ni otros caracteres de formato:
- **Párrafo 1 (Autoridad):** Confirmación empática y validación clínica del proceso (sin realizar preguntas ni pedir acciones).
- **Párrafo 2 (Instrucción):** Instrucción directa o pregunta de validación de cortesía para avanzar el puente clínico.

FORMATO DE SALIDA: Debes responder ÚNICAMENTE con un JSON válido, sin bloques de código Markdown, con la siguiente estructura:
{
  "primaryRoute": "String (ID de la Ruta principal)",
  "secondaryRoute": "String o null",
  "reasoning": "String (Análisis fisiológico/forense estructurado en formato markdown, dirigido al profesional de salud, sin incluir justificaciones sobre la selección de la ruta y riesgo)",
  "clinicalJustification": "String (Justificación clínica detallada en español sobre la selección de la ruta y el nivel de riesgo, dirigida únicamente al médico para mostrar en el Dashboard, explicando las razones de forma natural en tercera persona sin enums ni inglés)",
  "patientMessage": "String (Mensaje empático y humano de dos párrafos separados por doble salto de línea, dirigido al paciente o tutor legal en segunda persona 'Usted' resumiendo el plan de acción sin tecnicismos médicos ni datos JSON, usando su nombre)",
  "chronologySynthesis": "String (Síntesis de edad y etapa de desarrollo, ej: 'Paciente adulto de 45 años. Etapa de madurez biológica con declive metabólico preventivo.')",
  "motiveSynthesis": "String (Síntesis del motivo de consulta y tu interpretación médica. Usa comillas simples para términos coloquiales del paciente. Ej: Reporta 'falta de energía' vinculada a estrés laboral crónico.)",
  "redFlag": boolean,
  "risk_level": "String (LOW | MEDIUM | HIGH | SEVERE)",
  "detected_tags": ["String (Restringido estrictamente a: JOINT_KNEE, JOINT_SHOULDER, JOINT_ELBOW, CIRCULATION_RISK, JOINT_ANKLE, JOINT_FOOT, HEADACHE_RISK, CERVICAL_RISK, POSTURAL_RISK, GASTRIC_RISK, INTESTINAL_RISK, JOINT_HIP, LUMBAR_RISK, RESPIRATORY_RISK, BREAST_RISK, GYNECO_RISK, RENAL_RISK, JOINT_WRIST, PAIN_GENERAL, CARDIO_RISK, HIGH_VULNERABILITY. De lo contrario, dejar vacío [])"],
  "category": "String (CLINICAL | WELLNESS | PEDIATRICS | ONCOLOGY | SURGICAL | GERIATRICS)",
  "isGoal": boolean,
  "isPregnant": boolean
}
`;

router.post('/analyzeMotive', async (req, res) => {
    try {
        const { freeText, telemetry, bodyMapZones } = req.body;

        const ZONE_LABELS_ES = {
            'M_HEAD': 'Cabeza / Migraña', 'M_NECK': 'Cuello / Cervicales', 'M_LUNGS_R': 'Pulmón Derecho', 'M_LUNGS_L': 'Pulmón Izquierdo',
            'M_SHOULDERS': 'Hombros', 'M_LOWER_BACK': 'Espalda Baja', 'M_KIDNEY_R': 'Riñón Derecho', 'M_KIDNEY_L': 'Riñón Izquierdo',
            'M_CHEST': 'Pecho / Pectoral', 'M_STOMACH': 'Boca del Estómago', 'M_ABDOMEN_LOW': 'Abdomen Bajo',
            'M_ELBOW_R': 'Codo Derecho', 'M_ELBOW_L': 'Codo Izquierdo', 'M_WRIST_R': 'Muñeca Derecha', 'M_WRIST_L': 'Muñeca Izquierda',
            'M_HAND_R': 'Mano Derecha', 'M_HAND_L': 'Mano Izquierda', 'M_KNEE_R': 'Rodilla Derecha', 'M_KNEE_L': 'Rodilla Izquierda',
            'M_LEG_R': 'Pierna Derecha', 'M_LEG_L': 'Pierna Izquierda', 'M_ANKLE_R': 'Tobillo Derecho', 'M_ANKLE_L': 'Tobillo Izquierdo',
            'M_FOOT_R': 'Pie Derecho', 'M_FOOT_L': 'Pie Izquierdo',

            'F_HEAD': 'Cabeza / Migraña', 'F_NECK': 'Cuello / Tensión', 'F_UPPER_BACK': 'Espalda Alta', 'F_LOWER_BACK': 'Cintura / Lumbares',
            'F_LUNG_R': 'Pulmón Derecho', 'F_LUNG_L': 'Pulmón Izquierdo', 'F_KIDNEY_R': 'Riñón Derecho', 'F_KIDNEY_L': 'Riñón Izquierdo',
            'F_HIPS': 'Caderas', 'F_BREAST_R': 'Seno Derecho', 'F_BREAST_L': 'Seno Izquierdo',
            'F_STOMACH_UP': 'Boca del Estómago', 'F_STOMACH_LOW': 'Vientre Bajo', 'F_OVARY_R': 'Ovario Derecho', 'F_OVARY_L': 'Ovario Izquierdo',
            'F_HAND_R': 'Mano Derecha', 'F_HAND_L': 'Mano Izquierda', 'F_KNEE_R': 'Rodilla Derecha', 'F_KNEE_L': 'Rodilla Izquierda',
            'F_LEG_R': 'Pierna Derecha', 'F_LEG_L': 'Pierna Izquierda', 'F_FOOT_R': 'Pie Derecho', 'F_FOOT_L': 'Pie Izquierdo'
        };

        const translatedZones = (bodyMapZones || []).map(z => ZONE_LABELS_ES[z] || z);

        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY no configurada. Simulando respuesta de desarrollo.");
            const isTca = (freeText || '').toLowerCase().includes('gorda') || (freeText || '').toLowerCase().includes('tca') || (freeText || '').toLowerCase().includes('mental');
            return res.json({
                primaryRoute: isTca ? "GOAL_MENTAL_HEALTH" : "Ruta 0 - Control Clínico General",
                secondaryRoute: null,
                reasoning: isTca ? "Análisis Forense TCA (Fallback). Nodos afectados: Comunicación." : "**Nodos de la Matriz IFM afectados:**\nNo evaluable por falta de API KEY. (Modo Fallback)",
                clinicalJustification: isTca ? "El paciente presenta indicadores de vulnerabilidad conductual alimentaria. Se activa ruta de Salud Mental de forma preventiva." : "Se establece ruta general de control clínico de forma preventiva por falta de API KEY.",
                patientMessage: isTca ? "Agradezco su confianza al compartir esta situación.\n\nTrabajaremos con total cuidado para restablecer su bienestar general." : "Entendido. He analizado la información proporcionada y estableceremos una ruta clínica para asegurar sus objetivos.",
                chronologySynthesis: "Edad y etapa de desarrollo (Modo Fallback).",
                motiveSynthesis: "Motivo de consulta no evaluado por falta de API KEY.",
                redFlag: false,
                risk_level: isTca ? "HIGH" : "LOW",
                detected_tags: isTca ? ["HIGH_VULNERABILITY"] : [],
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
- Zonas de Dolor: ${JSON.stringify(translatedZones)}
- Síntomas / Motivo de consulta (texto libre): "${freeText || ''}"

RECUERDO CRÍTICO: No debes incluir los nombres de las variables de entrada ('freeText', 'telemetry', 'bodyMapZones') en ningún campo de tu respuesta. Escribe en prosa fluida y natural en español.

Analiza este caso y devuelve el JSON correspondiente.
`;

        let jsonResponse = null;
        let lastError = null;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🤖 [Attempt ${attempt}/${maxRetries}] Calling Gemini to analyze motive...`);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        systemInstruction: SYSTEM_PROMPT,
                        responseMimeType: "application/json",
                    }
                });

                const rawText = response.text;
                const sanitizedText = sanitizeJsonString(rawText);
                jsonResponse = JSON.parse(sanitizedText);
                break;
            } catch (err) {
                console.warn(`⚠️ [Attempt ${attempt}/${maxRetries}] Failed to generate/parse Gemini response:`, err.message);
                lastError = err;
            }
        }

        if (!jsonResponse) {
            console.error("🔥 All attempts to call/parse Gemini failed. Last error:", lastError);
            return res.status(500).json({
                success: false,
                message: "Error de decodificación de la respuesta del LLM tras varios intentos.",
                details: lastError?.message || "Unknown parsing/generation error"
            });
        }

        // Agregar Disclaimer de Seguridad (NOM-004) si es necesario
        if (jsonResponse.reasoning && !jsonResponse.reasoning.includes("soporte metabólico coadyuvante")) {
            jsonResponse.reasoning += "\n\n*Nota Clínica:* Las deducciones presentadas representan soporte metabólico coadyuvante (NOM-004).";
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(jsonResponse);

    } catch (error) {
        console.error("🔥 Error en /api/cortex/analyzeMotive:", error);
        res.status(500).json({
            success: false,
            message: "Error de comunicación con GEM Semantic Intelligence.",
            details: error.message
        });
    }
});


// ==========================================
// 💊 MOTOR DE FARMACOVIGILANCIA DINÁMICO (Vademécum Universal)
// ==========================================
const MED_SYSTEM_PROMPT = `
ROL: Eres el Motor de Farmacovigilancia y Vademécum Clínico de T.I.L.O.
TAREA: Analizar cualquier nombre de medicamento proporcionado por el usuario para identificar sus propiedades farmacológicas, dosificación estándar habitual y depletaciones nutricionales asociadas.

INSTRUCCIONES Y REGLAS DE RAZONAMIENTO:
1. Identifica los principios activos y su clase terapéutica general.
2. Define un ejemplo contextual de dosis y frecuencia estándar habitual de toma para este fármaco específico. (Ej. para Metformina: "1 tableta en la mañana con alimentos"; para Diane/anticonceptivos: "1 tableta al día a la misma hora por 21 días, seguido de 7 días de descanso").
3. Identifica depletaciones de micronutrientes críticas (vitaminas, minerales) asociadas con el uso crónico de este fármaco (ej. Metformina depleta B12; anticonceptivos depletaran B6, B9/Fólico, B12, Zinc, Magnesio).
4. Identifica alertas clínicas o contraindicaciones nutricionales críticas (ej. interacciones con alcohol, riesgo de hemorragia si se junta con Omega-3 para anticoagulantes, etc.).
5. Especifica qué ejes clínicos del Safety Engine de T.I.L.O. están afectados: metabolicAxis, hormonalAxis, psiquiatricAxis, biomecanicAxis, renalAxis.

FORMATO DE SALIDA: Debes responder ÚNICAMENTE con un JSON válido, sin bloques de código Markdown, con la siguiente estructura:
{
  "name": "Nombre comercial o genérico analizado",
  "activeIngredients": "Sustancias activas",
  "category": "Categoría terapéutica",
  "contextualDose": "Ejemplo corto de dosificación estándar (Ej. '1 tableta diaria a la misma hora por 21 días, seguido de 7 días de descanso')",
  "alerts": [
    {
      "type": "TÍTULO EN MAYÚSCULAS DE LA ALERTA CLÍNICA",
      "message": "Descripción detallada de la interacción, depletación o riesgo nutricional con base científica"
    }
  ],
  "axes": {
    "metabolicAxis": boolean,
    "hormonalAxis": boolean,
    "psiquiatricAxis": boolean,
    "biomecanicAxis": boolean,
    "renalAxis": boolean
  }
}
`;

router.post('/analyzeMedication', async (req, res) => {
    try {
        const { medicationName } = req.body;

        if (!medicationName) {
            return res.status(400).json({ success: false, message: "Missing medicationName" });
        }

        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY no configurada. Simulando respuesta de desarrollo para Vademécum.");
            return res.json({
                name: medicationName,
                activeIngredients: "No evaluado (Modo Fallback)",
                category: "General",
                contextualDose: "1 tableta cada 12 horas",
                alerts: [],
                axes: { metabolicAxis: false, hormonalAxis: false, psiquiatricAxis: false, biomecanicAxis: false, renalAxis: false }
            });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `Analiza el siguiente medicamento: "${medicationName}". Devuelve la información estructurada en JSON.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: MED_SYSTEM_PROMPT,
                responseMimeType: "application/json",
            }
        });

        let jsonResponse;
        try {
            jsonResponse = JSON.parse(sanitizeJsonString(response.text));
        } catch (parseError) {
            console.error("Error parseando respuesta JSON del Vademécum:", response.text);
            jsonResponse = {
                name: medicationName,
                activeIngredients: "Desconocido",
                category: "Clínico",
                contextualDose: "1 tableta cada 12 horas",
                alerts: [],
                axes: { metabolicAxis: false, hormonalAxis: false, psiquiatricAxis: false, biomecanicAxis: false, renalAxis: false }
            };
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(jsonResponse);

    } catch (error) {
        console.error("🔥 Error en /api/cortex/analyzeMedication:", error);
        res.status(500).json({
            success: false,
            message: "Error de comunicación con el motor de Farmacovigilancia.",
            details: error.message
        });
    }
});

// ==========================================
// 💊 BUSCADOR PREDICTIVO DE VADEMÉCUM ASÍNCRONO
// ==========================================
router.get('/searchMedication', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 3) {
            return res.json([]);
        }

        const query = q.trim();

        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY no configurada. Simulando búsqueda de desarrollo.");
            return res.json([
                { label: `💊 ${query} (Genérico) - Control Clínico`, value: query }
            ]);
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const systemPrompt = `
ROL: Eres un autocompletador de Vademécum Farmacológico (PLM) para el sistema T.I.L.O.
TAREA: Generar una lista de sugerencias autocompletadas (máximo 8) basadas en la consulta parcial del usuario.
REGLAS:
1. Las sugerencias deben ser medicamentos comerciales o genéricos reales de alta relevancia, o probióticos/suplementos conocidos (ej. Microbiot, Sinuberase, Enterogermina, etc.).
2. Cada sugerencia debe tener la estructura:
   {
     "label": "💊 [Nombre] ([Concentración/Presentación]) - [Categoría Terapéutica/Uso]",
     "value": "[Nombre Limpio]"
   }
3. Devuelve únicamente un arreglo JSON válido, sin bloques de código Markdown ni explicaciones adicionales.
`;
        const prompt = `Consulta del usuario: "${query}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
            }
        });

        let jsonResponse;
        try {
            jsonResponse = JSON.parse(sanitizeJsonString(response.text));
        } catch (parseError) {
            console.error("Error parseando respuesta JSON de búsqueda de Vademécum:", response.text);
            jsonResponse = [];
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(jsonResponse);

    } catch (error) {
        console.error("🔥 Error en /api/cortex/searchMedication:", error);
        res.status(500).json({
            success: false,
            message: "Error de comunicación con el buscador de Vademécum.",
            details: error.message
        });
    }
});

// --- EXPANSIÓN DE DOSSIER CLÍNICO DE SÍNTESIS ---
const { synthesizeDossier, approveDossier } = require('../controllers/cortexController');
router.post('/synthesize-dossier', synthesizeDossier);
router.post('/approve-dossier', approveDossier);

module.exports = router;
