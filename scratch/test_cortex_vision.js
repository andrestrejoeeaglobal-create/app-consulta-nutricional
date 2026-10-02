const path = require('path');
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'server', '.env') });
const fs = require('fs');
const { GoogleGenAI } = require(path.join(__dirname, '..', 'server', 'node_modules', '@google/genai'));

function fileToGenerativePart(filePath, mimeType) {
    if (!fs.existsSync(filePath)) return null;
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType: mimeType || 'image/jpeg'
        },
    };
}

async function runVisionTest() {
    console.log("🚀 Running Gemini 2.5 Flash Vision Test on Agustín Martínez Reyes images...");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const rightEyePath = path.join(__dirname, '..', 'server', 'uploads', 'ocular-1790035455997-11700851.jpg');
    const leftEyePath = path.join(__dirname, '..', 'server', 'uploads', 'ocular-1790035456007-275556100.jpg');
    const lingualPath = path.join(__dirname, '..', 'server', 'uploads', 'lingual-1790035516360-884364205.jpg');

    // 1. Ocular Binocular
    const ocularParts = [];
    const pR = fileToGenerativePart(rightEyePath, 'image/jpeg');
    const pL = fileToGenerativePart(leftEyePath, 'image/jpeg');
    if (pR) ocularParts.push(pR);
    if (pL) ocularParts.push(pL);

    const ocularPrompt = `
# DIRECTIVA OPERATIVA DEL CORTEX DE IA: AUDITORÍA SEMIOLÓGICA OCULAR Y PERIORBITAL DE ALTA RESOLUCIÓN

## REGLA DE ORO DE INMUNIDAD Y RIGOR ANATÓMICO
Queda ESTRICTAMENTE PROHIBIDO emitir descripciones complacientes o genéricas como "conservada", "normal" o "ausente" sin justificación anatómica. Si un signo tisular está presente (ej. herniación grasa, bolsas infraorbitarias, senescencia), debes describirlo y graduarlo con máxima precisión médica.

### 1. PALIDEZ CONJUNTIVAL Y CONJUNTIVA TARSAL
- Evalúa si el párpado inferior fue evertido en la toma fotográfica. Si la mucosa tarsal conjuntival NO fue expuesta ni evertida (ej. ojo cubierto o párpado en reposo), debes explicitar en estado: "No Evaluable por Falta de Eversión Tarsal" y en descripcion_clinica: "Mucosa conjuntival tarsal no expuesta en la toma fotográfica; requiere eversión palpebral directa para evaluación anémica".

### 2. MORFOLOGÍA PERIORBITAL Y EDEMA INFRAORBITARIO
- Inspecciona minuciosamente el párpado inferior y la zona malar en busca de bolsas infraorbitarias, herniación grasa palpebral, festón malar, laxitud del septum orbitario y estasis linfático.
- Clasifica edema_infraorbitario como "Grado II (Herniación Grasa Palpebral)" o "Grado III (Bolsas Prominentes & Festón Malar)" si observas pliegues o bolsas infraorbitarias.

### 3. MICROCIRCULACIÓN ESCLERAL Y ASIMETRÍA
- Densidad, tortuosidad vascular, calibre y simetría bilateral entre OD y OI.

Responde ÚNICAMENTE en formato JSON estricto con la siguiente estructura:
{
  "ocular_audit": {
    "palidez_conjuntival": {
      "estado": "string",
      "descripcion_clinica": "string"
    },
    "microcirculacion_escleral": {
      "calibre_vascular": "Normal | Tortuosidad Venular Leve | Dilatación Vascular",
      "densidad_capilar": "string",
      "hallazgos_especificos": ["string"]
    },
    "tejido_periorbital": {
      "edema_infraorbitario": "Grado II (Herniación Grasa Palpebral) | Grado III (Bolsas Prominentes & Festón Malar)",
      "estasis_venosa_pigmentaria": "string",
      "deposito_lipidico_corneal": "Positivo / Negativo"
    },
    "asimetria_binocular": {
      "es_simetrico": true,
      "observaciones": "string"
    }
  },
  "correlacion_multimodal": {
    "sintesis_fisiopatologica": "string",
    "indice_prioridad_clinica": "Moderado | Elevado"
  }
}
`;
    ocularParts.push(ocularPrompt);

    const ocularRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: ocularParts,
        config: { responseMimeType: 'application/json' }
    });

    console.log("👁️ OCULAR AI RESPONSE:");
    console.log(ocularRes.text);

    // 2. Lingual
    const lingualParts = [];
    const pLingual = fileToGenerativePart(lingualPath, 'image/jpeg');
    if (pLingual) lingualParts.push(pLingual);

    const lingualPrompt = `
# DIRECTIVA OPERATIVA DEL CORTEX DE IA: GLOSODIAGNÓSTICO Y TOPOGRAFÍA LINGUAL CYTOS

## REGLA DE ORO DE RIGOR TISULAR
Evalúa la toma de la lengua sin sesgos de complacencia hacia la normalidad.

### 1. CUERPO LINGUAL Y FESTONEADO LATERAL
- Inspecciona si el cuerpo lingual está ensanchado/macroglósico y si presenta marcas de presión o indentaciones dentales en sus bordes bilaterales (festoneado lateral). Si presenta indentaciones dentales, registra en indentaciones_dentales: "Presentes en bordes bilaterales (Festoneado por presión dentaria)".
- Evalúa el color del sustrato (Pálido / Rosado / Sublingual congestivo) y fisuras en mucosa.

### 2. SABURRA LINGUAL Y MICROBIOTA
- Evalúa la distribución de la capa o placa de saburra (Delgada / Moderada / Gruesa / Placa Blanquecina) y su topografía (Centro gástrico, Raíz colónica, Bordes hepato-biliares).

Responde ÚNICAMENTE en formato JSON estricto con la siguiente estructura:
{
  "lingual_topography": {
    "cuerpo_lingual": {
      "coloracion_sustrato": "Pálido / Hipoperfundido | Rosado fisiológico | Congestivo",
      "trofismo_volumen": "Aumentado (Saburra/Edema) | Eutrófico | Atrófico",
      "indentaciones_dentales": "Presentes en bordes bilaterales (Festoneado lateral) | Ausentes",
      "fisuras_mucosa": "string"
    },
    "saburra_microbiota": {
      "grosor": "Moderada a Gruesa | Placa Blanquecina Central",
      "color": "Blanquecina / Amarillenta",
      "distribucion_topografica": {
        "centro": "string",
        "raiz": "string",
        "bordes": "string"
      },
      "humectacion": "string"
    }
  },
  "correlacion_multimodal": {
    "sintesis_fisiopatologica": "string",
    "indice_prioridad_clinica": "Moderado | Elevado"
  }
}
`;
    lingualParts.push(lingualPrompt);

    const lingualRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: lingualParts,
        config: { responseMimeType: 'application/json' }
    });

    console.log("\n👅 LINGUAL AI RESPONSE:");
    console.log(lingualRes.text);
}

runVisionTest().catch(console.error);
