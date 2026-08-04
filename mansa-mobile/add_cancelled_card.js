const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

// 1. Add cancelledCount
const newCountLine = "const newCount = orders.filter(o => o.status === 'pending' || o.status === 'pending_warehouse' || o.status === 'new').length;";
const cancelledCountLine = "const cancelledCount = orders.filter(o => o.status === 'cancelled').length;";
if (!c.includes(cancelledCountLine)) {
  c = c.replace(newCountLine, newCountLine + "\n  " + cancelledCountLine);
}

// 2. Add the cancelled card
const row4End = `              {renderCustomCard('في الطريق للشركة', ofdOrdersCount, '#eab308', '#ffffff', \n                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('ofd_shipments'))}\n            </View>`;

const row5 = `
            {/* Row 5 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('ملغي', cancelledCount, '#ef4444', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M15 9l-6 6M9 9l6 6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('cancelled_shipments'))}
            </View>`;

if (!c.includes("Row 5")) {
  c = c.replace(row4End, row4End + row5);
}

// 3. Add the cancelled_shipments screen
// Let's inject it before "{activeTab === 'today_shipments' && ("
const screenAnchor = "{activeTab === 'today_shipments' && (";
const cancelledScreen = `
      {/* Cancelled Screen */}
      {activeTab === 'cancelled_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#ef4444', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                ملغي ({orders.filter(o => o.status === 'cancelled').length})
              </Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={cancelledSearchQuery || ''} onChangeText={t => setCancelledSearchQuery(t)} />
            </View>
          </View>
          <ScrollView style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'cancelled');
              if (cancelledSearchQuery && cancelledSearchQuery.trim()) {
                const q = cancelledSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  {filtered.slice(0, displayedOrdersCount).map((item, index) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <Text style={{ fontWeight: 'bold', color: '#ef4444', textAlign: 'right', marginBottom: 10 }}>رقم الوصل: {item.receiptNumber}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? item.totalAmount.toLocaleString() + ' د.ع' : '-'}</Text>
                    </View>
                  ))}
                  {filtered.length > displayedOrdersCount && (
                     <TouchableOpacity onPress={() => setDisplayedOrdersCount(prev => prev + 50)} style={{ backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 20 }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>عرض المزيد</Text>
                     </TouchableOpacity>
                  )}
                </>
              )
            })()}
          </ScrollView>
        </View>
      )}
`;

if (!c.includes("activeTab === 'cancelled_shipments'")) {
  c = c.replace(screenAnchor, cancelledScreen + "\n" + screenAnchor);
}

// 4. Add cancelledSearchQuery state
const stateAnchor = "const [returnedSearchQuery, setReturnedSearchQuery] = useState('');";
const cancelledState = "const [cancelledSearchQuery, setCancelledSearchQuery] = useState('');";
if (!c.includes(cancelledState)) {
  c = c.replace(stateAnchor, stateAnchor + "\n  " + cancelledState);
}

fs.writeFileSync('App.js', c);
console.log('App.js updated successfully!');
