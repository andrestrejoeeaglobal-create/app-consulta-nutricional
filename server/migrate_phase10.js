const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log("Iniciando migración V10 (Hábitos y Estilo de Vida)...");

try {
    const columnsToAdd = [
        { name: 'habits', type: 'TEXT' }, // Stores JSON: smoking, alcohol, recreational_drugs
        { name: 'safety', type: 'TEXT' }, // Stores JSON: medicines, interaction_flags
        { name: 'lifestyle_profile', type: 'TEXT' } // Stores JSON: exercise, neat, sleep, stress
    ];

    let changesCount = 0;

    columnsToAdd.forEach(col => {
        try {
            db.exec(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type}`);
            console.log(`✅ Columna ${col.name} agregada exitosamente.`);
            changesCount++;
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log(`ℹ️ La columna ${col.name} ya existe. Saltando...`);
            } else {
                console.error(`❌ Error al agregar ${col.name}:`, err.message);
            }
        }
    });

    console.log(`✅ Migración completada. Nuevas columnas: ${changesCount}`);
} catch (error) {
    console.error("🔥 Falla Crítica:", error.message);
} finally {
    db.close();
}
