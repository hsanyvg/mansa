const fs = require('fs');

let App = fs.readFileSync('App.js', 'utf8');

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
            employeeId: selectedEmployeeId || 'agent',
            employeeName: employees?.find(e => e.id === selectedEmployeeId)?.name || 'مجهول',
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

if (!App.includes('const handleSaveExpense')) {
  App = App.replace(
    "const handleSubmit = async () => {",
    handlersToInject + "\n\n  const handleSubmit = async () => {"
  );
  fs.writeFileSync('App.js', App);
  console.log("Handlers injected successfully!");
} else {
  console.log("Handlers already injected.");
}
