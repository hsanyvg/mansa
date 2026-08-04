const fs = require('fs');
const appJsPath = './App.js';
let code = fs.readFileSync(appJsPath, 'utf8');

// 1. Add renderProductsIcon
const productsIconCode = `
  const renderProductsIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
        )}
        <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke={strokeColor} strokeWidth={2} />
        <Path d="M3.27 6.96L12 12.01l8.73-5.05" stroke={strokeColor} strokeWidth={2} />
        <Path d="M12 22.08V12" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };
`;

if (!code.includes('renderProductsIcon')) {
  code = code.replace('const renderSettingsIcon', productsIconCode + '\n  const renderSettingsIcon');
}

// 2. Replace renderOrdersIcon with Clipboard icon
const oldRenderOrdersStart = code.indexOf('const renderOrdersIcon = (active) => {');
const oldRenderOrdersEnd = code.indexOf('};', oldRenderOrdersStart) + 2;

const newRenderOrdersIcon = `const renderOrdersIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Path d="M9 2H15A1 1 0 0 1 16 3V5H8V3A1 1 0 0 1 9 2Z" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M8 4H5A2 2 0 0 0 3 6V20A2 2 0 0 0 5 22H19A2 2 0 0 0 21 20V6A2 2 0 0 0 19 4H16" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M8 11H16" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M8 15H16" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
          </>
        )}
        <Path d="M9 2H15A1 1 0 0 1 16 3V5H8V3A1 1 0 0 1 9 2Z" stroke={strokeColor} strokeWidth={2} />
        <Path d="M8 4H5A2 2 0 0 0 3 6V20A2 2 0 0 0 5 22H19A2 2 0 0 0 21 20V6A2 2 0 0 0 19 4H16" stroke={strokeColor} strokeWidth={2} />
        <Path d="M8 11H16" stroke={strokeColor} strokeWidth={2} />
        <Path d="M8 15H16" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };`;

if (oldRenderOrdersStart !== -1) {
  code = code.substring(0, oldRenderOrdersStart) + newRenderOrdersIcon + code.substring(oldRenderOrdersEnd);
}

// 3. Replace Bottom Tabs Navigation
const oldBottomNavStart = code.indexOf('{/* Bottom Tabs Navigation */}');
const modalsSectionStart = code.indexOf('{/* --- Modals Section --- */}');

if (oldBottomNavStart !== -1 && modalsSectionStart !== -1) {
  const newBottomNav = `{/* Bottom Tabs Navigation */}
      <View style={styles.bottomNav}>
        {/* Right: بياناتي (dashboard) */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          {renderReportsIcon(activeTab === 'dashboard')}
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>بياناتي</Text>
        </TouchableOpacity>

        {/* Center-Right: طلبيات (orders) */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'orders' && styles.navItemActive]}
          onPress={() => setActiveTab('orders')}
        >
          {renderOrdersIcon(activeTab === 'orders')}
          <Text style={[styles.navText, activeTab === 'orders' && styles.navTextActive]}>طلبيات</Text>
        </TouchableOpacity>

        {/* Center-Left: Floating + (entry) */}
        <View style={[styles.centerNavWrapper, { marginTop: -40, flex: 1.2 }]}>
          <TouchableOpacity 
            style={[styles.centerNavBtn, { backgroundColor: 'transparent', borderWidth: 0, width: 68, height: 68, shadowColor: 'transparent', elevation: 0 }, activeTab === 'entry' && styles.centerNavBtnActive]}
            onPress={() => setActiveTab('entry')}
          >
            <Svg width="76" height="76" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
              <Polygon points="50 5, 93 30, 93 70, 50 95, 7 70, 7 30" fill="#a855f7" stroke="#8b5cf6" strokeWidth="6" />
              <Polygon points="50 12, 85 32, 85 68, 50 88, 15 68, 15 32" fill="transparent" stroke="#d8b4fe" strokeWidth="3" />
            </Svg>
            <Text style={[styles.centerNavIcon, { zIndex: 2, fontSize: 34, color: 'white', marginTop: -4, fontWeight: '500' }]}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Left: المنتجات (settings) */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          {renderProductsIcon(activeTab === 'settings')}
          <Text style={[styles.navText, activeTab === 'settings' && styles.navTextActive]}>المنتجات</Text>
        </TouchableOpacity>
      </View>

      `;
  
  code = code.substring(0, oldBottomNavStart) + newBottomNav + code.substring(modalsSectionStart);
} else {
  console.log("Could not find bottom nav bounds");
}

fs.writeFileSync(appJsPath, code);
console.log("Bottom nav updated successfully");
