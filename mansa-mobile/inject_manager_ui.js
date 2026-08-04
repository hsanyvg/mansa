const fs = require('fs');

const appFile = 'App.js';
let c = fs.readFileSync(appFile, 'utf8');

// 1. Change the bottom navigation for "المنتجات" to point to 'products_manager' instead of 'settings'
const bottomNavSearch = "setActiveTab('settings')";
// We only want to replace the one in the bottom navigation.
// Let's find it.
const bottomNavIdx = c.indexOf("{/* Left: المنتجات (settings) */}");
if (bottomNavIdx !== -1) {
  const nextSectionIdx = c.indexOf("{/* --- Modals Section --- */}", bottomNavIdx);
  if (nextSectionIdx !== -1) {
    let bottomNavStr = c.substring(bottomNavIdx, nextSectionIdx);
    bottomNavStr = bottomNavStr.replace(/activeTab === 'settings'/g, "activeTab === 'products_manager'");
    bottomNavStr = bottomNavStr.replace(/setActiveTab\('settings'\)/g, "setActiveTab('products_manager')");
    c = c.substring(0, bottomNavIdx) + bottomNavStr + c.substring(nextSectionIdx);
  }
}

// 2. Add the `products_manager` block right before the `settings` block
const settingsBlockStart = ") : activeTab === 'settings' ? (";
const productsManagerBlock = `) : activeTab === 'products_manager' ? (
        <View style={[styles.tabContent, { backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12' }]}>
          {/* Segmented Control */}
          <View style={{ flexDirection: 'row-reverse', padding: 15, backgroundColor: isLightMode ? '#fff' : '#1e293b', borderBottomWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: productsTab === 'products' ? '#a855f7' : 'transparent' }}
              onPress={() => setProductsTab('products')}
            >
              <Text style={{ fontWeight: 'bold', color: productsTab === 'products' ? '#a855f7' : (isLightMode ? '#64748b' : '#94a3b8') }}>الأصناف</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: productsTab === 'categories' ? '#a855f7' : 'transparent' }}
              onPress={() => setProductsTab('categories')}
            >
              <Text style={{ fontWeight: 'bold', color: productsTab === 'categories' ? '#a855f7' : (isLightMode ? '#64748b' : '#94a3b8') }}>الفئات</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: productsTab === 'pages' ? '#a855f7' : 'transparent' }}
              onPress={() => setProductsTab('pages')}
            >
              <Text style={{ fontWeight: 'bold', color: productsTab === 'pages' ? '#a855f7' : (isLightMode ? '#64748b' : '#94a3b8') }}>البيجات</Text>
            </TouchableOpacity>
          </View>

          {/* Content Lists */}
          <ScrollView contentContainerStyle={{ padding: 15 }}>
            {productsTab === 'products' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>قائمة الأصناف ({baseProducts.length})</Text>
                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }} onPress={() => setAddProductModalVisible(true)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ إضافة صنف</Text>
                  </TouchableOpacity>
                </View>
                {baseProducts.map(p => (
                  <View key={p.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{p.name}</Text>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10 }}>
                      <Text style={{ color: '#8b5cf6' }}>سعر البيع: {p.selling || p.price || 0} د.ع</Text>
                      <Text style={{ color: '#64748b' }}>الكمية: {p.stock || p.quantity || 0}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {productsTab === 'categories' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>الفئات ({categoriesDb.length})</Text>
                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }} onPress={() => setAddCategoryModalVisible(true)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ إضافة فئة</Text>
                  </TouchableOpacity>
                </View>
                {categoriesDb.map(c => (
                  <View key={c.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{c.name}</Text>
                  </View>
                ))}
              </>
            )}

            {productsTab === 'pages' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>البيجات ({pagesDb.length})</Text>
                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }} onPress={() => setAddPageModalVisible(true)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ إضافة بيج</Text>
                  </TouchableOpacity>
                </View>
                {pagesDb.map(pg => (
                  <View key={pg.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{pg.name}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
`;

c = c.replace(settingsBlockStart, productsManagerBlock + settingsBlockStart);

fs.writeFileSync(appFile, c);
console.log('App.js updated with Products Manager UI!');
