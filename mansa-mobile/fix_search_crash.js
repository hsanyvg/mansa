const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add Keyboard to imports
if (!content.includes('Keyboard,')) {
    content = content.replace(
      /import \{\s*StyleSheet,\s*Switch,\s*Text,\s*View,\s*TextInput,\s*TouchableOpacity,\s*ScrollView,\s*Modal,\s*FlatList,\s*ActivityIndicator,\s*SafeAreaView,\s*Platform,\s*StatusBar,\s*Animated,\s*Easing,\s*AppState\s*\} from 'react-native';/,
      "import {\n  StyleSheet, Switch, \n  Text, \n  View, \n  TextInput, \n  TouchableOpacity, \n  ScrollView, \n  Modal, \n  FlatList, \n  ActivityIndicator, \n  SafeAreaView, \n  Platform,\n  StatusBar,\n  Animated,\n  Easing,\n  AppState,\n  Keyboard\n} from 'react-native';"
    );
}

// 2. Fix the order details styling in the Search tab FlatList
// We will replace `styles.orderPhone` with explicit inline styles that are readable in both light and dark modes
// And we will fix `styles.orderCustName` to have proper color too.

const oldRenderItem = `                  renderItem={({item: ord}) => (
                    <View key={ord.id} style={styles.orderItem}>
                      <View style={styles.orderLeft}>
                        <Text style={styles.orderCustName}>{ord.customerName}</Text>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
                          <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>
                          <Text style={[styles.orderPhone, { marginRight: 4 }]}>{ord.customerPhone} {ord.customerPhone2 ? \` - \${ord.customerPhone2}\` : ''}</Text>
                        </View>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
                          <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><Circle cx="12" cy="10" r="3" /></Svg>
                          <Text style={[styles.orderPhone, { marginRight: 4 }]}>{ord.governorate} {ord.address ? \`- \${ord.address}\` : ''}</Text>
                        </View>
                        <Text style={[styles.orderPhone, { marginTop: 4 }]}>المنتجات: {Array.isArray(ord.products) ? ord.products.map(p => p.name).join('، ') : 'بدون منتجات'}</Text>
                        {ord.notes && ord.notes.trim() !== '' && (
                          <Text style={[styles.orderPhone, { marginTop: 4, color: '#f59e0b', fontStyle: 'italic' }]}>ملاحظة: {ord.notes}</Text>
                        )}
                        <Text style={[styles.orderPhone, { marginTop: 4, fontSize: 10, color: isLightMode ? '#94a3b8' : '#475569' }]}>{ord.createdAt}</Text>
                      </View>`;

const newRenderItem = `                  renderItem={({item: ord}) => (
                    <View key={ord.id} style={styles.orderItem}>
                      <View style={styles.orderLeft}>
                        <Text style={[styles.orderCustName, { color: isLightMode ? '#1e293b' : '#f8fafc', fontSize: 15 }]}>{ord.customerName}</Text>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
                          <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#cbd5e1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>
                          <Text style={{ marginRight: 6, color: isLightMode ? '#475569' : '#cbd5e1', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{ord.customerPhone} {ord.customerPhone2 ? \` - \${ord.customerPhone2}\` : ''}</Text>
                        </View>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
                          <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#64748b' : '#cbd5e1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><Circle cx="12" cy="10" r="3" /></Svg>
                          <Text style={{ marginRight: 6, color: isLightMode ? '#475569' : '#cbd5e1', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{ord.governorate} {ord.address ? \`- \${ord.address}\` : ''}</Text>
                        </View>
                        <Text style={{ marginTop: 4, color: isLightMode ? '#475569' : '#cbd5e1', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>المنتجات: {Array.isArray(ord.products) ? ord.products.map(p => p.name).join('، ') : 'بدون منتجات'}</Text>
                        {ord.notes && ord.notes.trim() !== '' && (
                          <Text style={{ marginTop: 4, color: '#f59e0b', fontStyle: 'italic', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>ملاحظة: {ord.notes}</Text>
                        )}
                        <Text style={{ marginTop: 6, fontSize: 11, color: isLightMode ? '#94a3b8' : '#64748b', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{ord.createdAt}</Text>
                      </View>`;

if (content.includes(oldRenderItem)) {
    content = content.replace(oldRenderItem, newRenderItem);
    fs.writeFileSync('App.js', content);
    console.log("Fixed keyboard import and search text styling!");
} else {
    console.log("Could not find the target string. Let me double check if Keyboard is imported.");
}
