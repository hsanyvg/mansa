const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /const\s+\[displayedOrdersCount,\s*setDisplayedOrdersCount\]\s*=\s*useState\(100\);/g;

let matchCount = 0;
content = content.replace(regex, (match) => {
  matchCount++;
  if (matchCount === 2) {
    return ''; // Remove the second one
  }
  return match;
});

fs.writeFileSync('App.js', content);
console.log("Removed duplicate number 2. Total found:", matchCount);
