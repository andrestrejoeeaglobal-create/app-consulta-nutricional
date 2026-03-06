import { useState } from 'react';
import axios from 'axios';

/**
 * useCitationValidation Hook
 * Handles the logic for validating citations against the SAFE-ID backend.
 */
const useCitationValidation = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const validateCitation = async (citationId) => {
        setLoading(true);
        setError(null);
        setData(null);

        try {
            // Updated endpoint to match implementing SAFE-ID backend
            const response = await axios.get(`http://localhost:5000/checkCitation`, {
                params: { id: citationId }
            });

            // The backend returns { response: { code: 0, message: "ok" }, dataSet: [...] } 
            // OR { response: { code: 404... }, dataSet: [] }

            // const { response: meta, dataSet } = response.data; // Unused

            // V7.3: Pasamos la respuesta cruda para que la lógica de negocio (App.jsx)
            // decida qué hacer con estatus USED o NOT_FOUND.
            return response.data;

        } catch (err) {
            console.error("Validation Hook Error:", err);
            setError({ type: 'NETWORK', message: 'Error de conexión.' });
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        validateCitation,
        loading,
        error,
        data
    };
};

export default useCitationValidation;
