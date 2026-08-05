const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. We will replace everything from {activeTab === 'orders' ? ( to the start of the Advanced Search Form.
const regex = /\{\/\* Header row in screenshot \*\/\}([\s\S]*?)\{\/\* Advanced Search Form \*\/\}/;

const newTopUI = `{/* Golden Header */}
          <View style={{ backgroundColor: '#d4af37', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => setEmpModalVisible(true)}>
              <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <Path d="M3 12h18M3 6h18M3 18h18" />
              </Svg>
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>بحث</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Advanced Search Form (White Card) */}
`;

content = content.replace(regex, newTopUI);

// 2. Also remove the golden wrapper around the Advanced Search form to match his design where the background of the screen is golden, but wait. If I do that, the whole screen background needs to be golden.
// Let's just make the Advanced Search Form card perfectly match his design.
const oldFormStart = `<View style={{ backgroundColor: '#d4af37', margin: 15, borderRadius: 16, padding: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5 }}>
            
            <View style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 15 }}>`;

const newFormStart = `<View style={{ margin: 15 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 20, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>`;

content = content.replace(oldFormStart, newFormStart);

// 3. Remove the extra closing View for the old golden wrapper
const oldFormEnd = `            </TouchableOpacity>

          </View>`;
const newFormEnd = `            </TouchableOpacity>
          </View>
          </View>`; // I added an extra view wrapper to margin it. So 2 closing views is correct.
content = content.replace(oldFormEnd, `            </TouchableOpacity>\n          </View>\n          </View>`);


// 4. Update the Icons to match his screenshot
content = content.replace(/<Text style=\{\{ fontSize: 18, marginLeft: 10 \}\}>🏢<\/Text>/, 
  `<Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10 }}><Path d="M3 21h18" /><Path d="M9 8h1" /><Path d="M9 12h1" /><Path d="M9 16h1" /><Path d="M14 8h1" /><Path d="M14 12h1" /><Path d="M14 16h1" /><Path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /></Svg>`);

content = content.replace(/<Text style=\{\{ fontSize: 18, marginLeft: 10 \}\}>🕒<\/Text>/,
  `<Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10 }}><Circle cx="12" cy="12" r="10" /><Path d="M12 6v6l4 2" /></Svg>`);

content = content.replace(/<Text style=\{\{ fontSize: 18, marginLeft: 10 \}\}>🧾<\/Text>/,
  `<Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10 }}><Rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><Path d="M16 2v4" /><Path d="M8 2v4" /><Path d="M3 10h18" /></Svg>`);

content = content.replace(/<Text style=\{\{ fontSize: 18, marginLeft: 10 \}\}>👤<\/Text>/,
  `<Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10 }}><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx="12" cy="7" r="4" /></Svg>`);

content = content.replace(/<Text style=\{\{ fontSize: 18, marginLeft: 10 \}\}>📞<\/Text>/,
  `<Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10 }}><Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>`);

content = content.replace(/<Text style=\{\{ fontSize: 18, marginLeft: 10 \}\}>📨<\/Text>/,
  `<Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10 }}><Path d="M22 2L11 13" /><Path d="M22 2l-7 20-4-9-9-4 20-7z" /></Svg>`);

// Fix the FlatList wrapper. I want the background of the screen to look nice.
content = content.replace(
  /<ScrollView style=\{styles\.tabContent\} contentContainerStyle=\{styles\.scrollPadding\}>/,
  `<ScrollView style={[styles.tabContent, { backgroundColor: '#d4af37' }]} contentContainerStyle={{ paddingBottom: 100 }}>`
);

// We need to style the "قائمة الطلبات" section so it doesn't look bad on a golden background.
// I will wrap it in a white container with border radius.
content = content.replace(
  /\{\/\* Section: أحدث الطلبات \*\/\}\s*<Text style=\{styles\.sectionHeaderTitle\}>قائمة الطلبات<\/Text>/,
  `{/* Section: أحدث الطلبات */}
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, marginTop: 10, minHeight: 500 }}>
            <Text style={[styles.sectionHeaderTitle, { color: '#d4af37', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }]}>نتائج البحث</Text>`
);

// Add the closing View for the white container after the orders filter list... wait, it's easier to just use the FlatList style.
// Instead of a wrapper view, let's just make the FlatList background white.
content = content.replace(
  /\{\/\* Section: أحدث الطلبات \*\/\}\s*<View style=\{\{ backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, marginTop: 10, minHeight: 500 \}\}>\s*<Text style=\{\[styles\.sectionHeaderTitle, \{ color: '#d4af37', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 \}\]\}>نتائج البحث<\/Text>/,
  `{/* Section: أحدث الطلبات */}
          <View style={{ backgroundColor: isLightMode ? '#f8fafc' : '#0f172a', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, marginTop: 10, minHeight: 800 }}>
            <Text style={[styles.sectionHeaderTitle, { color: '#d4af37', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }]}>نتائج البحث</Text>`
);

// Find where the FlatList ends and close the View
// FlatList ends with:
//                  />
//                </>
//              );
//            })()}
//            <View style={{height: 50}} />
//          </ScrollView>
// So we replace that to close the View.
content = content.replace(
  /(\s*)\}\)\(\)\}\r?\n(\s*)<View style=\{\{height: 50\}\} \/>\r?\n(\s*)<\/ScrollView>/,
  `$1})()}\n$2</View>\n$3</ScrollView>`
);


fs.writeFileSync('App.js', content);
console.log("Fixed search tab UI layout");
