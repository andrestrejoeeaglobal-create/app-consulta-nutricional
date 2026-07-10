const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components/interview');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let original = fs.readFileSync(filePath, 'utf8');
    
    // The previous script wrote: `</div>\n                        )) : (`
    // It should be `</div>\n                        ) : (`
    let fixed = original.replace(/<\/div>\r?\n\s*\)\) : \(/g, '</div>\n                        ) : (');
    fixed = fixed.replace(/<\/div>\r?\n\s*\)\): \(/g, '</div>\n                        ) : (');
    fixed = fixed.replace(/<\/div>\r?\n\s*\)\):/g, '</div>\n                        ):');

    if (fixed !== original) {
        fs.writeFileSync(filePath, fixed, 'utf8');
        console.log("Fixed parens for " + file);
    }
});
