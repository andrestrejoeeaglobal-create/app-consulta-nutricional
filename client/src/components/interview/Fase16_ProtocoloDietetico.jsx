import React, { useState } from 'react';
import { Calculator, Settings, Check, UtensilsCrossed, AlertTriangle } from 'lucide-react';

const Fase16_ProtocoloDietetico = ({ onPhaseComplete }) => {
    const [tdee, setTdee] = useState('2200');
    const [target, setTarget] = useState('2000'); // Déficit por defecto

    // Macro split
    const [macros, setMacros] = useState({
        carbs: 40,
        protein: 30,
        fat: 30
    });

    const [constraints, setConstraints] = useState({
        fodmaps: false,
        shelfStable: false,
        noDairy: false,
        noGluten: false
    });

    const handleMacroChange = (type, value) => {
        const val = parseInt(value, 10) || 0;
        setMacros(prev => ({ ...prev, [type]: val }));
    };

    const totalMacros = macros.carbs + macros.protein + macros.fat;

    const toggleConstraint = (key) => {
        setConstraints(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="flex flex-col h-full bg-white relative p-6 overflow-y-auto custom-scrollbar font-sans border-r border-slate-200 shadow-sm">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                        <Calculator className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">
                        Protocolo Dietético
                    </h2>
                </div>
                <p className="text-sm text-slate-500">
                    Ajuste de Requerimientos Energéticos y Distribución de Macronutrientes.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Panel TDEE */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                        <UtensilsCrossed className="w-4 h-4" /> REQUERIMIENTO ENERGÉTICO
                    </h3>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500">TDEE Calculado (Gasto Energético Total) [kcal]</label>
                            <input
                                type="number"
                                value={tdee}
                                onChange={(e) => setTdee(e.target.value)}
                                className="p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500 bg-white shadow-inner font-mono font-bold text-slate-700"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-emerald-600">Prescripción Final (Déficit/Superávit) [kcal]</label>
                            <input
                                type="number"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="p-2 border-2 border-emerald-300 rounded-lg text-sm outline-none focus:border-emerald-500 bg-emerald-50 font-mono font-bold text-emerald-800"
                            />
                        </div>
                    </div>
                </div>

                {/* Panel Macros */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> DISTRIBUCIÓN DE MACRONUTRIENTES
                    </h3>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1 flex-1">
                                <label className="text-xs font-bold text-slate-500">Carbohidratos (%)</label>
                                <input
                                    type="number"
                                    value={macros.carbs}
                                    onChange={(e) => handleMacroChange('carbs', e.target.value)}
                                    className="p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 font-mono text-center"
                                />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                                <label className="text-xs font-bold text-slate-500">Proteínas (%)</label>
                                <input
                                    type="number"
                                    value={macros.protein}
                                    onChange={(e) => handleMacroChange('protein', e.target.value)}
                                    className="p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-red-500 font-mono text-center"
                                />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                                <label className="text-xs font-bold text-slate-500">Lípidos (%)</label>
                                <input
                                    type="number"
                                    value={macros.fat}
                                    onChange={(e) => handleMacroChange('fat', e.target.value)}
                                    className="p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-amber-500 font-mono text-center"
                                />
                            </div>
                        </div>

                        {/* Barra de Distribución */}
                        <div className="w-full h-3 flex overflow-hidden rounded-full mt-2 bg-slate-200">
                            <div style={{ width: `${(macros.carbs / totalMacros) * 100}%` }} className="bg-blue-500 transition-all"></div>
                            <div style={{ width: `${(macros.protein / totalMacros) * 100}%` }} className="bg-red-500 transition-all"></div>
                            <div style={{ width: `${(macros.fat / totalMacros) * 100}%` }} className="bg-amber-500 transition-all"></div>
                        </div>

                        <div className="flex justify-between items-center text-xs font-bold mt-1">
                            <span className={totalMacros === 100 ? 'text-green-600' : 'text-red-500'}>
                                Total: {totalMacros}%
                            </span>
                            {totalMacros !== 100 && (
                                <span className="text-red-500 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Debe sumar 100%
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Panel Restricciones Duras */}
            <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> RESTRICCIONES DURAS Y LOGÍSTICA
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => toggleConstraint('fodmaps')}
                        className={`p-3 rounded-lg border text-left text-sm font-bold flex items-center justify-between transition-colors ${constraints.fodmaps ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        Protocolo Bajo en FODMAPS
                        {constraints.fodmaps && <Check className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => toggleConstraint('shelfStable')}
                        className={`p-3 rounded-lg border text-left text-sm font-bold flex items-center justify-between transition-colors ${constraints.shelfStable ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        Logística 'Shelf Stable' (Viajes/Oficina)
                        {constraints.shelfStable && <Check className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => toggleConstraint('noDairy')}
                        className={`p-3 rounded-lg border text-left text-sm font-bold flex items-center justify-between transition-colors ${constraints.noDairy ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        Sin Lácteos
                        {constraints.noDairy && <Check className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => toggleConstraint('noGluten')}
                        className={`p-3 rounded-lg border text-left text-sm font-bold flex items-center justify-between transition-colors ${constraints.noGluten ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        Sin Gluten (Celiaquía/Sensibilidad)
                        {constraints.noGluten && <Check className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-slate-200">
                <button
                    onClick={() => {
                        // Aquí se inyectaría finalPatientData con Dieta
                        onPhaseComplete('PHASE_17_DASHBOARD_RENDER');
                    }}
                    disabled={totalMacros !== 100}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${totalMacros === 100
                        ? 'bg-black text-white hover:bg-slate-800 shadow-md transform hover:-translate-y-0.5'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        }`}
                >
                    CONSOLIDAR PLAN Y CERRAR CONSULTA MEDICA <span className="text-xl">✓</span>
                </button>
            </div>
        </div>
    );
};

export default Fase16_ProtocoloDietetico;
