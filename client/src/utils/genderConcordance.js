/**
 * Motor Canónico de Concordancia Gramatical por Sexo Biológico, Suplementación Contextual
 * y Normalización de Estado Clínico — Ecosistema T.I.L.O. (NOM-004 / CORTEX-V62.1)
 */

export function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyThreeTierCase(sourceMatch, targetLower) {
    if (!sourceMatch || !targetLower) return targetLower;
    const lettersOnly = String(sourceMatch).replace(/[^\p{L}]/gu, '');
    if (lettersOnly.length > 1 && lettersOnly === lettersOnly.toUpperCase()) {
        return targetLower.toUpperCase();
    }
    const first = String(sourceMatch).charAt(0);
    if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
        return targetLower.charAt(0).toUpperCase() + targetLower.slice(1);
    }
    return targetLower;
}

/**
 * Normaliza de forma case-insensitive todas las fuentes de sexo biológico del expediente.
 * Jamás evalúa 'm' como femenino ('M' = Masculino bajo NOM-004).
 */
export function resolvePatientSex(patientData = null, identityLock = null) {
    if (typeof patientData === 'boolean') {
        const code = patientData ? 'F' : 'M';
        return {
            isFemale: patientData,
            code,
            genderLock: code,
            label: patientData ? 'Femenino' : 'Masculino'
        };
    }
    if (typeof patientData === 'string') {
        const parsed = parseRawSexToken(patientData);
        if (parsed !== null) {
            const code = parsed ? 'F' : 'M';
            return {
                isFemale: parsed,
                code,
                genderLock: code,
                label: parsed ? 'Femenino' : 'Masculino'
            };
        }
    }

    const lockSource = identityLock || patientData?.identityLock || null;
    const candidates = [
        lockSource?.patientInfo?.gender,
        lockSource?.patientInfo?.sex,
        patientData?.profile?.sex,
        patientData?.profile?.gender,
        patientData?.identificacion?.sexo,
        patientData?.identificacion?.genero,
        patientData?.demographics?.sex,
        patientData?.demographics?.gender,
        patientData?.vitals?.sex,
        patientData?.sex,
        patientData?.sexo,
        patientData?.gender
    ];

    for (const raw of candidates) {
        const parsed = parseRawSexToken(raw);
        if (parsed !== null) {
            const code = parsed ? 'F' : 'M';
            return {
                isFemale: parsed,
                code,
                genderLock: code,
                label: parsed ? 'Femenino' : 'Masculino'
            };
        }
    }

    return { isFemale: false, code: 'M', genderLock: 'M', label: 'Masculino' };
}

function parseRawSexToken(raw) {
    if (raw === null || raw === undefined) return null;
    const norm = String(raw)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (!norm) return null;

    if (
        norm === 'f' ||
        norm === '2' ||
        norm === 'femenino' ||
        norm === 'female' ||
        norm === 'mujer' ||
        norm === 'femenina' ||
        norm === 'nina' ||
        norm === 'la paciente'
    ) {
        return true;
    }

    if (
        norm === 'm' ||
        norm === 'h' ||
        norm === '1' ||
        norm === 'masculino' ||
        norm === 'male' ||
        norm === 'hombre' ||
        norm === 'varon' ||
        norm === 'nino' ||
        norm === 'el paciente'
    ) {
        return false;
    }

    if (norm.startsWith('fem') || norm.startsWith('muj')) return true;
    if (norm.startsWith('masc') || norm.startsWith('homb') || norm.startsWith('var')) return false;
    return null;
}

export function g(isFemale, masc, fem) {
    return Boolean(isFemale) ? fem : masc;
}

const GENDERED_TERMS_MAP = {
    bienvenido: ['bienvenido', 'bienvenida'],
    estimado: ['estimado', 'estimada'],
    listo: ['listo', 'lista'],
    seguro: ['seguro', 'segura'],
    registrado: ['registrado', 'registrada'],
    candidato: ['candidato', 'candidata'],
    experto: ['experto', 'experta'],
    preparado: ['preparado', 'preparada'],
    tranquilo: ['tranquilo', 'tranquila'],
    quieto: ['quieto', 'quieta'],
    sentado: ['sentado', 'sentada'],
    recostado: ['recostado', 'recostada'],
    acostado: ['acostado', 'acostada'],
    erguido: ['erguido', 'erguida'],
    sometido: ['sometido', 'sometida'],
    operado: ['operado', 'operada'],
    intervenido: ['intervenido', 'intervenida'],
    diagnosticado: ['diagnosticado', 'diagnosticada'],
    evaluado: ['evaluado', 'evaluada'],
    sano: ['sano', 'sana'],
    solo: ['solo', 'sola'],
    protegido: ['protegido', 'protegida'],
    protegida: ['protegido', 'protegida'],
    alergico: ['alérgico', 'alérgica'],
    'alérgico': ['alérgico', 'alérgica'],
    cansado: ['cansado', 'cansada'],
    agotado: ['agotado', 'agotada'],
    hidratado: ['hidratado', 'hidratada'],
    inflamado: ['inflamado', 'inflamada'],
    motivado: ['motivado', 'motivada'],
    acompanado: ['acompañado', 'acompañada'],
    'acompañado': ['acompañado', 'acompañada'],
    dispuesto: ['dispuesto', 'dispuesta'],
    interesado: ['interesado', 'interesada'],
    sedentario: ['sedentario', 'sedentaria'],
    jubilado: ['jubilado', 'jubilada'],
    pensionado: ['pensionado', 'pensionada'],
    soltero: ['soltero', 'soltera'],
    casado: ['casado', 'casada'],
    divorciado: ['divorciado', 'divorciada'],
    viudo: ['viudo', 'viuda'],
    hijo: ['hijo', 'hija'],
    nino: ['niño', 'niña'],
    'niño': ['niño', 'niña']
};

export function getGenderedTerm(term, sexOrIsFemale, identityLock = null) {
    if (!term) return term;
    if (sexOrIsFemale === null || sexOrIsFemale === undefined || sexOrIsFemale === '') {
        return term;
    }
    const { isFemale } = typeof sexOrIsFemale === 'boolean'
        ? { isFemale: sexOrIsFemale }
        : resolvePatientSex(sexOrIsFemale, identityLock);

    const key = String(term).trim().toLowerCase();
    const pair = GENDERED_TERMS_MAP[key];
    if (!pair) return term;

    const chosen = isFemale ? pair[1] : pair[0];
    // Preserve historical TitleCase default when caller passed lowercase key like getGenderedTerm('bienvenido', sex)
    const callerWasLower = String(term) === String(term).toLowerCase();
    if (callerWasLower) {
        return chosen.charAt(0).toUpperCase() + chosen.slice(1);
    }
    return applyThreeTierCase(term, chosen);
}

/**
 * Diccionario cerrado (whitelist estricta) de términos humanos con barra o paréntesis.
 * Jamás toca unidades ni razones bioquímicas (kcal/día, A/G, EPA/DHA, N/A, mg/dL, S/N).
 */
const CLOSED_GENDER_SLASH_DICTIONARY = [
    ['sometidos/as', ['sometidos', 'sometidas']],
    ['sometidos(as)', ['sometidos', 'sometidas']],
    ['sometido/a', ['sometido', 'sometida']],
    ['sometido(a)', ['sometido', 'sometida']],
    ['operados/as', ['operados', 'operadas']],
    ['operados(as)', ['operados', 'operadas']],
    ['operado/a', ['operado', 'operada']],
    ['operado(a)', ['operado', 'operada']],
    ['intervenidos/as', ['intervenidos', 'intervenidas']],
    ['intervenido/a', ['intervenido', 'intervenida']],
    ['intervenido(a)', ['intervenido', 'intervenida']],
    ['diagnosticados/as', ['diagnosticados', 'diagnosticadas']],
    ['diagnosticado/a', ['diagnosticado', 'diagnosticada']],
    ['diagnosticado(a)', ['diagnosticado', 'diagnosticada']],
    ['dispuestos/as', ['dispuestos', 'dispuestas']],
    ['dispuesto/a', ['dispuesto', 'dispuesta']],
    ['dispuesto(a)', ['dispuesto', 'dispuesta']],
    ['interesados/as', ['interesados', 'interesadas']],
    ['interesado/a', ['interesado', 'interesada']],
    ['interesado(a)', ['interesado', 'interesada']],
    ['estimados/as', ['estimados', 'estimadas']],
    ['estimado/a', ['estimado', 'estimada']],
    ['estimado(a)', ['estimado', 'estimada']],
    ['bienvenidos/as', ['bienvenidos', 'bienvenidas']],
    ['bienvenido/a', ['bienvenido', 'bienvenida']],
    ['bienvenido(a)', ['bienvenido', 'bienvenida']],
    ['sentados/as', ['sentados', 'sentadas']],
    ['sentado/a', ['sentado', 'sentada']],
    ['sentado(a)', ['sentado', 'sentada']],
    ['recostados/as', ['recostados', 'recostadas']],
    ['recostado/a', ['recostado', 'recostada']],
    ['recostado(a)', ['recostado', 'recostada']],
    ['acostados/as', ['acostados', 'acostadas']],
    ['acostado/a', ['acostado', 'acostada']],
    ['acostado(a)', ['acostado', 'acostada']],
    ['erguidos/as', ['erguidos', 'erguidas']],
    ['erguido/a', ['erguido', 'erguida']],
    ['erguido(a)', ['erguido', 'erguida']],
    ['quietos/as', ['quietos', 'quietas']],
    ['quieto/a', ['quieto', 'quieta']],
    ['quieto(a)', ['quieto', 'quieta']],
    ['tranquilos/as', ['tranquilos', 'tranquilas']],
    ['tranquilo/a', ['tranquilo', 'tranquila']],
    ['tranquilo(a)', ['tranquilo', 'tranquila']],
    ['cansados/as', ['cansados', 'cansadas']],
    ['cansado/a', ['cansado', 'cansada']],
    ['cansado(a)', ['cansado', 'cansada']],
    ['agotados/as', ['agotados', 'agotadas']],
    ['agotado/a', ['agotado', 'agotada']],
    ['agotado(a)', ['agotado', 'agotada']],
    ['hidratados/as', ['hidratados', 'hidratadas']],
    ['hidratado/a', ['hidratado', 'hidratada']],
    ['hidratado(a)', ['hidratado', 'hidratada']],
    ['inflamados/as', ['inflamados', 'inflamadas']],
    ['inflamado/a', ['inflamado', 'inflamada']],
    ['inflamado(a)', ['inflamado', 'inflamada']],
    ['motivados/as', ['motivados', 'motivadas']],
    ['motivado/a', ['motivado', 'motivada']],
    ['motivado(a)', ['motivado', 'motivada']],
    ['acompañados/as', ['acompañados', 'acompañadas']],
    ['acompañado/a', ['acompañado', 'acompañada']],
    ['acompañado(a)', ['acompañado', 'acompañada']],
    ['listos/as', ['listos', 'listas']],
    ['listo/a', ['listo', 'lista']],
    ['listo(a)', ['listo', 'lista']],
    ['seguros/as', ['seguros', 'seguras']],
    ['seguro/a', ['seguro', 'segura']],
    ['seguro(a)', ['seguro', 'segura']],
    ['sanos/as', ['sanos', 'sanas']],
    ['sano/a', ['sano', 'sana']],
    ['sano(a)', ['sano', 'sana']],
    ['alérgicos/as', ['alérgicos', 'alérgicas']],
    ['alérgico/a', ['alérgico', 'alérgica']],
    ['alérgico(a)', ['alérgico', 'alérgica']],
    ['alergico/a', ['alérgico', 'alérgica']],
    ['alergico(a)', ['alérgico', 'alérgica']],
    ['un niño/a', ['un niño', 'una niña']],
    ['un niño(a)', ['un niño', 'una niña']],
    ['el niño/a', ['el niño', 'la niña']],
    ['el niño(a)', ['el niño', 'la niña']],
    ['un hijo/a', ['un hijo', 'una hija']],
    ['un hijo(a)', ['un hijo', 'una hija']],
    ['niños/as', ['niños', 'niñas']],
    ['niño/a', ['niño', 'niña']],
    ['niño(a)', ['niño', 'niña']],
    ['hijos/as', ['hijos', 'hijas']],
    ['hijo/a', ['hijo', 'hija']],
    ['hijo(a)', ['hijo', 'hija']],
    ['jubilados/as', ['jubilados', 'jubiladas']],
    ['jubilado/a', ['jubilado', 'jubilada']],
    ['jubilado(a)', ['jubilado', 'jubilada']],
    ['pensionados/as', ['pensionados', 'pensionadas']],
    ['pensionado/a', ['pensionado', 'pensionada']],
    ['pensionado(a)', ['pensionado', 'pensionada']],
    ['sedentarios/as', ['sedentarios', 'sedentarias']],
    ['sedentario/a', ['sedentario', 'sedentaria']],
    ['sedentario(a)', ['sedentario', 'sedentaria']],
    ['él/ella', ['él', 'ella']]
];

const COMPILED_GENDER_PATTERNS = CLOSED_GENDER_SLASH_DICTIONARY.map(([token, pair]) => ({
    regex: new RegExp(`(?<![\\p{L}\\p{N}_\\/])${escapeRegExp(token)}(?![\\p{L}\\p{N}_\\/])`, 'giu'),
    pair
}));

export function enforcePatientGenderConcordance(text, sexOrIsFemale = false) {
    if (text === null || text === undefined) return '';
    if (typeof text !== 'string') return String(text);
    const isFemale = typeof sexOrIsFemale === 'boolean'
        ? sexOrIsFemale
        : resolvePatientSex(sexOrIsFemale).isFemale;

    let result = text;
    for (const { regex, pair } of COMPILED_GENDER_PATTERNS) {
        const targetLower = isFemale ? pair[1] : pair[0];
        result = result.replace(regex, (matched) => applyThreeTierCase(matched, targetLower));
    }
    return result;
}

/**
 * Ejemplo contextual de dosis/frecuencia para suplementos (Fase 6).
 * 33Plus® y 34Plus® se presentan oficialmente en sobre individual.
 */
export function getContextualSupplementExample(supplementName = '') {
    const raw = String(supplementName || '').trim();
    const norm = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (/(?:33\s*[-+]?\s*(?:plus|\+)|multisinergix)/i.test(norm)) {
        return '1 sobre en la mañana';
    }
    if (/(?:34\s*[-+]?\s*(?:plus|\+)|aminosinergix)/i.test(norm)) {
        return '1 sobre por la tarde o antes de dormir';
    }
    if (/\b(sobre|sobres|sachet|sachets)\b/i.test(norm)) {
        return '1 sobre al día';
    }
    if (/\b(te|infusion|manzanilla|hierba|tisana)\b/i.test(norm)) {
        return '1 taza por la noche';
    }
    if (/\b(gota|gotas|sublingual|extracto|tintura|jarabe|ml)\b/i.test(norm)) {
        return '10 gotas en la mañana';
    }
    if (/\b(vitamina|omega|magnesio|zinc|calcio|hierro|complejo\s*b|probiotico|capsula|tableta|pastilla|perla|gomita|melatonina|coenzima|coq10|colageno\s+en\s+capsulas)\b/i.test(norm)) {
        return '1 cápsula en la mañana';
    }
    return '1 medida o scoop en la mañana';
}

const NEGATED_SENTINEL_REGEX = /^(ninguna?|ninguno|ningun[oa]\s+declarad[oa]|niega|negad[oa]s?|sin\s+registros?(?:\s+declarados?)?|sin\s+alergias?|sin\s+medicamentos?|sin\s+suplementos?|sin\s+sintomas?|no|no\s+aplica|no\s+refiere|n\/a|na|null|undefined|-+)$/i;

export function isNegatedSentinelValue(item) {
    if (item === null || item === undefined) return true;
    if (typeof item === 'string') {
        const clean = item.trim();
        return !clean || NEGATED_SENTINEL_REGEX.test(clean);
    }
    if (typeof item === 'object') {
        const primary = item.name ?? item.nombre ?? item.agent ?? item.agente ?? item.symptom ?? item.sintoma ?? item.label ?? '';
        const clean = String(primary).trim();
        return !clean || NEGATED_SENTINEL_REGEX.test(clean);
    }
    return false;
}

export function stripNegatedSentinels(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((item) => !isNegatedSentinelValue(item));
}

/**
 * Filtra anexos .tcx / .gpx huérfanos cuando la actividad física está en modo MANUAL,
 * preservando 100% intactos PDFs, imágenes clínicas, capturas Electret, fotos oculares/linguales/somáticas.
 */
export function filterOrphanTelemetryAnnexes(annexes, isManualExercise = true) {
    if (!Array.isArray(annexes)) return annexes;
    if (!isManualExercise) return annexes;
    return annexes.filter((annex) => {
        if (!annex) return false;
        const fileName = String(
            annex.filename || annex.file_name || annex.fileName || annex.originalname || annex.name || annex.path || annex.url || ''
        ).trim().toLowerCase();
        const fileType = String(annex.file_type || annex.fileType || annex.mimeType || annex.mimetype || '').trim().toUpperCase();
        if (fileType === 'TCX' || fileType === 'GPX' || fileType.includes('TCX') || fileType.includes('GPX')) return false;
        if (fileName.endsWith('.tcx') || fileName.endsWith('.gpx') || fileName.endsWith('.tcx.xml') || fileName.endsWith('.gpx.xml')) {
            return false;
        }
        return true;
    });
}

/**
 * Resuelve la telemetría activa de ejercicio exigiendo source_type === 'TELEMETRY_TCX'
 * en la fuente canónica (lifestyle_profile > clinical_context > lifestyle legado).
 * Si lifestyle_profile.activity.source_type === 'MANUAL', ignora cualquier residuo legado en lifestyle y devuelve null.
 */
export function resolveActiveExerciseTelemetry(patientData) {
    if (!patientData || typeof patientData !== 'object') {
        return null;
    }

    const lpAct = patientData.lifestyle_profile?.activity;
    const ccAct = patientData.clinical_context?.activity?.exercise;
    const legacyAct = patientData.lifestyle?.activity;

    let sourceType = 'MANUAL';
    if (lpAct && lpAct.source_type) {
        sourceType = lpAct.source_type;
    } else if (ccAct && ccAct.source_type) {
        sourceType = ccAct.source_type;
    } else if (legacyAct && legacyAct.source_type) {
        sourceType = legacyAct.source_type;
    }

    if (sourceType !== 'TELEMETRY_TCX') {
        return null;
    }

    return (
        lpAct?.telemetry_metadata ||
        ccAct?.telemetry_metadata ||
        legacyAct?.telemetry_metadata ||
        null
    );
}
