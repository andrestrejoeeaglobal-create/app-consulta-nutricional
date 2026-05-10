import React, { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';

const Fase14_Orquestador = ({ onPhaseComplete, patientData }) => {
    const [statusLog, setStatusLog] = useState([]);
    const [currentAction, setCurrentAction] = useState('Iniciando Cortex Integral...');

    useEffect(() => {
        const isFemale = patientData?.profile?.sex === 'FEMENINO';
        const riskLevel = patientData?.clinical_context?.alert_level || 'NORMAL';
        
        const sequence = [
            { time: 500, log: `Iniciando análisis para paciente ${isFemale ? 'femenina' : 'masculino'}...` },
            { time: 2000, log: `Calibrando nivel de riesgo clínico: ${riskLevel}` },
            { time: 3500, log: 'Procesando Eje Hormonal (Resistencia / Cortisol)...' },
            { time: 5000, log: 'Analizando Psiquiatría Nutricional (Eje intestino-cerebro)...' },
            { time: 6500, log: 'Sintetizando Medicina Metabólica (Inmunidad)...' },
            { time: 8000, log: 'Evaluando Reequilibrio Biomecánico...' },
            { time: 9500, log: 'Traduciendo a 7 Bloques Clínicos Estandarizados...' },
            { time: 11000, action: 'done' }
        ];

        let timeouts = [];

        sequence.forEach(({ time, log, action }) => {
            const t = setTimeout(() => {
                if (log) {
                    setStatusLog(prev => [...prev, log]);
                    setCurrentAction(log);
                }
                if (action === 'done') {
                    setCurrentAction('Análisis Completado.');
                    if (onPhaseComplete) {
                        setTimeout(() => {
                            onPhaseComplete('PHASE_15_SUPPLEMENTATION');
                        }, 1000);
                    }
                }
            }, time);
            timeouts.push(t);
        });

        return () => timeouts.forEach(clearTimeout);
    }, [onPhaseComplete, patientData?.profile?.sex, patientData?.clinical_context?.alert_level]);

    return (
        <div className="flex flex-col h-full bg-slate-900 relative items-center justify-center p-8 overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="z-10 bg-slate-800/80 backdrop-blur-md border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full text-center"
            >
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-blue-500/10 border-2 border-blue-500 flex items-center justify-center relative shadow-[0_0_30px_rgba(59,130,246,0.5)]">
                        <BrainCircuit className="w-10 h-10 text-blue-400" />
                        <div className="absolute inset-0 border-2 border-transparent border-t-blue-400 rounded-full animate-spin"></div>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2 font-prototype tracking-wider">
                    INTEGRAL PERFORMANCE CORTEX
                </h2>
                <p className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-8">
                    Orquestación Tetradimensional
                </p>

                <div className="space-y-4 text-left bg-slate-900/50 p-6 rounded-xl border border-slate-700 h-64 overflow-y-auto font-mono text-xs">
                    <AnimatePresence>
                        {statusLog.map((log, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-start gap-3 text-slate-300"
                            >
                                <span className="text-blue-500 mt-0.5">❯</span>
                                <span>{log}</span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {currentAction !== 'Análisis Completado.' && (
                        <div className="flex items-center gap-2 mt-4 text-slate-500 animate-pulse">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            <span>Procesando...</span>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Fase14_Orquestador;
