const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

// 1. Add state variables
const stateTarget = 'const [showEndDatePicker, setShowEndDatePicker] = useState(false);';
if (!c.includes('setDateFilterModalVisible')) {
    c = c.replace(stateTarget, stateTarget + '\n  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);\n  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());\n  const [filterYear, setFilterYear] = useState(new Date().getFullYear());');
}

// 2. Remove the Date Filter Bar (horizontal scroll view)
const dateBarRegex = /\{\/\* Date Filter Bar \*\/\}[\s\S]*?\{\/\* Main Tab View \*\/\}/;
c = c.replace(dateBarRegex, '{/* Main Tab View */}');

// 3. Add the Modal (before DatePicker)
const modalTarget = '{showStartDatePicker && (';
const modalCode = `
      {/* 5. Date Filter Modal */}
      <Modal visible={dateFilterModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تصفية التاريخ</Text>
            
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 15 }}>
              {[
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'today_and_yesterday', label: 'اليوم وأمس' },
                { id: 'last_7_days', label: 'آخر 7 أيام' },
                { id: 'last_30_days', label: 'آخر 30 يوم' },
                { id: 'last_60_days', label: 'آخر 60 يوم' },
                { id: 'last_90_days', label: 'آخر 90 يوم' },
                { id: 'year', label: 'سنة' },
                { id: 'all_time', label: 'فترة مطلقة' }
              ].map(filter => (
                <TouchableOpacity 
                  key={filter.id}
                  onPress={() => {
                    setGlobalDateFilter(filter.id);
                    setDateFilterModalVisible(false);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: globalDateFilter === filter.id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(30, 30, 40, 0.65)',
                    borderWidth: 1,
                    borderColor: globalDateFilter === filter.id ? '#a855f7' : '#475569',
                  }}
                >
                  <Text style={{ 
                    color: globalDateFilter === filter.id ? '#e9d5ff' : '#cbd5e1',
                    fontWeight: globalDateFilter === filter.id ? 'bold' : 'normal',
                    fontSize: 13
                  }}>{filter.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: '#ffffff', marginBottom: 10, textAlign: 'right', fontWeight: 'bold' }}>تاريخ مخصص:</Text>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 }}>
              <TouchableOpacity 
                style={{ flex: 1, marginLeft: 8, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>من تاريخ</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{customStartDate.toISOString().split('T')[0]}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ flex: 1, marginRight: 8, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>إلى تاريخ</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{customEndDate.toISOString().split('T')[0]}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={{ backgroundColor: '#a855f7', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 20 }}
              onPress={() => {
                setGlobalDateFilter('custom');
                setDateFilterModalVisible(false);
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>تطبيق التاريخ المخصص</Text>
            </TouchableOpacity>

            <Text style={{ color: '#ffffff', marginBottom: 10, textAlign: 'right', fontWeight: 'bold' }}>تحديد شهر وسنة:</Text>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 }}>
              <View style={{ flex: 1, marginLeft: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  <TouchableOpacity onPress={() => setFilterMonth(prev => prev === 11 ? 0 : prev + 1)} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>+</Text></TouchableOpacity>
                  <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{filterMonth + 1}</Text>
                  <TouchableOpacity onPress={() => setFilterMonth(prev => prev === 0 ? 11 : prev - 1)} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>-</Text></TouchableOpacity>
              </View>
              
              <View style={{ flex: 1, marginRight: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  <TouchableOpacity onPress={() => setFilterYear(prev => prev + 1)} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>+</Text></TouchableOpacity>
                  <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{filterYear}</Text>
                  <TouchableOpacity onPress={() => setFilterYear(prev => prev - 1)} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>-</Text></TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity 
              style={{ backgroundColor: '#a855f7', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}
              onPress={() => {
                setGlobalDateFilter('specific_month');
                setDateFilterModalVisible(false);
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>تطبيق شهر وسنة محددين</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setDateFilterModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showStartDatePicker && (`;
if (!c.includes('تصفية التاريخ')) {
    c = c.replace(modalTarget, modalCode);
}

// 4. Finally, apply the new header, WITH 3 buttons (User, Notification, Date Filter)
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
            {/* User Icon */}
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => setEmpModalVisible(true)}
            >
              <Svg width={22} height={22} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2.5}>
                <Path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                <Circle cx='12' cy='7' r='4' />
              </Svg>
            </TouchableOpacity>

            {/* Notification Bell */}
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
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
            
            {/* Date Filter Icon */}
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => setDateFilterModalVisible(true)}
            >
              <Svg width={22} height={22} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2.5}>
                <Rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
                <Path d='M16 2v4M8 2v4M3 10h18' />
              </Svg>
            </TouchableOpacity>

          </View>
        </View>
      </View>
      )}`;

const headerRegex = /\{\/\* Header \*\/\}[ \s\S]*?<View style=\{styles\.header\}>[ \s\S]*?<Text style=\{styles\.headerTitle\}>.*?<\/Text>[ \s\S]*?<\/View>/;
if (c.match(headerRegex)) {
    c = c.replace(headerRegex, newHeader);
}

fs.writeFileSync('App.js', c);
console.log('Restoration and Header Fix Applied Successfully.');
