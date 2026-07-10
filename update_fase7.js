const fs = require('fs');
const path = 'client/src/components/interview/Fase7_Habitos.jsx';
let content = fs.readFileSync(path, 'utf8');

// Remove msg.options from inside chat messages
content = content.replace(/\{msg\.options && msg\.sender === 'bot' && index === messages\.length - 1 && \([\s\S]*?\)\}/, '');

const oldInputAreaRegex = /\{\/\*\s*Input Area\s*\*\/\}\s*<div className="flex-shrink-0 p-4 bg-white border-t border-gray-200">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*$/m;

const newInputArea = `{/* Input Area */}
                <div className="p-6 bg-white border-t border-slate-100 relative z-[60] w-full shrink-0">
                    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center">
                        {getCurrentOptions()?.length > 3 && (
                            <SearchableVerticalMenu
                                options={getCurrentOptions()}
                                onSelect={(val) => handleOptionSelect(val)}
                            />
                        )}
                        
                        {getCurrentOptions()?.length > 0 && getCurrentOptions()?.length <= 3 && (
                            <div className="flex flex-col gap-2 mb-3 w-full">
                                {getCurrentOptions().map((opt, oIdx) => (
                                    <button
                                        key={oIdx}
                                        onClick={() => handleOptionSelect(opt.value)}
                                        className="w-full px-5 py-3 bg-white border-2 border-blue-100 text-slate-700 text-sm font-medium rounded-xl hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all flex items-center justify-between group"
                                    >
                                        <span>{opt.label}</span>
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0 ml-3">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <form
                            onSubmit={(e) => { e.preventDefault(); handleInput(inputValue); }}
                            className="flex items-center gap-3 w-full bg-slate-50 p-2 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-inner relative z-10"
                        >
                            <input
                                type={hasInputTypeNumber() ? "number" : "text"}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Escriba aquí..."
                                className="flex-1 bg-transparent border-none focus:ring-0 px-6 text-sm py-2 outline-none disabled:opacity-50"
                                disabled={!!getCurrentOptions()}
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim() || !!getCurrentOptions()}
                                className="w-10 h-10 bg-[#1C75BC] text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform hover:bg-[#155a8a] disabled:opacity-50 flex-shrink-0"
                            >
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                    <div className="text-center mt-3 text-xs text-gray-400 font-sansation flex items-center justify-center gap-2">
                        <i className="fi fi-rr-shield-check"></i>
                        Terminal A - Comunicación Clínica Encriptada Extremo a Extremo
                    </div>
                </div>
            </div>
        </div>
    );
};
`;

content = content.replace(/\{\/\* Input Area \*\/\}\s*<div className="flex-shrink-0 p-4 bg-white border-t border-gray-200">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*$/m, newInputArea);

fs.writeFileSync(path, content, 'utf8');
console.log('Fase7_Habitos updated');
