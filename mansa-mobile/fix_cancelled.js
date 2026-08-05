const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

content = content.replace(
  "const cancelledCount = dashboardStats.cancelledCount;",
  "const cancelledCountForTab = dashboardStats.cancelledCount;"
);

content = content.replace(
  "const activeOrdersCountForTab = dashboardStats.todayOrdersCount - completedCount - cancelledCount - dashboardStats.returnedCountCard;",
  "const activeOrdersCountForTab = dashboardStats.todayOrdersCount - completedCount - cancelledCountForTab - dashboardStats.returnedCountCard;"
);

fs.writeFileSync('App.js', content);
console.log('Fixed cancelledCount duplicate');
