const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../client/src/data/parsed_results.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const CATEGORIAS_MAP = {
    cardiovascular: 'Cardiovascular y Cerebrovascular',
    gastrointestinal: 'Función Gastrointestinal',
    colon: 'Función del Intestino Grueso',
    liver: 'Función Hepática',
    gallbladder: 'Función de la Vesícula Biliar',
    pancreas: 'Función Pancreática',
    renal: 'Función Renal',
    pulmonary: 'Función Pulmonar',
    brain: 'Nervio Cerebral',
    bone_disease: 'Padecimientos Óseos',
    bone_density: 'Densidad Mineral Ósea',
    rheumatoid: 'Enfermedad de Hueso Reumatoide',
    ndice_de_crecimiento_seo: 'Índice de Crecimiento Óseo',
    blood_glucose: 'Glucosa en la Sangre',
    trace_elements: 'Oligoelementos y Minerales',
    vitamins: 'Vitaminas',
    amino_acids: 'Aminoácidos',
    coenzymes: 'Coenzimas',
    fatty_acids: 'Ácidos Grasos',
    endocrine: 'Sistema Endocrino',
    immune: 'Sistema Inmunológico',
    thyroid: 'Tiroides',
    toxins: 'Toxinas Humanas',
    heavy_metals: 'Metales Pesados',
    basic_physical: 'Condición Física Básica',
    allergies: 'Alergias',
    obesity: 'Obesidad y Composición Fat-Mass',
    skin: 'Piel y Tejido Cutáneo',
    eye: 'Ojo y Función Visual',
    collagen: 'Colágeno',
    meridians: 'Meridianos (Bioenergética)',
    pulso_cerebro_y_corazon: 'Pulso Cerebro y Corazón',
    blood_lipids: 'Lípidos Sanguíneos',
    prostate: 'Próstata',
    male_sexual: 'Función Sexual Masculina',
    sperm_semen: 'Esperma y Semen',
    body_composition: 'Análisis Componencial Corporal',
    informe_de_anlisis_de_expertos: 'Informe de Análisis de Expertos',
    informe_de_anlisis_de_la_mano: 'Informe de Análisis Manual'
};

let md = `# Reporte Clínico de Telemetría Bioeléctrica y Biorresonancia (Electret)\n\n`;
md += `**Paciente:** Agustín Martínez Reyes  \n`;
md += `**Cita ID:** 20804  \n`;
md += `**Folio de Usuario:** 105104  \n`;
md += `**Sede:** Equipo en Acción Puebla  \n`;
md += `**Fecha de Auditoría:** 22 de Septiembre de 2026  \n`;
md += `**Normativa de Sellado:** NOM-004-SSA3-2012 / NOM-043-SSA2-2012  \n\n`;

md += `---\n\n## 📊 1. Resumen Ejecutivo de Alertas Biológicas\n\n`;

let abnormalCountTotal = 0;
let totalParamsTotal = 0;
const abnormalList = [];

Object.entries(data).forEach(([catKey, val]) => {
    const items = Array.isArray(val) ? val : (val.items || Object.values(val));
    items.forEach(i => {
        if (i && typeof i === 'object' && i.name) {
            totalParamsTotal++;
            const st = (i.status || 'NORMAL').toUpperCase();
            if (st !== 'NORMAL' && st !== 'NORMAL (-)' && st !== '-' && st !== 'INFORMATIVO') {
                abnormalCountTotal++;
                abnormalList.push({
                    cat: CATEGORIAS_MAP[catKey] || catKey,
                    name: i.name,
                    val: i.val || i.value || '-',
                    ref: i.ref || i.reference || '-',
                    status: i.status
                });
            }
        }
    });
});

md += `> [!IMPORTANT]\n`;
md += `> **Total de Parámetros Auditados:** ${totalParamsTotal}  \n`;
md += `> **Alertas y Anormalidades Detectadas:** ${abnormalCountTotal} parámetros fuera de rango fisiológico  \n`;
md += `> **Estatus de Expediente:** Sellado y Consolidado bajo la NOM-004  \n\n`;

md += `### ⚠️ Principales Hallazgos Biológicos Encontrados (${abnormalCountTotal} Alertas)\n\n`;
md += `| Sistema Biológico | Parámetro | Valor | Rango Ref. | Estado |\n`;
md += `| :--- | :--- | :---: | :---: | :---: |\n`;
abnormalList.forEach(a => {
    md += `| **${a.cat}** | ${a.name} | **${a.val}** | \`${a.ref}\` | \`${a.status}\` |\n`;
});

md += `\n---\n\n## 🧬 2. Detalle Completo por Sistemas Biológicos\n\n`;

Object.entries(data).forEach(([catKey, val]) => {
    const title = CATEGORIAS_MAP[catKey] || catKey.replace(/_/g, ' ');
    const items = Array.isArray(val) ? val : (val.items || Object.values(val));
    const validItems = items.filter(i => i && typeof i === 'object' && i.name);

    if (validItems.length === 0) return;

    md += `### ${title}\n\n`;
    md += `*Total Parámetros: ${validItems.length}*\n\n`;
    md += `| Parámetro | Valor | Rango de Referencia | Clasificación |\n`;
    md += `| :--- | :---: | :---: | :---: |\n`;

    validItems.forEach(i => {
        const valText = i.val !== undefined ? i.val : (i.value !== undefined ? i.value : '-');
        const refText = i.ref !== undefined ? i.ref : (i.reference !== undefined ? i.reference : '-');
        const status = i.status || 'NORMAL';
        const isAb = status.toUpperCase() !== 'NORMAL' && status.toUpperCase() !== 'NORMAL (-)' && status !== '-';
        const stBadge = isAb ? `**\`${status}\`**` : `\`Normal\``;

        md += `| ${i.name} | **${valText}** | \`${refText}\` | ${stBadge} |\n`;
    });

    md += `\n`;
});

const outputPath = 'C:/Users/andre/.gemini/antigravity/brain/ee64fa2d-f023-471c-87d5-ab4e7bc1af7f/reporte_electret_agustin_martinez.md';
fs.writeFileSync(outputPath, md, 'utf8');
console.log('Report generated successfully at:', outputPath);
