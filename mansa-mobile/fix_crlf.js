const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

content = content.replace(/\}\)\(\)\}\r?\n(\s*)<\/ScrollView>/g, '})()}\n$1</View>');

fs.writeFileSync('App.js', content);
console.log("Fixed CRLF");
