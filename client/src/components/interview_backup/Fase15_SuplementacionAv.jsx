import React, { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Check, X, Edit2, AlertTriangle, Pill } from 'lucide-react';

// MOCK DATA: Sugerencias del Cortex 33Plus y 34Plus
const mockSuggestions = [
    {
        id: 'sup_1',
        cortex: '34Plus (Metabólico)',
        name: 'Inulina de Agave',
        dosage: '10g al día',
        timing: 'En ayuno con agua natural',
        rationale: 'Modulación de microbiota y mejora en sensibilidad a la insulina.',
        status: 'pending' // pending | approved | rejected | adjusted
    },
    {
        id: 'sup_2',
        cortex: '33Plus (Neuro-cognitivo)',
        name: 'L-Teanina + Extracto de Té Verde',
        dosage: '200mg',
        timing: 'Por la mañana',
        rationale: 'Neuroprotección y control de picos de cortisol inducidos por estrés.',
        status: 'pending'
    },
    {
        id: 'sup_3',
        cortex: '34Plus (Celular)',
        name: 'Picolinato de Cromo',
        dosage: '200mcg',
        timing: 'Con la comida principal',
        rationale: 'Manejo de picos glucémicos postprandiales (Evidencia NOM-043).',
        status: 'pending'
    }
];

const Fase15_SuplementacionAv = ({ onPhaseComplete, setPatientData }) => {
    const [suggestions, setSuggestions] = useState(mockSuggestions);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ dosage: '', timing: '' });

    const handleAction = (id, action) => {
        setSuggestions(prev => prev.map(s =>
            s.id === id ? { ...s, status: action } : s
        ));
    };

    const handleEditSave = (id) => {
        setSuggestions(prev => prev.map(s =>
            s.id === id ? { ...s, status: 'approved', dosage: editForm.dosage, timing: editForm.timing } : s
        ));
        setEditingId(null);
    };

    const allResolved = suggestions.every(s => s.status !== 'pending' && s.status !== 'adjusting');

    return (
        <div className="flex flex-col h-full bg-white relative p-6 overflow-y-auto custom-scrollbar font-sans border-r border-slate-200 shadow-sm">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <Shield className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">
                        Protocolo de Suplementación (33Plus / 34Plus)
                    </h2>
                </div>
                <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-200 mt-4">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-amber-800 tracking-tight">CANDADO LEGAL REQUERIDO (COFEPRIS / NOM-004)</p>
                        <p className="text-xs text-amber-700 mt-1">
                            La IA actúa únicamente como herramienta de soporte a la decisión clínica. Usted debe aprobar, rechazar o ajustar cada sugerencia propuesta antes de que sea integrada al Plan de Acción del paciente.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 flex-1">
                <AnimatePresence>
                    {suggestions.map((suggestion) => (
                        <motion.div
                            key={suggestion.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`border rounded-xl p-4 transition-all ${suggestion.status === 'approved' ? 'bg-green-50 border-green-200' :
                                suggestion.status === 'rejected' ? 'bg-red-50 border-red-200 opacity-60' :
                                    'bg-white border-slate-200 shadow-sm'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
                                        MOTOR: {suggestion.cortex}
                                    </span>
                                    <h3 className="text-base font-bold text-slate-800 mt-2 flex items-center gap-2">
                                        <Pill className="w-4 h-4 text-slate-400" />
                                        {suggestion.name}
                                    </h3>
                                </div>

                                {suggestion.status !== 'pending' && suggestion.status !== 'adjusting' && (
                                    <div className={`px-3 py-1 text-xs font-bold rounded-full ${suggestion.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {suggestion.status === 'approved' ? '✓ APROBADO' : '✕ RECHAZADO'}
                                    </div>
                                )}
                            </div>

                            {editingId === suggestion.id ? (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 mb-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500">Dosis Ajustada:</label>
                                        <input
                                            type="text"
                                            value={editForm.dosage}
                                            onChange={(e) => setEditForm({ ...editForm, dosage: e.target.value })}
                                            className="p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500">Indicación / Horario:</label>
                                        <input
                                            type="text"
                                            value={editForm.timing}
                                            onChange={(e) => setEditForm({ ...editForm, timing: e.target.value })}
                                            className="p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-200 rounded hover:bg-slate-300"
                                        >
                                            CANCELAR
                                        </button>
                                        <button
                                            onClick={() => handleEditSave(suggestion.id)}
                                            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700"
                                        >
                                            GUARDAR AJUSTE
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-slate-600 space-y-1 mb-4">
                                    <p><span className="font-semibold">Dosis:</span> {suggestion.dosage}</p>
                                    <p><span className="font-semibold">Indicación:</span> {suggestion.timing}</p>
                                    <p className="text-xs text-slate-500 mt-2 italic bg-slate-50 p-2 rounded">🧠 Racional: {suggestion.rationale}</p>
                                </div>
                            )}

                            {suggestion.status === 'pending' && editingId !== suggestion.id && (
                                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                    <button
                                        onClick={() => handleAction(suggestion.id, 'approved')}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        <Check className="w-4 h-4" /> APROBAR
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingId(suggestion.id);
                                            setEditForm({ dosage: suggestion.dosage, timing: suggestion.timing });
                                        }}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" /> AJUSTAR
                                    </button>
                                    <button
                                        onClick={() => handleAction(suggestion.id, 'rejected')}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-700 border border-slate-200 hover:border-red-200 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        <X className="w-4 h-4" /> RECHAZAR
                                    </button>
                                </div>
                            )}

                            {suggestion.status !== 'pending' && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => handleAction(suggestion.id, 'pending')}
                                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline"
                                    >
                                        Deshacer Selección
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-200">
                <button
                    onClick={() => {
                        if (setPatientData) {
                            setPatientData(prev => ({
                                ...prev,
                                advanced_supplementation: suggestions.filter(s => s.status === 'approved')
                            }));
                        }
                        onPhaseComplete('PHASE_16_DIETARY_PROTOCOL');
                    }}
                    disabled={!allResolved}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${allResolved
                        ? 'bg-black text-white hover:bg-slate-800 shadow-md transform hover:-translate-y-0.5'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        }`}
                >
                    {allResolved ? (
                        <>CONTINUAR A PROTOCOLO DIETÉTICO <span className="text-xl">→</span></>
                    ) : (
                        <>REVISE TODAS LAS SUGERENCIAS PARA CONTINUAR</>
                    )}
                </button>
            </div>
        </div>
    );
};

export default Fase15_SuplementacionAv;
