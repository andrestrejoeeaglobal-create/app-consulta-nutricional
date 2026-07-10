const fs = require('fs');
let b = fs.readFileSync('client/src/components/interview/Fase5_EstiloVida.jsx', 'utf8');
b = b.replace("\\\\nimport SearchableVerticalMenu from '../ui/SearchableVerticalMenu';n\\\\n", "\\n");
fs.writeFileSync('client/src/components/interview/Fase5_EstiloVida.jsx', b, 'utf8');
