import React, { useState } from 'react';
import {
    Calendar, CheckCircle, Clock, Coffee, Moon, Sun, Utensils,
    Navigation, Activity, MapPin, Briefcase, User, Smartphone, Send
} from 'lucide-react';

export const TabCalendar = ({ patientData }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);

    const handleExport = () => {
        setIsExporting(true);
        // Simular llamada a API o delay de red
        setTimeout(() => {
            setIsExporting(false);
            setExportSuccess(true);
            // Reset success message after 3 seconds
            setTimeout(() => setExportSuccess(false), 3000);
        }, 1500);
    };

    // Extraer datos logísticos o usar fallbacks seguros
    const environmentVenue = patientData?.logistics_profile?.environment?.venue || 'HOME';
    const cookType = patientData?.logistics_profile?.cook_type || 'SELF';

    const translateVenue = (v) => {
        if (v === 'HOME') return 'Casa';
        if (v === 'WORK') return 'Oficina';
        if (v === 'STREET') return 'Calle / Restaurante';
        return v;
    };

    const translateCook = (c) => {
        if (c === 'SELF') return 'Yo mismo';
        if (c === 'FAMILY') return 'Familia';
        if (c === 'STAFF') return 'Personal';
        if (c === 'BUYING') return 'Pre-hecha';
        return c;
    };

    return (
        <div className="space-y-6 font-sans">
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-700 to-blue-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-white/5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-indigo-200" />
                        Calendario & Sprint
                    </h2>
                    <p className="text-indigo-100 mt-2 text-lg">
                        Fase 21: Crononutrición y Ruta de Ejecución a 28 Días
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* BLOQUE 1: RELOJ METABÓLICO (Timeline Vertical) */}
                <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-full">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6 border-b border-slate-50 pb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        Reloj Metabólico
                    </h3>

                    <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 py-2 flex-grow">

                        {/* 09:00 AM */}
                        <div className="relative pl-6">
                            <span className="absolute -left-[11px] top-1 px-1 bg-white">
                                <div className="w-4 h-4 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center">
                                    <Sun className="w-2 h-2 text-amber-600" />
                                </div>
                            </span>
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800">09:00 AM</span>
                                <span className="text-amber-600 text-[10px] font-bold uppercase tracking-wider mb-1">Ventana de Desayuno</span>
                                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 mt-1">
                                    <div className="flex items-start gap-2">
                                        <Activity className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">Ignición Mitocondrial</p>
                                            <p className="text-[10px] text-slate-500 leading-tight">Sugerir toma de Suplemento 33+</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 02:00 PM */}
                        <div className="relative pl-6">
                            <span className="absolute -left-[11px] top-1 px-1 bg-white">
                                <div className="w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center">
                                    <Utensils className="w-2 h-2 text-blue-600" />
                                </div>
                            </span>
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800">02:00 PM</span>
                                <span className="text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-1">Comida Principal</span>
                                <p className="text-xs text-slate-500">Pico insulínico mayor. Integración de macronutrientes.</p>
                            </div>
                        </div>

                        {/* 08:30 PM */}
                        <div className="relative pl-6">
                            <span className="absolute -left-[11px] top-1 px-1 bg-white">
                                <div className="w-4 h-4 rounded-full bg-indigo-100 border-2 border-indigo-400 flex items-center justify-center">
                                    <Moon className="w-2 h-2 text-indigo-600" />
                                </div>
                            </span>
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800">08:30 PM</span>
                                <span className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-1">Cena y Cierre Metabólico</span>
                                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 mt-1">
                                    <div className="flex items-start gap-2">
                                        <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">Reparación Tisular</p>
                                            <p className="text-[10px] text-slate-500 leading-tight">Sugerir toma de Suplemento 34+</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6 flex flex-col">
                    {/* BLOQUE 2: LOGÍSTICA DE EJECUCIÓN */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-start border-b border-slate-50 pb-3 mb-4">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-emerald-500" />
                                Logística de Ejecución
                            </h3>
                            <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black tracking-wider px-3 py-1 rounded-full uppercase">
                                Nivel 1: Grab & Go
                            </span>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4 flex flex-col items-center justify-center text-center border border-slate-100">
                                <MapPin className="w-5 h-5 text-slate-400 mb-2" />
                                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Entorno Principal</span>
                                <span className="text-sm font-bold text-slate-700">{translateVenue(environmentVenue)}</span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 flex flex-col items-center justify-center text-center border border-slate-100">
                                <User className="w-5 h-5 text-slate-400 mb-2" />
                                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Preparación</span>
                                <span className="text-sm font-bold text-slate-700">{translateCook(cookType)}</span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 flex flex-col items-center justify-center text-center border border-slate-100 lg:col-span-2">
                                <Coffee className="w-5 h-5 text-slate-400 mb-2" />
                                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Factibilidad</span>
                                <span className="text-sm font-bold text-slate-700">Alta - Menú Adaptativo</span>
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE 3: EL SPRINT DE 28 DÍAS */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex-grow flex flex-col">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-50 pb-3 mb-6 flex items-center gap-2">
                            <Navigation className="w-4 h-4 text-orange-500" />
                            Ruta de Evolución: 28 Días
                        </h3>

                        {/* Horizontal Progress Tracker */}
                        <div className="relative flex justify-between items-center w-full px-4 md:px-10 mt-4 mb-2">
                            {/* Track line base */}
                            <div className="absolute left-6 right-6 md:left-12 md:right-12 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0"></div>
                            {/* Track line active progress (ex. day 0 right now) */}
                            <div className="absolute left-6 md:left-12 top-1/2 -translate-y-1/2 h-1 bg-blue-500 rounded-full z-0 w-0"></div>

                            {/* Node 1: Día 0 */}
                            <div className="relative z-10 flex flex-col items-center group">
                                <div className="w-8 h-8 rounded-full bg-blue-600 border-4 border-white shadow-md flex items-center justify-center transition-transform group-hover:scale-110">
                                    {/* Icon or dot inside based on status */}
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                </div>
                                <div className="absolute top-10 text-center w-24">
                                    <p className="text-xs font-black text-blue-600">Día 0</p>
                                    <p className="text-[10px] text-slate-500 leading-tight">Inicio & Sincronización</p>
                                </div>
                            </div>

                            {/* Node 2: Día 2 */}
                            <div className="relative z-10 flex flex-col items-center group">
                                <div className="w-8 h-8 rounded-full bg-slate-200 border-4 border-white shadow-sm flex items-center justify-center transition-transform group-hover:scale-110">
                                    <Smartphone className="w-3 h-3 text-slate-400" />
                                </div>
                                <div className="absolute top-10 text-center w-24">
                                    <p className="text-xs font-bold text-slate-500">Día 2</p>
                                    <p className="text-[10px] text-slate-400 leading-tight">Checkpoint Tilo (App)</p>
                                </div>
                            </div>

                            {/* Node 3: S1-S3 */}
                            <div className="relative z-10 flex flex-col items-center group">
                                <div className="w-8 h-8 rounded-full bg-slate-200 border-4 border-white shadow-sm flex items-center justify-center transition-transform group-hover:scale-110">
                                    <Activity className="w-3 h-3 text-slate-400" />
                                </div>
                                <div className="absolute top-10 text-center w-24">
                                    <p className="text-xs font-bold text-slate-500">Semana 1-3</p>
                                    <p className="text-[10px] text-slate-400 leading-tight">Calibración Semanal</p>
                                </div>
                            </div>

                            {/* Node 4: Día 28 */}
                            <div className="relative z-10 flex flex-col items-center group">
                                <div className="w-8 h-8 rounded-full bg-slate-200 border-4 border-white shadow-sm flex items-center justify-center transition-transform group-hover:scale-110">
                                    <CheckCircle className="w-3 h-3 text-slate-400" />
                                </div>
                                <div className="absolute top-10 text-center w-24 text-right md:text-center md:right-auto right-0 translate-x-1/2 md:translate-x-0">
                                    <p className="text-xs font-bold text-slate-500">Día 28</p>
                                    <p className="text-[10px] text-slate-400 leading-tight">Bio-Auditoría (Electret)</p>
                                </div>
                            </div>
                        </div>
                        {/* Spacer to push button down since nodes have absolute text */}
                        <div className="h-16 mt-auto"></div>
                    </div>
                </div>
            </div>

            {/* BOTÓN DE CIERRE (Sincronización) */}
            <div className="flex justify-end pt-4 border-t border-slate-200 mt-8">
                <button
                    onClick={handleExport}
                    disabled={isExporting || exportSuccess}
                    className={`
                        relative overflow-hidden flex justify-center items-center gap-2 px-8 py-4 rounded-2xl font-black tracking-wide text-sm transition-all duration-300 w-full sm:w-auto shadow-lg
                        ${exportSuccess
                            ? 'bg-green-500 text-white cursor-default shadow-green-500/20'
                            : 'bg-[#1a56ff] text-white hover:bg-blue-700 shadow-blue-500/30 hover:shadow-blue-600/40 hover:-translate-y-0.5'
                        }
                    `}
                >
                    {isExporting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Enviando Datos...</span>
                        </>
                    ) : exportSuccess ? (
                        <>
                            <CheckCircle className="w-5 h-5 text-white" />
                            <span>Plan Exportado con Éxito</span>
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            <span>Sincronizar con Terminal B (Enviar al Paciente)</span>
                        </>
                    )}

                    {/* Ripple/Glimmer effect */}
                    {!exportSuccess && !isExporting && (
                        <div className="absolute inset-0 -translate-x-full hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    )}
                </button>
            </div>
        </div>
    );
};

export default TabCalendar;
