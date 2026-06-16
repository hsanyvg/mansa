const fs = require('fs');
const lines = fs.readFileSync('mansa-mobile/App.js', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes("activeTab === 'settings'")) {
    console.log(i + ": " + l.trim());
  }
});
