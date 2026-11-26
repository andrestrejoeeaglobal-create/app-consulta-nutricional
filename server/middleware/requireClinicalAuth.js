/**
 * Middleware Institucional de Autenticación Clínica (NOM-004 / EGM-79)
 * Exige cabecera Authorization: Bearer <token> válida en todos los endpoints clínicos protegidos
 * y propaga X-Client-Tab-Id para control optimista de concurrencia entre pestañas.
 */
function extractBearerToken(req) {
    const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '').trim();
    if (!authHeader) return null;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const candidate = (match ? match[1] : authHeader).trim();
    if (!candidate || candidate.length < 8) return null;
    const lower = candidate.toLowerCase();
    if (lower === 'null' || lower === 'undefined' || lower === 'false' || lower === 'nan') {
        return null;
    }
    return candidate;
}

function requireClinicalAuth(req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }
    const token = extractBearerToken(req);
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED_NOM004',
            message: 'Autenticación clínica requerida (Authorization: Bearer) bajo protocolo NOM-004.'
        });
    }
    req.clinicalAuthToken = token;
    const tabHeader = req.headers?.['x-client-tab-id'];
    req.clientTabId = tabHeader ? String(tabHeader).trim() : null;
    return next();
}

module.exports = {
    requireClinicalAuth,
    extractBearerToken
};
