const fs = require('fs');
const file = 'c:/Users/andre/App de consulta nutricional/client/src/hooks/useCortex.js';
let content = fs.readFileSync(file, 'utf8');

const helperStr = `
const applyV621Protocol = (text, patientData, isTriage = false, forceTutor = false) => {
    if (!text || typeof text !== 'string') return text;
    if (text.includes('<binary_gate_execution>')) return text;

    const age = patientData.profile?.age || patientData.identificacion?.edad || 30;
    const sex = patientData.profile?.sex || patientData.identificacion?.sexo || 'M';

    const parts = text.split('\\n\\n');
    let p1 = parts.length > 1 ? parts[0] : '';
    let p2 = parts.length > 1 ? parts.slice(1).join('\\n\\n') : text;

    let target = age >= 18 ? 'Adulto' : (age >= 12 && !forceTutor ? 'Adolescente' : 'Tutor');
    let gender = sex && sex.toLowerCase().startsWith('f') ? 'F' : 'M';
    let triageMode = isTriage ? 'Activo' : 'Inactivo';

    let formattedP1 = p1;
    if (target === 'Tutor' || forceTutor) {
        if (formattedP1 && !formattedP1.includes('[Triangulación Legal Activa')) {
            formattedP1 = '[Triangulación Legal Activa: Consentimiento Tutor] ' + formattedP1;
        } else if (!formattedP1) {
            formattedP1 = '[Triangulación Legal Activa: Consentimiento Tutor] Confirmación de autoridad.';
        }
    }

    let out = '<binary_gate_execution>\\n';
    if (formattedP1) out += 'P1: ' + formattedP1 + '\\n\\nP2: ' + p2 + '\\n\\n';
    else out += 'P2: ' + p2 + '\\n\\n';

    out += '<meta>\\nuser_target: ' + target + '\\ngender_lock: ' + gender + '\\n';
    out += 'triage_mode: ' + triageMode + '\\n</meta>\\n</binary_gate_execution>';
    return out;
};
`;

if (!content.includes('applyV621Protocol')) {
    content = content.replace(
        /(const \[messages,\s*setMessages\]\s*=\s*useState.*?;)/,
        '$1' + '\\n\\n    ' + helperStr
    );
}

// Extract Phase 3 block
const startDelimiter = "// =============== FASE 3: MOTIVO DE CONSULTA ===============";
let startIndex = content.indexOf(startDelimiter);
let endIndex = content.indexOf("case 'PHASE_4", startIndex);
if (endIndex === -1) {
    endIndex = content.indexOf("// ==========================================================", startIndex + 100);
}

if (startIndex === -1 || endIndex === -1) {
    console.log("Could not find delimiters");
    process.exit(1);
}

let phase3Block = content.substring(startIndex, endIndex);

// Using a regular expression to match the content assignment inside setMessages
// Match: content: [something up to next key] or }
// We want to avoid modifying things that are already wrapped.
const contentRegex = /content\s*:\s*([\s\S]*?),\s*(avatar|inputType|options|role)\s*:/g;
phase3Block = phase3Block.replace(contentRegex, (match, valStr, nextKey) => {
    // Trim the valStr safely to see if it's already wrapped
    const trimmed = valStr.trim();
    if (trimmed.startsWith('applyV621Protocol')) {
        return match; // Already wrapped
    }
    return 'content: applyV621Protocol(' + trimmed + ', patientData), ' + nextKey + ':';
});

// Also there might be a content property right before }
const contentEndRegex = /content\s*:\s*([\s\S]*?)\s*\}/g;
phase3Block = phase3Block.replace(contentEndRegex, (match, valStr) => {
    const trimmed = valStr.trim();
    if (trimmed.startsWith('applyV621Protocol')) {
        return match;
    }
    return 'content: applyV621Protocol(' + trimmed + ', patientData) }';
});

content = content.substring(0, startIndex) + phase3Block + content.substring(endIndex);

fs.writeFileSync(file, content, 'utf8');
console.log('Done!');
