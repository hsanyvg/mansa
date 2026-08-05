const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Replace globalDateFilter === filter.id with a function that checks for specific_month as well
content = content.replace(
  /globalDateFilter === filter\.id \? '#a855f7' : \(isLightMode/g,
  "(globalDateFilter === filter.id || (filter.id === 'custom' && globalDateFilter === 'specific_month')) ? '#a855f7' : (isLightMode"
);
content = content.replace(
  /globalDateFilter === filter\.id \? '#fff' : \(isLightMode/g,
  "(globalDateFilter === filter.id || (filter.id === 'custom' && globalDateFilter === 'specific_month')) ? '#fff' : (isLightMode"
);
content = content.replace(
  /globalDateFilter === filter\.id \? 'bold' : 'normal'/g,
  "(globalDateFilter === filter.id || (filter.id === 'custom' && globalDateFilter === 'specific_month')) ? 'bold' : 'normal'"
);

fs.writeFileSync('App.js', content);
console.log("Fixed custom active state!");
