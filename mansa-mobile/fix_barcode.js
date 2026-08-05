const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const barcodeInputStr = `            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>رقم الوصل</Text>
              <TextInput
                style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', color: isLightMode ? '#000' : '#fff', textAlign: 'right' }]}
                value={customReceiptNumber}
                onChangeText={setCustomReceiptNumber}
                placeholder="رقم الوصل (اختياري، يملأ عبر الباركود)"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>`;

// Note: Arabic characters might have encoding differences in node, so we use regex or partial match
const barcodeInputRegex = /<View style=\{styles\.inputContainer\}>\s*<Text style=\{styles\.inputLabel\}>[^<]*رقم الوصل[^<]*<\/Text>\s*<TextInput[^>]*value=\{customReceiptNumber\}[^>]*onChangeText=\{setCustomReceiptNumber\}[^>]*\/>\s*<\/View>/;

if (barcodeInputRegex.test(content)) {
  content = content.replace(barcodeInputRegex, '');
  console.log("Removed barcode input field");
} else {
  // Try substring fallback
  const fallbackRegex = /<View[^>]*>\s*<Text[^>]*>.*رقم الوصل.*<\/Text>\s*<TextInput[^>]*value=\{customReceiptNumber\}[^>]*\/>\s*<\/View>/g;
  content = content.replace(fallbackRegex, '');
  console.log("Removed barcode input field using fallback");
}

fs.writeFileSync('App.js', content);
