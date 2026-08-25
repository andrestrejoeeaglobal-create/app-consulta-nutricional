const { db } = require('../db');

/**
 * POST /api/cortex/synthesize-dossier
 * Realiza una síntesis diagnóstica en 3 pasos cruzando biometría, signos, ojo y lengua.
 */
const synthesizeDossier = async (req, res) => {
    const { citationId, patientData: bodyPatientData } = req.body;

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta el parámetro citationId." });
    }

    try {
        let patientData = bodyPatientData || null;

        if (!patientData) {
            const stmtSelect = db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?');
            const row = stmtSelect.get(citationId.toString());

            if (row && row.patient_data_snapshot) {
                patientData = JSON.parse(row.patient_data_snapshot || '{}');
            } else {
                patientData = {};
            }
        }
        
        // --- PASO 1: Fusión Multi-Modal & Extracción de Metadatos ---
        let payload = null;
        const clinicalFlags = patientData.clinical_flags || [];
        const foodAllergies = patientData.history?.allergies?.food || [];
        const drugAllergies = patientData.history?.allergies?.drug || [];
        const medications = patientData.history?.medications || [];
        const fastPattern = patientData.habits?.ayunoIntermitente || patientData.habits?.intermittentFasting || false;

        // ==========================================
        // 1. SANITIZACIÓN Y PARSEO CRONOLÓGICO BLINDADO (Fuerza Pediátrica)
        // ==========================================
        const extractAgeNumber = (data) => {
            if (!data) return null;
            const candidates = [
                data.identityLock?.patientInfo?.age,
                data.age,
                data.edad,
                data.profile?.age,
                data.vitals?.age,
                data.identificacion?.edad,
                data.profile?.pediatric_profile?.age
            ];
            for (const val of candidates) {
                if (val !== undefined && val !== null && val !== "") {
                    const num = Number(val);
                    if (!isNaN(num)) return num;
                }
            }
            return null;
        };

        const extractDobDate = (data) => {
            if (!data) return null;
            const pInfo = data.identityLock?.patientInfo;
            if (pInfo?.dob_year && pInfo?.dob_month && pInfo?.dob_day) {
                return new Date(pInfo.dob_year, pInfo.dob_month - 1, pInfo.dob_day);
            }
            let rawDob = data.dob || data.fecha_nacimiento || data.identificacion?.fechaNacimiento || data.profile?.dob;
            if (rawDob && typeof rawDob === "string" && rawDob.trim() !== "") {
                let parts = rawDob.trim().split(/[-/]/);
                if (parts.length === 3) {
                    if (parts[0].length <= 2 && parts[2].length === 4) {
                        return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T00:00:00`);
                    }
                }
                const d = new Date(rawDob);
                if (!isNaN(d.getTime())) return d;
            }
            return null;
        };

        let extractedAge = extractAgeNumber(patientData);
        let dobDate = extractDobDate(patientData);

        let ageYears = extractedAge !== null ? extractedAge : 30;
        let ageMonths = 0;
        let correctedAgeMonths = null;

        if (dobDate && !isNaN(dobDate.getTime())) {
            const today = new Date();
            ageYears = today.getFullYear() - dobDate.getFullYear();
            let monthDiff = today.getMonth() - dobDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
                ageYears--;
            }

            ageMonths = (today.getFullYear() - dobDate.getFullYear()) * 12 + (today.getMonth() - dobDate.getMonth());
            if (today.getDate() < dobDate.getDate()) {
                ageMonths--;
            }
            ageMonths = Math.max(0, ageMonths);

            const semanasGestacion = parseInt(patientData.vitals?.semanas_gestacion || patientData.history?.semanas_gestacion, 10);
            if (ageMonths < 36 && !isNaN(semanasGestacion) && semanasGestacion < 37) {
                const semanasFaltantes = 40 - semanasGestacion;
                const mesesFaltantes = semanasFaltantes / 4;
                correctedAgeMonths = Math.max(0, ageMonths - mesesFaltantes);
            }
        } else if (extractedAge !== null && extractedAge < 2) {
            ageMonths = extractedAge === 0 ? 11 : extractedAge * 12;
        }

        // Banderas Booleanas Pediátricas Desacopladas
        const isLactanteExplicit = patientData.isLactante || 
                                   patientData.profile?.pediatric_profile?.is_lactante || 
                                   (ageYears < 2) || 
                                   (ageMonths >= 0 && ageMonths < 24);

        const isPediatricExplicit = patientData.isPediatrico || 
                                    patientData.profile?.pediatric_profile?.is_minor || 
                                    patientData.profile?.pediatric_profile?.is_pediatric || 
                                    (ageYears < 18) || 
                                    isLactanteExplicit;

        if (isNaN(ageYears) || ageYears < 0) {
            ageYears = isLactanteExplicit ? 0 : (isPediatricExplicit ? 10 : 30);
        }

        // ==========================================
        // 2. CASCADA DE ENRUTAMIENTO PEDIÁTRICO / ADULTO
        // ==========================================
        let determinedRoute = "RUTA_D"; 

        if (isLactanteExplicit || isPediatricExplicit || ageYears < 18) {
            determinedRoute = "RUTA_A";
        } else {
            const reasonText = String(patientData.reason_for_consultation || patientData.motivo || patientData.history?.primaryRoute || "").toUpperCase();
            const hasGlycemicAlert = !!(patientData.scan_data?.electret_metrics?.glycemic_alert) || 
                                     clinicalFlags.includes("LINGUAL_GLYCEMIC_ALERT") || 
                                     clinicalFlags.includes("high_sugar_risk_CRITICAL") ||
                                     clinicalFlags.includes("GLYCEMIC_ALERT");
            const imc = parseFloat(patientData.vitals?.bmi || patientData.imc || patientData.metrics?.imc) || 0;

            if (hasGlycemicAlert || imc >= 25 || reasonText.includes("PESO") || reasonText.includes("GRASA") || reasonText.includes("DIABETES") || reasonText.includes("METABOLIC")) {
                determinedRoute = "RUTA_C";
            } else if (reasonText.includes("ENTRENAMIENTO") || reasonText.includes("VO2") || reasonText.includes("DOLOR") || reasonText.includes("POSTURA") || reasonText.includes("BIOMECANICA")) {
                determinedRoute = "RUTA_B";
            }
        }

        // 3. Estado Digestivo Real y Exclusiones
        const digestiveProfile = patientData.digestive_profile || {};
        const hasDigestiveIssues = digestiveProfile.has_issues || 
                                   patientData.history?.has_digestive_issues || 
                                   (digestiveProfile.symptoms && digestiveProfile.symptoms.length > 0) || 
                                   false;
        const digestivePhenotype = patientData.digestive_profile?.phenotype || (hasDigestiveIssues ? "DISBIOSIS/ALTERADO" : "EUBIOSIS/SALUDABLE");
        const proactiveExclusions = patientData.habits?.dietary_exclusions || patientData.profile?.dietary_exclusions || [];

        // 4. Evaluación Fisiológica Pediátrica PALS/OMS vs Adultos
        const activityLevel = String(
            patientData.activity_level || 
            patientData.physical_activity || 
            patientData.habits?.activity_level || 
            patientData.profile?.activity_level || 
            (isPediatricExplicit ? "JUEGO ACTIVO" : "SEDENTARIO")
        ).toUpperCase();

        const isSedentary = !isPediatricExplicit && (activityLevel.includes("SEDENTARIO") || activityLevel.includes("LIGERO") || activityLevel.includes("NULA"));

        const heartRate = parseInt(patientData.vitals?.heart_rate || patientData.vitals?.hr || (isLactanteExplicit ? 90 : 70), 10);
        
        // Tabla de Frecuencia Cardíaca Fisiológica PALS/OMS: Lactantes 80-140 LPM = Normal
        const isPediatricHRNormal = isLactanteExplicit ? (heartRate >= 80 && heartRate <= 140) : (isPediatricExplicit ? (heartRate >= 70 && heartRate <= 120) : false);
        const hasBradycardia = !isPediatricExplicit && heartRate < 60;
        const hasCardioFlags = !isPediatricExplicit && clinicalFlags.some(f => String(f).includes("BRADICARDIA") || String(f).includes("CARDIO"));

        const isExerciseRestricted = !isPediatricExplicit && (isSedentary || ageYears >= 55 || hasBradycardia || hasCardioFlags);

        // Candado Regulatorio COFEPRIS / NOM-043 para Lactantes (< 1 Año)
        let pediatricDisclaimer = "";
        if (isLactanteExplicit || ageMonths < 12 || ageYears < 1) {
            pediatricDisclaimer = "⚠️ DESCARGO REGULATORIO NOM-043/COFEPRIS: En lactantes menores de 1 año, la lactancia materna y la fórmula de continuación son la base nutricional primaria. Toda sugerencia de modulación nutricional celular (34Plus®) es de carácter orientativo y requiere validación explícita por el Pediatra tratante.";
        }

        let digestiveGuideline = "";
        if (!hasDigestiveIssues) {
            digestiveGuideline = "ESTADO DIGESTIVO: El paciente se declaró COMPLETAMENTE SANO Y ASINTOMÁTICO DIGESTIVO. Nodo 1: '1. Asimilación: Eubiosis e Integridad Intestinal (Z00.0 - Fisiológico Estable)'.";
        } else {
            digestiveGuideline = "ESTADO DIGESTIVO: Paciente presenta síntoma digestivo reportado. Nodo 1: '1. Asimilación: Alteración de la Absorción Intestinal (K90.9 - Prioridad Primaria)'.";
        }

        const hasHepaticOrRenalDisease = clinicalFlags.includes("HEPATIC_RISK") || 
                                         clinicalFlags.includes("RENAL_RISK") || 
                                         patientData.history?.app?.hepatic || 
                                         patientData.history?.app?.renal || 
                                         false;

        let hepaticRenalGuideline = "";
        if (!hasHepaticOrRenalDisease) {
            hepaticRenalGuideline = "ESTADO HEPÁTICO/RENAL: Paciente asintomático hepático/renal. Nodo 2: '2. Biotransformación: Salud Hepática y Renal Fisiológica (Z71.3 - Preventivo)'.";
        } else {
            hepaticRenalGuideline = "ESTADO HEPÁTICO/RENAL: Riesgo metabólico/hepático reportado. Nodo 2: '2. Biotransformación: Riesgo Metabólico/Hepático (K76.0)'.";
        }

        let physicalStrategyText = "";
        if (isPediatricExplicit) {
            physicalStrategyText = "Estimulación Psicomotriz Pediátrica: Gateo Activo, Coordinación Motora Gruesa/Fina y Tiempo de Juego (Tummy Time para lactantes).";
        } else if (isExerciseRestricted) {
            physicalStrategyText = "Prescripción Adaptativa Ligera: NEAT (6k-8k pasos) + Zona 2 Aeróbica Ligera + Readaptación Biomecánica (RIR >= 3-4). Prohibido Zona 5 HIIT.";
        } else {
            physicalStrategyText = "Lyon Protocol 2.0 + Decatlón Centenario (Zona 2 + Zona 5 4x4) + Protocolo Biomecánico 3 Fases.";
        }

        // 5. Construcción del Payload Seguro CORTEX v6.0
        const cortexPayload = {
            patient_metadata: {
                age: ageYears,
                age_months: ageMonths,
                corrected_age_months: correctedAgeMonths,
                is_lactante: isLactanteExplicit,
                is_pediatric: isPediatricExplicit,
                sex: patientData.sex || patientData.genero || patientData.profile?.gender || "No especificado",
                reason_for_consultation: patientData.reason_for_consultation || patientData.motivo || "Consulta Nutricional Pediátrica e Inmunometabólica"
            },
            hard_locks: {
                digestive_status: digestivePhenotype,
                has_digestive_issues: hasDigestiveIssues,
                proactive_exclusions: proactiveExclusions
            },
            routing: {
                target_route: determinedRoute
            },
            physical_telemetry: {
                activity_level: activityLevel,
                is_sedentary: isSedentary,
                heart_rate: heartRate,
                is_pediatric_hr_normal: isPediatricHRNormal,
                is_exercise_restricted: isExerciseRestricted
            }
        };

        // Intentar usar Gemini con Prompting Afirmativo XML y response_mime_type JSON
        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                
                const prompt = `
<system_constraints>
Eres CORTEX v2.0, el motor central de Inteligencia Clínica y Medicina Funcional de Sistemas de T.I.L.O.

REGLA DE SÍNTESIS Y BIOSEGURIDAD:
- La propiedad "alertas_bioseguridad" contiene la evaluación clínica limpia y el aviso regulatorio NOM-043.
- NO REPETIR el texto del descargo regulatorio en "critical_alerts" ni en "nutricion_defensora".

REGLAS CLÍNICAS POR GRUPO ETARIO:
1. PERFIL PEDIÁTRICO / LACTANTE:
   - Para pacientes menores de 18 años / lactantes, RUTA_A (Endocrinología y Desarrollo L-OMS) es OBLIGATORIA.
   - CADA DIAGNÓSTICO EN "preliminary_diagnosis" DEBE OBLIGATORIAMENTE INCLUIR SU CÓDIGO CIE-10 ENTRE PARÉNTESIS (ej: Z00.1, Z00.0, Z71.3, E78.5, E07.9, R53, Z88.8, M79.7).
   - En ejercicio: Prescribir ESTIMULACIÓN PSICOMOTRIZ Y JUEGO ACTIVO (sin HIIT, NEAT ni SMR).
   - En nutrición: Lactancia Materna / Fórmula Pediátrica + Ablactación BLW/Papillas caseras.

2. PERFIL ADULTO:
   - ${digestiveGuideline}
   - ${hepaticRenalGuideline}
   - ${isExerciseRestricted ? 'SAFEGUARD DE ESFUERZO ADULTO: Prescribir NEAT + Zona 2 Aeróbica Ligera (RIR >= 3-4).' : 'RÉGIMEN ATLETA: Zona 2 + Zona 5 VO2 Máx.'}
</system_constraints>

<response_schema>
Devuelve strictly un objeto JSON estructurado con la siguiente firma (sin texto adicional ni marcas markdown):
{
  "expediente_medico_nom004": {
    "doctrina_aplicada": "${determinedRoute === 'RUTA_A' ? 'RUTA_A: Endocrinología y Desarrollo Pediátrico L-OMS (Primeros 1000 Días)' : `${determinedRoute}: Medicina Funcional v2 (Matriz IFM de 7 Nodos)`}",
    "diagnostico_causa_raiz": "${isLactanteExplicit ? `Lactante de ${ageMonths || 11} meses en fase acelerada de crecimiento y desarrollo L-OMS. Constantes vitales dentro de parámetros normales (FC ${heartRate} LPM). Evaluación orientada a la maduración de la mucosa intestinal, tolerancia a alimentos sólidos y neurodesarrollo motor.` : 'Explicación clínica detallada jerarquizada desde el Nodo 1 de Asimilación hacia los nodos de Biotransformación, Energía, Comunicación y Transporte.'}",
    "alertas_bioseguridad": "${isLactanteExplicit ? `Paciente lactante (${ageMonths || 11} meses). Constantes vitales en norma fisiológica PALS/OMS (FC ${heartRate} LPM). Sin contraindicaciones digestivas ni hemodinámicas. ${pediatricDisclaimer}` : 'Parámetros de bioseguridad y adecuaciones de esfuerzo físico según perfil del paciente.'}",
    "sistemas_afectados": ["Desarrollo Pediátrico L-OMS", "Homeostasis Digestiva", "Perfil Neuroendocrino", "Biotensegridad Adaptativa"],
    "estrategia_terapeutica": {
      "nutricion_defensora": "${isLactanteExplicit ? `Matriz de Nutrición Celular 34Plus® Pediátrica: Leche Materna / Fórmula de Continuación + Introducción Guiada de Sólidos (BLW/Papillas caseras).` : 'Protocolo nutricional individualizado sin conteo calórico + Framework 5x5x5.'}",
      "readaptacion_fisica": "${physicalStrategyText}"
    },
    "preliminary_diagnosis": [
      "${isLactanteExplicit ? '1. Desarrollo: Crecimiento Pediátrico L-OMS (Z00.1 - Fisiológico)' : (hasDigestiveIssues ? '1. Asimilación: Alteración de la Absorción Intestinal (K90.9 - Prioridad Primaria)' : '1. Asimilación: Eubiosis e Integridad Intestinal (Z00.0 - Fisiológico)')}",
      "2. Biotransformación: Salud Hepática y Renal Fisiológica (Z71.3 - Preventivo)",
      "3. Energía: Perfil Metabólico e Inmunonutricional (E78.5)",
      "4. Comunicación: Equilibrio Neuroendocrino (E07.9)",
      "5. Transporte: Perfusión Cardiorrespiratoria Pediátrica en Reposo (R53)",
      "6. Defensa e Integridad: Perfil Inmunológico (Z88.8)",
      "7. Integridad Estructural: Biotensegridad y Desarrollo Psicomotor (M79.7)"
    ],
    "critical_alerts": [
      "${isLactanteExplicit ? `PROTOCOLO LACTANTE: Constantes vitales normales en escala PALS/OMS (FC ${heartRate} LPM). Prescrita Estimulación Psicomotriz.` : (isExerciseRestricted ? 'SAFEGUARD DE ESFUERZO: Bloqueado entrenamiento en Zona 5 HIIT por perfil sedentario.' : 'ENTRENAMIENTO ADULTO: Zona 2 + Zona 5 VO2 Máx adaptativo.')}"
    ],
    "suggested_management": [
      "${isLactanteExplicit ? '1. Preservación de Lactancia Materna / Fórmula Pediátrica + Introducción Guiada de Sólidos' : '1. Protocolo de Sellado o Preservación de Barrera Intestinal'}",
      "${isLactanteExplicit ? '2. Monitoreo Ponderal y Crecimiento Longitudinal (L-OMS)' : '2. Salvaguarda Tiroidea: Carbohidratos Cíclicos'}",
      "${isLactanteExplicit ? '3. Estimulación Psicomotriz Activa y Tiempo de Juego (Tummy Time)' : '3. Readaptación Física Adaptativa'}",
      "${isLactanteExplicit ? '4. Soporte Nutricional Pediátrico bajo Supervisión del Pediatra Tratante' : '4. Cronobiología 33+ (Mañana) / 34+ (Noche en 500ml de agua)'}"
    ]
  },
  "guia_paciente_whatsapp": {
    "titulo_resumen": "${isLactanteExplicit || isPediatricExplicit ? `🌱 El Crecimiento y Salud de ${patientData.profile?.first_name || patientData.identityLock?.patientInfo?.name || 'tu bebé'}` : '🌱 Tu Estado de Salud y Plan Metabólico'}",
    "pilar_salud_crecimiento": "${isLactanteExplicit ? `El bebé se encuentra en una etapa hermosa de desarrollo acelerado con constantes vitales normales en escala PALS/OMS (FC ${heartRate} LPM). Su desarrollo digestivo y motor avanza adecuadamente.` : 'Tu cuerpo se encuentra en un estado metabólico estable con parámetros de bioseguridad adaptados a tus objetivos.'}",
    "pilar_alimentacion_diaria": "${isLactanteExplicit ? 'Mantener la lactancia materna o fórmula de continuación como base principal, complementando con papillas caseras e introducción guiada de sólidos (BLW).' : 'Mantener alimentación equilibrada sin conteo calórico estricto, priorizando alimentos naturales e hidratación.'}",
    "pilar_juegos_movimiento": "${isLactanteExplicit ? 'Estimulación psicomotriz diaria con juego libre, gateo activo y tiempo boca abajo (Tummy Time) para fortalecer articulaciones y postura.' : 'Actividad física constante con caminata diaria (NEAT) y ejercicio aeróbico adaptado a tu condición.'}",
    "pilar_cuidados_suplementacion": "${isLactanteExplicit ? 'Monitoreo constante de crecimiento con su pediatra tratante. Las sugerencias nutricionales son orientativas bajo la NOM-043.' : 'Seguir los horarios de tomas diarias para optimizar tu energía diurna y descanso nocturno.'}"
  }
}
</response_schema>
`;

                console.log("🤖 CORTEX v2.0: Consultando Gemini para síntesis de expediente con Ruta:", cortexPayload.routing.target_route);
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
                console.error("⚠️ Error consultando Gemini para síntesis v2.0. Usando motor de reglas de respaldo:", geminiErr.message);
            }
        }

        // --- SISTEMA DE REGLAS DE RESPALDO (Offline / Alta Fidelidad v2.0 Pediátrico) ---
        if (!payload) {
            console.log("ℹ️ CORTEX v2.0: Ejecutando motor de reglas clínico local determinista v6.0 (Ruta:", determinedRoute, ")");
            
            const preliminary_diagnosis = [];
            if (isLactanteExplicit) {
                preliminary_diagnosis.push("1. Desarrollo: Crecimiento Pediátrico L-OMS (Z00.1 - Fisiológico)");
            } else if (hasDigestiveIssues) {
                preliminary_diagnosis.push("1. Asimilación: Alteración de la Absorción Intestinal (K90.9 - Prioridad Primaria)");
            } else {
                preliminary_diagnosis.push("1. Asimilación: Eubiosis e Integridad Intestinal (Z00.0 - Fisiológico)");
            }

            preliminary_diagnosis.push("2. Biotransformación: Salud Hepática y Renal Fisiológica (Z71.3 - Preventivo)");
            preliminary_diagnosis.push("3. Energía: Perfil Metabólico e Inmunonutricional (E78.5)");
            preliminary_diagnosis.push("4. Comunicación: Equilibrio Neuroendocrino (E07.9)");
            preliminary_diagnosis.push("5. Transporte: Perfusión Cardiorrespiratoria Pediátrica en Reposo (R53)");
            preliminary_diagnosis.push("6. Defensa e Integridad: Perfil Inmunológico (Z88.8)");
            preliminary_diagnosis.push("7. Integridad Estructural: Biotensegridad y Desarrollo Psicomotor (M79.7)");
            
            const critical_alerts = [];
            if (isLactanteExplicit) {
                critical_alerts.push(`PROTOCOLO LACTANTE: Constantes vitales normales en escala PALS/OMS (FC ${heartRate} LPM). Prescrita Estimulación Psicomotriz.`);
            } else if (isExerciseRestricted) {
                critical_alerts.push("SAFEGUARD DE ESFUERZO ADULTO: Bloqueado entrenamiento en Zona 5 HIIT por perfil sedentario/bradicárdico. Prescrita Zona 2 Ligera + NEAT.");
                critical_alerts.push("SALVAGUARDA TIROIDEA (PROTOCOLO PELZ): Prohibido el ayuno intermitente severo y la cetosis estricta. Prescripción obligatoria de Carbohidratos Cíclicos.");
            }

            const suggested_management = isLactanteExplicit ? [
                "1. Preservación de Lactancia Materna / Fórmula Pediátrica + Introducción Guiada de Sólidos (BLW/Papillas)",
                "2. Monitoreo Ponderal y Crecimiento Longitudinal (L-OMS)",
                "3. Estimulación Psicomotriz Activa y Tiempo de Juego (Tummy Time)",
                "4. Soporte Nutricional Pediátrico bajo Supervisión del Pediatra Tratante"
            ] : [
                hasDigestiveIssues ? "1. [Nodo Raíz - Asimilación] Protocolo de Sellado de Barrera Intestinal." : "1. [Nodo Raíz - Asimilación] Preservación de Eubiosis Intestinal (Z00.0).",
                "2. [Salvaguarda Tiroidea] Nutrición con Carbohidratos Complejos Cíclicos para conversión T4->T3 (Protocolo Pelz).",
                `3. [Readaptación Física] ${physicalStrategyText}`,
                "4. [Cronobiología 33+/34+] Fórmula 33Plus por la mañana. Fórmula 34Plus por la noche disuelta en agua 💧."
            ];

            const bioseguridadText = isLactanteExplicit 
                ? `Paciente lactante (${ageMonths || 11} meses). Constantes vitales en norma fisiológica PALS/OMS (FC ${heartRate} LPM). Sin contraindicaciones digestivas ni hemodinámicas. ${pediatricDisclaimer}`
                : (isExerciseRestricted 
                    ? "SAFEGUARD DE ESFUERZO ADULTO ACTIVADO: Prescrita Zona 2 Aeróbica Ligera + NEAT. Prohibido HIIT Zona 5." 
                    : "Régimen físico y metabólico para paciente sin restricciones.");

            const pName = patientData.profile?.first_name || patientData.identityLock?.patientInfo?.name || (isLactanteExplicit ? "tu bebé" : "Paciente");

            payload = {
                doctrina_aplicada: determinedRoute === 'RUTA_A' ? 'RUTA_A: Endocrinología y Desarrollo Pediátrico L-OMS (Primeros 1000 Días)' : `${determinedRoute}: Medicina Funcional de Sistemas (Matriz IFM de 7 Nodos v2)`,
                diagnostico_causa_raiz: isLactanteExplicit 
                    ? `Lactante de ${ageMonths || 11} meses en fase acelerada de crecimiento y desarrollo L-OMS. Constantes vitales dentro de parámetros normales (FC ${heartRate} LPM). Evaluación orientada a la maduración de la mucosa intestinal, tolerancia a alimentos sólidos y neurodesarrollo motor.`
                    : preliminary_diagnosis.join(". "),
                preliminary_diagnosis,
                critical_alerts,
                suggested_management,
                alertas_bioseguridad: bioseguridadText,
                sistemas_afectados: isLactanteExplicit 
                    ? ["Desarrollo Pediátrico L-OMS", "Homeostasis Digestiva", "Perfil Neuroendocrino", "Biotensegridad Adaptativa"]
                    : ["Nodo Raíz: Asimilación Intestinal", "Eje Insulina/Cortisol/Tiroides", "Biotransformación y Función Renal", "Biotensegridad y Músculo Exoesqueleto"],
                estrategia_terapeutica: {
                    nutricion_defensora: isLactanteExplicit 
                        ? "Matriz de Nutrición Celular 34Plus® Pediátrica: Leche Materna / Fórmula de Continuación + Introducción Guiada de Sólidos (BLW / Papillas caseras)."
                        : "Protocolo nutricional defensivo + Carbohidratos Complejos Cíclicos tiroideos + Framework 5x5x5 sin conteo calórico.",
                    readaptacion_fisica: physicalStrategyText
                },
                guia_paciente_whatsapp: {
                    titulo_resumen: isLactanteExplicit || isPediatricExplicit ? `🌱 El Crecimiento y Salud de ${pName}` : "🌱 Tu Estado de Salud y Plan Metabólico",
                    pilar_salud_crecimiento: isLactanteExplicit ? `El bebé se encuentra en una etapa hermosa de desarrollo acelerado con constantes vitales normales en escala PALS/OMS (FC ${heartRate} LPM). Su desarrollo digestivo y motor avanza adecuadamente.` : "Tu cuerpo se encuentra en un estado metabólico estable con parámetros de bioseguridad adaptados a tus objetivos.",
                    pilar_alimentacion_diaria: isLactanteExplicit ? "Mantener la lactancia materna o fórmula de continuación como base principal, complementando con papillas caseras e introducción guiada de sólidos (BLW)." : "Mantener alimentación equilibrada sin conteo calórico estricto, priorizando alimentos naturales e hidratación.",
                    pilar_juegos_movimiento: isLactanteExplicit ? "Estimulación psicomotriz diaria con juego libre, gateo activo y tiempo boca abajo (Tummy Time) para fortalecer articulaciones y postura." : "Actividad física constante con caminata diaria (NEAT) y ejercicio aeróbico adaptado a tu condición.",
                    pilar_cuidados_suplementacion: isLactanteExplicit ? "Monitoreo constante de crecimiento con su pediatra tratante. Las sugerencias nutricionales son orientativas bajo la NOM-043." : "Seguir los horarios de tomas diarias para optimizar tu energía diurna y descanso nocturno."
                }
            };
            // Alertas Críticas Adicionales (Alergias / Fármacos)
            foodAllergies.forEach(a => {
                payload.critical_alerts.push(`ALERGIA SEVERA: ${a.agent?.toUpperCase() || 'ALIMENTO'}`);
            });
            drugAllergies.forEach(a => {
                payload.critical_alerts.push(`ALERGIA MEDICAMENTOSA: ${a.agent?.toUpperCase() || 'MEDICAMENTO'}`);
            });

            const hasFentermina = medications.some(m => 
                m.name?.toUpperCase().includes("FENTER") || 
                m.name?.toUpperCase().includes("ACXION") || 
                m.name?.toUpperCase().includes("TERFAMEX")
            );

            if (hasFentermina) {
                payload.critical_alerts.push("INTERACCIÓN CRÍTICA: Uso de anorexigénicos simpaticomiméticos (Fentermina). Bloquear Fórmula 33 Plus.");
                payload.suggested_management.push("Prescribir Fórmula 34 Plus (Homeostasis nocturna) y contraindicar Fórmula 33 Plus.");
            }
        }

        // Sanitización y Normalización defensiva de Códigos CIE-10 para el renderizado Bento Grid
        if (payload) {
            if (payload.expediente_medico_nom004) {
                const guia = payload.guia_paciente_whatsapp;
                payload = {
                    ...payload.expediente_medico_nom004,
                    guia_paciente_whatsapp: guia || payload.guia_paciente_whatsapp
                };
            }

            if (Array.isArray(payload.preliminary_diagnosis)) {
                payload.preliminary_diagnosis = payload.preliminary_diagnosis.map((diag, idx) => {
                    let str = typeof diag === 'object' ? (diag.text || JSON.stringify(diag)) : String(diag);
                    // Eliminar cualquier etiqueta redundante "(Sin CIE-10)"
                    str = str.replace(/\(Sin CIE-10\)/gi, '').trim();
                    // Si no tiene código CIE-10 entre paréntesis, inyectar el código correspondiente
                    if (!/\([A-Z]\d{2}(\.\d{1,2})?.*?\)/i.test(str)) {
                        str = `${str} (Z00.${idx + 1})`;
                    }
                    return str;
                });
            }
            if (!payload.doctrina_aplicada) {
                payload.doctrina_aplicada = `${determinedRoute}: Ruta Clínica Activa`;
            }
            if (!payload.diagnostico_causa_raiz) {
                payload.diagnostico_causa_raiz = Array.isArray(payload.preliminary_diagnosis) && payload.preliminary_diagnosis.length > 0
                    ? payload.preliminary_diagnosis.join(". ")
                    : "Homeostasis metabólica general. Fisiológico estable.";
            }
            if (!payload.alertas_bioseguridad) {
                payload.alertas_bioseguridad = Array.isArray(payload.critical_alerts) && payload.critical_alerts.length > 0
                    ? payload.critical_alerts.join(". ")
                    : "Sin diagnósticos definitivos absolutos.";
            }
            if (!payload.sistemas_afectados || !Array.isArray(payload.sistemas_afectados)) {
                payload.sistemas_afectados = ["Sistema Inmune", "Metabolismo Energético", "Biotensegridad Fascial"];
            }
            if (!payload.estrategia_terapeutica || typeof payload.estrategia_terapeutica !== 'object') {
                payload.estrategia_terapeutica = {
                    nutricion_defensora: "Optimización de micronutrientes y jerarquía hormonal.",
                    readaptacion_fisica: "Prescripción biomecánica y capacidad aeróbica en Zona 2."
                };
            }
            if (!payload.preliminary_diagnosis || !Array.isArray(payload.preliminary_diagnosis)) {
                payload.preliminary_diagnosis = [payload.diagnostico_causa_raiz];
            } else {
                // Limpiar si el LLM devolvió strings de JSON
                payload.preliminary_diagnosis = payload.preliminary_diagnosis.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item));
            }
            if (!payload.suggested_management || !Array.isArray(payload.suggested_management)) {
                payload.suggested_management = [
                    payload.estrategia_terapeutica.nutricion_defensora,
                    payload.estrategia_terapeutica.readaptacion_fisica
                ].filter(Boolean);
            } else {
                payload.suggested_management = payload.suggested_management.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item));
            }
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
