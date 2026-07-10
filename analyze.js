const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components/interview');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Replace button class names where options are rendered 
    // Usually mapped as msg.options.map 
    // And containing button classes
    
    // We will find the button inside msg.options.map
    // And replace its className with the Fase 1 standard
    const standardClass = 'px-4 py-2 bg-slate-50 border border-slate-200 text-[#1C75BC] text-sm rounded-full shadow-sm hover:bg-[#1C75BC] hover:text-white hover:border-[#1C75BC] transition-colors';
    
    // Replace different button classes inside the map
    // Look for <button ... className="..."
    // It's a bit tricky with regex, let's just do it manually for known patterns if regex is too risky
    
    // Actually, let's fix the summary lists: 
    // Patterns like: summaryBlock += `* **Fórmulas Aprobadas:** ${approvedCount}\n`;
    // Should become: summaryBlock += `\n\n- **Fórmulas Aprobadas:** ${approvedCount}`;
    // Or: summaryBlock += `* Fármacos Activos: ...\n* Suplementos:`
    
    // Let's print out all files that have "* " or "- " in summaryBlock
    const lines = content.split('\n');
    let hasChanges = false;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.includes('summaryBlock') && (line.includes('*') || line.includes('- '))) {
            // Found a summary block line. 
            // We'll just print it for now to analyze.
            console.log(`File: ${file}:${i}`);
            console.log(line);
        }
    }
});
