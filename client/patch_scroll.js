/* global require */
const fs = require('fs');
const path = require('path');

const dirsToScan = [
  'c:/Users/andre/App de consulta nutricional/client/src/components/interview',
  'c:/Users/andre/App de consulta nutricional/client/src', // for App.jsx
];

for (const dir of dirsToScan) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if ((f.startsWith('Fase') && f.endsWith('.jsx')) || f === 'App.jsx') {
      const filePath = path.join(dir, f);
      let content = fs.readFileSync(filePath, 'utf-8');
      
      let modified = false;

      // Ensure useRef is imported!
      if (!content.includes('useRef')) {
         content = content.replace('import React, {', 'import React, { useRef, ');
         modified = true;
      }

      // Regex to match existing useEffect for scroll (chatEndRef)
      const regex1 = /useEffect\(\(\)\s*=>\s*\{\s*chatEndRef(?:\.current)?\?\.scrollIntoView\(\{\s*behavior:\s*['"]smooth['"]\s*\}\);\s*\},?\s*\[(.*?)\]\);/g;
      // Regex for messagesEndRef
      const regex2 = /useEffect\(\(\)\s*=>\s*\{\s*messagesEndRef(?:\.current)?\?\.scrollIntoView\(\{\s*behavior:\s*['"]smooth['"]\s*\}\);\s*\},?\s*\[(.*?)\]\);/g;
      
      // Special case App.jsx
      const regex3 = /const scrollToBottom = useCallback\(\(\) => \{\s*messagesEndRef\.current\?\.scrollIntoView\(\{ behavior: "smooth" \}\);\s*\}, \[\]\);/g;

      if (regex1.test(content)) {
        content = content.replace(regex1, (match, deps) => {
          return `const isFirstScroll = useRef(true);
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: isFirstScroll.current ? 'auto' : 'smooth' });
            if (isFirstScroll.current) isFirstScroll.current = false;
        }
    }, [${deps}]);`;
        });
        modified = true;
      }

      if (regex2.test(content)) {
         content = content.replace(regex2, (match, deps) => {
          return `const isFirstScroll = useRef(true);
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: isFirstScroll.current ? 'auto' : 'smooth' });
            if (isFirstScroll.current) isFirstScroll.current = false;
        }
    }, [${deps}]);`;
        });
        modified = true;
      }

      if (regex3.test(content)) {
         content = content.replace(regex3, `const isFirstScroll = useRef(true);
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: isFirstScroll.current ? 'auto' : 'smooth' });
      if (isFirstScroll.current) isFirstScroll.current = false;
    }
  }, []);`);
         modified = true; 
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log('Updated: ' + f);
      }
    }
  }
}
