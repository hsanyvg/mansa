const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Rename the UI text in the today_shipments render block
let newContent = content.replace(
  /\{activeTab === 'today_shipments' && \([\s\S]*?شحنات اليوم \(\{orders\.filter.*?\.length\}\)[\s\S]*?let filtered = orders\.filter.*?\;[\s\S]*?if \(todaySearchQuery/g,
  `{activeTab === 'today_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#ffffff', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#333', fontSize: 18, fontWeight: 'bold' }}>الطلبات الكلية ({orders.length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={todaySearchQuery} onChangeText={setTodaySearchQuery} />
            </View>
          </View>
          <ScrollView style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = [...orders];
              if (todaySearchQuery`
);

// We need to write this robustly, using regex
fs.writeFileSync('fix_total_orders_screen2.js', `
const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex1 = /شحنات اليوم \\\(\\{orders\\.filter\\(o => \\{ if \\(\\!o\\.createdAt\\) return false;.*?\\}\\)\\.length\\}\\)/s;
content = content.replace(regex1, 'الطلبات الكلية ({orders.length})');

const regex2 = /let filtered = orders\\.filter\\(o => \\{ if \\(\\!o\\.createdAt\\) return false;.*?\\}\\);/s;
content = content.replace(regex2, 'let filtered = [...orders];');

fs.writeFileSync('App.js', content);
console.log("Successfully fixed total orders screen!");
`);

