const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// The original script failed because of CRLF and differences in spacing
content = content.replace(/<View style=\{\{height: 50\}\} \/>\r?\n(\s*)<\/ScrollView>/g, '<View style={{height: 50}} />\n$1</View>');

fs.writeFileSync('App.js', content);
console.log("Fixed the rest of CRLF");
