const fs = require('fs');
const content = fs.readFileSync('client/src/hooks/useCortex.js', 'utf8');
const lines = content.split('\n');
const cases = lines.filter(line => line.includes('case \'PHASE_')).map(line => line.trim());
console.log(cases.join('\n'));
