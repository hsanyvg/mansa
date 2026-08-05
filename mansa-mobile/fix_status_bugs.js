const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Fix the active orders filter
content = content.replace(
  /if \(ordersFilter === 'active'\) return ord\.status !== 'delivered' && ord\.status !== 'partial' && ord\.status !== 'cancelled' && ord\.status !== 'returned';/g,
  `if (ordersFilter === 'active') return !['delivered', 'delivered_settled', 'partial', 'cancelled', 'returned', 'returned_agent', 'returned_warehouse'].includes(ord.status);`
);

// 2. Fix the styling of the badge
// We should use a helper function or inline logic.
// Let's replace the inline styling block:
const badStyleOld = `ord.status === 'delivered' ? styles.badgeDelivered :
                              ord.status === 'partial' ? styles.badgePartial :
                              ord.status === 'returned' ? styles.badgeReturned :
                              ord.status === 'cancelled' ? styles.badgeCancelled :
                              ord.status === 'backordered' ? styles.badgeBackordered : styles.badgePending`;

const badStyleNew = `['delivered', 'delivered_settled'].includes(ord.status) ? styles.badgeDelivered :
                              ord.status === 'partial' ? styles.badgePartial :
                              ['returned', 'returned_agent', 'returned_warehouse'].includes(ord.status) ? styles.badgeReturned :
                              ord.status === 'cancelled' ? styles.badgeCancelled :
                              ord.status === 'backordered' ? styles.badgeBackordered : styles.badgePending`;

content = content.replaceAll(badStyleOld, badStyleNew);

// 3. Fix the badge text
const badTextOld = `{ord.status === 'delivered' ? 'واصل' :
                                 ord.status === 'partial' ? 'واصل جزئي' :
                                 ord.status === 'returned' ? 'راجع' :
                                 ord.status === 'returned_warehouse' ? 'راجع مستلم بالمخزن' :
                                 ord.status === 'cancelled' ? 'ملغي' :
                                 ord.status === 'backordered' ? 'بانتظار المخزون' : 'قيد الانتظار'}`;

const badTextNew = `{translateStatus(ord.status)}`;

content = content.replaceAll(badTextOld, badTextNew);

// Wait, I also need to make sure the edit button handles returned_agent
// It already does! `ord.status !== 'returned_agent'` is there.

fs.writeFileSync('App.js', content);
console.log("Fixed statuses bugs");
