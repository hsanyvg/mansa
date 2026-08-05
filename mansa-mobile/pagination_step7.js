const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const startStr = "const teamStats = employees.map(emp => {";
const endStr = "                }).sort((a, b) => b.total - a.total);";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const prefix = content.substring(0, startIndex);
  const suffix = content.substring(endIndex + endStr.length);
  content = prefix + "// teamStats is already loaded from state!" + suffix;
  fs.writeFileSync('App.js', content);
  console.log("Successfully replaced Team Performance logic");
} else {
  console.log("Failed to find teamStats", startIndex, endIndex);
}
