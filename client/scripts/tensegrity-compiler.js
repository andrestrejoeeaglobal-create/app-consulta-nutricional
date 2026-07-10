import fs from 'fs';
import path from 'path';

// Define the files to check
const filesToCheck = [
    'src/hooks/useCortex.js',
    'src/components/interview/Fase1_Identificacion.jsx',
    'src/components/interview/Fase2_Seguridad.jsx',
    'src/components/interview/Fase3_MotivoConsulta.jsx'
];

let hasErrors = false;

// Simple regex parser to find string assignments to 'content:' or 'responseMsg ='
// We capture strings within backticks, double quotes, or single quotes.
const stringRegex = /(?:content:\s*|responseMsg\s*=\s*)([`"'])((?:(?=(\\?))\3.)*?)\1/g;

console.log('🛡️ [TENSEGRIDAD] Ejecutando análisis de compilación condicionada...');

filesToCheck.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) {
        console.warn(`[TENSEGRIDAD] Archivo no encontrado: ${file}`);
        return;
    }

    const code = fs.readFileSync(fullPath, 'utf8');
    
    let match;
    while ((match = stringRegex.exec(code)) !== null) {
        const fullMatch = match[0];
        const stringContent = match[2];
        
        // Remove escape characters to get the real length of the text
        const unescaped = stringContent.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\`/g, "`");
        
        if (unescaped.length > 120) {
            const hasDivider = unescaped.includes('\n\n---\n\n') || 
                               unescaped.includes('ui_divider') || 
                               unescaped.includes('<UiDivider');
            
            if (!hasDivider) {
                hasErrors = true;
                // Obtenemos la línea donde ocurrió la falla
                const index = match.index;
                const lines = code.substring(0, index).split('\n');
                const lineNum = lines.length;

                console.error(`\n❌ ERROR DE TENSEGRIDAD en ${file}:${lineNum}`);
                console.error(`   Bloque monolítico detectado (>120 chars) sin token de separación visual (ui_divider o \\n\\n---\\n\\n).`);
                console.error(`   Fragmento infractor: "${unescaped.substring(0, 60).replace(/\n/g, ' ')}..."`);
                console.error(`   Longitud detectada: ${unescaped.length} caracteres.`);
            }
        }
    }
});

if (hasErrors) {
    console.error('\n🚫 COMPILACIÓN RECHAZADA: La regla estricta de Tensegridad ha sido violada. El despliegue se ha detenido.');
    process.exit(1);
} else {
    console.log('✅ Verificación de Tensegridad superada. Procediendo con el despliegue...\n');
}
