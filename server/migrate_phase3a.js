const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { verbose: console.log });

function migrate() {
    console.log("🚀 Starting Phase 3A Migration (Cortex Triage)...");

    const columnsToAdd = [
        { name: 'triage_motive', type: 'TEXT' },
        { name: 'triage_risk_level', type: 'TEXT' },
        { name: 'triage_avatar', type: 'TEXT' },
        { name: 'triage_ai_tags', type: 'TEXT' }, // Stores JSON array
        { name: 'triage_secondary_symptoms', type: 'TEXT' }
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

    console.log("✅ Phase 3A Migration Completed Successfully.");
}

try {
    migrate();
} catch (error) {
    console.error("❌ Migration Failed:", error);
}
