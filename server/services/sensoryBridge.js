/**
 * sensoryBridge.js - Despachador Resiliente Express (Puerto 3000) ➔ FastAPI (Puerto 8000)
 * Implementa Circuit Breaker en memoria, AbortSignal.timeout(3500) y fallback determinista local Node.js.
 */

class SensoryCircuitBreaker {
    constructor(threshold = 2, coolDownMs = 60000) {
        this.failures = 0;
        this.threshold = threshold;
        this.coolDownMs = coolDownMs;
        this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
        this.nextAttempt = 0;
    }

    recordSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    recordFailure() {
        this.failures++;
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.coolDownMs;
            console.warn(`⚡ Sensory Circuit Breaker ABIERTO por ${this.coolDownMs / 1000}s.`);
        }
    }

    canAttempt() {
        if (this.state === 'CLOSED') return true;
        if (this.state === 'OPEN' && Date.now() > this.nextAttempt) {
            this.state = 'HALF_OPEN';
            return true;
        }
        return false;
    }
}

const circuitBreaker = new SensoryCircuitBreaker();

/**
 * Despacha peticiones hacia el Sensory Processing Hub (FastAPI :8000) con timeout y fallback.
 * @param {string} endpoint Ruta relativa (ej: '/api/sensory/analyze-ocular')
 * @param {Object} body Datos a enviar
 * @param {Function} localFallbackFn Función generadora del diagnóstico determinista local
 * @returns {Promise<Object>} Resultado del hub o del fallback local
 */
async function callSensoryHubWithFallback(endpoint, body, localFallbackFn) {
    if (!circuitBreaker.canAttempt()) {
        console.warn(`⚠️ Sensory Circuit Breaker en estado OPEN. Ejecutando fallback local Node.js para ${endpoint}.`);
        return await localFallbackFn();
    }

    try {
        const response = await fetch(`http://localhost:8000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(3500)
        });

        if (!response.ok) {
            throw new Error(`Sensory Hub respondió HTTP ${response.status}`);
        }

        const data = await response.json();
        circuitBreaker.recordSuccess();
        return data;
    } catch (err) {
        circuitBreaker.recordFailure();
        console.warn(`⚠️ Falla en Sensory Hub (${endpoint}): ${err.message}. Activando fallback local Node.js.`);
        return await localFallbackFn();
    }
}

module.exports = {
    SensoryCircuitBreaker,
    callSensoryHubWithFallback
};
