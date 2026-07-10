const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components/interview');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

let modifiedCount = 0;

files.forEach(file => {
    if (file === 'Fase1_Identificacion.jsx' || file === 'Fase2_Seguridad.jsx') return;

    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    let searchIdx = 0;
    let found = false;

    while (true) {
        let optionsStart = content.indexOf('{msg.options', searchIdx);
        if (optionsStart === -1) break;

        let braces = 0;
        let optionsEnd = -1;
        for (let i = optionsStart; i < content.length; i++) {
            if (content[i] === '{') braces++;
            else if (content[i] === '}') braces--;

            if (braces === 0) {
                optionsEnd = i;
                break;
            }
        }

        if (optionsEnd === -1) {
            searchIdx = optionsStart + 1;
            continue;
        }

        const optionsBlock = content.substring(optionsStart, optionsEnd + 1);

        let keyDivIdx = -1;
        for (let i = optionsStart; i >= 0; i--) {
            if (content.substring(i, i + 4) === '<div') {
                const tagContent = content.substring(i, i + 150);
                if (tagContent.includes('key={idx}') || tagContent.includes('key={i}')) {
                    keyDivIdx = i;
                    break;
                }
            }
        }

        if (keyDivIdx === -1) {
            searchIdx = optionsEnd + 1;
            continue;
        }

        const beforeDiv = content.substring(Math.max(0, keyDivIdx - 150), keyDivIdx);
        if (beforeDiv.includes('<React.Fragment') || beforeDiv.includes('<>')) {
            console.log(`Skipping extraction in ${file}: already has fragment wrapper.`);
            searchIdx = optionsEnd + 1;
            continue;
        }

        let divBraces = 0;
        let keyDivEnd = -1;
        for (let i = keyDivIdx; i < content.length; i++) {
            if (content.substring(i, i + 4) === '<div') divBraces++;
            else if (content.substring(i, i + 6) === '</div>') divBraces--;

            if (divBraces === 0 && i > keyDivIdx + 4) {
                keyDivEnd = i + 5;
                break;
            }
        }

        if (optionsEnd < keyDivIdx || optionsEnd > keyDivEnd) {
            searchIdx = optionsEnd + 1;
            continue;
        }

        let leadingSpace = 0;
        for (let i = optionsStart - 1; i >= 0; i--) {
            if (content[i] === ' ' || content[i] === '\t' || content[i] === '\n') leadingSpace++;
            else break;
        }
        
        // Remove options from inside
        let newContent = content.substring(0, optionsStart - leadingSpace) + "\n" + content.substring(optionsEnd + 1, keyDivEnd + 1);

        let modifiedOptionsBlock = optionsBlock;
        if (!modifiedOptionsBlock.includes('ml-[52px]') && !modifiedOptionsBlock.includes('ml-11') && !modifiedOptionsBlock.includes('justify-start')) {
             modifiedOptionsBlock = modifiedOptionsBlock.replace(/(className\s*=\s*["'][^"']*)(\bmt-\d+\b)/, "$1ml-[52px] justify-start $2");
        } else if (!modifiedOptionsBlock.includes('ml-[52px]') && !modifiedOptionsBlock.includes('ml-11')) {
            modifiedOptionsBlock = modifiedOptionsBlock.replace(/(className\s*=\s*["'][^"']*)(\bjustify-start\b)/, "$1ml-[52px] $2");
        }

        // Sometimes the key is `idx`, sometimes `i` depending on map variable
        newContent = newContent.replace(/key=\{idx\}\s*/, '');
        newContent = newContent.replace(/key=\{i\}\s*/, '');
        // In case they had it on the end
        newContent = newContent.replace(/\s*key=\{idx\}/, '');

        // Grab whichever key was used
        const keyVar = content.substring(keyDivIdx, keyDivIdx + 150).includes('key={idx}') ? 'idx' : 'i';

        const finalBlock = `<React.Fragment key={${keyVar}}>\n` + 
                           newContent.substring(keyDivIdx) + 
                           `\n\n{/* Botones Flotantes Fase 1 */}\n` +
                           `                                ` + modifiedOptionsBlock + 
                           `\n                            </React.Fragment>`;

        content = content.substring(0, keyDivIdx) + finalBlock + content.substring(keyDivEnd + 1);
        
        found = true;
        searchIdx = keyDivIdx + finalBlock.length;
        break; 
    }

    if (found && content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        modifiedCount++;
        console.log(`Successfully migrated options out of bubble for ${file}`);
    }
});

console.log(`Total migrated files: ${modifiedCount}`);
