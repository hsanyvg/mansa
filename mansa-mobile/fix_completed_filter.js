const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

const oldStr = "['delivered', 'returned', 'partial', 'replaced', 'cancelled'].includes(o.status)";
const newStr = "(o.status === 'delivered' || o.status === 'delivered_settled')";

if (c.includes(oldStr)) {
    c = c.split(oldStr).join(newStr);
    fs.writeFileSync('App.js', c);
    console.log('App.js updated: Replaced completed shipments status filter.');
} else {
    console.log('Could not find the target string in App.js');
}
