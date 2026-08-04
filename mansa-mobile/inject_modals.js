const fs = require('fs');

const appFile = 'App.js';
let c = fs.readFileSync(appFile, 'utf8');

// 1. Inject state variables
const stateVars = `
  // New Product Form State
  const [newProductName, setNewProductName] = useState('');
  const [newProductReorderLimit, setNewProductReorderLimit] = useState('');
  const [newProductPage, setNewProductPage] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductSubCategory, setNewProductSubCategory] = useState('');
  const [newProductBarcode, setNewProductBarcode] = useState('');
  const [newProductModel, setNewProductModel] = useState('');
  const [newProductCpo, setNewProductCpo] = useState('');
  const [newProductCost, setNewProductCost] = useState('');
  const [newProductSelling, setNewProductSelling] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('');
  const [newProductStore, setNewProductStore] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [newProductNotes, setNewProductNotes] = useState('');
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newPageName, setNewPageName] = useState('');
`;

c = c.replace("// Form State", stateVars + "\n  // Form State");

// 2. Inject handler functions
const handlers = `
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'users', adminUid, 'categories'), { name: newCategoryName });
      setNewCategoryName('');
      setAddCategoryModalVisible(false);
      setAlertModal({ visible: true, message: 'تمت إضافة الفئة بنجاح' });
    } catch (err) { console.log(err); }
  };
  const handleAddPage = async () => {
    if (!newPageName.trim()) return;
    try {
      await addDoc(collection(db, 'users', adminUid, 'pages_stores'), { name: newPageName });
      setNewPageName('');
      setAddPageModalVisible(false);
      setAlertModal({ visible: true, message: 'تمت إضافة البيج بنجاح' });
    } catch (err) { console.log(err); }
  };
  const handleAddProduct = async () => {
    if (!newProductName.trim()) return;
    try {
      const payload = {
        name: newProductName,
        reorderLimit: newProductReorderLimit,
        pageStore: newProductPage,
        category: newProductCategory,
        subCategory: newProductSubCategory,
        barcode: newProductBarcode,
        model: newProductModel,
        cpo: newProductCpo,
        cost: Number(newProductCost) || 0,
        selling: Number(newProductSelling) || 0,
        price: Number(newProductSelling) || 0,
        unit: newProductUnit,
        storeId: newProductStore,
        stock: Number(newProductStock) || 0,
        notes: newProductNotes,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'users', adminUid, 'products'), payload);
      setAddProductModalVisible(false);
      setNewProductName(''); setNewProductReorderLimit(''); setNewProductPage(''); setNewProductCategory('');
      setNewProductSubCategory(''); setNewProductBarcode(''); setNewProductModel(''); setNewProductCpo('');
      setNewProductCost(''); setNewProductSelling(''); setNewProductUnit(''); setNewProductStore('');
      setNewProductStock(''); setNewProductNotes('');
      setAlertModal({ visible: true, message: 'تم حفظ الصنف بنجاح' });
    } catch (err) { console.log(err); }
  };
`;

c = c.replace("  const selectEmployee = async (emp) => {", handlers + "\n  const selectEmployee = async (emp) => {");

// 3. Inject Modals
const modals = `
      {/* Add Page Modal */}
      <Modal visible={addPageModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>إضافة بيج جديد</Text>
            <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff' }]} placeholder="اسم البيج" placeholderTextColor="#64748b" value={newPageName} onChangeText={setNewPageName} />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleAddPage}><Text style={styles.modalCloseText}>حفظ البيج</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => setAddPageModalVisible(false)}><Text style={styles.modalCloseText}>إلغاء</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={addCategoryModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>إضافة فئة جديدة</Text>
            <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff' }]} placeholder="اسم الفئة" placeholderTextColor="#64748b" value={newCategoryName} onChangeText={setNewCategoryName} />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleAddCategory}><Text style={styles.modalCloseText}>حفظ الفئة</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => setAddCategoryModalVisible(false)}><Text style={styles.modalCloseText}>إلغاء</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Product Modal */}
      <Modal visible={addProductModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b', width: '95%', height: '80%', padding: 0, overflow: 'hidden' }]}>
            <View style={{ backgroundColor: '#8b5cf6', padding: 15, flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => setAddProductModalVisible(false)}><Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>X</Text></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>إضافة الصنف</Text>
              <View style={{ width: 20 }} />
            </View>
            <ScrollView style={{ padding: 15 }}>
              <Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 16, marginBottom: 10, textAlign: 'right' }}>البيانات الأساسية</Text>
              
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', marginBottom: 10, textAlign: 'right' }]} placeholder="الإسم *" placeholderTextColor="#64748b" value={newProductName} onChangeText={setNewProductName} />
              
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', marginBottom: 10, textAlign: 'right' }]} placeholder="حد الطلب" placeholderTextColor="#64748b" keyboardType="numeric" value={newProductReorderLimit} onChangeText={setNewProductReorderLimit} />
              
              <Text style={{ textAlign: 'right', marginBottom: 5, color: isLightMode ? '#64748b' : '#94a3b8' }}>البيج</Text>
              <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
                <Picker selectedValue={newProductPage} onValueChange={setNewProductPage} style={{ color: isLightMode ? '#000' : '#fff' }}>
                  <Picker.Item label="-- إختر البيج --" value="" />
                  {pagesDb.map(p => <Picker.Item key={p.id} label={p.name} value={p.name} />)}
                </Picker>
              </View>

              <Text style={{ textAlign: 'right', marginBottom: 5, color: isLightMode ? '#64748b' : '#94a3b8' }}>فئة رئيسية</Text>
              <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
                <Picker selectedValue={newProductCategory} onValueChange={setNewProductCategory} style={{ color: isLightMode ? '#000' : '#fff' }}>
                  <Picker.Item label="-- إختر فئة رئيسية --" value="" />
                  {categoriesDb.map(c => <Picker.Item key={c.id} label={c.name} value={c.name} />)}
                </Picker>
              </View>

              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', marginBottom: 10, textAlign: 'right' }]} placeholder="باركود الأصناف" placeholderTextColor="#64748b" value={newProductBarcode} onChangeText={setNewProductBarcode} />
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', marginBottom: 10, textAlign: 'right' }]} placeholder="الموديل" placeholderTextColor="#64748b" value={newProductModel} onChangeText={setNewProductModel} />
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', marginBottom: 10, textAlign: 'right' }]} placeholder="كود التتبع الإعلاني (CPO)" placeholderTextColor="#64748b" value={newProductCpo} onChangeText={setNewProductCpo} />

              <View style={{ height: 1, backgroundColor: isLightMode ? '#e2e8f0' : '#334155', marginVertical: 15 }} />
              <Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 16, marginBottom: 10, textAlign: 'right' }}>الاسعار والوحدات</Text>
              
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', marginBottom: 10, textAlign: 'right' }]} placeholder="سعر الشراء" placeholderTextColor="#64748b" keyboardType="numeric" value={newProductCost} onChangeText={setNewProductCost} />
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', marginBottom: 10, textAlign: 'right' }]} placeholder="سعر البيع *" placeholderTextColor="#64748b" keyboardType="numeric" value={newProductSelling} onChangeText={setNewProductSelling} />
              
              <Text style={{ textAlign: 'right', marginBottom: 5, color: isLightMode ? '#64748b' : '#94a3b8' }}>الوحدة</Text>
              <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
                <Picker selectedValue={newProductUnit} onValueChange={setNewProductUnit} style={{ color: isLightMode ? '#000' : '#fff' }}>
                  <Picker.Item label="-- إختر وحدة --" value="" />
                  {unitsDb.map(u => <Picker.Item key={u.id} label={u.name} value={u.name} />)}
                  <Picker.Item label="قطعة" value="قطعة" />
                  <Picker.Item label="كرتون" value="كرتون" />
                </Picker>
              </View>

              <View style={{ height: 1, backgroundColor: isLightMode ? '#e2e8f0' : '#334155', marginVertical: 15 }} />
              <Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 16, marginBottom: 10, textAlign: 'right' }}>المخازن والكميات</Text>
              
              <Text style={{ textAlign: 'right', marginBottom: 5, color: isLightMode ? '#64748b' : '#94a3b8' }}>المخزن</Text>
              <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
                <Picker selectedValue={newProductStore} onValueChange={setNewProductStore} style={{ color: isLightMode ? '#000' : '#fff' }}>
                  <Picker.Item label="-- إختر المخزن --" value="" />
                  {storesDb.map(s => <Picker.Item key={s.id} label={s.name} value={s.id} />)}
                </Picker>
              </View>
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', marginBottom: 10, textAlign: 'right' }]} placeholder="الرصيد الافتتاحي" placeholderTextColor="#64748b" keyboardType="numeric" value={newProductStock} onChangeText={setNewProductStock} />

              <View style={{ height: 1, backgroundColor: isLightMode ? '#e2e8f0' : '#334155', marginVertical: 15 }} />
              <Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 16, marginBottom: 10, textAlign: 'right' }}>الملاحظات</Text>
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', marginBottom: 20, textAlign: 'right', height: 80 }]} placeholder="ملاحظات" placeholderTextColor="#64748b" multiline value={newProductNotes} onChangeText={setNewProductNotes} />
              
              <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#10b981', marginBottom: 30 }]} onPress={handleAddProduct}>
                <Text style={styles.modalCloseText}>حفظ الصنف</Text>
              </TouchableOpacity>
              
            </ScrollView>
          </View>
        </View>
      </Modal>
`;

c = c.replace("{/* --- Modals Section --- */}", "{/* --- Modals Section --- */}\n" + modals);

fs.writeFileSync(appFile, c);
console.log('Modals and Handlers injected.');
