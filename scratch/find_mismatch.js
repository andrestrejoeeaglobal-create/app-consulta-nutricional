const fs = require('fs');

const code = fs.readFileSync('server/routes/bioRoutes.js', 'utf8');
const lines = code.split('\n');

const stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let col = 0; col < line.length; col++) {
        const char = line[col];
        if (char === '{') {
            stack.push({ lineNum: i + 1, col: col + 1, type: '{' });
        } else if (char === '}') {
            if (stack.length === 0) {
                console.log(`⚠️ Mismatched closing brace '}' at line ${i + 1}:${col + 1}`);
            } else {
                stack.pop();
            }
        }
    }
}

if (stack.length > 0) {
    console.log("❌ Unclosed braces left in stack:");
    stack.forEach(item => {
        console.log(`Line ${item.lineNum}:${item.col} - "${lines[item.lineNum - 1].trim()}"`);
    });
} else {
    console.log("✅ All braces are perfectly balanced!");
}
