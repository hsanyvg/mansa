const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Fix the alertBg View at line 1869 (it was around line 1878 actually)
const alertRegex = /<\/TouchableOpacity>\r?\n(\s*)<\/View>\r?\n(\s*)<\/Modal>/;
content = content.replace(alertRegex, '</TouchableOpacity>\n$1</View>\n$1</View>\n$2</Modal>');

// 2. Fix the Search Tab extra View.
// The search button ends with: <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>بحث</Text> </TouchableOpacity> </View> </View>
const searchRegex = /<Text style=\{\{ color: '#fff', fontSize: 18, fontWeight: 'bold' \}\}>بحث<\/Text>\r?\n(\s*)<\/TouchableOpacity>\r?\n(\s*)<\/View>\r?\n(\s*)<\/View>/;
content = content.replace(searchRegex, `<Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>بحث</Text>\n$1</TouchableOpacity>\n$2</View>`);

fs.writeFileSync('App.js', content);
console.log("Fixed both syntax errors");
