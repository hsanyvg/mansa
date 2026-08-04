const fs = require('fs');

const appFile = 'App.js';
let c = fs.readFileSync(appFile, 'utf8');

if (!c.includes("@react-native-picker/picker")) {
  c = c.replace(
    "import DateTimePicker from '@react-native-community/datetimepicker';",
    "import DateTimePicker from '@react-native-community/datetimepicker';\nimport { Picker } from '@react-native-picker/picker';"
  );
  fs.writeFileSync(appFile, c);
  console.log('Picker import injected.');
} else {
  console.log('Picker import already exists.');
}
