/**
 * Motor Universal Compartido de Anamnesis 360° y Edad Metabólica de 6 Dominios (`v3.4.0-EGM51-V3` — SSoTT)
 * Equipo en Acción® — Ecosistema T.I.L.O. (NOM-004-SSA3-2012 / NOM-043 / COFEPRIS)
 *
 * Fuente Única de Verdad (CommonJS vigilada por `nodemon --watch ../shared`), consumida 1:1 en servidor y cliente:
 * - Normaliza retrocompatiblemente Fases 0 a 18 sin tocar componentes protegidos (EGM-57).
 * - Evalúa farmacovigilancia, restricción hídrica, litiasis, turno nocturno y exclusiones alergénicas/éticas (EGM-58..60, EGM-66..67).
 * - Calcula Edad Metabólica sobre 6 Dominios (0.26 / 0.18 / 0.18 / 0.14 / 0.12 / 0.12 = 1.00) con Curva en J,
 *   atenuación por fármacos activos, biomarcadores PhenoAge y certeza bioquímica honesta (EGM-61..65).
 */

const ENGINE_VERSION_SSOT = '3.4.0-EGM51-V3';

const DOMAIN_WEIGHTS_SSOT = Object.freeze({
    ANTHROPOMETRY_ADIPOSITY: 0.26,
    HEMODYNAMICS_ALTITUDE_FITNESS: 0.18,
    GLYCEMIC_METABOLISM: 0.18,
    LIPOPROTEIN_VASCULAR: 0.14,
    HEPATORENAL_HEMATOLOGY: 0.12,
    ALLOSTATIC_TOXICOLOGY: 0.12
});

function normalizeAsciiToken(raw = '') {
    return String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function cleanHumanLabel(raw = '') {
    return String(raw || '')
        .replace(/\s*&\s*/g, ' y ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isNegatedOrEmptyToken(raw = '') {
    const s = cleanHumanLabel(raw);
    if (!s) return true;
    return /^(?:no|ningun[oa]?s?|niega|negad[oa]s?|sin\s+(?:antecedentes?|diagnosticos?|patologias?|alergias?|sintomas?|exclusiones?|restricciones?)|no_diagnosis|none|null|undefined|n\/a|na|-+|0)$/i.test(
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
}

const SURGICAL_CODE_LABELS = Object.freeze({
    SURG_BYPASS_MANGA: 'Cirugía bariátrica (Bypass / Manga gástrica)',
    SURG_COLECISTECTOMIA: 'Colecistectomía',
    SURG_APENDICECTOMIA: 'Apendicectomía',
    SURG_HERNIOPLASTIA: 'Hernioplastia',
    SURG_CESAREA: 'Cesárea',
    SURG_HISTERECTOMIA: 'Histerectomía',
    SURG_TIROIDECTOMIA: 'Tiroidectomía',
    SURG_FUNDUPLICATURA: 'Funduplicatura antirreflujo',
    SURG_ORTOPEDICA: 'Cirugía ortopédica articular/espinal',
    SURG_CARDIACA: 'Cirugía cardiovascular'
});

function parseMealClockMinutes(rawHour = '') {
    const txt = String(rawHour || '').trim().toLowerCase();
    if (!txt) return null;
    const m = txt.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
    if (!m) return null;
    let hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm < 0 || mm > 59) return null;
    const mer = (m[3] || '').replace(/[^ap]/gi, '').toLowerCase();
    if (mer === 'p' && hh < 12) hh += 12;
    else if (mer === 'a' && hh === 12) hh = 0;
    if (hh < 0 || hh > 23) return null;
    return (hh * 60) + mm;
}

function resolveSharedPatientIsFemale(patientData = {}) {
    const candidates = [
        patientData?.identityLock?.patientInfo?.sex,
        patientData?.identityLock?.patientInfo?.gender,
        patientData?.identificacion?.sexo,
        patientData?.identificacion?.genero,
        patientData?.profile?.sex,
        patientData?.profile?.gender,
        patientData?.demographics?.sex,
        patientData?.sex,
        patientData?.genero
    ];
    for (const c of candidates) {
        const u = String(c || '').trim().toUpperCase();
        if (!u) continue;
        if (u === 'F' || u.startsWith('FEM') || u === 'MUJER') return true;
        if (u === 'M' || u.startsWith('MASC') || u === 'HOMBRE' || u.startsWith('VAR')) return false;
    }
    return false;
}

function resolveSharedVerifiedAge(patientData = {}, fallbackYears = 35) {
    const pInfo = patientData?.identityLock?.patientInfo || {};
    const birthRaw =
        pInfo.birthdate ||
        patientData?.profile?.birthdate ||
        patientData?.identificacion?.fechanac ||
        patientData?.identificacion?.fechaNacimiento ||
        patientData?.demographics?.birthdate ||
        '';
    let parsedBirth = null;
    if (birthRaw) {
        const s = String(birthRaw).trim();
        const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (dmy) {
            parsedBirth = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        } else {
            const iso = new Date(s);
            if (!Number.isNaN(iso.getTime())) parsedBirth = iso;
        }
    }
    if (parsedBirth && !Number.isNaN(parsedBirth.getTime())) {
        const now = new Date();
        let years = now.getFullYear() - parsedBirth.getFullYear();
        let months = (now.getFullYear() - parsedBirth.getFullYear()) * 12 + (now.getMonth() - parsedBirth.getMonth());
        const mDiff = now.getMonth() - parsedBirth.getMonth();
        if (mDiff < 0 || (mDiff === 0 && now.getDate() < parsedBirth.getDate())) {
            years -= 1;
        }
        if (now.getDate() < parsedBirth.getDate()) {
            months -= 1;
        }
        if (years >= 0 && years <= 120) {
            return {
                ageYears: years,
                ageMonths: Math.max(0, months),
                hasVerifiedBirthDate: true,
                isLactanteVerified: years < 2,
                isPediatricVerified: years < 18
            };
        }
    }
    const candidates = [
        pInfo.age,
        patientData?.identificacion?.edad,
        patientData?.profile?.age,
        patientData?.demographics?.age,
        patientData?.age
    ];
    for (const c of candidates) {
        const n = parseFloat(c);
        if (Number.isFinite(n) && n >= 0 && n <= 120) {
            const yrs = Math.floor(n);
            return {
                ageYears: yrs,
                ageMonths: Math.round(n * 12),
                hasVerifiedBirthDate: false,
                isLactanteVerified: Boolean(yrs < 2 && patientData?.isLactante === true),
                isPediatricVerified: Boolean(yrs < 18 && (patientData?.isPediatrico === true || yrs >= 2))
            };
        }
    }
    return {
        ageYears: fallbackYears,
        ageMonths: fallbackYears * 12,
        hasVerifiedBirthDate: false,
        isLactanteVerified: false,
        isPediatricVerified: false
    };
}

function resolveSharedAltitudeMsnm(patientData = {}) {
    const explicitCandidates = [
        patientData?.identificacion?.altitude_msnm,
        patientData?.identificacion?.altitud_msnm,
        patientData?.profile?.altitude_msnm,
        patientData?.demographics?.altitude_msnm,
        patientData?.location?.altitude_msnm,
        patientData?.altitude_msnm
    ];
    for (const raw of explicitCandidates) {
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
            const v = Number(raw);
            if (Number.isFinite(v) && v >= 0 && v <= 5500) {
                return buildAltitudeBand(Math.round(v), patientData);
            }
        }
    }

    const locText = [
        patientData?.identificacion?.municipio,
        patientData?.identificacion?.ciudad,
        patientData?.identificacion?.estado,
        patientData?.identificacion?.direccion,
        patientData?.identificacion?.domicilio,
        patientData?.profile?.city,
        patientData?.profile?.state,
        patientData?.profile?.address,
        patientData?.demographics?.city,
        patientData?.demographics?.state
    ]
        .filter(Boolean)
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

    if (/\b(?:TOLUCA|METEPEC|ZINACANTEPEC|LERMA|SAN\s+MATEO\s+ATENCO|ALMOLOYA)\b/.test(locText)) {
        return buildAltitudeBand(2660, patientData, 'Toluca / Valle Alto (2,660 msnm)');
    }
    if (/\b(?:CIUDAD\s+DE\s+MEXICO|CDMX|DF|NAUCALPAN|TLALNEPANTLA|ECATEPEC|HUIXQUILUCAN|PACHUCA|PUEBLA|TLAXCALA|ZACATECAS)\b/.test(locText)) {
        return buildAltitudeBand(2240, patientData, 'Altiplano Central (2,240 msnm)');
    }
    if (/\b(?:QUERETARO|MORELIA|AGUASCALIENTES|SAN\s+LUIS\s+POTOSI|DURANGO|GUANAJUATO|LEON|GUADALAJARA|ZAPOPAN|SALTILLO|OAXACA)\b/.test(locText)) {
        return buildAltitudeBand(1800, patientData, 'Altitud Intermedia (1,800 msnm)');
    }
    if (/\b(?:VERACRUZ|BOCA\s+DEL\s+RIO|CANCUN|MERIDA|ACAPULCO|MAZATLAN|TAMPICO|PUERTO\s+VALLARTA|LOS\s+CABOS|LA\s+PAZ|COATZACOALCOS|CAMPECHE|CHETUMAL|PLAYA\s+DEL\s+CARMEN|COZUMEL|MANZANILLO|ENSENADA|VILLAHERMOSA)\b/.test(locText)) {
        return buildAltitudeBand(0, patientData, 'Nivel del mar (0 msnm)');
    }
    if (/\b(?:MONTERREY|SAN\s+PEDRO\s+GARZA|HERMOSILLO|CULIACAN|CHIHUAHUA|TORREON|MERIDA|TUXTLA|CUERNAVACA)\b/.test(locText)) {
        return buildAltitudeBand(540, patientData, 'Baja altitud (540 msnm)');
    }
    return buildAltitudeBand(2240, patientData, 'Referencia altiplano (2,240 msnm)');
}

function buildAltitudeBand(msnm, patientData = {}, customLabel = '') {
    let spo2NormalFloor = 95;
    let hbAltitudeOffset = 0.0;
    if (msnm >= 2500) {
        spo2NormalFloor = 91;
        hbAltitudeOffset = 1.3;
    } else if (msnm >= 2000) {
        spo2NormalFloor = 92;
        hbAltitudeOffset = 0.8;
    } else if (msnm >= 1500) {
        spo2NormalFloor = 93;
        hbAltitudeOffset = 0.5;
    } else if (msnm >= 1000) {
        spo2NormalFloor = 94;
        hbAltitudeOffset = 0.2;
    }
    const label = customLabel || (msnm === 0 ? 'Nivel del mar (0 msnm)' : `${msnm} msnm`);
    return { msnm, label, spo2NormalFloor, hbAltitudeOffset };
}

function calculateSharedCkdEpi2021(scrMgDl, ageYears, isFemale) {
    const scr = Number(scrMgDl);
    const age = Number(ageYears);
    if (!Number.isFinite(scr) || scr <= 0 || !Number.isFinite(age) || age < 18) return null;
    const kappa = isFemale ? 0.7 : 0.9;
    const alpha = isFemale ? -0.241 : -0.302;
    const femMult = isFemale ? 1.012 : 1.0;
    const ratio = scr / kappa;
    const egfr = 142 * Math.pow(Math.min(ratio, 1), alpha) * Math.pow(Math.max(ratio, 1), -1.200) * Math.pow(0.9938, age) * femMult;
    return Number(egfr.toFixed(1));
}

/**
 * Normalizador Universal Retrocompatible de Señales Clínicas (`EGM-57`..`EGM-60`, `EGM-66`..`EGM-67`).
 * Reconcilia llaves de Fases 0 a 18 sin tocar ningún componente de entrevista.
 */
function extractUnifiedAnamnesisSignals(patientData = {}) {
    const isFemale = resolveSharedPatientIsFemale(patientData);
    const history = patientData?.history || {};

    // 1. Fase 5: Patológicos Personales Estructurados + Legacy + Quirúrgicos
    const pathSet = new Map();
    const addPathology = (rawVal) => {
        const clean = cleanHumanLabel(rawVal);
        if (!clean || isNegatedOrEmptyToken(clean)) return;
        const k = normalizeAsciiToken(clean);
        if (!k || k === 'no_diagnosis' || k === 'other') return;
        if (!pathSet.has(k)) pathSet.set(k, clean);
    };

    const structuredApp = Array.isArray(history.personal_structured) ? history.personal_structured : [];
    structuredApp.forEach((item) => {
        if (!item) return;
        if (typeof item === 'string') {
            addPathology(item);
            return;
        }
        const st = String(item.status || 'ACTIVE').toUpperCase();
        if (st === 'RULED_OUT' || st === 'DESCARTADO' || st === 'INACTIVE_FALSE') return;
        const spec = cleanHumanLabel(item.specific_condition || item.name || item.patologia || item.label || '');
        const cat = cleanHumanLabel(item.condition_category || '');
        if (spec && !/^other$/i.test(spec)) addPathology(spec);
        else if (cat && !/^no_diagnosis$/i.test(cat)) addPathology(cat);
    });

    const legacyPaths = [
        ...(Array.isArray(history.pathologies) ? history.pathologies : []),
        ...(Array.isArray(patientData?.antecedentesPersonales) ? patientData.antecedentesPersonales : [])
    ];
    legacyPaths.forEach((p) => {
        if (!p) return;
        addPathology(typeof p === 'object' ? (p.specific_condition || p.name || p.patologia || p.label || '') : p);
    });

    if (typeof history.personal_raw_text === 'string' && !isNegatedOrEmptyToken(history.personal_raw_text)) {
        history.personal_raw_text.split(/[,;|\n]/).forEach(addPathology);
    }

    const unifiedPathologies = Array.from(pathSet.values());
    const pathUpper = unifiedPathologies.map((p) => p.toUpperCase()).join(' | ');

    const surgSet = new Map();
    const rawSurgical = Array.isArray(history.surgical) ? history.surgical : [];
    rawSurgical.forEach((s) => {
        const rawCodeOrName = typeof s === 'object' ? (s.id || s.code || s.label || s.name || s.procedure || '') : String(s || '');
        const trimmed = cleanHumanLabel(rawCodeOrName);
        if (!trimmed || isNegatedOrEmptyToken(trimmed)) return;
        const mapped = SURGICAL_CODE_LABELS[trimmed.toUpperCase()] || trimmed;
        const k = normalizeAsciiToken(mapped);
        if (k && !surgSet.has(k)) surgSet.set(k, mapped);
    });
    const unifiedSurgical = Array.from(surgSet.values());
    const surgicalUpper = `${unifiedSurgical.join(' | ')} | ${rawSurgical.map((s) => (typeof s === 'object' ? (s.id || s.code || '') : s)).join(' | ')}`.toUpperCase();

    const hasBariatricSurgery = /SURG_BYPASS_MANGA|BARI[ÁA]TRIC|BYPASS\s+G[ÁA]STRIC|MANGA\s+G[ÁA]STRIC/.test(`${surgicalUpper} | ${pathUpper}`);
    const hasCholecystectomy = /SURG_COLECISTECTOMIA|COLECISTECTOM|SIN\s+VES[ÍI]CULA/.test(`${surgicalUpper} | ${pathUpper}`);

    // 2. Fase 6: Farmacología y Subclases de Interacción
    const rawMeds = Array.isArray(history.medications) ? history.medications : [];
    const unifiedMedications = rawMeds
        .map((m) => cleanHumanLabel(typeof m === 'object' ? (m.name || m.drug || m.label || '') : m))
        .filter((s) => s && !isNegatedOrEmptyToken(s));
    const medsUpper = unifiedMedications.map((m) => m.toUpperCase()).join(' | ');

    const hasCoumarinAnticoagulant = /(?:WARFARINA|COUMADIN|ACENOCUMAROL|SINTROM|ALDOCUMAR|FENPROCUM[ÓO]N)/.test(medsUpper);
    const hasDoacOrStrongAntiplatelet = /(?:RIVAROXAB[ÁA]N|XARELTO|APIXAB[ÁA]N|ELIQUIS|DABIGATR[ÁA]N|PRADAXA|EDOXAB[ÁA]N|CLOPIDOGREL|PLAVIX|PRASUGREL|TICAGRELOR|BRILINTA|CILOSTAZOL)/.test(medsUpper);
    const hasFastingThyroidOrBisphosphonate = /(?:LEVOTIROXINA|EUTIROX|KARET|TIROXINA|LIOTIRONINA|NOVOTIRAL|ALENDRONATO|FOSAMAX|RISEDRONATO|IBANDRONATO|BONVIVA)/.test(medsUpper);
    const hasCationChelatedDrug = /(?:CIPROFLOXACINO|LEVOFLOXACINO|MOXIFLOXACINO|NORFLOXACINO|OFLOXACINO|DOXICICLINA|MINOCICLINA|TETRACICLINA|SULFATO\s+FERROSO|FUMARATO\s+FERROSO|HIERRO\s+ORAL|HIERRO\s+POLIMALTOSADO)/.test(medsUpper);
    const hasAntihypertensiveMed = /(?:LOSART[ÁA]N|TELMISART[ÁA]N|VALSART[ÁA]N|IRBESART[ÁA]N|CANDESART[ÁA]N|OLMESART[ÁA]N|ENALAPRIL|LISINOPRIL|CAPTOPRIL|RAMIPRIL|PERINDOPRIL|AMLODIPINO|NIFEDIPINO|FELODIPINO|DILTIAZEM|VERAPAMILO|HIDROCLOROTIAZIDA|CLORTALIDONA|INDAPAMIDA|ESPIRONOLACTONA|EPLERENONA|FUROSEMIDA|BUMETANIDA|METOPROLOL|BISOPROLOL|CARVEDILOL|NEBIVOLOL|PROPRANOLOL|ATENOLOL|PRAZOSINA)/.test(medsUpper);
    const hasGlucoseLoweringMed = /(?:METFORMINA|INSULINA|GLARGINA|DETEMIR|DEGLUDEC|LISPRO|ASPART|GLIBENCLAMIDA|GLIMEPIRIDA|GLICLAZIDA|SITAGLIPTINA|LINAGLIPTINA|VILDAGLIPTINA|SAXAGLIPTINA|EMPAGLIFLOZINA|DAPAGLIFLOZINA|CANAGLIFLOZINA|SEMAGLUTIDA|LIRAGLUTIDA|DULAGLUTIDA|TIRZEPATIDA|PIOGLITAZONA|ACARBOSA)/.test(medsUpper);
    const hasLipidLoweringMed = /(?:ATORVASTATINA|ROSUVASTATINA|SIMVASTATINA|PRAVASTATINA|PITAVASTATINA|FLUVASTATINA|EZETIMIBA|BEZAFIBRATO|FENOFIBRATO|GEMFIBROZILO|EVOLOCUMAB|ALIROCUMAB|INCLISIR[ÁA]N)/.test(medsUpper);
    const hasSympathomimeticMed = /(?:FENTERMINA|ACXION|TERFAMEX|METILFENIDATO|CONCERTA|RITALIN|ANFETAMINA|LISDEXANFETAMINA|VYVANSE|MODAFINILO|ARMODAFINILO|EFEDRINA|PSEUDOEFEDRINA|SIBUTRAMINA)/.test(medsUpper);
    const hasMaoInhibitorMed = /(?:FENELZINA|TRANILCIPROMINA|SELEGILINA|RASAGILINA|MOCLOBEMIDA|ISOCARBOXAZIDA|LINEZOLID|\bIMAO\b|INHIBIDOR(?:ES)?\s+DE\s+LA\s+MAO)/.test(medsUpper);

    // 3. Fase 10: Hábitos Tóxicos (Tabaco, Alcohol, Sustancias)
    const habits = patientData?.habits || {};
    const legacyToxic = patientData?.lifestyle?.toxic_habits || patientData?.habits_toxicology || patientData?.habitos?.toxicos || {};
    const smokingObj = habits.smoking && typeof habits.smoking === 'object' ? habits.smoking : {};
    const alcoholObj = habits.alcohol && typeof habits.alcohol === 'object' ? habits.alcohol : {};
    const drugsObj = habits.drugs && typeof habits.drugs === 'object' ? habits.drugs : {};
    const rawSmokingStr = typeof habits.smoking === 'string'
        ? habits.smoking
        : (typeof history.smoking === 'string' ? history.smoking : '');
    const rawAlcoholStr = typeof habits.alcohol === 'string'
        ? habits.alcohol
        : (typeof history.alcohol === 'string' ? history.alcohol : '');

    const isSmoker = Boolean(
        smokingObj.is_smoker === true ||
        legacyToxic.smoking === true ||
        (rawSmokingStr && !isNegatedOrEmptyToken(rawSmokingStr) && /^(?:si|s[íi]|activo|fumador)/i.test(rawSmokingStr))
    );
    const cigCountMatch = String(smokingObj.quantity_text || smokingObj.cigarettes_per_day || rawSmokingStr || '').match(/(\d+)/);
    const cigPerDay = cigCountMatch ? parseInt(cigCountMatch[1], 10) : 0;
    const isHeavySmoker = Boolean(
        isSmoker && (
            cigPerDay >= 15 ||
            String(smokingObj.risk_level || '').toUpperCase() === 'HIGH' ||
            String(smokingObj.risk_level || '').toUpperCase() === 'SEVERE' ||
            /cajetilla\s+y\s+media|[23]\s*cajetillas?|intenso/i.test(String(smokingObj.quantity_text || rawSmokingStr || ''))
        )
    );

    const isDrinker = Boolean(
        alcoholObj.is_drinker === true ||
        legacyToxic.alcohol_frequency === 'FREQUENT' ||
        Number(alcoholObj.frequency_days) > 0 ||
        Number(alcoholObj.calculated_weekly_calories) > 0 ||
        (rawAlcoholStr && !isNegatedOrEmptyToken(rawAlcoholStr) && /frecuente|diario|intenso|social|ocasional|activo/i.test(rawAlcoholStr))
    );
    const alcFreqDays = Number(alcoholObj.frequency_days || 0);
    const alcUnitsSession = Number(alcoholObj.units_per_session || 0);
    const alcWeeklyUnits = alcFreqDays > 0 && alcUnitsSession > 0 ? alcFreqDays * alcUnitsSession : 0;
    const alcWeeklyKcal = Number(alcoholObj.calculated_weekly_calories || 0);
    const isHeavyAlcohol = Boolean(
        isDrinker && (
            alcWeeklyKcal >= 1400 ||
            alcWeeklyUnits > (isFemale ? 7 : 14) ||
            alcUnitsSession >= (isFemale ? 4 : 5) ||
            /intenso|diario|excesiv|severo|alto/i.test(rawAlcoholStr)
        )
    );
    const isFrequentAlcohol = Boolean(
        isDrinker && (
            alcFreqDays >= 3 ||
            legacyToxic.alcohol_frequency === 'FREQUENT' ||
            /frecuente|diario/i.test(rawAlcoholStr)
        )
    );

    const substanceName = cleanHumanLabel(drugsObj.substance_name || drugsObj.substance || legacyToxic.drugs || '');
    const hasDrugUsage = Boolean(
        drugsObj.has_usage === true ||
        (substanceName && !isNegatedOrEmptyToken(substanceName))
    );
    const hasVasoactiveIllicitDrug = Boolean(
        hasDrugUsage && (
            !substanceName ||
            /coca[íi]na|anfetamina|metanfetamina|cristal|[ée]xtasis|mdma|crack|estimulante|cannabis|marihuana|thc/i.test(substanceName)
        )
    );
    const hasToxicologyRecord = Boolean(
        habits.smoking !== undefined ||
        habits.alcohol !== undefined ||
        habits.drugs !== undefined ||
        history.smoking !== undefined ||
        history.alcohol !== undefined ||
        Object.keys(legacyToxic).length > 0
    );

    // 4. Fase 11: Sueño y Estrés (Soporte Numérico 1..10 y Textual)
    const lp = patientData?.lifestyle_profile || {};
    const rawSleep = lp.sleep || habits.sleep || patientData?.lifestyle?.sleep || patientData?.habitos?.sueno || {};
    const sleepHoursRaw = rawSleep.hours_avg ?? rawSleep.hours;
    const sleepHours = sleepHoursRaw !== undefined && sleepHoursRaw !== null && String(sleepHoursRaw) !== '' ? Number(sleepHoursRaw) : null;
    const rawQual = rawSleep.quality ?? rawSleep.quality_score;
    const sleepQualityNum = (rawQual !== undefined && rawQual !== null && String(rawQual).trim() !== '' && !Number.isNaN(Number(rawQual)))
        ? Number(rawQual)
        : null;
    const sleepQualityStr = String(rawQual || '').toUpperCase();
    const hasInsomniaFlag = Boolean(rawSleep.insomnia === true || /INSOMNIO|DESPERTARES\s+FRECUENTES/i.test(String(rawSleep.notes || sleepQualityStr)));
    const hasPoorSleep = Boolean(
        hasInsomniaFlag ||
        (sleepHours !== null && sleepHours > 0 && sleepHours < 6.0) ||
        (sleepQualityNum !== null && sleepQualityNum <= 4) ||
        /POOR|MALA|DEFICIENTE|PESIMA|P[ÉE]SIMA|IRREGULAR/.test(sleepQualityStr)
    );
    const hasSleepRecord = Boolean(sleepHours !== null || sleepQualityNum !== null || sleepQualityStr);
    const hasOptimalSleep = Boolean(
        hasSleepRecord &&
        !hasPoorSleep &&
        (sleepHours === null || sleepHours >= 6.5) &&
        (sleepQualityNum === null || sleepQualityNum >= 7)
    );

    const rawStressObj = lp.stress || patientData?.lifestyle?.stress || patientData?.habitos?.estres || {};
    const rawStressLevelCandidate = lp.stress_level ?? rawStressObj.score ?? rawStressObj.level_score ?? rawStressObj.level ?? habits.stress;
    const stressScoreNum = (rawStressLevelCandidate !== undefined && rawStressLevelCandidate !== null && String(rawStressLevelCandidate).trim() !== '' && !Number.isNaN(Number(rawStressLevelCandidate)))
        ? Number(rawStressLevelCandidate)
        : null;
    const stressStr = String(rawStressObj.level || habits.stress || rawStressLevelCandidate || '').toUpperCase();
    const hasHighStress = Boolean(
        (stressScoreNum !== null && stressScoreNum >= 8) ||
        /HIGH|ALTO|SEVER|CR[ÍI]TIC|MUY\s+ALTO/.test(stressStr)
    );
    const hasModerateStress = Boolean(
        !hasHighStress && (
            (stressScoreNum !== null && stressScoreNum >= 5 && stressScoreNum <= 7) ||
            /MODERAD|MEDIO|MEDIUM/.test(stressStr)
        )
    );
    const hasStressRecord = Boolean(stressScoreNum !== null || stressStr);
    const hasLowStress = Boolean(
        hasStressRecord &&
        !hasHighStress &&
        !hasModerateStress &&
        ((stressScoreNum !== null && stressScoreNum <= 4) || /LOW|BAJO|LEVE|OPTIMO|ÓPTIMO|TRANQUIL/.test(stressStr))
    );

    // 5. Fase 8: Salud Digestiva, FODMAPs y Disfagia
    const digProfile = patientData?.digestive_profile || {};
    const unifiedDigestiveSymptoms = Array.from(new Set([
        ...(Array.isArray(digProfile.symptoms) ? digProfile.symptoms : []),
        ...(Array.isArray(history.digestive_symptoms) ? history.digestive_symptoms : [])
    ].map(cleanHumanLabel).filter((s) => s && !isNegatedOrEmptyToken(s))));
    const digJoin = `${unifiedDigestiveSymptoms.join(' | ')} | ${digProfile.phenotype || ''} | ${history.digestive_frequency || ''}`;
    const hasDigestiveIssues = Boolean(digProfile.has_issues === true || history.has_digestive_issues === true || unifiedDigestiveSymptoms.length > 0);
    const hasSiiDiarrheaOrFodmap = /diarrea|evacuaciones?\s+l[íi]quidas?|bristol\s*[67]|fodmap|colitis\s+nerviosa|sii[-\s]*d|meteorismo\s+severo|distensi[óo]n\s+severa/i.test(digJoin);

    // 6. Fase 9: Estado Fisiológico y Salud Reproductiva Femenina (+ alias special_context / gyneco)
    const physio = patientData?.physio || {};
    const clinicalContext = patientData?.clinical_context || {};
    const specialCtx = history.special_context || patientData?.special_context || {};
    const gyneco = history.gyneco || physio.gyneco || {};
    const isPregnant = Boolean(
        physio.is_pregnant === true ||
        clinicalContext.isPregnant === true ||
        specialCtx.is_pregnant === true ||
        specialCtx.isPregnant === true
    );
    const isLactating = Boolean(
        physio.is_lactating === true ||
        clinicalContext.isLactating === true ||
        specialCtx.is_lactating === true ||
        specialCtx.isLactating === true
    );
    const pregWeeksRaw = parseInt(
        physio.preg_weeks ?? physio.gestation_weeks ?? clinicalContext.preg_weeks ?? specialCtx.gestational_weeks ?? specialCtx.preg_weeks ?? 0,
        10
    );
    const pregWeeks = Number.isFinite(pregWeeksRaw) && pregWeeksRaw > 0 ? pregWeeksRaw : null;
    const amenorrheaMonths = Number(gyneco.amenorrhea_months || physio.amenorrhea_months || 0);
    const menstrualStatus = cleanHumanLabel(
        physio.menstrual_status ||
        gyneco.notes ||
        (amenorrheaMonths >= 3 ? `Amenorrea secundaria (${amenorrheaMonths} meses)` : '') ||
        ''
    );
    const hasAmenorrhea = Boolean(
        isFemale && !isPregnant && !isLactating && (
            amenorrheaMonths >= 3 ||
            /amenorrea|sin\s+ciclo|ausencia\s+de\s+(?:regla|menstruaci[óo]n)/i.test(menstrualStatus)
        )
    );
    const hasIrregularCycle = Boolean(isFemale && /irregular|oligomenorrea|polimenorrea/i.test(menstrualStatus));
    const hasMenopause = Boolean(isFemale && /menopausia|climaterio|postmenopausia/i.test(`${menstrualStatus} | ${pathUpper}`));

    // 7. Fase 7, 12, 13, 14: Alergias, Preferencias, Disfagia, Turno Nocturno y Ventana R24h
    const rawAllergyCandidates = [
        ...(Array.isArray(history?.allergies?.food) ? history.allergies.food : []),
        ...(Array.isArray(history?.allergies_structured) ? history.allergies_structured : []),
        ...(Array.isArray(patientData?.allergies) ? patientData.allergies : [])
    ];
    const allergyItems = Array.from(new Set(
        rawAllergyCandidates
            .map((a) => cleanHumanLabel(typeof a === 'object' ? (a.agent || a.name || a.label || '') : a))
            .filter((s) => s && !isNegatedOrEmptyToken(s))
    ));

    const prefDietRaw = String(
        patientData?.nutrition?.preferences?.diet_type ||
        patientData?.dietary_preferences?.diet_type ||
        patientData?.preferencias_alimentarias?.tipo_dieta ||
        patientData?.evaluacionDietetica?.patron_alimentario ||
        history.diet_pattern ||
        patientData?.diet_pattern ||
        ''
    ).toUpperCase();
    const isVegan = /VEGAN|BASADA\s+EN\s+PLANTAS\s+ESTRICTA|100%\s*VEGETAL/.test(prefDietRaw);
    const isVegetarian = !isVegan && /VEGETARIAN|OVOLACTO/.test(prefDietRaw);
    const isKeto = /KETO|CETOG[ÉE]NIC/.test(prefDietRaw);

    const logProf = patientData?.logistics_profile || patientData?.logistics || {};
    const envProf = logProf.environment || {};
    const allContextBlob = [
        pathUpper,
        surgicalUpper,
        medsUpper,
        digJoin,
        prefDietRaw,
        clinicalContext.primary_motive,
        clinicalContext.specific_ailment,
        clinicalContext.patient_quote,
        patientData?.motivo,
        patientData?.motivo_consulta,
        patientData?.reason_for_consultation,
        patientData?.identificacion?.ocupacion,
        patientData?.profile?.occupation,
        logProf.shift_schedule,
        logProf.work_schedule,
        JSON.stringify(history.special_context || ''),
        JSON.stringify(patientData?.special_context || ''),
        JSON.stringify(rawSleep.schedule || rawSleep.notes || '')
    ].filter(Boolean).join(' | ');
    const allContextUpper = allContextBlob.toUpperCase();

    const hasDysphagia = /DISFAGIA|DIFICULTAD\s+PARA\s+(?:TRAGAR|DEGLUTIR)|TRASTORNO\s+DE\s+DEGLUCI[ÓO]N|BRONCOASPIRACI[ÓO]N|TEXTURA\s+PAPILLA|IDDSI/.test(allContextUpper);
    const hasCeliacOrGlutenFree = /CEL[ÍI]AC|CELIAQU[ÍI]A|SIN\s+GLUTEN|GLUTEN\s*FREE|INTOLERANCIA\s+AL\s+GLUTEN/.test(
        `${allContextUpper} | ${JSON.stringify(history.intolerances || '')} | ${JSON.stringify(digProfile.intolerances || '')}`
    );

    const hasSevereRenalHistory = /(?:INSUFICIENCIA\s+RENAL|DI[ÁA]LISIS|HEMODI[ÁA]LISIS|\bERC\s*(?:G[345]|ESTADIO\s*G?\s*[345])|ENFERMEDAD\s+RENAL\s+CR[ÓO]NICA\s+(?:AVANZADA|G[345]|ESTADIO\s*G?\s*[345]))/.test(allContextUpper);
    const isDialysisActive = /(?:HEMODI[ÁA]LISIS|DI[ÁA]LISIS\s+PERITONEAL|\bEN\s+DI[ÁA]LISIS\b)/.test(allContextUpper);
    const hasOxalateOrRenalStoneHistory = /(?:LITIASIS\s+RENAL|C[ÁA]LCULOS?\s+RENAL(?:ES)?|NEFROLITIASIS|OXALATO|PIEDRAS?\s+EN\s+(?:EL\s+)?RI[ÑN][ÓO]N|GASTRITIS\s+EROSIVA|[ÚU]LCERA\s+P[ÉE]PTICA)/.test(allContextUpper);
    const hasMedicalFluidRestriction = /(?:INSUFICIENCIA\s+CARD[ÍI]ACA|\bICC\b|\bERC\s*(?:G[45]|ESTADIO\s*G?\s*[45])|ENFERMEDAD\s+RENAL\s+(?:CR[ÓO]NICA\s+)?(?:TERMINAL|ESTADIO\s*G?\s*[45]|G[45])|HEMODI[ÁA]LISIS|DI[ÁA]LISIS\s+PERITONEAL|CIRROSIS.*ASCITIS|\bASCITIS\b|S[ÍI]NDROME\s+NEFR[ÓO]TICO|EDEMA\s+PULMONAR|RESTRICCI[ÓO]N\s+(?:H[ÍI]DRICA|DE\s+L[ÍI]QUIDOS))/.test(allContextUpper);

    const painZones = Array.isArray(clinicalContext.pain_zones)
        ? clinicalContext.pain_zones
        : (Array.isArray(clinicalContext.pain_map) ? clinicalContext.pain_map : []);
    const painZonesUpper = JSON.stringify(painZones).toUpperCase();
    const hasLowerLimbOrSpinePainMap = /RODILLA|KNEE|CADERA|HIP|TOBILLO|ANKLE|PIE|FOOT|LUMBAR|COLUMNA|SPINE|CI[ÁA]TICA/.test(painZonesUpper);
    const hasNonImpactDischargeNeed = Boolean(
        hasLowerLimbOrSpinePainMap ||
        /(?:GONARTROSIS|COXARTROSIS|ARTROSIS\s+SEVERA|PIE\s+DIAB[ÉE]TICO|NEUROPAT[ÍI]A\s+(?:PERIF[ÉE]RICA|DIAB[ÉE]TICA)|[ÚU]LCERA\s+PLANTAR|V[ÉE]RTIGO|LABERINTITIS|RIESGO\s+DE\s+CA[ÍI]DA|SILLA\s+DE\s+RUEDAS|BAST[ÓO]N|ANDADERA|GOAL_DISABILITY|EPOC.*OX[ÍI]GENO|OX[ÍI]GENO\s+SUPLEMENTARIO)/.test(allContextUpper)
    );

    const isNightOrRotatingShift = /(?:TURNO\s+NOCTURNO|GUARDIA\s+NOCTURNA|VELADOR|TERCER\s+TURNO|HORARIO\s+NOCTURNO|TRABAJO\s+NOCTURNO|ROTATIVO\s+NOCTURNO|22:00\s*(?:A|-)\s*06:00|23:00\s*(?:A|-)\s*07:00|DUERME\s+DE\s+D[ÍI]A)/.test(allContextUpper);

    // Fase 12: Filtros logísticos de refrigeración, recalentamiento y compra externa
    const recipeFilters = logProf.recipe_filters || {};
    const noRefrigeration = recipeFilters.requires_refrigeration === false || logProf.has_refrigeration === false || envProf.no_refrigeration === true || /NONE|NO_FRIDGE|SIN_REFRIGERACION/i.test(String(logProf.infrastructure || ''));
    const noReheating = recipeFilters.requires_reheating === false || logProf.has_microwave === false || envProf.no_reheating === true || /NONE|NO_MICROWAVE|SIN_MICROONDAS|SIN_RECALENTAR/i.test(String(logProf.infrastructure || ''));
    const buyingTypeUpper = String(logProf.buying_type || '').toUpperCase();

    // Fase 14: Derivación horaria automática desde R24h
    const r24List = Array.isArray(patientData?.evaluacionDietetica?.r24h)
        ? patientData.evaluacionDietetica.r24h
        : (Array.isArray(patientData?.r24h) ? patientData.r24h : []);
    const parsedMealMinutes = r24List
        .map((m) => parseMealClockMinutes(m?.hora || m?.time || ''))
        .filter((v) => v !== null)
        .sort((a, b) => a - b);
    let derivedLastMealDisplay = null;
    let hasLateDinnerR24h = false;
    let derivedOvernightFastingHours = null;
    if (parsedMealMinutes.length > 0 && !isNightOrRotatingShift) {
        const firstMin = parsedMealMinutes[0];
        const lastMin = parsedMealMinutes[parsedMealMinutes.length - 1];
        const lH = Math.floor(lastMin / 60);
        const lM = String(lastMin % 60).padStart(2, '0');
        derivedLastMealDisplay = `${String(lH).padStart(2, '0')}:${lM} h`;
        hasLateDinnerR24h = lastMin >= (21 * 60 + 30);
        if (parsedMealMinutes.length >= 2 && lastMin > firstMin) {
            const eatingWindowHrs = (lastMin - firstMin) / 60;
            derivedOvernightFastingHours = Number((24 - eatingWindowHrs).toFixed(1));
        }
    }

    const ffq = patientData?.evaluacionDietetica?.ffq || patientData?.nutrition?.ffq || patientData?.frecuenciaConsumo || {};
    const ffqWaterGlasses = ffq.agua !== undefined && ffq.agua !== null && String(ffq.agua) !== '' ? Number(ffq.agua) : null;

    return {
        isFemale,
        unifiedPathologies,
        pathUpper,
        unifiedSurgical,
        surgicalUpper,
        hasBariatricSurgery,
        hasCholecystectomy,
        unifiedMedications,
        medsUpper,
        hasCoumarinAnticoagulant,
        hasDoacOrStrongAntiplatelet,
        hasFastingThyroidOrBisphosphonate,
        hasCationChelatedDrug,
        hasAntihypertensiveMed,
        hasGlucoseLoweringMed,
        hasLipidLoweringMed,
        hasSympathomimeticMed,
        hasMaoInhibitorMed,
        isSmoker,
        isHeavySmoker,
        cigPerDay,
        isDrinker,
        isHeavyAlcohol,
        isFrequentAlcohol,
        alcWeeklyKcal,
        alcWeeklyUnits,
        hasDrugUsage,
        substanceName,
        hasVasoactiveIllicitDrug,
        hasToxicologyRecord,
        sleepHours,
        sleepQualityNum,
        hasInsomniaFlag,
        hasPoorSleep,
        hasOptimalSleep,
        hasSleepRecord,
        stressScoreNum,
        hasHighStress,
        hasModerateStress,
        hasLowStress,
        hasStressRecord,
        unifiedDigestiveSymptoms,
        hasDigestiveIssues,
        hasSiiDiarrheaOrFodmap,
        isPregnant,
        isLactating,
        pregWeeks,
        menstrualStatus,
        hasAmenorrhea,
        hasIrregularCycle,
        hasMenopause,
        allergyItems,
        prefDietRaw,
        isVegan,
        isVegetarian,
        isKeto,
        hasDysphagia,
        hasCeliacOrGlutenFree,
        hasSevereRenalHistory,
        isDialysisActive,
        hasOxalateOrRenalStoneHistory,
        hasMedicalFluidRestriction,
        hasLowerLimbOrSpinePainMap,
        hasNonImpactDischargeNeed,
        isNightOrRotatingShift,
        noRefrigeration,
        noReheating,
        buyingTypeUpper,
        derivedLastMealDisplay,
        hasLateDinnerR24h,
        derivedOvernightFastingHours,
        ffqWaterGlasses
    };
}

/**
 * Generador Dinámico de Ejemplos Alimentarios 100% Libre de Alérgenos, Vegano, Celíaco y Seguro en Disfagia (`EGM-60` / `EGM-67`).
 */
function buildSafeDietaryExamplesSSoT({
    combinedExclusions = [],
    anamnesis = null
} = {}) {
    const mergedExcl = [
        ...(Array.isArray(combinedExclusions) ? combinedExclusions : []),
        ...(Array.isArray(anamnesis?.allergyItems) ? anamnesis.allergyItems : [])
    ];
    const exclBlob = mergedExcl
        .map((x) => normalizeAsciiToken(x))
        .join('_');

    const isExcluded = (regex) => regex.test(exclBlob);
    const isVegan = Boolean(anamnesis?.isVegan);
    const isVegetarian = Boolean(anamnesis?.isVegetarian);
    const hasDysphagia = Boolean(anamnesis?.hasDysphagia);
    const hasSiiFodmap = Boolean(anamnesis?.hasSiiDiarrheaOrFodmap);

    if (hasDysphagia) {
        const softFats = [];
        if (!isExcluded(/aguacate/)) softFats.push('puré cremoso de aguacate');
        if (!isExcluded(/oliva/)) softFats.push('aceite de oliva extra virgen en crudo');
        const softProteins = [];
        if (!isVegan && !isVegetarian) {
            if (!isExcluded(/pollo|ave|pavo/)) softProteins.push('pollo tierno finamente molido o en crema suave');
            if (!isExcluded(/pescado|marisco|atun|salmon|mojarra/)) softProteins.push('pescado blanco desmenuzado sin espinas');
        }
        if (!isVegan && !isExcluded(/huevo/)) softProteins.push('huevo suave cocido');
        if (softProteins.length === 0) softProteins.push('crema homogénea de proteína vegetal o tofu sedoso');
        return {
            veggiePhrase: 'cremas espesas de verduras cocidas de textura homogénea (seguras para la deglución bajo estándar IDDSI, cero granos sueltos ni trozos duros)',
            fatsPhrase: softFats.length > 0 ? `grasas nobles suaves (${softFats.join(' y ')})` : 'grasas suaves de fácil deglución',
            proteinPhrase: `proteínas tiernas de fácil paso como ${softProteins.slice(0, 3).join(', ')}`
        };
    }

    const fatCandidates = [];
    if (!isExcluded(/aguacate/)) fatCandidates.push('aguacate');
    if (!isExcluded(/oliva/)) fatCandidates.push('aceite de oliva extra virgen');
    if (!isExcluded(/semilla|chia|linaza|ajonjoli|girasol|calabaza/) && !hasSiiFodmap) {
        fatCandidates.push('semillas hidratadas');
    } else if (!isExcluded(/nuez|nueces|almendra|pistache|cacahuate|frutos?_secos?/) && !hasSiiFodmap) {
        fatCandidates.push('almendras o nueces naturales');
    }

    const proteinCandidates = [];
    if (isVegan) {
        if (!isExcluded(/soya|tofu|tempeh/)) proteinCandidates.push('tofu firme o tempeh');
        if (!isExcluded(/leguminosa|frijol|lenteja|garbanzo|haba/) && !hasSiiFodmap) {
            proteinCandidates.push('lentejas o leguminosas bien cocidas combinadas con cereal integral');
        }
        if (!isExcluded(/quinoa|amaranto/)) proteinCandidates.push('quinoa y amaranto');
        if (proteinCandidates.length === 0) proteinCandidates.push('proteína vegetal limpia hipoalergénica');
    } else if (isVegetarian) {
        if (!isExcluded(/huevo/)) proteinCandidates.push('huevo orgánico');
        if (!isExcluded(/lacteo|leche|queso|yogur|caseina/)) proteinCandidates.push('requesón o yogur natural sin azúcar');
        if (!isExcluded(/leguminosa|lenteja|frijol|garbanzo/) && !hasSiiFodmap) proteinCandidates.push('lentejas cocidas');
        if (!isExcluded(/soya|tofu/)) proteinCandidates.push('tofu');
        if (proteinCandidates.length === 0) proteinCandidates.push('quinoa, amaranto y proteína vegetal limpia');
    } else {
        if (!isExcluded(/pescado|marisco|atun|salmon|mojarra|camaron/)) proteinCandidates.push('pescado blanco o azul');
        if (!isExcluded(/pollo|ave|pavo/)) proteinCandidates.push('pechuga de pollo o pavo');
        if (!isExcluded(/huevo/)) proteinCandidates.push('huevo');
        if (proteinCandidates.length < 2 && !isExcluded(/res|carne/)) proteinCandidates.push('cortes magros suaves');
        if (proteinCandidates.length === 0) proteinCandidates.push('tofu, quinoa o proteína hipoalergénica segura');
    }

    const veggiePhrase = hasSiiFodmap
        ? 'verduras cocidas suaves bajas en fermentación (calabacita, zanahoria, chayote y espinaca cocida)'
        : 'verduras frescas y al vapor';
    const fatsPhrase = fatCandidates.length > 0
        ? `grasas nobles (${fatCandidates.join(', ')})`
        : 'grasas antiinflamatorias seguras para su perfil';
    const joinListEs = (arr) => {
        if (arr.length <= 1) return arr[0] || '';
        return `${arr.slice(0, -1).join(', ')} o ${arr[arr.length - 1]}`;
    };
    const proteinPhrase = isVegan
        ? `proteínas 100 % vegetales completas como ${joinListEs(proteinCandidates.slice(0, 3))}`
        : `proteínas limpias como ${joinListEs(proteinCandidates.slice(0, 3))}`;

    return { veggiePhrase, fatsPhrase, proteinPhrase };
}

function extractLabSnapshotFromRawPatientData(rawPatientData = {}, ageYears = 35, isFemale = false) {
    const labs = {};
    const ext = rawPatientData?.scan_data?.external_metrics || {};
    const sections = ext.sections || {};
    const sectionEntries = Array.isArray(sections)
        ? sections.map((s, i) => [`sec_${i}`, s])
        : Object.entries(sections);
    const flatLabs = ext.biomarkers || ext.labs || rawPatientData?.lab_results || rawPatientData?.ocr_labs || {};

    const assignMetric = (rawName, rawVal, rawUnit = '', itemObj = null) => {
        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') return;
        const rawNum = parseFloat(String(rawVal).replace(',', '.').replace(/[^0-9.-]/g, ''));
        if (!Number.isFinite(rawNum)) return;
        const normKey = normalizeAsciiToken(rawName);
        const unit = String(rawUnit || itemObj?.unit || '').toLowerCase().trim();
        let num = rawNum;

        if ((normKey.includes('glucosa') || normKey.includes('glucose')) && unit.includes('mmol')) {
            num = Number((rawNum * 18.0156).toFixed(1));
        } else if ((normKey.includes('colesterol') || normKey.includes('ldl') || normKey.includes('hdl')) && unit.includes('mmol')) {
            num = Number((rawNum * 38.67).toFixed(1));
        } else if (normKey.includes('triglic') && unit.includes('mmol')) {
            num = Number((rawNum * 88.57).toFixed(1));
        } else if (normKey.includes('creatinina') && (unit.includes('umol') || unit.includes('µmol'))) {
            num = Number((rawNum / 88.4).toFixed(2));
        } else if ((normKey.includes('urico') || normKey.includes('uric')) && (unit.includes('umol') || unit.includes('µmol'))) {
            num = Number((rawNum / 59.48).toFixed(2));
        } else if (normKey.includes('bilirrubina') && (unit.includes('umol') || unit.includes('µmol'))) {
            num = Number((rawNum / 17.1).toFixed(2));
        }

        if (normKey.includes('triglic')) labs.triglycerides = num;
        else if (normKey.includes('no_hdl')) labs.nonHdl = num;
        else if (normKey.includes('sd_ldl') || normKey.includes('sdldl')) labs.sdLdl = num;
        else if (normKey.includes('hdl') && !normKey.includes('no_hdl') && !normKey.includes('relacion')) labs.hdl = num;
        else if (normKey.includes('ldl') && !normKey.includes('vldl') && !normKey.includes('relacion')) labs.ldl = num;
        else if (normKey.includes('colesterol') && !normKey.includes('ldl') && !normKey.includes('hdl') && !normKey.includes('vldl')) labs.totalCholesterol = num;
        else if ((normKey.includes('glucosa') || normKey.includes('glucose')) && !normKey.includes('orina')) labs.glucose = num;
        else if (normKey.includes('insulina') || normKey.includes('insulin')) labs.insulin = num;
        else if (normKey.includes('hba1c') || normKey.includes('glicosilada') || normKey.includes('hemoglobina_a1c')) labs.hba1c = num;
        else if (normKey.includes('creatinina') && !normKey.includes('relacion') && !normKey.includes('depuracion')) labs.creatinine = num;
        else if (normKey.includes('filtrado') || normKey.includes('tfg') || normKey.includes('egfr')) labs.gfr = num;
        else if (normKey.includes('urico') || normKey.includes('uric')) labs.uricAcid = num;
        else if ((normKey.includes('alt') || normKey.includes('tgp')) && !normKey.includes('relacion')) labs.alt = num;
        else if ((normKey.includes('ast') || normKey.includes('tgo')) && !normKey.includes('relacion')) labs.ast = num;
        else if (normKey.includes('ggt') || normKey.includes('glutamil')) labs.ggt = num;
        else if (normKey.includes('bilirrubina_total') || (normKey.includes('bilirrubina') && !normKey.includes('directa') && !normKey.includes('indirecta'))) labs.bilirubin = num;
        else if (normKey.includes('albumina') && !normKey.includes('microalbumin') && !normKey.includes('relacion') && !normKey.includes('orina')) labs.albumin = num;
        else if (normKey.includes('rdw_cv') || (normKey.includes('distribucion_eritrocitaria') && !normKey.includes('rdw_sd') && (unit === '%' || rawNum < 30))) labs.rdw = rawNum;
        else if (normKey.includes('pcr') || normKey.includes('proteina_c_reactiva')) {
            if (itemObj?.value_mg_l !== undefined) labs.hscrpMgL = Number(itemObj.value_mg_l);
            else if (unit === 'mg/dl') labs.hscrpMgL = Number((rawNum * 10).toFixed(2));
            else labs.hscrpMgL = num;
        }
        else if (normKey.includes('hemoglobina') && !normKey.includes('corp') && !normKey.includes('a1c')) labs.hemoglobin = num;
        else if (normKey.includes('ferritina')) labs.ferritin = num;
        else if (normKey.includes('tsh')) labs.tsh = num;
        else if (normKey.includes('potasio') || normKey === 'k') labs.potassium = num;
        else if (normKey === 'sodio' || normKey.startsWith('sodio_')) labs.sodium = num;
    };

    sectionEntries.forEach(([, secObj]) => {
        const items = Array.isArray(secObj?.items) ? secObj.items : (Array.isArray(secObj) ? secObj : []);
        items.forEach((it) => assignMetric(it?.name || it?.label || it?.parameter || '', it?.val ?? it?.value, it?.unit || '', it));
    });
    if (flatLabs && typeof flatLabs === 'object') {
        Object.entries(flatLabs).forEach(([k, v]) => {
            if (v === null || v === undefined) return;
            const nm = typeof v === 'object' ? (v.name || v.label || k) : k;
            const val = typeof v === 'object' ? (v.value ?? v.val) : v;
            const un = typeof v === 'object' ? (v.unit || '') : '';
            assignMetric(nm, val, un, typeof v === 'object' ? v : null);
        });
    }

    if (labs.glucose > 0 && labs.insulin > 0 && !labs.homaIr) {
        labs.homaIr = Number(((labs.glucose * labs.insulin) / 405).toFixed(2));
    }
    if (labs.totalCholesterol > 0 && labs.hdl > 0 && !labs.nonHdl) {
        labs.nonHdl = Number((labs.totalCholesterol - labs.hdl).toFixed(1));
    }
    if (labs.creatinine > 0 && !(labs.gfr > 0)) {
        const egfr = calculateSharedCkdEpi2021(labs.creatinine, ageYears, isFemale);
        if (egfr !== null) labs.gfr = egfr;
    }
    return labs;
}

function extractCabinetSnapshotFromRawPatientData(rawPatientData = {}) {
    const ext = rawPatientData?.scan_data?.external_metrics || {};
    const studies = ext?.external_studies?.clinical_imaging_and_cabinet || ext?.imaging?.studies || [];
    const cab = {
        hasCabinetStudies: false,
        hasCardiacConductionOrBradycardia: false,
        hasRbbbOrConductionBlock: false,
        hasSinusBradycardiaFlag: false,
        hasActiveTachyarrhythmia: false,
        ecgHrBpm: null
    };
    if (!Array.isArray(studies) || studies.length === 0) return cab;
    cab.hasCabinetStudies = true;
    studies.forEach((st) => {
        if (!st || typeof st !== 'object') return;
        const flags = Array.isArray(st.clinical_flags) ? st.clinical_flags : [];
        const m = st.metrics || {};
        if (st.domain === 'ECG_CARDIOLOGY' || st.modality === 'ECG') {
            if (m.hr_bpm) cab.ecgHrBpm = Number(m.hr_bpm);
            const imp = String(st.impression || '');
            if (flags.includes('ECG_RBBB_CONDUCTION') || (m.qrs_ms && Number(m.qrs_ms) >= 120) || /bloqueo\s+de\s+(?:la\s+)?rama|hemibloqueo|bloqueo\s+av/i.test(imp)) {
                cab.hasRbbbOrConductionBlock = true;
                cab.hasCardiacConductionOrBradycardia = true;
            }
            if (flags.includes('ECG_SINUS_BRADYCARDIA') || (m.hr_bpm && Number(m.hr_bpm) < 60)) {
                cab.hasSinusBradycardiaFlag = true;
                cab.hasCardiacConductionOrBradycardia = true;
            }
            if (flags.includes('ECG_TACHYARRHYTHMIA') || (m.hr_bpm && Number(m.hr_bpm) >= 110) || /taquiarritmia|fibrilaci[óo]n\s+auricular|flutter/i.test(imp)) {
                cab.hasActiveTachyarrhythmia = true;
            }
        }
    });
    return cab;
}

/**
 * Motor Universal Multivariable de Edad Metabólica de 6 Dominios (`v3.4.0-EGM51-V3` — SSoTT 1:1 Servidor y Cliente).
 */
function calculateUniversalMetabolicAgeSSoT(rawPatientData = {}, opts = {}) {
    const verifiedAge = opts.verifiedAge || resolveSharedVerifiedAge(rawPatientData, 35);
    const chronoAge = Number(verifiedAge.ageYears) || 35;
    const isFemale = opts.isFemale !== undefined ? Boolean(opts.isFemale) : resolveSharedPatientIsFemale(rawPatientData);
    const isLactante = Boolean(chronoAge < 2 && (verifiedAge.isLactanteVerified || rawPatientData?.isLactante === true));
    const isPediatric = Boolean(chronoAge < 18 && (isLactante || verifiedAge.isPediatricVerified || rawPatientData?.isPediatrico === true));

    try {
        const anamnesis = opts.anamnesis || extractUnifiedAnamnesisSignals(rawPatientData);
        const altitudeInfo = opts.altitudeInfo || opts.serum?.altitudeInfo || resolveSharedAltitudeMsnm(rawPatientData);

        // Enrutamiento y Compuertas de Seguridad (Priorizando TCA y Embarazo sobre Pediatría genérica en adolescentes)
        const rawTokens = [
            rawPatientData?.clinical_context?.primary_route,
            rawPatientData?.clinical_context?.goal,
            ...(Array.isArray(rawPatientData?.clinical_context?.routes) ? rawPatientData.clinical_context.routes : []),
            ...(Array.isArray(rawPatientData?.activeRoutes) ? rawPatientData.activeRoutes : [rawPatientData?.activeRoutes]),
            rawPatientData?.history?.primaryRoute,
            rawPatientData?.route,
            rawPatientData?.profile?.goal,
            rawPatientData?.motivo_consulta,
            rawPatientData?.motivo,
            rawPatientData?.reason_for_consultation,
            rawPatientData?.clinical_context?.patient_quote,
            rawPatientData?.clinical_context?.specific_ailment,
            anamnesis.pathUpper,
            JSON.stringify(rawPatientData?.history?.special_context || '')
        ].filter(Boolean).map((x) => String(x).toUpperCase()).join(' | ');

        const routes = new Set();
        if (isPediatric || /GOAL_PEDIATRICS|PEDIATR|CRECIMIENTO\s+Y\s+DESARROLLO/.test(rawTokens)) routes.add('GOAL_PEDIATRICS');
        if (anamnesis.isPregnant || anamnesis.isLactating || /GOAL_PREGNANCY|EMBARAZ|GESTACI[ÓO]N|LACTANCIA\s+MATERNA|PUERPERIO/.test(rawTokens)) routes.add('GOAL_PREGNANCY');
        if (/GOAL_MENTAL_HEALTH|\bTCA\b|ANOREXIA|BULIMIA|ATRAC[ÓO]N|ORTOREXIA|VIGOREXIA|DISMORFIA|CONDUCTA\s+ALIMENTARIA|SEGURIDAD\s+CONDUCTUAL/.test(rawTokens)) routes.add('GOAL_MENTAL_HEALTH');
        if (/GOAL_PALLIATIVE|CUIDADOS?\s+PALIATIV|SOPORTE\s+PALIATIV|TERMINAL/.test(rawTokens)) routes.add('GOAL_PALLIATIVE');
        if (/GOAL_MUSCLE|GANAR\s+M[ÚU]SCULO|HIPERTROFIA|ATLETA|ALTO\s+RENDIMIENTO|DEPORTE\s+DE\s+FUERZA|FISICOCULTUR|HALTEROFILIA|CROSSFIT/.test(rawTokens)) routes.add('GOAL_MUSCLE');
        if (routes.size === 0) routes.add('GOAL_CLINICAL');

        let safetyGateReasonCode = null;
        if (routes.has('GOAL_MENTAL_HEALTH') && !isLactante) safetyGateReasonCode = 'TCA_BEHAVIORAL_SAFETY';
        else if (routes.has('GOAL_PREGNANCY')) safetyGateReasonCode = 'PREGNANCY_LACTATION_PROTECTION';
        else if (routes.has('GOAL_PALLIATIVE')) safetyGateReasonCode = 'PALLIATIVE_COMFORT_CARE';
        else if (routes.has('GOAL_PEDIATRICS')) safetyGateReasonCode = 'PEDIATRICS_GROWTH_PERCENTILES';

        const serumLabs = opts.serum?.labValues || null;
        const extractedLabs = extractLabSnapshotFromRawPatientData(rawPatientData, chronoAge, isFemale);
        const labs = serumLabs ? { ...extractedLabs, ...serumLabs } : extractedLabs;

        const cabRaw = extractCabinetSnapshotFromRawPatientData(rawPatientData);
        const serumCab = opts.serum?.cabinetSignals || {};
        const cab = {
            ...cabRaw,
            hasCabinetStudies: Boolean(serumCab.hasCabinetStudies || cabRaw.hasCabinetStudies),
            hasCardiacConductionOrBradycardia: Boolean(serumCab.hasCardiacConductionOrBradycardia || cabRaw.hasCardiacConductionOrBradycardia),
            hasRbbbOrConductionBlock: Boolean(serumCab.hasRbbbBlock || serumCab.hasRbbbOrConductionBlock || cabRaw.hasRbbbOrConductionBlock),
            hasSinusBradycardiaFlag: Boolean(cabRaw.hasSinusBradycardiaFlag || (Number(serumCab.ecgHrBpm || cabRaw.ecgHrBpm) > 0 && Number(serumCab.ecgHrBpm || cabRaw.ecgHrBpm) < 60)),
            hasActiveTachyarrhythmia: Boolean(serumCab.hasActiveTachyarrhythmia || cabRaw.hasActiveTachyarrhythmia),
            ecgHrBpm: serumCab.ecgHrBpm ?? cabRaw.ecgHrBpm ?? null
        };

        // EGM-65: Certeza Bioquímica 95% exige analitos sanguíneos reales (jamás una Rx aislada sin sangre)
        const realVenousAnalyteCount = [
            labs.glucose, labs.hba1c, labs.insulin, labs.totalCholesterol, labs.ldl, labs.hdl,
            labs.triglycerides, labs.creatinine, labs.gfr, labs.uricAcid, labs.alt, labs.ast,
            labs.ggt, labs.bilirubin, labs.albumin, labs.hemoglobin, labs.rdw, labs.hscrpMgL,
            labs.tsh, labs.ferritin
        ].filter((v) => Number(v) > 0).length;
        const hasRealVenousLabs = Boolean(realVenousAnalyteCount > 0 || opts.serum?.hasLabResultsLoaded === true);

        const rawElectretObj = rawPatientData?.scan_data?.electret_metrics || rawPatientData?.electretTelemetry?.categories || null;
        const hasElectretEvidence = Boolean(rawElectretObj && typeof rawElectretObj === 'object' && Object.keys(rawElectretObj).length > 0);
        const hasMultimodalCabinetOrWearable = Boolean(
            cab.hasCabinetStudies ||
            rawPatientData?.scan_data?.ocular_metrics ||
            rawPatientData?.scan_data?.lingual_metrics ||
            rawPatientData?.lifestyle_profile?.activity?.source_type === 'TELEMETRY_TCX'
        );

        const evidenceTier = hasRealVenousLabs
            ? 'BIOQUIMICO_INTEGRAL'
            : (hasElectretEvidence || hasMultimodalCabinetOrWearable)
                ? 'BIOFISICO_MULTIMODAL'
                : 'CLINICO_ANTROPOMETRICO';

        const evidenceTierBadge = evidenceTier === 'BIOQUIMICO_INTEGRAL'
            ? 'Certeza Bioquímica y Clínica Integral'
            : evidenceTier === 'BIOFISICO_MULTIMODAL'
                ? 'Certeza Biofísica y Clínica Multimodal'
                : 'Certeza Clínica y Antropométrica Basal';

        const evidenceConfidencePct = evidenceTier === 'BIOQUIMICO_INTEGRAL'
            ? 95
            : evidenceTier === 'BIOFISICO_MULTIMODAL'
                ? 82
                : 72;

        if (safetyGateReasonCode) {
            const gateMetaMap = {
                PEDIATRICS_GROWTH_PERCENTILES: {
                    badge: 'Protección Pediátrica Activa • Desarrollo Longitudinal',
                    title: 'Seguimiento por Curvas de Crecimiento y Desarrollo (Sin Edad Metabólica Comparativa)',
                    patientExplanation: chronoAge < 13
                        ? 'En menores de 18 años acompañamos el crecimiento saludable mediante curvas pediátricas de talla, peso y vitalidad diaria junto con su madre, padre o tutor, sin aplicar comparaciones de edad metabólica de adultos.'
                        : 'En etapa adolescente priorizamos su desarrollo armónico, energía escolar y bienestar integral mediante percentiles de crecimiento saludable, sin etiquetas comparativas de edad metabólica.',
                    clinicalExplanation: 'Compuerta Ruta 5 (Pediatría < 18 años): Se suprime comparación punitiva de Edad Metabólica adulta; rigen percentiles L-OMS/CDC de crecimiento y maduración.'
                },
                PREGNANCY_LACTATION_PROTECTION: {
                    badge: 'Protección Materno-Infantil • Embarazo y Lactancia',
                    title: 'Acompañamiento Fisiológico Gestacional y de Lactancia (Edad Metabólica Desactivada)',
                    patientExplanation: 'Durante el embarazo y la lactancia su organismo realiza adaptaciones fisiológicas maravillosas para nutrir la vida; por ello evaluamos su bienestar materno e hidratación sin comparaciones de edad metabólica.',
                    clinicalExplanation: 'Compuerta Ruta 6 (Embarazo y Lactancia): Los cambios fisiológicos de volumen plasmático, lípidos y composición corporal invalidan ecuaciones de edad metabólica estándar.'
                },
                TCA_BEHAVIORAL_SAFETY: {
                    badge: 'Seguridad Conductual Activa • Enfoque de Bienestar Integral',
                    title: 'Acompañamiento Nutricional Centrado en Vitalidad y Relación Saludable con la Alimentación',
                    patientExplanation: 'Su plan prioriza su energía diaria, descanso reparador, digestión cómoda y paz nutricional, prescindiendo deliberadamente de marcadores numéricos comparativos de edad corporal.',
                    clinicalExplanation: 'Compuerta Ruta 9 (Salud Mental / TCA): Supresión obligatoria de métricas numéricas punitivas de composición y edad metabólica por bioseguridad conductual.'
                },
                PALLIATIVE_COMFORT_CARE: {
                    badge: 'Cuidado Compasivo Integral • Confort y Calidad de Vida',
                    title: 'Soporte Nutricional Enfocado en Confort Digestivo, Hidratación y Bienestar Diario',
                    patientExplanation: 'Nuestro acompañamiento se centra plenamente en su confort diario, hidratación suave y aprovechamiento amable de sus alimentos, sin indicadores comparativos punitivos.',
                    clinicalExplanation: 'Compuerta Ruta 14 (Cuidados Paliativos): Se desactiva cálculo punitivo de Edad Metabólica priorizando calidad de vida, tolerancia digestiva y confort.'
                }
            };
            const gMeta = gateMetaMap[safetyGateReasonCode] || gateMetaMap.TCA_BEHAVIORAL_SAFETY;
            return {
                engineVersion: ENGINE_VERSION_SSOT,
                isSuppressedBySafetyGate: true,
                isTcaBehavioralSafety: routes.has('GOAL_MENTAL_HEALTH'),
                safetyGateReasonCode,
                suppressionReasonCode: safetyGateReasonCode,
                safetyGateBadge: gMeta.badge,
                safetyGateTitle: gMeta.title,
                safetyGatePatientExplanation: gMeta.patientExplanation,
                safetyGateClinicalExplanation: gMeta.clinicalExplanation,
                suppressionReasonText: gMeta.patientExplanation,
                chronologicalAge: chronoAge,
                metabolicAge: null,
                metabolicAgeExact: null,
                deltaYears: null,
                deltaYearsRounded: null,
                cycle1TargetAge28d: null,
                cycle1Delta28d: null,
                cycle3ProjectionAge90d: null,
                cycle3Delta90d: null,
                evidenceTier,
                evidenceTierBadge,
                evidenceConfidencePct,
                measuredDomainsCount: 0,
                totalDomainsPossible: 6,
                coverageWeightRatio: 0,
                altitudeMsnm: altitudeInfo.msnm,
                altitudeLabel: altitudeInfo.label,
                spo2AdjustedNormal: true,
                isAthleticHighLeanMass: false,
                activeRoutes: Array.from(routes),
                unitConversionsApplied: opts.serum?.unitConversionsApplied || labs.unitConversionsApplied || [],
                anthropometrySource: 'SAFETY_GATED',
                physicalMetrics: {},
                domainBreakdown: [],
                protectiveFactors: [],
                modifiableLoadFactors: [],
                patientSummary: gMeta.patientExplanation,
                clinicalSummary: gMeta.clinicalExplanation
            };
        }

        // Extracción Antropométrica y Constantes Vitales
        const vitals = rawPatientData?.vitals || rawPatientData?.signosVitales || {};
        const anthro = rawPatientData?.anthropometry || rawPatientData?.vitales_antropometria || {};
        const biometria = rawPatientData?.biometria || {};
        const bio = opts.bioenergetics || rawPatientData?.clinical_dossier?.bioenergetics || {};
        const vitalsSnap = opts.serum?.vitalsSnapshot || {};

        const weightKg = parseFloat(vitalsSnap.weightKg || vitals.weight || anthro.weight_kg || anthro.peso_kg || biometria.peso || rawPatientData?.peso || bio.weightKg || 0) || null;
        const rawH = parseFloat(vitalsSnap.heightCm || vitals.height || anthro.height_cm || anthro.talla_m || biometria.talla || rawPatientData?.talla || bio.heightCm || 0) || null;
        const heightCm = rawH ? (rawH < 3 ? Number((rawH * 100).toFixed(1)) : rawH) : null;
        const waistCm = parseFloat(vitalsSnap.waist || vitals.waist || anthro.waist_cm || anthro.cintura_cm || biometria.cintura || rawPatientData?.cintura || 0) || null;
        const hipCm = parseFloat(vitalsSnap.hip || vitals.hip || anthro.hip_cm || anthro.cadera_cm || biometria.cadera || rawPatientData?.cadera || 0) || null;

        let electretBodyFat = null;
        if (hasElectretEvidence) {
            Object.values(rawElectretObj || {}).forEach((cat) => {
                const items = Array.isArray(cat?.items) ? cat.items : [];
                items.forEach((it) => {
                    const nm = normalizeAsciiToken(it?.name || it?.key || '');
                    if (nm.includes('porcentaje_de_grasa') || nm === 'body_fat_pct') {
                        const v = parseFloat(String(it?.value ?? '').replace(/[^0-9.-]/g, ''));
                        if (Number.isFinite(v) && v >= 4 && v <= 65) electretBodyFat = v;
                    }
                });
            });
        }
        const rawFatCandidate = parseFloat(vitalsSnap.bodyFatPct || vitals.body_fat || biometria.grasa_corporal || biometria.porcentaje_grasa || bio.bodyFatPct || electretBodyFat || 0);
        const bodyFatPct = Number.isFinite(rawFatCandidate) && rawFatCandidate >= 4 && rawFatCandidate <= 65 ? rawFatCandidate : null;

        const bmi = (weightKg && heightCm)
            ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
            : (parseFloat(vitalsSnap.bmi || vitals.bmi || anthro.bmi || bio.bmi || 0) || null);
        const ica = (waistCm && heightCm) ? Number((waistCm / heightCm).toFixed(2)) : null;
        const icc = (waistCm && hipCm)
            ? Number((waistCm / hipCm).toFixed(2))
            : (parseFloat(vitalsSnap.icc || vitals.whr || anthro.whr || rawPatientData?.icc || 0) || null);

        const lpAct = rawPatientData?.lifestyle_profile?.activity || rawPatientData?.clinical_context?.activity?.exercise || {};
        const tcxValid = lpAct?.source_type === 'TELEMETRY_TCX' && !lpAct?.telemetry_metadata?.preview_pending_confirm ? lpAct.telemetry_metadata : null;
        const wkMin = Number(lpAct?.weekly_minutes || tcxValid?.weekly_minutes || ((Number(tcxValid?.daily_minutes || 0) * Number(tcxValid?.weekly_days || 0)) || 0));
        const actLevelStr = String(rawPatientData?.activity_level || rawPatientData?.physical_activity || rawPatientData?.habits?.activity_level || '').toUpperCase();
        const hasActiveExercise = Boolean(wkMin >= 120 || tcxValid || /MODERAD|INTENS|ATLETA|ACTIVO/.test(actLevelStr));
        const isExplicitSedentary = !hasActiveExercise && /SEDENTARIO|NULA/.test(actLevelStr);

        const iccThreshold = isFemale ? 0.85 : 0.90;
        const optimalFatMax = (isFemale ? 28.0 : 20.0) + (chronoAge >= 60 ? 2.0 : 0.0);
        const athleticFatMax = isFemale ? 25.0 : 18.0;

        // EGM-61: Piso estricto de IMC >= 20.5 kg/m² para impedir que caquexia/sarcopenia se clasifique como perfil atlético
        const hasSufficientLeanMassBmi = bmi === null || bmi >= 20.5;
        const isAthleticHighLeanMass = Boolean(
            hasSufficientLeanMassBmi && (
                routes.has('GOAL_MUSCLE') ||
                (bodyFatPct !== null && bodyFatPct <= athleticFatMax && (ica === null || ica < 0.52) && (icc === null || icc < iccThreshold) && hasActiveExercise)
            )
        );

        const protectiveFactors = [];
        const modifiableLoadFactors = [];
        const domains = [];

        // =========================================================================
        // DOMINIO 1 (0.26): Composición Corporal, Adiposidad Visceral y Curva en J
        // =========================================================================
        const hasAnthroDomain = Boolean(bmi !== null || ica !== null || icc !== null || bodyFatPct !== null);
        if (hasAnthroDomain) {
            let d1Score = 0;
            const isUnderweightMalnutrition = bmi !== null && bmi < 18.5;
            const isGeriatricLowReserve = chronoAge >= 65 && bmi !== null && bmi >= 18.5 && bmi < 21.0 && !hasActiveExercise;

            if (isUnderweightMalnutrition) {
                d1Score += bmi < 17.0 ? 5.2 : 3.6;
                if (chronoAge >= 65) d1Score += 1.2;
                modifiableLoadFactors.push(`baja reserva proteico-energética corporal (IMC ${bmi} kg/m²)`);
            } else if (isGeriatricLowReserve) {
                d1Score += 2.2;
                modifiableLoadFactors.push(`reserva osteomuscular geriátrica disminuida (IMC ${bmi} kg/m²)`);
            } else if (isAthleticHighLeanMass) {
                if (bodyFatPct !== null && bodyFatPct <= (isFemale ? 22 : 15)) {
                    d1Score -= 3.2;
                    protectiveFactors.push(`alta reserva muscular magra (${bodyFatPct} % grasa corporal; 0 penalización por IMC ${bmi || '--'})`);
                } else {
                    d1Score -= 2.0;
                    protectiveFactors.push('composición atlética con baja adiposidad visceral (0 penalización por IMC muscular)');
                }
                if (ica !== null && ica < 0.49) {
                    d1Score -= 1.0;
                    protectiveFactors.push(`relación cintura-estatura óptima (ICA ${ica})`);
                } else if (ica !== null && ica >= 0.54) {
                    d1Score += 1.5;
                }
            } else {
                if (ica !== null) {
                    if (ica < 0.50) {
                        d1Score -= 1.6;
                        protectiveFactors.push(`cintura-estatura saludable (ICA ${ica})`);
                    } else if (ica <= 0.54) {
                        d1Score += 0.6;
                    } else if (ica <= 0.60) {
                        d1Score += 2.2;
                        modifiableLoadFactors.push(`circunferencia abdominal central (ICA ${ica})`);
                    } else {
                        d1Score += 4.2;
                        modifiableLoadFactors.push(`adiposidad central marcada (ICA ${ica})`);
                    }
                } else if (bmi !== null) {
                    if (bmi >= 18.5 && bmi < 25.0) {
                        d1Score -= 1.2;
                        protectiveFactors.push(`índice de masa corporal en rango fisiológico (${bmi} kg/m²)`);
                    } else if (bmi >= 25.0 && bmi < 30.0) {
                        d1Score += 1.6;
                        modifiableLoadFactors.push(`sobrepeso moderado (IMC ${bmi} kg/m²)`);
                    } else if (bmi >= 30.0 && bmi < 35.0) {
                        d1Score += 3.8;
                        modifiableLoadFactors.push(`sobrecarga ponderal (IMC ${bmi} kg/m²)`);
                    } else if (bmi >= 35.0) {
                        d1Score += 6.0;
                        modifiableLoadFactors.push(`sobrecarga ponderal grado II+ (IMC ${bmi} kg/m²)`);
                    }
                }

                if (icc !== null) {
                    if (icc < iccThreshold) {
                        d1Score -= 0.6;
                    } else {
                        d1Score += icc >= (iccThreshold + 0.08) ? 1.8 : 1.0;
                        modifiableLoadFactors.push(`relación cintura-cadera física (ICC ${icc})`);
                    }
                }

                if (bodyFatPct !== null) {
                    if (bodyFatPct <= optimalFatMax) {
                        d1Score -= 0.8;
                        protectiveFactors.push(`porcentaje de grasa corporal conservado (${bodyFatPct} %)`);
                    } else if (bodyFatPct <= optimalFatMax + 5) {
                        d1Score += 0.8;
                    } else {
                        d1Score += 2.2;
                        modifiableLoadFactors.push(`porcentaje de grasa corporal elevado (${bodyFatPct} %)`);
                    }
                }
            }
            domains.push({
                id: 'ANTHROPOMETRY_ADIPOSITY',
                label: 'Composición Corporal y Reserva Magra',
                weight: DOMAIN_WEIGHTS_SSOT.ANTHROPOMETRY_ADIPOSITY,
                measured: true,
                scoreEquivalentYears: Math.max(-6.0, Math.min(9.0, Number(d1Score.toFixed(2))))
            });
        } else {
            domains.push({ id: 'ANTHROPOMETRY_ADIPOSITY', label: 'Composición Corporal', weight: 0, measured: false, status: 'NO_MEDIDO', scoreEquivalentYears: 0 });
        }

        // =========================================================================
        // DOMINIO 2 (0.18): Hemodinámica, Altitud, FC Basal y Aptitud Física
        // =========================================================================
        const bpObj = vitals.blood_pressure || vitals.bloodPressure || {};
        const sysBp = Number(vitalsSnap.sys || bpObj.systolic || vitals.systolic || vitals.ta_sistolica || 0);
        const diaBp = Number(vitalsSnap.dia || bpObj.diastolic || vitals.diastolic || vitals.ta_diastolica || 0);
        const spo2Val = Number(vitalsSnap.spo2 || vitals.spo2 || vitals.saturacion || 0);
        const restHr = Number(vitals.heart_rate || vitals.heartRate || vitals.hr || cab.ecgHrBpm || 0);
        const tempC = Number(vitals.temperature || vitalsSnap.temp || 0);

        const hasHemodynamicDomain = Boolean(sysBp > 0 || spo2Val > 0 || restHr > 0 || hasActiveExercise || isExplicitSedentary || cab.hasCabinetStudies);
        if (hasHemodynamicDomain) {
            let d2Score = 0;
            if (sysBp > 0 && diaBp > 0) {
                if (sysBp < 122 && diaBp < 80) {
                    if (anamnesis.hasAntihypertensiveMed) {
                        d2Score += 0.5;
                        protectiveFactors.push(`presión arterial controlada bajo tratamiento médico (${sysBp}/${diaBp} mmHg)`);
                    } else {
                        d2Score -= 1.2;
                        protectiveFactors.push(`presión arterial óptima (${sysBp}/${diaBp} mmHg)`);
                    }
                } else if (sysBp < 130 && diaBp < 85) {
                    d2Score += anamnesis.hasAntihypertensiveMed ? 0.5 : -0.3;
                } else if (sysBp < 140 && diaBp < 90) {
                    d2Score += 2.0;
                    modifiableLoadFactors.push(`tensión arterial limítrofe (${sysBp}/${diaBp} mmHg)`);
                } else {
                    d2Score += 4.8;
                    modifiableLoadFactors.push(`hipertensión arterial activa (${sysBp}/${diaBp} mmHg)`);
                }
            }
            if (spo2Val > 0) {
                if (spo2Val >= altitudeInfo.spo2NormalFloor) {
                    d2Score -= spo2Val >= (altitudeInfo.spo2NormalFloor + 3) ? 0.6 : 0.2;
                    protectiveFactors.push(
                        altitudeInfo.msnm >= 1500
                            ? `oxigenación fisiológica adaptada a altitud (${spo2Val} % en ${altitudeInfo.msnm} msnm)`
                            : `saturación de oxígeno adecuada (${spo2Val} %)`
                    );
                } else {
                    d2Score += spo2Val < 89 ? 3.5 : 1.8;
                    modifiableLoadFactors.push(`hipoxemia relativa para altitud (${spo2Val} %)`);
                }
            }
            if (restHr > 90 && !(tempC >= 37.8)) {
                d2Score += restHr > 100 ? 2.4 : 1.4;
                modifiableLoadFactors.push(`frecuencia cardiaca basal elevada en reposo (${restHr} lpm)`);
            }
            if (hasActiveExercise) {
                d2Score -= (wkMin >= 240 || routes.has('GOAL_MUSCLE')) ? 2.2 : 1.4;
                protectiveFactors.push(
                    tcxValid
                        ? `actividad física estructurada validada (${wkMin || tcxValid.daily_minutes} min${wkMin ? '/sem' : '/día'})`
                        : 'hábito de ejercicio físico activo'
                );
            } else if (isExplicitSedentary) {
                d2Score += 1.4;
                modifiableLoadFactors.push('bajo volumen actual de movimiento estructurado');
            }
            // EGM-64: Eximir bradicardia sinusal vagal limpia (45–59 lpm sin bloqueo de rama) en atleta/activo
            const isCleanAthleticVagalBradycardia = Boolean(
                cab.hasCardiacConductionOrBradycardia &&
                !cab.hasRbbbOrConductionBlock &&
                !cab.hasActiveTachyarrhythmia &&
                (hasActiveExercise || isAthleticHighLeanMass) &&
                (!cab.ecgHrBpm || (cab.ecgHrBpm >= 44 && cab.ecgHrBpm < 60))
            );
            if ((cab.hasCardiacConductionOrBradycardia && !isCleanAthleticVagalBradycardia) || cab.hasActiveTachyarrhythmia) {
                d2Score += cab.hasActiveTachyarrhythmia ? 2.2 : 0.9;
            }
            domains.push({
                id: 'HEMODYNAMICS_ALTITUDE_FITNESS',
                label: 'Hemodinámica, Oxigenación por Altitud y Aptitud Física',
                weight: DOMAIN_WEIGHTS_SSOT.HEMODYNAMICS_ALTITUDE_FITNESS,
                measured: true,
                scoreEquivalentYears: Math.max(-5.5, Math.min(8.5, Number(d2Score.toFixed(2))))
            });
        } else {
            domains.push({ id: 'HEMODYNAMICS_ALTITUDE_FITNESS', label: 'Hemodinámica y Aptitud', weight: 0, measured: false, status: 'NO_MEDIDO', scoreEquivalentYears: 0 });
        }

        // =========================================================================
        // DOMINIO 3 (0.18): Regulación Glucémica e Insulínica (Ayuno vs Postprandial + Fármaco)
        // =========================================================================
        const venousGlu = Number(labs.glucose || 0);
        const capGluRaw = parseFloat(vitalsSnap.glu || vitals.glucose || vitals.glucosa || 0);
        const capGluUnit = String(vitals.glucose_unit || vitals.unidad_glucosa || '').toLowerCase();
        const capGlu = capGluRaw > 0 && capGluUnit.includes('mmol') ? Number((capGluRaw * 18.0156).toFixed(1)) : capGluRaw;
        const gluContext = String(vitals.glucose_context || 'FASTING').toUpperCase();
        const isPostprandialCapillaryOnly = Boolean(!(venousGlu > 0) && capGlu > 0 && /POST|CASUAL|DESPU[ÉE]S/.test(gluContext));
        const effGlucose = venousGlu > 0 ? venousGlu : capGlu;
        const effHba1c = Number(labs.hba1c || 0);
        const effHoma = Number(labs.homaIr || 0);

        const hasGlycemicDomain = Boolean(effGlucose > 0 || effHba1c > 0 || effHoma > 0);
        if (hasGlycemicDomain) {
            let d3Score = 0;
            if (isPostprandialCapillaryOnly && !(effHba1c >= 6.5)) {
                if (effGlucose >= 200) {
                    d3Score += 8.0;
                    modifiableLoadFactors.push(`hiperglucemia postprandial marcada (${effGlucose} mg/dL)`);
                } else if (effGlucose >= 140 || (effHba1c >= 5.7 && effHba1c < 6.5)) {
                    d3Score += 3.2;
                    modifiableLoadFactors.push(`glucemia postprandial elevada (${effGlucose} mg/dL)`);
                } else if (effGlucose < 70) {
                    d3Score += 2.0;
                    modifiableLoadFactors.push(`hipoglucemia capilar (${effGlucose} mg/dL)`);
                } else {
                    d3Score += anamnesis.hasGlucoseLoweringMed ? 0.5 : -0.8;
                    protectiveFactors.push(`glucosa postprandial en rango fisiológico (${effGlucose} mg/dL)`);
                }
            } else {
                if (effGlucose >= 126 || effHba1c >= 6.5) {
                    d3Score += (effGlucose >= 165 || effHba1c >= 7.5) ? 9.5 : 6.5;
                    modifiableLoadFactors.push(`desregulación glucémica (${effGlucose ? `Glucosa ${effGlucose} mg/dL` : `HbA1c ${effHba1c} %`})`);
                } else if ((effGlucose >= 100 && effGlucose < 126) || (effHba1c >= 5.7 && effHba1c < 6.5) || effHoma > 2.5) {
                    d3Score += 3.2;
                    modifiableLoadFactors.push(`resistencia glucémica/insulínica temprana (${effGlucose ? `Glucosa ${effGlucose} mg/dL` : `HbA1c ${effHba1c} %`})`);
                } else if (effGlucose > 0 && effGlucose < 70) {
                    d3Score += 2.0;
                    modifiableLoadFactors.push(`hipoglucemia en ayuno (${effGlucose} mg/dL)`);
                } else if (effGlucose >= 70 && effGlucose < 93 && (!effHba1c || effHba1c < 5.5)) {
                    if (anamnesis.hasGlucoseLoweringMed) {
                        d3Score += 0.5;
                        protectiveFactors.push(`glucemia controlada bajo tratamiento médico (${effGlucose} mg/dL)`);
                    } else {
                        d3Score -= 1.8;
                        protectiveFactors.push(`normoglucemia óptima en ayuno (${effGlucose} mg/dL)`);
                    }
                } else {
                    d3Score += anamnesis.hasGlucoseLoweringMed ? 0.5 : -0.8;
                    protectiveFactors.push(`glucosa basal en rango saludable (${effGlucose || '--'} mg/dL)`);
                }
            }
            domains.push({
                id: 'GLYCEMIC_METABOLISM',
                label: 'Regulación Glucémica e Insulínica',
                weight: DOMAIN_WEIGHTS_SSOT.GLYCEMIC_METABOLISM,
                measured: true,
                scoreEquivalentYears: Math.max(-4.0, Math.min(11.0, Number(d3Score.toFixed(2))))
            });
        } else {
            domains.push({ id: 'GLYCEMIC_METABOLISM', label: 'Regulación Glucémica', weight: 0, measured: false, status: 'NO_MEDIDO', scoreEquivalentYears: 0 });
        }

        // =========================================================================
        // DOMINIO 4 (0.14): Transporte Lipoproteico e Inflamación Endotelial
        // =========================================================================
        const hasAcuteFever = tempC >= 37.8;
        const hasLipidVascDomain = Boolean(
            Number(labs.totalCholesterol) > 0 ||
            Number(labs.ldl) > 0 ||
            Number(labs.hdl) > 0 ||
            Number(labs.triglycerides) > 0 ||
            (!hasAcuteFever && Number(labs.hscrpMgL) > 0)
        );
        if (hasLipidVascDomain) {
            let d4Score = 0;
            const hdlMin = isFemale ? 50 : 40;
            if (Number(labs.hdl) > 0) {
                if (labs.hdl >= hdlMin + 12) {
                    d4Score -= 1.2;
                    protectiveFactors.push(`colesterol HDL cardioprotector (${labs.hdl} mg/dL)`);
                } else if (labs.hdl < hdlMin) {
                    d4Score += 2.2;
                    modifiableLoadFactors.push(`colesterol HDL reducido para su sexo (${labs.hdl} mg/dL)`);
                }
            }
            if (Number(labs.triglycerides) > 0) {
                const tgHdlRatio = Number(labs.hdl) > 0 ? (labs.triglycerides / labs.hdl) : 0;
                if (labs.triglycerides < 110 && tgHdlRatio <= 3.0) {
                    d4Score += anamnesis.hasLipidLoweringMed ? 0.0 : -0.8;
                    protectiveFactors.push(`triglicéridos en rango óptimo (${labs.triglycerides} mg/dL)`);
                } else if (labs.triglycerides >= 220) {
                    d4Score += 3.5;
                    modifiableLoadFactors.push(`hipertrigliceridemia (${labs.triglycerides} mg/dL)`);
                } else if (labs.triglycerides >= 150) {
                    d4Score += 1.8;
                    modifiableLoadFactors.push(`triglicéridos elevados (${labs.triglycerides} mg/dL)`);
                } else if (tgHdlRatio > 3.0) {
                    d4Score += 1.0;
                    modifiableLoadFactors.push(`relación TG/HDL elevada (${tgHdlRatio.toFixed(1)})`);
                }
            }
            // EGM-64: Cobertura continua de Colesterol no-HDL >= 130 mg/dL sin doble conteo
            if (Number(labs.ldl) >= 130 || Number(labs.sdLdl) > 1.35 || Number(labs.nonHdl) >= 130) {
                d4Score += (Number(labs.ldl) >= 160 || Number(labs.sdLdl) > 1.6 || Number(labs.nonHdl) >= 190) ? 2.8 : 1.6;
                modifiableLoadFactors.push(`carga lipoproteica LDL/sdLDL (${labs.ldl ? `LDL ${labs.ldl} mg/dL` : `no-HDL ${labs.nonHdl} mg/dL`})`);
            } else if (Number(labs.ldl) > 0 && labs.ldl < 100 && (!labs.nonHdl || labs.nonHdl < 130)) {
                d4Score += anamnesis.hasLipidLoweringMed ? 0.5 : -0.8;
            }
            if (!hasAcuteFever && Number(labs.hscrpMgL) > 0) {
                if (labs.hscrpMgL <= 1.2) {
                    d4Score -= 0.7;
                    protectiveFactors.push(`proteína C reactiva ultrasensible tranquila (${labs.hscrpMgL} mg/L)`);
                } else if (labs.hscrpMgL > 3.0) {
                    d4Score += 2.4;
                    modifiableLoadFactors.push(`inflamación vascular ultrasensible (PCR-us ${labs.hscrpMgL} mg/L)`);
                }
            }
            domains.push({
                id: 'LIPOPROTEIN_VASCULAR',
                label: 'Transporte Lipoproteico e Inflamación Endotelial',
                weight: DOMAIN_WEIGHTS_SSOT.LIPOPROTEIN_VASCULAR,
                measured: true,
                scoreEquivalentYears: Math.max(-4.0, Math.min(9.5, Number(d4Score.toFixed(2))))
            });
        } else {
            domains.push({ id: 'LIPOPROTEIN_VASCULAR', label: 'Perfil Lipoproteico', weight: 0, measured: false, status: 'NO_MEDIDO', scoreEquivalentYears: 0 });
        }

        // =========================================================================
        // DOMINIO 5 (0.12): Filtración Hepatorrenal, PhenoAge (Albúmina/RDW) y Tiroides
        // =========================================================================
        const hasHepatoRenalDomain = Boolean(
            Number(labs.creatinine) > 0 ||
            Number(labs.gfr) > 0 ||
            Number(labs.uricAcid) > 0 ||
            Number(labs.alt) > 0 ||
            Number(labs.ast) > 0 ||
            Number(labs.bilirubin) > 0 ||
            Number(labs.albumin) > 0 ||
            Number(labs.hemoglobin) > 0 ||
            Number(labs.rdw) > 0 ||
            Number(labs.tsh) > 0 ||
            Number(labs.ferritin) > 0
        );
        if (hasHepatoRenalDomain) {
            let d5Score = 0;
            const crUpper = isFemale ? 1.1 : 1.3;
            const uricUpper = isFemale ? 6.0 : 7.0;
            if (Number(labs.creatinine) > crUpper || (Number(labs.gfr) > 0 && labs.gfr < 60)) {
                d5Score += (Number(labs.creatinine) >= 1.6 || (Number(labs.gfr) > 0 && labs.gfr < 45)) ? 7.5 : 4.0;
                modifiableLoadFactors.push(`sobrecarga en filtración renal (Cr ${labs.creatinine} mg/dL${labs.gfr ? ` • TFGe ${labs.gfr}` : ''})`);
            } else if (chronoAge < 40 && Number(labs.gfr) >= 60 && Number(labs.gfr) < 75) {
                d5Score += 1.8;
                modifiableLoadFactors.push(`filtrado glomerular reducido para adulto joven (TFGe ${labs.gfr} mL/min)`);
            } else if (Number(labs.creatinine) > 0 || Number(labs.gfr) >= 60) {
                d5Score -= 0.8;
                protectiveFactors.push(`función renal conservada (${labs.creatinine ? `Creatinina ${labs.creatinine} mg/dL` : `TFGe ${labs.gfr}`})`);
            }
            if (Number(labs.uricAcid) > uricUpper) {
                d5Score += 1.6;
                modifiableLoadFactors.push(`ácido úrico elevado para su sexo (${labs.uricAcid} mg/dL)`);
            }
            if (Number(labs.alt) > 61 || Number(labs.ast) > 40 || Number(labs.ggt) > 61 || Number(labs.bilirubin) > 1.3) {
                d5Score += 2.6;
                modifiableLoadFactors.push('sobrecarga enzimática o pigmentaria hepatobiliar');
            } else if (Number(labs.alt) > 0 && Number(labs.ast) > 0) {
                d5Score -= 0.6;
                protectiveFactors.push('enzimas hepáticas en rango fisiológico');
            }
            if (Number(labs.albumin) > 0 && labs.albumin < 3.8) {
                d5Score += labs.albumin < 3.5 ? 4.0 : 2.0;
                modifiableLoadFactors.push(`reserva proteica visceral disminuida (Albúmina ${labs.albumin} g/dL)`);
            }
            if (Number(labs.rdw) > 14.8) {
                d5Score += 1.8;
                modifiableLoadFactors.push(`anisocitosis eritrocitaria (RDW ${labs.rdw} %)`);
            }
            if (Number(labs.hemoglobin) > 0) {
                const hbFloor = (isFemale ? 12.0 : 13.5) + altitudeInfo.hbAltitudeOffset;
                if (labs.hemoglobin < hbFloor) {
                    d5Score += 1.8;
                    modifiableLoadFactors.push(`hemoglobina baja para altitud (${labs.hemoglobin} g/dL)`);
                }
            }
            if (Number(labs.tsh) > 4.5 || (Number(labs.tsh) > 0 && labs.tsh < 0.35)) {
                d5Score += 1.6;
                modifiableLoadFactors.push(`desajuste del eje tiroideo (TSH ${labs.tsh} mUI/L)`);
            }
            if (Number(labs.ferritin) > 0) {
                const ferrUpper = isFemale ? 250 : 350;
                if (labs.ferritin < 20) {
                    d5Score += 1.2;
                    modifiableLoadFactors.push(`reserva férrica disminuida (Ferritina ${labs.ferritin} ng/mL)`);
                } else if (labs.ferritin > ferrUpper) {
                    d5Score += 1.4;
                    modifiableLoadFactors.push(`hiperferritinemia metabólica/inflamatoria (${labs.ferritin} ng/mL)`);
                }
            }
            domains.push({
                id: 'HEPATORENAL_HEMATOLOGY',
                label: 'Filtración Hepatorrenal, Reserva Proteica y Hematología',
                weight: DOMAIN_WEIGHTS_SSOT.HEPATORENAL_HEMATOLOGY,
                measured: true,
                scoreEquivalentYears: Math.max(-3.5, Math.min(10.5, Number(d5Score.toFixed(2))))
            });
        } else {
            domains.push({ id: 'HEPATORENAL_HEMATOLOGY', label: 'Filtración Hepatorrenal', weight: 0, measured: false, status: 'NO_MEDIDO', scoreEquivalentYears: 0 });
        }

        // =========================================================================
        // DOMINIO 6 (0.12): Carga Alostática, Sueño y Exposición Toxicológica (EGM-62)
        // =========================================================================
        const hasAllostaticDomain = Boolean(
            anamnesis.hasToxicologyRecord ||
            anamnesis.hasSleepRecord ||
            anamnesis.hasStressRecord
        );
        if (hasAllostaticDomain) {
            let d6Score = 0;
            if (anamnesis.isSmoker) {
                d6Score += anamnesis.isHeavySmoker ? 5.0 : 3.5;
                modifiableLoadFactors.push(anamnesis.isHeavySmoker ? 'tabaquismo activo intenso' : 'exposición activa a tabaco');
            }
            if (anamnesis.isHeavyAlcohol) {
                d6Score += 2.8;
                modifiableLoadFactors.push('consumo alcohólico elevado');
            } else if (anamnesis.isFrequentAlcohol) {
                d6Score += 1.5;
                modifiableLoadFactors.push('consumo frecuente de alcohol');
            }
            if (anamnesis.hasDrugUsage) {
                d6Score += 3.0;
                modifiableLoadFactors.push('exposición a sustancias psicoactivas');
            }
            if (anamnesis.hasPoorSleep) {
                d6Score += 1.6;
                modifiableLoadFactors.push(`deuda o fragmentación del sueño${anamnesis.sleepHours ? ` (${anamnesis.sleepHours} h/noche)` : ''}`);
            }
            if (anamnesis.hasHighStress) {
                d6Score += 1.2;
                modifiableLoadFactors.push('carga alostática de estrés crónico elevado');
            }

            if (
                !anamnesis.isSmoker &&
                !anamnesis.isHeavyAlcohol &&
                !anamnesis.isFrequentAlcohol &&
                !anamnesis.hasDrugUsage &&
                anamnesis.hasOptimalSleep &&
                anamnesis.hasLowStress
            ) {
                d6Score -= 0.7;
                protectiveFactors.push('sueño reparador, estrés regulado y abstinencia de tabaco/alcohol');
            }

            domains.push({
                id: 'ALLOSTATIC_TOXICOLOGY',
                label: 'Carga Alostática, Sueño y Exposición Toxicológica',
                weight: DOMAIN_WEIGHTS_SSOT.ALLOSTATIC_TOXICOLOGY,
                measured: true,
                scoreEquivalentYears: Math.max(-1.0, Math.min(9.0, Number(d6Score.toFixed(2))))
            });
        } else {
            domains.push({ id: 'ALLOSTATIC_TOXICOLOGY', label: 'Carga Alostática y Descanso', weight: 0, measured: false, status: 'NO_MEDIDO', scoreEquivalentYears: 0 });
        }

        // Normalización ponderada sobre dominios medidos (NO_MEDIDO = 0)
        const measuredDomains = domains.filter((d) => d.measured && d.weight > 0);
        const totalActiveWeight = measuredDomains.reduce((acc, d) => acc + d.weight, 0);
        let weightedDelta = totalActiveWeight > 0
            ? measuredDomains.reduce((acc, d) => acc + (d.weight * d.scoreEquivalentYears), 0) / totalActiveWeight
            : 0;

        if (!hasRealVenousLabs && hasElectretEvidence) {
            const electretAbnormalNodes = (opts.serum?.nodes || []).filter((n) =>
                Array.isArray(n.anomalies) && n.anomalies.some((a) => a.source === 'ELECTRET' && (a.severity === 'ALTA' || a.severity === 'CRÍTICA'))
            ).length;
            const pureBioelectricNudge = Math.min(1.0, electretAbnormalNodes * 0.2);
            if (modifiableLoadFactors.length === 0) {
                weightedDelta = Math.min(1.0, weightedDelta + pureBioelectricNudge);
            }
        }

        const clampedDeltaExact = Number(Math.max(-8.0, Math.min(12.0, weightedDelta)).toFixed(1));
        const metabolicAgeExact = Number(Math.max(18.0, chronoAge + clampedDeltaExact).toFixed(1));
        const metabolicAgeRounded = Math.round(metabolicAgeExact);
        const deltaYearsRounded = metabolicAgeRounded - chronoAge;

        let cycle1Delta28d = 0;
        let cycle3Delta90d = 0;
        if (clampedDeltaExact > 0.4) {
            cycle1Delta28d = -Number(Math.min(clampedDeltaExact, clampedDeltaExact >= 3.0 ? 1.5 : (clampedDeltaExact >= 1.2 ? 1.2 : Math.max(0.5, clampedDeltaExact))).toFixed(1));
            cycle3Delta90d = -Number(Math.min(clampedDeltaExact, Math.max(Math.abs(cycle1Delta28d), Math.min(4.5, Number((clampedDeltaExact * 0.6).toFixed(1))))).toFixed(1));
        } else {
            const roomToFloor = Math.max(0, (metabolicAgeExact - (chronoAge - 8.0)));
            cycle1Delta28d = roomToFloor >= 0.5 ? -0.5 : 0;
            cycle3Delta90d = roomToFloor >= 1.0 ? -1.0 : cycle1Delta28d;
        }

        const cycle1TargetAge28d = Number((metabolicAgeExact + cycle1Delta28d).toFixed(1));
        const cycle3ProjectionAge90d = Number((metabolicAgeExact + cycle3Delta90d).toFixed(1));

        const topProtectiveText = protectiveFactors.slice(0, 3).join(', ');
        const topModifiableText = modifiableLoadFactors.slice(0, 3).join(', ');

        const patientSummary = clampedDeltaExact > 0.5
            ? `Su Edad Cronológica es de ${chronoAge} años y su Edad Metabólica estimada es de ${metabolicAgeExact} años (${clampedDeltaExact > 0 ? `+${clampedDeltaExact}` : clampedDeltaExact} años • ${evidenceTierBadge}). Sus fortalezas actuales (${topProtectiveText || 'homeostasis general'}) equilibran gran parte de los ejes por optimizar (${topModifiableText || 'adaptación metabólica'}). En su Ciclo 1 (28 días) proyectamos una mejora realista hacia ${cycle1TargetAge28d} años (${cycle1Delta28d} años), consolidando una proyección a 90 días hacia ${cycle3ProjectionAge90d} años.`
            : clampedDeltaExact < -0.5
                ? `Su Edad Cronológica es de ${chronoAge} años y su Edad Metabólica actual es de ${metabolicAgeExact} años (${clampedDeltaExact} años • reserva funcional superior a su edad), respaldada por ${topProtectiveText || 'su composición corporal y vitalidad cardiometabólica'}. Nuestro objetivo a 28 y 90 días es preservar esta ventaja fisiológica (${cycle1TargetAge28d} años).`
                : `Su Edad Cronológica (${chronoAge} años) y su Edad Metabólica actual (${metabolicAgeExact} años) se encuentran en equilibrio fisiológico (${clampedDeltaExact >= 0 ? `+${clampedDeltaExact}` : clampedDeltaExact} años • ${evidenceTierBadge}), respaldadas por ${topProtectiveText || 'sus constantes vitales conservadas'}${topModifiableText ? `, enfocando los próximos 28 días en optimizar ${topModifiableText} hacia ${cycle1TargetAge28d} años` : ''}.`;

        const clinicalSummary = `Estudio Multivariable EGM-51 v3 (${evidenceTier} • ${measuredDomains.length}/6 dominios medidos • Altitud ${altitudeInfo.msnm} msnm): Edad Cronológica ${chronoAge} a vs Edad Metabólica ${metabolicAgeExact} a (Delta ${clampedDeltaExact >= 0 ? `+${clampedDeltaExact}` : clampedDeltaExact} a). Meta Ciclo 1 (28d): ${cycle1TargetAge28d} a (${cycle1Delta28d} a) | Proyección Ciclo 3 (90d): ${cycle3ProjectionAge90d} a (${cycle3Delta90d} a).`;

        return {
            engineVersion: ENGINE_VERSION_SSOT,
            isSuppressedBySafetyGate: false,
            isTcaBehavioralSafety: false,
            safetyGateReasonCode: null,
            safetyGateBadge: null,
            safetyGateTitle: null,
            safetyGatePatientExplanation: null,
            safetyGateClinicalExplanation: null,
            chronologicalAge: chronoAge,
            metabolicAge: metabolicAgeRounded,
            metabolicAgeExact,
            deltaYears: clampedDeltaExact,
            deltaYearsRounded,
            cycle1TargetAge28d,
            cycle1Delta28d,
            cycle3ProjectionAge90d,
            cycle3Delta90d,
            evidenceTier,
            evidenceTierBadge,
            evidenceConfidencePct,
            measuredDomainsCount: measuredDomains.length,
            totalDomainsPossible: 6,
            coverageWeightRatio: Number(totalActiveWeight.toFixed(2)),
            altitudeMsnm: altitudeInfo.msnm,
            altitudeLabel: altitudeInfo.label,
            spo2AdjustedNormal: Boolean(spo2Val === 0 || spo2Val >= altitudeInfo.spo2NormalFloor),
            isAthleticHighLeanMass,
            activeRoutes: Array.from(routes),
            unitConversionsApplied: opts.serum?.unitConversionsApplied || labs.unitConversionsApplied || [],
            anthropometrySource: waistCm && hipCm ? 'PHYSICAL_TAPE_PRIORITY' : (weightKg && heightCm ? 'PHYSICAL_SCALE_PRIORITY' : 'MULTIMODAL_FALLBACK'),
            physicalMetrics: {
                weightKg,
                heightCm,
                bmi,
                waistCm,
                hipCm,
                ica,
                icc,
                bodyFatPct
            },
            domainBreakdown: domains,
            protectiveFactors,
            modifiableLoadFactors,
            patientSummary,
            clinicalSummary
        };
    } catch (_) {
        return {
            engineVersion: ENGINE_VERSION_SSOT,
            isSuppressedBySafetyGate: false,
            isTcaBehavioralSafety: false,
            safetyGateReasonCode: null,
            chronologicalAge: chronoAge,
            metabolicAge: chronoAge,
            metabolicAgeExact: chronoAge,
            deltaYears: 0,
            deltaYearsRounded: 0,
            cycle1TargetAge28d: chronoAge,
            cycle1Delta28d: 0,
            cycle3ProjectionAge90d: chronoAge,
            cycle3Delta90d: 0,
            evidenceTier: 'CLINICO_ANTROPOMETRICO',
            evidenceTierBadge: 'Certeza Clínica y Antropométrica Basal',
            evidenceConfidencePct: 72,
            measuredDomainsCount: 0,
            totalDomainsPossible: 6,
            coverageWeightRatio: 0,
            altitudeMsnm: 0,
            altitudeLabel: 'Nivel basal',
            spo2AdjustedNormal: true,
            isAthleticHighLeanMass: false,
            activeRoutes: ['GOAL_CLINICAL'],
            unitConversionsApplied: [],
            anthropometrySource: 'UNMEASURED',
            physicalMetrics: {},
            domainBreakdown: [],
            protectiveFactors: [],
            modifiableLoadFactors: [],
            patientSummary: `Su Edad Cronológica (${chronoAge} años) se mantiene como referencia basal segura mientras integramos sus indicadores clínicos.`,
            clinicalSummary: `Respaldo seguro EGM-51 v3: Edad Cronológica ${chronoAge} años.`
        };
    }
}

module.exports = {
    ENGINE_VERSION_SSOT,
    DOMAIN_WEIGHTS_SSOT,
    extractUnifiedAnamnesisSignals,
    buildSafeDietaryExamplesSSoT,
    calculateUniversalMetabolicAgeSSoT
};
