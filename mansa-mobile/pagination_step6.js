const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const startStr = "const teamStats = employees.map(emp => {";
const endStr = "                    pending\\n                  };\\n                });";
const endStrWin = "                    pending\\r\\n                  };\\r\\n                });";

const startIndex = content.indexOf(startStr);
let endIndex = content.indexOf(endStr, startIndex);
let endLength = endStr.length;

if (endIndex === -1) {
  endIndex = content.indexOf(endStrWin, startIndex);
  endLength = endStrWin.length;
}

if (startIndex !== -1 && endIndex !== -1) {
  const prefix = content.substring(0, startIndex);
  const suffix = content.substring(endIndex + endLength);
  content = prefix + "// teamStats is already loaded from state!" + suffix;
  fs.writeFileSync('App.js', content);
  console.log("Replaced Team Stats successfully");
} else {
  console.log("Failed to find teamStats", startIndex, endIndex);
}
