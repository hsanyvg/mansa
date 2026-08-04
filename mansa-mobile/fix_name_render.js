const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

c = c.replace(/\{p\.name\}/g, "{typeof p.name === 'string' ? p.name : (p.name ? JSON.stringify(p.name) : 'بدون اسم')}");
c = c.replace(/\{c\.name\}/g, "{typeof c.name === 'string' ? c.name : (c.name ? JSON.stringify(c.name) : 'بدون اسم')}");
c = c.replace(/\{pg\.name\}/g, "{typeof pg.name === 'string' ? pg.name : (pg.name ? JSON.stringify(pg.name) : 'بدون اسم')}");

// Also fix Picker.Item where label and value might get objects
c = c.replace(/label=\{p\.name\}/g, "label={typeof p.name === 'string' ? p.name : String(p.name)}");
c = c.replace(/value=\{p\.name\}/g, "value={typeof p.name === 'string' ? p.name : String(p.name)}");

c = c.replace(/label=\{c\.name\}/g, "label={typeof c.name === 'string' ? c.name : String(c.name)}");
c = c.replace(/value=\{c\.name\}/g, "value={typeof c.name === 'string' ? c.name : String(c.name)}");

c = c.replace(/label=\{pg\.name\}/g, "label={typeof pg.name === 'string' ? pg.name : String(pg.name)}");
c = c.replace(/value=\{pg\.name\}/g, "value={typeof pg.name === 'string' ? pg.name : String(pg.name)}");

fs.writeFileSync('App.js', c);
console.log('App.js fixed with safe name rendering');
