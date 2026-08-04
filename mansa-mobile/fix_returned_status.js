const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

// 1. returnedCountCard
c = c.replace(
  "const returnedCountCard = orders.filter(o => o.status === 'returned' || o.status === 'returned_warehouse').length;",
  "const returnedCountCard = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse').length;"
);

// 2. The header text "المرتجعات ({...})"
// It looks like:
// let fc = orders.filter(o => o.status === 'returned' || o.status === 'returned_warehouse');
// if (returnedSubTab === 'agent') fc = fc.filter(o => o.status === 'returned');
// else fc = fc.filter(o => o.status === 'returned_warehouse');
// We replace the entire text block inside the ()()}) function.
const oldHeader = "let fc = orders.filter(o => o.status === 'returned' || o.status === 'returned_warehouse');";
const newHeader = "let fc = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse');";
c = c.replace(oldHeader, newHeader);

// 3. returnedSubTab logic in the header
c = c.replace(
  "if (returnedSubTab === 'agent') fc = fc.filter(o => o.status === 'returned');",
  "if (returnedSubTab === 'agent') fc = fc.filter(o => o.status === 'returned' || o.status === 'returned_agent');"
);

// 4. subTabs counting (agentC and warehouseC)
const oldAllR = "const allR = orders.filter(o => o.status === 'returned' || o.status === 'returned_warehouse');";
const newAllR = "const allR = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse');";
c = c.replace(oldAllR, newAllR);

c = c.replace(
  "const agentC = allR.filter(o => o.status === 'returned').length;",
  "const agentC = allR.filter(o => o.status === 'returned' || o.status === 'returned_agent').length;"
);

// 5. list filtering
const oldListFilter = "let filtered = orders.filter(o => o.status === 'returned' || o.status === 'returned_warehouse');";
const newListFilter = "let filtered = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse');";
c = c.replace(oldListFilter, newListFilter);

c = c.replace(
  "if (returnedSubTab === 'agent') filtered = filtered.filter(o => o.status === 'returned');",
  "if (returnedSubTab === 'agent') filtered = filtered.filter(o => o.status === 'returned' || o.status === 'returned_agent');"
);

// 6. card text
c = c.replace(
  "(item.status === 'returned' ? 'عند المندوب' : 'في المخزن')",
  "((item.status === 'returned' || item.status === 'returned_agent') ? 'عند المندوب' : 'في المخزن')"
);

fs.writeFileSync('App.js', c);
console.log('App.js updated: Fixed returned status logic gracefully.');
