const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const helper = `\n  const formatDateLocal = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return \`\${date.getFullYear()}-\${String(date.getMonth() + 1).padStart(2, '0')}-\${String(date.getDate()).padStart(2, '0')}\`;
  };\n`;

if (!content.includes('formatDateLocal = (d)')) {
  // inject after setIsLightMode = useState(false);
  content = content.replace(/const \[isLightMode, setIsLightMode\] = useState\(false\);/, 'const [isLightMode, setIsLightMode] = useState(false);' + helper);
}

content = content.replace(/tempCustomStartDate\.toISOString\(\)\.split\('T'\)\[0\]/g, 'formatDateLocal(tempCustomStartDate)');
content = content.replace(/tempCustomEndDate\.toISOString\(\)\.split\('T'\)\[0\]/g, 'formatDateLocal(tempCustomEndDate)');
content = content.replace(/expenseDate\.toISOString\(\)\.split\('T'\)\[0\]/g, 'formatDateLocal(expenseDate)');
content = content.replace(/customStartDate\.toISOString\(\)\.split\('T'\)\[0\]/g, 'formatDateLocal(customStartDate)');
content = content.replace(/customEndDate\.toISOString\(\)\.split\('T'\)\[0\]/g, 'formatDateLocal(customEndDate)');

fs.writeFileSync('App.js', content);
console.log('Fixed date display');
