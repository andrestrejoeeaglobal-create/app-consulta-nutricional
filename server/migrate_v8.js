const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { verbose: console.log });

function migrate() {
    console.log("🚀 Starting V8.0 Migration...");

    const columnsToAdd = [
        { name: 'nationality_type', type: 'TEXT DEFAULT "MX"' },
        { name: 'curp', type: 'TEXT' },
        { name: 'passport_id', type: 'TEXT' },
        { name: 'civil_status', type: 'TEXT' },
        { name: 'religion_has', type: 'BOOLEAN' },
        { name: 'religion_name', type: 'TEXT' },
        { name: 'religion_diet_flags', type: 'TEXT' } // JSON stringified
    ];

    const currentColumns = db.prepare("PRAGMA table_info(patients)").all().map(c => c.name);

    db.transaction(() => {
        for (const col of columnsToAdd) {
            if (!currentColumns.includes(col.name)) {
                console.log(`Adding column: ${col.name}`);
                db.prepare(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type}`).run();
            } else {
                console.log(`Column ${col.name} already exists. Skipping.`);
            }
        }
    })();

    console.log("✅ V8.0 Migration Completed Successfully.");
}

try {
    migrate();
} catch (error) {
    console.error("❌ Migration Failed:", error);
}
