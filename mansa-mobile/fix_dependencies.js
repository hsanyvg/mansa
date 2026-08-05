const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Replace the dependency arrays to include filterMonth and filterYear
content = content.replace(
  /\[activeTab, globalDateFilter, customStartDate, customEndDate, ordersFilter, completedSubTab, ordersSearchQuery, completedSearchQuery\]/g,
  "[activeTab, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, ordersFilter, completedSubTab, ordersSearchQuery, completedSearchQuery]"
);

content = content.replace(
  /\[activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate\]/g,
  "[activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear]"
);

content = content.replace(
  /\[globalDateFilter, customStartDate, customEndDate, adminUid, user, employees\]/g,
  "[globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, employees]"
);

content = content.replace(
  /\[activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, adminUid, user, displayedOrdersCount\]/g,
  "[activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, displayedOrdersCount]"
);

fs.writeFileSync('App.js', content);
console.log("Fixed useEffect dependencies for Date Filter!");
