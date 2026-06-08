const fs = require('fs');
const html = fs.readFileSync('almasar_api.html', 'utf-8');

const cleanText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const start = cleanText.indexOf('Who Calls Who?');
if (start !== -1) {
    console.log(cleanText.substring(start, start + 3000));
}

const start2 = cleanText.indexOf('Registration Guide');
if (start2 !== -1) {
    console.log('\n\n--- REGISTRATION GUIDE ---');
    console.log(cleanText.substring(start2, start2 + 3000));
}
