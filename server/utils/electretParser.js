/**
 * Motor Universal de Ingesta y Parseo de Telemetría Electret (Servidor)
 * Ecosistema T.I.L.O. - Cumplimiento NOM-004-SSA3-2012 y Constitución Sinergix v2.0.2
 */

const cheerio = require('cheerio');
const { sanitizeClinicalSpanish } = require('./clinicalTextSanitizer');

/**
 * Colapsa saltos de línea, tabuladores y espacios múltiples (incluyendo &nbsp;).
 * @param {string} str
 * @returns {string}
 */
function collapseWhitespace(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&nbsp;/gi, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Normaliza cualquier cadena eliminando acentos, caracteres invisibles (&nbsp;),
 * saltos de línea y formateando a snake_case / slug canónico.
 * @param {string} str
 * @returns {string}
 */
function normalizeKey(str) {
    if (!str) return '';
    return collapseWhitespace(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

/**
 * Normaliza nombres clínicos para cotejo biométrico NOM-004.
 */
function normalizeClinicalName(name) {
    if (!name) return '';
    return collapseWhitespace(name)
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
    const clean = collapseWhitespace(dateStr);
    const parts = clean.split(/[\sT]+/);
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
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Convierte cualquier representación de número a float puro.
 * Reemplaza comas por puntos, maneja nulos, undefined y cadenas cualitativas.
 * @param {any} val
 * @returns {number|null}
 */
function cleanFloat(val) {
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
 * (firma inequívoca: body_composition con Clasificación Componencial = 1.000 e ICW = 0.000).
 * @param {object} categories
 * @returns {boolean}
 */
function isSyntheticElectretPayload(categories) {
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
 * Evalúa el estado biosemántico del parámetro basado en el icono oficial del analizador
 * o en la evaluación matemática/cualitativa del rango (incluyendo rangos invertidos y tablas de 3 columnas).
 * @param {string} imgSrc
 * @param {any} val
 * @param {string} ref
 * @returns {string} 'NORMAL (-)' | 'ANORMAL LEVE (+)' | 'ANORMAL MODERADO (++)' | 'ANORMAL SEVERO (+++)'
 */
function evalParamStatus(imgSrc, val, ref) {
    if (imgSrc) {
        const s = String(imgSrc).toLowerCase().trim();
        // Mapeo canónico exacto del analizador cuántico:
        // YC01 / YC07: Extremos (- - - / + + +) -> ANORMAL SEVERO (+++)
        // YC02 / YC06: Medios (- - / + +) -> ANORMAL MODERADO (++)
        // YC03 / YC05 / YC09 / YC10: Desviación de primer umbral (- / +) -> ANORMAL LEVE (+)
        // YC04 / YC08: Centro saludable -> NORMAL (-)
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

    // 1. Igualdad cualitativa exacta (ej. Padecimientos Óseos: "Sin Dirección" === "Sin Dirección", "+" === "+")
    if (valClean && refClean && valClean.toLowerCase() === refClean.toLowerCase()) {
        return 'NORMAL (-)';
    }

    // 2. Umbral superior con '<' o '<=' (ej. "< u 0,2" vs "u 0.19", "< 0.90" vs "1.04")
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

    // 3. Umbral inferior con '>' o '>=' (ej. ">= 70" vs "64.6")
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

    // 4. Rango bilateral (incluyendo porcentajes "10%-40%" y rangos invertidos como DMO "0,796 - 0,433")
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
 * Resuelve el contenedor DOM acotado de una sección encabezada por <font size="6">,
 * incluso cuando la última página (ej. Informe de síntesis) carece de div[style*="page-break"].
 */
function resolveSectionTables($, fontEl) {
    const pageDiv = $(fontEl).closest('div[style*="page-break"]');
    if (pageDiv.length) {
        return pageDiv.find('table');
    }
    const headerTable = $(fontEl).closest('table');
    if (!headerTable.length) return $();
    const collected = [];
    let next = headerTable.next();
    while (next.length) {
        if (next.is('div[style*="page-break"]') || next.find('font[size="6"]').length > 0) {
            break;
        }
        if (next.is('table')) collected.push(next[0]);
        next.find('table').each((_, t) => collected.push(t));
        next = next.next();
    }
    return $(collected);
}

/**
 * Pre-extrae las filas exactas del "Informe de síntesis" / "Informe compuesto" del software original,
 * soportando celdas con rowspan="2" (filas de 5 columnas y filas continuadas de 3 columnas)
 * y descartando el 100% de la columna "Consejos de Experto" (cero menciones a cerdo o picante).
 */
function extractSynthesisReportItems($) {
    const synthesisKeys = new Set();
    const synthesisItems = [];

    $('font[size="6"]').each(function () {
        const heading = collapseWhitespace($(this).text()).toLowerCase();
        if (!heading.includes('síntesis') && !heading.includes('sintesis') && !heading.includes('compuesto')) {
            return;
        }

        const tables = resolveSectionTables($, this);
        const targetTable = tables.filter('.table').first();
        if (!targetTable.length) return;

        let currentSystemTitle = '';
        let currentCatKey = '';

        targetTable.find('tr').each(function () {
            const tds = $(this).find('td');
            if (tds.length < 3) return;

            let sysTitle = '';
            let paramName = '';
            let ref = '';
            let val = '';

            if (tds.length >= 5) {
                sysTitle = collapseWhitespace($(tds[0]).text());
                paramName = collapseWhitespace($(tds[1]).text());
                ref = collapseWhitespace($(tds[2]).text());
                val = collapseWhitespace($(tds[3]).text());
                // tds[4] ("Consejos de Experto") se descarta deliberadamente al 100%
            } else if (tds.length === 4) {
                // Algunos formatos sin columna de consejos o con una celda fusionada
                const c0 = collapseWhitespace($(tds[0]).text());
                const c1 = collapseWhitespace($(tds[1]).text());
                const c2 = collapseWhitespace($(tds[2]).text());
                const c3 = collapseWhitespace($(tds[3]).text());
                if (/\d/.test(c1) && /\d/.test(c2)) {
                    sysTitle = currentSystemTitle;
                    paramName = c0;
                    ref = c1;
                    val = c2;
                } else {
                    sysTitle = c0;
                    paramName = c1;
                    ref = c2;
                    val = c3;
                }
            } else if (tds.length === 3) {
                // Continuación por rowspan="2" de Sistema y Consejos de Experto
                sysTitle = currentSystemTitle;
                paramName = collapseWhitespace($(tds[0]).text());
                ref = collapseWhitespace($(tds[1]).text());
                val = collapseWhitespace($(tds[2]).text());
            }

            if (
                !paramName ||
                /^sistema$/i.test(sysTitle) ||
                /^objeto\s+(?:analizado|examinado)/i.test(paramName) ||
                /^rango\s+normal$/i.test(ref)
            ) {
                return;
            }

            if (sysTitle) {
                currentSystemTitle = sysTitle;
                const normSys = normalizeKey(sysTitle);
                currentCatKey = CATEGORY_MAP[normSys] || normSys;
            }

            const cleanDisplay = sanitizeClinicalSpanish(paramName);
            const paramKey = normalizeKey(paramName);
            const cleanParamKey = normalizeKey(cleanDisplay);

            if (currentCatKey && paramKey) {
                synthesisKeys.add(`${currentCatKey}::${paramKey}`);
                synthesisKeys.add(`${currentCatKey}::${cleanParamKey}`);
            }
            if (paramKey) synthesisKeys.add(paramKey);

            synthesisItems.push({
                catKey: currentCatKey || 'general',
                systemTitle: sanitizeClinicalSpanish(currentSystemTitle),
                name: cleanDisplay,
                key: paramKey,
                reference: ref,
                value: val,
                numeric_value: cleanFloat(val)
            });
        });
    });

    return { synthesisKeys, synthesisItems };
}

/**
 * Parsea de forma dedicada las múltiples sub-tablas de "(Elementos humanos) Informe del Análisis"
 * extrayendo los 15 KPIs antropométricos y de composición corporal con exactitud matemática.
 */
function parseHumanElementsSection($, sectionTables, patientMetadata = {}) {
    const isFemale = /^f|mujer|femenin/i.test(String(patientMetadata?.sex || '').trim());
    const extracted = {};

    const recordVal = (slot, rawVal) => {
        const cleaned = collapseWhitespace(rawVal);
        if (cleaned && extracted[slot] === undefined) {
            extracted[slot] = cleaned;
        }
    };

    sectionTables.find('tr').each(function () {
        const cells = $(this).find('td').map((_, td) => collapseWhitespace($(td).text())).get();
        if (!cells.length) return;
        const rowJoined = cells.join(' | ');

        // Sub-tabla 1: Composición hídrica, proteica, mineral, muscular, magra y grasa
        if (/\(1\)\s*l[íi]quido\s+intracelular/i.test(cells[0] || '')) {
            recordVal('icw', cells[1]);
        }
        if (/\(2\)\s*l[íi]quido\s+extracelular/i.test(cells[0] || '')) {
            recordVal('ecw', cells[1]);
        }
        if (/\(3\)\s*prote[íi]nas/i.test(cells[0] || '')) {
            recordVal('proteins', cells[1]);
        }
        if (/\(4\)\s*sustancias\s+inorg[áa]nicas/i.test(cells[0] || '')) {
            recordVal('minerals', cells[1]);
        }
        if (/\(5\)\s*grasa\s+corporal/i.test(cells[0] || '')) {
            recordVal('fat_mass', cells[1]);
        }

        const tbwMatch = rowJoined.match(/\(6\)[^=]*=\(1\)\+\(2\)=\s*(-?\d+(?:[.,]\d+)?)/i);
        if (tbwMatch) recordVal('tbw', tbwMatch[1]);

        const muscMatch = rowJoined.match(/\(7\)[^=]*=\(6\)\+\(3\)=\s*(-?\d+(?:[.,]\d+)?)/i);
        if (muscMatch) recordVal('muscle_mass', muscMatch[1]);

        const lbmMatch = rowJoined.match(/\(8\)[^=]*=\(7\)\+\(4\)=\s*(-?\d+(?:[.,]\d+)?)/i);
        if (lbmMatch) recordVal('lean_mass', lbmMatch[1]);

        const weightSumMatch = rowJoined.match(/\(9\)[^=]*=\(8\)\+\(5\)=\s*(-?\d+(?:[.,]\d+)?)/i);
        if (weightSumMatch) recordVal('weight_kg', weightSumMatch[1]);

        // Sub-tabla 2: Análisis de grasas y antropometría
        if (/^2\.\s*peso\s*\(kg\)/i.test(cells[0] || '') && cells[1]) {
            recordVal('weight_kg', cells[1]);
        }
        if (/^3\.\s*masa\s+muscular/i.test(cells[0] || '') && cells[1]) {
            recordVal('muscle_mass', cells[1]);
        }
        if (/^4\.\s*contenido\s+de\s+materias\s+grasas/i.test(cells[0] || '') && cells[1]) {
            recordVal('fat_mass', cells[1]);
        }
        if (/^5\.\s*porcentaje\s+de\s+grasa/i.test(cells[0] || '') && cells[1]) {
            recordVal('body_fat_pct', cells[1]);
        }
        if (/^6\.\s*radio\s+de\s+grasa\s+abdominal/i.test(cells[0] || '') && cells[1]) {
            recordVal('whr', cells[1]);
        }

        // Sub-tabla 3: Alimentación / Metabolismo (ODB, IMC, TMB, BCM)
        if (/grado\s+de\s+obesidad\s+del\s+cuerpo\s*\(odb\)/i.test(cells[0] || '') && cells[1]) {
            recordVal('odb', cells[1]);
        }
        if (/[íiï]ndice\s+de\s+masa\s+corporal\s*\(imc\)/i.test(cells[0] || '') && cells[1]) {
            recordVal('bmi', cells[1]);
        }
        if (/tasa\s+de\s+metabolismo\s+basal\s*\(tmb\)/i.test(cells[0] || '') && cells[1]) {
            recordVal('bmr', cells[1]);
        }
        if (/masa\s+celular\s+corporal\s*\(bcm\)/i.test(cells[0] || '') && cells[1]) {
            recordVal('bcm', cells[1]);
        }

        // Sub-tabla 6: Formulario de evaluación del cuerpo (Score global)
        const scoreMatch = rowJoined.match(/formulario\s+de\s+evaluaci[oó]n\s+del\s+cuerpo\s*:\s*(-?\d+(?:[.,]\d+)?)/i);
        if (scoreMatch) {
            recordVal('body_score', scoreMatch[1]);
        }
    });

    const weightNum = cleanFloat(extracted.weight_kg) || cleanFloat(patientMetadata?.weight) || null;
    const minMuscleKg = weightNum ? Number((weightNum * 0.35).toFixed(1)) : null;
    const maxMuscleKg = weightNum ? Number((weightNum * 0.48).toFixed(1)) : null;
    const minFatKg = weightNum ? Number((weightNum * (isFemale ? 0.17 : 0.14)).toFixed(1)) : null;
    const maxFatKg = weightNum ? Number((weightNum * (isFemale ? 0.24 : 0.20)).toFixed(1)) : null;

    const kpiSpecs = [
        {
            slot: 'tbw',
            name: 'Agua Corporal Total (ICW + ECW)',
            unit: 'L',
            ref: 'Informativo'
        },
        {
            slot: 'icw',
            name: 'Líquido Intracelular (ICW)',
            unit: 'L',
            ref: 'Informativo'
        },
        {
            slot: 'ecw',
            name: 'Líquido Extracelular (ECW)',
            unit: 'L',
            ref: 'Informativo'
        },
        {
            slot: 'proteins',
            name: 'Proteínas Corporales',
            unit: 'Kg',
            ref: 'Informativo'
        },
        {
            slot: 'minerals',
            name: 'Sustancias Inorgánicas (Minerales)',
            unit: 'Kg',
            ref: 'Informativo'
        },
        {
            slot: 'muscle_mass',
            name: 'Volumen Muscular Esquelético',
            unit: 'Kg',
            ref: (minMuscleKg && maxMuscleKg) ? `${minMuscleKg} - ${maxMuscleKg}` : 'Informativo'
        },
        {
            slot: 'lean_mass',
            name: 'Peso Corporal Magro (MLG)',
            unit: 'Kg',
            ref: 'Informativo'
        },
        {
            slot: 'fat_mass',
            name: 'Masa Grasa Corporal',
            unit: 'Kg',
            ref: (minFatKg && maxFatKg) ? `${minFatKg} - ${maxFatKg}` : 'Informativo'
        },
        {
            slot: 'body_fat_pct',
            name: 'Porcentaje de Grasa Corporal',
            unit: '%',
            ref: isFemale ? '17% - 24%' : '14% - 20%'
        },
        {
            slot: 'whr',
            name: 'Relación Cintura-Cadera (RCC)',
            unit: '',
            ref: isFemale ? '< 0.80' : '< 0.90'
        },
        {
            slot: 'bmi',
            name: 'Índice de Masa Corporal (IMC)',
            unit: 'Kg/M²',
            ref: '18.5 - 24.9'
        },
        {
            slot: 'bmr',
            name: 'Tasa Metabólica Basal (TMB)',
            unit: 'kcal',
            ref: 'Informativo'
        },
        {
            slot: 'bcm',
            name: 'Masa Celular Corporal (BCM)',
            unit: 'Kg',
            ref: 'Informativo'
        },
        {
            slot: 'weight_kg',
            name: 'Peso Corporal Registrado',
            unit: 'Kg',
            ref: 'Informativo'
        },
        {
            slot: 'body_score',
            name: 'Puntuación de Evaluación Corporal',
            unit: 'pts',
            ref: '>= 70'
        }
    ];

    const items = [];
    const itemsDict = {};
    let abnormalCount = 0;

    for (const spec of kpiSpecs) {
        const raw = extracted[spec.slot];
        if (raw === undefined || raw === null || raw === '') continue;
        const num = cleanFloat(raw);
        let formattedVal = String(raw);
        if (num !== null) {
            if (spec.unit === '%' && !formattedVal.includes('%')) formattedVal = `${num}%`;
            else if (spec.unit && !new RegExp(spec.unit.replace('²', '[²2]'), 'i').test(formattedVal)) {
                formattedVal = `${num} ${spec.unit}`;
            } else {
                formattedVal = formattedVal.replace(/Kg\/M2/i, 'Kg/M²');
            }
        }

        let status = 'NORMAL (-)';
        if (spec.slot === 'body_fat_pct' && num !== null) {
            const normMax = isFemale ? 24 : 20;
            const modMax = isFemale ? 30 : 25;
            const normMin = isFemale ? 17 : 14;
            if (num < normMin) status = 'ANORMAL LEVE (+)';
            else if (num <= normMax) status = 'NORMAL (-)';
            else if (num <= modMax) status = 'ANORMAL LEVE (+)';
            else if (num <= modMax + 7) status = 'ANORMAL MODERADO (++)';
            else status = 'ANORMAL SEVERO (+++)';
        } else if (spec.slot === 'fat_mass' && num !== null && minFatKg && maxFatKg) {
            const modFatMax = weightNum * (isFemale ? 0.30 : 0.25);
            if (num < minFatKg) status = 'ANORMAL LEVE (+)';
            else if (num <= maxFatKg) status = 'NORMAL (-)';
            else if (num <= modFatMax) status = 'ANORMAL LEVE (+)';
            else status = 'ANORMAL MODERADO (++)';
        } else if (spec.slot === 'bmi' && num !== null) {
            if (num < 18.5) status = 'ANORMAL LEVE (+)';
            else if (num <= 24.9) status = 'NORMAL (-)';
            else if (num <= 29.9) status = 'ANORMAL LEVE (+)';
            else if (num <= 34.9) status = 'ANORMAL MODERADO (++)';
            else status = 'ANORMAL SEVERO (+++)';
        } else if (spec.slot === 'whr' && num !== null) {
            const whrMax = isFemale ? 0.80 : 0.90;
            const whrMod = isFemale ? 0.85 : 1.00;
            if (num <= whrMax) status = 'NORMAL (-)';
            else if (num <= whrMod) status = 'ANORMAL LEVE (+)';
            else status = 'ANORMAL MODERADO (++)';
        } else if (spec.ref !== 'Informativo') {
            status = evalParamStatus('', num !== null ? String(num) : formattedVal, spec.ref);
        }

        const paramKey = normalizeKey(spec.name);
        const paramObj = {
            name: spec.name,
            displayName: spec.name,
            key: paramKey,
            slot: spec.slot,
            value: formattedVal,
            val: formattedVal,
            raw_value: String(raw),
            numeric_value: num,
            unit: spec.unit,
            reference: spec.ref,
            ref: spec.ref,
            status,
            inSynthesisReport: false
        };

        itemsDict[paramKey] = paramObj;
        items.push(paramObj);
        if (!status.startsWith('NORMAL')) {
            abnormalCount += 1;
        }
    }

    return {
        title: 'Análisis Componencial Corporal (Elementos Humanos)',
        key: 'body_composition',
        total: items.length,
        abnormalCount,
        items,
        itemsDict
    };
}

/**
 * Parsea contenido HTML completo del informe del Analizador Cuántico Bioeléctrico (.htm en latin1/utf8).
 * @param {string} htmlContent
 * @returns {object}
 */
function parseElectretHTML(htmlContent) {
    if (!htmlContent || typeof htmlContent !== 'string') {
        return { success: false, categories: {}, synthesisItems: [], totalParameters: 0, abnormalCount: 0 };
    }

    // Extracción limpia de metadatos clínicos del paciente (NOM-004) incluyendo Complexión (Talla y Peso)
    const nameMatch = htmlContent.match(/Nombre:\s*([^<&\r\n]+)/i);
    const sexMatch = htmlContent.match(/Sexo:\s*([^<&\r\n]+)/i);
    const ageMatch = htmlContent.match(/Edad:\s*([^<&\r\n]+)/i);
    const complexionMatch = htmlContent.match(/Complexi[oó]n:\s*(\d+(?:[.,]\d+)?)\s*cm\s*,\s*(\d+(?:[.,]\d+)?)\s*kg/i);
    const dateMatch = htmlContent.match(/Fecha\s+y\s+Hora\s+del\s+An[aá]lisis:\s*([^<&]+)/i);

    const rawPatientName = nameMatch ? collapseWhitespace(nameMatch[1]) : null;
    const normalizedPatientName = normalizeClinicalName(rawPatientName);
    const rawScanDate = dateMatch ? collapseWhitespace(dateMatch[1]) : null;
    const parsedLocalDate = parseLocalDate(rawScanDate);
    const heightCm = complexionMatch ? parseFloat(complexionMatch[1].replace(',', '.')) : null;
    const weightKg = complexionMatch ? parseFloat(complexionMatch[2].replace(',', '.')) : null;

    const patientMetadata = {
        name: rawPatientName,
        normalizedName: normalizedPatientName,
        sex: sexMatch ? collapseWhitespace(sexMatch[1]) : null,
        age: ageMatch ? collapseWhitespace(ageMatch[1]) : null,
        height: Number.isFinite(heightCm) ? heightCm : null,
        weight: Number.isFinite(weightKg) ? weightKg : null,
        scanDate: rawScanDate,
        parsedLocalDate: parsedLocalDate ? parsedLocalDate.toISOString() : null
    };

    const $ = cheerio.load(htmlContent);
    const { synthesisKeys, synthesisItems } = extractSynthesisReportItems($);

    const resultCategories = {};
    let totalParams = 0;
    let abnormalCount = 0;

    $('font[size="6"]').each(function () {
        const rawHeading = collapseWhitespace($(this).text());
        const lowerHeading = rawHeading
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        // Exclusión estricta de páginas de resumen/expertos/mano/síntesis tras colapsar saltos \r\n
        if (
            lowerHeading.includes('analisis de expertos') ||
            lowerHeading.includes('analisis de la mano') ||
            lowerHeading.includes('sintesis') ||
            lowerHeading.includes('compuesto') ||
            lowerHeading.includes('resumen')
        ) {
            return;
        }

        const catMatch = rawHeading.match(/\((.*?)\)/);
        const catTitle = catMatch ? collapseWhitespace(catMatch[1]) : collapseWhitespace(rawHeading.replace(/informe.*$/i, ''));
        if (!catTitle) return;

        const normKey = normalizeKey(catTitle);
        const catKey = CATEGORY_MAP[normKey] || normKey;
        const sectionTables = resolveSectionTables($, this);

        // Tratamiento dedicado para Composición Corporal ("Elementos humanos") con 15 KPIs reales
        if (catKey === 'body_composition') {
            const humanBlock = parseHumanElementsSection($, sectionTables, patientMetadata);
            if (humanBlock.total > 0) {
                resultCategories.body_composition = humanBlock;
                totalParams += humanBlock.total;
                abnormalCount += humanBlock.abnormalCount;
            }
            return;
        }

        const targetTable = sectionTables.filter('.table').first();
        if (!targetTable.length) return;

        if (!resultCategories[catKey]) {
            resultCategories[catKey] = {
                title: sanitizeClinicalSpanish(catTitle),
                key: catKey,
                total: 0,
                abnormalCount: 0,
                items: [],
                itemsDict: {}
            };
        }

        targetTable.find('tr').each(function () {
            const tds = $(this).find('td');
            // Soporta tablas estándar de 4 columnas y tablas especiales de 3 columnas (ej. Padecimientos Óseos)
            if (tds.length < 3) return;

            const rawName = collapseWhitespace($(tds[0]).text());
            const ref = collapseWhitespace($(tds[1]).text());
            const val = collapseWhitespace($(tds[2]).text());
            const imgSrc = tds.length >= 4
                ? ($(tds[3]).find('img, image').attr('src') || $(this).find('img, image').attr('src') || '')
                : '';

            const lowerName = rawName.toLowerCase();
            if (
                !rawName ||
                lowerName.includes('objeto') ||
                lowerName.includes('examinado') ||
                lowerName.includes('analizado') ||
                lowerName.includes('rango normal') ||
                lowerName.includes('parámetro') ||
                lowerName.includes('parametro')
            ) {
                return;
            }
            if (rawName.includes(':') && (lowerName.includes('nombre') || lowerName.includes('complex') || lowerName.includes('sexo') || lowerName.includes('edad'))) {
                return;
            }

            const cleanName = sanitizeClinicalSpanish(rawName);
            const paramKey = normalizeKey(cleanName);
            const rawParamKey = normalizeKey(rawName);
            const cleanValNum = cleanFloat(val);
            const status = evalParamStatus(imgSrc, val, ref);
            const iconFile = imgSrc ? decodeURIComponent(String(imgSrc)).split(/[\\/]/).pop() : '';
            const inSynthesisReport = Boolean(
                synthesisKeys.has(`${catKey}::${paramKey}`) ||
                synthesisKeys.has(`${catKey}::${rawParamKey}`)
            );

            const paramObj = {
                name: cleanName,
                displayName: cleanName,
                key: paramKey,
                value: String(val),
                val: String(val),
                raw_value: String(val),
                numeric_value: cleanValNum,
                reference: String(ref),
                ref: String(ref),
                iconCode: iconFile || null,
                status,
                inSynthesisReport
            };

            if (!resultCategories[catKey].itemsDict[paramKey]) {
                resultCategories[catKey].itemsDict[paramKey] = paramObj;
                resultCategories[catKey].items.push(paramObj);
                resultCategories[catKey].total += 1;
                totalParams += 1;

                if (!status.startsWith('NORMAL') && status !== '-') {
                    resultCategories[catKey].abnormalCount += 1;
                    abnormalCount += 1;
                }
            }
        });
    });

    return {
        success: Object.keys(resultCategories).length > 0,
        patientMetadata,
        categories: resultCategories,
        synthesisItems,
        synthesisCount: synthesisItems.length,
        totalParameters: totalParams,
        abnormalCount,
        parsedAt: new Date().toISOString()
    };
}

/**
 * Normaliza un objeto JSON telemétrico estructurado previamente preservando banderas de síntesis y unidades.
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
    });

    return {
        success: true,
        categories: resultCategories,
        totalParameters: totalParams,
        abnormalCount,
        parsedAt: new Date().toISOString()
    };
}

module.exports = {
    collapseWhitespace,
    normalizeKey,
    normalizeClinicalName,
    parseLocalDate,
    cleanFloat,
    evalParamStatus,
    isSyntheticElectretPayload,
    parseElectretHTML,
    parseElectretJSON,
    CATEGORY_MAP
};
