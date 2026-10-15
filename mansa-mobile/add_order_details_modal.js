const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

// 1. Add state variable for the modal
if (!content.includes('const [selectedOrderForDetails, setSelectedOrderForDetails]')) {
  content = content.replace(
    /const \[isSearchingServer, setIsSearchingServer\] = useState\(false\);/,
    `const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);`
  );
}

// 2. The Modal JSX
const modalJSX = `
      {/* Order Details Modal */}
      <Modal visible={!!selectedOrderForDetails} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
          {selectedOrderForDetails && (
            <View style={{ width: '95%', maxHeight: '90%', backgroundColor: '#13121e', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#332b47' }}>
              
              {/* Header */}
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                 <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, color: '#fff', fontWeight: 'bold' }}>تفاصيل الطلب</Text>
                    <Text style={{ fontSize: 18, color: '#a855f7', marginLeft: 10 }}>#{selectedOrderForDetails.receiptNumber || selectedOrderForDetails.id?.substring(0,6)}</Text>
                 </View>
                 <TouchableOpacity onPress={() => setSelectedOrderForDetails(null)}>
                    <Text style={{ fontSize: 24, color: '#94a3b8', fontWeight: 'bold' }}>×</Text>
                 </TouchableOpacity>
              </View>

              <ScrollView>
                 {/* Top Grid Info */}
                 <View style={{ borderWidth: 1, borderColor: '#332b47', borderRadius: 12, padding: 15, marginBottom: 20, backgroundColor: '#181726' }}>
                    
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 }}>
                       <View style={{ alignItems: 'flex-end', flex: 1 }}>
                          <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>مستخدم النظام</Text>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{selectedOrderForDetails.bookingEmployeeName || 'مجهول'}</Text>
                       </View>
                       <View style={{ alignItems: 'flex-end', flex: 1 }}>
                          <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>رقم الهاتف</Text>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{selectedOrderForDetails.customerPhone}</Text>
                       </View>
                    </View>

                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 }}>
                       <View style={{ alignItems: 'flex-end', flex: 1 }}>
                          <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>المحافظة</Text>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{selectedOrderForDetails.governorate}</Text>
                       </View>
                       <View style={{ alignItems: 'flex-end', flex: 1 }}>
                          <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>المنطقة</Text>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{selectedOrderForDetails.region || 'غير محدد'}</Text>
                       </View>
                    </View>

                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                       <View style={{ alignItems: 'flex-end', flex: 1 }}>
                          <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>الموظف المسؤول</Text>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{selectedOrderForDetails.employeeName || 'المدير'}</Text>
                       </View>
                       <View style={{ alignItems: 'flex-end', flex: 1 }}>
                          <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>تاريخ ووقت الطلب</Text>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                             {selectedOrderForDetails.date && typeof selectedOrderForDetails.date.toDate === 'function' ? selectedOrderForDetails.date.toDate().toLocaleString('en-GB') : (selectedOrderForDetails.date || '')}
                          </Text>
                       </View>
                    </View>
                 </View>

                 {/* Products Table */}
                 <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#332b47' }}>
                    {/* Table Header */}
                    <View style={{ flexDirection: 'row-reverse', backgroundColor: '#10b981', padding: 12 }}>
                       <Text style={{ flex: 0.5, color: '#000', fontWeight: 'bold', textAlign: 'center' }}>#</Text>
                       <Text style={{ flex: 3, color: '#000', fontWeight: 'bold', textAlign: 'right' }}>الصنف</Text>
                       <Text style={{ flex: 1, color: '#000', fontWeight: 'bold', textAlign: 'center' }}>الكمية</Text>
                       <Text style={{ flex: 2, color: '#000', fontWeight: 'bold', textAlign: 'center' }}>السعر المفرد</Text>
                       <Text style={{ flex: 2, color: '#000', fontWeight: 'bold', textAlign: 'center' }}>الإجمالي</Text>
                    </View>
                    {/* Table Rows */}
                    {Array.isArray(selectedOrderForDetails.items) && selectedOrderForDetails.items.length > 0 ? selectedOrderForDetails.items.map((item, idx) => (
                       <View key={idx} style={{ flexDirection: 'row-reverse', backgroundColor: '#181726', padding: 12, borderTopWidth: 1, borderTopColor: '#332b47' }}>
                          <Text style={{ flex: 0.5, color: '#fff', textAlign: 'center' }}>{idx + 1}</Text>
                          <Text style={{ flex: 3, color: '#fff', textAlign: 'right' }}>{item.productName}</Text>
                          <Text style={{ flex: 1, color: '#fff', textAlign: 'center' }}>{item.quantity}</Text>
                          <Text style={{ flex: 2, color: '#fff', textAlign: 'center' }}>{Number(item.unitPrice).toLocaleString()} د.ع</Text>
                          <Text style={{ flex: 2, color: '#10b981', fontWeight: 'bold', textAlign: 'center' }}>{Number(item.total).toLocaleString()} د.ع</Text>
                       </View>
                    )) : (
                       <View style={{ backgroundColor: '#181726', padding: 15 }}><Text style={{ color: '#94a3b8', textAlign: 'center' }}>بدون منتجات</Text></View>
                    )}
                 </View>

                 {/* Operations Log */}
                 <Text style={{ color: '#a855f7', fontSize: 16, fontWeight: 'bold', marginBottom: 15, textAlign: 'right' }}>سجل عمليات الطلب 🕒</Text>
                 <View style={{ borderWidth: 1, borderColor: '#332b47', borderRadius: 12, padding: 15, marginBottom: 20, backgroundColor: '#181726' }}>
                    {/* Fake log entry since full logs aren't saved in DB yet */}
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                       <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#a855f7', marginTop: 5 }} />
                          <View style={{ width: 2, height: 50, backgroundColor: '#332b47' }} />
                       </View>
                       <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>إنشاء الطلب</Text>
                          <Text style={{ color: '#64748b', fontSize: 13 }}>تم تسجيل الطلب في النظام</Text>
                          <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 5 }}>
                             <Text style={{ color: '#10b981', fontSize: 11 }}>👤 {selectedOrderForDetails.bookingEmployeeName || 'النظام'}</Text>
                          </View>
                       </View>
                       <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                             {selectedOrderForDetails.date && typeof selectedOrderForDetails.date.toDate === 'function' ? selectedOrderForDetails.date.toDate().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'}) : ''}
                          </Text>
                          <Text style={{ color: '#64748b', fontSize: 10 }}>
                             {selectedOrderForDetails.date && typeof selectedOrderForDetails.date.toDate === 'function' ? selectedOrderForDetails.date.toDate().toLocaleDateString('en-GB') : ''}
                          </Text>
                       </View>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                       <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginTop: 5 }} />
                       </View>
                       <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>الحالة الحالية</Text>
                          <Text style={{ color: '#64748b', fontSize: 13 }}>تم التحديث إلى {translateStatus(selectedOrderForDetails.status)}</Text>
                       </View>
                       <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: '#94a3b8', fontSize: 12 }}>الآن</Text>
                       </View>
                    </View>
                 </View>

                 {/* Footer */}
                 <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                    <View style={{ flex: 1 }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#332b47', paddingBottom: 10 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 14 }}>المبلغ الكلي:</Text>
                          <Text style={{ color: '#10b981', fontSize: 14 }}>{Number(selectedOrderForDetails.totalAmount || 0).toLocaleString()} د.ع</Text>
                       </View>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                          <Text style={{ color: '#10b981', fontSize: 18, fontWeight: 'bold' }}>المبلغ الصافي:</Text>
                          <Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>{Number(selectedOrderForDetails.totalAmount || 0).toLocaleString()} د.ع</Text>
                       </View>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                       <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'left' }}>{selectedOrderForDetails.notes || 'لا توجد ملاحظات'}</Text>
                    </View>
                 </View>

              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
`;

if (!content.includes('تفاصيل الطلب')) {
  // Inject before the end of the main view
  content = content.replace(
    /\{\/\* 1\. Employee Selection Modal \*\/\}/,
    modalJSX + '\n      {/* 1. Employee Selection Modal */}'
  );
}

// 3. Update the button onPress
const oldButton = `                                <TouchableOpacity 
                                   style={{ backgroundColor: '#eab308', paddingVertical: 10, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}
                                   onPress={() => {
                                      const dateStr = ord.date && typeof ord.date.toDate === 'function' ? formatDateLocal(ord.date.toDate()) : (ord.date || 'غير متوفر');
                                      setAlertModal({ visible: true, message: 'تاريخ الطلب: ' + dateStr });
                                   }}
                                >
                                   <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>عرض التفاصيل</Text>
                                </TouchableOpacity>`;

const newButton = `                                <TouchableOpacity 
                                   style={{ backgroundColor: '#eab308', paddingVertical: 10, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}
                                   onPress={() => setSelectedOrderForDetails(ord)}
                                >
                                   <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>عرض التفاصيل</Text>
                                </TouchableOpacity>`;

content = content.replace(oldButton, newButton);

fs.writeFileSync('App.js', content);
console.log('OrderDetailsModal added');
