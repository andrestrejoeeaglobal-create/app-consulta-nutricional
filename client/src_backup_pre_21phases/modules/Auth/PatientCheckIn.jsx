import React, { useState } from 'react';
import axios from 'axios';
import { AnimatePresence } from 'framer-motion';

const PatientCheckIn = ({ onValidationSuccess }) => {
    const [appointmentId, setAppointmentId] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, error, completed, locked
    const [attempts, setAttempts] = useState(0);
    const [feedbackMsg, setFeedbackMsg] = useState('');
    const [historyData, setHistoryData] = useState(null); // Datos de la cita vieja

    // 🛠️ UTILS: Parsing de Datos (Traductor Tilo)
    const formatDate = (dateString) => {
        // Convierte "2025-12-31" -> "31 de Diciembre, 2025"
        if (!dateString) return 'Fecha desconocida';
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('es-MX', options);
    };

    const translateType = (type) => {
        // Traduce "ON LINE" -> "Modalidad En Línea"
        if (type === 'ON LINE' || type === 'En Linea') return 'Modalidad En Línea';
        return 'Consulta Presencial';
    };

    const handleValidate = async (e) => {
        e.preventDefault();
        if (!appointmentId.trim()) return;

        setStatus('loading');
        setHistoryData(null); // Limpiar datos previos

        try {
            const response = await axios.post('http://localhost:5000/api/clinical/validate-appointment', {
                appointmentId
            });

            const data = response.data;

            if (data.valid) {
                // ✅ ÉXITO
                setStatus('success');
                setFeedbackMsg('✅ Cita validada correctamente. Cargando expediente...');
                setTimeout(() => {
                    onValidationSuccess(data.patientData);
                }, 1500);
            } else {
                // 🚦 MANEJO DE CASOS DE FALLO
                if (data.reason === 'COMPLETED') {
                    // CASO 1: Cita Vencida (Bandera de Meta)
                    setStatus('completed');
                    setHistoryData(data.details);
                    setAppointmentId(''); // Limpiar para permitir nuevo intento inmediato
                } else {
                    // CASO 2: No existe
                    throw new Error('Invalid ID');
                }
            }

        } catch {
            // ❌ LÓGICA DE REINTENTO (Solo para errores reales, no para citas vencidas)
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);

            if (newAttempts >= 3) {
                setStatus('locked');
                setFeedbackMsg('⚠️ Parece que hay un problema. Por favor, acérquese al mostrador para que un humano valide su acceso manual.');
            } else {
                setStatus('error');
                setFeedbackMsg(`❌ No pudimos validar la Cita #${appointmentId}. Verifique su comprobante.`);
                setAppointmentId('');
            }
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg border border-gray-100">

            {/* Avatar Tilo */}
            <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl shadow-sm">
                    🧩
                </div>
            </div>

            <h2 className="text-center text-xl font-bold text-gray-800 mb-2">Hola, soy Tilo</h2>
            <p className="text-center text-gray-500 mb-6 text-sm">
                Estoy listo para procesar una nueva consulta.
            </p>

            {/* ZONA DE MENSAJES DINÁMICOS */}
            <AnimatePresence mode='wait'>

                {/* ❌ ERROR GENÉRICO */}
                {status === 'error' && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded shadow-sm"
                    >
                        {feedbackMsg}
                    </motion.div>
                )}

                {/* 🏁 CASO 1: CITA COMPLETADA (Diseño Especial) */}
                {status === 'completed' && historyData && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl mt-1">🏁</div>
                            <div>
                                <p className="font-bold text-gray-800">La Cita ya fue procesada.</p>
                                <p className="text-gray-600 mt-1">
                                    Este folio aparece como <span className="font-semibold text-gray-800">CONCLUIDO</span> en nuestro historial.
                                </p>
                                <div className="mt-2 text-xs bg-white p-2 rounded border border-gray-200 text-gray-500">
                                    📅 Registro: <span className="font-medium text-gray-700">{formatDate(historyData.date)}</span>
                                    <br />
                                    💻 {translateType(historyData.type)}
                                </div>
                                <p className="text-blue-600 font-medium mt-3 text-xs">
                                    👇 Por favor, ingrese el folio vigente para hoy:
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FORMULARIO O BLOQUEO */}
            {status === 'locked' ? (
                <motion.div className="p-6 bg-orange-50 border border-orange-200 rounded-lg text-center">
                    <div className="text-4xl mb-3">⚠️</div>
                    <p className="text-orange-800 font-semibold text-sm">{feedbackMsg}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 text-xs text-gray-400 underline">Reiniciar sistema</button>
                </motion.div>
            ) : (
                <form onSubmit={handleValidate}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-xs font-bold mb-2 uppercase tracking-wide">
                            Número de Cita
                        </label>
                        <input
                            type="text"
                            value={appointmentId}
                            onChange={(e) => setAppointmentId(e.target.value)}
                            disabled={status === 'loading'}
                            placeholder="Ej: 1001"
                            className="appearance-none border rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-lg text-center bg-gray-50"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading' || !appointmentId}
                        className={`w-full font-bold py-3 px-4 rounded transition-all duration-200 
              ${status === 'loading'
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'}`}
                    >
                        {status === 'loading' ? 'Validando...' : 'Verificar Cita'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default PatientCheckIn;

