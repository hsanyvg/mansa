const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const oldFilterLogic = `              const filteredList = orders.filter((ord) => {
                let match = true;
                
                if (advSearchGov && advSearchGov.trim()) {
                  if (!(ord.governorate || '').toLowerCase().includes(advSearchGov.toLowerCase().trim())) match = false;
                }
                
                if (advSearchDate && advSearchDate.trim()) {
                  if (!(ord.createdAt || '').toLowerCase().includes(advSearchDate.toLowerCase().trim())) match = false;
                }
                
                if (advSearchReceipt && advSearchReceipt.trim()) {
                  if (!(ord.receiptNumber || ord.id || '').toLowerCase().includes(advSearchReceipt.toLowerCase().trim())) match = false;
                }
                
                if (advSearchName && advSearchName.trim()) {
                  if (!(ord.customerName || '').toLowerCase().includes(advSearchName.toLowerCase().trim())) match = false;
                }
                
                if (advSearchPhone && advSearchPhone.trim()) {
                  const p1 = (ord.customerPhone || '').toLowerCase();
                  const p2 = (ord.customerPhone2 || '').toLowerCase();
                  const term = advSearchPhone.toLowerCase().trim();
                  if (!p1.includes(term) && !p2.includes(term)) match = false;
                }
                
                if (advSearchStatus && advSearchStatus.trim()) {
                  if (ord.status !== advSearchStatus) match = false;
                }
                
                return match;
              });`;

const newFilterLogic = `              const filteredList = orders.filter((ord) => {
                let match = true;
                
                if (advSearchGov && advSearchGov.trim()) {
                  if (!String(ord.governorate || '').toLowerCase().includes(advSearchGov.toLowerCase().trim())) match = false;
                }
                
                if (advSearchDate && advSearchDate.trim()) {
                  if (!String(ord.createdAt || '').toLowerCase().includes(advSearchDate.toLowerCase().trim())) match = false;
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
              });`;

if (content.includes(oldFilterLogic)) {
    content = content.replace(oldFilterLogic, newFilterLogic);
    fs.writeFileSync('App.js', content);
    console.log("Fixed search types!");
} else {
    console.log("Could not find the target string. Maybe it has different formatting?");
}
