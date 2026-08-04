const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

c = c.replace(/<TouchableOpacity style=\{\{ marginTop: 10, backgroundColor: '#f97316', paddingVertical: 8, borderRadius: 5, alignItems: 'center' \}\} onPress=\{\(\) => \{ setSelectedOrderForDetails\(item\); setOrderDetailsModalVisible\(true\); \}\}>[\s\S]*?<\/TouchableOpacity>/g, '');
c = c.replace(/<TouchableOpacity style=\{\{ marginTop: 10, backgroundColor: '#ef4444', paddingVertical: 8, borderRadius: 5, alignItems: 'center' \}\} onPress=\{\(\) => \{ setSelectedOrderForDetails\(item\); setOrderDetailsModalVisible\(true\); \}\}>[\s\S]*?<\/TouchableOpacity>/g, '');

fs.writeFileSync('App.js', c);
console.log('Crash buttons removed');
