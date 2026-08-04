const fs = require('fs');
const appJsPath = './App.js';
let code = fs.readFileSync(appJsPath, 'utf8');

const targetStr = `{/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>منصة منسا - الجوال</Text>
      </View>`;

const targetStr2 = `{/* Header */}\r\n      <View style={styles.header}>\r\n        <Text style={styles.headerTitle}>منصة منسا - الجوال</Text>\r\n      </View>`;

const newHeader = `
      {/* Global Header & Search */}
      {activeTab !== 'settings' && (
      <View style={{ backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12', paddingBottom: 10 }}>
        {/* Top Row: Profile & Notifications */}
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 16, marginTop: 15 }}>
          {/* Right: Profile Info */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f3e8ff', justifyContent: 'center', alignItems: 'center', marginLeft: 12 }}>
              <Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 18 }}>
                {selectedEmployeeName ? selectedEmployeeName.split(' ').slice(0,2).map(n => n[0]).join(' ') : '👤'}
              </Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>
              {selectedEmployeeName}
            </Text>
          </View>

          {/* Left: Action Icons */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => setEmpModalVisible(true)}
            >
              <Svg width={22} height={22} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2.5}>
                <Path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                <Circle cx='12' cy='7' r='4' />
              </Svg>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => setAlertModal({ visible: true, message: 'لا توجد إشعارات جديدة حالياً.' })}
            >
              <Svg width={24} height={24} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2}>
                <Path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                <Path d='M13.73 21a2 2 0 0 1-3.46 0' />
              </Svg>
              <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: isLightMode ? '#f8fafc' : '#0f172a' }}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>52</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      )}`;

if(code.includes(targetStr) || code.includes(targetStr2)){
    code = code.replace(targetStr, newHeader).replace(targetStr2, newHeader);
    fs.writeFileSync(appJsPath, code);
    console.log("Header replaced successfully!");
} else {
    console.log("Could not find the target string.");
}
