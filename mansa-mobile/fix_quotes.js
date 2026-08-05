const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

content = content.replace('"+ إضافة منتج"', '&quot;+ إضافة منتج&quot;');

fs.writeFileSync('App.js', content);
console.log("Fixed quotes!");
