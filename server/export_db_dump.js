const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const backupsDir = path.join(__dirname, '..', 'backups_vault_nom004');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
let sqlDump = `-- DUMP OF EQUIPO EN ACCION - T.I.L.O. CLINICAL VAULT\n-- Generated: ${new Date().toISOString()}\n\n`;

for (const { name } of tables) {
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name);
    if (schema && schema.sql) {
        sqlDump += schema.sql + ';\n\n';
    }
    const rows = db.prepare(`SELECT * FROM ${name}`).all();
    for (const row of rows) {
        const keys = Object.keys(row);
        const vals = keys.map(k => {
            const v = row[k];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
        });
        sqlDump += `INSERT INTO ${name} (${keys.join(', ')}) VALUES (${vals.join(', ')});\n`;
    }
    sqlDump += '\n';
}

const targetPath = path.join(backupsDir, `database_dump_${Date.now()}.sql`);
fs.writeFileSync(targetPath, sqlDump);
console.log(`✅ SQL dump exported to vault successfully. Size: ${sqlDump.length} bytes`);
