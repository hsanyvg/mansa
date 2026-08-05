const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const targetStr = "Timestamp\\r\\n} from 'firebase/firestore';";
const targetStr2 = "Timestamp\\n} from 'firebase/firestore';";
const replacement = "Timestamp,\n  getCountFromServer,\n  getAggregateFromServer,\n  sum,\n  orderBy,\n  startAfter\n} from 'firebase/firestore';";

if (content.includes("Timestamp\r\n} from 'firebase/firestore';")) {
  content = content.replace("Timestamp\r\n} from 'firebase/firestore';", replacement);
  console.log("Replaced using CRLF");
} else if (content.includes("Timestamp\n} from 'firebase/firestore';")) {
  content = content.replace("Timestamp\n} from 'firebase/firestore';", replacement);
  console.log("Replaced using LF");
} else {
  console.log("Could not find Timestamp to replace");
}

fs.writeFileSync('App.js', content);
