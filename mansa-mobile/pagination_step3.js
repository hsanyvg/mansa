const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const statesToRemove = [
  "  const [todaySales, setTodaySales] = useState(0);",
  "  const [activeOrdersCount, setActiveOrdersCount] = useState(0);",
  "  const [todayOrdersCount, setTodayOrdersCount] = useState(0);",
  "  const [rateThisMonth, setRateThisMonth] = useState(0);",
  "  const [activeThisMonthCount, setActiveThisMonthCount] = useState(0);",
  "  const [newOrdersCount, setNewOrdersCount] = useState(0);",
  "  const [ofdOrdersCount, setOfdOrdersCount] = useState(0);",
  "  const [deliveredTodayCount, setDeliveredTodayCount] = useState(0);"
];

for (const state of statesToRemove) {
  content = content.replace(state + '\\r\\n', '');
  content = content.replace(state + '\\n', '');
}

fs.writeFileSync('App.js', content);
console.log("Removed useless states successfully");
