const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const oldTranslateBlock = `  const translateStatus = (status) => {
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
    }`;

const newTranslateBlock = `  const translateStatus = (status) => {
    switch (status) {
      case 'new': return 'جديد';
      case 'pending': return 'قيد الانتظار';
      case 'pending_warehouse': return 'قيد انتظار المخزن';
      case 'backordered': return 'قيد الانتظار (مخزن)';
      case 'processing': return 'جاري التجهيز';
      case 'processed': return 'تمت المعالجة';
      case 'confirmed': return 'مؤكد';
      case 'shipped': return 'تم الشحن';
      case 'ofd': return 'قيد التوصيل';
      case 'delivered': return 'مكتمل (لم تتم المحاسبة)';
      case 'delivered_settled': return 'مكتمل (تمت المحاسبة)';
      case 'partial': return 'واصل جزئي (لم تتم المحاسبة)';
      case 'returned': return 'راجع';
      case 'returned_agent': return 'راجع عند المندوب';
      case 'returned_warehouse': return 'راجع مخزن';
      case 'postponed': return 'مؤجل';
      case 'cancelled': return 'ملغي';
      case 'replaced': return 'استبدال';
      default: return status || 'غير معروف';
    }`;

content = content.replace(oldTranslateBlock, newTranslateBlock);

fs.writeFileSync('App.js', content);
console.log("Updated status translations");
