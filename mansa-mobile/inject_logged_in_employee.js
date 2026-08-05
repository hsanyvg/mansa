const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Add loggedInEmployeeId state
if (!content.includes('const [loggedInEmployeeId, setLoggedInEmployeeId]')) {
    content = content.replace(
        `const [isEmployee, setIsEmployee] = useState(false);`,
        `const [isEmployee, setIsEmployee] = useState(false);\n  const [loggedInEmployeeId, setLoggedInEmployeeId] = useState('');`
    );
}

// Update onAuthStateChanged to set loggedInEmployeeId
if (!content.includes('setLoggedInEmployeeId(data.employeeId)')) {
    content = content.replace(
        `setSelectedEmployeeId(data.employeeId);\n             setIsEmployee(true);`,
        `setSelectedEmployeeId(data.employeeId);\n             setLoggedInEmployeeId(data.employeeId);\n             setIsEmployee(true);`
    );
}

// Update handleSubmit to save customerName correctly
const orderDataRegex = /const orderData = \{\s*employeeId: selectedEmployeeId,\s*employeeName: employees\.find\(e => e\.id === selectedEmployeeId\)\?\.name \|\| 'مجهول',/g;
content = content.replace(
    orderDataRegex,
    `const orderData = {\n        employeeId: selectedEmployeeId,\n        employeeName: employees.find(e => e.id === selectedEmployeeId)?.name || 'مجهول',\n        customerName: isEmployee ? (employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير',`
);

// We should also do this for the Barcode Receipt!
// In handleSaveBarcodeReceipt:
const barcodeOrderRegex = /transaction\.set\(newOrderRef, \{\s*receiptNumber: newBarcodeReceipt\.trim\(\),\s*employeeId: selectedEmployeeId \|\| 'agent',\s*employeeName: employees\?\.find\(e => e\.id === selectedEmployeeId\)\?\.name \|\| 'مجهول',\s*customerName: '',/g;
content = content.replace(
    barcodeOrderRegex,
    `transaction.set(newOrderRef, {\n            receiptNumber: newBarcodeReceipt.trim(),\n            employeeId: selectedEmployeeId || 'agent',\n            employeeName: employees?.find(e => e.id === selectedEmployeeId)?.name || 'مجهول',\n            customerName: isEmployee ? (employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير',`
);


fs.writeFileSync('App.js', content);
console.log("Injected systemUser (customerName) logic!");
