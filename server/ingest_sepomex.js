const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');
const readline = require('readline');
const iconv = require('iconv-lite');

// Configuración
const DB_PATH = path.resolve(__dirname, 'database.sqlite'); // Usamos la misma DB del proyecto
const SOURCE_FILE = path.resolve(__dirname, 'CPdescarga.txt'); // Archivo fuente

const db = new Database(DB_PATH);

console.log("🚀 Iniciando Ingesta Masiva de Datos SEPOMEX (Better-SQLite3)...");

try {
    // 1. Limpieza y Preparación
    console.log("🧹 Limpiando tabla anterior...");
    db.prepare("DROP TABLE IF EXISTS codigos_postales").run();

    // Creamos la tabla con la estructura OFICIAL
    db.prepare(`
        CREATE TABLE IF NOT EXISTS codigos_postales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            d_codigo TEXT, d_asenta TEXT, d_tipo_asenta TEXT, 
            D_mnpio TEXT, d_estado TEXT, d_ciudad TEXT, 
            d_CP TEXT, c_estado TEXT, c_oficina TEXT, 
            c_CP TEXT, c_tipo_asenta TEXT, c_mnpio TEXT, 
            id_asenta_cpcons TEXT, d_zona TEXT, c_cve_ciudad TEXT
        )
    `).run();

    // 2. Preparar la Inserción Masiva
    const insertStmt = db.prepare(`
        INSERT INTO codigos_postales (
            d_codigo, d_asenta, d_tipo_asenta, D_mnpio, d_estado, d_ciudad, 
            d_CP, c_estado, c_oficina, c_CP, c_tipo_asenta, c_mnpio, 
            id_asenta_cpcons, d_zona, c_cve_ciudad
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 3. Lectura del Archivo (Stream)
    const fileStream = fs.createReadStream(SOURCE_FILE)
        .pipe(iconv.decodeStream('latin1'));

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;

    // Iniciamos Transacción
    console.log("📥 Iniciando lectura de archivo...");
    const insertMany = db.transaction((rows) => {
        for (const row of rows) insertStmt.run(row);
    });

    let batch = [];
    const BATCH_SIZE = 5000;

    rl.on('line', (line) => {
        // Ignorar líneas vacías o headers
        if (!line || line.includes('d_codigo') || line.includes('El Catálogo Nacional')) return;

        const parts = line.split('|');

        // Validación básica de estructura
        if (parts.length >= 14) {
            // Ajustamos a 15 campos exactos (relleno final si falta)
            const data = [
                parts[0], parts[1], parts[2], parts[3], parts[4],
                parts[5], parts[6], parts[7], parts[8], parts[9],
                parts[10], parts[11], parts[12], parts[13], parts[14] || ''
            ];
            batch.push(data);
            count++;

            if (batch.length >= BATCH_SIZE) {
                insertMany(batch);
                batch = [];
                if (count % 10000 === 0) process.stdout.write(`... procesados ${count} registros\r`);
            }
        }
    });

    rl.on('close', () => {
        if (batch.length > 0) insertMany(batch); // Insertar remanentes
        console.log(`\n📦 Inserción de datos completada (${count} registros).`);

        console.log("⚙️  Creando índices de búsqueda...");
        db.prepare("CREATE INDEX IF NOT EXISTS idx_codigo ON codigos_postales(d_codigo)").run();
        db.prepare("CREATE INDEX IF NOT EXISTS idx_estado_mnpio ON codigos_postales(d_estado, D_mnpio)").run();

        console.log(`✅ ¡ÉXITO! Base de datos SEPOMEX lista.`);
        db.close();
    });

} catch (err) {
    console.error("❌ Error:", err);
}
