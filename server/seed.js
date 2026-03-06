const { db, initDb } = require('./db');

// Initialize schema first
initDb();

const seed = () => {
    const insertPatient = db.prepare(`
        INSERT INTO patients (first_name, paternal_lastname, maternal_lastname, birth_date, gender, weight_kg, height_cm, occupation, phone_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Andrés Trejo, 60 años (nació en 1965), Masculino, 85kg, 170cm
    const info = insertPatient.run('Andrés', 'Trejo', 'Maldonado', '1965-05-05', 'Masculino', 85.0, 170.0, 'Jubilado', '555-0199');
    const userId = info.lastInsertRowid;

    console.log(`Patient created with ID: ${userId} (Andrés Trejo)`);

    // Table II: Family History
    const insertFamily = db.prepare(`INSERT INTO family_history (user_id, condition_name, relative_type) VALUES (?, ?, ?)`);
    insertFamily.run(userId, 'Diabetes Mellitus', 'Madre');
    insertFamily.run(userId, 'Hipertensión', 'Padre');

    // Table V: Lifestyle Habits
    const insertHabit = db.prepare(`INSERT INTO lifestyle_habits (user_id, habit_type, frequency, quantity, activity_factor) VALUES (?, ?, ?, ?, ?)`);
    insertHabit.run(userId, 'Actividad Física', '0 veces/semana', 'Ninguna', 1.2);
    insertHabit.run(userId, 'Tabaco', 'Diario', '5 cigarrillos', null);

    // Table VI: Food Frequency
    const insertFood = db.prepare(`INSERT INTO food_frequency (user_id, food_group, weekly_frequency, preferences) VALUES (?, ?, ?, ?)`);
    insertFood.run(userId, 'Verduras', 2, 'Poco consumo');
    insertFood.run(userId, 'Origen Animal', 3, 'Preferencia por carnes rojas');
    insertFood.run(userId, 'Refrescos', 7, 'Consumo diario');

    // Table VIII: External Studies
    const insertStudy = db.prepare(`
        INSERT INTO external_studies (user_id, study_date, study_type, parameter_name, measured_value, reference_range, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Dato 1: Colágeno Bajo
    insertStudy.run(userId, '2025-12-05', 'Resonancia Cuántica', 'Colágeno', '4.823', '7.245 - 8.562', 'Bajo');

    // Dato 2: Diagnóstico del ECG
    insertStudy.run(userId, '2025-12-05', 'Electrocardiograma', 'Impresión Diagnóstica', 'BRADICARDIA SINUSAL. BLOQUEO RAMA DERECHA.', 'N/A', 'Alerta');

    console.log("✅ Datos de prueba (Paciente Andrés Trejo) insertados correctamente.");

    // Table IX: Códigos Postales
    // Table IX: Códigos Postales (SEPOMEX)
    const insertCP = db.prepare(`
        INSERT INTO codigos_postales 
        (d_codigo, D_mnpio, d_estado, d_asenta, d_tipo_asenta) 
        VALUES (?, ?, ?, ?, ?)
    `);
    try {
        insertCP.run('38000', 'Celaya', 'Guanajuato', 'Centro', 'Colonia');
        insertCP.run('38000', 'Celaya', 'Guanajuato', 'Alameda', 'Colonia');
        insertCP.run('50110', 'Toluca', 'Estado de México', 'Guerrero', 'Colonia');
        insertCP.run('50110', 'Toluca', 'Estado de México', 'La Merced', 'Barrio');
        insertCP.run('06600', 'Cuauhtémoc', 'Ciudad de México', 'Juárez', 'Colonia');
        console.log("✅ Códigos Postales insertados (Esquema SEPOMEX).");
    } catch (err) {
        console.log("ℹ️ Error insertando CPs:", err.message);
    }
};

try {
    seed();
} catch (err) {
    console.error("Error seeding database:", err);
}
