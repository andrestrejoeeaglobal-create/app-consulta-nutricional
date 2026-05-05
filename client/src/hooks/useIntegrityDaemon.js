import { useClinicalGenome } from '../store/useClinicalGenome';

/**
 * Daemon de Integridad (Middleware Clínico)
 * Escucha pasivamente el Genome y levanta señales de bloqueo ("Red Flags")
 * si faltan requisitos de la NOM-004 o hay valores críticos.
 */
export const useIntegrityDaemon = () => {
    const genome = useClinicalGenome();

    const reasons = [];

    // BLOQUE I: ANCLAJE LEGAL (NOM-004)
    if (!genome.identityLock.verified) {
        reasons.push("Identidad no verificada");
    }
    if (!genome.identityLock.privacySigned) {
        reasons.push("Aviso de privacidad pendiente");
    }

    // BLOQUE II: SEGURIDAD (Alergias)
    if (!genome.allergies.verified) {
        reasons.push("Verificación de alergias incompleta");
    }

    // BLOQUE V: SIGNOS VITALES (Emergencias restrictivas)
    const { bloodPressure } = genome.vitalSigns;
    if (bloodPressure.systolic > 180 || bloodPressure.diastolic > 120) {
        reasons.push("CRÍTICO: Crisis Hipertensiva detectada (>180/120). Protocolo de emergencia requerido.");
    }

    return { isBlocked: reasons.length > 0, blockingReasons: reasons };
};
