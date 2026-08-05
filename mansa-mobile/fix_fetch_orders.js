const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /\/\/ 2\. Fetch Paginated Orders for Active Tab.*?return \(\) => unsub\(\);\s*\}, \[activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, displayedOrdersCount\]\);/s;

const newFetchOrders = `// 2. Fetch Paginated Orders for Active Tab (Hybrid logic to avoid Composite Indexes)
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
      // If date range is selected, query by date (No status filter to avoid composite index)
      ordersQuery = fsQuery(ordersQuery, where('date', '>=', range.start), where('date', '<=', range.end), orderBy('date', 'desc'));
    } else {
      // If "All Time", limit the query to avoid downloading 15,000 orders at once
      // We must fetch enough to allow local status filtering to find 100 items. 
      ordersQuery = fsQuery(ordersQuery, orderBy('date', 'desc'), limit(1000));
    }

    const unsub = onSnapshot(ordersQuery, (snapshot) => {
      let fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(o => o.isDeleted !== true);

      // 1. Filter by status locally based on activeTab
      if (activeTab === 'completed_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['delivered', 'delivered_settled'].includes(o.status));
      } else if (activeTab === 'returned_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['returned', 'returned_agent', 'returned_warehouse'].includes(o.status));
      } else if (activeTab === 'postponed_shipments') {
        fetchedOrders = fetchedOrders.filter(o => o.status === 'postponed');
      } else if (activeTab === 'pending_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['pending', 'pending_warehouse', 'new'].includes(o.status));
      } else if (activeTab === 'partial_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['partial', 'replaced'].includes(o.status));
      } else if (activeTab === 'processed_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['processed', 'confirmed'].includes(o.status));
      } else if (activeTab === 'ofd_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['ofd', 'shipped'].includes(o.status));
      } else if (activeTab === 'orders') {
        if (ordersFilter === 'completed') {
          fetchedOrders = fetchedOrders.filter(o => ['delivered', 'partial'].includes(o.status));
        } else if (ordersFilter === 'active') {
          fetchedOrders = fetchedOrders.filter(o => ['pending', 'new', 'ofd', 'shipped', 'postponed', 'processed', 'confirmed', 'pending_warehouse', 'backordered'].includes(o.status));
        }
      }

      // 2. Pagination slice
      setOrders(fetchedOrders.slice(0, displayedOrdersCount));
      setLoading(false);
    }, (error) => {
      console.log("Error fetching orders:", error);
      setLoading(false);
    });
    
    return () => unsub();
  }, [activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, displayedOrdersCount]);`;

if (regex.test(content)) {
  content = content.replace(regex, newFetchOrders);
  console.log("Successfully replaced fetchOrders with hybrid logic!");
} else {
  console.log("Could not find fetchOrders to replace.");
}

fs.writeFileSync('App.js', content);
