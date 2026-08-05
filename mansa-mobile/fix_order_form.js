const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Fix the Employee Selector onPress
content = content.replace(
    `<Text style={{ color: '#e9d5ff', fontWeight: 'bold', marginBottom: 8, textAlign: 'right' }}>موظفة الرد (التي حجزت الطلب) *</Text>
              <TouchableOpacity 
                style={[styles.modalTrigger, isFieldInvalid(selectedEmployeeId) && styles.inputError]}
                onPress={() => setActiveTab('settings')}`,
    `<Text style={{ color: '#e9d5ff', fontWeight: 'bold', marginBottom: 8, textAlign: 'right' }}>موظفة الرد (التي حجزت الطلب) *</Text>
              <TouchableOpacity 
                style={[styles.modalTrigger, isFieldInvalid(selectedEmployeeId) && styles.inputError]}
                onPress={() => setEmpModalVisible(true)}`
);

// 2. Remove Customer Name field from the UI
const customerNameUI = `            {/* Customer Name */}
            <View style={styles.formGroup}>
              <Text style={{ color: '#e9d5ff', fontWeight: 'bold', marginBottom: 8, textAlign: 'right' }}>اسم الزبون *</Text>
              <TextInput 
                style={[styles.input, isFieldInvalid(customerName) && styles.inputError]}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="اسم الزبون كاملاً"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>`;

// Wait, I need to check the exact code for Customer Name UI. Let me use regex to be safe.
const customerNameUIRegex = /\s*\{\/\* Customer Name \*\/\}\s*<View style=\{styles\.formGroup\}>\s*<Text[^>]*>اسم الزبون \*(?:.*?)<\/Text>\s*<TextInput[\s\S]*?onChangeText=\{setCustomerName\}[\s\S]*?\/>\s*<\/View>/g;
content = content.replace(customerNameUIRegex, '');

// Also remove it from validation in handleSubmit
const validationRegex = /customerName\.trim\(\)\s*===\s*''\s*\|\|/g;
content = content.replace(validationRegex, '');

// 3. Receipt Number Auto Generation
// Find the transaction block where we save the order
const transactionBlock = `          const newOrderRef = doc(db, 'users', adminUid, 'orders', newOrderId.toString());
          transaction.set(newOrderRef, orderData);
          orderDocId = newOrderRef.id;`;

const newTransactionBlock = `          const newOrderRef = doc(db, 'users', adminUid, 'orders', newOrderId.toString());
          // Auto-generate receipt number if empty
          orderData.receiptNumber = customReceiptNumber.trim() || newOrderId.toString();
          transaction.set(newOrderRef, orderData);
          orderDocId = newOrderRef.id;`;

content = content.replace(transactionBlock, newTransactionBlock);

fs.writeFileSync('App.js', content);
console.log("Fixes applied successfully!");
