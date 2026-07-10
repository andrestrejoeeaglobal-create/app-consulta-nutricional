import os
import re

files = [
    'Fase6_Farmacologia.jsx',
    'Fase7_Alergias.jsx',
    'Fase8_SaludDigestiva.jsx',
    'Fase9_EstadoFisiologico.jsx',
    'Fase10_Habitos.jsx',
    'Fase11_EvaluacionDietetica.jsx',
    'Fase12_Biometria.jsx',
    'Fase13_ContextoEspecial.jsx',
    'Fase14_Orquestador.jsx',
    'Fase15_SuplementacionAv.jsx',
    'Fase16_ProtocoloDietetico.jsx',
    'Fase17_Despedida.jsx',
]

base_path = 'c:/Users/andre/App de consulta nutricional/client/src/components/interview/'

new_bubble = '''<div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${(msg.sender === "tilo" || msg.role === 'assistant')
                                ? msg.isBio
                                    ? 'bg-purple-50 border-l-4 border-purple-500 text-purple-900 rounded-tl-none font-medium'
                                    : msg.isAcute
                                        ? 'bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-tl-none font-medium'
                                        : msg.isCritical
                                            ? 'bg-red-50 border-l-4 border-red-500 text-red-900 rounded-tl-none font-bold'
                                            : 'bg-white border text-slate-700 rounded-tl-none border-slate-100'
                                : 'bg-indigo-600 text-white rounded-tr-none'
                                }`}>'''

# Find the pattern exactly or flexibly
# Some might be single line or multiline
pattern = re.compile(r'<div\s+className=\{`p-4 rounded-2xl max-w-\[85%\] shadow-sm \$\{\(msg\.sender === [\'"]tilo[\'"] \|\| msg\.role === [\'"]assistant[\'"]\)\s*\?\s*[\'"]bg-white border text-slate-700 rounded-tl-none border-slate-100[\'"]\s*:\s*[\'"]bg-indigo-600 text-white rounded-tr-none[\'"]\s*\}`\}>', re.MULTILINE)

for file in files:
    path = os.path.join(base_path, file)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = pattern.sub(new_bubble, content)
        if new_content != content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {file}')
        else:
            print(f'No match found in {file}')
    else:
        print(f'File not found: {file}')
