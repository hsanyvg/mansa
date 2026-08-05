const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Replace the orphan tags before products_manager
const regex = /<\/View>\r?\n(\s*)<\/View>\r?\n(\s*)<\/Animated\.View>\r?\n(\s*)<\/ScrollView>\r?\n(\s*)\) : activeTab === 'products_manager' \? \(/;

const fixed = `</View>\r\n$3</ScrollView>\r\n$4) : activeTab === 'products_manager' ? (`;

content = content.replace(regex, fixed);

fs.writeFileSync('App.js', content);
console.log("Fixed orphan tags");
