const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

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

      {showStartDatePicker && (
        <DateTimePicker
          value={customStartDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) setCustomStartDate(selectedDate);
          }}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={customEndDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) setCustomEndDate(selectedDate);
          }}
        />
      )}
`;

const target = `      </Modal>

    </SafeAreaView>
  );
}`;

if (!c.includes('تطبيق شهر وسنة محددين')) {
    c = c.replace(target, `      </Modal>\n${modalCode}\n    </SafeAreaView>\n  );\n}`);
    fs.writeFileSync('App.js', c);
    console.log("Modal added successfully!");
} else {
    console.log("Modal already exists.");
}
