/* eslint-disable no-unused-vars */
import React from 'react';
import { FlaskConical, AlertTriangle, Salad } from 'lucide-react';

const severityMap = {
    'HIGH': 'Alto',
    'MEDIUM': 'Moderado',
    'LOW': 'Bajo',
    'PENDING': 'Pendiente'
};

const smokingMap = {
    'CIGARETTE': 'Cigarrillo',
    'VAPE': 'Vapeador / Electrónico',
    'BOTH': 'Ambos (Cigarrillo y Vapeador)',
    'NONE': 'Ninguno'
};

const alcoholMap = {
    'BEER_355': 'Cerveza (355ml)',
    'BEER_940': 'Cerveza Caguama (940ml)',
    'WINE': 'Vino',
    'SPIRITS': 'Destilados / Licores',
    'COCKTAILS': 'Coctelería / Mezclas',
    'NONE': 'Ninguno'
};

export const TabRestrictions = ({
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
                title="Restricciones e Interacciones"
                id="accordion-restrictions"
                isOpen={openSections.lifestyle} // Reuse lifestyle or create new state key later in orchestrator
                onToggle={() => toggleSection('lifestyle')}
            >
                <div className="space-y-6">
                    {/* TARJETA: FARMACOLOGÍA Y SUPLEMENTNOS */}
                    <div id="card-meds" className={`bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 transition-all duration-300 ${currentStep?.includes('meds_') || currentStep?.includes('supp_') ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                        <CardHeader icon={FlaskConical} title="Farmacología y Suplementación" colorClass="text-indigo-600"
                            onEdit={() => onTriggerEdit && onTriggerEdit('meds')}
                            showEdit={true}
                        />
                        <div className="space-y-6">
                            {/* SECTION: MEDICATIONS */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Medicamentos Prescritos</h4>
                                {patientData.history?.medications && patientData.history.medications.length > 0 ? (
                                    <div className="space-y-2">
                                        {patientData.history.medications.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start p-3 bg-indigo-50 rounded-xl text-sm border border-indigo-100">
                                                <div>
                                                    <div className="font-bold text-indigo-700">{item.name}</div>
                                                    <div className="text-xs text-indigo-600 mt-0.5">{item.dose_frequency}</div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="inline-block px-2 py-0.5 bg-white rounded border border-indigo-200 text-[10px] font-bold text-indigo-500">
                                                        {item.duration || 'Sin dato'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    renderEditableField(null, 'farma_lista', 'Ninguno', 'clinica')
                                )}
                            </div>

                            {/* SECTION: SUPPLEMENTS */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Suplementación</h4>
                                {patientData.history?.supplements && patientData.history.supplements.length > 0 ? (
                                    <div className="space-y-2">
                                        {patientData.history.supplements.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start p-3 bg-emerald-50 rounded-xl text-sm border border-emerald-100">
                                                <div>
                                                    <div className="font-bold text-emerald-700">{item.name}</div>
                                                    <div className="text-xs text-emerald-600 mt-0.5">{item.frequency}</div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="inline-block px-2 py-0.5 bg-white rounded border border-emerald-200 text-[10px] font-bold text-emerald-400">
                                                        {item.duration || 'Sin dato'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    renderEditableField(null, 'suple_lista', 'Ninguno', 'clinica')
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TARJETA: ALERGIAS Y SEGURIDAD */}
                    <div id="card-allergy" className={`w-full bg-white p-6 rounded-2xl shadow-sm border border-rose-100 transition-all duration-300 ${(currentStep?.toLowerCase().includes('allergies') || currentStep?.toLowerCase().includes('phase_7_') || currentStep?.toLowerCase().includes('ph7_')) ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                        <CardHeader icon={AlertTriangle} title="Alergias y Seguridad" colorClass="text-rose-500"
                            onEdit={() => onTriggerEdit && onTriggerEdit('allergies')}
                            showEdit={true}
                        />
                        <div className="space-y-6">
                            {/* SECTION: FOOD ALLERGIES */}
                            <div>
                                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">Alimentos (Filtro Seguridad)</h4>
                                {patientData.history?.allergies?.food && patientData.history.allergies.food.length > 0 ? (
                                    <div className="space-y-2">
                                        {patientData.history.allergies.food.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-rose-50 rounded-xl text-sm border border-rose-100">
                                                <div>
                                                    <div className="font-bold text-rose-700">{item.agent}</div>
                                                    <div className="text-xs text-rose-600 mt-0.5">{item.reaction}</div>
                                                </div>
                                                <div>
                                                    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${item.severity === 'HIGH' ? 'bg-red-100 text-red-600 border-red-200' :
                                                        item.severity === 'MEDIUM' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                                                            'bg-slate-100 text-slate-500 border-slate-200'
                                                        }`}>
                                                        {severityMap[item.severity?.toUpperCase()] || item.severity || 'Pendiente'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-400 italic text-center border dashed border-slate-200">
                                        Niega alergias alimentarias
                                    </div>
                                )}
                            </div>

                            {/* SECTION: DRUG ALLERGIES */}
                            <div>
                                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">Medicamentos (Alerta Clínica)</h4>
                                {patientData.history?.allergies?.drug && patientData.history.allergies.drug.length > 0 ? (
                                    <div className="space-y-2">
                                        {patientData.history.allergies.drug.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded-xl text-sm border border-red-100">
                                                <div>
                                                    <div className="font-bold text-red-700">{item.agent}</div>
                                                    <div className="text-xs text-red-600 mt-0.5">{item.reaction}</div>
                                                </div>
                                                <div>
                                                    <span className="inline-block px-2 py-0.5 bg-red-600 text-white rounded border border-red-700 text-[10px] font-bold shadow-sm">
                                                        CRÍTICO
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-400 italic text-center border dashed border-slate-200">
                                        Niega alergias medicamentosas
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TARJETA: HÁBITOS Y TOXICOLOGÍA */}
                    <div id="card-habit" className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all duration-300 ${(currentStep?.toLowerCase().includes('habit') || currentStep?.toLowerCase().includes('phase_10_') || currentStep?.toLowerCase().includes('ph10_')) ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                        <CardHeader icon={Salad} title="Hábitos y Toxicología" colorClass="text-green-600"
                            onEdit={() => onTriggerEdit && onTriggerEdit('habits')}
                            showEdit={true}
                        />
                        <div className="space-y-4">
                            {/* 1. SAFETY ALERTS (INTERACTION ENGINE) */}
                            {patientData.safety?.interaction_flags?.length > 0 && (
                                <div className="mb-4 space-y-2">
                                    {patientData.safety.interaction_flags.map((flag, idx) => (
                                        <div key={idx} className={`p-3 rounded-lg border flex items-start gap-3 ${flag.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                                            <AlertTriangle className={`w-5 h-5 mt-0.5 ${flag.severity === 'CRITICAL' ? 'text-red-600' : 'text-orange-600'}`} />
                                            <div>
                                                <div className={`text-xs font-bold uppercase ${flag.severity === 'CRITICAL' ? 'text-red-700' : 'text-orange-700'}`}>
                                                    {flag.risk_code}
                                                </div>
                                                <div className={`text-sm ${flag.severity === 'CRITICAL' ? 'text-red-800' : 'text-orange-800'}`}>
                                                    {flag.user_message}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 2. TABACISMO */}
                            <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🚬</span>
                                    <div>
                                        <div className="text-sm font-bold text-slate-700">Tabaco / Vape</div>
                                        <div className="text-xs text-slate-500">
                                            {patientData.habits?.smoking?.is_smoker ? (
                                                `${smokingMap[patientData.habits.smoking.type?.toUpperCase()] || patientData.habits.smoking.type || 'Activo'} - ${patientData.habits.smoking.quantity_text || 'Detalle pendiente'}`
                                            ) : (
                                                patientData.habits?.smoking?.is_smoker === false ? 'Niega consumo' : 'Pendiente de evaluación'
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {patientData.habits?.smoking?.is_smoker && (
                                    <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded font-bold">ACTIVO</span>
                                )}
                            </div>

                            {/* 3. ALCOHOL */}
                            <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🍺</span>
                                    <div>
                                        <div className="text-sm font-bold text-slate-700">Alcohol</div>
                                        <div className="text-xs text-slate-500">
                                            {patientData.habits?.alcohol?.is_drinker ? (
                                                <>
                                                    {alcoholMap[patientData.habits.alcohol.preferred_drink?.toUpperCase()] || patientData.habits.alcohol.preferred_drink || 'Activo'} ({patientData.habits.alcohol.frequency_days || 0} días/sem)
                                                    <br />
                                                    <span className="text-slate-400">~{patientData.habits.alcohol.calculated_weekly_calories || 0} kcal/semanales</span>
                                                </>
                                            ) : (patientData.habits?.alcohol?.is_drinker === false ? 'Niega consumo' : 'Pendiente de evaluación')}
                                        </div>
                                    </div>
                                </div>
                                {patientData.habits?.alcohol?.is_drinker && patientData.habits.alcohol.calculated_weekly_calories > 1000 && (
                                    <span className="bg-yellow-100 text-yellow-750 text-[10px] px-2 py-0.5 rounded font-bold">ALTO CALÓRICO</span>
                                )}
                            </div>

                            {/* 4. DROGAS (CRITICAL) */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">💊</span>
                                    <div>
                                        <div className="text-sm font-bold text-slate-700">Recreativo / Tóxicos</div>
                                        <div className="text-xs text-slate-500">
                                            {patientData.habits?.drugs?.has_usage ? (
                                                `${patientData.habits.drugs.substance_name || 'Activo'} (${patientData.habits.drugs.frequency || 'Frecuencia pendiente'})`
                                            ) : (
                                                patientData.habits?.drugs?.has_usage === false ? 'Niega consumo' : 'Pendiente de evaluación'
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {patientData.habits?.drugs?.has_usage && (
                                    <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-bold border border-red-200">
                                        ALERTA
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Accordion>
        </div>
    );
};

export default TabRestrictions;
