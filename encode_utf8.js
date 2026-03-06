const fs = require('fs');
const filePath = 'client/src/hooks/useCortex.js';
const buffer = fs.readFileSync(filePath);
let content = '';
if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    content = buffer.toString('utf16le');
} else {
    // If it's already utf8 but ripgrep fails, maybe it has a BOM?
    content = buffer.toString('utf8');
}
fs.writeFileSync(filePath, content, 'utf8');
console.log('Converted to utf8.');
