const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const oldHeader = `          {/* Main Header */}
          <View style={styles.ordersHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={styles.headerIconButton} onPress={() => setActiveTab('settings')}>
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <Circle cx="12" cy="7" r="4" />
                </Svg>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerIconButton, { marginLeft: 10 }]}>
                <View style={{ position: 'relative' }}>
                  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </Svg>
                  <View style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, backgroundColor: '#ef4444', borderRadius: 4 }} />
                </View>
              </TouchableOpacity>
            </View>
            <View>
              <Text style={styles.ordersHeaderTitle}>البحث المتقدم</Text>
              <Text style={styles.ordersHeaderSubtitle}>ابحث عن الطلبات بسهولة</Text>
            </View>
          </View>`;

const newHeader = `          {/* Main Header */}
          <View style={styles.ordersHeaderRow}>
            <View />
            <View>
              <Text style={styles.ordersHeaderTitle}>البحث المتقدم</Text>
              <Text style={styles.ordersHeaderSubtitle}>ابحث عن الطلبات بسهولة</Text>
            </View>
          </View>`;

if (content.includes(oldHeader)) {
    content = content.replace(oldHeader, newHeader);
    fs.writeFileSync('App.js', content);
    console.log("Removed icons from Advanced Search header!");
} else {
    console.log("Could not find the target string.");
}
