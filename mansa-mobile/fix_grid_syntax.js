const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const brokenPart = `              return (
                        <View style={[
                          styles.statusBadge, 
                          ord.status === 'delivered' ? styles.badgeDelivered : 
                          ord.status === 'returned' || ord.status === 'returned_warehouse' ? styles.badgeReturned : 
                          ord.status === 'partial' ? styles.badgePartial :
                          ord.status === 'cancelled' ? styles.badgeCancelled :
                          ord.status === 'backordered' ? styles.badgeBackordered : styles.badgePending,
                          { borderWidth: 1, borderColor: 
                            ord.status === 'delivered' ? 'rgba(16, 185, 129, 0.3)' : 
                            ord.status === 'returned' || ord.status === 'returned_warehouse' ? 'rgba(244, 63, 94, 0.3)' : 
                            ord.status === 'partial' ? 'rgba(14, 165, 233, 0.3)' :
                            ord.status === 'cancelled' ? 'rgba(244, 63, 94, 0.3)' :
                            ord.status === 'backordered' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(251, 191, 36, 0.3)'
                          }
                        ]}>
                          <Text style={[styles.statusBadgeText, {
                            color: ord.status === 'delivered' ? (isLightMode ? '#059669' : '#34d399') :
                                   ord.status === 'partial' ? (isLightMode ? '#0284c7' : '#38bdf8') :
                                   ord.status === 'returned' || ord.status === 'returned_warehouse' || ord.status === 'cancelled' ? (isLightMode ? '#e11d48' : '#fb7185') :
                                   ord.status === 'backordered' ? (isLightMode ? '#7c3aed' : '#a78bfa') :
                                   (isLightMode ? '#d97706' : '#fbbf24')
                          }]}>
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
              );
            })()}
          </View>
          </SafeAreaView>
          </Modal>`;

const fixPart = `              return (
                <ScrollView contentContainerStyle={{ paddingBottom: 50, flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {Object.keys(statusCounts).map(st => {
                     const info = statusLabels[st] || statusLabels['unknown'];
                     return (
                        <View key={st} style={{ width: '48%', backgroundColor: info.bg, borderWidth: 1, borderColor: info.border, borderRadius: 12, padding: 15, marginBottom: 15, alignItems: 'center', justifyContent: 'center' }}>
                           <Text style={{ fontSize: 28, fontWeight: 'bold', color: info.text, marginBottom: 5 }}>{statusCounts[st]}</Text>
                           <Text style={{ fontSize: 14, fontWeight: 'bold', color: info.text, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{info.label}</Text>
                        </View>
                     );
                  })}
                  
                  {/* Total Card */}
                  <View style={{ width: '100%', backgroundColor: isLightMode ? '#f1f5f9' : '#1e293b', borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', borderRadius: 12, padding: 20, marginBottom: 15, alignItems: 'center', justifyContent: 'center' }}>
                     <Text style={{ fontSize: 32, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#f8fafc', marginBottom: 5 }}>{filteredList.length}</Text>
                     <Text style={{ fontSize: 16, fontWeight: 'bold', color: isLightMode ? '#475569' : '#cbd5e1', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>المجموع الكلي للطلبات</Text>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
          </SafeAreaView>
          </Modal>`;

if (content.includes(brokenPart)) {
    content = content.replace(brokenPart, fixPart);
    fs.writeFileSync('App.js', content);
    console.log("Syntax fixed and Grid applied!");
} else {
    console.log("Could not find the broken part exactly.");
}
