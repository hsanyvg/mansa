const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const oldRenderItemStart = `                          renderItem={({item: ord}) => (`;
const oldRenderItemEnd = `                          )}
                       />
                    </View>
                 );`;

const newRenderItem = `                          renderItem={({item: ord}) => (
                             <View key={ord.id} style={{ 
                                backgroundColor: '#fde047', // Yellow background
                                borderRadius: 12, 
                                padding: 16, 
                                marginBottom: 15, 
                                shadowColor: '#000', 
                                shadowOffset: { width: 0, height: 2 }, 
                                shadowOpacity: 0.2, 
                                shadowRadius: 4, 
                                elevation: 3,
                                borderWidth: 1,
                                borderColor: '#eab308'
                             }}>
                                {/* Top row: Edit Pen & Status */}
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                   <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                                      رقم الوصل : {ord.receiptNumber || (ord.id ? ord.id.substring(0,6) : '')}
                                   </Text>
                                   <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginLeft: 15 }}>
                                         {info.label}
                                      </Text>
                                      {(!isEmployee) && (
                                         <TouchableOpacity onPress={() => { setSelectedGridStatus(null); setIsSearchModalVisible(false); setTimeout(() => handleEditOrder(ord), 300); }} style={{ padding: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 20 }}>
                                            <Text style={{ fontSize: 18 }}>✏️</Text>
                                         </TouchableOpacity>
                                      )}
                                   </View>
                                </View>

                                {/* Fields */}
                                <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                   هاتف المستلم : {ord.customerPhone} {ord.customerPhone2 ? \` - \${ord.customerPhone2}\` : ''}
                                </Text>
                                <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                   المحافظة : {ord.governorate}
                                </Text>
                                <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                   المنطقة : {ord.address || 'غير محدد'}
                                </Text>
                                <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                   هاتف السائق : {ord.driverPhone || ''}
                                </Text>
                                <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                   الملاحظات : {ord.notes || 'لا توجد'}
                                </Text>
                                <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                   المبلغ الكلي : {(ord.totalCost || 0).toLocaleString('en-US')}
                                </Text>
                                <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 15, textAlign: 'right', fontWeight: 'bold' }}>
                                   اخر تحديث : {ord.createdAt || ''}
                                </Text>

                                {/* Details Button */}
                                <TouchableOpacity style={{ backgroundColor: '#eab308', paddingVertical: 10, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}>
                                   <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>عرض التفاصيل</Text>
                                </TouchableOpacity>
                             </View>
                          )}
                       />
                    </View>
                 );`;

let startIndex = content.indexOf(oldRenderItemStart);
let endIndex = content.indexOf(oldRenderItemEnd);

if (startIndex !== -1 && endIndex !== -1) {
    let before = content.substring(0, startIndex);
    let after = content.substring(endIndex + oldRenderItemEnd.length);
    content = before + newRenderItem + after;
    fs.writeFileSync('App.js', content);
    console.log('Yellow Card design applied successfully!');
} else {
    console.log('Failed to find the renderItem block.');
}
