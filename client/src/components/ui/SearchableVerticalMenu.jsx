import React, { useState } from 'react';

const SearchableVerticalMenu = ({ options, onSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="absolute bottom-[calc(100%+12px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-50 flex flex-col overflow-hidden max-h-96 tilo-searchable-menu animate-in slide-in-from-bottom-2 duration-300">
            <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0">
                <input
                    type="text"
                    placeholder="Buscar opción..."
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="overflow-y-auto flex-1 p-1">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((option, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={(e) => { e.preventDefault(); onSelect(option.value); }}
                            className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 hover:text-blue-700 transition-colors rounded-lg mb-1 last:mb-0 cursor-pointer"
                        >
                            {option.label}
                        </button>
                    ))
                ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                        No se encontraron opciones
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchableVerticalMenu;
