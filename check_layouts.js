const fs = require('fs');
const path = require('path');

const dir = 'client/src/components/interview';
const files = fs.readdirSync(dir).filter(f => f.startsWith('Fase') && f.endsWith('.jsx'));

for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const match = content.match(/return \(\s*(.*?)\s*(.*?)\s*(.*?)\s*/s);
    if (match) {
        console.log(`\n--- ${file} ---`);
        console.log(match[0].substring(0, 200));
    }
}
