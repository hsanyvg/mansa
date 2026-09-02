const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add DateFrom, DateTo, and their picker visibility states
content = content.replace(
    "const [advSearchMonth, setAdvSearchMonth] = useState('');\n  const [advSearchYear, setAdvSearchYear] = useState('');",
    "const [advSearchMonth, setAdvSearchMonth] = useState('');\n  const [advSearchYear, setAdvSearchYear] = useState('');\n  const [advSearchDateFrom, setAdvSearchDateFrom] = useState(null);\n  const [advSearchDateTo, setAdvSearchDateTo] = useState(null);\n  const [showAdvSearchDateFromPicker, setShowAdvSearchDateFromPicker] = useState(false);\n  const [showAdvSearchDateToPicker, setShowAdvSearchDateToPicker] = useState(false);"
);

// 2. Remove advSearchName state usage in hasSearchCriteria
content = content.replace(
    "const hasSearchCriteria = !!(advSearchGov || advSearchMonth || advSearchYear || advSearchReceipt || advSearchName || advSearchPhone || advSearchStatus);",
    "const hasSearchCriteria = !!(advSearchGov || advSearchMonth || advSearchYear || advSearchDateFrom || advSearchDateTo || advSearchReceipt || advSearchPhone || advSearchStatus);"
);

// 3. Remove advSearchName filtering logic
const oldNameFilterLogic = `if (advSearchName && advSearchName.trim()) {
                  if (!String(ord.customerName || '').toLowerCase().includes(advSearchName.toLowerCase().trim())) match = false;
                }`;
content = content.replace(oldNameFilterLogic, "");

// 4. Add Date From/To filtering logic
const oldDateLogic = `if (advSearchYear && advSearchYear.trim()) {
                  let dStr = '';
                  if (ord.createdAt && typeof ord.createdAt.toDate === 'function') dStr = ord.createdAt.toDate().toISOString();
                  else dStr = String(ord.createdAt || '');
                  if (!dStr.includes(advSearchYear)) match = false;
                }`;

const newDateLogic = `${oldDateLogic}
                if (advSearchDateFrom || advSearchDateTo) {
                  let orderDate = null;
                  if (ord.createdAt && typeof ord.createdAt.toDate === 'function') orderDate = ord.createdAt.toDate();
                  else if (ord.createdAt) orderDate = new Date(ord.createdAt);
                  
                  if (orderDate && !isNaN(orderDate.getTime())) {
                    if (advSearchDateFrom) {
                       const f = new Date(advSearchDateFrom); f.setHours(0,0,0,0);
                       if (orderDate < f) match = false;
                    }
                    if (advSearchDateTo) {
                       const t = new Date(advSearchDateTo); t.setHours(23,59,59,999);
                       if (orderDate > t) match = false;
                    }
                  }
                }`;

content = content.replace(oldDateLogic, newDateLogic);

// 5. Replace Governorates TextInput with Picker
const oldGovUI = `{/* Governorate */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="المحافظة"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchGov}
                onChangeText={setAdvSearchGov}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><Circle cx="12" cy="10" r="3" /></Svg>
            </View>`;

const newGovUI = `{/* Governorate */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                <Picker
                  selectedValue={advSearchGov}
                  style={{ width: '100%', height: 48, color: isLightMode ? '#1e293b' : '#f8fafc' }}
                  onValueChange={(itemValue) => setAdvSearchGov(itemValue)}
                  dropdownIconColor={isLightMode ? '#1e293b' : '#f8fafc'}
                >
                  <Picker.Item label="-- اختر المحافظة --" value="" color={isLightMode ? '#94a3b8' : '#64748b'} />
                  {governoratesList.map((gov, idx) => (
                    <Picker.Item key={idx} label={gov} value={gov} color={isLightMode ? '#1e293b' : '#000000'} />
                  ))}
                </Picker>
              </View>
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><Circle cx="12" cy="10" r="3" /></Svg>
            </View>`;

content = content.replace(oldGovUI, newGovUI);

// 6. Remove the Customer Name UI
const oldNameUI = `{/* Customer Name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="اسم الزبون"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchName}
                onChangeText={setAdvSearchName}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx="12" cy="7" r="4" /></Svg>
            </View>`;

content = content.replace(oldNameUI, "");

// 7. Fix Status Picker Colors (change all color={...} to #000000 for standard dark color on android picker items)
// The user says "اريده الاوان بي واضحه الكتابة" -> Just set color to black on Android, or default.
// Let's replace the whole Status Picker items part.
const oldStatusPicker = `<Picker.Item label="الحالة (الكل)" value="" color={isLightMode ? '#94a3b8' : '#64748b'} />
                  <Picker.Item label="قيد الانتظار" value="pending" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="قيد الانتظار (مخزن)" value="backordered" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="جاري التجهيز" value="processing" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="تم الشحن" value="shipped" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="قيد التوصيل" value="ofd" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="مكتمل (لم تتم المحاسبة)" value="delivered" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="مكتمل (تمت المحاسبة)" value="delivered_settled" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="واصل جزئي (لم تتم المحاسبة)" value="partial" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="راجع" value="returned" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="راجع عند المندوب" value="returned_agent" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="راجع مخزن" value="returned_warehouse" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="مؤجل" value="postponed" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                  <Picker.Item label="ملغي" value="cancelled" color={isLightMode ? '#1e293b' : '#f8fafc'} />`;

const newStatusPicker = `<Picker.Item label="الحالة (الكل)" value="" color={isLightMode ? '#64748b' : '#000000'} />
                  <Picker.Item label="قيد الانتظار" value="pending" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="قيد الانتظار (مخزن)" value="backordered" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="جاري التجهيز" value="processing" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="تم الشحن" value="shipped" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="قيد التوصيل" value="ofd" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="مكتمل (لم تتم المحاسبة)" value="delivered" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="مكتمل (تمت المحاسبة)" value="delivered_settled" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="واصل جزئي (لم تتم المحاسبة)" value="partial" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="راجع" value="returned" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="راجع عند المندوب" value="returned_agent" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="راجع مخزن" value="returned_warehouse" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="مؤجل" value="postponed" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="ملغي" value="cancelled" color={isLightMode ? '#000000' : '#000000'} />`;

content = content.replace(oldStatusPicker, newStatusPicker);

// Also remove `color: advSearchStatus ? ...` from Picker style to avoid invisible selected text
const oldPickerStyle = `style={{ width: '100%', height: 48, textAlign: 'right', color: advSearchStatus ? (isLightMode ? '#1e293b' : '#f8fafc') : (isLightMode ? '#94a3b8' : '#64748b') }}`;
const newPickerStyle = `style={{ width: '100%', height: 48, textAlign: 'right', color: isLightMode ? '#1e293b' : '#f8fafc' }}`;
content = content.replace(oldPickerStyle, newPickerStyle);


// 8. Add From/To Date Pickers UI right after Month/Year UI
const datePickersUI = `
            {/* From / To Date */}
            <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', overflow: 'hidden' }}>
                <TouchableOpacity onPress={() => setShowAdvSearchDateFromPicker(true)} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: advSearchDateFrom ? (isLightMode ? '#1e293b' : '#f8fafc') : (isLightMode ? '#94a3b8' : '#64748b'), fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                    {advSearchDateFrom ? formatDateLocal(advSearchDateFrom) : '-- من تاريخ --'}
                  </Text>
                </TouchableOpacity>
                {showAdvSearchDateFromPicker && (
                  <DateTimePicker
                    value={advSearchDateFrom || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowAdvSearchDateFromPicker(false);
                      if (date) setAdvSearchDateFrom(date);
                    }}
                  />
                )}
              </View>

              <View style={{ flex: 1, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', overflow: 'hidden' }}>
                <TouchableOpacity onPress={() => setShowAdvSearchDateToPicker(true)} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: advSearchDateTo ? (isLightMode ? '#1e293b' : '#f8fafc') : (isLightMode ? '#94a3b8' : '#64748b'), fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                    {advSearchDateTo ? formatDateLocal(advSearchDateTo) : '-- الى تاريخ --'}
                  </Text>
                </TouchableOpacity>
                {showAdvSearchDateToPicker && (
                  <DateTimePicker
                    value={advSearchDateTo || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowAdvSearchDateToPicker(false);
                      if (date) setAdvSearchDateTo(date);
                    }}
                  />
                )}
              </View>
            </View>`;

// Insert datePickersUI right after:
// `<Picker.Item label="2028" value="2028" />
//                 </Picker>
//               </View>
//             </View>`

content = content.replace(
    /<Picker\.Item label="2028" value="2028" \/>\s*<\/Picker>\s*<\/View>\s*<\/View>/g,
    `<Picker.Item label="2028" value="2028" />\n                </Picker>\n              </View>\n            </View>\n${datePickersUI}`
);

// 9. Update Clear Button action
const oldClearBtn = `setAdvSearchMonth('');\n              setAdvSearchYear('');\n              setAdvSearchReceipt('');\n              setAdvSearchName('');`;
const newClearBtn = `setAdvSearchMonth('');\n              setAdvSearchYear('');\n              setAdvSearchDateFrom(null);\n              setAdvSearchDateTo(null);\n              setAdvSearchReceipt('');`;
content = content.replace(oldClearBtn, newClearBtn);

fs.writeFileSync('App.js', content);
console.log("Advanced Search UI updated!");
