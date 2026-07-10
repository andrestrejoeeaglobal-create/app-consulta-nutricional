import React, { useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import tiloImg from "../../assets/tilo.png";

const Fase17_Despedida = ({ patientData }) => {

    useEffect(() => {
        // Optional: Perform any final cleanup or telemetry sync here
        console.log("Consulta finalizada. Datos consolidados:", patientData);
    }, [patientData]);

    return (
        <div className="flex-1 h-full flex items-center justify-center p-8 bg-slate-50 relative z-10 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full text-center flex flex-col items-center gap-6 relative z-10"
            >
                <div className="relative">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="w-24 h-24 rounded-full bg-slate-50 flex-shrink-0 border-2 border-slate-100 shadow-md flex items-center justify-center overflow-hidden mb-2 mx-auto relative z-10"
                    >
                        <img src={tiloImg} alt="Tilo" className="w-16 h-16 object-contain" />
                    </motion.div>
                    <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring" }}
                        className="absolute -bottom-2 -right-2 bg-emerald-100 text-emerald-600 p-2 rounded-full border-2 border-white shadow-sm z-20"
                    >
                        <CheckCircle className="w-6 h-6" />
                    </motion.div>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Consulta Finalizada</h2>
                    <p className="text-slate-600 leading-relaxed text-sm">
                        El expediente ha sido cerrado y guardado correctamente. 
                        Cediendo el control total al Bio-Arquitecto para la explicación final del plan al {patientData?.profile?.pediatric_profile?.is_minor ? 'tutor legal' : 'paciente'}.
                    </p>
                </div>

                <div className="w-16 h-1 bg-emerald-500 rounded-full opacity-50 mx-auto"></div>
                
                <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 text-left">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estatus del Sistema</p>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500"/> Sincronización de Datos: Completa</li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500"/> Protocolo Dietético: Generado</li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500"/> Esclusa Legal: Firmada</li>
                    </ul>
                </div>
            </motion.div>
        </div>
    );
};

export default Fase17_Despedida;
