const fs = require('fs');
let content = fs.readFileSync('client/src/components/interview/Fase7_Habitos.jsx', 'utf8');

// Find the last occurrence of "export default Fase7_Habitos;" and remove it.
const searchStr = 'export default Fase7_Habitos;';
const lastIndex = content.lastIndexOf(searchStr);

if (lastIndex !== -1) {
    content = content.substring(0, lastIndex) + content.substring(lastIndex + searchStr.length);
    // Also fix the }; at the end if it exists.
    content = content.replace(/};\s*$/, '}\n');
    fs.writeFileSync('client/src/components/interview/Fase7_Habitos.jsx', content);
    console.log('Fixed export and trailing tags in Fase7_Habitos.jsx');
} else {
    console.log('Could not find export default string');
}
