import axios from 'axios';

const OUTBOX_STORAGE_KEY = 'tilo_sync_outbox_v1';

let queue = [];
let isProcessing = false;
let inFlightItemId = null;
let retryTimer = null;
let retryAttempt = 0;

function readPersistedQueue() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function persistQueue() {
    if (typeof window === 'undefined') return;
    try {
        if (queue.length === 0) {
            localStorage.removeItem(OUTBOX_STORAGE_KEY);
        } else {
            localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(queue));
        }
    } catch {
        // Ignorar cuota excedida sin interrumpir flujo clínico
    }
    notifyStatus();
}

function notifyStatus() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent('tilo-outbox-status', {
            detail: {
                pendingCount: queue.length,
                isProcessing,
                retryAttempt,
                online: typeof navigator !== 'undefined' ? navigator.onLine : true,
            },
        })
    );
}

export function getOutboxStatus() {
    return {
        pendingCount: queue.length,
        isProcessing,
        retryAttempt,
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };
}

function scheduleBackoffRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    const baseMs = Math.min(30000, 1000 * Math.pow(2, Math.min(retryAttempt, 5)));
    const jitterMs = Math.floor(Math.random() * 400);
    retryAttempt += 1;
    notifyStatus();
    retryTimer = setTimeout(() => {
        retryTimer = null;
        drainCitationOutbox();
    }, baseMs + jitterMs);
}

export async function drainCitationOutbox() {
    if (isProcessing || queue.length === 0) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        notifyStatus();
        return;
    }

    isProcessing = true;
    notifyStatus();

    while (queue.length > 0) {
        const item = queue[0];
        inFlightItemId = item.id;
        try {
            const response = await axios.patch(item.url, item.payload, { timeout: 12000 });
            if (response && response.status >= 200 && response.status < 300) {
                if (queue[0]?.id === item.id) {
                    queue.shift();
                } else {
                    const idx = queue.findIndex((entry) => entry.id === item.id);
                    if (idx >= 0) queue.splice(idx, 1);
                }
                inFlightItemId = null;
                retryAttempt = 0;
                persistQueue();
            } else {
                throw new Error(`Unexpected HTTP status ${response?.status}`);
            }
        } catch (err) {
            inFlightItemId = null;
            const status = err?.response?.status;
            // Errores 4xx definitivos (excepto 408/429) no deben atascar eternamente la cola
            if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
                console.warn('[SyncOutbox] Petición descartada por rechazo 4xx no recuperable:', status);
                if (queue[0]?.id === item.id) {
                    queue.shift();
                } else {
                    const idx = queue.findIndex((entry) => entry.id === item.id);
                    if (idx >= 0) queue.splice(idx, 1);
                }
                persistQueue();
                continue;
            }
            isProcessing = false;
            scheduleBackoffRetry();
            return;
        }
    }

    inFlightItemId = null;
    isProcessing = false;
    notifyStatus();
}

export function enqueueCitationProgressPatch(url, payload) {
    if (!url || !payload) return;

    const normalizedPhase = payload.phase ?? payload.current_phase;
    const normalizedPayload = normalizedPhase !== undefined
        ? { ...payload, phase: normalizedPhase, current_phase: normalizedPhase }
        : { ...payload };

    // Jamás sobrescribir un elemento actualmente en vuelo (inFlightItemId) para no perder mutaciones tras shift()
    const existingIdx = queue.findIndex((entry) => entry.url === url && entry.id !== inFlightItemId);
    const nextItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url,
        payload: normalizedPayload,
        queuedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
        const prev = queue[existingIdx].payload || {};
        const mergedPhase = Math.max(
            Number(prev.phase ?? prev.current_phase) || 0,
            Number(normalizedPayload.phase ?? normalizedPayload.current_phase) || 0
        );
        nextItem.payload = {
            ...prev,
            ...normalizedPayload,
            phase: mergedPhase,
            current_phase: mergedPhase,
            is_completed: Boolean(prev.is_completed || normalizedPayload.is_completed),
        };
        queue[existingIdx] = nextItem;
    } else {
        queue.push(nextItem);
    }

    persistQueue();
    drainCitationOutbox();
}

if (typeof window !== 'undefined') {
    queue = readPersistedQueue();
    window.addEventListener('online', () => {
        retryAttempt = 0;
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        notifyStatus();
        drainCitationOutbox();
    });
    window.addEventListener('offline', () => {
        notifyStatus();
    });
    if (queue.length > 0) {
        setTimeout(() => drainCitationOutbox(), 800);
    }
}
