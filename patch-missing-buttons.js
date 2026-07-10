const fs = require('fs');

const files = fs.readdirSync('client/src/components/interview').filter(f => f.startsWith('Fase') && f.endsWith('.jsx'));

let patchedCount = 0;

for (const file of files) {
    const filePath = `client/src/components/interview/${file}`;
    let content = fs.readFileSync(filePath, 'utf8');

    const errorDivRegex = /<div className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-full w-full text-slate-500 text-sm shadow-inner">\s*Por favor, seleccione una de las opciones desplegadas arriba\.\s*<\/div>/g;

    const errorDivRegex2 = /<div className="text-center p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-sm font-sansation">\s*Por favor, seleccione una de las opciones desplegadas arriba\.\s*<\/div>/g;


    if (errorDivRegex.test(content) || errorDivRegex2.test(content)) {
        console.log(`Patching ${file}...`);
        
        const replaceWith = `
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
                        </div>`;

        content = content.replace(errorDivRegex, replaceWith);
        content = content.replace(errorDivRegex2, replaceWith);
        fs.writeFileSync(filePath, content, 'utf8');
        patchedCount++;
    }
}

console.log(`Total fixed files: ${patchedCount}`);
