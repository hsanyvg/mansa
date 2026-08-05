const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Remove the horizontal scroll date picker
const horizontalPickerRegex = /\{\/\*\s*Horizontal Date Picker\s*\*\/\}.*?<\/ScrollView>\s*<\/View>\s*<\/View>\s*\)\}/s;
content = content.replace(horizontalPickerRegex, '      </View>\n      )}\n');

// 2. Add back the Calendar icon in the header next to the notification bell
const bellRegex = /(\{\/\*\s*Notification Bell\s*\*\/\}.*?<\/TouchableOpacity>)/s;
const calendarIcon = `
            {/* Date Filter Icon */}
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => {
              setTempGlobalDateFilter(globalDateFilter);
              setTempCustomStartDate(customStartDate);
              setTempCustomEndDate(customEndDate);
              setTempFilterMonth(filterMonth);
              setTempFilterYear(filterYear);
              setDateFilterModalVisible(true);
            }}
            >
              <Svg width={22} height={22} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2.5}>
                <Rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
                <Path d='M16 2v4M8 2v4M3 10h18' />
              </Svg>
            </TouchableOpacity>`;

content = content.replace(bellRegex, `$1\n${calendarIcon}`);

fs.writeFileSync('App.js', content);
console.log("Restored Date Modal Icon and removed Horizontal Picker!");
