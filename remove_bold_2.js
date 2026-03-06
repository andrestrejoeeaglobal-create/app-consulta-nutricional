const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'client', 'src', 'hooks', 'useCortex.js');
let content = fs.readFileSync(targetFile, 'utf8');

// Replace `**${...}**` even with multiple variables inside like `**${foo} - ${bar}**`
// We can use a non-greedy wildcard to find anything starting with **${ and ending with }**
// But wait, what if it matches from the FIRST **${ to the LAST }** on the line?
// Better: match `\*\*` that are followed by `${` or precede `}`.
// Instead, just remove `**` if the whole string inside starts with `${` and ends with `}`.
const regex2 = /\*\*(\$\{[^}]+\}(?:.*?\$\{[^}]+\})*)\*\*/g;
// That matches: `**`, then `${...}`, then maybe other stuff ending in `${...}`, then `**`.
content = content.replace(regex2, '$1');

// Also removing things like `** ¿Es usted el paciente titular mencionado arriba? **` ? 
// No, the original prompt was "removing bold syntax (**) from variable names". I will ONLY target ** wraps around variables.

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Done replacing ** around compound variables');
