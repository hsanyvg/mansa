const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Inject setLoggedInEmployeeId into onAuthStateChanged
content = content.replace(
    /setSelectedEmployeeId\(data\.employeeId\);\s*setIsEmployee\(true\);/g,
    `setSelectedEmployeeId(data.employeeId);\n             setLoggedInEmployeeId(data.employeeId);\n             setIsEmployee(true);`
);

fs.writeFileSync('App.js', content);
console.log("Fixed loggedInEmployeeId in onAuthStateChanged!");
