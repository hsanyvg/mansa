const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Update fetchOrders to save rawCreatedAt
const fetchOrdersRegex = /createdAt:\s*data\.createdAt\s*\?\s*\(data\.createdAt\.toDate\s*\?\s*data\.createdAt\.toDate\(\)\.toLocaleDateString\('en-GB'\)\s*:\s*new\s+Date\(data\.createdAt\)\.toLocaleDateString\('en-GB'\)\)\s*:\s*''/g;
if (content.match(fetchOrdersRegex)) {
    content = content.replace(fetchOrdersRegex, "createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString('en-GB') : new Date(data.createdAt).toLocaleDateString('en-GB')) : '', rawCreatedAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime()) : 0");
} else {
    console.log("Could not find createdAt in fetchOrders");
}


// 2. Update the Search Filter to use rawCreatedAt
const oldFilterStart = `              const filteredList = orders.filter((ord) => {`;
const oldFilterEnd = `              // Aggregate filtered list by status`;

const newFilter = `              const filteredList = orders.filter((ord) => {
                let match = true;
                
                if (advSearchGov && advSearchGov.trim()) {
                  if (!String(ord.governorate || '').toLowerCase().includes(advSearchGov.toLowerCase().trim())) match = false;
                }
                
                // Use rawCreatedAt if available, otherwise try to parse the string
                let orderDateObj = null;
                if (ord.rawCreatedAt) {
                   orderDateObj = new Date(ord.rawCreatedAt);
                } else if (ord.createdAt) {
                   // Fallback parsing (rarely used now)
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
                    match = false; // if searching by date and order has no valid date, it fails
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

              console.log('Filtered Orders Count:', filteredList.length);

`;

let startIndex = content.indexOf(oldFilterStart);
let endIndex = content.indexOf(oldFilterEnd);

if (startIndex !== -1 && endIndex !== -1) {
    let before = content.substring(0, startIndex);
    let after = content.substring(endIndex);
    content = before + newFilter + after;
    fs.writeFileSync('App.js', content);
    console.log('Robust Date filtering with rawCreatedAt applied successfully!');
} else {
    console.log('Failed to locate filter block.');
}
