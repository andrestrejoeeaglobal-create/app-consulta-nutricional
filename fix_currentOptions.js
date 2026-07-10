const fs = require('fs');

const files = [
  'Fase9_EstadoFisiologico.jsx', 'Fase10_Habitos.jsx', 'Fase11_ActividadYSueno.jsx'
];

let modifiedCount = 0;

for (let f of files) {
  let file = 'client/src/components/interview/' + f;
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf8');
  let originalText = text;

  // Find the messages.map and insert the Fragment logically
  let mapIdx = text.indexOf('messages.map((msg, index) => {');
  let isIMap = false;
  let idxVar = 'index';
  
  if (mapIdx === -1) {
       mapIdx = text.indexOf('messages.map((msg, i) => {');
       if (mapIdx !== -1) idxVar = 'i';
  }
  
  if (mapIdx !== -1 && !text.includes('ml-[52px] mt-3 flex flex-wrap gap-2')) {
      let returnStart = text.indexOf('return (', mapIdx);
      if (returnStart !== -1) {
          let parens = 0;
          let returnEnd = -1;
          for (let i = returnStart + 7; i < text.length; i++) {
              if (text[i] === '(') parens++;
              else if (text[i] === ')') parens--;
              
              if (parens === 0) {
                  returnEnd = i;
                  break;
              }
          }
          
          if (returnEnd !== -1) {
              let returnBlock = text.substring(returnStart + 8, returnEnd);
              
              // We should remove the options from inside the return block first
              // Looking for `{isBot && index === messages.length - 1 && currentOptions.length > 0 && (`
              // Or similar
              const optionsRegex = /\{isBot[^}]*currentOptions\.length > 0 && \([\s\S]*?(?=\}\s*<\/div>\s*<\/div>\s*<\/div>)/;
              if (optionsRegex.test(returnBlock)) {
                  // We remove the options from inside the bubble
                  returnBlock = returnBlock.replace(/\{isBot[^}]*currentOptions\.length > 0 && \([\s\S]*?(?=\}\s*<\/div>\s*<\/div>)/, '');
              } else {
                  // Just replace any standard options block found inside
                  returnBlock = returnBlock.replace(/\{isBot && index === messages\.length - 1 && currentOptions\.length > 0 && \(\s*<div className="mt-4 flex flex-wrap gap-2">[\s\S]*?<\/div>\s*\)\}/g, '');
                  returnBlock = returnBlock.replace(/\{isBot && i === messages\.length - 1 && currentOptions\.length > 0 && \(\s*<div className="mt-4 flex flex-wrap gap-2">[\s\S]*?<\/div>\s*\)\}/g, '');
              }

              returnBlock = returnBlock.replace(`key={${idxVar}}`, '');
              
              const buttonsBlock = `
                            {isBot && ${idxVar} === messages.length - 1 && currentOptions.length > 0 && (
                                <div className="ml-[52px] mt-3 flex flex-wrap gap-2 justify-start mb-6">
                                    {currentOptions.map((opt, oIdx) => (
                                        <button
                                            key={oIdx}
                                            onClick={() => handleOptionSelect(opt.value)}
                                            className="px-4 py-2 bg-slate-50 border border-slate-200 text-[#1C75BC] text-sm rounded-full shadow-sm hover:bg-[#1C75BC] hover:text-white hover:border-[#1C75BC] transition-colors"
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}`;
                            
              let newReturnBlock = `\n<React.Fragment key={${idxVar}}>${returnBlock}${buttonsBlock}</React.Fragment>\n`;
              
              text = text.substring(0, returnStart + 8) + newReturnBlock + text.substring(returnEnd);
          }
      }
  }

  if (text !== originalText) {
    fs.writeFileSync(file, text, 'utf8');
    modifiedCount++;
    console.log(`Updated ${f}`);
  }
}
console.log(`Modified ${modifiedCount} files.`);
