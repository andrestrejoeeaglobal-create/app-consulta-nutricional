const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('database.sqlite', { verbose: console.log });
db.pragma('foreign_keys = ON');

function initDb() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
    console.log("Database initialized with schema.");
}

module.exports = { db, initDb };
