const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

content = content.replace(/setDisplayedOrdersCount\(prev => prev \+ 20\)/g, 'setDisplayedOrdersCount(prev => prev + 100)');

fs.writeFileSync('App.js', content);
console.log("Updated Load More buttons to 100");
