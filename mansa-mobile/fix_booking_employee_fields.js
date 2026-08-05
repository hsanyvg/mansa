const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Update orderData in handleSubmit
const regex1 = /employeeId: orderBookingEmployeeId,\s*employeeName: employees\.find\(e => e\.id === orderBookingEmployeeId\)\?\.name \|\| 'مجهول',/g;
content = content.replace(regex1, `bookingEmployeeId: orderBookingEmployeeId,
        bookingEmployeeName: employees.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',
        employeeId: orderBookingEmployeeId,
        employeeName: employees.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',`);

// Update barcode saving
const regex2 = /employeeId: orderBookingEmployeeId \|\| 'agent',\s*employeeName: employees\?\.find\(e => e\.id === orderBookingEmployeeId\)\?\.name \|\| 'مجهول',/g;
content = content.replace(regex2, `bookingEmployeeId: orderBookingEmployeeId || 'agent',
            bookingEmployeeName: employees?.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',
            employeeId: orderBookingEmployeeId || 'agent',
            employeeName: employees?.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',`);

fs.writeFileSync('App.js', content);
console.log("Added bookingEmployeeName and bookingEmployeeId fields!");
