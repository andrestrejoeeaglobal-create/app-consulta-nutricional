const path = require('path');
const Database = require(path.join(__dirname, '..', 'server', 'node_modules', 'better-sqlite3'));

const dbPaths = [
    path.join(__dirname, '..', 'database.sqlite'),
    path.join(__dirname, '..', 'server', 'database.sqlite')
];

const exactOcularAudit = {
    palidez_conjuntival: {
        estado: "No Evaluable por Falta de Eversión Tarsal",
        descripcion_clinica: "Mucosa conjuntival tarsal del ojo derecho no expuesta en la toma fotográfica debido a la falta de eversión palpebral manual. El ojo izquierdo permanece cubierto. Requiere inspección física directa para evaluación anémica."
    },
    microcirculacion_escleral: {
        calibre_vascular: "Tortuosidad Venular Leve",
        densidad_capilar: "Moderada, con vasos conjuntivales visibles y ligeramente prominentes en región escleral expuesta.",
        hallazgos_especificos: [
            "Leve congestión vascular epiescleral focal en OD",
            "Sin hemorragias subconjuntivales visibles"
        ]
    },
    tejido_periorbital: {
        edema_infraorbitario: "Grado III (Bolsas Prominentes & Festón Malar)",
        estasis_venosa_pigmentaria: "Hiperpigmentación periorbitaria difusa bilateral con laxitud cutánea significativa y pliegues marcados.",
        deposito_lipidico_corneal: "Positivo (Arco senil incipiente)"
    },
    asimetria_binocular: {
        es_simetrico: false,
        observaciones: "El ojo izquierdo está cubierto por la mano del paciente; simetría evaluada únicamente en prominencia de bolsas infraorbitarias."
    }
};

const exactLingualTopography = {
    cuerpo_lingual: {
        coloracion_sustrato: "Pálido / Hipoperfundido",
        trofismo_volumen: "Aumentado (Saburra/Edema)",
        indentaciones_dentales: "Presentes en bordes bilaterales (Festoneado por presión dentaria)",
        fisuras_mucosa: "Superficie irregular con micro-fisuras transversales en tercio medio"
    },
    saburra_microbiota: {
        grosor: "Moderada a Gruesa",
        color: "Blanquecina",
        distribucion_topografica: {
            centro: "Capa gruesa blanquecina concentrada en zona gástrica.",
            raiz: "Acumulación saburral densa en tercio posterior colónico.",
            bordes: "Festoneado lateral con tinte pálido e indentaciones dentales por estasis fluido."
        },
        humectacion: "Saburral / Húmeda"
    }
};

const exactCorrelacionMultimodal = {
    sintesis_fisiopatologica: "El paciente presenta signos de senescencia ocular y periorbitaria (bolsas infraorbitarias Grado III con herniación grasa y festón malar) en consonancia con retención hídrica y laxitud septal. La topografía lingual confirma estasis de fluidos e hipoperfusión tisular con sustrato pálido, aumento de volumen con marcadas indentaciones dentales bilaterales (festoneado) e hiperplasia saburral blanquecina. La prioridad clínica es MODERADA/ELEVADA requerimiento de modulación microvascular y soporte linfático.",
    indice_prioridad_clinica: "Moderado"
};

for (const dbPath of dbPaths) {
    try {
        console.log(`📡 Actualizando SQLite en: ${dbPath}`);
        const db = new Database(dbPath);
        
        // Query todas las filas de session_persistence
        const rows = db.prepare('SELECT citation_id, patient_data_snapshot FROM session_persistence').all();
        for (const row of rows) {
            let snapshot = {};
            try {
                snapshot = JSON.parse(row.patient_data_snapshot || '{}');
            } catch (e) {}

            snapshot.scan_data = snapshot.scan_data || {};

            snapshot.scan_data.ocular_metrics = {
                right_eye_url: "/uploads/ocular-1790035455997-11700851.jpg",
                left_eye_url: "/uploads/ocular-1790035456007-275556100.jpg",
                ...exactOcularAudit,
                ocular_audit: exactOcularAudit,
                correlacion_multimodal: exactCorrelacionMultimodal
            };

            snapshot.scan_data.lingual_metrics = {
                imageUrl: "/uploads/lingual-1790035516360-884364205.jpg",
                ...exactLingualTopography,
                lingual_topography: exactLingualTopography,
                correlacion_multimodal: exactCorrelacionMultimodal
            };

            snapshot.scan_data.correlacion_multimodal = exactCorrelacionMultimodal;

            db.prepare('UPDATE session_persistence SET patient_data_snapshot = ? WHERE citation_id = ?').run(JSON.stringify(snapshot), row.citation_id);
            console.log(`  ✅ Fila citation_id=${row.citation_id} actualizada exitosamente.`);
        }
        db.close();
    } catch (err) {
        console.error(`🔥 Error procesando DB ${dbPath}:`, err.message);
    }
}
