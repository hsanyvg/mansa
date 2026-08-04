const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

c = c.replace(
  /\{typeof p\.selling === 'object' \? JSON\.stringify\(p\.selling\) \: \(p\.selling \|\| p\.price \|\| 0\)\}/g,
  "{typeof (p.selling || p.price || 0) === 'object' ? JSON.stringify(p.selling || p.price || 0) : String(p.selling || p.price || 0)}"
);

c = c.replace(
  /\{typeof p\.stock === 'object' \? JSON\.stringify\(p\.stock\) \: \(p\.stock \|\| p\.quantity \|\| 0\)\}/g,
  "{typeof (p.stock || p.quantity || 0) === 'object' ? JSON.stringify(p.stock || p.quantity || 0) : String(p.stock || p.quantity || 0)}"
);

// Wait, what if I replaced it with String(...) earlier?
// Let's also check if I did {String(p.selling || p.price || 0)} in my previous script
c = c.replace(
  /\{String\(p\.selling \|\| p\.price \|\| 0\)\}/g,
  "{typeof (p.selling || p.price || 0) === 'object' ? JSON.stringify(p.selling || p.price || 0) : String(p.selling || p.price || 0)}"
);

c = c.replace(
  /\{String\(p\.stock \|\| p\.quantity \|\| 0\)\}/g,
  "{typeof (p.stock || p.quantity || 0) === 'object' ? JSON.stringify(p.stock || p.quantity || 0) : String(p.stock || p.quantity || 0)}"
);

fs.writeFileSync('App.js', c);
console.log('Fixed object evaluation for price and quantity!');
