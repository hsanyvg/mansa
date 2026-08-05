const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const dateFilterIconRegex = /\{\/\*\s*Date Filter Icon\s*\*\/\}.*?<\/TouchableOpacity>/s;
content = content.replace(dateFilterIconRegex, '');

const insertionRegex = /          <\/View>\s*<\/View>\s*<\/View>\s*\)}/;

const horizontalScrollView = `          </View>
        </View>
        
        {/* Horizontal Date Picker */}
        <View style={{ backgroundColor: isLightMode ? '#f8fafc' : '#0f172a', paddingBottom: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, flexDirection: 'row-reverse' }}>
            {[
              { id: 'today', label: 'اليوم' },
              { id: 'yesterday', label: 'أمس' },
              { id: 'today_and_yesterday', label: 'اليوم وأمس' },
              { id: 'last_7_days', label: 'آخر 7 أيام' },
              { id: 'last_30_days', label: 'آخر 30 يوم' },
              { id: 'last_60_days', label: 'آخر 60 يوم' },
              { id: 'last_90_days', label: 'آخر 90 يوم' },
              { id: 'year', label: 'سنة' },
              { id: 'all_time', label: 'فترة مطلقة' },
              { id: 'custom', label: 'تخصيص' }
            ].map((filter, index) => (
              <TouchableOpacity 
                key={filter.id}
                onPress={() => {
                  if (filter.id === 'custom') {
                    setDateFilterModalVisible(true);
                  } else {
                    setGlobalDateFilter(filter.id);
                  }
                }}
                style={{
                  marginLeft: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: globalDateFilter === filter.id ? '#a855f7' : (isLightMode ? '#e2e8f0' : 'rgba(30, 30, 40, 0.65)'),
                  borderWidth: 1,
                  borderColor: globalDateFilter === filter.id ? '#a855f7' : (isLightMode ? '#cbd5e1' : '#475569'),
                }}
              >
                <Text style={{ 
                  color: globalDateFilter === filter.id ? '#fff' : (isLightMode ? '#334155' : '#cbd5e1'),
                  fontWeight: globalDateFilter === filter.id ? 'bold' : 'normal',
                  fontSize: 13
                }}>{filter.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
      )}`;

if (insertionRegex.test(content)) {
  content = content.replace(insertionRegex, horizontalScrollView);
  console.log("Injected horizontal date picker!");
} else {
  console.log("Failed to find insertion point for horizontal date picker!");
}

fs.writeFileSync('App.js', content);
