const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const dbOptions = process.env.SQLITE_DEBUG_VERBOSE === 'true' ? { verbose: console.log } : {};
const db = new Database(dbPath, dbOptions);
db.pragma('foreign_keys = ON');

// Asegurar que existe la tabla session_persistence para auto-save con índice en user_id
db.exec(`
    CREATE TABLE IF NOT EXISTS session_persistence (
        citation_id TEXT PRIMARY KEY,
        user_id TEXT,
        last_active_phase INTEGER,
        last_active_block TEXT,
        is_completed BOOLEAN DEFAULT 0,
        patient_data_snapshot TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_session_persistence_user_id ON session_persistence(user_id);
`);

function initDb() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
    console.log("Database initialized with schema.");
}

module.exports = { db, initDb };
