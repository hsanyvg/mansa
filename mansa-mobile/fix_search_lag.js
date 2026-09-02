const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add advancedSearchResults state
if (!content.includes('const [advancedSearchResults')) {
    content = content.replace(
        'const [selectedGridStatus, setSelectedGridStatus] = useState(null);',
        'const [selectedGridStatus, setSelectedGridStatus] = useState(null);\n  const [advancedSearchResults, setAdvancedSearchResults] = useState([]);'
    );
}

// 2. Add executeAdvancedSearch function right before handleServerSearch
const executeFn = `
  const executeAdvancedSearch = () => {
    const hasSearchCriteria = !!(advSearchGov || advSearchMonth || advSearchYear || advSearchDateFrom || advSearchDateTo || advSearchReceipt || advSearchPhone || advSearchStatus);
    if (!hasSearchCriteria) {
      setAdvancedSearchResults([]);
      return;
    }

    const result = orders.filter((ord) => {
      let match = true;
      
      if (advSearchGov && advSearchGov.trim()) {
        if (!String(ord.governorate || '').toLowerCase().includes(advSearchGov.toLowerCase().trim())) match = false;
      }
      
      // Use rawCreatedAt if available, otherwise try to parse the string
      let orderDateObj = null;
      if (ord.rawCreatedAt) {
         orderDateObj = new Date(ord.rawCreatedAt);
      } else if (ord.createdAt && typeof ord.createdAt.toDate === 'function') {
         // It's a Firebase Timestamp
         orderDateObj = ord.createdAt.toDate();
      } else if (ord.createdAt) {
         // Fallback parsing for string dates
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

    setAdvancedSearchResults(result);
  };
`;

if (!content.includes('const executeAdvancedSearch =')) {
    content = content.replace(
        'const handleServerSearch = async () => {',
        executeFn + '\n  const handleServerSearch = async () => {'
    );
}

// 3. Update the Search button to call executeAdvancedSearch()
content = content.replace(
    'Keyboard.dismiss(); \n                setSelectedGridStatus(null); setIsSearchModalVisible(true);',
    'Keyboard.dismiss(); \n                setSelectedGridStatus(null); executeAdvancedSearch(); setIsSearchModalVisible(true);'
);
content = content.replace(
    'Keyboard.dismiss(); \r\n                setSelectedGridStatus(null); setIsSearchModalVisible(true);',
    'Keyboard.dismiss(); \n                setSelectedGridStatus(null); executeAdvancedSearch(); setIsSearchModalVisible(true);'
);

// Backup replacement if the multiline doesn't match perfectly
content = content.replace(
    /setSelectedGridStatus\(null\);\s*setIsSearchModalVisible\(true\);/g,
    'setSelectedGridStatus(null); executeAdvancedSearch(); setIsSearchModalVisible(true);'
);


// 4. Remove the inline filter logic inside the Modal!
const oldInlineFilterStart = `              const filteredList = orders.filter((ord) => {`;
const oldInlineFilterEnd = `              // Aggregate filtered list by status`;

let filterStartIndex = content.lastIndexOf(oldInlineFilterStart);
let filterEndIndex = content.lastIndexOf(oldInlineFilterEnd);

if (filterStartIndex !== -1 && filterEndIndex !== -1) {
    let before = content.substring(0, filterStartIndex);
    let after = content.substring(filterEndIndex);
    content = before + '              const filteredList = advancedSearchResults;\n' + after;
    fs.writeFileSync('App.js', content);
    console.log('Search Lag fixed by extracting filter logic out of the Modal render!');
} else {
    console.log('Failed to find the inline filter block inside the Modal.');
}
