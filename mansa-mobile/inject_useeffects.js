const fs = require('fs');

const appFile = 'App.js';
let c = fs.readFileSync(appFile, 'utf8');

const useEffects = `
  // Fetch pages, categories, stores, units
  useEffect(() => {
    if (!user || !adminUid) {
      setPagesDb([]);
      setCategoriesDb([]);
      setStoresDb([]);
      setUnitsDb([]);
      return;
    }
    const unsubPages = onSnapshot(collection(db, 'users', adminUid, 'pages_stores'), (snapshot) => {
      setPagesDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubCats = onSnapshot(collection(db, 'users', adminUid, 'categories'), (snapshot) => {
      setCategoriesDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubStores = onSnapshot(collection(db, 'users', adminUid, 'stores'), (snapshot) => {
      setStoresDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubUnits = onSnapshot(collection(db, 'users', adminUid, 'units'), (snapshot) => {
      setUnitsDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubPages();
      unsubCats();
      unsubStores();
      unsubUnits();
    };
  }, [user, adminUid]);

`;

c = c.replace("// Fetch base products", useEffects + "  // Fetch base products");

fs.writeFileSync(appFile, c);
console.log('UseEffects injected.');
