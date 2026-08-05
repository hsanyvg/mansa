const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Update handleSubmit
const regex1 = /bookingEmployeeId: orderBookingEmployeeId,\s*bookingEmployeeName: employees\.find\(e => e\.id === orderBookingEmployeeId\)\?\.name \|\| 'مجهول',\s*employeeId: orderBookingEmployeeId,\s*employeeName: employees\.find\(e => e\.id === orderBookingEmployeeId\)\?\.name \|\| 'مجهول',/g;

content = content.replace(regex1, `bookingEmployeeId: orderBookingEmployeeId,
        bookingEmployeeName: employees.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',
        employeeId: loggedInEmployeeId || 'admin',
        employeeName: isEmployee ? (loggedInSystemUserName || employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير',`);

// Update barcode saving
const regex2 = /bookingEmployeeId: orderBookingEmployeeId \|\| 'agent',\s*bookingEmployeeName: employees\?\.find\(e => e\.id === orderBookingEmployeeId\)\?\.name \|\| 'مجهول',\s*employeeId: orderBookingEmployeeId \|\| 'agent',\s*employeeName: employees\?\.find\(e => e\.id === orderBookingEmployeeId\)\?\.name \|\| 'مجهول',/g;

content = content.replace(regex2, `bookingEmployeeId: orderBookingEmployeeId || 'agent',
            bookingEmployeeName: employees?.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',
            employeeId: loggedInEmployeeId || 'admin',
            employeeName: isEmployee ? (loggedInSystemUserName || employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير',`);

fs.writeFileSync('App.js', content);
console.log("Fixed the mixup!");
