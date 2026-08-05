const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const oldRenderRight = `                      <View style={styles.orderRight}>
                        <View style={[
                          styles.statusBadge, 
                          ord.status === 'delivered' ? styles.badgeDelivered : 
                          ord.status === 'returned' || ord.status === 'returned_warehouse' ? styles.badgeReturned : 
                          ord.status === 'partial' ? styles.badgePartial :
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
                        </View>`;

const newRenderRight = `                      <View style={styles.orderRight}>
                        <Text style={{ fontSize: 12, color: isLightMode ? '#64748b' : '#94a3b8', marginBottom: 6, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', fontWeight: 'bold' }}>#{ord.receiptNumber || (ord.id ? ord.id.substring(0,6) : '')}</Text>
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
                        </View>`;

if (content.includes(oldRenderRight)) {
    content = content.replace(oldRenderRight, newRenderRight);
    fs.writeFileSync('App.js', content);
    console.log("Fixed receipt number and status badge colors!");
} else {
    console.log("Could not find the target string.");
}
