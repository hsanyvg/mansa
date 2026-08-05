const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Inject state variables for advanced search
const statesToInject = `  const [advSearchGov, setAdvSearchGov] = useState('');
  const [advSearchDate, setAdvSearchDate] = useState('');
  const [advSearchReceipt, setAdvSearchReceipt] = useState('');
  const [advSearchName, setAdvSearchName] = useState('');
  const [advSearchPhone, setAdvSearchPhone] = useState('');
  const [advSearchStatus, setAdvSearchStatus] = useState('');
`;

content = content.replace(
  /const \[ordersSearchQuery, setOrdersSearchQuery\] = useState\(''\);/,
  `const [ordersSearchQuery, setOrdersSearchQuery] = useState('');\n${statesToInject}`
);

fs.writeFileSync('App.js', content);
console.log("Injected advanced search states");
