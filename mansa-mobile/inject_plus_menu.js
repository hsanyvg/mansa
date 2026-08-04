const fs = require('fs');

let App = fs.readFileSync('App.js', 'utf8');

// 1. Add States
const statesToInject = `
  const [plusMenuVisible, setPlusMenuVisible] = useState(false);
  const [addExpenseModalVisible, setAddExpenseModalVisible] = useState(false);
  const [addBarcodeModalVisible, setAddBarcodeModalVisible] = useState(false);

  // Expense form states
  const [expenseCategoriesDb, setExpenseCategoriesDb] = useState([]);
  const [walletsDb, setWalletsDb] = useState([]);
  const [treasuryDb, setTreasuryDb] = useState([]);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCurrency, setNewExpenseCurrency] = useState('IQD');
  const [newExpenseWallet, setNewExpenseWallet] = useState('');
  const [newExpenseDetails, setNewExpenseDetails] = useState('');

  // Barcode receipt state
  const [newBarcodeReceipt, setNewBarcodeReceipt] = useState('');
`;

if (!App.includes('const [plusMenuVisible')) {
  App = App.replace(
    "const [ordersMatches, setOrdersMatches] = useState([]);",
    "const [ordersMatches, setOrdersMatches] = useState([]);\n" + statesToInject
  );
}

// 2. Add Fetchers in useEffect
const fetchersToInject = `
      const unsubExpCats = onSnapshot(collection(db, 'users', adminUid, 'expense_categories'), s => setExpenseCategoriesDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubWallets = onSnapshot(collection(db, 'users', adminUid, 'wallets'), s => setWalletsDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubTreasury = onSnapshot(collection(db, 'users', adminUid, 'treasury_transactions'), s => setTreasuryDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
`;

if (!App.includes('expense_categories')) {
  App = App.replace(
    "const unsubPages = onSnapshot(collection(db, 'users', adminUid, 'pages_stores'),",
    fetchersToInject + "\n      const unsubPages = onSnapshot(collection(db, 'users', adminUid, 'pages_stores'),"
  );
}

// 3. Handlers
const handlersToInject = `
  const handleSaveExpense = async () => {
    if (!newExpenseCategory || !newExpenseAmount || !newExpenseWallet) {
      setAlertModal({ visible: true, message: 'يرجى تعبئة الحقول الأساسية' });
      return;
    }
    try {
      const numAmount = Number(newExpenseAmount);
      const cat = expenseCategoriesDb.find(c => c.id === newExpenseCategory);
      const wallet = walletsDb.find(w => w.id === newExpenseWallet);
      
      const batch = writeBatch(db);
      const expenseRef = doc(collection(db, 'users', adminUid, 'expenses'));
      const treasuryRef = doc(collection(db, 'users', adminUid, 'treasury_transactions'));
      
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];

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

      setAddExpenseModalVisible(false);
      setNewExpenseCategory('');
      setNewExpenseAmount('');
      setNewExpenseDetails('');
      setNewExpenseWallet('');
      setAlertModal({ visible: true, message: 'تم إضافة المصروف بنجاح' });
    } catch(err) {
      console.log(err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الحفظ' });
    }
  };

  const handleSaveBarcodeReceipt = async () => {
    if (!newBarcodeReceipt.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال رقم الوصل' });
      return;
    }
    try {
      const counterRef = doc(db, 'users', adminUid, 'metadata', 'orderCounter');
      let newOrderId = 100000;
      
      await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (counterDoc.exists()) {
            newOrderId = (counterDoc.data().lastId || 100000) + 1;
            transaction.update(counterRef, { lastId: newOrderId });
          } else {
            transaction.set(counterRef, { lastId: newOrderId });
          }
          
          const newOrderRef = doc(db, 'users', adminUid, 'orders', newOrderId.toString());
          transaction.set(newOrderRef, {
            receiptNumber: newBarcodeReceipt.trim(),
            employeeId: selectedEmployeeId,
            employeeName: employees.find(e => e.id === selectedEmployeeId)?.name || 'مجهول',
            customerName: '',
            customerPhone: '',
            governorate: '',
            region: '',
            notes: 'تم إنشاؤه عبر وصل باركود',
            paymentMethod: 'cash',
            totalAmount: 0,
            items: [],
            date: serverTimestamp(),
            status: 'waiting',
            is_settled: false
          });
      });

      setAddBarcodeModalVisible(false);
      setNewBarcodeReceipt('');
      setAlertModal({ visible: true, message: 'تم إضافة الطلب بنجاح' });
    } catch(err) {
      console.log(err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الحفظ' });
    }
  };
`;

if (!App.includes('handleSaveExpense')) {
  App = App.replace(
    "const handleAddCategory = async () => {",
    handlersToInject + "\n\n  const handleAddCategory = async () => {"
  );
}

// 4. Update the PLUS button
const oldPlusBtn = `
        {/* Center-Left: Floating + (entry) */}
        <View style={[styles.centerNavWrapper, { marginTop: -40, flex: 1.2 }]}>
          <TouchableOpacity 
            style={[styles.centerNavBtn, { backgroundColor: 'transparent', borderWidth: 0, width: 68, height: 68, shadowColor: 'transparent', elevation: 0 }, activeTab === 'entry' && styles.centerNavBtnActive]}
            onPress={() => setActiveTab('entry')}
          >
            <Svg width="76" height="76" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
              <Polygon points="50 5, 93 30, 93 70, 50 95, 7 70, 7 30" fill="#a855f7" stroke="#8b5cf6" strokeWidth="6" />
              <Polygon points="50 12, 85 32, 85 68, 50 88, 15 68, 15 32" fill="transparent" stroke="#d8b4fe" strokeWidth="3" />
            </Svg>
            <Text style={[styles.centerNavIcon, { zIndex: 2, fontSize: 34, color: 'white', marginTop: -4, fontWeight: '500' }]}>+</Text>
          </TouchableOpacity>
        </View>
`;

const newPlusBtn = `
        {/* Center-Left: Floating + (Menu) */}
        <View style={[styles.centerNavWrapper, { marginTop: -40, flex: 1.2 }]}>
          <TouchableOpacity 
            style={[styles.centerNavBtn, { backgroundColor: 'transparent', borderWidth: 0, width: 68, height: 68, shadowColor: 'transparent', elevation: 0 }, plusMenuVisible && styles.centerNavBtnActive]}
            onPress={() => setPlusMenuVisible(true)}
          >
            <Svg width="76" height="76" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
              <Polygon points="50 5, 93 30, 93 70, 50 95, 7 70, 7 30" fill="#a855f7" stroke="#8b5cf6" strokeWidth="6" />
              <Polygon points="50 12, 85 32, 85 68, 50 88, 15 68, 15 32" fill="transparent" stroke="#d8b4fe" strokeWidth="3" />
            </Svg>
            <Text style={[styles.centerNavIcon, { zIndex: 2, fontSize: 34, color: 'white', marginTop: -4, fontWeight: '500' }]}>+</Text>
          </TouchableOpacity>
        </View>
`;

if (App.includes("onPress={() => setActiveTab('entry')}")) {
  App = App.replace(oldPlusBtn.trim(), newPlusBtn.trim());
}

// 5. Add Modals (Action Sheet, Add Expense, Add Barcode Receipt)
const modalsToInject = `
      {/* Plus Menu Modal (Action Sheet) */}
      <Modal visible={plusMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setPlusMenuVisible(false)}>
          <View style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, alignItems: 'center' }}>
            <View style={{ width: 40, height: 5, backgroundColor: isLightMode ? '#cbd5e1' : '#475569', borderRadius: 5, marginBottom: 20 }} />
            
            <TouchableOpacity style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155' }} onPress={() => { setPlusMenuVisible(false); setActiveTab('entry'); }}>
              <Text style={{ fontSize: 18, color: isLightMode ? '#1e293b' : '#f8fafc', fontWeight: 'bold' }}>📦 إضافة طلب</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155' }} onPress={() => { setPlusMenuVisible(false); setAddExpenseModalVisible(true); }}>
              <Text style={{ fontSize: 18, color: isLightMode ? '#1e293b' : '#f8fafc', fontWeight: 'bold' }}>💸 إضافة مصروف</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15 }} onPress={() => { setPlusMenuVisible(false); setAddBarcodeModalVisible(true); }}>
              <Text style={{ fontSize: 18, color: isLightMode ? '#1e293b' : '#f8fafc', fontWeight: 'bold' }}>🧾 إضافة وصل باركود</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Expense Modal */}
      <Modal visible={addExpenseModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>إضافة مصروف جديد</Text>
            
            <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
              <Picker selectedValue={newExpenseCategory} onValueChange={setNewExpenseCategory} style={{ color: isLightMode ? '#000' : '#fff' }}>
                <Picker.Item label="-- الفئة --" value="" />
                {expenseCategoriesDb.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
              </Picker>
            </View>

            <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
              <Picker selectedValue={newExpenseWallet} onValueChange={setNewExpenseWallet} style={{ color: isLightMode ? '#000' : '#fff' }}>
                <Picker.Item label="-- الخزنة (للسحب منها) --" value="" />
                {walletsDb.map(w => <Picker.Item key={w.id} label={w.name} value={w.id} />)}
              </Picker>
            </View>

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', flex: 1, marginLeft: 10, textAlign: 'right' }]} placeholder="المبلغ" placeholderTextColor="#64748b" keyboardType="numeric" value={newExpenseAmount} onChangeText={setNewExpenseAmount} />
              
              <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, flex: 0.5, marginBottom: 10 }}>
                <Picker selectedValue={newExpenseCurrency} onValueChange={setNewExpenseCurrency} style={{ color: isLightMode ? '#000' : '#fff' }}>
                  <Picker.Item label="د.ع" value="IQD" />
                  <Picker.Item label="$" value="USD" />
                </Picker>
              </View>
            </View>

            <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', textAlign: 'right', height: 80, textAlignVertical: 'top' }]} placeholder="التفاصيل / ملاحظات" placeholderTextColor="#64748b" multiline value={newExpenseDetails} onChangeText={setNewExpenseDetails} />

            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleSaveExpense}><Text style={styles.modalCloseText}>حفظ المصروف</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => setAddExpenseModalVisible(false)}><Text style={styles.modalCloseText}>إغلاق</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Barcode Receipt Modal */}
      <Modal visible={addBarcodeModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>إضافة وصل باركود</Text>
            
            <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', textAlign: 'right', fontSize: 18 }]} placeholder="رقم الوصل (امسح الباركود هنا)" placeholderTextColor="#64748b" value={newBarcodeReceipt} onChangeText={setNewBarcodeReceipt} autoFocus />

            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleSaveBarcodeReceipt}><Text style={styles.modalCloseText}>حفظ كطلب جديد (قيد الانتظار)</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => setAddBarcodeModalVisible(false)}><Text style={styles.modalCloseText}>إغلاق</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
`;

if (!App.includes('plusMenuVisible')) {
  App = App.replace(
    "{/* --- Modals Section --- */}",
    "{/* --- Modals Section --- */}\n" + modalsToInject
  );
}

fs.writeFileSync('App.js', App);
console.log("Plus menu and new features successfully injected into App.js");
