const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const advancedSearchUI = `          {/* Advanced Search Form */}
          <View style={{ backgroundColor: '#d4af37', margin: 15, borderRadius: 16, padding: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5 }}>
            
            <View style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 15 }}>
              {/* Governorates */}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 }}>
                <TextInput
                  style={{ flex: 1, textAlign: 'right', fontSize: 16, color: '#333' }}
                  placeholder="المحافظة"
                  placeholderTextColor="#94a3b8"
                  value={advSearchGov}
                  onChangeText={setAdvSearchGov}
                />
                <Text style={{ fontSize: 18, marginLeft: 10 }}>🏢</Text>
              </View>

              {/* Date */}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 }}>
                <TextInput
                  style={{ flex: 1, textAlign: 'right', fontSize: 16, color: '#333' }}
                  placeholder="تاريخ الاضافة"
                  placeholderTextColor="#94a3b8"
                  value={advSearchDate}
                  onChangeText={setAdvSearchDate}
                />
                <Text style={{ fontSize: 18, marginLeft: 10 }}>🕒</Text>
              </View>

              {/* Receipt */}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 }}>
                <TextInput
                  style={{ flex: 1, textAlign: 'right', fontSize: 16, color: '#333' }}
                  placeholder="رقم الوصل"
                  placeholderTextColor="#94a3b8"
                  value={advSearchReceipt}
                  onChangeText={setAdvSearchReceipt}
                />
                <Text style={{ fontSize: 18, marginLeft: 10 }}>🧾</Text>
              </View>

              {/* Customer Name */}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 }}>
                <TextInput
                  style={{ flex: 1, textAlign: 'right', fontSize: 16, color: '#333' }}
                  placeholder="اسم الزبون"
                  placeholderTextColor="#94a3b8"
                  value={advSearchName}
                  onChangeText={setAdvSearchName}
                />
                <Text style={{ fontSize: 18, marginLeft: 10 }}>👤</Text>
              </View>

              {/* Customer Phone */}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 }}>
                <TextInput
                  style={{ flex: 1, textAlign: 'right', fontSize: 16, color: '#333' }}
                  placeholder="هاتف الزبون"
                  placeholderTextColor="#94a3b8"
                  value={advSearchPhone}
                  onChangeText={setAdvSearchPhone}
                  keyboardType="phone-pad"
                />
                <Text style={{ fontSize: 18, marginLeft: 10 }}>📞</Text>
              </View>

              {/* Status Picker */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Picker
                    selectedValue={advSearchStatus}
                    style={{ width: '100%', height: 40, textAlign: 'right', color: advSearchStatus ? '#333' : '#94a3b8' }}
                    onValueChange={(itemValue) => setAdvSearchStatus(itemValue)}
                  >
                    <Picker.Item label="الحالة (الكل)" value="" color="#94a3b8" />
                    <Picker.Item label="قيد الانتظار" value="pending" />
                    <Picker.Item label="قيد الانتظار (مخزن)" value="backordered" />
                    <Picker.Item label="جاري التجهيز" value="processing" />
                    <Picker.Item label="تم الشحن" value="shipped" />
                    <Picker.Item label="قيد التوصيل" value="ofd" />
                    <Picker.Item label="مكتمل (لم تتم المحاسبة)" value="delivered" />
                    <Picker.Item label="مكتمل (تمت المحاسبة)" value="delivered_settled" />
                    <Picker.Item label="واصل جزئي (لم تتم المحاسبة)" value="partial" />
                    <Picker.Item label="راجع" value="returned" />
                    <Picker.Item label="راجع عند المندوب" value="returned_agent" />
                    <Picker.Item label="راجع مخزن" value="returned_warehouse" />
                    <Picker.Item label="مؤجل" value="postponed" />
                    <Picker.Item label="ملغي" value="cancelled" />
                  </Picker>
                </View>
                <Text style={{ fontSize: 18, marginLeft: 10 }}>📨</Text>
              </View>

            </View>

            {/* Search Button */}
            <TouchableOpacity 
              style={{ backgroundColor: '#e2bb4a', paddingVertical: 12, borderRadius: 25, marginTop: 20, marginHorizontal: 40, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 }}
              onPress={() => Keyboard.dismiss()}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>بحث</Text>
            </TouchableOpacity>

          </View>`;

// Replace Neon Search with Advanced Search UI
const neonRegex = /\{\/\* Search Input with Animated Spinning Neon Border & Pulsing Glow \*\/\}([\s\S]*?)<\/Animated\.View>/;
content = content.replace(neonRegex, advancedSearchUI);


// Replace filtering logic
const oldFilter = `                    .filter((ord) => {
                      if (!ordersSearchQuery.trim()) return true;
                      const query = ordersSearchQuery.toLowerCase().trim();
                      const name = (ord.customerName || '').toLowerCase();
                      const phone = (ord.customerPhone || '').toLowerCase();
                      const phone2 = (ord.customerPhone2 || '').toLowerCase();
                      const gov = (ord.governorate || '').toLowerCase();
                      const id = (ord.id || '').toLowerCase();
                      return name.includes(query) || phone.includes(query) || phone2.includes(query) || gov.includes(query) || id.includes(query);
                    });`;

const newFilter = `                    .filter((ord) => {
                      // Multi-field filtering
                      let matches = true;
                      
                      // Match Governorate
                      if (advSearchGov.trim()) {
                        const gov = (ord.governorate || '').toLowerCase();
                        if (!gov.includes(advSearchGov.toLowerCase().trim())) matches = false;
                      }
                      
                      // Match Date (basic substring match for now)
                      if (advSearchDate.trim()) {
                        const dateStr = (ord.createdAt && ord.createdAt.toDate) 
                          ? ord.createdAt.toDate().toLocaleDateString('en-GB')
                          : '';
                        if (!dateStr.includes(advSearchDate.trim())) matches = false;
                      }

                      // Match Receipt
                      if (advSearchReceipt.trim()) {
                        const receipt = (ord.receiptNumber || ord.id || '').toLowerCase();
                        if (!receipt.includes(advSearchReceipt.toLowerCase().trim())) matches = false;
                      }

                      // Match Customer Name
                      if (advSearchName.trim()) {
                        const name = (ord.customerName || '').toLowerCase();
                        if (!name.includes(advSearchName.toLowerCase().trim())) matches = false;
                      }

                      // Match Phone
                      if (advSearchPhone.trim()) {
                        const phone = (ord.customerPhone || '').toLowerCase();
                        const phone2 = (ord.customerPhone2 || '').toLowerCase();
                        if (!phone.includes(advSearchPhone.toLowerCase().trim()) && !phone2.includes(advSearchPhone.toLowerCase().trim())) matches = false;
                      }

                      // Match Status
                      if (advSearchStatus) {
                        if (ord.status !== advSearchStatus) matches = false;
                      }

                      return matches;
                    });`;

content = content.replace(oldFilter, newFilter);

fs.writeFileSync('App.js', content);
console.log("Injected advanced search UI and logic");
