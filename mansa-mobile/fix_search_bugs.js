const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Fix Modal condition
content = content.replace(
    'if (!hasSearchCriteria) {',
    'if (!hasSearchCriteria && !selectedGridStatus) {'
);

// 2. Fix filteredList
content = content.replace(
    'const filteredList = advancedSearchResults;',
    'const filteredList = (!hasSearchCriteria) ? orders : advancedSearchResults;'
);

// 3. Fix Yellow Card rendering (Products & Timestamp crash)
const oldCreatedAt = `اخر تحديث : {ord.createdAt || ''}`;
const newCreatedAt = `اخر تحديث : {ord.createdAt && typeof ord.createdAt.toDate === 'function' ? formatDateLocal(ord.createdAt.toDate()) : (ord.createdAt || '')}`;

content = content.replace(oldCreatedAt, newCreatedAt);

// 4. Add Products to Yellow Card
const oldNotes = `<Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                   الملاحظات : {ord.notes || 'لا توجد'}
                                </Text>`;
const newNotes = `<Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                   المنتجات : {Array.isArray(ord.products) ? ord.products.map(p => p.name).join('، ') : 'بدون منتجات'}
                                </Text>
                                <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                   الملاحظات : {ord.notes || 'لا توجد'}
                                </Text>`;

content = content.replace(oldNotes, newNotes);

fs.writeFileSync('App.js', content);
console.log('Search bugs fixed successfully!');
