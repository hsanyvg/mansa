const fs = require('fs');
let content = fs.readFileSync('App_final.js', 'utf8');

const neonSearchOld = `              <View style={styles.neonSearchInner}>
                <View style={styles.neonSearchBtn}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#e9d5ff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx="11" cy="11" r="8" />
                    <Path d="m21 21-4.3-4.3" />
                  </Svg>
                </View>
                <TextInput
                  style={styles.neonSearchInput}
                  value={ordersSearchQuery}
                  onChangeText={setOrdersSearchQuery}
                  placeholder="ابحث بالاسم، الهاتف، المحافظة أو رقم الطلب..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>`;

const neonSearchNew = `              <View style={styles.neonSearchInner}>
                <TouchableOpacity style={styles.neonSearchBtn} onPress={handleServerSearch}>
                  {isSearchingServer ? (
                     <ActivityIndicator size="small" color="#a855f7" />
                  ) : (
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#e9d5ff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <Circle cx="11" cy="11" r="8" />
                      <Path d="m21 21-4.3-4.3" />
                    </Svg>
                  )}
                </TouchableOpacity>
                <TextInput
                  style={styles.neonSearchInput}
                  value={serverSearchQuery}
                  onChangeText={(t) => { setServerSearchQuery(t); if(!t) setServerSearchResult(null); }}
                  onSubmitEditing={handleServerSearch}
                  placeholder="بحث سريع في السيرفر (برقم الهاتف أو الوصل)..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  returnKeyType="search"
                />
              </View>`;

content = content.replace(neonSearchOld, neonSearchNew);

fs.writeFileSync('App_final2.js', content);
console.log("Injected neon server search");
