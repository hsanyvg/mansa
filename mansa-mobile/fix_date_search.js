const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Replace state
content = content.replace(
    "const [advSearchDate, setAdvSearchDate] = useState('');",
    "const [advSearchMonth, setAdvSearchMonth] = useState('');\n  const [advSearchYear, setAdvSearchYear] = useState('');"
);

// 2. Replace filter logic criteria
content = content.replace(
    "const hasSearchCriteria = !!(advSearchGov || advSearchDate || advSearchReceipt || advSearchName || advSearchPhone || advSearchStatus);",
    "const hasSearchCriteria = !!(advSearchGov || advSearchMonth || advSearchYear || advSearchReceipt || advSearchName || advSearchPhone || advSearchStatus);"
);

// 3. Replace filtering logic for date
const oldDateLogic = `if (advSearchDate && advSearchDate.trim()) {
                  if (!String(ord.createdAt || '').toLowerCase().includes(advSearchDate.toLowerCase().trim())) match = false;
                }`;

const newDateLogic = `if (advSearchMonth && advSearchMonth.trim()) {
                  let dStr = '';
                  if (ord.createdAt && typeof ord.createdAt.toDate === 'function') dStr = ord.createdAt.toDate().toISOString();
                  else dStr = String(ord.createdAt || '');
                  if (!dStr.includes('-' + advSearchMonth + '-')) match = false;
                }
                if (advSearchYear && advSearchYear.trim()) {
                  let dStr = '';
                  if (ord.createdAt && typeof ord.createdAt.toDate === 'function') dStr = ord.createdAt.toDate().toISOString();
                  else dStr = String(ord.createdAt || '');
                  if (!dStr.includes(advSearchYear)) match = false;
                }`;

content = content.replace(oldDateLogic, newDateLogic);

// 4. Replace the UI of Date Search
// The old date UI looks like:
const oldDateUI = `{/* Date */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="تاريخ الاضافة (مثال: 2024-05-01)"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchDate}
                onChangeText={setAdvSearchDate}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Circle cx="12" cy="12" r="10" /><Path d="M12 6v6l4 2" /></Svg>
            </View>`;

const newDateUI = `{/* Month and Year */}
            <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', overflow: 'hidden' }}>
                <Picker
                  selectedValue={advSearchMonth}
                  onValueChange={(itemValue) => setAdvSearchMonth(itemValue)}
                  style={{ color: isLightMode ? '#1e293b' : '#f8fafc', height: 48, width: '100%' }}
                  dropdownIconColor={isLightMode ? '#1e293b' : '#f8fafc'}
                >
                  <Picker.Item label="-- اختر الشهر --" value="" />
                  <Picker.Item label="January (01)" value="01" />
                  <Picker.Item label="February (02)" value="02" />
                  <Picker.Item label="March (03)" value="03" />
                  <Picker.Item label="April (04)" value="04" />
                  <Picker.Item label="May (05)" value="05" />
                  <Picker.Item label="June (06)" value="06" />
                  <Picker.Item label="July (07)" value="07" />
                  <Picker.Item label="August (08)" value="08" />
                  <Picker.Item label="September (09)" value="09" />
                  <Picker.Item label="October (10)" value="10" />
                  <Picker.Item label="November (11)" value="11" />
                  <Picker.Item label="December (12)" value="12" />
                </Picker>
              </View>

              <View style={{ flex: 1, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', overflow: 'hidden' }}>
                <Picker
                  selectedValue={advSearchYear}
                  onValueChange={(itemValue) => setAdvSearchYear(itemValue)}
                  style={{ color: isLightMode ? '#1e293b' : '#f8fafc', height: 48, width: '100%' }}
                  dropdownIconColor={isLightMode ? '#1e293b' : '#f8fafc'}
                >
                  <Picker.Item label="-- اختر السنة --" value="" />
                  <Picker.Item label="2024" value="2024" />
                  <Picker.Item label="2025" value="2025" />
                  <Picker.Item label="2026" value="2026" />
                  <Picker.Item label="2027" value="2027" />
                  <Picker.Item label="2028" value="2028" />
                </Picker>
              </View>
            </View>`;

content = content.replace(oldDateUI, newDateUI);

// 5. Update Clear Fields button to clear month and year
const oldClearFields = `setAdvSearchDate('');`;
const newClearFields = `setAdvSearchMonth('');\n              setAdvSearchYear('');`;
content = content.replace(oldClearFields, newClearFields);

fs.writeFileSync('App.js', content);
console.log("Date Search updated successfully!");
