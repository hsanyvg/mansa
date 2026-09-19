const fs = require('fs');
const file = 'c:/Users/Hasan/.gemini/antigravity/scratch/inventory-system/app/orders/list/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const compTarget = `                  if (!stock[firstStoreKey]) {
                    stock[firstStoreKey] = { quantity: qtyToAdd, unit: rawData.units?.[0]?.type || 'قطعة' };
                  } else {
                    stock[firstStoreKey].quantity += qtyToAdd;
                  }`;

const compReplacement = `                  if (!stock[firstStoreKey]) {
                    stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: rawData.units?.[0]?.type || 'قطعة' };
                  }
                  const isHardDeducted = state === 'HARD_DEDUCTED';
                  if (isHardDeducted) {
                    stock[firstStoreKey].quantity += qtyToAdd;
                  } else {
                    stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToAdd);
                  }`;

content = content.replace(compTarget, compReplacement);

const simpleTarget = `                if (!stock[firstStoreKey]) {
                  stock[firstStoreKey] = { quantity: qtyToAdd, unit: prodData.units?.[0]?.type || 'قطعة' };
                } else {
                  stock[firstStoreKey].quantity += qtyToAdd;
                }`;

const simpleReplacement = `                if (!stock[firstStoreKey]) {
                  stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: prodData.units?.[0]?.type || 'قطعة' };
                }
                const isHardDeducted = state === 'HARD_DEDUCTED';
                if (isHardDeducted) {
                  stock[firstStoreKey].quantity += qtyToAdd;
                } else {
                  stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToAdd);
                }`;

content = content.replace(simpleTarget, simpleReplacement);

fs.writeFileSync(file, content);
console.log('Fixed bulk delete logic successfully!');
