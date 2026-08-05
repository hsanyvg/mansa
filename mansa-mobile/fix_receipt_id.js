const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Replace 'بدون رقم' with item.id
content = content.replace(/\{item\.receiptNumber \|\| 'بدون رقم'\}/g, "{item.receiptNumber || item.id}");

fs.writeFileSync('App.js', content);
console.log("Replaced 'بدون رقم' with item.id!");
