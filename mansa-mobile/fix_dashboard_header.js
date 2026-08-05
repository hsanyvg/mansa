const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Remove the Date Filter Icon block
const dateFilterRegex = /\s*\{\/\* Date Filter Icon \*\/\}\s*<TouchableOpacity[\s\S]*?setDateFilterModalVisible\(true\);[\s\S]*?<\/Svg>\s*<\/TouchableOpacity>/g;
content = content.replace(dateFilterRegex, '');

// 2. Change all setEmpModalVisible(true) attached to User Icons in headers to setActiveTab('settings')
// We will just do a global replace for all `setEmpModalVisible(true)` inside header touchables.
// Since there's no other place `setEmpModalVisible(true)` is legitimately used (unless he actually wants to keep the employee assignment modal somewhere else?). 
// Wait, is `empModalVisible` used for anything else?
// The user said "مو اختار موضف لان ماا احتاج انو اختار موضف اعتمادي ع اليوزر مال موضف" (Not choose an employee because I don't need to choose an employee, I rely on the employee's user account).
// This implies he doesn't want the Employee selection feature at all anymore! So replacing all setEmpModalVisible(true) with setActiveTab('settings') is safe.

content = content.replace(/setEmpModalVisible\(true\)/g, "setActiveTab('settings')");

fs.writeFileSync('App.js', content);
console.log("Fixed dashboard header icons!");
