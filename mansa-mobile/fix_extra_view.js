const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /<\/TouchableOpacity>\r?\n(\s*)<\/View>\r?\n(\s*)<\/View>/;
content = content.replace(regex, '</TouchableOpacity>\n$1</View>');

fs.writeFileSync('App.js', content);
console.log("Fixed extra View tag");
