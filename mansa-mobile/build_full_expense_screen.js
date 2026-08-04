const fs = require('fs');

let App = fs.readFileSync('App.js', 'utf8');

// 1. Add Image Picker Import
if (!App.includes('expo-image-picker')) {
  App = App.replace(
    "import * as Updates from 'expo-updates';",
    "import * as Updates from 'expo-updates';\nimport * as ImagePicker from 'expo-image-picker';\nimport { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';\nimport { storage } from './firebase';"
  );
}

// 2. Add New States
const newStates = `
  // Full Add Expense states
  const [expenseTagsDb, setExpenseTagsDb] = useState([]);
  const [pagesStoresDb, setPagesStoresDb] = useState([]);
  const [branchesDb, setBranchesDb] = useState([]);
  const [expenseCategoriesDb, setExpenseCategoriesDb] = useState([]);
  const [walletsDb, setWalletsDb] = useState([]);
  
  const [expensePageId, setExpensePageId] = useState('');
  const [expenseBranchId, setExpenseBranchId] = useState('');
  const [expenseItemId, setExpenseItemId] = useState('');
  const [expenseSelectedTags, setExpenseSelectedTags] = useState([]);
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showExpenseDatePicker, setShowExpenseDatePicker] = useState(false);
  const [expenseImage, setExpenseImage] = useState(null);
  const [isUploadingExpense, setIsUploadingExpense] = useState(false);
`;
if (!App.includes('const [expenseTagsDb')) {
  App = App.replace(
    "const [newBarcodeReceipt, setNewBarcodeReceipt] = useState('');",
    "const [newBarcodeReceipt, setNewBarcodeReceipt] = useState('');\n" + newStates
  );
}

// 3. Add Data Fetchers
const newFetchers = `
    const unsubExpCats = onSnapshot(collection(db, 'users', adminUid, 'expense_categories'), s => setExpenseCategoriesDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubWallets = onSnapshot(collection(db, 'users', adminUid, 'wallets'), s => setWalletsDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTags = onSnapshot(collection(db, 'users', adminUid, 'expense_tags'), s => setExpenseTagsDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPagesStores = onSnapshot(collection(db, 'users', adminUid, 'pages_stores'), s => setPagesStoresDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBranches = onSnapshot(collection(db, 'users', adminUid, 'categories'), s => setBranchesDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
`;
if (!App.includes('const unsubExpCats')) {
  App = App.replace(
    "const unsub = onSnapshot(collection(db, 'users', adminUid, 'customers'), (snapshot) => {",
    newFetchers + "\n    const unsub = onSnapshot(collection(db, 'users', adminUid, 'customers'), (snapshot) => {"
  );
}

// 4. Update the Action Sheet Button for Expense
App = App.replace(
  "onPress={() => { setPlusMenuVisible(false); setAddExpenseModalVisible(true); }}",
  "onPress={() => { setPlusMenuVisible(false); setActiveTab('add_expense'); }}"
);

// 5. Replace handleSaveExpense
const oldHandleSaveExpenseStart = "const handleSaveExpense = async () => {";
const oldHandleSaveExpenseEnd = "  const handleSaveBarcodeReceipt = async () => {";
if (App.includes(oldHandleSaveExpenseStart) && App.includes(oldHandleSaveExpenseEnd)) {
  const parts = App.split(oldHandleSaveExpenseStart);
  const before = parts[0];
  const after = parts[1].split(oldHandleSaveExpenseEnd)[1];
  
  const newHandleSaveExpense = `const pickExpenseImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setExpenseImage(result.assets[0].uri);
    }
  };

  const handleSaveExpense = async () => {
    if (!newExpenseCategory || !newExpenseAmount || !newExpenseWallet) {
      setAlertModal({ visible: true, message: 'يرجى تعبئة الحقول الأساسية (الفئة، المبلغ، المحفظة)' });
      return;
    }
    
    setIsUploadingExpense(true);
    try {
      let uploadedImageUrl = '';
      if (expenseImage) {
        const response = await fetch(expenseImage);
        const blob = await response.blob();
        const filename = \`expenses/\${Date.now()}-\${Math.random().toString(36).substring(7)}\`;
        const storageRef = ref(storage, \`users/\${adminUid}/\${filename}\`);
        const uploadTask = await uploadBytesResumable(storageRef, blob);
        uploadedImageUrl = await getDownloadURL(storageRef);
      }

      const numAmount = Number(newExpenseAmount);
      const cat = expenseCategoriesDb.find(c => c.id === newExpenseCategory);
      const wallet = walletsDb.find(w => w.id === newExpenseWallet);
      
      const pg = pagesStoresDb.find(p => p.id === expensePageId);
      const br = branchesDb.find(b => b.id === expenseBranchId);
      const it = baseProducts.find(i => i.id === expenseItemId) || compositeProductsData.find(i => i.id === expenseItemId);
      
      const batch = writeBatch(db);
      const expenseRef = doc(collection(db, 'users', adminUid, 'expenses'));
      const treasuryRef = doc(collection(db, 'users', adminUid, 'treasury_transactions'));
      
      const dateStr = expenseDate.toISOString().split('T')[0];
      const timeStr = expenseDate.toTimeString().split(' ')[0];

      batch.set(expenseRef, {
        categoryId: newExpenseCategory,
        categoryName: cat?.name || '',
        amount: numAmount,
        currency: newExpenseCurrency,
        date: dateStr,
        time: timeStr,
        details: newExpenseDetails,
        walletId: newExpenseWallet,
        walletName: wallet?.name || '',
        pageId: expensePageId,
        pageName: pg?.name || '',
        branchId: expenseBranchId,
        branchName: br?.name || '',
        itemId: expenseItemId,
        itemName: it?.name || '',
        tags: expenseSelectedTags,
        imageUrl: uploadedImageUrl,
        isArchived: false,
        createdAt: serverTimestamp()
      });

      batch.set(treasuryRef, {
        type: 'withdraw',
        walletId: newExpenseWallet,
        amount: numAmount,
        currency: newExpenseCurrency,
        date: dateStr,
        time: timeStr,
        details: \`مصروف فئة \${cat?.name || 'غير محدد'} - \${newExpenseDetails}\`,
        createdAt: serverTimestamp(),
        isAutomated: true,
        expenseId: expenseRef.id
      });

      await batch.commit();

      // Reset
      setActiveTab('dashboard');
      setNewExpenseCategory('');
      setNewExpenseAmount('');
      setNewExpenseDetails('');
      setNewExpenseWallet('');
      setExpensePageId('');
      setExpenseBranchId('');
      setExpenseItemId('');
      setExpenseSelectedTags([]);
      setExpenseImage(null);
      setExpenseDate(new Date());
      setIsUploadingExpense(false);
      setAlertModal({ visible: true, message: 'تم إضافة المصروف بنجاح' });
    } catch(err) {
      console.log(err);
      setIsUploadingExpense(false);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الحفظ' });
    }
  };

  const handleSaveBarcodeReceipt = async () => {`;
  
  App = before + newHandleSaveExpense + after;
}

// 6. Add UI to the tab rendering (near activeTab === 'entry')
const newScreenUI = `} else if (activeTab === 'add_expense') {
        return (
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
        );
      } else if (activeTab === 'entry') {`;

App = App.replace("} else if (activeTab === 'entry') {", newScreenUI);

fs.writeFileSync('App.js', App);
console.log("Full screen Add Expense injected successfully!");
