const fs = require('fs');
const html = fs.readFileSync('almasar_api.html', 'utf-8');

// Use a regex to find all <pre><code> blocks and print them
const codeRegex = /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g;
let match;
let codeBlocks = [];
while ((match = codeRegex.exec(html)) !== null) {
    let block = match[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // Only keep block if it looks like JSON or is interesting
    if (block.includes('system_code') || block.includes('shipment') || block.includes('updates')) {
        codeBlocks.push(block);
    }
}

console.log(`Found ${codeBlocks.length} code blocks with 'system_code' or 'shipment' or 'updates'`);
codeBlocks.forEach((b, i) => {
    console.log(`\n--- Code Block ${i} ---`);
    console.log(b.substring(0, 1000));
});
