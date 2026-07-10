// client/src/utils/EmpathyEngine.js

/**
 * EmpathyEngine V3.0 - Motor Simulado del Cortex T.I.L.O.
 * Analiza el texto de los síntomas del paciente y devuelve una respuesta empática, 
 * congruente y estructurada según los "Párrafos de Poder" de Equipo en Acción.
 */

// Categorías Clínica y Palabras Clave
const ONCOLOGY_KEYWORDS = ['cancer', 'cáncer', 'tumor', 'quimio', 'radioterapia', 'maligno', 'oncolog', 'metástasis'];
const SURGERY_KEYWORDS = ['operacion', 'operación', 'cirugia', 'cirugía', 'quirofano', 'quirófano', 'extirpar', 'amputar', 'trasplante'];
const PAIN_KEYWORDS = ['dolor', 'duele', 'insoportable', 'punzante', 'crónico', 'cronico', 'ardor', 'migraña'];
const METABOLIC_KEYWORDS = ['diabetes', 'azucar', 'obesidad', 'tiroides', 'hipertension', 'colesterol', 'higado', 'riñon'];
const PSYCH_KEYWORDS = ['depresion', 'ansiedad', 'triste', 'angustia', 'insomnio', 'estres', 'estrés', 'pánico'];

export const generateEmpatheticResponse = (symptomsText, isSurgeryFlow = false) => {
    const text = symptomsText.toLowerCase();
    let response = "";

    // 1. Identificar Categoría Principal
    const isOncology = ONCOLOGY_KEYWORDS.some(kw => text.includes(kw));
    const isSurgery = SURGERY_KEYWORDS.some(kw => text.includes(kw));
    const isPain = PAIN_KEYWORDS.some(kw => text.includes(kw));
    const isPsych = PSYCH_KEYWORDS.some(kw => text.includes(kw));
    const isMetabolic = METABOLIC_KEYWORDS.some(kw => text.includes(kw));

    // Determinar los Párrafos de Poder a utilizar

    if (isOncology) {
        // Párrafo 1: Contención y Autoridad Institucional
        const p1 = "Lamento profundamente escuchar sobre este diagnóstico. Entiendo que enfrentar un proceso oncológico genera gran incertidumbre y desgaste físico, pero quiero que sepa que nuestra arquitectura nutricional está diseñada para respaldar su tratamiento y fortalecer su sistema inmunológico celular.";
        // Párrafo 2: Instrucción Clínica (Depende de si debe ir a Sensible o Qx)
        const p2 = isSurgeryFlow
            ? "¿Este procedimiento quirúrgico está programado próximamente o ya se llevó a cabo?"
            : "Para poder blindar su estrategia metabólica adecuadamente, ¿le gustaría compartirme un poco más sobre en qué etapa del tratamiento se encuentra, o prefiere abordarlo directamente con el cuerpo médico en su consulta?";
        response = `${p1}\n\n${p2}`;
    }
    else if (isSurgery) {
        const p1 = "Comprendo. Un procedimiento quirúrgico siempre representa un evento de alto impacto para el organismo, y la nutrición juega un papel vital en reducir la inflamación y acelerar la recuperación de los tejidos.";
        const p2 = isSurgeryFlow
            ? "¿Hace cuánto tiempo fue esta cirugía o para cuándo está programada?"
            : "¿Le parece bien ahondar en los motivos de esta intervención ahora, o prefiere que el equipo clínico lo documente en persona?";
        response = `${p1}\n\n${p2}`;
    }
    else if (isPsych) {
        const p1 = "Agradezco mucho que comparta esto conmigo. La conexión entre la salud mental y la nutrición es absoluta; el estrés y la ansiedad tienen un impacto neurobiológico profundo que altera el metabolismo.";
        const p2 = "Para comprender mejor el panorama, ¿siente que este estado emocional está afectando directamente sus hábitos alimenticios o su calidad de sueño, o le gustaría que lo abordemos a detalle en la consulta?";
        response = `${p1}\n\n${p2}`;
    }
    else if (isPain) {
        const p1 = "Entiendo lo desgastante que es vivir con dolor. Ese síntoma es una señal clara de alerta que el cuerpo está emitiendo sobre niveles altos de inflamación sistémica que debemos atender.";
        const p2 = "Para ajustar nuestra estrategia, ¿podría compartirme hace cuánto tiempo empezó este malestar, o prefiere detallarlo durante la evaluación física?";
        response = `${p1}\n\n${p2}`;
    }
    else if (isMetabolic) {
        const p1 = "Tomamos nota de este hallazgo. Los desórdenes metabólicos son exactamente el tipo de retos que nuestra arquitectura celular está diseñada para revertir a través de la nutrición científica.";
        const p2 = "¿Hay algún detalle adicional que considere vital que el equipo médico sepa antes de su consulta, o prefiere ahondar en esto de manera presencial?";
        response = `${p1}\n\n${p2}`;
    }
    else {
        // Fallback genérico mejorado pero respetando TILO
        const p1 = "Entiendo la importancia de lo que me comenta. Cada detalle que comparta nos permite trazar un diagnóstico mucho más preciso del estado actual de su metabolismo celular.";
        const p2 = isSurgeryFlow
            ? "¿Hace cuánto tiempo fue este evento médico o cuándo está programado?"
            : "Para poder apoyarle con la mayor precisión, ¿le gustaría agregar algún otro contexto a este punto, o considera que es mejor profundizar directamente en la consulta clínica?";
        response = `${p1}\n\n${p2}`;
    }

    return response;
};

export const detectSurgeryKeyword = (symptomsText) => {
    const text = symptomsText.toLowerCase();
    // Ampliando para abarcar cualquier keyword que obligue a pasar a Cirugía
    return SURGERY_KEYWORDS.some(kw => text.includes(kw)) || ['quiste', 'histerectomia', 'cesarea', 'apendice', 'vesicula'].some(kw => text.includes(kw));
};

export const detectContainmentKeyword = (symptomsText) => {
    const text = symptomsText.toLowerCase();
    return ONCOLOGY_KEYWORDS.some(kw => text.includes(kw)) || ['falleci', 'muerte', 'matriz', 'duelo', 'luto', 'perdida', 'pérdida'].some(kw => text.includes(kw));
};
