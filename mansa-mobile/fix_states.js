const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

content = content.replace(/.*const \[activeOrdersCount, setActiveOrdersCount\] = useState\(0\);.*\n?/g, '');
content = content.replace(/.*const \[todayOrdersCount, setTodayOrdersCount\] = useState\(0\);.*\n?/g, '');
content = content.replace(/.*const \[activeThisMonthCount, setActiveThisMonthCount\] = useState\(0\);.*\n?/g, '');
content = content.replace(/.*const \[newOrdersCount, setNewOrdersCount\] = useState\(0\);.*\n?/g, '');
content = content.replace(/.*const \[ofdOrdersCount, setOfdOrdersCount\] = useState\(0\);.*\n?/g, '');
content = content.replace(/.*const \[deliveredTodayCount, setDeliveredTodayCount\] = useState\(0\);.*\n?/g, '');
content = content.replace(/.*const \[rateThisMonth, setRateThisMonth\] = useState\(0\);.*\n?/g, '');
content = content.replace(/.*const \[todaySales, setTodaySales\] = useState\(0\);.*\n?/g, '');

fs.writeFileSync('App.js', content);
console.log('Removed duplicate states');
