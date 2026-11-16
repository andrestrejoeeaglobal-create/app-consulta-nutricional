const { db } = require('../db');
const cryptoVault = require('../utils/cryptoVault');

const ASSIGNED_CITATION_USER_MAP = {
    '21161': '32071'
};

function normalizeControllerCitationId(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s || s === '0' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
    return s;
}

function normalizeControllerUserId(raw, citationIdHint = null) {
    if (raw !== null && raw !== undefined) {
        const s = String(raw).trim();
        if (s && s !== '0' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') {
            return s;
        }
    }
    if (citationIdHint !== null && citationIdHint !== undefined) {
        const cKey = String(citationIdHint).trim();
        if (ASSIGNED_CITATION_USER_MAP[cKey]) {
            return ASSIGNED_CITATION_USER_MAP[cKey];
        }
    }
    return null;
}
const {
    sanitizeClinicalSpanish,
    normalizeMetricDecimals,
    joinSpanishList,
    isPhysiologicallyNormal,
    normalizeForMatch,
    sanitizeSnapshotStringsRecursively,
    enforcePatientGenderConcordance,
    filterOrphanTelemetryAnnexes
} = require('../utils/clinicalTextSanitizer');

function resolveBackendPatientIsFemale(patientData) {
    const raw =
        patientData?.identityLock?.patientInfo?.gender ??
        patientData?.identityLock?.patientInfo?.sex ??
        patientData?.identificacion?.sexo ??
        patientData?.identificacion?.genero ??
        patientData?.profile?.sex ??
        patientData?.profile?.gender ??
        patientData?.sex ??
        patientData?.genero ??
        '';
    const norm = String(raw ?? '').trim().toUpperCase();
    return norm === '2' || norm === 'F' || norm === 'FEMENINO' || norm === 'FEMALE' || norm === 'MUJER' || norm.startsWith('FEM');
}

function sanitizeLegacyTelemetryInPatientData(rawPatientData) {
    if (!rawPatientData || typeof rawPatientData !== 'object') return rawPatientData;
    const data = { ...rawPatientData };
    const lp = data.lifestyle_profile ? { ...data.lifestyle_profile } : null;
    const legacyLs = data.lifestyle ? { ...data.lifestyle } : null;
    const cc = data.clinical_context ? { ...data.clinical_context } : null;

    const canonicalSourceType =
        lp?.activity?.source_type ||
        cc?.activity?.exercise?.source_type ||
        legacyLs?.activity?.source_type ||
        'MANUAL';

    const isConfirmedTelemetry = canonicalSourceType === 'TELEMETRY_TCX';

    if (!isConfirmedTelemetry) {
        if (lp && lp.activity) {
            lp.activity = {
                ...lp.activity,
                source_type: 'MANUAL',
                telemetry_metadata: null
            };
        }
        if (legacyLs && legacyLs.activity) {
            legacyLs.activity = {
                ...legacyLs.activity,
                ...(lp?.activity ? {
                    has_scheduled_exercise: lp.activity.has_scheduled_exercise,
                    neat_level: lp.activity.neat_level,
                    log: lp.activity.log
                } : {}),
                source_type: 'MANUAL',
                telemetry_metadata: null
            };
        }
        if (cc) {
            if (cc.activity?.exercise) {
                cc.activity = {
                    ...cc.activity,
                    exercise: {
                        ...cc.activity.exercise,
                        source_type: 'MANUAL',
                        telemetry_metadata: null
                    }
                };
            }
            if (Array.isArray(cc.annexes)) {
                cc.annexes = filterOrphanTelemetryAnnexes(cc.annexes, true);
            }
        }
    }

    if (lp) data.lifestyle_profile = lp;
    if (legacyLs) data.lifestyle = legacyLs;
    if (cc) data.clinical_context = cc;
    return data;
}

function capitalizeLeadingSpanishLetter(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    if (!trimmed) return '';
    // Si inicia con "(1)líquido...", respetar el prefijo numérico y capitalizar la primera letra
    return trimmed.replace(/^(\(\d+\)\s*)?([\p{Ll}])/u, (_, prefix = '', ch) => `${prefix}${ch.toUpperCase()}`);
}

function cleanClinicalLabel(rawLabel) {
    return capitalizeLeadingSpanishLetter(sanitizeClinicalSpanish(rawLabel || ''));
}

function evaluateRangeDirection(rawVal, rawRef) {
    if (rawVal === null || rawVal === undefined || rawRef === null || rawRef === undefined) {
        return 'OUT_OF_RANGE';
    }
    const vNum = parseFloat(String(rawVal).replace(',', '.').replace(/[^0-9.-]/g, ''));
    if (isNaN(vNum)) return 'OUT_OF_RANGE';
    const refNorm = String(rawRef).replace(/,/g, '.');
    const m = refNorm.match(/(-?\d+(?:\.\d+)?)\s*[-–~]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return 'OUT_OF_RANGE';
    const min = parseFloat(m[1]);
    const max = parseFloat(m[2]);
    if (isNaN(min) || isNaN(max)) return 'OUT_OF_RANGE';
    const lowBound = Math.min(min, max);
    const highBound = Math.max(min, max);
    if (vNum < lowBound) return 'LOW';
    if (vNum > highBound) return 'HIGH';
    return 'IN_RANGE';
}

/**
 * Clasificador Ontológico Exhaustivo de las 37 Categorías Electret + Categorías Femeninas
 * y Enrutamiento Fino de Micronutrientes (Cero pérdida silenciosa y cero cajón de sastre en Nodo 7).
 */
function classifyElectretParameterToNode(catKey, itemKey, cleanName) {
    const cKey = normalizeForMatch(catKey);
    const pKey = normalizeForMatch(itemKey || cleanName);

    // 0. Exclusión limpia de meridianos de acupuntura hacia telemetría bioenergética auxiliar
    if (cKey === 'meridians' || cKey.includes('meridiano')) {
        return { nodeId: 'AUXILIARY_MERIDIANS' };
    }

    // 1. Enrutamiento fino de Vitaminas (vitamins)
    if (cKey === 'vitamins' || cKey.startsWith('vitamina')) {
        if (pKey.includes('vitamina_d') || pKey.includes('d3') || pKey.includes('vitamina_k')) {
            return { nodeId: 'NODO_7_ESTRUCTURAL' };
        }
        if (pKey.includes('vitamina_c') || pKey.includes('vitamina_e') || pKey.includes('vitamina_a')) {
            return { nodeId: 'NODO_6_DEFENSA' };
        }
        // Complejo B (B1, B2, B3, B6, B9, B12) -> Cofactores mitocondriales y ciclo de Krebs
        return { nodeId: 'NODO_3_ENERGIA' };
    }

    // 2. Enrutamiento fino de Oligoelementos / Minerales (trace_elements)
    if (cKey === 'trace_elements' || cKey.includes('oligoelemento') || cKey.includes('mineral')) {
        if (['calcio', 'fosforo', 'silicio', 'boro', 'estroncio', 'fluor', 'manganeso'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_7_ESTRUCTURAL' };
        }
        if (['hierro', 'cobre', 'cobalto'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_5_TRANSPORTE' };
        }
        if (['zinc', 'selenio', 'niquel'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_6_DEFENSA' };
        }
        if (['potasio', 'magnesio', 'vanadio', 'cromo'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_3_ENERGIA' };
        }
        if (pKey.includes('yodo')) {
            return { nodeId: 'NODO_4_COMUNICACION' };
        }
        if (['molibdeno', 'estano'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_2_BIOTRANSFORMACION' };
        }
        return { nodeId: 'NODO_3_ENERGIA' };
    }

    // 3. Enrutamiento fino de Aminoácidos (amino_acids)
    if (cKey === 'amino_acids' || cKey.includes('aminoacido')) {
        if (['leucina', 'isoleucina', 'valina'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_7_ESTRUCTURAL' };
        }
        if (['triptofano', 'fenilalanina', 'tirosina'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_4_COMUNICACION' };
        }
        if (pKey.includes('arginina')) {
            return { nodeId: 'NODO_5_TRANSPORTE' };
        }
        if (pKey.includes('metionina')) {
            return { nodeId: 'NODO_2_BIOTRANSFORMACION' };
        }
        if (pKey.includes('treonina') || pKey.includes('glutamina')) {
            return { nodeId: 'NODO_1_ASIMILACION' };
        }
        // Lisina, Histidina -> inmunidad, reparación epitelial y modulación histamínica
        return { nodeId: 'NODO_6_DEFENSA' };
    }

    // 4. Enrutamiento fino de Ojo / Microcirculación Periocular (eye)
    if (cKey === 'eye' || cKey === 'ojo' || cKey === 'ojos') {
        if (pKey.includes('fatiga_visual')) {
            return { nodeId: 'NODO_4_COMUNICACION' };
        }
        if (pKey.includes('arrugas') || pKey.includes('colageno') || pKey.includes('flacidez')) {
            return { nodeId: 'NODO_7_ESTRUCTURAL' };
        }
        return { nodeId: 'NODO_5_TRANSPORTE' };
    }

    // 5. Enrutamiento fino de Condición Física Básica (basic_physical)
    if (cKey === 'basic_physical' || cKey.includes('fisica_basica')) {
        if (pKey.includes('hipoxia')) return { nodeId: 'NODO_5_TRANSPORTE' };
        if (pKey.includes('mental') || pKey.includes('respuesta')) return { nodeId: 'NODO_4_COMUNICACION' };
        return { nodeId: 'NODO_3_ENERGIA' };
    }

    // 6. Enrutamiento fino de Composición Corporal (body_composition)
    if (cKey === 'body_composition' || cKey.includes('composicion_corporal')) {
        if (pKey.includes('grasa_corporal')) return { nodeId: 'NODO_3_ENERGIA' };
        return { nodeId: 'NODO_7_ESTRUCTURAL' };
    }

    // 7. Categorías Sistémicas Directas (Cobertura 100% de las 37 categorías canónicas + variantes femeninas)
    const DIRECT_CATEGORY_MAP = {
        // Nodo 1: Asimilación y Barrera Digestiva
        gastrointestinal: 'NODO_1_ASIMILACION',
        stomach: 'NODO_1_ASIMILACION',
        intestinal: 'NODO_1_ASIMILACION',
        colon: 'NODO_1_ASIMILACION',
        large_intestine: 'NODO_1_ASIMILACION',
        pancreas: 'NODO_1_ASIMILACION',
        digestivo: 'NODO_1_ASIMILACION',

        // Nodo 2: Biotransformación Hepatorrenal y Detoxificación
        liver: 'NODO_2_BIOTRANSFORMACION',
        higado: 'NODO_2_BIOTRANSFORMACION',
        gallbladder: 'NODO_2_BIOTRANSFORMACION',
        vesicula: 'NODO_2_BIOTRANSFORMACION',
        renal: 'NODO_2_BIOTRANSFORMACION',
        kidney: 'NODO_2_BIOTRANSFORMACION',
        rinon: 'NODO_2_BIOTRANSFORMACION',
        toxins: 'NODO_2_BIOTRANSFORMACION',
        human_toxin: 'NODO_2_BIOTRANSFORMACION',
        heavy_metals: 'NODO_2_BIOTRANSFORMACION',
        metales_pesados: 'NODO_2_BIOTRANSFORMACION',

        // Nodo 3: Bioenergética Mitocondrial y Metabolismo Lipídico-Glucémico
        blood_sugar: 'NODO_3_ENERGIA',
        azucar_en_la_sangre: 'NODO_3_ENERGIA',
        blood_lipids: 'NODO_3_ENERGIA',
        lipidos_sanguineos: 'NODO_3_ENERGIA',
        obesity: 'NODO_3_ENERGIA',
        obesidad: 'NODO_3_ENERGIA',
        coenzymes: 'NODO_3_ENERGIA',
        coenzimas: 'NODO_3_ENERGIA',
        fatty_acids: 'NODO_3_ENERGIA',
        acidos_grasos: 'NODO_3_ENERGIA',

        // Nodo 4: Comunicación Neuroendocrina, Cerebral y Reproductiva
        endocrine: 'NODO_4_COMUNICACION',
        tiroides: 'NODO_4_COMUNICACION',
        thyroid: 'NODO_4_COMUNICACION',
        brain: 'NODO_4_COMUNICACION',
        brain_nerve: 'NODO_4_COMUNICACION',
        cerebro: 'NODO_4_COMUNICACION',
        prostate: 'NODO_4_COMUNICACION',
        prostata: 'NODO_4_COMUNICACION',
        male_sexual: 'NODO_4_COMUNICACION',
        sperm_semen: 'NODO_4_COMUNICACION',
        gynecology: 'NODO_4_COMUNICACION',
        ginecologia: 'NODO_4_COMUNICACION',
        breasts: 'NODO_4_COMUNICACION',
        mammary: 'NODO_4_COMUNICACION',
        mama: 'NODO_4_COMUNICACION',
        menstrual_cycle: 'NODO_4_COMUNICACION',
        ciclo_menstrual: 'NODO_4_COMUNICACION',
        female_sexual: 'NODO_4_COMUNICACION',
        uterus: 'NODO_4_COMUNICACION',

        // Nodo 5: Transporte Cardiovascular, Cerebrovascular y Respiratorio
        cardiovascular: 'NODO_5_TRANSPORTE',
        cerebrovascular: 'NODO_5_TRANSPORTE',
        pulso_cerebro_y_corazon: 'NODO_5_TRANSPORTE',
        heart_brain_pulse: 'NODO_5_TRANSPORTE',
        pulmonary: 'NODO_5_TRANSPORTE',
        lung: 'NODO_5_TRANSPORTE',
        pulmonar: 'NODO_5_TRANSPORTE',

        // Nodo 6: Defensa Inmunológica, Alergias y Piel
        immune: 'NODO_6_DEFENSA',
        inmunologico: 'NODO_6_DEFENSA',
        allergies: 'NODO_6_DEFENSA',
        alergias: 'NODO_6_DEFENSA',
        skin: 'NODO_6_DEFENSA',
        piel: 'NODO_6_DEFENSA',

        // Nodo 7: Integridad Estructural, Matriz Ósea, Reumatoide y Colágeno
        bone_disease: 'NODO_7_ESTRUCTURAL',
        bone_density: 'NODO_7_ESTRUCTURAL',
        bone_mineral_density: 'NODO_7_ESTRUCTURAL',
        rheumatoid: 'NODO_7_ESTRUCTURAL',
        rheumatoid_bone: 'NODO_7_ESTRUCTURAL',
        bone_growth: 'NODO_7_ESTRUCTURAL',
        collagen: 'NODO_7_ESTRUCTURAL',
        colageno: 'NODO_7_ESTRUCTURAL'
    };

    if (DIRECT_CATEGORY_MAP[cKey]) {
        return { nodeId: DIRECT_CATEGORY_MAP[cKey] };
    }

    // Respaldo semántico por palabras clave antes de levantar alerta de auditoría ontológica
    const combined = `${cKey}_${pKey}`;
    if (/(gastro|estomag|intestin|colon|pepsin|pancrea|absorcion)/.test(combined)) return { nodeId: 'NODO_1_ASIMILACION' };
    if (/(higado|hepat|vesicul|biliar|renal|rinon|urobilin|proteinuri|toxin|pesticid|metal|plomo|mercuri|arsenic|cadmi)/.test(combined)) return { nodeId: 'NODO_2_BIOTRANSFORMACION' };
    if (/(glucos|insulina|colesterol|triglic|lipoprotein|hdl|ldl|coenzim|obesid|adip|acido_graso)/.test(combined)) return { nodeId: 'NODO_3_ENERGIA' };
    if (/(endocrin|tiroid|cerebr|craneal|memoria|pineal|hipotal|prostat|esperma|semen|testosteron|gonad|ginecol|menstru|estrogen|progesteron)/.test(combined)) return { nodeId: 'NODO_4_COMUNICACION' };
    if (/(cardio|vascular|coronari|miocard|pulmon|respirat|capacidad_vital|paco2|sao2|viscosidad|bombeo|latido)/.test(combined)) return { nodeId: 'NODO_5_TRANSPORTE' };
    if (/(inmun|linf|amigdal|alerg|histamin|cutane|melanin|dermat)/.test(combined)) return { nodeId: 'NODO_6_DEFENSA' };
    if (/(hueso|osea|osteocalcin|osteopor|reumat|colagen|calcificac|lumbar|cervical|muscul)/.test(combined)) return { nodeId: 'NODO_7_ESTRUCTURAL' };

    console.warn(`[CORTEX ONTOLOGY AUDIT] Parámetro Electret sin categoría canónica reconocida: cat="${catKey}", key="${itemKey}", name="${cleanName}". Enrutando a revisión clínica.`);
    return { nodeId: 'NODO_2_BIOTRANSFORMACION', requiresOntologyReview: true };
}

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
function calculatePrecisionBioenergetics(rawPatientData, ageYears, ageMonths, isLactanteExplicit, isPediatricExplicit) {
    const patientData = sanitizeLegacyTelemetryInPatientData(rawPatientData || {});
    const rawWeight = parseFloat(patientData?.vitals?.weight || patientData?.peso || patientData?.biometria?.peso || patientData?.profile?.weight) || (isLactanteExplicit ? 9.5 : 72);
    const rawHeight = parseFloat(patientData?.vitals?.height || patientData?.talla || patientData?.biometria?.talla || patientData?.profile?.height) || (isLactanteExplicit ? 74 : 168);
    const heightCm = rawHeight < 3 ? rawHeight * 100 : rawHeight;
    const heightM = heightCm / 100;
    const bmi = heightM > 0 ? Number((rawWeight / (heightM * heightM)).toFixed(1)) : 24.0;

    const isFemale = resolveBackendPatientIsFemale(patientData);
    const isMale = !isFemale;
    const gender = isFemale ? 'Femenino' : 'Masculino';

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
function distillClinicalSerum(rawPatientData, isLactanteExplicit = false) {
    const patientData = sanitizeLegacyTelemetryInPatientData(rawPatientData || {});
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

    const pushAnomaly = (nodeKey, source, label, detail, severity = 'MODERADA', extraMeta = {}) => {
        if (!label && !detail) return;
        if (!nodesMap[nodeKey]) return;
        nodesMap[nodeKey].anomalies.push({
            source,
            label: cleanClinicalLabel(label),
            detail: sanitizeClinicalSpanish(String(detail || '').trim()),
            severity,
            ...extraMeta
        });
    };

    // Declaración e inicialización estricta de variables de control clínico y bioseguridad
    let hasHighSerumCalciumOrCalcification = false;
    const auxiliaryBioenergetics = [];
    const unmappedOntologyWarnings = [];
    const electretSignals = {
        hasRenalBurden: false,
        hasSevereRenalAlert: false,
        hasHepaticBurden: false,
        hasBiliaryBurden: false,
        hasDigestiveSensitivity: false,
        hasCalcificationAlert: false,
        hasThyroidAlert: false,
        renalMarkers: [],
        hepaticMarkers: []
    };

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
    const lp = patientData?.lifestyle_profile || {};
    const lifestyle = patientData?.lifestyle || {};
    const rawSleep = lp.sleep || lifestyle.sleep || patientData?.habitos?.sueno || {};
    const sleep = {
        ...rawSleep,
        hours: rawSleep.hours_avg ?? rawSleep.hours
    };
    const stress = lp.stress || lifestyle.stress || patientData?.habitos?.estres || {};
    const toxic = lifestyle.toxic_habits || patientData?.habits_toxicology || patientData?.habitos?.toxicos || {};

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
        else if (normKey.includes('potasio') || normKey === 'k' || normKey.startsWith('k_')) labValues.potassium = num;
    }

    Object.entries(labSections).forEach(([secKey, secObj]) => {
        const items = Array.isArray(secObj?.items) ? secObj.items : (Array.isArray(secObj) ? secObj : []);
        items.forEach(item => {
            const name = cleanClinicalLabel(item.name || item.label || item.parameter || 'Biomarcador');
            registerLabNumeric(name, item.val ?? item.value);

            const st = String(item.status || '').toUpperCase().trim();
            if (st && !isPhysiologicallyNormal(st)) {
                seenLabKeys.add(name.toUpperCase());
                const normLabVal = normalizeMetricDecimals(item.val ?? item.value ?? '');
                const normLabRef = normalizeMetricDecimals(item.ref || item.reference || 'N/A');
                const detail = `${normLabVal} ${item.unit || ''} (Ref: ${normLabRef} | Estado: ${st})`.trim();
                const upperName = `${secKey} ${name}`.toUpperCase();

                if (upperName.includes('COLESTEROL') || upperName.includes('LDL') || upperName.includes('HDL') || upperName.includes('TRIGLIC') || upperName.includes('ATEROG') || upperName.includes('GLUCOSA') || upperName.includes('INSULINA') || upperName.includes('HBA1C')) {
                    pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', name, detail, 'ALTA');
                } else if (upperName.includes('BASÓFIL') || upperName.includes('BASOFIL') || upperName.includes('LEUCOCIT') || upperName.includes('EOSIN') || upperName.includes('LINFOCIT') || upperName.includes('NEUTRÓFIL') || upperName.includes('PCR') || upperName.includes('VSG') || upperName.includes('FERRITINA')) {
                    pushAnomaly('NODO_6_DEFENSA', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('HEMOGLOBINA') || upperName.includes('HEMATOCRITO') || upperName.includes('ERITROCIT') || upperName.includes('PLAQUETA') || upperName.includes('HIERRO') || upperName.includes('HOMOCISTEINA') || upperName.includes('HOMOCISTEÍNA')) {
                    pushAnomaly('NODO_5_TRANSPORTE', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('CREATININA') || upperName.includes('UREA') || upperName.includes('BUN') || upperName.includes('ÁCIDO ÚRICO') || upperName.includes('ACIDO URICO') || upperName.includes('AST') || upperName.includes('ALT') || upperName.includes('GGT') || upperName.includes('BILIRRUBINA') || upperName.includes('ORINA') || upperName.includes('POTASIO')) {
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
        const name = cleanClinicalLabel(typeof v === 'object' ? (v.name || v.label || k) : k);
        const rawVal = typeof v === 'object' ? (v.value ?? v.val) : v;
        registerLabNumeric(name, rawVal);

        const st = typeof v === 'object' ? String(v.status || '').toUpperCase().trim() : '';
        if (st && !isPhysiologicallyNormal(st) && !seenLabKeys.has(name.toUpperCase())) {
            const detail = `${normalizeMetricDecimals(rawVal ?? '')} ${typeof v === 'object' ? (v.unit || '') : ''} (${st})`.trim();
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

    // 4. Biotransformación Hepatorrenal (Creatinina, TFG, BUN, Ácido Úrico, Potasio, TGO/AST, TGP/ALT, GGT, Bilirrubinas)
    if (labValues.alt > 35 || labValues.ast > 35 || labValues.ggt > 50 || labValues.bilirubin > 1.2 || labValues.uricAcid > 6.5 || labValues.creatinine > 1.2 || (labValues.gfr > 0 && labValues.gfr < 60) || labValues.potassium > 5.0) {
        pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', 'Sobrecarga de Biotransformación Hepatorrenal',
            `Parámetros alterados: ${[
                labValues.alt > 35 ? `ALT/TGP: ${labValues.alt} U/L` : null,
                labValues.ast > 35 ? `AST/TGO: ${labValues.ast} U/L` : null,
                labValues.ggt > 50 ? `GGT: ${labValues.ggt} U/L` : null,
                labValues.bilirubin > 1.2 ? `Bilirrubina: ${labValues.bilirubin} mg/dL` : null,
                labValues.uricAcid > 6.5 ? `Ácido Úrico: ${labValues.uricAcid} mg/dL` : null,
                labValues.creatinine > 1.2 ? `Creatinina: ${labValues.creatinine} mg/dL` : null,
                (labValues.gfr > 0 && labValues.gfr < 60) ? `TFG: ${labValues.gfr} mL/min` : null,
                labValues.potassium > 5.0 ? `Potasio: ${labValues.potassium} mEq/L` : null
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
        if (labValues.tsh > 4.5 || (labValues.tsh > 0 && labValues.tsh < 0.4)) {
            electretSignals.hasThyroidAlert = true;
        }
        pushAnomaly('NODO_4_COMUNICACION', 'OCR_LAB', 'Eje Neuroendocrino / Tiroideo-Adrenal Alterado',
            `Hormonas: ${[
                labValues.tsh ? `TSH: ${labValues.tsh} µUI/mL` : null,
                labValues.cortisol ? `Cortisol: ${labValues.cortisol} µg/dL` : null
            ].filter(Boolean).join(' • ')}`, 'MODERADA');
    }

    // C. Anomalías de Bioimpedancia Cuántica Electret (Paso 1 de Fase 18 - Cobertura Ontológica de 37 Categorías)
    const electretCats = patientData?.scan_data?.electret_metrics || patientData?.electretTelemetry?.categories || {};

    if (electretCats && typeof electretCats === 'object') {
        Object.entries(electretCats).forEach(([catKey, catData]) => {
            const items = Array.isArray(catData?.items) ? catData.items : (Array.isArray(catData) ? catData : []);
            items.forEach(item => {
                const st = String(item.status || item.level || '').toUpperCase().trim();
                // Filtro fisiológico estricto: descarta NORMAL, NORMAL (-), NORMAL (+), OPTIMAL, CONSERVADO
                if (!st || isPhysiologicallyNormal(st)) {
                    return;
                }

                const rawName = item.displayName || item.name || item.parameter || item.label || catKey;
                let cleanName = cleanClinicalLabel(rawName);
                const normCat = normalizeForMatch(catKey);
                if (normCat === 'collagen' && !/col[áa]geno/i.test(cleanName)) {
                    cleanName = `Colágeno (${cleanName})`;
                }

                const rawVal = normalizeMetricDecimals(item.value ?? item.val ?? item.actual ?? '');
                const refStr = normalizeMetricDecimals(item.reference || item.ref || item.range || item.standard || 'N/A');
                const direction = evaluateRangeDirection(rawVal, refStr);
                const dirHint = direction === 'LOW' ? 'Bajo' : (direction === 'HIGH' ? 'Elevado' : '');
                const valStr = `${rawVal} (Ref: ${refStr} | ${st}${dirHint ? ` • ${dirHint}` : ''})`.trim();

                let sev = 'MODERADA';
                if (st.includes('+++') || st.includes('---') || st.includes('SEVER')) sev = 'CRÍTICA';
                else if (st.includes('++') || st.includes('--') || st.includes('MODERAD')) sev = 'ALTA';

                const normItemKey = normalizeForMatch(item.key || rawName);

                // Señales de bioseguridad y sobrecarga orgánica para Semáforo Clínico
                if (normItemKey.includes('calcificacion') && direction !== 'LOW') {
                    hasHighSerumCalciumOrCalcification = true;
                    electretSignals.hasCalcificationAlert = true;
                } else if (normItemKey === 'calcio' && direction === 'HIGH') {
                    hasHighSerumCalciumOrCalcification = true;
                    electretSignals.hasCalcificationAlert = true;
                }

                if (normCat === 'renal' || normItemKey.includes('proteinuria') || normItemKey.includes('acido_urico') || normItemKey.includes('urobilinogeno') || normItemKey.includes('nitrogeno_ureico')) {
                    if (sev === 'ALTA' || sev === 'CRÍTICA' || normItemKey.includes('proteinuria')) {
                        electretSignals.hasRenalBurden = true;
                        electretSignals.renalMarkers.push(cleanName);
                    }
                    if (sev === 'CRÍTICA' && normItemKey.includes('proteinuria')) {
                        electretSignals.hasSevereRenalAlert = true;
                    }
                }

                if (normCat === 'liver' || normItemKey.includes('grasa_en_el_higado') || normItemKey.includes('desintoxicacion')) {
                    if (sev === 'ALTA' || sev === 'CRÍTICA') {
                        electretSignals.hasHepaticBurden = true;
                        electretSignals.hepaticMarkers.push(cleanName);
                    }
                }

                if (normCat === 'gallbladder') {
                    if (sev === 'ALTA' || sev === 'CRÍTICA') {
                        electretSignals.hasBiliaryBurden = true;
                    }
                }

                if ((normCat === 'gastrointestinal' || normCat === 'colon') && sev === 'CRÍTICA') {
                    electretSignals.hasDigestiveSensitivity = true;
                }

                if (normItemKey.includes('tiroid') || normItemKey.includes('tiroglobulina') || normItemKey.includes('paratiroid') || /(?:^|_)t[34](?:_|$)/.test(normItemKey)) {
                    if (sev === 'ALTA' || sev === 'CRÍTICA' || normItemKey.includes('tiroglobulina')) {
                        electretSignals.hasThyroidAlert = true;
                    }
                }

                const classification = classifyElectretParameterToNode(catKey, item.key, cleanName);
                if (classification.nodeId === 'AUXILIARY_MERIDIANS') {
                    auxiliaryBioenergetics.push({
                        label: cleanName,
                        detail: valStr,
                        severity: sev
                    });
                    return;
                }

                if (classification.requiresOntologyReview) {
                    unmappedOntologyWarnings.push(`${catKey}:${cleanName}`);
                }

                pushAnomaly(classification.nodeId, 'ELECTRET', cleanName, valStr, sev, {
                    direction,
                    category: normCat,
                    requiresOntologyReview: Boolean(classification.requiresOntologyReview)
                });
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
        const hasOntologyFlag = node.anomalies.some(a => a.requiresOntologyReview);
        return {
            ...node,
            hasAnomalies,
            anomaliesCount: node.anomalies.length,
            preAssignedCie10: resolvedCie.cie10,
            preAssignedLabel: resolvedCie.label,
            validation_status: hasOntologyFlag ? 'REQUIERE_REVISIÓN' : resolvedCie.validation_status
        };
    });

    const hasLabResultsLoaded = Object.keys(labValues).length > 0;

    return {
        nodes,
        hasHighSerumCalciumOrCalcification,
        combinedExclusions,
        labValues,
        hasLabResultsLoaded,
        electretSignals,
        auxiliaryBioenergetics,
        unmappedOntologyWarnings,
        vitalsSnapshot: { sys, dia, glu, waist, hip, icc },
        anamnesis360Context: {
            chiefComplaint: sanitizeClinicalSpanish(patientQuote),
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
// 4. MOTOR SSoTT (SINGLE SOURCE OF THERAPEUTIC TRUTH) + SÍNTESIS OBSERVACIONAL UNIFICADA
// ============================================================================
const IFM_BATCH_SUMMARY_SCHEMA = {
    type: 'OBJECT',
    properties: {
        nodes: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    nodeId: { type: 'STRING', description: 'Identificador exacto del Nodo IFM' },
                    status: { type: 'STRING', enum: ['HOMEOSTASIS', 'ALERTA_MODERADA', 'PRIORIDAD_ALTA', 'CRÍTICO'] },
                    summary: { type: 'STRING', description: 'Narrativa fisiopatológica observacional concisa en español (1 a 2 oraciones, cero prescripciones)' }
                },
                required: ['nodeId', 'status', 'summary']
            }
        }
    },
    required: ['nodes']
};

const SEVERITY_RANK = { CRÍTICA: 4, ALTA: 3, MODERADA: 2, LEVE: 1 };

const FORBIDDEN_SUMMARY_CLAIMS_REGEX = /(?<![\p{L}\p{N}_])(quelaci[óo]n|silimarina|glutati[óo]n|hipocal[óo]ric[ao]s?|nutriketo|cetog[ée]nic[ao]s?|fitoterapia|intoxicaci[óo]n|envenenamiento|suplementaci[óo]n\s+(?:dirigida\s+|espec[íi]fica\s+)?con)(?![\p{L}\p{N}_])/iu;
const UNCONFIRMED_NOSOLOGY_WITHOUT_LABS_REGEX = /(?<![\p{L}\p{N}_])(esteatosis\s+hep[áa]tica|acumulaci[óo]n\s+(?:significativa\s+|severa\s+)?de\s+metales\s+pesados|deficiencia\s+(?:relativa\s+|severa\s+)?de\s+yodo)(?![\p{L}\p{N}_])/iu;

/**
 * Construye el Contrato Terapéutico Canónico (SSoTT) ANTES de cualquier síntesis narrativa,
 * garantizando 100% de coherencia entre Vista Médica (NOM-004), Vista Paciente y Portapapeles.
 */
function buildCanonicalTherapeuticContract({
    serum = {},
    bioenergetics = {},
    biosecuritySemaphore = {},
    hasStimulantsConflict = false,
    isLactanteExplicit = false,
    isPediatricExplicit = false
} = {}) {
    const weightForWater = Number(bioenergetics?.weightKg) > 0 ? Number(bioenergetics.weightKg) : 70;
    const hydrationTargetLiters = Math.min(3.2, Math.max(1.8, Number(((weightForWater * 32) / 1000).toFixed(1))));
    const macros = bioenergetics?.macros || { carbs: 40, protein: 30, fat: 30 };
    const targetKcal = bioenergetics?.targetKcal || bioenergetics?.tdee || 2000;
    const tdeeKcal = bioenergetics?.tdee || targetKcal;
    const caloricDeltaType = bioenergetics?.caloricDeltaType || 'MANTENIMIENTO_RECOMPOSICION';
    const isPregnantOrLactating = Boolean(serum?.anamnesis360Context?.isPregnant || serum?.anamnesis360Context?.isLactating);
    const switch33PlusToDecaf = Boolean(hasStimulantsConflict || isPregnantOrLactating);
    const calciumLocked = Boolean(serum?.hasHighSerumCalciumOrCalcification || serum?.electretSignals?.hasCalcificationAlert);
    const hasThyroidAlert = Boolean(serum?.electretSignals?.hasThyroidAlert);
    const hasLabResultsLoaded = Boolean(serum?.hasLabResultsLoaded);
    const isPaused = Boolean(biosecuritySemaphore?.isPaused || biosecuritySemaphore?.level === 'ROJO');
    const isMicroDose = !isPaused && Boolean(biosecuritySemaphore?.isMicroDose || biosecuritySemaphore?.level === 'AMARILLO');
    const isKetoRegimen = Number(macros.carbs) > 0 && Number(macros.carbs) <= 15;

    const regimen = isLactanteExplicit
        ? 'Alimentación Pediátrica Guiada (L-OMS)'
        : (isKetoRegimen ? 'Alimentación Cetogénica Clínica' : 'Alimentación Antiinflamatoria Personalizada');
    const regimenBadge = isLactanteExplicit
        ? 'Alimentación Pediátrica L-OMS (Supervisión Pediátrica)'
        : `${isKetoRegimen ? 'NutriKeto Clínico' : 'Alimentación Antiinflamatoria'} (0 Picante • 0 Cerdo • 0 Azúcares)`;

    const patientSpecificExclusions = (serum?.combinedExclusions || [])
        .map(sanitizeClinicalSpanish)
        .filter((val) => {
            const clean = String(val || '').trim();
            if (!clean) return false;
            return !/^(ninguna?|ninguno|niega|negad[oa]s?|n\/a|na|sin\s+alergias?|sin\s+exclusiones?|sin\s+restricciones?|no|no\s+refiere|null|undefined|-+)$/i.test(clean);
        });

    const evolutionTimeline = {
        totalDays: 28,
        summaryLabel: '28 Días de seguimiento continuo (Fase 1: Días 1–7 • Fase 2: Días 8–21 • Fase 3: Días 22–28)',
        phases: isPaused
            ? [
                {
                    phase: 1,
                    rangeLabel: 'Días 1 a 7',
                    weekLabel: 'Semana 1',
                    title: 'Estabilización Inicial y Pausa Preventiva de Suplementación',
                    description: `Alimentación antiinflamatoria (${targetKcal} kcal/día), hidratación estructurada (${hydrationTargetLiters} L/día) y recopilación de estudios de laboratorio de control (0 sobres activos).`
                },
                {
                    phase: 2,
                    rangeLabel: 'Días 8 a 21',
                    weekLabel: 'Semanas 2-3',
                    title: 'Valoración Médica Paraclínica y Desinflamación Mucosa',
                    description: 'Revisión clínica de analitos solicitados para validar función renal, hepática y hemodinámica previo a cualquier suplementación.'
                },
                {
                    phase: 3,
                    rangeLabel: 'Días 22 a 28',
                    weekLabel: 'Semana 4',
                    title: 'Consolidación Metabólica y Re-Evaluación Comparativa (T0 → T1)',
                    description: `Auditoría comparativa de evolución clínica al cierre del ciclo de 28 días (${targetKcal} kcal/día).`
                }
            ]
            : isMicroDose
                ? [
                    {
                        phase: 1,
                        rangeLabel: 'Días 1 a 7',
                        weekLabel: 'Semana 1',
                        title: 'Adaptación Mucosa y Micro-Dosis Calibrada',
                        description: `Sellado epitelial digestivo (0 Picante, 0 Cerdo, 0 Azúcares), hidratación medida (${hydrationTargetLiters} L/día) e inicio gradual con 1/2 sobre (5 g) matutino de 33Plus® y 1/2 sobre (5 g) nocturno de 34Plus® en mínimo 500 ml de agua simple 💧.`
                    },
                    {
                        phase: 2,
                        rangeLabel: 'Días 8 a 21',
                        weekLabel: 'Semanas 2-3',
                        title: 'Escalamiento Gradual según Tolerancia y Modulación Metabólica',
                        description: 'Valoración de tolerancia digestiva y renal a partir del Día 8 para integrar o mantener la toma de media mañana, optimizando sensibilidad metabólica y fluidez microvascular.'
                    },
                    {
                        phase: 3,
                        rangeLabel: 'Días 22 a 28',
                        weekLabel: 'Semana 4',
                        title: 'Consolidación Funcional y Re-Evaluación Comparativa (T0 → T1)',
                        description: `Auditoría comparativa de bioseñales y estudios de control al cierre del ciclo de 28 días sobre meta de ${targetKcal} kcal/día.`
                    }
                ]
                : [
                    {
                        phase: 1,
                        rangeLabel: 'Días 1 a 7',
                        weekLabel: 'Semana 1',
                        title: 'Sincronización Circadiana y Sellado de Barrera Mucosa',
                        description: `Integración de ${regimen.toLowerCase()} (${targetKcal} kcal/día), hidratación diaria (${hydrationTargetLiters} L/día) y protocolo sincronizado de 33Plus® y 34Plus® (en mínimo 500 ml de agua simple 💧).`
                    },
                    {
                        phase: 2,
                        rangeLabel: 'Días 8 a 21',
                        weekLabel: 'Semanas 2-3',
                        title: 'Modulación Metabólica, Vascular y Reparación Tisular',
                        description: 'Optimización del transporte lipídico-glucémico, oxigenación microvascular diurna y síntesis nocturna de matriz de colágeno.'
                    },
                    {
                        phase: 3,
                        rangeLabel: 'Días 22 a 28',
                        weekLabel: 'Semana 4',
                        title: 'Consolidación Funcional y Re-Evaluación Comparativa (T0 → T1)',
                        description: `Auditoría comparativa de parámetros fuera de rango al día 28 y consolidación de composición corporal (${targetKcal} kcal/día).`
                    }
                ]
    };

    return {
        contractVersion: '3.0.0-SSOTT',
        regimen,
        regimenBadge,
        caloricDeltaType,
        tdeeKcal,
        targetKcal,
        macros,
        hydrationTargetLiters,
        patientSpecificExclusions,
        calciumLocked,
        hasThyroidAlert,
        hasLabResultsLoaded,
        isPaused,
        isMicroDose,
        isPediatricExplicit,
        isLactanteExplicit,
        switch33PlusToDecaf,
        semaphoreLevel: biosecuritySemaphore?.level || 'VERDE',
        evolutionTimeline
    };
}

/**
 * Resuelve de forma 100% determinista el `therapeutic_focus` de cada Nodo IFM acoplado al SSoTT:
 * - Cero contradicciones de calcio cuando `calciumLocked === true`.
 * - Cero dieta hipocalórica cuando `caloricDeltaType === 'MANTENIMIENTO_RECOMPOSICION'`.
 * - Cero prescripción de quelantes, silimarina, glutatión, yodo exógeno o fitoterapia fuera de T.I.L.O.
 */
function resolveNodeTherapeuticFocus(nodeId, contract = null) {
    const c = contract || buildCanonicalTherapeuticContract({});
    const kcal = c.targetKcal || 2000;
    const m = c.macros || { carbs: 40, protein: 30, fat: 30 };
    const liters = c.hydrationTargetLiters || 2.2;

    let caloricPhrase = `pauta normocalórica de mantenimiento y recomposición (${kcal} kcal/día; ${m.carbs}% CHO / ${m.protein}% P / ${m.fat}% L)`;
    if (String(c.caloricDeltaType || '').includes('DEFICIT')) {
        caloricPhrase = `ajuste energético antiinflamatorio (${kcal} kcal/día; ${m.carbs}% CHO / ${m.protein}% P / ${m.fat}% L)`;
    } else if (String(c.caloricDeltaType || '').includes('SUPERAVIT')) {
        caloricPhrase = `soporte energético de recuperación (${kcal} kcal/día; ${m.carbs}% CHO / ${m.protein}% P / ${m.fat}% L)`;
    }

    const name33 = c.switch33PlusToDecaf ? '33Plus® (variante sin estimulantes)' : '33Plus®';
    const dose33Phrase = c.isPaused
        ? 'alimentación natural sin suplementos activos (en pausa preventiva hasta validación de laboratorios)'
        : c.isMicroDose
            ? `micro-dosis gradual matutina de ${name33} (1/2 sobre de 5 g en 300 ml de agua natural en Semana 1)`
            : `esquema matutino sincronizado de ${name33} (en 300 ml de agua natural)`;

    const dose34Phrase = c.isPaused
        ? 'hidratación medida y proteína dietética suave (suplementación en pausa preventiva médica)'
        : c.isMicroDose
            ? 'micro-dosis nocturna de 34Plus® (1/2 sobre de 5 g disuelto en mínimo 500 ml de agua simple)'
            : 'protocolo vespertino y nocturno de 34Plus® (disuelto en mínimo 500 ml de agua simple)';

    switch (nodeId) {
        case 'NODO_1_ASIMILACION':
            return sanitizeClinicalSpanish(
                `Restauración de barrera mucosa digestiva mediante exclusión estricta de irritantes (0 picante, 0 cerdo, 0 azúcares refinados), tiempos pausados de masticación, hidratación fraccionada (${liters} L/día) y soporte prebiótico con ${dose34Phrase}.`
            );
        case 'NODO_2_BIOTRANSFORMACION':
            return sanitizeClinicalSpanish(
                `Soporte hepatobiliar fisiológico y nefroprotección mediante ${caloricPhrase}, hidratación estructurada (${liters} L/día de agua simple), vegetales crucíferos y fibra soluble alimentaria, evitando sobrecarga renal o insumos ajenos al protocolo.`
            );
        case 'NODO_3_ENERGIA':
            return sanitizeClinicalSpanish(
                `Modulación glucémica, sensibilidad insulínica y transporte lipídico saludable mediante ${caloricPhrase}, grasas monoinsaturadas y cofactores bioenergéticos (Coenzima Q10, Cromo y polifenoles) aportados en ${dose33Phrase}.`
            );
        case 'NODO_4_COMUNICACION':
            return sanitizeClinicalSpanish(
                `Sincronización circadiana neuroendocrina (luz natural matutina, cena ligera 2–3 h antes de dormir e higiene del sueño), regulación de carga alostática${c.hasThyroidAlert ? ' y correlación con perfil tiroideo sérico (sin administración empírica de minerales hormonales aislados)' : ''} y apoyo adaptativo con L-Teanina en ${dose33Phrase}.`
            );
        case 'NODO_5_TRANSPORTE':
            return sanitizeClinicalSpanish(
                `Optimización endotelial, fluidez microcirculatoria y oxigenación tisular mediante hidratación constante (${liters} L/día), caminata aeróbica conversacional sin impactos bruscos y polifenoles antioxidantes en ${dose33Phrase}.`
            );
        case 'NODO_6_DEFENSA':
            return sanitizeClinicalSpanish(
                `Modulación inmunológica antiinflamatoria y protección antioxidante celular (Vitamina C, aminoácidos estructurales y retiro de alérgenos/irritantes detectados), acompañada de descanso reparador y ${dose34Phrase}.`
            );
        case 'NODO_7_ESTRUCTURAL':
            if (c.calciumLocked) {
                return sanitizeClinicalSpanish(
                    `Soporte de matriz colágena y articular mediante ${dose34Phrase}, proteína dietética de alto valor biológico, magnesio y vitamina K2 alimentaria y movilidad suave sin impacto, con exclusión estricta de suplementos aislados de calcio inorgánico por alerta de calcificación ectópica.`
                );
            }
            return sanitizeClinicalSpanish(
                `Regeneración de matriz extracelular, síntesis de colágeno tipo I/III y soporte osteomuscular mediante ${dose34Phrase}, proteína dietética de alto valor biológico y movilidad articular progresiva.`
            );
        default:
            return 'Modulación nutricional personalizada e hidratación estructurada bajo monitoreo clínico.';
    }
}

function formatCleanAnomalyDescriptorForSummary(anomaly) {
    const cleanLabel = sanitizeClinicalSpanish(String(anomaly?.label || '').trim());
    if (!cleanLabel) return '';
    const detail = String(anomaly?.detail || '');
    if (/•\s*Bajo\b/i.test(detail) || anomaly?.direction === 'LOW') {
        return `${cleanLabel} disminuido`;
    }
    if (/•\s*Elevado\b/i.test(detail) || anomaly?.direction === 'HIGH') {
        return `${cleanLabel} elevado`;
    }
    return cleanLabel;
}

function formatMedicalBiomarkerSummary(rawItem) {
    const translated = translateBiomarkerToSpanish(rawItem);
    return sanitizeClinicalSpanish(translated)
        .replace(/Ref:\s*N\/A\s*\|\s*/gi, '')
        .replace(/ANORMAL\s+SEVERO\s*(\(\+\+\+\))?/gi, (_, g1) => `Alerta Severa${g1 ? ` ${g1}` : ' (+++)'}`)
        .replace(/ANORMAL\s+MODERADO\s*(\(\+\+\))?/gi, (_, g1) => `Alerta Moderada${g1 ? ` ${g1}` : ' (++)'}`)
        .replace(/ANORMAL\s+LEVE\s*(\(\+\))?/gi, (_, g1) => `Desviación Leve${g1 ? ` ${g1}` : ' (+)'}`)
        .replace(/(\d),(\d)/g, '$1.$2')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Construye una síntesis médica determinista en prosa clínica limpia (cero dobles paréntesis crudos
 * y cero volcados de rangos numéricos de debug) para garantizar uniformidad editorial 100%.
 */
function buildDeterministicNodeSynthesis(node, contract = null) {
    const rawAnomalies = Array.isArray(node.anomalies) ? node.anomalies : [];
    const anomalies = [...rawAnomalies].sort(
        (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
    );
    const count = anomalies.length;
    const hasCritical = anomalies.some(a => a.severity === 'CRÍTICA');
    const status = count === 0
        ? 'HOMEOSTASIS'
        : (hasCritical && count >= 3 ? 'CRÍTICO' : (count >= 2 ? 'PRIORIDAD_ALTA' : 'ALERTA_MODERADA'));

    const cleanNodeTitle = sanitizeClinicalSpanish(String(node.name || '').replace(/^\d+\.\s*/, '').trim());
    const topDescriptors = Array.from(
        new Set(anomalies.slice(0, 4).map(formatCleanAnomalyDescriptorForSummary).filter(Boolean))
    );
    const remainingCount = Math.max(0, count - topDescriptors.length);
    const hasConfirmedLab = anomalies.some(a => a.source === 'OCR_LAB' || a.source === 'FUNCTIONAL_INDEX');

    let summary = 'Función conservada. Sin alteraciones detectadas.';
    if (count > 0) {
        const listClause = topDescriptors.join(', ') + (remainingCount > 0 ? ` y ${remainingCount} parámetros complementarios` : '');
        if (hasConfirmedLab) {
            summary = sanitizeClinicalSpanish(
                `Correlación clínica y funcional en ${cleanNodeTitle} (${count} hallazgos registrados), destacando alteración en ${listClause}. El perfil integrado sugiere demanda adaptativa prioritaria compatible con vigilancia bajo ${node.preAssignedLabel}.`
            );
        } else {
            summary = sanitizeClinicalSpanish(
                `Se registran ${count} bioseñales funcionales fuera de rango óptimo en ${cleanNodeTitle}, con predominio en ${listClause}. Estos hallazgos orientativos sugieren sobrecarga adaptativa en el eje evaluado, sujeta a correlación clínica y confirmación paraclínica.`
            );
        }
    }

    return {
        nodeId: node.id,
        nodeName: sanitizeClinicalSpanish(node.name),
        status,
        cie10: node.preAssignedCie10 || 'Z00.0',
        validation_status: node.validation_status || 'VALIDADO',
        summary,
        key_biomarkers: anomalies.map(a => formatMedicalBiomarkerSummary(`${a.label}: ${a.detail}`)),
        therapeutic_focus: count > 0
            ? resolveNodeTherapeuticFocus(node.id, contract)
            : 'Mantenimiento preventivo y vigilancia estándar.'
    };
}

/**
 * Ejecuta 1 sola llamada estructurada a Gemini (con AbortController de 16000 ms) para redactar
 * únicamente la correlación observacional (`summary`) de todos los nodos activos, resolviendo
 * `therapeutic_focus` 100% desde el motor determinista SSoTT.
 */
async function synthesizeAllIfmNodesSSoTT(nodes, contract = null, ai = null) {
    const resolvedContract = contract || buildCanonicalTherapeuticContract({});
    const activeNodes = (Array.isArray(nodes) ? nodes : []).filter(n => n.hasAnomalies && Array.isArray(n.anomalies) && n.anomalies.length > 0);

    if (!ai || activeNodes.length === 0) {
        return (Array.isArray(nodes) ? nodes : []).map(node =>
            node.hasAnomalies
                ? buildDeterministicNodeSynthesis(node, resolvedContract)
                : {
                    nodeId: node.id,
                    nodeName: sanitizeClinicalSpanish(node.name),
                    status: 'HOMEOSTASIS',
                    cie10: node.preAssignedCie10 || 'Z00.0',
                    validation_status: 'VALIDADO',
                    summary: 'Función conservada. Sin alteraciones detectadas.',
                    key_biomarkers: [],
                    therapeutic_focus: 'Mantenimiento preventivo y vigilancia estándar.'
                }
        );
    }

    const nodesDigestText = activeNodes.map((node) => {
        const sortedAnomalies = [...(node.anomalies || [])].sort(
            (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
        );
        const topLines = sortedAnomalies
            .slice(0, 14)
            .map((a, idx) => `   ${idx + 1}. [${a.source}] ${a.label}: ${a.detail}`)
            .join('\n');
        return `NODO "${node.id}" (${node.name} | CIE-10: ${node.preAssignedCie10} | ${node.anomalies.length} hallazgos totales):\n${topLines}`;
    }).join('\n\n');

    const prompt = `Eres el motor médico funcional CORTEX v3.0 SSoTT (Cumplimiento NOM-004-SSA3-2012 y COFEPRIS).
Tu única tarea es redactar la síntesis observacional concisa ("summary") para cada uno de los siguientes ${activeNodes.length} Nodos IFM con hallazgos.

REGLAS EPISTEMOLÓGICAS Y NORMATIVAS ESTRICTAS (OBLIGATORIAS):
1. Devuelve exactamente un elemento en "nodes" por cada nodo listado, respetando el "nodeId" exacto.
2. En "summary" redacta máximo 2 oraciones en español médico impecable (con ortografía y acentuación perfectas, sin listas de números ni paréntesis anidados).
3. Todo hallazgo con etiqueta "[ELECTRET]" corresponde a bioimpedancia funcional orientativa (NO es estudio de laboratorio sanguíneo ni imagenología). Queda ESTRICTAMENTE PROHIBIDO afirmar diagnósticos orgánicos cerrados como "esteatosis hepática severa", "intoxicación o acumulación confirmada de metales pesados", "deficiencia confirmada de yodo", "disbiosis confirmada" o "prostatitis diagnosticada" si no existe fuente "[OCR_LAB]". Exprésalo siempre como correlación biofísica funcional o sobrecarga adaptativa sujeta a confirmación paraclínica.
4. CERO PRESCRIPCIONES EN "summary": Queda prohibido recomendar dietas, calorías, suplementos, minerales (calcio, yodo, selenio), quelación, silimarina, glutatión o fármacos dentro de "summary".
5. ESTILO EDITORIAL MÉDICO SIN REPETICIONES LÉXICAS: Queda estrictamente prohibido repetir el mismo verbo o sustantivo clínico dentro de una misma oración o entre las dos oraciones del mismo nodo (p. ej., NUNCA escribas "sugieren... y sugieren...", "muestran... y muestran...", "indican... e indican...", "alteraciones... y alteraciones..."). Emplea conectores variados ("asociado a", "acompañado de", "compatible con").

NODOS ACTIVOS A SINTETIZAR:
${nodesDigestText}`;

    const candidateModels = [
        'gemini-3.8-flash',
        'gemini-flash-lite-latest'
    ];

    let llmSummariesByNodeId = new Map();
    for (const modelName of candidateModels) {
        const controller = new AbortController();
        let timeoutId = null;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    controller.abort();
                    reject(new Error('AI_BATCH_TIMEOUT_16000MS'));
                }, 16000);
            });

            const callPromise = ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    temperature: 0.1,
                    topP: 0.8,
                    abortSignal: controller.signal,
                    responseMimeType: 'application/json',
                    responseSchema: IFM_BATCH_SUMMARY_SCHEMA
                }
            });

            const response = await Promise.race([callPromise, timeoutPromise]);
            if (response && response.text) {
                const cleanedJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedJson);
                if (Array.isArray(parsed?.nodes) && parsed.nodes.length > 0) {
                    parsed.nodes.forEach((item) => {
                        if (item?.nodeId && item?.summary) {
                            llmSummariesByNodeId.set(String(item.nodeId).trim(), item);
                        }
                    });
                    if (llmSummariesByNodeId.size > 0) {
                        break;
                    }
                }
            }
        } catch (modelErr) {
            controller.abort();
            console.warn(`⚠️ [CORTEX SSoTT] Modelo ${modelName} en lote unificado: ${modelErr.message}`);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    return (Array.isArray(nodes) ? nodes : []).map((node) => {
        if (!node.hasAnomalies) {
            return {
                nodeId: node.id,
                nodeName: sanitizeClinicalSpanish(node.name),
                status: 'HOMEOSTASIS',
                cie10: node.preAssignedCie10 || 'Z00.0',
                validation_status: 'VALIDADO',
                summary: 'Función conservada. Sin alteraciones detectadas.',
                key_biomarkers: [],
                therapeutic_focus: 'Mantenimiento preventivo y vigilancia estándar.'
            };
        }

        const deterministicNode = buildDeterministicNodeSynthesis(node, resolvedContract);
        const llmCandidate = llmSummariesByNodeId.get(node.id);
        if (!llmCandidate || !llmCandidate.summary) {
            return deterministicNode;
        }

        let sanitizedSummary = sanitizeClinicalSpanish(String(llmCandidate.summary).trim());
        if (!resolvedContract.hasLabResultsLoaded) {
            sanitizedSummary = sanitizedSummary.replace(
                /(?<![\p{L}\p{N}_])disbiosis(?:\s+intestinal)?(?![\p{L}\p{N}_])/giu,
                'desequilibrio funcional de la microbiota'
            );
        }
        const hasForbiddenTherapeuticClaim = FORBIDDEN_SUMMARY_CLAIMS_REGEX.test(sanitizedSummary);
        const hasUnconfirmedNosology = !resolvedContract.hasLabResultsLoaded && UNCONFIRMED_NOSOLOGY_WITHOUT_LABS_REGEX.test(sanitizedSummary);
        const validSummary = (!hasForbiddenTherapeuticClaim && !hasUnconfirmedNosology && sanitizedSummary.length >= 25)
            ? sanitizedSummary
            : deterministicNode.summary;

        const validStatus = (llmCandidate.status && ['ALERTA_MODERADA', 'PRIORIDAD_ALTA', 'CRÍTICO'].includes(llmCandidate.status))
            ? llmCandidate.status
            : deterministicNode.status;

        return {
            ...deterministicNode,
            status: validStatus,
            summary: validSummary,
            therapeutic_focus: deterministicNode.therapeutic_focus
        };
    });
}

async function processCortexNodesInBatches(nodes, ai, contractOrBatchSize = null) {
    const contract = (contractOrBatchSize && typeof contractOrBatchSize === 'object')
        ? contractOrBatchSize
        : null;
    return synthesizeAllIfmNodesSSoTT(nodes, contract, ai);
}

// ============================================================================
// 5. SEMÁFORO CLÍNICO DE BIOSEGURIDAD + PRESCRIPCIÓN SINCRONIZADA (33Plus® / 34Plus®)
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
    const raw = sanitizeClinicalSpanish(String(b).trim());
    const key = raw.toUpperCase().replace(/\s+/g, '_');
    return CLINICAL_BIOMARKER_TRANSLATE[key] || raw;
}

/**
 * Evalúa el Semáforo Clínico de Bioseguridad (VERDE / AMARILLO / ROJO) y determina
 * algorítmicamente el régimen de titulación para evitar contradicciones entre alerta y dosis.
 */
/**
 * Resuelve de forma determinista el contrato lingüístico y de autoridad clínica según las skills
 * institucionales activas (`tilo-communication-protocol` y `tilo-binary-protocol-v62.1`):
 * - `< 13` años (`MODO_TUTOR` — Lactantes `< 2` y Niñez `2–12`): Interlocutor directo = Madre/Padre/Tutor
 *   en trato estricto de `"Usted"`, refiriéndose al paciente en 3.ª persona (`su bebé` / `[Nombre]`).
 * - `13+` años (`Usted Global` — `CALIBRADOR_EMPODERADOR` `13–17`, `ESTRATEGA_SENIOR` `18–64`, `GERIATRIC_MODE` `≥ 65`):
 *   Cero tuteo; acusativo mexicano sin leísmo (`Lo`/`La` según sexo biológico) y triangulación con tutor en `13–17`.
 */
function resolveClinicalAddressing({
    patientName = '',
    ageYears = 30,
    isFemale = false,
    isLactanteExplicit = false
} = {}) {
    const safeAge = Number.isFinite(Number(ageYears)) && Number(ageYears) >= 0 ? Number(ageYears) : 30;
    const isLactante = Boolean(isLactanteExplicit || safeAge < 2);
    const isTutorChild = !isLactante && safeAge < 13;
    const isTutorMode = isLactante || isTutorChild;
    const isAdolescent = safeAge >= 13 && safeAge < 18;
    const isSenior = safeAge >= 65;

    const cleanFullName = cleanClinicalLabel(patientName || (isLactante ? 'su bebé' : 'Paciente'));
    const hasSpecificName = !/^(paciente|su\s+beb[ée]|tu\s+beb[ée]|el\s+menor|la\s+menor|lactante)$/i.test(cleanFullName.trim());
    const rawFirstToken = cleanFullName.split(/\s+/)[0] || cleanFullName;
    const firstName = hasSpecificName
        ? rawFirstToken
        : (isTutorMode
            ? (isLactante ? 'su bebé' : (isFemale ? 'su hija' : 'su hijo'))
            : 'paciente');

    const childShortRef = isLactante
        ? (hasSpecificName ? firstName : 'su bebé')
        : (hasSpecificName ? firstName : (isFemale ? 'su hija' : 'su hijo'));

    const childSubjectWithKinship = isLactante
        ? (hasSpecificName ? `${firstName} (su bebé)` : 'su bebé')
        : (hasSpecificName ? `${firstName} (${isFemale ? 'su hija' : 'su hijo'})` : (isFemale ? 'su hija' : 'su hijo'));

    const mode = isTutorMode
        ? 'MODO_TUTOR'
        : isAdolescent
            ? 'CALIBRADOR_EMPODERADOR'
            : isSenior
                ? 'GERIATRIC_MODE'
                : 'ESTRATEGA_SENIOR';

    return {
        mode,
        ageYears: safeAge,
        isFemale: Boolean(isFemale),
        isLactante,
        isTutorChild,
        isTutorMode,
        isAdolescent,
        isSenior,
        hasSpecificName,
        cleanFullName,
        firstName,
        childShortRef,
        childSubjectWithKinship,
        estimadoLabel: isFemale ? 'Estimada' : 'Estimado',
        directObjCap: isFemale ? 'La' : 'Lo',
        directObjLower: isFemale ? 'la' : 'lo',
        seatedLabel: isFemale ? 'sentada' : 'sentado'
    };
}

function buildPatientUiLabels({ addressing, isPaused = false }) {
    const ref = addressing.childShortRef;
    const refUpper = String(ref || 'EL MENOR').toUpperCase();

    if (addressing.isLactante) {
        return {
            semaphoreFallbackTitle: 'Cuidado exclusivo de lactancia y alimentación guiada por su pediatra',
            recommendedLabsTitle: `🔬 Estudios de control sugeridos para personalizar el seguimiento pediátrico de ${ref}:`,
            systemsSectionTitle: `Los 5 Sistemas de Salud de ${ref} Explicados con Sencillez`,
            observedBoxTitle: `¿Qué observamos en la evaluación de ${ref}?`,
            alliesSectionKicker: 'Prioridad Pediátrica • Primeros 1000 Días',
            alliesSectionTitle: 'Cuidado Exclusivo de Lactancia e Hidratación Pediátrica',
            scheduleCardTitle: 'Orientación diaria de alimentación e hidratación guiada por su pediatra',
            redPauseTitle: `Primero la seguridad pediátrica de ${ref} (0 sobres activos)`,
            redPauseBody: 'En menores de 2 años no se utilizan sobres de suplementación para adultos. Continúe hoy mismo con lactancia materna o fórmula pediátrica y las indicaciones directas de su pediatra.',
            homePlanSectionTitle: `Plan de Acción Diario en Casa para ${ref}`,
            clipboardPatientLabel: 'Paciente (Atención a Madre/Padre/Tutor):',
            clipboardSystemsHeading: `LOS 5 SISTEMAS DE SALUD DE ${refUpper} EN PALABRAS SENCILLAS`,
            clipboardAlliesHeading: 'CUIDADO EXCLUSIVO DE LACTANCIA E HIDRATACIÓN PEDIÁTRICA'
        };
    }

    if (addressing.isTutorChild) {
        return {
            semaphoreFallbackTitle: `¿Cómo iniciaremos el cuidado nutricional de ${ref} de forma segura?`,
            recommendedLabsTitle: `🔬 Estudios de control sugeridos para personalizar el seguimiento de ${ref}:`,
            systemsSectionTitle: `Los 5 Sistemas de Salud de ${ref} Explicados con Sencillez`,
            observedBoxTitle: `¿Qué observamos en la evaluación de ${ref}?`,
            alliesSectionKicker: isPaused
                ? 'Vigilancia Pediátrica Preventiva'
                : `Soporte Nutricional Pediátrico Adaptado al Día de ${ref}`,
            alliesSectionTitle: isPaused
                ? `Hidratación Natural y Cuidado Digestivo para ${ref}`
                : `Soporte Nutricional Complementario para ${ref} (33Plus® y 34Plus®)`,
            scheduleCardTitle: isPaused
                ? `Cómo organizar la hidratación preventiva de ${ref} en casa`
                : `Cómo integrar las tomas e hidratación a la rutina diaria de ${ref}`,
            redPauseTitle: `Primero la seguridad médica de ${ref} (0 sobres por ahora)`,
            redPauseBody: `Por precaución clínica, aún no iniciaremos sobres de suplementación para ${ref}. Siga hoy mismo su guía de alimentación protectora e hidratación natural en casa mientras revisamos sus estudios con su pediatra o médico tratante.`,
            homePlanSectionTitle: `Plan de Acción Diario en Casa para ${ref}`,
            clipboardPatientLabel: 'Paciente (Atención a Madre/Padre/Tutor):',
            clipboardSystemsHeading: `LOS 5 SISTEMAS DE SALUD DE ${refUpper} EN PALABRAS SENCILLAS`,
            clipboardAlliesHeading: isPaused
                ? `HIDRATACIÓN PREVENTIVA Y CUIDADO DIARIO PARA ${refUpper}`
                : `SOPORTE NUTRICIONAL COMPLEMENTARIO Y HORARIOS PARA ${refUpper}`
        };
    }

    return {
        semaphoreFallbackTitle: '¿Cómo iniciaremos su protocolo de forma segura?',
        recommendedLabsTitle: '🔬 Estudios de control sugeridos para personalizar aún más su seguimiento:',
        systemsSectionTitle: 'Sus 5 Sistemas de Salud Explicados con Sencillez',
        observedBoxTitle: '¿Qué observamos en su evaluación?',
        alliesSectionKicker: 'Nutrición Funcional Sincronizada a su Despertar',
        alliesSectionTitle: 'Sus Aliados Nutricionales (33Plus® y 34Plus®)',
        scheduleCardTitle: 'Cómo integrarlo a su rutina diaria (adaptado a su hora real de despertar)',
        redPauseTitle: 'Primero su seguridad médica (0 sobres por ahora)',
        redPauseBody: addressing.isAdolescent
            ? 'Por precaución clínica, aún no iniciaremos sobres de suplementación. Siga hoy mismo su guía de alimentación protectora e hidratación natural en acompañamiento con su madre, padre o tutor legal mientras revisamos sus estudios con su médico.'
            : 'Por precaución clínica, aún no iniciaremos sobres de suplementación. Siga hoy mismo su guía de alimentación protectora e hidratación natural mientras revisamos sus estudios con su médico.',
        homePlanSectionTitle: 'Su Plan de Acción Diario en Casa',
        clipboardPatientLabel: addressing.isAdolescent
            ? 'Paciente (con acompañamiento de Madre/Padre/Tutor):'
            : 'Paciente:',
        clipboardSystemsHeading: 'SUS 5 SISTEMAS DE SALUD EN PALABRAS SENCILLAS',
        clipboardAlliesHeading: 'SUS ALIADOS NUTRICIONALES Y HORARIOS ADAPTADOS A SU DÍA'
    };
}

function evaluateBiosecurityAndTitration(
    patientData,
    serum,
    ageYears = 30,
    medications = [],
    hasStimulantsConflict = false,
    isLactanteExplicit = false,
    isPediatricExplicit = false,
    addressingOverride = null
) {
    const rawName =
        patientData?.profile?.name ||
        patientData?.profile?.first_name ||
        patientData?.identificacion?.nombre ||
        patientData?.identityLock?.patientInfo?.name ||
        (isLactanteExplicit || ageYears < 2 ? 'su bebé' : 'Paciente');
    const addr = addressingOverride || resolveClinicalAddressing({
        patientName: rawName,
        ageYears,
        isFemale: resolveBackendPatientIsFemale(patientData),
        isLactanteExplicit
    });

    const labs = serum?.labValues || {};
    const signals = serum?.electretSignals || {};
    const vitals = serum?.vitalsSnapshot || {};
    const isPregnant = Boolean(serum?.anamnesis360Context?.isPregnant);
    const isLactating = Boolean(serum?.anamnesis360Context?.isLactating);

    const foodAllergies = patientData?.history?.allergies?.food || [];
    const drugAllergies = patientData?.history?.allergies?.drug || [];
    const allAllergiesStr = [...foodAllergies, ...drugAllergies]
        .map(a => String(typeof a === 'object' ? a.agent : a || '').toUpperCase())
        .join(' ');
    const hasFormulaAllergy = ['GUARANA', 'GUARANÁ', 'COLAGENO', 'COLÁGENO', 'INULINA', 'TEANINA', 'UVA', 'SPIRULINA'].some(
        ing => allAllergiesStr.includes(ing)
    );

    const rawPathologies = patientData?.history?.pathologies || patientData?.antecedentesPersonales || [];
    const pathStr = (Array.isArray(rawPathologies) ? rawPathologies : [])
        .map(p => String(typeof p === 'object' ? (p.name || p.patologia) : p || '').toUpperCase())
        .join(' ');

    const hasSevereRenalHistory = /(INSUFICIENCIA RENAL|DIALISIS|DIÁLISIS|HEMODIALISIS|ERC ESTADIO [345])/.test(pathStr);
    const hasRenalStoneOrMildHistory = /(LITIASIS RENAL|CALCULO RENAL|CÁLCULO RENAL|RIÑON|RIÑÓN|GASTRITIS EROSIVA|ULCERA|ÚLCERA)/.test(pathStr);

    const redReasons = [];
    const yellowReasons = [];
    const recommendedLabsSet = new Set();

    // 1. Reglas de Compuerta ROJA (Pausa Preventiva de Suplementación Activa)
    if (addr.isLactante) {
        return {
            level: 'ROJO',
            modeCode: 'PAUSA_PREVENTIVA_PEDIATRICA',
            badgeLabel: 'Prioridad Pediátrica • Sin Suplementos Adultos',
            title: 'Cuidado exclusivo de lactancia y alimentación guiada por su pediatra',
            honestExplanation: `En etapa de lactancia temprana (< 2 años), la nutrición de ${addr.childShortRef} depende prioritariamente de leche materna o fórmula indicada por su pediatra y de la introducción gradual de alimentos naturales. Por seguridad pediátrica, mantenemos cualquier sobre concentrado en pausa estricta.`,
            ethicalNote: 'Toda orientación nutricional en los primeros 1000 días acompaña y respeta íntegramente las indicaciones de su pediatra tratante.',
            recommendedLabs: [],
            isPaused: true,
            isMicroDose: false,
            titrationPlanText: '0 sobres activos (etapa de lactancia temprana bajo vigilancia pediátrica).'
        };
    }

    if (hasFormulaAllergy) {
        redReasons.push('antecedente de hipersensibilidad o alergia declarada a alguno de los componentes botánicos o proteicos');
    }
    if (hasSevereRenalHistory || (labs.gfr > 0 && labs.gfr < 45) || labs.creatinine > 1.5 || labs.potassium > 5.2) {
        redReasons.push('indicadores de compromiso renal importante que requieren valoración nefrológica antes de concentrar aminoácidos o minerales');
        recommendedLabsSet.add('Química sanguínea con Creatinina, Urea, TFG y Electrolitos séricos (Sodio, Potasio, Cloro)');
        recommendedLabsSet.add('Examen General de Orina (EGO) con relación microalbuminuria/creatinina');
    }
    if (labs.alt > 105 || labs.ast > 105 || labs.bilirubin > 2.5) {
        redReasons.push('elevación marcada de enzimas hepáticas que amerita revisión médica prioritaria');
        recommendedLabsSet.add('Perfil hepático completo (AST, ALT, GGT, Fosfatasa Alcalina y Bilirrubinas)');
    }
    if (vitals.sys >= 160 || vitals.dia >= 100) {
        redReasons.push(`presión arterial elevada (${vitals.sys}/${vitals.dia} mmHg) que requiere estabilización médica inmediata`);
    }
    const fastGlucose = vitals.glu || labs.glucose || 0;
    if (fastGlucose >= 250 || (fastGlucose > 0 && fastGlucose < 60)) {
        redReasons.push(`glucosa fuera de margen seguro (${fastGlucose} mg/dL) que requiere ajuste médico directo`);
        recommendedLabsSet.add('Glucosa central en ayuno, Insulina basal y Hemoglobina Glucosilada (HbA1c)');
    }

    if (redReasons.length > 0) {
        if (signals.hasThyroidAlert) {
            recommendedLabsSet.add('Perfil tiroideo (TSH, T4L, Anti-TPO)');
        }
        return {
            level: 'ROJO',
            modeCode: 'PAUSA_PREVENTIVA_MEDICA',
            badgeLabel: 'Prioridad Médica • Pausa Preventiva',
            title: addr.isTutorMode
                ? `Primero protegemos la seguridad de ${addr.childShortRef}: pausa temporal de suplementación`
                : 'Primero protegemos su seguridad: pausa temporal de suplementación',
            honestExplanation: addr.isTutorMode
                ? `En la evaluación de ${addr.childShortRef} observamos ${joinSpanishList(redReasons)}. Por ética clínica, hoy iniciamos únicamente con alimentación natural suave e hidratación medida en casa, dejando las fórmulas en pausa preventiva hasta contar con la validación presencial y sus estudios de control.`
                : `Observamos ${joinSpanishList(redReasons)}. Por ética clínica, hoy iniciamos únicamente con alimentación natural suave e hidratación medida, dejando las fórmulas en pausa preventiva hasta contar con la validación presencial y sus estudios de control${addr.isAdolescent ? ' en acompañamiento con su madre, padre o tutor legal' : ''}.`,
            ethicalNote: addr.isTutorMode
                ? `Las fórmulas 33Plus® y 34Plus® son soporte nutricional complementario (no medicamentos) y solo se valoran cuando los filtros naturales de ${addr.childShortRef} están listos bajo supervisión médica.`
                : `Las fórmulas 33Plus® y 34Plus® son aliados nutricionales de precisión (no medicamentos) y solo se activan cuando sus filtros naturales están listos para aprovecharlos con total seguridad${addr.isAdolescent ? ', contando siempre con el acompañamiento de su madre, padre o tutor legal' : ''}.`,
            recommendedLabs: Array.from(recommendedLabsSet),
            isPaused: true,
            isMicroDose: false,
            titrationPlanText: '0 sobres activos por ahora (Pausa preventiva hasta revisión de estudios de laboratorio).'
        };
    }

    // 2. Reglas de Compuerta AMARILLA (Inicio Gradual con Micro-Dosis Calibrada)
    if (signals.hasRenalBurden || hasRenalStoneOrMildHistory || (labs.creatinine >= 1.2 && labs.creatinine <= 1.5) || (labs.gfr >= 45 && labs.gfr < 60) || labs.uricAcid > 6.8) {
        yellowReasons.push(
            addr.isTutorMode
                ? `los riñones de ${addr.childShortRef} muestran señales de trabajo extra (como filtración de proteínas o ácido úrico elevado)`
                : 'sus riñones muestran señales de trabajo extra (como filtración de proteínas o ácido úrico elevado)'
        );
        recommendedLabsSet.add('Química sanguínea (Creatinina, Ácido Úrico, BUN) y Examen General de Orina (EGO)');
    }
    if (signals.hasHepaticBurden || signals.hasBiliaryBurden || (labs.alt > 45 && labs.alt <= 105) || (labs.ast > 45 && labs.ast <= 105)) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el hígado y la vesícula de ${addr.childShortRef} están procesando carga acumulada de grasas`
                : 'su hígado y vesícula están procesando carga acumulada de grasas'
        );
        recommendedLabsSet.add('Perfil hepático y Perfil de lípidos completo');
    }
    const hasCalcificationTrigger = Boolean(serum?.hasHighSerumCalciumOrCalcification || signals.hasCalcificationAlert);
    if (hasCalcificationTrigger) {
        recommendedLabsSet.add('Calcio sérico, Magnesio y Vitamina D (25-OH)');
    }
    if (signals.hasThyroidAlert && !labs.tsh) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el eje tiroideo de ${addr.childShortRef} muestra señales funcionales que conviene corroborar en laboratorio`
                : 'su eje tiroideo muestra señales funcionales que conviene corroborar en laboratorio'
        );
        recommendedLabsSet.add('Perfil tiroideo (TSH, T4L, Anti-TPO)');
    } else if (signals.hasThyroidAlert) {
        recommendedLabsSet.add('Perfil tiroideo (TSH, T4L, Anti-TPO)');
    }
    if (signals.hasDigestiveSensitivity) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el estómago e intestino de ${addr.childShortRef} presentan sensibilidad en la absorción, por lo que conviene adaptarlos poco a poco`
                : 'su estómago e intestino presentan sensibilidad en la absorción, por lo que conviene acostumbrarlos poco a poco'
        );
    }
    if ((vitals.sys >= 135 && vitals.sys < 160) || (vitals.dia >= 85 && vitals.dia < 100)) {
        yellowReasons.push(
            addr.isTutorMode
                ? `la presión arterial registrada requiere vigilancia cercana (${vitals.sys}/${vitals.dia} mmHg)`
                : `su presión arterial requiere vigilancia cercana (${vitals.sys}/${vitals.dia} mmHg)`
        );
    }
    if (hasStimulantsConflict || isPregnant || isLactating) {
        yellowReasons.push(
            addr.isTutorMode
                ? `se requiere una modulación suave sin estimulantes para cuidar el sistema nervioso y cardiovascular de ${addr.childShortRef}`
                : 'usted requiere una modulación suave sin estimulantes para cuidar su sistema nervioso y cardiovascular'
        );
    }
    if (!serum?.hasLabResultsLoaded && (ageYears >= 65 || (Array.isArray(medications) && medications.length >= 3))) {
        yellowReasons.push('aún no contamos con estudios de sangre recientes en su expediente para confirmar el estado exacto de sus filtros renales y hepáticos');
        recommendedLabsSet.add('Biometría hemática, Química sanguínea de 6 elementos y Examen General de Orina');
    }

    if (yellowReasons.length === 0 && hasCalcificationTrigger) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el equilibrio mineral de ${addr.childShortRef} requiere hidratación constante y ajuste gradual`
                : 'su equilibrio mineral requiere hidratación constante y ajuste gradual'
        );
    }

    if (yellowReasons.length > 0 || isPediatricExplicit) {
        if (yellowReasons.length === 0) {
            yellowReasons.push(
                addr.isTutorMode
                    ? `en la etapa de crecimiento de ${addr.childShortRef} priorizamos una adaptación gradual y bien diluida acorde a su edad`
                    : 'en etapa adolescente priorizamos una adaptación gradual y suave en acompañamiento con su madre, padre o tutor legal'
            );
        }
        const formattedYellowReasons = joinSpanishList(yellowReasons.slice(0, 3));
        return {
            level: 'AMARILLO',
            modeCode: 'MICRO_DOSIS_GRADUAL_CALIBRADA',
            badgeLabel: 'Inicio Gradual Preventivo • Micro-Dosis Calibrada',
            title: addr.isTutorMode
                ? `Avanzamos paso a paso para cuidar los filtros naturales y la digestión de ${addr.childShortRef}`
                : 'Avanzamos paso a paso para cuidar sus filtros naturales y su digestión',
            honestExplanation: addr.isTutorMode
                ? `Para cuidar el organismo de ${addr.childShortRef} con total responsabilidad —ya que ${formattedYellowReasons}— iniciaremos los primeros 7 días (Semana 1) con una micro-dosis suave (medio sobre) bien diluida en agua natural, permitiendo una adaptación cómoda y sin sobrecarga.`
                : `Para proteger su organismo con total responsabilidad —ya que ${formattedYellowReasons}— iniciaremos los primeros 7 días (Semana 1) con una micro-dosis suave (medio sobre) bien diluida en agua natural, permitiendo que su organismo se adapte sin sobrecarga${addr.isAdolescent ? ', contando siempre con el acompañamiento de su madre, padre o tutor legal' : ''}.`,
            ethicalNote: addr.isTutorMode
                ? `33Plus® y 34Plus® actúan como soporte nutricional complementario a la alimentación diaria de ${addr.childShortRef} (nunca sustituyen sus medicamentos ni el seguimiento de su pediatra o médico tratante).`
                : `33Plus® y 34Plus® actúan como apoyo nutricional complementario a su alimentación diaria (nunca sustituyen sus medicamentos ni su seguimiento médico${addr.isAdolescent ? ', y se integran en conjunto con su madre, padre o tutor legal' : ''}).`,
            recommendedLabs: Array.from(recommendedLabsSet),
            isPaused: false,
            isMicroDose: true,
            titrationPlanText: 'Fase de adaptación (Días 1 al 7): 1/2 sobre (5 g) de 33Plus® al despertar + 1/2 sobre (5 g) de 34Plus® antes de dormir en 500 ml de agua simple 💧. Escalar gradualmente según tolerancia.'
        };
    }

    // 3. Compuerta VERDE (Dosis Estándar Circadiana Completa)
    return {
        level: 'VERDE',
        modeCode: 'DOSIS_ESTANDAR_COMPLETA',
        badgeLabel: 'Vía Libre Biosegura • Protocolo Completo',
        title: addr.isTutorMode
            ? `Los filtros principales de ${addr.childShortRef} están en equilibrio para su acompañamiento nutricional`
            : 'Sus filtros principales están listos para su protocolo completo',
        honestExplanation: addr.isTutorMode
            ? `Los indicadores vitales de ${addr.childShortRef} permiten integrar su acompañamiento nutricional sincronizado con su horario natural de despertar y descanso.`
            : `Sus indicadores vitales permiten iniciar su acompañamiento nutricional completo, sincronizado con su horario natural de despertar y descanso${addr.isAdolescent ? ', en acompañamiento con su madre, padre o tutor legal' : ''}.`,
        ethicalNote: addr.isTutorMode
            ? `33Plus® y 34Plus® son fórmulas de nutrición celular que acompañan la alimentación diaria e hidratación constante de ${addr.childShortRef}.`
            : `33Plus® y 34Plus® son fórmulas de nutrición celular que acompañan su alimentación diaria e hidratación constante${addr.isAdolescent ? ', supervisadas junto con su madre, padre o tutor legal' : ''}.`,
        recommendedLabs: [],
        isPaused: false,
        isMicroDose: false,
        titrationPlanText: 'Protocolo estándar sincronizado a su día: 2 tomas matutinas de 33Plus® y 2 tomas vespertinas/nocturnas de 34Plus® en 500 ml de agua simple 💧.'
    };
}

function buildOrthomolecularPrescription(
    patientData,
    processedNodes = [],
    serum,
    bioenergetics,
    hasStimulantsConflict,
    biosecuritySemaphore = null,
    canonicalContract = null,
    addressingOverride = null
) {
    const fallbackAge = Number(
        patientData?.identityLock?.patientInfo?.age ??
        patientData?.profile?.age ??
        patientData?.identificacion?.edad ??
        patientData?.age ??
        30
    );
    const safeFallbackAge = Number.isFinite(fallbackAge) && fallbackAge >= 0 ? fallbackAge : 30;
    const addr = addressingOverride || resolveClinicalAddressing({
        patientName:
            patientData?.profile?.name ||
            patientData?.profile?.first_name ||
            patientData?.identificacion?.nombre ||
            patientData?.identityLock?.patientInfo?.name ||
            (safeFallbackAge < 2 ? 'su bebé' : 'Paciente'),
        ageYears: safeFallbackAge,
        isFemale: resolveBackendPatientIsFemale(patientData),
        isLactanteExplicit: Boolean(patientData?.isLactante || safeFallbackAge < 2)
    });

    const semaphore = biosecuritySemaphore || evaluateBiosecurityAndTitration(
        patientData,
        serum,
        addr.ageYears,
        patientData?.history?.medications || [],
        hasStimulantsConflict,
        addr.isLactante,
        addr.ageYears < 18,
        addr
    );

    const contract = canonicalContract || buildCanonicalTherapeuticContract({
        serum,
        bioenergetics,
        biosecuritySemaphore: semaphore,
        hasStimulantsConflict
    });

    const node3 = processedNodes.find(n => n.nodeId === 'NODO_3_ENERGIA');
    const node5 = processedNodes.find(n => n.nodeId === 'NODO_5_TRANSPORTE');
    const node6 = processedNodes.find(n => n.nodeId === 'NODO_6_DEFENSA');
    const node7 = processedNodes.find(n => n.nodeId === 'NODO_7_ESTRUCTURAL');

    const energyBiomarkers = [...(node3?.key_biomarkers || []), ...(node5?.key_biomarkers || [])]
        .slice(0, 4)
        .map(formatMedicalBiomarkerSummary);
    const tissueBiomarkers = [...(node6?.key_biomarkers || []), ...(node7?.key_biomarkers || [])]
        .slice(0, 4)
        .map(formatMedicalBiomarkerSummary);

    const isPregnantOrLactating = Boolean(serum?.anamnesis360Context?.isPregnant || serum?.anamnesis360Context?.isLactating);
    const switch33PlusToDecaf = Boolean(hasStimulantsConflict || isPregnantOrLactating || addr.isTutorMode);
    const label33Formula = switch33PlusToDecaf
        ? '🔴 33Plus® (Variante Suave Sin Estimulantes)'
        : '🔴 33Plus® (Energía Celular y Circulación)';

    let circadianSchedule = [];
    let sup33 = null;
    let sup34 = null;
    let protocolName = 'Protocolo Circadiano Dual de Restauración Celular (33Plus® & 34Plus®)';

    if (semaphore.isPaused) {
        protocolName = addr.isLactante
            ? 'Prioridad Pediátrica • Lactancia y Alimentación Guiada (0 Sobres Adultos)'
            : 'Pausa Preventiva de Suplementación • Prioridad Alimentación e Hidratación';
        circadianSchedule = [
            {
                tomaNumber: 1,
                timeSlot: 'Al despertar en ayunas',
                phase: 'PAUSA PREVENTIVA — Hidratación Protectora Inicial',
                formula: '💧 Agua natural purificada (Suplementos en pausa preventiva)',
                dosage: addr.isLactante
                    ? '0 sobres activos • Continuar lactancia materna o fórmula indicada por su pediatra'
                    : '0 sobres activos • Beber 300 ml de agua simple a sorbos pausados',
                clinicalObjective: 'Proteger la filtración renal, hepática y estabilidad hemodinámica mientras se validan estudios de laboratorio.',
                patientObjective: addr.isLactante
                    ? `Respetar la etapa de lactancia y maduración digestiva de ${addr.childShortRef} bajo guía pediátrica.`
                    : (addr.isTutorMode
                        ? `Hidratar suavemente el organismo de ${addr.childShortRef} al despertar sin sobrecargar sus filtros naturales.`
                        : 'Hidratar suavemente sus órganos al despertar sin sobrecargar sus filtros naturales.'),
                waterVolumeMl: addr.isLactante ? 0 : 300,
                isPaused: true
            },
            {
                tomaNumber: 2,
                timeSlot: '30 a 60 min antes de dormir',
                phase: 'PAUSA PREVENTIVA — Descanso y Vigilancia Clínica',
                formula: '💧 Hidratación ligera nocturna (Pendiente revisión médica)',
                dosage: '0 sobres activos • Pendiente valoración médica de control',
                clinicalObjective: 'Resguardar bioseguridad clínica bajo NOM-004 hasta contar con biometría/química sanguínea actualizada.',
                patientObjective: addr.isTutorMode
                    ? `Favorecer un descanso tranquilo para ${addr.childShortRef} mientras completamos su valoración médica.`
                    : 'Favorecer un descanso tranquilo mientras completamos sus análisis de control.',
                waterVolumeMl: addr.isLactante ? 0 : 250,
                isPaused: true
            }
        ];

        sup33 = {
            id: 'sup_33plus',
            cortex: '33Plus® (En Pausa Preventiva de Bioseguridad)',
            name: '33Plus® — En pausa temporal hasta revisión de estudios de control',
            dosage: '0 sobres activos (Pausa preventiva por prioridad médica)',
            timing: addr.isLactante
                ? 'No indicado en menores de 2 años (etapa exclusiva de lactancia/pediatría)'
                : 'Se activará únicamente tras revisión médica de sus estudios de laboratorio',
            clinical_timing: addr.isLactante
                ? 'Contraindicado en lactantes menores de 2 años (etapa exclusiva de lactancia y pediatría)'
                : 'Diferido temporalmente hasta valoración médica de estudios de control',
            rationale: addr.isLactante
                ? 'PAUSA PREVENTIVA DE BIOSEGURIDAD (NOM-004 / NOM-043): Exclusión obligatoria de fórmulas concentradas para adultos en lactantes menores de 2 años.'
                : 'PAUSA PREVENTIVA DE BIOSEGURIDAD (NOM-004): Diferimiento temporal de suplementación concentrada hasta acreditación de laboratorios de control y estabilización orgánica del paciente.',
            patient_rationale: addr.isLactante
                ? 'En menores de 2 años no se utilizan fórmulas concentradas para adultos; la base nutricional exclusiva es la indicada por su pediatra.'
                : (addr.isTutorMode
                    ? `Por cuidado a la salud de ${addr.childShortRef}, mantenemos 33Plus® en pausa temporal hasta revisar sus análisis y confirmar que sus filtros naturales estén listos.`
                    : 'Por cuidado a su salud, mantenemos 33Plus® en pausa temporal hasta revisar sus análisis y confirmar que sus filtros naturales estén listos.'),
            status: 'paused_by_biosecurity'
        };

        sup34 = {
            id: 'sup_34plus',
            cortex: '34Plus® (En Pausa Preventiva de Bioseguridad)',
            name: '34Plus® — En pausa temporal hasta revisión de estudios de control',
            dosage: '0 sobres activos (Pausa preventiva por prioridad médica)',
            timing: addr.isLactante
                ? 'No indicado en menores de 2 años (etapa exclusiva de lactancia/pediatría)'
                : 'Se activará únicamente tras revisión médica de sus estudios de laboratorio',
            clinical_timing: addr.isLactante
                ? 'Contraindicado en lactantes menores de 2 años (etapa exclusiva de lactancia y pediatría)'
                : 'Diferido temporalmente hasta valoración médica de estudios de control',
            rationale: addr.isLactante
                ? 'PAUSA PREVENTIVA DE BIOSEGURIDAD (NOM-004 / NOM-043): Exclusión obligatoria de fórmulas concentradas para adultos en lactantes menores de 2 años.'
                : 'PAUSA PREVENTIVA DE BIOSEGURIDAD (NOM-004): Diferimiento temporal de suplementación concentrada hasta acreditación de laboratorios de control y estabilización orgánica del paciente.',
            patient_rationale: addr.isLactante
                ? `Mantenemos 34Plus® fuera del esquema de ${addr.childShortRef}, priorizando su alimentación natural acorde a la pauta pediátrica.`
                : (addr.isTutorMode
                    ? `Mantenemos 34Plus® en pausa preventiva mientras cuidamos la hidratación y alimentación natural de ${addr.childShortRef} en casa.`
                    : 'Mantenemos 34Plus® en pausa preventiva mientras cuidamos su hidratación y alimentación natural en casa.'),
            status: 'paused_by_biosecurity'
        };
    } else if (semaphore.isMicroDose) {
        protocolName = 'Protocolo de Inicio Gradual Calibrado (Micro-Dosis Protectora 33Plus® & 34Plus®)';
        circadianSchedule = [
            {
                tomaNumber: 1,
                timeSlot: 'Al despertar en ayunas',
                phase: 'FASE MATUTINA — Adaptación Suave de Energía y Circulación',
                formula: label33Formula,
                dosage: '1/2 sobre (5 g) disuelto en 300 ml de agua natural o tibia',
                clinicalObjective: 'Aporte gradual de antioxidantes vasculares (CoQ10, polifenoles y L-Teanina) respetando la tasa de filtración y tolerancia gástrica.',
                patientObjective: addr.isTutorMode
                    ? `Apoyar la energía matutina y la circulación de ${addr.childShortRef} de forma suave y progresiva.`
                    : 'Encender su energía de la mañana y apoyar su circulación de forma suave y progresiva.',
                waterVolumeMl: 300,
                isMicroDose: true
            },
            {
                tomaNumber: 2,
                timeSlot: 'A media mañana (Días 8 en adelante, según tolerancia)',
                phase: 'FASE MATUTINA — Escalamiento Gradual Opcional',
                formula: label33Formula,
                dosage: 'Iniciar solo con agua natural (Semana 1) • Valorar 1/2 sobre adicional en Semana 2',
                clinicalObjective: 'Titulación escalonada sujeta a tolerancia digestiva, presión arterial y estudios renales/hepáticos.',
                patientObjective: addr.isTutorMode
                    ? `Permitir que el organismo de ${addr.childShortRef} se adapte primero antes de valorar una segunda toma matutina.`
                    : 'Permitir que su organismo se adapte primero antes de sumar una segunda toma matutina.',
                waterVolumeMl: 300,
                isMicroDose: true
            },
            {
                tomaNumber: 3,
                timeSlot: 'A media tarde',
                phase: 'FASE VESPERTINA — Hidratación de Limpieza Renal y Digestiva',
                formula: '💧 Hidratación Preparatoria (Agua Simple)',
                dosage: '500 ml de agua simple purificada a sorbos durante la tarde 💧',
                clinicalObjective: 'Mantener flujo urinario constante y preparar la mucosa intestinal para la reparación nocturna.',
                patientObjective: addr.isTutorMode
                    ? `Ayudar a los riñones e intestino de ${addr.childShortRef} a limpiar desechos suavemente durante la tarde.`
                    : 'Ayudar a sus riñones e intestino a limpiar desechos suavemente durante la tarde.',
                waterVolumeMl: 500,
                isMicroDose: true
            },
            {
                tomaNumber: 4,
                timeSlot: '30 a 60 min antes de dormir',
                phase: 'FASE NOCTURNA — Reparación Suave de Tejidos y Mucosa Digestiva',
                formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                dosage: '1/2 sobre (5 g) disuelto en MÍNIMO 500 ml de agua simple 💧',
                clinicalObjective: 'Aporte controlado de péptidos de colágeno, Vitamina C e inulina prebiótica con amplia dilución hídrica para proteger el vaciado gástrico y el riñón.',
                patientObjective: addr.isTutorMode
                    ? `Nutrir articulaciones, piel y digestión mientras ${addr.childShortRef} duerme, siempre con suficiente agua simple.`
                    : 'Nutrir sus articulaciones, piel y digestión mientras usted duerme, siempre con suficiente agua simple.',
                waterVolumeMl: 500,
                isMicroDose: true
            }
        ];

        sup33 = {
            id: 'sup_33plus',
            cortex: switch33PlusToDecaf
                ? '33Plus® (Micro-Dosis Gradual • Sin Estimulantes NOM-028)'
                : '33Plus® (Micro-Dosis Gradual • Energía y Circulación)',
            name: switch33PlusToDecaf
                ? '33Plus® (Variante Sin Estimulantes) - L-Teanina, CoQ10, Cromo y Polifenoles'
                : '33Plus® - Polifenoles de Semilla de Uva, CoQ10, Cromo y L-Teanina',
            dosage: 'Inicio gradual (Días 1–7): 1/2 sobre (5 g) al despertar en ayunas en 300 ml de agua natural',
            timing: addr.isTutorMode
                ? `Sincronizado al despertar de ${addr.childShortRef} (evitar ofrecerlo después de las 2:00 PM)`
                : 'Sincronizado a su despertar real (evitar tomarlo después de las 2:00 PM)',
            clinical_timing: 'Sincronizado al despertar del paciente en ayunas (evitar administración posterior a las 14:00 h)',
            rationale: `TITULACIÓN EN MICRO-DOSIS PREVENTIVA (Semana 1 — 5 g/día): Inicio escalonado al 50% de concentración para resguardar reserva hepatorrenal, tolerancia endotelial y homeostasis mineral del paciente.${energyBiomarkers.length > 0 ? ` Hallazgos objetivos: ${energyBiomarkers.join(' | ')}.` : ''}`,
            patient_rationale: addr.isTutorMode
                ? `Acompaña a ${addr.childShortRef} por la mañana con antioxidantes suaves para apoyar su energía diaria y circulación, iniciando con medio sobre para cuidar su adaptación.`
                : `${addr.directObjCap} acompaña por la mañana con antioxidantes para apoyar su energía diaria y la flexibilidad de su circulación, iniciando con medio sobre para cuidar su adaptación.`,
            status: 'approved'
        };

        sup34 = {
            id: 'sup_34plus',
            cortex: '34Plus® (Micro-Dosis Gradual • Reparación y Digestión)',
            name: '34Plus® - Péptidos de Colágeno Hidrolizado, Vitamina C, L-Arginina e Inulina Prebiótica',
            dosage: 'Inicio gradual (Días 1–7): 1/2 sobre (5 g) 30 a 60 min antes de dormir en MÍNIMO 500 ml de agua simple 💧',
            timing: 'Noche (30 a 60 min antes de dormir, siempre en medio litro de agua simple 💧)',
            clinical_timing: 'Sincronizado a ventana nocturna (30–60 min previo al descanso en mínimo 500 ml de agua simple 💧)',
            rationale: `TITULACIÓN EN MICRO-DOSIS PREVENTIVA (Semana 1 — 5 g/día): Aporte nocturno controlado de péptidos de colágeno e inulina prebiótica con dilución obligatoria en mínimo 500 ml de agua simple para proteger vaciado gástrico y filtración renal del paciente.${tissueBiomarkers.length > 0 ? ` Hallazgos objetivos: ${tissueBiomarkers.join(' | ')}.` : ''}`,
            patient_rationale: addr.isTutorMode
                ? `Trabaja mientras ${addr.childShortRef} descansa aportando bloques de construcción (colágeno, fibra prebiótica y vitamina C) para su digestión, piel y tejidos en crecimiento. Disuélvalo siempre en medio litro de agua simple 💧.`
                : 'Trabaja mientras usted descansa aportando bloques de construcción (colágeno, fibra prebiótica y vitamina C) para su digestión, piel y articulaciones. Tómelo siempre en medio litro de agua simple 💧.',
            status: 'approved'
        };
    } else {
        circadianSchedule = [
            {
                tomaNumber: 1,
                timeSlot: 'Al despertar en ayunas',
                phase: 'FASE DIURNA — Encendido de Energía Celular y Circulación',
                formula: label33Formula,
                dosage: '1 sobre (10 g) disuelto en 300 ml de agua natural o tibia',
                clinicalObjective: 'Inducción de energía mitocondrial, oxigenación tisular y soporte endotelial matutino.',
                patientObjective: addr.isTutorMode
                    ? `Impulsar la energía natural y atención matutina de ${addr.childShortRef} desde temprano.`
                    : 'Despertar su energía natural con claridad mental y apoyar una circulación ligera desde temprano.',
                waterVolumeMl: 300
            },
            {
                tomaNumber: 2,
                timeSlot: 'A media mañana (aprox. 4 h después de despertar)',
                phase: 'FASE DIURNA — Estabilidad de Energía y Enfoque',
                formula: label33Formula,
                dosage: '1 sobre (10 g) disuelto en 300 ml de agua natural',
                clinicalObjective: 'Sostén de enfoque cognitivo, sensibilidad a la glucosa y protección antioxidante vascular.',
                patientObjective: addr.isTutorMode
                    ? `Mantener la vitalidad de ${addr.childShortRef} estable a mitad del día.`
                    : 'Mantener su vitalidad estable a mitad del día evitando bajones de energía después de comer.',
                waterVolumeMl: 300
            },
            {
                tomaNumber: 3,
                timeSlot: 'A media tarde',
                phase: 'FASE VESPERTINA — Bienestar Digestivo y Desinflamación',
                formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                dosage: '1 sobre (10 g) disuelto en MÍNIMO 500 ml de agua simple 💧',
                clinicalObjective: 'Soporte a la barrera mucosa intestinal, aporte prebiótico y modulación del desgaste oxidativo vespertino.',
                patientObjective: addr.isTutorMode
                    ? `Cuidar la digestión vespertina de ${addr.childShortRef} e hidratar profundamente sus tejidos con medio litro de agua simple.`
                    : 'Cuidar su digestión de la tarde e hidratar profundamente sus tejidos con medio litro de agua simple.',
                waterVolumeMl: 500
            },
            {
                tomaNumber: 4,
                timeSlot: '30 a 60 min antes de dormir',
                phase: 'FASE NOCTURNA — Reparación Profunda de Tejidos y Articulaciones',
                formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                dosage: '1 sobre (10 g) disuelto en MÍNIMO 500 ml de agua simple 💧',
                clinicalObjective: 'Síntesis nocturna de colágeno tipo I/III, recuperación miofascial y nutrición de la microbiota intestinal.',
                patientObjective: addr.isTutorMode
                    ? `Aportar a los músculos, huesos, piel y articulaciones de ${addr.childShortRef} los nutrientes que emplea para repararse mientras duerme.`
                    : 'Aportar a sus músculos, huesos, piel y articulaciones los nutrientes que emplean para repararse mientras usted duerme.',
                waterVolumeMl: 500
            }
        ];

        sup33 = {
            id: 'sup_33plus',
            cortex: switch33PlusToDecaf
                ? '33Plus® (Modulación Mitocondrial Sin Estimulantes NOM-028)'
                : '33Plus® (Ignición Mitocondrial y Reología Vascular)',
            name: switch33PlusToDecaf
                ? '33Plus® (Protocolo Libre de Estimulantes) - L-Teanina Pura, CoQ10, Cromo (200 mcg) y Polifenoles'
                : '33Plus® - Polifenoles de Semilla de Uva, CoQ10, Cromo (200 mcg) y L-Teanina',
            dosage: '2 tomas matutinas: 1 sobre al despertar en ayunas y 1 sobre a media mañana (cada uno en 300 ml de agua natural)',
            timing: addr.isTutorMode
                ? `Sincronizado a la mañana de ${addr.childShortRef} (Al despertar y a media mañana)`
                : 'Sincronizado a su mañana (Al despertar y a media mañana)',
            clinical_timing: 'Sincronizado a ventana matutina del paciente (al despertar en ayunas y a media mañana)',
            rationale: switch33PlusToDecaf
                ? `BLOQUEO DE BIOSEGURIDAD (NOM-028 / Fisiológico): Conmutación a variante sin estimulantes para resguardar estabilidad cardiovascular y nerviosa del paciente${energyBiomarkers.length > 0 ? ` (${energyBiomarkers.join(' | ')})` : ''}.`
                : (energyBiomarkers.length > 0
                    ? `Prescripción dirigida por hallazgos objetivos en expediente (${energyBiomarkers.join(' | ')}): favorece la protección antioxidante de lípidos circulantes y la fluidez microvascular diurna.`
                    : 'Optimización de microcirculación, oxigenación tisular diurna y sensibilidad metabólica a la glucosa.'),
            patient_rationale: addr.isTutorMode
                ? `Acompaña a ${addr.childShortRef} por la mañana: aporta antioxidantes de semilla de uva, Coenzima Q10 y cromo para apoyar su circulación y una energía limpia durante el día.`
                : `Su aliado de la mañana: ${addr.directObjLower} acompaña con antioxidantes de semilla de uva, Coenzima Q10 y cromo para apoyar su circulación, su corazón y una energía limpia durante el día.`,
            status: 'approved'
        };

        sup34 = {
            id: 'sup_34plus',
            cortex: '34Plus® (Ingeniería Tisular y Homeostasis Mucosa)',
            name: '34Plus® - Péptidos de Colágeno Hidrolizado, Vitamina C, L-Arginina e Inulina Prebiótica',
            dosage: '2 tomas vespertinas/nocturnas: 1 sobre a media tarde y 1 sobre antes de dormir, cada uno en MÍNIMO 500 ml de agua simple 💧',
            timing: 'Sincronizado a su tarde y noche (Media tarde y 30–60 min antes de dormir)',
            clinical_timing: 'Sincronizado a ventana vespertina y nocturna (media tarde y 30–60 min previo al descanso en mínimo 500 ml de agua simple 💧)',
            rationale: tissueBiomarkers.length > 0
                ? `Prescripción dirigida por hallazgos tisulares e inmunológicos (${tissueBiomarkers.join(' | ')}): promueve la regeneración epitelial digestiva y de matriz de colágeno durante el descanso nocturno. Dilución obligatoria en mínimo 500 ml de agua simple.`
                : 'Reparación de matriz de colágeno y recubrimiento digestivo nocturno. Dilución obligatoria en mínimo 500 ml de agua simple.',
            patient_rationale: addr.isTutorMode
                ? `Soporte de reparación vespertino y nocturno para ${addr.childShortRef}: aporta colágeno hidrolizado, vitamina C y fibra prebiótica suave para confortar su intestino y nutrir articulaciones, huesos y piel. Disuélvalo siempre en medio litro de agua simple 💧.`
                : 'Su aliado de reparación en la tarde y noche: aporta colágeno hidrolizado, vitamina C y fibra prebiótica suave para confortar su intestino y nutrir articulaciones, huesos y piel. Disuélvalo siempre en medio litro de agua simple 💧.',
            status: 'approved'
        };
    }

    return {
        protocolName,
        biosecurity_semaphore: semaphore,
        hydrationTargetLiters: contract.hydrationTargetLiters,
        dietaryPlan: {
            regimen: contract.regimen,
            regimenBadge: contract.regimenBadge,
            universalExclusions: ['0 Picante', '0 Cerdo', '0 Azúcares refinados'],
            patientSpecificExclusions: contract.patientSpecificExclusions
        },
        evolutionTimeline: contract.evolutionTimeline,
        therapeutic_contract: contract,
        circadianSchedule,
        supplements: [sup33, sup34],
        has_calcium_contraction_lock: contract.calciumLocked,
        calcium_alert_text: contract.calciumLocked
            ? 'Detectamos tendencia a depósito de calcio fuera del hueso: evitamos suplementos aislados de calcio inorgánico y priorizamos hidratación constante junto con magnesio y vitamina K2 alimentaria.'
            : null,
        calcium_clinical_safeguard_text: contract.calciumLocked
            ? `Riesgo biofísico de calcificación ectópica: se excluye suplementación aislada con sales de calcio inorgánico; priorizar hidratación estructurada (${contract.hydrationTargetLiters} L/día), magnesio y vitamina K2 alimentaria.`
            : null,
        bioenergetics_summary: bioenergetics
    };
}

/**
 * Traduce etiquetas crudas de bioimpedancia/clínica a lenguaje ciudadano empático,
 * filtrando marcadores esotéricos o alarmantes (p. ej. Radiación Electromagnética, Mercurio, Arsénico).
 */
function humanizeBiomarkerTopicForPatient(rawLabel, systemId = '') {
    if (!rawLabel) return '';
    const base = cleanClinicalLabel(String(rawLabel).split(':')[0].trim());
    if (!base) return '';

    // Excluir marcadores ambientales no-orgánicos de las tarjetas fisiológicas del paciente
    if (/radiaci[óo]n\s+electromagn[ée]tica|electromagn[ée]tic/i.test(base)) {
        return '';
    }

    if (/mercurio|ars[ée]nico|plomo|cadmio|pesticida|metales?\s+pesados?|toxina/i.test(base)) {
        return 'depuración de desechos ambientales';
    }
    if (/tiroglobulina|tiroides|tiroide[ao]|tsh|t3|t4|paratiroides/i.test(base)) {
        return 'equilibrio funcional de la tiroides';
    }
    if (/prostatitis|pr[óo]stata|prost[áa]tic|testosterona|gonadotropina|esperma/i.test(base)) {
        return 'bienestar y equilibrio prostático y hormonal';
    }
    if (/estr[óo]geno|progesterona|ginecol|mamari|[úu]tero|ovario/i.test(base)) {
        return 'equilibrio hormonal cíclico';
    }
    if (/hiperplasia\s+[óo]sea|densidad\s+mineral|osteoporosis|osteocalcina|calcificaci[óo]n|cervical|lumbar|fosfatasa|[óo]se[ao]|hueso|crecimiento\s+[óo]seo/i.test(base)) {
        return 'firmeza mineral de huesos y columna';
    }
    if (/reumatismo|articular|articulaci|ligamento|cart[íi]lago/i.test(base)) {
        return 'confort y movilidad articular';
    }
    if (/col[áa]geno|piel|cut[áa]ne|cabello|tejido|muscular|m[úu]sculo/i.test(base)) {
        return 'reservas de colágeno en articulaciones, piel y tejidos';
    }
    if (/grasa\s+en\s+el\s+h[íi]gado|h[íi]gado|hep[áa]tic|ves[íi]cula|biliar|bilirrubina|\bglobulina\b|desintoxicaci[óo]n|energ[íi]a\s+del\s+h[íi]gado/i.test(base)) {
        return 'procesamiento de grasas y limpieza en hígado';
    }
    if (/proteinuria|[áa]cido\s+[úu]rico|urobilin[óo]geno|nitr[óo]geno|urea|creatinina|renal|ri[ñn][óo]n/i.test(base)) {
        return 'filtración de minerales y proteínas en riñón';
    }
    if (/memoria|cerebr|craneal|nervio\s+craneal|enfoque|cognitiv|emoci[óo]n/i.test(base)) {
        return 'claridad mental, enfoque y memoria';
    }
    if (/punta\s+lingual|hpa|suprarrenal|adrenal|pineal|melatonina|cortisol|sue[ñn]o|estr[ée]s|insomnio|timo/i.test(base)) {
        return 'recuperación frente al estrés y calidad de descanso';
    }
    if (/alergia|sensibilidad|polen|polvo|leche|l[áa]cteo|marisco|pintura|fibra\s+qu[íi]mica|antibi[óo]tico|alcohol|tabaco/i.test(base)) {
        return 'sensibilidad digestiva o ambiental';
    }
    if (/c[íi]rculos\s+oscuros|bolsas\s+en\s+los\s+ojos|ojeras|fatiga\s+visual/i.test(base)) {
        return 'oxigenación microvascular y descanso visual';
    }
    if (/sublingual/i.test(base)) {
        return 'hidratación y microcirculación digestiva';
    }
    if (systemId === 'digestion_absorcion' && /treonina|histidina|lisina|valina|leucina|isoleucina|tript[óo]fano|metionina|fenilalanina|arginina|amino[áa]cido/i.test(base)) {
        return 'aprovechamiento digestivo de aminoácidos y proteínas';
    }
    if (systemId === 'circulacion_energia' && /coenzima|vitamina\s+b|hierro|mitocondri/i.test(base)) {
        return 'producción de energía celular';
    }
    if (/vitamina|zinc|selenio|hierro|magnesio|potasio|calcio|coenzima|treonina|histidina|lisina|valina|leucina|isoleucina|tript[óo]fano|metionina|fenilalanina|arginina|amino[áa]cido|inmunoglobulina|linf[áa]tic|am[íi]gdala|bazo|m[ée]dula|respiratori|mucosa/i.test(base)) {
        return 'reservas de vitaminas, minerales y defensas naturales';
    }
    if (/mioc[áa]rdic|coronari|latido|bombeo|viscosidad|elasticidad|vascular|arteri|venos|microcirculaci|ox[íi]geno|pulmonar|riesgo\s+cerebrovascular|stroke|presi[óo]n|impedancia|volumen\s+de\s+perfusi/i.test(base)) {
        return 'fluidez de la circulación y oxigenación del corazón';
    }
    if (/araquid[óo]nico|omega|colesterol|triglic[ée]ridos?|lipoprote[íi]na|grasa\s+en\s+sangre|adiposo|obesidad|l[íi]pido/i.test(base)) {
        return 'equilibrio de grasas saludables en sangre';
    }
    if (/insulina|glucosa|az[úu]car|gluc[óo]geno|energ[íi]a|mitocondri|metabolismo|cuerpo\s+[áa]cido|ph/i.test(base)) {
        return 'aprovechamiento diario de azúcares y energía celular';
    }
    if (/peristalsis|intestin|col[óo]nic|colon|flora|microbiota|estre[ñn]imiento|evacuaci/i.test(base)) {
        return 'ritmo de movimiento del estómago e intestino';
    }
    if (/absorci[óo]n|g[áa]stric|pepsina|est[óo]mago|saburra|lingual|digestiv|amilasa/i.test(base)) {
        return 'producción de jugos digestivos y absorción de nutrientes';
    }

    return base
        .replace(/^(?:grado|coeficiente|[íi]ndice|s[íi]ndrome|factor|tasa)\s+de\s+/i, '')
        .replace(/\([^)]*\)/g, '')
        .trim()
        .toLowerCase();
}

/**
 * Construye la Guía Empática para el Paciente ("Carta de su Director Clínico"),
 * traduciendo la Matriz IFM a 5 grandes sistemas humanos sin códigos CIE-10 ni jerga intimidante,
 * cumpliendo 100% `MODO_TUTOR (< 13 años)` y `Usted Global (13+ años)`.
 */
function buildPatientFriendlyGuide({
    patientName,
    ageYears,
    isFemale = false,
    isLactanteExplicit,
    isPediatricExplicit,
    processedNodes,
    serum,
    bioenergetics,
    orthomolecularPrescription,
    biosecuritySemaphore,
    addressingOverride = null
}) {
    const addr = addressingOverride || resolveClinicalAddressing({
        patientName,
        ageYears,
        isFemale,
        isLactanteExplicit
    });
    const ref = addr.childShortRef;
    const isPausedProtocol = Boolean(biosecuritySemaphore?.isPaused || addr.isLactante);
    const uiLabels = buildPatientUiLabels({ addressing: addr, isPaused: isPausedProtocol });

    const getNode = (id) => processedNodes.find(n => n.nodeId === id) || { key_biomarkers: [], status: 'HOMEOSTASIS' };

    const sampleBalancedFriendlyTopics = (sourceNodes, systemId) => {
        const perNodeTopics = sourceNodes.map((n) => {
            const rawList = Array.isArray(n.key_biomarkers) ? n.key_biomarkers : [];
            return Array.from(new Set(rawList.map((b) => humanizeBiomarkerTopicForPatient(b, systemId)).filter(Boolean)));
        });

        if (perNodeTopics.length <= 1) {
            return (perNodeTopics[0] || []).slice(0, 4);
        }

        // Muestreo balanceado round-robin 2 + 2 para sistemas fusionados ([N5 + N3], [N4 + N6])
        const selected = [];
        const addUnique = (topic) => {
            if (topic && !selected.includes(topic) && selected.length < 4) {
                selected.push(topic);
            }
        };

        perNodeTopics.forEach((nodeTopics) => {
            let takenFromNode = 0;
            for (const t of nodeTopics) {
                if (takenFromNode >= 2 || selected.length >= 4) break;
                if (!selected.includes(t)) {
                    selected.push(t);
                    takenFromNode++;
                }
            }
        });

        if (selected.length < 4) {
            perNodeTopics.forEach((nodeTopics) => {
                for (const t of nodeTopics) {
                    addUnique(t);
                }
            });
        }

        return selected;
    };

    const makeSystemCard = ({ id, title, subtitle, iconKey, sourceNodes, observedWhenActive, meaningWhenActive, healthyObserved, healthyMeaning }) => {
        const mergedBiomarkers = sourceNodes.flatMap(n => Array.isArray(n.key_biomarkers) ? n.key_biomarkers : []);
        const hasPriority = sourceNodes.some(n => n.status === 'CRÍTICO' || n.status === 'PRIORIDAD_ALTA');
        const hasAny = mergedBiomarkers.length > 0;

        const status = !hasAny
            ? 'EN_EQUILIBRIO'
            : (hasPriority ? 'ATENCION_PRIORITARIA' : 'VIGILANCIA_PREVENTIVA');
        const statusLabel = !hasAny
            ? 'En equilibrio'
            : (hasPriority ? 'Atención prioritaria' : 'Cuidado preventivo');

        const topFriendlyTopics = sampleBalancedFriendlyTopics(sourceNodes, id);

        return {
            id,
            title,
            subtitle,
            iconKey,
            status,
            statusLabel,
            findingsCount: mergedBiomarkers.length,
            cleanHighlights: topFriendlyTopics,
            whatWeObserved: hasAny
                ? observedWhenActive(topFriendlyTopics.length > 0 ? topFriendlyTopics : ['equilibrio funcional preventivo'])
                : healthyObserved,
            whatItMeans: hasAny ? meaningWhenActive : healthyMeaning
        };
    };

    const n1 = getNode('NODO_1_ASIMILACION');
    const n2 = getNode('NODO_2_BIOTRANSFORMACION');
    const n3 = getNode('NODO_3_ENERGIA');
    const n4 = getNode('NODO_4_COMUNICACION');
    const n5 = getNode('NODO_5_TRANSPORTE');
    const n6 = getNode('NODO_6_DEFENSA');
    const n7 = getNode('NODO_7_ESTRUCTURAL');

    const fiveSystems = addr.isTutorMode
        ? [
            makeSystemCard({
                id: 'circulacion_energia',
                title: `Circulación, Corazón y Energía Diaria de ${ref}`,
                subtitle: 'Cómo viajan el oxígeno y el combustible hacia sus órganos en crecimiento',
                iconKey: 'heart',
                sourceNodes: [n5, n3],
                observedWhenActive: (topics) =>
                    `Notamos que el sistema circulatorio y las reservas de energía de ${ref} están haciendo un esfuerzo extra (especialmente en indicadores como ${topics.join(', ')}).`,
                meaningWhenActive:
                    `Imagine las arterias como tuberías flexibles y las células de ${ref} como pequeñas baterías: cuando hay mayor demanda de nutrientes o hidratación, su organismo trabaja más. Con hidratación natural y alimentación fresca le ayudaremos a mantener vitalidad estable.`,
                healthyObserved: `Los indicadores principales de circulación, oxigenación y manejo de energía de ${ref} se mantienen estables.`,
                healthyMeaning: `El transporte de oxígeno y energía celular de ${ref} responde adecuadamente; el objetivo en casa será conservar ese equilibrio día con día.`
            }),
            makeSystemCard({
                id: 'digestion_absorcion',
                title: `Digestión y Aprovechamiento de Nutrientes de ${ref}`,
                subtitle: 'Cómo reciben su estómago e intestino los alimentos del día',
                iconKey: 'utensils',
                sourceNodes: [n1],
                observedWhenActive: (topics) =>
                    `Observamos en ${ref} señales de digestión lenta o sensibilidad en el recubrimiento digestivo (${topics.join(', ')}).`,
                meaningWhenActive:
                    `Aunque ${ref} reciba buenos alimentos, si su estómago o intestino presentan sensibilidad cuesta más absorber vitaminas y minerales. Retirar irritantes (picante, embutidos y azúcares) en casa le dará un descanso inmediato a su mucosa digestiva.`,
                healthyObserved: `El sistema digestivo de ${ref} muestra buena capacidad general de asimilación.`,
                healthyMeaning: `Su intestino está en buenas condiciones para aprovechar los nutrientes de su alimentación diaria.`
            }),
            makeSystemCard({
                id: 'filtros_naturales',
                title: `Filtros Naturales de ${ref}: Hígado y Riñones`,
                subtitle: 'Los órganos encargados de depurar y mantener limpio su organismo',
                iconKey: 'droplets',
                sourceNodes: [n2],
                observedWhenActive: (topics) =>
                    `Los filtros naturales de ${ref} muestran señales de carga acumulada de trabajo (${topics.join(', ')}).`,
                meaningWhenActive:
                    `El hígado y los riñones funcionan como los filtros de agua de casa: limpian todos los días lo que el organismo de ${ref} ya no necesita. Por eso cuidamos con tanta prudencia su hidratación natural y ajustamos cualquier pauta sin forzarlos.`,
                healthyObserved: `Los filtros hepático y renal de ${ref} se observan despejados y trabajando a buen ritmo.`,
                healthyMeaning: `Sus órganos depuradores cuentan con buen margen funcional acorde a su etapa de crecimiento.`
            }),
            makeSystemCard({
                id: 'descanso_defensas',
                title: `Descanso, Desarrollo y Defensas de ${ref}`,
                subtitle: 'Su reloj interno, calidad de sueño y escudo inmunológico',
                iconKey: 'shield',
                sourceNodes: [n4, n6],
                observedWhenActive: (topics) =>
                    `Identificamos mayor demanda en la recuperación nocturna o en las defensas naturales de ${ref} (${topics.join(', ')}).`,
                meaningWhenActive:
                    `El organismo infantil crece y se repara a profundidad cuando ${ref} descansa bien por la noche. Al cuidar sus horarios de descanso, hidratación y alimentación diaria, usted ayuda directamente a fortalecer su sistema inmunológico.`,
                healthyObserved: `El descanso y las defensas naturales de ${ref} mantienen un equilibrio favorable.`,
                healthyMeaning: `Su escudo protector responde de forma ordenada; conservar sus rutinas de sueño sostendrá esta fortaleza.`
            }),
            makeSystemCard({
                id: 'huesos_musculos',
                title: `Huesos, Músculos, Piel y Crecimiento de ${ref}`,
                subtitle: 'El sostén estructural que acompaña su desarrollo y movimiento',
                iconKey: 'bone',
                sourceNodes: [n7],
                observedWhenActive: (topics) =>
                    `Observamos en ${ref} mayor demanda de nutrientes de soporte estructural, minerales y colágeno (${topics.join(', ')}).`,
                meaningWhenActive:
                    `Las proteínas limpias, vitaminas y minerales son los ladrillos que sostienen el crecimiento óseo y muscular de ${ref}. Los acompañaremos con alimentación natural y juego activo seguro acorde a su edad.`,
                healthyObserved: `La estructura ósea, muscular y cutánea de ${ref} conserva buena firmeza funcional.`,
                healthyMeaning: `Mantendremos un buen aporte de nutrientes naturales y movimiento diario para acompañar su desarrollo.`
            })
        ]
        : [
            makeSystemCard({
                id: 'circulacion_energia',
                title: 'Su Circulación, Corazón y Energía Diaria',
                subtitle: 'Cómo viaja el oxígeno y el combustible hacia sus órganos',
                iconKey: 'heart',
                sourceNodes: [n5, n3],
                observedWhenActive: (topics) =>
                    `Notamos que su sistema circulatorio y sus reservas de energía están haciendo un esfuerzo extra (especialmente en indicadores como ${topics.join(', ')}).`,
                meaningWhenActive:
                    'Imagine sus arterias como tuberías flexibles y a sus células como pequeñas baterías: cuando la sangre viaja un poco más espesa o hay exceso de grasas y azúcares circulando, el corazón trabaja más y usted puede sentir cansancio. Con hidratación, alimentación limpia y antioxidantes ayudaremos a que todo fluya con ligereza.',
                healthyObserved: 'Sus indicadores principales de circulación, oxigenación y manejo de energía se mantienen estables.',
                healthyMeaning: 'Sus "tuberías" y "baterías celulares" responden adecuadamente; el objetivo será conservar esa vitalidad día con día.'
            }),
            makeSystemCard({
                id: 'digestion_absorcion',
                title: 'Su Digestión y Aprovechamiento de Nutrientes',
                subtitle: 'Cómo recibe su estómago e intestino lo que usted consume',
                iconKey: 'utensils',
                sourceNodes: [n1],
                observedWhenActive: (topics) =>
                    `Observamos señales de digestión lenta o sensibilidad en el recubrimiento digestivo (${topics.join(', ')}).`,
                meaningWhenActive:
                    'Aunque usted consuma buenos alimentos, si el estómago y el intestino trabajan lento o están irritados, no logramos absorber al 100% las vitaminas y minerales. Retirar irritantes (picante, cerdo y azúcares) y comer sin prisa le dará un respiro inmediato a su digestión.',
                healthyObserved: 'Su sistema digestivo muestra buena capacidad general de asimilación.',
                healthyMeaning: 'Su intestino está listo para aprovechar los nutrientes de su plan de alimentación.'
            }),
            makeSystemCard({
                id: 'filtros_naturales',
                title: 'Sus Filtros Naturales: Hígado y Riñones',
                subtitle: 'Los encargados de depurar y mantener limpio su organismo',
                iconKey: 'droplets',
                sourceNodes: [n2],
                observedWhenActive: (topics) =>
                    `Sus filtros naturales muestran señales de carga acumulada de trabajo (${topics.join(', ')}).`,
                meaningWhenActive:
                    'Su hígado y sus riñones funcionan como los filtros de agua de casa: limpian todos los días lo que su organismo ya no necesita. Por eso cuidamos tanto la cantidad de agua simple que usted ingiere y ajustamos su suplementación con prudencia para acompañarlos sin forzarlos.',
                healthyObserved: 'Sus filtros hepático y renal se observan despejados y trabajando a buen ritmo.',
                healthyMeaning: 'Sus órganos depuradores tienen buen margen para procesar nutrientes con normalidad.'
            }),
            makeSystemCard({
                id: 'descanso_defensas',
                title: 'Su Descanso, Equilibrio Hormonal y Defensas',
                subtitle: 'Su reloj interno, manejo del estrés y escudo protector',
                iconKey: 'shield',
                sourceNodes: [n4, n6],
                observedWhenActive: (topics) =>
                    `Identificamos desgaste en su recuperación nerviosa, hormonal o en sus defensas (${topics.join(', ')}).`,
                meaningWhenActive:
                    'Su organismo se repara a profundidad cuando usted descansa bien y baja el ritmo por la noche. Al ordenar sus horarios de cena, hidratarse bien y nutrir sus defensas, ayudamos a que su sistema nervioso e inmunológico disminuyan la inflamación.',
                healthyObserved: 'Su comunicación hormonal y sus defensas mantienen un equilibrio favorable.',
                healthyMeaning: 'Su escudo protector responde de forma ordenada; cuidar su sueño mantendrá esta fortaleza.'
            }),
            makeSystemCard({
                id: 'huesos_musculos',
                title: 'Sus Huesos, Músculos, Piel y Articulaciones',
                subtitle: 'El sostén y la estructura que le permite moverse con libertad',
                iconKey: 'bone',
                sourceNodes: [n7],
                observedWhenActive: (topics) =>
                    `Observamos mayor demanda de nutrientes de soporte estructural, minerales y colágeno (${topics.join(', ')}).`,
                meaningWhenActive:
                    'Los aminoácidos, minerales, vitamina D y el colágeno son como los ladrillos y el cemento que mantienen firmes sus huesos, músculos y articulaciones. Vamos a nutrirlos con proteína de fácil digestión y movimiento suave que no lastime sus articulaciones.',
                healthyObserved: 'Su estructura ósea, muscular y de colágeno conserva buena firmeza funcional.',
                healthyMeaning: 'Mantendremos un buen aporte de proteína y movimiento diario para proteger su masa muscular.'
            })
        ];

    const weightForWater = Number(bioenergetics?.weightKg) > 0 ? Number(bioenergetics.weightKg) : 70;
    const totalLitersRecommended = Number(orthomolecularPrescription?.hydrationTargetLiters) > 0
        ? Number(orthomolecularPrescription.hydrationTargetLiters)
        : Math.min(3.2, Math.max(1.8, Number(((weightForWater * 32) / 1000).toFixed(1))));
    const specificExclusions = (serum?.combinedExclusions || [])
        .map(cleanClinicalLabel)
        .filter((val) => {
            const clean = String(val || '').trim();
            if (!clean) return false;
            return !/^(ninguna?|ninguno|niega|negad[oa]s?|n\/a|na|sin\s+alergias?|sin\s+exclusiones?|sin\s+restricciones?|no|no\s+refiere|null|undefined|-+)$/i.test(clean);
        });

    const movementGuidance = addr.isLactante
        ? `Estimulación motriz temprana (tiempo boca abajo supervisado, gateo libre y juego sensorial acorde a la edad de ${ref}), además de contacto suave con luz natural matutina.`
        : addr.isTutorChild
            ? `Juego activo diario acorde a la etapa de crecimiento de ${ref}, coordinación motriz libre al aire libre y contacto matutino con luz natural.`
            : (addr.ageYears >= 55
                ? 'Caminata suave y constante a paso cómodo de 15 a 20 minutos después de sus comidas principales (a un ritmo donde usted pueda conversar sin agitarse), acompañada de estiramientos suaves de cuello, hombros y cadera.'
                : `Caminata ligera de 20 a 30 minutos al día a ritmo conversacional y pausas activas cada hora si usted permanece mucho tiempo ${addr.seatedLabel}, sumando movilidad articular suave sin impactos bruscos.`);

    const greetingTitle = addr.isLactante
        ? `Estimada madre, padre o tutor: lectura clara del bienestar de ${ref}`
        : addr.isTutorChild
            ? `Estimada madre, padre o tutor: lectura clara de la salud de ${ref}`
            : `${addr.estimadoLabel} ${addr.firstName}: esta es la lectura clara de su salud hoy`;

    const empatheticLead = addr.isLactante
        ? `Integramos con todo cuidado la valoración de crecimiento, tolerancia digestiva y desarrollo de ${addr.childSubjectWithKinship} para explicarle con claridad qué observamos y acompañarle paso a paso en casa.`
        : addr.isTutorChild
            ? `Reunimos los síntomas, la historia clínica y las mediciones de ${addr.childSubjectWithKinship} para explicarle con total claridad qué observamos en su organismo y cómo vamos a acompañar a ${ref} paso a paso en casa, sin prisas ni sobrecargas.`
            : addr.isAdolescent
                ? `Reunimos sus síntomas, su historia clínica y las mediciones de su evaluación para explicarle con total claridad qué está ocurriendo en su organismo y cómo vamos a ${addr.directObjLower === 'la' ? 'acompañarla' : 'acompañarlo'} paso a paso junto con su madre, padre o tutor legal.`
                : `Reunimos sus síntomas, su historia clínica y las mediciones de su evaluación para explicarle con total claridad qué está ocurriendo en su organismo y cómo vamos a ${addr.directObjLower === 'la' ? 'acompañarla' : 'acompañarlo'} paso a paso, sin prisas ni sobrecargas.`;

    return {
        greetingTitle,
        empatheticLead,
        ui_labels: uiLabels,
        biosecurity_semaphore: biosecuritySemaphore,
        calcium_alert_text: orthomolecularPrescription?.calcium_alert_text || null,
        five_systems: fiveSystems,
        home_action_plan: {
            protective_nutrition: {
                title: 'Alimentación Protectora en Casa',
                targetKcal: bioenergetics?.targetKcal || null,
                summary: addr.isLactante
                    ? `Mantener lactancia materna o fórmula indicada por su pediatra e introducción gradual de alimentos naturales para ${ref}, sin sal añadida ni azúcares.`
                    : addr.isTutorChild
                        ? `El plan alimentario de ${ref} (${bioenergetics?.targetKcal || 1600} kcal al día) está calculado acorde a su crecimiento, priorizando verduras frescas, grasas nobles (aguacate, aceite de oliva), fruta natural y proteínas limpias como pescado, pollo o huevo.`
                        : `Su plan está calculado a la medida de su organismo (${bioenergetics?.targetKcal || 1800} kcal al día), priorizando verduras frescas, grasas nobles (aguacate, aceite de oliva, semillas), fibra suave y proteínas limpias como pescado, pollo o huevo.`,
                universalRules: addr.isTutorMode
                    ? ['0 Picante (protege la mucosa digestiva)', '0 Carne de cerdo y embutidos', '0 Azúcares refinados ni refrescos']
                    : ['0 Picante (protege su mucosa digestiva)', '0 Carne de cerdo y embutidos', '0 Azúcares refinados ni refrescos'],
                personalExclusions: specificExclusions
            },
            smart_hydration: {
                title: 'Hidratación Inteligente Durante el Día',
                litersPerDay: addr.isLactante ? null : totalLitersRecommended,
                summary: addr.isLactante
                    ? `En menores de 2 años la hidratación principal proviene de la leche materna o fórmula pediátrica; ofrezca pequeños sorbos de agua natural simple únicamente según la indicación de su pediatra.`
                    : addr.isTutorChild
                        ? `La meta aproximada para ${ref} es de ${totalLitersRecommended} litros de agua simple purificada repartidos a sorbos desde la mañana hasta media tarde, disminuyendo cerca de su hora de dormir.`
                        : `Su meta aproximada es de ${totalLitersRecommended} litros de agua simple purificada repartidos a sorbos desde la mañana hasta media tarde (disminuyendo cerca de su hora de dormir para no interrumpir su sueño).`,
                keyRule34Plus: addr.isLactante
                    ? 'En etapa de lactancia temprana no se utilizan sobres concentrados; continúe exclusivamente con la pauta de su pediatra.'
                    : (biosecuritySemaphore?.isPaused
                        ? (addr.isTutorChild
                            ? `Por ahora mantenemos los sobres en pausa preventiva para ${ref} y priorizamos únicamente agua natural simple.`
                            : 'Por ahora mantenemos sus suplementos en pausa preventiva y nos enfocamos únicamente en agua natural simple.')
                        : 'Regla de oro para 34Plus®: disuélvalo siempre en MÍNIMO 500 ml (medio litro) de agua simple natural para que su fibra y colágeno se absorban con suavidad.')
            },
            gentle_movement: {
                title: addr.isTutorMode ? 'Juego y Desarrollo Motor Diario' : 'Movimiento Cotidiano Seguro y Articular',
                isPediatric: Boolean(addr.isTutorMode),
                summary: movementGuidance,
                sleepHabit: addr.isLactante
                    ? `Favorezca rutinas tranquilas de sueño para ${ref} con luz tenue y ambiente sereno libre de pantallas.`
                    : addr.isTutorChild
                        ? `Procure ofrecer a ${ref} una cena ligera al menos 2 horas antes de dormir y apagar pantallas brillantes con anticipación.`
                        : 'Procure cenar ligero al menos 2 a 3 horas antes de dormir y descansar lejos de pantallas brillantes.'
            }
        }
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
    const { citationId: rawCitationId, patientData: bodyPatientData } = req.body;
    const citationId = normalizeControllerCitationId(rawCitationId);

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta o es inválido el parámetro citationId (Guardia NOM-004)." });
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

        // Saneamiento recursivo determinista + purga quirúrgica de telemetría .TCX legada no confirmada
        patientData = sanitizeLegacyTelemetryInPatientData(sanitizeSnapshotStringsRecursively(patientData || {}));
        const isFemalePatient = resolveBackendPatientIsFemale(patientData);

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

        const hasExplicitNumericAge =
            (extractedAge !== null && extractedAge >= 0) ||
            (dobDate !== null && !isNaN(dobDate.getTime()));

        const isLactanteExplicit = Boolean(
            patientData.isLactante ||
            patientData.profile?.pediatric_profile?.is_lactante ||
            (hasExplicitNumericAge && ageYears >= 0 && ageYears < 2)
        );

        const isPediatricExplicit = Boolean(
            isLactanteExplicit ||
            patientData.isPediatrico ||
            patientData.profile?.pediatric_profile?.is_minor ||
            patientData.profile?.pediatric_profile?.is_pediatric ||
            (hasExplicitNumericAge && ageYears >= 0 && ageYears < 18)
        );

        if (isNaN(ageYears) || ageYears < 0) {
            ageYears = isLactanteExplicit ? 0 : (isPediatricExplicit ? 10 : 30);
        }

        const pName = cleanClinicalLabel(
            patientData.profile?.name ||
            patientData.profile?.first_name ||
            patientData.identificacion?.nombre ||
            patientData.identityLock?.patientInfo?.name ||
            (isLactanteExplicit ? "su bebé" : "Paciente")
        );

        const clinicalAddressing = resolveClinicalAddressing({
            patientName: pName,
            ageYears,
            isFemale: isFemalePatient,
            isLactanteExplicit
        });

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
            (clinicalAddressing.isTutorMode ? "JUEGO ACTIVO" : "SEDENTARIO")
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
        if (isLactanteExplicit || (hasExplicitNumericAge && (ageMonths < 12 || ageYears < 1))) {
            pediatricDisclaimer = "⚠️ DESCARGO REGULATORIO NOM-043/COFEPRIS: En lactantes menores de 1 año, la lactancia materna y la fórmula de continuación son la base nutricional primaria. Toda sugerencia de modulación nutricional celular (34Plus®) es de carácter orientativo y requiere validación explícita por el Pediatra tratante.";
        }

        // Estrategia técnica para vista médica
        let physicalStrategyText = "";
        if (clinicalAddressing.isLactante) {
            physicalStrategyText = "Estimulación Psicomotriz Pediátrica: Gateo Activo, Coordinación Motora Gruesa/Fina y Tiempo de Juego Supervisado (Tummy Time).";
        } else if (clinicalAddressing.isTutorChild) {
            physicalStrategyText = "Desarrollo Psicomotor Escolar: Juego Activo Diario, Coordinación Motriz Libre y Exposición Matutina Segura a Luz Natural.";
        } else if (clinicalAddressing.isAdolescent) {
            physicalStrategyText = "Acondicionamiento Físico Juvenil Guiado: Actividad aeróbica recreativa, coordinación neuromuscular y movilidad articular progresiva acorde a etapa adolescente.";
        } else if (isExerciseRestricted) {
            physicalStrategyText = "Prescripción Adaptativa Ligera: Actividad aeróbica suave conversacional (6\u00A0000 a 8\u00A0000 pasos/día) + Readaptación Articular Progresiva sin impacto ni esfuerzo máximo.";
        } else {
            physicalStrategyText = "Acondicionamiento Aeróbico Moderado + Fortalecimiento Muscular Progresivo en 3 Fases con control biomecánico.";
        }

        // ==========================================
        // 5. MOTOR DETERMINISTA PRIMERO (SSoTT): SEMÁFORO DE BIOSEGURIDAD + CONTRATO TERAPÉUTICO CANÓNICO
        // ==========================================
        const biosecuritySemaphore = evaluateBiosecurityAndTitration(
            patientData,
            serum,
            ageYears,
            medications,
            hasStimulantsConflict,
            isLactanteExplicit,
            isPediatricExplicit,
            clinicalAddressing
        );

        const canonicalContract = buildCanonicalTherapeuticContract({
            serum,
            bioenergetics,
            biosecuritySemaphore,
            hasStimulantsConflict,
            isLactanteExplicit,
            isPediatricExplicit
        });

        // ==========================================
        // 6. SÍNTESIS OBSERVACIONAL UNIFICADA EN 1 SOLA LLAMADA GEMINI (16000 ms + therapeutic_focus 100% determinista)
        // ==========================================
        let aiInstance = null;
        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            } catch (initErr) {
                console.warn("⚠️ No se pudo inicializar GoogleGenAI, operando en modo determinista SSoTT local:", initErr.message);
            }
        }

        console.log(`🧠 CORTEX SSoTT v2.7.2: Sintetizando 7 Nodos IFM en llamada unificada (timeout=16000ms, temp=0.1) para Ruta ${determinedRoute}...`);
        const processedIfmNodes = await synthesizeAllIfmNodesSSoTT(serum.nodes, canonicalContract, aiInstance);

        // ==========================================
        // 7. PRESCRIPCIÓN ORTOMOLECULAR SINCRONIZADA + GUÍA EMPÁTICA DEL PACIENTE (PARIDAD BILATERAL 100%)
        // ==========================================
        const orthomolecularPrescription = buildOrthomolecularPrescription(
            patientData,
            processedIfmNodes,
            serum,
            bioenergetics,
            hasStimulantsConflict,
            biosecuritySemaphore,
            canonicalContract,
            clinicalAddressing
        );

        const preliminary_diagnosis = processedIfmNodes.map((n, idx) => {
            const auditTag = n.validation_status === 'REQUIERE_REVISIÓN' ? ' [⚠️ REQUIERE_REVISIÓN]' : '';
            return sanitizeClinicalSpanish(`${idx + 1}. ${n.nodeName.replace(/^\d+\.\s*/, '')}: ${n.summary} (${n.cie10})${auditTag}`);
        });

        const activeNodesWithAnomalies = processedIfmNodes.filter(n => n.status !== 'HOMEOSTASIS');

        const rawFriendlyGuide = buildPatientFriendlyGuide({
            patientName: pName,
            ageYears,
            isFemale: isFemalePatient,
            isLactanteExplicit,
            isPediatricExplicit,
            processedNodes: processedIfmNodes,
            serum,
            bioenergetics,
            orthomolecularPrescription,
            biosecuritySemaphore,
            addressingOverride: clinicalAddressing
        });
        const applyGenderRecurse = (node) => {
            if (typeof node === 'string') return enforcePatientGenderConcordance(node, isFemalePatient);
            if (Array.isArray(node)) return node.map(applyGenderRecurse);
            if (node && typeof node === 'object') {
                const out = {};
                for (const [k, v] of Object.entries(node)) out[k] = applyGenderRecurse(v);
                return out;
            }
            return node;
        };
        const patientFriendlyGuide = applyGenderRecurse(rawFriendlyGuide);

        const diagnosticoCausaRaiz = isLactanteExplicit
            ? `Lactante de ${ageMonths || 11} meses en fase acelerada de crecimiento y desarrollo L-OMS. Constantes vitales dentro de parámetros normales (FC ${heartRate} LPM). Evaluación orientada a la maduración de la mucosa intestinal, tolerancia a alimentos sólidos y neurodesarrollo motor.`
            : (activeNodesWithAnomalies.length > 0
                ? activeNodesWithAnomalies.map(n => `• ${n.nodeName.replace(/^(?:(?:Nodo\s*)?\d+[.:\s-]*)+/i, '')} (${n.cie10}): ${n.summary}`).join(' ')
                : 'Homeostasis funcional conservada en los 7 Nodos de la Matriz IFM (Z00.0).');

        const critical_alerts = [];
        if (isLactanteExplicit) {
            critical_alerts.push(`PROTOCOLO LACTANTE: Constantes vitales normales en escala PALS/OMS (FC ${heartRate} LPM). Prescrita Estimulación Psicomotriz.`);
        } else if (isExerciseRestricted) {
            critical_alerts.push("Salvaguarda de Esfuerzo Físico (Adulto): Se restringe ejercicio extenuante de alta intensidad por perfil sedentario o cardiovascular. Prescrita caminata aeróbica ligera y movilidad articular progresiva.");
        }

        if (hasStimulantsConflict) {
            critical_alerts.push("BLOQUEO FARMACOLÓGICO (NOM-028): Se detectaron fármacos activos con interacción simpaticomimética. Fórmula 33Plus® adaptada a protocolo libre de estimulantes.");
        }

        if (biosecuritySemaphore.level !== 'VERDE') {
            critical_alerts.push(`SEMÁFORO DE BIOSEGURIDAD (${biosecuritySemaphore.level}): ${biosecuritySemaphore.badgeLabel} — ${biosecuritySemaphore.titrationPlanText}`);
        }

        if (orthomolecularPrescription.has_calcium_contraction_lock && (orthomolecularPrescription.calcium_clinical_safeguard_text || orthomolecularPrescription.calcium_alert_text)) {
            critical_alerts.push(`SALVAGUARDA MINERAL (BLOQUEO DE CALCIO EXÓGENO): ${orthomolecularPrescription.calcium_clinical_safeguard_text || orthomolecularPrescription.calcium_alert_text}`);
        }

        foodAllergies.forEach(a => {
            const agent = typeof a === 'object' ? a.agent : a;
            if (agent) critical_alerts.push(`ALERGIA ALIMENTARIA ESTRICTA: ${cleanClinicalLabel(String(agent)).toUpperCase()}`);
        });
        drugAllergies.forEach(a => {
            const agent = typeof a === 'object' ? a.agent : a;
            if (agent) critical_alerts.push(`ALERGIA MEDICAMENTOSA: ${cleanClinicalLabel(String(agent)).toUpperCase()}`);
        });

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
            `${activeNodesWithAnomalies.length + 1}. [Bioenergética ${bioenergetics.equationUsed} • ${canonicalContract.regimen}] TMB: ${bioenergetics.bmr} kcal | TDEE: ${bioenergetics.tdee} kcal | Meta Prescrita: ${bioenergetics.targetKcal} kcal (${bioenergetics.macros.carbs}% C / ${bioenergetics.macros.protein}% P / ${bioenergetics.macros.fat}% L) | Hidratación Meta: ${canonicalContract.hydrationTargetLiters} L/día.`,
            `${activeNodesWithAnomalies.length + 2}. [Readaptación Biomecánica y Prescripción de Movimiento] ${physicalStrategyText}`,
            `${activeNodesWithAnomalies.length + 3}. [Bioseguridad y Posología (${biosecuritySemaphore.level})] ${biosecuritySemaphore.titrationPlanText}`
        ];

        const payload = {
            doctrina_aplicada: determinedRoute === 'RUTA_A'
                ? 'Ruta Clínica A • Endocrinología y Desarrollo Pediátrico L-OMS (Primeros 1000 Días)'
                : `Ruta Clínica ${determinedRoute.replace('RUTA_', '')} • Medicina Funcional de Sistemas (Matriz IFM SSoTT v2.7)`,
            diagnostico_causa_raiz: sanitizeClinicalSpanish(diagnosticoCausaRaiz),
            preliminary_diagnosis,
            ifm_nodes_matrix: processedIfmNodes,
            auxiliary_bioenergetics: (serum.auxiliaryBioenergetics || []).map(item => ({
                ...item,
                label: sanitizeClinicalSpanish(item?.label || ''),
                detail: formatMedicalBiomarkerSummary(item?.detail || '')
            })),
            bioenergetics,
            biosecurity_semaphore: biosecuritySemaphore,
            therapeutic_contract: canonicalContract,
            orthomolecular_prescription: orthomolecularPrescription,
            patient_friendly_guide: patientFriendlyGuide,
            critical_alerts,
            suggested_management,
            alertas_bioseguridad: critical_alerts.join(' • ') || (pediatricDisclaimer || 'Parámetros de bioseguridad verificados bajo la NOM-004-SSA3-2012.'),
            sistemas_afectados: activeNodesWithAnomalies.length > 0
                ? activeNodesWithAnomalies.map(n => `${n.nodeName.replace(/^\d+\.\s*/, '')} (${n.cie10})`)
                : ["Homeostasis Sistémica Conservada (Z00.0)"],
            estrategia_terapeutica: {
                nutricion_defensora: isLactanteExplicit
                    ? "Matriz de Nutrición Celular 34Plus® Pediátrica: Leche Materna / Fórmula de Continuación + Introducción Guiada de Sólidos (BLW / Papillas caseras)."
                    : `${canonicalContract.regimen} — Prescripción Bioenergética (${bioenergetics.equationUsed}): TDEE ${bioenergetics.tdee} kcal → Meta ${bioenergetics.targetKcal} kcal/día (${bioenergetics.macros.carbs}% Carbohidratos / ${bioenergetics.macros.protein}% Proteínas / ${bioenergetics.macros.fat}% Lípidos) + Hidratación diaria ${canonicalContract.hydrationTargetLiters} L/día + Regla 0 Picante, 0 Cerdo, 0 Azúcares refinados${canonicalContract.patientSpecificExclusions.length > 0 ? ` (Exclusiones personalizadas: ${canonicalContract.patientSpecificExclusions.join(', ')})` : ''}.`,
                readaptacion_fisica: physicalStrategyText
            },
            guia_paciente_whatsapp: {
                titulo_resumen: clinicalAddressing.isTutorMode
                    ? `El Crecimiento y Salud de ${clinicalAddressing.childShortRef}`
                    : `Su Guía Personal de Salud — ${pName}`,
                pilar_salud_crecimiento: patientFriendlyGuide.empatheticLead,
                pilar_alimentacion_diaria: patientFriendlyGuide.home_action_plan.protective_nutrition.summary,
                pilar_juegos_movimiento: patientFriendlyGuide.home_action_plan.gentle_movement.summary,
                pilar_cuidados_suplementacion: `${biosecuritySemaphore.badgeLabel}: ${biosecuritySemaphore.titrationPlanText}`
            },
            human_approved_diagnosis: preliminary_diagnosis,
            human_approved_management: suggested_management,
            ssot_contract_version: "2.8.2",
            status: "SYNTHESIZED_READY_FOR_REVIEW"
        };

        // ==========================================
        // 7. PERSISTENCIA CIFRADA NOM-004 + SANEAMIENTO RECURSIVO + AUDIT LEDGER SHA-256
        // ==========================================
        try {
            const stmtCheck = db.prepare('SELECT is_completed, patient_data_snapshot FROM session_persistence WHERE citation_id = ?');
            const existingRow = stmtCheck.get(citationId.toString());
            if (existingRow && existingRow.patient_data_snapshot) {
                const decryptedRaw = cryptoVault.decryptClinicalData(existingRow.patient_data_snapshot);
                const parsedStored = typeof decryptedRaw === 'string'
                    ? JSON.parse(decryptedRaw || '{}')
                    : (decryptedRaw || {});
                const healedSnapshot = sanitizeLegacyTelemetryInPatientData(sanitizeSnapshotStringsRecursively(parsedStored));
                const validUid = normalizeControllerUserId(
                    healedSnapshot?.profile?.usuarioId ??
                    healedSnapshot?.identificacion?.usuarioId ??
                    healedSnapshot?.usuarioId,
                    citationId
                );
                if (validUid) {
                    healedSnapshot.profile = { ...(healedSnapshot.profile || {}), usuarioId: validUid, citaId: citationId, citationId };
                    healedSnapshot.identificacion = { ...(healedSnapshot.identificacion || {}), usuarioId: validUid, idCita: citationId, citaId: citationId };
                }
                if (Number(existingRow.is_completed) === 1) {
                    healedSnapshot.is_completed = true;
                }
                healedSnapshot.clinical_dossier = payload;

                const cipherSnapshot = cryptoVault.encryptClinicalData(healedSnapshot);
                const stmtUpdate = db.prepare(`
                    UPDATE session_persistence 
                    SET user_id = CASE
                            WHEN ? IS NOT NULL AND ? != '0' THEN ?
                            WHEN user_id IS NOT NULL AND user_id != '0' THEN user_id
                            ELSE NULL
                        END,
                        patient_data_snapshot = ?,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE citation_id = ?
                `);
                stmtUpdate.run(validUid, validUid, validUid, cipherSnapshot, citationId.toString());

                cryptoVault.appendAuditLedger({
                    actorId: 'CORTEX_SYNTHESIZER_V2_5',
                    action: 'SYNTHESIZE_DOSSIER_NOM004',
                    patientId: citationId.toString(),
                    payload: {
                        route: determinedRoute,
                        semaphore: biosecuritySemaphore.level,
                        synthesizedAt: new Date().toISOString()
                    }
                });
            }
        } catch (persistErr) {
            console.warn("⚠️ No se pudo pre-guardar clinical_dossier cifrado en SQLite:", persistErr.message);
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
        citationId: rawCitationId,
        approvedDiagnosis,
        approvedManagement,
        additionalSymptoms,
        originalDiagnosis,
        originalManagement,
        ifmNodesMatrix,
        bioenergetics,
        orthomolecularPrescription
    } = req.body;
    const citationId = normalizeControllerCitationId(rawCitationId);

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta o es inválido el parámetro citationId (Guardia NOM-004)." });
    }

    try {
        const stmtSelect = db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?');
        const row = stmtSelect.get(citationId.toString());

        if (!row) {
            return res.status(404).json({ success: false, message: "No se encontró sesión activa." });
        }

        const decryptedRaw = cryptoVault.decryptClinicalData(row.patient_data_snapshot || '{}');
        const parsedSnapshot = typeof decryptedRaw === 'string'
            ? JSON.parse(decryptedRaw || '{}')
            : (decryptedRaw || {});
        const patientData = sanitizeLegacyTelemetryInPatientData(sanitizeSnapshotStringsRecursively(parsedSnapshot));

        const rlhf_deltas = {
            original_diagnosis: originalDiagnosis || [],
            approved_diagnosis: approvedDiagnosis || [],
            original_management: originalManagement || [],
            approved_management: approvedManagement || [],
            modified_at: new Date().toISOString()
        };

        const existingDossier = patientData.clinical_dossier || {};
        const mergedIfmNodes = ifmNodesMatrix || existingDossier.ifm_nodes_matrix || [];
        const mergedBioenergetics = bioenergetics || existingDossier.bioenergetics || null;
        const mergedOrtho = orthomolecularPrescription || existingDossier.orthomolecular_prescription || null;
        const mergedSemaphore = mergedOrtho?.biosecurity_semaphore || existingDossier.biosecurity_semaphore || null;

        let updatedFriendlyGuide = existingDossier.patient_friendly_guide || null;
        if (mergedIfmNodes.length > 0 && (ifmNodesMatrix || bioenergetics || orthomolecularPrescription || !updatedFriendlyGuide)) {
            const isFem = resolveBackendPatientIsFemale(patientData);
            const rawAgeCandidate =
                patientData?.identityLock?.patientInfo?.age ??
                patientData?.profile?.age ??
                patientData?.identificacion?.edad ??
                patientData?.age;
            const hasExplicitAgeInSnap = rawAgeCandidate !== undefined && rawAgeCandidate !== null && rawAgeCandidate !== '';
            const ageNum = hasExplicitAgeInSnap && !isNaN(Number(rawAgeCandidate)) ? Number(rawAgeCandidate) : 30;
            const isLact = Boolean(patientData?.isLactante || patientData?.profile?.pediatric_profile?.is_lactante || (hasExplicitAgeInSnap && ageNum >= 0 && ageNum < 2));
            const isPed = Boolean(isLact || patientData?.isPediatrico || patientData?.profile?.pediatric_profile?.is_pediatric || (hasExplicitAgeInSnap && ageNum >= 0 && ageNum < 18));
            const pName = cleanClinicalLabel(
                patientData.profile?.name ||
                patientData.profile?.first_name ||
                patientData.identificacion?.nombre ||
                patientData.identityLock?.patientInfo?.name ||
                (isLact ? 'su bebé' : 'Paciente')
            );
            const serumSnap = distillClinicalSerum(patientData, isLact);
            const rawGuide = buildPatientFriendlyGuide({
                patientName: pName,
                ageYears: ageNum,
                isFemale: isFem,
                isLactanteExplicit: isLact,
                isPediatricExplicit: isPed,
                processedNodes: mergedIfmNodes,
                serum: serumSnap,
                bioenergetics: mergedBioenergetics,
                orthomolecularPrescription: mergedOrtho,
                biosecuritySemaphore: mergedSemaphore
            });
            const recurseGender = (node) => {
                if (typeof node === 'string') return enforcePatientGenderConcordance(node, isFem);
                if (Array.isArray(node)) return node.map(recurseGender);
                if (node && typeof node === 'object') {
                    const out = {};
                    for (const [k, v] of Object.entries(node)) out[k] = recurseGender(v);
                    return out;
                }
                return node;
            };
            updatedFriendlyGuide = recurseGender(rawGuide);
        }

        const wasAlreadyCompleted = Number(row.is_completed) === 1 || Number(row.last_active_phase) >= 21;

        patientData.clinical_dossier = {
            ...existingDossier,
            human_approved_diagnosis: (approvedDiagnosis || []).map(sanitizeClinicalSpanish),
            human_approved_management: (approvedManagement || []).map(sanitizeClinicalSpanish),
            ifm_nodes_matrix: mergedIfmNodes,
            bioenergetics: mergedBioenergetics,
            orthomolecular_prescription: mergedOrtho,
            patient_friendly_guide: updatedFriendlyGuide,
            additional_symptoms_reported: sanitizeClinicalSpanish(additionalSymptoms || ""),
            rlhf_deltas,
            doctor_approval_timestamp: new Date().toISOString(),
            ssot_contract_version: "2.8.2",
            status: "approved"
        };

        patientData.diagnosis_approved = true;
        if (wasAlreadyCompleted) {
            patientData.is_completed = true;
        }

        const validUid = normalizeControllerUserId(
            patientData?.profile?.usuarioId ??
            patientData?.identificacion?.usuarioId ??
            patientData?.usuarioId ??
            row.user_id,
            citationId
        );
        if (validUid) {
            patientData.profile = { ...(patientData.profile || {}), usuarioId: validUid, citaId: citationId, citationId };
            patientData.identificacion = { ...(patientData.identificacion || {}), usuarioId: validUid, idCita: citationId, citaId: citationId };
        }

        const nextPhase = wasAlreadyCompleted ? Math.max(21, Number(row.last_active_phase) || 21) : 20;
        const nextBlock = wasAlreadyCompleted ? "finished" : "PHASE_20_READY";

        const stmtSave = db.prepare(`
            INSERT INTO session_persistence (citation_id, user_id, last_active_phase, last_active_block, patient_data_snapshot, is_completed, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(citation_id) DO UPDATE SET
                user_id = CASE
                    WHEN excluded.user_id IS NOT NULL AND excluded.user_id != '0' THEN excluded.user_id
                    WHEN session_persistence.user_id IS NOT NULL AND session_persistence.user_id != '0' THEN session_persistence.user_id
                    ELSE NULL
                END,
                last_active_phase = CASE
                    WHEN session_persistence.is_completed = 1 THEN MAX(COALESCE(session_persistence.last_active_phase, 21), excluded.last_active_phase)
                    ELSE excluded.last_active_phase
                END,
                last_active_block = CASE
                    WHEN session_persistence.is_completed = 1 THEN 'finished'
                    ELSE excluded.last_active_block
                END,
                patient_data_snapshot = excluded.patient_data_snapshot,
                is_completed = CASE
                    WHEN excluded.is_completed = 1 OR session_persistence.is_completed = 1 THEN 1
                    ELSE 0
                END,
                last_updated = CURRENT_TIMESTAMP
        `);

        const cipherSnapshot = cryptoVault.encryptClinicalData(patientData);
        stmtSave.run(citationId.toString(), validUid, nextPhase, nextBlock, cipherSnapshot, wasAlreadyCompleted ? 1 : 0);

        cryptoVault.appendAuditLedger({
            actorId: 'SPECIALIST_SHERPA',
            action: 'APPROVE_DOSSIER',
            patientId: citationId.toString(),
            payload: { phase: nextPhase, approvedAt: new Date().toISOString() }
        });

        console.log(`💾 [RLHF SUCCESS] Expediente v2.5 sellado con deltas de especialista para Cita #${citationId}`);
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
    const { citationId: rawCitationId, rawPatientData, electret245Baseline } = req.body;
    const citationId = normalizeControllerCitationId(rawCitationId);

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta o es inválido el parámetro citationId (Guardia NOM-004)." });
    }

    try {
        const validUid = normalizeControllerUserId(
            rawPatientData?.profile?.usuarioId ??
            rawPatientData?.identificacion?.usuarioId ??
            rawPatientData?.usuarioId ??
            req.body.userId,
            citationId
        );

        const fullBaseline = sanitizeLegacyTelemetryInPatientData(sanitizeSnapshotStringsRecursively({
            ...(rawPatientData || {}),
            profile: {
                ...(rawPatientData?.profile || {}),
                citaId: citationId,
                citationId,
                ...(validUid ? { usuarioId: validUid } : {})
            },
            identificacion: {
                ...(rawPatientData?.identificacion || {}),
                idCita: citationId,
                citaId: citationId,
                ...(validUid ? { usuarioId: validUid } : {})
            },
            electretTelemetry: electret245Baseline || rawPatientData?.electretTelemetry || {},
            presyncedAt: new Date().toISOString(),
            isBaselineT0: true
        }));

        const cipherSnapshot = cryptoVault.encryptClinicalData(fullBaseline);

        const stmt = db.prepare(`
            INSERT INTO session_persistence (citation_id, user_id, last_active_phase, last_active_block, patient_data_snapshot, is_completed, last_updated)
            VALUES (?, ?, 19, 'BASELINE_T0', ?, 0, CURRENT_TIMESTAMP)
            ON CONFLICT(citation_id) DO UPDATE SET
                user_id = CASE
                    WHEN excluded.user_id IS NOT NULL AND excluded.user_id != '0' THEN excluded.user_id
                    WHEN session_persistence.user_id IS NOT NULL AND session_persistence.user_id != '0' THEN session_persistence.user_id
                    ELSE NULL
                END,
                patient_data_snapshot = excluded.patient_data_snapshot,
                last_active_phase = 19,
                last_active_block = 'BASELINE_T0',
                last_updated = CURRENT_TIMESTAMP
        `);
        stmt.run(citationId.toString(), validUid, cipherSnapshot);

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
    buildCanonicalTherapeuticContract,
    resolveNodeTherapeuticFocus,
    synthesizeAllIfmNodesSSoTT,
    evaluateBiosecurityAndTitration,
    buildOrthomolecularPrescription,
    buildPatientFriendlyGuide,
    humanizeBiomarkerTopicForPatient,
    calculatePrecisionWeights,
    calculatePrecisionBioenergetics,
    processCortexNodesInBatches,
    sanitizeLegacyTelemetryInPatientData,
    resolveBackendPatientIsFemale
};
