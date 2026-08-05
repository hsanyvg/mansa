const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// The closing tags that should be </View> because we changed the opening tag to <View>
// The opening tag was `<View style={{ flex: 1, padding: 15 }}>`
// Let's replace any `</ScrollView>` that immediately follows `})()}\n`
content = content.replace(/\}\)\(\)\}\n(\s*)<\/ScrollView>/g, '})()}\n$1</View>');

fs.writeFileSync('App.js', content);
console.log("Fixed remaining ScrollViews");
