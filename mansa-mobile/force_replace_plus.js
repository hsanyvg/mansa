const fs = require('fs');
let App = fs.readFileSync('App.js', 'utf8');

const oldStr = `style={[styles.centerNavBtn, { backgroundColor: 'transparent', borderWidth: 0, width: 68, height: 68, shadowColor: 'transparent', elevation: 0 }, activeTab === 'entry' && styles.centerNavBtnActive]}
            onPress={() => setActiveTab('entry')}`;

const newStr = `style={[styles.centerNavBtn, { backgroundColor: 'transparent', borderWidth: 0, width: 68, height: 68, shadowColor: 'transparent', elevation: 0 }, plusMenuVisible && styles.centerNavBtnActive]}
            onPress={() => setPlusMenuVisible(true)}`;

if (App.includes(oldStr)) {
  App = App.replace(oldStr, newStr);
  fs.writeFileSync('App.js', App);
  console.log("Plus button replaced perfectly using exact string match.");
} else {
  console.log("oldStr not found! I will try with flexible whitespace replacement.");
  // Fallback
  const flexibleRegex = /style=\{\[styles\.centerNavBtn.*?activeTab === 'entry' && styles\.centerNavBtnActive\]\}\s*onPress=\{\(\) => setActiveTab\('entry'\)\}/;
  if (flexibleRegex.test(App)) {
    App = App.replace(flexibleRegex, `style={[styles.centerNavBtn, { backgroundColor: 'transparent', borderWidth: 0, width: 68, height: 68, shadowColor: 'transparent', elevation: 0 }, plusMenuVisible && styles.centerNavBtnActive]}
            onPress={() => setPlusMenuVisible(true)}`);
    fs.writeFileSync('App.js', App);
    console.log("Plus button replaced using flexible regex.");
  } else {
    console.log("Still could not find the target code to replace!");
  }
}
