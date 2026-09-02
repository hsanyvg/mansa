const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const oldBlock = `                // Use rawCreatedAt if available, otherwise try to parse the string
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
                }`;

const newBlock = `                // Use rawCreatedAt if available, otherwise try to parse the string
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
                }`;

if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync('App.js', content);
    console.log('Fixed Timestamp parsing for Date filters!');
} else {
    console.log('Failed to find the parser block');
}
