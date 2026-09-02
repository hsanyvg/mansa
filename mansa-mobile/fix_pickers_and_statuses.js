const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Replace Governorates TextInput with Picker
const oldGovUI = `{/* Governorates */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="المحافظة"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchGov}
                onChangeText={setAdvSearchGov}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M3 21h18" /><Path d="M9 8h1" /><Path d="M9 12h1" /><Path d="M9 16h1" /><Path d="M14 8h1" /><Path d="M14 12h1" /><Path d="M14 16h1" /><Path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /></Svg>
            </View>`;

const newGovUI = `{/* Governorates */}
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
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M3 21h18" /><Path d="M9 8h1" /><Path d="M9 12h1" /><Path d="M9 16h1" /><Path d="M14 8h1" /><Path d="M14 12h1" /><Path d="M14 16h1" /><Path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /></Svg>
            </View>`;

content = content.replace(oldGovUI, newGovUI);

// 2. Replace Month labels
const oldMonths = `<Picker.Item label="-- اختر الشهر --" value="" />
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
                  <Picker.Item label="December (12)" value="12" />`;

const newMonths = `<Picker.Item label="-- الشهر --" value="" />
                  <Picker.Item label="01" value="01" />
                  <Picker.Item label="02" value="02" />
                  <Picker.Item label="03" value="03" />
                  <Picker.Item label="04" value="04" />
                  <Picker.Item label="05" value="05" />
                  <Picker.Item label="06" value="06" />
                  <Picker.Item label="07" value="07" />
                  <Picker.Item label="08" value="08" />
                  <Picker.Item label="09" value="09" />
                  <Picker.Item label="10" value="10" />
                  <Picker.Item label="11" value="11" />
                  <Picker.Item label="12" value="12" />`;

content = content.replace(oldMonths, newMonths);

// 3. Replace Status Picker labels with Emojis to represent the requested colors and clear states.
const oldStatusPicker = `<Picker.Item label="الحالة (الكل)" value="" color={isLightMode ? '#64748b' : '#000000'} />
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

const newStatusPicker = `<Picker.Item label="📋 الحالة (الكل)" value="" color={isLightMode ? '#64748b' : '#000000'} />
                  <Picker.Item label="🟡 قيد الانتظار" value="pending" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="🟣 قيد الانتظار (مخزن)" value="backordered" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="🟠 جاري التجهيز" value="processing" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="🚚 تم الشحن" value="shipped" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="🛵 قيد التوصيل" value="ofd" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="🟢 مكتمل (لم تتم المحاسبة)" value="delivered" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="✅ مكتمل (تمت المحاسبة)" value="delivered_settled" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="🔵 واصل جزئي (لم تتم المحاسبة)" value="partial" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="🔴 راجع" value="returned" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="🟥 راجع عند المندوب" value="returned_agent" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="⭕ راجع مخزن" value="returned_warehouse" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="⏱️ مؤجل" value="postponed" color={isLightMode ? '#000000' : '#000000'} />
                  <Picker.Item label="❌ ملغي" value="cancelled" color={isLightMode ? '#000000' : '#000000'} />`;

content = content.replace(oldStatusPicker, newStatusPicker);

fs.writeFileSync('App.js', content);
console.log("Fixes applied successfully!");
