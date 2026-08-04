const fs = require('fs');

let App = fs.readFileSync('App.js', 'utf8');

const brokenStr = `                <Text style={selectedEmployeeId ? styles.triggerText : styles.triggerPlaceholder}>
                placeholder="اسم الزبون *"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>`;

const fixedStr = `                <Text style={selectedEmployeeId ? styles.triggerText : styles.triggerPlaceholder}>
                  {selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId)?.name : "-- اختر موظفة الرد --"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Receipt Number (Optional) */}
            <View style={styles.formGroup}>
              <TextInput 
                style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff' }]}
                value={customReceiptNumber}
                onChangeText={setCustomReceiptNumber}
                placeholder="رقم الوصل (اختياري، يملأ عبر الباركود)"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>

            {/* Input Name */}
            <View style={styles.formGroup}>
              <TextInput 
                style={[styles.input, isFieldInvalid(customerName) && styles.inputError]}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="اسم الزبون *"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>`;

if (App.indexOf(brokenStr) !== -1) {
  App = App.replace(brokenStr, fixedStr);
  fs.writeFileSync('App.js', App);
  console.log("Fixed the damage!");
} else {
  console.log("Broken string not found");
}
