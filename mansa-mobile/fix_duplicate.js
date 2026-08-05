const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Find the second declaration and remove it
const duplicate = "  const [displayedOrdersCount, setDisplayedOrdersCount] = useState(100);\n";
const firstIndex = content.indexOf(duplicate);
if (firstIndex !== -1) {
  const secondIndex = content.indexOf(duplicate, firstIndex + duplicate.length);
  if (secondIndex !== -1) {
    const prefix = content.substring(0, secondIndex);
    const suffix = content.substring(secondIndex + duplicate.length);
    content = prefix + suffix;
    fs.writeFileSync('App.js', content);
    console.log("Duplicate declaration removed!");
  } else {
    // maybe it has different spacing
    console.log("Could not find second exact duplicate");
  }
} else {
  console.log("Could not find first declaration");
}
