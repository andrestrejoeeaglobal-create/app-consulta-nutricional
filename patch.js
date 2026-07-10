const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components/interview');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

const btnTargetClass = "px-4 py-2 bg-slate-50 border border-slate-200 text-[#1C75BC] text-sm rounded-full shadow-sm hover:bg-[#1C75BC] hover:text-white hover:border-[#1C75BC] transition-colors font-semibold";

let modifiedFiles = 0;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let original = fs.readFileSync(filePath, 'utf8');
    let content = original;

    // Fix summary blocks that use asterisk bullets.
    // E.g. summaryBlock += `* **Tensión Arterial:**
    content = content.replace(/summaryBlock\s*\+=\s*`\*\s/g, "summaryBlock += `\\n\\n- ");
    // Fix summary blocks missing double newlines before bullets. e.g. `\n- **`
    content = content.replace(/\\n-\s\*\*/g, "\\n\\n- **");
    // Also those that use literal \n* in their strings
    content = content.replace(/\\n\*\s/g, "\\n\\n- ");

    // Handle `* Fármacos Activos` inside inline strings like in Fase6
    content = content.replace(/\\n\n\*\s/g, "\\n\\n- ");
    content = content.replace(/\\n\*\s/g, "\\n\\n- ");

    // Replace <button ... className="..."> inside .map
    // We look for any button rendered in an options map block. It usually has a long className.
    const classNameRegex = /className="[^\"]*rounded-[^\"]*"/g;
    
    // Replace wrappers:
    // e.g. className="mt-4 flex flex-col gap-2" -> className="mt-3 flex flex-wrap gap-2 justify-start"
    // e.g. className="flex flex-col gap-2 w-full mb-2" -> className="mt-3 flex flex-wrap gap-2 justify-start w-full mb-2"

    // To be very safe, let's identify the option wrappers. They usually follow `msg.options.map` directly or via a wrapper div.
    // Instead of blind regex, let's carefully replace button classes if they look like option buttons.
    content = content.replace(/<button([^>]*)className="([^"]+)"/g, (match, before, cls) => {
        // If the button class is already the target or close to it, skip if it's the exact one.
        if (cls.includes('#1C75BC') && cls.includes('rounded-full') && !before.includes('disabled={inputType !== \'text\'')) {
            return match; // Already fixed or very close
        }
        // If it's an option button (has onClick that deals with opt.val, or handles text, etc)
        // Usually these are wide buttons with things like "w-full text-left" or "bg-slate-50" etc.
        // Or if the file doesn't have other large mapped buttons...
        if (cls.includes('w-full') || cls.includes('rounded-xl') || cls.includes('rounded-lg') || cls.includes('border-tilo-primary') || cls.includes('hover:bg-slate-50')) {
             return `<button${before}className="${btnTargetClass}"`;
        }
        return match;
    });

    // Replace flex-col wrappers for those options
    // Find divs that contain msg.options.map or just flex-col gap-2 nearest to map
    content = content.replace(/className="[^"]*flex-col[^"]*gap-2[^"]*"/g, (match) => {
        // Only replace if it seems like an options wrapper
        if (match.includes('w-full') || match.includes('mt-4') || match.includes('mt-3')) {
            let replaced = match.replace('flex-col', 'flex-wrap flex-row justify-start').replace('mt-4', 'mt-3').replace('w-full', '');
            return replaced;
        }
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        modifiedFiles++;
        console.log(`Modified: ${file}`);
    }
});

console.log(`Total modified files: ${modifiedFiles}`);
