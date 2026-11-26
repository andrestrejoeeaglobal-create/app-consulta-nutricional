/**
 * Catálogo Farmacopeico SSoTT Inmutable — Equipo en Acción® (Constitución v2.0.5 / NOM-043 / COFEPRIS)
 * Fuente Única de Verdad para estequiometría oficial de planta, códigos maestros de materia prima (MP),
 * escalamiento matemático proporcional por fracción de dosis (doseFactor) y separación estricta de activos.
 *
 * REGLAS INMUTABLES (EGM-49):
 * 1. Cero SKUs ficticios en inventario (prohibido inventar "Variante Libre de Estimulantes" o citar "NOM-028").
 * 2. 33Plus® (#B70E0C): Sobre oficial 10.6 g (1/2 sobre = 5.3 g) en 300 ml de agua natural. Incluye complejo botánico energético natural. CERO L-Teanina.
 * 3. 34Plus® (#3AAA35): Sobre oficial 11.3645 g [11.4 g comercial] (1/2 sobre = 5.7 g [5.68 g]) en MÍNIMO 500 ml de agua simple. Incluye L-Teanina MP123.
 * 4. Cero ampersand ('&'); uso exclusivo de conjunción española ('y').
 */

function formatCleanNumberEs(num) {
    if (!Number.isFinite(num)) return '0';
    const rounded = Number(num.toFixed(2));
    const [intPart, decPart] = String(rounded).split('.');
    const intWithComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart ? `${intWithComma}.${decPart}` : intWithComma;
}

const FORMULA_33PLUS = Object.freeze({
    code: '33PLUS',
    id: 'sup_33plus',
    brandTitle: '33Plus®',
    uiAccentHex: '#B70E0C',
    phaseRole: 'DIURNO',
    sachetGramsExact: 10.6,
    sachetGramsDisplay: '10.6 g',
    halfSachetGramsExact: 5.3,
    halfSachetGramsDisplay: '5.3 g',
    minWaterMl: 300,
    waterMedium: 'agua natural o tibia',
    cutoffHour24: '14:00 h',
    containsNaturalBotanicalXanthines: true,
    forbiddenActives: Object.freeze(['L-Teanina', 'MP123']),
    heroActives: Object.freeze([
        Object.freeze({ code: 'MP026', name: 'L-Taurina', amountNumeric: 500, unit: 'mg', role: 'Modulación osmorreguladora y contráctil cardiometabólica' }),
        Object.freeze({ code: 'MP080', name: 'L-Carnitina', amountNumeric: 500, unit: 'mg', role: 'Transporte mitocondrial de ácidos grasos y beta-oxidación limpia' }),
        Object.freeze({ code: 'MP104', name: 'Coenzima Q10', amountNumeric: 31.25, unit: 'mg', role: 'Cadena respiratoria mitocondrial y protección antioxidante endotelial' }),
        Object.freeze({ code: 'MP040', name: 'Semilla de Uva 95 %', fullName: 'Extracto de Semilla de Uva (95 % proantocianidinas)', amountNumeric: 18.75, unit: 'mg', role: 'Protección frente a peroxidación de partículas LDL y fluidez microvascular' }),
        Object.freeze({ code: 'MP048', name: 'Vitamina C', amountNumeric: 1000, unit: 'mg', role: 'Cofactor endotelial de óxido nítrico y defensa antioxidante plasmática' }),
        Object.freeze({ code: 'MP078', name: 'Picolinato de Cromo', amountNumeric: 188, unit: 'mcg', role: 'Sensibilidad del receptor metabólico y estabilidad energética diurna' })
    ]),
    botanicalComplexNote: 'complejo botánico energético natural estandarizado',
    dosageByMode: Object.freeze({
        PAUSED_PEDIATRIC: '0 sobres activos (etapa exclusiva de lactancia y pediatría)',
        PAUSED_MEDICAL: '0 sobres activos por ahora (en pausa preventiva hasta autorización médica)',
        PAUSED_SELECTIVE_33: '0 sobres activos de 33Plus® (pausa selectiva de bioseguridad por interacción simpaticomimética / etapa fisiológica)',
        MICRO_DOSE: 'Inicio gradual (Días 1–7): 1/2 sobre (5.3 g) al despertar en ayunas disuelto en 300 ml de agua natural (corte estricto antes de las 14:00 h)',
        RECALIBRATION_DOSE: 'Ajuste preventivo de toma (Días 1–7): 1/2 sobre (5.3 g) al despertar en ayunas disuelto en 300 ml de agua natural (corte estricto antes de las 14:00 h)',
        STANDARD_DOSE: '2 tomas matutinas: 1 sobre (10.6 g) al despertar en ayunas y 1 sobre (10.6 g) a media mañana, cada uno en 300 ml de agua natural (antes de las 14:00 h)'
    })
});

const FORMULA_34PLUS = Object.freeze({
    code: '34PLUS',
    id: 'sup_34plus',
    brandTitle: '34Plus®',
    uiAccentHex: '#3AAA35',
    phaseRole: 'VESPERTINO_NOCTURNO',
    sachetGramsExact: 11.3645,
    sachetGramsDisplay: '11.4 g',
    halfSachetGramsExact: 5.6823,
    halfSachetGramsDisplay: '5.7 g',
    minWaterMl: 500,
    waterMedium: 'agua simple',
    containsNaturalBotanicalXanthines: false,
    heroActives: Object.freeze([
        Object.freeze({ code: 'MP009', name: 'Colágeno Hidrolizado', amountNumeric: 500, unit: 'mg', role: 'Sustrato peptídico para matriz extracelular vascular, dérmica y articular' }),
        Object.freeze({ code: 'MP123', name: 'L-Teanina', amountNumeric: 9.375, unit: 'mg', role: 'Modulación neurovegetativa vespertina/nocturna y transición a ondas alfa de descanso' }),
        Object.freeze({ code: 'MP023', name: 'L-Glicina', amountNumeric: 200, unit: 'mg', role: 'Síntesis de colágeno, conjugación biliar Fase II y arquitectura del sueño profundo' }),
        Object.freeze({ code: 'MP020', name: 'FOS-Inulina Prebiótica', amountNumeric: 400, unit: 'mg', role: 'Nutrición selectiva de microbiota colónica y captación entérica de lípidos y esteroles' }),
        Object.freeze({ code: 'MP012', name: 'Citrato de Magnesio', amountNumeric: 400, unit: 'mg', role: 'Relajación neuromuscular, conducción eléctrica cardiaca y equilibrio mineral' }),
        Object.freeze({ code: 'MP048', name: 'Vitamina C', amountNumeric: 156.25, unit: 'mg', role: 'Hidroxilación nocturna de prolina y lisina en fibras de colágeno' }),
        Object.freeze({ code: 'MP172', name: 'Vitamina K2 MK-7', amountNumeric: 1, unit: 'mg', role: 'Activación de matriz Gla para fijación ósea de calcio y protección arterial' }),
        Object.freeze({ code: 'MP171', name: 'Zinc Optizinc', amountNumeric: 18.75, unit: 'mg', role: 'Sellado de uniones estrechas epiteliales e inmunomodulación mucosa' })
    ]),
    dosageByMode: Object.freeze({
        PAUSED_PEDIATRIC: '0 sobres activos (etapa exclusiva de lactancia y pediatría)',
        PAUSED_MEDICAL: '0 sobres activos por ahora (en pausa preventiva hasta autorización médica)',
        MICRO_DOSE: 'Inicio gradual (Días 1–7): 1/2 sobre (5.7 g) 30 a 60 min antes de dormir disuelto en MÍNIMO 500 ml de agua simple 💧',
        RECALIBRATION_DOSE: 'Ajuste preventivo de toma (Días 1–7): 1/2 sobre (5.7 g) 30 a 60 min antes de dormir disuelto en MÍNIMO 500 ml de agua simple 💧',
        STANDARD_DOSE: '2 tomas vespertinas/nocturnas: 1 sobre (11.4 g) a media tarde y 1 sobre (11.4 g) 30 a 60 min antes de dormir, cada uno en MÍNIMO 500 ml de agua simple 💧'
    })
});

/**
 * Calcula estequiométricamente los miligramos/microgramos exactos aportados por la fracción de dosis prescrita
 * con doble claridad regulatoria (aporte neto prescrito + referencia explícita al sobre unitario oficial COFEPRIS).
 */
function formatScaledActives(productKey, doseFactor = 1, options = {}) {
    try {
        const key = String(productKey || '').toUpperCase();
        const formula = key.includes('33') ? FORMULA_33PLUS : FORMULA_34PLUS;
        const factor = Number(doseFactor);

        if (!Number.isFinite(factor) || factor <= 0) {
            const pausedInline = '0 mg de activos concentrados (fórmula en pausa preventiva de bioseguridad)';
            return {
                doseFactor: 0,
                totalGramsDisplay: '0 g',
                fractionLabel: '0 sobres activos',
                activesInline: pausedInline,
                activeListText: pausedInline,
                clinicalHeaderName: `${formula.brandTitle} — En pausa preventiva de bioseguridad (0 sobres activos)`,
                regulatorySummary: `${formula.brandTitle} diferido temporalmente (0 sobres activos; sobre oficial de planta ${formula.sachetGramsDisplay}).`
            };
        }

        const includeCodes = options.includeCodes !== false;
        const scaledItems = formula.heroActives.map((act) => {
            const val = formatCleanNumberEs(act.amountNumeric * factor);
            return includeCodes
                ? `${act.name} ${act.code} (${val} ${act.unit})`
                : `${act.name} (${val} ${act.unit})`;
        });

        const activesInline = scaledItems.length > 1
            ? `${scaledItems.slice(0, -1).join(', ')} y ${scaledItems[scaledItems.length - 1]}`
            : (scaledItems[0] || '');

        const pctOfSingleSachet = Math.round(factor * 100);
        const totalGramsExact = formula.code === '34PLUS' && factor === 0.5
            ? '5.7 g'
            : formula.code === '34PLUS' && factor === 1
                ? '11.4 g'
                : `${formatCleanNumberEs(Number((formula.sachetGramsDisplay.replace(/[^\d.]/g, '')) * factor))} g`;

        const fractionLabel = factor === 0.5
            ? `1/2 sobre (${formula.halfSachetGramsDisplay})`
            : factor === 1
                ? `1 sobre (${formula.sachetGramsDisplay})`
                : factor === 2
                    ? `2 sobres/día (${totalGramsExact} totales; ${formula.sachetGramsDisplay} c/u)`
                    : `${formatCleanNumberEs(factor)} sobres (${totalGramsExact})`;

        const exactSachetRef = formula.code === '34PLUS'
            ? `${formula.sachetGramsDisplay} [11.3645 g exactos]`
            : formula.sachetGramsDisplay;

        const clinicalHeaderName = factor === 0.5
            ? `${formula.brandTitle} (Fracción Inicial Gradual ${fractionLabel} • 50 % del sobre oficial de ${exactSachetRef}) — Aporte neto diario sugerido: ${activesInline}`
            : factor === 2
                ? `${formula.brandTitle} (Pauta de Sobre Completo ${fractionLabel} • 200 % diario respecto al sobre unitario de ${exactSachetRef}) — Aporte neto diario sugerido: ${activesInline}`
                : `${formula.brandTitle} (Pauta ${fractionLabel} • ${pctOfSingleSachet} % respecto al sobre oficial de ${exactSachetRef}) — Aporte neto diario sugerido: ${activesInline}`;

        const regulatorySummary = `Aporte neto en la pauta nutricional sugerida (${fractionLabel}; ${pctOfSingleSachet} % respecto al sobre unitario oficial de ${exactSachetRef}): ${activesInline}`;

        return {
            doseFactor: factor,
            totalGramsDisplay: totalGramsExact,
            fractionLabel,
            activesInline,
            activeListText: activesInline,
            clinicalHeaderName,
            regulatorySummary
        };
    } catch (_) {
        const fallbackInline = 'Respaldo determinista SSoTT sin datos simulados';
        return {
            doseFactor: 0,
            totalGramsDisplay: '0 g',
            fractionLabel: '0 sobres activos',
            activesInline: fallbackInline,
            activeListText: fallbackInline,
            clinicalHeaderName: 'Fórmula en validación clínica SSoTT',
            regulatorySummary: 'Respaldo determinista SSoTT activo.'
        };
    }
}

const PHARMACOPEIA_CATALOG_SSOT = Object.freeze({
    version: '3.3.0-EGM51-SSoTT',
    formulas: Object.freeze({
        FORMULA_33PLUS,
        FORMULA_34PLUS
    })
});

module.exports = {
    PHARMACOPEIA_CATALOG_SSOT,
    FORMULA_33PLUS,
    FORMULA_34PLUS,
    formatScaledActives
};
