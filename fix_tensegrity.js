const fs = require('fs');
const path = require('path');

const errors = [
    { file: 'src/hooks/useCortex.js', lines: [1067, 1093, 1120, 1142, 1177, 1200, 1314, 1391, 1482, 1498, 1528, 1559, 1698, 1736, 1824, 1925, 2036, 2266, 2275, 2389] },
    { file: 'src/components/interview/Fase1_Identificacion.jsx', lines: [134, 136, 167, 169, 195] },
    { file: 'src/components/interview/Fase3_MotivoConsulta.jsx', lines: [413] }
];

errors.forEach(({ file, lines }) => {
    const fullPath = path.join(__dirname, 'client', file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let contentLines = content.split('\n');

    lines.forEach(lineNum => {
        let lineIdx = lineNum - 1;
        let lineStr = contentLines[lineIdx];

        // Find string literal in the line
        // Simple heuristic: find content between ` ` or ' ' or " " that is long
        // Because JSX or JS might have multiple strings, we will look for string literals containing a period to insert the separator
        
        let match = lineStr.match(/(`|'|")(.*?)\1/);
        if (match) {
            let quote = match[1];
            let strContent = match[2];
            
            // If already has separator, skip
            if (strContent.includes('\\n\\n---\\n\\n')) return;
            
            if (strContent.length > 100) {
                // Find a good place to split: after a period and space
                let splitIdx = strContent.indexOf('. ');
                if (splitIdx !== -1 && splitIdx < strContent.length - 2) {
                    let newStrContent = strContent.substring(0, splitIdx + 1) + '\\n\\n---\\n\\n' + strContent.substring(splitIdx + 1).trim();
                    let newStr = quote + newStrContent + quote;
                    contentLines[lineIdx] = lineStr.replace(match[0], newStr);
                    console.log(`Fixed ${file}:${lineNum}`);
                } else {
                    // Try ? or ! or just add it in the middle
                    let splitIdx = strContent.indexOf('? ');
                    if (splitIdx !== -1 && splitIdx < strContent.length - 2) {
                        let newStrContent = strContent.substring(0, splitIdx + 1) + '\\n\\n---\\n\\n' + strContent.substring(splitIdx + 1).trim();
                        let newStr = quote + newStrContent + quote;
                        contentLines[lineIdx] = lineStr.replace(match[0], newStr);
                        console.log(`Fixed ${file}:${lineNum}`);
                    } else {
                         // Insert in middle at first space
                         let mid = Math.floor(strContent.length / 2);
                         let spaceIdx = strContent.indexOf(' ', mid);
                         if (spaceIdx === -1) spaceIdx = mid;
                         let newStrContent = strContent.substring(0, spaceIdx) + '\\n\\n---\\n\\n' + strContent.substring(spaceIdx).trim();
                         let newStr = quote + newStrContent + quote;
                         contentLines[lineIdx] = lineStr.replace(match[0], newStr);
                         console.log(`Fallback fixed ${file}:${lineNum}`);
                    }
                }
            }
        }
    });

    fs.writeFileSync(fullPath, contentLines.join('\n'));
});
