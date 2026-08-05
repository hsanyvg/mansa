const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const targetState = `  const [orders, setOrders] = useState([]);`;
const replaceState = `  const [orders, setOrders] = useState([]);
  const [displayedOrdersCount, setDisplayedOrdersCount] = useState(100);
  const [dashboardStats, setDashboardStats] = useState({
    totalCompletedCount: 0, partialCount: 0, ofdOrdersCount: 0, processedCount: 0,
    newCount: 0, postponedCount: 0, returnedCountCard: 0, cancelledCount: 0,
    todayOrdersCount: 0, todaySales: 0
  });
  const [teamStats, setTeamStats] = useState([]);`;

content = content.replace(targetState, replaceState);
fs.writeFileSync('App.js', content);
console.log("Replaced states successfully");
