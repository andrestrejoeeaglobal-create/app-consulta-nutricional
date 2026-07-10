const fs = require('fs');
let b = fs.readFileSync('client/src/components/interview/Fase5_EstiloVida.jsx', 'utf8');

let optStart = b.indexOf("{msg.options && msg.role === 'assistant'");
if (optStart !== -1) {
    let optEnd = b.indexOf(')}', optStart);
    if (optEnd !== -1) {
        // Find closing fragment
        let fragmentEnd = b.indexOf('</React.Fragment>', optEnd);
        if (fragmentEnd !== -1) {
            b = b.substring(0, optStart) + b.substring(fragmentEnd);
        }
    }
}

// 2. Replace the input form
let formStart = b.indexOf('<form');
if (formStart !== -1) {
    let innerContent = `
                    {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].options ? (
                        messages[messages.length - 1].options.length > 3 ? (
                            <div className="w-full relative px-2 mb-2">
                                <SearchableVerticalMenu
                                    options={messages[messages.length - 1].options}
                                    onSelect={(selectedValue) => {
                                        const opt = messages[messages.length - 1].options.find(o => o.value === selectedValue);
                                        handleSend(opt?.label || selectedValue, selectedValue);
                                    }}
                                    embedded={true}
                                />
                            </div>
                        ) : (
                        <div className="flex flex-col gap-2 w-full px-2 mb-2">
                            {messages[messages.length - 1].options.map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleSend(opt.label, opt.value);
                                    }}
                                    disabled={typeof isAnalyzing !== 'undefined' ? isAnalyzing : false}
                                    className="w-full text-left px-5 py-4 rounded-xl border-2 border-slate-100 bg-white hover:border-tilo-primary hover:bg-slate-50 transition-all font-medium text-slate-700 shadow-sm disabled:opacity-50 uppercase"
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        )
                    ) : (
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
                            className="max-w-2xl mx-auto flex gap-3 relative w-full"
                        >
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Escriba su respuesta..."
                                className="flex-1 px-5 py-4 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1C75BC] focus:bg-white transition-all font-sansation text-slate-700 shadow-sm disabled:opacity-50 disabled:bg-gray-100"
                                disabled={isInputDisabled}
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim() || isInputDisabled}
                                className="px-6 py-4 bg-[#1C75BC] text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center min-w-[60px]"
                            >
                                <i className="fi fi-rr-paper-plane text-xl"></i>
                            </button>
                        </form>
                    )}
`;
    // Find the end of the form
    let formEnd = b.indexOf('</form>', formStart) + 7;
    b = b.substring(0, formStart) + innerContent + b.substring(formEnd);
}

// Ensure import
if (b.indexOf('SearchableVerticalMenu') !== -1 && b.indexOf('import SearchableVerticalMenu') === -1) {
    b = "import SearchableVerticalMenu from '../ui/SearchableVerticalMenu';\n" + b;
}

fs.writeFileSync('client/src/components/interview/Fase5_EstiloVida.jsx', b, 'utf8');
console.log('Fixed Fase5');
