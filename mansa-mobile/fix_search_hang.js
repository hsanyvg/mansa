const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add selectedGridStatus state
if (!content.includes('const [selectedGridStatus')) {
    content = content.replace(
        'const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);',
        'const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);\n  const [selectedGridStatus, setSelectedGridStatus] = useState(null);'
    );
}

// 2. Reset selectedGridStatus when opening/closing modal
content = content.replace(
    'setIsSearchModalVisible(true);',
    'setSelectedGridStatus(null); setIsSearchModalVisible(true);'
);
content = content.replace(
    /onRequestClose=\{\(\) \=\> setIsSearchModalVisible\(false\)\}/g,
    'onRequestClose={() => { setSelectedGridStatus(null); setIsSearchModalVisible(false); }}'
);
content = content.replace(
    /<TouchableOpacity onPress=\{\(\) \=\> setIsSearchModalVisible\(false\)\}/g,
    '<TouchableOpacity onPress={() => { setSelectedGridStatus(null); setIsSearchModalVisible(false); }}'
);


// 3. Replace the Modal rendering logic to support Drill-Down
const oldGridBlockStart = `              // Aggregate filtered list by status`;
const oldGridBlockEnd = `            })()}
          </View>
          </SafeAreaView>
          </Modal>`;

const newGridBlock = `              // Aggregate filtered list by status
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

              if (selectedGridStatus) {
                 const statusList = filteredList.filter(o => (o.status || 'unknown') === selectedGridStatus);
                 const info = statusLabels[selectedGridStatus] || statusLabels['unknown'];
                 return (
                    <View style={{ flex: 1 }}>
                       <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, padding: 10, backgroundColor: info.bg, borderRadius: 8, borderWidth: 1, borderColor: info.border }}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: info.text, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>طلبات: {info.label}</Text>
                          <TouchableOpacity onPress={() => setSelectedGridStatus(null)} style={{ padding: 6, backgroundColor: isLightMode ? '#fff' : '#1e293b', borderRadius: 6 }}>
                             <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 12 }}>رجوع للوحة</Text>
                          </TouchableOpacity>
                       </View>
                       <FlatList 
                          data={statusList}
                          keyExtractor={ord => ord.id}
                          initialNumToRender={10}
                          maxToRenderPerBatch={10}
                          windowSize={5}
                          contentContainerStyle={{ paddingBottom: 50 }}
                          renderItem={({item: ord}) => (
                             <View key={ord.id} style={styles.orderItem}>
                                <View style={styles.orderLeft}>
                                   <Text style={[styles.orderCustName, { color: isLightMode ? '#1e293b' : '#f8fafc', fontSize: 15 }]}>{ord.customerName}</Text>
                                   <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
                                      <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#cbd5e1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>
                                      <Text style={{ marginRight: 6, color: isLightMode ? '#475569' : '#cbd5e1', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{ord.customerPhone} {ord.customerPhone2 ? \` - \${ord.customerPhone2}\` : ''}</Text>
                                   </View>
                                   <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
                                      <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#cbd5e1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><Circle cx="12" cy="10" r="3" /></Svg>
                                      <Text style={{ marginRight: 6, color: isLightMode ? '#475569' : '#cbd5e1', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{ord.governorate} {ord.address ? \`- \${ord.address}\` : ''}</Text>
                                   </View>
                                   <Text style={{ marginTop: 4, color: isLightMode ? '#475569' : '#cbd5e1', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>المنتجات: {Array.isArray(ord.products) ? ord.products.map(p => p.name).join('، ') : 'بدون منتجات'}</Text>
                                   {ord.notes && ord.notes.trim() !== '' && (
                                      <Text style={{ marginTop: 4, color: '#f59e0b', fontStyle: 'italic', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>ملاحظة: {ord.notes}</Text>
                                   )}
                                   <Text style={{ marginTop: 6, fontSize: 11, color: isLightMode ? '#94a3b8' : '#64748b', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{ord.createdAt}</Text>
                                </View>

                                <View style={styles.orderRight}>
                                   <Text style={{ fontSize: 12, color: isLightMode ? '#64748b' : '#94a3b8', marginBottom: 6, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', fontWeight: 'bold' }}>#{ord.receiptNumber || (ord.id ? ord.id.substring(0,6) : '')}</Text>
                                   <View style={[
                                      styles.statusBadge, 
                                      ord.status === 'delivered' ? styles.badgeDelivered : 
                                      ord.status === 'returned' || ord.status === 'returned_warehouse' ? styles.badgeReturned : 
                                      ord.status === 'partial' ? styles.badgePartial :
                                      ord.status === 'cancelled' ? styles.badgeCancelled :
                                      ord.status === 'backordered' ? styles.badgeBackordered : styles.badgePending,
                                      { borderWidth: 1, borderColor: 
                                         ord.status === 'delivered' ? 'rgba(16, 185, 129, 0.3)' : 
                                         ord.status === 'returned' || ord.status === 'returned_warehouse' ? 'rgba(244, 63, 94, 0.3)' : 
                                         ord.status === 'partial' ? 'rgba(14, 165, 233, 0.3)' :
                                         ord.status === 'cancelled' ? 'rgba(244, 63, 94, 0.3)' :
                                         ord.status === 'backordered' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(251, 191, 36, 0.3)'
                                      }
                                   ]}>
                                      <Text style={[styles.statusBadgeText, {
                                         color: ord.status === 'delivered' ? (isLightMode ? '#059669' : '#34d399') :
                                                ord.status === 'partial' ? (isLightMode ? '#0284c7' : '#38bdf8') :
                                                ord.status === 'returned' || ord.status === 'returned_warehouse' || ord.status === 'cancelled' ? (isLightMode ? '#e11d48' : '#fb7185') :
                                                ord.status === 'backordered' ? (isLightMode ? '#7c3aed' : '#a78bfa') :
                                                (isLightMode ? '#d97706' : '#fbbf24')
                                      }]}>
                                         {ord.status === 'delivered' ? 'واصل' :
                                          ord.status === 'partial' ? 'واصل جزئي' :
                                          ord.status === 'returned' ? 'راجع' :
                                          ord.status === 'returned_warehouse' ? 'راجع مستلم بالمخزن' :
                                          ord.status === 'cancelled' ? 'ملغي' :
                                          ord.status === 'processing' ? 'جاري التجهيز' :
                                          ord.status === 'shipped' ? 'تم الشحن' :
                                          ord.status === 'ofd' ? 'قيد التوصيل' :
                                          ord.status === 'backordered' ? 'بانتظار المخزون' :
                                          ord.status === 'postponed' ? 'مؤجل' :
                                          ord.status === 'delivered_settled' ? 'مكتمل' :
                                          'قيد الانتظار'}
                                      </Text>
                                   </View>
                                   {ord.deliveryCost !== undefined && (
                                      <Text style={{ marginTop: 6, fontSize: 12, color: isLightMode ? '#475569' : '#cbd5e1', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                                         توصيل: {ord.deliveryCost.toLocaleString('en-US')}
                                      </Text>
                                   )}
                                   <Text style={{ marginTop: 4, fontSize: 14, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                                      {(ord.totalCost || 0).toLocaleString('en-US')} دينار
                                   </Text>
                                   
                                   {(userRole === 'admin' || userRole === 'editor') && (
                                      <TouchableOpacity onPress={() => { setSelectedGridStatus(null); setIsSearchModalVisible(false); setTimeout(() => handleEditOrder(ord), 300); }} style={{ marginTop: 10, backgroundColor: isLightMode ? '#8b5cf6' : '#6d28d9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' }}>
                                         <Text style={{ color: '#e9d5ff', fontWeight: 'bold', fontSize: 12 }}>✏️ تعديل الطلب</Text>
                                      </TouchableOpacity>
                                   )}
                                </View>
                             </View>
                          )}
                       />
                    </View>
                 );
              }

              return (
                <ScrollView contentContainerStyle={{ paddingBottom: 50, flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {Object.keys(statusCounts).map(st => {
                     const info = statusLabels[st] || statusLabels['unknown'];
                     return (
                        <TouchableOpacity 
                           key={st} 
                           style={{ width: '48%', backgroundColor: info.bg, borderWidth: 1, borderColor: info.border, borderRadius: 12, padding: 15, marginBottom: 15, alignItems: 'center', justifyContent: 'center' }}
                           onPress={() => setSelectedGridStatus(st)}
                        >
                           <Text style={{ fontSize: 28, fontWeight: 'bold', color: info.text, marginBottom: 5 }}>{statusCounts[st]}</Text>
                           <Text style={{ fontSize: 14, fontWeight: 'bold', color: info.text, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{info.label}</Text>
                        </TouchableOpacity>
                     );
                  })}
                  
                  {/* Total Card */}
                  <View style={{ width: '100%', backgroundColor: isLightMode ? '#f1f5f9' : '#1e293b', borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', borderRadius: 12, padding: 20, marginBottom: 15, alignItems: 'center', justifyContent: 'center' }}>
                     <Text style={{ fontSize: 32, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#f8fafc', marginBottom: 5 }}>{filteredList.length}</Text>
                     <Text style={{ fontSize: 16, fontWeight: 'bold', color: isLightMode ? '#475569' : '#cbd5e1', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>المجموع الكلي للطلبات</Text>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
          </SafeAreaView>
          </Modal>`;

let startIndex = content.indexOf(oldGridBlockStart);
let endIndex = content.indexOf(oldGridBlockEnd);

if (startIndex !== -1 && endIndex !== -1) {
    let before = content.substring(0, startIndex);
    let after = content.substring(endIndex + oldGridBlockEnd.length);
    content = before + newGridBlock + after;
    fs.writeFileSync('App.js', content);
    console.log('Successfully added Drill-Down functionality to Advanced Search!');
} else {
    console.log('Failed to find the Grid block to replace.');
}
