const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components/interview');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

let modifiedCount = 0;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let original = fs.readFileSync(filePath, 'utf8');
    let content = original;

    // 2. REFACTOR THE INPUT ZONE
    let inputZoneStart = content.indexOf("{inputType === 'buttons'");
    if (inputZoneStart === -1) inputZoneStart = content.indexOf('{inputType === "buttons"');
    if (inputZoneStart === -1) inputZoneStart = content.indexOf("{messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].options ? (");
    if (inputZoneStart === -1) inputZoneStart = content.indexOf('{messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].options ? (');
    if (inputZoneStart === -1) inputZoneStart = content.indexOf("{ messages.length > 0 && messages[messages.length - 1].role === 'assistant'");

    if (inputZoneStart !== -1) {
        if (content.indexOf('SearchableVerticalMenu', inputZoneStart) > 0 && content.indexOf('SearchableVerticalMenu', inputZoneStart) < inputZoneStart + 500) {
            // Probably already patched successfully
        } else {
            let colonIdx = content.indexOf(') :', inputZoneStart);
            if (colonIdx === -1) colonIdx = content.indexOf('):', inputZoneStart);
            if (colonIdx === -1) colonIdx = content.indexOf(') : (internalStep', inputZoneStart);
            if (colonIdx === -1) colonIdx = content.indexOf('): (internalStep', inputZoneStart);
            if (colonIdx === -1) colonIdx = content.indexOf(') : ( internalStep', inputZoneStart);
            if (colonIdx === -1) colonIdx = content.indexOf(') : (', inputZoneStart);

            if (colonIdx !== -1) {
                let questionMarkIdx = content.indexOf('?', inputZoneStart);
                if (questionMarkIdx !== -1 && questionMarkIdx < colonIdx) {
                    let isLabelFirst = content.includes('handleSend(opt.label, opt.value)') || content.includes('handleSend(opt.label)');
                    let sendCallString = isLabelFirst ? 'handleSend(opt.label, opt.value);' : 'handleSend(opt.value, opt.label);';

                    const newVerticalButtons = `
                        messages[messages.length - 1].options.length > 3 ? (
                            <div className="w-full relative px-2 mb-2">
                                <SearchableVerticalMenu
                                    options={messages[messages.length - 1].options}
                                    onSelect={(selectedValue) => {
                                        const opt = messages[messages.length - 1].options.find(o => o.value === selectedValue);
                                        ${isLabelFirst ? 'handleSend(opt?.label || selectedValue, selectedValue);' : 'handleSend(selectedValue, opt?.label || selectedValue);'}
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
                                        ${sendCallString}
                                    }}
                                    disabled={typeof isAnalyzing !== 'undefined' ? isAnalyzing : false}
                                    className="w-full text-left px-5 py-4 rounded-xl border-2 border-slate-100 bg-white hover:border-tilo-primary hover:bg-slate-50 transition-all font-medium text-slate-700 shadow-sm disabled:opacity-50 uppercase"
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        )`;

                    content = content.substring(0, questionMarkIdx + 1) + 
                             newVerticalButtons + 
                             content.substring(colonIdx);
                }
            }
        }
    }

    if (content.indexOf('SearchableVerticalMenu') !== -1 && content.indexOf('import SearchableVerticalMenu') === -1) {
         let lastImport = content.lastIndexOf('import ');
         let lastImportEnd = content.indexOf('\\n', lastImport) !== -1 ? content.indexOf('\\n', lastImport) : content.indexOf('\\r\\n', lastImport);
         if (lastImportEnd === -1) lastImportEnd = content.indexOf(';', lastImport);
         if (lastImportEnd !== -1) {
              content = content.substring(0, lastImportEnd + 1) + "\\nimport SearchableVerticalMenu from '../ui/SearchableVerticalMenu';" + content.substring(lastImportEnd + 1);
         }
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        modifiedCount++;
        console.log("Successfully updated input zone UI for " + file);
    }
});

console.log("Total migrated input zones: " + modifiedCount);
