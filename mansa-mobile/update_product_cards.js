const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

const target = `<View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10 }}>
                      <Text style={{ color: '#8b5cf6' }}>سعر البيع: {typeof (p.selling || p.price || 0) === 'object' ? JSON.stringify(p.selling || p.price || 0) : String(p.selling || p.price || 0)} د.ع</Text>
                      <Text style={{ color: '#64748b' }}>الكمية: {typeof (p.stock || p.quantity || 0) === 'object' ? JSON.stringify(p.stock || p.quantity || 0) : String(p.stock || p.quantity || 0)}</Text>
                    </View>`;

const replacement = `<View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 12 }}>
                      {/* Cost Card */}
                      <View style={{ flex: 1, backgroundColor: isLightMode ? '#fef2f2' : '#7f1d1d', padding: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: isLightMode ? '#ef4444' : '#fca5a5', marginBottom: 4, fontWeight: 'bold' }}>التكلفة</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isLightMode ? '#b91c1c' : '#fee2e2' }}>
                          {typeof p.cost === 'object' ? 0 : (p.cost || p.purchase || 0)}
                        </Text>
                      </View>

                      {/* Selling Card */}
                      <View style={{ flex: 1, backgroundColor: isLightMode ? '#f0fdf4' : '#14532d', padding: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: isLightMode ? '#22c55e' : '#86efac', marginBottom: 4, fontWeight: 'bold' }}>سعر البيع</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isLightMode ? '#15803d' : '#dcfce7' }}>
                          {typeof (p.selling || p.price) === 'object' ? 0 : (p.selling || p.price || 0)}
                        </Text>
                      </View>

                      {/* Quantity Card */}
                      <View style={{ flex: 1, backgroundColor: isLightMode ? '#eff6ff' : '#1e3a8a', padding: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: isLightMode ? '#3b82f6' : '#93c5fd', marginBottom: 4, fontWeight: 'bold' }}>العدد</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isLightMode ? '#1d4ed8' : '#dbeafe' }}>
                          {(() => {
                            if (typeof p.totalBaseQuantity === 'number') return p.totalBaseQuantity;
                            let stk = p.stock || p.quantity;
                            if (typeof stk === 'number' || typeof stk === 'string') return stk;
                            if (typeof stk === 'object' && stk !== null) {
                              let t = 0;
                              Object.keys(stk).forEach(k => { t += Number(stk[k]?.quantity) || 0; });
                              return t;
                            }
                            return 0;
                          })()}
                        </Text>
                      </View>
                    </View>`;

if(c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync('App.js', c);
  console.log('Cards added successfully!');
} else {
  console.log('Target not found!');
}
