/**
 * Utilerías Onomásticas y de Conformidad Normativa NOM-004-SSA3-2012
 * Normalización de nombres de pacientes y particionado seguro de apellidos compuestos mexicanos.
 */

/**
 * Normaliza nombres y apellidos bajo la regla legal PENULTIMATE-LAST de la NOM-004,
 * resolviendo partículas compuestas múltiples ("De la Torre", "De los Santos", "San Martín").
 * @param {string} fullName Cadena completa con el nombre del paciente
 * @returns {Object} { firstName, paternalLastName, maternalLastName, fullNameNormalized }
 */
function parsePenultimateLastName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
        return { firstName: '', paternalLastName: '', maternalLastName: '', fullNameNormalized: '' };
    }

    const clean = fullName.trim().replace(/\s+/g, ' ');
    if (!clean) {
        return { firstName: '', paternalLastName: '', maternalLastName: '', fullNameNormalized: '' };
    }

    // Expresión regular pre-tokenizadora para unir partículas compuestas indivisibles.
    // Transforma cualquier espacio interno y adyacente del conector en '_' para evitar cortes erróneos.
    const normalizedCompound = clean.replace(
        /\b(de\s+las|de\s+los|de\s+la|del|de|san|santa)\s+/gi,
        (match) => `${match.trim().replace(/\s+/g, '_')}_`
    );

    const rawTokens = normalizedCompound.split(' ').filter(Boolean);
    const tokens = rawTokens.map(t => t.replace(/_/g, ' '));

    if (tokens.length === 1) {
        return {
            firstName: tokens[0],
            paternalLastName: '',
            maternalLastName: '',
            fullNameNormalized: tokens[0]
        };
    }
    if (tokens.length === 2) {
        return {
            firstName: tokens[0],
            paternalLastName: tokens[1],
            maternalLastName: '',
            fullNameNormalized: `${tokens[0]} ${tokens[1]}`
        };
    }
    if (tokens.length === 3) {
        return {
            firstName: tokens[0],
            paternalLastName: tokens[1],
            maternalLastName: tokens[2],
            fullNameNormalized: `${tokens[0]} ${tokens[1]} ${tokens[2]}`
        };
    }

    // Regla PENULTIMATE-LAST:
    // El penúltimo elemento es el Apellido Paterno.
    // El último elemento es el Apellido Materno.
    // Todos los elementos previos corresponden al Nombre(s) de Pila.
    const maternalLastName = tokens[tokens.length - 1];
    const paternalLastName = tokens[tokens.length - 2];
    const firstName = tokens.slice(0, tokens.length - 2).join(' ');

    return {
        firstName,
        paternalLastName,
        maternalLastName,
        fullNameNormalized: `${firstName} ${paternalLastName} ${maternalLastName}`
    };
}

module.exports = {
    parsePenultimateLastName
};
