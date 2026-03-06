// Helper to render the genetic map
const MemberRow = ({ label, data }) => (
    <div className="bg-white border border-slate-100 p-5 rounded-[32px] flex items-center justify-between shadow-sm hover:border-blue-100 transition-all">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#1C75BC] flex items-center justify-center font-bold text-[10px] uppercase font-prototype leading-none text-center">
                {label.substring(0, 4)}
            </div>
            <span className="text-[11px] font-bold text-slate-700 font-prototype uppercase tracking-tight">{label}</span>
        </div>
        <div className="flex gap-1.5">
            {data.diabetes && <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-black" title="Diabetes">D</div>}
            {data.hypertension && <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-[10px] text-white font-black" title="Presión">P</div>}
            {data.cancer && <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-[10px] text-white font-black animate-pulse" title="Cáncer">C</div>}
            {data.obesity && <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-white font-black" title="Obesidad">O</div>}
            {data.renal && <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-[10px] text-white font-black" title="Renal">R</div>}
            {!data.diabetes && !data.hypertension && !data.cancer && !data.obesity && !data.renal && <span className="text-[9px] text-slate-300 font-bold uppercase italic tracking-widest font-sansation">Sin reporte</span>}
        </div>
    </div>
);
import React from 'react';
import { Dna, Activity, Utensils, AlertTriangle, FlaskConical, Salad } from 'lucide-react';
import EspejoClinicoActivo from '../interview/EspejoClinicoActivo';

export const TabClinicalHistory = ({
    patientData,
    // eslint-disable-next-line no-unused-vars
    setPatientData,
    // eslint-disable-next-line no-unused-vars
    isEditing,
    onTriggerEdit,
    renderEditableField,
    // eslint-disable-next-line no-unused-vars
    CardHeader,
    // eslint-disable-next-line no-unused-vars
    Accordion,
    openSections,
    toggleSection,
    currentStep,
    // eslint-disable-next-line no-unused-vars
    TAG_CONFIG,
    fase3State,
    fase4State,
    pendingAlerts,
    // eslint-disable-next-line no-unused-vars
    metabolicAxis
}) => {
    return (
        <div className="space-y-6" >
            {/* --- ACORDEÓN PADRE 2: HISTORIA CLÍNICA --- */}
            < Accordion
                title="Historia Clínica"
                id="accordion-clinical-parent"
                isOpen={openSections.parentClinical}
                onToggle={() => toggleSection('parentClinical')}
                variant="parent"
            >
                <div className="space-y-6">

                    {/* --- ALERTAS TEMPRANAS PASIVAS (DEL GENOMA TILO) --- */}
                    {pendingAlerts?.length > 0 && (
                        <div className="mb-2 space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-3 h-3" /> Monitoreo Analítico Pasivo
                            </h4>
                            {pendingAlerts.map(alert => (
                                <div key={alert.id} className="p-4 bg-[#FFFBEB] border border-amber-200 rounded-2xl flex items-start gap-4 shadow-sm animate-in zoom-in duration-300">
                                    <div className="bg-amber-100 p-2 rounded-full text-amber-600 border border-amber-200 shrink-0">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider font-prototype">{alert.type || 'ALERTA TILO CORTEX'}</h4>
                                        <p className="text-sm text-amber-900 mt-1 font-medium leading-relaxed max-w-lg">{alert.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* --- HIJO 0: Motivo de Consulta --- */}
                    <Accordion
                        title="Motivo de Consulta"
                        id="accordion-motivo"
                        isOpen={openSections.childMotive}
                        onToggle={() => toggleSection('childMotive')}
                    >
                        <EspejoClinicoActivo fase3State={fase3State} finalizeGoal={fase3State?.finalizeGoal} patientData={patientData} />
                    </Accordion>

                    {/* --- HIJO 1: AHF (Heredofamiliares) --- */}
                    <Accordion
                        title="Antecedentes Heredofamiliares"
                        id="accordion-ahf"
                        isOpen={openSections.childAhf}
                        onToggle={() => toggleSection('childAhf')}
                    >
                        <div id="card-ahf" className={`bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden transition-all duration-300 ${currentStep?.includes('ahf_') || currentStep?.includes('PHASE_4_') ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                            <CardHeader icon={Dna} title="Heredofamiliares" colorClass="text-indigo-500"
                                onEdit={() => onTriggerEdit && onTriggerEdit('ahf')}
                                showEdit={true}
                            />
                            {fase4State ? (
                                <div className="px-4 pb-4 pt-2 space-y-6">
                                    <div className="flex justify-center">
                                        <div className={`px-10 py-3.5 rounded-full shadow-sm text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-4 transition-all border font-prototype bg-[#1C75BC] text-white border-[#155a8a]`}>
                                            MAPA GENÉTICO PROFESIONAL
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <MemberRow label="Padres" data={fase4State.parents} />
                                        <MemberRow label="Abuelos Mat" data={fase4State.grandparentsMaternal} />
                                        <MemberRow label="Abuelos Pat" data={fase4State.grandparentsPaternal} />
                                        <MemberRow label="Hermanos" data={fase4State.siblings} />
                                    </div>

                                    {fase4State.alert_detected && (
                                        <div className="p-8 rounded-[40px] border-2 border-pink-400 bg-pink-50 shadow-xl relative overflow-hidden font-prototype mt-4">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 text-pink-900"></div>
                                            <h4 className="text-xs font-black text-pink-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 italic">
                                                <AlertTriangle size={20} /> Carga Genética de Riesgo
                                            </h4>
                                            <p className="text-sm text-pink-800 leading-relaxed font-sansation font-medium">
                                                Antecedentes oncológicos detectados. El plan priorizará compuestos **anti-inflamatorios y quimiopreventivos** para blindar su salud metabólica.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (patientData.history?.family_history?.length > 0 || patientData.history?.family_structured?.length > 0) ? (
                                <div className="space-y-2">
                                    {patientData.history?.family_history?.map((item, idx) => (
                                        <div key={`fh-${idx}`} className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl text-sm border border-indigo-100">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-indigo-700 uppercase p-0 m-0 leading-tight">
                                                    {item.condition}
                                                </span>
                                                <span className="text-[10px] text-indigo-400 font-semibold tracking-wide">
                                                    PARENTESCO: {item.relative}
                                                </span>
                                            </div>
                                            <div className="h-2 w-2 rounded-full bg-indigo-400"></div>
                                        </div>
                                    ))}
                                    {patientData.history?.family_structured?.map((item, idx) => (
                                        <div key={`fs-${idx}`} className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl text-sm border border-indigo-100">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-indigo-700 uppercase p-0 m-0 leading-tight">
                                                    {item.condition_category === 'OTHER' ? item.specific_condition : item.condition_category}
                                                </span>
                                                <span className="text-[10px] text-indigo-400 font-semibold tracking-wide">
                                                    {item.source === 'CHECKLIST' ? 'NORMATIVA NOM-004' : 'REPORTE LIBRE'}
                                                </span>
                                            </div>
                                            <div className="h-2 w-2 rounded-full bg-indigo-400"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                patientData.history?.family_raw_text ? (
                                    <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium border border-slate-200 text-sm italic">
                                        "{patientData.history.family_raw_text}"
                                    </div>
                                ) : (
                                    renderEditableField('Antecedentes', 'ahf_lista', 'Niega', 'clinica')
                                )
                            )}
                        </div>
                    </Accordion>

                    {/* --- HIJO 2: APP (Patológicos Personales) --- */}
                    <Accordion
                        title="Antecedentes Patológicos"
                        id="accordion-app"
                        isOpen={openSections.childApp}
                        onToggle={() => toggleSection('childApp')}
                    >
                        <div id="card-app" className={`bg-white p-6 rounded-2xl shadow-sm border border-amber-100 relative overflow-hidden transition-all duration-300 ${currentStep?.includes('app_') || currentStep?.includes('ph5_') ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                            <CardHeader icon={Activity} title="Patológicos Personales" colorClass="text-amber-500"
                                onEdit={() => onTriggerEdit && onTriggerEdit('app')}
                                showEdit={true}
                            />
                            <div className="space-y-3 relative z-10">
                                {patientData.history?.personal_structured && patientData.history.personal_structured.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {patientData.history.personal_structured.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-amber-50 rounded-xl text-sm border border-amber-100 w-full">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-amber-700 uppercase p-0 m-0 leading-tight">
                                                        {item.specific_condition === 'PENDING' ? item.condition_category : item.specific_condition}
                                                    </span>
                                                    <span className="text-[10px] text-amber-400 font-semibold tracking-wide">
                                                        {item.source === 'CHECKLIST' ? 'NORMATIVA NOM-004' : 'REPORTE LIBRE'}
                                                    </span>
                                                </div>
                                                <div className="h-2 w-2 rounded-full bg-amber-400"></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    patientData.history?.personal_raw_text ? (
                                        <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium border border-slate-200 text-sm italic">
                                            "{patientData.history.personal_raw_text}"
                                            <div className="mt-2 flex justify-end">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200">
                                                    REPORTE LIBRE
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        renderEditableField('Patologías', 'app_lista', 'Niega', 'clinica')
                                    )
                                )}
                            </div>
                        </div>
                    </Accordion>

                    {/* --- HIJO 3: FARMACOLOGÍA Y SUPLEMENTACIÓN --- */}
                    <Accordion
                        title="Farmacología y Suplementación"
                        id="accordion-farma"
                        isOpen={openSections.childFarma}
                        onToggle={() => toggleSection('childFarma')}
                    >
                        <div id="card-meds" className={`bg-white p-6 rounded-2xl shadow-sm border border-purple-100 transition-all duration-300 ${currentStep?.includes('meds_') || currentStep?.includes('supp_') ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                            <CardHeader icon={FlaskConical} title="Farmacología y Suplementación" colorClass="text-purple-500"
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
                                                <div key={idx} className="flex justify-between items-start p-3 bg-purple-50 rounded-xl text-sm border border-purple-100">
                                                    <div>
                                                        <div className="font-bold text-purple-700">{item.name}</div>
                                                        <div className="text-xs text-purple-600 mt-0.5">{item.dose_frequency}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="inline-block px-2 py-0.5 bg-white rounded border border-purple-200 text-[10px] font-bold text-purple-400">
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
                    </Accordion>

                    {/* --- HIJO 4: ALERGIAS Y SEGURIDAD --- */}
                    <Accordion
                        title="Alergias y Seguridad"
                        id="accordion-allergies"
                        isOpen={openSections.childAllergies}
                        onToggle={() => toggleSection('childAllergies')}
                    >
                        <div id="card-allergy" className={`w-full bg-white p-6 rounded-2xl shadow-sm border border-rose-100 transition-all duration-300 ${currentStep?.includes('allergies_') ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                            <CardHeader icon={AlertTriangle} title="Alergias y Seguridad" colorClass="text-rose-500"
                                onEdit={() => onTriggerEdit && onTriggerEdit('allergies')}
                                showEdit={true}
                            />
                            <div className="space-y-6">
                                {/* SECTION: FOOD ALLERGIES */}
                                <div>
                                    <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">Alimentos (Filtro Seguridad)</h4>
                                    {patientData.allergies?.food && patientData.allergies.food.length > 0 ? (
                                        <div className="space-y-2">
                                            {patientData.allergies.food.map((item, idx) => (
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
                                                            {item.severity || 'PENDING'}
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
                                    {patientData.allergies?.drug && patientData.allergies.drug.length > 0 ? (
                                        <div className="space-y-2">
                                            {patientData.allergies.drug.map((item, idx) => (
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
                    </Accordion>

                    {/* --- HIJO 5: DIGESTIVO --- */}
                    <Accordion
                        title="Digestivo"
                        id="accordion-digestive"
                        isOpen={openSections.childDigestive}
                        onToggle={() => toggleSection('childDigestive')}
                    >
                        <div id="card-digestive" className={`w-full bg-white p-6 rounded-2xl shadow-sm border border-orange-100 transition-all duration-300 ${currentStep?.includes('digestive_') ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                            <CardHeader icon={Utensils} title="Digestivo" colorClass="text-orange-500"
                                onEdit={() => onTriggerEdit && onTriggerEdit('digestive')}
                                showEdit={true}
                            />
                            {patientData.digestive_profile?.has_issues ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-600">Fenotipo:</span>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${patientData.digestive_profile.phenotype === 'CONSTIPATION' ? 'bg-orange-100 text-orange-600' :
                                            patientData.digestive_profile.phenotype === 'BLOATING' ? 'bg-yellow-100 text-yellow-700' :
                                                patientData.digestive_profile.phenotype === 'DIARRHEA' ? 'bg-red-100 text-red-600' :
                                                    'bg-purple-100 text-purple-600'
                                            }`}>
                                            {patientData.digestive_profile.phenotype}
                                        </span>
                                    </div>
                                    {patientData.digestive_profile.details && Object.keys(patientData.digestive_profile.details).length > 0 && (
                                        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-100">
                                            <strong>Detalle Clínico:</strong><br />
                                            {Object.entries(patientData.digestive_profile.details).map(([k, v]) => (
                                                <div key={k} className="mt-1 flex justify-between">
                                                    <span className="capitalize text-slate-500">{k.replace('digestive_', '').replace('_', ' ')}:</span>
                                                    <span className="font-medium text-slate-700">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {patientData.digestive_profile.alarm_symptoms && patientData.digestive_profile.alarm_symptoms.length > 0 && (
                                        <div className="p-3 bg-red-50 rounded-lg border border-red-100 animate-pulse">
                                            <div className="flex items-center gap-2 mb-1">
                                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                                <span className="text-xs font-bold text-red-700 uppercase">Signos de Alarma</span>
                                            </div>
                                            <ul className="list-disc list-inside text-[10px] text-red-600 font-medium">
                                                {patientData.digestive_profile.alarm_symptoms.map(s => (
                                                    <li key={s}>{s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {patientData.digestive_profile.ai_analysis?.raw_text && (
                                        <div className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">
                                            " {patientData.digestive_profile.ai_analysis.raw_text} "
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <span className="inline-block px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold border border-green-100">
                                        EUBIOSIS (Sin hallazgos) 🌿
                                    </span>
                                </div>
                            )}
                        </div>
                    </Accordion>

                    {/* --- HIJO 6: ESTADO FISIOLÓGICO (Condicional) --- */}
                    {patientData?.profile?.sex === 'Femenino' && (
                        <Accordion
                            title="Estado Fisiológico"
                            id="accordion-physio"
                            isOpen={openSections.childPhysio}
                            onToggle={() => toggleSection('childPhysio')}
                        >
                            <div id="card-physio" className={`w-full bg-white p-6 rounded-2xl shadow-sm border border-pink-100 transition-all duration-300 ${currentStep?.includes('physio_') ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                                <CardHeader icon={Activity} title="Estado Fisiológico (Mujer)" colorClass="text-pink-500"
                                    onEdit={() => onTriggerEdit && onTriggerEdit('physio')}
                                    showEdit={true}
                                />
                                <div className="space-y-4">
                                    {renderEditableField('Último Periodo / Menstruación', 'menstruation_cycle', '--', 'clinical', false, 'dashboard-data-text')}
                                    {renderEditableField('Embarazo / Lactancia', 'pregnancy_status', '--', 'clinical', false, 'dashboard-data-text')}
                                </div>
                            </div>
                        </Accordion>
                    )}

                    {/* --- HIJO 7: HÁBITOS Y TOXICOLOGÍA --- */}
                    <Accordion
                        title="Hábitos y Toxicología"
                        id="accordion-habits"
                        isOpen={openSections.childHabits}
                        onToggle={() => toggleSection('childHabits')}
                    >
                        <div id="card-habit" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
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
                                                {patientData.habits?.smoking?.is_smoker ?
                                                    `${patientData.habits.smoking.type} - ${patientData.habits.smoking.quantity_text}` :
                                                    'Niega consumo'}
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
                                                        {patientData.habits.alcohol.preferred_drink} ({patientData.habits.alcohol.frequency_days} días/sem)
                                                        <br />
                                                        <span className="text-slate-400">~{patientData.habits.alcohol.calculated_weekly_calories} kcal/semanales</span>
                                                    </>
                                                ) : 'Niega consumo'}
                                            </div>
                                        </div>
                                    </div>
                                    {patientData.habits?.alcohol?.is_drinker && patientData.habits.alcohol.calculated_weekly_calories > 1000 && (
                                        <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded font-bold">ALTO CALÓRICO</span>
                                    )}
                                </div>

                                {/* 4. DROGAS (CRITICAL) */}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">💊</span>
                                        <div>
                                            <div className="text-sm font-bold text-slate-700">Recreativo / Tóxicos</div>
                                            <div className="text-xs text-slate-500">
                                                {patientData.habits?.drugs?.has_usage ?
                                                    `${patientData.habits.drugs.substance_name} (${patientData.habits.drugs.frequency})` :
                                                    'Niega consumo'}
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
                    </Accordion>
                </div>
            </Accordion >
        </div >
    );
};

export default TabClinicalHistory;
