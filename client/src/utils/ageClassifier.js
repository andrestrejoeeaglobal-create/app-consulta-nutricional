/**
 * Clasificador Edad (T.I.L.O. Ecosistema Asíncrono - Fase 1)
 *
 * Basado en la fecha de nacimiento (o edad calculada), clasifica al paciente
 * en una de las 5 categorías biológicas del Genoma T.I.L.O.
 */

export const classifyLifeStage = (ageYears) => {
    if (ageYears === null || ageYears === undefined) return null;

    // Convert to number just in case
    const age = Number(ageYears);

    if (age < 2) return 'Lactante';
    if (age >= 2 && age <= 11) return 'Escolar';
    if (age >= 12 && age <= 17) return 'Adolescente';
    if (age >= 18 && age <= 59) return 'Adulto';
    if (age >= 60) return 'Geriátrico';

    return 'Desconocido';
};

/**
 * Calcula la edad en años con base en la fecha de nacimiento.
 * @param {number} day 
 * @param {number} month (1-12)
 * @param {number} year 
 * @returns {number} Edad en años
 */
export const calculateAge = (day, month, year) => {
    if (!day || !month || !year) return null;

    // JS Months are 0-indexed
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    // Adjust if birthdate hasn't occurred yet this year
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
};

/**
 * Retorna las etiquetas de la compuerta binaria de confirmación según la NOM-004.
 * Basado en BINARY_GATE_LOGIC V37.1
 * @param {number} age - Edad en años
 * @param {string} sex - "Femenino" o "Masculino"
 * @returns {object} { confirmLabel, rejectLabel }
 */
export const getBinaryGateLabels = (age, sex) => {
    const isFemale = sex === 'Femenino';
    let confirmLabel = "✅ SÍ, ES CORRECTO"; // Default fallback
    
    if (age < 1) {
        // Neonato
        confirmLabel = isFemale ? "✅ SÍ, ES LA RECIÉN NACIDA" : "✅ SÍ, ES EL RECIÉN NACIDO";
    } else if (age >= 1 && age < 3) {
        // Lactante
        confirmLabel = isFemale ? "✅ SÍ, ES ELLA" : "✅ SÍ, ES ÉL";
    } else if (age >= 3 && age < 13) {
        // Pediátrico
        confirmLabel = isFemale ? "✅ SÍ, ES CORRECTA" : "✅ SÍ, ES CORRECTO";
    } else if (age >= 13 && age < 18) {
        // Adolescente
        confirmLabel = "✅ SÍ, SOY YO";
    } else if (age >= 18 && age < 65) {
        // Adulto
        confirmLabel = isFemale ? "✅ SÍ, SOY USUARIA" : "✅ SÍ, SOY USUARIO";
    } else if (age >= 65) {
        // Adulto Mayor
        confirmLabel = isFemale ? "✅ SÍ, ES CORRECTA" : "✅ SÍ, ES CORRECTO";
    }

    return {
        confirmLabel,
        rejectLabel: "❌ NO, CORREGIR DATOS"
    };
};
