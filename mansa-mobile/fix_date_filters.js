const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// The faulty filter block starts with `const filteredList = orders.filter((ord) => {`
// Let's replace the whole body of it!
const oldFilterStart = `              const filteredList = orders.filter((ord) => {`;
const oldFilterEnd = `              // Aggregate filtered list by status`;

const newFilter = `              const filteredList = orders.filter((ord) => {
                let match = true;
                
                if (advSearchGov && advSearchGov.trim()) {
                  if (!String(ord.governorate || '').toLowerCase().includes(advSearchGov.toLowerCase().trim())) match = false;
                }
                
                // Helper to parse DD/MM/YYYY to Date object
                const parseDateStr = (d) => {
                   if (!d) return null;
                   if (typeof d.toDate === 'function') return d.toDate();
                   if (d instanceof Date) return d;
                   if (typeof d === 'string') {
                       if (d.includes('/')) {
                          const parts = d.split('/');
                          if (parts.length === 3) {
                             // parts[0]=DD, parts[1]=MM, parts[2]=YYYY
                             const mm = parseInt(parts[1], 10) - 1;
                             return new Date(parts[2], mm, parts[0], 12, 0, 0);
                          }
                       }
                       return new Date(d);
                   }
                   return null;
                };

                const orderDateObj = parseDateStr(ord.createdAt);
                const orderDateIso = orderDateObj ? orderDateObj.toISOString() : '';
                
                if (advSearchMonth && advSearchMonth.trim()) {
                  const m = String(advSearchMonth).padStart(2, '0');
                  if (!orderDateIso.includes('-' + m + '-')) match = false;
                }
                if (advSearchYear && advSearchYear.trim()) {
                  if (!orderDateIso.includes(advSearchYear)) match = false;
                }
                if (advSearchDateFrom || advSearchDateTo) {
                  if (orderDateObj && !isNaN(orderDateObj.getTime())) {
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
    console.log('Date filters fixed successfully!');
} else {
    console.log('Failed to locate filter block.');
}
