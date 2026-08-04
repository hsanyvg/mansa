const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

// 1. Add state variables for new screens
const stateRegex = /const \[completedSubTab, setCompletedSubTab\] = useState\('unaccounted'\);/;
if (!c.includes('returnedSubTab')) {
    c = c.replace(stateRegex, "const [completedSubTab, setCompletedSubTab] = useState('unaccounted');\n  const [returnedSubTab, setReturnedSubTab] = useState('agent');\n  const [postponedSearchQuery, setPostponedSearchQuery] = useState('');\n  const [returnedSearchQuery, setReturnedSearchQuery] = useState('');");
}

// 2. Add returnedCount computation
const countRegex = /const cancelledCount = orders\.filter\(o => o\.status === 'cancelled' \|\| o\.status === 'returned'\)\.length;/;
if (!c.includes('const returnedCountCard =')) {
    c = c.replace(countRegex, "const cancelledCount = orders.filter(o => o.status === 'cancelled').length;\n  const returnedCountCard = orders.filter(o => o.status === 'returned' || o.status === 'returned_warehouse').length;");
}

// 3. Remove "Successful Shipments" (deliveredCount) from dashboard cards, add "Returned" card, and update "Postponed" card
const cardsRegex = /\{\/\* Cards row 1 \*\/\}([\s\S]*?)\{\/\* Action buttons \*\/\}/;
const newCards = `
            {/* Cards row 1 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 }}>
              {renderCustomCard('الشحنات المكتملة', totalCompletedCount, '#10b981', '#ffffff', 
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Path d="M22 4L12 14.01l-3-3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg>,
                true, () => setActiveTab('completed_shipments')
              )}
              {renderCustomCard('راجع', returnedCountCard, '#ef4444', '#ffffff', 
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Path d="M3 3v5h5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg>,
                true, () => setActiveTab('returned_shipments')
              )}
            </View>

            {/* Cards row 2 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 }}>
              {renderCustomCard('مؤجلة', postponedCount, '#f97316', '#ffffff', 
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg>,
                true, () => setActiveTab('postponed_shipments')
              )}
              {renderCustomCard('قيد الإنتظار', newCount, '#27272a', '#ffffff', 
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 8v4l3 3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg>,
                true
              )}
            </View>

            {/* Cards row 3 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 }}>
              {renderCustomCard('تسليم جزئي', partialCount, '#34d399', '#ffffff', 
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Path d="M3.27 6.96L12 12.01l8.73-5.05" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Path d="M12 22.08V12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg>,
                true
              )}
              {renderCustomCard('قيد المعالجة', processedCount, '#34d399', '#ffffff', 
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg>,
                true
              )}
            </View>
            
            {/* Cards row 4 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20 }}>
              {renderCustomCard('طلبات اليوم', todayOrdersCount, '#ffffff', '#94a3b8', 
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="#94a3b8" strokeWidth="2"/><Path d="M16 2v4M8 2v4M3 10h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg>,
                false
              )}
              {renderCustomCard('قيد التوصيل', ofdOrdersCount, '#eab308', '#ffffff', 
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M5 18H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Path d="M14 18H9M19 18h2a2 2 0 0 0 2-2v-5l-3-4h-5v11z" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Circle cx="7" cy="18" r="2" stroke="#ffffff" strokeWidth="2"/><Circle cx="17" cy="18" r="2" stroke="#ffffff" strokeWidth="2"/></Svg>,
                true
              )}
            </View>

            {/* Action buttons */}`;
if (c.match(cardsRegex)) {
    c = c.replace(cardsRegex, newCards);
}

// 4. Add the postponed and returned screens after completed_shipments screen
const newScreens = `

      {/* Postponed Shipments Screen */}
      {activeTab === 'postponed_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#f97316', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>الطلبات المؤجلة ({orders.filter(o => o.status === 'postponed').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={postponedSearchQuery} onChangeText={setPostponedSearchQuery} />
            </View>
          </View>
          <ScrollView style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'postponed');
              if (postponedSearchQuery.trim()) {
                const q = postponedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  {filtered.slice(0, displayedOrdersCount).map((item, index) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#f97316' }}>رقم الوصل: {item.receiptNumber}</Text>
                         <Text style={{ color: '#666' }}>مؤجلة</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? item.totalAmount.toLocaleString() + ' د.ع' : '-'}</Text>
                       {item.postponeReason && <Text style={{ textAlign: 'right', color: '#f97316', marginTop: 5 }}>السبب: {item.postponeReason}</Text>}
                       <TouchableOpacity style={{ marginTop: 10, backgroundColor: '#f97316', paddingVertical: 8, borderRadius: 5, alignItems: 'center' }} onPress={() => { setSelectedOrderForDetails(item); setOrderDetailsModalVisible(true); }}>
                         <Text style={{ color: '#fff', fontWeight: 'bold' }}>عرض التفاصيل</Text>
                       </TouchableOpacity>
                    </View>
                  ))}
                  {filtered.length > displayedOrdersCount && (
                    <TouchableOpacity style={{ padding: 15, backgroundColor: '#f97316', borderRadius: 8, alignItems: 'center', marginBottom: 30 }} onPress={() => setDisplayedOrdersCount(prev => prev + 20)}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>عرض المزيد</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* Returned Shipments Screen */}
      {activeTab === 'returned_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#ef4444', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                المرتجعات ({(() => {
                  let fc = orders.filter(o => o.status === 'returned' || o.status === 'returned_warehouse');
                  if (returnedSubTab === 'agent') fc = fc.filter(o => o.status === 'returned');
                  else fc = fc.filter(o => o.status === 'returned_warehouse');
                  if (returnedSearchQuery.trim()) {
                    const q = returnedSearchQuery.toLowerCase();
                    fc = fc.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
                  }
                  return fc.length;
                })()})
              </Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={returnedSearchQuery} onChangeText={setReturnedSearchQuery} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 15, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' }}>
               {(() => {
                  const allR = orders.filter(o => o.status === 'returned' || o.status === 'returned_warehouse');
                  const agentC = allR.filter(o => o.status === 'returned').length;
                  const warehouseC = allR.filter(o => o.status === 'returned_warehouse').length;
                  return (
                    <>
                       <TouchableOpacity style={{ flex: 1, paddingVertical: 10, backgroundColor: returnedSubTab === 'warehouse' ? '#ef4444' : '#fff' }} onPress={() => setReturnedSubTab('warehouse')}>
                         <Text style={{ textAlign: 'center', color: returnedSubTab === 'warehouse' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>راجع في المخزن ({warehouseC})</Text>
                       </TouchableOpacity>
                       <TouchableOpacity style={{ flex: 1, paddingVertical: 10, backgroundColor: returnedSubTab === 'agent' ? '#ef4444' : '#fff' }} onPress={() => setReturnedSubTab('agent')}>
                         <Text style={{ textAlign: 'center', color: returnedSubTab === 'agent' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>راجع عند المندوب ({agentC})</Text>
                       </TouchableOpacity>
                    </>
                  )
               })()}
            </View>
          </View>
          <ScrollView style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'returned' || o.status === 'returned_warehouse');
              if (returnedSubTab === 'agent') filtered = filtered.filter(o => o.status === 'returned');
              else filtered = filtered.filter(o => o.status === 'returned_warehouse');
              
              if (returnedSearchQuery.trim()) {
                const q = returnedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  {filtered.slice(0, displayedOrdersCount).map((item, index) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#ef4444' }}>رقم الوصل: {item.receiptNumber}</Text>
                         <Text style={{ color: '#666' }}>{item.status === 'returned' ? 'عند المندوب' : 'في المخزن'}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? item.totalAmount.toLocaleString() + ' د.ع' : '-'}</Text>
                       <TouchableOpacity style={{ marginTop: 10, backgroundColor: '#ef4444', paddingVertical: 8, borderRadius: 5, alignItems: 'center' }} onPress={() => { setSelectedOrderForDetails(item); setOrderDetailsModalVisible(true); }}>
                         <Text style={{ color: '#fff', fontWeight: 'bold' }}>عرض التفاصيل</Text>
                       </TouchableOpacity>
                    </View>
                  ))}
                  {filtered.length > displayedOrdersCount && (
                    <TouchableOpacity style={{ padding: 15, backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center', marginBottom: 30 }} onPress={() => setDisplayedOrdersCount(prev => prev + 20)}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>عرض المزيد</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* Main Tab View */}`;

if (!c.includes("activeTab === 'returned_shipments'")) {
    c = c.replace("{/* Main Tab View */}", newScreens);
}

fs.writeFileSync('App.js', c);
console.log("App.js updated successfully!");
