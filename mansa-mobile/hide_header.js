const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

c = c.replace(
  "{activeTab !== 'settings' && (",
  "{(!activeTab.endsWith('_shipments') && activeTab !== 'settings') && ("
);

fs.writeFileSync('App.js', c);
console.log('App.js updated successfully!');
