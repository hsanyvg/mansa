const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

const stateStr = "const [globalDateFilter, setGlobalDateFilter] = useState('last_7_days');";
const tempStates = `
  const [tempGlobalDateFilter, setTempGlobalDateFilter] = useState('last_7_days');
  const [tempCustomStartDate, setTempCustomStartDate] = useState(new Date());
  const [tempCustomEndDate, setTempCustomEndDate] = useState(new Date());
  const [tempFilterMonth, setTempFilterMonth] = useState(new Date().getMonth());
  const [tempFilterYear, setTempFilterYear] = useState(new Date().getFullYear());`;

if (c.includes(stateStr) && !c.includes('tempGlobalDateFilter')) {
    c = c.replace(stateStr, stateStr + tempStates);
}

const oldOnPress = "onPress={() => setDateFilterModalVisible(true)}";
const newOnPress = `onPress={() => {
              setTempGlobalDateFilter(globalDateFilter);
              setTempCustomStartDate(customStartDate);
              setTempCustomEndDate(customEndDate);
              setTempFilterMonth(filterMonth);
              setTempFilterYear(filterYear);
              setDateFilterModalVisible(true);
            }}`;

// Use replace to only replace the first occurrence (which is the calendar icon) 
// or if there are multiple, maybe we just replace all of them just in case.
c = c.replace(oldOnPress, newOnPress);

const modalStartStr = "{/* 5. Date Filter Modal */}";
const modalEndStr = "  {showStartDatePicker && (";

const startIdx = c.indexOf(modalStartStr);
const endIdx = c.indexOf(modalEndStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const before = c.substring(0, startIdx);
    const after = c.substring(endIdx); // starts with {showStartDatePicker && (
    
    const newModalStr = `{/* 5. Date Filter Modal */}
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
                  onPress={() => setTempGlobalDateFilter(filter.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: tempGlobalDateFilter === filter.id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(30, 30, 40, 0.65)',
                    borderWidth: 1,
                    borderColor: tempGlobalDateFilter === filter.id ? '#a855f7' : '#475569',
                  }}
                >
                  <Text style={{ 
                    color: tempGlobalDateFilter === filter.id ? '#e9d5ff' : '#cbd5e1',
                    fontWeight: tempGlobalDateFilter === filter.id ? 'bold' : 'normal',
                    fontSize: 13
                  }}>{filter.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={() => setTempGlobalDateFilter('custom')}>
              <Text style={{ color: tempGlobalDateFilter === 'custom' ? '#a855f7' : '#ffffff', marginBottom: 10, textAlign: 'right', fontWeight: 'bold' }}>تاريخ مخصص:</Text>
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, opacity: tempGlobalDateFilter === 'custom' ? 1 : 0.5 }}>
              <TouchableOpacity 
                style={{ flex: 1, marginLeft: 8, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                   setTempGlobalDateFilter('custom');
                   setShowStartDatePicker(true);
                }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>من تاريخ</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{tempCustomStartDate.toISOString().split('T')[0]}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ flex: 1, marginRight: 8, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                   setTempGlobalDateFilter('custom');
                   setShowEndDatePicker(true);
                }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>إلى تاريخ</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{tempCustomEndDate.toISOString().split('T')[0]}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setTempGlobalDateFilter('specific_month')}>
               <Text style={{ color: tempGlobalDateFilter === 'specific_month' ? '#a855f7' : '#ffffff', marginBottom: 10, textAlign: 'right', fontWeight: 'bold' }}>تحديد شهر وسنة:</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 25, opacity: tempGlobalDateFilter === 'specific_month' ? 1 : 0.5 }}>
              <View style={{ flex: 1, marginLeft: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterMonth(prev => prev === 11 ? 0 : prev + 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>+</Text></TouchableOpacity>
                  <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{tempFilterMonth + 1}</Text>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterMonth(prev => prev === 0 ? 11 : prev - 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>-</Text></TouchableOpacity>
              </View>
              
              <View style={{ flex: 1, marginRight: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterYear(prev => prev + 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>+</Text></TouchableOpacity>
                  <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{tempFilterYear}</Text>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterYear(prev => prev - 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>-</Text></TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
               <TouchableOpacity 
                 style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center', flex: 1, marginLeft: 5 }}
                 onPress={() => {
                   setGlobalDateFilter(tempGlobalDateFilter);
                   setCustomStartDate(tempCustomStartDate);
                   setCustomEndDate(tempCustomEndDate);
                   setFilterMonth(tempFilterMonth);
                   setFilterYear(tempFilterYear);
                   setDateFilterModalVisible(false);
                 }}
               >
                 <Text style={{ color: '#fff', fontWeight: 'bold' }}>موافق</Text>
               </TouchableOpacity>
               
               <TouchableOpacity 
                 style={{ backgroundColor: '#334155', padding: 12, borderRadius: 8, alignItems: 'center', flex: 1, marginRight: 5 }}
                 onPress={() => setDateFilterModalVisible(false)}
               >
                 <Text style={{ color: '#fff', fontWeight: 'bold' }}>إلغاء</Text>
               </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

`;
    c = before + newModalStr + after;
    
    // Also, update the DateTimePickers to use setTempCustomStartDate instead of setCustomStartDate
    // Because they are part of the 'after' block, we can replace them globally in 'c' 
    c = c.replace(/setCustomStartDate\(selectedDate\);/g, 'setTempCustomStartDate(selectedDate);');
    c = c.replace(/setCustomEndDate\(selectedDate\);/g, 'setTempCustomEndDate(selectedDate);');
    
    // We should also replace the customStartDate with tempCustomStartDate in the DateTimePicker value props!
    c = c.replace(/value={customStartDate}/g, 'value={tempCustomStartDate}');
    c = c.replace(/value={customEndDate}/g, 'value={tempCustomEndDate}');
}

fs.writeFileSync('App.js', c);
console.log('Date filter modal updated successfully');
