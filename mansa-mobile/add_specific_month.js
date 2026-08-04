const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

const target = "case 'custom':";
const replacement = `case 'specific_month':
        start = new Date(filterYear, filterMonth, 1, 0, 0, 0, 0);
        end = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59, 999);
        break;
      case 'custom':`;

if (c.includes(target) && !c.includes("case 'specific_month':")) {
    c = c.replace(target, replacement);
    fs.writeFileSync('App.js', c);
    console.log("Added specific_month logic to getDateRange.");
} else {
    console.log("Not found or already added.");
}
