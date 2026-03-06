const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { verbose: console.log });

function migrate() {
    console.log("🚀 Starting Phase 4 Migration (Family History V4.0)...");

    const columnsToAdd = [
        { name: 'history_data', type: 'TEXT' } // Stores JSON: { family_raw_text, family_checklist_verified, family_structured }
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

    console.log("✅ Phase 4 Migration Completed Successfully.");
}

try {
    migrate();
} catch (error) {
    console.error("❌ Migration Failed:", error);
}
