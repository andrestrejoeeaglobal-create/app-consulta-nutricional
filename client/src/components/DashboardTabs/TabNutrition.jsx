/* eslint-disable no-unused-vars */
import React from 'react';
import { Shield, Clock, AlertTriangle, XCircle, Heart } from 'lucide-react';

export const TabNutrition = ({
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
                title="Nutrición y Patrones"
                id="accordion-nutrition"
                isOpen={openSections.nutrition || true} // Ensure it has a state or default open
                onToggle={() => toggleSection('nutrition')}
            >
                {/* BENTO GRID LAYOUT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* TARJETA: PREFERENCIAS Y SEGURIDAD */}
                    <div id="card-preferences" className="glass-morphism dark:bg-slate-800/60 dark:border-indigo-900/50 p-6 rounded-3xl relative overflow-hidden transition-all duration-300 flex flex-col">
                        <CardHeader icon={Shield} title="Preferencias y Seguridad" colorClass="text-indigo-600 dark:text-indigo-400"
                            onEdit={() => onTriggerEdit && onTriggerEdit('preferences')}
                            showEdit={true}
                        />
                        <div className="space-y-4">
                            {/* 1. DIET STYLE & OVERRIDE STATUS */}
                            <div className="flex justify-between items-start border-b border-indigo-50 pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🥗</span>
                                    <div>
                                        <div className="text-sm font-bold text-slate-700">Estrategia Nutricional</div>
                                        <div className="text-xs text-slate-500">
                                            Solicitado: <span className="italic">{patientData.nutrition?.preferences?.user_selected_diet || '--'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${patientData.nutrition?.preferences?.safety_lock?.override_applied ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-indigo-50 text-indigo-700'
                                        }`}>
                                        {patientData.nutrition?.preferences?.assigned_diet || 'PENDIENTE'}
                                    </span>
                                    {patientData.nutrition?.preferences?.safety_lock?.override_applied && (
                                        <div className="text-[9px] text-amber-600 font-medium mt-1 flex items-center justify-end gap-1">
                                            <AlertTriangle size={10} />
                                            Medical Override
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. HEDONICS (LIKES & DISLIKES) */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Dislikes */}
                                <div className="bg-red-50/50 p-2 rounded-lg border border-red-100">
                                    <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <XCircle size={10} /> Aversiones (Excluir)
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {patientData.nutrition?.preferences?.excluded_ingredients?.length > 0 ? (
                                            patientData.nutrition.preferences.excluded_ingredients.map((item, i) => (
                                                <span key={i} className="text-[10px] bg-white px-1.5 rounded text-red-600 border border-red-100 shadow-sm">{item}</span>
                                            ))
                                        ) : <span className="text-[10px] text-slate-400 italic">Ninguna</span>}
                                    </div>
                                </div>
                                {/* Likes */}
                                <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Heart size={10} /> Favoritos (Incluir)
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {patientData.nutrition?.preferences?.favorite_foods?.length > 0 ? (
                                            patientData.nutrition.preferences.favorite_foods.map((item, i) => (
                                                <span key={i} className="text-[10px] bg-white px-1.5 rounded text-emerald-600 border border-emerald-100 shadow-sm">{item}</span>
                                            ))
                                        ) : <span className="text-[10px] text-slate-400 italic">Sin datos</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TARJETA: CRONONUTRICIÓN (R24H) */}
                    <div id="card-chrononutrition" className="glass-morphism dark:bg-slate-800/60 dark:border-orange-900/50 p-6 rounded-3xl relative overflow-hidden transition-all duration-300 flex flex-col">
                        <CardHeader icon={Clock} title="Crononutrición (R24H)" colorClass="text-orange-600 dark:text-orange-400"
                            onEdit={() => onTriggerEdit && onTriggerEdit('chrononutrition')}
                            showEdit={true}
                        />

                        {/* METRICS ROW */}
                        <div className="flex justify-between items-center mb-6 bg-orange-50/50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                            <div className="text-center">
                                <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Ventana Comida</div>
                                <div className="text-xl font-bold text-orange-600">
                                    {patientData.nutrition?.current_diet_r24h?.feeding_window_hours || '--'}h
                                </div>
                            </div>
                            <div className="h-8 w-px bg-orange-200/50"></div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Ayuno Nocturno</div>
                                <div className="text-xl font-bold text-indigo-600">
                                    {patientData.nutrition?.current_diet_r24h?.fasting_window_hours || '--'}h
                                </div>
                            </div>
                            <div className="h-8 w-px bg-orange-200/50"></div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Cena Tardía</div>
                                {patientData.nutrition?.current_diet_r24h?.late_dinner_risk ? (
                                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold border border-red-200">RIESGO</span>
                                ) : (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">OK</span>
                                )}
                            </div>
                        </div>

                        {/* TIMELINE VISUALIZATION */}
                        <div className="relative pl-4 space-y-4 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {/* FIRST BITE */}
                            <div className="relative">
                                <div className="absolute -left-[19px] bg-emerald-500 w-2.5 h-2.5 rounded-full border-2 border-white ring-1 ring-emerald-100 mt-1.5"></div>
                                <div className="text-xs font-bold text-emerald-700">
                                    {patientData.nutrition?.current_diet_r24h?.first_bite_time || '--:--'} <span className="text-slate-400 font-normal">- Primer Bocado</span>
                                </div>
                            </div>

                            {/* ENTRIES LOOP */}
                            {patientData.nutrition?.current_diet_r24h?.entries?.map((entry, idx) => (
                                <div key={idx} className="relative">
                                    <div className="absolute -left-[19px] bg-slate-300 w-2 h-2 rounded-full border-2 border-white mt-1.5"></div>
                                    <div className="bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-bold text-slate-700">{entry.time}</span>
                                            <span className={`text-[9px] px-1.5 rounded ${entry.hunger_level >= 8 ? 'bg-green-100 text-green-700' : entry.hunger_level <= 3 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                Hambre: {entry.hunger_level}/10
                                            </span>
                                        </div>
                                        <div className="text-slate-600 leading-snug">{entry.content_raw}</div>
                                    </div>
                                </div>
                            ))}

                            {/* LAST BITE */}
                            {patientData.nutrition?.current_diet_r24h?.last_bite_time && (
                                <div className="relative">
                                    <div className="absolute -left-[19px] bg-indigo-500 w-2.5 h-2.5 rounded-full border-2 border-white ring-1 ring-indigo-100 mt-1.5"></div>
                                    <div className="text-xs font-bold text-indigo-700">
                                        {patientData.nutrition.current_diet_r24h.last_bite_time} <span className="text-slate-400 font-normal">- Último Bocado</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Accordion>
        </div>
    );
};

export default TabNutrition;
