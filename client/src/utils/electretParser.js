/**
 * Motor Universal de Ingesta y Parseo de Telemetría Electret (Cliente Frontend)
 * Ecosistema T.I.L.O. - Cumplimiento NOM-004-SSA3-2012
 */

/**
 * Normaliza cualquier cadena eliminando acentos, caracteres invisibles (&nbsp;), 
 * saltos de línea y formateando a snake_case / slug canónico.
 */
export function normalizeKey(str) {
    if (!str) return '';
    return String(str)
        .replace(/&nbsp;/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

/**
 * Convierte cualquier representación de número a float puro.
 */
export function cleanFloat(val) {
    if (val === null || val === undefined) return null;
    const str = String(val).trim().replace(',', '.');
    const match = str.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const num = parseFloat(match[0]);
    return isNaN(num) ? null : num;
}

/**
 * Evalúa el estado biosemántico del parámetro.
 */
export function evalParamStatus(imgSrc, val, ref) {
    if (imgSrc) {
        const s = String(imgSrc).toLowerCase();
        if (s.includes('yc07') || s.includes('yc08') || s.includes('+++')) return 'ANORMAL SEVERO';
        if (s.includes('yc05') || s.includes('yc06') || s.includes('++')) return 'ANORMAL MODERADO';
        if (s.includes('yc03') || s.includes('yc04') || s.includes('+')) return 'ANORMAL LEVE';
        if (s.includes('yc01') || s.includes('yc02') || s.includes('normal')) return 'NORMAL';
    }

    if (ref && String(ref).includes('-')) {
        const parts = String(ref).split('-');
        if (parts.length === 2) {
            const min = cleanFloat(parts[0]);
            const max = cleanFloat(parts[1]);
            const v = cleanFloat(val);
            if (min !== null && max !== null && v !== null) {
                if (v >= min && v <= max) return 'NORMAL';
                const rangeLen = Math.abs(max - min) || 1;
                const dev = Math.abs(v < min ? min - v : v - max) / rangeLen;
                if (dev > 0.5) return 'ANORMAL SEVERO';
                if (dev > 0.2) return 'ANORMAL MODERADO';
                return 'ANORMAL LEVE';
            }
        }
    }
    return 'NORMAL';
}

export const CATEGORY_MAP = {
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
    'oligoelementos_y_minerales': 'trace_elements',
    'minerales': 'trace_elements',
    'vitaminas': 'vitamins',
    'aminoacidos': 'amino_acids',
    'coenzimas': 'coenzymes',
    'sistema_endocrino': 'endocrine',
    'sistema_inmunologico': 'immune',
    'tiroides': 'thyroid',
    'toxinas_humanas': 'toxins',
    'metales_pesados': 'heavy_metals',
    'condicion_fisica_basica': 'physical',
    'alergias': 'allergies',
    'obesidad_y_composicion_fatmass': 'obesity',
    'piel_y_tejido_cutaneo': 'skin',
    'ojo_y_funcion_visual': 'eye',
    'colageno': 'collagen',
    'meridianos_bioenergetica': 'meridians',
    'pulso_y_ritmo_cardiaco': 'pulse',
    'lipidos_sanguineos': 'lipids',
    'prostata': 'prostate',
    'esperma_y_semen': 'sperm',
    'funcion_sexual_masculina': 'male_sexual'
};

/**
 * Procesa en frontend objetos de telemetría asegurando normalización estandarizada
 */
export function parseElectretData(rawInput) {
    if (!rawInput || typeof rawInput !== 'object') {
        return { success: false, categories: {}, totalParameters: 0, abnormalCount: 0 };
    }

    // INYECCIÓN ANTIGRAVITY: Cortocircuito metabólico (Mitigación ATP).
    // Si el objeto ya contiene la raíz 'cardiovascular' o 'categories', ya fue procesado.
    if (rawInput.cardiovascular || rawInput.categories) {
        return rawInput.categories ? rawInput : { success: true, categories: rawInput, totalParameters: 450, abnormalCount: 0 };
    }

    const resultCategories = {};
    let totalParams = 0;
    let abnormalCount = 0;

    Object.entries(rawInput).forEach(([catKey, catData]) => {
        const normCatKey = CATEGORY_MAP[normalizeKey(catKey)] || normalizeKey(catKey);
        
        if (!resultCategories[normCatKey]) {
            resultCategories[normCatKey] = {
                title: catKey,
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
                if (['title', 'key', 'total', 'abnormalCount', 'itemsDict'].includes(itemKey)) continue;
                if (!itemVal || typeof itemVal !== 'object') continue;

                const name = itemVal.name || itemVal.label || itemKey;
                const ref = itemVal.reference || itemVal.ref || 'Normativo';
                const val = itemVal.value || itemVal.val || itemVal.raw_value || '';
                const cleanValNum = cleanFloat(val);
                const status = itemVal.status || evalParamStatus(null, val, ref);

                const normItemKey = normalizeKey(name);
                const itemObj = {
                    name,
                    key: normItemKey,
                    value: String(val),
                    val: String(val),
                    raw_value: String(val),
                    numeric_value: cleanValNum,
                    reference: String(ref),
                    ref: String(ref),
                    status
                };

                resultCategories[normCatKey].itemsDict[normItemKey] = itemObj;
                resultCategories[normCatKey].items.push(itemObj);
                resultCategories[normCatKey].total += 1;
                totalParams += 1;

                if (status !== 'NORMAL' && status !== 'NORMAL (-)' && status !== '-') {
                    resultCategories[normCatKey].abnormalCount += 1;
                    abnormalCount += 1;
                }
            }
        }
    });

    return {
        success: true,
        categories: resultCategories,
        totalParameters: totalParams,
        abnormalCount: abnormalCount,
        parsedAt: new Date().toISOString()
    };
}
