import axios from 'axios';

const TAB_STORAGE_KEY = 'tilo_client_tab_id';
const TAB_WINDOW_PREFIX = 'tilo_tab_v1:';
const citationRevisionMap = new Map();
let interceptorsInstalled = false;
let cachedTabId = null;

function generateUuidV4() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Identificador único por pestaña (Trampa Forense #2):
 * Combina sessionStorage + window.name para que una recarga F5 en la misma pestaña conserve su UUID
 * (evitando auto-bloqueos en ráfagas PATCH), mientras que "Duplicar pestaña" o abrir otra pestaña
 * reciba un UUID nuevo e independiente.
 */
export function getClientTabId() {
    if (cachedTabId) return cachedTabId;
    if (typeof window === 'undefined') {
        cachedTabId = `srv_${generateUuidV4()}`;
        return cachedTabId;
    }
    try {
        const winName = String(window.name || '');
        const storedId = window.sessionStorage.getItem(TAB_STORAGE_KEY);
        if (storedId && winName === `${TAB_WINDOW_PREFIX}${storedId}`) {
            cachedTabId = storedId;
            return cachedTabId;
        }
        const freshId = `tab_${generateUuidV4()}`;
        window.sessionStorage.setItem(TAB_STORAGE_KEY, freshId);
        try {
            window.name = `${TAB_WINDOW_PREFIX}${freshId}`;
        } catch {
            // Ignorar entornos con window.name restringido
        }
        cachedTabId = freshId;
        return cachedTabId;
    } catch {
        cachedTabId = `tab_${generateUuidV4()}`;
        return cachedTabId;
    }
}

/**
 * Garantiza un token Bearer válido cuando el login ocurre directamente contra ea_lab_login.asp (Trampa Forense #3).
 */
export function ensureClinicalSessionToken(userRecord = null) {
    if (typeof window === 'undefined') return null;
    try {
        const explicit = String(
            userRecord?.token ||
            window.localStorage.getItem('ea_token') ||
            window.localStorage.getItem('tilo_auth_token') ||
            ''
        ).trim();
        if (explicit && explicit.length >= 8 && !/^(null|undefined|false|nan)$/i.test(explicit)) {
            window.localStorage.setItem('ea_token', explicit);
            window.localStorage.setItem('tilo_auth_token', explicit);
            return explicit;
        }
        const synthesized = `tilo_sess_${generateUuidV4().replace(/-/g, '')}`;
        window.localStorage.setItem('ea_token', synthesized);
        window.localStorage.setItem('tilo_auth_token', synthesized);
        if (userRecord && typeof userRecord === 'object') {
            userRecord.token = synthesized;
            window.localStorage.setItem('ea_session', JSON.stringify(userRecord));
        }
        return synthesized;
    } catch {
        return `tilo_sess_${generateUuidV4().replace(/-/g, '')}`;
    }
}

export function getActiveClinicalBearerToken() {
    if (typeof window === 'undefined') return null;
    try {
        const direct = String(
            window.localStorage.getItem('ea_token') ||
            window.localStorage.getItem('tilo_auth_token') ||
            ''
        ).trim();
        if (direct && direct.length >= 8 && !/^(null|undefined|false|nan)$/i.test(direct)) {
            return direct;
        }
        const rawSession = window.localStorage.getItem('ea_session');
        if (rawSession && rawSession.startsWith('{')) {
            const parsed = JSON.parse(rawSession);
            if (parsed && typeof parsed === 'object') {
                return ensureClinicalSessionToken(parsed);
            }
        }
    } catch {
        return null;
    }
    return null;
}

export function setKnownCitationRevision(citationId, revision) {
    if (!citationId) return;
    const cleanId = String(citationId).trim();
    const revNum = Number(revision);
    if (cleanId && Number.isFinite(revNum) && revNum >= 1) {
        const prev = citationRevisionMap.get(cleanId) || 0;
        if (revNum >= prev) {
            citationRevisionMap.set(cleanId, revNum);
        }
    }
}

export function getKnownCitationRevision(citationId) {
    if (!citationId) return null;
    const cleanId = String(citationId).trim();
    return citationRevisionMap.has(cleanId) ? citationRevisionMap.get(cleanId) : null;
}

function isClinicalBackendUrl(rawUrl) {
    if (!rawUrl) return false;
    const urlStr = String(rawUrl);
    const configuredBase = String(import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    if (configuredBase && urlStr.startsWith(configuredBase)) return true;
    if (/^https?:\/\/(?:localhost|127\.0\.0\.1):5000(?:\/|$|\?)/i.test(urlStr)) return true;
    if (urlStr.startsWith('/api/') || urlStr.startsWith('/checkCitation')) return true;
    return false;
}

function extractCitationIdFromUrl(urlStr) {
    if (!urlStr) return null;
    const progressMatch = String(urlStr).match(/\/api\/citations\/([^/?#]+)\/progress/i);
    if (progressMatch) return decodeURIComponent(progressMatch[1]);
    const checkParamMatch = String(urlStr).match(/[?&]id=([^&#]+)/i);
    if (checkParamMatch && /checkCitation/i.test(urlStr)) return decodeURIComponent(checkParamMatch[1]);
    const checkPathMatch = String(urlStr).match(/\/api\/citations\/check\/([^/?#]+)/i);
    if (checkPathMatch) return decodeURIComponent(checkPathMatch[1]);
    return null;
}

function syncRevisionFromResponsePayload(urlStr, data) {
    if (!data || typeof data !== 'object') return;
    const urlCita = extractCitationIdFromUrl(urlStr);
    const citaId = data.citationId || data.session?.citation_id || data.session_progress?.citation_id || data.dataSet?.[0]?.idCita || urlCita;
    const rev = data.revision ?? data.session?.revision ?? data.session_progress?.revision ?? null;
    if (citaId && rev !== null && rev !== undefined) {
        setKnownCitationRevision(citaId, rev);
    }
}

export function installClinicalApiInterceptors() {
    if (interceptorsInstalled || typeof window === 'undefined') return;
    interceptorsInstalled = true;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const reqUrl = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input?.url || '');
        if (!isClinicalBackendUrl(reqUrl)) {
            return nativeFetch(input, init);
        }

        const token = getActiveClinicalBearerToken();
        const tabId = getClientTabId();
        // Trampa Forense #3: Clonar con new Headers() sin tocar jamás Content-Type (preserva boundary de FormData)
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        if (tabId && !headers.has('X-Client-Tab-Id')) {
            headers.set('X-Client-Tab-Id', tabId);
        }

        let nextInit = { ...(init || {}), headers };
        const method = String(nextInit.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (method === 'PATCH' && /\/api\/citations\/[^/?#]+\/progress/i.test(reqUrl) && typeof nextInit.body === 'string') {
            try {
                const parsedBody = JSON.parse(nextInit.body);
                const citaId = extractCitationIdFromUrl(reqUrl);
                const knownRev = getKnownCitationRevision(citaId);
                if (!parsedBody.client_tab_id) parsedBody.client_tab_id = tabId;
                if (parsedBody.expected_revision === undefined && knownRev !== null) {
                    parsedBody.expected_revision = knownRev;
                }
                nextInit.body = JSON.stringify(parsedBody);
            } catch {
                // Conservar body original si no es JSON
            }
        }

        const response = await nativeFetch(input, nextInit);
        try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                response.clone().json().then((json) => syncRevisionFromResponsePayload(reqUrl, json)).catch(() => {});
            }
        } catch {
            // No bloquear lectura de respuesta
        }
        return response;
    };

    axios.interceptors.request.use((config) => {
        const reqUrl = config?.url || '';
        const fullUrl = config?.baseURL ? `${String(config.baseURL).replace(/\/+$/, '')}/${String(reqUrl).replace(/^\/+/, '')}` : reqUrl;
        if (!isClinicalBackendUrl(fullUrl)) return config;

        const token = getActiveClinicalBearerToken();
        const tabId = getClientTabId();
        config.headers = config.headers || {};
        if (token && !config.headers.Authorization && !config.headers.authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        if (tabId && !config.headers['X-Client-Tab-Id']) {
            config.headers['X-Client-Tab-Id'] = tabId;
        }

        const method = String(config.method || 'get').toUpperCase();
        if (method === 'PATCH' && /\/api\/citations\/[^/?#]+\/progress/i.test(fullUrl) && config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
            const citaId = extractCitationIdFromUrl(fullUrl);
            const knownRev = getKnownCitationRevision(citaId);
            if (!config.data.client_tab_id) config.data.client_tab_id = tabId;
            if (config.data.expected_revision === undefined && knownRev !== null) {
                config.data.expected_revision = knownRev;
            }
        }
        return config;
    });

    axios.interceptors.response.use((response) => {
        try {
            const reqUrl = response?.config?.url || '';
            syncRevisionFromResponsePayload(reqUrl, response?.data);
        } catch {
            // Ignorar
        }
        return response;
    });
}
