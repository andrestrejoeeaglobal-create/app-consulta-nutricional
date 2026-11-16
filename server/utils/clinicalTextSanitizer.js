/**
 * Sanitizador Clínico Determinista, Normalizador Ortográfico y Predicado Fisiológico
 * Ecosistema T.I.L.O. - Cumplimiento NOM-004-SSA3-2012
 *
 * Regla de Ingeniería:
 * - Prohibido el uso de \b (ASCII-only) para reemplazos léxicos en español.
 * - Todas las fronteras de palabra emplean escapes Unicode (?<![\p{L}\p{N}_])...(?![\p{L}\p{N}_]) con bandera 'giu'.
 */

function matchCase(sourceWord, targetLower, targetCapitalized) {
    if (!sourceWord) return targetLower;
    if (sourceWord === sourceWord.toUpperCase() && sourceWord.length > 1) {
        return targetCapitalized.toUpperCase();
    }
    const first = sourceWord.charAt(0);
    if (first === first.toUpperCase() && first !== first.toLowerCase()) {
        return targetCapitalized;
    }
    return targetLower;
}

const UNICODE_WORD_FIXES = [
    // 1. Neologismos rotos por reemplazos previos sin anclas ("vas" -> "vías", "raz" -> "raíz")
    [/cardiov[íi]asculares/giu, (m) => matchCase(m, 'cardiovasculares', 'Cardiovasculares')],
    [/cardiov[íi]ascular/giu, (m) => matchCase(m, 'cardiovascular', 'Cardiovascular')],
    [/cerebrov[íi]asculares/giu, (m) => matchCase(m, 'cerebrovasculares', 'Cerebrovasculares')],
    [/cerebrov[íi]ascular/giu, (m) => matchCase(m, 'cerebrovascular', 'Cerebrovascular')],
    [/microv[íi]asculares/giu, (m) => matchCase(m, 'microvasculares', 'Microvasculares')],
    [/microv[íi]ascular/giu, (m) => matchCase(m, 'microvascular', 'Microvascular')],
    [/periv[íi]asculares/giu, (m) => matchCase(m, 'perivasculares', 'Perivasculares')],
    [/periv[íi]ascular/giu, (m) => matchCase(m, 'perivascular', 'Perivascular')],
    [/endov[íi]asculares/giu, (m) => matchCase(m, 'endovasculares', 'Endovasculares')],
    [/endov[íi]ascular/giu, (m) => matchCase(m, 'endovascular', 'Endovascular')],
    [/neurov[íi]ascular/giu, (m) => matchCase(m, 'neurovascular', 'Neurovascular')],
    [/renov[íi]ascular/giu, (m) => matchCase(m, 'renovascular', 'Renovascular')],
    [/v[íi]ascularizaci[óo•\ufffd]n/giu, (m) => matchCase(m, 'vascularización', 'Vascularización')],
    [/v[íi]asculares/giu, (m) => matchCase(m, 'vasculares', 'Vasculares')],
    [/v[íi]ascular/giu, (m) => matchCase(m, 'vascular', 'Vascular')],
    [/(?<![\p{L}\p{N}_])v[íi]asos(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'vasos', 'Vasos')],
    [/(?<![\p{L}\p{N}_])v[íi]aso(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'vaso', 'Vaso')],
    [/inv[íi]asiv(o|a|os|as)/giu, (m, suf) => matchCase(m, `invasiv${suf.toLowerCase()}`, `Invasiv${suf.toLowerCase()}`)],
    [/significativ[íi]as/giu, (m) => matchCase(m, 'significativas', 'Significativas')],
    [/ev[íi]asluaci[óo•\ufffd]n/giu, (m) => matchCase(m, 'evaluación', 'Evaluación')],
    [/v[íi]aslor/giu, (m) => matchCase(m, 'valor', 'Valor')],
    [/cora[íi]z[óo]n/giu, (m) => matchCase(m, 'corazón', 'Corazón')],

    // 2. Mojibake UTF-8 / Windows-1252 (• y \ufffd dentro de palabras en español)
    [/(?<![\p{L}\p{N}_])est[•\ufffd]ndar(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'estándar', 'Estándar')],
    [/(?<![\p{L}\p{N}_])p[•\ufffd]rdidas?(?![\p{L}\p{N}_])/giu, (m) => {
        const plural = /s$/i.test(m) ? 's' : '';
        return matchCase(m, `pérdida${plural}`, `Pérdida${plural}`);
    }],
    [/(?<![\p{L}\p{N}_])d[•\ufffd]cadas?(?![\p{L}\p{N}_])/giu, (m) => {
        const plural = /s$/i.test(m) ? 's' : '';
        return matchCase(m, `década${plural}`, `Década${plural}`);
    }],
    [/(?<![\p{L}\p{N}_])r[•\ufffd]pid(o|a|os|as)(?![\p{L}\p{N}_])/giu, (m, suf) => matchCase(m, `rápid${suf.toLowerCase()}`, `Rápid${suf.toLowerCase()}`)],
    [/(?<![\p{L}\p{N}_])f[•\ufffd]?sic(o|a|os|as)(?![\p{L}\p{N}_])/giu, (m, suf) => matchCase(m, `físic${suf.toLowerCase()}`, `Físic${suf.toLowerCase()}`)],
    [/(?<![\p{L}\p{N}_])cat[•\ufffd]?lic(o|a|os|as)(?![\p{L}\p{N}_])/giu, (m, suf) => matchCase(m, `católic${suf.toLowerCase()}`, `Católic${suf.toLowerCase()}`)],
    [/(?<![\p{L}\p{N}_])m[•\ufffd]xico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'méxico', 'México')],
    [/(?<![\p{L}\p{N}_])quer[•\ufffd]taro(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'querétaro', 'Querétaro')],
    [/(?<![\p{L}\p{N}_])a[•\ufffd]os(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'años', 'Años')],
    // Sufijos -ción / -sión con bala o carácter de reemplazo (ej. oxidaci•n, absorci•n, presi•n)
    [/([\p{L}]+?[cs])i[•\ufffd]n(?![\p{L}\p{N}_])/giu, (_, prefix) => `${prefix}ión`],
    [/([\p{L}]+?)ol[•\ufffd]gic(o|a|os|as)(?![\p{L}\p{N}_])/giu, (_, prefix, suf) => `${prefix}ológic${suf}`],
    [/([\p{L}]+?)[•\ufffd]mic(o|a|os|as)(?![\p{L}\p{N}_])/giu, (_, prefix, suf) => `${prefix}émic${suf}`],

    // 3. Ortografía y acentuación médica (Catálogo Electret + Textos Clínicos)
    [/(?<![\p{L}\p{N}_])lipo\s*prote[íi]nas?\s+de\s+muy\s+baja\s+den[cs]idad(?:\s*\(\s*vldl(?:-c)?\s*\))?/giu, (m) =>
        /vldl/i.test(m) ? 'Lipoproteínas de Muy Baja Densidad (VLDL-C)' : 'Lipoproteínas de Muy Baja Densidad'],
    [/(?<![\p{L}\p{N}_])lipo\s*prote[íi]nas?\s+de\s+alta\s+den[cs]idad(?:\s*\(\s*hdl(?:-c)?\s*\))?/giu, (m) =>
        /hdl/i.test(m) ? 'Lipoproteínas de Alta Densidad (HDL-C)' : 'Lipoproteínas de Alta Densidad'],
    [/(?<![\p{L}\p{N}_])lipo\s*prote[íi]nas?\s+de\s+baja\s+den[cs]idad(?:\s*\(\s*ldl(?:-c)?\s*\))?/giu, (m) =>
        /ldl/i.test(m) ? 'Lipoproteínas de Baja Densidad (LDL-C)' : 'Lipoproteínas de Baja Densidad'],
    [/(?<![\p{L}\p{N}_])lipo\s+prote[íi]nas(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'lipoproteínas', 'Lipoproteínas')],
    [/(?<![\p{L}\p{N}_])dencidad(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'densidad', 'Densidad')],
    [/(?<![\p{L}\p{N}_])hipotalmico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'hipotalámico', 'Hipotalámico')],
    [/(?<![\p{L}\p{N}_])hipotalamico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'hipotalámico', 'Hipotalámico')],
    [/(?<![\p{L}\p{N}_])proteinas(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'proteínas', 'Proteínas')],
    [/(?<![\p{L}\p{N}_])proteina(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'proteína', 'Proteína')],
    [/(?<![\p{L}\p{N}_])[iïìî]ndices(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'índices', 'Índices')],
    [/(?<![\p{L}\p{N}_])[iïìî]ndice(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'índice', 'Índice')],
    [/(?<![\p{L}\p{N}_])trigliceridos(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'triglicéridos', 'Triglicéridos')],
    [/(?<![\p{L}\p{N}_])triglicerido(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'triglicérido', 'Triglicérido')],
    [/(^|[\s(•,;:"'])la\s+tiroglobulina(?![\p{L}\p{N}_])/giu, (_, pre) => `${pre}Tiroglobulina`],
    [/Osteocalcina\s*\(\s*BGP\s*\)/giu, 'Osteocalcina (BGP)'],
    [/(?<![\p{L}\p{N}_])[iíïìî]ndice\s+de\s+stroke(?![\p{L}\p{N}_])/giu, 'Índice de Riesgo Cerebrovascular'],
    [/(?<![\p{L}\p{N}_])sistolico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'sistólico', 'Sistólico')],
    [/(?<![\p{L}\p{N}_])sistolica(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'sistólica', 'Sistólica')],
    [/(?<![\p{L}\p{N}_])diastolico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'diastólico', 'Diastólico')],
    [/(?<![\p{L}\p{N}_])diastolica(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'diastólica', 'Diastólica')],
    [/(?<![\p{L}\p{N}_])periferica(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'periférica', 'Periférica')],
    [/(?<![\p{L}\p{N}_])periferico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'periférico', 'Periférico')],
    [/(?<![\p{L}\p{N}_])saturacion(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'saturación', 'Saturación')],
    [/(?<![\p{L}\p{N}_])presion(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'presión', 'Presión')],
    [/(?<![\p{L}\p{N}_])oxigeno(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'oxígeno', 'Oxígeno')],
    [/(?<![\p{L}\p{N}_])numero(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'número', 'Número')],
    [/(?<![\p{L}\p{N}_])licuefaccion(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'licuefacción', 'Licuefacción')],
    [/(?<![\p{L}\p{N}_])estomago(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'estómago', 'Estómago')],
    [/(?<![\p{L}\p{N}_])vesicula(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'vesícula', 'Vesícula')],
    [/(?<![\p{L}\p{N}_])circulacion(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'circulación', 'Circulación')],
    [/(?<![\p{L}\p{N}_])sangre\s+miocardial(?![\p{L}\p{N}_])/giu, 'Sangre Miocárdica'],
    [/(?<![\p{L}\p{N}_])sangu[íi]nea\s+miocardial(?![\p{L}\p{N}_])/giu, 'Sanguínea Miocárdica'],
    [/(?<![\p{L}\p{N}_])ox[íi]geno\s+miocardial(?![\p{L}\p{N}_])/giu, 'Oxígeno Miocárdico']
];

function deduplicateRepeatedClauseVerbs(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(
        /(?<![\p{L}\p{N}_])(sugieren|sugiere|indican|indica|muestran|muestra|reflejan|refleja|evidencian|evidencia|apuntan\s+a|apunta\s+a|observan|observa)(?![\p{L}\p{N}_])([^.!?;]+?)\s+(?:y|e)\s+\1(?![\p{L}\p{N}_])\s+([\p{L}\p{N}_]+)/giu,
        (_, verb, middle, nextWord) => {
            const conj = /^(?:i|hi(?![aeouáéóú]))/iu.test(nextWord) ? 'e' : 'y';
            return `${verb}${middle} ${conj} ${nextWord}`;
        }
    );
}

function normalizeMetricDecimals(rawStr) {
    if (rawStr === null || rawStr === undefined) return '';
    return String(rawStr)
        .replace(/(\d),(\d+)(?!\s*(?:pasos|kcal)\b)/gu, '$1.$2');
}

function joinSpanishList(rawItems) {
    const items = (Array.isArray(rawItems) ? rawItems : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    const head = items.slice(0, -1).join(', ');
    const last = items[items.length - 1];
    const firstWordOfLast = last.replace(/^[^\p{L}]+/u, '');
    const conj = /^(?:i|hi(?![aeouáéóú]))/iu.test(firstWordOfLast) ? 'e' : 'y';
    return `${head} ${conj} ${last}`;
}

function sanitizeClinicalSpanish(rawText) {
    if (rawText === null || rawText === undefined) return '';
    if (typeof rawText !== 'string') return String(rawText);
    let text = rawText;
    for (const [pattern, replacement] of UNICODE_WORD_FIXES) {
        text = text.replace(pattern, replacement);
    }
    // Homologación NOM-008-SCFI: punto decimal consistente dentro de bloques de referencia "(Ref: ...)"
    text = text.replace(/\(\s*Ref:\s*([^)|]+)/giu, (m) => m.replace(/(\d),(\d+)/g, '$1.$2'));
    text = deduplicateRepeatedClauseVerbs(text);
    return text;
}

/**
 * Predicado canónico de normalidad fisiológica.
 * Reconoce NORMAL, NORMAL (-), NORMAL (+), NORMALES, OPTIMAL, OPTIMO, ÓPTIMO, NEGATIVO, CONSERVADO, HOMEOSTASIS.
 */
function isPhysiologicallyNormal(statusStr) {
    if (statusStr === null || statusStr === undefined) return true;
    const s = String(statusStr).trim().toUpperCase();
    if (!s || s === '-' || s === 'N/A' || s === 'NONE') return true;
    if (
        s === 'NORMAL' ||
        s === 'NORMALES' ||
        s.startsWith('NORMAL ') ||
        s.startsWith('NORMAL(') ||
        s === 'OPTIMAL' ||
        s.startsWith('OPTIMAL ') ||
        s === 'OPTIMO' ||
        s === 'ÓPTIMO' ||
        s.startsWith('OPTIMO ') ||
        s.startsWith('ÓPTIMO ') ||
        s === 'NEGATIVO' ||
        s === 'CONSERVADO' ||
        s === 'HOMEOSTASIS' ||
        s === 'DENTRO DE RANGO' ||
        s === 'SIN ALTERACIONES'
    ) {
        return true;
    }
    return false;
}

/**
 * Normaliza cadenas para matching tolerante entre reportes crudos de hardware Electret
 * (ej. "Lipo Proteinas de Alta dencidad (HDL-C)") y versiones corregidas.
 */
function normalizeForMatch(str) {
    if (!str) return '';
    return sanitizeClinicalSpanish(String(str))
        .replace(/&nbsp;/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\bdencidad\b/g, 'densidad')
        .replace(/\bhipotalmico\b/g, 'hipotalamico')
        .replace(/\blipo\s*proteinas?\b/g, 'lipoproteinas')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, '_')
        .replace(/^_+|_+$/g, '');
}

const PROTECTED_SNAPSHOT_KEYS = new Set([
    'id', 'userId', 'usuarioId', 'user_id', 'citaId', 'idCita', 'citationId', 'citation_id',
    'curp', 'rfc', 'key', 'nodeId', 'cie10', 'code', 'status', 'level', 'validation_status',
    'prevHash', 'currentHash', 'payload_hash', 'prev_hash', 'current_hash',
    'email', 'zip', 'cp', 'codigo_postal', 'phone', 'telefono', 'celular',
    'value', 'val', 'raw_value', 'numeric_value', 'reference', 'ref', 'range', 'standard', 'unit',
    'imgSrc', 'avatar', 'url', 'uri', 'path', 'photo', 'image', 'base64',
    'dob', 'birthdate', 'fechanac', 'fechaNacimiento', 'timestamp', 'created_at', 'modified_at',
    'last_updated', 'presyncedAt', 'doctor_approval_timestamp', 'parsedLocalDate'
]);

function isProtectedStringValue(str) {
    if (!str || typeof str !== 'string') return true;
    if (str.length > 8000 && !str.includes(' ')) return true; // Base64 / binario
    if (/^data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(str)) return true;
    if (/^https?:\/\//i.test(str)) return true;
    if (/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i.test(str)) return true; // AES-GCM cipher
    if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?/.test(str)) return true;
    return false;
}

/**
 * Sanitiza recursivamente cadenas de texto libre en un patient_data_snapshot desencriptado,
 * preservando intactos números, booleanos, IDs, códigos, llaves canónicas y nombres crudos de Electret.
 */
function sanitizeSnapshotStringsRecursively(node, parentKey = '') {
    if (node === null || node === undefined) return node;
    if (typeof node === 'number' || typeof node === 'boolean') return node;

    if (typeof node === 'string') {
        if (PROTECTED_SNAPSHOT_KEYS.has(parentKey) || isProtectedStringValue(node)) {
            return node;
        }
        return sanitizeClinicalSpanish(node);
    }

    if (Array.isArray(node)) {
        return node.map((item) => sanitizeSnapshotStringsRecursively(item, parentKey));
    }

    if (typeof node === 'object') {
        // Caso especial: objeto de parámetro Electret con { name, key, value, reference/ref, status }
        const looksLikeElectretParam =
            typeof node.key === 'string' &&
            typeof node.name === 'string' &&
            (node.reference !== undefined || node.ref !== undefined || node.raw_value !== undefined);

        const out = {};
        for (const [k, v] of Object.entries(node)) {
            if (looksLikeElectretParam && k === 'name') {
                // Preservar name original de hardware salvo que tuviera corrupción de regex ("víascular" / "•")
                const hadRegexCorruption = /v[íi]ascular|v[íi]aso|cora[íi]z|[Ïï]ndice|[•\ufffd]/iu.test(v);
                out.name = hadRegexCorruption ? sanitizeClinicalSpanish(v) : v;
                out.displayName = sanitizeClinicalSpanish(node.displayName || v);
            } else {
                out[k] = sanitizeSnapshotStringsRecursively(v, k);
            }
        }
        if (looksLikeElectretParam && !out.displayName) {
            out.displayName = sanitizeClinicalSpanish(out.name);
        }
        return out;
    }

    return node;
}

function escapeRegExp(str) {
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

function isPatientFemaleFromValue(sexOrIsFemale) {
    if (typeof sexOrIsFemale === 'boolean') return sexOrIsFemale;
    if (!sexOrIsFemale) return false;
    const norm = String(sexOrIsFemale).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return norm === 'f' || norm === '2' || norm === 'femenino' || norm === 'female' || norm === 'mujer' || norm === 'femenina' || norm === 'nina' || norm.startsWith('fem');
}

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

function enforcePatientGenderConcordance(text, sexOrIsFemale = false) {
    if (text === null || text === undefined) return '';
    if (typeof text !== 'string') return String(text);
    const isFemale = isPatientFemaleFromValue(sexOrIsFemale);
    let result = text;
    for (const { regex, pair } of COMPILED_GENDER_PATTERNS) {
        const targetLower = isFemale ? pair[1] : pair[0];
        result = result.replace(regex, (matched) => applyThreeTierCase(matched, targetLower));
    }
    return result;
}

function filterOrphanTelemetryAnnexes(annexes, isManualExercise = true) {
    if (!Array.isArray(annexes) || !isManualExercise) return annexes;
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

module.exports = {
    sanitizeClinicalSpanish,
    deduplicateRepeatedClauseVerbs,
    normalizeMetricDecimals,
    joinSpanishList,
    enforcePatientGenderConcordance,
    filterOrphanTelemetryAnnexes,
    isPhysiologicallyNormal,
    normalizeForMatch,
    sanitizeSnapshotStringsRecursively
};
