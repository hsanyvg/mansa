const fs = require('fs');
const html = fs.readFileSync('almasar_api.html', 'utf-8');

const codeRegex = /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi;
let match;
while ((match = codeRegex.exec(html)) !== null) {
    let block = match[1].replace(/&quot;/g, '"');
    if (block.includes('username')) {
        console.log(block);
    }
}
