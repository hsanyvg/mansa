const fs = require('fs');
let c = fs.readFileSync('App.js', 'utf8');

const searchStr = "const [completedSubTab, setCompletedSubTab] = useState('accounted');";
const replacement = `const [completedSubTab, setCompletedSubTab] = useState('accounted');
  const [returnedSubTab, setReturnedSubTab] = useState('agent');
  const [postponedSearchQuery, setPostponedSearchQuery] = useState('');
  const [returnedSearchQuery, setReturnedSearchQuery] = useState('');`;

if (c.includes(searchStr) && !c.includes('returnedSubTab')) {
    c = c.replace(searchStr, replacement);
    fs.writeFileSync('App.js', c);
    console.log('State variables added successfully.');
} else {
    console.log('Target not found or already added.');
}
