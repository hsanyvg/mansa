const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Rename renderOrdersIcon to renderSearchIcon and change the SVG to a magnifying glass
const searchIconSVG = `  const renderSearchIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Circle cx="11" cy="11" r="8" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M21 21l-4.3-4.3" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            
            <Circle cx="11" cy="11" r="8" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Path d="M21 21l-4.3-4.3" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Circle cx="11" cy="11" r="8" stroke={strokeColor} strokeWidth={2} />
        <Path d="M21 21l-4.3-4.3" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };`;

// Replace renderOrdersIcon function completely
const oldRenderOrdersIconRegex = /const renderOrdersIcon = \(active\) => \{[\s\S]*?\};/;
content = content.replace(oldRenderOrdersIconRegex, searchIconSVG);

// 2. Change the tab text and icon call in the bottom nav
// Search for: {renderOrdersIcon(activeTab === 'orders')}
// Search for: <Text style={[styles.navText, activeTab === 'orders' && styles.navTextActive]}>طلبيات</Text>
content = content.replace(/renderOrdersIcon/g, 'renderSearchIcon');
content = content.replace(
  /<Text style=\{\[styles\.navText, activeTab === 'orders' && styles\.navTextActive\]\}>طلبيات<\/Text>/g,
  `<Text style={[styles.navText, activeTab === 'orders' && styles.navTextActive]}>بحث</Text>`
);

// 3. Optional: Change the header title from "الطلبات" to "بحث متقدم" inside the orders tab
content = content.replace(
  /<Text style=\{styles\.ordersHeaderTitle\}>الطلبات<\/Text>/g,
  `<Text style={styles.ordersHeaderTitle}>بحث متقدم</Text>`
);

fs.writeFileSync('App.js', content);
console.log("Injected search tab UI");
