const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'client', 'src', 'hooks', 'useCortex.js');
let content = fs.readFileSync(targetFile, 'utf8');

// Replace **${...}** with ${...}
// Also replace **${...}** if there are spaces, although usually it's strict.
// We'll replace `**${` with `${` and `}**` with `}`.
// Also we'll replace `** ` or ` **` if they somehow ended up there but mostly the user said "from variable names".
// Let's do a regex replacement:
// Replace \*\*\$\{([^}]+)\}\*\*  with \$\{\1\}
const regex1 = /\*\*\$\{([^}]+)\}\*\*/g;
content = content.replace(regex1, '${$1}');

// What if the bold is around a word and the variable? e.g. **Hola ${name}**  -> Hola ${name}
// The request was "removing bold syntax (**) from variable names".
// Let's also just replace all \*\* around ${...} even if not perfectly closed immediately?
// Actually just removing `**${` -> `${` and `}**` -> `}` is a good start.

// What if they just want ALL `**` removed from useCortex.js ?
// Originally: "removing bold syntax (**) from variable names, as originally intended before the file corruption occurred."
// In the PS script that corrupted it, the user probably did something like (Get-Content ...) -replace '\*\*\$\{(.+?)\}\*\*', '${1}' which messed up because of PowerShell $ expansion.

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Done replacing **${...}**');
