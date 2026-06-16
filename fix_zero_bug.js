const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mansa-mobile', 'App.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Initial State
content = content.replace(
  `const [customTotalAmount, setCustomTotalAmount] = useState('');`,
  `const [customTotalAmount, setCustomTotalAmount] = useState(null);`
);

// 2. Clear calls
content = content.replace(/setCustomTotalAmount\(''\);/g, `setCustomTotalAmount(null);`);

// 3. totalAmount computation
// Old: const totalAmount = customTotalAmount !== '' ? (parseInt(customTotalAmount.replace(/[^0-9]/g, '')) || 0) : calculatedTotal;
content = content.replace(
  `const totalAmount = customTotalAmount !== '' ? (parseInt(customTotalAmount.replace(/[^0-9]/g, '')) || 0) : calculatedTotal;`,
  `const totalAmount = customTotalAmount !== null && customTotalAmount !== '' ? (parseInt(customTotalAmount.replace(/[^0-9]/g, '')) || 0) : calculatedTotal;`
);

// 4. TextInput block
const oldTextInput = `                    <TextInput
                      style={styles.totalAmountInput}
                      value={customTotalAmount !== '' ? customTotalAmount : String(calculatedTotal)}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        const cleanVal = text.replace(/[^0-9]/g, '');
                        setCustomTotalAmount(cleanVal);
                      }}
                      onEndEditing={() => {
                        if (customTotalAmount === '0' || customTotalAmount === null) {
                          setCustomTotalAmount(null);
                        }
                      }}
                    />`;

// I need to be careful with exact replacement. Let's use regex to replace the TextInput value and onChangeText.
content = content.replace(
  `value={customTotalAmount !== '' ? customTotalAmount : String(calculatedTotal)}`,
  `value={customTotalAmount !== null ? customTotalAmount : (calculatedTotal === 0 ? '' : String(calculatedTotal))}`
);

const oldOnChange = `onChangeText={(text) => {
                        const cleanVal = text.replace(/[^0-9]/g, '');
                        setCustomTotalAmount(cleanVal);
                      }}`;
const newOnChange = `onChangeText={(text) => {
                        let cleanVal = text.replace(/[^0-9]/g, '');
                        if (cleanVal.length > 1 && cleanVal.startsWith('0')) {
                          cleanVal = cleanVal.replace(/^0+/, '');
                          if (cleanVal === '') cleanVal = '0';
                        }
                        setCustomTotalAmount(cleanVal);
                      }}`;
content = content.replace(oldOnChange, newOnChange);

const oldOnEnd = `onEndEditing={() => {
                        if (customTotalAmount === '0' || customTotalAmount === null) {
                          setCustomTotalAmount(null);
                        }
                      }}`;
// wait, previously it was customTotalAmount === '0' || customTotalAmount === ''
content = content.replace(
  `if (customTotalAmount === '0' || customTotalAmount === '') {
                          setCustomTotalAmount('');`,
  `if (customTotalAmount === '0' || customTotalAmount === '') {
                          setCustomTotalAmount(null);`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed zero bug in mobile app.');
