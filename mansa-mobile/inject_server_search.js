const fs = require('fs');
let content = fs.readFileSync('App_flatlist_final.js', 'utf8');

// Inject state
content = content.replace(
  /const \[ordersSearchQuery, setOrdersSearchQuery\] = useState\(''\);/,
  `const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  
  // Server Search State
  const [serverSearchQuery, setServerSearchQuery] = useState('');
  const [serverSearchResult, setServerSearchResult] = useState(null);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  
  const handleServerSearch = async () => {
    if (!serverSearchQuery.trim()) {
      setServerSearchResult(null);
      return;
    }
    setIsSearchingServer(true);
    setServerSearchResult(null);
    try {
       let q = fsQuery(collection(db, 'users', adminUid, 'orders'), where('receiptNumber', '==', serverSearchQuery.trim()));
       let snap = await getDocs(q);
       
       if (snap.empty) {
          // Try customerPhone
          q = fsQuery(collection(db, 'users', adminUid, 'orders'), where('customerPhone', '==', serverSearchQuery.trim()));
          snap = await getDocs(q);
       }
       if (snap.empty) {
          // Try id
          const docRef = doc(db, 'users', adminUid, 'orders', serverSearchQuery.trim());
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
             setServerSearchResult([{ id: docSnap.id, ...docSnap.data() }]);
             setIsSearchingServer(false);
             return;
          }
       }
       
       if (!snap.empty) {
         setServerSearchResult(snap.docs.map(d => ({ id: d.id, ...d.data() })));
       } else {
         setServerSearchResult([]); // not found
       }
    } catch (e) {
       console.log("Server search error:", e);
    }
    setIsSearchingServer(false);
  };`
);

// Update UI
// Find the search bar in the orders tab
const oldSearchBar = `<View style={styles.searchBarContainer}>
              <View style={styles.searchIconContainer}>
                 <Text style={{ fontSize: 16 }}>🔍</Text>
              </View>
              <TextInput
                  style={styles.searchInput}
                  placeholder="ابحث برقم الوصل، الهاتف، أو اسم الزبون..."
                  placeholderTextColor={isLightMode ? "#94a3b8" : "#64748b"}
                  value={ordersSearchQuery}
                  onChangeText={setOrdersSearchQuery}
              />
            </View>`;

const newSearchBar = `<View style={{ flexDirection: 'row-reverse', marginBottom: 15 }}>
              <View style={[styles.searchBarContainer, { flex: 1, marginBottom: 0 }]}>
                <View style={styles.searchIconContainer}>
                   <Text style={{ fontSize: 16 }}>🔍</Text>
                </View>
                <TextInput
                    style={styles.searchInput}
                    placeholder="ابحث في السيرفر (رقم الوصل أو الهاتف)..."
                    placeholderTextColor={isLightMode ? "#94a3b8" : "#64748b"}
                    value={serverSearchQuery}
                    onChangeText={(t) => { setServerSearchQuery(t); if(!t) setServerSearchResult(null); }}
                    onSubmitEditing={handleServerSearch}
                />
              </View>
              <TouchableOpacity 
                style={{ backgroundColor: '#a855f7', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12, marginRight: 10 }}
                onPress={handleServerSearch}
              >
                {isSearchingServer ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>بحث</Text>}
              </TouchableOpacity>
            </View>`;

content = content.replace(oldSearchBar, newSearchBar);

// Update rendering to use serverSearchResult if it exists
// Right after:
// const query = ordersSearchQuery.toLowerCase().trim();
// Wait! `ordersSearchQuery` is now replaced in the UI, but it's still in the map!
// If `serverSearchResult` exists, we should render IT instead of the FlatList!

content = content.replace(
  /\{filteredList\.length === 0/g,
  `{serverSearchResult !== null ? (
                    serverSearchResult.length === 0 ? (
                       <Text style={styles.emptyText}>الطلب غير موجود في السيرفر.</Text>
                    ) : (
                       <FlatList 
                        data={serverSearchResult} 
                        keyExtractor={ord => ord.id}
                        initialNumToRender={10}
                        contentContainerStyle={{ paddingBottom: 50 }}
                        renderItem={({item: ord}) => (
                           <View key={ord.id} style={styles.orderItem}>
                          <View style={styles.orderLeft}>
                            <Text style={styles.orderCustName}>{ord.customerName}</Text>
                            <Text style={styles.orderMetaText}>{ord.customerPhone} | {ord.governorate}</Text>
                          </View>
                          <View style={styles.orderRight}>
                            <Text style={styles.orderAmountText}>{Number(ord.totalAmount || 0).toLocaleString()} د.ع</Text>
                            <View style={[
                              styles.statusBadge,
                              ord.status === 'delivered' ? styles.badgeDelivered :
                              ord.status === 'partial' ? styles.badgePartial :
                              ord.status === 'returned' ? styles.badgeReturned :
                              ord.status === 'cancelled' ? styles.badgeCancelled :
                              ord.status === 'backordered' ? styles.badgeBackordered : styles.badgePending
                            ]}>
                              <Text style={styles.statusBadgeText}>
                                {ord.status === 'delivered' ? 'واصل' :
                                 ord.status === 'partial' ? 'واصل جزئي' :
                                 ord.status === 'returned' ? 'راجع' :
                                 ord.status === 'returned_warehouse' ? 'راجع مستلم بالمخزن' :
                                 ord.status === 'cancelled' ? 'ملغي' :
                                 ord.status === 'backordered' ? 'بانتظار المخزون' : 'قيد الانتظار'}
                              </Text>
                            </View>
                            
                            {(ord.status !== 'delivered' && ord.status !== 'cancelled' && ord.status !== 'returned_warehouse' && ord.status !== 'returned' && ord.status !== 'returned_agent') && (
                              <TouchableOpacity 
                                style={{ padding: 6, backgroundColor: 'rgba(168, 85, 247, 0.15)', borderRadius: 6, marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.4)' }}
                                onPress={() => handleEditOrder(ord)}
                              >
                                <Text style={{ color: '#e9d5ff', fontWeight: 'bold', fontSize: 12 }}>✏️ تعديل الطلب</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        )}
                      />
                    )
                  ) : {filteredList.length === 0`
);


fs.writeFileSync('App_final.js', content);
console.log("Injected server search into App_final.js");
