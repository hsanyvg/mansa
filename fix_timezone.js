const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'employees', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Inject helper function after the imports
content = content.replace(
  `export default function EmployeesPage() {\n`,
  `const toLocalDate = (d: Date) => {\n  const date = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));\n  return date.toISOString().split('T')[0];\n};\n\nexport default function EmployeesPage() {\n`
);

// Replace all .toISOString().split('T')[0] with toLocalDate(...)
// Wait, regex to match something like `dateRange.start.toISOString().split('T')[0]`
content = content.replace(/new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g, "toLocalDate(new Date())");
content = content.replace(/employee\.joinDate \|\| new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g, "employee.joinDate || toLocalDate(new Date())");
content = content.replace(/dateRange\.start\.toISOString\(\)\.split\('T'\)\[0\]/g, "toLocalDate(dateRange.start)");
content = content.replace(/dateRange\.end\.toISOString\(\)\.split\('T'\)\[0\]/g, "toLocalDate(dateRange.end)");
content = content.replace(/d\.toISOString\(\)\.split\('T'\)\[0\]/g, "toLocalDate(d)");
content = content.replace(/iterDate\.toISOString\(\)\.split\('T'\)\[0\]/g, "toLocalDate(iterDate)");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed timezone issues.');
