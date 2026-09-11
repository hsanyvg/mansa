const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('app/page.tsx', 'utf8');
try {
  parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  console.log('No error');
} catch (e) {
  console.error(e);
}
