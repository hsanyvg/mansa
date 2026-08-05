const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const receiptRegex = /\s*\{\/\* Receipt Number \(Optional\) \*\/\}\s*<View style=\{styles\.formGroup\}>\s*<TextInput[\s\S]*?value=\{customReceiptNumber\}[\s\S]*?\/>\s*<\/View>/g;
content = content.replace(receiptRegex, '');

fs.writeFileSync('App.js', content);
console.log("Removed Receipt Number UI from Add Order form!");
