const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Replace the wrongly replaced </View> for team stats
content = content.replace(
  /\}\)\(\)\}\r?\n(\s*)<\/View>\r?\n(\s*)<\/View>\r?\n(\s*)<\/ScrollView>\r?\n(\s*)\) : activeTab === 'add_expense' \? \(/g,
  `})()}\n$1</ScrollView>\n$2</View>\n$3</ScrollView>\n$4) : activeTab === 'add_expense' ? (`
);

fs.writeFileSync('App.js', content);
console.log("Fixed team stats ScrollView");
