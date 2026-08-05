const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

content = content.replace(/(\s*)\}\)\(\)\}\n(\s*)<\/ScrollView>/g, '$1})()}\n$2</View>');

fs.writeFileSync('App.js', content);
console.log("Fixed remaining ScrollViews again");
