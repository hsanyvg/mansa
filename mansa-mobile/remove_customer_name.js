const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Remove Input Name block
const inputNameRegex = /\s*\{\/\* Input Name \*\/\}\s*<View style=\{styles\.formGroup\}>\s*<TextInput\s*style=\{\[styles\.input,\s*isFieldInvalid\(customerName\)\s*&&\s*styles\.inputError\]\}\s*value=\{customerName\}\s*onChangeText=\{setCustomerName\}\s*placeholder="اسم الزبون \*"\s*placeholderTextColor="rgba\(255,255,255,0\.3\)"\s*\/>\s*<\/View>/g;

content = content.replace(inputNameRegex, '');

fs.writeFileSync('App.js', content);
console.log("Removed Input Name UI!");
