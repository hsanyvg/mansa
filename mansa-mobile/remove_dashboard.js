const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Change default active tab
content = content.replace(
  /const \[activeTab, setActiveTab\] = useState\('dashboard'\);/g,
  `const [activeTab, setActiveTab] = useState('orders');`
);

// 2. Change all setActiveTab('dashboard') to setActiveTab('orders')
content = content.replace(/setActiveTab\('dashboard'\)/g, `setActiveTab('orders')`);

// 3. Remove the dashboard UI block from Main Tab View
// The dashboard UI block starts at:
// {activeTab === 'dashboard' ? (
//        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
// and ends at:
//      ) : activeTab === 'add_expense' ? (
// Let's use a regex to remove everything between these two lines.

content = content.replace(
  /\{activeTab === 'dashboard' \? \([\s\S]*?\) : activeTab === 'add_expense' \? \(/,
  `{activeTab === 'add_expense' ? (`
);

// 4. Remove the bottom tab button for dashboard
const bottomNavBtn = `        {/* Right: بياناتي (dashboard) */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
          onPress={() => setActiveTab('orders')}
        >
          {renderReportsIcon(activeTab === 'dashboard')}
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>بياناتي</Text>
        </TouchableOpacity>`;

// Note: I already replaced setActiveTab('dashboard') with setActiveTab('orders') globally
// So the onPress is now setActiveTab('orders')

// Wait, the regex could just match the whole button block.
content = content.replace(/(\s*)\{\/\* Right: بياناتي \(dashboard\) \*\/\}([\s\S]*?)<\/TouchableOpacity>/, '');

fs.writeFileSync('App.js', content);
console.log("Removed dashboard");
