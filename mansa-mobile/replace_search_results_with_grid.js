const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const replacementScript = `
              // Aggregate filtered list by status
              const statusCounts = {};
              filteredList.forEach(ord => {
                 const st = ord.status || 'unknown';
                 statusCounts[st] = (statusCounts[st] || 0) + 1;
              });

              const statusLabels = {
                 'pending': { label: 'قيد الانتظار', bg: 'rgba(251, 191, 36, 0.15)', text: isLightMode ? '#d97706' : '#fbbf24', border: 'rgba(251, 191, 36, 0.4)' },
                 'backordered': { label: 'قيد الانتظار (مخزن)', bg: 'rgba(139, 92, 246, 0.15)', text: isLightMode ? '#7c3aed' : '#a78bfa', border: 'rgba(139, 92, 246, 0.4)' },
                 'processing': { label: 'جاري التجهيز', bg: 'rgba(249, 115, 22, 0.15)', text: isLightMode ? '#ea580c' : '#fb923c', border: 'rgba(249, 115, 22, 0.4)' },
                 'shipped': { label: 'تم الشحن', bg: 'rgba(56, 189, 248, 0.15)', text: isLightMode ? '#0284c7' : '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' },
                 'ofd': { label: 'قيد التوصيل', bg: 'rgba(99, 102, 241, 0.15)', text: isLightMode ? '#4f46e5' : '#818cf8', border: 'rgba(99, 102, 241, 0.4)' },
                 'delivered': { label: 'مكتمل (لم تتم المحاسبة)', bg: 'rgba(16, 185, 129, 0.15)', text: isLightMode ? '#059669' : '#34d399', border: 'rgba(16, 185, 129, 0.4)' },
                 'delivered_settled': { label: 'مكتمل (تمت المحاسبة)', bg: 'rgba(20, 184, 166, 0.15)', text: isLightMode ? '#0d9488' : '#2dd4bf', border: 'rgba(20, 184, 166, 0.4)' },
                 'partial': { label: 'واصل جزئي (لم تتم المحاسبة)', bg: 'rgba(14, 165, 233, 0.15)', text: isLightMode ? '#0284c7' : '#38bdf8', border: 'rgba(14, 165, 233, 0.4)' },
                 'returned': { label: 'راجع', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                 'returned_agent': { label: 'راجع عند المندوب', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                 'returned_warehouse': { label: 'راجع مخزن', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                 'postponed': { label: 'مؤجل', bg: 'rgba(234, 179, 8, 0.15)', text: isLightMode ? '#ca8a04' : '#facc15', border: 'rgba(234, 179, 8, 0.4)' },
                 'cancelled': { label: 'ملغي', bg: 'rgba(100, 116, 139, 0.15)', text: isLightMode ? '#475569' : '#94a3b8', border: 'rgba(100, 116, 139, 0.4)' },
                 'unknown': { label: 'غير معروف', bg: 'rgba(100, 116, 139, 0.15)', text: isLightMode ? '#475569' : '#94a3b8', border: 'rgba(100, 116, 139, 0.4)' }
              };

              return (
                <ScrollView contentContainerStyle={{ paddingBottom: 50, flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {Object.keys(statusCounts).map(st => {
                     const info = statusLabels[st] || statusLabels['unknown'];
                     return (
                        <View key={st} style={{ width: '48%', backgroundColor: info.bg, borderWidth: 1, borderColor: info.border, borderRadius: 12, padding: 15, marginBottom: 15, alignItems: 'center', justifyContent: 'center' }}>
                           <Text style={{ fontSize: 24, fontWeight: 'bold', color: info.text, marginBottom: 5 }}>{statusCounts[st]}</Text>
                           <Text style={{ fontSize: 13, fontWeight: 'bold', color: info.text, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{info.label}</Text>
                        </View>
                     );
                  })}
                  
                  {/* Total Card */}
                  <View style={{ width: '100%', backgroundColor: isLightMode ? '#f1f5f9' : '#1e293b', borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', borderRadius: 12, padding: 15, marginBottom: 15, alignItems: 'center', justifyContent: 'center' }}>
                     <Text style={{ fontSize: 28, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#f8fafc', marginBottom: 5 }}>{filteredList.length}</Text>
                     <Text style={{ fontSize: 15, fontWeight: 'bold', color: isLightMode ? '#475569' : '#cbd5e1', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>المجموع الكلي للطلبات</Text>
                  </View>
                </ScrollView>
              );
`;

// Target the FlatList rendering block
const startIdx = content.indexOf('return (\n                <FlatList');
const endIdx = content.indexOf('</SafeAreaView>\n          </Modal>');

if (startIdx !== -1 && endIdx !== -1) {
    // We need to find the end of the FlatList safely. We will use a regex.
    const flatListRegex = /return \(\s*<FlatList[\s\S]*?<\/FlatList>\s*\);/;
    const match = content.match(flatListRegex);
    if (match) {
        content = content.replace(match[0], replacementScript);
        fs.writeFileSync('App.js', content);
        console.log('Search Results Grid Dashboard applied successfully!');
    } else {
        console.log('Failed to match FlatList with Regex.');
    }
} else {
    console.log('Could not find start/end indices for FlatList replacement.');
}
