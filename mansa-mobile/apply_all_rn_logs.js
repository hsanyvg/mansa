const fs = require('fs');
let code = fs.readFileSync('App.js', 'utf8');

// 1. Inject Diff Logic and Subcollection Save
const targetLogic = `      const updates = {
        customerName,
        customerPhone,
        customerPhone2,
        governorate,
        region,
        notes,
        paymentMethod,
        fbLoginId,
        totalAmount,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          isComposite: item.product.isComposite || false,
          composition: item.product.composition || null
        }))
      };`;

const newLogic = `      // --- Audit Log Diff Logic ---
      let logMessages = [];
      if (originalOrderDetails) {
        if (originalOrderDetails.customerName !== customerName) {
           logMessages.push(\`اسم الزبون من "\${originalOrderDetails.customerName || 'فارغ'}" إلى "\${customerName || 'فارغ'}"\`);
        }
        if (originalOrderDetails.customerPhone !== customerPhone) {
           logMessages.push(\`هاتف المستلم من "\${originalOrderDetails.customerPhone || 'فارغ'}" إلى "\${customerPhone || 'فارغ'}"\`);
        }
        if (originalOrderDetails.customerPhone2 !== customerPhone2) {
           logMessages.push(\`الهاتف البديل من "\${originalOrderDetails.customerPhone2 || 'فارغ'}" إلى "\${customerPhone2 || 'فارغ'}"\`);
        }
        if (originalOrderDetails.governorate !== governorate) {
           logMessages.push(\`المحافظة من "\${originalOrderDetails.governorate || 'فارغ'}" إلى "\${governorate || 'فارغ'}"\`);
        }
        if (originalOrderDetails.region !== region) {
           logMessages.push(\`المنطقة من "\${originalOrderDetails.region || 'فارغ'}" إلى "\${region || 'فارغ'}"\`);
        }
        if (originalOrderDetails.totalAmount !== totalAmount) {
           logMessages.push(\`المبلغ الكلي من "\${(originalOrderDetails.totalAmount || 0).toLocaleString('en-US')}" إلى "\${(totalAmount || 0).toLocaleString('en-US')}"\`);
        }
        if (originalOrderDetails.notes !== notes) {
           logMessages.push(\`الملاحظات تم تعديلها\`);
        }
        
        // Items Diff
        const oldItemsStr = (originalOrderDetails.items || []).map(i => \`\${i.productName} (x\${i.quantity})\`).join('، ');
        const newItemsStr = cart.map(i => \`\${i.product.name} (x\${i.quantity})\`).join('، ');
        if (oldItemsStr !== newItemsStr) {
           logMessages.push(\`المنتجات من [\${oldItemsStr || 'لا يوجد'}] إلى [\${newItemsStr || 'لا يوجد'}]\`);
        }
      }

      const updates = {
        customerName,
        customerPhone,
        customerPhone2,
        governorate,
        region,
        notes,
        paymentMethod,
        fbLoginId,
        totalAmount,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          isComposite: item.product.isComposite || false,
          composition: item.product.composition || null
        }))
      };

      if (logMessages.length > 0) {
        const newLogRef = doc(collection(db, 'users', adminUid, 'orders', editingOrderId, 'logs'));
        batch.set(newLogRef, {
           action: 'تعديل',
           details: 'تم التعديل: ' + logMessages.join(' | '),
           timestamp: serverTimestamp(),
           employeeName: loggedInSystemUserName || 'المدير'
        });
      }`;

if (code.includes(targetLogic)) {
    code = code.replace(targetLogic, newLogic);
    console.log("Injected Auditing Logic.");
}

// 2. Add originalOrderDetails State
const targetOriginalState = `  const [editingOrderId, setEditingOrderId] = useState(null);`;
const newOriginalState = `  const [editingOrderId, setEditingOrderId] = useState(null);
  const [originalOrderDetails, setOriginalOrderDetails] = useState(null);`;
if (code.includes(targetOriginalState)) {
    code = code.replace(targetOriginalState, newOriginalState);
    console.log("Injected originalOrderDetails State.");
}

// 3. Set originalOrderDetails in handleEditOrder
const targetSetOriginal = `    setEditingOrderId(order.id);`;
const newSetOriginal = `    setEditingOrderId(order.id);
    setOriginalOrderDetails(order);`;
if (code.includes(targetSetOriginal)) {
    code = code.replace(targetSetOriginal, newSetOriginal);
    console.log("Injected setOriginalOrderDetails.");
}

// 4. Add orderLogs State and UseEffect
const targetSearchState = `  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);`;
const newSearchState = `  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [orderLogs, setOrderLogs] = useState([]);`;
if (code.includes(targetSearchState)) {
    code = code.replace(targetSearchState, newSearchState);
    console.log("Injected orderLogs state.");
}

const targetEffect = `  useEffect(() => {
    // Only search after 1s debounce`;
const newEffect = `  useEffect(() => {
    if (selectedOrderForDetails) {
       const logsRef = collection(db, 'users', adminUid || 'anonymous', 'orders', selectedOrderForDetails.id, 'logs');
       const q = query(logsRef, orderBy('timestamp', 'desc'));
       const unsub = onSnapshot(q, (snapshot) => {
          const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setOrderLogs(fetchedLogs);
       });
       return () => unsub();
    } else {
       setOrderLogs([]);
    }
  }, [selectedOrderForDetails, adminUid]);

  useEffect(() => {
    // Only search after 1s debounce`;
if (code.includes(targetEffect)) {
    code = code.replace(targetEffect, newEffect);
    console.log("Injected orderLogs fetch effect.");
}

// 5. Update UI for Logs
const targetUI = `                <View style={{ borderWidth: 1, borderColor: '#332b47', borderRadius: 12, padding: 15, marginBottom: 20, backgroundColor: '#181726' }}>
                  {/* Fake log entry since full logs aren't saved in DB yet */}
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                    <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#a855f7', marginTop: 5 }} />
                      <View style={{ width: 2, height: 50, backgroundColor: '#332b47' }} />
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>إنشاء الطلب</Text>
                      <Text style={{ color: '#64748b', fontSize: 13 }}>تم تسجيل الطلب في النظام</Text>
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 5 }}>
                        <Text style={{ color: '#10b981', fontSize: 11 }}>👤 {selectedOrderForDetails.bookingEmployeeName || 'المدير'}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                        {selectedOrderForDetails.date && typeof selectedOrderForDetails.date.toDate === 'function' ? selectedOrderForDetails.date.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Text>
                      <Text style={{ color: '#64748b', fontSize: 10 }}>
                        {selectedOrderForDetails.date && typeof selectedOrderForDetails.date.toDate === 'function' ? selectedOrderForDetails.date.toDate().toLocaleDateString('en-GB') : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                    <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginTop: 5 }} />
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>الحالة الحالية</Text>
                      <Text style={{ color: '#64748b', fontSize: 13 }}>تم تحديث حالة الطلب إلى {translateStatus(selectedOrderForDetails.status)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>الآن</Text>
                    </View>
                  </View>
                </View>`;

const newUI = `                <View style={{ borderWidth: 1, borderColor: '#332b47', borderRadius: 12, padding: 15, marginBottom: 20, backgroundColor: '#181726' }}>
                  {/* Dynamic Logs Render */}
                  {orderLogs.length > 0 ? orderLogs.map((log, index, arr) => {
                    const dateObj = log.timestamp && typeof log.timestamp.toDate === 'function' ? log.timestamp.toDate() : new Date();
                    return (
                    <View key={index} style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: index === arr.length - 1 ? 0 : 15 }}>
                      <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: index === 0 ? '#10b981' : '#a855f7', marginTop: 5 }} />
                        {index !== arr.length - 1 && <View style={{ width: 2, height: 50, backgroundColor: '#332b47' }} />}
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>{log.action}</Text>
                        <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'right' }}>{log.details}</Text>
                        <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 5 }}>
                          <Text style={{ color: '#10b981', fontSize: 11 }}>👤 {log.employeeName || 'النظام'}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                          {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 10 }}>
                          {dateObj.toLocaleDateString('en-GB')}
                        </Text>
                      </View>
                    </View>
                  )}) : (
                    <Text style={{color: '#64748b', textAlign: 'center', padding: 10}}>لا توجد حركات مسجلة لهذا الطلب حتى الآن.</Text>
                  )}
                </View>`;

if (code.includes(targetUI)) {
    code = code.replace(targetUI, newUI);
    console.log("Injected Logs UI.");
}

fs.writeFileSync('App.js', code);
console.log("All done with React Native App.js!");
