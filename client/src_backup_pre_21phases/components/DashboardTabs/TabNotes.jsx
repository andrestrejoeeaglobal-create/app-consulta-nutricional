/* eslint-disable no-unused-vars */
import React from 'react';
import { FileText } from 'lucide-react';

export const TabNotes = ({ patientData, isEditing }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                        <FileText size={20} />
                    </div>
                    <h3 className="font-bold text-slate-700">Notas de Evolución</h3>
                </div>
                <div className="h-64 flex items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <span className="text-slate-400 text-sm">Espacio para notas SOAP y Evolución...</span>
                </div>
            </div>
        </div>
    );
};

export default TabNotes;
