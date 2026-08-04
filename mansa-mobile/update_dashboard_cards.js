const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

// The exact block to replace starts at {/* Dashboard Stats */} and ends before {/* Team Performance Section */}
const cardsTargetStart = "{/* Dashboard Stats */}";
const cardsTargetEnd = "{/* Team Performance Section */}";

const startIndex = c.indexOf(cardsTargetStart);
const endIndex = c.indexOf(cardsTargetEnd);

if (startIndex !== -1 && endIndex !== -1) {
    const before = c.substring(0, startIndex);
    const after = c.substring(endIndex);
    
    const newCards = `{/* Dashboard Stats */}
          <View style={{ marginBottom: 20 }}>
            {/* Row 1 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('الشحنات المكتملة', totalCompletedCount, '#10b981', '#ffffff', 
                <Path d="M3 10h10a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5H3m0-12l4-4m-4 4l4 4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>, false, () => setActiveTab('completed_shipments'))}
              {renderCustomCard('راجع', returnedCountCard, '#ef4444', '#ffffff', 
                <><Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Path d="M3 3v5h5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>, false, () => setActiveTab('returned_shipments'))}
            </View>

            {/* Row 2 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('مؤجلة', postponedCount, '#f97316', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('postponed_shipments'))}
              {renderCustomCard('قيد المعالجة', newCount, '#27272a', '#ffffff', 
                <Path d="M5 22h14M5 2h14M8 2v5l4 5-4 5v5m8-20v5l-4 5 4 5v5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>, false)}
            </View>

            {/* Row 3 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('جزئي او استبدال', partialCount, '#34d399', '#ffffff', 
                <><Path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/><Path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/><Path d="M21 21v-5h-5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false)}
              {renderCustomCard('تمت المعالجة', processedCount, '#34d399', '#ffffff', 
                <Path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4M12 4v12M8 12l4 4 4-4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>, false)}
            </View>

            {/* Row 4 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('شحنات اليوم', todayOrdersCount, '#ffffff', '#94a3b8', 
                <><Circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/></>, true)}
              {renderCustomCard('في الطريق للشركة', ofdOrdersCount, '#eab308', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false)}
            </View>
          </View>

          `;
    c = before + newCards + after;
    fs.writeFileSync('App.js', c);
    console.log("Dashboard cards updated successfully!");
} else {
    console.log("Could not find targets in App.js");
}
