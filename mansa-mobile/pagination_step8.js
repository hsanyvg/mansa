const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const stateToRemove = "  const [displayedOrdersCount, setDisplayedOrdersCount] = useState(100);";

// Remove ONLY the first occurrence (which is the one I injected at line 214)
content = content.replace(stateToRemove + "\\r\\n", "");
content = content.replace(stateToRemove + "\\n", "");

fs.writeFileSync('App.js', content);
console.log("Removed duplicate displayedOrdersCount state successfully");
