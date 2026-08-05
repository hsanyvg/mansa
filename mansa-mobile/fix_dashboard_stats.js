const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /const fetchDashboardStats = async \(\) => \{.*?try \{.*?let baseQuery = collection\(db, 'users', adminUid, 'orders'\);.*?catch \(err\) \{.*?console\.log\("Error fetching stats:", err\);.*?\}\s*\};\s*fetchDashboardStats\(\);/s;

const newFetchDashboardStats = `const fetchDashboardStats = async () => {
      try {
        let baseQuery = collection(db, 'users', adminUid, 'orders');
        const range = getDateRange(globalDateFilter);
        
        if (!range) {
            // ALL TIME: Use server-side counts (No composite index required)
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
        } else {
            // SPECIFIC DATE RANGE: Fetch documents and count client-side (Bypasses missing composite indexes)
            const dateQuery = fsQuery(baseQuery, where('date', '>=', range.start), where('date', '<=', range.end));
            const snap = await getDocs(dateQuery);
            
            let stats = {
              totalCompletedCount: 0, partialCount: 0, ofdOrdersCount: 0, processedCount: 0,
              newCount: 0, postponedCount: 0, returnedCountCard: 0, cancelledCount: 0,
              todayOrdersCount: 0, todaySales: 0
            };
            
            let tStatsMap = {};
            if (employees && employees.length > 0) {
               employees.forEach(emp => {
                   tStatsMap[emp.id] = { emp, total: 0, delivered: 0, returned: 0, cancelled: 0, pending: 0 };
               });
            }

            snap.forEach(doc => {
               const data = doc.data();
               const status = data.status;
               stats.todayOrdersCount++;
               
               if (['delivered', 'delivered_settled'].includes(status)) {
                   stats.totalCompletedCount++;
                   stats.todaySales += (Number(data.totalAmount) || 0);
               } else if (['partial', 'replaced'].includes(status)) {
                   stats.partialCount++;
               } else if (['ofd', 'shipped'].includes(status)) {
                   stats.ofdOrdersCount++;
               } else if (['processed', 'confirmed'].includes(status)) {
                   stats.processedCount++;
               } else if (['pending', 'pending_warehouse', 'new'].includes(status)) {
                   stats.newCount++;
               } else if (status === 'postponed') {
                   stats.postponedCount++;
               } else if (['returned', 'returned_agent', 'returned_warehouse'].includes(status)) {
                   stats.returnedCountCard++;
               } else if (status === 'cancelled') {
                   stats.cancelledCount++;
               }
               
               // Team Stats Logic
               if (data.employeeId && tStatsMap[data.employeeId]) {
                   tStatsMap[data.employeeId].total++;
                   if (['delivered', 'delivered_settled'].includes(status)) {
                       tStatsMap[data.employeeId].delivered++;
                   } else if (['returned', 'returned_agent', 'returned_warehouse'].includes(status)) {
                       tStatsMap[data.employeeId].returned++;
                   } else if (status === 'cancelled') {
                       tStatsMap[data.employeeId].cancelled++;
                   } else {
                       tStatsMap[data.employeeId].pending++;
                   }
               }
            });
            
            setDashboardStats(stats);
            if (employees && employees.length > 0) {
               setTeamStats(Object.values(tStatsMap));
            }
        }
      } catch (err) {
        console.log("Error fetching stats:", err);
      }
    };
    fetchDashboardStats();`;

if (regex.test(content)) {
  content = content.replace(regex, newFetchDashboardStats);
  console.log("Successfully replaced fetchDashboardStats with hybrid logic!");
} else {
  console.log("Could not find fetchDashboardStats to replace.");
}

fs.writeFileSync('App.js', content);
