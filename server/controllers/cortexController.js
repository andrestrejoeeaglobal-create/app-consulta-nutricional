const { db } = require('../db');

// ============================================================================
// 1. DICCIONARIO DETERMINISTA LOCAL DE CÓDIGOS CIE-10 Y REGLA DE FALLBACK
// ============================================================================
const CIE10_CLINICAL_DICTIONARY = {
    Z00_0: { code: 'Z00.0', label: 'Examen médico general (Homeostasis conservada)' },
    Z00_1: { code: 'Z00.1', label: 'Control de salud de rutina del niño (L-OMS)' },
    Z71_3: { code: 'Z71.3', label: 'Consulta para instrucción y vigilancia dietética' },
    K90_9: { code: 'K90.9', label: 'Malabsorción intestinal / Disbiosis funcional' },
    K30:   { code: 'K30',   label: 'Dispepsia funcional / Hipoclorhidria' },
    K59_0: { code: 'K59.0', label: 'Estreñimiento funcional' },
    K76_0: { code: 'K76.0', label: 'Hígado graso / Sobrecarga de biotransformación hepática' },
    E78_0: { code: 'E78.0', label: 'Hipercolesterolemia pura (LDL / Colesterol elevado)' },
    E78_2: { code: 'E78.2', label: 'Hiperlipidemia mixta (Colesterol y Triglicéridos)' },
    E78_5: { code: 'E78.5', label: 'Hiperlipidemia / Dislipidemia aterogénica (sdLDL / Índice Aterogénico)' },
    E11_9: { code: 'E11.9', label: 'Disglucemia / Resistencia a la insulina metabólica' },
    R73_0: { code: 'R73.0', label: 'Anormalidad en la prueba de tolerancia a la glucosa / Prediabetes' },
    E03_9: { code: 'E03.9', label: 'Hipotiroidismo subclínico / Baja conversión periférica T4->T3' },
    E07_9: { code: 'E07.9', label: 'Desregulación del eje neuroendocrino (Cortisol / DHEA)' },
    G47_0: { code: 'G47.0', label: 'Trastorno del inicio y mantenimiento del sueño / Cronodisrupción' },
    I10:   { code: 'I10',   label: 'Hipertensión arterial / Reactividad vascular elevada' },
    R70_1: { code: 'R70.1', label: 'Viscosidad sanguínea anormal / Hiperviscosidad reológica' },
    D50_9: { code: 'D50.9', label: 'Déficit de hierro / Hipoperfusión microcirculatoria' },
    D72_8: { code: 'D72.8', label: 'Reactividad leucocitaria / Basofilia reactiva' },
    L53_9: { code: 'L53.9', label: 'Afección eritematosa / Erupción micropapular cutánea' },
    T78_4: { code: 'T78.4', label: 'Hipersensibilidad alérgica / Reactividad histamínica' },
    M81_8: { code: 'M81.8', label: 'Desmineralización ósea / Desbalance de osteocalcina' },
    M79_1: { code: 'M79.1', label: 'Mialgia / Tensión miofascial y biotensegridad alterada' },
    E66_9: { code: 'E66.9', label: 'Adiposidad visceral / Desbalance de composición corporal' },
    // Fallbacks deterministas para casos borde no mapeados
    R79_9: { code: 'R79.9', label: 'Hallazgo anormal de la química sanguínea, sin otra especificación' },
    R89_9: { code: 'R89.9', label: 'Hallazgo anormal no especificado en muestras de otros órganos, sistemas y tejidos' }
};

/**
 * Asigna el código CIE-10 determinista según las anomalías del Nodo IFM.
 * Si existen anomalías pero ninguna coincide con una regla exacta, aplica el fallback
 * R79.9 (Química Sanguínea/OCR) o R89.9 (Electret/Somatoscopía) con estado REQUIERE_REVISIÓN.
 */
function resolveCie10ForNode(nodeId, anomalies, isLactanteExplicit = false) {
    if (!Array.isArray(anomalies) || anomalies.length === 0) {
        if (isLactanteExplicit && nodeId === 'NODO_1_ASIMILACION') {
            return { cie10: CIE10_CLINICAL_DICTIONARY.Z00_1.code, label: CIE10_CLINICAL_DICTIONARY.Z00_1.label, validation_status: 'VALIDADO' };
        }
        return { cie10: CIE10_CLINICAL_DICTIONARY.Z00_0.code, label: CIE10_CLINICAL_DICTIONARY.Z00_0.label, validation_status: 'VALIDADO' };
    }

    const joined = anomalies.map(a => `${a.label || ''} ${a.detail || ''} ${a.code || ''}`).join(' ').toUpperCase();

    if (nodeId === 'NODO_1_ASIMILACION') {
        if (joined.includes('ESTREÑIMIENTO') || joined.includes('BRISTOL 1') || joined.includes('BRISTOL 2')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.K59_0.code, label: CIE10_CLINICAL_DICTIONARY.K59_0.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('PEPSINA') || joined.includes('REFLUJO') || joined.includes('ACIDEZ') || joined.includes('GÁSTRIC')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.K30.code, label: CIE10_CLINICAL_DICTIONARY.K30.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('SABURRA') || joined.includes('DISBIOSIS') || joined.includes('DISTENSIÓN') || joined.includes('COLITIS') || joined.includes('ABSORCIÓN') || joined.includes('INTESTIN')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.K90_9.code, label: CIE10_CLINICAL_DICTIONARY.K90_9.label, validation_status: 'VALIDADO' };
        }
    }

    if (nodeId === 'NODO_2_BIOTRANSFORMACION') {
        if (joined.includes('HEPÁT') || joined.includes('HIGADO') || joined.includes('HÍGADO') || joined.includes('TRANSAMINASA') || joined.includes('ALT') || joined.includes('AST') || joined.includes('GGT') || joined.includes('BILIRRUBINA') || joined.includes('METALES')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.K76_0.code, label: CIE10_CLINICAL_DICTIONARY.K76_0.label, validation_status: 'VALIDADO' };
        }
    }

    if (nodeId === 'NODO_3_ENERGIA') {
        if ((joined.includes('COLESTEROL') || joined.includes('LDL')) && joined.includes('TRIGLIC')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.E78_2.code, label: CIE10_CLINICAL_DICTIONARY.E78_2.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('SDLDL') || joined.includes('ATEROGÉNIC') || joined.includes('ATEROGENIC') || joined.includes('NO-HDL') || joined.includes('CRISTAL DE COLESTEROL')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.E78_5.code, label: CIE10_CLINICAL_DICTIONARY.E78_5.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('COLESTEROL') || joined.includes('LDL')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.E78_0.code, label: CIE10_CLINICAL_DICTIONARY.E78_0.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('GLUCOSA') || joined.includes('INSULINA') || joined.includes('HBA1C')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.R73_0.code, label: CIE10_CLINICAL_DICTIONARY.R73_0.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('COENZIMA') || joined.includes('ATP') || joined.includes('MITOCONDR')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.E78_5.code, label: CIE10_CLINICAL_DICTIONARY.E78_5.label, validation_status: 'VALIDADO' };
        }
    }

    if (nodeId === 'NODO_4_COMUNICACION') {
        if (joined.includes('TIROID') || joined.includes('TSH') || joined.includes('T3') || joined.includes('T4')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.E03_9.code, label: CIE10_CLINICAL_DICTIONARY.E03_9.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('SUEÑO') || joined.includes('INSOMNIO') || joined.includes('DESPERTAR')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.G47_0.code, label: CIE10_CLINICAL_DICTIONARY.G47_0.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('ESTRÉS') || joined.includes('CORTISOL') || joined.includes('ANSIEDAD') || joined.includes('HORMON')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.E07_9.code, label: CIE10_CLINICAL_DICTIONARY.E07_9.label, validation_status: 'VALIDADO' };
        }
    }

    if (nodeId === 'NODO_5_TRANSPORTE') {
        if (joined.includes('VISCOSIDAD') || joined.includes('REOLÓGIC') || joined.includes('RANINAS') || joined.includes('ESTASIS') || joined.includes('TORTUOSIDAD')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.R70_1.code, label: CIE10_CLINICAL_DICTIONARY.R70_1.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('PRESIÓN') || joined.includes('HIPERTENSIÓN') || joined.includes('RESISTENCIA VASCULAR') || joined.includes('TPR')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.I10.code, label: CIE10_CLINICAL_DICTIONARY.I10.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('PALIDEZ') || joined.includes('HEMOGLOBINA') || joined.includes('HIERRO') || joined.includes('FERRITINA')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.D50_9.code, label: CIE10_CLINICAL_DICTIONARY.D50_9.label, validation_status: 'VALIDADO' };
        }
    }

    if (nodeId === 'NODO_6_DEFENSA') {
        if (joined.includes('ERITEMA') || joined.includes('MICROPAPULAR') || joined.includes('MÁCULA') || joined.includes('MACULA') || joined.includes('CUTÁNEO') || joined.includes('PERIFOLICULAR') || joined.includes('EDEMA CUTÁNEO')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.L53_9.code, label: CIE10_CLINICAL_DICTIONARY.L53_9.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('BASÓFILO') || joined.includes('BASOFILO') || joined.includes('EOSINÓFILO') || joined.includes('LEUCOCITO') || joined.includes('LINFOCITO')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.D72_8.code, label: CIE10_CLINICAL_DICTIONARY.D72_8.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('ALERGIA') || joined.includes('HISTAMIN') || joined.includes('IGE')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.T78_4.code, label: CIE10_CLINICAL_DICTIONARY.T78_4.label, validation_status: 'VALIDADO' };
        }
    }

    if (nodeId === 'NODO_7_ESTRUCTURAL') {
        if (joined.includes('OSTEOCALCINA') || joined.includes('CALCIFICACIÓN') || joined.includes('CALCIO') || joined.includes('ÓSEA') || joined.includes('COLÁGENO')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.M81_8.code, label: CIE10_CLINICAL_DICTIONARY.M81_8.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('IMC') || joined.includes('GRASA') || joined.includes('OBESIDAD') || joined.includes('SOBREPESO')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.E66_9.code, label: CIE10_CLINICAL_DICTIONARY.E66_9.label, validation_status: 'VALIDADO' };
        }
        if (joined.includes('DOLOR') || joined.includes('FASCIA') || joined.includes('MÚSCULO') || joined.includes('ARTICULAR')) {
            return { cie10: CIE10_CLINICAL_DICTIONARY.M79_1.code, label: CIE10_CLINICAL_DICTIONARY.M79_1.label, validation_status: 'VALIDADO' };
        }
    }

    // REGLA DE FALLBACK DETERMINISTA PARA CASOS BORDE (Cero pérdida silenciosa)
    const hasLabOcrAnomaly = anomalies.some(a => a.source === 'OCR_LAB');
    if (hasLabOcrAnomaly) {
        return {
            cie10: CIE10_CLINICAL_DICTIONARY.R79_9.code,
            label: CIE10_CLINICAL_DICTIONARY.R79_9.label,
            validation_status: 'REQUIERE_REVISIÓN'
        };
    }

    return {
        cie10: CIE10_CLINICAL_DICTIONARY.R89_9.code,
        label: CIE10_CLINICAL_DICTIONARY.R89_9.label,
        validation_status: 'REQUIERE_REVISIÓN'
    };
}

// ============================================================================
// 2. FÓRMULA DE DEVINE BIDIRECCIONAL (< 152.4 cm) + ÁRBOL BIOENERGÉTICO
// ============================================================================
/**
 * Calcula el Peso Ideal (Fórmula de Devine Bidireccional + Referencia Lemmens)
 * y el Peso Ajustado para pacientes con obesidad (IMC >= 35).
 * @param {number} weightKg - Peso real del paciente en kilogramos.
 * @param {number} heightCm - Estatura del paciente en centímetros.
 * @param {string} gender - 'Masculino' o 'Femenino'.
 * @returns {Object} { idealWeight, lemmensIdealWeight, adjustedWeight }
 */
function calculatePrecisionWeights(weightKg, heightCm, gender) {
    const validWeight = Number(weightKg) > 0 ? Number(weightKg) : 70;
    const validHeight = Number(heightCm) > 0 ? Number(heightCm) : 165;
    const baseHeightCm = 152.4; // Base de 5 pies (60 pulgadas)
    const gStr = String(gender || '').toLowerCase();
    const isMale = gStr.startsWith('masc') || gStr === 'hombre' || gStr === 'm';
    const baseWeightKg = isMale ? 50.0 : 45.5;

    let idealWeight = baseWeightKg;
    if (validHeight >= baseHeightCm) {
        const inchesOverBase = (validHeight - baseHeightCm) / 2.54;
        idealWeight = baseWeightKg + (2.3 * inchesOverBase);
    } else {
        // Corrección bidireccional para estaturas bajas (< 152.4 cm):
        // Resta 1.5 kg por cada pulgada por debajo de los 5 pies
        const inchesUnderBase = (baseHeightCm - validHeight) / 2.54;
        idealWeight = Math.max(30.0, baseWeightKg - (1.5 * inchesUnderBase));
    }

    // Referencia cruzada de Lemmens (IMC óptimo 22 kg/m² válido en todo el espectro de tallas)
    const heightM = validHeight / 100;
    const lemmensIdealWeight = 22.0 * (heightM * heightM);

    // Peso Ajustado: PI + 25% del exceso de peso metabólicamente inactivo
    const adjustedWeight = idealWeight > 0 && validWeight > idealWeight
        ? idealWeight + 0.25 * (validWeight - idealWeight)
        : validWeight;

    return {
        idealWeight: Number(idealWeight.toFixed(2)),
        lemmensIdealWeight: Number(lemmensIdealWeight.toFixed(2)),
        adjustedWeight: Number(adjustedWeight.toFixed(2))
    };
}

/**
 * Árbol de Decisiones Matemáticas para Cálculo Bioenergético:
 * 1. Lactantes/Pediátricos (< 18 años) -> OMS / Schofield
 * 2. Adultos con % Grasa / Masa Muscular -> Katch-McArdle (MLG)
 * 3. Adultos con IMC >= 35 sin bioimpedancia -> Mifflin-St Jeor con Peso Ajustado (Devine Bidireccional)
 * 4. Adultos estándar sin bioimpedancia -> Mifflin-St Jeor Estándar
 */
function calculatePrecisionBioenergetics(patientData, ageYears, ageMonths, isLactanteExplicit, isPediatricExplicit) {
    const rawWeight = parseFloat(patientData?.vitals?.weight || patientData?.peso || patientData?.biometria?.peso || patientData?.profile?.weight) || (isLactanteExplicit ? 9.5 : 72);
    const rawHeight = parseFloat(patientData?.vitals?.height || patientData?.talla || patientData?.biometria?.talla || patientData?.profile?.height) || (isLactanteExplicit ? 74 : 168);
    const heightCm = rawHeight < 3 ? rawHeight * 100 : rawHeight;
    const heightM = heightCm / 100;
    const bmi = heightM > 0 ? Number((rawWeight / (heightM * heightM)).toFixed(1)) : 24.0;

    const gender = patientData?.sex || patientData?.genero || patientData?.profile?.gender || patientData?.identificacion?.genero || 'Masculino';
    const gStr = String(gender).toLowerCase();
    const isMale = gStr.startsWith('masc') || gStr === 'hombre' || gStr === 'm';

    const weights = calculatePrecisionWeights(rawWeight, heightCm, gender);

    // Detectar % de Grasa Corporal (Fase 16 o Electret)
    const bodyFatRaw = parseFloat(
        patientData?.vitals?.body_fat ||
        patientData?.biometria?.grasa_corporal ||
        patientData?.biometria?.porcentaje_grasa ||
        patientData?.metrics?.body_fat ||
        0
    );
    const hasBioimpedanceFat = !isNaN(bodyFatRaw) && bodyFatRaw >= 4 && bodyFatRaw <= 65;

    let bmr = 1500;
    let equationUsed = 'Mifflin-St Jeor Estándar';
    let formulaExplanation = '';
    let leanBodyMassKg = null;

    if (isLactanteExplicit || isPediatricExplicit || ageYears < 18) {
        equationUsed = 'OMS / Schofield Pediátrica';
        if (ageYears < 3) {
            bmr = isMale ? (59.512 * rawWeight) - 30.4 : (58.317 * rawWeight) - 31.1;
            bmr += isLactanteExplicit ? 180 : 120; // Reserva energética de crecimiento L-OMS
        } else if (ageYears < 10) {
            bmr = isMale ? (22.706 * rawWeight) + 504.3 : (20.315 * rawWeight) + 485.9;
        } else {
            bmr = isMale ? (17.686 * rawWeight) + 658.2 : (13.384 * rawWeight) + 692.6;
        }
        formulaExplanation = `Cálculo pediátrico OMS/Schofield para ${ageYears < 2 ? `${ageMonths || 12} meses` : `${ageYears} años`} con peso ${rawWeight} kg.`;
    } else if (hasBioimpedanceFat) {
        equationUsed = 'Katch-McArdle (Masa Libre de Grasa)';
        leanBodyMassKg = Number((rawWeight * (1 - (bodyFatRaw / 100))).toFixed(2));
        bmr = 370 + (21.6 * leanBodyMassKg);
        formulaExplanation = `Basada en Masa Libre de Grasa (MLG: ${leanBodyMassKg} kg | Grasa: ${bodyFatRaw}%): TMB = 370 + (21.6 × ${leanBodyMassKg}).`;
    } else if (bmi >= 35) {
        equationUsed = 'Mifflin-St Jeor con Peso Ajustado (Devine Bidireccional)';
        const s = isMale ? 5 : -161;
        bmr = (10 * weights.adjustedWeight) + (6.25 * heightCm) - (5 * ageYears) + s;
        formulaExplanation = `IMC ${bmi} kg/m² (≥ 35): Se utilizó Peso Ajustado (${weights.adjustedWeight} kg) derivado de Peso Ideal Devine (${weights.idealWeight} kg).`;
    } else {
        equationUsed = 'Mifflin-St Jeor Estándar';
        const s = isMale ? 5 : -161;
        bmr = (10 * rawWeight) + (6.25 * heightCm) - (5 * ageYears) + s;
        formulaExplanation = `Basada en Peso Actual (${rawWeight} kg), Estatura (${heightCm} cm), Edad (${ageYears} años) y Sexo (${isMale ? '+5' : '-161'}).`;
    }

    bmr = Math.max(isLactanteExplicit ? 450 : 950, Math.round(bmr));

    // Factor de Actividad Física (PAL) cruzando Fase 1 y Fase 11
    const actStr = String(
        patientData?.activity_level ||
        patientData?.physical_activity ||
        patientData?.habits?.activity_level ||
        patientData?.profile?.activity_level ||
        'LIGERO'
    ).toUpperCase();

    let pal = 1.375;
    if (isLactanteExplicit) pal = 1.25;
    else if (actStr.includes('SEDENTARIO') || actStr.includes('NULA')) pal = 1.2;
    else if (actStr.includes('MODERAD') || actStr.includes('ACTIVO')) pal = 1.55;
    else if (actStr.includes('INTENS') || actStr.includes('ATLETA') || actStr.includes('ALTO')) pal = 1.725;

    const tdee = Math.round(bmr * pal);

    // Determinación del Objetivo Calórico (Target)
    let targetKcal = tdee;
    let caloricDeltaType = 'MANTENIMIENTO_RECOMPOSICION';
    if (!isLactanteExplicit && !isPediatricExplicit) {
        if (bmi >= 30) {
            targetKcal = Math.max(1250, tdee - 450);
            caloricDeltaType = 'DEFICIT_TERAPEUTICO_MODERADO (-450 kcal)';
        } else if (bmi >= 25.5) {
            targetKcal = Math.max(1300, tdee - 300);
            caloricDeltaType = 'DEFICIT_RECOMPOSICION_SUAVE (-300 kcal)';
        } else if (bmi < 18.5) {
            targetKcal = tdee + 300;
            caloricDeltaType = 'SUPERAVIT_ANABOLICO (+300 kcal)';
        }
    }

    // Distribución de Macronutrientes personalizada
    let macros = { carbs: 40, protein: 30, fat: 30 };
    if (isLactanteExplicit) {
        macros = { carbs: 50, protein: 15, fat: 35 };
    } else if (isPediatricExplicit) {
        macros = { carbs: 50, protein: 20, fat: 30 };
    } else if (ageYears >= 65) {
        macros = { carbs: 45, protein: 25, fat: 30 };
    } else if (bmi >= 27) {
        macros = { carbs: 35, protein: 35, fat: 30 };
    }

    return {
        bmr,
        tdee,
        targetKcal,
        pal,
        bmi,
        weightKg: rawWeight,
        heightCm,
        leanBodyMassKg,
        bodyFatPct: hasBioimpedanceFat ? bodyFatRaw : null,
        weights,
        equationUsed,
        formulaExplanation,
        caloricDeltaType,
        macros
    };
}

// ============================================================================
// 3. DESTILADOR DE "SUERO CLÍNICO" (REDUCCIÓN DE RUIDO HOMEOSTÁTICO)
// ============================================================================
/**
 * Extrae únicamente las anomalías reales de las Fases 1-18 (ignorando los valores
 * en rango NORMAL de Electret y OCR) y las organiza en las 7 Micro-Cápsulas IFM.
 */
function distillClinicalSerum(patientData, isLactanteExplicit = false) {
    const nodesMap = {
        NODO_1_ASIMILACION: {
            id: 'NODO_1_ASIMILACION',
            number: 1,
            name: '1. Asimilación y Barrera Intestinal',
            anomalies: []
        },
        NODO_2_BIOTRANSFORMACION: {
            id: 'NODO_2_BIOTRANSFORMACION',
            number: 2,
            name: '2. Biotransformación y Eliminación Hepatorrenal',
            anomalies: []
        },
        NODO_3_ENERGIA: {
            id: 'NODO_3_ENERGIA',
            number: 3,
            name: '3. Bioenergética Mitocondrial y Metabolismo Lipídico-Glucémico',
            anomalies: []
        },
        NODO_4_COMUNICACION: {
            id: 'NODO_4_COMUNICACION',
            number: 4,
            name: '4. Comunicación Neuroendocrina y Ritmo Circadiano',
            anomalies: []
        },
        NODO_5_TRANSPORTE: {
            id: 'NODO_5_TRANSPORTE',
            number: 5,
            name: '5. Transporte Cardiovascular y Reología Microcirculatoria',
            anomalies: []
        },
        NODO_6_DEFENSA: {
            id: 'NODO_6_DEFENSA',
            number: 6,
            name: '6. Defensa Inmunológica, Piel y Respuesta Inflamatoria',
            anomalies: []
        },
        NODO_7_ESTRUCTURAL: {
            id: 'NODO_7_ESTRUCTURAL',
            number: 7,
            name: '7. Integridad Estructural, Matriz Ósea y Biotensegridad',
            anomalies: []
        }
    };

    const pushAnomaly = (nodeKey, source, label, detail, severity = 'MODERADA') => {
        if (!label && !detail) return;
        nodesMap[nodeKey].anomalies.push({
            source,
            label: String(label || '').trim(),
            detail: String(detail || '').trim(),
            severity
        });
    };

    // A. Anomalías de Entrevista Clínica (Fases 5, 6, 7, 8, 12, 13)
    const digestiveProfile = patientData?.digestive_profile || {};
    if (digestiveProfile.has_issues || patientData?.history?.has_digestive_issues || (Array.isArray(digestiveProfile.symptoms) && digestiveProfile.symptoms.length > 0)) {
        const symp = Array.isArray(digestiveProfile.symptoms) ? digestiveProfile.symptoms.join(', ') : (digestiveProfile.phenotype || 'Sintomatología digestiva reportada');
        pushAnomaly('NODO_1_ASIMILACION', 'INTERVIEW', 'Disfunción Digestiva Declarada', symp, 'ALTA');
    }

    const foodAllergies = patientData?.history?.allergies?.food || [];
    foodAllergies.forEach(a => {
        const agent = typeof a === 'object' ? a.agent : a;
        if (agent) pushAnomaly('NODO_6_DEFENSA', 'INTERVIEW', `Alergia Alimentaria: ${agent}`, 'Hipersensibilidad declarada en Fase 7', 'CRÍTICA');
    });

    const drugAllergies = patientData?.history?.allergies?.drug || [];
    drugAllergies.forEach(a => {
        const agent = typeof a === 'object' ? a.agent : a;
        if (agent) pushAnomaly('NODO_6_DEFENSA', 'INTERVIEW', `Alergia Farmacológica: ${agent}`, 'Hipersensibilidad medicamentosa declarada en Fase 7', 'CRÍTICA');
    });

    // B. Anomalías de Laboratorio Clínico OCR (Paso 4 de Fase 18)
    const extMetrics = patientData?.scan_data?.external_metrics || {};
    const labSections = extMetrics.sections || {};
    const seenLabKeys = new Set();

    Object.entries(labSections).forEach(([secKey, secObj]) => {
        const items = Array.isArray(secObj?.items) ? secObj.items : (Array.isArray(secObj) ? secObj : []);
        items.forEach(item => {
            const st = String(item.status || '').toUpperCase();
            if (st && st !== 'NORMAL' && st !== 'OPTIMAL' && st !== 'OPTIMO' && st !== 'NEGATIVO') {
                const name = item.name || item.label || item.parameter || 'Biomarcador';
                seenLabKeys.add(name.toUpperCase());
                const detail = `${item.value ?? ''} ${item.unit || ''} (Ref: ${item.ref || item.reference || 'N/A'} | Estado: ${st})`.trim();
                const upperName = `${secKey} ${name}`.toUpperCase();

                if (upperName.includes('COLESTEROL') || upperName.includes('LDL') || upperName.includes('HDL') || upperName.includes('TRIGLIC') || upperName.includes('ATEROG') || upperName.includes('GLUCOSA') || upperName.includes('INSULINA') || upperName.includes('HBA1C')) {
                    pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', name, detail, 'ALTA');
                } else if (upperName.includes('BASÓFIL') || upperName.includes('BASOFIL') || upperName.includes('LEUCOCIT') || upperName.includes('EOSIN') || upperName.includes('LINFOCIT') || upperName.includes('NEUTRÓFIL') || upperName.includes('PCR')) {
                    pushAnomaly('NODO_6_DEFENSA', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('HEMOGLOBINA') || upperName.includes('HEMATOCRITO') || upperName.includes('ERITROCIT') || upperName.includes('PLAQUETA') || upperName.includes('HIERRO')) {
                    pushAnomaly('NODO_5_TRANSPORTE', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('CREATININA') || upperName.includes('UREA') || upperName.includes('BUN') || upperName.includes('ÁCIDO ÚRICO') || upperName.includes('AST') || upperName.includes('ALT') || upperName.includes('GGT') || upperName.includes('BILIRRUBINA') || upperName.includes('ORINA')) {
                    pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('TSH') || upperName.includes('T3') || upperName.includes('T4') || upperName.includes('CORTISOL')) {
                    pushAnomaly('NODO_4_COMUNICACION', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('CALCIO') || upperName.includes('VITAMINA D') || upperName.includes('MAGNESIO') || upperName.includes('FÓSFORO')) {
                    pushAnomaly('NODO_7_ESTRUCTURAL', 'OCR_LAB', name, detail, 'MODERADA');
                } else {
                    pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', name, detail, 'MODERADA');
                }
            }
        });
    });

    // Fallback si biomarkers planos en external_metrics contienen alertas no listadas en sections
    const flatLabs = extMetrics.biomarkers || extMetrics.labs || patientData?.lab_results || {};
    Object.entries(flatLabs).forEach(([k, v]) => {
        if (!v || typeof v !== 'object') return;
        const st = String(v.status || '').toUpperCase();
        const name = v.name || v.label || k;
        if (st && st !== 'NORMAL' && st !== 'OPTIMAL' && !seenLabKeys.has(name.toUpperCase())) {
            const detail = `${v.value ?? ''} ${v.unit || ''} (${st})`.trim();
            const upperName = name.toUpperCase();
            if (upperName.includes('COLESTEROL') || upperName.includes('LDL') || upperName.includes('ATEROG') || upperName.includes('GLUCOSA')) {
                pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', name, detail, 'ALTA');
            } else if (upperName.includes('BASÓFIL') || upperName.includes('BASOFIL') || upperName.includes('LEUCOCIT')) {
                pushAnomaly('NODO_6_DEFENSA', 'OCR_LAB', name, detail, 'MODERADA');
            } else {
                pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', name, detail, 'MODERADA');
            }
        }
    });

    // C. Anomalías de Bioimpedancia Cuántica Electret (Paso 1 de Fase 18)
    const electretCats = patientData?.scan_data?.electret_metrics || patientData?.electretTelemetry?.categories || {};
    let hasHighSerumCalciumOrCalcification = false;

    if (electretCats && typeof electretCats === 'object') {
        Object.entries(electretCats).forEach(([catKey, catData]) => {
            const items = Array.isArray(catData?.items) ? catData.items : (Array.isArray(catData) ? catData : []);
            items.forEach(item => {
                const st = String(item.status || item.level || '').toUpperCase();
                if (st && st !== 'NORMAL' && st !== 'OPTIMAL' && st !== 'NORMALES') {
                    const pName = item.name || item.parameter || item.label || catKey;
                    const valStr = `${item.value ?? item.actual ?? ''} (Ref: ${item.range || item.standard || 'N/A'} | ${st})`.trim();
                    const upper = `${catKey} ${pName}`.toUpperCase();

                    if (upper.includes('CALCIO') || upper.includes('CALCIFICACIÓN') || upper.includes('OSTEOCALCINA')) {
                        hasHighSerumCalciumOrCalcification = true;
                    }

                    if (upper.includes('GASTRO') || upper.includes('INTESTIN') || upper.includes('PEPSINA') || upper.includes('ABSORCIÓN')) {
                        pushAnomaly('NODO_1_ASIMILACION', 'ELECTRET', pName, valStr, 'MODERADA');
                    } else if (upper.includes('HÍGADO') || upper.includes('HIGADO') || upper.includes('RENAL') || upper.includes('RIÑÓN') || upper.includes('VESÍCULA') || upper.includes('TOXINA') || upper.includes('METAL')) {
                        pushAnomaly('NODO_2_BIOTRANSFORMACION', 'ELECTRET', pName, valStr, 'MODERADA');
                    } else if (upper.includes('COLESTEROL') || upper.includes('LÍPIDO') || upper.includes('GLUCOSA') || upper.includes('INSULINA') || upper.includes('COENZIMA') || upper.includes('OBESIDAD')) {
                        pushAnomaly('NODO_3_ENERGIA', 'ELECTRET', pName, valStr, 'ALTA');
                    } else if (upper.includes('ENDOCRIN') || upper.includes('TIROID') || upper.includes('CEREBR') || upper.includes('PINEAL') || upper.includes('HORMON')) {
                        pushAnomaly('NODO_4_COMUNICACION', 'ELECTRET', pName, valStr, 'MODERADA');
                    } else if (upper.includes('CARDIO') || upper.includes('VASCULAR') || upper.includes('VISCOSIDAD') || upper.includes('PERFUSIÓN') || upper.includes('SANGUÍN')) {
                        pushAnomaly('NODO_5_TRANSPORTE', 'ELECTRET', pName, valStr, 'ALTA');
                    } else if (upper.includes('INMUN') || upper.includes('ALERG') || upper.includes('PIEL') || upper.includes('AMINO')) {
                        pushAnomaly('NODO_6_DEFENSA', 'ELECTRET', pName, valStr, 'MODERADA');
                    } else {
                        pushAnomaly('NODO_7_ESTRUCTURAL', 'ELECTRET', pName, valStr, 'MODERADA');
                    }
                }
            });
        });
    }

    // D. Hallazgos de Auditoría Ocular Binocular (Paso 2 de Fase 18)
    const ocular = patientData?.scan_data?.ocular_metrics;
    if (ocular && ocular.status !== 'SKIPPED') {
        const ocSeverity = String(ocular.severity || 'LOW').toUpperCase();
        const ocFindings = ocular.findings || ocular.summary || '';
        const ocFlags = Array.isArray(ocular.clinical_flags) ? ocular.clinical_flags.join(', ') : '';
        if (ocFindings || ocFlags) {
            pushAnomaly('NODO_5_TRANSPORTE', 'OCULAR_VISION', 'Trofismo Microvascular Escleral/Conjuntival', `${ocFindings} ${ocFlags ? `[${ocFlags}]` : ''}`.trim(), ocSeverity === 'HIGH' ? 'ALTA' : 'MODERADA');
        }
    }

    // E. Hallazgos de Glosodiagnóstico 6 Ejes (Paso 3 de Fase 18)
    const lingual = patientData?.scan_data?.lingual_metrics;
    if (lingual && lingual.status !== 'SKIPPED') {
        const lgFindings = lingual.findings || lingual.summary || '';
        const lgFlags = Array.isArray(lingual.clinical_flags) ? lingual.clinical_flags.join(', ') : '';
        if (lgFindings || lgFlags) {
            pushAnomaly('NODO_1_ASIMILACION', 'LINGUAL_VISION', 'Glosodiagnóstico Dorsal/Ventral', `${lgFindings} ${lgFlags ? `[${lgFlags}]` : ''}`.trim(), 'MODERADA');
        }
        if (String(lgFindings).toUpperCase().includes('RANINA') || String(lgFindings).toUpperCase().includes('ESTASIS') || String(lgFindings).toUpperCase().includes('VENOSA')) {
            pushAnomaly('NODO_5_TRANSPORTE', 'LINGUAL_VISION', 'Red Venosa Sublingual (Venas Raninas)', lgFindings, 'MODERADA');
        }
    }

    // F. Hallazgos de Evidencia Somática Multi-Foto (Paso 5 de Fase 18)
    const visual = patientData?.scan_data?.visual_metrics;
    if (visual && visual.status !== 'SKIPPED') {
        const items = Array.isArray(visual.items) ? visual.items : [];
        if (items.length > 0) {
            items.forEach((it, idx) => {
                const flagsStr = Array.isArray(it.clinical_flags) ? it.clinical_flags.join(', ') : '';
                pushAnomaly(
                    'NODO_6_DEFENSA',
                    'SOMATIC_VISION',
                    `Evidencia Somática #${idx + 1} (${it.region || 'Región Cutánea'})`,
                    `${it.finding || ''} ${flagsStr ? `[Banderas: ${flagsStr}]` : ''}`.trim(),
                    String(it.severity || visual.severity || 'MODERADA').toUpperCase()
                );
            });
        } else if (visual.findings) {
            const flagsStr = Array.isArray(visual.clinical_flags) ? visual.clinical_flags.join(', ') : '';
            pushAnomaly('NODO_6_DEFENSA', 'SOMATIC_VISION', 'Evidencia Somática Cutánea', `${visual.findings} ${flagsStr ? `[${flagsStr}]` : ''}`.trim(), 'MODERADA');
        }
    }

    // Construir arreglo final de las 7 Micro-Cápsulas IFM con CIE-10 determinista pre-asignado
    const nodes = Object.values(nodesMap).map(node => {
        const hasAnomalies = node.anomalies.length > 0;
        const resolvedCie = resolveCie10ForNode(node.id, node.anomalies, isLactanteExplicit);
        return {
            ...node,
            hasAnomalies,
            preAssignedCie10: resolvedCie.cie10,
            preAssignedLabel: resolvedCie.label,
            validation_status: resolvedCie.validation_status
        };
    });

    return {
        nodes,
        hasHighSerumCalciumOrCalcification
    };
}

// ============================================================================
// 4. SÍNTESIS POR LOTE CON PROMISE.ALLSETTLED + DELAY 800ms + RESPONSESCHEMA
// ============================================================================
const IFM_NODE_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        nodeId: { type: 'STRING', description: 'Identificador exacto del Nodo IFM' },
        status: { type: 'STRING', enum: ['HOMEOSTASIS', 'ALERTA_MODERADA', 'PRIORIDAD_ALTA', 'CRÍTICO'] },
        cie10: { type: 'STRING', description: 'Código CIE-10 determinista pre-asignado' },
        validation_status: { type: 'STRING', enum: ['VALIDADO', 'REQUIERE_REVISIÓN'] },
        summary: { type: 'STRING', description: 'Narrativa fisiopatológica clínica concisa en español (1 a 2 oraciones)' },
        key_biomarkers: {
            type: 'ARRAY',
            items: { type: 'STRING' }
        },
        therapeutic_focus: { type: 'STRING', description: 'Directriz terapéutica clínica en español para este nodo' }
    },
    required: ['nodeId', 'status', 'cie10', 'validation_status', 'summary', 'key_biomarkers', 'therapeutic_focus']
};

/**
 * Invoca a gemini-2.5-flash con temperature: 0.1 y responseSchema estricto
 * para sintetizar una micro-cápsula IFM individual con sus anomalías purificadas.
 */
async function synthesizeNodeWithGemini(node, ai) {
    const anomalyListText = node.anomalies
        .map((a, idx) => `${idx + 1}. [${a.source}] ${a.label}: ${a.detail}`)
        .join('\n');

    const prompt = `Eres el motor médico funcional CORTEX v2.4 (Cumplimiento NOM-004-SSA3-2012).
Analiza exclusivamente las siguientes anomalías detectadas en el "${node.name}" y genera la síntesis clínica en español.
Respeta de forma inmutable el código CIE-10 pre-asignado "${node.preAssignedCie10}" y el estado de validación "${node.validation_status}".

ANOMALÍAS DETECTADAS EN ESTE NODO:
${anomalyListText}

INSTRUCCIONES:
- nodeId debe ser exactamente "${node.id}".
- cie10 debe ser exactamente "${node.preAssignedCie10}".
- validation_status debe ser exactamente "${node.validation_status}".
- En summary redacta en español clínico conciso la correlación fisiopatológica de estos hallazgos reales.
- En key_biomarkers incluye los nombres y valores exactos de los biomarcadores o signos alterados de la lista superior.
- En therapeutic_focus indica la intervención nutricional o funcional específica para este nodo.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.1,
            topP: 0.8,
            responseMimeType: 'application/json',
            responseSchema: IFM_NODE_RESPONSE_SCHEMA
        }
    });

    if (!response || !response.text) {
        throw new Error(`Respuesta vacía de Gemini en nodo ${node.id}`);
    }

    const parsed = JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
    return {
        nodeId: node.id,
        nodeName: node.name,
        status: parsed.status || 'ALERTA_MODERADA',
        cie10: node.preAssignedCie10,
        validation_status: node.validation_status,
        summary: parsed.summary || `${node.preAssignedLabel}. Hallazgos: ${node.anomalies.map(a => a.label).join(', ')}.`,
        key_biomarkers: Array.isArray(parsed.key_biomarkers) ? parsed.key_biomarkers : node.anomalies.map(a => `${a.label}: ${a.detail}`),
        therapeutic_focus: parsed.therapeutic_focus || 'Modulación nutricional focalizada y monitoreo de biomarcadores.'
    };
}

/**
 * Procesa los Nodos IFM en lotes para respetar el Rate Limit de Gemini,
 * utilizando Promise.allSettled, enfriamiento de 800 ms e isomorfismo de contrato.
 * @param {Array} nodes - Arreglo con las 7 micro-cápsulas IFM.
 * @param {Object} ai - Instancia de GoogleGenAI (o null si opera offline).
 * @param {number} batchSize - Límite de concurrencia (Recomendado: 3).
 * @returns {Promise<Array>} Resultados de los Nodos procesados con firma 100% uniforme.
 */
async function processCortexNodesInBatches(nodes, ai, batchSize = 3) {
    const finalDossierResults = [];

    for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        const batchHasActiveNetworkCalls = Boolean(ai) && batch.some(n => n.hasAnomalies);

        // Ejecución concurrente controlada por lote con Promise.allSettled
        const batchResults = await Promise.allSettled(
            batch.map(async (node) => {
                // Resolución en 0 ms si el nodo está en homeostasis (Contrato Isomórfico Completo)
                if (!node.hasAnomalies) {
                    return {
                        nodeId: node.id,
                        nodeName: node.name,
                        status: 'HOMEOSTASIS',
                        cie10: node.preAssignedCie10 || 'Z00.0',
                        validation_status: 'VALIDADO',
                        summary: 'Función conservada. Sin alteraciones detectadas.',
                        key_biomarkers: [],
                        therapeutic_focus: 'Mantenimiento preventivo y vigilancia estándar.'
                    };
                }

                // Si no hay instancia de IA disponible, sintetizar determinísticamente con los biomarcadores reales
                if (!ai) {
                    return {
                        nodeId: node.id,
                        nodeName: node.name,
                        status: 'PRIORIDAD_ALTA',
                        cie10: node.preAssignedCie10,
                        validation_status: node.validation_status,
                        summary: `${node.preAssignedLabel}. Hallazgos clínicos documentados: ${node.anomalies.map(a => `${a.label} (${a.detail})`).join('; ')}.`,
                        key_biomarkers: node.anomalies.map(a => `${a.label}: ${a.detail}`),
                        therapeutic_focus: 'Intervención nutricional selectiva basada en anomalías cuantificadas.'
                    };
                }

                // Llamada a la API de Gemini con temperature: 0.1 y responseSchema estricto
                return await synthesizeNodeWithGemini(node, ai);
            })
        );

        // Evaluación de resiliencia post-lote (Contrato Isomórfico Completo en Contingencia)
        batchResults.forEach((outcome, index) => {
            if (outcome.status === 'fulfilled') {
                finalDossierResults.push({
                    ...outcome.value,
                    key_biomarkers: Array.isArray(outcome.value?.key_biomarkers) ? outcome.value.key_biomarkers : [],
                    therapeutic_focus: outcome.value?.therapeutic_focus || 'Mantenimiento preventivo y vigilancia estándar.'
                });
            } else {
                const failedNode = batch[index];
                console.error(`[CORTEX ERROR] Falla en síntesis del Nodo ${failedNode.id}:`, outcome.reason?.message || outcome.reason);
                finalDossierResults.push({
                    nodeId: failedNode.id,
                    nodeName: failedNode.name,
                    status: 'ERROR_SINTESIS',
                    error: 'SÍNTESIS_PENDIENTE',
                    cie10: failedNode.preAssignedCie10 || 'REQUIERE_REVISIÓN',
                    validation_status: 'REQUIERE_REVISIÓN',
                    summary: `SÍNTESIS_PENDIENTE (${failedNode.preAssignedLabel}): Hubo una interrupción de red al analizar esta cápsula. Los datos crudos han sido preservados: ${failedNode.anomalies.map(a => `${a.label}: ${a.detail}`).join('; ')}.`,
                    key_biomarkers: [],
                    therapeutic_focus: 'PENDIENTE DE EVALUACIÓN MÉDICA. Revisar anomalías crudas.',
                    rawAnomaliesPreserved: failedNode.anomalies
                });
            }
        });

        // Enfriamiento de tasa de transferencia (800 ms) antes del siguiente lote si hubo llamadas de red
        if (batchHasActiveNetworkCalls && (i + batchSize < nodes.length)) {
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

    return finalDossierResults;
}

// ============================================================================
// 5. CONSTRUCTOR CENTRALIZADO DE PRESCRIPCIÓN ORTOMOLECULAR (33Plus® / 34Plus®)
// ============================================================================
function buildOrthomolecularPrescription(patientData, processedNodes, serum, bioenergetics, hasStimulantsConflict) {
    const node3 = processedNodes.find(n => n.nodeId === 'NODO_3_ENERGIA');
    const node5 = processedNodes.find(n => n.nodeId === 'NODO_5_TRANSPORTE');
    const node6 = processedNodes.find(n => n.nodeId === 'NODO_6_DEFENSA');
    const node7 = processedNodes.find(n => n.nodeId === 'NODO_7_ESTRUCTURAL');

    const energyBiomarkers = [...(node3?.key_biomarkers || []), ...(node5?.key_biomarkers || [])].slice(0, 4);
    const tissueBiomarkers = [...(node6?.key_biomarkers || []), ...(node7?.key_biomarkers || [])].slice(0, 4);

    const sup33 = hasStimulantsConflict
        ? {
            id: 'sup_33plus',
            cortex: '33Plus® (Modulación Mitocondrial con Candado NOM-028)',
            name: 'L-Teanina Pura + Picolinato de Cromo (Protocolo Libre de Estimulantes)',
            dosage: '150 mg L-Teanina + 200 mcg Cromo al día',
            timing: 'Por la mañana con el primer alimento',
            rationale: `⚠️ BLOQUEO DE BIOSEGURIDAD (NOM-028): Se suspendieron xantinas/termogénicos por interacción farmacológica o sensibilidad simpaticomimética. Se indica modulación nootrópica y sensibilidad insulínica libre de estimulantes${energyBiomarkers.length > 0 ? ` para atender: ${energyBiomarkers.join(' | ')}` : ''}.`,
            status: 'approved'
        }
        : {
            id: 'sup_33plus',
            cortex: '33Plus® (Ignición Mitocondrial y Reología Vascular)',
            name: '33 PLUS® - Polifenoles de Semilla de Uva, CoQ10, Cromo (200mcg) y L-Teanina',
            dosage: '1 toma al día (disuelto en 250 ml de agua temp. ambiente)',
            timing: 'Por la mañana con el primer alimento',
            rationale: energyBiomarkers.length > 0
                ? `Prescripción dirigida por hallazgos en expediente (${energyBiomarkers.join(' | ')}): optimiza la oxidación de lipoproteínas aterogénicas (LDL/sdLDL), reduce la viscosidad sanguínea y mejora la perfusión endotelial diurna.`
                : 'Optimización de microcirculación, oxigenación tisular diurna y sensibilidad a la insulina.',
            status: 'approved'
        };

    const sup34 = {
        id: 'sup_34plus',
        cortex: '34Plus® (Ingeniería Tisular y Homeostasis Mucosa)',
        name: '34 PLUS® - Péptidos de Colágeno Hidrolizado, Vitamina C, L-Arginina e Inulina Prebiótica',
        dosage: '1 toma al día (disuelto en MÍNIMO 500 ml de agua 💧)',
        timing: 'Por la noche (60 min antes de dormir)',
        rationale: tissueBiomarkers.length > 0
            ? `Prescripción dirigida por hallazgos tisulares/inmunológicos (${tissueBiomarkers.join(' | ')}): promueve la regeneración de la barrera epitelial y matriz dérmica durante el sueño profundo. La dilución en 500 ml de agua es obligatoria para proteger el vaciado gástrico y el aclaramiento glinfático.`
            : 'Reparación de matriz extracelular y trofismo mucoso nocturno. Dilución obligatoria en 500 ml de agua para favorecer el aclaramiento glinfático.',
        status: 'approved'
    };

    return {
        supplements: [sup33, sup34],
        has_calcium_contraction_lock: Boolean(serum.hasHighSerumCalciumOrCalcification),
        calcium_alert_text: serum.hasHighSerumCalciumOrCalcification
            ? 'Se detectaron indicadores de sobrecarga cálcica o calcificación tisular en telemetría. Se contraindican sales de calcio inorgánico aisladas y se prioriza direccionamiento con Vitamina K2 (MK-7) + Magnesio.'
            : null,
        bioenergetics_summary: bioenergetics
    };
}

/**
 * POST /api/cortex/synthesize-dossier
 * Arquitectura Híbrida Neuro-Simbólica v2.4:
 * 1. Tronco Encefálico Determinista (Compuertas Duras, Destilación de Suero Clínico en 7 Nodos IFM,
 *    Diccionario CIE-10 con Fallback R79.9/R89.9 y Árbol Bioenergético Devine-Lemmens / Katch-McArdle / Schofield).
 * 2. Inferencia Concurrente Controlada por Lotes (Promise.allSettled, batchSize = 3, delay 800 ms,
 *    temperature: 0.1, responseSchema estricto e Isomorfismo Estructural Completo).
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

        const clinicalFlags = patientData.clinical_flags || [];
        const foodAllergies = patientData.history?.allergies?.food || [];
        const drugAllergies = patientData.history?.allergies?.drug || [];
        const medications = patientData.history?.medications || [];

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

        const isLactanteExplicit = (ageYears < 2) && Boolean(
            patientData.isLactante ||
            patientData.profile?.pediatric_profile?.is_lactante ||
            (dobDate !== null && ageMonths >= 0 && ageMonths < 24)
        );

        const isPediatricExplicit = (ageYears < 18) && Boolean(
            patientData.isPediatrico ||
            patientData.profile?.pediatric_profile?.is_minor ||
            patientData.profile?.pediatric_profile?.is_pediatric ||
            isLactanteExplicit
        );

        if (isNaN(ageYears) || ageYears < 0) {
            ageYears = isLactanteExplicit ? 0 : (isPediatricExplicit ? 10 : 30);
        }

        // ==========================================
        // 2. DESTILACIÓN DEL SUERO CLÍNICO Y ÁRBOL BIOENERGÉTICO
        // ==========================================
        const serum = distillClinicalSerum(patientData, isLactanteExplicit);
        const bioenergetics = calculatePrecisionBioenergetics(patientData, ageYears, ageMonths, isLactanteExplicit, isPediatricExplicit);

        // ==========================================
        // 3. CASCADA DE ENRUTAMIENTO PEDIÁTRICO / ADULTO
        // ==========================================
        let determinedRoute = "RUTA_D";
        const hasLipidOrGlycemicAlert = serum.nodes.find(n => n.id === 'NODO_3_ENERGIA')?.hasAnomalies || false;

        if (ageYears < 18 && (isLactanteExplicit || isPediatricExplicit)) {
            determinedRoute = "RUTA_A";
        } else {
            const reasonText = String(patientData.reason_for_consultation || patientData.motivo || patientData.history?.primaryRoute || "").toUpperCase();
            if (hasLipidOrGlycemicAlert || bioenergetics.bmi >= 25 || reasonText.includes("PESO") || reasonText.includes("GRASA") || reasonText.includes("DIABETES") || reasonText.includes("COLESTEROL") || reasonText.includes("METABOLIC")) {
                determinedRoute = "RUTA_C";
            } else if (reasonText.includes("ENTRENAMIENTO") || reasonText.includes("VO2") || reasonText.includes("DOLOR") || reasonText.includes("POSTURA") || reasonText.includes("BIOMECANICA")) {
                determinedRoute = "RUTA_B";
            }
        }

        // 4. Compuertas Duras de Bioseguridad (Fármacos NOM-028, Esfuerzo y Lactantes)
        const activityLevel = String(
            patientData.activity_level ||
            patientData.physical_activity ||
            patientData.habits?.activity_level ||
            patientData.profile?.activity_level ||
            (isPediatricExplicit ? "JUEGO ACTIVO" : "SEDENTARIO")
        ).toUpperCase();

        const isSedentary = !isPediatricExplicit && (activityLevel.includes("SEDENTARIO") || activityLevel.includes("LIGERO") || activityLevel.includes("NULA"));
        const heartRate = parseInt(patientData.vitals?.heart_rate || patientData.vitals?.hr || (isLactanteExplicit ? 90 : 70), 10);
        const hasBradycardia = !isPediatricExplicit && heartRate < 60;
        const hasCardioFlags = !isPediatricExplicit && clinicalFlags.some(f => String(f).includes("BRADICARDIA") || String(f).includes("CARDIO"));
        const isExerciseRestricted = !isPediatricExplicit && (isSedentary || ageYears >= 55 || hasBradycardia || hasCardioFlags);

        const hasStimulantsConflict = medications.some(m => {
            const mName = String(m?.name || m || '').toUpperCase();
            return ['FENTER', 'ACXION', 'TERFAMEX', 'CLONAZEPAM', 'DIAZEPAM', 'FLUOXETINA', 'SERTRALINA', 'ANSIOL', 'ANTIDEPRES', 'METILFENIDATO'].some(k => mName.includes(k));
        });

        let pediatricDisclaimer = "";
        if (isLactanteExplicit || ageMonths < 12 || ageYears < 1) {
            pediatricDisclaimer = "⚠️ DESCARGO REGULATORIO NOM-043/COFEPRIS: En lactantes menores de 1 año, la lactancia materna y la fórmula de continuación son la base nutricional primaria. Toda sugerencia de modulación nutricional celular (34Plus®) es de carácter orientativo y requiere validación explícita por el Pediatra tratante.";
        }

        let physicalStrategyText = "";
        if (isPediatricExplicit) {
            physicalStrategyText = "Estimulación Psicomotriz Pediátrica: Gateo Activo, Coordinación Motora Gruesa/Fina y Tiempo de Juego (Tummy Time para lactantes).";
        } else if (isExerciseRestricted) {
            physicalStrategyText = "Prescripción Adaptativa Ligera: NEAT (6,000–8,000 pasos/día) + Zona 2 Aeróbica Ligera + Readaptación Biomecánica (RIR >= 3-4). Prohibido Zona 5 HIIT.";
        } else {
            physicalStrategyText = "Lyon Protocol 2.0 + Decatlón Centenario (Zona 2 Oxidativa + Zona 5 VO2 Máx 4x4) + Protocolo Biomecánico 3 Fases.";
        }

        // ==========================================
        // 5. ORQUESTACIÓN RESILIENTE POR LOTES (Promise.allSettled + 800ms + responseSchema)
        // ==========================================
        let aiInstance = null;
        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            } catch (initErr) {
                console.warn("⚠️ No se pudo inicializar GoogleGenAI, operando en modo determinista local:", initErr.message);
            }
        }

        console.log(`🧠 CORTEX v2.4: Procesando 7 Micro-Cápsulas IFM en lotes (batchSize=3, delay=800ms, temp=0.1) para Ruta ${determinedRoute}...`);
        const processedIfmNodes = await processCortexNodesInBatches(serum.nodes, aiInstance, 3);

        // ==========================================
        // 6. ENSAMBLAJE DEL DOSSIER UNIFICADO E ISOMÓRFICO
        // ==========================================
        const orthomolecularPrescription = buildOrthomolecularPrescription(
            patientData,
            processedIfmNodes,
            serum,
            bioenergetics,
            hasStimulantsConflict
        );

        const preliminary_diagnosis = processedIfmNodes.map((n, idx) => {
            const auditTag = n.validation_status === 'REQUIERE_REVISIÓN' ? ' [⚠️ REQUIERE_REVISIÓN]' : '';
            return `${idx + 1}. ${n.nodeName.replace(/^\d+\.\s*/, '')}: ${n.summary} (${n.cie10})${auditTag}`;
        });

        const activeNodesWithAnomalies = processedIfmNodes.filter(n => n.status !== 'HOMEOSTASIS');
        const pName = patientData.profile?.name || patientData.profile?.first_name || patientData.identificacion?.nombre || patientData.identityLock?.patientInfo?.name || (isLactanteExplicit ? "tu bebé" : "Paciente");

        const diagnosticoCausaRaiz = isLactanteExplicit
            ? `Lactante de ${ageMonths || 11} meses en fase acelerada de crecimiento y desarrollo L-OMS. Constantes vitales dentro de parámetros normales (FC ${heartRate} LPM). Evaluación orientada a la maduración de la mucosa intestinal, tolerancia a alimentos sólidos y neurodesarrollo motor.`
            : (activeNodesWithAnomalies.length > 0
                ? activeNodesWithAnomalies.map(n => `• ${n.nodeName} (${n.cie10}): ${n.summary}`).join(' ')
                : 'Homeostasis funcional conservada en los 7 Nodos de la Matriz IFM (Z00.0).');

        const critical_alerts = [];
        if (isLactanteExplicit) {
            critical_alerts.push(`PROTOCOLO LACTANTE: Constantes vitales normales en escala PALS/OMS (FC ${heartRate} LPM). Prescrita Estimulación Psicomotriz.`);
        } else if (isExerciseRestricted) {
            critical_alerts.push("SAFEGUARD DE ESFUERZO ADULTO: Bloqueado entrenamiento en Zona 5 HIIT por perfil sedentario/hemodinámico. Prescrita Zona 2 Ligera + NEAT.");
        }

        if (hasStimulantsConflict) {
            critical_alerts.push("BLOQUEO FARMACOLÓGICO (NOM-028): Se detectaron fármacos activos con interacción simpaticomimética. Fórmula 33Plus® adaptada a protocolo libre de estimulantes.");
        }

        foodAllergies.forEach(a => {
            const agent = typeof a === 'object' ? a.agent : a;
            if (agent) critical_alerts.push(`ALERGIA ALIMENTARIA ESTRICTA: ${String(agent).toUpperCase()}`);
        });
        drugAllergies.forEach(a => {
            const agent = typeof a === 'object' ? a.agent : a;
            if (agent) critical_alerts.push(`ALERGIA MEDICAMENTOSA: ${String(agent).toUpperCase()}`);
        });

        // Alertas críticas derivadas de nodos con hallazgos
        activeNodesWithAnomalies.forEach(n => {
            if (Array.isArray(n.key_biomarkers) && n.key_biomarkers.length > 0) {
                critical_alerts.push(`ALERTA ${n.nodeName.toUpperCase()} (${n.cie10}): ${n.key_biomarkers.slice(0, 4).join(' | ')}`);
            }
        });

        const suggested_management = isLactanteExplicit ? [
            "1. Preservación de Lactancia Materna / Fórmula Pediátrica + Introducción Guiada de Sólidos (BLW/Papillas)",
            "2. Monitoreo Ponderal y Crecimiento Longitudinal (L-OMS)",
            "3. Estimulación Psicomotriz Activa y Tiempo de Juego (Tummy Time)",
            "4. Soporte Nutricional Pediátrico bajo Supervisión del Pediatra Tratante"
        ] : [
            ...activeNodesWithAnomalies.map((n, idx) => `${idx + 1}. [${n.nodeName} - ${n.cie10}] ${n.therapeutic_focus}`),
            `${activeNodesWithAnomalies.length + 1}. [Bioenergética ${bioenergetics.equationUsed}] TMB: ${bioenergetics.bmr} kcal | TDEE: ${bioenergetics.tdee} kcal | Meta Prescrita: ${bioenergetics.targetKcal} kcal (${bioenergetics.macros.carbs}% C / ${bioenergetics.macros.protein}% P / ${bioenergetics.macros.fat}% L).`,
            `${activeNodesWithAnomalies.length + 2}. [Readaptación Física] ${physicalStrategyText}`,
            `${activeNodesWithAnomalies.length + 3}. [Cronobiología Ortomolecular] ${orthomolecularPrescription.supplements[0].name} (Mañana) + ${orthomolecularPrescription.supplements[1].name} (Noche en 500 ml de agua 💧).`
        ];

        const payload = {
            doctrina_aplicada: determinedRoute === 'RUTA_A'
                ? 'RUTA_A: Endocrinología y Desarrollo Pediátrico L-OMS (Primeros 1000 Días)'
                : `${determinedRoute}: Medicina Funcional de Sistemas (Matriz IFM de 7 Nodos v2.4)`,
            diagnostico_causa_raiz: diagnosticoCausaRaiz,
            preliminary_diagnosis,
            ifm_nodes_matrix: processedIfmNodes,
            bioenergetics,
            orthomolecular_prescription: orthomolecularPrescription,
            critical_alerts,
            suggested_management,
            alertas_bioseguridad: critical_alerts.join(' • ') || (pediatricDisclaimer || 'Parámetros de bioseguridad verificados bajo la NOM-004-SSA3-2012.'),
            sistemas_afectados: activeNodesWithAnomalies.length > 0
                ? activeNodesWithAnomalies.map(n => `${n.nodeName.replace(/^\d+\.\s*/, '')} (${n.cie10})`)
                : ["Homeostasis Sistémica Conservada (Z00.0)"],
            estrategia_terapeutica: {
                nutricion_defensora: isLactanteExplicit
                    ? "Matriz de Nutrición Celular 34Plus® Pediátrica: Leche Materna / Fórmula de Continuación + Introducción Guiada de Sólidos (BLW / Papillas caseras)."
                    : `Prescripción Bioenergética (${bioenergetics.equationUsed}): TDEE ${bioenergetics.tdee} kcal → Meta ${bioenergetics.targetKcal} kcal/día (${bioenergetics.macros.carbs}% Carbohidratos / ${bioenergetics.macros.protein}% Proteínas / ${bioenergetics.macros.fat}% Lípidos) + Modulación endotelial y antiaterogénica.`,
                readaptacion_fisica: physicalStrategyText
            },
            guia_paciente_whatsapp: {
                titulo_resumen: isLactanteExplicit || isPediatricExplicit ? `🌱 El Crecimiento y Salud de ${pName}` : `🌱 Plan Médico-Nutricional de ${pName}`,
                pilar_salud_crecimiento: isLactanteExplicit
                    ? `El bebé se encuentra en desarrollo acelerado con constantes vitales normales en escala PALS/OMS (FC ${heartRate} LPM).`
                    : `Hemos integrado tus estudios de laboratorio, bioimpedancia y exploración clínica en los 7 Nodos de Medicina Funcional para atender de raíz cada indicador detectado.`,
                pilar_alimentacion_diaria: isLactanteExplicit
                    ? "Mantener lactancia materna o fórmula de continuación complementada con introducción guiada de sólidos (BLW)."
                    : `Tu requerimiento energético diario fue calculado con precisión (${bioenergetics.equationUsed}: ${bioenergetics.targetKcal} kcal/día), priorizando grasas cardioprotectoras, fibra soluble y proteínas de alto valor biológico.`,
                pilar_juegos_movimiento: isLactanteExplicit
                    ? "Estimulación psicomotriz diaria con juego libre, gateo activo y Tummy Time."
                    : physicalStrategyText,
                pilar_cuidados_suplementacion: isLactanteExplicit
                    ? "Monitoreo constante de crecimiento con su pediatra tratante bajo la NOM-043."
                    : `Protocolo Cronobiológico: ${orthomolecularPrescription.supplements[0].name} por la mañana y ${orthomolecularPrescription.supplements[1].name} por la noche disuelto en 500 ml de agua.`
            },
            human_approved_diagnosis: preliminary_diagnosis,
            human_approved_management: suggested_management,
            status: "SYNTHESIZED_READY_FOR_REVIEW"
        };

        // ==========================================
        // 7. PERSISTENCIA INMEDIATA EN SQLITE ANTE REFRESCO (F5)
        // ==========================================
        try {
            const stmtCheck = db.prepare('SELECT patient_data_snapshot FROM session_persistence WHERE citation_id = ?');
            const existingRow = stmtCheck.get(citationId.toString());
            if (existingRow) {
                const storedSnapshot = JSON.parse(existingRow.patient_data_snapshot || '{}');
                storedSnapshot.clinical_dossier = payload;
                const stmtUpdate = db.prepare(`
                    UPDATE session_persistence 
                    SET patient_data_snapshot = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE citation_id = ?
                `);
                stmtUpdate.run(JSON.stringify(storedSnapshot), citationId.toString());
            }
        } catch (persistErr) {
            console.warn("⚠️ No se pudo pre-guardar clinical_dossier en SQLite:", persistErr.message);
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
        originalManagement,
        ifmNodesMatrix,
        bioenergetics,
        orthomolecularPrescription
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

        const rlhf_deltas = {
            original_diagnosis: originalDiagnosis || [],
            approved_diagnosis: approvedDiagnosis || [],
            original_management: originalManagement || [],
            approved_management: approvedManagement || [],
            modified_at: new Date().toISOString()
        };

        patientData.clinical_dossier = {
            human_approved_diagnosis: approvedDiagnosis || [],
            human_approved_management: approvedManagement || [],
            ifm_nodes_matrix: ifmNodesMatrix || patientData.clinical_dossier?.ifm_nodes_matrix || [],
            bioenergetics: bioenergetics || patientData.clinical_dossier?.bioenergetics || null,
            orthomolecular_prescription: orthomolecularPrescription || patientData.clinical_dossier?.orthomolecular_prescription || null,
            additional_symptoms_reported: additionalSymptoms || "",
            rlhf_deltas,
            doctor_approval_timestamp: new Date().toISOString(),
            status: "READY_FOR_PHASE_20"
        };

        patientData.diagnosis_approved = true;

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

        console.log(`💾 [RLHF SUCCESS] Expediente v2.4 sellado con deltas de especialista para Cita #${citationId}`);
        res.json({ success: true, message: "Expediente sellado por el especialista con metadatos RLHF." });

    } catch (err) {
        console.error("🔥 Error en approveDossier:", err.message);
        res.status(500).json({ success: false, message: "Error al sellar el expediente clínico." });
    }
};

module.exports = {
    synthesizeDossier,
    approveDossier,
    calculatePrecisionWeights,
    calculatePrecisionBioenergetics,
    processCortexNodesInBatches
};
