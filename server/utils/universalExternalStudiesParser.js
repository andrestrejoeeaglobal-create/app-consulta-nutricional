const fs = require('fs');
const path = require('path');

let pdfParseLib = null;
try {
    pdfParseLib = require('pdf-parse');
} catch (_) {
    pdfParseLib = null;
}

function slugifyToken(raw) {
    return String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[μµ]/g, 'u')
        .replace(/%/g, 'pct')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

function normalizeUnitDisplay(rawUnit) {
    const s = String(rawUnit || '').trim().replace(/μ/g, 'µ');
    if (!s) return 'índice';
    if (/g\/dl\s*\(%\)/i.test(s)) return 'g/dL';
    if (/ml\/min\/1\.73\s*m2/i.test(s)) return 'mL/min/1.73 m²';
    return s;
}

function buildAnalyteUid(name, unit, studyDateIso) {
    const nameSlug = slugifyToken(name) || 'analito';
    const unitSlug = slugifyToken(normalizeUnitDisplay(unit)) || 'indice';
    const datePart = String(studyDateIso || 'sin_fecha').trim();
    return `${nameSlug}::${unitSlug}::${datePart}`;
}

function parseDateFromText(text) {
    const s = String(text || '');
    const prioritizedPatterns = [
        /(?:Fecha\s+de\s+Registro|Fecha\s+Examen|CAPTURA|Fecha\s+de\s+Toma|Fecha)\s*[:\t ]*\s*(\d{2})[/-](\d{2})[/-](\d{4})/i,
        /\b(\d{2})[/-](\d{2})[/-](\d{4})\s+\d{2}:\d{2}/
    ];
    for (const re of prioritizedPatterns) {
        const m = s.match(re);
        if (m) {
            const dd = m[1];
            const mm = m[2];
            const yyyy = m[3];
            if (Number(yyyy) >= 1990 && Number(yyyy) <= 2100 && Number(mm) >= 1 && Number(mm) <= 12) {
                return { iso: `${yyyy}-${mm}-${dd}`, display: `${dd}/${mm}/${yyyy}` };
            }
        }
    }
    const allDates = [...s.matchAll(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/g)];
    for (const m of allDates) {
        const dd = m[1];
        const mm = m[2];
        const yyyy = m[3];
        // Ignorar fechas de nacimiento típicas si están precedidas por nacimiento o paréntesis de edad
        const idx = m.index || 0;
        const prefix = s.slice(Math.max(0, idx - 30), idx);
        if (/nacimiento|años\s*\(/i.test(prefix)) continue;
        if (Number(yyyy) >= 2000 && Number(yyyy) <= 2100 && Number(mm) >= 1 && Number(mm) <= 12) {
            return { iso: `${yyyy}-${mm}-${dd}`, display: `${dd}/${mm}/${yyyy}` };
        }
    }
    return { iso: null, display: null };
}

function computeVigenciaMeta(studyDateIso, referenceNow = new Date()) {
    if (!studyDateIso) {
        return {
            study_date_iso: null,
            study_date_display: null,
            age_days: null,
            tier: 'INTERMEDIA',
            is_historical: false,
            label: 'Fecha de toma no especificada en documento'
        };
    }
    const parts = studyDateIso.split('-').map(Number);
    const dt = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    const diffMs = referenceNow.getTime() - dt.getTime();
    const ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const display = `${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[0]}`;

    if (ageDays <= 90) {
        return {
            study_date_iso: studyDateIso,
            study_date_display: display,
            age_days: ageDays,
            tier: 'VIGENTE',
            is_historical: false,
            label: `Estudio vigente (${display} • ${ageDays} días)`
        };
    }
    if (ageDays <= 180) {
        return {
            study_date_iso: studyDateIso,
            study_date_display: display,
            age_days: ageDays,
            tier: 'INTERMEDIA',
            is_historical: false,
            label: `Vigencia intermedia (${display} • ${ageDays} días)`
        };
    }
    return {
        study_date_iso: studyDateIso,
        study_date_display: display,
        age_days: ageDays,
        tier: 'HISTORICA',
        is_historical: true,
        label: `Referencia histórica (> 6 meses • ${display})`
    };
}

function sanitizeLabReferenceRange(rawRef, rawLineContext = '') {
    let ref = String(rawRef || '').trim().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
    if (/^\d{3,4}$/.test(ref) && rawLineContext) {
        const rangeInCtx = String(rawLineContext).match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
        if (rangeInCtx) {
            ref = `${rangeInCtx[1]} - ${rangeInCtx[2]}`;
        }
    }
    ref = ref
        .replace(/^<\s*/, '< ')
        .replace(/^<=\s*/, '<= ')
        .replace(/^>\s*/, '> ')
        .replace(/^>=\s*/, '>= ')
        .replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/, '$1 - $2');
    return ref.trim();
}

function evaluateAnalyteStatus(numVal, cleanRef, fallbackStatus = 'NORMAL') {
    if (!Number.isFinite(numVal) || !cleanRef) return fallbackStatus || 'NORMAL';
    const bi = cleanRef.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
    if (bi) {
        const min = Math.min(parseFloat(bi[1]), parseFloat(bi[2]));
        const max = Math.max(parseFloat(bi[1]), parseFloat(bi[2]));
        if (numVal < min) return 'BAJO';
        if (numVal > max) return 'ELEVADO';
        return 'NORMAL';
    }
    const lt = cleanRef.match(/^<=?\s*(-?\d+(?:\.\d+)?)$/);
    if (lt) {
        const max = parseFloat(lt[1]);
        return numVal > max ? 'ELEVADO' : 'NORMAL';
    }
    const gt = cleanRef.match(/^>=?\s*(-?\d+(?:\.\d+)?)$/);
    if (gt) {
        const min = parseFloat(gt[1]);
        return numVal < min ? 'BAJO' : 'NORMAL';
    }
    return fallbackStatus || 'NORMAL';
}

const SECTION_CATALOG = [
    {
        match: /^(?:QU[ÍI]MICA\s+INTEGRAL|FUNCI[ÓO]N\s+RENAL|ELECTROLITOS)/i,
        id: 'quimica_renal_electrolitos',
        title: '1. Química Integral, Función Renal y Electrolitos',
        domain: 'QUÍMICA SANGUÍNEA, FUNCIÓN RENAL Y ELECTROLITOS SÉRICOS',
        desc: 'Evaluación cuantitativa de glucemia basal, depuración nitrogenada glomerular y equilibrio hidroelectrolítico.'
    },
    {
        match: /^(?:RIESGO\s+CARDIOVASCULAR|PERFIL\s+DE\s+L[ÍI]PIDOS|PERFIL\s+LIP[ÍI]DICO)/i,
        id: 'riesgo_cardiovascular_lipidos',
        title: '2. Riesgo Cardiovascular y Perfil Lipídico',
        domain: 'PERFIL LIPÍDICO AMPLIADO Y RIESGO CARDIOMETABÓLICO',
        desc: 'Cuantificación de fracciones lipoproteicas, partículas LDL pequeñas y densas (sdLDL), índices aterogénicos y PCR ultrasensible.'
    },
    {
        match: /^(?:FUNCIONAMIENTO\s+HEP[ÁA]TICO|PRUEBAS\s+DE\s+FUNCI[ÓO]N\s+HEP[ÁA]TICA)/i,
        id: 'funcionamiento_hepatico',
        title: '3. Funcionamiento Hepático y Enzimas',
        domain: 'FUNCIÓN HEPATOBILIAR, TRANSAMINASAS Y SÍNTESIS PROTEICA',
        desc: 'Evaluación de conjugación biliar, integridad hepatocelular, actividad canalicular y síntesis proteica visceral.'
    },
    {
        match: /^(?:METABOLISMO\s+DE\s+HIERRO|CIN[ÉE]TICA\s+DE\s+HIERRO|PERFIL\s+DE\s+HIERRO)/i,
        id: 'metabolismo_hierro',
        title: '4. Metabolismo de Hierro',
        domain: 'CINÉTICA FÉRRICA Y TRANSPORTE ERITROIDE',
        desc: 'Valoración del hierro sérico disponible, capacidad de fijación de transferrina y porcentaje de saturación.'
    },
    {
        match: /^(?:RESPUESTA\s+INMUNOL[ÓO]GICA|INMUNOGLOBULINAS|INMUNOLOG[ÍI]A)/i,
        id: 'respuesta_inmunologica',
        title: '5. Respuesta Inmunológica',
        domain: 'INMUNIDAD HUMORAL E INMUNOGLOBULINAS SÉRICAS',
        desc: 'Cuantificación de anticuerpos circulantes IgG, IgA e IgM.'
    },
    {
        match: /^(?:BIOMETR[ÍI]A\s+HEM[ÁA]TICA|CITOMETR[ÍI]A\s+HEM[ÁA]TICA|HEMOGRAMA)/i,
        id: 'biometria_hematica',
        title: '6. Biometría Hemática',
        domain: 'CITOMETRÍA HEMÁTICA: SERIE ROJA, PLAQUETARIA Y DIFERENCIAL LEUCOCITARIO',
        desc: 'Evaluación integral de eritropoyesis, índices corpusculares, plaquetas y fórmula blanca relativa (%) y absoluta (miles/µL).'
    },
    {
        match: /^(?:EXAMEN\s+GENERAL\s+DE\s+ORINA|URIAN[ÁA]LISIS)/i,
        id: 'urianalisis_ego',
        title: '7. Examen General de Orina (EGO)',
        domain: 'URIANÁLISIS FÍSICO-QUÍMICO Y SEDIMENTO URINARIO',
        desc: 'Evaluación urinaria de densidad, proteinuria, glucosuria y sedimento microscópico.'
    },
    {
        match: /^(?:PERFIL\s+TIROIDEO|ENDOCRINOLOG[ÍI]A|HORMONAS)/i,
        id: 'endocrinologia_hormonas',
        title: '8. Perfil Hormonal y Tiroideo',
        domain: 'SEÑALIZACIÓN NEUROENDOCRINA Y FUNCIÓN TIROIDEA',
        desc: 'Cuantificación hormonal sérica.'
    }
];

function canonicalizeAnalyteDisplayName(rawName) {
    const clean = String(rawName || '').replace(/\s+/g, ' ').replace(/^Relación:\s*/i, 'Relación ').trim();
    if (/^Colesterol$/i.test(clean)) return 'Colesterol total';
    if (/^F\.\s*Alcalina\s+total$/i.test(clean)) return 'Fosfatasa Alcalina total';
    if (/^Gama\s+glutamil\s+transpeptidasa$/i.test(clean)) return 'Gama glutamil transpeptidasa (GGT)';
    if (/^Prote[íi]na\s+C\s+Reactiva\s+ultrasensible$/i.test(clean)) return 'Proteína C Reactiva ultrasensible (PCR-us)';
    if (/^Tasa\s+de\s+filtraci[óo]n\s+glomerular\s+estimada$/i.test(clean)) return 'Tasa de filtración glomerular estimada (TFGe)';
    if (/^Hemat[óo]crito$/i.test(clean)) return 'Hematocrito';
    if (/^Ancho\s+de\s+Distrib\.\s+de\s+Eritrocitos\s*\(CV\)$/i.test(clean)) return 'Ancho de Distribución de Eritrocitos (CV)';
    if (/^Ancho\s+de\s+Distrib\.\s+de\s+Eritrocitos\s*\(SD\)$/i.test(clean)) return 'Ancho de Distribución de Eritrocitos (SD)';
    if (/^Volumen\s+Corp\.\s+Medio$/i.test(clean)) return 'Volumen Corpuscular Medio (VCM)';
    if (/^Hemoglobina\s+Corp\.\s+Media$/i.test(clean)) return 'Hemoglobina Corpuscular Media (HCM)';
    if (/^Conc\.\s+Media\s+de\s+Hemoglobina\s+Corp\.$/i.test(clean)) return 'Conc. Media de Hemoglobina Corp. (CMHC)';
    return clean;
}

function isNonAnalyteNoiseLine(line) {
    const s = String(line || '').trim();
    if (!s) return true;
    if (/^[_=\-*]{3,}$/.test(s)) return true;
    if (/^(?:Prueba|Paciente:|Sexo:|Fecha\s+de\s+Registro:|Dirigido\s+a:|Edad:|Hoja:|Resultados|An[áa]lisis\s+Cl[íi]nicos|Bajo\s*\(LR\)|años|Orden:|ID\s+Paciente:|Fecha\s+de\s+nacimiento:)/i.test(s)) return true;
    if (/^(?:L[íi]mites\s+de\s+[Rr]eferencia|Categor[íi]as\s+de\s+Tasa|Estadio\s+G[1-5]|Fuente:|De\s+acuerdo\s+con\s+la\s+gu[íi]a|Chronic\s+Kidney|clasificaciones\s+G3|uso\s+de\s+pruebas|diagn[óo]stico\s+de\s+enfermedad|consecutivas\s+por\s+debajo)/i.test(s)) return true;
    if (/^(?:Instituciones\s+CDC|Prote[íi]na\s+C\s+reactiva\s+ultrasensible\s*\(mg\/dL\)|AHA:|CDC:|Nota:|La\s+relaci[óo]n\s+AST\/ALT|est[áa]\s+fuera\s+de\s+los\s+l[íi]mites|M[ée]todo:|INFORME\s+FINAL|Q\.F\.B\.|Universidad|Gracias\s+por|Responsable\s+del|Acreditaci[óo]n|PUE\s+No:|"Consulte\s+el\s+alcance|www\.|SUCURSAL|AV\s+PASEO|TOLUCA|GRUPO\s+DIAGN[ÓO]STICO|DR\(A\)\.|IB0\d+)/i.test(s)) return true;
    if (/^(?:<\s*\d+.*(?:Óptimo|Deseable|Normal|Bajo|Riesgo)|>\s*o\s*=|\d+\s*-\s*\d+\s+(?:Lim[íi]trofe|Cercano|Alto|Moderadamente|Promedio)|>\s*0\.3\s*mg\/dL\s+Alto|AST\/ALT\s*[<>])/i.test(s)) return true;
    return false;
}

function parseRefAndUnitLine(line) {
    const s = String(line || '').trim().replace(/[–—]/g, '-');
    // Bilateral: "55 - 99 mg/dL" o "9.3 - 19.5" o "32.0-36.0 g/dL (%)"
    const bi = s.match(/^(-?\d+(?:[.,]\d+)?\s*-\s*-?\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (bi) {
        const tail = bi[2].trim();
        // Descartar líneas explicativas como "200 - 239 Limítrofe" o "0.1 - 0.3 mg/dL Promedio"
        if (/(?:Lim[íi]trofe|Cercano|Moderadamente|Alto|Bajo|Deseable|Óptimo|Promedio|TFG|fallo)/i.test(tail)) {
            return null;
        }
        return {
            ref: sanitizeLabReferenceRange(bi[1].replace(/,/g, '.'), s),
            unit: normalizeUnitDisplay(tail)
        };
    }
    // Unilateral: "< 200 mg/dL", ">60 mL/min/1.73m2", "< 4.5"
    const uni = s.match(/^(<=?|>=?)\s*(-?\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (uni) {
        const tail = uni[3].trim();
        if (/(?:Lim[íi]trofe|Cercano|Moderadamente|Alto|Bajo|Deseable|Óptimo|Promedio|TFG|fallo|Riesgo|Relacionado)/i.test(tail)) {
            return null;
        }
        return {
            ref: sanitizeLabReferenceRange(`${uni[1]} ${uni[2].replace(/,/g, '.')}`, s),
            unit: normalizeUnitDisplay(tail)
        };
    }
    return null;
}

async function extractPdfPagesSafe(filePath) {
    if (!pdfParseLib) return { numpages: 0, fullText: '', pagesText: [] };
    try {
        const buf = fs.readFileSync(filePath);
        const pagesText = [];
        const options = {
            pagerender: async (pageData) => {
                const textContent = await pageData.getTextContent();
                let lastY = null;
                let text = '';
                for (const item of textContent.items) {
                    if (lastY === item.transform[5] || lastY === null) {
                        text += item.str;
                    } else {
                        text += '\n' + item.str;
                    }
                    lastY = item.transform[5];
                }
                pagesText.push(text);
                return text;
            }
        };
        const parsed = await pdfParseLib(buf, options);
        return {
            numpages: parsed.numpages || pagesText.length || 1,
            fullText: parsed.text || pagesText.join('\n\n'),
            pagesText: pagesText.length > 0 ? pagesText : [parsed.text || '']
        };
    } catch (err) {
        console.warn(`⚠️ [pdf-parse safe catch] (${path.basename(filePath)}):`, err.message);
        return { numpages: 0, fullText: '', pagesText: [] };
    }
}

function parseQuantitativeLabFromText(pagesText, fullText, fileName) {
    const dateMeta = parseDateFromText(fullText);
    const orderMatch = fullText.match(/Orden:\s*\n?\s*([A-Z0-9-]+)/i) || fullText.match(/\b(IB\d{6,})\b/);
    const orderId = orderMatch ? orderMatch[1].trim() : null;

    let currentSection = SECTION_CATALOG[0];
    const rawExtractedBySection = new Map();
    const ensureSec = (secDef) => {
        if (!rawExtractedBySection.has(secDef.id)) {
            rawExtractedBySection.set(secDef.id, {
                ...secDef,
                items: []
            });
        }
        return rawExtractedBySection.get(secDef.id);
    };

    let skippedCommercialPages = 0;

    for (const pageRaw of pagesText) {
        const pageStr = String(pageRaw || '');
        if (/CUP[ÓO]N\s+DE\s+DESCUENTOS|VIGENCIADESCUENTOPRODUCTO/i.test(pageStr)) {
            skippedCommercialPages++;
            continue;
        }
        if (/AVISO\s+IMPORTANTE[\s\S]{0,400}aviso\s+de\s+privacidad/i.test(pageStr) && !/\d+\s*-\s*\d+\s*(?:mg\/dL|g\/dL|U\/L|%)/i.test(pageStr)) {
            skippedCommercialPages++;
            continue;
        }

        const lines = pageStr.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const matchedSec = SECTION_CATALOG.find(s => s.match.test(line));
            if (matchedSec) {
                currentSection = matchedSec;
                continue;
            }

            if (isNonAnalyteNoiseLine(line)) continue;
            // El nombre de un analito no debe ser un número puro ni una línea de rango
            if (/^-?\d+(?:[.,]\d+)?$/.test(line)) continue;
            if (parseRefAndUnitLine(line)) continue;
            // Descartar nombre del paciente en mayúsculas si tiene 3 apellidos/nombres sin paréntesis clínicos
            if (/^[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){2,3}$/.test(line) && !/(?:COLESTEROL|BILIRRUBINA|INMUNOGLOBULINA|FOSFATASA|PORCENTAJE|CAPTACI|VOLUMEN|HEMOGLOBINA|RELACI)/i.test(line)) {
                continue;
            }

            const valLine = lines[i + 1];
            const refLine = lines[i + 2];
            if (valLine !== undefined && refLine !== undefined && /^-?\d+(?:[.,]\d+)?$/.test(valLine)) {
                const parsedRef = parseRefAndUnitLine(refLine);
                if (parsedRef) {
                    const numVal = parseFloat(valLine.replace(',', '.'));
                    const canonicalName = canonicalizeAnalyteDisplayName(line);
                    const status = evaluateAnalyteStatus(numVal, parsedRef.ref, 'NORMAL');
                    ensureSec(currentSection).items.push({
                        baseName: canonicalName,
                        name: canonicalName,
                        val: valLine.replace(',', '.'),
                        value: numVal,
                        unit: parsedRef.unit,
                        ref: parsedRef.ref,
                        reference: parsedRef.ref,
                        status
                    });
                    i += 2;
                }
            }
        }
    }

    const allItems = Array.from(rawExtractedBySection.values()).flatMap(s => s.items);
    if (allItems.length < 3) return null;

    // Desambiguación determinista de homónimos intra-documento (ej. Neutrófilos % vs miles/µL)
    const baseNameCounts = new Map();
    for (const it of allItems) {
        const bSlug = slugifyToken(it.baseName);
        baseNameCounts.set(bSlug, (baseNameCounts.get(bSlug) || 0) + 1);
    }

    for (const sec of rawExtractedBySection.values()) {
        sec.items = sec.items.map(it => {
            const bSlug = slugifyToken(it.baseName);
            let displayName = it.name;
            if ((baseNameCounts.get(bSlug) || 0) > 1 && !/\(/.test(displayName)) {
                if (it.unit === '%') {
                    displayName = `${displayName} (%)`;
                } else if (/miles\/[µu]l|10\^3/i.test(it.unit)) {
                    displayName = `${displayName} (Absoluto)`;
                } else {
                    displayName = `${displayName} (${it.unit})`;
                }
            }

            const analyteUid = buildAnalyteUid(displayName, it.unit, dateMeta.iso);
            const isThousandCellsUnit = /miles\/[µu]l|10\^3\/[µu]l|x10\^9\/l/i.test(it.unit);
            const isPcrMgDl = /prote[íi]na\s+c\s+reactiva|\bpcr\b/i.test(displayName) && /^mg\/dl$/i.test(it.unit);

            return {
                ...it,
                name: displayName,
                analyte_uid: analyteUid,
                study_date_iso: dateMeta.iso,
                study_date_display: dateMeta.display,
                ...(isThousandCellsUnit ? { value_cells_per_ul: Math.round(it.value * 1000) } : {}),
                ...(isPcrMgDl ? { value_mg_l: Number((it.value * 10).toFixed(3)) } : {})
            };
        });
    }

    return {
        domain: 'LAB_QUANTITATIVE',
        file_name: fileName,
        order_id: orderId,
        study_date_iso: dateMeta.iso,
        study_date_display: dateMeta.display,
        skipped_non_clinical_pages: skippedCommercialPages,
        sections: Array.from(rawExtractedBySection.values())
    };
}

function solveConcatenatedEcgRow(compactDigits) {
    const s = String(compactDigits || '').trim();
    // Buscador fisiológico universal basado en la identidad física FC (lpm) * RR (ms) ≈ 60,000 (±4,500)
    for (const hrLen of [2, 3]) {
        const hr = Number(s.slice(0, hrLen));
        if (hr < 25 || hr > 240) continue;
        for (const rrLen of [4, 3]) {
            const rr = Number(s.slice(s.length - rrLen));
            if (rr < 250 || rr > 2500) continue;
            if (Math.abs(hr * rr - 60000) > 4500) continue;
            const mid = s.slice(hrLen, s.length - rrLen);
            // PR (2-3 d), QRS (2-3 d), QT (3 d), QTc (3 d) + Ejes P, QRS, T
            for (const prLen of [3, 2]) {
                for (const qrsLen of [3, 2]) {
                    const pr = Number(mid.slice(0, prLen));
                    const qrs = Number(mid.slice(prLen, prLen + qrsLen));
                    const qt = Number(mid.slice(prLen + qrsLen, prLen + qrsLen + 3));
                    const qtc = Number(mid.slice(prLen + qrsLen + 3, prLen + qrsLen + 6));
                    if (pr < 70 || pr > 380 || qrs < 50 || qrs > 250 || qt < 240 || qt > 620 || qtc < 280 || qtc > 620) continue;
                    const axesStr = mid.slice(prLen + qrsLen + 6);
                    for (let i = 1; i <= Math.min(4, axesStr.length - 2); i++) {
                        for (let j = i + 1; j <= Math.min(i + 4, axesStr.length - 1); j++) {
                            const pStr = axesStr.slice(0, i);
                            const qStr = axesStr.slice(i, j);
                            const tStr = axesStr.slice(j);
                            if (!/^-?\d{1,3}$/.test(pStr) || !/^-?\d{1,3}$/.test(qStr) || !/^-?\d{1,3}$/.test(tStr)) continue;
                            const pAx = Number(pStr);
                            const qrsAx = Number(qStr);
                            const tAx = Number(tStr);
                            if (Math.abs(pAx) <= 180 && Math.abs(qrsAx) <= 180 && Math.abs(tAx) <= 180) {
                                return {
                                    hr_bpm: hr,
                                    pr_ms: pr,
                                    qrs_ms: qrs,
                                    qt_ms: qt,
                                    qtc_ms: qtc,
                                    p_axis_deg: pAx,
                                    qrs_axis_deg: qrsAx,
                                    t_axis_deg: tAx,
                                    rr_ms: rr
                                };
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
}

function parseEcgDocument(fullText, fileName) {
    const dateMeta = parseDateFromText(fullText);
    const accMatch = fullText.match(/Accession(?:\s+Number)?\s*[:\t ]*\s*([A-Z0-9-]+)/i) || fullText.match(/Orden\s*:\s*([A-Z0-9-]+)/i);
    const orderId = accMatch ? accMatch[1].trim() : null;

    let metrics = {};
    const spacedMatch = fullText.match(/RR\s*Prom[^\n]*\r?\n\s*(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})\s+(-?\d{1,3})\s+(-?\d{1,3})\s+(-?\d{1,3})\s+(\d{3,4})/i);
    if (spacedMatch) {
        metrics = {
            hr_bpm: Number(spacedMatch[1]),
            pr_ms: Number(spacedMatch[2]),
            qrs_ms: Number(spacedMatch[3]),
            qt_ms: Number(spacedMatch[4]),
            qtc_ms: Number(spacedMatch[5]),
            p_axis_deg: Number(spacedMatch[6]),
            qrs_axis_deg: Number(spacedMatch[7]),
            t_axis_deg: Number(spacedMatch[8]),
            rr_ms: Number(spacedMatch[9])
        };
    } else {
        const rawRowMatch = fullText.match(/RR\s*Prom[^\n]*\r?\n\s*([0-9\-]{16,30})/i);
        if (rawRowMatch) {
            const solved = solveConcatenatedEcgRow(rawRowMatch[1]);
            if (solved) metrics = solved;
        }
    }

    const interpBlockMatch = fullText.match(/INTERPRETACI[ÓO]N\s+M[ÉE]DICA\s*([\s\S]*?)(?:Dr\.|Dra\.|C[ÉE]DULA|Informe\s+generado|$)/i);
    const rawLines = interpBlockMatch
        ? interpBlockMatch[1]
            .split(/\r?\n/)
            .map(l => l.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
        : [];

    const upper = fullText.toUpperCase();
    const clinicalFlags = [];
    if ((metrics.hr_bpm && metrics.hr_bpm < 60) || upper.includes('BRADICARDIA')) clinicalFlags.push('ECG_SINUS_BRADYCARDIA');
    if ((metrics.qrs_ms && metrics.qrs_ms >= 120) || /BLOQUEO\s+DE\s+LA?\s+RAMA\s+DERECHA/.test(upper)) clinicalFlags.push('ECG_RBBB_CONDUCTION');
    if ((metrics.qrs_axis_deg !== undefined && metrics.qrs_axis_deg < -30) || /EJE[\s\S]{0,25}IZQUIERDA/.test(upper)) clinicalFlags.push('ECG_LEFT_AXIS_DEVIATION');
    if (upper.includes('ECOCARDIOGRAMA')) clinicalFlags.push('RECOMMENDS_ECHOCARDIOGRAM');

    const physicianMatch = fullText.match(/(Dr[a]?\.\s*[^\n\t]+?)(?:\s*C[ÉE]DULA|\r?\n)/i);

    return {
        domain: 'ECG_CARDIOLOGY',
        modality: 'ECG',
        anatomical_region: 'cardiovascular_reposo',
        title: 'Electrocardiograma Digital en Reposo (12 Derivaciones)',
        file_name: fileName,
        order_id: orderId,
        study_date_iso: dateMeta.iso,
        study_date_display: dateMeta.display,
        metrics,
        findings: rawLines,
        impression: rawLines.join(' • ') || 'Electrocardiograma en reposo evaluado.',
        physician: physicianMatch ? physicianMatch[1].replace(/\s+/g, ' ').trim() : null,
        severity: clinicalFlags.length > 0 ? 'VIGILANCIA_PREVENTIVA' : 'NORMAL',
        clinical_flags: clinicalFlags
    };
}

function parseImagingOrPlatesDocument(fullText, numpages, fileName) {
    const dateMeta = parseDateFromText(fullText);
    const upper = fullText.toUpperCase();
    const isPlateCaptureOnly = /CAPTURA\s*:/i.test(fullText) && !/(?:HALLAZGOS|IMPRESI[ÓO]N\s+DIAGN[ÓO]STICA|SE\s+REALIZA\s+ESTUDIO)/i.test(fullText);

    let modality = 'IMAGENOLOGIA';
    if (/\bRX\b|RADIOGRAF|T[ÓO]RAX\s+POSTERO/i.test(upper)) modality = 'RX';
    else if (/ULTRASONIDO|ECOGRAF|DOPPLER/i.test(upper)) modality = 'US';
    else if (/RESONANCIA\s+MAGN[ÉE]TICA|\bRM\b/i.test(upper)) modality = 'RM';
    else if (/TOMOGRAF|\bTAC\b/i.test(upper)) modality = 'TAC';
    else if (/DENSITOMETR|\bDMO\b/i.test(upper)) modality = 'DMO';

    let anatomicalRegion = 'general';
    let title = 'Estudio de Imagenología Clínica';
    if (/T[ÓO]RAX/i.test(upper)) {
        anatomicalRegion = 'torax_pa';
        title = 'Radiografía de Tórax Postero-Anterior (PA)';
    } else if (/INGUINAL\s+DERECH/i.test(upper) || (/PARTES\s+BLANDAS/i.test(upper) && modality === 'US')) {
        anatomicalRegion = 'partes_blandas_inguinal';
        title = 'Ultrasonido de Partes Blandas de Alta Resolución y Doppler (Región Inguinal Derecha)';
    } else if (/COLUMNA\s+LUMBAR/i.test(upper)) {
        anatomicalRegion = 'columna_lumbar';
        title = `${modality} de Columna Lumbar`;
    }

    const orderMatch = fullText.match(/Orden\s*:\s*([A-Z0-9-]+)/i);
    const orderId = orderMatch ? orderMatch[1].trim() : null;

    if (isPlateCaptureOnly) {
        return {
            domain: 'RADIOLOGY_ULTRASOUND_IMAGING',
            is_plate_bundle: true,
            plate_pages: numpages || 1,
            modality,
            anatomical_region: anatomicalRegion,
            title,
            file_name: fileName,
            order_id: orderId,
            study_date_iso: dateMeta.iso,
            study_date_display: dateMeta.display,
            metrics: {},
            findings: [],
            impression: '',
            clinical_flags: []
        };
    }

    const metrics = {};
    const ictMatch = fullText.match(/[íi]ndice\s+cardiotor[áa]cico\s+de\s+(\d+(?:[.,]\d+)?)/i);
    if (ictMatch) {
        metrics.ict = parseFloat(ictMatch[1].replace(',', '.'));
    }
    const mhzMatch = fullText.match(/(\d+(?:[.,]\d+)?)\s*MHz/i);
    if (mhzMatch) {
        metrics.transducer_mhz = parseFloat(mhzMatch[1].replace(',', '.'));
    }

    const impMatch = fullText.match(/Impresi[óo]n\s+[Dd]iagn[óo]stica\s*:?\s*([\s\S]*?)(?:Atentamente|Dr\.|Dra\.|$)/i);
    const impressionLines = impMatch
        ? impMatch[1]
            .split(/\r?\n/)
            .map(l => l.replace(/^[*•\-–\s]+/, '').replace(/\s+/g, ' ').trim())
            .filter(l => l && !/^Indispensable\s+correlacionar/i.test(l))
        : [];

    const hallazgosMatch = fullText.match(/(?:Hallazgos\s*:|donde\s+se\s+aprecia)\s*([\s\S]*?)(?:Impresi[óo]n\s+[Dd]iagn[óo]stica|Atentamente|$)/i);
    const findingLines = hallazgosMatch
        ? hallazgosMatch[1]
            .split(/\r?\n/)
            .map(l => l.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
        : [];

    const clinicalFlags = [];
    if (/ARCO\s+A[ÓO]RTICO\s+PROMINENTE|HILIOS\s+PULMONARES\s+Y\s+ARCO\s+A[ÓO]RTICO\s+PROMINENTES/i.test(upper)) {
        clinicalFlags.push('RX_PROMINENT_AORTIC_ARCH_HILA');
    }
    if (/PATR[ÓO]N\s+PULMONAR\s+LINEAL/i.test(upper)) {
        clinicalFlags.push('RX_LINEAR_PULMONARY_PATTERN');
    }
    if (/CAMBIOS\s+POSTQUIR[ÚU]RGICOS/i.test(upper) && /INGUINAL/i.test(upper)) {
        clinicalFlags.push('US_POSTSURGICAL_INGUINAL_WALL');
    }
    if (/NO\s+SE\s+OBSERVAN\s+DEFECTOS\s+HERNIARIOS|SIN\s+DEFECTOS\s+HERNIARIOS/i.test(upper)) {
        clinicalFlags.push('US_NO_ACTIVE_HERNIA_AT_VALSALVA');
    }
    if (/VASOS\s+FEMORALES[\s\S]{0,80}CONSERVADA/i.test(upper)) {
        clinicalFlags.push('US_FEMORAL_DOPPLER_PATENT');
    }

    const physicianMatch = fullText.match(/(Dr[a]?\.\s*[^\n]+)\s*\r?\n\s*M[ée]dico\s+Radi[óo]logo/i);

    return {
        domain: 'RADIOLOGY_ULTRASOUND_IMAGING',
        is_plate_bundle: false,
        plate_pages: 0,
        modality,
        anatomical_region: anatomicalRegion,
        title,
        file_name: fileName,
        order_id: orderId,
        study_date_iso: dateMeta.iso,
        study_date_display: dateMeta.display,
        metrics,
        findings: findingLines,
        impression: impressionLines.join(' • ') || findingLines.slice(0, 2).join(' • '),
        physician: physicianMatch ? physicianMatch[1].replace(/\s+/g, ' ').trim() : null,
        severity: clinicalFlags.some(f => f.startsWith('RX_PROMINENT') || f.startsWith('US_POSTSURGICAL'))
            ? 'VIGILANCIA_PREVENTIVA'
            : 'NORMAL',
        clinical_flags: clinicalFlags
    };
}

async function classifyAndParsePdfFile(filePath, originalName) {
    const fileName = originalName || path.basename(filePath);
    const { numpages, fullText, pagesText } = await extractPdfPagesSafe(filePath);
    const trimmed = String(fullText || '').trim();

    if (trimmed.length < 40) {
        return { domain: 'NEEDS_VISION_OCR', file_name: fileName, numpages };
    }

    // 1. Intentar parseo cuantitativo de laboratorio (páginas tabulares)
    const quantLab = parseQuantitativeLabFromText(pagesText, fullText, fileName);
    if (quantLab) {
        return quantLab;
    }

    // 2. Detectar carátula administrativa sin métricas ni hallazgos clínicos
    const isCoverLetter =
        /presento\s+el\s+(?:informe\s+del\s+)?estudio\s+que\s+le\s+ha\s+solicitado/i.test(trimmed) &&
        !/(?:INTERPRETACI[ÓO]N\s+M[ÉE]DICA|Impresi[óo]n\s+[Dd]iagn[óo]stica|Hallazgos\s*:|donde\s+se\s+aprecia|RR\s*Prom)/i.test(trimmed);

    if (isCoverLetter) {
        const dateMeta = parseDateFromText(fullText);
        const ordMatch = fullText.match(/Orden\s*:\s*([A-Z0-9-]+)/i);
        const studyLabelMatch = fullText.match(/paciente\.?\s*\n+\s*([A-ZÁÉÍÓÚÑ\s]{6,60})\n/i);
        return {
            domain: 'NON_CLINICAL_COVER',
            file_name: fileName,
            order_id: ordMatch ? ordMatch[1].trim() : null,
            study_date_iso: dateMeta.iso,
            study_date_display: dateMeta.display,
            referenced_study: studyLabelMatch ? studyLabelMatch[1].replace(/\s+/g, ' ').trim() : 'Carátula administrativa de gabinete'
        };
    }

    // 3. Detectar Electrocardiograma / Cardiología
    if (/INFORME\s+ELECTROCARDIOGR[ÁA]FICO|INTERPRETACI[ÓO]N\s+M[ÉE]DICA[\s\S]{0,200}(?:SINUSAL|QRS|HAZ\s+DE\s+HIS)|RR\s*Prom/i.test(trimmed)) {
        return parseEcgDocument(fullText, fileName);
    }

    // 4. Detectar Radiología / Ultrasonido / Placas de Imagenología
    if (/RX\s+DE|RADIOGRAF|RADIOLOG[ÍI]A|ULTRASONIDO|DOPPLER|RESONANCIA\s+MAGN[ÉE]TICA|TOMOGRAF|DENSITOMETR|CAPTURA\s*:/i.test(trimmed)) {
        return parseImagingOrPlatesDocument(fullText, numpages, fileName);
    }

    return { domain: 'NEEDS_VISION_OCR', file_name: fileName, numpages };
}

function consolidateUniversalExternalStudies(parsedDocs = [], referenceNow = new Date()) {
    const labPanels = [];
    const imagingGroups = new Map();
    const administrativeSkipped = [];

    for (const doc of parsedDocs) {
        if (!doc) continue;
        if (doc.domain === 'LAB_QUANTITATIVE') {
            const vig = computeVigenciaMeta(doc.study_date_iso, referenceNow);
            labPanels.push({
                file_name: doc.file_name,
                order_id: doc.order_id,
                study_date_iso: doc.study_date_iso,
                study_date_display: doc.study_date_display,
                skipped_non_clinical_pages: doc.skipped_non_clinical_pages || 0,
                vigencia: vig,
                sections: doc.sections
            });
            continue;
        }

        if (doc.domain === 'NON_CLINICAL_COVER') {
            administrativeSkipped.push({
                file_name: doc.file_name,
                order_id: doc.order_id,
                study_date_iso: doc.study_date_iso,
                study_date_display: doc.study_date_display,
                reason: 'Carátula administrativa sin parámetros clínicos ni interpretación diagnóstica',
                referenced_study: doc.referenced_study
            });
            continue;
        }

        if (doc.domain === 'ECG_CARDIOLOGY' || doc.domain === 'RADIOLOGY_ULTRASOUND_IMAGING') {
            const regionKey = doc.modality === 'US' && doc.anatomical_region.includes('inguinal')
                ? 'inguinal_partes_blandas'
                : slugifyToken(doc.anatomical_region);
            const groupKey = `${doc.modality}::${regionKey}::${doc.study_date_iso || doc.order_id || doc.file_name}`;
            const vig = computeVigenciaMeta(doc.study_date_iso, referenceNow);

            if (!imagingGroups.has(groupKey)) {
                imagingGroups.set(groupKey, {
                    study_group_key: groupKey,
                    domain: doc.domain,
                    modality: doc.modality,
                    anatomical_region: doc.anatomical_region,
                    title: doc.title,
                    order_id: doc.order_id || null,
                    study_date_iso: doc.study_date_iso,
                    study_date_display: doc.study_date_display,
                    vigencia: vig,
                    metrics: { ...(doc.metrics || {}) },
                    findings: [...(doc.findings || [])],
                    impression: doc.impression || '',
                    physician: doc.physician || null,
                    severity: doc.severity || 'NORMAL',
                    clinical_flags: [...(doc.clinical_flags || [])],
                    attached_plate_pages: doc.is_plate_bundle ? (doc.plate_pages || 1) : 0,
                    source_files: [doc.file_name]
                });
            } else {
                const existing = imagingGroups.get(groupKey);
                if (!existing.source_files.includes(doc.file_name)) {
                    existing.source_files.push(doc.file_name);
                }
                if (doc.is_plate_bundle) {
                    existing.attached_plate_pages += (doc.plate_pages || 1);
                } else {
                    existing.title = doc.title || existing.title;
                    existing.order_id = existing.order_id || doc.order_id;
                    existing.metrics = { ...existing.metrics, ...(doc.metrics || {}) };
                    existing.findings = Array.from(new Set([...existing.findings, ...(doc.findings || [])]));
                    existing.impression = doc.impression || existing.impression;
                    existing.physician = existing.physician || doc.physician;
                    if (doc.severity === 'VIGILANCIA_PREVENTIVA' || doc.severity === 'CRITICO') {
                        existing.severity = doc.severity;
                    }
                    existing.clinical_flags = Array.from(new Set([...existing.clinical_flags, ...(doc.clinical_flags || [])]));
                }
            }
        }
    }

    // Ordenar paneles cuantitativos cronológicamente (antiguo -> reciente) para cálculo longitudinal Delta
    labPanels.sort((a, b) => String(a.study_date_iso || '').localeCompare(String(b.study_date_iso || '')));

    const historyByMeasureKey = new Map();
    for (const panel of labPanels) {
        for (const sec of panel.sections) {
            for (const item of sec.items) {
                const mKey = `${slugifyToken(item.name)}::${slugifyToken(item.unit)}`;
                const prevEntries = historyByMeasureKey.get(mKey) || [];
                if (prevEntries.length > 0) {
                    const prev = prevEntries[prevEntries.length - 1];
                    if (Number.isFinite(item.value) && Number.isFinite(prev.value) && prev.study_date_iso !== panel.study_date_iso) {
                        const deltaAbs = Number((item.value - prev.value).toFixed(3));
                        const deltaPct = prev.value !== 0 ? Number((((item.value - prev.value) / prev.value) * 100).toFixed(1)) : null;
                        item.delta = {
                            delta_abs: deltaAbs,
                            delta_pct: deltaPct,
                            previous_value: prev.value,
                            previous_date_display: prev.study_date_display || prev.study_date_iso
                        };
                    }
                }
                prevEntries.push({
                    value: item.value,
                    study_date_iso: panel.study_date_iso,
                    study_date_display: panel.study_date_display
                });
                historyByMeasureKey.set(mKey, prevEntries);
            }
        }
    }

    const latestPanel = labPanels.length > 0 ? labPanels[labPanels.length - 1] : null;
    const sectionsArray = latestPanel ? latestPanel.sections : [];
    const biomarkers = {};
    const labs = {};
    let totalParameters = 0;
    let abnormalCount = 0;

    for (const sec of sectionsArray) {
        for (const it of sec.items) {
            totalParameters++;
            if (String(it.status || 'NORMAL').toUpperCase() !== 'NORMAL') {
                abnormalCount++;
            }
            const uid = it.analyte_uid || buildAnalyteUid(it.name, it.unit, latestPanel?.study_date_iso);
            biomarkers[uid] = {
                analyte_uid: uid,
                name: it.name,
                value: it.value,
                val: it.val,
                unit: it.unit,
                ref: it.ref,
                reference: it.reference || it.ref,
                status: it.status,
                section: sec.title,
                section_id: sec.id,
                study_date_iso: it.study_date_iso || null,
                study_date_display: it.study_date_display || null,
                ...(it.value_cells_per_ul !== undefined ? { value_cells_per_ul: it.value_cells_per_ul } : {}),
                ...(it.value_mg_l !== undefined ? { value_mg_l: it.value_mg_l } : {}),
                ...(it.delta ? { delta: it.delta } : {})
            };
            const unitSlug = slugifyToken(it.unit);
            const labLookupKey = `${slugifyToken(it.name)}_${unitSlug}`.replace(/_+$/, '');
            labs[labLookupKey] = `${it.val} ${it.unit}`.trim();
        }
    }

    const clinicalImagingAndCabinet = Array.from(imagingGroups.values());
    const allCabinetFlags = Array.from(new Set(clinicalImagingAndCabinet.flatMap(c => c.clinical_flags || [])));

    return {
        sections: sectionsArray,
        biomarkers,
        labs,
        totalParameters,
        abnormalCount,
        vigencia: latestPanel?.vigencia || null,
        cabinet_flags: allCabinetFlags,
        external_studies: {
            lab_panels: labPanels,
            clinical_imaging_and_cabinet: clinicalImagingAndCabinet,
            administrative_skipped: administrativeSkipped
        },
        imaging: {
            count: clinicalImagingAndCabinet.length,
            studies: clinicalImagingAndCabinet
        }
    };
}

module.exports = {
    slugifyToken,
    normalizeUnitDisplay,
    buildAnalyteUid,
    sanitizeLabReferenceRange,
    computeVigenciaMeta,
    classifyAndParsePdfFile,
    consolidateUniversalExternalStudies
};
