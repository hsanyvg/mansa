const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add new state variables for dashboardStats and teamStats after `const [todaySales, setTodaySales] = useState(0);`
const statsAnchor = 'const [todaySales, setTodaySales] = useState(0);';
const newStates = `const [todaySales, setTodaySales] = useState(0);
  const [dashboardStats, setDashboardStats] = useState({
    totalCompletedCount: 0, partialCount: 0, ofdOrdersCount: 0, processedCount: 0,
    newCount: 0, postponedCount: 0, returnedCountCard: 0, cancelledCount: 0,
    todayOrdersCount: 0, todaySales: 0
  });
  const [teamStats, setTeamStats] = useState([]);
  const [displayedOrdersCount, setDisplayedOrdersCount] = useState(100);`;

content = content.replace(statsAnchor, newStates);

// 2. Replace the existing Orders fetch useEffect
const oldEffectRegex = /\/\/ Fetch Firestore Orders\s*useEffect\(\(\) => \{[\s\S]*?setOfdOrdersCount\(countOfd\);\s*\}\);\s*return \(\) => unsub\(\);\s*\}, \[.*?\]\);/g;

const newFetchLogic = `// ------------------ NEW DATA FETCHING (PAGINATION + AGGREGATION) ------------------

  // Reset pagination when tab or filters change
  useEffect(() => {
    setDisplayedOrdersCount(100);
  }, [activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear]);

  // 1. Fetch Dashboard Stats & Team Stats
  useEffect(() => {
    if (!user || !adminUid) return;
    
    const fetchDashboardStats = async () => {
      try {
        let baseQuery = collection(db, 'users', adminUid, 'orders');
        const range = getDateRange(globalDateFilter);
        if (range) {
          baseQuery = fsQuery(baseQuery, where('date', '>=', range.start), where('date', '<=', range.end));
        }

        const qCompleted = fsQuery(baseQuery, where('status', 'in', ['delivered', 'delivered_settled']));
        const qPartial = fsQuery(baseQuery, where('status', 'in', ['partial', 'replaced']));
        const qOfd = fsQuery(baseQuery, where('status', 'in', ['ofd', 'shipped']));
        const qProcessed = fsQuery(baseQuery, where('status', 'in', ['processed', 'confirmed']));
        const qNew = fsQuery(baseQuery, where('status', 'in', ['pending', 'pending_warehouse', 'new']));
        const qPostponed = fsQuery(baseQuery, where('status', '==', 'postponed'));
        const qReturned = fsQuery(baseQuery, where('status', 'in', ['returned', 'returned_agent', 'returned_warehouse']));
        const qCancelled = fsQuery(baseQuery, where('status', '==', 'cancelled'));

        const [cCompleted, cPartial, cOfd, cProcessed, cNew, cPostponed, cReturned, cCancelled, cTotal] = await Promise.all([
          getCountFromServer(qCompleted), getCountFromServer(qPartial), getCountFromServer(qOfd),
          getCountFromServer(qProcessed), getCountFromServer(qNew), getCountFromServer(qPostponed),
          getCountFromServer(qReturned), getCountFromServer(qCancelled), getCountFromServer(baseQuery)
        ]);

        const sumAgg = await getAggregateFromServer(qCompleted, { totalAmount: sum('totalAmount') });

        setDashboardStats({
          totalCompletedCount: cCompleted.data().count,
          partialCount: cPartial.data().count,
          ofdOrdersCount: cOfd.data().count,
          processedCount: cProcessed.data().count,
          newCount: cNew.data().count,
          postponedCount: cPostponed.data().count,
          returnedCountCard: cReturned.data().count,
          cancelledCount: cCancelled.data().count,
          todayOrdersCount: cTotal.data().count,
          todaySales: sumAgg.data().totalAmount || 0,
        });

        // Team Stats
        if (employees && employees.length > 0) {
           const tStats = await Promise.all(employees.map(async emp => {
              const empQ = fsQuery(baseQuery, where('employeeId', '==', emp.id));
              const empTotal = await getCountFromServer(empQ);
              const empDelivered = await getCountFromServer(fsQuery(empQ, where('status', 'in', ['delivered', 'delivered_settled'])));
              const empReturned = await getCountFromServer(fsQuery(empQ, where('status', 'in', ['returned', 'returned_agent', 'returned_warehouse'])));
              const empCancelled = await getCountFromServer(fsQuery(empQ, where('status', '==', 'cancelled')));
              
              return {
                 emp,
                 total: empTotal.data().count,
                 delivered: empDelivered.data().count,
                 returned: empReturned.data().count,
                 cancelled: empCancelled.data().count,
                 pending: Math.max(0, empTotal.data().count - empDelivered.data().count - empReturned.data().count - empCancelled.data().count)
              };
           }));
           setTeamStats(tStats);
        }

      } catch (err) {
        console.log("Error fetching stats:", err);
      }
    };
    fetchDashboardStats();
  }, [globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, employees]);

  // 2. Fetch Paginated Orders for Active Tab
  useEffect(() => {
    if (!user || !adminUid) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    let ordersQuery = collection(db, 'users', adminUid, 'orders');
    const range = getDateRange(globalDateFilter);
    if (range) {
      ordersQuery = fsQuery(ordersQuery, where('date', '>=', range.start), where('date', '<=', range.end));
    }

    // Apply specific filters based on activeTab
    if (activeTab === 'completed_shipments') {
      ordersQuery = fsQuery(ordersQuery, where('status', 'in', ['delivered', 'delivered_settled']));
    } else if (activeTab === 'returned_shipments') {
      ordersQuery = fsQuery(ordersQuery, where('status', 'in', ['returned', 'returned_agent', 'returned_warehouse']));
    } else if (activeTab === 'postponed_shipments') {
      ordersQuery = fsQuery(ordersQuery, where('status', '==', 'postponed'));
    } else if (activeTab === 'pending_shipments') {
      ordersQuery = fsQuery(ordersQuery, where('status', 'in', ['pending', 'pending_warehouse', 'new']));
    } else if (activeTab === 'partial_shipments') {
      ordersQuery = fsQuery(ordersQuery, where('status', 'in', ['partial', 'replaced']));
    } else if (activeTab === 'processed_shipments') {
      ordersQuery = fsQuery(ordersQuery, where('status', 'in', ['processed', 'confirmed']));
    } else if (activeTab === 'ofd_shipments') {
      ordersQuery = fsQuery(ordersQuery, where('status', 'in', ['ofd', 'shipped']));
    } else if (activeTab === 'orders') {
      if (ordersFilter === 'completed') {
        ordersQuery = fsQuery(ordersQuery, where('status', 'in', ['delivered', 'partial']));
      } else if (ordersFilter === 'active') {
        ordersQuery = fsQuery(ordersQuery, where('status', 'in', ['pending', 'new', 'ofd', 'shipped', 'postponed', 'processed', 'confirmed', 'pending_warehouse', 'backordered']));
      }
    }

    ordersQuery = fsQuery(ordersQuery, orderBy('date', 'desc'), limit(displayedOrdersCount));

    const unsub = onSnapshot(ordersQuery, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(o => o.isDeleted !== true);
      setOrders(allOrders);
      setLoading(false);
    });
    
    return () => unsub();
  }, [activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, displayedOrdersCount]);

  // --------------------------------------------------------------------------------`;

content = content.replace(oldEffectRegex, newFetchLogic);

fs.writeFileSync('App.js', content);
console.log('Script completed.');
