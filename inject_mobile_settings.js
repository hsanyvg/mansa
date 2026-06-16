const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mansa-mobile', 'App.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove the Account Tab block from the main render ternary
// The block starts at `) : activeTab === 'account' ? (` and ends before `) : activeTab === 'orders' ? (`
const accountTabStartStr = `      ) : activeTab === 'account' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
          {/* Account Tab Content */}
          <View style={styles.tabHeaderCard}>
            <Text style={styles.tabHeaderTitle}>👤 ملف الموظف التعريفي</Text>
          </View>
          <View style={styles.statCardBig}>
            <Text style={styles.profileLabel}>الموظف الحالي:</Text>
            <Text style={styles.profileValue}>{selectedEmployeeName}</Text>
            <Text style={styles.profileDescription}>
              مسؤول عن إدخال الطلبات الحالية وتعديلها.
            </Text>
            <TouchableOpacity 
              style={styles.profileSwitchBtn} 
              onPress={() => setEmpModalVisible(true)}
            >
              <Text style={styles.profileSwitchBtnText}>🔄 تغيير الموظف</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabHeaderCard}>
            <Text style={styles.tabHeaderTitle}>🔐 حساب المستخدم</Text>
          </View>
          <View style={styles.statCardBig}>
            <Text style={styles.profileLabel}>البريد الإلكتروني:</Text>
            <Text style={styles.profileValue}>{user?.email}</Text>
            <Text style={styles.profileDescription}>
              هذا هو حساب المنصة المسجل دخولك به حالياً.
            </Text>
            <TouchableOpacity 
              style={[styles.profileSwitchBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444' }]} 
              onPress={handleLogout}
            >
              <Text style={[styles.profileSwitchBtnText, { color: '#ef4444' }]}>🚪 تسجيل الخروج</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>`;

content = content.replace(accountTabStartStr, '');

// 2. Add the Employee Profile and Logout Button to the Settings Tab
const settingsHeaderStr = `          <View style={styles.tabHeaderCard}>
            <Text style={styles.tabHeaderTitle}>⚙️ إعدادات النظام</Text>
          </View>`;
const newSettingsContent = `          <View style={styles.tabHeaderCard}>
            <Text style={styles.tabHeaderTitle}>⚙️ إعدادات النظام</Text>
          </View>

          <View style={styles.statCardBig}>
            <Text style={styles.profileLabel}>الموظف الحالي:</Text>
            <Text style={styles.profileValue}>{selectedEmployeeName}</Text>
            <Text style={styles.profileDescription}>
              مسؤول عن إدخال الطلبات الحالية وتعديلها.
            </Text>
            <TouchableOpacity 
              style={styles.profileSwitchBtn} 
              onPress={() => setEmpModalVisible(true)}
            >
              <Text style={styles.profileSwitchBtnText}>🔄 تغيير الموظف</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statCardBig}>
            <Text style={styles.profileLabel}>تسجيل الخروج:</Text>
            <Text style={styles.profileValue}>{user?.email}</Text>
            <TouchableOpacity 
              style={[styles.profileSwitchBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', marginTop: 10 }]} 
              onPress={handleLogout}
            >
              <Text style={[styles.profileSwitchBtnText, { color: '#ef4444' }]}>🚪 تسجيل الخروج</Text>
            </TouchableOpacity>
          </View>`;

content = content.replace(settingsHeaderStr, newSettingsContent);

// 3. Remove the 'حسابي' Tab from Bottom Navigation
const navAccountStr = `        {/* Tab 2: حسابي */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'account' && styles.navItemActive]}
          onPress={() => setActiveTab('account')}
        >
          {renderProfileIcon(activeTab === 'account')}
          <Text style={[styles.navText, activeTab === 'account' && styles.navTextActive]}>حسابي</Text>
        </TouchableOpacity>`;

content = content.replace(navAccountStr, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Mobile app settings and nav updated.');
