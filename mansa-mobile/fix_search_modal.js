const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add isSearchModalVisible state
if (!content.includes('const [isSearchModalVisible')) {
    content = content.replace(
        "const [advSearchPhone, setAdvSearchPhone] = useState('');",
        "const [advSearchPhone, setAdvSearchPhone] = useState('');\n  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);"
    );
}

// 2. Change search button action
content = content.replace(
    /onPress=\{\(\) => Keyboard\.dismiss\(\)\}/g,
    "onPress={() => { Keyboard.dismiss(); setIsSearchModalVisible(true); }}"
);

// 3. Wrap Search Results in a Modal
// Let's find the exact block from `          {/* Search Results */}` to the end of the `View`
const searchResultsStart = `          {/* Search Results */}
          <View style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, minHeight: 400, marginTop: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc', textAlign: 'right', marginBottom: 15 }}>نتائج البحث</Text>`;

const newSearchResultsStart = `          {/* Search Results Modal */}
          <Modal visible={isSearchModalVisible} animationType="slide" onRequestClose={() => setIsSearchModalVisible(false)}>
            <SafeAreaView style={{ flex: 1, backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: isLightMode ? '#fff' : '#1e293b', borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>نتائج البحث</Text>
                <TouchableOpacity onPress={() => setIsSearchModalVisible(false)} style={{ padding: 8, backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8 }}>
                  <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 14 }}>إغلاق</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, padding: 20 }}>`;

content = content.replace(searchResultsStart, newSearchResultsStart);

// We need to replace the closing tag of that block.
// The block ends around line 3050. Let's find it using a regex or simple string replacement.
// Let's find:
// `            })()}
//           </View>
//         </ScrollView>`
// And replace it with:
// `            })()}
//           </View>
//           </SafeAreaView>
//           </Modal>
//         </ScrollView>`

content = content.replace(
    /            \}\)\(\)\}\n          <\/View>\n        <\/ScrollView>/g,
    "            })()}\n          </View>\n          </SafeAreaView>\n          </Modal>\n        </ScrollView>"
);

fs.writeFileSync('App.js', content);
console.log("Search Modal injected successfully!");
