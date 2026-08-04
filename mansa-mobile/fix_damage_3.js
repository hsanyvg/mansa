const fs = require('fs');

const lines = fs.readFileSync('App.js', 'utf8').split('\n');
const fixedLines = [];

for (let i = 0; i < lines.length; i++) {
  if (i === 2433 && lines[i].includes('placeholder="اسم الزبون *"')) {
    // We hit the corrupted block!
    fixedLines.push(`                  {selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId)?.name : "-- اختر موظفة الرد --"}`);
    fixedLines.push(`                </Text>`);
    fixedLines.push(`              </TouchableOpacity>`);
    fixedLines.push(`            </View>`);
    fixedLines.push(``);
    fixedLines.push(`            {/* Receipt Number (Optional) */}`);
    fixedLines.push(`            <View style={styles.formGroup}>`);
    fixedLines.push(`              <TextInput `);
    fixedLines.push(`                style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff' }]}`);
    fixedLines.push(`                value={customReceiptNumber}`);
    fixedLines.push(`                onChangeText={setCustomReceiptNumber}`);
    fixedLines.push(`                placeholder="رقم الوصل (اختياري، يملأ عبر الباركود)"`);
    fixedLines.push(`                placeholderTextColor="rgba(255,255,255,0.3)"`);
    fixedLines.push(`              />`);
    fixedLines.push(`            </View>`);
    fixedLines.push(``);
    fixedLines.push(`            {/* Input Name */}`);
    fixedLines.push(`            <View style={styles.formGroup}>`);
    fixedLines.push(`              <TextInput `);
    fixedLines.push(`                style={[styles.input, isFieldInvalid(customerName) && styles.inputError]}`);
    fixedLines.push(`                value={customerName}`);
    fixedLines.push(`                onChangeText={setCustomerName}`);
    fixedLines.push(`                placeholder="اسم الزبون *"`);
  } else {
    fixedLines.push(lines[i]);
  }
}

fs.writeFileSync('App.js', fixedLines.join('\n'));
console.log("Replaced perfectly by line index.");
