const fs = require('fs');

const appFile = 'App.js';
let c = fs.readFileSync(appFile, 'utf8');

const stateInjection = `  const [baseProducts, setBaseProducts] = useState([]);
  const [pagesDb, setPagesDb] = useState([]);
  const [categoriesDb, setCategoriesDb] = useState([]);
  const [storesDb, setStoresDb] = useState([]);
  const [unitsDb, setUnitsDb] = useState([]);
  
  const [productsTab, setProductsTab] = useState('products'); // 'products', 'categories', 'pages'
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);
  const [addCategoryModalVisible, setAddCategoryModalVisible] = useState(false);
  const [addPageModalVisible, setAddPageModalVisible] = useState(false);`;

c = c.replace("  const [baseProducts, setBaseProducts] = useState([]);", stateInjection);

fs.writeFileSync(appFile, c);
console.log('State variables injected.');
