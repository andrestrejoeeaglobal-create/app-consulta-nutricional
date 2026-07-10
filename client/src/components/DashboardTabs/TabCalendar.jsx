import React, { useState } from 'react';
import axios from 'axios';
import {
    CheckCircle, Clock, Coffee, Moon, Sun, Utensils,
    Navigation, Activity, MapPin, Briefcase, User, Smartphone, Send, Shield, AlertTriangle
} from 'lucide-react';

export const TabCalendar = ({
    patientData,
    setPatientData,
    apiContext,
    Accordion,
    openSections,
    toggleSection
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [errorSync, setErrorSync] = useState(null);

    const has33Plus = patientData?.advanced_supplementation?.some(s => s.name === '33 PLUS');
    const has34Plus = patientData?.advanced_supplementation?.some(s => s.name === '34 PLUS');

    // Extraer datos logísticos o usar fallbacks seguros
    const environmentVenue = patientData?.logistics_profile?.environment?.venue || 'HOME';
    const cookType = patientData?.logistics_profile?.cook_type || 'SELF';

    const handleExport = async () => {
        setIsExporting(true);
        setErrorSync(null);

        const citationId = apiContext?.citaId || apiContext?.idCita || patientData?.citaId || '15000';
        const userId = apiContext?.userId || patientData?.userId || '165';

        // Construir DTO limpio (Contrato de Datos)
        const dto = {
            sync_metadata: {
                citation_id: citationId,
                user_id: userId,
                timestamp: new Date().toISOString()
            },
            safety_clearance: {
                allergies_detected: patientData?.history?.allergies?.food?.map(a => a.agent) || [],
                override_applied: patientData?.nutrition?.preferences?.safety_lock?.override_applied || false
            },
            metabolic_clock: {
                breakfast: {
                    time: '09:00 AM',
                    supplement: has33Plus ? '33 PLUS' : null
                },
                lunch: {
                    time: '02:00 PM',
                    supplement: null
                },
                dinner: {
                    time: '08:30 PM',
                    supplement: has34Plus ? '34 PLUS' : null
                }
            },
            logistics_execution: {
                environment_venue: environmentVenue,
                cook_type: cookType,
                factibility: 'Alta - Menú Adaptativo'
            },
            sprint_tracker: {
                duration_days: 28,
                milestones: [
                    { day: 0, label: 'Inicio & Sincronización' },
                    { day: 2, label: 'Control Tilo (App)' },
                    { week: '1-3', label: 'Calibración Semanal' },
                    { day: 28, label: 'Bio-Auditoría (Electret)' }
                ]
            }
        };

        try {
            // Petición real al backend local (Puerto 5000)
            const response = await axios.patch(`http://localhost:5000/api/citations/${citationId}/progress`, {
                phase: 21,
                block: 'finished',
                patientData: dto,
                is_completed: true
            });

            if (response.data?.success) {
                setExportSuccess(true);
                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        is_completed: true
                    }));
                }
            } else {
                throw new Error("Respuesta del servidor sin éxito");
            }
        } catch (err) {
            console.error("❌ Error al sincronizar con Terminal B:", err.message);
            setErrorSync("Error de conexión: No se pudo transmitir el plan a la Terminal B.");
        } finally {
            setIsExporting(false);
        }
    };

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
            {/* --- ACORDEÓN PADRE: CALENDARIO Y RUTA DE EJECUCIÓN --- */}
            <Accordion
                title="Calendario y Ruta de Ejecución"
                id="accordion-calendar-parent"
                isOpen={openSections.parentCalendar}
                onToggle={() => toggleSection('parentCalendar')}
                variant="parent"
            >
                <div className="space-y-6">

                    {/* --- CHILD ACCORDION 1: RELOJ METABÓLICO --- */}
                    <Accordion
                        title="Reloj Metabólico"
                        id="accordion-metabolic-clock"
                        isOpen={openSections.childMetabolicClock}
                        onToggle={() => toggleSection('childMetabolicClock')}
                    >
                        <div id="card-metabolic-clock" className="bg-tilo-bg-base/40 rounded-2xl p-6 border border-tilo-border">
                            <div className="relative border-l-2 border-tilo-border ml-4 space-y-8 py-2">
                                {/* 09:00 AM */}
                                <div className="relative pl-6">
                                    <span className="absolute -left-[11px] top-1 px-1 bg-tilo-bg-panel">
                                        <div className="w-4 h-4 rounded-full bg-tilo-warning/10 border-2 border-tilo-warning flex items-center justify-center">
                                            <Sun className="w-2.5 h-2.5 text-tilo-warning" />
                                        </div>
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-tilo-text-main">09:00 AM</span>
                                        <span className="text-tilo-warning text-[10px] font-bold uppercase tracking-wider mb-1">Ventana de Desayuno</span>
                                        {has33Plus ? (
                                            <div className="bg-tilo-primary/10 p-3 rounded-xl border border-tilo-primary/20 mt-1 shadow-sm max-w-md">
                                                <div className="flex items-start gap-2">
                                                    <Activity className="w-4 h-4 text-tilo-primary shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs font-bold text-tilo-text-main">Ignición Mitocondrial</p>
                                                        <p className="text-[10px] text-tilo-text-muted leading-tight">Tomar Suplemento 33+ (1 toma)</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-tilo-bg-base/20 p-3 rounded-xl border border-tilo-border mt-1 border-dashed max-w-md">
                                                <p className="text-[10px] text-tilo-text-muted/60 italic">Sin suplemento de ignición asignado</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 02:00 PM */}
                                <div className="relative pl-6">
                                    <span className="absolute -left-[11px] top-1 px-1 bg-tilo-bg-panel">
                                        <div className="w-4 h-4 rounded-full bg-tilo-primary/10 border-2 border-tilo-primary flex items-center justify-center">
                                            <Utensils className="w-2.5 h-2.5 text-tilo-primary" />
                                        </div>
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-tilo-text-main">02:00 PM</span>
                                        <span className="text-tilo-primary text-[10px] font-bold uppercase tracking-wider mb-1">Comida Principal</span>
                                        <p className="text-xs text-tilo-text-muted leading-relaxed">Pico insulínico mayor. Integración de macronutrientes.</p>
                                    </div>
                                </div>

                                {/* 08:30 PM */}
                                <div className="relative pl-6">
                                    <span className="absolute -left-[11px] top-1 px-1 bg-tilo-bg-panel">
                                        <div className="w-4 h-4 rounded-full bg-tilo-success/10 border-2 border-tilo-success flex items-center justify-center">
                                            <Moon className="w-2.5 h-2.5 text-tilo-success" />
                                        </div>
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-tilo-text-main">08:30 PM</span>
                                        <span className="text-tilo-success text-[10px] font-bold uppercase tracking-wider mb-1">Cena y Cierre Metabólico</span>
                                        {has34Plus ? (
                                            <div className="bg-tilo-success/10 p-3 rounded-xl border border-tilo-success/20 mt-1 shadow-sm max-w-md">
                                                <div className="flex items-start gap-2">
                                                    <Shield className="w-4 h-4 text-tilo-success shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs font-bold text-tilo-text-main">Reparación Tisular</p>
                                                        <p className="text-[10px] text-tilo-text-muted leading-tight">Tomar Suplemento 34+ (1 toma)</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-tilo-bg-base/20 p-3 rounded-xl border border-tilo-border mt-1 border-dashed max-w-md">
                                                <p className="text-[10px] text-tilo-text-muted/60 italic">Sin suplemento de reparación asignado</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 2: LOGÍSTICA DE EJECUCIÓN --- */}
                    <Accordion
                        title="Logística de Ejecución"
                        id="accordion-execution-logistics"
                        isOpen={openSections.childExecutionLogistics}
                        onToggle={() => toggleSection('childExecutionLogistics')}
                    >
                        <div id="card-logistics" className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-bold text-tilo-text-muted uppercase tracking-wider">Planificación de Ejecución</span>
                                <span className="bg-tilo-success/10 text-tilo-success border border-tilo-success/20 text-[10px] font-black tracking-wider px-3 py-1 rounded-full uppercase">
                                    Nivel 1: Al Paso
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-tilo-bg-base/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-tilo-border">
                                    <MapPin className="w-5 h-5 text-tilo-text-muted/50 mb-2" />
                                    <span className="text-[10px] uppercase text-tilo-text-muted font-bold tracking-wider mb-1">Entorno Principal</span>
                                    <span className="text-sm font-bold text-tilo-text-main">{translateVenue(environmentVenue)}</span>
                                </div>
                                <div className="bg-tilo-bg-base/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-tilo-border">
                                    <User className="w-5 h-5 text-tilo-text-muted/50 mb-2" />
                                    <span className="text-[10px] uppercase text-tilo-text-muted font-bold tracking-wider mb-1">Preparación</span>
                                    <span className="text-sm font-bold text-tilo-text-main">{translateCook(cookType)}</span>
                                </div>
                                <div className="bg-tilo-bg-base/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-tilo-border">
                                    <Coffee className="w-5 h-5 text-tilo-text-muted/50 mb-2" />
                                    <span className="text-[10px] uppercase text-tilo-text-muted font-bold tracking-wider mb-1">Factibilidad</span>
                                    <span className="text-sm font-bold text-tilo-text-main">Alta - Menú Adaptativo</span>
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 3: RUTA DE EVOLUCIÓN: 28 DÍAS --- */}
                    <Accordion
                        title="Ruta de Evolución: 28 Días"
                        id="accordion-evolution-route"
                        isOpen={openSections.childEvolutionRoute}
                        onToggle={() => toggleSection('childEvolutionRoute')}
                    >
                        <div id="card-evolution" className="py-4">
                            <div className="relative flex justify-between items-center w-full px-4 md:px-10 mt-4 mb-2">
                                {/* Track line base */}
                                <div className="absolute left-6 right-6 md:left-12 md:right-12 top-1/2 -translate-y-1/2 h-1 bg-tilo-border rounded-full z-0"></div>
                                {/* Track line active progress (ex. day 0 right now) */}
                                <div className="absolute left-6 md:left-12 top-1/2 -translate-y-1/2 h-1 bg-tilo-primary rounded-full z-0 w-0"></div>

                                {/* Node 1: Día 0 */}
                                <div className="relative z-10 flex flex-col items-center group">
                                    <div className="w-8 h-8 rounded-full bg-tilo-primary border-4 border-tilo-bg-panel shadow-md flex items-center justify-center transition-transform group-hover:scale-110">
                                        <div className="w-2 h-2 bg-tilo-bg-panel rounded-full"></div>
                                    </div>
                                    <div className="absolute top-10 text-center w-24">
                                        <p className="text-xs font-black text-tilo-primary">Día 0</p>
                                        <p className="text-[10px] text-tilo-text-muted leading-tight font-medium">Inicio & Sincronización</p>
                                    </div>
                                </div>

                                {/* Node 2: Día 2 */}
                                <div className="relative z-10 flex flex-col items-center group">
                                    <div className="w-8 h-8 rounded-full bg-tilo-bg-base border-4 border-tilo-bg-panel shadow-sm flex items-center justify-center transition-transform group-hover:scale-110 border-tilo-border">
                                        <Smartphone className="w-3 h-3 text-tilo-text-muted/70" />
                                    </div>
                                    <div className="absolute top-10 text-center w-24">
                                        <p className="text-xs font-bold text-tilo-text-main">Día 2</p>
                                        <p className="text-[10px] text-tilo-text-muted leading-tight">Control Tilo (App)</p>
                                    </div>
                                </div>

                                {/* Node 3: S1-S3 */}
                                <div className="relative z-10 flex flex-col items-center group">
                                    <div className="w-8 h-8 rounded-full bg-tilo-bg-base border-4 border-tilo-bg-panel shadow-sm flex items-center justify-center transition-transform group-hover:scale-110 border-tilo-border">
                                        <Activity className="w-3 h-3 text-tilo-text-muted/70" />
                                    </div>
                                    <div className="absolute top-10 text-center w-24">
                                        <p className="text-xs font-bold text-tilo-text-main">Semana 1-3</p>
                                        <p className="text-[10px] text-tilo-text-muted leading-tight">Calibración Semanal</p>
                                    </div>
                                </div>

                                {/* Node 4: Día 28 */}
                                <div className="relative z-10 flex flex-col items-center group">
                                    <div className="w-8 h-8 rounded-full bg-tilo-bg-base border-4 border-tilo-bg-panel shadow-sm flex items-center justify-center transition-transform group-hover:scale-110 border-tilo-border">
                                        <CheckCircle className="w-3 h-3 text-tilo-text-muted/70" />
                                    </div>
                                    <div className="absolute top-10 text-center w-24 text-right md:text-center md:right-auto right-0 translate-x-1/2 md:translate-x-0">
                                        <p className="text-xs font-bold text-tilo-text-main">Día 28</p>
                                        <p className="text-[10px] text-tilo-text-muted leading-tight">Bio-Auditoría (Electret)</p>
                                    </div>
                                </div>
                            </div>
                            {/* Spacer to push content down since nodes have absolute text */}
                            <div className="h-16"></div>
                        </div>
                    </Accordion>
                </div>
            </Accordion>

            {/* ERROR SYNC BANNER */}
            {errorSync && (
                <div className="bg-tilo-danger/10 border border-tilo-danger/20 text-tilo-danger px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold mt-4 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-tilo-danger shrink-0" />
                    <span>{errorSync}</span>
                </div>
            )}

            {/* BOTÓN DE CIERRE (Sincronización) */}
            <div className="flex justify-end pt-4 border-t border-tilo-border mt-8">
                <button
                    onClick={handleExport}
                    disabled={isExporting || exportSuccess}
                    className={`
                        relative overflow-hidden flex justify-center items-center gap-2 px-8 py-4 rounded-2xl font-black tracking-wide text-xs transition-all duration-300 w-full sm:w-auto shadow-lg cursor-pointer
                        ${exportSuccess
                            ? 'bg-tilo-success text-white cursor-default shadow-tilo-success/20'
                            : 'bg-tilo-primary text-white hover:bg-tilo-primary/80 shadow-tilo-primary/20 hover:shadow-tilo-primary/30 hover:-translate-y-0.5'
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
