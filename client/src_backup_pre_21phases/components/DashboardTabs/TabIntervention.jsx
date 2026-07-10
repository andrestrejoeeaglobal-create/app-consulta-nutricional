/* eslint-disable no-unused-vars */
import React from 'react';
import { Clipboard as PrescriptionBoard } from 'lucide-react';

export const TabIntervention = ({ patientData, isEditing }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
                        <PrescriptionBoard size={20} />
                    </div>
                    <h3 className="font-bold text-slate-700">Plan de Intervención</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-teal-50 rounded-xl border border-teal-100">
                        <h4 className="font-bold text-teal-800 text-sm mb-2">Diagnóstico Nutricional</h4>
                        <p className="text-xs text-teal-600">PES: Problema, Etiología, Signos/Síntomas...</p>
                    </div>
                    <div className="p-4 bg-teal-50 rounded-xl border border-teal-100">
                        <h4 className="font-bold text-teal-800 text-sm mb-2">Prescripción Dietética</h4>
                        <p className="text-xs text-teal-600">Cálculo de Requerimientos...</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TabIntervention;
