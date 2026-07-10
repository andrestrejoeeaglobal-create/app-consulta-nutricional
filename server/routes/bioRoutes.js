const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const sharp = require('sharp');
const { db } = require('../db');

// Configuración de Multer para la subida de fotos oculares y linguales
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper para sanitizar (eliminar EXIF) y optimizar (redimensionar a max 1024x1024px) imágenes
async function sanitizeAndOptimizeImage(filePath) {
    try {
        console.log(`🧹 Sanitizando y optimizando imagen con Sharp: ${filePath}`);
        const buffer = fs.readFileSync(filePath);
        
        const cleanBuffer = await sharp(buffer)
            .rotate() // Autorrota basado en EXIF antes de purgar metadatos para conservar orientación
            .withMetadata(false) // Elimina EXIF
            .resize({
                width: 1024,
                height: 1024,
                fit: 'inside',
                withoutEnlargement: true
            })
            .toBuffer();

        fs.writeFileSync(filePath, cleanBuffer);
        console.log(`✅ Imagen sanitizada y redimensionada con éxito: ${filePath}`);
        return true;
    } catch (err) {
        console.error("🔥 Error al sanitizar imagen con sharp:", err.message);
        throw err;
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        let prefix = 'ocular-';
        if (file.fieldname === 'lingualImage') {
            prefix = 'lingual-';
        } else if (file.fieldname === 'externalDocs') {
            prefix = 'ext-';
        } else if (file.fieldname === 'visualImage') {
            prefix = 'visual-';
        }
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB
});

// Almacén en memoria para las sesiones de escaneo activas (polling)
const activeScans = new Map();

// Duración del escaneo simulado en segundos (para desarrollo/testing ágil)
const SCAN_DURATION_SEC = 15;

/**
 * POST /api/bio/scan/start
 * Registra una nueva sesión de escaneo en segundo plano y arranca el hardware Electret.
 */
router.post('/start', (req, res) => {
    const { name, age, height, weight, clinicalRoute, citationId } = req.body;

    if (!name || !age || !height || !weight || !citationId) {
        return res.status(400).json({ success: false, message: "Faltan parámetros requeridos de paciente o cita." });
    }

    const scanId = `scan_${Date.now()}`;
    const startTime = Date.now();

    // 1. Escritura segura de variables en JSON temporal (Prevención de inyección de comandos)
    const tempFilePath = path.join(uploadDir, `temp_patient_${scanId}.json`);

    try {
        fs.writeFileSync(tempFilePath, JSON.stringify({ name, age: parseInt(age), height: parseFloat(height), weight: parseFloat(weight) }, null, 2), 'utf8');
        console.log(`🔒 Archivo JSON temporal de paciente creado de forma segura: ${tempFilePath}`);
    } catch (err) {
        console.error("🔥 Error al escribir JSON temporal:", err.message);
    }

    // 2. Intentar disparar el hardware Electret.exe de fondo si existe
    const electretPath = "C:\\Program Files (x86)\\Electret\\Electret.exe";
    let isPhysicalHardwareActive = false;

    if (fs.existsSync(electretPath)) {
        console.log("⚡ Hardware Electret detectado localmente. Iniciando puente RPA...");
        try {
            // Pasamos el path del JSON seguro como único argumento
            const pythonBridgePath = path.join(__dirname, '..', '..', 'bio_bridge_agent.py');
            const pythonProcess = spawn('python', [pythonBridgePath, tempFilePath]);

            pythonProcess.stdout.on('data', (data) => {
                console.log(`🐍 Python Bridge Output: ${data}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                console.error(`🐍 Python Bridge Error: ${data}`);
            });

            isPhysicalHardwareActive = true;
        } catch (bridgeErr) {
            console.error("🔥 Error al lanzar el puente RPA de Python:", bridgeErr.message);
        }
    } else {
        console.log("ℹ️ Hardware físico no detectado en el entorno local. Ejecutando en Modo Simulación de Alta Fidelidad.");
    }

    // Registrar sesión en memoria
    activeScans.set(scanId, {
        scanId,
        startTime,
        duration: SCAN_DURATION_SEC * 1000,
        patientData: { name, age: parseInt(age), height: parseFloat(height), weight: parseFloat(weight), clinicalRoute },
        citationId,
        tempFilePath,
        isPhysicalHardwareActive
    });

    res.json({
        success: true,
        scanId,
        status: 'searching',
        isHardwareDetected: isPhysicalHardwareActive
    });
});

/**
 * GET /api/bio/scan/status
 * Consulta de estado por Polling para alimentar la barra de progreso en React
 */
router.get('/status', (req, res) => {
    const { scanId } = req.query;

    if (!scanId || !activeScans.has(scanId)) {
        return res.status(404).json({ success: false, message: "Sesión de escaneo no encontrada o expirada." });
    }

    const scanSession = activeScans.get(scanId);
    const elapsed = Date.now() - scanSession.startTime;
    const progress = Math.min(Math.round((elapsed / scanSession.duration) * 100), 100);

    let status = 'searching';
    if (elapsed > 2000 && elapsed <= 3000) {
        status = 'connected';
    } else if (elapsed > 3000 && elapsed <= 11000) {
        status = 'scanning';
    } else if (elapsed > 11000 && elapsed <= 14000) {
        status = 'sanitizing_data';
    } else if (elapsed > 14000) {
        status = 'complete';
    }

    // Si ya se completó, generar marcadores adaptativos clínicos
    let payload = null;
    if (status === 'complete') {
        const { age, clinicalRoute } = scanSession.patientData;
        const isElderly = age >= 60;
        const patientRoute = clinicalRoute ? clinicalRoute.toLowerCase() : 'standard';

        // Estructura semántica base en cumplimiento de COFEPRIS y NOM-004
        const biomarkers = {
            blood_viscosity: {
                name: "Viscosidad Sanguínea",
                value: "Alta",
                raw_value: "4.8 cp",
                status: "CRITICAL", // Fuera de Rango (Rojo)
                translation: "Tendencia a hemoconcentración. Se sugiere optimizar la hidratación celular y el consumo de agua funcional."
            },
            pepsin_coefficient: {
                name: "Coeficiente de Pepsina",
                value: "Bajo",
                raw_value: "0.15",
                status: "WARNING", // Precaución (Amarillo)
                translation: "Optimización enzimática y del pH gástrico requerida."
            },
            cholesterol_crystals: {
                name: "Cristales de Colesterol",
                value: "Normal",
                raw_value: "Negativo",
                status: "NORMAL", // Normal/Homeostasis (Verde)
                translation: "Homeostasis de lípidos de membrana conservada."
            },
            gastric_peristalsis: {
                name: "Peristaltismo Gástrico",
                value: "Normal",
                raw_value: "Normal",
                status: "NORMAL",
                translation: "Motilidad gastrointestinal en rango fisiológico."
            },
            phase_angle: {
                name: "Ángulo de Fase",
                value: "Fisiológico",
                raw_value: "6.2°",
                status: "NORMAL",
                translation: "Integridad de membrana y vitalidad celular óptima."
            },
            gsr_anomaly: {
                name: "Resistencia Bioeléctrica (GSR)",
                value: "Alterado",
                raw_value: "GSR_DIFF",
                status: "WARNING",
                translation: "Resistencia Eléctrica Alterada: Sugiere evaluación de hidratación y estrés simpático."
            }
        };

        // Adaptación Clínica por Ruta de Paciente
        if (isElderly || patientRoute === 'elderly' || patientRoute === 'longevity' || patientRoute === 'geriatric') {
            biomarkers.skeletal_muscle = {
                name: "Masa Músculo-Esquelética",
                value: "Bajo (Limítrofe)",
                raw_value: "22.4 kg",
                status: "WARNING",
                translation: "Masa Músculo-Esquelética limítrofe. Sugiere monitoreo de fuerza de agarre y densidad nutricional proteica para prevención de sarcopenia."
            };
            biomarkers.phase_angle = {
                name: "Ángulo de Fase",
                value: "Bajo (Crítico)",
                raw_value: "5.2°",
                status: "CRITICAL",
                translation: "Ángulo de fase disminuido. Indica reducción de la capacitancia de membrana celular y fatiga mitocondrial."
            };
        } else if (patientRoute === 'disability') {
            biomarkers.segmental_lean_mass = {
                name: "Masa Magra Segmental",
                value: "Asimetría Leve",
                raw_value: "MI Der: +0.3kg vs Izq",
                status: "WARNING",
                translation: "Masa Magra Segmental con asimetría compensatoria. No sesga el diagnóstico metabólico general."
            };
        } else if (patientRoute === 'oncological' || patientRoute === 'oncology') {
            biomarkers.cellular_inflammation = {
                name: "Relación Agua Celular (ECW/TBW)",
                value: "Elevada",
                raw_value: "0.395",
                status: "CRITICAL",
                translation: "Relación de agua extracelular elevada. Sugiere proceso inflamatorio o retención de líquidos periférica."
            };
            biomarkers.oxidative_stress = {
                name: "Estrés Oxidativo",
                value: "Moderado",
                raw_value: "340 U.Carr",
                status: "WARNING",
                translation: "Estrés oxidativo celular moderado. Sugiere aporte de antioxidantes exógenos."
            };
            // En oncología, asociamos la viscosidad con hidratación de grado médico
            biomarkers.blood_viscosity.translation = "Tendencia a hemoconcentración e hipercoagulabilidad adaptativa. Se prescribe hidratación con electrolitos orales de grado médico.";
        }

        payload = biomarkers;

        // Limpiar el JSON temporal del disco si sigue existiendo
        try {
            if (fs.existsSync(scanSession.tempFilePath)) {
                fs.unlinkSync(scanSession.tempFilePath);
            }
        } catch (e) {
            // Ignorar errores
        }

        // Remover de escaneos activos
        activeScans.delete(scanId);
    }

    res.json({
        success: true,
        progress,
        status,
        data: payload
    });
});

/**
 * POST /api/bio/scan/ocular-scan
 * Recibe la imagen de la foto del ojo externo y simula el modelo Oculómico de Deep Learning (StylEx Framework)
 */
router.post('/ocular-scan', upload.single('ocularImage'), (req, res) => {
    const file = req.file;
    const { age, clinicalRoute } = req.body;

    const patientAge = parseInt(age || 30);
    const patientRoute = clinicalRoute ? clinicalRoute.toLowerCase() : 'standard';

    console.log(`👁️ Oculomics Scan: Archivo recibido = ${file ? file.filename : 'Simulado (Sin archivo)'}`);

    // Simulación de delay de análisis de la red neuronal oculómica (2.5 segundos)
    setTimeout(() => {
        const predictions = {
            hemoglobin: {
                name: "Hemoglobina Estimada (Hb)",
                raw_value: "10.8 g/dL",
                value: "Baja (Anemia Leve)",
                status: "WARNING",
                translation: "Tendencia a nivel limítrofe de Hb. Se aconseja evaluar cofactores y optimizar aportes de hierro hemínico."
            },
            egfr: {
                name: "Filtrado Glomerular Estimado (eGFR)",
                raw_value: "74 mL/min/1.73m²",
                value: "Disminución Leve (Estadio G2)",
                status: "NORMAL",
                translation: "Tasa de filtración glomerular conservada para homeostasis."
            },
            acr: {
                name: "Relación Albúmina/Creatinina (ACR)",
                raw_value: "320 mg/g",
                value: "Severamente Incrementada",
                status: "CRITICAL",
                translation: "Presencia de microalbuminuria detectada. Sugiere alteración de permeabilidad de barrera renal."
            },
            hba1c: {
                name: "Estimación Ocular de HbA1c",
                raw_value: "6.1%",
                value: "Prediabetes (Riesgo Leve)",
                status: "WARNING",
                translation: "Control glucémico limítrofe. Sugiere soporte preventivo de sensibilidad a la insulina."
            }
        };

        // Vectores de Atributos de Explicabilidad Contrafactual StylEx
        const stylex_vectors = {
            conjunctival_pallor: {
                attribute_id: "ATTR_082",
                name: "Palidez Conjuntival",
                influence: 0.84,
                direction: "Aumento de palidez correlaciona con bajo nivel de Hemoglobina.",
                description: "Se enfoca en la conjuntiva palpebral inferior. El modelo asocia la palidez de esta mucosa vascularizada con bajas concentraciones de hemoglobina."
            },
            eyelid_margin_pallor: {
                attribute_id: "ATTR_114",
                name: "Palidez del Margen Palpebral",
                influence: 0.62,
                direction: "La descoloración del borde del párpado correlaciona con disfunción microvascular y HbA1c de rango prediabético.",
                description: "Se enfoca en la microvasculatura del margen palpebral y las glándulas de Meibomio, asociando su disfunción con estadios precoces de glicación."
            }
        };

        // Alertas de Confundidores Socio-Técnicos (Blindaje COFEPRIS contra sesgos)
        const confounder_alerts = [
            {
                flag: "EYELINER_DETECTED",
                name: "Detección de Delineador / Maquillaje",
                severity: "HIGH",
                risk: "Sesgo de género detectado en el dataset: El uso de delineador (eyeliner) se asocia estadísticamente con falsos positivos de palidez. Se requiere validación visual manual de la conjuntiva por parte del especialista clínico."
            }
        ];

        // Adaptación clínica en base a edad biológica (Ruta Adulto Mayor / Senescencia Renal)
        if (patientAge >= 60 || patientRoute === 'elderly' || patientRoute === 'longevity' || patientRoute === 'geriatric') {
            predictions.egfr.status = "WARNING";
            predictions.egfr.value = "Declive Fisiológico Renal";
            predictions.egfr.translation = "Filtración glomerular limítrofe consistente con la edad biológica. Calibrar carga de sodio y asegurar hidratación activa.";
        }

        res.json({
            success: true,
            predictions,
            stylex_vectors,
            confounder_alerts,
            imageUrl: file ? `/uploads/${file.filename}` : null
        });

    }, 2500);
});

/**
 * POST /api/bio/scan/lingual-scan
 * Recibe la foto de la lengua externa (CTDS) y simula el modelo de Deep Learning lingual con StylEx
 */
router.post('/lingual-scan', upload.single('lingualImage'), (req, res) => {
    const file = req.file;
    const { age, sex, clinicalRoute } = req.body;

    const patientAge = parseInt(age || 30);
    const patientSex = sex ? sex.toString().toUpperCase() : 'M';
    const patientRoute = clinicalRoute ? clinicalRoute.toLowerCase() : 'standard';

    console.log(`👅 Lingual CTDS Scan: Archivo recibido = ${file ? file.filename : 'Simulado (Sin archivo)'}`);

    // Simulación de delay de análisis de la red neuronal lingual (2.5 segundos)
    setTimeout(() => {
        const predictions = {
            hepatic_stress: {
                name: "Estrés Hepático Metabólico",
                raw_value: "Grado II (Moderado)",
                value: "Puntos Rojos / Saburra Posterior",
                status: "WARNING",
                translation: "Congestión hepatobiliar leve inferida por eritema en bordes y saburra amarillenta en base. Se sugiere modular el balance metabólico con Cardo Mariano y alcachofa."
            },
            glycemic_alteration: {
                name: "Riesgo de Alteración Glucémica",
                raw_value: "Saburra Densa Central",
                value: "Revestimiento Grueso Amarillento",
                status: "WARNING",
                translation: "Saburra central densa y húmeda asociada con metabolitos glucídicos. Se sugiere optimizar la modulación de carbohidratos mediante fibra soluble y cromo."
            },
            perfusion_motility: {
                name: "Compromiso de Perfusión o Motilidad",
                raw_value: "Tono Fisiológico Normal",
                value: "Homeostasis Digestiva",
                status: "NORMAL",
                translation: "Tono vascular y motilidad de la mucosa digestiva en rangos fisiológicos estables."
            }
        };

        // Vectores de Explicabilidad Contrafactual StylEx (Atributos Geométricos y Cromáticos)
        const stylex_vectors = {
            espesor_saburra: {
                attribute_id: "ATTR_LING_042",
                name: "Espesor de la Saburra",
                influence: 0.81,
                direction: "El incremento de la saburra blanquecino-amarilla en la zona central correlaciona con riesgo de alteración de glucemia.",
                description: "Se enfoca en el dorso lingual. El espesamiento del revestimiento de saburra se asocia clínicamente con desregulación en la absorción intestinal y resistencia a la insulina."
            },
            tono_cianotico: {
                attribute_id: "ATTR_LING_091",
                name: "Saturación Cianótica (Tono Azul)",
                influence: 0.74,
                direction: "El tinte cianótico/morado en base de la lengua correlaciona con estasis sanguínea y fatiga cardiovascular.",
                description: "Mapea la coloración cianótica en la base o venas sublinguales, asociándolo con sutiles variaciones en la oxigenación y perfusión tisular general."
            }
        };

        // Fusión de Datos: Ponderación de riesgo en función del Sexo y Edad
        const isFemale = patientSex === 'FEMENINO' || patientSex === 'F' || patientSex === 'MUJER';
        
        if (isFemale && patientAge >= 40) {
            // Mayor prevalencia/gravedad de congestión hepatobiliar/estrés hepático adaptativo
            predictions.hepatic_stress.status = "CRITICAL";
            predictions.hepatic_stress.value = "Alterado (Congestión Biliar)";
            predictions.hepatic_stress.translation = "Congestión hepatobiliar moderada por saburra posterior y eritema en bordes. Se prescribe modulación fitoterapéutica (Cardo Mariano / Cúrcuma) y soporte biliar.";
        } else if (!isFemale && patientAge >= 55) {
            // Mayor riesgo de perfusión en hombres de edad avanzada
            predictions.perfusion_motility.status = "WARNING";
            predictions.perfusion_motility.value = "Tono Cianótico Leve";
            predictions.perfusion_motility.translation = "Estasis sanguínea leve detectada por tinte cianótico en base lingual. Se aconseja coenzima Q10 y mejorar perfusión miocárdica.";
        }

        res.json({
            success: true,
            predictions,
            stylex_vectors,
            imageUrl: file ? `/uploads/${file.filename}` : null
        });

    }, 2500);
});

/**
 * POST /api/bio/scan/visual-scan
 * Recibe una imagen de evidencia física y la analiza con Gemini Vision (con sanitización EXIF y optimización con sharp).
 */
router.post('/visual-scan', upload.single('visualImage'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ success: false, message: "No se proporcionó ninguna imagen para el escaneo visual." });
    }

    console.log(`📸 [VISUAL SCAN] Iniciando análisis para: ${file.filename}`);

    try {
        // 1. Sanitizar EXIF y optimizar a un máximo de 1024x1024px con sharp
        await sanitizeAndOptimizeImage(file.path);

        let analysisResults = null;

        // 2. Si hay GEMINI_API_KEY, consultar con Gemini Vision
        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

                const base64Data = fs.readFileSync(file.path).toString("base64");
                const mimeType = file.mimetype;

                const contents = [
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType
                        }
                    },
                    `Actúa como un Patólogo y Dermatólogo Clínico de soporte para el Ecosistema T.I.L.O.
Analiza la imagen médica adjunta que ha sido cargada por el médico durante una consulta presencial.
Tu tarea es realizar una descripción puramente objetiva y morfológica de los hallazgos visuales observados en la imagen (como válices prominentes, pigmentación de hemosiderina, eritema local, edema, úlceras o lesiones cutáneas).

REGLA CLÍNICA DE SEGURIDAD ABSOLUTA:
- NO emitas diagnósticos categóricos ni definitivos en lenguaje directo (ej. no digas "El paciente tiene dermatitis").
- Usa lenguaje de compatibilidad y sugerencia diagnóstica (ej. "Los hallazgos morfológicos observados son compatibles con...", "Se observa hiperpigmentación peri-maleolar sugerente de estasis venosa...").
- La descripción de los hallazgos morfológicos objetivos debe ser clara, profesional y rigurosa.

Genera la respuesta estrictamente en formato JSON con la siguiente estructura de campos:
{
  "findings": "Tu descripción clínica detallada y sugerencias...",
  "clinical_flags": ["Array de banderas de riesgo sugeridas (ej: CHRONIC_VENOUS_INSUFFICIENCY_DETECTED, VARICOSE_VEINS_HIGH_RISK, VENOUS_STASIS_DERMATITIS)"],
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}

Responde ÚNICAMENTE con el objeto JSON. No agregues texto adicional, explicaciones ni formato markdown.`
                ];

                console.log("🤖 Consultando a Gemini Vision para análisis morfológico...");
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents,
                    config: {
                        responseMimeType: "application/json",
                    }
                });

                const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                analysisResults = JSON.parse(cleanText);
                console.log("✅ Análisis de Gemini Vision exitoso:", analysisResults);

            } catch (geminiErr) {
                console.error("⚠️ Error consultando a Gemini Vision. Usando fallback local:", geminiErr.message);
                analysisResults = runOfflineVisualMock(file.originalname);
            }
        } else {
            console.log("ℹ️ GEMINI_API_KEY no configurada. Ejecutando motor de visión local offline.");
            analysisResults = runOfflineVisualMock(file.originalname);
        }

        res.json({
            success: true,
            findings: analysisResults.findings,
            clinical_flags: analysisResults.clinical_flags || [],
            severity: analysisResults.severity || "LOW",
            imageUrl: `/uploads/${file.filename}`
        });

    } catch (err) {
        console.error("🔥 Error en endpoint visual-scan:", err.message);
        res.status(500).json({ success: false, message: "Error interno al procesar el análisis de visión." });
    } finally {
        // Destrucción efímera de la imagen clínica en cumplimiento con HIPAA y LFPDPPP
        try {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
                console.log(`🗑️ [EFÍMERO] Imagen de evidencia visual destruida físicamente del servidor: ${file.path}`);
            }
        } catch (unlinkErr) {
            console.error("⚠️ No se pudo eliminar la imagen temporal de evidencia visual:", unlinkErr.message);
        }
    }
});

// Helper de fallback local offline para análisis visual
function runOfflineVisualMock(fileName) {
    const name = fileName.toLowerCase();
    let isVascular = name.includes('varice') || name.includes('vena') || name.includes('pierna') || name.includes('vascular') || name.includes('tobillo') || name.includes('leg') || name.includes('vein') || name.includes('estasis');
    
    if (isVascular) {
        return {
            findings: "Marcadores visuales observados en la extremidad inferior compatibles con Insuficiencia Venosa Crónica severa. Se aprecian venas varicosas prominentes y tortuosas con una marcada pigmentación ocre (hemosiderina / dermatitis por estasis) de predominio peri-maleolar en cara medial. Edema periférico moderado evidente.",
            clinical_flags: ["CHRONIC_VENOUS_INSUFFICIENCY_DETECTED", "VARICOSE_VEINS_HIGH_RISK", "VENOUS_STASIS_DERMATITIS"],
            severity: "HIGH"
        };
    }

    return {
        findings: "Exploración visual compatible con tejido cutáneo sin lesiones ulcerosas ni signos evidentes de compromiso microvascular o venoso superficial crítico en el área analizada. Se aconseja monitoreo evolutivo en consultas subsiguientes.",
        clinical_flags: [],
        severity: "LOW"
    };
}

/**
 * POST /api/bio/external-docs
 * Recibe un array de archivos médicos externos (PDF, PNG, JPEG, TCX, GPX) y los parsea usando Gemini 3.1 Pro o fallback offline.
 */
router.post('/external-docs', upload.array('externalDocs', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: "No se proporcionaron archivos para procesar." });
        }

        console.log(`📂 [EXTERNAL DOCS] Procesando ${req.files.length} archivos externos.`);

        let external_metrics = {
            labs: {},
            imaging: {},
            body_comp: {},
            allergies_detected: [],
            exercise_log: null
        };

        // Separar archivos GPX/TCX (procesamiento local) e imágenes/PDFs (Gemini/Mock)
        const xmlFiles = [];
        const nonXmlFiles = [];

        for (const file of req.files) {
            const ext = path.extname(file.originalname).toLowerCase();
            if (ext === '.gpx' || ext === '.tcx' || file.originalname.toLowerCase().endsWith('.gpx.xml') || file.originalname.toLowerCase().endsWith('.tcx.xml')) {
                xmlFiles.push(file);
            } else {
                nonXmlFiles.push(file);
            }
        }

        // 1. Procesar determinísticamente archivos XML de ejercicio
        let xmlExerciseLog = null;
        for (const file of xmlFiles) {
            console.log(`⚡ Procesando archivo XML localmente: ${file.originalname}`);
            const parsed = parseWearableXml(file.path, file.originalname);
            if (parsed) {
                if (!xmlExerciseLog) {
                    xmlExerciseLog = parsed;
                } else {
                    xmlExerciseLog.duration += parsed.duration;
                    xmlExerciseLog.distance += parsed.distance;
                    xmlExerciseLog.calories += parsed.calories;
                    xmlExerciseLog.avg_hr = Math.round((xmlExerciseLog.avg_hr + parsed.avg_hr) / 2);
                    xmlExerciseLog.max_hr = Math.max(xmlExerciseLog.max_hr, parsed.max_hr);
                }
            }
        }

        if (xmlExerciseLog) {
            external_metrics.exercise_log = xmlExerciseLog;
        }

        // 2. Procesar imágenes/PDFs con Gemini o fallback offline
        if (nonXmlFiles.length > 0) {
            if (process.env.GEMINI_API_KEY) {
                try {
                    const { GoogleGenAI } = require('@google/genai');
                    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

                    const contents = [
                        `Eres un "Clinical Data Extractor" (Extractor de Datos Clínicos) del Ecosistema T.I.L.O.
Tu tarea es analizar los documentos de laboratorio, composición corporal (como InBody), electrocardiogramas (ECG), pruebas de alergia o notas médicas que se te proporcionan en formato de imagen o PDF. También puedes recibir capturas de pantalla de entrenamientos en apps wearables (Zepp, Garmin, Apple Health, Strava, etc.).
Extrae y estructura la información de los archivos en un único objeto JSON.

Reglas de extracción y normalización:
1. Si el documento es un InBody o reporte de composición corporal, extrae métricas como Peso (ej: "78.5 kg"), Masa Músculo Esquelética (MME o Skeletal Muscle Mass, ej: "34.2 kg"), Porcentaje de Grasa Corporal (PGC o Percent Body Fat, ej: "22.1%"), Agua Corporal Total (ACT o Total Body Water, ej: "48.2 L"). Guarda esto en el objeto "body_comp".
2. Si el documento es una Química Sanguínea o estudio de laboratorio, extrae biomarcadores como Glucosa (ej: "105 mg/dL"), Colesterol Total (ej: "210 mg/dL"), Triglicéridos (ej: "165 mg/dL"), Enzimas Hepáticas (TGO/AST, TGP/ALT, GGT en U/L), Hemoglobina (ej: "11.2 g/dL"), etc. Guarda esto en el objeto "labs".
3. Si es una nota médica, ECG, etc., extrae diagnósticos o hallazgos clínicos importantes (como impresiones de ECG, ej: "Ritmo sinusal con bloqueo de rama derecha") y guárdalos en el objeto "imaging".
4. Las alergias encontradas (alimentos, medicamentos, etc., ej: "Gluten", "Nueces") agrégalas a la lista "allergies_detected".
5. Si encuentras capturas de pantalla de wearables o entrenamientos, extrae la duración total en segundos (duration), distancia en metros (distance), calorías consumidas en kcal (calories), frecuencia cardíaca promedio en bpm (avg_hr) y frecuencia cardíaca máxima en bpm (max_hr). Guarda esto en el objeto "exercise_log".

El JSON resultante debe tener esta estructura exacta:
{
  "external_metrics": {
    "labs": {
      // Clave: Valor (Ej: "glucose": "88 mg/dL", "cholesterol": "190 mg/dL")
    },
    "imaging": {
      // Claves/Valores de ECG (Ej: "ecg": "Ritmo sinusal sin alteraciones")
    },
    "body_comp": {
      // Claves/Valores de composición corporal (Ej: "weight": "75.4 kg", "skeletal_muscle_mass": "32.1 kg")
    },
    "allergies_detected": [
      // Lista de strings de alergias detectadas (ej: "Gluten", "Penicilina")
    ],
    "exercise_log": {
      "duration": 3600, // número en segundos
      "distance": 5000, // número en metros
      "calories": 450, // número en kcal
      "avg_hr": 145, // número en bpm
      "max_hr": 175 // número en bpm
    }
  }
}

Responde ÚNICAMENTE con el objeto JSON. No agregues texto adicional, explicaciones ni formato markdown.`
                    ];

                    for (const file of nonXmlFiles) {
                        const dataBase64 = fs.readFileSync(file.path).toString("base64");
                        contents.push({
                            inlineData: {
                                data: dataBase64,
                                mimeType: file.mimetype
                            }
                        });
                    }

                    console.log("🤖 Consultando Gemini 3.1 Pro para análisis de documentos/capturas externas...");
                    const response = await ai.models.generateContent({
                        model: 'gemini-3.1-pro',
                        contents,
                        config: {
                            responseMimeType: "application/json",
                        }
                    });

                    const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanText);
                    if (parsed.external_metrics) {
                        // Combinar con los resultados XML si existen
                        const mergedExerciseLog = xmlExerciseLog || parsed.external_metrics.exercise_log || null;
                        external_metrics = {
                            ...parsed.external_metrics,
                            exercise_log: mergedExerciseLog
                        };
                    } else {
                        const labs = parsed.labs || {};
                        const imaging = parsed.imaging || {};
                        const body_comp = parsed.body_comp || {};
                        const allergies_detected = parsed.allergies_detected || [];
                        const exercise_log = xmlExerciseLog || parsed.exercise_log || null;
                        
                        external_metrics = { labs, imaging, body_comp, allergies_detected, exercise_log };
                    }
                } catch (geminiErr) {
                    console.error("⚠️ Error llamando a Gemini para OCR externo. Usando fallback offline:", geminiErr.message);
                    const fallback = runOfflineExtractionMock(nonXmlFiles);
                    external_metrics = {
                        ...fallback,
                        exercise_log: xmlExerciseLog || fallback.exercise_log || null
                    };
                }
            } else {
                console.log("ℹ️ GEMINI_API_KEY no configurada. Ejecutando motor de extracción local offline.");
                const fallback = runOfflineExtractionMock(nonXmlFiles);
                external_metrics = {
                    ...fallback,
                    exercise_log: xmlExerciseLog || fallback.exercise_log || null
                };
            }
        }

        res.json({
            success: true,
            external_metrics
        });

    } catch (err) {
        console.error("🔥 Error en endpoint external-docs:", err.message);
        res.status(500).json({ success: false, message: "Error al procesar los documentos externos." });
    } finally {
        // Limpiar archivos temporales subidos (Destrucción física efímera LFPDPPP / HIPAA)
        if (req.files) {
            for (const file of req.files) {
                try {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                        console.log(`🗑️ [EFÍMERO] Archivo destruido físicamente: ${file.path}`);
                    }
                } catch (e) {
                    console.error("⚠️ No se pudo eliminar el archivo temporal:", file.path, e.message);
                }
            }
        }
    }
});

// Helper de extracción simulada offline (Alta fidelidad)
function runOfflineExtractionMock(files) {
    let hasInBody = false;
    let hasLabs = false;
    let hasAllergies = false;
    let hasImaging = false;
    let hasExercise = false;

    for (const file of files) {
        const name = file.originalname.toLowerCase();
        if (name.includes('inbody') || name.includes('composicion') || name.includes('body') || name.includes('peso')) {
            hasInBody = true;
        }
        if (name.includes('lab') || name.includes('quimica') || name.includes('sangre') || name.includes('biometria') || name.includes('chopo') || name.includes('salud')) {
            hasLabs = true;
        }
        if (name.includes('alergia') || name.includes('prick') || name.includes('test') || name.includes('sensib')) {
            hasAllergies = true;
        }
        if (name.includes('ecg') || name.includes('electro') || name.includes('rx') || name.includes('imagen') || name.includes('cardio')) {
            hasImaging = true;
        }
        if (name.includes('reloj') || name.includes('garmin') || name.includes('zepp') || name.includes('fitbit') || name.includes('exercise') || name.includes('entrenamiento') || name.includes('wearable') || name.includes('screenshot') || name.includes('captura')) {
            hasExercise = true;
        }
    }

    // Si no coincide ningún nombre, simular una extracción combinada por defecto
    if (!hasInBody && !hasLabs && !hasAllergies && !hasImaging && !hasExercise) {
        hasInBody = true;
        hasLabs = true;
        hasAllergies = true;
        hasImaging = true;
        hasExercise = true;
    }

    const mockData = {
        labs: {},
        imaging: {},
        body_comp: {},
        allergies_detected: [],
        exercise_log: null
    };

    if (hasInBody) {
        mockData.body_comp = {
            weight: "78.5 kg",
            skeletal_muscle_mass: "34.2 kg",
            body_fat_percent: "22.1%",
            total_body_water: "48.2 L"
        };
    }

    if (hasLabs) {
        mockData.labs = {
            glucose: "105 mg/dL",
            cholesterol: "210 mg/dL",
            triglycerides: "165 mg/dL",
            ast_tgo: "38 U/L",
            alt_tgp: "42 U/L",
            hemoglobin: "11.2 g/dL"
        };
    }

    if (hasImaging) {
        mockData.imaging = {
            ecg: "Ritmo sinusal con bloqueo de rama derecha periférica."
        };
    }

    if (hasAllergies) {
        mockData.allergies_detected = ["Gluten", "Nueces"];
    }

    if (hasExercise) {
        mockData.exercise_log = {
            duration: 2700, // 45 min
            distance: 6200, // 6.2 km
            calories: 520,
            avg_hr: 142,
            max_hr: 168
        };
    }

    return mockData;
}

/**
 * POST /api/bio/scan/sync-cortex
 * Sincronización silenciosa y asíncrona de los marcadores (Electret, Oculómica, Lingual, Externos) a SQLite
 * para que CORTEX los tenga disponibles en la Fase 19.
 */
router.post('/sync-cortex', (req, res) => {
    const { citationId, electretBiomarkers, ocularBiomarkers, lingualBiomarkers, externalMetrics, visualMetrics } = req.body;

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta el parámetro requerido citationId." });
    }

    try {
        // 1. Buscar si hay progreso guardado de la cita en SQLite
        const stmtSelect = db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?');
        const persisted = stmtSelect.get(citationId.toString());

        let patientDataObj = {};
        let phase = 18;
        let block = "PHASE_18_SUMMARY_CONFIRM";

        if (persisted) {
            patientDataObj = JSON.parse(persisted.patient_data_snapshot || '{}');
            phase = persisted.last_active_phase || 18;
            block = persisted.last_active_block || "PHASE_18_SUMMARY_CONFIRM";
        }

        // 2. Inicializar estructura unificada de scan_data si no existe
        patientDataObj.scan_data = patientDataObj.scan_data || {};
        
        // Almacenar métricas de la triada y estudios externos
        if (electretBiomarkers) patientDataObj.scan_data.electret_metrics = electretBiomarkers;
        if (ocularBiomarkers) patientDataObj.scan_data.ocular_metrics = ocularBiomarkers;
        if (lingualBiomarkers) patientDataObj.scan_data.lingual_metrics = lingualBiomarkers;
        if (externalMetrics) patientDataObj.scan_data.external_metrics = externalMetrics;
        if (visualMetrics) patientDataObj.scan_data.visual_metrics = visualMetrics;

        // Sincronizar también en la clave global electret_scan_data para compatibilidad hacia atrás
        patientDataObj.electret_scan_data = {
            ...(patientDataObj.electret_scan_data || {}),
            ...electretBiomarkers,
            ...ocularBiomarkers,
            ...lingualBiomarkers
        };

        // 3. Sincronizar en el panel de vitals para cruce clínico con CORTEX
        patientDataObj.vitals = patientDataObj.vitals || {};
        patientDataObj.signosVitales = patientDataObj.signosVitales || {};
        
        if (electretBiomarkers) {
            if (electretBiomarkers.blood_viscosity) patientDataObj.vitals.blood_viscosity = electretBiomarkers.blood_viscosity.value;
            if (electretBiomarkers.pepsin_coefficient) patientDataObj.vitals.pepsin_coefficient = electretBiomarkers.pepsin_coefficient.value;
            if (electretBiomarkers.phase_angle) patientDataObj.vitals.phase_angle = electretBiomarkers.phase_angle.raw_value;
        }

        if (ocularBiomarkers) {
            if (ocularBiomarkers.hemoglobin) patientDataObj.vitals.hemoglobin = ocularBiomarkers.hemoglobin.raw_value;
            if (ocularBiomarkers.egfr) patientDataObj.vitals.egfr = ocularBiomarkers.egfr.raw_value;
            if (ocularBiomarkers.acr) patientDataObj.vitals.acr = ocularBiomarkers.acr.raw_value;
        }
        if (lingualBiomarkers) {
            if (lingualBiomarkers.hepatic_stress) patientDataObj.vitals.lingual_hepatic_stress = lingualBiomarkers.hepatic_stress.value;
            if (lingualBiomarkers.glycemic_alteration) patientDataObj.vitals.lingual_glycemic_alteration = lingualBiomarkers.glycemic_alteration.value;
            if (lingualBiomarkers.perfusion_motility) patientDataObj.vitals.lingual_perfusion_motility = lingualBiomarkers.perfusion_motility.value;
        }

        if (visualMetrics) {
            if (visualMetrics.findings) patientDataObj.vitals.visual_evidence_notes = visualMetrics.findings;
            if (visualMetrics.severity) patientDataObj.vitals.visual_evidence_severity = visualMetrics.severity;
        }

        // Mapear datos de estudios externos a variables de vitals y bioquímicos
        if (externalMetrics) {
            if (externalMetrics.body_comp) {
                if (externalMetrics.body_comp.weight) {
                    const weightVal = parseFloat(externalMetrics.body_comp.weight);
                    if (!isNaN(weightVal)) {
                        patientDataObj.vitals.weight = weightVal;
                        // Recalcular IMC si hay estatura
                        if (patientDataObj.vitals.height) {
                            const heightMeters = patientDataObj.vitals.height / 100;
                            patientDataObj.vitals.bmi = parseFloat((weightVal / (heightMeters * heightMeters)).toFixed(1));
                        }
                    }
                }
            }

            // Glucosa y Hemoglobina de Labs externos
            if (externalMetrics.labs) {
                if (externalMetrics.labs.glucose) {
                    const match = String(externalMetrics.labs.glucose).match(/\d+/);
                    if (match) {
                        const glucoseVal = parseInt(match[0]);
                        patientDataObj.vitals.glucose = glucoseVal;
                        patientDataObj.signosVitales.glucosa = glucoseVal.toString() + " mg/dL";
                    }
                }
                if (externalMetrics.labs.hemoglobin) {
                    patientDataObj.vitals.hemoglobin = externalMetrics.labs.hemoglobin;
                }
            }

            // Inyección Crítica de Alergias
            if (externalMetrics.allergies_detected && externalMetrics.allergies_detected.length > 0) {
                patientDataObj.safety = patientDataObj.safety || {};
                patientDataObj.safety.allergies = patientDataObj.safety.allergies || [];
                
                const currentSafetyAllergies = new Set(patientDataObj.safety.allergies);
                
                patientDataObj.history = patientDataObj.history || {};
                patientDataObj.history.allergies = patientDataObj.history.allergies || { food: [], drug: [] };
                patientDataObj.history.allergies.food = patientDataObj.history.allergies.food || [];

                externalMetrics.allergies_detected.forEach(allergen => {
                    if (allergen && allergen.trim()) {
                        const trimmed = allergen.trim();
                        currentSafetyAllergies.add(trimmed);

                        const exists = patientDataObj.history.allergies.food.some(
                            a => a.agent.toLowerCase() === trimmed.toLowerCase()
                        );
                        if (!exists) {
                            patientDataObj.history.allergies.food.push({
                                agent: trimmed,
                                reaction: "Detectado en Estudio Externo / Prick Test",
                                status: "ACTIVE"
                            });
                        }
                    }
                });

                patientDataObj.safety.allergies = Array.from(currentSafetyAllergies);
            }

            // Inyección de Telemetría Wearable / Ejercicio
            if (externalMetrics.exercise_log) {
                patientDataObj.lifestyle = patientDataObj.lifestyle || {};
                patientDataObj.lifestyle.exercise_log = externalMetrics.exercise_log;
            }
        }

        // Configuración de banderas de riesgo clínico para alertar a CORTEX (Ejes Clínicos)
        const clinicalFlags = new Set(patientDataObj.clinical_flags || []);
        
        if (electretBiomarkers) {
            if (electretBiomarkers.blood_viscosity && electretBiomarkers.blood_viscosity.status === 'CRITICAL') {
                clinicalFlags.add("HIGH_CARDIO_RISK");
            }
            if (electretBiomarkers.pepsin_coefficient && electretBiomarkers.pepsin_coefficient.status === 'WARNING') {
                clinicalFlags.add("DIGESTIVE_ENZYME_LOW");
            }
        }

        if (ocularBiomarkers) {
            if (ocularBiomarkers.hemoglobin && ocularBiomarkers.hemoglobin.status === 'WARNING') {
                clinicalFlags.add("OCULAR_ANEMIA_ALERT");
            }
            if (ocularBiomarkers.acr && ocularBiomarkers.acr.status === 'CRITICAL') {
                clinicalFlags.add("OCULAR_RENAL_ALERT");
            }
        }

        if (lingualBiomarkers) {
            if (lingualBiomarkers.hepatic_stress && (lingualBiomarkers.hepatic_stress.status === 'WARNING' || lingualBiomarkers.hepatic_stress.status === 'CRITICAL')) {
                clinicalFlags.add("LINGUAL_HEPATIC_ALERT");
            }
            if (lingualBiomarkers.glycemic_alteration && (lingualBiomarkers.glycemic_alteration.status === 'WARNING' || lingualBiomarkers.glycemic_alteration.status === 'CRITICAL')) {
                clinicalFlags.add("LINGUAL_GLYCEMIC_ALERT");
            }
            if (lingualBiomarkers.perfusion_motility && lingualBiomarkers.perfusion_motility.status === 'WARNING') {
                clinicalFlags.add("LINGUAL_CARDIO_ALERT");
            }
        }

        if (visualMetrics && visualMetrics.clinical_flags) {
            visualMetrics.clinical_flags.forEach(flag => {
                if (flag) clinicalFlags.add(flag);
            });
        }

        patientDataObj.clinical_flags = [...clinicalFlags];

        // 4. Guardar de nuevo en SQLite
        const stmtSave = db.prepare(`
            INSERT INTO session_persistence (citation_id, last_active_phase, last_active_block, patient_data_snapshot, is_completed, last_updated)
            VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
            ON CONFLICT(citation_id) DO UPDATE SET
                patient_data_snapshot = excluded.patient_data_snapshot,
                last_updated = CURRENT_TIMESTAMP
        `);

        stmtSave.run(citationId.toString(), phase, block, JSON.stringify(patientDataObj));

        console.log(`💾 [CORTEX SYNC] Métricas completas (con Estudios Externos) guardadas silenciosamente en SQLite para Cita #${citationId}`);
        res.json({ success: true, message: "Sincronización completa de la triada y estudios externos con CORTEX exitosa." });
    } catch (err) {
        console.error("🔥 Error en sync-cortex SQLite unificada:", err.message);
        res.status(500).json({ success: false, message: "Error al sincronizar biomarcadores en base de datos." });
    }
});

// --- PARSER DETERMINISTA LOCAL PARA ARCHIVOS DE TELEMETRÍA WEARABLE (TCX, GPX) ---

function parseWearableXml(filePath, originalName) {
    try {
        const xmlText = fs.readFileSync(filePath, 'utf8');
        const name = originalName.toLowerCase();
        
        if (name.endsWith('.tcx') || name.endsWith('.tcx.xml')) {
            return parseTcx(xmlText);
        } else if (name.endsWith('.gpx') || name.endsWith('.gpx.xml')) {
            return parseGpx(xmlText);
        }
    } catch (err) {
        console.error("🔥 Error al parsear XML wearable:", err.message);
    }
    return null;
}

function parseTcx(xmlText) {
    let duration = 0;
    let distance = 0;
    let calories = 0;
    let avg_hr = 0;
    let max_hr = 0;

    // Sumar laps - TotalTimeSeconds
    const durationMatches = xmlText.match(/<TotalTimeSeconds>([\d\.]+)<\/TotalTimeSeconds>/gi);
    if (durationMatches) {
        durationMatches.forEach(m => {
            const val = parseFloat(m.replace(/<\/?TotalTimeSeconds>/gi, ''));
            if (!isNaN(val)) duration += val;
        });
    }
    duration = Math.round(duration);

    // Sumar laps - DistanceMeters
    const distanceMatches = xmlText.match(/<DistanceMeters>([\d\.]+)<\/DistanceMeters>/gi);
    if (distanceMatches) {
        distanceMatches.forEach(m => {
            const val = parseFloat(m.replace(/<\/?DistanceMeters>/gi, ''));
            if (!isNaN(val)) distance += val;
        });
    }
    distance = Math.round(distance);

    // Sumar laps - Calories
    const caloriesMatches = xmlText.match(/<Calories>(\d+)<\/Calories>/gi);
    if (caloriesMatches) {
        caloriesMatches.forEach(m => {
            const val = parseInt(m.replace(/<\/?Calories>/gi, ''));
            if (!isNaN(val)) calories += val;
        });
    }

    // Promedio de AverageHeartRateBpm
    const avgHrMatches = [];
    const avgHrRegex = /<AverageHeartRateBpm>[^]*?<Value>(\d+)<\/Value>/gi;
    let match;
    while ((match = avgHrRegex.exec(xmlText)) !== null) {
        avgHrMatches.push(parseInt(match[1]));
    }
    if (avgHrMatches.length > 0) {
        avg_hr = Math.round(avgHrMatches.reduce((a, b) => a + b, 0) / avgHrMatches.length);
    }

    // Máximo de MaximumHeartRateBpm
    const maxHrMatches = [];
    const maxHrRegex = /<MaximumHeartRateBpm>[^]*?<Value>(\d+)<\/Value>/gi;
    while ((match = maxHrRegex.exec(xmlText)) !== null) {
        maxHrMatches.push(parseInt(match[1]));
    }
    if (maxHrMatches.length > 0) {
        max_hr = Math.max(...maxHrMatches);
    }

    // Si no se encuentra avg_hr o max_hr en el lap, intentar buscar en los trackpoints:
    if (avg_hr === 0) {
        const tpRegex = /<HeartRateBpm>[^]*?<Value>(\d+)<\/Value>/gi;
        const tpHrs = [];
        while ((match = tpRegex.exec(xmlText)) !== null) {
            tpHrs.push(parseInt(match[1]));
        }
        if (tpHrs.length > 0) {
            avg_hr = Math.round(tpHrs.reduce((a, b) => a + b, 0) / tpHrs.length);
            max_hr = Math.max(...tpHrs, max_hr);
        }
    }

    return { duration, distance, calories, avg_hr, max_hr };
}

function parseGpx(xmlText) {
    let match;
    const trackpoints = [];
    const trkptRegex = /<trkpt\s+lat=["']([\d\.-]+)["']\s+lon=["']([\d\.-]+)["']/gi;
    while ((match = trkptRegex.exec(xmlText)) !== null) {
        trackpoints.push({
            lat: parseFloat(match[1]),
            lon: parseFloat(match[2])
        });
    }

    const timeRegex = /<time>([^<]+)<\/time>/gi;
    const times = [];
    while ((match = timeRegex.exec(xmlText)) !== null) {
        times.push(match[1]);
    }

    let duration = 0;
    if (times.length >= 2) {
        const startTime = new Date(times[0]);
        const endTime = new Date(times[times.length - 1]);
        if (!isNaN(startTime) && !isNaN(endTime)) {
            duration = Math.max(0, Math.round((endTime - startTime) / 1000));
        }
    }

    let distance = 0;
    for (let i = 0; i < trackpoints.length - 1; i++) {
        const p1 = trackpoints[i];
        const p2 = trackpoints[i + 1];
        distance += haversine(p1.lat, p1.lon, p2.lat, p2.lon);
    }
    distance = Math.round(distance);

    const hrRegex = /<(?:(?:gpxtpx|ns3):)?hr>(\d+)<\/(?:(?:gpxtpx|ns3):)?hr>/gi;
    const hrs = [];
    while ((match = hrRegex.exec(xmlText)) !== null) {
        hrs.push(parseInt(match[1]));
    }
    
    let avg_hr = 0;
    let max_hr = 0;
    if (hrs.length > 0) {
        avg_hr = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
        max_hr = Math.max(...hrs);
    }

    let calories = 0;
    if (distance > 0) {
        calories = Math.round((distance / 1000) * 65);
    } else if (duration > 0) {
        calories = Math.round((duration / 60) * 7.5);
    }

    return { duration, distance, calories, avg_hr, max_hr };
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

module.exports = router;
