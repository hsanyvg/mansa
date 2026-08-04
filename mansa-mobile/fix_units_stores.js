const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

c = c.replace(/label=\{u\.name\}/g, "label={typeof u.name === 'string' ? u.name : String(u.name)}");
c = c.replace(/value=\{u\.name\}/g, "value={typeof u.name === 'string' ? u.name : String(u.name)}");

c = c.replace(/label=\{s\.name\}/g, "label={typeof s.name === 'string' ? s.name : String(s.name)}");
// s.id is a string (document ID), so value={s.id} is fine.

fs.writeFileSync('App.js', c);
console.log('App.js fixed u.name and s.name');
