const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const leftoverRegex = /\{\/\* The Inner Box Cover \*\/\}([\s\S]*?)<\/Animated\.View>/;
content = content.replace(leftoverRegex, '');

fs.writeFileSync('App.js', content);
console.log("Fixed leftover neon search bar");
