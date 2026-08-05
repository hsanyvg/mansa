const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /customerName: isEmployee \? \(employees\.find\(e => e\.id === loggedInEmployeeId\)\?\.name \|\| 'مجهول'\) : 'المدير',\s*customerName: customerName,/g;

content = content.replace(regex, `customerName: isEmployee ? (employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير',`);

fs.writeFileSync('App.js', content);
console.log("Fixed duplicate customerName key!");
