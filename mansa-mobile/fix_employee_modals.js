const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add new states
content = content.replace(
    `const [selectedEmployeeId, setSelectedEmployeeId] = useState('');`,
    `const [selectedEmployeeId, setSelectedEmployeeId] = useState('');\n  const [orderBookingEmployeeId, setOrderBookingEmployeeId] = useState('');\n  const [bookingEmpModalVisible, setBookingEmpModalVisible] = useState(false);`
);

// 2. Change the Add Order form to use orderBookingEmployeeId
const addOrderFormRegex = /<TouchableOpacity\s*style=\{\[styles\.modalTrigger,\s*isFieldInvalid\(selectedEmployeeId\)\s*&&\s*styles\.inputError\]\}\s*onPress=\{\(\) => setEmpModalVisible\(true\)\}\s*>\s*<Text style=\{selectedEmployeeId \? styles\.triggerText : styles\.triggerPlaceholder\}>\s*\{selectedEmployeeId \? employees\.find\(e => e\.id === selectedEmployeeId\)\?\.name : "-- اختر موظفة الرد --"\}\s*<\/Text>\s*<\/TouchableOpacity>/g;
content = content.replace(addOrderFormRegex, 
`<TouchableOpacity 
                style={[styles.modalTrigger, isFieldInvalid(orderBookingEmployeeId) && styles.inputError]}
                onPress={() => setBookingEmpModalVisible(true)}
              >
                <Text style={orderBookingEmployeeId ? styles.triggerText : styles.triggerPlaceholder}>
                  {orderBookingEmployeeId ? employees.find(e => e.id === orderBookingEmployeeId)?.name : "-- اختر موظفة الرد --"}
                </Text>
              </TouchableOpacity>`);

// 3. Inject the new Modal before the existing empModalVisible modal
const modalInjectionRegex = /<Modal visible=\{empModalVisible\} transparent animationType="slide">/;
const newModalCode = `<Modal visible={bookingEmpModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>اختر موظفة الرد (التي حجزت الطلب)</Text>
            <FlatList 
              data={employees}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem}
                  onPress={() => { setOrderBookingEmployeeId(item.id); setBookingEmpModalVisible(false); }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setBookingEmpModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>\n\n      <Modal visible={empModalVisible} transparent animationType="slide">`;
content = content.replace(modalInjectionRegex, newModalCode);

// 4. Update handleSubmit validation
content = content.replace(
    /if \(!selectedEmployeeId\) \{\s*setAlertModal\(\{ visible: true, message: 'يرجى اختيار الموظف أولاً\.' \}\);\s*return;\s*\}/g,
    `if (!orderBookingEmployeeId) {\n      setAlertModal({ visible: true, message: 'يرجى اختيار الموظف أولاً.' });\n      return;\n    }`
);

// 5. Update orderData in handleSubmit
const orderDataReplace = /employeeId: selectedEmployeeId,\s*employeeName: employees\.find\(e => e\.id === selectedEmployeeId\)\?\.name \|\| 'مجهول',/g;
content = content.replace(
    orderDataReplace,
    `employeeId: orderBookingEmployeeId,\n        employeeName: employees.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',`
);

// 6. Update barcode saving logic
const barcodeSaveReplace = /employeeId: selectedEmployeeId \|\| 'agent',\s*employeeName: employees\?\.find\(e => e\.id === selectedEmployeeId\)\?\.name \|\| 'مجهول',/g;
content = content.replace(
    barcodeSaveReplace,
    `employeeId: orderBookingEmployeeId || 'agent',\n            employeeName: employees?.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',`
);

fs.writeFileSync('App.js', content);
console.log("Fixed employee separation logic!");
