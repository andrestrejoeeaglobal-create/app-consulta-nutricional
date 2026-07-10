/* eslint-disable no-unused-vars */
import React from 'react';
import { Activity, AlertCircle, AlertTriangle } from 'lucide-react';

export const TabLogistics = ({
    patientData,
    setPatientData,
    isEditing,
    onTriggerEdit,
    onEditToggle,
    renderEditableField,
    CardHeader,
    Accordion,
    openSections,
    toggleSection,
    currentStep
}) => {
    return (
        <div className="space-y-6">
            <Accordion
                title="Estilo de Vida y Entorno"
                id="accordion-lifestyle-env"
                isOpen={openSections.parentLifestyle}
                onToggle={() => toggleSection('parentLifestyle')}
                variant="parent"
            >
                <div className="space-y-6">
                    {/* TARJETA I: ACTIVIDAD Y SUEÑO (PHASE 11 V1.0) */}
                    <div id="card-lifestyle" className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 relative overflow-hidden transition-all duration-300">
                        <CardHeader icon={Activity} title="Actividad y Entorno" colorClass="text-emerald-600"
                            onEdit={() => onTriggerEdit && onTriggerEdit('activity')}
                            showEdit={true}
                        />

                        <div className="space-y-4">
                            {/* 1. ACTIVIDAD FÍSICA & NEAT */}
                            <div className="border-b border-slate-50 pb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🏃</span>
                                        <div>
                                            <div className="text-sm font-bold text-slate-700">Actividad Física</div>
                                            <div className="text-xs text-slate-500 font-medium">
                                                NEAT: {patientData.lifestyle_profile?.activity?.neat_level || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                    {patientData.lifestyle_profile?.activity?.has_scheduled_exercise ? (
                                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded font-bold">EJERCITANTE</span>
                                    ) : (
                                        <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded font-bold">SEDENTARIO</span>
                                    )}
                                </div>

                                {/* Activity Log */}
                                {patientData.lifestyle_profile?.activity?.log?.length > 0 ? (
                                    <div className="space-y-1 mt-2">
                                        {patientData.lifestyle_profile.activity.log.map((act, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-emerald-50 px-2 py-1.5 rounded text-xs text-emerald-800">
                                                <span className="font-semibold">{act.type}</span>
                                                <span className="opacity-80">{act.frequency}d/sem - {act.duration}min</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    (patientData.lifestyle_profile?.activity?.has_scheduled_exercise) && <div className="text-xs text-slate-400 italic pl-8">Sin detalles de actividad</div>
                                )}
                            </div>

                            {/* 2. SUEÑO Y RITMO CIRCADIANO */}
                            <div className="border-b border-slate-50 pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">💤</span>
                                        <div>
                                            <div className="text-sm font-bold text-slate-700">Sueño y Descanso</div>
                                            <div className="text-xs text-slate-500">
                                                {patientData.lifestyle_profile?.sleep?.hours_avg ? `${patientData.lifestyle_profile.sleep.hours_avg} horas/noche` : '--'}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${patientData.lifestyle_profile?.sleep?.quality === 'GOOD' ? 'bg-blue-100 text-blue-700' :
                                        patientData.lifestyle_profile?.sleep?.quality === 'POOR' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                        }`}>
                                        {patientData.lifestyle_profile?.sleep?.quality === 'GOOD' ? 'CALIDAD BUENA' :
                                            patientData.lifestyle_profile?.sleep?.quality === 'POOR' ? 'MALA CALIDAD' : 'REGULAR'}
                                    </span>
                                </div>
                                {/* Ghrelin Warning */}
                                {patientData.lifestyle_profile?.sleep?.hours_avg > 0 && patientData.lifestyle_profile.sleep.hours_avg < 6 && (
                                    <div className="mt-2 flex items-center gap-2 bg-yellow-50 px-2 py-1 rounded text-[10px] text-yellow-800 border border-yellow-100">
                                        <AlertCircle size={12} />
                                        <span>Riesgo Hormonal: Posible aumento de Grelina (Apetito).</span>
                                    </div>
                                )}
                                {patientData.lifestyle_profile?.sleep?.issue_type && patientData.lifestyle_profile?.sleep?.issue_type !== 'NONE' && (
                                    <div className="mt-1 pl-8 text-xs text-slate-500">
                                        Problema: <span className="font-medium text-slate-700">{patientData.lifestyle_profile?.sleep?.issue_type}</span>
                                    </div>
                                )}
                            </div>

                            {/* 3. ESTRÉS Y CORTISOL */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🧠</span>
                                    <div>
                                        <div className="text-sm font-bold text-slate-700">Nivel de Estrés</div>
                                        <div className="text-xs text-slate-500">
                                            Origen: {patientData.lifestyle_profile?.stress?.origin === 'NONE' ? '--' : patientData.lifestyle_profile?.stress?.origin}
                                        </div>
                                    </div>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${patientData.lifestyle_profile?.stress?.level === 'LOW' ? 'bg-green-100 text-green-700' :
                                    patientData.lifestyle_profile?.stress?.level === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                    {patientData.lifestyle_profile?.stress?.level || 'SIN DATO'}
                                </span>
                            </div>
                            {patientData.lifestyle_profile?.stress?.cortisol_management_needed && (
                                <div className="mt-2 flex items-center gap-2 bg-red-50 px-2 py-1 rounded text-[10px] text-red-800 border border-red-100">
                                    <AlertTriangle size={12} />
                                    <span>Alerta Cortisol: Gestión de estrés prioritaria.</span>
                                </div>
                            )}

                            {/* 4. LOGÍSTICA Y REALIDAD (PHASE 12) */}
                            <div className="border-t border-slate-100 pt-3 mt-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🍱</span>
                                        <div>
                                            <div className="text-sm font-bold text-slate-700">Logística Alimentaria</div>
                                            <div className="text-xs text-slate-500">
                                                {patientData.logistics_profile?.cook_type === 'SELF' ? 'Cocina Propia' :
                                                    patientData.logistics_profile?.cook_type === 'FAMILY' ? 'Familiar Cocina' :
                                                        patientData.logistics_profile?.cook_type === 'STAFF' ? 'Personal Cocina' :
                                                            patientData.logistics_profile?.cook_type === 'BUYING' ? 'Compra Comida' : '--'}
                                                {' • '}
                                                {patientData.logistics_profile?.environment?.venue === 'HOME' ? 'Come en Casa' :
                                                    patientData.logistics_profile?.environment?.venue === 'WORK' ? 'Come en Trabajo' :
                                                        patientData.logistics_profile?.environment?.venue === 'STREET' ? 'Come en Calle' : ''}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Constraints Badges */}
                                    <div className="flex flex-col gap-1 items-end">
                                        {!patientData.logistics_profile?.recipe_filters?.requires_reheating && (
                                            <span className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded border border-slate-200">NO MICROONDAS</span>
                                        )}
                                        {!patientData.logistics_profile?.recipe_filters?.requires_refrigeration && (
                                            <span className="bg-rose-50 text-rose-600 text-[9px] px-1.5 py-0.5 rounded border border-rose-100">NO REFRIGERACIÓN</span>
                                        )}
                                        {patientData.logistics_profile?.cooking_time === 'LOW' && (
                                            <span className="bg-blue-50 text-blue-600 text-[9px] px-1.5 py-0.5 rounded border border-blue-100">TIEMPO LIMITADO</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Accordion>
        </div>
    );
};

export default TabLogistics;
