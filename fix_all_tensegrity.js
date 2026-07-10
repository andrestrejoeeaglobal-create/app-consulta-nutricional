const fs = require('fs');
const path = require('path');

const filesToCheck = [
    'src/hooks/useCortex.js',
    'src/components/interview/Fase1_Identificacion.jsx',
    'src/components/interview/Fase2_Seguridad.jsx',
    'src/components/interview/Fase3_MotivoConsulta.jsx'
];

const stringRegex = /(content:\s*|responseMsg\s*=\s*)([`"'])((?:(?=(\\?))\4.)*?)\2/g;

filesToCheck.forEach(file => {
    const fullPath = path.join(__dirname, 'client', file);
    if (!fs.existsSync(fullPath)) return;

    let code = fs.readFileSync(fullPath, 'utf8');
    let hasChanges = false;
    let match;
    
    // We can't replace while iterating easily with exec, so let's collect matches first
    const matches = [];
    while ((match = stringRegex.exec(code)) !== null) {
        matches.push({
            fullMatch: match[0],
            prefix: match[1],
            quote: match[2],
            content: match[3],
            index: match.index,
            length: match[0].length
        });
    }

    // Replace from end to start to avoid index shifting
    for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        const unescaped = m.content.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\`/g, "`");
        
        if (unescaped.length > 120) {
            const hasDivider = unescaped.includes('\n\n---\n\n') || 
                               unescaped.includes('ui_divider') || 
                               unescaped.includes('<UiDivider');
            
            if (!hasDivider) {
                // Find a good place to split: period space or newline
                let splitIdx = m.content.indexOf('\\n\\n');
                if (splitIdx === -1) splitIdx = m.content.indexOf('. ');
                if (splitIdx === -1) splitIdx = m.content.indexOf('? ');
                
                let newContent;
                if (splitIdx !== -1 && splitIdx < m.content.length - 4) {
                    if (m.content.substr(splitIdx, 4) === '\\n\\n') {
                        newContent = m.content.substring(0, splitIdx) + '\\n\\n---\\n\\n' + m.content.substring(splitIdx + 4).trim();
                    } else {
                        newContent = m.content.substring(0, splitIdx + 1) + '\\n\\n---\\n\\n' + m.content.substring(splitIdx + 1).trim();
                    }
                } else {
                    // split in middle
                    let mid = Math.floor(m.content.length / 2);
                    let spaceIdx = m.content.indexOf(' ', mid);
                    if (spaceIdx === -1) spaceIdx = mid;
                    newContent = m.content.substring(0, spaceIdx) + '\\n\\n---\\n\\n' + m.content.substring(spaceIdx).trim();
                }
                
                const newFullStr = m.prefix + m.quote + newContent + m.quote;
                code = code.substring(0, m.index) + newFullStr + code.substring(m.index + m.length);
                hasChanges = true;
            }
        }
    }

    if (hasChanges) {
        fs.writeFileSync(fullPath, code);
        console.log(`Fixed ${file}`);
    }
});
