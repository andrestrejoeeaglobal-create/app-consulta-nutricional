/**
 * Catálogo Farmacopeico SSoTT Inmutable — Equipo en Acción® (Constitución v2.0.5 / NOM-043 / COFEPRIS)
 * Versión: v3.6.0-EGM76-SSoTT (Grado Médico y Farmacopeico Real de Planta)
 *
 * Fuente Única de Verdad para estequiometría oficial de planta (masa bruta de materia prima vs. aporte
 * elemental / extracto estandarizado real), códigos maestros MP, banderas de bioseguridad alergénica/mineral
 * y escalamiento matemático proporcional por fracción de toma (`doseFactor`).
 *
 * REGLAS INMUTABLES (EGM-49 / EGM-75 / EGM-76):
 * 1. Prohibido imprimir pesos brutos de sales o premezclas como si fueran miligramos de nutriente puro.
 * 2. Cero SKUs ficticios en inventario (prohibido inventar "Variante Libre de Estimulantes" o citar "NOM-028").
 * 3. 33Plus® (#B70E0C): Sobre oficial 10.6 g (1/2 sobre = 5.3 g) en 300 ml de agua natural. CERO L-Teanina.
 * 4. 34Plus® (#3AAA35): Sobre oficial 11.3645 g [11.4 g comercial] (1/2 sobre = 5.7 g) en MÍNIMO 500 ml de agua simple.
 * 5. Cero ampersand ('&') y cero paréntesis anidados ('(())'); uso de corchetes internos '[...]' cuando aplique.
 */

function formatCleanNumberEs(num, options = {}) {
    if (!Number.isFinite(num)) return '0';
    const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
    if (options.forceOneDecimal && Number.isInteger(rounded)) {
        const intWithComma = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return `${intWithComma}.0`;
    }
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
    safetyFlags: Object.freeze({
        containsCaffeine: true,
        caffeineMgPerSachet: 132,
        guaranaCode: 'MP017',
        containsSynephrine: true,
        synephrineMgPerSachet: 1.88,
        citrusAurantiumCode: 'MP031',
        containsSalicylates: true,
        whiteWillowCode: 'MP039',
        whiteWillowMgPerSachet: 80,
        containsBovineCollagen: true,
        bovineCollagenCode: 'MP009',
        bovineCollagenMgPerSachet: 200,
        containsProbioticStrain: true,
        probioticStrainCode: 'MP105',
        probioticStrainLabel: 'Lactobacillus acidophilus MP105',
        containsDairyWhey: false,
        containsCoralCalcium: false,
        containsKelpIodine: false,
        containsIronBisglycinate: false,
        vitaminCMgPerSachet: 1000
    }),
    heroActives: Object.freeze([
        Object.freeze({
            code: 'MP048',
            name: 'Vitamina C',
            amountNumeric: 1000,
            unit: 'mg',
            role: 'Cofactor endotelial de óxido nítrico y defensa antioxidante plasmática'
        }),
        Object.freeze({
            code: 'MP017',
            name: 'Extracto de Guaraná',
            amountNumeric: 600,
            unit: 'mg',
            equivPrefix: 'aporta ~',
            equivNumeric: 132,
            equivUnit: 'mg',
            equivLabel: 'de cafeína natural al 22 %',
            role: 'Activación bioenergética diurna y alerta neurocognitiva estandarizada'
        }),
        Object.freeze({
            code: 'MP026',
            name: 'L-Taurina',
            amountNumeric: 500,
            unit: 'mg',
            role: 'Modulación osmorreguladora y contráctil cardiometabólica'
        }),
        Object.freeze({
            code: 'MP080',
            name: 'L-Carnitina',
            amountNumeric: 500,
            unit: 'mg',
            role: 'Transporte mitocondrial de ácidos grasos y beta-oxidación limpia'
        }),
        Object.freeze({
            code: 'MP009',
            name: 'Colágeno Hidrolizado Bovino',
            amountNumeric: 200,
            unit: 'mg',
            isAnimalOrigin: true,
            animalSource: 'bovino',
            role: 'Sustrato peptídico complementario de soporte vascular'
        }),
        Object.freeze({
            code: 'MP039',
            name: 'Sauce Blanco',
            scientificName: 'Salix alba',
            amountNumeric: 80,
            unit: 'mg',
            staticNote: 'fuente de salicina',
            role: 'Modulación fitoquímica vascular estandarizada (fuente natural de salicina)'
        }),
        Object.freeze({
            code: 'MP012',
            name: 'Citrato de Magnesio',
            amountNumeric: 50,
            unit: 'mg',
            rawQualifier: 'de sal',
            equivPrefix: '~',
            equivNumeric: 7.7,
            equivUnit: 'mg',
            equivLabel: 'de Mg elemental',
            role: 'Cofactor enzimático bioenergético y equilibrio electrolítico'
        }),
        Object.freeze({
            code: 'MP104',
            name: 'Coenzima Q10',
            amountNumeric: 31.25,
            unit: 'mg',
            role: 'Cadena respiratoria mitocondrial y protección antioxidante endotelial'
        }),
        Object.freeze({
            code: 'MP031',
            name: 'Citrus aurantium',
            amountNumeric: 31.25,
            unit: 'mg',
            equivPrefix: '~',
            equivNumeric: 1.88,
            equivUnit: 'mg',
            equivLabel: 'de p-sinefrina',
            role: 'Termogénesis fisiológica suave estandarizada'
        }),
        Object.freeze({
            code: 'MP040',
            name: 'Semilla de Uva 95 %',
            fullName: 'Extracto de Semilla de Uva [95 % proantocianidinas]',
            amountNumeric: 18.75,
            unit: 'mg',
            role: 'Protección frente a peroxidación de partículas LDL y fluidez microvascular'
        }),
        Object.freeze({
            code: 'MP078',
            name: 'Picolinato de Cromo',
            amountNumeric: 188,
            unit: 'mcg',
            rawQualifier: 'de sal',
            equivPrefix: '',
            equivNumeric: 23.3,
            equivUnit: 'mcg',
            equivLabel: 'de Cr elemental',
            role: 'Sensibilidad del receptor metabólico y estabilidad energética diurna'
        })
    ]),
    traceabilityActives: Object.freeze([
        Object.freeze({
            code: 'MP105',
            name: 'Lactobacillus acidophilus',
            note: 'soporte probiótico complementario'
        })
    ]),
    botanicalComplexNote: 'complejo botánico energético natural estandarizado',
    dosageByMode: Object.freeze({
        PAUSED_PEDIATRIC: '0 sobres activos (etapa exclusiva de lactancia y pediatría)',
        PAUSED_MEDICAL: '0 sobres activos por ahora (en pausa preventiva hasta autorización médica)',
        PAUSED_SELECTIVE_33: '0 sobres activos de 33Plus® (pausa selectiva de bioseguridad por interacción farmacológica, salicilatos o etapa fisiológica)',
        MICRO_DOSE: 'Inicio gradual (Días 1–7): 1/2 sobre (5.3 g) al despertar en ayunas disuelto en 300 ml de agua natural (corte estricto antes de las 14:00 h)',
        MICRO_DOSE_NIGHT_SHIFT: 'Inicio gradual (Días 1–7): 1/2 sobre (5.3 g) al iniciar su jornada tras despertar disuelto en 300 ml de agua natural (suspender >= 8 h antes de su horario programado de sueño diurno)',
        RECALIBRATION_DOSE: 'Ajuste preventivo de toma (Días 1–7): 1/2 sobre (5.3 g) al despertar en ayunas disuelto en 300 ml de agua natural (corte estricto antes de las 14:00 h)',
        RECALIBRATION_DOSE_NIGHT_SHIFT: 'Ajuste preventivo de toma (Días 1–7): 1/2 sobre (5.3 g) al iniciar su jornada tras despertar disuelto en 300 ml de agua natural (suspender >= 8 h antes de su horario programado de sueño diurno)',
        CARDIOPROTECTIVE_CONTINUITY_1_SACHET: 'Pauta óptima cardioprotectora en sobre completo: 1 sobre completo matutino (10.6 g) al despertar en ayunas disuelto en 300 ml de agua natural (corte estricto antes de las 14:00 h; sin segunda carga de xantinas)',
        CARDIOPROTECTIVE_CONTINUITY_1_SACHET_NIGHT_SHIFT: 'Pauta óptima cardioprotectora en sobre completo: 1 sobre completo (10.6 g) al iniciar su jornada tras despertar disuelto en 300 ml de agua natural (suspender >= 8 h antes de su horario programado de sueño diurno; sin segunda carga de xantinas)',
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
    safetyFlags: Object.freeze({
        containsDairyWhey: true,
        dairyWheyCode: 'MP170',
        dairyWheyMgPerSachet: 2200,
        containsCoralCalcium: true,
        coralCalciumCode: 'MP121',
        coralCalciumGrossMgPerSachet: 800,
        coralCalciumElementalMgPerSachet: 304,
        containsBovineCollagen: true,
        bovineCollagenCode: 'MP009',
        bovineCollagenMgPerSachet: 500,
        containsKelpIodine: true,
        kelpCode: 'MP132',
        kelpMgPerSachet: 50,
        containsIronBisglycinate: true,
        ironBisglycinateCode: 'MP062',
        ironBisglycinateMgPerSachet: 10,
        containsVitaminK2Mk7: true,
        vitaminK2Code: 'MP172',
        vitaminK2PremixMgPerSachet: 1.0,
        vitaminK2ElementalMcgPerSachet: 10,
        containsPotassiumCitrate: true,
        potassiumCitrateCode: 'MP191',
        potassiumCitrateMgPerSachet: 200,
        magnesiumElementalMgPerSachet: 61.8,
        vitaminCMgPerSachet: 156.25
    }),
    heroActives: Object.freeze([
        Object.freeze({
            code: 'MP170',
            name: 'Proteína Aislada de Suero de Leche 90 %',
            amountNumeric: 2200,
            unit: 'mg',
            rawQualifier: 'totales',
            isDairyAllergen: true,
            isAnimalOrigin: true,
            animalSource: 'lácteo bovino [WPI 90 %]',
            role: 'Aporte de aminoácidos esenciales de alta biodisponibilidad para síntesis proteica estructural'
        }),
        Object.freeze({
            code: 'MP121',
            name: 'Calcio de Coral',
            amountNumeric: 800,
            unit: 'mg',
            equivPrefix: '~',
            equivNumeric: 304,
            equivUnit: 'mg',
            equivLabel: 'de Ca elemental',
            isAnimalOrigin: true,
            animalSource: 'coralino marino',
            role: 'Mineralización estructural ósea y reserva alcalina regulada'
        }),
        Object.freeze({
            code: 'MP009',
            name: 'Colágeno Hidrolizado Bovino',
            amountNumeric: 500,
            unit: 'mg',
            isAnimalOrigin: true,
            animalSource: 'bovino',
            role: 'Sustrato peptídico para matriz extracelular vascular, dérmica y fascial/articular'
        }),
        Object.freeze({
            code: 'MP021',
            name: 'L-Arginina',
            amountNumeric: 500,
            unit: 'mg',
            role: 'Precursor endotelial de óxido nítrico y perfusión reparadora tisular'
        }),
        Object.freeze({
            code: 'MP020',
            name: 'FOS-Inulina',
            amountNumeric: 400,
            unit: 'mg',
            role: 'Nutrición selectiva de microbiota colónica y captación entérica de lípidos y esteroles'
        }),
        Object.freeze({
            code: 'MP012',
            name: 'Citrato de Magnesio',
            amountNumeric: 400,
            unit: 'mg',
            rawQualifier: 'de sal',
            equivPrefix: '~',
            equivNumeric: 61.8,
            equivUnit: 'mg',
            equivLabel: 'de Mg elemental',
            role: 'Relajación neuromuscular, conducción eléctrica cardiaca y equilibrio mineral'
        }),
        Object.freeze({
            code: 'MP023',
            name: 'L-Glicina',
            amountNumeric: 200,
            unit: 'mg',
            role: 'Síntesis de colágeno, conjugación biliar Fase II y arquitectura del sueño profundo'
        }),
        Object.freeze({
            code: 'MP191',
            name: 'Citrato Tripotásico',
            amountNumeric: 200,
            unit: 'mg',
            role: 'Equilibrio ácido-base intracelular y soporte hidroelectrolítico'
        }),
        Object.freeze({
            code: 'MP048',
            name: 'Vitamina C',
            amountNumeric: 156.25,
            unit: 'mg',
            role: 'Hidroxilación nocturna de prolina y lisina en fibras de colágeno'
        }),
        Object.freeze({
            code: 'MP132',
            name: 'Alga Kelp',
            amountNumeric: 50,
            unit: 'mg',
            staticNote: 'fuente natural de yodo',
            role: 'Aporte oligomineral marino natural (fuente botánica de yodo)'
        }),
        Object.freeze({
            code: 'MP171',
            name: 'Zinc Optizinc',
            amountNumeric: 18.75,
            unit: 'mg',
            rawQualifier: 'de complejo',
            equivPrefix: '~',
            equivNumeric: 4.22,
            equivUnit: 'mg',
            equivLabel: 'de Zn elemental',
            role: 'Sellado de uniones estrechas epiteliales e inmunomodulación mucosa'
        }),
        Object.freeze({
            code: 'MP062',
            name: 'Bisglicinato Quelado de Hierro',
            amountNumeric: 10,
            unit: 'mg',
            rawQualifier: 'de quelato',
            role: 'Soporte de transporte celular de oxígeno y reposición mineral quelada'
        }),
        Object.freeze({
            code: 'MP123',
            name: 'L-Teanina',
            amountNumeric: 9.375,
            unit: 'mg',
            role: 'Modulación neurovegetativa vespertina/nocturna y transición a ondas alfa de descanso'
        }),
        Object.freeze({
            code: 'MP078',
            name: 'Picolinato de Cromo',
            amountNumeric: 188,
            unit: 'mcg',
            rawQualifier: 'de sal',
            equivPrefix: '',
            equivNumeric: 23.3,
            equivUnit: 'mcg',
            equivLabel: 'de Cr elemental',
            role: 'Sensibilidad del receptor de insulina en reposo nocturno'
        }),
        Object.freeze({
            code: 'MP130',
            name: 'Vitamina D3 Colecalciferol CWS',
            amountNumeric: 1.0,
            unit: 'mg',
            forceOneDecimal: true,
            rawQualifier: 'de premezcla',
            equivPrefix: '~',
            equivNumeric: 500,
            equivUnit: 'UI',
            secondaryEquivNumeric: 12.5,
            secondaryEquivUnit: 'mcg',
            role: 'Absorción y fijación homeostática de calcio e inmunomodulación'
        }),
        Object.freeze({
            code: 'MP172',
            name: 'Vitamina K2 MK-7',
            amountNumeric: 1.0,
            unit: 'mg',
            forceOneDecimal: true,
            rawQualifier: 'de premezcla estandarizada al 1 %',
            equivPrefix: '~',
            equivNumeric: 10,
            equivUnit: 'mcg',
            equivLabel: 'de MK-7',
            role: 'Activación de matriz Gla para fijación ósea de calcio y protección arterial'
        })
    ]),
    traceabilityActives: Object.freeze([]),
    dosageByMode: Object.freeze({
        PAUSED_PEDIATRIC: '0 sobres activos (etapa exclusiva de lactancia y pediatría)',
        PAUSED_MEDICAL: '0 sobres activos por ahora (en pausa preventiva hasta autorización médica)',
        PAUSED_SELECTIVE_34: '0 sobres activos de 34Plus® (pausa selectiva de bioseguridad por ingrediente activo de planta)',
        MICRO_DOSE: 'Inicio gradual (Días 1–7): 1/2 sobre (5.7 g) 30 a 60 min antes de dormir disuelto en MÍNIMO 500 ml de agua simple 💧',
        RECALIBRATION_DOSE: 'Ajuste preventivo de toma (Días 1–7): 1/2 sobre (5.7 g) 30 a 60 min antes de dormir disuelto en MÍNIMO 500 ml de agua simple 💧',
        STANDARD_DOSE: '2 tomas vespertinas/nocturnas: 1 sobre (11.4 g) a media tarde y 1 sobre (11.4 g) 30 a 60 min antes de dormir, cada uno en MÍNIMO 500 ml de agua simple 💧'
    })
});

function formatSingleActiveStoichiometry(act, factor = 1, includeCodes = true) {
    if (!act) return '';
    const grossVal = formatCleanNumberEs(act.amountNumeric * factor, { forceOneDecimal: Boolean(act.forceOneDecimal) });
    const qualPart = act.rawQualifier ? ` ${act.rawQualifier}` : '';
    let inner = `${grossVal} ${act.unit}${qualPart}`;

    if (Number.isFinite(act.equivNumeric)) {
        const eqVal = formatCleanNumberEs(act.equivNumeric * factor);
        const eqPrefix = act.equivPrefix !== undefined ? act.equivPrefix : '~';
        const eqLabel = act.equivLabel ? ` ${act.equivLabel}` : '';
        let secBracket = '';
        if (Number.isFinite(act.secondaryEquivNumeric) && act.secondaryEquivUnit) {
            const secVal = formatCleanNumberEs(act.secondaryEquivNumeric * factor);
            secBracket = ` [${secVal} ${act.secondaryEquivUnit}]`;
        }
        inner += ` • ${eqPrefix}${eqVal} ${act.equivUnit}${eqLabel}${secBracket}`;
    } else if (act.staticNote) {
        inner += ` • ${act.staticNote}`;
    }

    return includeCodes
        ? `${act.name} ${act.code} (${inner})`
        : `${act.name} (${inner})`;
}

/**
 * Devuelve la cita farmacopeica exacta por sobre unitario de un ingrediente específico (por código MP o patrón),
 * evitando cualquier impresión de masa bruta sin su equivalencia elemental/estandarizada.
 */
function formatSingleSachetActiveCitation(formulaOrKey, codeOrRegex, options = {}) {
    const formula = typeof formulaOrKey === 'string'
        ? (String(formulaOrKey).toUpperCase().includes('33') ? FORMULA_33PLUS : FORMULA_34PLUS)
        : (formulaOrKey || FORMULA_34PLUS);
    const list = [...(formula.heroActives || []), ...(formula.traceabilityActives || [])];
    const match = list.find((a) => {
        if (!a) return false;
        if (codeOrRegex instanceof RegExp) return codeOrRegex.test(`${a.code || ''} ${a.name || ''}`);
        const needle = String(codeOrRegex || '').toUpperCase();
        return String(a.code || '').toUpperCase() === needle || String(a.name || '').toUpperCase().includes(needle);
    });
    if (!match) return '';
    if (!Number.isFinite(match.amountNumeric)) {
        return options.includeCodes === false ? match.name : `${match.name} ${match.code}`;
    }
    const perSachetSuffix = options.withPerSachetSuffix ? '/sobre' : '';
    const base = formatSingleActiveStoichiometry(match, 1, options.includeCodes !== false);
    return perSachetSuffix ? base.replace(/\)$/, `${perSachetSuffix})`) : base;
}

/**
 * Calcula estequiométricamente la masa bruta y el ion elemental / extracto estandarizado aportados
 * por la fracción de pauta sugerida (`doseFactor`), con trazabilidad completa al sobre oficial COFEPRIS.
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
        const scaledItems = formula.heroActives.map((act) =>
            formatSingleActiveStoichiometry(act, factor, includeCodes)
        );
        if (Array.isArray(formula.traceabilityActives) && formula.traceabilityActives.length > 0) {
            formula.traceabilityActives.forEach((tr) => {
                if (!tr?.name) return;
                scaledItems.push(includeCodes ? `${tr.name} ${tr.code} (${tr.note || 'trazabilidad probiótica'})` : `${tr.name} (${tr.note || 'trazabilidad probiótica'})`);
            });
        }

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
            ? `1/2 sobre [${formula.halfSachetGramsDisplay}]`
            : factor === 1
                ? `1 sobre completo [${formula.sachetGramsDisplay}]`
                : factor === 2
                    ? `2 sobres/día [${totalGramsExact} totales; ${formula.sachetGramsDisplay} c/u]`
                    : `${formatCleanNumberEs(factor)} sobres [${totalGramsExact}]`;

        const exactSachetRef = formula.code === '34PLUS'
            ? `${formula.sachetGramsDisplay} [11.3645 g exactos]`
            : formula.sachetGramsDisplay;

        const clinicalHeaderName = factor === 0.5
            ? `${formula.brandTitle} (Fracción Inicial Gradual ${fractionLabel} • 50 % del sobre oficial de ${exactSachetRef}) — Aporte neto diario sugerido: ${activesInline}`
            : factor === 1
                ? `${formula.brandTitle} (Pauta de Sobre Completo ${fractionLabel} • 100 % respecto al sobre unitario oficial de ${exactSachetRef}) — Aporte neto diario sugerido: ${activesInline}`
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
    version: '3.6.0-EGM76-SSoTT',
    formulas: Object.freeze({
        FORMULA_33PLUS,
        FORMULA_34PLUS
    })
});

export {
    PHARMACOPEIA_CATALOG_SSOT,
    FORMULA_33PLUS,
    FORMULA_34PLUS,
    formatSingleActiveStoichiometry,
    formatSingleSachetActiveCitation,
    formatScaledActives
};
