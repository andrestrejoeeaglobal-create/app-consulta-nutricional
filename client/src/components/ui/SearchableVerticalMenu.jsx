import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const SearchableVerticalMenu = ({ 
    options, 
    onSelect, 
    searchQuery: externalSearchQuery, 
    setSearchQuery: externalSetSearchQuery,
    placeholder = "Escriba para buscar o seleccione una opción...",
    emptyMessage = "No se encontraron resultados para la búsqueda.",
    isMedicamentoSearch = false
}) => {
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const [asyncOptions, setAsyncOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
    const setSearchQuery = externalSetSearchQuery !== undefined ? externalSetSearchQuery : setLocalSearchQuery;

    const query = searchQuery.trim();

    // Búsqueda asíncrona predictiva con debounce de 300ms y longitud mínima de 3 caracteres
    useEffect(() => {
        if (!isMedicamentoSearch) {
            setAsyncOptions([]);
            setIsLoading(false);
            return;
        }

        const trimmed = searchQuery.trim();
        if (trimmed.length < 3) {
            setAsyncOptions([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const res = await fetch(`${apiUrl}/api/cortex/searchMedication?q=${encodeURIComponent(trimmed)}`);
                if (res.ok) {
                    const data = await res.json();
                    setAsyncOptions(data);
                } else {
                    setAsyncOptions([]);
                }
            } catch (err) {
                console.error("⚠️ Error en búsqueda predictiva de Vademécum:", err);
                setAsyncOptions([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, isMedicamentoSearch]);

    // 1. Filtrar las opciones del Vademécum (Local o Asíncrono)
    const matchedOptions = isMedicamentoSearch && query.length >= 3
        ? asyncOptions
        : options.filter(option => {
            if (!query) return true;
            const lowerLabel = option.label.toLowerCase();
            const lowerQuery = query.toLowerCase();
            
            return lowerLabel.startsWith(lowerQuery) || 
                   lowerLabel.includes(' ' + lowerQuery) ||
                   lowerLabel.includes('/' + lowerQuery) ||
                   lowerLabel.includes('-' + lowerQuery);
        });

    // 2. Construir la lista final de sugerencias
    const finalOptions = [];

    // Si el usuario ha escrito algo, agregar la opción dinámica de registro manual al inicio
    if (query !== '') {
        // Verificar si hay una coincidencia exacta para no duplicar
        const hasExactMatch = (isMedicamentoSearch && query.length >= 3 ? asyncOptions : options).some(opt => opt.value.toLowerCase() === query.toLowerCase());
        if (!hasExactMatch) {
            finalOptions.push({
                label: `✍️ Registrar "${searchQuery}"`,
                value: searchQuery,
                isCustom: true
            });
        }
    }

    // Agregar las opciones filtradas
    finalOptions.push(...matchedOptions);

    // Helper para resaltar la coincidencia (negrita inversa como Google Autocomplete: texto ingresado normal, el resto negrita)
    const renderBoldedLabel = (label, search) => {
        if (!search) return <span className="font-medium text-slate-700">{label}</span>;
        
        const lowerLabel = label.toLowerCase();
        const lowerSearch = search.toLowerCase();
        
        let matchIdx = -1;
        if (lowerLabel.startsWith(lowerSearch)) {
            matchIdx = 0;
        } else {
            const prefixes = [' ', '/', '-', '('];
            for (const prefix of prefixes) {
                const idx = lowerLabel.indexOf(prefix + lowerSearch);
                if (idx !== -1) {
                    matchIdx = idx + 1; // Saltar el prefijo
                    break;
                }
            }
        }
        
        if (matchIdx === -1) {
            matchIdx = lowerLabel.indexOf(lowerSearch);
        }
        
        if (matchIdx === -1) {
            return <span className="font-medium text-slate-500">{label}</span>;
        }
        
        const textBefore = label.substring(0, matchIdx);
        const textMatched = label.substring(matchIdx, matchIdx + search.length);
        const textAfter = label.substring(matchIdx + search.length);
        
        return (
            <span className="font-medium">
                {textBefore && <span className="text-slate-500">{textBefore}</span>}
                <span className="text-slate-500">{textMatched}</span>
                {textAfter && <strong className="font-black text-slate-900 bg-blue-50/50 px-0.5 rounded">{textAfter}</strong>}
            </span>
        );
    };

    return (
        <div className="absolute bottom-[calc(100%+12px)] left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-96 tilo-searchable-menu animate-in slide-in-from-bottom-2 duration-300">
            {/* Input de Búsqueda Estilo Premium */}
            <div className="p-3 border-b border-slate-100 bg-slate-50 shrink-0 flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                <input
                    type="text"
                    placeholder={placeholder}
                    className="w-full text-sm bg-transparent outline-none border-none text-slate-800 placeholder-slate-400 font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                />
            </div>
            
            {/* Loader Asíncrono */}
            {isLoading && (
                <div className="px-4 py-2.5 bg-blue-50/40 text-[11px] text-blue-600 font-bold flex items-center gap-2 border-b border-slate-100 shrink-0 animate-pulse">
                    <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Buscando en Vademécum Inteligente...</span>
                </div>
            )}
            
            {/* Contenedor de Sugerencias Predictivas */}
            <div className="overflow-y-auto flex-1 p-1.5 custom-scrollbar">
                {finalOptions.length > 0 ? (
                    finalOptions.map((option, idx) => {
                        const isCustom = option.isCustom;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={(e) => { 
                                    e.preventDefault(); 
                                    onSelect(option.value); 
                                }}
                                className={`w-full text-left px-4 py-3 text-sm transition-all rounded-xl mb-1 last:mb-0 cursor-pointer flex items-center gap-3 ${
                                    isCustom 
                                        ? 'bg-blue-50/70 hover:bg-blue-100/90 text-blue-700 hover:text-blue-800 border border-dashed border-blue-200 shadow-sm' 
                                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-blue-700'
                                }`}
                            >
                                {/* Icono de Búsqueda Predictiva */}
                                {isCustom ? (
                                    <span className="text-base shrink-0">✍️</span>
                                ) : (
                                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:text-blue-500" />
                                )}
                                
                                {/* Etiqueta con Coincidencia en Negrita */}
                                <div className="flex-1 truncate">
                                    {isCustom ? (
                                        <span className="font-semibold">{option.label}</span>
                                    ) : (
                                        renderBoldedLabel(option.label, query)
                                    )}
                                </div>
                            </button>
                        );
                    })
                ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
                        <span className="text-xl">🔍</span>
                        <span>{emptyMessage}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchableVerticalMenu;
