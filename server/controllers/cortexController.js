const { db } = require('../db');

/**
 * POST /api/cortex/synthesize-dossier
 * Realiza una síntesis diagnóstica en 3 pasos cruzando biometría, signos, ojo y lengua.
 */
const synthesizeDossier = async (req, res) => {
    const { citationId } = req.body;

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta el parámetro citationId." });
    }

    try {
        const stmtSelect = db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?');
        const row = stmtSelect.get(citationId.toString());

        if (!row) {
            return res.status(404).json({ success: false, message: "No se encontró sesión para esta cita." });
        }

        const patientData = JSON.parse(row.patient_data_snapshot || '{}');
        
        // --- PASO 1 (Fusión Multi-Modal) ---
        const clinicalFlags = patientData.clinical_flags || [];
        const foodAllergies = patientData.history?.allergies?.food || [];
        const drugAllergies = patientData.history?.allergies?.drug || [];
        const medications = patientData.history?.medications || [];
        const fastPattern = patientData.habits?.ayunoIntermitente || patientData.habits?.intermittentFasting || false;

        let payload = null;

        // Intentar usar Gemini si la clave de API está presente
        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                
                const prompt = `
                Eres el Motor CORTEX de T.I.L.O. (Medicina Funcional). Realiza una Síntesis Diagnóstica en 3 Pasos:
                - PASO 1 (Fusión Multi-Modal): Analiza cruzadamente alertas clínicas, alergias, medicamentos, hábitos y signos del paciente.
                - PASO 2 (Blindaje COFEPRIS): Traduce cualquier diagnóstico médico definitivo o alopático a términos de riesgo o soporte funcional metabólico (ej. "Diabetes" -> "Riesgo de Alteración Glucémica").
                - PASO 3 (Generación de Borrador): Devuelve una sugerencia preliminar.
                
                Datos Clínicos Recolectados del Paciente:
                - Banderas Clínicas de Triage y Escáneres (Fase 18): ${JSON.stringify(clinicalFlags)}
                - Alergias Alimentarias: ${JSON.stringify(foodAllergies)}
                - Alergias Farmacológicas: ${JSON.stringify(drugAllergies)}
                - Medicamentos en Uso: ${JSON.stringify(medications)}
                - Patrón de Ayuno: ${fastPattern ? "Ayuno Intermitente Activo" : "Sin ayuno"}
                - Vitales y Biometría: ${JSON.stringify(patientData.vitals || {})}
                - Ruta Clínica Principal: ${patientData.route || patientData.history?.primaryRoute || "Metabólica Estándar"}
                
                Especificaciones de Salida del JSON:
                1. "preliminary_diagnosis": Un array de strings con diagnósticos preliminares en español, usando terminología funcional (ej. "Estrés Hepático Metabólico" en vez de "Hígado Graso").
                2. "critical_alerts": Un array de strings indicando alergias graves o interacciones críticas de medicamentos/fórmulas.
                3. "suggested_management": Un array de strings con sugerencias de intervención específicas, soporte digestivo/enzimático, y dosificación de suplementación.
                
                Responde estrictamente con un JSON estructurado así (sin markdown, sin explicaciones):
                {
                  "preliminary_diagnosis": ["String"],
                  "critical_alerts": ["String"],
                  "suggested_management": ["String"]
                }
                `;

                console.log("🤖 CORTEX: Consultando Gemini para síntesis de expediente...");
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                    }
                });

                const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                payload = JSON.parse(cleanText);
            } catch (geminiErr) {
                console.error("⚠️ Error consultando Gemini para síntesis. Usando motor de reglas de respaldo:", geminiErr.message);
            }
        }

        // --- SISTEMA DE REGLAS DE RESPALDO (Offline/Alta Fidelidad) ---
        if (!payload) {
            console.log("ℹ️ CORTEX: Ejecutando motor de reglas clínico local.");
            const preliminary_diagnosis = [];
            const critical_alerts = [];
            const suggested_management = [];

            // 1. Diagnósticos preliminares basados en flags de Fase 18
            if (clinicalFlags.includes("HIGH_CARDIO_RISK")) {
                preliminary_diagnosis.push("Tendencia a Estrés de Perfusión Microvascular");
            }
            if (clinicalFlags.includes("DIGESTIVE_ENZYME_LOW")) {
                preliminary_diagnosis.push("Sugerencia de Optimización de Hidrólisis Gástrica (Acidez/Enzimas)");
            }
            if (clinicalFlags.includes("OCULAR_ANEMIA_ALERT")) {
                preliminary_diagnosis.push("Tendencia a Descenso de Hemoglobina Funcional");
            }
            if (clinicalFlags.includes("OCULAR_RENAL_ALERT")) {
                preliminary_diagnosis.push("Riesgo de Alteración de Permeabilidad Renal Fisiológica");
            }
            if (clinicalFlags.includes("LINGUAL_HEPATIC_ALERT")) {
                preliminary_diagnosis.push("Estrés Hepático Metabólico (Congestión Hepatobiliar)");
            }
            if (clinicalFlags.includes("LINGUAL_GLYCEMIC_ALERT")) {
                preliminary_diagnosis.push("Riesgo de Alteración de Sensibilidad Glucémica");
            }
            if (clinicalFlags.includes("LINGUAL_CARDIO_ALERT")) {
                preliminary_diagnosis.push("Estasis Sanguínea Leve / Necesidad de Soporte Circulatorio");
            }

            if (preliminary_diagnosis.length === 0) {
                preliminary_diagnosis.push("Homeostasis Metabólica General (Fisiológico Estable)");
            }

            // 2. Alertas Críticas (Alergias / Fármacos)
            foodAllergies.forEach(a => {
                critical_alerts.push(`ALERGIA SEVERA: ${a.agent?.toUpperCase() || 'ALIMENTO'}`);
            });
            drugAllergies.forEach(a => {
                critical_alerts.push(`ALERGIA MEDICAMENTOSA: ${a.agent?.toUpperCase() || 'MEDICAMENTO'}`);
            });

            const hasFentermina = medications.some(m => 
                m.name?.toUpperCase().includes("FENTER") || 
                m.name?.toUpperCase().includes("ACXION") || 
                m.name?.toUpperCase().includes("TERFAMEX")
            );

            if (hasFentermina) {
                critical_alerts.push("INTERACCIÓN CRÍTICA: Uso de anorexigénicos simpaticomiméticos (Fentermina). Bloquear Fórmula 33 Plus.");
            }

            if (clinicalFlags.includes("HIGH_VULNERABILITY")) {
                critical_alerts.push("ALERTA CONDUCTUAL: Vulnerabilidad psicológica alimentaria detectada. Evitar lenguaje restrictivo.");
            }

            // 3. Recomendaciones de Manejo
            if (clinicalFlags.includes("DIGESTIVE_ENZYME_LOW")) {
                suggested_management.push("Soporte digestivo: Iniciar Betaína HCl con Pepsina antes de alimentos densos.");
            }
            if (clinicalFlags.includes("LINGUAL_HEPATIC_ALERT")) {
                suggested_management.push("Modular congestión biliar mediante extracto estandarizado de alcachofa y cardo mariano.");
            }
            if (clinicalFlags.includes("LINGUAL_GLYCEMIC_ALERT")) {
                suggested_management.push("Soporte insulínico: Inclusión de fibra soluble viscosa (Inulina) y Picolinato de Cromo.");
            }
            if (clinicalFlags.includes("OCULAR_ANEMIA_ALERT")) {
                suggested_management.push("Optimizar biodisponibilidad de hierro mediante cofactores y espirulina.");
            }
            if (fastPattern) {
                suggested_management.push("Sincronizar crononutrición: Romper la ventana de ayuno con aporte proteico denso.");
            }

            if (hasFentermina) {
                suggested_management.push("Prescribir Fórmula 34 Plus (Homeostasis nocturna) y contraindicar Fórmula 33 Plus.");
            } else {
                suggested_management.push("Esquema dual recomendado: Fórmula 33 Plus (Mañana) + Fórmula 34 Plus (Noche).");
            }

            payload = {
                preliminary_diagnosis,
                critical_alerts,
                suggested_management
            };
        }

        res.json({
            success: true,
            dossier: payload
        });

    } catch (err) {
        console.error("🔥 Error en synthesize-dossier:", err.message);
        res.status(500).json({ success: false, message: "Error interno al sintetizar el expediente." });
    }
};

/**
 * POST /api/cortex/approve-dossier
 * Sella el expediente en SQLite y calcula silenciosamente los deltas de cambios del médico para RLHF.
 */
const approveDossier = async (req, res) => {
    const { 
        citationId, 
        approvedDiagnosis, 
        approvedManagement, 
        additionalSymptoms,
        originalDiagnosis,
        originalManagement
    } = req.body;

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta el parámetro citationId." });
    }

    try {
        const stmtSelect = db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?');
        const row = stmtSelect.get(citationId.toString());

        if (!row) {
            return res.status(404).json({ success: false, message: "No se encontró sesión activa." });
        }

        const patientData = JSON.parse(row.patient_data_snapshot || '{}');

        // --- CÁLCULO DE DELTAS PARA RLHF ---
        const rlhf_deltas = {
            original_diagnosis: originalDiagnosis || [],
            approved_diagnosis: approvedDiagnosis || [],
            original_management: originalManagement || [],
            approved_management: approvedManagement || [],
            modified_at: new Date().toISOString()
        };

        // Inyectar el expediente aprobado en patientData
        patientData.clinical_dossier = {
            human_approved_diagnosis: approvedDiagnosis || [],
            human_approved_management: approvedManagement || [],
            additional_symptoms_reported: additionalSymptoms || "",
            rlhf_deltas,
            doctor_approval_timestamp: new Date().toISOString(),
            status: "READY_FOR_PHASE_20"
        };

        // Sincronizar en el panel de vitals y diagnóstico si es necesario
        patientData.diagnosis_approved = true;

        // Transición de fase en la base de datos
        const nextPhase = 20;
        const nextBlock = "PHASE_20_READY";

        const stmtSave = db.prepare(`
            INSERT INTO session_persistence (citation_id, last_active_phase, last_active_block, patient_data_snapshot, is_completed, last_updated)
            VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
            ON CONFLICT(citation_id) DO UPDATE SET
                last_active_phase = excluded.last_active_phase,
                last_active_block = excluded.last_active_block,
                patient_data_snapshot = excluded.patient_data_snapshot,
                last_updated = CURRENT_TIMESTAMP
        `);

        stmtSave.run(citationId.toString(), nextPhase, nextBlock, JSON.stringify(patientData));

        console.log(`💾 [RLHF SUCCESS] Expediente sellado con deltas de especialista para Cita #${citationId}`);
        res.json({ success: true, message: "Expediente sellado por el especialista con metadatos RLHF." });

    } catch (err) {
        console.error("🔥 Error en approveDossier:", err.message);
        res.status(500).json({ success: false, message: "Error al sellar el expediente clínico." });
    }
};

module.exports = { synthesizeDossier, approveDossier };
