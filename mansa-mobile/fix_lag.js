const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /\/\/ 2\. Fetch Paginated Orders for Active Tab.*?return \(\) => unsub\(\);\s*\}, \[activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, displayedOrdersCount\]\);/s;

const newFetchOrders = `// 2. Fetch Paginated Orders for Active Tab
  useEffect(() => {
    if (!user || !adminUid) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    let ordersQuery = collection(db, 'users', adminUid, 'orders');
    const range = getDateRange(globalDateFilter);
    
    // We MUST limit the query to avoid downloading massive amounts of data and crashing the app.
    // Dashboard Stats are handled by the server separately, so this list only needs to show recent items.
    if (range) {
      ordersQuery = fsQuery(
        ordersQuery, 
        where('date', '>=', range.start), 
        where('date', '<=', range.end),
        orderBy('date', 'desc'),
        limit(800)
      );
    } else {
      ordersQuery = fsQuery(ordersQuery, orderBy('date', 'desc'), limit(800));
    }

    const unsub = onSnapshot(ordersQuery, (snapshot) => {
      let fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(o => o.isDeleted !== true);

      // Local Filtering based on tab
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

      // Slicing to the displayed count to avoid rendering lag
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
  console.log("Successfully fixed lag!");
} else {
  console.log("Could not find fetchOrders to replace.");
}

fs.writeFileSync('App.js', content);
