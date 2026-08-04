const fs = require('fs');

let App = fs.readFileSync('App.js', 'utf8');

// Remove the duplicate declarations from the new block
App = App.replace("  const [expenseCategoriesDb, setExpenseCategoriesDb] = useState([]);\n", "");
App = App.replace("  const [walletsDb, setWalletsDb] = useState([]);\n", "");

fs.writeFileSync('App.js', App);
console.log("Duplicate declarations removed!");
