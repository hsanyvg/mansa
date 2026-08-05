const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Fix Employee Selector onPress
content = content.replace(/<TouchableOpacity\s*style=\{\[styles\.modalTrigger,\s*isFieldInvalid\(selectedEmployeeId\)\s*&&\s*styles\.inputError\]\}\s*onPress=\{\(\)\s*=>\s*setActiveTab\('settings'\)\}/g, 
                          `<TouchableOpacity \n                style={[styles.modalTrigger, isFieldInvalid(selectedEmployeeId) && styles.inputError]}\n                onPress={() => setEmpModalVisible(true)}`);

// 2. Remove Customer Name UI
const customerNameUIRegex = /\s*\{\/\* Customer Name \*\/\}\s*<View style=\{styles\.formGroup\}>\s*<Text[^>]*>اسم الزبون \*(?:.*?)<\/Text>\s*<TextInput[\s\S]*?onChangeText=\{setCustomerName\}[\s\S]*?\/>\s*<\/View>/g;
content = content.replace(customerNameUIRegex, '');

// 3. Remove Customer Name validation
content = content.replace(/customerName\.trim\(\)\s*===\s*''\s*\|\|/g, '');

// 4. Receipt number auto generation inside handleSubmit transaction
// Let's use regex for this too just in case.
const transactionRegex = /const newOrderRef = doc\(db, 'users', adminUid, 'orders', newOrderId\.toString\(\)\);\s*transaction\.set\(newOrderRef, orderData\);\s*orderDocId = newOrderRef\.id;/;
content = content.replace(transactionRegex, `const newOrderRef = doc(db, 'users', adminUid, 'orders', newOrderId.toString());
          orderData.receiptNumber = customReceiptNumber.trim() || newOrderId.toString();
          transaction.set(newOrderRef, orderData);
          orderDocId = newOrderRef.id;`);

fs.writeFileSync('App.js', content);
console.log("Fixes applied successfully (attempt 2)!");
