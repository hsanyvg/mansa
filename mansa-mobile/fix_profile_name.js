const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Replace selectedEmployeeName definition with systemUserName
const regex = /const selectedEmployeeName = employees\.find\(e => e\.id === selectedEmployeeId\)\?\.name \|\| 'اختر الموظف 👤';/g;
content = content.replace(regex, `const systemUserName = isEmployee ? (employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير';`);

// Replace usages of selectedEmployeeName with systemUserName
content = content.replace(/\{selectedEmployeeName \? selectedEmployeeName\.split\(' '\)\.slice\(0,2\)\.map\(n => n\[0\]\)\.join\(' '\) : '👤'\}/g, 
    `{systemUserName ? systemUserName.split(' ').slice(0,2).map(n => n[0]).join(' ') : '👤'}`);
content = content.replace(/\{selectedEmployeeName\}/g, `{systemUserName}`);

fs.writeFileSync('App.js', content);
console.log("Fixed profile name to use systemUserName!");
