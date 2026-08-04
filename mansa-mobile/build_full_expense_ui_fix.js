const fs = require('fs');

let App = fs.readFileSync('App.js', 'utf8');

const newScreenUI = `) : activeTab === 'add_expense' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding} keyboardShouldPersistTaps="handled">
          <View style={[styles.formContainer, { backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 20, borderRadius: 12 }]}>
            
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#fff' }}>💸 إضافة مصروف</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')} style={{ padding: 8, backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8 }}>
                <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8' }}>رجوع</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              
              {/* Right side fields (in RTL, row-reverse makes this the main grid) */}
              <View style={{ width: '100%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>البيان / التفاصيل</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', color: isLightMode ? '#000' : '#fff', textAlign: 'right', height: 100, textAlignVertical: 'top' }]}
                  placeholder="اكتب التفاصيل هنا..."
                  placeholderTextColor="#64748b"
                  multiline
                  value={newExpenseDetails}
                  onChangeText={setNewExpenseDetails}
                />
              </View>

              {/* Categories & Amounts */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>الفئة</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={newExpenseCategory} onValueChange={setNewExpenseCategory} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر الفئة..." value="" />
                    {expenseCategoriesDb.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>المبلغ</Text>
                <View style={{ flexDirection: 'row-reverse' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', color: isLightMode ? '#000' : '#fff', textAlign: 'right', marginLeft: 10 }]}
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={newExpenseAmount}
                    onChangeText={setNewExpenseAmount}
                  />
                  <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8, width: 80 }}>
                    <Picker selectedValue={newExpenseCurrency} onValueChange={setNewExpenseCurrency} style={{ color: isLightMode ? '#000' : '#fff' }}>
                      <Picker.Item label="د.ع" value="IQD" />
                      <Picker.Item label="$" value="USD" />
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Wallets & Date */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>دفع من محفظة (إلزامي)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={newExpenseWallet} onValueChange={setNewExpenseWallet} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر المحفظة..." value="" />
                    {walletsDb.map(w => <Picker.Item key={w.id} label={w.name} value={w.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>التاريخ</Text>
                <TouchableOpacity 
                  style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', justifyContent: 'center' }]}
                  onPress={() => setShowExpenseDatePicker(true)}
                >
                  <Text style={{ color: isLightMode ? '#000' : '#fff', textAlign: 'center' }}>
                    {expenseDate.toISOString().split('T')[0]}
                  </Text>
                </TouchableOpacity>
                {showExpenseDatePicker && (
                  <DateTimePicker
                    value={expenseDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowExpenseDatePicker(false);
                      if (date) setExpenseDate(date);
                    }}
                  />
                )}
              </View>

              {/* Optionals: Page, Branch, Item */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>البيج (اختياري)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={expensePageId} onValueChange={setExpensePageId} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر البيج..." value="" />
                    {pagesStoresDb.map(p => <Picker.Item key={p.id} label={p.name} value={p.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>الفرع (اختياري)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={expenseBranchId} onValueChange={setExpenseBranchId} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر الفرع..." value="" />
                    {branchesDb.map(b => <Picker.Item key={b.id} label={b.name} value={b.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>الصنف (اختياري)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={expenseItemId} onValueChange={setExpenseItemId} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر الصنف..." value="" />
                    {baseProducts.concat(compositeProductsData).map(p => <Picker.Item key={p.id} label={p.name} value={p.id} />)}
                  </Picker>
                </View>
              </View>

              {/* Image and Tags */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>صور الفاتورة / الوصل (اختياري)</Text>
                <TouchableOpacity onPress={pickExpenseImage} style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', padding: 15, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#a855f7', fontWeight: 'bold' }}>{expenseImage ? 'تم اختيار صورة (تغيير)' : '📁 اختيار صور الفاتورة'}</Text>
                </TouchableOpacity>
              </View>

            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={{ backgroundColor: '#a855f7', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 }}
              onPress={handleSaveExpense}
              disabled={isUploadingExpense}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{isUploadingExpense ? 'جاري الحفظ...' : '💾 حفظ العملية'}</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      ) : activeTab === 'entry' ? (`;

App = App.replace(") : activeTab === 'entry' ? (", newScreenUI);

fs.writeFileSync('App.js', App);
console.log("Full screen Add Expense ternary injected successfully!");
