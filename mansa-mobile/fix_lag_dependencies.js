const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Remove the slice inside setOrders
content = content.replace(
  "setOrders(fetchedOrders.slice(0, displayedOrdersCount));",
  "setOrders(fetchedOrders);"
);

// 2. Remove displayedOrdersCount from the dependency array of fetchOrders
content = content.replace(
  "}, [activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, displayedOrdersCount]);",
  "}, [activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user]);"
);

fs.writeFileSync('App.js', content);
console.log("Fixed fetchOrders dependencies and slicing!");
