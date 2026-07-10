import React from 'react';
import { FlaskConical } from 'lucide-react';

export const TabBiochemicals = ({
    isProcessing,
    displayData,
    handleFileUpload,
    selectedFileToView,
    setSelectedFileToView,
    processedDocs,
    analyzeStatus
}) => {

    const renderModalContent = () => {
        if (!selectedFileToView) return null;
        const docData = processedDocs[selectedFileToView.name];
        if (!docData) return null;

        const hasAnyAlert = docData.isGrouped && Object.values(docData.findings).some(rows => rows.some(r => analyzeStatus(r.value, r.ref) !== 'normal'));

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 font-sans">
                    <div className="bg-[#1e293b] p-5 flex justify-between items-center text-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg">
                                <span className="text-xl">🧪</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg tracking-wide">{docData.title}</h3>
                                <div className="flex gap-3 text-xs opacity-80 mt-1">
                                    <span className="flex items-center gap-1">👤 {docData.patient}</span>
                                    <span>|</span>
                                    <span className="bg-blue-500/20 px-2 rounded border border-blue-500/30">IA VERIFIED</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedFileToView(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-xl">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-6 custom-scrollbar">
                        {!hasAnyAlert && (
                            <div className="p-8 text-center bg-white rounded-xl border border-green-200 shadow-sm">
                                <div className="text-4xl mb-2">🌿</div>
                                <h3 className="text-green-700 font-bold">Sin hallazgos patológicos</h3>
                                <p className="text-green-600 text-sm">Todo en orden.</p>
                            </div>
                        )}
                        {docData.isGrouped && Object.entries(docData.findings).map(([section, rows], idx) => {
                            const abnormalRows = rows.filter(row => analyzeStatus(row.value, row.ref) !== 'normal');
                            if (abnormalRows.length === 0) return null;
                            return (
                                <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-red-50 px-6 py-3 border-b border-red-100 flex justify-between items-center">
                                        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> {section}
                                        </h4>
                                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold border border-red-200">{abnormalRows.length} ALERTAS</span>
                                    </div>
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-slate-50">
                                            {abnormalRows.map((row, rIdx) => {
                                                const status = analyzeStatus(row.value, row.ref);
                                                return (
                                                    <tr key={rIdx} className="hover:bg-red-50/10 transition-colors">
                                                        <td className="px-6 py-3 font-medium text-slate-600 w-[40%]">{row.label}</td>
                                                        <td className="px-6 py-3 font-bold text-slate-800 text-base">{row.value}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            {status.includes('critical') ?
                                                                <span className="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm">CRÍTICO</span> :
                                                                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${status === 'high' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{status === 'high' ? 'ALTO ⬆' : 'BAJO ⬇'}</span>
                                                            }
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-400 text-xs text-right font-mono">{row.ref}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6" id="card-lab">
            <div className="bg-white rounded-2xl border border-blue-500 ring-4 ring-blue-50 shadow-md overflow-hidden">
                <div className="p-4 border-b border-blue-100 bg-blue-50">
                    <h4 className="font-bold text-blue-800 flex items-center gap-2 text-sm"><FlaskConical size={16} /> Procesador de Docs Bio-Cuánticos</h4>
                </div>
                <div className="p-6">
                    <label className={`flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all mb-6 bg-white ${isProcessing ? 'border-blue-400 bg-blue-50/30' : 'border-blue-200 hover:border-blue-400 hover:shadow-inner'}`}>
                        <div className="flex flex-col items-center justify-center">
                            <span className={`text-4xl mb-3 ${isProcessing ? 'animate-spin' : ''}`}>{isProcessing ? '⚙️' : '☁️'}</span>
                            <p className="text-sm font-bold text-slate-700">{isProcessing ? 'Procesando Inteligencia...' : 'Arrastra o Clic para Subir'}</p>
                            <span className="text-xs text-slate-400 mt-2">Soporta PDF, HTML Cuánticos</span>
                        </div>
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isProcessing} multiple />
                    </label>

                    <div className="space-y-2">
                        {displayData?.files?.map((file, idx) => (
                            <div key={idx} onClick={() => setSelectedFileToView(file)} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 shadow-sm transition-colors">
                                <span className="text-xl">{file.icon}</span>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-700">{file.name}</p>
                                    <p className="text-[10px] text-slate-400">{file.date} - {file.status}</p>
                                </div>
                                <span className="text-xs text-blue-600 font-bold">Ver ➔</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {renderModalContent()}
        </div>
    );
};

export default TabBiochemicals;
