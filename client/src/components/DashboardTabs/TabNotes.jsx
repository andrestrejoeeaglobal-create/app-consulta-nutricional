import React from 'react';

export const TabNotes = ({
    patientData,
    setPatientData,
    isEditing,
    Accordion,
    openSections,
    toggleSection
}) => {
    return (
        <Accordion
            title="Notas de Evolución"
            id="accordion-notes"
            isOpen={openSections.childNotes}
            onToggle={() => toggleSection('childNotes')}
        >
            <div id="card-notes" className="space-y-4">
                <textarea
                    className="w-full h-64 p-5 rounded-2xl bg-tilo-bg-base/40 border border-tilo-border text-tilo-text-main placeholder-tilo-text-muted/50 focus:ring-2 focus:ring-tilo-primary/20 focus:border-tilo-primary outline-none transition-all resize-none text-sm font-sans disabled:opacity-70 disabled:cursor-not-allowed"
                    placeholder="Espacio para notas SOAP y Evolución..."
                    value={patientData?.notes || ''}
                    onChange={(e) => setPatientData && setPatientData(prev => ({
                        ...prev,
                        notes: e.target.value
                    }))}
                    disabled={!isEditing}
                />
            </div>
        </Accordion>
    );
};

export default TabNotes;
