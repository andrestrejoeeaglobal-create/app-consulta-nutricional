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

/**
 * Cifra datos clínicos usando AES-256-GCM con Vector de Inicialización estándar NIST de 12 bytes (96 bits).
 * @param {string|Object} plainData Cadena o JSON a cifrar
 * @returns {string} iv:authTag:encrypted
 */
function encryptClinicalData(plainData) {
    if (!plainData) return "";
    const plainText = typeof plainData === 'string' ? plainData : JSON.stringify(plainData);
    
    // NIST SP 800-38D: 12 bytes (96 bits) es el estándar matemáticamente óptimo para AES-GCM
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
    
    // RETROCOMPATIBILIDAD OBLIGATORIA: Si inicia como JSON ({, [) o no contiene exactamente dos separadores ':'
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || !trimmed.includes(':')) {
        return trimmed;
    }

    const parts = trimmed.split(':');
    if (parts.length !== 3) {
        return trimmed;
    }

    try {
        const [ivHex, authTagHex, encryptedHex] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.warn("⚠️ Aviso de descifrado en cryptoVault: no se pudo descifrar (posible formato legado), retornando texto original:", e.message);
        return trimmed;
    }
}

/**
 * Registra un evento inmutable en el ledger SHA-256 Hash Chain bajo la NOM-004.
 * @param {Object} entry { actorId, action, patientId, payload }
 * @returns {Object} { prevHash, currentHash, timestamp }
 */
function appendAuditLedger({ actorId = 'SYSTEM_USER', action = 'RECORD_ACCESS', patientId = 'UNKNOWN', payload = {} }) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    const lastEntry = db.prepare('SELECT current_hash FROM audit_ledger ORDER BY id DESC LIMIT 1').get();
    const prevHash = lastEntry ? lastEntry.current_hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();

    const currentHash = crypto.createHash('sha256')
        .update(`${prevHash}:${timestamp}:${actorId}:${action}:${patientId}:${payloadHash}`)
        .digest('hex');

    const stmt = db.prepare(`
        INSERT INTO audit_ledger (timestamp, actor_id, action, patient_id, payload_hash, prev_hash, current_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(timestamp, actorId, action, String(patientId), payloadHash, prevHash, currentHash);

    return { prevHash, currentHash, timestamp };
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
