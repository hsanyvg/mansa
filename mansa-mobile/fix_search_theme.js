const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /\) \: activeTab === 'orders' \? \([\s\S]*?\) \: activeTab === 'products_manager' \? \(/;

const newSearchTab = `) : activeTab === 'orders' ? (
        <ScrollView style={[styles.tabContent, { backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12' }]} contentContainerStyle={{ paddingBottom: 100 }}>
          
          {/* Main Header */}
          <View style={styles.ordersHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={styles.headerIconButton} onPress={() => setEmpModalVisible(true)}>
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <Circle cx="12" cy="7" r="4" />
                </Svg>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerIconButton, { marginLeft: 10 }]}>
                <View style={{ position: 'relative' }}>
                  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </Svg>
                  <View style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, backgroundColor: '#ef4444', borderRadius: 4 }} />
                </View>
              </TouchableOpacity>
            </View>
            <View>
              <Text style={styles.ordersHeaderTitle}>البحث المتقدم</Text>
              <Text style={styles.ordersHeaderSubtitle}>ابحث عن الطلبات بسهولة</Text>
            </View>
          </View>

          {/* Advanced Search Form */}
          <View style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', borderRadius: 16, padding: 15, marginHorizontal: 5, marginBottom: 20, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
            
            {/* Governorates */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="المحافظة"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchGov}
                onChangeText={setAdvSearchGov}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M3 21h18" /><Path d="M9 8h1" /><Path d="M9 12h1" /><Path d="M9 16h1" /><Path d="M14 8h1" /><Path d="M14 12h1" /><Path d="M14 16h1" /><Path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /></Svg>
            </View>

            {/* Date */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="تاريخ الاضافة (مثال: 2024-05-01)"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchDate}
                onChangeText={setAdvSearchDate}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Circle cx="12" cy="12" r="10" /><Path d="M12 6v6l4 2" /></Svg>
            </View>

            {/* Receipt */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="رقم الوصل"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchReceipt}
                onChangeText={setAdvSearchReceipt}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><Path d="M16 2v4" /><Path d="M8 2v4" /><Path d="M3 10h18" /></Svg>
            </View>

            {/* Customer Name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="اسم الزبون"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchName}
                onChangeText={setAdvSearchName}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx="12" cy="7" r="4" /></Svg>
            </View>

            {/* Customer Phone */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="هاتف الزبون"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchPhone}
                onChangeText={setAdvSearchPhone}
                keyboardType="phone-pad"
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>
            </View>

            {/* Status Picker */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                <Picker
                  selectedValue={advSearchStatus}
                  style={{ width: '100%', height: 48, textAlign: 'right', color: advSearchStatus ? (isLightMode ? '#1e293b' : '#f8fafc') : (isLightMode ? '#94a3b8' : '#64748b') }}
                  onValueChange={(itemValue) => setAdvSearchStatus(itemValue)}
                >
                  <Picker.Item label="الحالة (الكل)" value="" color={isLightMode ? '#94a3b8' : '#64748b'} />
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
                  <Picker.Item label="ملغي" value="cancelled" color={isLightMode ? '#1e293b' : '#f8fafc'} />
                </Picker>
              </View>
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M22 2L11 13" /><Path d="M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
            </View>

            {/* Clear Button */}
            <TouchableOpacity 
              style={{ paddingVertical: 10, alignItems: 'center', marginBottom: 10 }}
              onPress={() => {
                setAdvSearchGov('');
                setAdvSearchDate('');
                setAdvSearchReceipt('');
                setAdvSearchName('');
                setAdvSearchPhone('');
                setAdvSearchStatus('');
                Keyboard.dismiss();
              }}
            >
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: 'bold' }}>مسح الحقول</Text>
            </TouchableOpacity>

            {/* Search Button */}
            <TouchableOpacity 
              style={{ backgroundColor: isLightMode ? '#3b82f6' : '#a855f7', paddingVertical: 14, borderRadius: 12, alignItems: 'center', shadowColor: isLightMode ? '#3b82f6' : '#a855f7', shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 }}
              onPress={() => Keyboard.dismiss()}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>بحث</Text>
            </TouchableOpacity>
          </View>

          {/* Search Results */}
          <View style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, minHeight: 400, marginTop: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc', textAlign: 'right', marginBottom: 15 }}>نتائج البحث</Text>
          
            {(() => {
              // Only filter if at least one field is filled
              const hasSearchCriteria = !!(advSearchGov || advSearchDate || advSearchReceipt || advSearchName || advSearchPhone || advSearchStatus);

              if (!hasSearchCriteria) {
                return (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, opacity: 0.5 }}>
                    <Svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#94a3b8' : '#64748b'} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 15 }}><Circle cx="11" cy="11" r="8" /><Path d="m21 21-4.3-4.3" /></Svg>
                    <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8', fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>قم بإدخال معلومات للبحث عن الطلبات</Text>
                  </View>
                );
              }

              const filteredList = orders.filter((ord) => {
                let match = true;
                
                if (advSearchGov && advSearchGov.trim()) {
                  if (!(ord.governorate || '').toLowerCase().includes(advSearchGov.toLowerCase().trim())) match = false;
                }
                
                if (advSearchDate && advSearchDate.trim()) {
                  if (!(ord.createdAt || '').toLowerCase().includes(advSearchDate.toLowerCase().trim())) match = false;
                }
                
                if (advSearchReceipt && advSearchReceipt.trim()) {
                  if (!(ord.receiptNumber || ord.id || '').toLowerCase().includes(advSearchReceipt.toLowerCase().trim())) match = false;
                }
                
                if (advSearchName && advSearchName.trim()) {
                  if (!(ord.customerName || '').toLowerCase().includes(advSearchName.toLowerCase().trim())) match = false;
                }
                
                if (advSearchPhone && advSearchPhone.trim()) {
                  const p1 = (ord.customerPhone || '').toLowerCase();
                  const p2 = (ord.customerPhone2 || '').toLowerCase();
                  const term = advSearchPhone.toLowerCase().trim();
                  if (!p1.includes(term) && !p2.includes(term)) match = false;
                }
                
                if (advSearchStatus && advSearchStatus.trim()) {
                  if (ord.status !== advSearchStatus) match = false;
                }
                
                return match;
              });

              if (filteredList.length === 0) {
                return (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <Svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 15 }}><Circle cx="12" cy="12" r="10"/><Path d="m15 9-6 6"/><Path d="m9 9 6 6"/></Svg>
                    <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8', fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>لا توجد طلبات تطابق بحثك</Text>
                  </View>
                );
              }

              return (
                <FlatList 
                  data={filteredList} 
                  keyExtractor={ord => ord.id}
                  initialNumToRender={25}
                  maxToRenderPerBatch={50}
                  windowSize={10}
                  contentContainerStyle={{ paddingBottom: 50 }}
                  renderItem={({item: ord}) => (
                    <View key={ord.id} style={styles.orderItem}>
                      <View style={styles.orderLeft}>
                        <Text style={styles.orderCustName}>{ord.customerName}</Text>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
                          <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>
                          <Text style={[styles.orderPhone, { marginRight: 4 }]}>{ord.customerPhone} {ord.customerPhone2 ? \` - \${ord.customerPhone2}\` : ''}</Text>
                        </View>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
                          <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><Circle cx="12" cy="10" r="3" /></Svg>
                          <Text style={[styles.orderPhone, { marginRight: 4 }]}>{ord.governorate} {ord.address ? \`- \${ord.address}\` : ''}</Text>
                        </View>
                        <Text style={[styles.orderPhone, { marginTop: 4 }]}>المنتجات: {Array.isArray(ord.products) ? ord.products.map(p => p.name).join('، ') : 'بدون منتجات'}</Text>
                        {ord.notes && ord.notes.trim() !== '' && (
                          <Text style={[styles.orderPhone, { marginTop: 4, color: '#f59e0b', fontStyle: 'italic' }]}>ملاحظة: {ord.notes}</Text>
                        )}
                        <Text style={[styles.orderPhone, { marginTop: 4, fontSize: 10, color: isLightMode ? '#94a3b8' : '#475569' }]}>{ord.createdAt}</Text>
                      </View>

                      <View style={styles.orderRight}>
                        <View style={[
                          styles.statusBadge, 
                          ord.status === 'delivered' ? styles.badgeDelivered : 
                          ord.status === 'returned' || ord.status === 'returned_warehouse' ? styles.badgeReturned : 
                          ord.status === 'partial' ? styles.badgePartial :
                          ord.status === 'cancelled' ? styles.badgeCancelled :
                          ord.status === 'backordered' ? styles.badgeBackordered : styles.badgePending
                        ]}>
                          <Text style={styles.statusBadgeText}>
                            {ord.status === 'delivered' ? 'واصل' :
                             ord.status === 'partial' ? 'واصل جزئي' :
                             ord.status === 'returned' ? 'راجع' :
                             ord.status === 'returned_warehouse' ? 'راجع مستلم بالمخزن' :
                             ord.status === 'cancelled' ? 'ملغي' :
                             ord.status === 'backordered' ? 'بانتظار المخزون' : 'قيد الانتظار'}
                          </Text>
                        </View>
                        
                        {(ord.status !== 'delivered' && ord.status !== 'cancelled' && ord.status !== 'returned_warehouse' && ord.status !== 'returned' && ord.status !== 'returned_agent') && (
                          <TouchableOpacity 
                            style={{ padding: 6, backgroundColor: 'rgba(168, 85, 247, 0.15)', borderRadius: 6, marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.4)' }}
                            onPress={() => handleEditOrder(ord)}
                          >
                            <Text style={{ color: '#e9d5ff', fontWeight: 'bold', fontSize: 12 }}>✏️ تعديل الطلب</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )} 
                />
              );
            })()}
          </View>
        </ScrollView>
      ) : activeTab === 'products_manager' ? (`;

content = content.replace(regex, newSearchTab);
fs.writeFileSync('App.js', content);
console.log("Updated search tab theme and logic");
