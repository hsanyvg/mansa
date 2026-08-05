const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /\{\/\* Neon spinning border card wrapper \*\/\}([\s\S]*?)\{\/\* Inner dark content card \*\/\}\r?\n(\s*)<View style=\{styles\.neonCardInner\}>/;
content = content.replace(regex, '');

// Now we need to remove the closing tags that were at the end of the FlatList!
// I had replaced them with 2 closing views. But originally there were 3 (View, View, Animated.View).
// Wait, I replaced `})()}\n</View>\n</ScrollView>` earlier, which was wrong because I removed the closing tags of the Neon Card too early.
// Let's check how the file ends before modifying it further.
fs.writeFileSync('App.js', content);
console.log("Removed neon card wrapper start tags");
