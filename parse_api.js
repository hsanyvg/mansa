const fs = require('fs');

try {
    const html = fs.readFileSync('almasar_api.html', 'utf-8');
    
    // Remove scripts and styles
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Replace block-level tags with newlines
    text = text.replace(/<\/(div|p|h[1-6]|section|table|tr|li)>/gi, '\n');
    text = text.replace(/<(br|hr)\s*\/?>/gi, '\n');
    
    // Remove all remaining tags
    text = text.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    
    // Remove extra whitespace
    text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    
    // Save to a text file
    fs.writeFileSync('almasar_api.txt', text, 'utf-8');
    
    // Print the first 2000 characters to get an idea
    console.log(text.substring(0, 2000));
} catch (error) {
    console.error("Error:", error);
}
