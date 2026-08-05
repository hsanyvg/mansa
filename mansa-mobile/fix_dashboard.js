const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

const oldDashboardPattern = /\{\/\*\s*Dashboard Stats\s*\*\/\}.*?\{\/\*\s*Team Performance Section\s*\*\/\}/s;

const newDashboardStr = `{/* Dashboard Stats */}
          <View style={{ marginBottom: 20 }}>
            {/* Row 1 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('الشحنات المكتملة', totalCompletedCount, '#10b981', '#ffffff', 
                <Path d="M3 10h10a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5H3m0-12l4-4m-4 4l4 4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>, false, () => setActiveTab('completed_shipments'))}
              {renderCustomCard('جزئي او استبدال', partialCount, '#34d399', '#ffffff', 
                <><Path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/><Path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/><Path d="M21 21v-5h-5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('partial_shipments'))}
            </View>

            {/* Row 2 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('في الطريق للشركة', ofdOrdersCount, '#eab308', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('ofd_shipments'))}
              {renderCustomCard('تمت المعالجة', processedCount, '#34d399', '#ffffff', 
                <Path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4M12 4v12M8 12l4 4 4-4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>, false, () => setActiveTab('processed_shipments'))}
            </View>

            {/* Row 3 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('قيد الإنتظار', newCount, '#27272a', '#ffffff', 
                <Path d="M5 22h14M5 2h14M8 2v5l4 5-4 5v5m8-20v5l-4 5 4 5v5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>, false, () => setActiveTab('pending_shipments'))}
              {renderCustomCard('مؤجلة', postponedCount, '#f97316', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('postponed_shipments'))}
            </View>

            {/* Row 4 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('راجع', returnedCountCard, '#ef4444', '#ffffff', 
                <><Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Path d="M3 3v5h5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>, false, () => setActiveTab('returned_shipments'))}
              {renderCustomCard('ملغي', cancelledCount, '#ef4444', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M15 9l-6 6M9 9l6 6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('orders'))}
            </View>
            
            {/* Row 5 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('الطلبات الكلية', todayOrdersCount, '#ffffff', '#94a3b8', 
                <><Circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/></>, true, () => setActiveTab('today_shipments'))}
              {renderCustomCard('المبيعات الكلية', todaySales + ' د.ع', '#ffffff', '#94a3b8', 
                <><Path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>, true, () => setActiveTab('dashboard'))}
            </View>
          </View>

          {/* Team Performance Section */}`;

if (oldDashboardPattern.test(content)) {
  const newContent = content.replace(oldDashboardPattern, newDashboardStr);
  fs.writeFileSync('App.js', newContent);
  console.log("Successfully replaced Dashboard Stats!");
} else {
  console.log("Could not find Dashboard Stats pattern.");
}
