const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'database.sqlite'), { verbose: console.log });

function migrate() {
    console.log("🚀 Iniciando migración NEAT-005...");
    const currentColumns = db.prepare("PRAGMA table_info(patients)").all().map(c => c.name);
    
    db.transaction(() => {
        if (!currentColumns.includes('ocupacion_descriptor')) {
            console.log("Añadiendo columna ocupacion_descriptor a la tabla patients...");
            db.prepare("ALTER TABLE patients ADD COLUMN ocupacion_descriptor TEXT").run();
            console.log("✅ Columna ocupacion_descriptor añadida.");
        } else {
            console.log("La columna ocupacion_descriptor ya existe. Saltando.");
        }
        
        if (!currentColumns.includes('factor_pal')) {
            console.log("Añadiendo columna factor_pal a la tabla patients...");
            db.prepare("ALTER TABLE patients ADD COLUMN factor_pal REAL").run();
            console.log("✅ Columna factor_pal añadida.");
        } else {
            console.log("La columna factor_pal ya existe. Saltando.");
        }
    })();
    console.log("🎉 Migración NEAT-005 completada exitosamente.");
}

try {
    migrate();
} catch (error) {
    console.error("❌ La migración NEAT-005 falló:", error);
}
db.close();
