const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Replace ScrollViews for the 7 standard tabs
const tabsToReplace = [
  'completed_shipments',
  'returned_shipments',
  'postponed_shipments',
  'pending_shipments',
  'partial_shipments',
  'processed_shipments',
  'ofd_shipments'
];

// In these 7 tabs, we have <ScrollView style={{ flex: 1, padding: 15 }}> 
// which we will replace with <View style={{ flex: 1 }}> (padding moved to FlatList)

// For each standard tab, let's find the mapping block and replace it.
// Regex to find the standard map block:
// \{filtered\.slice\(0, displayedOrdersCount\)\.map\(\(item, index\) => \(([\s\S]*?)\)\)\}
// And the touchable:
// \{filtered\.length > displayedOrdersCount && \([\s\S]*?<\/TouchableOpacity>[\s\S]*?\)\}

let newContent = content;

// Replace the slice map with FlatList for `filtered`
newContent = newContent.replace(
  /\{filtered\.slice\(0, displayedOrdersCount\)\.map\(\(item, index\) => \(([\s\S]*?)\)\)\}[\s\S]*?\{filtered\.length > displayedOrdersCount && \([\s\S]*?<\/TouchableOpacity>[\s\S]*?\)\}/g,
  `<FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => ($1)} 
                  />`
);

// Replace the slice map with FlatList for `filteredList` in the 'orders' tab
newContent = newContent.replace(
  /\{filteredList\.slice\(0, displayedOrdersCount\)\.map\(\(ord\) => \(([\s\S]*?)\)\)\}[\s\S]*?\{filteredList\.length > displayedOrdersCount && \([\s\S]*?<\/TouchableOpacity>[\s\S]*?\)\}/g,
  `<FlatList 
                        data={filteredList} 
                        keyExtractor={ord => ord.id}
                        initialNumToRender={25}
                        maxToRenderPerBatch={50}
                        windowSize={10}
                        contentContainerStyle={{ paddingBottom: 50 }}
                        renderItem={({item: ord}) => ($1)} 
                      />`
);

// Now replace `<ScrollView style={{ flex: 1, padding: 15 }}>` with `<View style={{ flex: 1, padding: 15 }}>`
// and its closing tag. Since they are exactly paired, we can just replace them.
// Wait, we need to be careful not to replace OTHER ScrollViews.
// Let's replace ONLY `<ScrollView style={{ flex: 1, padding: 15 }}>`
newContent = newContent.replace(/<ScrollView style=\{\{ flex: 1, padding: 15 \}\}>/g, '<View style={{ flex: 1, padding: 15 }}>');
// But how to replace the closing `</ScrollView>`? 
// In each of these tabs, it's followed by `</View>` for the tab container.
// It's safer to just change `<ScrollView` to `<View` and `</ScrollView>` to `</View>` for these specific lines.

fs.writeFileSync('App_flatlist_temp.js', newContent);
console.log("Refactored to App_flatlist_temp.js");
