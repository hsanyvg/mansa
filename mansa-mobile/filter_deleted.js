const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

const anchor = "const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));";
const replacement = "const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(o => o.isDeleted !== true);";

if (c.includes(anchor)) {
  c = c.replace(anchor, replacement);
  fs.writeFileSync('App.js', c);
  console.log('App.js updated: Filtered out soft-deleted orders.');
} else {
  console.log('Anchor not found or already replaced.');
}
