const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

// 1. Add translateStatus inside App component
const translateStatusCode = `
  const translateStatus = (status) => {
    switch (status) {
      case 'new': return 'جديد';
      case 'pending': return 'قيد الانتظار';
      case 'pending_warehouse': return 'قيد انتظار المخزن';
      case 'processing': return 'قيد المعالجة';
      case 'processed': return 'تمت المعالجة';
      case 'confirmed': return 'مؤكد';
      case 'ofd': return 'في الطريق';
      case 'shipped': return 'تم الشحن';
      case 'delivered': return 'واصل (ناجح)';
      case 'delivered_settled': return 'واصل ومسدد';
      case 'returned': return 'راجع';
      case 'returned_agent': return 'راجع بيد المندوب';
      case 'returned_warehouse': return 'راجع للمخزن';
      case 'postponed': return 'مؤجل';
      case 'partial': return 'جزئي';
      case 'replaced': return 'استبدال';
      case 'backordered': return 'طلب متأخر';
      default: return status || 'غير معروف';
    }
  };
`;

if (!content.includes('const translateStatus = (status) =>')) {
  content = content.replace('export default function App() {', 'export default function App() {' + translateStatusCode);
}

// 2. Replace {item.receiptNumber} with {item.receiptNumber || 'بدون رقم'}
content = content.replace(/\{item\.receiptNumber\}/g, "{item.receiptNumber || 'بدون رقم'}");

// 3. Replace simple {item.status}
content = content.replace(/<Text style=\{\{ color: '#666' \}\}>\{item\.status\}<\/Text>/g, "<Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>");

// 4. Replace ternary 1
content = content.replace(/<Text style=\{\{ color: '#666' \}\}>\{item\.status === 'returned' \? 'عند المندوب' : 'في المخزن'\}<\/Text>/g, "<Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>");

// 5. Replace ternary 2
content = content.replace(/<Text style=\{\{ color: '#666' \}\}>\{item\.status === 'delivered' \? 'ناجحة' : item\.status === 'returned' \? 'راجعة' : item\.status === 'partial' \|\| item\.status === 'replaced' \? 'جزئي او استبدال' : item\.status\}<\/Text>/g, "<Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>");

fs.writeFileSync('App.js', content);
console.log("Successfully fixed UI text!");
