import sys
import re

file_path = 'c:/Users/andre/App de consulta nutricional/client/src/components/interview/Fase3_MotivoConsulta.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

find1 = '''                             const reviewMsg = {
                                 role: "assistant",
                                 content: "¿Es correcta esta información o desea agregar algo más antes de continuar con su historial clínico?",
                                 options: [
                                     { label: "Sí, todo es correcto", value: "CONFIRM_DATA" },
                                     { label: "Quiero agregar algo", value: "CORRECT_DATA" }
                                 ]
                             };'''

find2 = '''                         const reviewMsg = {
                             role: "assistant",
                             content: "¿Es correcta esta información o desea agregar algo más antes de continuar con su historial clínico?",
                             options: [
                                 { label: "Sí, todo es correcto", value: "CONFIRM_DATA" },
                                 { label: "Quiero agregar algo", value: "CORRECT_DATA" }
                             ]
                         };'''

find1_regex = re.escape(find1).replace(r'\n', r'\r?\n')
find2_regex = re.escape(find2).replace(r'\n', r'\r?\n')

content = re.sub(find1_regex, '                             const reviewMsg = getBinaryGateReviewMsg();', content)
content = re.sub(find2_regex, '                         const reviewMsg = getBinaryGateReviewMsg();', content)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('Done!')
