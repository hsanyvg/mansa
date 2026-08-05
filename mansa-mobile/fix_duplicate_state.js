const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Replace the first occurrence of setDisplayedOrdersCount
content = content.replace(/\s*const \[displayedOrdersCount, setDisplayedOrdersCount\] = useState\(100\);/, '');

fs.writeFileSync('App.js', content);
console.log('Duplicate state removed');
