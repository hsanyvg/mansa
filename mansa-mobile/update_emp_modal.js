const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

// 1. Remove the Employee Selector in the new order form
const entryEmployeeSelectorStart = "            {/* Employee Selector */}";
const entryEmployeeSelectorEnd = "            </View>";
const startIdx = c.indexOf(entryEmployeeSelectorStart);
if (startIdx !== -1) {
  const nextSectionIdx = c.indexOf("{/* Input Name */}", startIdx);
  if (nextSectionIdx !== -1) {
    c = c.substring(0, startIdx) + c.substring(nextSectionIdx);
  }
}

// 2. Change person icon onPress to setActiveTab('settings')
// There are a few places where setEmpModalVisible(true) is used.
// Global header (line ~1522)
c = c.replace(
  "onPress={() => setEmpModalVisible(true)}",
  "onPress={() => setActiveTab('settings')}"
);

// Profile switch button in settings tab
c = c.replace(
  "onPress={() => setEmpModalVisible(true)}",
  "onPress={() => setActiveTab('settings')}"
);

// Orders header
c = c.replace(
  "onPress={() => setEmpModalVisible(true)}",
  "onPress={() => setActiveTab('settings')}"
);

fs.writeFileSync('App.js', c);
console.log('App.js updated successfully!');
