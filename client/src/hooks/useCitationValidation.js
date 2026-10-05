import { useState } from 'react';

/**
 * useCitationValidation Hook (V8 - SRP & Anti-Empty Array Shield)
 * Músculo especializado de validación de citas omnicanal.
 */
const useCitationValidation = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const validateCitation = async (citationId) => {
        setLoading(true);
        setError(null);

        try {
            const authUrl = `https://www.equipoenaccion.app/ea_lab_login.asp?action=CITA_AG&dateId=${encodeURIComponent(citationId)}`;
            const res = await fetch(authUrl);
            const json = await res.json();

            // 🛡️ SANITIZACIÓN ANTE EL SÍNDROME DEL ARREGLO VACÍO (NOM-004)
            const hasData = json && json.response?.code === 0 && Array.isArray(json.dataSet) && json.dataSet.length > 0;

            if (!hasData) {
                return {
                    isValid: false,
                    status: 'ESTUDIO_NO_ENCONTRADO',
                    message: '⛔ **Cita No Encontrada.**\n\n---\n\nNo se encontró información para el número de cita ingresado. Verifique el número e intente nuevamente.',
                    patientData: null
                };
            }

            const rawRecord = json.dataSet[0];
            const estatus = String(rawRecord?.estatus || '').trim().toUpperCase();

            // 🛡️ CLASIFICACIÓN SRP DE ESTADOS CLÍNICOS
            if (estatus === 'ESTUDIO_PENDIENTE') {
                return {
                    isValid: true,
                    status: 'ESTUDIO_PENDIENTE',
                    message: 'OK',
                    patientData: rawRecord,
                    rawResponse: json
                };
            } else if (estatus === 'ESTUDIO_REALIZADO') {
                return {
                    isValid: false,
                    status: 'ESTUDIO_REALIZADO',
                    message: '⛔ **Cita No Disponible.**\n\n---\n\nLa cita ingresada ya no está disponible (Falta por realizar el estudio). Consulte en recepción.',
                    patientData: null
                };
            } else if (estatus === 'ESTUDIO_COMPLETO') {
                return {
                    isValid: false,
                    status: 'ESTUDIO_COMPLETO',
                    message: '⛔ **Estudio Previamente Completado.**\n\n---\n\nLa cita ingresada ya ha sido procesada y el estudio clínico fue completado anteriormente.',
                    patientData: null
                };
            } else {
                return {
                    isValid: false,
                    status: 'ESTUDIO_NO_ENCONTRADO',
                    message: '⛔ **Número de Cita Inválido.**\n\n---\n\nEl número de cita proporcionado no es válido para realizar un estudio.',
                    patientData: null
                };
            }

        } catch (err) {
            console.error("Validation Hook Error:", err);
            setError({ type: 'NETWORK', message: 'Error de conexión.' });
            return {
                isValid: false,
                status: 'ERROR_RED',
                message: '⛔ **Fallo de Sincronización.**\n\n---\n\nNo fue posible establecer conexión con la Red Institucional. Verifique su acceso e intente nuevamente.',
                patientData: null
            };
        } finally {
            setLoading(false);
        }
    };

    return {
        validateCitation,
        loading,
        error
    };
};

export default useCitationValidation;
