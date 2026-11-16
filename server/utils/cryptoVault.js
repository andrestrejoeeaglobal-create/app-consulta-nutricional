const crypto = require('crypto');
const { db } = require('../db');

// Clave simétrica de cifrado clínico de 32 bytes (256 bits)
const rawKey = process.env.CLINICAL_ENCRYPTION_KEY || '01234567890123456789012345678901';
const ENCRYPTION_KEY = Buffer.from(rawKey.padEnd(32, '0').slice(0, 32), 'utf8');

// Asegurar existencia de la tabla audit_ledger en SQLite para bitácora inmutable bajo NOM-004
db.exec(`
    CREATE TABLE IF NOT EXISTS audit_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        current_hash TEXT NOT NULL
    );
`);

// Migración aditiva NULL-safe (100% compatible con los 52+ bloques SHA-256 existentes)
try {
    const cols = db.prepare('PRAGMA table_info(audit_ledger)').all().map((c) => c.name);
    if (!cols.includes('log_id')) {
        db.exec('ALTER TABLE audit_ledger ADD COLUMN log_id TEXT DEFAULT NULL;');
    }
    if (!cols.includes('changed_fields')) {
        db.exec('ALTER TABLE audit_ledger ADD COLUMN changed_fields TEXT DEFAULT NULL;');
    }
} catch (migErr) {
    console.warn('⚠️ Aviso migración aditiva audit_ledger:', migErr.message);
}

// Candados SQLite estrictamente Append-Only (NOM-004 — Prohibido alterar o borrar eslabones)
db.exec(`
    CREATE TRIGGER IF NOT EXISTS audit_ledger_no_update
    BEFORE UPDATE ON audit_ledger
    BEGIN
        SELECT RAISE(ABORT, 'NOM-004: audit_ledger es estrictamente inmutable (UPDATE prohibido)');
    END;

    CREATE TRIGGER IF NOT EXISTS audit_ledger_no_delete
    BEFORE DELETE ON audit_ledger
    BEGIN
        SELECT RAISE(ABORT, 'NOM-004: audit_ledger es estrictamente inmutable (DELETE prohibido)');
    END;
`);

const HEX_IV_RE = /^[0-9a-f]{24}$/i;
const HEX_TAG_RE = /^[0-9a-f]{32}$/i;

/**
 * Cifra datos clínicos usando AES-256-GCM con Vector de Inicialización estándar NIST de 12 bytes (96 bits).
 * @param {string|Object} plainData Cadena o JSON a cifrar
 * @returns {string} iv:authTag:encrypted
 */
function encryptClinicalData(plainData) {
    if (!plainData) return "";
    const plainText = typeof plainData === 'string' ? plainData : JSON.stringify(plainData);

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descifra un registro clínico con retrocompatibilidad absoluta para JSON plano legado en SQLite.
 * @param {string} cipherText Cadena potencialmente cifrada
 * @returns {string} Cadena descifrada o texto plano original
 */
function decryptClinicalData(cipherText) {
    if (!cipherText || typeof cipherText !== 'string') return cipherText;
    const trimmed = cipherText.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[') || !trimmed.includes(':')) {
        return trimmed;
    }

    const parts = trimmed.split(':');
    if (parts.length !== 3) {
        return trimmed;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!HEX_IV_RE.test(ivHex) || !HEX_TAG_RE.test(authTagHex)) {
        return trimmed;
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const selectLastHashStmt = db.prepare('SELECT current_hash FROM audit_ledger ORDER BY id DESC LIMIT 1');
const insertAuditStmt = db.prepare(`
    INSERT INTO audit_ledger (timestamp, actor_id, action, patient_id, payload_hash, prev_hash, current_hash, log_id, changed_fields)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const appendLedgerTx = db.transaction(({ actorId, action, patientId, payloadStr, changedFieldsJson }) => {
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');
    const lastEntry = selectLastHashStmt.get();
    const prevHash = lastEntry ? lastEntry.current_hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();
    const logId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

    // FÓRMULA CANÓNICA INVARIANTE (Garantiza compatibilidad 100% con toda la cadena histórica existente)
    const currentHash = crypto.createHash('sha256')
        .update(`${prevHash}:${timestamp}:${actorId}:${action}:${patientId}:${payloadHash}`)
        .digest('hex');

    insertAuditStmt.run(
        timestamp,
        actorId,
        action,
        String(patientId),
        payloadHash,
        prevHash,
        currentHash,
        logId,
        changedFieldsJson
    );

    return { logId, prevHash, currentHash, timestamp };
});

/**
 * Registra un evento inmutable en el ledger SHA-256 Hash Chain bajo la NOM-004 en transacción IMMEDIATE.
 * @param {Object} entry { actorId, action, patientId, payload, changedFields }
 * @returns {Object} { logId, prevHash, currentHash, timestamp }
 */
function appendAuditLedger({
    actorId = 'SYSTEM_USER',
    action = 'RECORD_ACCESS',
    patientId = 'UNKNOWN',
    payload = {},
    changedFields = null
}) {
    const effectiveChanged = Array.isArray(changedFields)
        ? changedFields
        : (payload && typeof payload === 'object' && Array.isArray(payload.changedFields) ? payload.changedFields : null);
    const changedFieldsJson = effectiveChanged ? JSON.stringify(effectiveChanged) : null;
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});

    return appendLedgerTx.immediate({
        actorId,
        action,
        patientId: String(patientId),
        payloadStr,
        changedFieldsJson
    });
}

/**
 * Valida la integridad criptográfica de toda la cadena de custodia del expediente clínico.
 * @returns {Object} { valid: boolean, totalEntries: number, brokenAtId?: number, reason?: string }
 */
function verifyLedgerIntegrity() {
    const rows = db.prepare('SELECT * FROM audit_ledger ORDER BY id ASC').all();
    let expectedPrev = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const row of rows) {
        if (row.prev_hash !== expectedPrev) {
            return { valid: false, brokenAtId: row.id, reason: 'PREV_HASH_MISMATCH' };
        }
        const recalculation = crypto.createHash('sha256')
            .update(`${row.prev_hash}:${row.timestamp}:${row.actor_id}:${row.action}:${row.patient_id}:${row.payload_hash}`)
            .digest('hex');
        if (recalculation !== row.current_hash) {
            return { valid: false, brokenAtId: row.id, reason: 'CURRENT_HASH_CORRUPTED' };
        }
        expectedPrev = row.current_hash;
    }
    return { valid: true, totalEntries: rows.length };
}

module.exports = {
    encryptClinicalData,
    decryptClinicalData,
    appendAuditLedger,
    verifyLedgerIntegrity
};
