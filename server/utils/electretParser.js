/**
 * Motor Universal de Ingesta y Parseo de Telemetría Electret (Servidor)
 * Ecosistema T.I.L.O. - Cumplimiento NOM-004-SSA3-2012
 */

const cheerio = require('cheerio');

/**
 * Normaliza cualquier cadena eliminando acentos, caracteres invisibles (&nbsp;), 
 * saltos de línea y formateando a snake_case / slug canónico.
 * @param {string} str 
 * @returns {string}
 */
function normalizeKey(str) {
    if (!str) return '';
    return String(str)
        .replace(/&nbsp;/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos/acentos
        .replace(/[^\w\s-]/g, '') // Quita caracteres especiales manteniendo guiones y espacios
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

/**
 * Convierte cualquier representación de número a float puro.
 * Reemplaza comas por puntos, maneja nulos, undefined y cadenas corruptas.
 * @param {any} val 
 * @returns {number|null}
 */
function cleanFloat(val) {
    if (val === null || val === undefined) return null;
    const str = String(val).trim().replace(',', '.');
    // Extraer patrones numéricos flotantes (ej. "1.574", "-0.45", "33%")
    const match = str.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const num = parseFloat(match[0]);
    return isNaN(num) ? null : num;
}

/**
 * Evalúa el estado biosemántico del parámetro basado en la imagen del reporte o desviación respecto al rango.
 * @param {string} imgSrc 
 * @param {any} val 
 * @param {string} ref 
 * @returns {string} 'NORMAL' | 'ANORMAL LEVE' | 'ANORMAL MODERADO' | 'ANORMAL SEVERO'
 */
function evalParamStatus(imgSrc, val, ref) {
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

/**
 * Mapeo canónico de categorías para garantizar consistencia entre reportes heterogéneos
 */
const CATEGORY_MAP = {
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
 * Parsea contenido HTML completo del informe Electret extraído vía ODBC o cargado.
 * @param {string} htmlContent 
 * @returns {object} Payload homogenizado con categorías, total de parámetros y conteo de anormalidades.
 */
function parseElectretHTML(htmlContent) {
    if (!htmlContent || typeof htmlContent !== 'string') {
        return { success: false, categories: {}, totalParameters: 0, abnormalCount: 0 };
    }

    const $ = cheerio.load(htmlContent);
    const resultCategories = {};
    let currentCategoryRaw = "General";
    let currentCategoryKey = "general";
    let totalParams = 0;
    let abnormalCount = 0;

    $('body, div, table').find('h1, h2, h3, h4, .title, table').each((_, el) => {
        const $el = $(el);
        const tag = el.name ? el.name.toLowerCase() : '';

        if (['h1', 'h2', 'h3', 'h4'].includes(tag) || $el.hasClass('title')) {
            const titleText = $el.text().trim();
            if (titleText && titleText.length > 2 && titleText.length < 120 && !titleText.toLowerCase().includes('informe')) {
                currentCategoryRaw = titleText;
                const normalized = normalizeKey(titleText);
                currentCategoryKey = CATEGORY_MAP[normalized] || normalized;

                if (!resultCategories[currentCategoryKey]) {
                    resultCategories[currentCategoryKey] = {
                        title: currentCategoryRaw,
                        key: currentCategoryKey,
                        total: 0,
                        abnormalCount: 0,
                        items: [],
                        itemsDict: {}
                    };
                }
            }
        } else if (tag === 'table') {
            $el.find('tr').each((_, tr) => {
                const $tr = $(tr);
                const tds = $tr.find('td');

                let name = "";
                let ref = "";
                let val = "";
                let imgSrc = "";

                tds.each((_, td) => {
                    const $img = $(td).find('img');
                    if ($img.length > 0) {
                        imgSrc = $img.attr('src') || "";
                    }
                });

                if (tds.length >= 4) {
                    name = $(tds[1]).text().trim();
                    ref = $(tds[2]).text().trim();
                    val = $(tds[3]).text().trim();
                } else if (tds.length === 3) {
                    name = $(tds[0]).text().trim();
                    ref = $(tds[1]).text().trim();
                    val = $(tds[2]).text().trim();
                }

                if (name && val && ref && !name.toLowerCase().includes('objeto analizado') && !name.toLowerCase().includes('parametro') && !name.toLowerCase().includes('clasificac')) {
                    if (!resultCategories[currentCategoryKey]) {
                        resultCategories[currentCategoryKey] = {
                            title: currentCategoryRaw,
                            key: currentCategoryKey,
                            total: 0,
                            abnormalCount: 0,
                            items: [],
                            itemsDict: {}
                        };
                    }

                    const paramKey = normalizeKey(name);
                    const cleanValNum = cleanFloat(val);
                    const status = evalParamStatus(imgSrc, val, ref);

                    const paramObj = {
                        name,
                        key: paramKey,
                        value: String(val),
                        val: String(val),
                        raw_value: String(val),
                        numeric_value: cleanValNum,
                        reference: String(ref),
                        ref: String(ref),
                        status
                    };

                    resultCategories[currentCategoryKey].itemsDict[paramKey] = paramObj;
                    resultCategories[currentCategoryKey].items.push(paramObj);
                    resultCategories[currentCategoryKey].total += 1;
                    totalParams += 1;

                    if (status !== 'NORMAL' && status !== 'NORMAL (-)' && status !== '-') {
                        resultCategories[currentCategoryKey].abnormalCount += 1;
                        abnormalCount += 1;
                    }
                }
            });
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

/**
 * Normaliza un objeto JSON telemétrico estructurado previamente.
 * @param {object} rawJson 
 * @returns {object}
 */
function parseElectretJSON(rawJson) {
    if (!rawJson || typeof rawJson !== 'object') {
        return { success: false, categories: {}, totalParameters: 0, abnormalCount: 0 };
    }

    const resultCategories = {};
    let totalParams = 0;
    let abnormalCount = 0;

    Object.entries(rawJson).forEach(([catKey, catData]) => {
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

module.exports = {
    normalizeKey,
    cleanFloat,
    evalParamStatus,
    parseElectretHTML,
    parseElectretJSON,
    CATEGORY_MAP
};
