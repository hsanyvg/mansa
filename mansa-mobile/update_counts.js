const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

c = c.replace(
  "const newCount = orders.filter(o => o.status === 'pending' || o.status === 'new').length;", 
  "const newCount = orders.filter(o => o.status === 'pending' || o.status === 'pending_warehouse' || o.status === 'new').length;"
);

c = c.replace(
  "const ofdOrdersCount = orders.filter(o => o.status === 'ofd' || o.status === 'shipped').length;", 
  "const ofdOrdersCount = orders.filter(o => o.status === 'processing' || o.status === 'confirmed' || o.status === 'ofd' || o.status === 'shipped').length;"
);

fs.writeFileSync('App.js', c);
console.log('Counts updated');
