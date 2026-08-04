const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

// 1. Add newCategoryPage state
if (!c.includes("const [newCategoryPage")) {
  c = c.replace(
    "const [newCategoryName, setNewCategoryName] = useState('');",
    "const [newCategoryName, setNewCategoryName] = useState('');\n  const [newCategoryPage, setNewCategoryPage] = useState('');"
  );
}

// 2. Update handleAddCategory
const oldHandleAddCat = `  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'users', adminUid, 'categories'), { name: newCategoryName });
      setNewCategoryName('');
      setAddCategoryModalVisible(false);
      setAlertModal({ visible: true, message: 'تم إضافة الفئة بنجاح' });
    } catch (err) { console.log(err); }
  };`;

const newHandleAddCat = `  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    if (!newCategoryPage) {
      setAlertModal({ visible: true, message: 'يرجى اختيار البيج التابعة لها الفئة' });
      return;
    }
    try {
      await addDoc(collection(db, 'users', adminUid, 'categories'), { name: newCategoryName, pageId: newCategoryPage, subcategories: [] });
      setNewCategoryName('');
      setNewCategoryPage('');
      setAddCategoryModalVisible(false);
      setAlertModal({ visible: true, message: 'تم إضافة الفئة بنجاح' });
    } catch (err) { console.log(err); }
  };`;

// Note: text encoding/crlf might fail simple string replacement, so we use regex or partial match if needed.
// To be safe, we can use a more forgiving regex for handleAddCategory
c = c.replace(/const handleAddCategory = async \(\) => \{[\s\S]*?catch \(err\) \{ console\.log\(err\); \}\r?\n  \};/, newHandleAddCat);

// 3. Update Categories map render
const oldCatRender = `                {categoriesDb.map(c => (
                  <View key={c.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{typeof c.name === 'string' ? c.name : (c.name ? JSON.stringify(c.name) : 'بدون اسم')}</Text>
                  </View>
                ))}`;

const newCatRender = `                {categoriesDb.map(c => {
                  const page = pagesDb.find(p => p.id === c.pageId);
                  const pageName = page ? (typeof page.name === 'string' ? page.name : 'بدون اسم') : 'بدون بيج';
                  return (
                    <View key={c.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{typeof c.name === 'string' ? c.name : (c.name ? JSON.stringify(c.name) : 'بدون اسم')}</Text>
                      <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ fontSize: 12, color: isLightMode ? '#64748b' : '#cbd5e1' }}>{pageName}</Text>
                      </View>
                    </View>
                  );
                })}`;

// Regex for replacing the map block safely
c = c.replace(/\{categoriesDb\.map\(c => \([\s\S]*?<\/[Vv]iew>\r?\n\s*\)\)\}/, newCatRender);

// 4. Update the Modal content
const oldModalInput = `<TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff' }]} placeholder="اسم الفئة" placeholderTextColor="#64748b" value={newCategoryName} onChangeText={setNewCategoryName} />`;

const newModalInput = `<View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
              <Picker selectedValue={newCategoryPage} onValueChange={setNewCategoryPage} style={{ color: isLightMode ? '#000' : '#fff' }}>
                <Picker.Item label="-- اختر البيج --" value="" />
                {pagesDb.map(p => <Picker.Item key={p.id} label={typeof p.name === 'string' ? p.name : 'بدون اسم'} value={p.id} />)}
              </Picker>
            </View>
            <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', textAlign: 'right' }]} placeholder="اسم الفئة" placeholderTextColor="#64748b" value={newCategoryName} onChangeText={setNewCategoryName} />`;

c = c.replace(oldModalInput, newModalInput);

fs.writeFileSync('App.js', c);
console.log('Category feature updated!');
