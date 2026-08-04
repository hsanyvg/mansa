const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

// 1. Add state variables for the 5 new screens
const stateRegex = "const [returnedSearchQuery, setReturnedSearchQuery] = useState('');";
const newStates = `
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const [todaySearchQuery, setTodaySearchQuery] = useState('');
  const [partialSearchQuery, setPartialSearchQuery] = useState('');
  const [processedSearchQuery, setProcessedSearchQuery] = useState('');
  const [ofdSearchQuery, setOfdSearchQuery] = useState('');`;

if (c.includes(stateRegex) && !c.includes('pendingSearchQuery')) {
    c = c.replace(stateRegex, stateRegex + newStates);
}

// 2. Update dashboard cards: renaming and adding onPress handlers
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
              {renderCustomCard('قيد الإنتظار', newCount, '#27272a', '#ffffff', 
                <Path d="M5 22h14M5 2h14M8 2v5l4 5-4 5v5m8-20v5l-4 5 4 5v5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>, false, () => setActiveTab('pending_shipments'))}
            </View>

            {/* Row 3 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('جزئي او استبدال', partialCount, '#34d399', '#ffffff', 
                <><Path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/><Path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/><Path d="M21 21v-5h-5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('partial_shipments'))}
              {renderCustomCard('تمت المعالجة', processedCount, '#34d399', '#ffffff', 
                <Path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4M12 4v12M8 12l4 4 4-4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>, false, () => setActiveTab('processed_shipments'))}
            </View>

            {/* Row 4 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('شحنات اليوم', todayOrdersCount, '#ffffff', '#94a3b8', 
                <><Circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/></>, true, () => setActiveTab('today_shipments'))}
              {renderCustomCard('في الطريق للشركة', ofdOrdersCount, '#eab308', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('ofd_shipments'))}
            </View>
          </View>

          `;
    c = before + newCards + after;
}

// Helper to generate screen UI string
function generateScreen(tabName, title, bgColor, queryVar, setQueryVar, itemsFilterFuncStr, countStr) {
    let headerTextColor = bgColor === '#ffffff' ? '#333' : '#fff';
    let iconStrokeColor = bgColor === '#ffffff' ? '#333' : '#ffffff';
    let inputBgColor = bgColor === '#ffffff' ? '#f1f5f9' : '#fff';
    let moreBgColor = bgColor === '#ffffff' ? '#cbd5e1' : bgColor;
    
    return `
      {/* ${title} Screen */}
      {activeTab === '${tabName}' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '${bgColor}', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '${headerTextColor}', fontSize: 18, fontWeight: 'bold' }}>${title} ({${countStr}})</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="${iconStrokeColor}" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '${inputBgColor}', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={${queryVar}} onChangeText={${setQueryVar}} />
            </View>
          </View>
          <ScrollView style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = ${itemsFilterFuncStr};
              if (${queryVar}.trim()) {
                const q = ${queryVar}.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  {filtered.slice(0, displayedOrdersCount).map((item, index) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '${headerTextColor}' }}>رقم الوصل: {item.receiptNumber}</Text>
                         <Text style={{ color: '#666' }}>{item.status}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  ))}
                  {filtered.length > displayedOrdersCount && (
                    <TouchableOpacity style={{ padding: 15, backgroundColor: '${moreBgColor}', borderRadius: 8, alignItems: 'center', marginBottom: 30 }} onPress={() => setDisplayedOrdersCount(prev => prev + 20)}>
                      <Text style={{ color: '${headerTextColor}', fontWeight: 'bold' }}>عرض المزيد</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}
`;
}

// "قيد الإنتظار" -> pending, pending_warehouse, new
const pendingFilter = "orders.filter(o => o.status === 'pending' || o.status === 'pending_warehouse' || o.status === 'new')";
// "شحنات اليوم" -> today Orders (based on createdAt)
const todayFilter = "orders.filter(o => { if (!o.createdAt) return false; let od = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt); let today = new Date(); return od.getDate() === today.getDate() && od.getMonth() === today.getMonth() && od.getFullYear() === today.getFullYear(); })";
// "جزئي او استبدال" -> partial, replaced
const partialFilter = "orders.filter(o => o.status === 'partial' || o.status === 'replaced')";
// "تمت المعالجة" -> processed, confirmed
const processedFilter = "orders.filter(o => o.status === 'processed' || o.status === 'confirmed')";
// "في الطريق للشركة" -> processing/confirmed, plus existing logic
const ofdFilter = "orders.filter(o => o.status === 'processing' || o.status === 'confirmed' || o.status === 'ofd' || o.status === 'shipped')";

const screens = 
  generateScreen('pending_shipments', 'قيد الإنتظار', '#27272a', 'pendingSearchQuery', 'setPendingSearchQuery', pendingFilter, pendingFilter + '.length') +
  generateScreen('today_shipments', 'شحنات اليوم', '#ffffff', 'todaySearchQuery', 'setTodaySearchQuery', todayFilter, todayFilter + '.length') +
  generateScreen('partial_shipments', 'جزئي او استبدال', '#34d399', 'partialSearchQuery', 'setPartialSearchQuery', partialFilter, partialFilter + '.length') +
  generateScreen('processed_shipments', 'تمت المعالجة', '#34d399', 'processedSearchQuery', 'setProcessedSearchQuery', processedFilter, processedFilter + '.length') +
  generateScreen('ofd_shipments', 'في الطريق للشركة', '#eab308', 'ofdSearchQuery', 'setOfdSearchQuery', ofdFilter, ofdFilter + '.length');

if (c.includes('{/* Main Tab View */}') && !c.includes("activeTab === 'pending_shipments'")) {
    c = c.replace('{/* Main Tab View */}', screens + '\n      {/* Main Tab View */}');
}

fs.writeFileSync('App.js', c);
console.log('Screens added successfully');
