const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\Hasan\\.gemini\\antigravity-ide\\brain\\c6acf1ad-2853-4ae3-8c06-cf5b1d4e0da2\\.system_generated\\steps\\636\\content.md';

try {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log("File length:", content.length);

  // Search for any URL containing artifacts/eas
  const regex = /https:\/\/expo\.dev\/artifacts\/eas\/[a-zA-Z0-9_\-\.\/]+/g;
  const matches = content.match(regex);
  console.log("Matches found:", matches);
  
  // Search for any JSON state that might contain appUrl
  const jsonRegex = /"artifacts"\s*:\s*\{[^\}]+}/g;
  const jsonMatches = content.match(jsonRegex);
  console.log("JSON matches:", jsonMatches);

  // Print all URL-like strings containing eas or artifacts
  const urls = content.match(/https?:\/\/[a-zA-Z0-9_\-\.\/]+/g) || [];
  const filtered = urls.filter(u => u.includes('artifact') || u.includes('eas') || u.includes('apk'));
  console.log("Filtered URLs:", [...new Set(filtered)]);

} catch (err) {
  console.error("Error reading file:", err);
}
