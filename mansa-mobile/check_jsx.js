const fs = require('fs');
const babel = require('@babel/core');

try {
  const code = fs.readFileSync('App.js', 'utf8');
  babel.transformSync(code, {
    presets: ['@babel/preset-react'],
    filename: 'App.js'
  });
  console.log("JSX is valid!");
} catch (e) {
  console.error("JSX Error:", e.message);
}
