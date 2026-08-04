const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

c = c.replace(/updateDoc,\r?\n  query as fsQuery,/g, "updateDoc,\n  addDoc,\n  query as fsQuery,");

fs.writeFileSync('App.js', c);
console.log('addDoc safely imported using Regex!');
