const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add advSearchName back to hasSearchCriteria
content = content.replace(
  /const hasSearchCriteria = !!\(advSearchGov \|\| advSearchMonth \|\| advSearchYear \|\| advSearchDateFrom \|\| advSearchDateTo \|\| advSearchReceipt \|\| advSearchPhone \|\| advSearchStatus\);/g,
  "const hasSearchCriteria = !!(advSearchGov || advSearchMonth || advSearchYear || advSearchDateFrom || advSearchDateTo || advSearchReceipt || advSearchPhone || advSearchStatus || advSearchName);"
);

// 2. Add advSearchName logic inside filter
const nameFilterLogic = `
      if (advSearchName && advSearchName.trim()) {
        if (!String(ord.customerName || '').toLowerCase().includes(advSearchName.toLowerCase().trim())) match = false;
      }
`;
if (!content.includes('advSearchName && advSearchName.trim()')) {
  content = content.replace(
    /if \(advSearchPhone && advSearchPhone\.trim\(\)\) \{/g,
    nameFilterLogic + "      if (advSearchPhone && advSearchPhone.trim()) {"
  );
}

// 3. Add Server Fallback inside executeAdvancedSearch
const newExecuteAdvancedSearch = `  const executeAdvancedSearch = async () => {
    const hasSearchCriteria = !!(advSearchGov || advSearchMonth || advSearchYear || advSearchDateFrom || advSearchDateTo || advSearchReceipt || advSearchPhone || advSearchStatus || advSearchName);
    if (!hasSearchCriteria && !selectedGridStatus) {
      setAdvancedSearchResults([]);
      return;
    }

    let result = orders.filter((ord) => {
      let match = true;
      
      if (advSearchGov && advSearchGov.trim()) {
        if (!String(ord.governorate || '').toLowerCase().includes(advSearchGov.toLowerCase().trim())) match = false;
      }
      
      let orderDateObj = null;
      if (ord.rawCreatedAt) {
         orderDateObj = new Date(ord.rawCreatedAt);
      } else if (ord.createdAt && typeof ord.createdAt.toDate === 'function') {
         orderDateObj = ord.createdAt.toDate();
      } else if (ord.createdAt) {
         const d = String(ord.createdAt);
         if (d.includes('/')) {
            const parts = d.split('/');
            if (parts.length === 3) {
               const dd = parseInt(parts[0], 10);
               const mm = parseInt(parts[1], 10) - 1;
               const yyyy = parseInt(parts[2].split(' ')[0], 10);
               orderDateObj = new Date(yyyy, mm, dd, 12, 0, 0);
            }
         }
         if (!orderDateObj || isNaN(orderDateObj.getTime())) {
            orderDateObj = new Date(d);
         }
      }
      
      const isValidDate = orderDateObj && !isNaN(orderDateObj.getTime());
      const orderDateIso = isValidDate ? orderDateObj.toISOString() : '';
      
      if (advSearchMonth && advSearchMonth.trim()) {
        if (!isValidDate) match = false;
        else {
           const m = String(advSearchMonth).padStart(2, '0');
           if (!orderDateIso.includes('-' + m + '-')) match = false;
        }
      }
      if (advSearchYear && advSearchYear.trim()) {
        if (!isValidDate) match = false;
        else if (!orderDateIso.includes(advSearchYear)) match = false;
      }
      if (advSearchDateFrom || advSearchDateTo) {
        if (isValidDate) {
          if (advSearchDateFrom) {
             const f = new Date(advSearchDateFrom); f.setHours(0,0,0,0);
             if (orderDateObj < f) match = false;
          }
          if (advSearchDateTo) {
             const t = new Date(advSearchDateTo); t.setHours(23,59,59,999);
             if (orderDateObj > t) match = false;
          }
        } else {
          match = false;
        }
      }
      
      if (advSearchReceipt && advSearchReceipt.trim()) {
        if (!String(ord.receiptNumber || ord.id || '').toLowerCase().includes(advSearchReceipt.toLowerCase().trim())) match = false;
      }
      
      if (advSearchName && advSearchName.trim()) {
        if (!String(ord.customerName || '').toLowerCase().includes(advSearchName.toLowerCase().trim())) match = false;
      }
      
      if (advSearchPhone && advSearchPhone.trim()) {
        const p1 = String(ord.customerPhone || '').toLowerCase();
        const p2 = String(ord.customerPhone2 || '').toLowerCase();
        const term = advSearchPhone.toLowerCase().trim();
        if (!p1.includes(term) && !p2.includes(term)) match = false;
      }
      
      if (advSearchStatus && advSearchStatus.trim()) {
        if (ord.status !== advSearchStatus) match = false;
      }
      
      return match;
    });

    if (result.length === 0 && (advSearchReceipt || advSearchPhone)) {
       try {
          let serverRes = [];
          if (advSearchReceipt && advSearchReceipt.trim()) {
             let q = fsQuery(collection(db, 'users', adminUid, 'orders'), where('receiptNumber', '==', advSearchReceipt.trim()));
             let snap = await getDocs(q);
             if (snap.empty) {
                const docRef = doc(db, 'users', adminUid, 'orders', advSearchReceipt.trim());
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                   serverRes.push({ id: docSnap.id, ...docSnap.data() });
                }
             } else {
                serverRes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
             }
          } else if (advSearchPhone && advSearchPhone.trim()) {
             let q = fsQuery(collection(db, 'users', adminUid, 'orders'), where('customerPhone', '==', advSearchPhone.trim()));
             let snap = await getDocs(q);
             if (!snap.empty) {
                serverRes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
             }
          }
          if (serverRes.length > 0) {
             result = serverRes;
          }
       } catch (e) {
          console.log("Server fallback error:", e);
       }
    }

    setAdvancedSearchResults(result);
    console.log(\`Executed Advanced Search: filtered \${orders.length} orders down to \${result.length} orders.\`);
  };`;

// Replace the old executeAdvancedSearch
const executeRegex = /const executeAdvancedSearch = \(\) => \{[\s\S]*?console\.log\(`Executed Advanced Search.*?\}\;/;
content = content.replace(executeRegex, newExecuteAdvancedSearch);


// 4. Inject advSearchName into UI
const uiRegex = /<TextInput[\s\S]*?value=\{advSearchReceipt\}[\s\S]*?<\/View>/;
const match = content.match(uiRegex);
if (match && !content.includes('value={advSearchName}')) {
  const nameInputHtml = `
            {/* Customer Name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="اسم الزبون"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchName}
                onChangeText={setAdvSearchName}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx="12" cy="7" r="4" /></Svg>
            </View>
`;
  content = content.replace(match[0], match[0] + nameInputHtml);
}

fs.writeFileSync('App.js', content);
console.log("Fixed advanced search in App.js");
