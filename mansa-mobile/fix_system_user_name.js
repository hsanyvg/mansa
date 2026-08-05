const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// 1. Add loggedInSystemUserName state
if (!content.includes('const [loggedInSystemUserName')) {
    content = content.replace(
        "const [loggedInEmployeeId, setLoggedInEmployeeId] = useState('');",
        "const [loggedInEmployeeId, setLoggedInEmployeeId] = useState('');\n  const [loggedInSystemUserName, setLoggedInSystemUserName] = useState('');"
    );
}

// 2. Fetch sysUserSnap in onAuthStateChanged
const regexOnAuth = /try \{\s*const sysUserRef = doc\(db, 'users', data\.adminUid, 'system_users', usr\.uid\);\s*await updateDoc\(sysUserRef, \{ isOnline: true, lastActive: serverTimestamp\(\) \}\);\s*\} catch\(e\)\{\}/;
content = content.replace(regexOnAuth, `try {
                const sysUserRef = doc(db, 'users', data.adminUid, 'system_users', usr.uid);
                const sysUserSnap = await getDoc(sysUserRef);
                if (sysUserSnap.exists()) {
                   setLoggedInSystemUserName(sysUserSnap.data().name);
                }
                await updateDoc(sysUserRef, { isOnline: true, lastActive: serverTimestamp() });
             } catch(e){}`);

// 3. Update customerName in orderData
content = content.replace(
    /customerName: isEmployee \? \(employees\.find\(e => e\.id === loggedInEmployeeId\)\?\.name \|\| 'مجهول'\) : 'المدير'/g,
    "customerName: isEmployee ? (loggedInSystemUserName || employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير'"
);

// 4. Update systemUserName definition
content = content.replace(
    /const systemUserName = isEmployee \? \(employees\.find\(e => e\.id === loggedInEmployeeId\)\?\.name \|\| 'مجهول'\) : 'المدير';/g,
    "const systemUserName = isEmployee ? (loggedInSystemUserName || employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير';"
);

fs.writeFileSync('App.js', content);
console.log("Fixed systemUserName resolution!");
