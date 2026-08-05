const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const startStr = "const teamStats = employees.map(emp => {";
const endStr = "                  };";
const endStr2 = "                });";

const startIndex = content.indexOf(startStr);
if (startIndex !== -1) {
  const endIndex = content.indexOf(endStr2, startIndex) + endStr2.length;
  const prefix = content.substring(0, startIndex);
  const suffix = content.substring(endIndex);
  
  content = prefix + "// teamStats is already loaded from state!" + suffix;
  fs.writeFileSync('App.js', content);
  console.log("Replaced using substring successfully.");
} else {
  console.log("Could not find startStr.");
}
