const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

const r = /const \[completedSubTab, setCompletedSubTab\] = useState\('accounted'\);/;
const replacement = `const [completedSubTab, setCompletedSubTab] = useState('accounted');
  const [returnedSubTab, setReturnedSubTab] = useState('agent');
  const [postponedSearchQuery, setPostponedSearchQuery] = useState('');
  const [returnedSearchQuery, setReturnedSearchQuery] = useState('');`;

if (c.match(r) && !c.includes('returnedSubTab')) {
    c = c.replace(r, replacement);
    fs.writeFileSync('App.js', c);
    console.log('State variables added successfully.');
} else {
    console.log('Target not found or already added.');
}
