const fs = require('fs');
const file = 'c:/Users/Hasan/.gemini/antigravity/scratch/inventory-system/app/orders/list/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
for(let i=0; i<lines.length; i++){
  if(lines[i].includes('const getStockState = (status: string) => {') && lines[i+1].includes('HARD_DEDUCTED') && lines[i+2].includes('FREE')) {
     lines[i+1] = "    if (['cancelled', 'returned_warehouse'].includes(status)) return 'FREE';";
     lines[i+2] = "    if (['pending', 'backordered', 'new'].includes(status)) return 'SOFT_ALLOCATED';";
     lines[i+3] = "    return 'HARD_DEDUCTED';";
     console.log('Replaced via line matching');
     break;
  }
}
fs.writeFileSync(file, lines.join('\n'));
