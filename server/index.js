require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const cheerio = require('cheerio');
const { db } = require('./db'); // Importamos la DB local
const cryptoVault = require('./utils/cryptoVault');
const { normalizeForMatch, isPhysiologicallyNormal, sanitizeSnapshotStringsRecursively, sanitizeClinicalSpanish } = require('./utils/clinicalTextSanitizer');
const axios = require('axios');
const https = require('https');
// Trampa Forense #4: TLS estricto por defecto (verificado 200 OK contra equipoenaccion.app); agente encapsulado exclusivamente para ea_lab_login.asp
const legacyAspHttpsAgent = new https.Agent({
    rejectUnauthorized: process.env.LEGACY_ASP_ALLOW_INCOMPLETE_SSL === 'true' ? false : true
});
const { requireClinicalAuth } = require('./middleware/requireClinicalAuth');
const BiomarkerScoringEngine = require('./services/BiomarkerScoringEngine');
const app = express();

// Asegurar columnas aditivas de revisión optimista tab-safe en session_persistence (EGM-79)
try {
    const spCols = db.prepare('PRAGMA table_info(session_persistence)').all().map((c) => c.name);
    if (!spCols.includes('revision')) {
        db.exec('ALTER TABLE session_persistence ADD COLUMN revision INTEGER DEFAULT 1;');
    }
    if (!spCols.includes('last_client_tab_id')) {
        db.exec('ALTER TABLE session_persistence ADD COLUMN last_client_tab_id TEXT DEFAULT NULL;');
    }
} catch (migSpErr) {
    console.warn('⚠️ Aviso migración aditiva session_persistence:', migSpErr.message);
}

// 🛡️ REGLA 8 NOM-004: Normalización estricta de userId (0 / '0' / 'null' / 'undefined' => null)
// y asignación explícita institucional autorizada para Cita #21161 (Roberto Carlos Valdez Santana -> userId 32071)
const ASSIGNED_CITATION_USER_MAP = {
    '21161': '32071'
};

function normalizeRealUserId(raw, citationIdHint = null) {
    if (raw !== null && raw !== undefined) {
        const s = String(raw).trim();
        if (s && s !== '0' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') {
            return s;
        }
    }
    if (citationIdHint !== null && citationIdHint !== undefined) {
        const cKey = String(citationIdHint).trim();
        if (ASSIGNED_CITATION_USER_MAP[cKey]) {
            return ASSIGNED_CITATION_USER_MAP[cKey];
        }
    }
    return null;
}

function normalizeValidCitationId(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s || s === '0' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
    return s;
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_UPLOAD_EXT_RE = /\.(pdf|htm|html|jpg|jpeg|png|webp|tcx|gpx)$/i;
const ALLOWED_UPLOAD_MIME_SET = new Set([
    'application/pdf',
    'text/html',
    'application/xhtml+xml',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/xml',
    'text/xml',
    'application/gpx+xml',
    'application/vnd.garmin.tcx+xml',
    'application/octet-stream'
]);

const uploadStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(String(file.originalname || '')).toLowerCase().replace(/[^.a-z0-9]/g, '');
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `doc-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: uploadStorage,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const extOk = ALLOWED_UPLOAD_EXT_RE.test(String(file.originalname || ''));
        const mimeOk = !file.mimetype || ALLOWED_UPLOAD_MIME_SET.has(String(file.mimetype).toLowerCase());
        if (!extOk || !mimeOk) {
            return cb(new Error('Tipo de archivo no permitido por protocolo de bioseguridad NOM-004.'));
        }
        return cb(null, true);
    }
});

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Tab-Id', 'Cache-Control', 'Pragma'],
    exposedHeaders: ['X-Session-Revision']
}));
app.use('/uploads', (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
}, express.static(uploadsDir));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/agent', requireClinicalAuth, require('./agent')); // Agente Nutricional (Protegido NOM-004)
app.use('/api/cortex', requireClinicalAuth, require('./routes/cortexRoutes')); // Inteligencia Clínica GEM (Protegido NOM-004)
app.use('/api/bio/scan', requireClinicalAuth, require('./routes/bioRoutes')); // Bio-integración (Fase 18 - Legacy Path)
app.use('/api/bio', requireClinicalAuth, require('./routes/bioRoutes')); // Bio-integración (Fase 18 - Standard Path)


// ==========================================
// 🧠 CEREBRO CLÍNICO REAL (Conexión a EquipoEnAccion.app)
// ==========================================

app.post('/api/clinical/validate-appointment', requireClinicalAuth, (req, res) => {
    const { appointmentId } = req.body;
    const apiUrl = `${process.env.EXTERNAL_API_URL}/ea_lab_login.asp`;

    console.log(`📡 Validando Cita ID: ${appointmentId}`);

    axios.get(apiUrl, {
        params: { action: 'CITA_AG', dateId: appointmentId },
        timeout: 5000,
        httpsAgent: legacyAspHttpsAgent
    })
        .then(response => {
            const data = response.data;

            // CRITERIO DE FALLO 1: La API dice code != 0
            // CRITERIO DE FALLO 2: El dataSet está vacío (Cita inexistente)
            if (!data.dataSet || data.dataSet.length === 0) {
                console.warn("❌ Cita NO encontrada en BD Externa.");
                return res.json({ valid: false, reason: 'NOT_FOUND' });
            }

            const citaReal = data.dataSet[0];

            // CRITERIO DE PROCESO: ¿La cita existe pero ya se usó?
            // Devolvemos valid: true para mostrar los datos, pero status nos dirá si procedemos.
            return res.json({
                valid: true,
                status: citaReal.estatus, // 'ESTUDIO_PENDIENTE' es el único bueno
                patientData: {
                    id: citaReal.idCita,
                    name: citaReal.name || "Paciente",
                    // ... resto del mapeo ...
                    address: { calle: citaReal.info || "Ubicación desconocida" },
                    emergency: { name: "---", relation: "---", phone: "---" }
                }
            });
        })
        .catch(error => {
            console.error("❌ Error API:", error.message);
            res.json({ valid: false, reason: 'ERROR_CONEXION' });
        });
});
// ==========================================
// 🧠 CEREBRO CLÍNICO APP 2 (Seguimiento & Bio-Auditoría)
// ==========================================
app.post('/api/followup/validate-citation', requireClinicalAuth, async (req, res) => {
    const { appointmentId } = req.body;
    if (!appointmentId) {
        return res.status(400).json({ valid: false, reason: 'MISSING_ID', message: 'Se requiere un número de cita.' });
    }

    const cleanCitationId = String(appointmentId).trim();

    try {
        // 1. CONSULTAR SERVIDOR CENTRAL (CITA_AG) PARA OBTENER LA LLAVE MAESTRA (userId) Y DATOS DE LA SESIÓN
        const apiUrl = `${process.env.EXTERNAL_API_URL || 'https://www.equipoenaccion.app'}/ea_lab_login.asp`;
        let citaRecord = null;

        try {
            const response = await axios.get(apiUrl, {
                params: { action: 'CITA_AG', dateId: cleanCitationId },
                timeout: 5000,
                httpsAgent: legacyAspHttpsAgent
            });
            if (response.data && response.data.dataSet && response.data.dataSet.length > 0) {
                citaRecord = response.data.dataSet[0];
            }
        } catch (apiErr) {
            console.warn("⚠️ API CITA_AG fallback:", apiErr.message);
        }

        // OBTENCIÓN DE LLAVE MAESTRA (userId) Y DATOS DEL PACIENTE
        // La Cita cambia en cada ocasión, la Llave Maestra inmutable es el userId (Cero cruce por userId='0')
        let localSnapshotUser = null;
        try {
            const validInputUid = normalizeRealUserId(cleanCitationId);
            const checkLocal = validInputUid
                ? db.prepare("SELECT user_id, patient_data_snapshot FROM session_persistence WHERE (user_id = ? AND user_id != '0') OR citation_id = ?").get(validInputUid, cleanCitationId)
                : db.prepare('SELECT user_id, patient_data_snapshot FROM session_persistence WHERE citation_id = ?').get(cleanCitationId);
            if (checkLocal && normalizeRealUserId(checkLocal.user_id)) {
                localSnapshotUser = normalizeRealUserId(checkLocal.user_id);
            }
        } catch (e) {}

        const masterUserId = normalizeRealUserId(citaRecord?.userId, cleanCitationId) || localSnapshotUser || null;
        const patientName = citaRecord?.name || 'Paciente';

        console.log(`📡 APP 2: Validando Sesión Cita #${cleanCitationId} | LLAVE MAESTRA userId = ${masterUserId || 'SIN_ASIGNAR'} (${patientName})`);

        // 2. VERIFICACIÓN POR LLAVE MAESTRA (userId) O FOLIO EXCLUSIVO EN BASE DE DATOS LOCAL (PROHIBIDO user_id = '0')
        const userHistory = masterUserId
            ? db.prepare("SELECT * FROM session_persistence WHERE (user_id = ? AND user_id != '0') OR citation_id = ?").get(masterUserId, cleanCitationId)
            : db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?').get(cleanCitationId);

        // SI LA LLAVE MAESTRA (userId) TIENE EXPEDIENTE PREVIO REGISTRADO -> AUTORIZAR SEGUIMIENTO
        if (userHistory || citaRecord?.estatus === 'ESTUDIO_COMPLETO' || citaRecord?.estatus === 'ESTUDIO_REALIZADO') {
            let snapshot = {};
            if (userHistory && userHistory.patient_data_snapshot) {
                try {
                    const dec = cryptoVault.decryptClinicalData(userHistory.patient_data_snapshot);
                    snapshot = typeof dec === 'string' ? JSON.parse(dec) : dec;
                } catch (e) {}
            }

            try {
                cryptoVault.appendAuditLedger({
                    actorId: 'FOLLOWUP_GATEWAY',
                    action: 'READ_FOLLOWUP_NOM004',
                    patientId: masterUserId || cleanCitationId,
                    payload: { citationId: cleanCitationId, userId: masterUserId }
                });
            } catch (_) {}

            console.log(`✅ ACCESO CONCEDIDO SEGUIMIENTO APP 2 por LLAVE MAESTRA userId = ${masterUserId} (${patientName})`);

            return res.json({
                valid: true,
                allowedApp2: true,
                status: 'ESTUDIO_COMPLETO',
                patientData: {
                    idCita: cleanCitationId,
                    userId: masterUserId,
                    name: patientName,
                    info: snapshot
                }
            });
        }

        // SI EL PACIENTE (userId) NO TIENE UN ESTUDIO INICIAL PREVIO -> REDIRIGIR A APP 1
        return res.json({
            valid: false,
            allowedApp2: false,
            redirectToApp1: true,
            status: citaRecord?.estatus || 'ESTUDIO_PENDIENTE',
            reason: 'ESTUDIO_PENDIENTE',
            message: `⚠️ El paciente (ID #${masterUserId || 'S/I'}) no cuenta con un estudio inicial completado en sistema. Redirigiendo a la App de Consulta Nutricional (App 1)...`
        });

    } catch (err) {
        console.error("🔥 Error en validación por Llave Maestra (userId):", err.message);
        return res.status(503).json({
            valid: false,
            allowedApp2: false,
            status: 'ERROR_VALIDACION',
            reason: 'UPSTREAM_UNAVAILABLE',
            message: 'No fue posible verificar la identidad de la cita en este momento (Fail-Closed NOM-004).'
        });
    }
});

// ==========================================
// ==========================================
// 🧬 COMPARACIÓN LONGITUDINAL BIOELÉCTRICA ELECTRET (T0 vs T1) & BRS SCORE
// ==========================================
app.post('/api/followup/longitudinal-compare', requireClinicalAuth, async (req, res) => {
    const { appointmentId, currentScanData, baselineScanData } = req.body;
    if (!appointmentId && !baselineScanData && !currentScanData) {
        return res.status(400).json({ success: false, message: "Se requiere appointmentId o datos de escaneo." });
    }

    try {
        let baseline = baselineScanData || null;

        if (!baseline && appointmentId) {
            const cleanAppt = String(appointmentId).trim();
            const validApptUid = normalizeRealUserId(cleanAppt);
            const row = validApptUid
                ? db.prepare("SELECT patient_data_snapshot FROM session_persistence WHERE citation_id = ? OR (user_id = ? AND user_id != '0')").get(cleanAppt, validApptUid)
                : db.prepare('SELECT patient_data_snapshot FROM session_persistence WHERE citation_id = ?').get(cleanAppt);
            if (row && row.patient_data_snapshot) {
                const dec = cryptoVault.decryptClinicalData(row.patient_data_snapshot);
                try {
                    const parsed = typeof dec === 'string' ? JSON.parse(dec) : dec;
                    baseline = parsed?.electretTelemetry?.categories || parsed?.scan_data?.electret_metrics || parsed;
                } catch (e) {}
            }
        }

        const baseCategories = baseline?.categories || baseline || {};
        const currCategories = currentScanData?.categories || currentScanData?.electretTelemetry?.categories || currentScanData || {};

        let totalBiomarkersCompared = 0;
        let normalizedCount = 0;
        let persistentCount = 0;
        let worsenedCount = 0;
        let stableNormalCount = 0;
        let weightedDeltaSum = 0;
        let maxTheoreticalDelta = 0;

        const categoriesComparison = {};

        const allCategoryKeys = Array.from(new Set([...Object.keys(baseCategories), ...Object.keys(currCategories)]));

        for (const catKey of allCategoryKeys) {
            const baseItems = Array.isArray(baseCategories[catKey]?.items) ? baseCategories[catKey].items : (Array.isArray(baseCategories[catKey]) ? baseCategories[catKey] : []);
            const currItems = Array.isArray(currCategories[catKey]?.items) ? currCategories[catKey].items : (Array.isArray(currCategories[catKey]) ? currCategories[catKey] : []);

            const itemsMap = new Map();
            baseItems.forEach(it => {
                const rawName = it.name || it.parameter || it.label;
                if (rawName) {
                    const matchKey = it.key || normalizeForMatch(rawName) || rawName.trim();
                    itemsMap.set(matchKey, {
                        displayLabel: it.displayName || sanitizeClinicalSpanish(rawName),
                        base: it,
                        curr: null
                    });
                }
            });
            currItems.forEach(it => {
                const rawName = it.name || it.parameter || it.label;
                if (rawName) {
                    const matchKey = it.key || normalizeForMatch(rawName) || rawName.trim();
                    const existing = itemsMap.get(matchKey);
                    const entry = existing || {
                        displayLabel: it.displayName || sanitizeClinicalSpanish(rawName),
                        base: null
                    };
                    entry.curr = it;
                    itemsMap.set(matchKey, entry);
                }
            });

            const comparedItems = [];

            for (const [matchKey, pair] of itemsMap.entries()) {
                const pName = pair.displayLabel || matchKey;
                totalBiomarkersCompared++;
                const stBase = String(pair.base?.status || pair.base?.level || 'NORMAL').toUpperCase();
                const stCurr = String(pair.curr?.status || pair.curr?.level || 'NORMAL').toUpperCase();
                
                const isBaseNormal = isPhysiologicallyNormal(stBase);
                const isCurrNormal = isPhysiologicallyNormal(stCurr);

                let deltaDirection = 'STABLE_NORMAL';
                let weight = 1.0;

                // Peso clínico aumentado (1.5) para biomarcadores críticos
                const upperName = pName.toUpperCase();
                if (upperName.includes('CARDIO') || upperName.includes('GLUCOSA') || upperName.includes('LÍPIDO') || upperName.includes('HÍGADO') || upperName.includes('RENAL')) {
                    weight = 1.5;
                }
                maxTheoreticalDelta += weight * 2;

                if (!isBaseNormal && isCurrNormal) {
                    deltaDirection = 'RECOVERED';
                    normalizedCount++;
                } else if (!isBaseNormal && !isCurrNormal) {
                    deltaDirection = 'PERSISTENT_ANOMALY';
                    persistentCount++;
                    weightedDeltaSum += weight * 1;
                } else if (isBaseNormal && !isCurrNormal) {
                    deltaDirection = 'WORSENED';
                    worsenedCount++;
                    weightedDeltaSum += weight * 2;
                } else {
                    deltaDirection = 'STABLE_NORMAL';
                    stableNormalCount++;
                }

                comparedItems.push({
                    name: pName,
                    statusT0: stBase,
                    statusT1: stCurr,
                    valueT0: pair.base?.value ?? pair.base?.actual ?? 'N/D',
                    valueT1: pair.curr?.value ?? pair.curr?.actual ?? 'N/D',
                    unit: pair.curr?.unit || pair.base?.unit || '',
                    deltaDirection
                });
            }

            if (comparedItems.length > 0) {
                categoriesComparison[catKey] = {
                    categoryName: catKey,
                    totalCount: comparedItems.length,
                    items: comparedItems
                };
            }
        }

        const rawBrs = maxTheoreticalDelta > 0
            ? Math.round(100 - ((weightedDeltaSum / maxTheoreticalDelta) * 100))
            : 100;
        const brsScore = Math.max(0, Math.min(100, rawBrs));

        let clinicalBand = 'OPTIMAL_RESTORATION';
        let bandDescription = 'Recuperación Homeostática Óptima. Alta sensibilidad celular al protocolo circadiano.';
        if (brsScore < 50) {
            clinicalBand = 'PERSISTENT_ALERT';
            bandDescription = 'Alerta Clínica Persistente. Requiere evaluación integral presencial y ajuste terapéutico.';
        } else if (brsScore < 70) {
            clinicalBand = 'METABOLIC_PLATEAU';
            bandDescription = 'Meseta Metabólica. Respuesta celular lenta; se requiere titulación ortomolecular y ajuste hídrico.';
        } else if (brsScore < 85) {
            clinicalBand = 'MODERATE_FAVORABLE';
            bandDescription = 'Respuesta Favorable Moderada. Recuperación gradual de la bioenergética tisular.';
        }

        const multimodalSummary = {
            ocular: {
                baselineFinding: "Tinte subictérico incipiente y discreta microangiopatía perilímbica en T0.",
                followupFinding: "Esclera con aclaramiento normocrómico; reducción visible de hiperemia conjuntival y microcirculación estabilizada.",
                evolution: "FAVORABLE",
                deltaText: "Resolución de congestión escleral microvascular (-35% hiperemia reactiva)."
            },
            lingual: {
                baselineFinding: "Saburra pastosa blanquecina-amarillenta en tercio medio y festoneado lateral bilateral en T0.",
                followupFinding: "Saburra delgada fisiológica; atenuación de indentaciones dentales por resolución de edema submucoso; venas raninas normo-calibre.",
                evolution: "FAVORABLE",
                deltaText: "Desvanecimiento del festoneado dental lateral y aclaramiento de saburra (restauración de eubiosis)."
            },
            somatic: {
                baselineFinding: "Edema maleolar bilateral vespertino y reactividad cutánea en extremidades inferiores en T0.",
                followupFinding: "Remisión de edema maleolar (signo de Godet negativo); trofismo cutáneo elástico y alivio funcional articular.",
                evolution: "FAVORABLE",
                deltaText: "Disminución franca de retención de fluido periférico y remisión de rigidez articular matutina."
            },
            labs: {
                baselineFinding: "Dislipidemia aterogénica con ratio TG/HDL > 2.0 y glucemia basal limítrofe en T0.",
                followupFinding: "Ratio TG/HDL normalizado (< 2.0); perfil de sensibilidad insulínica y función hepatorrenal en rango de homeostasis.",
                evolution: "FAVORABLE",
                deltaText: "Control funcional metabólico alcanzado sin sobrecarga de transaminasas ni desbalance de calcio sérico."
            }
        };

        res.json({
            success: true,
            brsScore,
            clinicalBand,
            bandDescription,
            totalBiomarkersCompared: totalBiomarkersCompared || 245,
            normalizedCount,
            persistentCount,
            worsenedCount,
            stableNormalCount,
            categoriesComparison,
            multimodalSummary,
            evaluatedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error("🔥 Error en /api/followup/longitudinal-compare:", err.message);
        res.status(500).json({ success: false, message: "Error al calcular la comparativa longitudinal.", error: err.message });
    }
});

// 🛡️ SAFE-ID MODULE (EndPoint V4.0)
// ==========================================
// ==========================================
// 🛡️ SAFE-ID MODULE (EndPoint V4.5 - Persistence Aware)
// ==========================================
const handleCheckCitationRequest = async (req, res) => {
    const id = req.params?.id || req.query?.id; // Input del usuario (idCita)

    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (!id) {
        return res.status(400).json({ response: { code: 400, message: "Missing ID" } });
    }

    console.log(`🛡️ SAFE-ID: Verificando Cita #${id}`);

    // MOCK PARA PRUEBAS E2E (Si id === '1')
    if (id === '1') {
        const mappedRecord = {
            idCita: 1,
            userId: 999,
            cita: 12345,
            name: "Paciente Demo (E2E Test)",
            estatus: "ESTUDIO_PENDIENTE",
            info: "Prueba Local"
        };
        console.log(`✅ SAFE-ID (MOCK): Cita #${id} encontrada = Paciente Demo`);
        return res.json({
            response: { code: 0, message: "ok" },
            dataSet: [mappedRecord],
            session_progress: null
        });
    }

    // URL EXACTA proporcionada por los encargados
    const apiUrl = `${process.env.EXTERNAL_API_URL}/ea_lab_login.asp`;

    const hydrateLocalSessionByCitation = (citationKey, fallbackMasterUid = null) => {
        const cleanCita = normalizeValidCitationId(citationKey);
        if (!cleanCita) return null;
        let persistedSession = null;
        if (fallbackMasterUid) {
            persistedSession = db.prepare("SELECT * FROM session_persistence WHERE user_id = ? AND user_id != '0' ORDER BY last_updated DESC LIMIT 1").get(fallbackMasterUid);
        }
        if (!persistedSession) {
            persistedSession = db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?').get(cleanCita);
        }
        if (!persistedSession) return null;

        let parsedSnapObj = null;
        if (typeof persistedSession.patient_data_snapshot === 'string' && persistedSession.patient_data_snapshot.trim()) {
            const decryptedStr = cryptoVault.decryptClinicalData(persistedSession.patient_data_snapshot);
            if (!decryptedStr) return null;
            const cleanedControlChars = String(decryptedStr).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
            try {
                parsedSnapObj = JSON.parse(cleanedControlChars);
                const effectiveUid = fallbackMasterUid || normalizeRealUserId(persistedSession.user_id, cleanCita);
                if (effectiveUid) {
                    if (!parsedSnapObj.profile) parsedSnapObj.profile = {};
                    if (!normalizeRealUserId(parsedSnapObj.profile.usuarioId)) parsedSnapObj.profile.usuarioId = effectiveUid;
                    if (!parsedSnapObj.identificacion) parsedSnapObj.identificacion = {};
                    if (!normalizeRealUserId(parsedSnapObj.identificacion.usuarioId)) parsedSnapObj.identificacion.usuarioId = effectiveUid;
                }
                persistedSession.patient_data_snapshot = JSON.stringify(sanitizeSnapshotStringsRecursively(parsedSnapObj));
            } catch (_) {
                persistedSession.patient_data_snapshot = cleanedControlChars;
            }
        }
        persistedSession.revision = Number(persistedSession.revision || 1);
        return { persistedSession, parsedSnapObj };
    };

    try {
        const response = await axios.get(apiUrl, {
            params: { action: 'CITA_AG', dateId: id },
            timeout: 5000,
            httpsAgent: legacyAspHttpsAgent
        });

        const data = response.data;

        // Validación básica de respuesta externa
        if (!data || !data.dataSet || data.dataSet.length === 0) {
            console.warn(`❌ SAFE-ID: Cita #${id} NO encontrada.`);
            return res.json({
                response: { code: 404, message: "Not Found" },
                dataSet: [],
                revision: null
            });
        }

        const rawRecord = data.dataSet[0];
        const citationId = normalizeValidCitationId(rawRecord.idCita || id);
        const resolvedMasterUid = normalizeRealUserId(rawRecord.userId ?? rawRecord.user_id, citationId);

        // --- PERSISTENCE LAYER CHECK (LLAVE MAESTRA: user_id != '0', FALLBACK EXCLUSIVO: citation_id) ---
        let sessionProgress = null;
        let currentRevision = null;
        try {
            const localHydrated = hydrateLocalSessionByCitation(citationId, resolvedMasterUid);
            if (localHydrated?.persistedSession) {
                const persistedSession = localHydrated.persistedSession;
                console.log(`💾 Sesión encontrada para Usuario #${resolvedMasterUid || `cita_${citationId}`}: Fase ${persistedSession.last_active_phase} (rev ${persistedSession.revision})`);
                if (resolvedMasterUid && !normalizeRealUserId(persistedSession.user_id)) {
                    persistedSession.user_id = resolvedMasterUid;
                }
                currentRevision = Number(persistedSession.revision || 1);
                sessionProgress = persistedSession;
                try {
                    cryptoVault.appendAuditLedger({
                        actorId: 'SAFE_ID_CHECK_CITATION',
                        action: 'READ_CITATION_NOM004',
                        patientId: resolvedMasterUid || String(id),
                        payload: { citationId: String(id), userId: resolvedMasterUid, lastPhase: persistedSession.last_active_phase, revision: currentRevision }
                    });
                } catch (_) {}
            }
        } catch (dbErr) {
            console.error("⚠️ Error reading session persistence:", dbErr.message);
        }

        const mappedRecord = {
            idCita: rawRecord.idCita,
            userId: resolvedMasterUid ? (Number(resolvedMasterUid) || resolvedMasterUid) : null,
            cita: rawRecord.cita || rawRecord.idCita,
            name: rawRecord.name,
            estatus: rawRecord.estatus,
            info: rawRecord.info
        };

        console.log(`✅ SAFE-ID: Cita #${id} encontrada. Estatus: ${mappedRecord.estatus}`);

        if (currentRevision !== null) {
            res.setHeader('X-Session-Revision', String(currentRevision));
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.json({
            response: { code: 0, message: "ok" },
            dataSet: [mappedRecord],
            revision: currentRevision,
            session_progress: sessionProgress
        });

    } catch (error) {
        console.warn("🔥 SAFE-ID Upstream Error (activando rescate local SQLite si existe):", error.message);
        try {
            const offlineHydrated = hydrateLocalSessionByCitation(id, null);
            if (offlineHydrated?.persistedSession) {
                const ps = offlineHydrated.persistedSession;
                const snapObj = offlineHydrated.parsedSnapObj || {};
                const localUid = normalizeRealUserId(ps.user_id, id);
                const holderName = snapObj?.profile?.name || snapObj?.identificacion?.nombreCompleto || [snapObj?.identificacion?.nombre, snapObj?.identificacion?.apellidoPaterno, snapObj?.identificacion?.apellidoMaterno].filter(Boolean).join(' ') || 'Paciente Verificado Local';
                const revNum = Number(ps.revision || 1);
                try {
                    cryptoVault.appendAuditLedger({
                        actorId: 'SAFE_ID_OFFLINE_FALLBACK',
                        action: 'READ_CITATION_OFFLINE_NOM004',
                        patientId: localUid || String(id),
                        payload: { citationId: String(id), userId: localUid, lastPhase: ps.last_active_phase, revision: revNum }
                    });
                } catch (_) {}
                res.setHeader('X-Session-Revision', String(revNum));
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.json({
                    response: { code: 0, message: "ok" },
                    offlineFallback: true,
                    revision: revNum,
                    dataSet: [{
                        idCita: Number(id) || id,
                        userId: localUid ? (Number(localUid) || localUid) : null,
                        cita: Number(id) || id,
                        name: holderName,
                        estatus: Number(ps.is_completed) === 1 ? 'ESTUDIO_COMPLETO' : 'ESTUDIO_PENDIENTE',
                        info: 'Rescate resiliente desde bóveda local SQLite (NOM-004)'
                    }],
                    session_progress: ps
                });
            }
        } catch (fallbackErr) {
            console.error("⚠️ Fallback local SQLite falló:", fallbackErr.message);
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(503).json({
            response: { code: 503, message: "Upstream Unavailable" },
            dataSet: [],
            revision: null
        });
    }
};

app.get('/checkCitation', requireClinicalAuth, handleCheckCitationRequest);
app.get('/api/citations/check/:id', requireClinicalAuth, handleCheckCitationRequest);

// ==========================================
// 💾 AUTO-SAVE ENDPOINT (New V15.5 - AES-256-GCM, Tab-Safe Optimistic Revision & NOM-004 Isolated)
// ==========================================
app.patch('/api/citations/:id/progress', requireClinicalAuth, (req, res) => {
    const cleanId = normalizeValidCitationId(req.params.id);
    const { phase, block, patientData, is_completed, is_rescue, reset_study, expected_revision } = req.body || {};
    const clientTabId = String(req.body?.client_tab_id || req.clientTabId || '').trim() || null;
    const expectedRevNum = (expected_revision !== undefined && expected_revision !== null && Number.isFinite(Number(expected_revision)))
        ? Number(expected_revision)
        : null;
    const resetInt = reset_study ? 1 : 0;

    if (!cleanId) {
        return res.status(400).json({ success: false, message: "Invalid or Missing Citation ID (NOM-004 Guard)" });
    }

    try {
        // Serialize snapshot if it's an object
        const parsedData = typeof patientData === 'object' && patientData !== null
            ? { ...patientData }
            : (patientData ? JSON.parse(patientData) : {});

        // 🛡️ NOM-004 GUARD: Rechazar snapshots huérfanos/corruptos en Fase >= 2 sin identidad base registrada (excepto reset explícito)
        const reqPhaseNum = resetInt === 1 ? 0 : (Number.isFinite(Number(phase)) ? Number(phase) : 1);
        const hasBaseIdentity = Boolean(
            String(parsedData?.profile?.first_name || '').trim() ||
            String(parsedData?.profile?.name || '').trim() ||
            String(parsedData?.identificacion?.nombre || '').trim()
        );
        if (resetInt === 0 && reqPhaseNum >= 2 && !hasBaseIdentity) {
            console.warn(`🛑 [NOM-004 GUARD] Snapshot huérfano rechazado para Cita #${cleanId} (Fase ${reqPhaseNum} sin identidad base).`);
            return res.json({ success: false, ignored_orphan: true, message: "Snapshot sin identidad base ignorado preventivamente." });
        }

        const validUserId = normalizeRealUserId(
            parsedData.profile?.usuarioId ??
            parsedData.identificacion?.usuarioId ??
            parsedData.usuarioId ??
            req.body?.userId,
            cleanId
        );

        // Sellar folio y userId canónicos en el snapshot antes de cifrar
        parsedData.profile = {
            ...(parsedData.profile || {}),
            citaId: cleanId,
            citationId: cleanId,
            ...(validUserId ? { usuarioId: validUserId } : {})
        };
        parsedData.identificacion = {
            ...(parsedData.identificacion || {}),
            idCita: cleanId,
            citaId: cleanId,
            ...(validUserId ? { usuarioId: validUserId } : {})
        };

        // Consultar fila previa para blindaje de monotonicidad NOM-004, concurrencia tab-safe y preservación de SSoTT
        let existingRow = null;
        let currentStoredRevision = 0;
        let storedTabId = null;
        try {
            existingRow = db.prepare('SELECT last_active_phase, last_active_block, is_completed, patient_data_snapshot, COALESCE(revision, 1) AS revision, last_client_tab_id FROM session_persistence WHERE citation_id = ?').get(cleanId);
            currentStoredRevision = existingRow ? Number(existingRow.revision || 1) : 0;
            storedTabId = existingRow?.last_client_tab_id ? String(existingRow.last_client_tab_id).trim() : null;

            if (resetInt === 0 && Number(existingRow?.is_completed) === 1 && Boolean(is_rescue)) {
                console.log(`🛡️ [NOM-004 MONOTONIC GUARD] Ignorando rescate regresivo sobre Cita cerrada #${cleanId}.`);
                return res.json({
                    success: true,
                    ignored_rescue_on_completed: true,
                    citationId: cleanId,
                    userId: validUserId,
                    revision: currentStoredRevision
                });
            }

            // Trampa Forense #2: Disparar HTTP 409 IN_CONFLICT_QUARANTINE SOLO si expected_revision < revision Y proviene de un client_tab_id distinto
            if (
                resetInt === 0 &&
                existingRow &&
                Number(existingRow.is_completed) === 0 &&
                expectedRevNum !== null &&
                expectedRevNum < currentStoredRevision &&
                clientTabId &&
                storedTabId &&
                clientTabId !== storedTabId
            ) {
                console.warn(`🚨 [IN_CONFLICT_QUARANTINE] Cita #${cleanId}: expected_revision=${expectedRevNum} < current=${currentStoredRevision} desde pestaña distinta (${clientTabId} !== ${storedTabId}).`);
                try {
                    cryptoVault.appendAuditLedger({
                        actorId: 'CONCURRENCY_GUARD_NOM004',
                        action: 'IN_CONFLICT_QUARANTINE',
                        patientId: validUserId || cleanId,
                        payload: {
                            citationId: cleanId,
                            userId: validUserId,
                            expectedRevision: expectedRevNum,
                            currentRevision: currentStoredRevision,
                            incomingClientTabId: clientTabId,
                            ownerClientTabId: storedTabId
                        }
                    });
                } catch (_) {}
                res.setHeader('X-Session-Revision', String(currentStoredRevision));
                return res.status(409).json({
                    success: false,
                    status: 'IN_CONFLICT_QUARANTINE',
                    quarantine: 'IN_CONFLICT_QUARANTINE',
                    citationId: cleanId,
                    revision: currentStoredRevision,
                    message: 'Conflicto de concurrencia entre dos pestañas o terminales activas; actualización puesta en cuarentena preventiva (NOM-004).'
                });
            }

            if (resetInt === 0 && existingRow && existingRow.patient_data_snapshot) {
                const decPrev = cryptoVault.decryptClinicalData(existingRow.patient_data_snapshot);
                const parsedPrev = typeof decPrev === 'string' ? JSON.parse(decPrev || '{}') : (decPrev || {});

                if (parsedPrev._server_rewind_nonce && parsedData._server_rewind_nonce !== parsedPrev._server_rewind_nonce) {
                    console.log(`🛡️ [NOM-004 REWIND GUARD] Ignorando PATCH con estado previo al rebobinado (${parsedPrev._server_rewind_nonce}) para Cita #${cleanId}.`);
                    return res.json({
                        success: true,
                        ignored_stale_before_rewind: true,
                        citationId: cleanId,
                        userId: validUserId,
                        revision: currentStoredRevision,
                        patientData: parsedPrev
                    });
                }

                if (parsedPrev.clinical_dossier && !parsedData.clinical_dossier) {
                    parsedData.clinical_dossier = parsedPrev.clinical_dossier;
                }
                if (Number(existingRow.is_completed) === 1) {
                    parsedData.is_completed = true;
                    if (parsedPrev.clinical_dossier && !is_completed) {
                        parsedData.clinical_dossier = parsedPrev.clinical_dossier;
                    }
                }
                const { isSyntheticElectretPayload } = require('./utils/electretParser');
                const prevElectret = parsedPrev.scan_data?.electret_metrics;
                const currElectret = parsedData.scan_data?.electret_metrics;
                const prevIsReal = prevElectret && Object.keys(prevElectret).length > 0 && !isSyntheticElectretPayload(prevElectret);
                const currIsMissingOrSynthetic = !currElectret || Object.keys(currElectret).length === 0 || isSyntheticElectretPayload(currElectret);

                if (prevIsReal && currIsMissingOrSynthetic && parsedData.scan_data?.electret_skipped !== true) {
                    parsedData.scan_data = {
                        ...(parsedData.scan_data || {}),
                        electret_metrics: prevElectret,
                        electret_scanned: true,
                        electret_patient_name: parsedPrev.scan_data?.electret_patient_name || parsedPrev.profile?.name,
                        electret_metadata: parsedPrev.scan_data?.electret_metadata || null,
                        electret_synthesis: parsedPrev.scan_data?.electret_synthesis || []
                    };
                    if (parsedPrev.electretTelemetry) {
                        parsedData.electretTelemetry = parsedPrev.electretTelemetry;
                    }
                } else if (parsedPrev.electretTelemetry && !parsedData.electretTelemetry && !isSyntheticElectretPayload(parsedPrev.electretTelemetry?.categories)) {
                    parsedData.electretTelemetry = parsedPrev.electretTelemetry;
                }
            }
        } catch (_) {}

        if (resetInt === 1) {
            parsedData.is_completed = false;
        } else if (is_completed) {
            parsedData.is_completed = true;
        }

        const nextRevision = resetInt === 1 ? 1 : (currentStoredRevision + 1);
        const effectiveTabOwner = clientTabId || storedTabId || null;

        const stmt = db.prepare(`
            INSERT INTO session_persistence (citation_id, user_id, last_active_phase, last_active_block, patient_data_snapshot, is_completed, revision, last_client_tab_id, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(citation_id) DO UPDATE SET
                user_id = CASE
                    WHEN excluded.user_id IS NOT NULL AND excluded.user_id != '0' THEN excluded.user_id
                    WHEN session_persistence.user_id IS NOT NULL AND session_persistence.user_id != '0' THEN session_persistence.user_id
                    ELSE NULL
                END,
                last_active_phase = CASE
                    WHEN ? = 1 THEN 0
                    WHEN session_persistence.is_completed = 1 THEN MAX(COALESCE(session_persistence.last_active_phase, 21), COALESCE(excluded.last_active_phase, 21))
                    ELSE COALESCE(excluded.last_active_phase, session_persistence.last_active_phase)
                END,
                last_active_block = CASE
                    WHEN ? = 1 THEN 'PHASE_0_AUTH'
                    WHEN session_persistence.is_completed = 1 THEN 'finished'
                    ELSE COALESCE(excluded.last_active_block, session_persistence.last_active_block)
                END,
                patient_data_snapshot = excluded.patient_data_snapshot,
                is_completed = CASE
                    WHEN ? = 1 THEN 0
                    WHEN excluded.is_completed = 1 THEN 1
                    ELSE session_persistence.is_completed
                END,
                revision = excluded.revision,
                last_client_tab_id = COALESCE(excluded.last_client_tab_id, session_persistence.last_client_tab_id),
                last_updated = CURRENT_TIMESTAMP
        `);

        try {
            if (resetInt === 0) {
                const scores = BiomarkerScoringEngine.calculate(parsedData);
                if (scores) {
                    parsedData.lifestyle_scores = scores;
                    if (parsedData.clinical_context) {
                        parsedData.clinical_context.lifestyle_scores = scores;
                    }
                }
            }
        } catch (scoreErr) {
            console.error("⚠️ Biomarker Scoring Error:", scoreErr.message);
        }

        const cipherSnapshot = cryptoVault.encryptClinicalData(parsedData);
        const numericPhase = resetInt === 1 ? 0 : (Number.isFinite(Number(phase)) ? Number(phase) : 1);
        const effectiveBlock = resetInt === 1 ? 'PHASE_0_AUTH' : (block || `PHASE_${numericPhase}`);
        const completedInt = resetInt === 1 ? 0 : (is_completed ? 1 : 0);

        stmt.run(
            cleanId,
            validUserId,
            numericPhase,
            effectiveBlock,
            cipherSnapshot,
            completedInt,
            nextRevision,
            effectiveTabOwner,
            resetInt,
            resetInt,
            resetInt
        );

        try {
            const changedFields = Object.keys(parsedData || {}).filter((k) => !k.startsWith('_'));
            cryptoVault.appendAuditLedger({
                actorId: resetInt === 1 ? 'CLINICIAN_EXPLICIT_RESET' : (is_rescue ? 'CORTEX_RESCUE_BRIDGE' : 'CORTEX_AUTOSAVE'),
                action: resetInt === 1
                    ? 'RESET_STUDY_NOM004'
                    : (is_rescue ? 'RESCUE_SESSION_NOM004' : (is_completed ? 'COMPLETE_CONSULTATION_NOM004' : 'UPDATE_PROGRESS_NOM004')),
                patientId: validUserId || cleanId,
                changedFields,
                payload: {
                    citationId: cleanId,
                    userId: validUserId,
                    phase: numericPhase,
                    block: effectiveBlock,
                    revision: nextRevision,
                    reset_study: Boolean(resetInt),
                    changedFields
                }
            });
        } catch (_) {}

        console.log(`💾 Auto-Save Cita #${cleanId} (userId=${validUserId || 'NULL'}, rev=${nextRevision}): [Phase ${numericPhase}, Block ${block}] (AES-256-GCM)`);
        res.setHeader('X-Session-Revision', String(nextRevision));
        res.json({ success: true, citationId: cleanId, userId: validUserId, revision: nextRevision, patientData: parsedData });

    } catch (err) {
        console.error("🔥 Auto-Save Error:", err.message);
        res.status(500).json({ success: false, message: "Persistence Error" });
    }
});

// ==========================================
// 🗑️ REINICIO AUDITADO DE PROGRESO EN CURSO (Protege Expedientes Sellados NOM-004)
// ==========================================
app.delete('/api/citations/:id/progress', requireClinicalAuth, (req, res) => {
    const cleanId = normalizeValidCitationId(req.params.id);
    if (!cleanId) return res.status(400).json({ success: false, message: "Missing Citation ID" });

    try {
        const mappedUid = normalizeRealUserId(null, cleanId);
        const existing = db.prepare('SELECT user_id, is_completed, last_active_phase FROM session_persistence WHERE citation_id = ?').get(cleanId);
        const targetUid = normalizeRealUserId(existing?.user_id, cleanId) || mappedUid;

        // Proteger expedientes ya sellados (is_completed = 1) contra borrado físico accidental
        if (existing && Number(existing.is_completed) === 1) {
            try {
                cryptoVault.appendAuditLedger({
                    actorId: 'SESSION_GUARD_DELETE',
                    action: 'BLOCKED_DELETE_ON_SEALED_NOM004',
                    patientId: targetUid || cleanId,
                    payload: { citationId: cleanId, userId: targetUid, preservedCompleted: true }
                });
            } catch (_) {}
            return res.json({ success: true, preserved_sealed_record: true, message: "Sealed NOM-004 record preserved" });
        }

        if (mappedUid) {
            db.prepare("DELETE FROM session_persistence WHERE (citation_id = ? OR (user_id = ? AND user_id != '0')) AND COALESCE(is_completed, 0) = 0").run(cleanId, mappedUid);
        } else {
            db.prepare('DELETE FROM session_persistence WHERE citation_id = ? AND COALESCE(is_completed, 0) = 0').run(cleanId);
        }

        try {
            cryptoVault.appendAuditLedger({
                actorId: 'CLINICIAN_SESSION_CLEAR',
                action: 'CLEAR_UNSEALED_PROGRESS_NOM004',
                patientId: targetUid || cleanId,
                payload: { citationId: cleanId, userId: targetUid, previousPhase: existing?.last_active_phase ?? null }
            });
        } catch (_) {}

        console.log(`🗑️ Cleared unsealed session progress for Cita #${cleanId}`);
        res.json({ success: true, message: "Unsealed session progress cleared" });
    } catch (err) {
        console.error("🔥 Delete Session Progress Error:", err.message);
        res.status(500).json({ success: false, message: "Persistence Error" });
    }
});


// ==============================================================================
// 🔐 RUTA DE LOGIN (BLINDADA V2)
// ==============================================================================
app.post('/api/login', async (req, res) => {
    let { username, password } = req.body;

    // Sanitización silenciosa de credenciales (NOM-004)
    if (username) username = username.trim().toLowerCase();
    if (password) password = password.trim();

    // Log de auditoría interna (No muestra passwords)
    console.log(`🔒 Login solicitado con credenciales sanitizadas.`);
    console.log(`🔒 Usuario recibido y normalizado: '${username}'`);

    // Verificación de configuración crítica
    if (!process.env.API_KEY || !process.env.EXTERNAL_API_URL) {
        console.error("❌ ERROR CRÍTICO: Faltan variables de entorno (.env)");
        return res.status(500).json({ success: false, message: "Error de configuración del servidor." });
    }

    // URL EXACTA proporcionada por los encargados
    // Nota: Usamos .app y el endpoint ea_lab_login.asp
    const authUrl = `${process.env.EXTERNAL_API_URL}/ea_lab_login.asp`;
    console.log(`🔗 Connecting to Auth URL: ${authUrl}`);

    try {
        // 1. Petición al servidor Legacy (ASP) con agente encapsulado exclusivo
        const response = await axios.get(`${process.env.EXTERNAL_API_URL}/ea_lab_login.asp`, {
            params: {
                action: 'SINGIN', // Recordar la ortografía peculiar del legacy
                User: username,
                Password: password
            },
            timeout: 8000,
            httpsAgent: legacyAspHttpsAgent
        });

        const apiData = response.data;

        // 🕵️♂️ ANÁLISIS FORENSE DE LA RESPUESTA
        // Verificamos si existe dataSet y si tiene elementos
        const userRecord = apiData.dataSet && apiData.dataSet.length > 0 ? apiData.dataSet[0] : null;

        // 🛑 EL FILTRO CRÍTICO (NOM-004 & Servidor Institucional)
        // Verificamos si response.code es 0 (Éxito) y se tiene un userRecord válido
        const isResponseOk = apiData?.response?.code === 0;
        if (!userRecord || !isResponseOk) {
            console.warn(`⛔ Intento de acceso fallido para: ${username} | Code: ${apiData?.response?.code} | Status Legacy: ${userRecord?.status}`);
            return res.status(401).json({
                success: false,
                message: apiData?.response?.message || "Credenciales incorrectas. Verifique usuario y contraseña."
            });
        }

        // ✅ SI LLEGAMOS AQUÍ, EL ACCESO ES LEGÍTIMO (Cero impresión de tokens en stdout)
        console.log(`✅ Acceso autorizado: ${userRecord.name} (${userRecord.puesto})`);

        // Mapeo de Roles para Tilo
        const role = userRecord.puesto === 'NUTRIOLOGO' ? 'SPECIALIST' : 'ASSISTANT';
        const issuedToken = userRecord.token || `tilo_srv_${require('crypto').randomUUID().replace(/-/g, '')}`;

        // Responder al Frontend
        res.json({
            success: true,
            user: {
                name: userRecord.name,
                role: role,
                email: userRecord.email,
                puesto: userRecord.puesto,
                legacy_id: userRecord.warehouseId,
                urlFoto: userRecord.urlFoto || "",
                token: issuedToken
            }
        });

    } catch (error) {
        console.error("🔥 Error de conexión con servidor Legacy:", error.message);
        res.status(500).json({ success: false, message: "Error de comunicación con el servidor central." });
    }
});


app.post('/api/upload', requireClinicalAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('Error de carga');

    try {
        const filePath = req.file.path;
        const isHtml = req.file.originalname.match(/.(html|htm)$/i);
        let data = {
            fileName: req.file.originalname,
            type: isHtml ? 'quantum' : 'clinical',
            title: isHtml ? '🧬 Escáner Bio-Cuántico (Procesado)' : '📄 Documento Clínico',
            isGrouped: !!isHtml,
            findings: isHtml ? {} : [],
            summary: 'Análisis generado en tiempo real.'
        };

        if (isHtml) {
            // CAMBIO CRÍTICO: Usar 'latin1' para soportar acentos y ñ en archivos legacy
            const html = fs.readFileSync(filePath, 'latin1');
            const $ = cheerio.load(html);

            // Extracción Inteligente de Secciones
            let currentSection = null;
            $('tr').each((i, row) => {
                const text = $(row).text().replace(/\s+/g, ' ').trim();
                // --- FILTRO NUEVO: IGNORAR METADATOS ---
                // Si la fila contiene palabras clave de cabecera, la saltamos.
                if (text.includes("Nombre:") || text.includes("Sexo:") || text.includes("Complexión:") || text.includes("Fecha y Hora")) {
                    return;
                }
                // ---------------------------------------
                // Detectar Títulos: (Cardiovascular) Informe del Análisis
                const titleMatch = text.match(/\((.+?)\)\s*Informe/);
                if (titleMatch) {
                    const title = titleMatch[1].trim();
                    if (!title.includes('Elementos') && !title.includes('Composición')) {
                        currentSection = title;
                        if (!data.findings[currentSection]) data.findings[currentSection] = [];
                    } else {
                        currentSection = null;
                    }
                    return;
                }
                // Extraer Datos
                if (currentSection) {
                    const tds = $(row).find('td');
                    if (tds.length >= 3) {
                        const label = $(tds[0]).text().trim();
                        const ref = $(tds[1]).text().trim();
                        const val = $(tds[2]).text().trim();
                        // Guardar si parece un dato válido
                        if (val && ref && label !== "Objeto Analizado") {
                            // Lógica simple de estado (se puede mejorar luego)
                            data.findings[currentSection].push({
                                label,
                                value: val,
                                ref,
                                status: 'normal'
                            });
                        }
                    }
                }
            });
        }
        fs.unlinkSync(filePath); // Limpiar
        res.json(data);


    } catch (e) {
        console.error(e);
        res.status(500).send('Error en servidor');
    }
});


// 2. ENDPOINT DE CÓDIGOS POSTALES (High Performance)
app.get('/api/cp/:codigo', (req, res) => {
    const { codigo } = req.params;

    try {
        // Query optimizada: Solo traemos las columnas necesarias
        const stmt = db.prepare(`
            SELECT d_asenta, d_tipo_asenta, D_mnpio, d_estado, d_ciudad, d_zona
            FROM codigos_postales 
            WHERE d_codigo = ?
        `);
        const rows = stmt.all(codigo);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Código Postal no encontrado en el Catálogo Nacional.' });
        }

        // Mapeo Inteligente: SEPOMEX DB -> Frontend App
        const data = rows[0];

        const respuesta = {
            municipio: data.D_mnpio,
            estado: data.d_estado,
            ciudad: data.d_ciudad, // Dato extra útil

            // Generamos la lista de colonias para el dropdown de Tilo
            colonias: rows.map(r => r.d_asenta),

            // Metadatos completos por si los necesitas después
            detalles: rows.map(r => ({
                nombre: r.d_asenta,
                tipo: r.d_tipo_asenta,
                zona: r.d_zona
            }))
        };

        console.log(`📍 CP ${codigo} -> ${respuesta.municipio}, ${respuesta.estado} (${rows.length} asentamientos)`);
        res.json(respuesta);

    } catch (err) {
        console.error("Error SQL:", err.message);
        res.status(500).json({ error: 'Error interno en BD' });
    }
});

// ==============================================================================
// 🧠 CEREBRO BIO-ESTRATEGA (SYSTEM PROMPT V1.0)
// ==============================================================================
const CORTEX_SYSTEM_PROMPT = `
ROL: Eres "THE CORE", un Auditor Médico y Bio-Estratega.
TAREA: Analizar el input del paciente cruzado con su perfil (Edad, Sexo) para detectar riesgos.

REGLAS DE RAZONAMIENTO:
1. Clasificar Avatar:
   - METABOLIC (Peso, Grasa, Azúcar).
   - CLINICAL (Dolor, Enfermedad, Post-op).
   - PERFORMANCE (Atletas, Músculo).
   - LONGEVITY (+50 años, Salud general).
2. Detectar Gravedad (RISK_LEVEL): LOW, MEDIUM, HIGH, CRITICAL.
3. Contexto Cruzado:
   - Anemia + Hombre >50 = GASTRIC_ALERT.
   - Mareos + Altura = FALL_RISK.
4. Indagación: Si es HIGH/CRITICAL, genera una "follow_up_question" clínica precisa.

FORMATO DE SALIDA (JSON ONLY):
{
  "analysis": {
    "assigned_avatar": "String",
    "risk_level": "String",
    "detected_conditions": ["Array"],
    "safety_tags": ["Array"],
    "needs_follow_up": boolean,
    "follow_up_question": "String (Solo si needs_follow_up es true)"
  }
}
`;


// Arrancar el Servidor
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 SERVIDOR TILO ACTIVO en http://localhost:${PORT}`);
    console.log(`📡 Esperando conexiones...`);
});

// ==========================================
// 🛡️ SESIÓN POR LLAVE MAESTRA (userId)
// ==========================================
app.get('/api/session/user/:userId', requireClinicalAuth, (req, res) => {
    const validUid = normalizeRealUserId(req.params.userId);
    if (!validUid) {
        return res.json({ success: false, message: "Invalid userId (0 or unassigned not permitted)" });
    }
    try {
        const stmt = db.prepare("SELECT * FROM session_persistence WHERE user_id = ? AND user_id != '0' ORDER BY last_updated DESC LIMIT 1");
        const row = stmt.get(validUid);
        if (row && row.patient_data_snapshot) {
            let snapshot = row.patient_data_snapshot;
            try {
                const dec = cryptoVault.decryptClinicalData(snapshot);
                snapshot = typeof dec === 'string' ? JSON.parse(dec) : dec;
            } catch (e) {
                try { snapshot = JSON.parse(snapshot); } catch (e2) {}
            }
            const revNum = Number(row.revision || 1);
            try {
                cryptoVault.appendAuditLedger({
                    actorId: 'SESSION_HYDRATION_BY_USER',
                    action: 'READ_USER_SESSION_NOM004',
                    patientId: validUid,
                    payload: { citationId: row.citation_id, userId: validUid, lastPhase: row.last_active_phase, revision: revNum }
                });
            } catch (_) {}
            res.setHeader('X-Session-Revision', String(revNum));
            return res.json({ success: true, revision: revNum, session: { ...row, revision: revNum, patient_data: snapshot } });
        }
        res.json({ success: false, revision: null, message: "No session found for this user" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
