const fs = require('fs');
let content = fs.readFileSync('App_flatlist_temp.js', 'utf8');

// Fix the 7 tabs closing tags
content = content.replace(
  /\}\)\(\)\}\n(\s*)<View style=\{\{height: 50\}\} \/>\n(\s*)<\/ScrollView>/g,
  `})()}\n$1<View style={{height: 50}} />\n$2</View>`
);

// Fix the main orders tab outer ScrollView
content = content.replace(
  /<ScrollView style=\{styles\.tabContent\} contentContainerStyle=\{styles\.scrollPadding\}>\n(\s*)\{!\(adminUid && user\) \? \(/,
  `<View style={styles.tabContent}>\n$1{!(adminUid && user) ? (`
);

content = content.replace(
  /<\/Animated\.View>\n(\s*)<\/ScrollView>\n(\s*)\) : activeTab === 'products_manager'/,
  `</Animated.View>\n$1</View>\n$2) : activeTab === 'products_manager'`
);

fs.writeFileSync('App_flatlist_final.js', content);
console.log("Fixed ScrollViews in App_flatlist_final.js");
