const fs = require('fs');
const file = 'c:/Users/andre/App de consulta nutricional/client/src/hooks/useCortex.js';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `
                    if (rejectionRegex.test(text)) {
                        finalAnchor = "Resolución Técnica del Síntoma Primario";
                        setFase3State(prev => ({ ...prev, emotional_anchor: finalAnchor }));
                        
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyV621Protocol(\`Entiendo, **\${patientFirstName}**. Nos enfocaremos exclusivamente en la resolución técnica del síntoma primario ("\${patientData?.history?.consultation_reason?.primary_complaint || 'su motivo de consulta'}"). Procediendo...\`, patientData), avatar: tiloImg
                        }]);
                    } else {
                        setFase3State(prev => ({ ...prev, emotional_anchor: finalAnchor }));
                    }
`.trim();

const replacementStr = `
                    const religiousRegex = /dios|jes[uú]s|jesucristo|virgen|cristo|se[ñn]or|santo|milagro div/i;

                    if (rejectionRegex.test(text)) {
                        finalAnchor = "Resolución Técnica del Síntoma Primario";
                        setFase3State(prev => ({ ...prev, emotional_anchor: finalAnchor }));
                        
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyV621Protocol(\`Entiendo, **\${patientFirstName}**. Nos enfocaremos exclusivamente en la resolución técnica del síntoma primario ("\${patientData?.history?.consultation_reason?.primary_complaint || 'su motivo de consulta'}"). Procediendo...\`, patientData), avatar: tiloImg
                        }]);
                    } else if (religiousRegex.test(text)) {
                        finalAnchor = "Fe y Fortaleza Espiritual";
                        setFase3State(prev => ({ ...prev, emotional_anchor: finalAnchor }));
                        
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: applyV621Protocol(\`Comprendo y respeto profundamente su fe, **\${patientFirstName}**. La espiritualidad es un motor invaluable para la sanación metabólica. Hemos sellado su ancla bajo este principio. Procediendo...\`, patientData), avatar: tiloImg
                        }]);
                    } else {
                        setFase3State(prev => ({ ...prev, emotional_anchor: finalAnchor }));
                    }
`.trim();

if (content.includes('religiousRegex')) {
    console.log("Already replaced!");
} else {
    // Normalizing whitespace and replacing manually since exact string match can fail across OS
    
    // Fallback: search by regex to find the block
    const blockRegex = /if\s*\(rejectionRegex\.test\(text\)\)\s*\{[\s\S]*?else\s*\{\s*setFase3State\(prev\s*=>\s*\(\{\s*\.\.\.prev,\s*emotional_anchor:\s*finalAnchor\s*\}\)\);\s*\}/;
    
    content = content.replace(blockRegex, replacementStr);
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Replaced successfully via regex match');
}
