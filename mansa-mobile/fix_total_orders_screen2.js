
const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex1 = /شحنات اليوم \(\{orders\.filter\(o => \{ if \(\!o\.createdAt\) return false;.*?\}\)\.length\}\)/s;
content = content.replace(regex1, 'الطلبات الكلية ({orders.length})');

const regex2 = /let filtered = orders\.filter\(o => \{ if \(\!o\.createdAt\) return false;.*?\}\);/s;
content = content.replace(regex2, 'let filtered = [...orders];');

fs.writeFileSync('App.js', content);
console.log("Successfully fixed total orders screen!");
