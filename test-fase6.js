const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components/interview');
const file = 'Fase6_Farmacologia.jsx';
const filePath = path.join(dir, file);
let content = fs.readFileSync(filePath, 'utf8');
let original = content;

// Replace <div key={idx} ...
// find the options
let optionsStart = content.indexOf('{msg.options');
// Balance braces
let braces = 0;
let optionsEnd = -1;
for (let i = optionsStart; i < content.length; i++) {
    if (content[i] === '{') braces++;
    else if (content[i] === '}') braces--;
    if (braces === 0) { optionsEnd = i; break; }
}

let keyDivIdx = -1;
for (let i = optionsStart; i >= 0; i--) {
    if (content.substring(i, i + 4) === '<div') {
        const tagContent = content.substring(i, i + 150);
        if (tagContent.includes('key={idx}')) {
            keyDivIdx = i;
            break;
        }
    }
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

console.log('keyDivEnd', keyDivEnd);

if (optionsEnd >= keyDivIdx && optionsEnd <= keyDivEnd) {
    let leadingSpace = 0;
    for (let i = optionsStart - 1; i >= 0; i--) {
        if (content[i] === ' ' || content[i] === '\t' || content[i] === '\n') leadingSpace++;
        else break;
    }
    
    let newContent = content.substring(0, optionsStart - leadingSpace) + "\n" + content.substring(optionsEnd + 1, keyDivEnd + 1);

    const optionsBlock = content.substring(optionsStart, optionsEnd + 1);
    let modifiedOptionsBlock = optionsBlock;
    if (!modifiedOptionsBlock.includes('ml-[52px]') && !modifiedOptionsBlock.includes('ml-[48px]')) {
         modifiedOptionsBlock = modifiedOptionsBlock.replace(/(className\s*=\s*["'][^"']*)(\bmt-\d+\b)/, "$1ml-[52px] $2");
    }

    newContent = newContent.replace(/key=\{idx\}\s*/, '');

    const finalBlock = `<React.Fragment key={idx}>\n` + 
                       newContent.substring(keyDivIdx) + 
                       `\n\n{/* Botones Flotantes Fase 1 */}\n` +
                       `                                ` + modifiedOptionsBlock + 
                       `\n                            </React.Fragment>`;

    content = content.substring(0, keyDivIdx) + finalBlock + content.substring(keyDivEnd + 1);
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Successfully patched Fase6!');
    }
} else {
    console.log('Validation failed', optionsEnd, keyDivIdx, keyDivEnd);
}
