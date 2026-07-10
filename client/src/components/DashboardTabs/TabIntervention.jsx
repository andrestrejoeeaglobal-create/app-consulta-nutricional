import React from 'react';

export const TabIntervention = ({
    patientData,
    setPatientData,
    isEditing,
    Accordion,
    openSections,
    toggleSection
}) => {
    return (
        <Accordion
            title="Plan de Intervención"
            id="accordion-intervention"
            isOpen={openSections.childInterventionPlan}
            onToggle={() => toggleSection('childInterventionPlan')}
        >
            <div id="card-intervention" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Diagnóstico Nutricional */}
                <div className="p-5 bg-tilo-bg-base/40 rounded-2xl border border-tilo-border">
                    <h4 className="font-extrabold text-tilo-text-main text-xs uppercase tracking-wider mb-2">
                        Diagnóstico Nutricional
                    </h4>
                    {isEditing ? (
                        <textarea
                            className="w-full h-32 p-3 rounded-xl bg-tilo-bg-panel border border-tilo-border text-tilo-text-main placeholder-tilo-text-muted/50 focus:ring-2 focus:ring-tilo-primary/20 focus:border-tilo-primary outline-none transition-all resize-none text-xs"
                            placeholder="PES: Problema, Etiología, Signos/Síntomas..."
                            value={patientData?.nutrition?.intervention?.diagnosis || ''}
                            onChange={(e) => setPatientData && setPatientData(prev => {
                                const nutrition = prev?.nutrition || {};
                                const intervention = nutrition.intervention || {};
                                return {
                                    ...prev,
                                    nutrition: {
                                        ...nutrition,
                                        intervention: {
                                            ...intervention,
                                            diagnosis: e.target.value
                                        }
                                    }
                                };
                            })}
                        />
                    ) : (
                        <p className="text-xs text-tilo-text-muted leading-relaxed whitespace-pre-wrap">
                            {patientData?.nutrition?.intervention?.diagnosis || 'PES: Problema, Etiología, Signos/Síntomas...'}
                        </p>
                    )}
                </div>

                {/* Prescripción Dietética */}
                <div className="p-5 bg-tilo-bg-base/40 rounded-2xl border border-tilo-border">
                    <h4 className="font-extrabold text-tilo-text-main text-xs uppercase tracking-wider mb-2">
                        Prescripción Dietética
                    </h4>
                    {isEditing ? (
                        <textarea
                            className="w-full h-32 p-3 rounded-xl bg-tilo-bg-panel border border-tilo-border text-tilo-text-main placeholder-tilo-text-muted/50 focus:ring-2 focus:ring-tilo-primary/20 focus:border-tilo-primary outline-none transition-all resize-none text-xs"
                            placeholder="Cálculo de Requerimientos..."
                            value={patientData?.nutrition?.intervention?.prescription || ''}
                            onChange={(e) => setPatientData && setPatientData(prev => {
                                const nutrition = prev?.nutrition || {};
                                const intervention = nutrition.intervention || {};
                                return {
                                    ...prev,
                                    nutrition: {
                                        ...nutrition,
                                        intervention: {
                                            ...intervention,
                                            prescription: e.target.value
                                        }
                                    }
                                };
                            })}
                        />
                    ) : (
                        <p className="text-xs text-tilo-text-muted leading-relaxed whitespace-pre-wrap">
                            {patientData?.nutrition?.intervention?.prescription || 'Cálculo de Requerimientos...'}
                        </p>
                    )}
                </div>
            </div>
        </Accordion>
    );
};

export default TabIntervention;
