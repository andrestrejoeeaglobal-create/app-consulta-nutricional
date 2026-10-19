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
 * Normaliza nombres clínicos para cotejo biométrico NOM-004.
 * Convierte a minúsculas, elimina acentos y diacríticos, y limpia espacios extras.
 */
function normalizeClinicalName(name) {
    if (!name) return '';
    return String(name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Parsea fecha local en formato DD/MM/YYYY HH:mm o ISO asegurando correspondencia de tiempo local.
 */
function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).trim().split(/[\sT]+/);
    if (parts.length >= 2) {
        const dParts = parts[0].split(/[/.-]/);
        const tParts = parts[1].split(':');
        if (dParts.length === 3 && tParts.length >= 2) {
            let day, month, year;
            if (dParts[0].length === 4) {
                year = parseInt(dParts[0], 10);
                month = parseInt(dParts[1], 10) - 1;
                day = parseInt(dParts[2], 10);
            } else {
                day = parseInt(dParts[0], 10);
                month = parseInt(dParts[1], 10) - 1;
                year = parseInt(dParts[2], 10);
            }
            const hours = parseInt(tParts[0], 10);
            const minutes = parseInt(tParts[1], 10);
            const seconds = tParts[2] ? parseInt(tParts[2], 10) : 0;
            return new Date(year, month, day, hours, minutes, seconds);
        }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
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
        // Mapeo canónico del semáforo cuántico Electret:
        // YC01 / YC07: Extremos (- - - / + + +) -> ANORMAL SEVERO
        // YC02 / YC06: Medios (- - / + +) -> ANORMAL MODERADO
        // YC03 / YC05 / YC09: Ligeros (- / +) -> ANORMAL LEVE
        // YC04 / YC08: Centro verde (Dentro de rango / Normal) -> NORMAL
        if (s.includes('yc01') || s.includes('yc07') || s.includes('ycmark1') || s.includes('+++')) return 'ANORMAL SEVERO';
        if (s.includes('yc02') || s.includes('yc06') || s.includes('ycmark2') || s.includes('++')) return 'ANORMAL MODERADO';
        if (s.includes('yc03') || s.includes('yc05') || s.includes('yc09') || s.includes('ycmark3') || s.includes('+')) return 'ANORMAL LEVE';
        if (s.includes('yc04') || s.includes('yc08') || s.includes('ycmark4') || s.includes('normal')) return 'NORMAL';
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
    'elementos_humanos': 'body_composition',
    'prostata': 'prostate',
    'esperma_y_semen': 'sperm_semen',
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

    // Extracción de metadatos clínicos del paciente desde el HTML (NOM-004)
    const nameMatch = htmlContent.match(/Nombre:\s*([^<&]+)/i);
    const sexMatch = htmlContent.match(/Sexo:\s*([^<&]+)/i);
    const ageMatch = htmlContent.match(/Edad:\s*([^<&]+)/i);
    const dateMatch = htmlContent.match(/Fecha y Hora del An[aá]lisis:\s*([^<&]+)/i);

    const rawPatientName = nameMatch ? nameMatch[1].trim() : null;
    const normalizedPatientName = normalizeClinicalName(rawPatientName);
    const rawScanDate = dateMatch ? dateMatch[1].trim() : null;
    const parsedLocalDate = parseLocalDate(rawScanDate);

    const patientMetadata = {
        name: rawPatientName,
        normalizedName: normalizedPatientName,
        sex: sexMatch ? sexMatch[1].trim() : null,
        age: ageMatch ? ageMatch[1].trim() : null,
        scanDate: rawScanDate,
        parsedLocalDate: parsedLocalDate ? parsedLocalDate.toISOString() : null
    };

    const $ = cheerio.load(htmlContent);
    const resultCategories = {};
    let totalParams = 0;
    let abnormalCount = 0;

    // Iteración canónica sobre cada encabezado de categoría clínica
    $('font[size="6"]').each(function() {
        const rawHeading = $(this).text().trim();
        // Exclusión obligatoria de informes de síntesis/resumen para prevenir colisiones y duplicaciones
        const lowerHeading = rawHeading.toLowerCase();
        if (lowerHeading.includes('análisis de expertos') || 
            lowerHeading.includes('análisis de la mano') || 
            lowerHeading.includes('síntesis') || 
            lowerHeading.includes('resumen')) {
            return;
        }

        // Extracción de categoría: ej. "(Cardiovasculares y Cerebrovasculares)Informe del Análisis" -> "Cardiovasculares y Cerebrovasculares"
        const catMatch = rawHeading.match(/\((.*?)\)/);
        const catTitle = catMatch ? catMatch[1].trim() : rawHeading.replace(/informe.*$/i, '').trim();
        if (!catTitle) return;

        const normKey = normalizeKey(catTitle);
        const catKey = CATEGORY_MAP[normKey] || normKey;

        // Contenedor delimitado de la página
        const container = $(this).closest('div[style*="page-break"]').length 
            ? $(this).closest('div[style*="page-break"]')
            : $(this).closest('table').parent();

        // Localizar exclusivamente la tabla principal de resultados de este bloque
        const targetTable = container.find('table.table').first();
        if (!targetTable.length) return;

        if (!resultCategories[catKey]) {
            resultCategories[catKey] = {
                title: catTitle,
                key: catKey,
                total: 0,
                abnormalCount: 0,
                items: [],
                itemsDict: {}
            };
        }

        targetTable.find('tr').each(function() {
            const tds = $(this).find('td');
            if (tds.length < 3) return;

            let name = $(tds[0]).text().trim();
            let ref = $(tds[1]).text().trim();
            let val = $(tds[2]).text().trim();
            let imgSrc = $(tds[3]).find('img, image').attr('src') || $(this).find('img, image').attr('src') || '';

            // Filtrado defensivo estricto contra filas de encabezado o metadatos
            const lowerName = name.toLowerCase();
            if (lowerName.includes('objeto') || lowerName.includes('examinado') || lowerName.includes('analizado') || lowerName.includes('rango normal') || lowerName.includes('parámetro')) {
                return;
            }
            if (name.includes(':') && (lowerName.includes('nombre') || lowerName.includes('complexión') || lowerName.includes('sexo') || lowerName.includes('edad'))) {
                return;
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

            // Inserción garantizada libre de duplicados
            if (!resultCategories[catKey].itemsDict[paramKey]) {
                resultCategories[catKey].itemsDict[paramKey] = paramObj;
                resultCategories[catKey].items.push(paramObj);
                resultCategories[catKey].total += 1;
                totalParams += 1;

                if (status !== 'NORMAL' && status !== 'NORMAL (-)' && status !== '-') {
                    resultCategories[catKey].abnormalCount += 1;
                    abnormalCount += 1;
                }
            }
        });
    });

    return {
        success: true,
        patientMetadata,
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
    normalizeClinicalName,
    parseLocalDate,
    cleanFloat,
    evalParamStatus,
    parseElectretHTML,
    parseElectretJSON,
    CATEGORY_MAP
};
