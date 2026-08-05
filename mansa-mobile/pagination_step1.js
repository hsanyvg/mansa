const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const targetImport = `  limit,
  runTransaction,
  Timestamp
} from 'firebase/firestore';`;

const replaceImport = `  limit,
  runTransaction,
  Timestamp,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  startAfter,
  orderBy
} from 'firebase/firestore';`;

content = content.replace(targetImport, replaceImport);
fs.writeFileSync('App.js', content);
console.log("Replaced imports successfully");
