const fs = require('fs');
let code = fs.readFileSync('App.js', 'utf8');

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
           logMessages.push(\`المبلغ الكلي من "\${originalOrderDetails.totalAmount || 0}" إلى "\${totalAmount || 0}"\`);
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
        updates.logs = arrayUnion({
           action: 'تعديل',
           message: 'تم التعديل: ' + logMessages.join(' | '),
           date: new Date().toISOString(),
           by: loggedInSystemUserName || 'مستخدم النظام'
        });
      }`;

if (code.includes(targetLogic)) {
    code = code.replace(targetLogic, newLogic);
    fs.writeFileSync('App.js', code);
    console.log("Successfully injected the auditing diff logic.");
} else {
    console.log("Target logic not found!");
}
