const { db } = require('../server/db');

console.log("🧪 Purging residual pediatric dossier for Citation 20804...");

try {
    const stmtSelect = db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?');
    const row = stmtSelect.get('20804');

    if (row) {
        let patientData = JSON.parse(row.patient_data_snapshot || '{}');
        console.log("Patient Age:", patientData?.identityLock?.patientInfo?.age || patientData?.identificacion?.edad || patientData?.edad);
        console.log("Previous Dossier Doctrina:", patientData?.clinical_dossier?.doctrina_aplicada);

        // Purge residual pediatric clinical dossier
        if (patientData.clinical_dossier) {
            delete patientData.clinical_dossier.human_approved_management;
            delete patientData.clinical_dossier.suggested_management;
            delete patientData.clinical_dossier.expediente_medico_nom004;
            delete patientData.clinical_dossier.guia_paciente_whatsapp;
            delete patientData.clinical_dossier;
        }

        delete patientData.isLactante;
        delete patientData.isPediatrico;
        if (patientData.profile?.pediatric_profile) {
            delete patientData.profile.pediatric_profile;
        }

        patientData.identificacion = {
            ...(patientData.identificacion || {}),
            nombre: "AGUSTIN MARTINEZ REYES",
            edad: 73,
            sexo: "M",
            idCita: "20804"
        };
        patientData.identityLock = {
            ...(patientData.identityLock || {}),
            verified: true,
            patientInfo: {
                name: "AGUSTIN MARTINEZ REYES",
                age: 73,
                sex: "M"
            }
        };

        const stmtSave = db.prepare(`
            UPDATE session_persistence 
            SET patient_data_snapshot = ?, last_updated = CURRENT_TIMESTAMP
            WHERE citation_id = '20804'
        `);
        stmtSave.run(JSON.stringify(patientData));
        console.log("✅ Citation 20804 successfully updated with adult profile (age 73)!");
    } else {
        console.log("No session found for 20804.");
    }
} catch (err) {
    console.error("Error updating 20804:", err.message);
}
