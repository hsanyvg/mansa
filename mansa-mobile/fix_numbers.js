const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

c = c.replace(
  "{p.selling || p.price || 0}",
  "{typeof p.selling === 'object' ? JSON.stringify(p.selling) : (p.selling || p.price || 0)}"
);

c = c.replace(
  "{p.stock || p.quantity || 0}",
  "{typeof p.stock === 'object' ? JSON.stringify(p.stock) : (p.stock || p.quantity || 0)}"
);

// Also maybe p.price or p.quantity could be objects?
c = c.replace(
  "{p.selling || p.price || 0}",
  "{String(p.selling || p.price || 0)}"
);
c = c.replace(
  "{p.stock || p.quantity || 0}",
  "{String(p.stock || p.quantity || 0)}"
);

fs.writeFileSync('App.js', c);
console.log('App.js fixed with safe number rendering');
