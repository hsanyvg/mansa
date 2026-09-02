const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add state for Status Dropdown Modal
if (!content.includes('showStatusDropdown')) {
    content = content.replace(
        "const [advSearchStatus, setAdvSearchStatus] = useState('');",
        "const [advSearchStatus, setAdvSearchStatus] = useState('');\n  const [showStatusDropdown, setShowStatusDropdown] = useState(false);"
    );
}

// 2. Define the statuses array with their colors (background and text) for the custom UI
const customStatusUI = `{/* Status Custom Dropdown */}
            <View style={{ marginBottom: 12 }}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}
                onPress={() => setShowStatusDropdown(true)}
              >
                <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text style={{ color: advSearchStatus ? (isLightMode ? '#1e293b' : '#f8fafc') : (isLightMode ? '#94a3b8' : '#64748b'), fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', fontSize: 14 }}>
                    {advSearchStatus === 'pending' ? 'قيد الانتظار' :
                     advSearchStatus === 'backordered' ? 'قيد الانتظار (مخزن)' :
                     advSearchStatus === 'processing' ? 'جاري التجهيز' :
                     advSearchStatus === 'shipped' ? 'تم الشحن' :
                     advSearchStatus === 'ofd' ? 'قيد التوصيل' :
                     advSearchStatus === 'delivered' ? 'مكتمل (لم تتم المحاسبة)' :
                     advSearchStatus === 'delivered_settled' ? 'مكتمل (تمت المحاسبة)' :
                     advSearchStatus === 'partial' ? 'واصل جزئي (لم تتم المحاسبة)' :
                     advSearchStatus === 'returned' ? 'راجع' :
                     advSearchStatus === 'returned_agent' ? 'راجع عند المندوب' :
                     advSearchStatus === 'returned_warehouse' ? 'راجع مخزن' :
                     advSearchStatus === 'postponed' ? 'مؤجل' :
                     advSearchStatus === 'cancelled' ? 'ملغي' :
                     'الحالة (الكل)'}
                  </Text>
                </View>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M22 2L11 13" /><Path d="M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
              </TouchableOpacity>

              {/* Status Dropdown Modal */}
              <Modal visible={showStatusDropdown} transparent={true} animationType="fade" onRequestClose={() => setShowStatusDropdown(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }} activeOpacity={1} onPress={() => setShowStatusDropdown(false)}>
                  <TouchableOpacity activeOpacity={1} style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', borderRadius: 16, maxHeight: '80%', overflow: 'hidden' }}>
                    <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155', backgroundColor: isLightMode ? '#f8fafc' : '#0f172a' }}>
                      <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>اختر حالة الطلب</Text>
                    </View>
                    <ScrollView style={{ padding: 10 }}>
                      {[
                        { val: '', label: 'الحالة (الكل)', bg: isLightMode ? '#f1f5f9' : '#334155', text: isLightMode ? '#475569' : '#cbd5e1' },
                        { val: 'pending', label: 'قيد الانتظار', bg: 'rgba(251, 191, 36, 0.15)', text: isLightMode ? '#d97706' : '#fbbf24', border: 'rgba(251, 191, 36, 0.4)' },
                        { val: 'backordered', label: 'قيد الانتظار (مخزن)', bg: 'rgba(139, 92, 246, 0.15)', text: isLightMode ? '#7c3aed' : '#a78bfa', border: 'rgba(139, 92, 246, 0.4)' },
                        { val: 'processing', label: 'جاري التجهيز', bg: 'rgba(249, 115, 22, 0.15)', text: isLightMode ? '#ea580c' : '#fb923c', border: 'rgba(249, 115, 22, 0.4)' },
                        { val: 'shipped', label: 'تم الشحن', bg: 'rgba(56, 189, 248, 0.15)', text: isLightMode ? '#0284c7' : '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' },
                        { val: 'ofd', label: 'قيد التوصيل', bg: 'rgba(99, 102, 241, 0.15)', text: isLightMode ? '#4f46e5' : '#818cf8', border: 'rgba(99, 102, 241, 0.4)' },
                        { val: 'delivered', label: 'مكتمل (لم تتم المحاسبة)', bg: 'rgba(16, 185, 129, 0.15)', text: isLightMode ? '#059669' : '#34d399', border: 'rgba(16, 185, 129, 0.4)' },
                        { val: 'delivered_settled', label: 'مكتمل (تمت المحاسبة)', bg: 'rgba(20, 184, 166, 0.15)', text: isLightMode ? '#0d9488' : '#2dd4bf', border: 'rgba(20, 184, 166, 0.4)' },
                        { val: 'partial', label: 'واصل جزئي (لم تتم المحاسبة)', bg: 'rgba(14, 165, 233, 0.15)', text: isLightMode ? '#0284c7' : '#38bdf8', border: 'rgba(14, 165, 233, 0.4)' },
                        { val: 'returned', label: 'راجع', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                        { val: 'returned_agent', label: 'راجع عند المندوب', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                        { val: 'returned_warehouse', label: 'راجع مخزن', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                        { val: 'postponed', label: 'مؤجل', bg: 'rgba(234, 179, 8, 0.15)', text: isLightMode ? '#ca8a04' : '#facc15', border: 'rgba(234, 179, 8, 0.4)' },
                        { val: 'cancelled', label: 'ملغي', bg: 'rgba(100, 116, 139, 0.15)', text: isLightMode ? '#475569' : '#94a3b8', border: 'rgba(100, 116, 139, 0.4)' }
                      ].map((item, idx) => (
                        <TouchableOpacity 
                          key={idx} 
                          style={{ 
                            paddingVertical: 12, paddingHorizontal: 15, marginBottom: 8, borderRadius: 10,
                            backgroundColor: item.bg, borderWidth: item.border ? 1 : 0, borderColor: item.border || 'transparent',
                            flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between'
                          }}
                          onPress={() => { setAdvSearchStatus(item.val); setShowStatusDropdown(false); }}
                        >
                          <Text style={{ fontSize: 15, fontWeight: 'bold', color: item.text, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{item.label}</Text>
                          {advSearchStatus === item.val && (
                            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={item.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><Path d="M20 6L9 17l-5-5"/></Svg>
                          )}
                        </TouchableOpacity>
                      ))}
                      <View style={{ height: 20 }} />
                    </ScrollView>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Modal>
            </View>`;

// Find the old Status Picker in the content and replace it
// The old status picker starts with `{/* Status Picker */}` or just `<View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a'`...
// Let's use a regex to grab the exact block.
const oldPickerMatch = content.match(/\{\/\* Status Picker \*\/\}[\s\S]*?(?=\{\/\* Clear Button \*\/\}|\{\/\* From \/ To Date \*\/\}|\{\/\* Clear Button \*\/\})/g);

if (oldPickerMatch && oldPickerMatch[0]) {
    content = content.replace(oldPickerMatch[0], customStatusUI + "\n\n            ");
} else {
    // If we couldn't match via regex, we will do a simpler fallback.
    const fallbackRegex = /\{\/\* Status Picker \*\/\}[\s\S]*?(?=\{\/\* Clear Button \*\/\}|\{\/\* From \/ To Date \*\/\}|setAdvSearchGov\(''\);)/;
    const match2 = content.match(fallbackRegex);
    if (match2) {
        content = content.replace(match2[0], customStatusUI + "\n\n            ");
    }
}

fs.writeFileSync('App.js', content);
console.log("Custom Status Dropdown UI successfully implemented!");
