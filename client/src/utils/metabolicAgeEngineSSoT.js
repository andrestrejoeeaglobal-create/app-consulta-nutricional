/**
 * Motor Universal Compartido de Anamnesis 360° y Edad Metabólica de 6 Dominios (`v3.5.0-EGM51-V4` — SSoTT)
 * Equipo en Acción® — Ecosistema T.I.L.O. (NOM-004-SSA3-2012 / NOM-043 / COFEPRIS Art. 215 LGS)
 *
 * Fuente Única de Verdad (CommonJS vigilada por `nodemon --watch ../shared`), consumida 1:1 en servidor y cliente:
 * - Normaliza retrocompatiblemente Fases 0 a 18 sin tocar componentes protegidos (EGM-57).
 * - Evalúa farmacovigilancia, restricción hídrica, litiasis, turno nocturno y exclusiones alergénicas/éticas (EGM-58..60, EGM-66..67).
 * - Calcula Edad Metabólica sobre 6 Dominios (0.26 / 0.18 / 0.18 / 0.14 / 0.12 / 0.12 = 1.00) con Tracción Opuesta
 *   sub-regla por sub-regla, Potencial Óptimo Ciclo 6 (180d), Compensación Fisiológica Activa y Niveles I-III (EGM-69..72).
 */

const ENGINE_VERSION_SSOT = '3.5.0-EGM51-V4';

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

/**
 * Sanitizador Regulatorio COFEPRIS / NOM-004 (`EGM-71` — Parte II Anexo Biofísico y Parte III Guía del Paciente).
 * Transforma etiquetas nosológicas/toxicológicas crudas del escáner bioeléctrico `.HTM` en bioseñales orientativas no diagnósticas.
 */
function sanitizeBioelectricScreeningLabel(rawLabel = '') {
    const clean = cleanHumanLabel(rawLabel);
    if (!clean) return '';
    if (/radiaci[óo]n\s+electromagn[ée]tica|electromagn[ée]tic/i.test(clean)) {
        return 'Bioseñal orientativa de confort neuroambiental';
    }
    if (/s[íi]ndrome\s+de\s+prostatitis|prostatitis|hiperplasia\s+prost[áa]tica|calcificaci[óo]n\s+prost[áa]tica|pr[óo]stata/i.test(clean)) {
        return 'Bioseñal orientativa de confort prostático y urogenital';
    }
    if (/mercurio|ars[ée]nico|plomo|cadmio|metales?\s+pesados?|pesticidas?|toxinas?\s+ambientales?/i.test(clean)) {
        return 'Índice biofísico orientativo de depuración ambiental';
    }
    if (/enfermedad\s+(?:coronaria|cardiovascular)|arteriosclerosis|aterosclerosis|isquemia\s+(?:mioc[áa]rdica|cerebral)|riesgo\s+cerebrovascular|\bstroke\b|infarto/i.test(clean)) {
        return 'Bioseñal orientativa de elasticidad y flujo microvascular';
    }
    if (/\bdiabetes\b|hiperglucemia|hipoglucemia/i.test(clean)) {
        return 'Bioseñal orientativa de equilibrio bioenergético celular';
    }
    if (/esteatosis|h[íi]gado\s+graso|cirrosis|hepatitis/i.test(clean)) {
        return 'Bioseñal orientativa de procesamiento lipídico hepatobiliar';
    }
    if (/nefritis|insuficiencia\s+renal|uremia|proteinuria/i.test(clean)) {
        return 'Bioseñal orientativa de balance hidromineral renal';
    }
    if (/gastritis|[úu]lcera|colitis|enteritis/i.test(clean)) {
        return 'Bioseñal orientativa de confort y motilidad digestiva';
    }
    if (/osteoporosis|hiperplasia\s+[óo]sea|espondilosis|enfermedad\s+[óo]sea\s+reumatoide|coeficiente\s+de\s+reumatismo|reumatismo|artritis/i.test(clean)) {
        return 'Bioseñal orientativa de soporte osteomuscular y articular';
    }
    if (/hipertiroidismo|hipotiroidismo|tiroiditis|bocio/i.test(clean)) {
        return 'Bioseñal orientativa de modulación funcional tiroidea';
    }
    return clean
        .replace(/^(?:S[íi]ndrome|Enfermedad|Trastorno|Patolog[íi]a)\s+de\s+/iu, 'Bioseñal orientativa de ')
        .trim();
}

/**
 * Sanitizador Léxico Art. 215 LGS / COFEPRIS (`EGM-71` — Parte II y Parte III).
 * Erradica términos farmacológicos/terapéuticos aplicados a alimentación o suplementación (33Plus® / 34Plus®),
 * preservando referencias legítimas a medicamentos alopáticos prescritos por el médico tratante.
 */
function sanitizeArt215NonTherapeuticLexicon(rawText = '') {
    const s = String(rawText || '');
    if (!s) return '';
    return s
        .replace(/Puente\s+nutricional\s+terap[ée]utico/giu, 'Ajuste alimentario cardioprotector')
        .replace(/PRESCRIPCI[ÓO]N\s+ORTOMOLECULAR(?:\s+INTEGRAL)?/gu, 'COMPLEMENTACIÓN NUTRICIONAL CIRCADIANA')
        .replace(/Prescripci[óo]n\s+Ortomolecular(?:\s+Integral)?/giu, 'Complementación Nutricional Circadiana')
        .replace(/PRESCRIPCI[ÓO]N\s+BIOENERG[ÉE]TICA\s+Y\s+CRONOBIOLOG[ÍI]A\s+ORTOMOLECULAR/gu, 'META BIOENERGÉTICA Y COMPLEMENTACIÓN NUTRICIONAL CIRCADIANA')
        .replace(/Prescripci[óo]n\s+Bioenerg[ée]tica/giu, 'Pauta Bioenergética Sugerida')
        .replace(/Estrategia\s+Terap[ée]utica(?:\s+Integral)?/giu, 'Pauta Nutricional Sugerida y Apoyo Fisiológico Complementario')
        .replace(/Enfoque\s+Terap[ée]utico/giu, 'Apoyo Fisiológico Complementario')
        .replace(/SECUENCIACI[ÓO]N\s+TERAP[ÉE]UTICA/gu, 'SECUENCIACIÓN DE HÁBITOS Y COMPLEMENTACIÓN')
        .replace(/Secuenciaci[óo]n\s+Terap[ée]utica/giu, 'Secuenciación de Hábitos y Complementación')
        .replace(/Secuenciaci[óo]n\s+cronobiol[óo]gica\s+ortomolecular/giu, 'Secuenciación cronobiológica de complementación nutricional')
        .replace(/Meta\s+(?:Cal[óo]rica\s+|Energ[ée]tica\s+)?Prescrita/giu, 'Meta Energética Sugerida')
        .replace(/D[ÉE]FICIT_TERAP[ÉE]UTICO_MODERADO/gu, 'AJUSTE_ENERGETICO_MODERADO')
        .replace(/su\s+prescripci[óo]n\s+nutricional/giu, 'su pauta nutricional sugerida')
        .replace(/Prescripci[óo]n\s+de\s+Movimiento/giu, 'Pauta de Movimiento Seguro')
        .replace(/Prescripci[óo]n\s+Multimodal\s+Guiada/giu, 'Pauta Multimodal de Movimiento Guiada')
        .replace(/Prescripci[óo]n\s+Biomec[áa]nica/giu, 'Pauta Biomecánica')
        .replace(/Prescripci[óo]n\s+Adaptativa/giu, 'Pauta Adaptativa');
}

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
    try {
        const dom = patientData?.domicilio || patientData?.address || patientData?.location || {};
        const ident = patientData?.identificacion || patientData?.profile || patientData?.demographics || {};
        const explicitCandidates = [
            dom.altitud_msnm,
            dom.altitude_msnm,
            dom.altitud,
            dom.altitude,
            dom.elevation_m,
            dom.msnm,
            ident.altitud_msnm,
            ident.altitude_msnm,
            patientData?.vitals?.altitude_msnm,
            patientData?.vitals?.altitud_msnm,
            patientData?.profile?.altitude_msnm,
            patientData?.profile?.altitud_msnm,
            patientData?.altitude_msnm,
            patientData?.msnm
        ];
        for (const cand of explicitCandidates) {
            if (cand !== null && cand !== undefined && String(cand).trim() !== '') {
                const n = parseFloat(String(cand).replace(/[^0-9.-]/g, ''));
                if (Number.isFinite(n) && n >= -100 && n <= 5500) {
                    const msnm = Math.max(0, Math.round(n));
                    return buildAltitudeBand(msnm, patientData, msnm === 0 ? 'Nivel del mar (0 msnm)' : `${dom.municipio || dom.ciudad || ident.municipio || ident.city || 'Altitud declarada'} • ${msnm} msnm`);
                }
            }
        }

        const lat = parseFloat(dom?.coordinates?.lat ?? dom?.lat ?? ident?.lat ?? NaN);
        const lng = parseFloat(dom?.coordinates?.lng ?? dom?.lng ?? ident?.lng ?? NaN);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            if (lat >= 19.12 && lat <= 19.46 && lng >= -99.85 && lng <= -99.42) return buildAltitudeBand(2660, patientData, 'Valle de Toluca • 2660 msnm');
            if (lat >= 19.20 && lat <= 19.65 && lng >= -99.36 && lng <= -98.88) return buildAltitudeBand(2240, patientData, 'Valle de México • 2240 msnm');
            if (lat >= 20.02 && lat <= 20.22 && lng >= -98.85 && lng <= -98.60) return buildAltitudeBand(2420, patientData, 'Pachuca / Comarca Minera • 2420 msnm');
            if (lat >= 18.95 && lat <= 19.15 && lng >= -98.35 && lng <= -98.10) return buildAltitudeBand(2135, patientData, 'Valle de Puebla • 2135 msnm');
            if (lat >= 20.50 && lat <= 20.70 && lng >= -100.52 && lng <= -100.28) return buildAltitudeBand(1820, patientData, 'Querétaro • 1820 msnm');
            if (lat >= 20.55 && lat <= 20.80 && lng >= -103.50 && lng <= -103.20) return buildAltitudeBand(1566, patientData, 'Guadalajara • 1566 msnm');
        }

        const cp = String(dom.cp || dom.codigoPostal || dom.postal_code || ident.cp || ident.codigoPostal || ident.postal_code || '').trim();
        if (/^(50\d{3}|520\d{2}|521\d{2})$/.test(cp)) return buildAltitudeBand(2660, patientData, 'Valle de Toluca • 2660 msnm');
        if (/^(0[1-9]\d{3}|1[0-6]\d{3})$/.test(cp)) return buildAltitudeBand(2240, patientData, 'Ciudad de México • 2240 msnm');
        if (/^42[01]\d{2}$/.test(cp)) return buildAltitudeBand(2420, patientData, 'Pachuca • 2420 msnm');
        if (/^423\d{2}$/.test(cp)) return buildAltitudeBand(1640, patientData, 'Tasquillo, Hidalgo • 1640 msnm');
        if (/^980\d{2}$/.test(cp)) return buildAltitudeBand(2490, patientData, 'Zacatecas • 2490 msnm');
        if (/^72\d{3}$/.test(cp)) return buildAltitudeBand(2135, patientData, 'Puebla • 2135 msnm');
        if (/^76[0-2]\d{2}$/.test(cp)) return buildAltitudeBand(1820, patientData, 'Querétaro • 1820 msnm');

        const locText = [
            dom.municipio, dom.ciudad, dom.estado, dom.direccion_capturada_usuario, dom.direccion_googlemaps,
            ident.municipio, ident.ciudad, ident.estado, ident.direccion, ident.domicilio,
            ident.city, ident.state, ident.address
        ]
            .filter(Boolean)
            .join(' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();

        if (/\b(?:TOLUCA|METEPEC|ZINACANTEPEC|LERMA|SAN\s+MATEO\s+ATENCO|CALIMAYA|ALMOLOYA)\b/.test(locText)) {
            return buildAltitudeBand(2660, patientData, 'Valle de Toluca • 2660 msnm');
        }
        if (/\b(?:EL\s+ALTO|LA\s+PAZ\s+BOLIVIA)\b/.test(locText)) return buildAltitudeBand(3640, patientData, 'Altiplano Andino • 3640 msnm');
        if (/\b(?:CUSCO|CUZCO)\b/.test(locText)) return buildAltitudeBand(3399, patientData, 'Cusco • 3399 msnm');
        if (/\b(?:QUITO)\b/.test(locText)) return buildAltitudeBand(2850, patientData, 'Quito • 2850 msnm');
        if (/\b(?:BOGOTA)\b/.test(locText)) return buildAltitudeBand(2640, patientData, 'Sabana de Bogotá • 2640 msnm');
        if (/\b(?:ZACATECAS)\b/.test(locText)) return buildAltitudeBand(2490, patientData, 'Zacatecas • 2490 msnm');
        if (/\b(?:PACHUCA|MINERAL\s+DE\s+LA\s+REFORMA|REAL\s+DEL\s+MONTE|TLAXCALA|APIZACO)\b/.test(locText)) {
            return buildAltitudeBand(2420, patientData, 'Altiplano Central • 2420 msnm');
        }
        if (/\b(?:CIUDAD\s+DE\s+MEXICO|CDMX|DF|NAUCALPAN|TLALNEPANTLA|ECATEPEC|HUIXQUILUCAN|NEZAHUALCOYOTL|TEXCOCO)\b/.test(locText)) {
            return buildAltitudeBand(2240, patientData, 'Valle de México • 2240 msnm');
        }
        if (/\b(?:PUEBLA|CHOLULA|ATLIXCO)\b/.test(locText)) return buildAltitudeBand(2135, patientData, 'Valle de Puebla • 2135 msnm');
        if (/\b(?:QUERETARO|MORELIA|PATZCUARO|AGUASCALIENTES|SAN\s+LUIS\s+POTOSI|DURANGO|GUANAJUATO|LEON|GUADALAJARA|ZAPOPAN|SALTILLO|OAXACA|TASQUILLO|IXMIQUILPAN)\b/.test(locText)) {
            return buildAltitudeBand(1820, patientData, 'Altiplano Medio • 1820 msnm');
        }
        if (/\b(?:VERACRUZ|BOCA\s+DEL\s+RIO|CANCUN|MERIDA|ACAPULCO|MAZATLAN|TAMPICO|PUERTO\s+VALLARTA|LOS\s+CABOS|LA\s+PAZ|COATZACOALCOS|CAMPECHE|CHETUMAL|PLAYA\s+DEL\s+CARMEN|COZUMEL|MANZANILLO|ENSENADA|VILLAHERMOSA)\b/.test(locText)) {
            return buildAltitudeBand(0, patientData, 'Nivel del mar (0 msnm)');
        }
        if (/\b(?:MONTERREY|SAN\s+PEDRO\s+GARZA|HERMOSILLO|CULIACAN|CHIHUAHUA|TORREON|TUXTLA|CUERNAVACA)\b/.test(locText)) {
            return buildAltitudeBand(540, patientData, 'Baja altitud (540 msnm)');
        }
    } catch (_) {
        // Respaldo seguro
    }
    return buildAltitudeBand(0, patientData, 'Nivel basal (< 1,500 msnm)');
}

function buildAltitudeBand(msnm, patientData = {}, customLabel = '') {
    const safeMsnm = Number.isFinite(msnm) ? Math.max(0, Math.round(msnm)) : 0;
    let spo2NormalFloor = 95;
    let hbAltitudeOffset = 0.0;
    if (safeMsnm >= 2400) {
        spo2NormalFloor = 92;
        hbAltitudeOffset = 1.3;
    } else if (safeMsnm >= 1500) {
        spo2NormalFloor = 94;
        hbAltitudeOffset = 0.5;
    }
    const label = customLabel || (safeMsnm === 0 ? 'Nivel basal (< 1,500 msnm)' : `${safeMsnm} msnm`);
    return { msnm: safeMsnm, label, spo2NormalFloor, hbAltitudeOffset };
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
    const rawChrono = Number(verifiedAge.ageYears);
    const chronoAge = (verifiedAge.ageYears !== null && verifiedAge.ageYears !== undefined && Number.isFinite(rawChrono) && rawChrono >= 0)
        ? rawChrono
        : 35;
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
            ? 'Nivel I — Evidencia Bioquímica y Clínica Completa'
            : evidenceTier === 'BIOFISICO_MULTIMODAL'
                ? 'Nivel II — Evidencia Multimodal y Antropométrica'
                : 'Nivel III — Evaluación Clínica y Antropométrica Basal';

        const evidenceConfidencePct = null;

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
        const rawFatCandidate = parseFloat(vitalsSnap.bodyFatPct || vitals.body_fat || vitals.body_fat_pct || biometria.grasa_corporal || biometria.porcentaje_grasa || bio.bodyFatPct || electretBodyFat || 0);
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

        // Acumuladores Sub-Regla por Sub-Regla para Tracción Opuesta (EGM-69 — Fallo #1: cero ocultamiento intra-dominio)
        let rawProtectiveWeightedSum = 0; // <= 0 (años brutos ganados)
        let rawTotalDragWeightedSum = 0;  // >= 0 (años brutos retenidos totales)
        let rawModifiableDragWeightedSum = 0; // >= 0 (años retenidos 100 % modificables)

        const finalizeDomainWithSubRules = (id, label, weight, subRules, minCap, maxCap) => {
            const rawSum = subRules.reduce((acc, r) => acc + r.delta, 0);
            const clamped = Math.max(minCap, Math.min(maxCap, Number(rawSum.toFixed(2))));
            const scale = (rawSum !== 0 && Math.abs(clamped - rawSum) > 0.001) ? (clamped / rawSum) : 1.0;
            subRules.forEach((r) => {
                const eff = r.delta * scale;
                if (eff < 0) {
                    rawProtectiveWeightedSum += weight * eff;
                } else if (eff > 0) {
                    rawTotalDragWeightedSum += weight * eff;
                    if (r.modifiable !== false) {
                        rawModifiableDragWeightedSum += weight * eff;
                    }
                }
            });
            return {
                id,
                label,
                weight,
                measured: true,
                scoreEquivalentYears: clamped
            };
        };

        // =========================================================================
        // DOMINIO 1 (0.26): Composición Corporal, Adiposidad Visceral y Curva en J
        // =========================================================================
        const hasAnthroDomain = Boolean(bmi !== null || ica !== null || icc !== null || bodyFatPct !== null);
        if (hasAnthroDomain) {
            const d1Sub = [];
            const pushD1 = (delta, modifiable = true) => { if (delta !== 0) d1Sub.push({ delta, modifiable }); };
            const isUnderweightMalnutrition = bmi !== null && bmi < 18.5;
            const isGeriatricLowReserve = chronoAge >= 65 && bmi !== null && bmi >= 18.5 && bmi < 21.0 && !hasActiveExercise;

            if (isUnderweightMalnutrition) {
                pushD1(bmi < 17.0 ? 5.2 : 3.6, true);
                if (chronoAge >= 65) pushD1(1.2, true);
                modifiableLoadFactors.push(`baja reserva proteico-energética corporal (IMC ${bmi} kg/m²)`);
            } else if (isGeriatricLowReserve) {
                pushD1(2.2, true);
                modifiableLoadFactors.push(`reserva osteomuscular geriátrica disminuida (IMC ${bmi} kg/m²)`);
            } else if (isAthleticHighLeanMass) {
                if (bodyFatPct !== null && bodyFatPct <= (isFemale ? 22 : 15)) {
                    pushD1(-3.2, true);
                    protectiveFactors.push(`alta reserva muscular magra (${bodyFatPct} % grasa corporal; 0 penalización por IMC ${bmi || '--'})`);
                } else {
                    pushD1(-2.0, true);
                    protectiveFactors.push('composición atlética con baja adiposidad visceral (0 penalización por IMC muscular)');
                }
                if (ica !== null && ica < 0.49) {
                    pushD1(-1.0, true);
                    protectiveFactors.push(`relación cintura-estatura óptima (ICA ${ica})`);
                } else if (ica !== null && ica >= 0.54) {
                    pushD1(1.5, true);
                }
            } else {
                if (ica !== null) {
                    if (ica < 0.50) {
                        pushD1(-1.6, true);
                        protectiveFactors.push(`cintura-estatura saludable (ICA ${ica})`);
                    } else if (ica <= 0.54) {
                        pushD1(0.6, true);
                    } else if (ica <= 0.60) {
                        pushD1(2.2, true);
                        modifiableLoadFactors.push(`circunferencia abdominal central (ICA ${ica})`);
                    } else {
                        pushD1(4.2, true);
                        modifiableLoadFactors.push(`adiposidad central marcada (ICA ${ica})`);
                    }
                } else if (bmi !== null) {
                    if (bmi >= 18.5 && bmi < 25.0) {
                        pushD1(-1.2, true);
                        protectiveFactors.push(`índice de masa corporal en rango fisiológico (${bmi} kg/m²)`);
                    } else if (bmi >= 25.0 && bmi < 30.0) {
                        pushD1(1.6, true);
                        modifiableLoadFactors.push(`sobrepeso moderado (IMC ${bmi} kg/m²)`);
                    } else if (bmi >= 30.0 && bmi < 35.0) {
                        pushD1(3.8, true);
                        modifiableLoadFactors.push(`sobrecarga ponderal (IMC ${bmi} kg/m²)`);
                    } else if (bmi >= 35.0) {
                        pushD1(6.0, true);
                        modifiableLoadFactors.push(`sobrecarga ponderal grado II+ (IMC ${bmi} kg/m²)`);
                    }
                }

                if (icc !== null) {
                    if (icc < iccThreshold) {
                        pushD1(-0.6, true);
                    } else {
                        pushD1(icc >= (iccThreshold + 0.08) ? 1.8 : 1.0, true);
                        modifiableLoadFactors.push(`relación cintura-cadera física (ICC ${icc})`);
                    }
                }

                if (bodyFatPct !== null) {
                    if (bodyFatPct <= optimalFatMax) {
                        pushD1(-0.8, true);
                        protectiveFactors.push(`porcentaje de grasa corporal conservado (${bodyFatPct} %)`);
                    } else if (bodyFatPct <= optimalFatMax + 5) {
                        pushD1(0.8, true);
                    } else {
                        pushD1(2.2, true);
                        modifiableLoadFactors.push(`porcentaje de grasa corporal elevado (${bodyFatPct} %)`);
                    }
                }
            }
            domains.push(finalizeDomainWithSubRules(
                'ANTHROPOMETRY_ADIPOSITY',
                'Composición Corporal y Reserva Magra',
                DOMAIN_WEIGHTS_SSOT.ANTHROPOMETRY_ADIPOSITY,
                d1Sub,
                -6.0,
                9.0
            ));
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
        let isCleanAthleticVagalBradycardiaGlobal = false;

        const hasHemodynamicDomain = Boolean(sysBp > 0 || spo2Val > 0 || restHr > 0 || hasActiveExercise || isExplicitSedentary || cab.hasCabinetStudies);
        if (hasHemodynamicDomain) {
            const d2Sub = [];
            const pushD2 = (delta, modifiable = true) => { if (delta !== 0) d2Sub.push({ delta, modifiable }); };
            if (sysBp > 0 && diaBp > 0) {
                if (sysBp < 122 && diaBp < 80) {
                    if (anamnesis.hasAntihypertensiveMed) {
                        pushD2(0.5, false);
                        protectiveFactors.push(`presión arterial controlada bajo tratamiento médico (${sysBp}/${diaBp} mmHg)`);
                    } else {
                        pushD2(-1.2, true);
                        protectiveFactors.push(`presión arterial óptima (${sysBp}/${diaBp} mmHg)`);
                    }
                } else if (sysBp < 130 && diaBp < 85) {
                    pushD2(anamnesis.hasAntihypertensiveMed ? 0.5 : -0.3, !anamnesis.hasAntihypertensiveMed);
                } else if (sysBp < 140 && diaBp < 90) {
                    pushD2(2.0, true);
                    modifiableLoadFactors.push(`tensión arterial limítrofe (${sysBp}/${diaBp} mmHg)`);
                } else {
                    pushD2(4.8, true);
                    modifiableLoadFactors.push(`hipertensión arterial activa (${sysBp}/${diaBp} mmHg)`);
                }
            }
            if (spo2Val > 0) {
                if (spo2Val >= altitudeInfo.spo2NormalFloor) {
                    pushD2(spo2Val >= (altitudeInfo.spo2NormalFloor + 3) ? -0.6 : -0.2, true);
                    protectiveFactors.push(
                        altitudeInfo.msnm >= 1500
                            ? `oxigenación fisiológica adaptada a altitud (${spo2Val} % en ${altitudeInfo.msnm} msnm)`
                            : `saturación de oxígeno adecuada (${spo2Val} %)`
                    );
                } else {
                    pushD2(spo2Val < 89 ? 3.5 : 1.8, true);
                    modifiableLoadFactors.push(`hipoxemia relativa para altitud (${spo2Val} %)`);
                }
            }
            if (restHr > 90 && !(tempC >= 37.8)) {
                pushD2(restHr > 100 ? 2.4 : 1.4, true);
                modifiableLoadFactors.push(`frecuencia cardiaca basal elevada en reposo (${restHr} lpm)`);
            }
            if (hasActiveExercise) {
                pushD2((wkMin >= 240 || routes.has('GOAL_MUSCLE')) ? -2.2 : -1.4, true);
                protectiveFactors.push(
                    tcxValid
                        ? `actividad física estructurada validada (${wkMin || tcxValid.daily_minutes} min${wkMin ? '/sem' : '/día'})`
                        : 'hábito de ejercicio físico activo'
                );
            } else if (isExplicitSedentary) {
                pushD2(1.4, true);
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
            isCleanAthleticVagalBradycardiaGlobal = isCleanAthleticVagalBradycardia;
            if ((cab.hasCardiacConductionOrBradycardia && !isCleanAthleticVagalBradycardia) || cab.hasActiveTachyarrhythmia) {
                pushD2(cab.hasActiveTachyarrhythmia ? 2.2 : 0.9, cab.hasActiveTachyarrhythmia);
            }
            domains.push(finalizeDomainWithSubRules(
                'HEMODYNAMICS_ALTITUDE_FITNESS',
                'Hemodinámica, Oxigenación por Altitud y Aptitud Física',
                DOMAIN_WEIGHTS_SSOT.HEMODYNAMICS_ALTITUDE_FITNESS,
                d2Sub,
                -5.5,
                8.5
            ));
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
            const d3Sub = [];
            const pushD3 = (delta, modifiable = true) => { if (delta !== 0) d3Sub.push({ delta, modifiable }); };
            if (isPostprandialCapillaryOnly && !(effHba1c >= 6.5)) {
                if (effGlucose >= 200) {
                    pushD3(8.0, true);
                    modifiableLoadFactors.push(`hiperglucemia postprandial marcada (${effGlucose} mg/dL)`);
                } else if (effGlucose >= 140 || (effHba1c >= 5.7 && effHba1c < 6.5)) {
                    pushD3(3.2, true);
                    modifiableLoadFactors.push(`glucemia postprandial elevada (${effGlucose} mg/dL)`);
                } else if (effGlucose < 70) {
                    pushD3(2.0, true);
                    modifiableLoadFactors.push(`hipoglucemia capilar (${effGlucose} mg/dL)`);
                } else {
                    pushD3(anamnesis.hasGlucoseLoweringMed ? 0.5 : -0.8, !anamnesis.hasGlucoseLoweringMed);
                    protectiveFactors.push(`glucosa postprandial en rango fisiológico (${effGlucose} mg/dL)`);
                }
            } else {
                if (effGlucose >= 126 || effHba1c >= 6.5) {
                    pushD3((effGlucose >= 165 || effHba1c >= 7.5) ? 9.5 : 6.5, true);
                    modifiableLoadFactors.push(`desregulación glucémica (${effGlucose ? `Glucosa ${effGlucose} mg/dL` : `HbA1c ${effHba1c} %`})`);
                } else if ((effGlucose >= 100 && effGlucose < 126) || (effHba1c >= 5.7 && effHba1c < 6.5) || effHoma > 2.5) {
                    pushD3(3.2, true);
                    modifiableLoadFactors.push(`resistencia glucémica/insulínica temprana (${effGlucose ? `Glucosa ${effGlucose} mg/dL` : `HbA1c ${effHba1c} %`})`);
                } else if (effGlucose > 0 && effGlucose < 70) {
                    pushD3(2.0, true);
                    modifiableLoadFactors.push(`hipoglucemia en ayuno (${effGlucose} mg/dL)`);
                } else if (effGlucose >= 70 && effGlucose < 93 && (!effHba1c || effHba1c < 5.5)) {
                    if (anamnesis.hasGlucoseLoweringMed) {
                        pushD3(0.5, false);
                        protectiveFactors.push(`glucemia controlada bajo tratamiento médico (${effGlucose} mg/dL)`);
                    } else {
                        pushD3(-1.8, true);
                        protectiveFactors.push(`normoglucemia óptima en ayuno (${effGlucose} mg/dL)`);
                    }
                } else {
                    pushD3(anamnesis.hasGlucoseLoweringMed ? 0.5 : -0.8, !anamnesis.hasGlucoseLoweringMed);
                    protectiveFactors.push(`glucosa basal en rango saludable (${effGlucose || '--'} mg/dL)`);
                }
            }
            domains.push(finalizeDomainWithSubRules(
                'GLYCEMIC_METABOLISM',
                'Regulación Glucémica e Insulínica',
                DOMAIN_WEIGHTS_SSOT.GLYCEMIC_METABOLISM,
                d3Sub,
                -4.0,
                11.0
            ));
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
            const d4Sub = [];
            const pushD4 = (delta, modifiable = true) => { if (delta !== 0) d4Sub.push({ delta, modifiable }); };
            const hdlMin = isFemale ? 50 : 40;
            if (Number(labs.hdl) > 0) {
                if (labs.hdl >= hdlMin + 12) {
                    pushD4(-1.2, true);
                    protectiveFactors.push(`colesterol HDL cardioprotector (${labs.hdl} mg/dL)`);
                } else if (labs.hdl < hdlMin) {
                    pushD4(2.2, true);
                    modifiableLoadFactors.push(`colesterol HDL reducido para su sexo (${labs.hdl} mg/dL)`);
                }
            }
            if (Number(labs.triglycerides) > 0) {
                const tgHdlRatio = Number(labs.hdl) > 0 ? (labs.triglycerides / labs.hdl) : 0;
                if (labs.triglycerides < 110 && tgHdlRatio <= 3.0) {
                    pushD4(anamnesis.hasLipidLoweringMed ? 0.0 : -0.8, true);
                    protectiveFactors.push(`triglicéridos en rango óptimo (${labs.triglycerides} mg/dL)`);
                } else if (labs.triglycerides >= 220) {
                    pushD4(3.5, true);
                    modifiableLoadFactors.push(`hipertrigliceridemia (${labs.triglycerides} mg/dL)`);
                } else if (labs.triglycerides >= 150) {
                    pushD4(1.8, true);
                    modifiableLoadFactors.push(`triglicéridos elevados (${labs.triglycerides} mg/dL)`);
                } else if (tgHdlRatio > 3.0) {
                    pushD4(1.0, true);
                    modifiableLoadFactors.push(`relación TG/HDL elevada (${tgHdlRatio.toFixed(1)})`);
                }
            }
            // EGM-64: Cobertura continua de Colesterol no-HDL >= 130 mg/dL sin doble conteo
            if (Number(labs.ldl) >= 130 || Number(labs.sdLdl) > 1.35 || Number(labs.nonHdl) >= 130) {
                pushD4((Number(labs.ldl) >= 160 || Number(labs.sdLdl) > 1.6 || Number(labs.nonHdl) >= 190) ? 2.8 : 1.6, true);
                modifiableLoadFactors.push(`carga lipoproteica LDL/sdLDL (${labs.ldl ? `LDL ${labs.ldl} mg/dL` : `no-HDL ${labs.nonHdl} mg/dL`})`);
            } else if (Number(labs.ldl) > 0 && labs.ldl < 100 && (!labs.nonHdl || labs.nonHdl < 130)) {
                pushD4(anamnesis.hasLipidLoweringMed ? 0.5 : -0.8, !anamnesis.hasLipidLoweringMed);
            }
            if (!hasAcuteFever && Number(labs.hscrpMgL) > 0) {
                if (labs.hscrpMgL <= 1.2) {
                    pushD4(-0.7, true);
                    protectiveFactors.push(`proteína C reactiva ultrasensible tranquila (${labs.hscrpMgL} mg/L)`);
                } else if (labs.hscrpMgL > 3.0) {
                    pushD4(2.4, true);
                    modifiableLoadFactors.push(`inflamación vascular ultrasensible (PCR-us ${labs.hscrpMgL} mg/L)`);
                }
            }
            domains.push(finalizeDomainWithSubRules(
                'LIPOPROTEIN_VASCULAR',
                'Transporte Lipoproteico e Inflamación Endotelial',
                DOMAIN_WEIGHTS_SSOT.LIPOPROTEIN_VASCULAR,
                d4Sub,
                -4.0,
                9.5
            ));
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
            const d5Sub = [];
            const pushD5 = (delta, modifiable = true) => { if (delta !== 0) d5Sub.push({ delta, modifiable }); };
            const crUpper = isFemale ? 1.1 : 1.3;
            const uricUpper = isFemale ? 6.0 : 7.0;
            if (Number(labs.creatinine) > crUpper || (Number(labs.gfr) > 0 && labs.gfr < 60)) {
                pushD5((Number(labs.creatinine) >= 1.6 || (Number(labs.gfr) > 0 && labs.gfr < 45)) ? 7.5 : 4.0, true);
                modifiableLoadFactors.push(`sobrecarga en filtración renal (Cr ${labs.creatinine} mg/dL${labs.gfr ? ` • TFGe ${labs.gfr}` : ''})`);
            } else if (chronoAge < 40 && Number(labs.gfr) >= 60 && Number(labs.gfr) < 75) {
                pushD5(1.8, true);
                modifiableLoadFactors.push(`filtrado glomerular reducido para adulto joven (TFGe ${labs.gfr} mL/min)`);
            } else if (Number(labs.creatinine) > 0 || Number(labs.gfr) >= 60) {
                pushD5(-0.8, true);
                protectiveFactors.push(`función renal conservada (${labs.creatinine ? `Creatinina ${labs.creatinine} mg/dL` : `TFGe ${labs.gfr}`})`);
            }
            if (Number(labs.uricAcid) > uricUpper) {
                pushD5(1.6, true);
                modifiableLoadFactors.push(`ácido úrico elevado para su sexo (${labs.uricAcid} mg/dL)`);
            }
            if (Number(labs.alt) > 61 || Number(labs.ast) > 40 || Number(labs.ggt) > 61 || Number(labs.bilirubin) > 1.3) {
                pushD5(2.6, true);
                modifiableLoadFactors.push('sobrecarga enzimática o pigmentaria hepatobiliar');
            } else if (Number(labs.alt) > 0 && Number(labs.ast) > 0) {
                pushD5(-0.6, true);
                protectiveFactors.push('enzimas hepáticas en rango fisiológico');
            }
            if (Number(labs.albumin) > 0 && labs.albumin < 3.8) {
                pushD5(labs.albumin < 3.5 ? 4.0 : 2.0, true);
                modifiableLoadFactors.push(`reserva proteica visceral disminuida (Albúmina ${labs.albumin} g/dL)`);
            }
            if (Number(labs.rdw) > 14.8) {
                pushD5(1.8, true);
                modifiableLoadFactors.push(`anisocitosis eritrocitaria (RDW ${labs.rdw} %)`);
            }
            if (Number(labs.hemoglobin) > 0) {
                const hbFloor = (isFemale ? 12.0 : 13.5) + altitudeInfo.hbAltitudeOffset;
                if (labs.hemoglobin < hbFloor) {
                    pushD5(1.8, true);
                    modifiableLoadFactors.push(`hemoglobina baja para altitud (${labs.hemoglobin} g/dL)`);
                }
            }
            if (Number(labs.tsh) > 4.5 || (Number(labs.tsh) > 0 && labs.tsh < 0.35)) {
                pushD5(1.6, true);
                modifiableLoadFactors.push(`desajuste del eje tiroideo (TSH ${labs.tsh} mUI/L)`);
            }
            if (Number(labs.ferritin) > 0) {
                const ferrUpper = isFemale ? 250 : 350;
                if (labs.ferritin < 20) {
                    pushD5(1.2, true);
                    modifiableLoadFactors.push(`reserva férrica disminuida (Ferritina ${labs.ferritin} ng/mL)`);
                } else if (labs.ferritin > ferrUpper) {
                    pushD5(1.4, true);
                    modifiableLoadFactors.push(`hiperferritinemia metabólica/inflamatoria (${labs.ferritin} ng/mL)`);
                }
            }
            domains.push(finalizeDomainWithSubRules(
                'HEPATORENAL_HEMATOLOGY',
                'Filtración Hepatorrenal, Reserva Proteica y Hematología',
                DOMAIN_WEIGHTS_SSOT.HEPATORENAL_HEMATOLOGY,
                d5Sub,
                -3.5,
                10.5
            ));
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
            const d6Sub = [];
            const pushD6 = (delta, modifiable = true) => { if (delta !== 0) d6Sub.push({ delta, modifiable }); };
            if (anamnesis.isSmoker) {
                pushD6(anamnesis.isHeavySmoker ? 5.0 : 3.5, true);
                modifiableLoadFactors.push(anamnesis.isHeavySmoker ? 'tabaquismo activo intenso' : 'exposición activa a tabaco');
            }
            if (anamnesis.isHeavyAlcohol) {
                pushD6(2.8, true);
                modifiableLoadFactors.push('consumo alcohólico elevado');
            } else if (anamnesis.isFrequentAlcohol) {
                pushD6(1.5, true);
                modifiableLoadFactors.push('consumo frecuente de alcohol');
            }
            if (anamnesis.hasDrugUsage) {
                pushD6(3.0, true);
                modifiableLoadFactors.push('exposición a sustancias psicoactivas');
            }
            if (anamnesis.hasPoorSleep) {
                pushD6(1.6, true);
                modifiableLoadFactors.push(`deuda o fragmentación del sueño${anamnesis.sleepHours ? ` (${anamnesis.sleepHours} h/noche)` : ''}`);
            }
            if (anamnesis.hasHighStress) {
                pushD6(1.2, true);
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
                pushD6(-0.7, true);
                protectiveFactors.push('sueño reparador, estrés regulado y abstinencia de tabaco/alcohol');
            }

            domains.push(finalizeDomainWithSubRules(
                'ALLOSTATIC_TOXICOLOGY',
                'Carga Alostática, Sueño y Exposición Toxicológica',
                DOMAIN_WEIGHTS_SSOT.ALLOSTATIC_TOXICOLOGY,
                d6Sub,
                -1.0,
                9.0
            ));
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
            const electretAbnormalCategories = Object.values(rawElectretObj || {}).filter((cat) => {
                const items = Array.isArray(cat?.items) ? cat.items : (Array.isArray(cat) ? cat : []);
                return items.some((it) => {
                    const st = String(it?.status || it?.level || '').toUpperCase();
                    return st.includes('++') || st.includes('--') || st.includes('MODERAD') || st.includes('SEVER');
                });
            }).length;
            const pureBioelectricNudge = Math.min(1.0, Math.min(5, electretAbnormalCategories) * 0.2);
            if (modifiableLoadFactors.length === 0) {
                weightedDelta = Math.min(1.0, weightedDelta + pureBioelectricNudge);
            }
        }

        const clampedDeltaExact = Number(Math.max(-8.0, Math.min(12.0, weightedDelta)).toFixed(1));
        const metabolicAgeExact = Number(Math.max(18.0, chronoAge + clampedDeltaExact).toFixed(1));
        const metabolicAgeRounded = Math.round(metabolicAgeExact);
        const deltaYearsRounded = metabolicAgeRounded - chronoAge;

        // Tracción Opuesta Sub-Regla por Sub-Regla (EGM-69)
        const protectiveBonusYears = totalActiveWeight > 0
            ? Number(Math.abs(rawProtectiveWeightedSum / totalActiveWeight).toFixed(1))
            : 0;
        const totalDragYears = totalActiveWeight > 0
            ? Number((rawTotalDragWeightedSum / totalActiveWeight).toFixed(1))
            : 0;
        const modifiableDragYearsExact = totalActiveWeight > 0
            ? Number((rawModifiableDragWeightedSum / totalActiveWeight).toFixed(2))
            : 0;
        const modifiableDragYears = Number(modifiableDragYearsExact.toFixed(1));

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

        // EGM-70: Detección de Compensación Fisiológica Activa (prohíbe falso "Equilibrio" si hay dominio >= +1.8 o foco de gabinete)
        const maxSingleDomainScore = measuredDomains.reduce((mx, d) => Math.max(mx, d.scoreEquivalentYears), 0);
        const hasRelevantCabinetFocus = Boolean(
            cab.hasRbbbOrConductionBlock ||
            (cab.hasCardiacConductionOrBradycardia && !isCleanAthleticVagalBradycardiaGlobal) ||
            opts.serum?.cabinetSignals?.hasAorticOrThoracicRemodeling
        );
        const hasActiveCompensationFocalDrag = Boolean(
            Math.abs(clampedDeltaExact) <= 1.0 &&
            (maxSingleDomainScore >= 1.8 || hasRelevantCabinetFocus)
        );

        // EGM-69 (Fallo #4): Potencial Óptimo Desbloqueable separado en Ciclo 6 (180 Días)
        const d1Obj = measuredDomains.find((d) => d.id === 'ANTHROPOMETRY_ADIPOSITY');
        const hdlOptThreshold = isFemale ? 62 : 52;
        const hasReserveOptimizationMargin = Boolean(
            (d1Obj && d1Obj.scoreEquivalentYears > 0) ||
            (Number(labs.hdl) > 0 && labs.hdl < hdlOptThreshold) ||
            Number(labs.ldl) >= 100
        );
        const extraOptimizationMargin180d = hasReserveOptimizationMargin ? 0.5 : 0.2;
        const rawOptimalMax180d = metabolicAgeExact - ((modifiableDragYearsExact * 0.90) + extraOptimizationMargin180d);
        const floorAge180d = Math.max(18.0, Number((chronoAge - 8.0).toFixed(1)));
        const ceilingBelow90d = Math.max(floorAge180d, Number((cycle3ProjectionAge90d - 0.8).toFixed(1)));
        const cycle6OptimalMax180d = Math.max(floorAge180d, Math.min(ceilingBelow90d, Number(rawOptimalMax180d.toFixed(1))));
        const cycle6OptimalMin180d = Math.max(floorAge180d, Number((cycle6OptimalMax180d - 0.5).toFixed(1)));
        const cycle6RangeLabel180d = cycle6OptimalMin180d < cycle6OptimalMax180d
            ? `${cycle6OptimalMin180d} a ${cycle6OptimalMax180d} años`
            : `${cycle6OptimalMax180d} años`;

        // Clasificación en 3 Marcos de Retención (EGM-69)
        const narrativeMode = clampedDeltaExact >= 1.5
            ? 'MODO_RECUPERACION_CELULAR'
            : (clampedDeltaExact >= -0.9 && (modifiableDragYearsExact > 0 || hasActiveCompensationFocalDrag))
                ? 'MODO_DESBLOQUEO_POTENCIAL'
                : 'MODO_EXPANSION_RESERVA';

        const statusBadgeLabel = narrativeMode === 'MODO_RECUPERACION_CELULAR'
            ? `Sobrecarga Reversible: +${clampedDeltaExact} años`
            : hasActiveCompensationFocalDrag
                ? 'COMPENSACIÓN FISIOLÓGICA ACTIVA • FOCOS PRIORITARIOS POR OPTIMIZAR'
                : narrativeMode === 'MODO_DESBLOQUEO_POTENCIAL'
                    ? `Potencial por Desbloquear: ${clampedDeltaExact >= 0 ? `+${clampedDeltaExact}` : clampedDeltaExact} años`
                    : (clampedDeltaExact < -0.4 ? `Reserva Funcional Joven (${clampedDeltaExact} años)` : 'Reserva Funcional Conservada');

        const topProtectiveText = protectiveFactors.slice(0, 3).join(', ');
        const topModifiableText = modifiableLoadFactors.slice(0, 3).join(', ');

        const patientSummary = narrativeMode === 'MODO_RECUPERACION_CELULAR'
            ? `Su Edad Cronológica es de ${chronoAge} años y su Edad Metabólica estimada es de ${metabolicAgeExact} años (+${clampedDeltaExact} años • ${evidenceTierBadge}). Sus fortalezas actuales (${topProtectiveText || 'capacidad de adaptación funcional'}) le restan ya ${protectiveBonusYears} años de desgaste, mientras que los ejes modificables por atender (${topModifiableText || 'sobrecarga metabólica'}) retienen +${totalDragYears} años. En su Ciclo 1 (28 días) proyectamos avanzar hacia ${cycle1TargetAge28d} años (${cycle1Delta28d} años), en su Ciclo 3 (90 días) hacia ${cycle3ProjectionAge90d} años, y un Potencial Óptimo Desbloqueable en su Ciclo 6 (180 días) de ${cycle6RangeLabel180d}.`
            : narrativeMode === 'MODO_DESBLOQUEO_POTENCIAL'
                ? `Su Edad Cronológica (${chronoAge} años) y su Edad Metabólica actual (${metabolicAgeExact} años; ${clampedDeltaExact >= 0 ? `+${clampedDeltaExact}` : clampedDeltaExact} años • ${evidenceTierBadge}) reflejan una tracción opuesta activa: sus hábitos y constantes protectoras (${topProtectiveText || 'reserva cardiorrespiratoria y metabólica'}) ya le ganan -${protectiveBonusYears} años de vitalidad celular, pero hoy focos específicos (${topModifiableText || 'ejes clínicos prioritarios'}) le retienen +${totalDragYears} años. Al optimizarlos paso a paso, proyectamos ${cycle1TargetAge28d} años a 28 días, ${cycle3ProjectionAge90d} años a 90 días y un Potencial Óptimo Desbloqueable a 180 días (Ciclo 6) de ${cycle6RangeLabel180d}.`
                : `Su Edad Cronológica es de ${chronoAge} años y su Edad Metabólica actual es de ${metabolicAgeExact} años (${clampedDeltaExact} años • ${evidenceTierBadge}), respaldada por ${topProtectiveText || 'su composición corporal y vitalidad cardiometabólica'}. Nuestro enfoque de expansión de reserva funcional proyecta sostener y blindar esta ventaja hacia ${cycle1TargetAge28d} años (28 días) y ${cycle6RangeLabel180d} en su horizonte de 180 días (Healthspan).`;

        const clinicalSummary = `Estudio Multivariable EGM-51 v4 (${evidenceTierBadge} • ${measuredDomains.length}/6 dominios • Altitud ${altitudeInfo.msnm} msnm • ${narrativeMode}${hasActiveCompensationFocalDrag ? ' • COMPENSACIÓN FISIOLÓGICA ACTIVA' : ''}): Edad Cronológica ${chronoAge} a vs Edad Metabólica ${metabolicAgeExact} a (Delta ${clampedDeltaExact >= 0 ? `+${clampedDeltaExact}` : clampedDeltaExact} a | Tracción Opuesta: -${protectiveBonusYears} a protectores vs +${totalDragYears} a retenidos [+${modifiableDragYears} a modificables]). Meta Ciclo 1 (28d): ${cycle1TargetAge28d} a (${cycle1Delta28d} a) | Proyección Ciclo 3 (90d): ${cycle3ProjectionAge90d} a (${cycle3Delta90d} a) | Potencial Óptimo Ciclo 6 (180d): ${cycle6RangeLabel180d}.`;

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
            protectiveBonusYears,
            totalDragYears,
            modifiableDragYears,
            narrativeMode,
            hasActiveCompensationFocalDrag,
            statusBadgeLabel,
            cycle1TargetAge28d,
            cycle1Delta28d,
            cycle3ProjectionAge90d,
            cycle3Delta90d,
            cycle6OptimalMin180d,
            cycle6OptimalMax180d,
            cycle6RangeLabel180d,
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
            protectiveBonusYears: 0,
            totalDragYears: 0,
            modifiableDragYears: 0,
            narrativeMode: 'MODO_EXPANSION_RESERVA',
            hasActiveCompensationFocalDrag: false,
            statusBadgeLabel: 'Reserva Funcional Conservada',
            cycle1TargetAge28d: chronoAge,
            cycle1Delta28d: 0,
            cycle3ProjectionAge90d: chronoAge,
            cycle3Delta90d: 0,
            cycle6OptimalMin180d: chronoAge,
            cycle6OptimalMax180d: chronoAge,
            cycle6RangeLabel180d: `${chronoAge} años`,
            evidenceTier: 'CLINICO_ANTROPOMETRICO',
            evidenceTierBadge: 'Nivel III — Evaluación Clínica y Antropométrica Basal',
            evidenceConfidencePct: null,
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
            clinicalSummary: `Respaldo seguro EGM-51 v4: Edad Cronológica ${chronoAge} años.`
        };
    }
}

export {
    ENGINE_VERSION_SSOT,
    DOMAIN_WEIGHTS_SSOT,
    sanitizeBioelectricScreeningLabel,
    sanitizeArt215NonTherapeuticLexicon,
    extractUnifiedAnamnesisSignals,
    buildSafeDietaryExamplesSSoT,
    calculateUniversalMetabolicAgeSSoT
};
