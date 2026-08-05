const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /\{\/\*\s*5\.\s*Date Filter Modal\s*\*\/\}.*?<\/Modal>\s*/s;

if (regex.test(content)) {
  content = content.replace(regex, '');
  console.log("Successfully removed duplicate Date Filter Modal!");
} else {
  console.log("Could not find the duplicate Modal block.");
}

fs.writeFileSync('App.js', content);
