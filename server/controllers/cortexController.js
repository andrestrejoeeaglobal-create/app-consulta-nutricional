const { db } = require('../db');
const cryptoVault = require('../utils/cryptoVault');

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

    // Declaración e inicialización estricta de variables de control clínico
    let hasHighSerumCalciumOrCalcification = false;

    // A. INGESTA DE FASE 3: MOTIVO PRINCIPAL & SUFRIMIENTO CLÍNICO
    const clinicalContext = patientData?.clinical_context || {};
    const patientQuote = clinicalContext.patient_quote || patientData?.motivo || "";
    const specificAilment = clinicalContext.specific_ailment || "";
    const emotionalAnchor = clinicalContext.emotional_anchor || "";
    if (patientQuote || specificAilment) {
        pushAnomaly('NODO_4_COMUNICACION', 'CHIEF_COMPLAINT', 'Motivo de Consulta y Carga Alostática', 
            `Voz del Paciente: "${patientQuote}". Afección específica: ${specificAilment}. Ancla emocional: ${emotionalAnchor}`, 'MODERADA');
    }

    // B. INGESTA DE FASE 4: ANTECEDENTES HEREDOFAMILIARES (AHF - Carga Genética)
    const rawFamily = patientData?.history?.family_structured || patientData?.history?.family_history || [];
    const familyHistory = Array.isArray(rawFamily) ? rawFamily : [];
    familyHistory.forEach(item => {
        const disease = (typeof item === 'object' ? item.disease || item.condicion : item) || '';
        const kin = (typeof item === 'object' ? item.relationship || item.parentesco : 'Familiar') || '';
        if (disease) {
            const upper = String(disease).toUpperCase();
            if (upper.includes('DIABET') || upper.includes('GLUCOSA') || upper.includes('METABOL')) {
                pushAnomaly('NODO_3_ENERGIA', 'AHF', `Carga Familiar: ${disease} (${kin})`, 'Riesgo genético metabólico y disglucemia', 'ALTA');
            } else if (upper.includes('HIPERTENSI') || upper.includes('INFARTO') || upper.includes('CARDIO')) {
                pushAnomaly('NODO_5_TRANSPORTE', 'AHF', `Carga Familiar: ${disease} (${kin})`, 'Predisposición a rigidez endotelial y riesgo cardiovascular', 'ALTA');
            } else if (upper.includes('CANCER') || upper.includes('AUTOINMUNE') || upper.includes('TIROID')) {
                pushAnomaly('NODO_6_DEFENSA', 'AHF', `Carga Familiar: ${disease} (${kin})`, 'Vulnerabilidad inflamatoria / inmunológica', 'MODERADA');
            }
        }
    });

    // C. INGESTA DE FASES 5 Y 6: ANTECEDENTES PATOLÓGICOS PERSONALES (APP) Y CIRUGÍAS
    const rawPathologies = patientData?.history?.pathologies || patientData?.antecedentesPersonales || [];
    const pathologies = Array.isArray(rawPathologies) ? rawPathologies : [];
    pathologies.forEach(p => {
        const name = (typeof p === 'object' ? p.name || p.patologia : p) || '';
        const upper = String(name).toUpperCase();
        if (upper.includes('COLECIST') || upper.includes('VESÍCULA') || upper.includes('VESICULA')) {
            pushAnomaly('NODO_1_ASIMILACION', 'SURGICAL', 'Colecistectomía Declarada', 'Pérdida de reservorio biliar; requiere emulsión enzimática y modulación lipídica estricta.', 'ALTA');
        } else if (upper.includes('GASTRITIS') || upper.includes('REFLUJO') || upper.includes('COLITIS') || upper.includes('DISBIOSIS')) {
            pushAnomaly('NODO_1_ASIMILACION', 'APP_DIGESTIVE', `Patología Digestiva: ${name}`, 'Compromiso mucoso / permeabilidad epitelial', 'ALTA');
        } else if (upper.includes('HÍGADO GRASO') || upper.includes('HIGADO GRASO') || upper.includes('HEPAT')) {
            pushAnomaly('NODO_2_BIOTRANSFORMACION', 'APP_HEPATIC', `Sobrecarga Hepática: ${name}`, 'Sobrecarga de biotransformación Fase I/II', 'ALTA');
        }
    });

    // D. INGESTA DE FASE 9: ESTADO FISIOLÓGICO Y REPRODUCTIVO
    const physio = patientData?.physio || {};
    const isPregnant = physio.is_pregnant === true || clinicalContext.isPregnant === true;
    const isLactating = physio.is_lactating === true;
    const gestationWeeks = parseInt(physio.gestation_weeks || 0, 10);
    if (isPregnant) {
        pushAnomaly('NODO_3_ENERGIA', 'PHYSIO_STATE', 'Estado Gestacional Activo', 
            `Semana de gestación: ${gestationWeeks || 'No precisada'}. Prioridad de balance energético y soporte de micronutrientes fetoplacentario.`, 'CRÍTICA');
        pushAnomaly('NODO_4_COMUNICACION', 'PHYSIO_STATE', 'Modulación Neuroendocrina Gestacional', 
            'Ajuste hormonal progesterona/prolactina y control glucémico estricto.', 'ALTA');
    } else if (isLactating) {
        pushAnomaly('NODO_3_ENERGIA', 'PHYSIO_STATE', 'Lactancia Materna Activa', 
            'Incremento en demanda hídrica y calórica; prescripción adaptada libre de estimulantes.', 'ALTA');
    }

    // E. INGESTA DE FASES 10 Y 11: CRONOBIOLOGÍA, SUEÑO, ESTRÉS Y TOXICOMANÍAS
    const lifestyle = patientData?.lifestyle || {};
    const sleep = lifestyle.sleep || patientData?.habitos?.sueno || {};
    const stress = lifestyle.stress || patientData?.habitos?.estres || {};
    const toxic = lifestyle.toxic_habits || patientData?.habitos?.toxicos || {};

    if (sleep.insomnia || sleep.quality === 'POOR' || (sleep.hours && sleep.hours < 6)) {
        pushAnomaly('NODO_4_COMUNICACION', 'LIFESTYLE_SLEEP', 'Disrupción Circadiana / Deuda de Sueño', 
            `Horas reportadas: ${sleep.hours || '<6'} h/noche. Calidad: ${sleep.quality || 'Mala'}. Insomnio: ${sleep.insomnia ? 'Sí' : 'No'}`, 'ALTA');
    }
    if (stress.level === 'HIGH' || stress.level === 'SEVERE' || parseInt(stress.score || 0) >= 8) {
        pushAnomaly('NODO_4_COMUNICACION', 'LIFESTYLE_STRESS', 'Carga Alostática Elevada (Eje HPA)', 
            `Nivel de estrés percibido: ${stress.level || stress.score}/10. Riesgo de hipercortisolemia y resistencia a la insulina`, 'ALTA');
    }
    if (toxic.smoking || toxic.alcohol_frequency === 'FREQUENT') {
        pushAnomaly('NODO_2_BIOTRANSFORMACION', 'TOXIC_BURDEN', 'Exposición a Xenobióticos / Tóxicos', 
            `Tabaco: ${toxic.smoking ? 'Activo' : 'No'}. Alcohol: ${toxic.alcohol_frequency || 'Ocasional'}`, 'MODERADA');
    }

    // F. INGESTA DE FASES 12 Y 13: PREFERENCIAS, AVERSIÓN Y RESTRICCIONES ALIMENTARIAS
    const nutritionPrefs = patientData?.nutrition?.preferences || {};
    const dietEval = patientData?.evaluacionDietetica?.preferencias || {};
    const rawExcluded = Array.isArray(nutritionPrefs.excluded_ingredients)
        ? nutritionPrefs.excluded_ingredients
        : (Array.isArray(nutritionPrefs.dislikes) ? nutritionPrefs.dislikes : []);
    const textAversions = dietEval.aversiones ? String(dietEval.aversiones).split(/[,;]/).map(s => s.trim()) : [];
    const combinedExclusions = Array.from(new Set([...rawExcluded, ...textAversions])).filter(Boolean);

    // G. INGESTA DE FASE 14: CRONONUTRICIÓN R24H (Ventanas de Ayuno y Horarios Nocturnos)
    const crono = patientData?.nutrition?.crononutricion || patientData?.crononutricion || patientData?.r24h || {};
    const cenaTime = crono.hora_cena || crono.cena_horario || crono.dinner_time || '';
    const hasLateEating = cenaTime && (cenaTime.includes('22:') || cenaTime.includes('23:') || cenaTime.includes('00:') || cenaTime.includes('01:') || cenaTime.includes('10 PM') || cenaTime.includes('11 PM'));
    const fastingHours = parseFloat(crono.horas_ayuno || crono.fasting_hours || 0);
    if (hasLateEating || (crono.ingesta_nocturna && crono.ingesta_nocturna !== 'NO')) {
        pushAnomaly('NODO_4_COMUNICACION', 'R24H_CHRONO', 'Ingesta Tardía / Desalineación Cronobiológica', 
            `Horario de última ingesta (${cenaTime || 'Nocturno tardío'}) interfiere con la secreción de melatonina y GH somatotrópica`, 'ALTA');
    }
    if (fastingHours > 0 && fastingHours < 10) {
        pushAnomaly('NODO_4_COMUNICACION', 'R24H_FASTING', 'Ventana de Reposo Metabólico Reducida', 
            `Ayuno nocturno de solo ${fastingHours} hrs. Se recomienda extender a mínimo 12 hrs para autofagia basal`, 'MODERADA');
    }

    // H. INGESTA DE FASE 15: FRECUENCIA DE ALIMENTOS FFQ (Ultraprocesados y Azúcares)
    const ffq = patientData?.nutrition?.ffq || patientData?.frecuenciaConsumo || {};
    const ultraprocessedFreq = String(ffq.ultraprocesados || ffq.comida_chatarra || ffq.fast_food || '').toUpperCase();
    const sugaryBeveragesFreq = String(ffq.bebidas_azucaradas || ffq.refrescos || ffq.sodas || '').toUpperCase();
    if (ultraprocessedFreq.includes('DIARIO') || ultraprocessedFreq.includes('FRECUENTE') || ultraprocessedFreq.includes('3-4')) {
        pushAnomaly('NODO_1_ASIMILACION', 'FFQ_ULTRAPROCESSED', 'Consumo Recurrente de Ultraprocesados', 
            'Ingesta elevada de emulsificantes y grasas hidrogenadas; riesgo de disrupción en la barrera mucosa enterocitaria', 'ALTA');
    }
    if (sugaryBeveragesFreq.includes('DIARIO') || sugaryBeveragesFreq.includes('FRECUENTE') || sugaryBeveragesFreq.includes('3-4')) {
        pushAnomaly('NODO_3_ENERGIA', 'FFQ_SUGARS', 'Sobrecarga de Fructosa / Azúcares Líquidos', 
            'Frecuencia elevada de azúcares simples; riesgo de esteatosis hepática y resistencia periférica a la insulina', 'ALTA');
    }

    // I. INGESTA DE FASES 16 Y 17: ANTROPOMETRÍA, PRESIÓN ARTERIAL Y GLUCOSA CAPILAR
    const vitals = patientData?.vitals || patientData?.signosVitales || {};
    const biometria = patientData?.biometria || {};
    const bp = vitals.bloodPressure || {};
    const sys = parseInt(bp.systolic || vitals.ta_sistolica || vitals.ta?.split('/')[0] || 0, 10);
    const dia = parseInt(bp.diastolic || vitals.ta_diastolica || vitals.ta?.split('/')[1] || 0, 10);
    const glu = parseFloat(vitals.glucose || vitals.glucosa || 0);
    const waist = parseFloat(biometria.cintura || patientData?.cintura || 0);
    const hip = parseFloat(biometria.cadera || patientData?.cadera || 0);
    const icc = (waist > 0 && hip > 0) ? parseFloat((waist / hip).toFixed(2)) : null;

    if (sys >= 130 || dia >= 85) {
        pushAnomaly('NODO_5_TRANSPORTE', 'VITALS_BP', `Tensión Arterial Elevada (${sys}/${dia} mmHg)`, 
            'Riesgo de sobrecarga vascular y disfunción endotelial', sys >= 140 || dia >= 90 ? 'CRÍTICA' : 'ALTA');
    }
    if (glu >= 100) {
        pushAnomaly('NODO_3_ENERGIA', 'VITALS_GLUCOSE', `Glucosa Capilar Alterada (${glu} mg/dL)`, 
            glu >= 126 ? 'Glucemia en rango compatible con diabetes' : 'Disglucemia basal en ayuno', 'CRÍTICA');
    }
    if (icc && ((patientData?.sexo === 'F' && icc > 0.85) || (patientData?.sexo !== 'F' && icc > 0.90))) {
        pushAnomaly('NODO_3_ENERGIA', 'ANTHRO_ICC', `Riesgo Cardiometabólico Visceral (ICC: ${icc})`, 
            `Cintura: ${waist} cm, Cadera: ${hip} cm. Adiposidad troncular profunda`, 'ALTA');
    }

    // J. Anomalías de Entrevista Clínica (Fases 7 y 8)
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

    // B. Anomalías de Laboratorio Clínico OCR e Índices Funcionales (Paso 4 de Fase 18)
    const extMetrics = patientData?.scan_data?.external_metrics || {};
    const labSections = extMetrics.sections || {};
    const flatLabs = extMetrics.biomarkers || extMetrics.labs || patientData?.lab_results || patientData?.ocr_labs || {};
    const seenLabKeys = new Set();

    // Diccionario de valores numéricos extraídos para cálculo de índices funcionales
    const labValues = {};

    function registerLabNumeric(name, rawVal) {
        if (rawVal === undefined || rawVal === null) return;
        const num = parseFloat(String(rawVal).replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return;
        const normKey = String(name).toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, '_');

        if (normKey.includes('triglic')) labValues.triglycerides = num;
        else if (normKey.includes('hdl') && !normKey.includes('no_hdl')) labValues.hdl = num;
        else if (normKey.includes('ldl')) labValues.ldl = num;
        else if (normKey.includes('colesterol') && !normKey.includes('ldl') && !normKey.includes('hdl')) labValues.totalCholesterol = num;
        else if (normKey.includes('glucosa') || normKey.includes('glucose')) labValues.glucose = num;
        else if (normKey.includes('insulina') || normKey.includes('insulin')) labValues.insulin = num;
        else if (normKey.includes('hba1c') || normKey.includes('glicosilada') || normKey.includes('hemoglobina_a1c')) labValues.hba1c = num;
        else if (normKey.includes('calcio') || normKey.includes('calcium')) labValues.serumCalcium = num;
        else if (normKey.includes('vitamina_d') || normKey.includes('25_oh') || normKey.includes('calcidiol')) labValues.vitaminD = num;
        else if (normKey.includes('creatinina')) labValues.creatinine = num;
        else if (normKey.includes('filtrado') || normKey.includes('tfg') || normKey.includes('egfr')) labValues.gfr = num;
        else if (normKey.includes('bun') || normKey.includes('urea')) labValues.bun = num;
        else if (normKey.includes('urico')) labValues.uricAcid = num;
        else if (normKey.includes('alt') || normKey.includes('tgp')) labValues.alt = num;
        else if (normKey.includes('ast') || normKey.includes('tgo')) labValues.ast = num;
        else if (normKey.includes('ggt')) labValues.ggt = num;
        else if (normKey.includes('bilirrubina') || normKey.includes('bilirubin')) labValues.bilirubin = num;
        else if (normKey.includes('pcr') || normKey.includes('proteina_c_reactiva')) labValues.hscrp = num;
        else if (normKey.includes('homocisteina')) labValues.homocysteine = num;
        else if (normKey.includes('leucocito') || normKey.includes('white_blood')) labValues.leukocytes = num;
        else if (normKey.includes('vsg') || normKey.includes('sedimentacion')) labValues.vsg = num;
        else if (normKey.includes('ferritina')) labValues.ferritin = num;
        else if (normKey.includes('tsh')) labValues.tsh = num;
        else if (normKey.includes('t3_libre') || normKey.includes('t3')) labValues.freeT3 = num;
        else if (normKey.includes('t4_libre') || normKey.includes('t4')) labValues.freeT4 = num;
        else if (normKey.includes('cortisol')) labValues.cortisol = num;
    }

    Object.entries(labSections).forEach(([secKey, secObj]) => {
        const items = Array.isArray(secObj?.items) ? secObj.items : (Array.isArray(secObj) ? secObj : []);
        items.forEach(item => {
            const name = item.name || item.label || item.parameter || 'Biomarcador';
            registerLabNumeric(name, item.val ?? item.value);

            const st = String(item.status || '').toUpperCase();
            if (st && st !== 'NORMAL' && st !== 'OPTIMAL' && st !== 'OPTIMO' && st !== 'NEGATIVO') {
                seenLabKeys.add(name.toUpperCase());
                const detail = `${item.val ?? item.value ?? ''} ${item.unit || ''} (Ref: ${item.ref || item.reference || 'N/A'} | Estado: ${st})`.trim();
                const upperName = `${secKey} ${name}`.toUpperCase();

                if (upperName.includes('COLESTEROL') || upperName.includes('LDL') || upperName.includes('HDL') || upperName.includes('TRIGLIC') || upperName.includes('ATEROG') || upperName.includes('GLUCOSA') || upperName.includes('INSULINA') || upperName.includes('HBA1C')) {
                    pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', name, detail, 'ALTA');
                } else if (upperName.includes('BASÓFIL') || upperName.includes('BASOFIL') || upperName.includes('LEUCOCIT') || upperName.includes('EOSIN') || upperName.includes('LINFOCIT') || upperName.includes('NEUTRÓFIL') || upperName.includes('PCR') || upperName.includes('VSG') || upperName.includes('FERRITINA')) {
                    pushAnomaly('NODO_6_DEFENSA', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('HEMOGLOBINA') || upperName.includes('HEMATOCRITO') || upperName.includes('ERITROCIT') || upperName.includes('PLAQUETA') || upperName.includes('HIERRO') || upperName.includes('HOMOCISTEINA')) {
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

    Object.entries(flatLabs).forEach(([k, v]) => {
        if (!v) return;
        const name = typeof v === 'object' ? (v.name || v.label || k) : k;
        const rawVal = typeof v === 'object' ? (v.value ?? v.val) : v;
        registerLabNumeric(name, rawVal);

        const st = typeof v === 'object' ? String(v.status || '').toUpperCase() : '';
        if (st && st !== 'NORMAL' && st !== 'OPTIMAL' && !seenLabKeys.has(name.toUpperCase())) {
            const detail = `${rawVal ?? ''} ${typeof v === 'object' ? (v.unit || '') : ''} (${st})`.trim();
            const upperName = name.toUpperCase();
            if (upperName.includes('COLESTEROL') || upperName.includes('LDL') || upperName.includes('ATEROG') || upperName.includes('GLUCOSA') || upperName.includes('TRIGLIC')) {
                pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', name, detail, 'ALTA');
            } else if (upperName.includes('BASÓFIL') || upperName.includes('BASOFIL') || upperName.includes('LEUCOCIT') || upperName.includes('PCR')) {
                pushAnomaly('NODO_6_DEFENSA', 'OCR_LAB', name, detail, 'MODERADA');
            } else {
                pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', name, detail, 'MODERADA');
            }
        }
    });

    // EVALUACIÓN DE ÍNDICES FUNCIONALES Y CORTE BIOLÓGICO CLÍNICO
    // 1. Ratio Triglicéridos / HDL (> 2.0)
    if (labValues.triglycerides > 0 && labValues.hdl > 0) {
        const tgHdl = labValues.triglycerides / labValues.hdl;
        if (tgHdl > 2.0) {
            pushAnomaly('NODO_3_ENERGIA', 'FUNCTIONAL_INDEX', 'Ratio Triglicéridos/HDL Elevado',
                `TG: ${labValues.triglycerides} mg/dL, HDL: ${labValues.hdl} mg/dL | Ratio = ${tgHdl.toFixed(2)} (> 2.0). Marcador subrogado de aterogenicidad y resistencia a la insulina`, 'ALTA');
        }
    }

    // 2. Índice HOMA-IR (> 2.5) o Glucosa / HbA1c
    if (labValues.glucose > 0 && labValues.insulin > 0) {
        const homa = (labValues.glucose * labValues.insulin) / 405;
        if (homa > 2.5) {
            pushAnomaly('NODO_3_ENERGIA', 'FUNCTIONAL_INDEX', 'Índice HOMA-IR Elevado',
                `Glucosa: ${labValues.glucose} mg/dL, Insulina: ${labValues.insulin} µUI/mL | HOMA-IR = ${homa.toFixed(2)} (> 2.5). Resistencia periférica a la insulina`, 'ALTA');
        }
    } else if (labValues.hba1c >= 5.7) {
        pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', `Hemoglobina Glucosilada Alterada (${labValues.hba1c}%)`,
            `HbA1c = ${labValues.hba1c}%. Glicación proteica tisular fuera de rango óptimo`, labValues.hba1c >= 6.5 ? 'CRÍTICA' : 'ALTA');
    }

    // 3. Calcio Sérico (> 10.2 mg/dL) y Vitamina D
    if (labValues.serumCalcium > 10.2) {
        hasHighSerumCalciumOrCalcification = true;
        pushAnomaly('NODO_7_ESTRUCTURAL', 'OCR_LAB', 'Calcio Sérico Elevado (Hipercalcemia Funcional)',
            `Calcio sérico: ${labValues.serumCalcium} mg/dL (> 10.2 mg/dL). Alerta de desregulación mineral y riesgo de calcificación vascular`, 'ALTA');
    }
    if (labValues.vitaminD > 0 && labValues.vitaminD < 30) {
        pushAnomaly('NODO_7_ESTRUCTURAL', 'OCR_LAB', 'Hipovitaminosis D (25-OH)',
            `Vitamina D (25-OH): ${labValues.vitaminD} ng/mL (< 30 ng/mL). Deficiencia de mineralización esquelética`, 'MODERADA');
    }

    // 4. Biotransformación Hepatorrenal (Creatinina, TFG, BUN, Ácido Úrico, TGO/AST, TGP/ALT, GGT, Bilirrubinas)
    if (labValues.alt > 35 || labValues.ast > 35 || labValues.ggt > 50 || labValues.bilirubin > 1.2 || labValues.uricAcid > 6.5 || labValues.creatinine > 1.2 || (labValues.gfr > 0 && labValues.gfr < 60)) {
        pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', 'Sobrecarga de Biotransformación Hepatorrenal',
            `Parámetros alterados: ${[
                labValues.alt > 35 ? `ALT/TGP: ${labValues.alt} U/L` : null,
                labValues.ast > 35 ? `AST/TGO: ${labValues.ast} U/L` : null,
                labValues.ggt > 50 ? `GGT: ${labValues.ggt} U/L` : null,
                labValues.bilirubin > 1.2 ? `Bilirrubina: ${labValues.bilirubin} mg/dL` : null,
                labValues.uricAcid > 6.5 ? `Ácido Úrico: ${labValues.uricAcid} mg/dL` : null,
                labValues.creatinine > 1.2 ? `Creatinina: ${labValues.creatinine} mg/dL` : null,
                (labValues.gfr > 0 && labValues.gfr < 60) ? `TFG: ${labValues.gfr} mL/min` : null
            ].filter(Boolean).join(' • ')}`, 'ALTA');
    }

    // 5. Transporte Vascular (Colesterol Total, LDL, PCR-us, Homocisteína)
    if (labValues.totalCholesterol > 200 || labValues.ldl > 130 || labValues.hscrp > 1.0 || labValues.homocysteine > 12) {
        pushAnomaly('NODO_5_TRANSPORTE', 'OCR_LAB', 'Sobrecarga Aterogénica e Inflamación Vascular',
            `Marcadores vasculares: ${[
                labValues.totalCholesterol > 200 ? `Colesterol Total: ${labValues.totalCholesterol} mg/dL` : null,
                labValues.ldl > 130 ? `LDL: ${labValues.ldl} mg/dL` : null,
                labValues.hscrp > 1.0 ? `PCR-us: ${labValues.hscrp} mg/L` : null,
                labValues.homocysteine > 12 ? `Homocisteína: ${labValues.homocysteine} µmol/L` : null
            ].filter(Boolean).join(' • ')}`, 'ALTA');
    }

    // 6. Defensa e Inmunología (Leucocitos, VSG, Ferritina)
    if (labValues.leukocytes > 10000 || (labValues.leukocytes > 0 && labValues.leukocytes < 4000) || labValues.vsg > 20 || labValues.ferritin > 300) {
        pushAnomaly('NODO_6_DEFENSA', 'OCR_LAB', 'Reactividad Inmunológica / Reactantes de Fase Aguda',
            `Analitos: ${[
                labValues.leukocytes ? `Leucocitos: ${labValues.leukocytes} /µL` : null,
                labValues.vsg ? `VSG: ${labValues.vsg} mm/h` : null,
                labValues.ferritin ? `Ferritina: ${labValues.ferritin} ng/mL` : null
            ].filter(Boolean).join(' • ')}`, 'MODERADA');
    }

    // 7. Comunicación Neuroendocrina (TSH, T3 libre, T4 libre, Cortisol)
    if (labValues.tsh > 4.5 || (labValues.tsh > 0 && labValues.tsh < 0.4) || labValues.cortisol > 20) {
        pushAnomaly('NODO_4_COMUNICACION', 'OCR_LAB', 'Eje Neuroendocrino / Tiroideo-Adrenal Alterado',
            `Hormonas: ${[
                labValues.tsh ? `TSH: ${labValues.tsh} µUI/mL` : null,
                labValues.cortisol ? `Cortisol: ${labValues.cortisol} µg/dL` : null
            ].filter(Boolean).join(' • ')}`, 'MODERADA');
    }

    // C. Anomalías de Bioimpedancia Cuántica Electret (Paso 1 de Fase 18)
    const electretCats = patientData?.scan_data?.electret_metrics || patientData?.electretTelemetry?.categories || {};

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
    const ocular = patientData?.scan_data?.ocular_metrics || patientData?.ocular_metrics || patientData?.oculomics;
    if (ocular && ocular.status !== 'SKIPPED') {
        const ocSeverity = String(ocular.severity || 'LOW').toUpperCase();
        const ocFindings = ocular.findings || ocular.summary || '';
        const ocFlags = Array.isArray(ocular.clinical_flags) ? ocular.clinical_flags.join(', ') : '';
        const fullOcText = `${ocFindings} ${ocFlags} ${JSON.stringify(ocular.pilares || {})}`.toUpperCase();

        // 1. Palidez conjuntival -> Nodo 5 (Transporte) y Nodo 1 (Déficit de hierro/B12)
        if (fullOcText.includes('PALIDEZ') || fullOcText.includes('CONJUNCTIVAL_PALLOR') || fullOcText.includes('ANEMIA')) {
            pushAnomaly('NODO_5_TRANSPORTE', 'OCULAR_VISION', 'Palidez Conjuntival / Hipoperfusión Tisular',
                'Signo de hipoperfusión microvascular detectable en lecho conjuntival tarsal', ocSeverity === 'HIGH' ? 'ALTA' : 'MODERADA');
            pushAnomaly('NODO_1_ASIMILACION', 'OCULAR_VISION', 'Sospecha de Déficit Malabsortivo (Hierro / B12)',
                'La palidez conjuntival sugiere compromiso en la asimilación y reserva de micronutrientes hematopoyéticos', 'MODERADA');
        }

        // 2. Esclera ictérica o congestión -> Nodo 2 (Sobrecarga hepatobiliar)
        if (fullOcText.includes('ICTER') || fullOcText.includes('SUBICTER') || fullOcText.includes('CONGESTION') || fullOcText.includes('HIPEREMIA ESCLERAL')) {
            pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCULAR_VISION', 'Cromatismo Escleral / Congestión Hepatobiliar',
                'Tinte subictérico o congestión vascular en esclera compatible con sobrecarga en vías de eliminación hepatobiliar', 'ALTA');
        }

        // 3. Arco corneal / Xantelasmas -> Nodo 3 (Metabolismo lipídico) y Nodo 5 (Riesgo vascular)
        if (fullOcText.includes('ARCO SENIL') || fullOcText.includes('ARCO CORNEAL') || fullOcText.includes('GERONTOXON') || fullOcText.includes('XANTELASMA')) {
            pushAnomaly('NODO_3_ENERGIA', 'OCULAR_VISION', 'Depósito Lipídico Corneal (Arco Senil / Xantelasma)',
                'Extravasación lipídica periférica corneal indicativa de dislipidemia y desregulación del metabolismo lipídico', 'ALTA');
            pushAnomaly('NODO_5_TRANSPORTE', 'OCULAR_VISION', 'Riesgo Microvascular por Aterogénesis Ocular',
                'Signo oftalmológico de depósito perivascular con correlación de riesgo aterosclerótico sistémico', 'ALTA');
        }

        if (ocFindings && !fullOcText.includes('PALIDEZ') && !fullOcText.includes('ICTER') && !fullOcText.includes('ARCO')) {
            pushAnomaly('NODO_5_TRANSPORTE', 'OCULAR_VISION', 'Trofismo Microvascular Escleral/Conjuntival', `${ocFindings} ${ocFlags ? `[${ocFlags}]` : ''}`.trim(), ocSeverity === 'HIGH' ? 'ALTA' : 'MODERADA');
        }
    }

    // E. Hallazgos de Glosodiagnóstico 6 Ejes (Paso 3 de Fase 18)
    const lingual = patientData?.scan_data?.lingual_metrics || patientData?.lingual_metrics || patientData?.glosodiagnostico;
    if (lingual && lingual.status !== 'SKIPPED') {
        const lgFindings = lingual.findings || lingual.summary || '';
        const lgFlags = Array.isArray(lingual.clinical_flags) ? lingual.clinical_flags.join(', ') : '';
        const fullLgText = `${lgFindings} ${lgFlags} ${JSON.stringify(lingual.pilares || {})}`.toUpperCase();

        // 1. Saburra espesa / amarilla / blanca y marcas dentales -> Nodo 1 (Asimilación y Disbiosis)
        if (fullLgText.includes('SABURRA') || fullLgText.includes('MARCAS DENTALES') || fullLgText.includes('SCALLOPED') || fullLgText.includes('FESTONEADA') || fullLgText.includes('INDENTACION') || fullLgText.includes('BLANCA') || fullLgText.includes('AMARILLA')) {
            pushAnomaly('NODO_1_ASIMILACION', 'LINGUAL_VISION', 'Saburra Patológica y/o Marcas Dentales (Disbiosis)',
                `Glosodiagnóstico: Saburra alterada o bordes festoneados por edema mucoso. Compatible con permeabilidad intestinal y disbiosis`, 'ALTA');
        }

        // 2. Bordes rojizos / sobrecarga hepática -> Nodo 2 (Biotransformación)
        if (fullLgText.includes('BORDES ROJ') || fullLgText.includes('BORDES ERITEMATOSOS') || fullLgText.includes('HEPATOBILIAR') || fullLgText.includes('FUEGO HEPATICO')) {
            pushAnomaly('NODO_2_BIOTRANSFORMACION', 'LINGUAL_VISION', 'Eritema Lateral Lingual (Sobrecarga Hepatobiliar)',
                'Hiperemia marcada en bordes laterales de la lengua correspondiente al territorio reflexológico hepatobiliar', 'ALTA');
        }

        // 3. Punta roja -> Nodo 4 (Estrés / HPA / Comunicación Neuroendocrina)
        if (fullLgText.includes('PUNTA ROJA') || fullLgText.includes('RED TIP') || fullLgText.includes('ERITEMA APICAL') || fullLgText.includes('ESTRES') || fullLgText.includes('ESTRÉS') || fullLgText.includes('HPA')) {
            pushAnomaly('NODO_4_COMUNICACION', 'LINGUAL_VISION', 'Punta Lingual Hiperémica (Hiperactividad Simpática / HPA)',
                'Eritema en ápice lingual indicativo de sobrecarga adrenocortical, estrés neurovegetativo y alteración circadiana', 'ALTA');
        }

        // 4. Venas sublinguales ingurgitadas o cuerpo violáceo -> Nodo 5 (Reología / Microcirculación y Transporte)
        if (fullLgText.includes('RANINA') || fullLgText.includes('SUBLINGUAL') || fullLgText.includes('ESTASIS') || fullLgText.includes('INGURGIT') || fullLgText.includes('VIOLACEO') || fullLgText.includes('VIOLÁCEO') || fullLgText.includes('CIANOSIS') || fullLgText.includes('PURPURA') || fullLgText.includes('PÚRPURA')) {
            pushAnomaly('NODO_5_TRANSPORTE', 'LINGUAL_VISION', 'Estasis Venosa Sublingual / Microcirculación Hipóxica',
                'Venas raninas dilatadas o tinte violáceo lingual compatible con lentitud reológica y sobrecarga venosa periférica', 'ALTA');
        }

        if (lgFindings && !fullLgText.includes('SABURRA') && !fullLgText.includes('BORDES') && !fullLgText.includes('PUNTA') && !fullLgText.includes('RANINA')) {
            pushAnomaly('NODO_1_ASIMILACION', 'LINGUAL_VISION', 'Glosodiagnóstico Funcional', `${lgFindings} ${lgFlags ? `[${lgFlags}]` : ''}`.trim(), 'MODERADA');
        }
    }

    // F. Hallazgos de Evidencia Somática Multi-Foto y Mapa Corporal (Paso 5 de Fase 18 + VisualBodyMap)
    const visual = patientData?.scan_data?.visual_metrics;
    const somaticFindings = patientData?.somatic_findings || patientData?.body_zones || patientData?.VisualBodyMap || patientData?.mapaCorporal || [];
    const allSomaticItems = [];

    if (visual && visual.status !== 'SKIPPED') {
        const vItems = Array.isArray(visual.items) ? visual.items : [];
        if (vItems.length > 0) {
            allSomaticItems.push(...vItems);
        } else if (visual.findings) {
            allSomaticItems.push({ region: 'Superficie Corporal', finding: visual.findings, clinical_flags: visual.clinical_flags, severity: visual.severity });
        }
    }

    if (Array.isArray(somaticFindings)) {
        somaticFindings.forEach(sf => {
            if (typeof sf === 'string') {
                allSomaticItems.push({ region: 'Mapa Corporal', finding: sf, severity: 'MODERADA' });
            } else if (typeof sf === 'object') {
                allSomaticItems.push({
                    region: sf.zone || sf.region || sf.label || sf.bodyPart || 'Zona Corporal',
                    finding: sf.finding || sf.notes || sf.description || sf.symptom || 'Hallazgo somático reportado',
                    severity: sf.severity || 'MODERADA',
                    clinical_flags: sf.clinical_flags || sf.flags || []
                });
            }
        });
    }

    if (allSomaticItems.length > 0) {
        allSomaticItems.forEach((it, idx) => {
            const region = it.region || `Zona #${idx + 1}`;
            const desc = it.finding || '';
            const flags = Array.isArray(it.clinical_flags) ? it.clinical_flags.join(', ') : (it.clinical_flags || '');
            const fullSomText = `${region} ${desc} ${flags}`.toUpperCase();
            const sev = String(it.severity || 'MODERADA').toUpperCase();

            // 1. Acantosis nigricans o adiposidad localizada -> Nodo 3
            if (fullSomText.includes('ACANTOSIS') || fullSomText.includes('NIGRICANS') || fullSomText.includes('ADIPOSIDAD') || fullSomText.includes('GRASA LOCALIZADA') || (fullSomText.includes('CUELLO') && fullSomText.includes('OSCURA'))) {
                pushAnomaly('NODO_3_ENERGIA', 'SOMATIC_VISION', `Acantosis Nigricans / Adiposidad (${region})`,
                    `${desc} ${flags ? `[${flags}]` : ''}. Marcador cutáneo de hiperinsulinemia y resistencia a la insulina`, sev === 'ALTA' || sev === 'CRÍTICA' ? 'ALTA' : 'MODERADA');
            }

            // 2. Edema maleolar, insuficiencia venosa, várices o cianosis -> Nodo 5
            if (fullSomText.includes('EDEMA') || fullSomText.includes('MALEOLAR') || fullSomText.includes('VENOSA') || fullSomText.includes('VARICES') || fullSomText.includes('VÁRICES') || fullSomText.includes('HEMOSIDERINA') || fullSomText.includes('CIANOSIS')) {
                pushAnomaly('NODO_5_TRANSPORTE', 'SOMATIC_VISION', `Insuficiencia Venosa / Edema Periférico (${region})`,
                    `${desc} ${flags ? `[${flags}]` : ''}. Compromiso del retorno venoso y reología vascular`, sev === 'ALTA' || sev === 'CRÍTICA' ? 'ALTA' : 'MODERADA');
            }

            // 3. Dermatitis, eccema, psoriasis o lesiones en piel -> Nodo 6 (Defensa) y Nodo 1 (Intestino-Piel)
            if (fullSomText.includes('DERMATITIS') || fullSomText.includes('ECCEMA') || fullSomText.includes('ECZEMA') || fullSomText.includes('PSORIASIS') || fullSomText.includes('ERITEMA') || fullSomText.includes('ERUPCION') || fullSomText.includes('ERUPCIÓN') || fullSomText.includes('PRURITO') || fullSomText.includes('LESION') || fullSomText.includes('LESIÓN')) {
                pushAnomaly('NODO_6_DEFENSA', 'SOMATIC_VISION', `Reactividad Cutánea Inflamatoria (${region})`,
                    `${desc} ${flags ? `[${flags}]` : ''}. Activación de respuesta inmunológica dérmica`, 'MODERADA');
                pushAnomaly('NODO_1_ASIMILACION', 'SOMATIC_VISION', `Eje Intestino-Piel (${region})`,
                    'Manifestación dérmica vinculada a hiperpermeabilidad mucosa e inmunotolerancia alterada', 'MODERADA');
            }

            // 4. Inflamación o dolor articular / musculoesquelético -> Nodo 7
            if (fullSomText.includes('ARTICULAR') || fullSomText.includes('RODILLA') || fullSomText.includes('DOLOR') || fullSomText.includes('INFLAMACION') || fullSomText.includes('INFLAMACIÓN') || fullSomText.includes('ARTROSIS') || fullSomText.includes('ARTRITIS') || fullSomText.includes('COLUMNA') || fullSomText.includes('LUMBAR') || fullSomText.includes('CERVICAL') || fullSomText.includes('HOMBRO')) {
                pushAnomaly('NODO_7_ESTRUCTURAL', 'SOMATIC_VISION', `Compromiso Estructural / Articular (${region})`,
                    `${desc} ${flags ? `[${flags}]` : ''}. Alteración de la integridad biomecánica y articular`, sev === 'ALTA' || sev === 'CRÍTICA' ? 'ALTA' : 'MODERADA');
            }
        });
    }

    // Construir arreglo final de las 7 Micro-Cápsulas IFM con CIE-10 determinista pre-asignado
    const nodes = Object.values(nodesMap).map(node => {
        const hasAnomalies = node.anomalies.length > 0;
        const resolvedCie = resolveCie10ForNode(node.id, node.anomalies, isLactanteExplicit);
        return {
            ...node,
            hasAnomalies,
            anomaliesCount: node.anomalies.length,
            preAssignedCie10: resolvedCie.cie10,
            preAssignedLabel: resolvedCie.label,
            validation_status: resolvedCie.validation_status
        };
    });

    return {
        nodes,
        hasHighSerumCalciumOrCalcification,
        combinedExclusions,
        anamnesis360Context: {
            chiefComplaint: patientQuote,
            pathologiesCount: pathologies.length,
            highRiskVitals: sys >= 130 || glu >= 100,
            combinedExclusions,
            isPregnant,
            isLactating,
            gestationWeeks
        }
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

const THERAPEUTIC_FOCUS_BY_NODE = {
    NODO_1_ASIMILACION: 'Sellado de barrera epitelial intestinal (L-Glutamina, Fibra prebiótica soluble y probióticos esporulados) previo a detoxificación sistémica.',
    NODO_2_DEFENSA: 'Modulación inmunológica antinflamatoria (Omega-3 EPA/DHA, polifenoles vasculares y protocolo de exclusión antigénica).',
    NODO_3_ENERGIA: 'Optimización mitocondrial y sensibilidad insulínica con 33Plus® (Coenzima Q10, Ácido Alfa Lipoico y cofactores del ciclo de Krebs).',
    NODO_4_BIOTRANSFORMACION: 'Soporte hepatobiliar Fase I/II y nefroprotección (hidratación estructurada, crucíferas azufradas, silimarina y control de carga nitrogenada).',
    NODO_5_TRANSPORTE: 'Optimización endotelial, síntesis de óxido nítrico y perfusión microcirculatoria (L-Arginina, antioxidantes endoteliales y balance electrolítico).',
    NODO_6_COMUNICACION: 'Sincronización neuroendocrina y modulación del eje HPA-tiroideo (adaptógenos, higiene circadiana y estabilidad glucémica).',
    NODO_7_ESTRUCTURAL: 'Regeneración de matriz extracelular, síntesis de colágeno y biotensegridad miofascial con 34Plus® y umbral óptimo de leucina.'
};

/**
 * Construye una síntesis médica determinista de grado clínico a partir de los hallazgos
 * purificados del nodo IFM (garantizando cero mensajes de error técnico en UI).
 */
function buildDeterministicNodeSynthesis(node) {
    const anomalies = Array.isArray(node.anomalies) ? node.anomalies : [];
    const count = anomalies.length;
    const status = count >= 2 ? 'PRIORIDAD_ALTA' : (count === 1 ? 'ALERTA_MODERADA' : 'HOMEOSTASIS');
    const detailsText = anomalies.map(a => `${a.label} (${a.detail})`).join('; ');

    return {
        nodeId: node.id,
        nodeName: node.name,
        status,
        cie10: node.preAssignedCie10 || 'Z00.0',
        validation_status: node.validation_status || 'VALIDADO',
        summary: count > 0
            ? `Correlación clínica en ${node.name} compatible con ${node.preAssignedLabel} [CIE-10: ${node.preAssignedCie10}]. Se documentan ${count} biomarcadores/signos fuera de rango fisiológico: ${detailsText}.`
            : 'Función conservada. Sin alteraciones detectadas.',
        key_biomarkers: anomalies.map(a => `${a.label}: ${a.detail}`),
        therapeutic_focus: count > 0
            ? (THERAPEUTIC_FOCUS_BY_NODE[node.id] || 'Modulación nutricional focalizada y monitoreo de biomarcadores.')
            : 'Mantenimiento preventivo y vigilancia estándar.'
    };
}

/**
 * Invoca a la cascada de modelos Gemini con temperature: 0.1 y responseSchema estricto
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

    const candidateModels = [
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-2.5-flash',
        'gemini-flash-lite-latest'
    ];

    let response = null;
    for (const modelName of candidateModels) {
        try {
            response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    temperature: 0.1,
                    topP: 0.8,
                    responseMimeType: 'application/json',
                    responseSchema: IFM_NODE_RESPONSE_SCHEMA
                }
            });
            if (response && response.text) {
                break;
            }
        } catch (modelErr) {
            console.warn(`⚠️ [CORTEX] Modelo ${modelName} no disponible en ${node.id}, aplicando fallback...`);
        }
    }

    if (!response || !response.text) {
        return buildDeterministicNodeSynthesis(node);
    }

    try {
        const parsed = JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
        const fallback = buildDeterministicNodeSynthesis(node);
        return {
            nodeId: node.id,
            nodeName: node.name,
            status: (parsed.status && parsed.status !== 'ERROR_SINTESIS') ? parsed.status : fallback.status,
            cie10: node.preAssignedCie10,
            validation_status: node.validation_status,
            summary: parsed.summary || fallback.summary,
            key_biomarkers: (Array.isArray(parsed.key_biomarkers) && parsed.key_biomarkers.length > 0)
                ? parsed.key_biomarkers
                : fallback.key_biomarkers,
            therapeutic_focus: parsed.therapeutic_focus || fallback.therapeutic_focus
        };
    } catch (parseErr) {
        return buildDeterministicNodeSynthesis(node);
    }
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
                    return buildDeterministicNodeSynthesis(node);
                }

                // Llamada a la API de Gemini con cascada resiliente y responseSchema estricto
                return await synthesizeNodeWithGemini(node, ai);
            })
        );

        // Evaluación de resiliencia post-lote (Contrato Isomórfico Clínico sin errores técnicos)
        batchResults.forEach((outcome, index) => {
            if (outcome.status === 'fulfilled') {
                finalDossierResults.push({
                    ...outcome.value,
                    key_biomarkers: Array.isArray(outcome.value?.key_biomarkers) ? outcome.value.key_biomarkers : [],
                    therapeutic_focus: outcome.value?.therapeutic_focus || 'Mantenimiento preventivo y vigilancia estándar.'
                });
            } else {
                const failedNode = batch[index];
                console.warn(`[CORTEX FALLBACK] Sintetizando determinísticamente el Nodo ${failedNode.id}:`, outcome.reason?.message || outcome.reason);
                finalDossierResults.push(buildDeterministicNodeSynthesis(failedNode));
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
const CLINICAL_BIOMARKER_TRANSLATE = {
    'RETICULAR_ERYTHEMA': 'Eritema Reticular',
    'PUNCTATE_MACULES': 'Máculas Puntiformes',
    'MICROPAPULAR_ERUPTION': 'Erupción Micropapular',
    'PERIFOLLICULAR_INVOLVEMENT': 'Compromiso Perifolicular',
    'CUTANEOUS_EDEMA_SUPERFICIAL': 'Edema Cutáneo Superficial',
    'SUPERFICIAL_CUTANEOUS_EDEMA': 'Edema Cutáneo Superficial',
    'CHRONIC_VENOUS_INSUFFICIENCY_DETECTED': 'Insuficiencia Venosa Crónica',
    'CHRONIC_VENOUS_INSUFFICIENCY': 'Insuficiencia Venosa Crónica',
    'VARICOSE_VEINS_HIGH_RISK': 'Riesgo Elevado de Várices',
    'VENOUS_STASIS_DERMATITIS': 'Dermatitis por Estasis Venosa',
    'EDEMA_PERIPHERAL_MODERATE': 'Edema Periférico Moderado',
    'PERIPHERAL_EDEMA': 'Edema Periférico',
    'HYPERPIGMENTATION': 'Hiperpigmentación Cutánea',
    'HEMOSIDERIN_PIGMENTATION': 'Pigmentación por Hemosiderina',
    'FOLLICULAR_HYPERKERATOSIS': 'Hiperqueratosis Folicular',
    'XEROSIS_CUTIS': 'Xerosis Cutánea (Piel Seca)',
    'TELANGIECTASIA': 'Telangiectasias Superficiales',
    'VENOUS_ECTASIA': 'Ectasia Venosa',
    'SUBLINGUAL_VARICES': 'Várices Sublinguales',
    'LINGUAL_COATING_WHITE': 'Saburra Lingual Blanquecina',
    'GINGIVAL_CONGESTION': 'Congestión Gingival',
    'DRY_MUCOSA': 'Resequedad de Mucosa',
    'ERYTHEMATOUS_EDEMA': 'Edema Eritematoso',
    'MICROVASCULAR_CONGESTION': 'Congestión Microvascular',
    'BLOOD_VISCOSITY': 'Viscosidad Sanguínea',
    'VASCULAR_RESISTANCE': 'Resistencia Vascular',
    'VASCULAR_ELASTICITY': 'Elasticidad Vascular',
    'MYOCARDIAL_BLOOD_DEMAND': 'Demanda de Sangre Miocárdica',
    'STROKE_VOLUME': 'Volumen Sistólico',
    'LEFT_VENTRICULAR_EJECTION_IMPEDANCE': 'Impedancia Ventricular de Expulsión',
    'EFFECTIVE_PUMP_FORCE': 'Fuerza de Bombeo Efectiva',
    'CORONARY_ARTERY_ELASTICITY': 'Elasticidad Coronaria',
    'CEREBRAL_VESSEL_ELASTICITY': 'Elasticidad de Vaso Cerebral',
    'CHOLESTEROL_CRYSTAL': 'Cristal de Colesterol'
};

function translateBiomarkerToSpanish(b) {
    if (!b) return '';
    const raw = String(b).trim();
    const key = raw.toUpperCase().replace(/\s+/g, '_');
    return CLINICAL_BIOMARKER_TRANSLATE[key] || raw;
}

function buildOrthomolecularPrescription(patientData, processedNodes, serum, bioenergetics, hasStimulantsConflict) {
    const node3 = processedNodes.find(n => n.nodeId === 'NODO_3_ENERGIA');
    const node5 = processedNodes.find(n => n.nodeId === 'NODO_5_TRANSPORTE');
    const node6 = processedNodes.find(n => n.nodeId === 'NODO_6_DEFENSA');
    const node7 = processedNodes.find(n => n.nodeId === 'NODO_7_ESTRUCTURAL');

    const energyBiomarkers = [...(node3?.key_biomarkers || []), ...(node5?.key_biomarkers || [])]
        .slice(0, 4)
        .map(translateBiomarkerToSpanish);
    const tissueBiomarkers = [...(node6?.key_biomarkers || []), ...(node7?.key_biomarkers || [])]
        .slice(0, 4)
        .map(translateBiomarkerToSpanish);

    const isPregnantOrLactating = Boolean(serum?.anamnesis360Context?.isPregnant || serum?.anamnesis360Context?.isLactating);
    const switch33PlusToDecaf = Boolean(hasStimulantsConflict || isPregnantOrLactating);

    // Protocolo Circadiano Dual de 4 Tomas (🔴 33Plus® y 🟢 34Plus®)
    const circadianSchedule = [
        {
            tomaNumber: 1,
            timeSlot: "04:00 hrs (Al Despertar / Alba)",
            phase: "FASE DIURNA — Ignición Mitocondrial y Biogénesis",
            formula: switch33PlusToDecaf ? "🔴 33Plus® (Variante Modulada Sin Estimulantes)" : "🔴 33Plus® (Fórmula Maestra de Ignición)",
            dosage: "1 sobre (10g) diluido en 300 ml de agua tibia",
            clinicalObjective: "Inducción rápida de ATP mitocondrial, oxigenación cerebral y activación del ciclo de Krebs.",
            waterVolumeMl: 300
        },
        {
            tomaNumber: 2,
            timeSlot: "09:30 hrs (Media Mañana)",
            phase: "FASE DIURNA — Rendimiento Cognitivo y Estabilidad Metabólica",
            formula: switch33PlusToDecaf ? "🔴 33Plus® (Variante Modulada Sin Estimulantes)" : "🔴 33Plus® (Fórmula Maestra de Ignición)",
            dosage: "1 sobre (10g) diluido en 300 ml de agua a temperatura ambiente",
            clinicalObjective: "Sostén de neurotransmisores catecolaminérgicos, concentración sostenida y modulación termogénica limpia.",
            waterVolumeMl: 300
        },
        {
            tomaNumber: 3,
            timeSlot: "15:00 hrs (Media Tarde)",
            phase: "FASE VESPERTINA — Homeostasis Tisular y Desinflamación",
            formula: "🟢 34Plus® (Fórmula Maestra de Regeneración Tisular)",
            dosage: "1 sobre (10g) diluido en 500 ml de agua purificada 💧",
            clinicalObjective: "Reparación de la barrera enterocitaria intestinal, alcalinización sistémica y modulación del estrés oxidativo vespertino.",
            waterVolumeMl: 500
        },
        {
            tomaNumber: 4,
            timeSlot: "20:30 hrs (Previa al Sueño / Anabolismo Nocturno)",
            phase: "FASE NOCTURNA — Reconstrucción Miofascial y Carga Anabólica Somatotrópica",
            formula: "🟢 34Plus® (Fórmula Maestra de Regeneración Tisular)",
            dosage: "1 sobre (10g) diluido en 500 ml de agua purificada 💧",
            clinicalObjective: "Inducción del anabolismo profundo nocturno de las 21:00 hrs, cross-linking de colágeno tipo I/III, remineralización y detoxificación de matriz celular.",
            waterVolumeMl: 500
        }
    ];

    const sup33 = switch33PlusToDecaf
        ? {
            id: 'sup_33plus',
            cortex: '33Plus® (Modulación Mitocondrial con Candado NOM-028)',
            name: '33 PLUS® (Protocolo Libre de Estimulantes) - L-Teanina Pura, CoQ10, Cromo (200mcg) y Polifenoles',
            dosage: '2 tomas al día: Toma 1 (04:00 hrs) y Toma 2 (09:30 hrs), cada una en 300 ml de agua tibia',
            timing: 'Cronobiología Matutina Circadiana (04:00 y 09:30 hrs)',
            rationale: `⚠️ BLOQUEO DE BIOSEGURIDAD (NOM-028 / Fisiológico): Conmutación a variante libre de estimulantes para resguardar la hemodinámica y neuroestabilidad${energyBiomarkers.length > 0 ? ` para atender: ${energyBiomarkers.join(' | ')}` : ''}.`,
            status: 'approved'
        }
        : {
            id: 'sup_33plus',
            cortex: '33Plus® (Ignición Mitocondrial y Reología Vascular)',
            name: '33 PLUS® - Polifenoles de Semilla de Uva, CoQ10, Cromo (200mcg) y L-Teanina',
            dosage: '2 tomas al día: Toma 1 (04:00 hrs) y Toma 2 (09:30 hrs), cada una en 300 ml de agua tibia',
            timing: 'Cronobiología Matutina Circadiana (04:00 y 09:30 hrs)',
            rationale: energyBiomarkers.length > 0
                ? `Prescripción dirigida por hallazgos en expediente (${energyBiomarkers.join(' | ')}): optimiza la oxidación de lipoproteínas aterogénicas (LDL/sdLDL), reduce la viscosidad sanguínea y mejora la perfusión endotelial diurna.`
                : 'Optimización de microcirculación, oxigenación tisular diurna y sensibilidad a la insulina.',
            status: 'approved'
        };

    const sup34 = {
        id: 'sup_34plus',
        cortex: '34Plus® (Ingeniería Tisular y Homeostasis Mucosa)',
        name: '34 PLUS® - Péptidos de Colágeno Hidrolizado, Vitamina C, L-Arginina e Inulina Prebiótica',
        dosage: '2 tomas al día: Toma 3 (15:00 hrs) y Toma 4 (20:30 hrs), cada una en MÍNIMO 500 ml de agua 💧',
        timing: 'Cronobiología Vespertina / Nocturna Circadiana (15:00 y 20:30 hrs)',
        rationale: tissueBiomarkers.length > 0
            ? `Prescripción dirigida por hallazgos tisulares/inmunológicos (${tissueBiomarkers.join(' | ')}): promueve la regeneración de la barrera epitelial y matriz dérmica durante el sueño profundo. La dilución en 500 ml de agua es obligatoria para proteger el vaciado gástrico y el aclaramiento glinfático.`
            : 'Reparación de matriz extracelular y trofismo mucoso nocturno. Dilución obligatoria en 500 ml de agua para favorecer el aclaramiento glinfático.',
        status: 'approved'
    };

    return {
        protocolName: "Protocolo Circadiano Dual de Restauración Celular (33Plus® & 34Plus®)",
        dietaryPlan: {
            regimen: "NutriKeto Personalizado",
            universalExclusions: ["0 Picante", "0 Cerdo", "0 Azúcares refinados"],
            patientSpecificExclusions: serum?.combinedExclusions || []
        },
        circadianSchedule,
        supplements: [sup33, sup34],
        has_calcium_contraction_lock: Boolean(serum?.hasHighSerumCalciumOrCalcification),
        calcium_alert_text: serum?.hasHighSerumCalciumOrCalcification
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
                const rawSnapshot = cryptoVault.decryptClinicalData(row.patient_data_snapshot);
                try {
                    patientData = typeof rawSnapshot === 'string' ? JSON.parse(rawSnapshot || '{}') : (rawSnapshot || {});
                } catch (pe) {
                    patientData = {};
                }
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
                ? activeNodesWithAnomalies.map(n => `• ${n.nodeName.replace(/^(?:(?:Nodo\s*)?\d+[.:\s-]*)+/i, '')} (${n.cie10}): ${n.summary}`).join(' ')
                : 'Homeostasis funcional conservada en los 7 Nodos de la Matriz IFM (Z00.0).');

        const critical_alerts = [];
        if (isLactanteExplicit) {
            critical_alerts.push(`PROTOCOLO LACTANTE: Constantes vitales normales en escala PALS/OMS (FC ${heartRate} LPM). Prescrita Estimulación Psicomotriz.`);
        } else if (isExerciseRestricted) {
            critical_alerts.push("Salvaguarda de Esfuerzo Físico (Adulto): Bloqueado entrenamiento en Zona 5 (HIIT) por perfil sedentario o hemodinámico. Prescrita Zona 2 Ligera + Movilidad Diaria Adaptada (NEAT).");
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
                critical_alerts.push(`ALERTA ${n.nodeName.replace(/^(?:(?:Nodo\s*)?\d+[.:\s-]*)+/i, '').toUpperCase()} (${n.cie10}): ${n.key_biomarkers.slice(0, 4).join(' | ')}`);
            }
        });

        const suggested_management = isLactanteExplicit ? [
            "1. Preservación de Lactancia Materna / Fórmula Pediátrica + Introducción Guiada de Sólidos (BLW/Papillas)",
            "2. Monitoreo Ponderal y Crecimiento Longitudinal (L-OMS)",
            "3. Estimulación Psicomotriz Activa y Tiempo de Juego (Tummy Time)",
            "4. Soporte Nutricional Pediátrico bajo Supervisión del Pediatra Tratante"
        ] : [
            ...activeNodesWithAnomalies.map((n, idx) => `${idx + 1}. [${n.nodeName.replace(/^(?:(?:Nodo\s*)?\d+[.:\s-]*)+/i, '')} - ${n.cie10}] ${n.therapeutic_focus}`),
            `${activeNodesWithAnomalies.length + 1}. [Bioenergética ${bioenergetics.equationUsed}] TMB: ${bioenergetics.bmr} kcal | TDEE: ${bioenergetics.tdee} kcal | Meta Prescrita: ${bioenergetics.targetKcal} kcal (${bioenergetics.macros.carbs}% C / ${bioenergetics.macros.protein}% P / ${bioenergetics.macros.fat}% L).`,
            `${activeNodesWithAnomalies.length + 2}. [Readaptación Física] ${physicalStrategyText}`,
            `${activeNodesWithAnomalies.length + 3}. [Cronobiología Ortomolecular] ${orthomolecularPrescription.supplements[0].name} (Mañana) + ${orthomolecularPrescription.supplements[1].name} (Noche en 500 ml de agua 💧).`
        ];

        const payload = {
            doctrina_aplicada: determinedRoute === 'RUTA_A'
                ? 'Ruta Clínica A • Endocrinología y Desarrollo Pediátrico L-OMS (Primeros 1000 Días)'
                : `Ruta Clínica ${determinedRoute.replace('RUTA_', '')} • Medicina Funcional de Sistemas (Matriz IFM de 7 Nodos v2.4)`,
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
                    SET patient_data_snapshot = ?, last_updated = CURRENT_TIMESTAMP
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

        const cipherSnapshot = cryptoVault.encryptClinicalData(patientData);
        stmtSave.run(citationId.toString(), nextPhase, nextBlock, cipherSnapshot);

        cryptoVault.appendAuditLedger({
            actorId: 'SPECIALIST_SHERPA',
            action: 'APPROVE_DOSSIER',
            patientId: citationId.toString(),
            payload: { phase: nextPhase, approvedAt: new Date().toISOString() }
        });

        console.log(`💾 [RLHF SUCCESS] Expediente v2.4 sellado con deltas de especialista para Cita #${citationId}`);
        res.json({ success: true, message: "Expediente sellado por el especialista con metadatos RLHF." });

    } catch (err) {
        console.error("🔥 Error en approveDossier:", err.message);
        res.status(500).json({ success: false, message: "Error al sellar el expediente clínico." });
    }
};

/**
 * POST /api/cortex/presync-baseline
 * Persiste silenciosamente el snapshot basal completo ($T_0$) de los 245 biomarcadores
 * antes de la reducción del payload de red, blindando la línea base para revaloración a 28 días.
 */
const presyncBaselineSnapshot = async (req, res) => {
    const { citationId, rawPatientData, electret245Baseline } = req.body;

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta el parámetro citationId." });
    }

    try {
        const fullBaseline = {
            ...(rawPatientData || {}),
            electretTelemetry: electret245Baseline || rawPatientData?.electretTelemetry || {},
            presyncedAt: new Date().toISOString(),
            isBaselineT0: true
        };

        const cipherSnapshot = cryptoVault.encryptClinicalData(fullBaseline);

        const stmt = db.prepare(`
            INSERT INTO session_persistence (citation_id, last_active_phase, last_active_block, patient_data_snapshot, is_completed, last_updated)
            VALUES (?, 19, 'BASELINE_T0', 0, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(citation_id) DO UPDATE SET
                patient_data_snapshot = excluded.patient_data_snapshot,
                last_active_phase = 19,
                last_active_block = 'BASELINE_T0',
                last_updated = CURRENT_TIMESTAMP
        `);
        stmt.run(citationId.toString(), cipherSnapshot);

        cryptoVault.appendAuditLedger({
            actorId: 'CORTEX_PRESYNC',
            action: 'PRESYNC_BASELINE_T0',
            patientId: citationId.toString(),
            payload: { baselineSaved: true, timestamp: new Date().toISOString() }
        });

        console.log(`💾 [PRESYNC T0] Línea base de 245 biomarcadores Electret asegurada para Cita #${citationId}`);
        res.json({
            success: true,
            message: "Línea base cuántica T0 de 245 biomarcadores preservada exitosamente en SQLite.",
            citationId
        });
    } catch (err) {
        console.error("🔥 Error en presyncBaselineSnapshot:", err.message);
        res.status(500).json({ success: false, message: "Error al presincronizar la línea base T0.", details: err.message });
    }
};

module.exports = {
    synthesizeDossier,
    approveDossier,
    presyncBaselineSnapshot,
    distillClinicalSerum,
    buildOrthomolecularPrescription,
    calculatePrecisionWeights,
    calculatePrecisionBioenergetics,
    processCortexNodesInBatches
};
