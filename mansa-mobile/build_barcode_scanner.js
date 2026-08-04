const fs = require('fs');

let App = fs.readFileSync('App.js', 'utf8');

// 1. Add imports for expo-camera
if (!App.includes("import { CameraView, useCameraPermissions }")) {
  App = App.replace("import * as ImagePicker from 'expo-image-picker';", "import * as ImagePicker from 'expo-image-picker';\nimport { CameraView, useCameraPermissions } from 'expo-camera';");
}

// 2. Add state for customReceiptNumber inside App()
if (!App.includes("const [customReceiptNumber, setCustomReceiptNumber]")) {
  App = App.replace("const [newBarcodeReceipt, setNewBarcodeReceipt] = useState('');", "const [newBarcodeReceipt, setNewBarcodeReceipt] = useState('');\n  const [customReceiptNumber, setCustomReceiptNumber] = useState('');\n  const [cameraPermission, requestCameraPermission] = useCameraPermissions();\n  const [scanned, setScanned] = useState(false);");
}

// 3. Replace handleSaveBarcodeReceipt logic
const oldHandleSave = `  const handleSaveBarcodeReceipt = async () => {
    if (!newBarcodeReceipt.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال رقم الوصل.' });
      return;
    }
    setIsUploadingExpense(true); // just reusing state for loading
    try {
      const orderRef = doc(collection(db, 'users', adminUid, 'orders'));
      await setDoc(orderRef, {
        receiptNumber: newBarcodeReceipt.trim(),
        employeeId: selectedEmployeeId || 'agent',
        employeeName: employees?.find(e => e.id === selectedEmployeeId)?.name || 'مجهول',
        date: serverTimestamp(),
        status: 'waiting',
        items: [],
        totalAmount: 0,
        customerName: '',
        customerPhone: '',
        governorate: '',
        region: ''
      });
      // also log
      const logRef = doc(collection(db, 'users', adminUid, 'system_logs'));
      await setDoc(logRef, {
          action: 'create_order',
          orderId: orderRef.id,
          employeeId: selectedEmployeeId || 'agent',
          employeeName: employees?.find(e => e.id === selectedEmployeeId)?.name || 'مجهول',
          details: \`تم إضافة طلب انتظار (وصل باركود رقم \${newBarcodeReceipt.trim()})\`,
          timestamp: serverTimestamp()
      });

      setAddBarcodeModalVisible(false);
      setNewBarcodeReceipt('');
      setAlertModal({ visible: true, message: 'تم إضافة الوصل للانتظار بنجاح!' });
    } catch(err) {
      console.error(err);
      setAlertModal({ visible: true, message: 'حدث خطأ.' });
    }
    setIsUploadingExpense(false);
  };`;

const newHandleSave = `  const handleSaveBarcodeReceipt = () => {
    if (!newBarcodeReceipt.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال أو مسح رقم الوصل.' });
      return;
    }
    setCustomReceiptNumber(newBarcodeReceipt.trim());
    setAddBarcodeModalVisible(false);
    setNewBarcodeReceipt('');
    setScanned(false);
    setActiveTab('entry');
  };

  const handleBarcodeScanned = ({ type, data }) => {
    setScanned(true);
    setNewBarcodeReceipt(data);
    // Auto-continue to entry screen
    setCustomReceiptNumber(data.trim());
    setAddBarcodeModalVisible(false);
    setNewBarcodeReceipt('');
    setScanned(false);
    setActiveTab('entry');
  };`;

App = App.replace(oldHandleSave, newHandleSave);

// 4. Update the "Add Order" (entry) tab to include the customReceiptNumber input
// Find the first TextInput in the entry tab (Customer Name field)
const searchEntryStr = `<View style={styles.entryRow}>\n            <Text style={[styles.entryLabel, { color: isLightMode ? '#475569' : '#cbd5e1' }]}>اسم الزبون</Text>`;
const replaceEntryStr = `
            {/* Custom Receipt Number Field (Optional) */}
            <View style={styles.entryRow}>
              <Text style={[styles.entryLabel, { color: isLightMode ? '#475569' : '#cbd5e1' }]}>رقم الوصل (اختياري، يملأ عبر الباركود)</Text>
              <TextInput 
                style={[styles.entryInput, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff' }]} 
                placeholder="أدخل رقم الوصل أو امسحه بالباركود" 
                placeholderTextColor="#64748b" 
                value={customReceiptNumber} 
                onChangeText={setCustomReceiptNumber} 
              />
            </View>

            ` + searchEntryStr.trim();

if (!App.includes("رقم الوصل (اختياري")) {
  App = App.replace(searchEntryStr, replaceEntryStr);
}

// 5. Update handleSubmit to include receiptNumber
const searchSubmitStr = `        status: 'pending',\n        is_settled: false\n      };`;
const replaceSubmitStr = `        status: 'pending',\n        is_settled: false\n      };\n\n      if (customReceiptNumber.trim() !== '') {\n        orderData.receiptNumber = customReceiptNumber.trim();\n      }`;
App = App.replace(searchSubmitStr, replaceSubmitStr);

// Also need to clear customReceiptNumber after successful submit
const searchSubmitSuccess = `setAlertModal({ visible: true, message: 'تم إرسال الطلب بنجاح!' });`;
const replaceSubmitSuccess = `setAlertModal({ visible: true, message: 'تم إرسال الطلب بنجاح!' });\n      setCustomReceiptNumber('');`;
App = App.replace(searchSubmitSuccess, replaceSubmitSuccess);

// 6. Update the Modal UI
const oldModalUI = `<Modal visible={addBarcodeModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>إضافة وصل باركود</Text>
            
            <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', textAlign: 'right', fontSize: 18 }]} placeholder="رقم الوصل (أو امسحه بالباركود)" placeholderTextColor="#64748b" value={newBarcodeReceipt} onChangeText={setNewBarcodeReceipt} autoFocus />

            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleSaveBarcodeReceipt}><Text style={styles.modalCloseText}>إضافة الوصل (قيد الانتظار)</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => setAddBarcodeModalVisible(false)}><Text style={styles.modalCloseText}>إلغاء</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>`;

const newModalUI = `<Modal visible={addBarcodeModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b', width: '90%', height: '80%' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>مسح وصل الباركود 📸</Text>
            
            <View style={{ flex: 1, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              {!cameraPermission ? (
                 <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                   <ActivityIndicator size="large" color="#a855f7" />
                 </View>
              ) : !cameraPermission.granted ? (
                 <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                   <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 15 }}>نحتاج إلى صلاحية الكاميرا لمسح الباركود</Text>
                   <TouchableOpacity style={{ backgroundColor: '#a855f7', padding: 10, borderRadius: 8 }} onPress={requestCameraPermission}>
                     <Text style={{ color: '#fff', fontWeight: 'bold' }}>منح الصلاحية</Text>
                   </TouchableOpacity>
                 </View>
              ) : (
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />
              )}
            </View>

            <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right', fontWeight: 'bold' }}>أو أدخل رقم الوصل يدوياً:</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', textAlign: 'right', fontSize: 18, marginBottom: 15 }]} 
              placeholder="رقم الوصل..." 
              placeholderTextColor="#64748b" 
              value={newBarcodeReceipt} 
              onChangeText={setNewBarcodeReceipt} 
            />

            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleSaveBarcodeReceipt}>
              <Text style={styles.modalCloseText}>متابعة وإضافة طلب ➡️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => { setAddBarcodeModalVisible(false); setScanned(false); }}>
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>`;

if (App.includes("<Modal visible={addBarcodeModalVisible}")) {
  // We need to replace the entire old modal. Let's use regex or split.
  const modalStart = App.indexOf("<Modal visible={addBarcodeModalVisible}");
  const modalEnd = App.indexOf("</Modal>", modalStart) + 8;
  const currentModalUI = App.slice(modalStart, modalEnd);
  App = App.replace(currentModalUI, newModalUI);
}


fs.writeFileSync('App.js', App);
console.log("Barcode scanner logic injected successfully!");
