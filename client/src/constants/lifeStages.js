/**
 * Dictionary of Life Stages (Etapas de Vida)
 * Used to provide the correct clinical descriptor and health focus based on age.
 */
export const LIFE_STAGES = [
    {
        id: 'NEONATO',
        minAgeDays: 0,
        maxAgeDays: 28,
        descriptor: 'neonato',
        focus: 'Lactancia, tamiz metabólico y reflejos.',
        route: 'Ruta C'
    },
    {
        id: 'LACTANTE',
        minAgeDays: 29,
        maxAgeDays: Math.floor((365.25 * 2)) - 1, // Hasta los 23 meses (antes de cumplir 2)
        descriptor: 'lactante',
        focus: 'Hitos del desarrollo y ablactación.',
        route: 'Ruta C'
    },
    {
        id: 'PEDIATRICO',
        minAgeDays: Math.floor((365.25 * 2)), 
        maxAgeDays: Math.floor((365.25 * 13)) - 1, // 2 a 12.99
        descriptor: 'pediátrico',
        focus: 'Crecimiento somático y escolaridad.',
        route: 'Ruta C'
    },
    {
        id: 'ADOLESCENTE',
        minAgeDays: Math.floor((365.25 * 13)),
        maxAgeDays: Math.floor((365.25 * 18)) - 1, // 13 a 17.99
        descriptor: 'adolescente',
        focus: 'Maduración sexual y riesgo psicosocial.',
        route: 'Ruta B'
    },
    {
        id: 'ADULTO',
        minAgeDays: Math.floor((365.25 * 18)),
        maxAgeDays: Infinity, // 18 en adelante
        descriptor: 'adulto',
        focus: 'Estabilidad metabólica y cronicidad.',
        route: 'Ruta A'
    }
];

/**
 * Helper to get the clinical descriptor based on age in years and days.
 * @param {number} ageInYears 
 * @param {number} ageInDays (optional, for precise neonatal/lactante resolution if ageInYears is 0)
 * @returns {object} The matched life stage object
 */
export const getLifeStageDescriptor = (ageInYears, ageInDays = null) => {
    // If we only have years and it's 0, we might need days to distinguish Neonatal vs Lactante.
    // If days aren't provided but age is 0, we default to Lactante to be safe unless we know it's < 28 days.
    // However, given the prompt, we can approximate:
    
    let totalDays = ageInYears * 365;
    if (ageInDays !== null) {
        totalDays = ageInDays; // Use precise days if available (e.g. for infants)
    } else if (ageInYears === 0) {
        // If age is 0 and no days provided, let's default to a safe middle ground for 0-year-olds: Lactante
        // since true neonates (0-28 days) are a very narrow window.
        totalDays = 60; 
    }

    return LIFE_STAGES.find(stage => totalDays >= stage.minAgeDays && totalDays <= stage.maxAgeDays) || LIFE_STAGES[3]; // Default to ADULT/ENDOCRINO
};
