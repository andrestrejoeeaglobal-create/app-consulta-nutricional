/**
 * Motor Universal de Ingesta y Parseo de Telemetría Electret (Cliente Frontend)
 * Ecosistema T.I.L.O. - Cumplimiento NOM-004-SSA3-2012 y Constitución Sinergix v2.0.2
 */

import { sanitizeClinicalSpanish } from './patientGuideAdapter';

export function collapseWhitespace(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&nbsp;/gi, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeKey(str) {
    if (!str) return '';
    return collapseWhitespace(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

export function cleanFloat(val) {
    if (val === null || val === undefined) return null;
    const str = collapseWhitespace(val).replace(',', '.');
    if (!str || /^sin\s+direcci/i.test(str) || /^[+-]+$/.test(str)) return null;
    const match = str.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const num = parseFloat(match[0]);
    return isNaN(num) ? null : num;
}

/**
 * Detecta si un bloque de categorías proviene del antiguo motor sintético QuantumResonanceEngine
 * (body_composition con Clasificación Componencial = 1.000 e ICW = 0.000).
 */
export function isSyntheticElectretPayload(categories) {
    if (!categories || typeof categories !== 'object') return false;
    const bc = categories.body_composition;
    if (!bc) return false;
    const items = Array.isArray(bc.items) ? bc.items : Object.values(bc.items || bc);
    if (!Array.isArray(items) || items.length === 0) return false;
    const hasFakeHeader = items.some((i) =>
        /clasificaci[oó]n\s+componencial/i.test(String(i?.name || '')) &&
        String(i?.val ?? i?.value ?? '') === '1.000'
    );
    const hasZeroIcw = items.some((i) =>
        /l[íi]quido\s+intracelular/i.test(String(i?.name || '')) &&
        String(i?.val ?? i?.value ?? '') === '0.000'
    );
    return hasFakeHeader && hasZeroIcw;
}

/**
 * Evalúa el estado biosemántico del parámetro respetando iconos YC01..YC10,
 * rangos invertidos (ej. DMO 0,796 - 0,433) y valores cualitativos de 3 columnas (Padecimientos Óseos).
 */
export function evalParamStatus(imgSrc, val, ref) {
    if (imgSrc) {
        const s = String(imgSrc).toLowerCase().trim();
        if (s.includes('yc01') || s.includes('yc07') || s.includes('ycmark1') || s.includes('+++') || s.includes('---')) {
            return 'ANORMAL SEVERO (+++)';
        }
        if (s.includes('yc02') || s.includes('yc06') || s.includes('ycmark2') || s.includes('++') || s.includes('--')) {
            return 'ANORMAL MODERADO (++)';
        }
        if (
            s.includes('yc03') ||
            s.includes('yc05') ||
            s.includes('yc09') ||
            s.includes('yc10') ||
            s.includes('ycmark3') ||
            s === '+' ||
            s === '-'
        ) {
            return s === '-' ? 'NORMAL (-)' : 'ANORMAL LEVE (+)';
        }
        if (s.includes('yc04') || s.includes('yc08') || s.includes('ycmark4') || s.includes('normal')) {
            return 'NORMAL (-)';
        }
    }

    const valClean = collapseWhitespace(val);
    const refClean = collapseWhitespace(ref);

    if (!refClean || /^mediciones$|^informativo$|^normativo$/i.test(refClean)) {
        return 'NORMAL (-)';
    }

    if (valClean && refClean && valClean.toLowerCase() === refClean.toLowerCase()) {
        return 'NORMAL (-)';
    }

    const ltMatch = refClean.match(/^<=?\s*[a-zA-Z]*\s*(-?\d+(?:[.,]\d+)?)/);
    if (ltMatch) {
        const limit = parseFloat(ltMatch[1].replace(',', '.'));
        const vNum = cleanFloat(valClean);
        if (!isNaN(limit) && vNum !== null) {
            if (vNum <= limit) return 'NORMAL (-)';
            const excessRatio = (vNum - limit) / (Math.abs(limit) || 1);
            if (excessRatio > 0.5) return 'ANORMAL SEVERO (+++)';
            if (excessRatio > 0.15) return 'ANORMAL MODERADO (++)';
            return 'ANORMAL LEVE (+)';
        }
    }

    const gtMatch = refClean.match(/^>=?\s*[a-zA-Z]*\s*(-?\d+(?:[.,]\d+)?)/);
    if (gtMatch) {
        const limit = parseFloat(gtMatch[1].replace(',', '.'));
        const vNum = cleanFloat(valClean);
        if (!isNaN(limit) && vNum !== null) {
            if (vNum >= limit) return 'NORMAL (-)';
            const defRatio = (limit - vNum) / (Math.abs(limit) || 1);
            if (defRatio > 0.35) return 'ANORMAL SEVERO (+++)';
            if (defRatio > 0.15) return 'ANORMAL MODERADO (++)';
            return 'ANORMAL LEVE (+)';
        }
    }

    const rangeMatch = refClean.match(/^\s*(-?\d+(?:[.,]\d+)?)%?\s*[-~]\s*(-?\d+(?:[.,]\d+)?)%?(?:\s*[a-zA-Z/%²2]*)?\s*$/);
    if (rangeMatch) {
        const rawA = parseFloat(rangeMatch[1].replace(',', '.'));
        const rawB = parseFloat(rangeMatch[2].replace(',', '.'));
        const v = cleanFloat(valClean);
        if (!isNaN(rawA) && !isNaN(rawB) && v !== null) {
            const min = Math.min(rawA, rawB);
            const max = Math.max(rawA, rawB);
            if (v >= min && v <= max) return 'NORMAL (-)';
            const rangeLen = Math.abs(max - min) || 1;
            const dev = Math.abs(v < min ? min - v : v - max) / rangeLen;
            if (dev > 0.5) return 'ANORMAL SEVERO (+++)';
            if (dev > 0.2) return 'ANORMAL MODERADO (++)';
            return 'ANORMAL LEVE (+)';
        }
    }

    return 'NORMAL (-)';
}

export const CATEGORY_MAP = {
    'cardiovasculares_y_cerebrovasculares': 'cardiovascular',
    'cardiovascular_y_cerebrovascular': 'cardiovascular',
    'cardiovascular_y_cerebrovasculares': 'cardiovascular',
    'cardiovascular': 'cardiovascular',
    'funcion_gastrointestinal': 'gastrointestinal',
    'gastrointestinal': 'gastrointestinal',
    'funcion_del_intestino_grueso': 'colon',
    'intestino_grueso': 'colon',
    'colon': 'colon',
    'funcion_hepatica': 'liver',
    'hepatica': 'liver',
    'liver': 'liver',
    'funcion_de_la_vesicula_biliar': 'gallbladder',
    'vesicula_biliar': 'gallbladder',
    'gallbladder': 'gallbladder',
    'funcion_pancreatica': 'pancreas',
    'pancreatica': 'pancreas',
    'pancreas': 'pancreas',
    'funcion_renal': 'renal',
    'renal': 'renal',
    'funcion_pulmonar': 'pulmonary',
    'pulmonar': 'pulmonary',
    'nervio_cerebral': 'brain',
    'cerebral': 'brain',
    'padecimientos_oseos': 'bone_disease',
    'densidad_mineral_osea': 'bone_density',
    'enfermedad_de_hueso_reumatoide': 'rheumatoid',
    'indice_de_crecimiento_oseo': 'bone_growth',
    'glucosa_en_la_sangre': 'blood_sugar',
    'blood_glucose': 'blood_sugar',
    'oligoelementos': 'trace_elements',
    'oligoelementos_y_minerales': 'trace_elements',
    'vitamina': 'vitamins',
    'vitaminas': 'vitamins',
    'aminoacidos': 'amino_acids',
    'coenzima': 'coenzymes',
    'coenzimas': 'coenzymes',
    'acido_graso': 'fatty_acids',
    'acidos_grasos': 'fatty_acids',
    'sistema_endocrino': 'endocrine',
    'sistema_inmunologico': 'immune',
    'tiroides': 'thyroid',
    'toxina_humana': 'toxins',
    'toxinas_humanas': 'toxins',
    'metales_pesados': 'heavy_metals',
    'condicion_fisica_basica': 'basic_physical',
    'alergias': 'allergies',
    'obesidad': 'obesity',
    'piel': 'skin',
    'ojo': 'eye',
    'colageno': 'collagen',
    'meridianos_o_canales_de_acupuntura': 'meridians',
    'meridianos_bioenergetica': 'meridians',
    'pulso_cerebro_y_corazon': 'pulso_cerebro_y_corazon',
    'lipidos_sanguineos': 'blood_lipids',
    'ginecologia': 'gynecology',
    'senos': 'breasts',
    'cyclo_menstrual': 'menstrual_cycle',
    'ciclo_menstrual': 'menstrual_cycle',
    'elementos_humanos': 'body_composition',
    'prostata': 'prostate',
    'esperma_y_semen': 'sperm_semen',
    'funcion_sexual_masculina': 'male_sexual'
};

/**
 * Procesa en frontend objetos de telemetría asegurando normalización ortográfica,
 * preservación de banderas inSynthesisReport y cortocircuito libre de falsificaciones.
 */
export function parseElectretData(rawInput) {
    if (!rawInput || typeof rawInput !== 'object') {
        return { success: false, categories: {}, totalParameters: 0, abnormalCount: 0 };
    }

    if (rawInput.categories && typeof rawInput.categories === 'object') {
        return rawInput;
    }

    const resultCategories = {};
    let totalParams = 0;
    let abnormalCount = 0;

    Object.entries(rawInput).forEach(([catKey, catData]) => {
        if (!catData || typeof catData !== 'object') return;
        const normCatKey = CATEGORY_MAP[normalizeKey(catKey)] || normalizeKey(catKey);

        if (!resultCategories[normCatKey]) {
            resultCategories[normCatKey] = {
                title: sanitizeClinicalSpanish(catData.title || catKey),
                key: normCatKey,
                total: 0,
                abnormalCount: 0,
                items: [],
                itemsDict: {}
            };
        }

        const itemsSource = catData.items || catData;
        if (typeof itemsSource === 'object') {
            const sourceEntries = Array.isArray(itemsSource) ? itemsSource.entries() : Object.entries(itemsSource);
            for (const [itemKey, itemVal] of sourceEntries) {
                if (['title', 'key', 'total', 'abnormalCount', 'itemsDict'].includes(String(itemKey))) continue;
                if (!itemVal || typeof itemVal !== 'object') continue;

                const rawName = itemVal.displayName || itemVal.name || itemVal.label || String(itemKey);
                const cleanName = sanitizeClinicalSpanish(rawName);
                const ref = itemVal.reference ?? itemVal.ref ?? 'Informativo';
                const val = itemVal.value ?? itemVal.val ?? itemVal.raw_value ?? '';
                const cleanValNum = itemVal.numeric_value !== undefined ? itemVal.numeric_value : cleanFloat(val);
                const status = itemVal.status || evalParamStatus(itemVal.iconCode || null, val, ref);

                const normItemKey = itemVal.key || normalizeKey(cleanName);
                const itemObj = {
                    name: cleanName,
                    displayName: cleanName,
                    key: normItemKey,
                    slot: itemVal.slot || null,
                    unit: itemVal.unit || '',
                    value: String(val),
                    val: String(val),
                    raw_value: String(itemVal.raw_value ?? val),
                    numeric_value: cleanValNum,
                    reference: String(ref),
                    ref: String(ref),
                    iconCode: itemVal.iconCode || null,
                    status,
                    inSynthesisReport: Boolean(itemVal.inSynthesisReport)
                };

                if (!resultCategories[normCatKey].itemsDict[normItemKey]) {
                    resultCategories[normCatKey].itemsDict[normItemKey] = itemObj;
                    resultCategories[normCatKey].items.push(itemObj);
                    resultCategories[normCatKey].total += 1;
                    totalParams += 1;

                    if (!String(status).startsWith('NORMAL') && status !== '-') {
                        resultCategories[normCatKey].abnormalCount += 1;
                        abnormalCount += 1;
                    }
                }
            }
        }
    });

    return {
        success: Object.keys(resultCategories).length > 0,
        categories: resultCategories,
        totalParameters: totalParams,
        abnormalCount,
        parsedAt: new Date().toISOString()
    };
}
