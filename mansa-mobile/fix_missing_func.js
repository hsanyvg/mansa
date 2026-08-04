const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

const target = `  };

      const counterRef = doc(db, 'users', adminUid, 'metadata', 'orderCounter');
      let newOrderId = 100000;`;

const replacement = `  };

  const handleBarcodeScanned = ({ type, data }) => {
    setScanned(true);
    setNewBarcodeReceipt(data);
  };

  const handleSaveBarcodeReceipt = async () => {
    if (!newBarcodeReceipt.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال رقم الوصل' });
      return;
    }
    try {
      const counterRef = doc(db, 'users', adminUid, 'metadata', 'orderCounter');
      let newOrderId = 100000;`;

if(c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync('App.js', c);
  console.log('Fixed syntax error!');
} else {
  // Let's try replacing with \r\n
  const targetCRLF = target.replace(/\n/g, '\r\n');
  if(c.includes(targetCRLF)) {
    c = c.replace(targetCRLF, replacement.replace(/\n/g, '\r\n'));
    fs.writeFileSync('App.js', c);
    console.log('Fixed syntax error (CRLF)!');
  } else {
    console.log('Target not found!');
  }
}
