const fs = require('fs');
const file = 'c:/Users/Hasan/.gemini/antigravity/scratch/inventory-system/app/orders/list/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = /if \(\!stock\[firstStoreKey\]\) \{\s*stock\[firstStoreKey\] = \{ quantity: qtyToAdd, unit: rawData\.units\?\.\[0\]\?\.type \|\| 'قطعة' \};\s*\} else \{\s*stock\[firstStoreKey\]\.quantity \+= qtyToAdd;\s*\}/g;

const target2 = /if \(\!stock\[firstStoreKey\]\) \{\s*stock\[firstStoreKey\] = \{ quantity: qtyToAdd, unit: prodData\.units\?\.\[0\]\?\.type \|\| 'قطعة' \};\s*\} else \{\s*stock\[firstStoreKey\]\.quantity \+= qtyToAdd;\s*\}/g;

const rep1 = `if (!stock[firstStoreKey]) {
                    stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: rawData.units?.[0]?.type || 'قطعة' };
                  }
                  const isHardDeducted = state === 'HARD_DEDUCTED';
                  if (isHardDeducted) {
                    stock[firstStoreKey].quantity += qtyToAdd;
                  } else {
                    stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToAdd);
                  }`;

const rep2 = `if (!stock[firstStoreKey]) {
                  stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: prodData.units?.[0]?.type || 'قطعة' };
                }
                const isHardDeducted = state === 'HARD_DEDUCTED';
                if (isHardDeducted) {
                  stock[firstStoreKey].quantity += qtyToAdd;
                } else {
                  stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToAdd);
                }`;

let newContent = content.replace(target1, rep1);
newContent = newContent.replace(target2, rep2);

if (newContent !== content) {
  fs.writeFileSync(file, newContent);
  console.log('Successfully fixed bulk delete bug!');
} else {
  console.log('No matches found for regex.');
}
