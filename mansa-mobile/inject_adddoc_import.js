const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

c = c.replace(
  "updateDoc,\n  query as fsQuery,",
  "updateDoc,\n  addDoc,\n  query as fsQuery,"
);

fs.writeFileSync('App.js', c);
console.log('addDoc imported!');
