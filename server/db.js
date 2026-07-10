const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('database.sqlite', { verbose: console.log });
db.pragma('foreign_keys = ON');

// Asegurar que existe la tabla session_persistence para auto-save sin alterar codigos_postales
db.exec(`
    CREATE TABLE IF NOT EXISTS session_persistence (
        citation_id TEXT PRIMARY KEY,
        last_active_phase INTEGER,
        last_active_block TEXT,
        is_completed BOOLEAN DEFAULT 0,
        patient_data_snapshot TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

function initDb() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
    console.log("Database initialized with schema.");
}

module.exports = { db, initDb };
