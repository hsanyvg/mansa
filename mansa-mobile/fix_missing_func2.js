const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

c = c.replace(/      const counterRef = doc\(db, 'users', adminUid, 'metadata', 'orderCounter'\);/, `  const handleBarcodeScanned = ({ type, data }) => {
    setScanned(true);
    setNewBarcodeReceipt(data);
  };

  const handleSaveBarcodeReceipt = async () => {
    if (!newBarcodeReceipt.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال رقم الوصل' });
      return;
    }
    try {
      const counterRef = doc(db, 'users', adminUid, 'metadata', 'orderCounter');`);

fs.writeFileSync('App.js', c);
console.log('Fixed missing declaration!');
