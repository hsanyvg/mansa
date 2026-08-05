const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Replace variables around line 1490
const oldStatsVars = /const deliveredCount.*?const totalCompletedCount.*?;/s;
const newStatsVars = `const {
    totalCompletedCount,
    partialCount,
    ofdOrdersCount,
    processedCount,
    newCount,
    postponedCount,
    returnedCountCard,
    cancelledCount,
    todayOrdersCount,
    todaySales
  } = dashboardStats;`;

if (oldStatsVars.test(content)) {
  content = content.replace(oldStatsVars, newStatsVars);
  console.log("Replaced stats vars at 1490");
} else {
  console.log("Failed to find stats vars at 1490");
}

// 2. Replace variables in renderOrdersTab around line 1373
const oldOrdersTabVars = /const completedCount = orders\.filter.*?const returnedCountCard = .*?;/s;
const newOrdersTabVars = `const completedCount = dashboardStats.totalCompletedCount;
  const cancelledCount = dashboardStats.cancelledCount;
  const activeOrdersCountForTab = dashboardStats.todayOrdersCount - completedCount - cancelledCount - dashboardStats.returnedCountCard;`;

if (oldOrdersTabVars.test(content)) {
  content = content.replace(oldOrdersTabVars, newOrdersTabVars);
  console.log("Replaced orders tab counters");
} else {
  console.log("Failed to find orders tab counters");
}

// 3. Replace Team Performance logic around line 2182
const oldTeamPerf = /const teamStats = employees\.map\(emp => \{[\s\S]*?return \{\s*emp,\s*total,\s*delivered,\s*returned,\s*cancelled,\s*pending\s*\};\s*\}\);/g;
const newTeamPerf = `// teamStats is already loaded from state!`;

if (oldTeamPerf.test(content)) {
  content = content.replace(oldTeamPerf, newTeamPerf);
  console.log("Replaced Team Performance logic");
} else {
  console.log("Failed to find Team Performance logic");
}

// 4. Update the Load More button to increment displayedOrdersCount
// It's located in the tabs, usually looking like `setDisplayedOrdersCount(prev => prev + 50)`
// We will replace all `prev + 50` with `prev + 100` just to be consistent with "100 by 100"
content = content.replace(/setDisplayedOrdersCount\(prev => prev \+ 50\)/g, 'setDisplayedOrdersCount(prev => prev + 100)');

fs.writeFileSync('App.js', content);
