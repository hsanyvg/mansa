const fs = require('fs');
const file = 'c:/Users/Hasan/.gemini/antigravity/scratch/inventory-system/app/orders/list/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix confirmDeleteOrder
content = content.replace(
  "const isCancelled = ['cancelled', 'returned', 'returned_agent', 'returned_warehouse'].includes(orderToDelete.status);",
  "const state = getStockState(orderToDelete.status);\n      const isAlreadyFreed = state === 'FREE';"
);
content = content.replace(
  "if (!isCancelled && orderToDelete.items && orderToDelete.items.length > 0) {",
  "if (!isAlreadyFreed && orderToDelete.items && orderToDelete.items.length > 0) {"
);
content = content.replace(
  "const isHardDeducted = ['shipped', 'delivered', 'partial', 'returned_agent', 'returned'].includes(orderToDelete.status);",
  "const isHardDeducted = state === 'HARD_DEDUCTED';"
);
content = content.replace(
  "const isHardDeducted = ['shipped', 'delivered', 'partial', 'returned_agent', 'returned'].includes(orderToDelete.status);",
  "const isHardDeducted = state === 'HARD_DEDUCTED';"
);

// 2. Fix confirmBulkDelete
// In confirmBulkDelete, there is a bug where it ALWAYS adds to quantity and ignores reserved.
// We must replace the stock manipulation logic inside it.
const bulkDeleteTarget = `
                  const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                  if (!stock[firstStoreKey]) {
                    stock[firstStoreKey] = { quantity: qtyToAdd, unit: rawData.units?.[0]?.type || 'قطعة' };
                  } else {
                    stock[firstStoreKey].quantity += qtyToAdd;
                  }`;
                  
const bulkDeleteReplacement = `
                  const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                  if (!stock[firstStoreKey]) {
                    stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: rawData.units?.[0]?.type || 'قطعة' };
                  }
                  const isHardDeducted = state === 'HARD_DEDUCTED';
                  if (isHardDeducted) {
                    stock[firstStoreKey].quantity += qtyToAdd;
                  } else {
                    stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToAdd);
                  }`;
                  
content = content.replace(bulkDeleteTarget, bulkDeleteReplacement);

const bulkDeleteTarget2 = `
                const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                if (!stock[firstStoreKey]) {
                  stock[firstStoreKey] = { quantity: qtyToAdd, unit: prodData.units?.[0]?.type || 'قطعة' };
                } else {
                  stock[firstStoreKey].quantity += qtyToAdd;
                }`;
                
const bulkDeleteReplacement2 = `
                const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                if (!stock[firstStoreKey]) {
                  stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: prodData.units?.[0]?.type || 'قطعة' };
                }
                const isHardDeducted = state === 'HARD_DEDUCTED';
                if (isHardDeducted) {
                  stock[firstStoreKey].quantity += qtyToAdd;
                } else {
                  stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToAdd);
                }`;
                
content = content.replace(bulkDeleteTarget2, bulkDeleteReplacement2);

// Fix the isCancelled logic in confirmBulkDelete
content = content.replace(
  "const isCancelled = ['cancelled', 'returned', 'returned_agent', 'returned_warehouse'].includes(orderItem.status);",
  "const state = getStockState(orderItem.status);\n        const isAlreadyFreed = state === 'FREE';"
);
content = content.replace(
  "if (!isCancelled && orderItem.items && orderItem.items.length > 0) {",
  "if (!isAlreadyFreed && orderItem.items && orderItem.items.length > 0) {"
);

fs.writeFileSync(file, content);
console.log('Fixed deletion stock logic');
