const fs = require('fs');
const files = [
  'client/src/hooks/useCortex.js',
  'client/src/components/interview/Fase1_Identificacion.jsx',
  'client/src/components/interview/Fase2_Seguridad.jsx',
  'client/src/components/interview/Fase3_MotivoConsulta.jsx'
];

files.forEach(f => {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    const c = l.match(/content:\s*["`']([^"`']+)["`']/);
    if(c && c[1].length > 120 && !c[1].includes('\\n\\n') && !c[1].includes('\n\n')) {
      console.log(`${f}:${i+1}: ${c[1].substring(0, 50)}... (len: ${c[1].length})`);
    }
  });
});
