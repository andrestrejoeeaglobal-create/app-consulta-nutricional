export const generateSecurityConstraints = (religion, bmiValue) => {
    // Estructura base
    const constraints = {
        forbidden_ingredients: [],
        clinical_alerts: [],
        mix_restrictions: [],
        waiver_log: null
    };

    if (!religion) return constraints;

    const normalizedReligion = religion.toUpperCase().trim();
    const bmi = parseFloat(bmiValue) || 0;

    switch (normalizedReligion) {
        case 'ADVENTISTA':
            constraints.forbidden_ingredients = ['CERDO', 'MARISCO', 'CAFE', 'ALCOHOL'];
            constraints.clinical_alerts = ['CHECK_B12_LEVELS'];
            break;

        case 'MORMON':
        case 'MORMÓN':
        case 'SUD':
        case 'LDS':
            constraints.forbidden_ingredients = ['CAFE', 'TE', 'ALCOHOL', 'TABACO'];
            // Regla Condicional: Trampa del Almacenamiento
            if (bmi > 30) {
                constraints.forbidden_ingredients.push('HARINAS_REFINADAS');
            }
            break;

        case 'ISLAM':
        case 'HALAL':
        case 'MUSULMAN':
        case 'MUSULMÁN':
            constraints.forbidden_ingredients = ['CERDO', 'ALCOHOL', 'SANGRE'];
            constraints.clinical_alerts = ['RAMADAN_FASTING_CHECK'];
            break;

        case 'JUDIO':
        case 'JUDÍO':
        case 'KOSHER':
            constraints.forbidden_ingredients = ['CERDO', 'MARISCO', 'SANGRE'];
            constraints.mix_restrictions = ['NO_MEAT_AND_DAIRY'];
            break;

        case 'HINDUISMO':
        case 'HINDU':
        case 'HINDÚ':
            constraints.forbidden_ingredients = ['RES', 'VACA'];
            constraints.clinical_alerts = ['PROTEIN_DEFICIT_RISK'];
            break;

        default:
            // Si no hay match (católico, ateo, etc), se queda vacío
            break;
    }

    return constraints;
};

// Protocolo de cumplimiento (NOM-004 / Blindaje Legal)
export const logDietaryConflict = (requestedFood, forbiddenList) => {
    // Lógica de validación futura
    // Si requestedFood está en forbiddenList, disparar advertencia
    if (forbiddenList.includes(requestedFood.toUpperCase())) {
        console.warn(`CONFLICTO DETECTADO: ${requestedFood} prohibido por restricción religiosa.`);
        return `Paciente asume responsabilidad de dieta fuera de su ética declarada. Fecha: ${new Date().toISOString()}.`;
    }
    return null;
};
