const fs = require('fs');
const html = fs.readFileSync('almasar_api.html', 'utf-8');

// Find all code blocks that look like JSON payloads for shipments
const codeRegex = /<code[^>]*>([\s\S]*?)<\/code>/gi;
let match;
while ((match = codeRegex.exec(html)) !== null) {
    let block = match[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (block.includes('receiver_name') && block.includes('amount_iqd') && block.includes('governorate_code')) {
        console.log("PAYLOAD FOUND:\n", block.substring(0, 1500));
        break; // just need the first good example of create shipment payload
    }
}
