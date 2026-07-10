// 🛡️ MOTOR DE SEGURIDAD CLÍNICA (V3.0)
// Simulación de Base de Datos PLM & Reglas de Interacción

// --- MOCK DATABASE (PLM) ---
const PLM_DB = [
    {
        id: "plm_101",
        brand_name: "Aspirina Protect",
        substance: "Ácido Acetilsalicílico",
        presentation: "Tabletas",
        concentration: "100 mg",
        safety_tags: ["ANTICOAGULANTE", "GASTROLESIVO"],
        image: "https://via.placeholder.com/50?text=ASP"
    },
    {
        id: "plm_102",
        brand_name: "Tylenol",
        substance: "Paracetamol",
        presentation: "Capletas",
        concentration: "500 mg",
        safety_tags: ["HEPATOTOXICO_DOSIS_ALTA"],
        image: "https://via.placeholder.com/50?text=TYL"
    },
    {
        id: "plm_103",
        brand_name: "Tempra",
        substance: "Paracetamol",
        presentation: "Tabletas",
        concentration: "500 mg",
        safety_tags: ["HEPATOTOXICO_DOSIS_ALTA"],
        image: "https://via.placeholder.com/50?text=TEM"
    },
    {
        id: "plm_104",
        brand_name: "Advil",
        substance: "Ibuprofeno",
        presentation: "Capsulas",
        concentration: "400 mg",
        safety_tags: ["GASTROLESIVO", "NEFROTOXICO"],
        image: "https://via.placeholder.com/50?text=ADV"
    },
    {
        id: "plm_105",
        brand_name: "Plavix",
        substance: "Clopidogrel",
        presentation: "Tabletas",
        concentration: "75 mg",
        safety_tags: ["ANTICOAGULANTE"],
        image: "https://via.placeholder.com/50?text=PLV"
    },
    {
        id: "plm_106",
        brand_name: "Metformina",
        substance: "Metformina Clorhidrato",
        presentation: "Tabletas",
        concentration: "850 mg",
        safety_tags: ["HIPOGLUCEMIANTE", "GASTROLESIVE_SENSITIVE"],
        image: "https://via.placeholder.com/50?text=MET"
    }
];

// --- MOCK DATABASE (SUPPLEMENTS) ---
const SUPP_DB = [
    {
        id: "supp_201",
        common_name: "Omega 3",
        active_ingredients: ["Omega 3", "EPA", "DHA"],
        risk_tags: ["ANTICOAGULANTE_NATURAL"],
        image: "https://via.placeholder.com/50?text=OMG"
    },
    {
        id: "supp_202",
        common_name: "Jengibre Extracto",
        active_ingredients: ["Jengibre"],
        risk_tags: ["ANTICOAGULANTE_NATURAL", "GASTROPROTECTOR"],
        image: "https://via.placeholder.com/50?text=JENG"
    },
    {
        id: "supp_203",
        common_name: "Malla Biológica Tropical",
        active_ingredients: ["Jengibre", "Cúrcuma"],
        risk_tags: ["ANTICOAGULANTE_NATURAL", "HIPOGLUCEMIANTE"],
        image: "https://via.placeholder.com/50?text=MALLA"
    },
    {
        id: "supp_204",
        common_name: "Ajo Concentrado",
        active_ingredients: ["Ajo", "Alina"],
        risk_tags: ["ANTICOAGULANTE_NATURAL", "HIPOTENSOR"],
        image: "https://via.placeholder.com/50?text=AJO"
    }
];

// --- SIMULATED SEARCH API ---
export const searchDrug = (query) => {
    if (!query) return [];
    const lowerQ = query.toLowerCase();
    return PLM_DB.filter(item =>
        item.brand_name.toLowerCase().includes(lowerQ) ||
        item.substance.toLowerCase().includes(lowerQ)
    );
};

export const searchSupplement = (query) => {
    if (!query) return [];
    const lowerQ = query.toLowerCase();
    return SUPP_DB.filter(item =>
        item.common_name.toLowerCase().includes(lowerQ) ||
        item.active_ingredients.some(ing => ing.toLowerCase().includes(lowerQ))
    );
};

// --- LOGIC GATES (MOTOR DE REGLAS) ---
export const checkInteractions = (newItem, currentList, triageData) => {
    const alerts = [];
    const newItemTags = newItem.safety_tags || newItem.risk_tags || [];


    // LOG 1: RIESGO QUIRÚRGICO (Protocolo ERAS)
    if (triageData.surgery_status === 'PRE') {
        if (newItemTags.includes('ANTICOAGULANTE') || newItemTags.includes('ANTICOAGULANTE_NATURAL')) {
            alerts.push({
                type: 'CRITICAL',
                title: '⚠️ ALERTA DE SEGURIDAD QUIRÚRGICA',
                message: `El producto **${newItem.brand_name || newItem.common_name}** es un anticoagulante. Dado que su cirugía es próxima, se sugiere validación médica para suspenderlo 7 días antes.`
            });
        }
    }

    // LOG 2: DOBLE MEDICACIÓN (Duplicidad)
    // Solo aplica para fármacos con sustancia definida
    if (newItem.substance) {
        const duplicate = currentList.find(i => i.substance === newItem.substance);
        if (duplicate) {
            alerts.push({
                type: 'INFO',
                title: 'ℹ️ OBSERVACIÓN DE DUPLICIDAD',
                message: `Precaución: Tanto **${newItem.brand_name}** como **${duplicate.brand_name}** contienen **${newItem.substance}**. Verifique para evitar sobredosis.`
            });
        }
    }

    return alerts;
};

// --- DIGESTIVE HEALTH ALGORITHM (ROMA IV) ---
export const calibrateGutProtocol = (selection) => {
    // 🟠 ESTREÑIMIENTO (Constipation)
    if (selection === 'CONSTIPATION') {
        return {
            fiber_tolerance: 'HIGH',   // Luz Verde para 33 Plus
            magnesium_cap: 'FULL',     // Ayuda motilidad
            diet_protocol: 'HIGH_FIBER'
        };
    }

    // 🟡 DISTENSIÓN (Bloating/Gas)
    if (selection === 'BLOATING') {
        return {
            fiber_tolerance: 'SENSITIVE', // Precaución
            magnesium_cap: 'TITRATED',    // Dosis divididas
            diet_protocol: 'LOW_FODMAP'   // Protocolo Fermentativo
        };
    }

    // 🔴 DIARREA (Diarrhea)
    if (selection === 'DIARREA') {
        return {
            fiber_tolerance: 'ZERO',       // ⛔ PROHIBIDO 33 Plus
            magnesium_cap: 'RESTRICTED',   // Bloquear Magnesio
            diet_protocol: 'ASTRINGENT'    // Dieta blanca
        };
    }

    // DEFAULT (Safety Fallback)
    return {
        fiber_tolerance: 'NORMAL',
        magnesium_cap: 'FULL',
        diet_protocol: 'STANDARD'
    };
};
