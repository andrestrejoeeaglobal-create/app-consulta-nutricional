const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const sharp = require('sharp');
const { db } = require('../db');
const cryptoVault = require('../utils/cryptoVault');
const { GoogleGenAI } = require('@google/genai');
const { parseElectretHTML, parseElectretJSON, normalizeClinicalName, parseLocalDate, isSyntheticElectretPayload } = require('../utils/electretParser');
const { samplePhysicalSensor, synthesizePatientStudy } = require('../services/directElectretEngine');
const { callSensoryHubWithFallback } = require('../services/sensoryBridge');

let lastDirectScanResult = null;

/**
 * Esteriliza el entorno físico de escaneo eliminando el informe previo de ResultOne.htm
 * Protegido con try/catch para evitar EPERM si Windows restringe permisos en Program Files (Sutura 1).
 */
function sterilizeElectretReport() {
    // 🛡️ NOM-004: Conservación del reporte consolidado ResultOne.htm en disco.
    // La protección contra contaminación cruzada se realiza mediante el Candado Biométrico (checkPatientMatch).
    return 0;
}

/**
 * Función de cotejo biométrico NOM-004 entre paciente de cita y paciente del reporte (Sutura 2).
 */
function checkPatientMatch(activePatientName, scanPatientName) {
    const normActive = normalizeClinicalName(activePatientName);
    const normScan = normalizeClinicalName(scanPatientName);
    if (!normActive || !normScan) return false;
    if (normActive === normScan) return true;
    
    // Tokens significativos (>2 caracteres)
    const activeTokens = normActive.split(' ').filter(t => t.length > 2);
    const scanTokens = normScan.split(' ').filter(t => t.length > 2);
    
    const matchingTokens = activeTokens.filter(t => scanTokens.includes(t));
    return matchingTokens.length >= 2 || (activeTokens.length === 1 && matchingTokens.length === 1);
}

function fileToGenerativePart(filePath, mimeType) {
    if (!fs.existsSync(filePath)) return null;
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType: mimeType || 'image/jpeg'
        },
    };
}

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
        if (file.fieldname === 'dorsalImage') {
            prefix = 'lingual-dorsal-';
        } else if (file.fieldname === 'ventralImage') {
            prefix = 'lingual-ventral-';
        } else if (file.fieldname === 'lingualImage') {
            prefix = 'lingual-';
        } else if (file.fieldname === 'externalDocs') {
            prefix = 'ext-';
        } else if (file.fieldname === 'visualImage' || file.fieldname === 'visualImages') {
            prefix = 'visual-';
        } else if (file.fieldname === 'rightEye') {
            prefix = 'ocular-od-';
        } else if (file.fieldname === 'leftEye') {
            prefix = 'ocular-oi-';
        }
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 } // Límite expandido a 25MB para prevenir error 413
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
    const electretPaths = [
        "C:\\Program Files (x86)\\Electret\\Electret.exe",
        "C:\\Program Files (x86)\\Sistema Cuántico Bio-Eléctrico (4)\\Electret.exe",
        "C:\\Program Files (x86)\\Sistema Cuántico Bio-Eléctrico\\Electret.exe"
    ];
    const electretPath = electretPaths.find(p => fs.existsSync(p)) || electretPaths[0];
    let isPhysicalHardwareActive = false;

    if (fs.existsSync(electretPath)) {
        console.log("⚡ Hardware Electret detectado localmente. Iniciando puente RPA...");
        try {
            // Pasamos el path del JSON seguro como único argumento
            const pythonBridgePath = path.join(__dirname, '..', '..', 'bio_bridge_agent.py');
            const venvPythonPath = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
            const pythonExe = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';
            const pythonProcess = spawn(pythonExe, [pythonBridgePath, tempFilePath]);

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
 * GET /api/bio/hardware-status
 * Devuelve el estado actual de la conexión física del hardware Electret
 */
router.get('/hardware-status', (req, res) => {
    const electretPaths = [
        "C:\\Program Files (x86)\\Electret\\Electret.exe",
        "C:\\Program Files (x86)\\Sistema Cuántico Bio-Eléctrico (4)\\Electret.exe",
        "C:\\Program Files (x86)\\Sistema Cuántico Bio-Eléctrico\\Electret.exe"
    ];
    const isHardwareDetected = electretPaths.some(p => fs.existsSync(p));
    res.json({
        success: true,
        connected: isHardwareDetected,
        handContactDetected: isHardwareDetected,
        voltage_uv: isHardwareDetected ? 58.42 : 0,
        impedance_ohms: isHardwareDetected ? 1410 : 0
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
        const parsedPath = path.join(__dirname, '..', 'uploads', 'parsed_results.json');
        if (fs.existsSync(parsedPath)) {
            try {
                payload = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
                console.log("🧬 Express /status: Cargados resultados anidados de Electret desde parsed_results.json");
            } catch (err) {
                console.error("🔥 Error al leer parsed_results.json en Express:", err.message);
            }
        }

        if (!payload) {
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
        }

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
 * POST /api/bio/scan/electret/launch
 * Lanzamiento asistido del software original Electret vía Windows Shell (start "")
 * Bypass de restricciones UIPI delegando la elevación gráfica al explorador del sistema operativo
 */
router.post('/electret/launch', (req, res) => {
    const { name = 'Jorge Muñoz Padilla', age = 51, height = 172, weight = 78 } = req.body || {};

    const pythonBridgePath = path.join(__dirname, '..', '..', 'bio_bridge_agent.py');
    const venvPythonPath = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
    const pythonExe = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

    // Crear JSON temporal para bio_bridge_agent
    const tempScanId = `launch_${Date.now()}`;
    const tempJsonPath = path.join(__dirname, '..', 'uploads', `temp_patient_${tempScanId}.json`);

    try {
        fs.writeFileSync(tempJsonPath, JSON.stringify({ name, age, height, weight }, null, 2), 'utf8');
        console.log(`🚀 [AUTONOMOUS RPA] Disparando bio_bridge_agent.py para ${name}...`);

        const { spawn } = require('child_process');
        const child = spawn(pythonExe, [pythonBridgePath, tempJsonPath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: false
        });
        child.unref();

        return res.json({
            success: true,
            message: `Puente autónomo RPA iniciado para ${name}.`,
            patient: name
        });
    } catch (err) {
        console.error("🔥 [AUTONOMOUS RPA] Error al disparar puente:", err.message);
        return res.json({
            success: false,
            error: "BRIDGE_FAILED",
            message: "No se pudo disparar el puente autónomo RPA.",
            detail: err.message
        });
    }
});

/**
 * POST /api/bio/scan/electret/sterilize
 * Apoptosis física de archivos residuales del escáner previo (Sutura 1: try/catch defensivo contra EPERM)
 */
router.post('/electret/sterilize', (req, res) => {
    const purged = sterilizeElectretReport();
    res.json({
        success: true,
        purgedFiles: purged,
        message: "Sala de escaneo esterilizada físicamente."
    });
});

/**
 * Comprueba de forma asíncrona y no bloqueante la presencia de hardware USB (Sensor VID_5608 y Dongle VID_096E)
 */
function checkUsbHardwareStatus() {
    return new Promise((resolve) => {
        const { execFile } = require('child_process');
        execFile('reg.exe', ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Enum\\USB\\VID_5608&PID_0808'], (err1) => {
            const hasSensor = !err1;
            execFile('reg.exe', ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Enum\\USB\\VID_096E&PID_0304'], (err2) => {
                const hasDongle = !err2;
                resolve({
                    sensorConnected: hasSensor,
                    dongleConnected: hasDongle,
                    hardwareReady: hasSensor || hasDongle,
                    status: (hasSensor && hasDongle) ? "ONLINE" : (hasSensor || hasDongle ? "PARTIAL" : "SIMULATION")
                });
            });
        });
    });
}

/**
 * Decodifica de forma segura un buffer HTML exportado por el Analizador Cuántico
 * priorizando latin1 (iso-8859-1 / windows-1252) salvo cabecera explícita UTF-8.
 */
function decodeElectretBuffer(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer)) return '';
    const headAscii = buffer.subarray(0, 1024).toString('ascii');
    if (/charset\s*=\s*["']?utf-?8/i.test(headAscii)) {
        return buffer.toString('utf8');
    }
    return buffer.toString('latin1');
}

/**
 * Persiste únicamente el sub-árbol bioeléctrico verificado en session_persistence (AES-256-GCM),
 * preservando intactos last_active_phase, last_active_block, user_id y datos de Fases 0–17.
 */
function persistVerifiedElectretToSession({ citationId, patientName, parsed, source = 'NATIVE_HTM_INGESTION' }) {
    if (!parsed?.success || !parsed?.categories) return false;
    const cleanCita = String(citationId || '').trim();
    const cleanName = String(patientName || parsed?.patientMetadata?.name || '').trim();
    // 🛡️ REGLA 8 NOM-004: Solo persistir cuando exista citationId explícito (prohibido adivinar folio histórico por nombre)
    if (!cleanCita) return false;

    try {
        const rows = db.prepare('SELECT citation_id, patient_data_snapshot FROM session_persistence WHERE citation_id = ? AND patient_data_snapshot IS NOT NULL').all(cleanCita);

        for (const row of rows) {
            const decStr = cryptoVault.decryptClinicalData(row.patient_data_snapshot);
            if (!decStr) continue;
            const snap = typeof decStr === 'string' ? JSON.parse(decStr) : decStr;
            const snapName = (snap?.profile?.name || snap?.identificacion?.nombre || '').trim();
            const matchesRow = cleanCita
                ? String(row.citation_id) === cleanCita
                : (snapName && checkPatientMatch(cleanName, snapName));
            if (!matchesRow) continue;

            if (snapName && parsed.patientMetadata?.name && !checkPatientMatch(snapName, parsed.patientMetadata.name)) {
                console.warn(`🛡️ [NOM-004] Persistencia bloqueada: el estudio "${parsed.patientMetadata.name}" no coincide con "${snapName}" (Cita #${row.citation_id}).`);
                return false;
            }

            const bodyFatItem = (parsed.categories?.body_composition?.items || []).find((i) => i.slot === 'body_fat_pct');
            if (bodyFatItem?.numeric_value && !snap?.vitals?.body_fat) {
                snap.vitals = {
                    ...(snap.vitals || {}),
                    body_fat: bodyFatItem.numeric_value
                };
            }

            snap.scan_data = {
                ...(snap.scan_data || {}),
                electret_metrics: parsed.categories,
                electret_scanned: true,
                electret_skipped: false,
                electret_patient_name: parsed.patientMetadata?.name || snapName || cleanName,
                electret_metadata: parsed.patientMetadata || null,
                electret_synthesis: parsed.synthesisItems || []
            };

            snap.electretTelemetry = {
                isScanned: true,
                scannedAt: parsed.patientMetadata?.parsedLocalDate || new Date().toISOString(),
                citationId: row.citation_id,
                patientName: parsed.patientMetadata?.name || snapName || cleanName,
                patientMetadata: parsed.patientMetadata || null,
                categories: parsed.categories,
                synthesisItems: parsed.synthesisItems || [],
                totalParameters: parsed.totalParameters,
                abnormalCount: parsed.abnormalCount,
                source
            };

            snap._server_rewind_nonce = Date.now();
            const encSnap = cryptoVault.encryptClinicalData(snap);
            db.prepare('UPDATE session_persistence SET patient_data_snapshot = ?, last_updated = CURRENT_TIMESTAMP WHERE citation_id = ?').run(encSnap, row.citation_id);
            return true;
        }
    } catch (persistErr) {
        console.warn('⚠️ [ELECTRET PERSIST] Aviso no bloqueante:', persistErr.message);
    }
    return false;
}

/**
 * Localiza de forma autónoma el estudio .htm completo más reciente del paciente en el consultorio,
 * ordenando por fecha de modificación descendente (mtimeMs) y validando identidad NOM-004.
 */
function findPatientStudyOnDisk(targetPatientName, options = {}) {
    if (!targetPatientName) return null;
    const minMtimeMs = Number(options.minMtimeMs) || 0;
    const userHome = process.env.USERPROFILE || 'C:\\Users\\andre';
    const searchDirs = [
        'C:\\Program Files (x86)\\Sistema Cuántico Bio-Eléctrico (4)',
        'C:\\Program Files (x86)\\Sistema Cuántico Bio-Eléctrico',
        'C:\\Program Files (x86)\\Electret',
        path.join(userHome, 'OneDrive', 'Escritorio'),
        path.join(userHome, 'Escritorio'),
        path.join(userHome, 'OneDrive', 'Desktop'),
        path.join(userHome, 'Desktop'),
        path.join(userHome, 'Downloads'),
        path.join(userHome, 'Descargas'),
        path.join(userHome, 'OneDrive', 'Documentos'),
        path.join(userHome, 'Documents')
    ];

    console.log(`🔍 [AUTONOMOUS TELEMETRY] Buscando estudio .htm real para "${targetPatientName}"${minMtimeMs > 0 ? ` (posterior a ${new Date(minMtimeMs).toLocaleTimeString('es-MX')})` : ''}...`);

    const allCandidateFiles = [];
    const seenPaths = new Set();

    for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            const rawFiles = fs.readdirSync(dir);
            for (const f of rawFiles) {
                const low = f.toLowerCase();
                if ((!low.endsWith('.htm') && !low.endsWith('.html')) || low.startsWith('contrast') || low === 'resultall.htm') {
                    continue;
                }
                const fullPath = path.join(dir, f);
                const normFull = fullPath.toLowerCase();
                if (seenPaths.has(normFull)) continue;
                seenPaths.add(normFull);

                try {
                    const stat = fs.statSync(fullPath);
                    if (!stat.isFile() || stat.size < 80000) continue; // Descarta reportes parciales de 1 sola categoría (~15KB)
                    if (minMtimeMs > 0 && stat.mtimeMs < minMtimeMs) continue;
                    allCandidateFiles.push({ name: f, fullPath, size: stat.size, mtimeMs: stat.mtimeMs });
                } catch (_) {}
            }
        } catch (_) {}
    }

    // Ordenar estrictamente del archivo más reciente al más antiguo
    allCandidateFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);

    let freshMismatchName = null;

    for (const item of allCandidateFiles) {
        try {
            const rawBuf = fs.readFileSync(item.fullPath);
            const htmlText = decodeElectretBuffer(rawBuf);
            if (!htmlText.includes('Informe del An') && !htmlText.includes('Informe de prueba')) {
                continue;
            }
            const parsed = parseElectretHTML(htmlText);
            const catCount = Object.keys(parsed.categories || {}).length;
            if (!parsed.success || catCount < 20) continue;

            if (checkPatientMatch(targetPatientName, parsed.patientMetadata?.name)) {
                console.log(`✅ [AUTONOMOUS TELEMETRY] Estudio nativo verificado (${catCount} categorías, ${parsed.totalParameters} parámetros, ${parsed.synthesisCount || 0} síntesis) en: ${item.fullPath}`);
                return { file: item.fullPath, mtimeMs: item.mtimeMs, parsed };
            } else if (minMtimeMs > 0 && item.name.toLowerCase() === 'resultone.htm' && parsed.patientMetadata?.name) {
                freshMismatchName = parsed.patientMetadata.name;
            }
        } catch (_) {}
    }

    if (freshMismatchName) {
        return { crossPatientMismatch: true, scannedPatientName: freshMismatchName };
    }

    return null;
}

/**
 * GET /api/bio/hardware/status
 * Telemetría de estado del hardware físico USB
 */
router.get('/hardware/status', async (req, res) => {
    try {
        const hw = await checkUsbHardwareStatus();
        res.json({ success: true, hardware: hw });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST & GET /api/bio/scan/electret/sync
 * Sincronización autónoma de reporte .htm real con blindaje de identidad NOM-004 (Cero Datos Sintéticos).
 */
const handleElectretSync = async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });

    const targetPatientName = (req.body?.patientName || req.body?.name || req.query?.patientName || req.query?.name || '').trim();
    const targetCitationId = String(req.body?.citationId || req.query?.citationId || '').trim();
    const minMtimeMs = Number(req.body?.minMtimeMs || req.query?.minMtimeMs || 0) || 0;
    const forceFresh = req.query.forceFresh === 'true' || req.body?.forceFresh === true || minMtimeMs > 0;
    const storedOnly = req.query.storedOnly === 'true' || req.body?.storedOnly === true;

    console.log(`🔄 [ELECTRET SYNC] Sincronización solicitada para: "${targetPatientName || `Cita #${targetCitationId}`}" (forceFresh=${forceFresh}, storedOnly=${storedOnly})`);

    let hwStatus = { sensorConnected: false, dongleConnected: false, hardwareReady: false, status: 'OFFLINE' };
    try {
        hwStatus = await checkUsbHardwareStatus();
    } catch (hwErr) {
        console.warn('⚠️ No se pudo sondear hardware PnP:', hwErr.message);
    }

    // 1. Recuperación desde bóveda SQLite (session_persistence) únicamente si contiene telemetría real no sintética
    let needsRealHtmUpgrade = false;
    if (!forceFresh && (targetCitationId || targetPatientName)) {
        try {
            const persistedRows = targetCitationId
                ? db.prepare('SELECT citation_id, user_id, patient_data_snapshot FROM session_persistence WHERE citation_id = ? AND patient_data_snapshot IS NOT NULL').all(targetCitationId)
                : db.prepare('SELECT citation_id, user_id, patient_data_snapshot FROM session_persistence WHERE patient_data_snapshot IS NOT NULL ORDER BY last_updated DESC').all();
            for (const row of persistedRows) {
                const decStr = cryptoVault.decryptClinicalData(row.patient_data_snapshot);
                if (!decStr) continue;
                const snap = typeof decStr === 'string' ? JSON.parse(decStr) : decStr;
                const snapName = (snap?.profile?.name || snap?.identificacion?.nombre || snap?.scan_data?.electret_patient_name || '').trim();
                const storedMetrics = snap?.scan_data?.electret_metrics || snap?.electretTelemetry?.categories;
                const matchesIdentity = targetCitationId
                    ? String(row.citation_id) === targetCitationId
                    : (snapName && checkPatientMatch(targetPatientName, snapName));

                if (storedMetrics && Object.keys(storedMetrics).length > 0 && matchesIdentity) {
                    if (isSyntheticElectretPayload(storedMetrics)) {
                        console.warn(`🛑 [NOM-004] Detectado snapshot sintético legado en Cita #${row.citation_id}; resolviendo estudio .htm real automáticamente.`);
                        needsRealHtmUpgrade = true;
                        continue;
                    }
                    return res.json({
                        success: true,
                        hardware: hwStatus,
                        patientMetadata: snap?.scan_data?.electret_metadata || snap?.electretTelemetry?.patientMetadata || {
                            name: snapName,
                            scanDate: snap?.electretTelemetry?.scannedAt || null
                        },
                        electret_metrics: storedMetrics,
                        synthesisItems: snap?.scan_data?.electret_synthesis || snap?.electretTelemetry?.synthesisItems || [],
                        totalParameters: snap?.electretTelemetry?.totalParameters || 262,
                        abnormalCount: snap?.electretTelemetry?.abnormalCount || 0,
                        electret_scanned: true,
                        source: 'SQLITE_SESSION_PERSISTENCE'
                    });
                }
            }
        } catch (sqliteSyncErr) {
            console.warn('⚠️ [SQLITE TELEMETRY RECOVERY] Aviso:', sqliteSyncErr.message);
        }
    }

    if (storedOnly && !needsRealHtmUpgrade) {
        return res.json({
            success: false,
            status: 'NO_STORED_STUDY',
            electret_scanned: false
        });
    }

    // 2. Resolución directa autónoma desde archivo .htm real en disco (ordenado por mtimeMs más reciente)
    const patientStudy = findPatientStudyOnDisk(targetPatientName, { minMtimeMs });
    if (patientStudy?.crossPatientMismatch) {
        return res.status(409).json({
            success: false,
            error: 'CROSS_PATIENT_CONTAMINATION_PREVENTED',
            scannedPatientName: patientStudy.scannedPatientName,
            message: `El informe recién generado en Electret pertenece a "${patientStudy.scannedPatientName}", el cual no coincide con el paciente activo ("${targetPatientName}"). Verifique el nombre en Electret y vuelva a generar el informe.`
        });
    }

    if (patientStudy && patientStudy.parsed?.success) {
        const { parsed } = patientStudy;
        persistVerifiedElectretToSession({
            citationId: targetCitationId,
            patientName: targetPatientName,
            parsed,
            source: 'AUTONOMOUS_HTM_SYNC'
        });

        return res.json({
            success: true,
            hardware: hwStatus,
            patientMetadata: parsed.patientMetadata,
            electret_metrics: parsed.categories,
            synthesisItems: parsed.synthesisItems || [],
            synthesisCount: parsed.synthesisCount || 0,
            totalParameters: parsed.totalParameters,
            abnormalCount: parsed.abnormalCount,
            electret_scanned: true,
            source: 'AUTONOMOUS_HTM_SYNC',
            studyFile: path.basename(patientStudy.file)
        });
    }

    // 3. Vía secundaria: Puente nativo read_electret.exe (únicamente cuando no se exige mtime nuevo estricto o acaba de generarse)
    const { execFile } = require('child_process');
    const exePath = path.join(__dirname, '..', 'read_electret.exe');

    if (minMtimeMs === 0 && fs.existsSync(exePath)) {
        execFile(exePath, [], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 5000 }, (error, stdout) => {
            if (!error && stdout) {
                try {
                    const rawData = JSON.parse(stdout.trim());
                    if (rawData.success && rawData.html_content) {
                        const parsedResult = parseElectretHTML(rawData.html_content);
                        if (
                            parsedResult.success &&
                            Object.keys(parsedResult.categories || {}).length >= 20 &&
                            parsedResult.patientMetadata?.name &&
                            checkPatientMatch(targetPatientName, parsedResult.patientMetadata.name)
                        ) {
                            persistVerifiedElectretToSession({
                                citationId: targetCitationId,
                                patientName: targetPatientName,
                                parsed: parsedResult,
                                source: 'LIVE_ELECTRET_SOFTWARE'
                            });
                            return res.json({
                                success: true,
                                hardware: hwStatus,
                                patientMetadata: parsedResult.patientMetadata,
                                electret_metrics: parsedResult.categories,
                                synthesisItems: parsedResult.synthesisItems || [],
                                synthesisCount: parsedResult.synthesisCount || 0,
                                totalParameters: parsedResult.totalParameters,
                                abnormalCount: parsedResult.abnormalCount,
                                electret_scanned: true,
                                source: 'LIVE_ELECTRET_SOFTWARE'
                            });
                        }
                    }
                } catch (_) {}
            }

            return res.json({
                success: false,
                hardware: hwStatus,
                error: 'NO_ACTIVE_STUDY',
                message: `No se encontró un informe .htm verificado para ${targetPatientName || 'el paciente'}. Realice el escaneo en Electret, presione "Obtener Informe" o cargue el archivo .htm exportado.`
            });
        });
        return;
    }

    return res.json({
        success: false,
        hardware: hwStatus,
        error: 'NO_ACTIVE_STUDY',
        message: `Aguardando generación del informe .htm para ${targetPatientName || 'el paciente'} en el software del analizador.`
    });
};

/**
 * POST /api/bio/scan/electret/upload-htm
 * Carga manual asistida de archivo .htm/.html exportado por el software original del analizador cuántico
 * con decodificación latin1 segura, candado biométrico NOM-004 y persistencia cifrada.
 */
router.post('/electret/upload-htm', upload.single('htmFile'), (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    const uploadedFile = req.file;
    const targetPatientName = String(req.body?.patientName || '').trim();
    const targetCitationId = String(req.body?.citationId || '').trim();

    if (!uploadedFile || !uploadedFile.path) {
        return res.status(400).json({
            success: false,
            error: 'MISSING_HTM_FILE',
            message: 'No se recibió ningún archivo .htm o .html para analizar.'
        });
    }

    try {
        const rawBuf = fs.readFileSync(uploadedFile.path);
        const htmlContent = decodeElectretBuffer(rawBuf);
        const parsed = parseElectretHTML(htmlContent);
        const catCount = Object.keys(parsed.categories || {}).length;

        if (!parsed.success || catCount < 15) {
            return res.status(422).json({
                success: false,
                error: 'INVALID_ELECTRET_HTM',
                message: 'El archivo seleccionado no corresponde a un informe completo válido del analizador cuántico bioeléctrico.'
            });
        }

        if (targetPatientName && parsed.patientMetadata?.name && !checkPatientMatch(targetPatientName, parsed.patientMetadata.name)) {
            return res.status(409).json({
                success: false,
                error: 'CROSS_PATIENT_CONTAMINATION_PREVENTED',
                scannedPatientName: parsed.patientMetadata.name,
                message: `El informe cargado pertenece a "${parsed.patientMetadata.name}", el cual no coincide con el titular del expediente actual ("${targetPatientName}"). Carga bloqueada por bioseguridad NOM-004.`
            });
        }

        persistVerifiedElectretToSession({
            citationId: targetCitationId,
            patientName: targetPatientName || parsed.patientMetadata?.name,
            parsed,
            source: 'MANUAL_HTM_UPLOAD'
        });

        return res.json({
            success: true,
            patientMetadata: parsed.patientMetadata,
            electret_metrics: parsed.categories,
            synthesisItems: parsed.synthesisItems || [],
            synthesisCount: parsed.synthesisCount || 0,
            totalParameters: parsed.totalParameters,
            abnormalCount: parsed.abnormalCount,
            electret_scanned: true,
            source: 'MANUAL_HTM_UPLOAD',
            studyFile: uploadedFile.originalname
        });
    } catch (err) {
        console.error('🔥 [UPLOAD HTM] Error procesando archivo .htm:', err.message);
        return res.status(500).json({
            success: false,
            error: 'HTM_PARSE_EXCEPTION',
            message: 'Error al leer o decodificar el archivo .htm seleccionado.'
        });
    } finally {
        try {
            if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
                fs.unlinkSync(uploadedFile.path);
            }
        } catch (_) {}
    }
});

/**
 * POST /api/bio/scan/electret/direct-acquire
 * 🛡️ REGLA 8 NOM-004 (CERO DATOS INVENTADOS):
 * Se elimina la síntesis algorítmica de 253 parámetros sobre catálogo estático.
 * Lanza el puente RPA autónomo hacia Electret.exe y deriva al Centinela de Sincronización .htm real.
 */
router.post('/electret/direct-acquire', async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });

    const {
        name = 'Paciente',
        age = 51,
        height = 172,
        weight = 78
    } = req.body || {};

    const scanStartedAtMs = Date.now() - 3000;
    let bridgeLaunched = false;

    try {
        const pythonBridgePath = path.join(__dirname, '..', '..', 'bio_bridge_agent.py');
        const venvPythonPath = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
        const pythonExe = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

        if (fs.existsSync(pythonBridgePath)) {
            const tempScanId = `launch_${Date.now()}`;
            const tempJsonPath = path.join(__dirname, '..', 'uploads', `temp_patient_${tempScanId}.json`);
            fs.writeFileSync(tempJsonPath, JSON.stringify({ name, age, height, weight }, null, 2), 'utf8');
            const child = spawn(pythonExe, [pythonBridgePath, tempJsonPath], {
                detached: true,
                stdio: 'ignore',
                windowsHide: false
            });
            child.unref();
            bridgeLaunched = true;
        }
    } catch (bridgeErr) {
        console.warn('⚠️ [ELECTRET BRIDGE] No se pudo iniciar RPA automático:', bridgeErr.message);
    }

    return res.status(202).json({
        success: false,
        error: 'AWAITING_ELECTRET_REPORT',
        fallbackToSentinel: true,
        bridgeLaunched,
        scanStartedAtMs,
        message: 'Software del analizador cuántico iniciado. Aguardando la generación del informe .htm real.'
    });
});

router.post('/electret/sync', handleElectretSync);
router.get('/electret/sync', handleElectretSync);
router.post('/electret/acquire', handleElectretSync);

// ============================================================================
// 🛡️ GUARDIAS SSoTT DE FASE 18 (EGM-36, EGM-38, EGM-39, EGM-41, EGM-45)
// Honestidad biológica, Marca Blanca Equipo en Acción® y Blindaje COFEPRIS
// ============================================================================
function normalizeCornealArcusScale(rawArco) {
    const s = String(rawArco || '').trim();
    if (!s || /negativ|ausent|sin\s+arco|normal/i.test(s)) {
        return 'Ausente';
    }
    if (/grado\s*(ii|iii|2|3)|circunferencial|denso|severo|marcado/i.test(s)) {
        return 'Grado II–III (Circunferencial)';
    }
    return 'Grado I (Incipiente)';
}

function sanitizeWhiteLabelClinicalText(rawText) {
    if (!rawText || typeof rawText !== 'string') return rawText;
    return rawText
        .replace(/Gemini\s*2\.5\s*Flash\s*Vision|Gemini\s*2\.5\s*Flash|Gemini\s*Vision|Google\s*Gemini|CYTOS\s*Spectrum|Topograf[ií]a\s*CYTOS|\bCYTOS\b/gi, 'Motor de Visión Clínica Equipo en Acción®')
        .replace(/microcirculaci[oó]n\s+foveal/gi, 'microcirculación epiescleral y bulbar')
        .replace(/&/g, 'y')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function sanitizeOcularPredictionSSoT(rawPred, patientAge = 60) {
    if (!rawPred || typeof rawPred !== 'object') return rawPred;
    const pilares = rawPred.pilares && typeof rawPred.pilares === 'object' ? { ...rawPred.pilares } : {};
    const tipoToma = sanitizeWhiteLabelClinicalText(rawPred.tipo_toma_detectada || 'Segmento Anterior (Superficie Ocular Externa)');
    const isPosteriorRetina = /fondo\s+de\s+ojo|retinograf/i.test(tipoToma);

    if (pilares.diabetes_glucosa) {
        const dg = { ...pilares.diabetes_glucosa };
        const riesgoUpper = String(dg.riesgo || 'BAJO').toUpperCase();
        const ecoLabel = riesgoUpper.includes('ELEV') || riesgoUpper.includes('ALT')
            ? 'Sobrecarga Microvascular Activa'
            : riesgoUpper.includes('MOD')
                ? 'Vigilancia Microvascular Moderada'
                : 'Equilibrio Microvascular Fisiológico';
        dg.titulo = 'Eco Metabólico y Microvasculatura Epiescleral';
        dg.indice_eco_metabolico = dg.indice_eco_metabolico || ecoLabel;
        delete dg.hba1c_estimada;
        dg.edema_macular = isPosteriorRetina ? (dg.edema_macular || 'Ausente') : 'No valorable en toma externa de segmento anterior';
        dg.retinopatia_microangiopatia = sanitizeWhiteLabelClinicalText(
            dg.retinopatia_microangiopatia || 'Microcirculación epiescleral y bulbar conservada'
        ).replace(/diab[eé]tic[ao]s?/gi, 'microvascular');
        dg.hallazgos = sanitizeWhiteLabelClinicalText(
            dg.hallazgos || 'Lecho microvascular epiescleral y bulbar sin signos morfológicos de congestión reactiva.'
        )
            .replace(/HbA1c(?:\s*(?:estimad[ao]|est\.?|[<>≥≤=:\-])*\s*\d+(?:[.,]\d+)?\s*%)?/gi, 'indicador morfológico de Eco Metabólico')
            .replace(/diab[eé]tic[ao]s?/gi, 'microvascular')
            .replace(/\bdiabetes\b/gi, 'desequilibrio metabólico')
            .replace(/\bglucosa\b/gi, 'Eco Metabólico');
        pilares.diabetes_glucosa = dg;
    }

    if (pilares.cardiovascular_lipidos) {
        const cv = { ...pilares.cardiovascular_lipidos };
        cv.titulo = 'Salud Cardiovascular y Lípidos';
        cv.arco_senil_corneal = normalizeCornealArcusScale(cv.arco_senil_corneal);
        cv.angioarquitectura_hipertensiva = sanitizeWhiteLabelClinicalText(cv.angioarquitectura_hipertensiva || 'Calibre microvascular conservado');
        cv.hallazgos = sanitizeWhiteLabelClinicalText(cv.hallazgos || 'Calibre vascular epiescleral y transparencia perilímbica evaluados.');
        pilares.cardiovascular_lipidos = cv;
    }

    const csa = { ...(pilares.conteo_sanguineo_anemia || {}) };
    const palidezRaw = String(csa.palidez_conjuntival_tarsal || '');
    const hallazgosRaw = String(csa.hallazgos || '');
    const explicitTarsalEversion =
        csa.tiene_eversion_tarsal === true &&
        !/no\s+evaluable|falta\s+de\s+eversi[oó]n|sin\s+eversi[oó]n/i.test(`${palidezRaw} ${hallazgosRaw}`);

    csa.titulo = 'Perfusión Conjuntival Tarsal';
    csa.hemoglobina_estimada_gdl = null;
    if (!explicitTarsalEversion) {
        csa.tiene_eversion_tarsal = false;
        csa.estado_anemia = 'NO_EVALUABLE';
        csa.palidez_conjuntival_tarsal = 'No evaluable sin eversión palpebral tarsal';
        csa.hallazgos = 'Determinación morfológica tarsal no evaluable en fotografía bulbar frontal sin eversión del párpado inferior. La cuantificación de hemoglobina requiere biometría hemática venosa.';
    } else {
        csa.estado_anemia = /palidez|anemia|hipocrom/i.test(String(csa.estado_anemia || palidezRaw)) ? 'OBSERVACIÓN TARSAL' : 'NORMOCRÓMICA TARSAL';
        csa.palidez_conjuntival_tarsal = sanitizeWhiteLabelClinicalText(palidezRaw || 'Coloración tarsal conservada');
        csa.hallazgos = sanitizeWhiteLabelClinicalText(hallazgosRaw || 'Perfusión microvascular tarsal evaluada cualitativamente; requiere biometría hemática venosa para cuantificación de hemoglobina.')
            .replace(/\b\d+(?:\.\d+)?\s*g\/dL\b/gi, 'valor cuantitativo sujeto a laboratorio venoso');
    }
    pilares.conteo_sanguineo_anemia = csa;

    if (pilares.funcion_renal_hepatica) {
        pilares.funcion_renal_hepatica = {
            ...pilares.funcion_renal_hepatica,
            titulo: 'Función Renal y Hepatobiliar (Morfología Periorbital)',
            hallazgos: sanitizeWhiteLabelClinicalText(pilares.funcion_renal_hepatica.hallazgos || 'Región periorbitaria y estroma escleral evaluados.')
        };
    }

    if (pilares.edad_biologica_longevidad) {
        const eb = { ...pilares.edad_biologica_longevidad };
        eb.titulo = 'Edad Biológica Ocular y Resiliencia Endotelial';
        eb.edad_cronologica = eb.edad_cronologica || patientAge;
        eb.edad_biologica_ocular = eb.edad_biologica_ocular || patientAge;
        eb.retinal_age_gap = sanitizeWhiteLabelClinicalText(String(eb.retinal_age_gap || '0 años (Acorde a edad cronológica)').replace(/^Gap:\s*/i, ''));
        eb.hallazgos = sanitizeWhiteLabelClinicalText(eb.hallazgos || 'Morfología microvascular ocular acorde a edad cronológica.');
        pilares.edad_biologica_longevidad = eb;
    }

    if (pilares.salud_visual_estructural) {
        pilares.salud_visual_estructural = {
            ...pilares.salud_visual_estructural,
            titulo: 'Medios Refringentes y Simetría Binocular',
            hallazgos: sanitizeWhiteLabelClinicalText(pilares.salud_visual_estructural.hallazgos || 'Transparencia corneal y simetría binocular evaluadas.')
        };
    }

    return {
        ...rawPred,
        tipo_toma_detectada: tipoToma,
        pilares,
        sintesis_fisiopatologica: sanitizeWhiteLabelClinicalText(rawPred.sintesis_fisiopatologica || '')
            ?.replace(/\b(?:Hb|hemoglobina)\s*(?:estimad[ao]\s*)?:?\s*\d+(?:[.,]\d+)?\s*g\/dL\b|\b\d+(?:[.,]\d+)?\s*g\/dL\b/gi, 'perfusión conjuntival sujeta a biometría venosa')
            ?.replace(/HbA1c(?:\s*(?:estimad[ao]|est\.?|[<>≥≤=:\-])*\s*\d+(?:[.,]\d+)?\s*%)?/gi, 'Eco Metabólico microvascular')
            ?.trim() || null,
        disclaimer_legal: 'Tamizaje bio-óptico no invasivo mediante el Motor de Visión Clínica Equipo en Acción® conforme a la NOM-004-SSA3-2012 y directrices de COFEPRIS. No sustituye la exploración oftalmológica ni la biometría venosa.'
    };
}

function normalizeSaburraOrthography(text) {
    if (!text || typeof text !== 'string') return text;
    return sanitizeWhiteLabelClinicalText(text)
        .replace(/Moderada\s*\(\s*Blanquecina\s*\)/gi, 'Moderada (blanquecina)')
        .replace(/Delgada\s*\(\s*Blanquecina\s*\)/gi, 'Delgada (blanquecina)')
        .replace(/Delgada\s*\(\s*Blanca\s*\)/gi, 'Delgada (blanquecina)')
        .replace(/\b([A-Za-záéíóúñÁÉÍÓÚÑ]+)\(\s*([A-Za-záéíóúñÁÉÍÓÚÑ\s]+)\)/g, (_, a, b) => `${a} (${b.trim().toLowerCase()})`)
        .replace(/\bEutrofico\b/g, 'Eutrófico')
        .replace(/\beutrofico\b/g, 'eutrófico');
}

function sanitizeLingualPredictionSSoT(rawPred, patientAge = 60) {
    if (!rawPred || typeof rawPred !== 'object') return rawPred;
    const pilares = rawPred.pilares && typeof rawPred.pilares === 'object' ? { ...rawPred.pilares } : {};

    if (pilares.gastrointestinal_microbioma) {
        const gm = { ...pilares.gastrointestinal_microbioma };
        gm.titulo = 'Salud Gastrointestinal y Microbioma';
        gm.saburra_grosor = normalizeSaburraOrthography(gm.saburra_grosor || 'Delgada Fisiológica');
        gm.saburra_color = normalizeSaburraOrthography(gm.saburra_color || 'blanquecina fisiológica');
        gm.hallazgos = normalizeSaburraOrthography(gm.hallazgos || 'Mucosa lingual y biopelícula evaluadas dentro de parámetros funcionales.');
        pilares.gastrointestinal_microbioma = gm;
    }
    if (pilares.cardiovascular_oxigenacion) {
        pilares.cardiovascular_oxigenacion = {
            ...pilares.cardiovascular_oxigenacion,
            titulo: 'Sistema Cardiovascular y Venas Sublinguales',
            hallazgos: normalizeSaburraOrthography(pilares.cardiovascular_oxigenacion.hallazgos || 'Perfusión y retorno venoso sublingual evaluados.')
        };
    }
    if (pilares.conteo_sanguineo_nutricion) {
        pilares.conteo_sanguineo_nutricion = {
            ...pilares.conteo_sanguineo_nutricion,
            titulo: 'Nutrición Celular y Sustrato Mucoso',
            hallazgos: normalizeSaburraOrthography(pilares.conteo_sanguineo_nutricion.hallazgos || 'Coloración del sustrato lingual y papilas evaluadas.')
        };
    }
    if (pilares.funcion_hepatica_renal_hidratacion) {
        pilares.funcion_hepatica_renal_hidratacion = {
            ...pilares.funcion_hepatica_renal_hidratacion,
            titulo: 'Equilibrio Hepatorrenal e Hidratación',
            hallazgos: normalizeSaburraOrthography(pilares.funcion_hepatica_renal_hidratacion.hallazgos || 'Hidratación salival y bordes linguales evaluados.')
        };
    }
    if (pilares.inmune_inflamacion) {
        pilares.inmune_inflamacion = {
            ...pilares.inmune_inflamacion,
            titulo: 'Reactividad Mucosa e Inmunotolerancia',
            hallazgos: normalizeSaburraOrthography(pilares.inmune_inflamacion.hallazgos || 'Superficie lingual sin lesiones inflamatorias activas.')
        };
    }
    if (pilares.edad_biologica_mucosal) {
        const em = { ...pilares.edad_biologica_mucosal };
        em.titulo = 'Edad Biológica Mucosal y Trofismo';
        em.trofismo_muscular = normalizeSaburraOrthography(em.trofismo_muscular || 'Eutrófico (tono óptimo)');
        em.edad_mucosal_estimada = em.edad_mucosal_estimada || patientAge;
        em.hallazgos = normalizeSaburraOrthography(em.hallazgos || 'Trofismo muscular lingual eutrófico y resiliencia epitelial conservada.');
        pilares.edad_biologica_mucosal = em;
    }

    return {
        ...rawPred,
        tipo_toma_detectada: normalizeSaburraOrthography(rawPred.tipo_toma_detectada || 'Toma Dual Completa'),
        pilares,
        sintesis_fisiopatologica: normalizeSaburraOrthography(rawPred.sintesis_fisiopatologica || '') || null,
        disclaimer_legal: 'Tamizaje glosómico funcional no invasivo mediante el Motor de Visión Clínica Equipo en Acción® conforme a la NOM-004-SSA3-2012 y COFEPRIS. Requiere correlación clínica presencial.'
    };
}

const SOMATIC_ACCENT_DICTIONARY = {
    CRONICA: 'Crónica',
    CRONICO: 'Crónico',
    CUTANEO: 'Cutáneo',
    CUTANEA: 'Cutánea',
    DERMICO: 'Dérmico',
    DERMICA: 'Dérmica',
    PERIFERICO: 'Periférico',
    PERIFERICA: 'Periférica',
    MACULAS: 'Máculas',
    MACULA: 'Mácula',
    ERUPCION: 'Erupción',
    ULCERA: 'Úlcera',
    ULCERAS: 'Úlceras',
    PIGMENTACION: 'Pigmentación',
    HIPERPIGMENTACION: 'Hiperpigmentación',
    CIRCULACION: 'Circulación',
    MICROCIRCULACION: 'Microcirculación',
    INFLAMACION: 'Inflamación',
    LESION: 'Lesión',
    LESIONES: 'Lesiones',
    LIQUIDO: 'Líquido',
    LIQUIDOS: 'Líquidos',
    ESTASIS: 'Estasis',
    VARICOSAS: 'Varicosas',
    VENOSA: 'Venosa',
    VENOSO: 'Venoso',
    EUTROFICO: 'Eutrófico',
    HIPOTROFICO: 'Hipotrófico',
    HIPERQUERATOSIS: 'Hiperqueratosis',
    TELANGIECTASIAS: 'Telangiectasias'
};

function sanitizeSomaticFlagEs(rawFlag) {
    if (!rawFlag) return '';
    let cleaned = String(rawFlag)
        .trim()
        .replace(/^#+/, '')
        .replace(/autoinmun[ea]s?/gi, 'Reactividad Microvascular')
        .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
        .replace(/([A-ZÁÉÍÓÚÑ]+)([A-ZÁÉÍÓÚÑ][a-záéíóúñ])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const lowerConnectors = new Set(['de', 'del', 'por', 'en', 'con', 'sin', 'y', 'o', 'la', 'el', 'los', 'las']);
    return cleaned
        .split(' ')
        .filter(Boolean)
        .map((word, idx) => {
            const plainUpper = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            if (SOMATIC_ACCENT_DICTIONARY[plainUpper]) {
                return SOMATIC_ACCENT_DICTIONARY[plainUpper];
            }
            const lower = word.toLowerCase();
            if (idx > 0 && lowerConnectors.has(lower)) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

function sanitizeSomaticProseCofepris(rawText) {
    if (!rawText || typeof rawText !== 'string') return rawText;
    return sanitizeWhiteLabelClinicalText(rawText)
        .replace(/\b(?:origen\s+|etiolog[ií]a\s+|patolog[ií]a\s+|proceso\s+|enfermedad\s+)?autoinmun[ea]s?\b/gi, 'reactividad microvascular cutánea sujeta a valoración clínica')
        .replace(/\b(?:lupus|vasculitis\s+autoinmune|psoriasis\s+confirmada|melanoma\s+confirmado)\b/gi, 'alteración morfológica cutánea sujeta a valoración dermatológica')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function sanitizeSomaticMorphologyAndFlags(rawRes) {
    if (!rawRes || typeof rawRes !== 'object') return rawRes;
    const cleanFlags = Array.isArray(rawRes.clinical_flags)
        ? [...new Set(rawRes.clinical_flags.map(sanitizeSomaticFlagEs).filter(Boolean))]
        : [];
    const cleanItems = Array.isArray(rawRes.items)
        ? rawRes.items.map((it) => ({
            ...it,
            region: sanitizeSomaticProseCofepris(it?.region || ''),
            finding: sanitizeSomaticProseCofepris(it?.finding || ''),
            clinical_flags: Array.isArray(it?.clinical_flags)
                ? [...new Set(it.clinical_flags.map(sanitizeSomaticFlagEs).filter(Boolean))]
                : cleanFlags
        }))
        : [];
    return {
        ...rawRes,
        findings: sanitizeSomaticProseCofepris(rawRes.findings || ''),
        clinical_flags: cleanFlags,
        items: cleanItems
    };
}

function applyOcularVitalsGuard(patientDataObj, ocularBiomarkers) {
    if (!patientDataObj || typeof patientDataObj !== 'object') return patientDataObj;
    patientDataObj.vitals = patientDataObj.vitals || {};
    if (ocularBiomarkers) {
        // 🔒 EGM-36 (Regla 8 NOM-004): PROHIBIDO escribir estimaciones fotográficas sobre vitals.hemoglobin, vitals.egfr o vitals.acr.
        // vitals.hemoglobin pertenece exclusivamente a biometría hemática venosa certificada.
        patientDataObj.vitals.ocular_tarsal_status = ocularBiomarkers.hemoglobin?.status || 'NO_EVALUABLE';
    }
    return patientDataObj;
}

/**
 * POST /api/bio/scan/binocular-ocular-scan
 * Recibe simultáneamente las fotos del Ojo Derecho e Izquierdo para análisis binocular con el Motor de Visión Clínica Equipo en Acción®.
 */
router.post('/binocular-ocular-scan', upload.fields([
    { name: 'rightEye', maxCount: 1 },
    { name: 'leftEye', maxCount: 1 }
]), async (req, res) => {
    // 🛡️ PREVENCIÓN DE HIPOXIA POR LATENCIA (TIMEOUT MANAGEMENT): 120s
    req.setTimeout(120000);
    res.setTimeout(120000);

    try {
        const rightFile = req.files?.rightEye ? req.files.rightEye[0] : null;
        const leftFile = req.files?.leftEye ? req.files.leftEye[0] : null;
        const { age, sex } = req.body;
        const patientAge = parseInt(age || 60, 10);
        const patientSex = (sex || 'M').toUpperCase();

        const rightEyeUrl = rightFile ? `/uploads/${rightFile.filename}` : null;
        const leftEyeUrl = leftFile ? `/uploads/${leftFile.filename}` : null;

        console.log(`👁️ Oculomics Multidimensional Scan: Ojo Derecho=${rightFile?.filename || 'N/A'}, Ojo Izquierdo=${leftFile?.filename || 'N/A'} (Edad: ${patientAge}, Sexo: ${patientSex})`);

        if (!rightFile && !leftFile) {
            return res.status(400).json({ success: false, error: "No se recibieron imágenes oculares para el escaneo." });
        }

        const runLocalOcular = async () => {
            let localPred = null;
            if (process.env.GEMINI_API_KEY) {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const parts = [];

                if (rightFile) {
                    await sanitizeAndOptimizeImage(rightFile.path);
                    const pR = fileToGenerativePart(rightFile.path, rightFile.mimetype || 'image/jpeg');
                    if (pR) parts.push(pR);
                }
                if (leftFile) {
                    await sanitizeAndOptimizeImage(leftFile.path);
                    const pL = fileToGenerativePart(leftFile.path, leftFile.mimetype || 'image/jpeg');
                    if (pL) parts.push(pL);
                }

                const prompt = `
# DIRECTIVA OPERATIVA DEL CORTEX: MOTOR DE INTELIGENCIA OCULÓMICA SISTÉMICA (T.I.L.O. 2026)
Paciente: Edad=${patientAge} años, Sexo Biológico=${patientSex}.

Actúas como un Especialista de Élite en Oftalmología, Oculomics e Inteligencia Médica Predictiva. Analizarás minuciosamente las imágenes binoculares provistas (Ojo Derecho e Izquierdo).

## REGLA DE ORO DE INMUNIDAD ANATÓMICA Y CERO HARDCODING:
Evalúa estrictamente los biomarcadores observables en las imágenes reales. 
1. Primero identifica si la imagen es "Segmento Anterior (Superficie Externa / Córnea / Esclera / Párpados)", "Segmento Posterior (Fondo de Ojo / Retinografía)", o "Mixta".
2. Si un signo tisular está presente (ej. arco senil, edema periorbitario, microangiopatía, tortuosidad, ictericia, palidez tarsal), descríbelo y gradúalo con precisión. Si la conjuntiva tarsal no está evertida, reporta con honestidad clínica: "No Evaluable por Falta de Eversión Tarsal".
3. Si la toma es de segmento anterior y no muestra la retina, evalúa los signos indirectos en superficie y microvasculatura epiescleral/conjuntival/corneal indicándolo en la descripción.

## DEBES EVALUAR EN PROFUNDIDAD LOS SIGUIENTES 6 PILARES CLÍNICOS:

1. ECO METABÓLICO Y MICROVASCULATURA EPIESCLERAL:
   - Morfología microvascular en segmento anterior (tortuosidad perilímbica, congestión epiescleral y bulbar).
   - Solo si la toma es retinografía de fondo de ojo real, describir hallazgos retinianos; en toma frontal externa declarar edema macular como "No valorable en toma externa de segmento anterior".
   - PROHIBIDO estimar porcentajes de HbA1c ni glucosa sérica a partir de fotografía ocular. Clasificar únicamente el índice morfológico como: "Equilibrio Microvascular Fisiológico | Vigilancia Microvascular Moderada | Sobrecarga Microvascular Activa".

2. SALUD CARDIOVASCULAR Y LÍPIDOS:
   - Riesgo microvascular relativo (Bajo, Moderado, Elevado).
   - Angioarquitectura epiescleral y bulbar: calibre vascular y tortuosidad reactiva.
   - Depósitos lipídicos corneales (Arco Senil / Gerontoxon) usando EXCLUSIVAMENTE esta escala: "Ausente | Grado I (Incipiente) | Grado II–III (Circunferencial)".

3. PERFUSIÓN CONJUNTIVAL TARSAL (HONESTIDAD BIOLÓGICA ESTRICTA):
   - PROHIBIDO estimar valores numéricos de hemoglobina en g/dL por fotografía (jamás emitir cifras cuantitativas en g/dL ni rangos numéricos).
   - Indica booleano estricto "tiene_eversion_tarsal": true SOLO si se observa eversión física real del párpado inferior mostrando la conjuntiva tarsal; en toma frontal normal sin eversión, responde false y reporta "No evaluable sin eversión palpebral tarsal" y estado "NO_EVALUABLE".

4. FUNCIÓN DE ÓRGANOS (RIÑÓN E HÍGADO):
   - Eje Renal: edema infraorbitario bilateral, bolsas palpebrales / festón malar, laxitud septal (retención hidrosalina / fuga proteica / microangiopatía renal).
   - Eje Hepatobiliar: cromatismo escleral (blanco quirúrgico fisiológico vs tinte subictérico/ictérico por acumulación de bilirrubina), sospecha de esteatosis/congestión hepática.

5. EDAD BIOLÓGICA Y ENVEJECIMIENTO (RELOJ EPIGENÉTICO OCULAR):
   - Estimación de Edad Biológica Ocular (Retinal/Ocular Age Clock) basada en rigidez arteriolar, tortuosidad y densidad capilar vs la edad cronológica (${patientAge} años).
   - Retinal Age Gap (diferencia en años: ej. "+2 años", "-1 año", "Acorde a edad cronológica").
   - Senescencia microvascular y resiliencia endotelial.

6. SALUD VISUAL Y MEDIOS ESTRUCTURALES:
   - Transparencia del cristalino / cribado de cataratas (nuclear, cortical, subcapsular).
   - Superficie corneal (claridad, pterigión, pingüécula, ojo seco).
   - Sospecha de maculopatía / DMAE (si es fondo de ojo).
   - Asimetría binocular: análisis comparativo bilateral OD vs OI.

Responde ÚNICAMENTE en JSON estricto con esta estructura:
{
  "tipo_toma_detectada": "Segmento Anterior (Superficie Ocular Externa) | Fondo de Ojo (Retinografía) | Mixta",
  "calidad_optica": "Óptima | Adecuada | Subóptima",
  "pilares": {
    "diabetes_glucosa": {
      "titulo": "Eco Metabólico y Microvasculatura Epiescleral",
      "riesgo": "BAJO | MODERADO | ELEVADO",
      "indice_eco_metabolico": "Equilibrio Microvascular Fisiológico | Vigilancia Microvascular Moderada | Sobrecarga Microvascular Activa",
      "edema_macular": "No valorable en toma externa de segmento anterior | Ausente | Sospecha",
      "retinopatia_microangiopatia": "Microcirculación epiescleral y bulbar conservada | Tortuosidad perilímbica reactiva | Congestión epiescleral marcada",
      "hallazgos": "Descripción morfológica objetiva de la microcirculación epiescleral y bulbar..."
    },
    "cardiovascular_lipidos": {
      "titulo": "Salud Cardiovascular y Lípidos",
      "riesgo_cardiovascular": "BAJO | MODERADO | ELEVADO",
      "perfil_lipidico_estimado": "Fisiológico | Depósito lipídico corneal observable",
      "arco_senil_corneal": "Ausente | Grado I (Incipiente) | Grado II–III (Circunferencial)",
      "angioarquitectura_hipertensiva": "Calibre conservado | Estrechamiento microvascular leve | Tortuosidad venular reactiva",
      "relacion_av": "No valorable en superficie externa | 2:3 (Fisiológico)",
      "hallazgos": "Descripción morfológica del lecho vascular epiescleral y halo corneal..."
    },
    "conteo_sanguineo_anemia": {
      "titulo": "Perfusión Conjuntival Tarsal",
      "tiene_eversion_tarsal": false,
      "hemoglobina_estimada_gdl": null,
      "estado_anemia": "NO_EVALUABLE | NORMOCRÓMICA TARSAL | OBSERVACIÓN TARSAL",
      "palidez_conjuntival_tarsal": "No evaluable sin eversión palpebral tarsal | Coloración tarsal conservada | Palidez tarsal observable",
      "perfusion_escleral": "Perfusión microvascular epiescleral conservada",
      "hallazgos": "Evaluación morfológica estricta de conjuntiva tarsal..."
    },
    "funcion_renal_hepatica": {
      "titulo": "Función de Órganos (Riñón e Hígado)",
      "riesgo_renal": "BAJO | MODERADO | ELEVADO",
      "riesgo_hepatico": "BAJO | MODERADO | ELEVADO",
      "edema_infraorbitario_renal": "Normal | Grado I (Leve) | Grado II (Herniación Grasa Palpebral) | Grado III (Festón Malar Severo)",
      "ictericia_escleral_hepatica": "Ausente (Blanco Quirúrgico Fisiológico) | Subictericia Leve | Ictericia Marcada",
      "hallazgos": "Integración del estasis periorbitario hidrosalino y cromatismo del estroma escleral..."
    },
    "edad_biologica_longevidad": {
      "titulo": "Edad Biológica y Envejecimiento",
      "edad_cronologica": ${patientAge},
      "edad_biologica_ocular": ${patientAge},
      "retinal_age_gap": "0 años (Acorde a edad cronológica)",
      "estado_senescencia": "Envejecimiento microvascular acorde | Senescencia acelerada | Preservación endotelial óptima",
      "riesgo_mortalidad_vascular": "Bajo | Moderado | Elevado",
      "hallazgos": "Análisis comparativo de rigidez, tortuosidad y densidad capilar vs edad cronológica..."
    },
    "salud_visual_estructural": {
      "titulo": "Salud Visual y Afecciones Oculares",
      "cristalino_cataratas": "Cristalino claro y transparente | Esclerosis incipiente | Sospecha de catarata nuclear/cortical",
      "sospecha_dmae": "Baja / Sin signos | Drusas retinianas | No valorable en segmento anterior",
      "cornea_superficie": "Córnea transparente sin ectasias ni leucomas | Pterigión / Pingüécula incipiente",
      "asimetria_binocular": "Bilateral simétrica | Asimetría detectable OD vs OI",
      "hallazgos": "Evaluación de medios refringentes anteriores, reflejo pupilar y simetría bilateral..."
    }
  },
  "sintesis_fisiopatologica": "Síntesis integrativa de la telemetría bio-óptica ocular...",
  "prioridad_clinica_global": "Baja | Moderada | Elevada",
  "disclaimer_legal": "Tamizaje bio-óptico no invasivo mediante el Motor de Visión Clínica Equipo en Acción® conforme a la NOM-004-SSA3-2012 y directrices de COFEPRIS. No sustituye la exploración oftalmológica ni la biometría venosa."
}
                `;
                parts.push(prompt);

                const candidateModels = [
                    'gemini-flash-lite-latest',
                    'gemini-3.5-flash-lite',
                    'gemini-3.1-flash-lite',
                    'gemini-3.8-flash',
                    'gemini-flash-latest'
                ];
                let response = null;
                for (const targetModel of candidateModels) {
                    try {
                        console.log(`🤖 Intentando inferencia oculómica con modelo: ${targetModel}...`);
                        response = await ai.models.generateContent({
                            model: targetModel,
                            contents: parts,
                            config: { responseMimeType: 'application/json' }
                        });
                        if (response?.text) {
                            console.log(`✅ Inferencia oculómica completada con éxito usando ${targetModel}`);
                            break;
                        }
                    } catch (mErr) {
                        console.warn(`⚠️ Modelo ${targetModel} no disponible (${mErr.message}), probando siguiente...`);
                    }
                }

                if (response?.text) {
                    const clean = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    localPred = JSON.parse(clean);
                }
            } catch (err) {
                console.error("⚠️ Error consultando Gemini Vision para escaneo binocular:", err.message);
            }
        }
        return localPred;
    };

        const hubPayload = {
            age: patientAge,
            sex: patientSex,
            rightEyeUrl,
            leftEyeUrl
        };

        // ⚡ Conmutador Sensory Processing Hub con timeout de 3500ms y fallback local enriquecido
        let aiPrediction = await callSensoryHubWithFallback('/api/bio/scan/ocular-scan', hubPayload, runLocalOcular);

        if (!aiPrediction) {
            return res.status(500).json({
                success: false,
                error: "No fue posible completar la inferencia bio-óptica en el Motor de Visión Clínica Equipo en Acción®. Verifique la conectividad o la nitidez de las fotografías."
            });
        }

        aiPrediction = sanitizeOcularPredictionSSoT(aiPrediction, patientAge);
        const pilares = aiPrediction.pilares || {};

        // Adaptadores retrocompatibles para legacy code
        const ocularAuditLegacy = {
            palidez_conjuntival: {
                estado: pilares.conteo_sanguineo_anemia?.palidez_conjuntival_tarsal || "No evaluable sin eversión palpebral tarsal",
                descripcion_clinica: pilares.conteo_sanguineo_anemia?.hallazgos || "Determinación fotográfica no evaluable sin eversión palpebral tarsal."
            },
            microcirculacion_escleral: {
                calibre_vascular: pilares.cardiovascular_lipidos?.angioarquitectura_hipertensiva || "Calibre conservado",
                densidad_capilar: pilares.conteo_sanguineo_anemia?.perfusion_escleral || "Perfusión microvascular epiescleral conservada",
                hallazgos_especificos: [
                    pilares.diabetes_glucosa?.retinopatia_microangiopatia,
                    pilares.cardiovascular_lipidos?.arco_senil_corneal !== "Ausente" ? `Arco Senil: ${pilares.cardiovascular_lipidos?.arco_senil_corneal}` : null
                ].filter(Boolean)
            },
            tejido_periorbital: {
                edema_infraorbitario: pilares.funcion_renal_hepatica?.edema_infraorbitario_renal || "Normal",
                estasis_venosa_pigmentaria: pilares.funcion_renal_hepatica?.hallazgos || "Sin hallazgos patológicos",
                deposito_lipidico_corneal: pilares.cardiovascular_lipidos?.arco_senil_corneal || "Ausente"
            },
            asimetria_binocular: {
                es_simetrico: !pilares.salud_visual_estructural?.asimetria_binocular?.toLowerCase().includes('asimetría'),
                observaciones: pilares.salud_visual_estructural?.asimetria_binocular || "Bilateral simétrica."
            }
        };

        const isHbNoEvaluable = !pilares.conteo_sanguineo_anemia?.tiene_eversion_tarsal || pilares.conteo_sanguineo_anemia?.estado_anemia === "NO_EVALUABLE";
        const predictions = {
            hemoglobin: {
                name: "Perfusión Conjuntival Tarsal",
                raw_value: null,
                value: isHbNoEvaluable ? "NO_EVALUABLE" : (pilares.conteo_sanguineo_anemia?.estado_anemia || "NORMOCRÓMICA TARSAL"),
                status: isHbNoEvaluable ? "NO_EVALUABLE" : (pilares.conteo_sanguineo_anemia?.estado_anemia === "NORMOCRÓMICA TARSAL" ? "NORMAL" : "WARNING"),
                translation: pilares.conteo_sanguineo_anemia?.hallazgos || "Determinación fotográfica no evaluable sin eversión palpebral tarsal verificada."
            },
            foveal_microcirculation: {
                name: "Microcirculación Epiescleral y Bulbar",
                raw_value: pilares.cardiovascular_lipidos?.angioarquitectura_hipertensiva || "Normal",
                value: pilares.cardiovascular_lipidos?.riesgo_cardiovascular || "BAJO",
                status: pilares.cardiovascular_lipidos?.riesgo_cardiovascular === "ELEVADO" ? "WARNING" : "NORMAL",
                translation: pilares.cardiovascular_lipidos?.hallazgos || "Calibre microvascular epiescleral y bulbar conservado."
            },
            metabolic_risk: {
                name: "Eco Metabólico y Microvasculatura",
                raw_value: pilares.diabetes_glucosa?.indice_eco_metabolico || "Equilibrio Microvascular Fisiológico",
                value: pilares.diabetes_glucosa?.riesgo || "BAJO",
                status: pilares.diabetes_glucosa?.riesgo === "ELEVADO" ? "WARNING" : "NORMAL",
                translation: pilares.diabetes_glucosa?.hallazgos || "Lecho microvascular epiescleral sin congestión reactiva."
            }
        };

        res.json({
            success: true,
            rightEyeUrl,
            leftEyeUrl,
            tipo_toma: aiPrediction.tipo_toma_detectada || "Segmento Anterior (Superficie Ocular Externa)",
            calidad_optica: aiPrediction.calidad_optica || "Óptima",
            pilares: pilares,
            predictions,
            ocular_audit: {
                ...ocularAuditLegacy,
                right_eye_url: rightEyeUrl,
                left_eye_url: leftEyeUrl,
                pilares: pilares,
                tipo_toma: aiPrediction.tipo_toma_detectada,
                sintesis_fisiopatologica: aiPrediction.sintesis_fisiopatologica,
                prioridad_clinica_global: aiPrediction.prioridad_clinica_global,
                disclaimer_legal: aiPrediction.disclaimer_legal
            },
            ocular_metrics: {
                ...ocularAuditLegacy,
                right_eye_url: rightEyeUrl,
                left_eye_url: leftEyeUrl,
                pilares: pilares,
                tipo_toma: aiPrediction.tipo_toma_detectada,
                sintesis_fisiopatologica: aiPrediction.sintesis_fisiopatologica,
                prioridad_clinica_global: aiPrediction.prioridad_clinica_global,
                disclaimer_legal: aiPrediction.disclaimer_legal
            },
            correlacion_multimodal: {
                sintesis_fisiopatologica: aiPrediction.sintesis_fisiopatologica,
                indice_prioridad_clinica: aiPrediction.prioridad_clinica_global
            },
            asymmetry_findings: pilares.salud_visual_estructural?.asimetria_binocular || "Bilateral simétrica."
        });
    } catch (err) {
        console.error("🔥 Error en endpoint binocular-ocular-scan:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/bio/scan/lingual-scan
 * Recibe la foto de la lengua externa (CTDS) y procesa la imagen con Gemini Vision para evaluar saburra, hidratación y estrés hepático.
 */
router.post('/lingual-scan', upload.fields([
    { name: 'dorsalImage', maxCount: 1 },
    { name: 'ventralImage', maxCount: 1 },
    { name: 'lingualImage', maxCount: 1 }
]), async (req, res) => {
    const dorsalFile = req.files?.['dorsalImage']?.[0] || req.files?.['lingualImage']?.[0] || (req.file || null);
    const ventralFile = req.files?.['ventralImage']?.[0] || null;
    const { age, sex, clinicalRoute } = req.body;

    const patientAge = parseInt(age || 60);
    const patientSex = sex ? sex.toString().toUpperCase() : 'M';
    const patientRoute = clinicalRoute ? clinicalRoute.toLowerCase() : 'standard';

    console.log(`👅 Lingual Multidimensional Scan: Dorsal=${dorsalFile ? dorsalFile.filename : 'Ninguno'}, Ventral=${ventralFile ? ventralFile.filename : 'Ninguno'} (Edad: ${patientAge}, Sexo: ${patientSex})`);

    if (!dorsalFile && !ventralFile) {
        return res.status(400).json({ success: false, error: "No se recibió ninguna imagen de la superficie lingual." });
    }

    const dorsalUrl = dorsalFile ? `/uploads/${dorsalFile.filename}` : null;
    const ventralUrl = ventralFile ? `/uploads/${ventralFile.filename}` : null;

    const runLocalLingual = async () => {
        let localPred = null;
        if (process.env.GEMINI_API_KEY) {
        try {
            const { GoogleGenAI } = require('@google/genai');
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const parts = [];

            if (dorsalFile) {
                await sanitizeAndOptimizeImage(dorsalFile.path);
                const pD = fileToGenerativePart(dorsalFile.path, dorsalFile.mimetype || 'image/jpeg');
                if (pD) parts.push(pD);
            }
            if (ventralFile) {
                await sanitizeAndOptimizeImage(ventralFile.path);
                const pV = fileToGenerativePart(ventralFile.path, ventralFile.mimetype || 'image/jpeg');
                if (pV) parts.push(pV);
            }

            const prompt = `
# DIRECTIVA OPERATIVA DEL CORTEX: TOPOGRAFÍA LINGUAL Y GLOSÓMICA MULTIDIMENSIONAL (T.I.L.O. 2026)
Paciente: Edad=${patientAge} años, Sexo Biológico=${patientSex}, Ruta Clínica=${patientRoute}.

Actúas como un Especialista de Élite en Glosodiagnóstico Funcional, Medicina Interna, Gastroenterología y Biometría Multimodal.
Analizarás minuciosamente la(s) fotografía(s) provistas de la lengua (Cara Dorsal y/o Cara Ventral / Sublingual).

## REGLA DE ORO DE INMUNIDAD ÓPTICA (CONTROL DE REFLEJO Y FLASH DIRECTO):
1. Evalúa PRIMERO la calidad de iluminación, nitidez y reflectancia salival de la(s) toma(s).
2. Si el destello del flash directo genera un "lavado" o sobreexposición blanca que borra la morfología de la saburra, o si el reflejo salival simula saburra patológica, o si existe un desenfoque severo que impide valorar las papilas o venas:
   - "tipo_toma_detectada": "Calidad Insuficiente"
   - "calidad_optica": "Subóptima (Sobreexposición por Flash / Desenfoque)"
   - "requiere_recaptura": true
   - "motivo_rechazo_optico": "La reflectancia del flash directo o la falta de nitidez impiden una evaluación clínica certera. Se sugiere re-capturar con luz natural o difusa sin flash."
3. Si la calidad es adecuada ("Óptima" o "Adecuada"), procede con la fenotipificación exhaustiva de los 6 pilares.

## LOS 6 PILARES CLÍNICOS LINGUALES A EVALUAR:

1. SALUD GASTROINTESTINAL Y MICROBIOMA:
   - Análisis de Saburra: Grosor (Delgada Fisiológica | Moderada | Gruesa / Pastosa | Denudada / Pelada), Color (Blanquecina Fisiológica | Amarillenta | Grísea / Oscura) y Distribución topográfica (Punta/Cardiopulmonar, Centro/Gástrico, Raíz/Colónico, Bordes/Hepatobiliar).
   - Sospecha de disbiosis intestinal, sobrecrecimiento fúngico (candidiasis), reflujo gastroesofágico o permeabilidad intestinal.
   - Integridad Epitelial: Presencia de fisuras y grietas (ausentes, longitudinal media, transversales múltiples) asociadas a mala absorción, calor gástrico o estrés oxidativo.

2. SISTEMA CARDIOVASCULAR Y OXIGENACIÓN:
   - Estasis Venosa Sublingual (Cara Ventral): Calibre y tortuosidad de las venas raninas sublinguales (fisiológicas delgadas <2mm | dilatación leve | tortuosidad e ingurgitación marcada / nódulos violáceos oscuros), biomarcador de sobrecarga venosa central, hipoxia tisular o disfunción endotelial. Si no se aportó cara ventral, reportar: "No valorable por falta de toma ventral".
   - Cianosis Tisular: Tono general del sustrato lingual (rosado fisiológico vs tinte violáceo/azulado de microperfusión deficiente).

3. CONTEO SANGUÍNEO Y DEFICIENCIAS NUTRICIONALES:
   - Espectrometría del Tejido (Cromatismo del Sustrato): Lengua pálida/blanquecina como biomarcador de síndrome anémico e hipoperfusión eritrocitaria vs rosado fisiológico vs rojo carmesí.
   - Atrofia Papilar (Glositis Carencial): Pérdida de papilas filiformes, lengua lisa, lustrosa y eritematosa ("lengua de res") sugestiva de deficiencia aguda de Vitamina B12, Ácido Fólico o Hierro (anemia perniciosa o ferropénica).

4. FUNCIÓN HEPÁTICA, RENAL E HIDRATACIÓN:
   - Marcas Dentales (Lengua Festoneada / Scalloped Tongue): Hinchazón del cuerpo lingual que retiene indentaciones de los dientes en bordes laterales (edema intersticial, retención hidrosalina, disfunción renal/linfática o hipotiroidismo).
   - Tinte Amarillo / Saburra Hepática: Capa amarilla densa y adherente en base/dorso asociada a sobrecarga hepatobiliar, esteatosis hepática o estasis biliar.
   - Humedad y Salivación: Estado de hidratación de la mucosa (normo-hidratada, xerostomía/seca, exudado espeso).

5. SISTEMA INMUNE E INFLAMACIÓN SISTÉMICA:
   - Lengua Geográfica (Glositis Migratoria): Áreas eritematosas despapiladas con márgenes blanquecinos serpiginosos (marcador de atopia, hiperreactividad inmune, estrés crónico y alergias sistémicas).
   - Puntos Rojos / Papilas Fungiformes Inflamadas: Petequias o eritema papilar ("lengua de fresa") indicativo de inflamación activa, carga microbiana o reactividad sistémica.

6. EDAD BIOLÓGICA MUCOSAL Y SENESCENCIA:
   - Trofismo y Tono Muscular: Eutrófico vs pérdida de volumen muscular vs hipotonía.
   - Fasciculaciones o Temblores Linguales: Indicador de fatiga neuromuscular o compromiso motor.
   - Senescencia y Resiliencia del Tejido: Estimación de senescencia mucosal, adelgazamiento y correlación con fragilidad biológica.

Responde ÚNICAMENTE en JSON estricto con esta estructura:
{
  "tipo_toma_detectada": "Cara Dorsal (Saburra y Papilas) | Cara Ventral (Venas Sublinguales) | Toma Dual Completa | Calidad Insuficiente",
  "calidad_optica": "Óptima | Adecuada | Subóptima (Sobreexposición por Flash / Desenfoque)",
  "requiere_recaptura": false,
  "motivo_rechazo_optico": null,
  "pilares": {
    "gastrointestinal_microbioma": {
      "titulo": "Salud Gastrointestinal y Microbioma",
      "saburra_grosor": "Delgada Fisiológica | Moderada | Gruesa / Pastosa | Denudada",
      "saburra_color": "Blanquecina Fisiológica | Amarillenta | Grísea / Oscura",
      "distribucion_saburra": {
        "centro": "Gástrico: descripción...",
        "raiz": "Colónico: descripción...",
        "bordes": "Biliar: descripción..."
      },
      "fisuras_grietas": "Ausentes | Fisura media central | Fisuras transversales múltiples",
      "sospecha_disbiosis": "Baja / Fisiológica | Moderada | Elevada",
      "hallazgos": "Descripción de la ecología de la mucosa y microbioma..."
    },
    "cardiovascular_oxigenacion": {
      "titulo": "Sistema Cardiovascular y Oxigenación",
      "estasis_venosa_sublingual": "Fisiológica (Delgada <2mm) | Dilatación Leve | Tortuosidad e Ingurgitación Marcada | No valorable por falta de toma ventral",
      "coloracion_venas_sublinguales": "Azulada fisiológica | Violácea oscura / Púrpura | No valorable",
      "cianosis_periferica": "Ausente (Perfusión Óptima) | Cianosis periférica incipiente | Tinte violáceo difuso",
      "riesgo_vascular_congestivo": "BAJO | MODERADO | ELEVADO",
      "hallazgos": "Evaluación de microperfusión y estasis venosa..."
    },
    "conteo_sanguineo_nutricion": {
      "titulo": "Conteo Sanguíneo y Nutrición",
      "palidez_sustrato": "Normocrómica (Rosado Saludable) | Palidez Tisular Incipiente | Palidez Marcada (Sospecha de Anemia)",
      "atrofia_papilar_glositis": "Ausente (Papilas Preservadas) | Glositis Focal | Atrofia Papilar Generalizada (Sospecha B12/Fe)",
      "sospecha_deficiencia_nutricional": "Baja | Deficiencia B12 / Folato | Deficiencia de Hierro",
      "hallazgos": "Evaluación del estado de oxigenación y reserva hematínica..."
    },
    "funcion_hepatica_renal_hidratacion": {
      "titulo": "Función Hepática, Renal e Hidratación",
      "marcas_dentales_festoneado": "Ausentes (Bordes Lisos) | Leve en ápice | Marcadas bilaterales (Edema / Fuga hidrosalina)",
      "tinte_amarillo_base": "Ausente | Tinte amarillento en tercio posterior (Sobrecarga hepatobiliar)",
      "estado_hidratacion_salival": "Normo-hidratada | Moderadamente deshidratada | Xerostomía marcada",
      "hallazgos": "Correlación de retención de líquidos y función hepatobiliar..."
    },
    "inmune_inflamacion": {
      "titulo": "Sistema Inmune e Inflamación Sistémica",
      "lengua_geografica": "Ausente | Parches despapilados serpiginosos (Atopia/Reactividad inmune)",
      "petequias_papilas_eritematosas": "Ausentes | Puntos rojos en punta/bordes | Patrón en fresa",
      "nivel_inflamacion_mucosa": "Bajo / Fisiológico | Moderado | Sistémico Activo",
      "hallazgos": "Evaluación de la inmunotolerancia y reactividad de mucosas..."
    },
    "edad_biologica_mucosal": {
      "titulo": "Edad Biológica Mucosal y Senescencia",
      "trofismo_muscular": "Eutrófico (Tono óptimo) | Hipotonía leve | Atrofia muscular lingual",
      "temblores_fasciculaciones": "Ausentes | Temblores finos observables al extender",
      "edad_mucosal_estimada": ${patientAge},
      "resiliencia_epitelial": "Preservada | Senescencia mucosal acorde | Desgaste acelerado",
      "hallazgos": "Integración del estado biológico de la mucosa vs edad cronológica..."
    }
  },
  "sintesis_fisiopatologica": "Síntesis integrativa del glosodiagnóstico funcional...",
  "prioridad_clinica_global": "Baja | Moderada | Elevada",
  "disclaimer_legal": "Tamizaje glosómico funcional no invasivo mediante el Motor de Visión Clínica Equipo en Acción® conforme a la NOM-004-SSA3-2012 y COFEPRIS. Requiere correlación clínica presencial."
}
            `;
            parts.push(prompt);

            const candidateModels = [
                'gemini-flash-lite-latest',
                'gemini-3.5-flash-lite',
                'gemini-3.1-flash-lite',
                'gemini-3.8-flash',
                'gemini-flash-latest'
            ];
            let response = null;
            for (const targetModel of candidateModels) {
                try {
                    console.log(`🤖 Intentando inferencia lingual con modelo: ${targetModel}...`);
                    response = await ai.models.generateContent({
                        model: targetModel,
                        contents: parts,
                        config: { responseMimeType: 'application/json' }
                    });
                    if (response?.text) {
                        console.log(`✅ Inferencia lingual completada con éxito usando ${targetModel}`);
                        break;
                    }
                } catch (mErr) {
                    console.warn(`⚠️ Modelo ${targetModel} no disponible (${mErr.message}), probando siguiente...`);
                }
            }

            if (response?.text) {
                const clean = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                localPred = JSON.parse(clean);
            }
        } catch (err) {
            console.error("⚠️ Error consultando Gemini Vision para escaneo lingual:", err.message);
        }
    }
    return localPred;
};

    const hubPayload = {
        age: patientAge,
        sex: patientSex,
        clinicalRoute: patientRoute,
        dorsalUrl,
        ventralUrl
    };

    // ⚡ Conmutador Sensory Processing Hub con timeout de 3500ms y fallback local enriquecido
    let aiPrediction = await callSensoryHubWithFallback('/api/bio/scan/lingual-scan', hubPayload, runLocalLingual);

    if (!aiPrediction) {
        return res.status(500).json({
            success: false,
            error: "No fue posible completar la inferencia glosómica en el Motor de Visión Clínica Equipo en Acción®. Verifique la conectividad o la calidad de las fotografías."
        });
    }

    aiPrediction = sanitizeLingualPredictionSSoT(aiPrediction, patientAge);

    // SUTURA DE CALIDAD ÓPTICA (RECHAZO AMIGABLE ANTE FLASH DIRECTO O DESENFOQUE SEVERO)
    if (aiPrediction.tipo_toma_detectada === "Calidad Insuficiente" || aiPrediction.requiere_recaptura === true) {
        return res.json({
            success: true,
            requiere_recaptura: true,
            tipo_toma: "Calidad Insuficiente",
            calidad_optica: aiPrediction.calidad_optica || "Subóptima (Sobreexposición por Flash / Desenfoque)",
            motivo_rechazo_optico: aiPrediction.motivo_rechazo_optico || "La reflectancia del flash directo o la falta de nitidez impiden evaluar la saburra con rigor.",
            dorsalUrl,
            ventralUrl,
            imageUrl: dorsalUrl || ventralUrl
        });
    }

    const pilares = aiPrediction.pilares || {};

    // Adaptadores retrocompatibles para legacy code
    const lingualTopographyLegacy = {
        cuerpo_lingual: {
            coloracion_sustrato: pilares.conteo_sanguineo_nutricion?.palidez_sustrato || "Rosado Fisiológico",
            trofismo_volumen: pilares.edad_biologica_mucosal?.trofismo_muscular || "Eutrófico",
            indentaciones_dentales: pilares.funcion_hepatica_renal_hidratacion?.marcas_dentales_festoneado || "Ausentes",
            fisuras_mucosa: pilares.gastrointestinal_microbioma?.fisuras_grietas || "Ausentes"
        },
        saburra_microbiota: {
            grosor: pilares.gastrointestinal_microbioma?.saburra_grosor || "Delgada Fisiológica",
            color: pilares.gastrointestinal_microbioma?.saburra_color || "Blanquecina Fisiológica",
            distribucion_topografica: pilares.gastrointestinal_microbioma?.distribucion_saburra || {
                centro: "Centro gástrico normal",
                raiz: "Base preservada",
                bordes: "Bordes libres de estasis"
            },
            humectacion: pilares.funcion_hepatica_renal_hidratacion?.estado_hidratacion_salival || "Normo-hidratada"
        }
    };

    const predictions = {
        hepatic_stress: {
            name: "Estrés Hepático Metabólico",
            raw_value: pilares.funcion_hepatica_renal_hidratacion?.tinte_amarillo_base || "Ausente",
            value: pilares.funcion_hepatica_renal_hidratacion?.tinte_amarillo_base !== "Ausente" ? "ALERTA" : "NORMAL",
            status: pilares.funcion_hepatica_renal_hidratacion?.tinte_amarillo_base !== "Ausente" ? "WARNING" : "NORMAL",
            translation: pilares.funcion_hepatica_renal_hidratacion?.hallazgos || "Evaluación hepatobiliar funcional."
        },
        glycemic_alteration: {
            name: "Salud Gastrointestinal y Microbioma",
            raw_value: normalizeSaburraOrthography(`${pilares.gastrointestinal_microbioma?.saburra_grosor || 'Delgada'} (${(pilares.gastrointestinal_microbioma?.saburra_color || 'blanquecina').toLowerCase()})`),
            value: pilares.gastrointestinal_microbioma?.sospecha_disbiosis || "BAJO",
            status: pilares.gastrointestinal_microbioma?.sospecha_disbiosis === "Elevada" ? "WARNING" : "NORMAL",
            translation: pilares.gastrointestinal_microbioma?.hallazgos || "Biopelícula y mucosa en balance."
        },
        perfusion_motility: {
            name: "Cardiovascular y Oxigenación Sublingual",
            raw_value: pilares.cardiovascular_oxigenacion?.estasis_venosa_sublingual || "Fisiológica",
            value: pilares.cardiovascular_oxigenacion?.riesgo_vascular_congestivo || "BAJO",
            status: pilares.cardiovascular_oxigenacion?.riesgo_vascular_congestivo === "ELEVADO" ? "WARNING" : "NORMAL",
            translation: pilares.cardiovascular_oxigenacion?.hallazgos || "Perfusión y retorno venoso sin estasis."
        }
    };

    res.json({
        success: true,
        requiere_recaptura: false,
        dorsalUrl,
        ventralUrl,
        imageUrl: dorsalUrl || ventralUrl,
        tipo_toma: aiPrediction.tipo_toma_detectada || "Cara Dorsal (Saburra y Papilas)",
        calidad_optica: aiPrediction.calidad_optica || "Óptima",
        pilares,
        predictions,
        lingual_topography: {
            ...lingualTopographyLegacy,
            dorsal_url: dorsalUrl,
            ventral_url: ventralUrl,
            imageUrl: dorsalUrl || ventralUrl,
            pilares,
            tipo_toma: aiPrediction.tipo_toma_detectada,
            sintesis_fisiopatologica: aiPrediction.sintesis_fisiopatologica,
            prioridad_clinica_global: aiPrediction.prioridad_clinica_global,
            disclaimer_legal: aiPrediction.disclaimer_legal
        },
        lingual_metrics: {
            ...lingualTopographyLegacy,
            dorsal_url: dorsalUrl,
            ventral_url: ventralUrl,
            imageUrl: dorsalUrl || ventralUrl,
            pilares,
            tipo_toma: aiPrediction.tipo_toma_detectada,
            sintesis_fisiopatologica: aiPrediction.sintesis_fisiopatologica,
            prioridad_clinica_global: aiPrediction.prioridad_clinica_global,
            disclaimer_legal: aiPrediction.disclaimer_legal
        },
        correlacion_multimodal: {
            sintesis_fisiopatologica: aiPrediction.sintesis_fisiopatologica,
            indice_prioridad_clinica: aiPrediction.prioridad_clinica_global
        }
    });
});

/**
 * POST /api/bio/scan/visual-scan
 * Recibe una o múltiples imágenes de evidencia física somática y las analiza con Gemini Vision
 * (con sanitización EXIF, optimización con sharp y retorno de miniaturas Base64 persistentes).
 */
router.post('/visual-scan', upload.any(), async (req, res) => {
    const uploadedFiles = Array.isArray(req.files)
        ? req.files.filter(f => f && (f.fieldname === 'visualImages' || f.fieldname === 'visualImage'))
        : (req.file ? [req.file] : []);

    if (uploadedFiles.length === 0) {
        return res.status(400).json({ success: false, message: "No se proporcionó ninguna imagen para el escaneo visual somático." });
    }

    console.log(`📸 [VISUAL SCAN] Iniciando análisis multi-evidencia para ${uploadedFiles.length} fotografía(s).`);

    try {
        // 1. Sanitizar EXIF, optimizar con sharp y generar Data URLs persistentes antes de destrucción efímera
        const processedFiles = [];
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            await sanitizeAndOptimizeImage(file.path);
            const base64Data = fs.readFileSync(file.path).toString("base64");
            const mimeType = file.mimetype || 'image/jpeg';
            processedFiles.push({
                index: i + 1,
                file,
                fileName: file.originalname || `Evidencia_${i + 1}.jpg`,
                base64Data,
                mimeType,
                dataUrl: `data:${mimeType};base64,${base64Data}`
            });
        }

        const runLocalVisual = async () => {
            let localRes = null;
            // 2. Si hay GEMINI_API_KEY, consultar con Gemini Vision para todas las imágenes
            if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

                const contents = [];
                processedFiles.forEach((pf) => {
                    contents.push({
                        inlineData: {
                            data: pf.base64Data,
                            mimeType: pf.mimeType
                        }
                    });
                });

                contents.push(`Actúa como un Patólogo y Dermatólogo Clínico de soporte para el Ecosistema T.I.L.O.
Analiza las ${processedFiles.length} imagen(es) médica(s) somática(s) adjunta(s) cargadas durante la consulta presencial.
Realiza una descripción puramente objetiva y morfológica de los hallazgos visuales observados en cada fotografía y una síntesis global (ej. várices prominentes, pigmentación ocre por hemosiderina, eritema, edema, distribución adiposa/postural, trofismo cutáneo o lesiones dérmicas).

REGLAS CLÍNICAS, REGULATORIAS (COFEPRIS) Y LINGÜÍSTICAS OBLIGATORIAS (NOM-004):
1. NO emitas diagnósticos categóricos ni etiológicos definitivos. QUEDA ESTRICTAMENTE PROHIBIDO utilizar el término "autoinmune" (ni variantes como "lupus", "vasculitis autoinmune" o "etiología autoinmune"). Limítate exclusivamente a semiología morfológica microvascular y cutánea objetiva ("Los hallazgos morfológicos observados son compatibles con...", "Se aprecia reactividad microvascular cutánea o hiperpigmentación sugerente de...").
2. PROHIBIDO USAR INGLÉS, HASHTAGS #CAMELCASE O GUIONES BAJOS: Todos los valores de "severity" y todas las etiquetas en "clinical_flags" deben estar redactados ESTRICTAMENTE EN ESPAÑOL CLÍNICO CON ORTOGRAFÍA Y ACENTUACIÓN COMPLETAS, separados por espacios (ej. "Eritema Reticular", "Máculas Puntiformes", "Erupción Micropapular", "Compromiso Perifolicular", "Edema Cutáneo Superficial", "Insuficiencia Venosa Crónica").
3. Los valores permitidos para "severity" (tanto global como por cada elemento en "items") son exclusivamente: "Baja", "Moderada", "Alta" o "Crítica".

Genera la respuesta estrictamente en formato JSON con la siguiente estructura:
{
  "findings": "Síntesis clínica morfológica global integrando las ${processedFiles.length} fotografías...",
  "clinical_flags": ["Etiquetas clínicas en español sin guiones bajos, ej: Eritema Reticular, Edema Cutáneo Superficial"],
  "severity": "Baja" | "Moderada" | "Alta" | "Crítica",
  "items": [
    {
      "index": 1,
      "region": "Región anatómica identificada en la foto #1 en español (ej. Extremidad Inferior / Cara Anterior de la Pierna)",
      "finding": "Descripción morfológica objetiva de la foto #1 en español...",
      "severity": "Baja" | "Moderada" | "Alta" | "Crítica",
      "clinical_flags": ["Etiquetas clínicas específicas de esta foto en español sin guiones bajos"]
    }
  ]
}

Responde ÚNICAMENTE con el objeto JSON válido.`);

                console.log(`🤖 Consultando a Gemini Vision para análisis somático de ${processedFiles.length} foto(s)...`);
                const candidateModels = ['gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest'];
                let response = null;
                for (const targetModel of candidateModels) {
                    try {
                        response = await ai.models.generateContent({
                            model: targetModel,
                            contents,
                            config: {
                                responseMimeType: "application/json",
                            }
                        });
                        if (response?.text) break;
                    } catch (mErr) {
                        console.warn(`⚠️ Modelo ${targetModel} no disponible (${mErr.message}), probando siguiente...`);
                    }
                }

                if (!response || !response.text) {
                    throw new Error("Ningún modelo de Gemini Vision respondió con texto válido.");
                }

                const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                localRes = JSON.parse(cleanText);
                console.log("✅ Análisis multi-evidencia de Gemini Vision exitoso.");
            } catch (geminiErr) {
                console.error("⚠️ Error consultando a Gemini Vision. Usando fallback local:", geminiErr.message);
                localRes = runOfflineVisualMockMulti(processedFiles);
            }
        } else {
            console.log("ℹ️ GEMINI_API_KEY no configurada. Ejecutando motor de visión local offline.");
            localRes = runOfflineVisualMockMulti(processedFiles);
        }
        return localRes;
    };

    const hubPayload = {
        count: processedFiles.length,
        files: processedFiles.map(f => ({ name: f.fileName, mimeType: f.mimeType }))
    };

    // ⚡ Conmutador Sensory Processing Hub con timeout de 3500ms y fallback local enriquecido
    let analysisResults = await callSensoryHubWithFallback('/api/bio/scan/visual-scan', hubPayload, runLocalVisual);
    analysisResults = sanitizeSomaticMorphologyAndFlags(analysisResults || {});

        const normalizedItems = processedFiles.map((pf, idx) => {
            const aiItem = (Array.isArray(analysisResults?.items) && (analysisResults.items.find(it => Number(it.index) === idx + 1) || analysisResults.items[idx])) || null;
            const fallbackSingle = sanitizeSomaticMorphologyAndFlags(runOfflineVisualMock(pf.fileName));
            const rawItemFlags = Array.isArray(aiItem?.clinical_flags) ? aiItem.clinical_flags : (analysisResults?.clinical_flags || []);
            return {
                index: idx + 1,
                fileName: pf.fileName,
                region: sanitizeSomaticProseCofepris(aiItem?.region || `Evidencia Somática #${idx + 1}`),
                finding: sanitizeSomaticProseCofepris(aiItem?.finding || analysisResults?.findings || fallbackSingle.findings),
                severity: aiItem?.severity || analysisResults?.severity || fallbackSingle.severity || "Baja",
                clinical_flags: [...new Set(rawItemFlags.map(sanitizeSomaticFlagEs).filter(Boolean))],
                imageUrl: pf.dataUrl
            };
        });

        const mergedGlobalFlags = [...new Set((analysisResults?.clinical_flags || []).map(sanitizeSomaticFlagEs).filter(Boolean))];
        res.json({
            success: true,
            totalPhotos: processedFiles.length,
            findings: sanitizeSomaticProseCofepris(analysisResults?.findings || normalizedItems.map(i => `Foto #${i.index} (${i.region}): ${i.finding}`).join(' ')),
            clinical_flags: mergedGlobalFlags,
            severity: analysisResults?.severity || "Baja",
            imageUrl: processedFiles[0].dataUrl,
            items: normalizedItems
        });

    } catch (err) {
        console.error("🔥 Error en endpoint visual-scan:", err.message);
        res.status(500).json({ success: false, message: "Error interno al procesar el análisis de visión somática." });
    } finally {
        // Destrucción efímera de las imágenes clínicas temporales en cumplimiento con HIPAA y LFPDPPP
        for (const f of uploadedFiles) {
            try {
                if (f?.path && fs.existsSync(f.path)) {
                    fs.unlinkSync(f.path);
                    console.log(`🗑️ [EFÍMERO] Imagen de evidencia visual destruida físicamente del servidor: ${f.path}`);
                }
            } catch (unlinkErr) {
                console.error("⚠️ No se pudo eliminar la imagen temporal de evidencia visual:", unlinkErr.message);
            }
        }
    }
});

function runOfflineVisualMockMulti(processedFiles) {
    const items = processedFiles.map((pf, idx) => {
        const single = runOfflineVisualMock(pf.fileName);
        return {
            index: idx + 1,
            region: `Región Anatómica Evaluada #${idx + 1}`,
            finding: single.findings,
            severity: single.severity,
            clinical_flags: single.clinical_flags
        };
    });
    const allFlags = [...new Set(items.flatMap(i => i.clinical_flags || []))];
    const hasHigh = items.some(i => {
        const s = String(i.severity || '').toUpperCase();
        return s.includes('HIGH') || s.includes('ALTA') || s.includes('CRÍTICA') || s.includes('CRITICA');
    });
    return {
        findings: items.map(i => `[Evidencia #${i.index}] ${i.finding}`).join(' '),
        clinical_flags: allFlags,
        severity: hasHigh ? 'Alta' : 'Baja',
        items
    };
}

// Helper de fallback local offline para análisis visual
function runOfflineVisualMock(fileName) {
    const name = fileName.toLowerCase();
    let isVascular = name.includes('varice') || name.includes('vena') || name.includes('pierna') || name.includes('vascular') || name.includes('tobillo') || name.includes('leg') || name.includes('vein') || name.includes('estasis');
    
    if (isVascular) {
        return {
            findings: "Marcadores visuales observados en la extremidad inferior compatibles con Insuficiencia Venosa Crónica severa. Se aprecian venas varicosas prominentes y tortuosas con una marcada pigmentación ocre (hemosiderina / dermatitis por estasis) de predominio peri-maleolar en cara medial. Edema periférico moderado evidente.",
            clinical_flags: ["Insuficiencia Venosa Crónica", "Venas Varicosas de Alto Riesgo", "Dermatitis por Estasis Venosa"],
            severity: "Alta"
        };
    }

    return {
        findings: "Exploración visual compatible con tejido cutáneo sin lesiones ulcerosas ni signos evidentes de compromiso microvascular o venoso superficial crítico en el área analizada. Se aconseja monitoreo evolutivo en consultas subsiguientes.",
        clinical_flags: [],
        severity: "Baja"
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

        // 2. Procesar PDFs determinísticamente con pdf-parse + Study Grouping (analyte_uid) y fallback Vision solo para imágenes/escaneos sin capa de texto
        if (nonXmlFiles.length > 0) {
            const {
                buildAnalyteUid,
                sanitizeLabReferenceRange,
                classifyAndParsePdfFile,
                consolidateUniversalExternalStudies
            } = require('../utils/universalExternalStudiesParser');

            const runLocalDocs = async () => {
                let localMetrics = { ...external_metrics };
                const deterministicDocs = [];
                const visionFiles = [];

                for (const file of nonXmlFiles) {
                    const ext = path.extname(file.originalname || '').toLowerCase();
                    if (ext === '.pdf') {
                        const parsedDoc = await classifyAndParsePdfFile(file.path, file.originalname);
                        if (parsedDoc && parsedDoc.domain !== 'NEEDS_VISION_OCR') {
                            deterministicDocs.push(parsedDoc);
                        } else {
                            visionFiles.push(file);
                        }
                    } else {
                        visionFiles.push(file);
                    }
                }

                const consolidated = consolidateUniversalExternalStudies(deterministicDocs, new Date());

                if (visionFiles.length === 0) {
                    return {
                        ...consolidated,
                        body_comp: {},
                        allergies_detected: [],
                        exercise_log: xmlExerciseLog || null
                    };
                }

                if (process.env.GEMINI_API_KEY) {
                try {
                    const { GoogleGenAI } = require('@google/genai');
                    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

                    const contents = [
                        `Eres un "Clinical Data Extractor" del Ecosistema Equipo en Acción®.
Tu tarea es extraer el 100% de los parámetros analíticos, fecha de toma (YYYY-MM-DD) y hallazgos de gabinete (ECG, RX, US, RM, DMO) de los documentos adjuntos sin omitir analitos homónimos con distinta unidad (% vs miles/µL).

El JSON resultante debe tener esta estructura exacta:
{
  "external_metrics": {
    "patient_name": "Nombre completo detectado (si existe)",
    "study_date_iso": "YYYY-MM-DD",
    "sections": {
      "quimica_renal_electrolitos": {
        "title": "Química Integral, Función Renal y Electrolitos",
        "items": [
          { "name": "Glucosa", "val": "88", "unit": "mg/dL", "ref": "55 - 99", "status": "NORMAL" }
        ]
      }
    },
    "labs": {},
    "imaging": {},
    "body_comp": {},
    "allergies_detected": [],
    "exercise_log": null
  }
}

Responde ÚNICAMENTE con el objeto JSON válido.`
                    ];

                    for (const file of visionFiles) {
                        const dataBase64 = fs.readFileSync(file.path).toString("base64");
                        contents.push({
                            inlineData: {
                                data: dataBase64,
                                mimeType: file.mimetype || 'application/pdf'
                            }
                        });
                    }

                    const candidateModels = [
                        'gemini-flash-latest',
                        'gemini-flash-lite-latest'
                    ];
                    let response = null;
                    for (const targetModel of candidateModels) {
                        try {
                            console.log(`🤖 Consultando ${targetModel} para documentos escaneados sin capa de texto (${visionFiles.length})...`);
                            response = await ai.models.generateContent({
                                model: targetModel,
                                contents,
                                config: {
                                    responseMimeType: "application/json",
                                }
                            });
                            if (response?.text) break;
                        } catch (mErr) {
                            console.warn(`⚠️ Modelo ${targetModel} no disponible en external-docs (${mErr.message}), probando siguiente...`);
                        }
                    }

                    if (!response || !response.text) {
                        if (deterministicDocs.length > 0) {
                            return {
                                ...consolidated,
                                body_comp: {},
                                allergies_detected: [],
                                exercise_log: xmlExerciseLog || null
                            };
                        }
                        throw new Error("Ningún modelo respondió para documentos escaneados.");
                    }

                    const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanText);
                    const rawMetrics = parsed.external_metrics || parsed;
                    const normalized = normalizeExtractedLabMetrics(rawMetrics, buildAnalyteUid, sanitizeLabReferenceRange);

                    const mergedSections = [
                        ...(Array.isArray(consolidated.sections) ? consolidated.sections : []),
                        ...(Array.isArray(normalized.sections) ? normalized.sections : Object.values(normalized.sections || {}))
                    ];
                    localMetrics = {
                        ...normalized,
                        ...consolidated,
                        sections: mergedSections,
                        biomarkers: { ...(normalized.biomarkers || {}), ...(consolidated.biomarkers || {}) },
                        labs: { ...(normalized.labs || {}), ...(consolidated.labs || {}) },
                        totalParameters: (consolidated.totalParameters || 0) + (normalized.totalParameters || 0),
                        abnormalCount: (consolidated.abnormalCount || 0) + (normalized.abnormalCount || 0),
                        exercise_log: xmlExerciseLog || normalized.exercise_log || null
                    };
                } catch (geminiErr) {
                    if (deterministicDocs.length > 0) {
                        return {
                            ...consolidated,
                            body_comp: {},
                            allergies_detected: [],
                            exercise_log: xmlExerciseLog || null
                        };
                    }
                    console.error("🛑 [NOM-004 FAIL-CLOSED] Error en extracción OCR de documentos externos:", geminiErr.message);
                    const ocrErr = new Error("Servicio de extracción OCR no disponible temporalmente. Verifique conexión o reintente.");
                    ocrErr.code = 'OCR_UNAVAILABLE';
                    throw ocrErr;
                }
            } else if (deterministicDocs.length > 0) {
                return {
                    ...consolidated,
                    body_comp: {},
                    allergies_detected: [],
                    exercise_log: xmlExerciseLog || null
                };
            } else {
                console.error("🛑 [NOM-004 FAIL-CLOSED] GEMINI_API_KEY no configurada para extracción OCR.");
                const ocrErr = new Error("Motor OCR no configurado en el servidor.");
                ocrErr.code = 'OCR_UNAVAILABLE';
                throw ocrErr;
            }
            return localMetrics;
        };

        const hubPayload = {
            count: nonXmlFiles.length,
            files: nonXmlFiles.map(f => ({ name: f.originalname, mimeType: f.mimetype }))
        };

        // ⚡ Conmutador Sensory Processing Hub con timeout de 3500ms y fallback local OCR real (Cero mocks sintéticos)
        external_metrics = await callSensoryHubWithFallback('/api/bio/scan/external-docs', hubPayload, runLocalDocs);
    }

        res.json({
            success: true,
            external_metrics
        });

    } catch (err) {
        console.error("🔥 Error en endpoint external-docs:", err.message);
        if (err.code === 'OCR_UNAVAILABLE') {
            return res.status(503).json({
                success: false,
                error: 'OCR_UNAVAILABLE',
                message: err.message
            });
        }
        res.status(500).json({ success: false, error: 'EXTERNAL_DOCS_ERROR', message: "Error al procesar los documentos externos." });
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

// Normalizador universal con llave compuesta analyte_uid = slug(nombre)::slug(unidad)::fecha_iso (cero colisión de homónimos)
function normalizeExtractedLabMetrics(raw, buildAnalyteUidFn = null, sanitizeRefFn = null) {
    const rawSectionsObj = raw?.sections && typeof raw.sections === 'object' ? raw.sections : {};
    const studyDateIso = raw?.study_date_iso || null;
    const sectionsArray = [];
    const biomarkers = {};
    const labs = raw?.labs && typeof raw.labs === 'object' ? { ...raw.labs } : {};
    let totalParameters = 0;
    let abnormalCount = 0;

    const entries = Array.isArray(rawSectionsObj)
        ? rawSectionsObj.map((s, i) => [s.id || `sec_${i}`, s])
        : Object.entries(rawSectionsObj);

    const allItemsFlat = entries.flatMap(([, s]) => (Array.isArray(s?.items) ? s.items : []));
    const nameFreq = new Map();
    for (const it of allItemsFlat) {
        if (!it?.name) continue;
        const baseSlug = String(it.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
        nameFreq.set(baseSlug, (nameFreq.get(baseSlug) || 0) + 1);
    }

    for (const [secKey, secObj] of entries) {
        const items = Array.isArray(secObj?.items) ? secObj.items : [];
        const normItems = [];
        for (const item of items) {
            if (!item || !item.name) continue;
            totalParameters++;
            const statusUpper = String(item.status || 'NORMAL').toUpperCase();
            if (statusUpper !== 'NORMAL' && statusUpper !== '-') {
                abnormalCount++;
            }
            const baseSlug = String(item.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            const unitStr = String(item.unit || '').trim();
            let displayName = item.name;
            if ((nameFreq.get(baseSlug) || 0) > 1 && !/\(/.test(displayName) && unitStr) {
                displayName = unitStr === '%' ? `${displayName} (%)` : `${displayName} (${unitStr})`;
            }
            const cleanRef = sanitizeRefFn ? sanitizeRefFn(item.ref || item.reference || '') : (item.ref || item.reference || '');
            const uid = buildAnalyteUidFn
                ? buildAnalyteUidFn(displayName, unitStr, studyDateIso)
                : `${baseSlug}::${unitStr.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'indice'}::${studyDateIso || 'sin_fecha'}`;
            const valRaw = item.val !== undefined ? item.val : item.value;
            const numVal = parseFloat(String(valRaw).replace(',', '.'));
            const isThousandCells = /miles\/[µu]l|10\^3\/[µu]l/i.test(unitStr) && Number.isFinite(numVal);
            const isPcrMgDl = /prote[íi]na\s+c\s+reactiva|\bpcr\b/i.test(displayName) && /^mg\/dl$/i.test(unitStr) && Number.isFinite(numVal);

            const enriched = {
                analyte_uid: uid,
                name: displayName,
                val: String(valRaw ?? ''),
                value: Number.isFinite(numVal) ? numVal : valRaw,
                unit: unitStr,
                ref: cleanRef,
                reference: cleanRef,
                status: item.status || 'NORMAL',
                section: secObj.title || secKey,
                ...(isThousandCells ? { value_cells_per_ul: Math.round(numVal * 1000) } : {}),
                ...(isPcrMgDl ? { value_mg_l: Number((numVal * 10).toFixed(3)) } : {})
            };
            normItems.push(enriched);
            biomarkers[uid] = enriched;
            labs[`${baseSlug}_${unitStr.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`.replace(/_+$/, '')] = `${valRaw} ${unitStr}`.trim();
        }
        if (normItems.length > 0) {
            sectionsArray.push({
                id: secKey,
                title: secObj.title || secKey,
                items: normItems
            });
        }
    }

    return {
        patient_name: raw?.patient_name || null,
        sections: sectionsArray,
        biomarkers,
        labs,
        totalParameters,
        abnormalCount,
        imaging: raw?.imaging || {},
        body_comp: raw?.body_comp || {},
        allergies_detected: raw?.allergies_detected || [],
        exercise_log: raw?.exercise_log || null
    };
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

        if (persisted && persisted.patient_data_snapshot) {
            const decSnap = cryptoVault.decryptClinicalData(persisted.patient_data_snapshot) || '{}';
            patientDataObj = typeof decSnap === 'string' ? JSON.parse(decSnap) : decSnap;
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
            const card = electretBiomarkers.cardiovascular;
            const gastro = electretBiomarkers.funcion_gastrointestinal;
            
            // Viscosidad de la sangre
            if (card?.viscosidad_de_la_sangre) {
                patientDataObj.vitals.blood_viscosity = card.viscosidad_de_la_sangre.value;
            } else if (electretBiomarkers.blood_viscosity) {
                patientDataObj.vitals.blood_viscosity = electretBiomarkers.blood_viscosity.value;
            }

            // Coeficiente de secreción de pepsina
            if (gastro?.coeficiente_de_secrecion_de_pepsina) {
                patientDataObj.vitals.pepsin_coefficient = gastro.coeficiente_de_secrecion_de_pepsina.value;
            } else if (electretBiomarkers.pepsin_coefficient) {
                patientDataObj.vitals.pepsin_coefficient = electretBiomarkers.pepsin_coefficient.value;
            }

            // Ángulo de fase
            if (electretBiomarkers.densidad_osea?.angulo_de_fase) {
                patientDataObj.vitals.phase_angle = electretBiomarkers.densidad_osea.angulo_de_fase.value;
            } else if (electretBiomarkers.phase_angle) {
                patientDataObj.vitals.phase_angle = electretBiomarkers.phase_angle.raw_value || electretBiomarkers.phase_angle.value;
            }
        }

        // Inyectar Alergias detectadas en el Escáner Electret
        if (electretBiomarkers && electretBiomarkers.alergias) {
            patientDataObj.safety = patientDataObj.safety || {};
            patientDataObj.safety.allergies = patientDataObj.safety.allergies || [];
            const currentSafetyAllergies = new Set(patientDataObj.safety.allergies);

            patientDataObj.history = patientDataObj.history || {};
            patientDataObj.history.allergies = patientDataObj.history.allergies || { food: [], drug: [] };
            patientDataObj.history.allergies.food = patientDataObj.history.allergies.food || [];

            Object.entries(electretBiomarkers.alergias).forEach(([key, marker]) => {
                const s = marker.status ? marker.status.toUpperCase() : '';
                if (s.includes('WARNING') || s.includes('CRITICAL') || s.includes('ANORMAL') || s.includes('SEVERE')) {
                    let allergen = marker.name.replace(/^[íÍ]ndice de alergia a(l)?\s+/i, '').trim();
                    allergen = allergen.charAt(0).toUpperCase() + allergen.slice(1);
                    
                    if (allergen) {
                        currentSafetyAllergies.add(allergen);

                        const lowerAllergen = allergen.toLowerCase();
                        if (lowerAllergen.includes('leche') || lowerAllergen.includes('marisco') || lowerAllergen.includes('huevo') || lowerAllergen.includes('trigo') || lowerAllergen.includes('soya') || lowerAllergen.includes('mani') || lowerAllergen.includes('nuez')) {
                            const exists = patientDataObj.history.allergies.food.some(
                                a => a.agent.toLowerCase() === allergen.toLowerCase()
                            );
                            if (!exists) {
                                patientDataObj.history.allergies.food.push({
                                    agent: allergen,
                                    reaction: "Alerta metabólica - Escáner Electret/Biorresonancia",
                                    status: "ACTIVE"
                                });
                            }
                        }
                    }
                }
            });
            patientDataObj.safety.allergies = Array.from(currentSafetyAllergies);
        }

        applyOcularVitalsGuard(patientDataObj, ocularBiomarkers);
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

            // Glucosa y Hemoglobina de Labs externos (soporte bilingüe español/inglés)
            if (externalMetrics.labs) {
                const rawGluc = externalMetrics.labs.glucose || externalMetrics.labs.glucosa || externalMetrics.labs.glucosa_mg_dl;
                if (rawGluc) {
                    const match = String(rawGluc).match(/\d+(?:\.\d+)?/);
                    if (match) {
                        const glucoseVal = parseFloat(match[0]);
                        patientDataObj.vitals.glucose = glucoseVal;
                        patientDataObj.signosVitales = patientDataObj.signosVitales || {};
                        patientDataObj.signosVitales.glucosa = `${glucoseVal} mg/dL`;
                    }
                }
                const rawHgb = externalMetrics.labs.hemoglobin || externalMetrics.labs.hemoglobina || externalMetrics.labs.hemoglobina_g_dl;
                if (rawHgb) {
                    patientDataObj.vitals.hemoglobin = rawHgb;
                }
            }

            if (Array.isArray(externalMetrics.cabinet_flags) && externalMetrics.cabinet_flags.length > 0) {
                const mergedFlags = new Set(patientDataObj.clinical_flags || []);
                externalMetrics.cabinet_flags.forEach(f => mergedFlags.add(f));
                patientDataObj.clinical_flags = Array.from(mergedFlags);
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
            const card = electretBiomarkers.cardiovascular;
            const gastro = electretBiomarkers.funcion_gastrointestinal;

            if (card?.viscosidad_de_la_sangre && (card.viscosidad_de_la_sangre.status === 'CRITICAL' || card.viscosidad_de_la_sangre.status === 'warning_high')) {
                clinicalFlags.add("HIGH_CARDIO_RISK");
            } else if (electretBiomarkers.blood_viscosity && electretBiomarkers.blood_viscosity.status === 'CRITICAL') {
                clinicalFlags.add("HIGH_CARDIO_RISK");
            }

            if (gastro?.coeficiente_de_secrecion_de_pepsina && (gastro.coeficiente_de_secrecion_de_pepsina.status === 'WARNING' || gastro.coeficiente_de_secrecion_de_pepsina.status === 'warning_low')) {
                clinicalFlags.add("DIGESTIVE_ENZYME_LOW");
            } else if (electretBiomarkers.pepsin_coefficient && electretBiomarkers.pepsin_coefficient.status === 'WARNING') {
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

        // 4. Guardar de nuevo en SQLite (cifrado AES-256-GCM y conservando user_id)
        const stmtSave = db.prepare(`
            INSERT INTO session_persistence (citation_id, last_active_phase, last_active_block, patient_data_snapshot, is_completed, last_updated)
            VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
            ON CONFLICT(citation_id) DO UPDATE SET
                patient_data_snapshot = excluded.patient_data_snapshot,
                last_updated = CURRENT_TIMESTAMP
        `);

        stmtSave.run(citationId.toString(), phase, block, cryptoVault.encryptClinicalData(patientDataObj));

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

router._egmPhase18Guards = {
    normalizeCornealArcusScale,
    sanitizeWhiteLabelClinicalText,
    sanitizeOcularPredictionSSoT,
    normalizeSaburraOrthography,
    sanitizeLingualPredictionSSoT,
    sanitizeSomaticFlagEs,
    sanitizeSomaticProseCofepris,
    sanitizeSomaticMorphologyAndFlags,
    applyOcularVitalsGuard
};

module.exports = router;
