const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

content = content.replace(
    /paddingBottom: 100/g,
    "paddingBottom: 80"
);

content = content.replace(
    /paddingBottom: 90/g,
    "paddingBottom: 70"
);

content = content.replace(
    /height: 70,\s*backgroundColor: 'rgba\(20, 20, 30, 0\.95\)',/g,
    "height: 55,\n    backgroundColor: 'rgba(20, 20, 30, 0.95)',"
);

content = content.replace(
    /paddingVertical: 10,\s*\},/g,
    "paddingVertical: 5,\n  },"
);

fs.writeFileSync('App.js', content);
console.log("Updated bottom bar height!");
