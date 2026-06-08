import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Modal, 
  FlatList, 
  ActivityIndicator, 
  SafeAreaView, 
  Platform,
  StatusBar,
  Animated,
  Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, G, Polygon, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getDoc, 
  query as fsQuery, 
  where, 
  getDocs,
  limit,
  runTransaction
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Authentication State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Listen for Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Animated Neon Glow for Search Input
  const neonAnim = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(neonAnim, {
          toValue: 0.95,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(neonAnim, {
          toValue: 0.45,
          duration: 1800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [neonAnim]);

  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Firestore Databases
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [baseProducts, setBaseProducts] = useState([]);
  const [compositeProductsData, setCompositeProductsData] = useState([]);
  const [customersDb, setCustomersDb] = useState([]);
  const [ordersMatches, setOrdersMatches] = useState([]);

  // Stats
  const [todaySales, setTodaySales] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [todayOrdersCount, setTodayOrdersCount] = useState(0);
  const [rateThisMonth, setRateThisMonth] = useState(0);
  const [activeThisMonthCount, setActiveThisMonthCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [ofdOrdersCount, setOfdOrdersCount] = useState(0);
  const [deliveredTodayCount, setDeliveredTodayCount] = useState(0);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhone2, setCustomerPhone2] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [region, setRegion] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('كاش عند التوصيل');
  const [fbLoginId, setFbLoginId] = useState('');
  const [cart, setCart] = useState([]);
  const [customTotalAmount, setCustomTotalAmount] = useState('');
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');

  // Search State
  const [productSearch, setProductSearch] = useState('');
  const [phoneSearchMatches, setPhoneSearchMatches] = useState([]);

  // Custom Modal Visibilities
  const [empModalVisible, setEmpModalVisible] = useState(false);
  const [govModalVisible, setGovModalVisible] = useState(false);
  const [prodModalVisible, setProdModalVisible] = useState(false);
  const [alertModal, setAlertModal] = useState({ visible: false, message: '' });
  
  // Submit loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const governoratesList = [
    "بغداد", "البصرة", "نينوى (الموصل)", "أربيل", "النجف", "ذي قار (الناصرية)",
    "كركوك", "الأنبار (الرمادي)", "ديالى (بعقوبة)", "المثنى (السماوة)",
    "القادسية (الديوانية)", "ميسان (العمارة)", "واسط (الكوت)", "صلاح الدين (تكريت)",
    "دهوك", "السليمانية", "بابل (الحلة)", "كربلاء"
  ];

  // Load Saved Employee
  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const saved = await AsyncStorage.getItem('selectedEmployeeId');
        if (saved) setSelectedEmployeeId(saved);
      } catch (err) {
        console.log("AsyncStorage error:", err);
      }
    };
    loadEmployee();
  }, []);

  // Fetch Firestore Orders
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setTodaySales(0);
      setTodayOrdersCount(0);
      setActiveOrdersCount(0);
      setRateThisMonth(0);
      setActiveThisMonthCount(0);
      setNewOrdersCount(0);
      setOfdOrdersCount(0);
      setDeliveredTodayCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'orders'), (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort newest first
      allOrders.sort((a, b) => {
        const timeA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
        const timeB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
        return timeB - timeA;
      });
      setOrders(allOrders);

      // Compute statistics
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      let salesToday = 0;
      let countToday = 0;
      let activeCount = 0;
      let thisMonthTotal = 0;
      let thisMonthDelivered = 0;

      let countNew = 0;
      let countOfd = 0;
      let countDeliveredToday = 0;

      allOrders.forEach((order) => {
        const orderTime = order.date?.toDate ? order.date.toDate().getTime() : new Date(order.date).getTime();
        
        if (order.status === 'pending' || order.status === 'new') {
          countNew++;
        }
        if (order.status === 'ofd' || order.status === 'shipped') {
          countOfd++;
        }

        if (orderTime >= startOfToday) {
          countToday++;
          if (order.status === 'delivered') {
            salesToday += Number(order.totalAmount) || 0;
            countDeliveredToday++;
          }
        }

        if (order.status !== 'delivered' && order.status !== 'cancelled') {
          activeCount++;
        }

        if (orderTime >= startOfMonth) {
          if (order.status !== 'cancelled') {
            thisMonthTotal++;
            if (order.status === 'delivered') {
              thisMonthDelivered++;
            }
          }
        }
      });

      const rate = thisMonthTotal > 0 ? Math.round((thisMonthDelivered / thisMonthTotal) * 100) : 0;

      setTodaySales(salesToday);
      setTodayOrdersCount(countToday);
      setActiveOrdersCount(activeCount);
      setRateThisMonth(rate);
      setActiveThisMonthCount(thisMonthTotal);
      setNewOrdersCount(countNew);
      setOfdOrdersCount(countOfd);
      setDeliveredTodayCount(countDeliveredToday);
      setLoading(false);
    }, (err) => {
      console.log("Firestore orders load error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Fetch active employees
  useEffect(() => {
    if (!user) {
      setEmployees([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'employees'), (snapshot) => {
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(empData.filter((e) => e.isActive));
    });
    return () => unsub();
  }, [user]);

  // Fetch base products
  useEffect(() => {
    if (!user) {
      setBaseProducts([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'products'), (snapshot) => {
      setBaseProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  // Fetch composite products
  useEffect(() => {
    if (!user) {
      setCompositeProductsData([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'composite_products'), (snapshot) => {
      setCompositeProductsData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  // Fetch customers
  useEffect(() => {
    if (!user) {
      setCustomersDb([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'customers'), (snapshot) => {
      setCustomersDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  // Search orders archive for matching phone when customer phone length >= 10
  useEffect(() => {
    if (!user) {
      setOrdersMatches([]);
      return;
    }
    const phone = customerPhone.trim();
    if (phone.length < 10) {
      setOrdersMatches([]);
      return;
    }
    const searchOrders = async () => {
      try {
        const qPhone = fsQuery(
          collection(db, 'users', user.uid, 'orders'), 
          where('customerPhone', '>=', phone), 
          where('customerPhone', '<=', phone + '\uf8ff'),
          limit(3)
        );
        const snap = await getDocs(qPhone);
        const matches = [];
        snap.forEach(doc => {
          const d = doc.data();
          matches.push({
            id: 'ord-' + doc.id,
            name: d.customerName,
            phone: d.customerPhone,
            province: d.governorate,
            area: d.region,
            source: 'order'
          });
        });
        setOrdersMatches(matches);
      } catch (err) {
        console.log("Phone search error:", err);
      }
    };
    const timer = setTimeout(searchOrders, 300);
    return () => clearTimeout(timer);
  }, [customerPhone, user]);

  // Combine products and composite packages
  const productsList = useMemo(() => {
    const merged = [...baseProducts];
    compositeProductsData.forEach(cp => {
      let minBundles = Infinity;
      if (cp.composition && cp.composition.length > 0) {
        for (const comp of cp.composition) {
          const prod = baseProducts.find(p => p.id === comp.itemId);
          if (!prod) { minBundles = 0; break; }
          let totalStock = 0;
          if (prod.stock) {
            for (const storeId in prod.stock) {
              totalStock += prod.stock[storeId].quantity || 0;
            }
          }
          const canMake = Math.floor(totalStock / comp.quantityNeeded);
          if (canMake < minBundles) minBundles = canMake;
        }
      } else {
        minBundles = 0;
      }
      if (minBundles === Infinity) minBundles = 0;

      merged.push({
        id: cp.id,
        name: cp.name,
        barcode: '',
        units: [{ selling: cp.sellingPrice || 0, type: 'بكج' }],
        stock: { 'virtual_store': { quantity: minBundles, unit: 'بكج' } },
        isComposite: true,
        composition: cp.composition || []
      });
    });
    return merged;
  }, [baseProducts, compositeProductsData]);

  // Autocomplete phone list
  const filteredCustomersByPhone = useMemo(() => {
    const phoneQuery = customerPhone.trim();
    if (phoneQuery.length < 10) return [];
    const list = [];
    const matched = customersDb
      .filter(c => c.phone.includes(phoneQuery))
      .map(c => ({ ...c, source: 'customer' }));
    list.push(...matched);
    ordersMatches.forEach(om => {
      if (om.phone.includes(phoneQuery) && !list.find(i => i.phone === om.phone)) {
        list.push(om);
      }
    });
    return list;
  }, [customersDb, ordersMatches, customerPhone]);

  const handleSelectCustomer = (cust) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setGovernorate(cust.province || cust.governorate || '');
    setRegion(cust.area || cust.region || '');
    setPhoneSearchMatches([]);
  };

  const handleAddReplaceNote = () => {
    const tag = "استبدال هذا الطلب";
    setNotes(prev => prev.includes(tag) ? prev : prev ? `${prev}\n${tag}` : tag);
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        const price = (product.units && product.units.length > 0) ? product.units[0].selling : 0;
        return [...prev, { id: product.id, product, quantity: 1, unitPrice: price }];
      }
    });
    setProductSearch('');
    setProdModalVisible(false);
  };

  const updateCartQuantity = (id, qty) => {
    if (qty < 0) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const updateCartUnitPrice = (id, price) => {
    if (price < 0) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, unitPrice: price } : item));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const calculatedTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalAmount = customTotalAmount !== '' ? (parseInt(customTotalAmount.replace(/[^0-9]/g, '')) || 0) : calculatedTotal;

  useEffect(() => {
    setCustomTotalAmount('');
  }, [cart]);

  const filteredProductsSearch = productsList.filter(p => {
    if (!productSearch) return true;
    return p.name?.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.toLowerCase() === productSearch.toLowerCase();
  });

  const selectEmployee = async (emp) => {
    setSelectedEmployeeId(emp.id);
    setEmpModalVisible(false);
    try {
      await AsyncStorage.setItem('selectedEmployeeId', emp.id);
    } catch (err) {
      console.log(err);
    }
  };

  const isValidPhoneNumber = (phone) => {
    return /^(\+?\d{10,15})$/.test(phone.replace(/\s+/g, ''));
  };

  const handleAuthSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setAlertModal({ visible: true, message: 'يرجى ملء كافة الحقول.' });
      return;
    }
    if (authMode === 'register' && password !== confirmPassword) {
      setAlertModal({ visible: true, message: 'كلمتا المرور غير متطابقتين.' });
      return;
    }
    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const userId = userCredential.user.uid;
        
        // Initialize User Data
        const batch = writeBatch(db);
        
        // 1. Order Counter
        const counterRef = doc(db, 'users', userId, 'metadata', 'orderCounter');
        batch.set(counterRef, { lastId: 100000 });
        
        // 2. Default Employee
        const empRef = doc(collection(db, 'users', userId, 'employees'));
        batch.set(empRef, {
          name: 'المسؤول (الافتراضي)',
          isActive: true,
          createdAt: new Date().toISOString()
        });
        
        // 3. Default Product
        const prodRef = doc(collection(db, 'users', userId, 'products'));
        batch.set(prodRef, {
          name: 'منتج تجريبي 1',
          price: 25000,
          code: 'TEST-01',
          stock: {
            default_store: {
              quantity: 100,
              reserved: 0,
              unit: 'قطعة'
            }
          },
          units: [{ type: 'قطعة', count: 1 }]
        });
        
        await batch.commit();
      }
    } catch (err) {
      console.log("Auth error:", err);
      let errMsg = 'حدث خطأ أثناء الاتصال. يرجى المحاولة لاحقاً.';
      if (err.code === 'auth/invalid-email') errMsg = 'البريد الإلكتروني غير صالح.';
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') errMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      else if (err.code === 'auth/email-already-in-use') errMsg = 'البريد الإلكتروني مستخدم بالفعل.';
      else if (err.code === 'auth/weak-password') errMsg = 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).';
      else if (err.code === 'auth/invalid-credential') errMsg = 'بيانات الاعتماد المدخلة غير صحيحة.';
      setAlertModal({ visible: true, message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS !== 'web') {
      setAlertModal({ visible: true, message: 'تسجيل الدخول بجوجل مدعوم حالياً في نسخة الويب، يرجى استخدام البريد الإلكتروني على الجوال.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const userId = userCredential.user.uid;

      // If new user, seed their Firestore subcollections
      const counterRef = doc(db, 'users', userId, 'metadata', 'orderCounter');
      const counterSnap = await getDoc(counterRef);

      if (!counterSnap.exists()) {
        const batch = writeBatch(db);
        batch.set(counterRef, { lastId: 100000 });

        const empRef = doc(collection(db, 'users', userId, 'employees'));
        batch.set(empRef, {
          name: 'المسؤول (الافتراضي)',
          isActive: true,
          createdAt: new Date().toISOString()
        });

        const prodRef = doc(collection(db, 'users', userId, 'products'));
        batch.set(prodRef, {
          name: 'منتج تجريبي 1',
          price: 25000,
          code: 'TEST-01',
          stock: {
            default_store: {
              quantity: 100,
              reserved: 0,
              unit: 'قطعة'
            }
          },
          units: [{ type: 'قطعة', count: 1 }]
        });

        await batch.commit();
      }
    } catch (err) {
      console.log("Google Auth error:", err);
      let errMsg = 'حدث خطأ أثناء الاتصال بجوجل، يرجى المحاولة لاحقاً.';
      if (err.code === 'auth/popup-closed-by-user') {
        errMsg = 'تم إغلاق نافذة تسجيل الدخول.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'تسجيل الدخول بجوجل غير مفعّل في لوحة Firebase. يرجى تفعيله من قسم Authentication -> Sign-in method.';
      } else if (err.code === 'auth/unauthorized-domain') {
        errMsg = 'هذا النطاق (Domain) غير مصرح به في إعدادات Firebase لتسجيل الدخول بجوجل.';
      } else {
        errMsg = `${errMsg} (${err.code || err.message})`;
      }
      setAlertModal({ visible: true, message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFieldInvalid = (val, type = '') => {
    if (!hasAttemptedSubmit) return false;
    if (type === 'phone') return !isValidPhoneNumber(val);
    return val.trim() === '';
  };

  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);

    if (!user) {
      setAlertModal({ visible: true, message: 'يرجى تسجيل الدخول أولاً.' });
      return;
    }

    if (!selectedEmployeeId) {
      setAlertModal({ visible: true, message: 'يرجى اختيار الموظف أولاً.' });
      return;
    }

    if (
      customerName.trim() === '' ||
      !isValidPhoneNumber(customerPhone) ||
      governorate.trim() === '' ||
      region.trim() === ''
    ) {
      setAlertModal({ visible: true, message: 'يرجى ملء كافة البيانات المطلوبة للزبون.' });
      return;
    }

    if (cart.length === 0) {
      setAlertModal({ visible: true, message: 'سلة المشتريات فارغة!' });
      return;
    }

    setIsSubmitting(true);
    const userId = user.uid;

    try {
      // Generate sequential transaction numeric ID
      const counterRef = doc(db, 'users', userId, 'metadata', 'orderCounter');
      const nextId = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let currentId = 100000;
        if (counterSnap.exists()) {
          currentId = counterSnap.data().lastId;
        }
        const newId = currentId + 1;
        transaction.set(counterRef, { lastId: newId }, { merge: true });
        return newId;
      });

      const batch = writeBatch(db);
      const newOrderRef = doc(db, 'users', userId, 'orders', nextId.toString());
      const emp = employees.find(e => e.id === selectedEmployeeId);

      let isOrderBackordered = false;

      // Check stock availability
      for (const item of cart) {
        const productData = item.product;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', userId, 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let totalAvailable = 0;
              Object.values(rawData.stock || {}).forEach((s) => {
                const uMul = rawData.units?.find((u) => u.type === s.unit)?.count || 1;
                totalAvailable += ((Number(s.quantity) || 0) - (Number(s.reserved) || 0)) * uMul;
              });
              if (totalAvailable < component.quantityNeeded * item.quantity) {
                isOrderBackordered = true;
              }
            }
          }
        } else {
          const prodRef = doc(db, 'users', userId, 'products', item.product.id);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let totalAvailable = 0;
            Object.values(prodData.stock || {}).forEach((s) => {
              const uMul = prodData.units?.find((u) => u.type === s.unit)?.count || 1;
              totalAvailable += ((Number(s.quantity) || 0) - (Number(s.reserved) || 0)) * uMul;
            });
            if (totalAvailable < item.quantity) {
              isOrderBackordered = true;
            }
          }
        }
      }

      const orderData = {
        employeeId: selectedEmployeeId,
        employeeName: emp?.name || 'مجهول',
        customerName: customerName,
        customerPhone: customerPhone,
        customerPhone2: customerPhone2,
        governorate: governorate,
        region: region,
        notes: notes,
        paymentMethod: paymentMethod,
        fbLoginId: fbLoginId,
        totalAmount: totalAmount,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          isComposite: item.product.isComposite || false,
          composition: item.product.composition || null
        })),
        date: serverTimestamp(),
        status: isOrderBackordered ? 'backordered' : 'pending',
        is_settled: false
      };

      batch.set(newOrderRef, orderData);

      // Reserve stock
      for (const item of cart) {
        const productData = item.product;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', userId, 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let stock = { ...rawData.stock };
              let remainingToReserve = component.quantityNeeded * item.quantity;
              const firstStoreKey = Object.keys(stock)[0] || 'default_store';
              if (!stock[firstStoreKey]) {
                stock[firstStoreKey] = { quantity: 0, reserved: remainingToReserve, unit: rawData.units?.[0]?.type || 'قطعة' };
              } else {
                stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + remainingToReserve;
              }
              batch.update(rawProdRef, { stock });
            }
          }
        } else {
          const prodRef = doc(db, 'users', userId, 'products', item.product.id);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let stock = { ...prodData.stock };
            let remainingToReserve = item.quantity;
            const firstStoreKey = Object.keys(stock)[0] || 'default_store';
            if (!stock[firstStoreKey]) {
              stock[firstStoreKey] = { quantity: 0, reserved: remainingToReserve, unit: prodData.units?.[0]?.type || 'قطعة' };
            } else {
              stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + remainingToReserve;
            }
            batch.update(prodRef, { stock });
          }
        }
      }

      await batch.commit();

      // Trigger Webhook
      try {
        const orderId = newOrderRef.id;
        for (const item of cart) {
          fetch('https://management-easy-order.firebaseapp.com/api/webhooks/meta-purchase', { // Absolute url since native has no next.js server context
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: item.id,
              value: item.quantity * item.unitPrice,
              currency: 'IQD',
              phone: customerPhone,
              firstName: customerName.split(' ')[0] || customerName,
              state: governorate,
              externalId: orderId,
              fb_login_id: fbLoginId,
              userId: userId
            })
          }).catch(err => console.log("Webhook fail:", err));
        }
      } catch (webhookErr) {
        console.log("Failed to trigger webhook:", webhookErr);
      }

      setAlertModal({ visible: true, message: 'تم حفظ الطلب وتحديث المخزون بنجاح!' });
      
      // Reset Form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerPhone2('');
      setGovernorate('');
      setRegion('');
      setNotes('');
      setFbLoginId('');
      setCart([]);
      setCustomTotalAmount('');
      setHasAttemptedSubmit(false);

    } catch (err) {
      console.log("Submit order native error:", err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedEmployeeName = employees.find(e => e.id === selectedEmployeeId)?.name || 'اختر الموظف 👤';

  const getArabicDate = () => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const now = new Date();
    const dayName = days[now.getDay()];
    const dayNum = now.getDate();
    const monthName = months[now.getMonth()];
    return `${dayName} ${dayNum} ${monthName}`;
  };

  const completedCount = orders.filter(o => o.status === 'delivered').length;
  const activeOrdersCountForTab = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'returned').length;
  const cancelledCount = orders.filter(o => o.status === 'cancelled' || o.status === 'returned').length;

  const renderReportsIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Rect x="3" y="13" width="4" height="7" rx="1" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Rect x="10" y="4" width="4" height="16" rx="1" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Rect x="17" y="9" width="4" height="11" rx="1" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            
            <Rect x="3" y="13" width="4" height="7" rx="1" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Rect x="10" y="4" width="4" height="16" rx="1" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Rect x="17" y="9" width="4" height="11" rx="1" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Rect x="3" y="13" width="4" height="7" rx="1" stroke={strokeColor} strokeWidth={2} />
        <Rect x="10" y="4" width="4" height="16" rx="1" stroke={strokeColor} strokeWidth={2} />
        <Rect x="17" y="9" width="4" height="11" rx="1" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  const renderProfileIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Circle cx="12" cy="7" r="4" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            
            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Circle cx="12" cy="7" r="4" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={strokeColor} strokeWidth={2} />
        <Circle cx="12" cy="7" r="4" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  const renderOrdersIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Path d="M2 9h3" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M1 13h3" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M6 6h9v9H6z" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M15 9h4l3 3v3h-7z" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Circle cx="9" cy="17.5" r="2" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Circle cx="18" cy="17.5" r="2" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            
            <Path d="M2 9h3" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Path d="M1 13h3" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Path d="M6 6h9v9H6z" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Path d="M15 9h4l3 3v3h-7z" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Circle cx="9" cy="17.5" r="2" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Circle cx="18" cy="17.5" r="2" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Path d="M2 9h3" stroke={strokeColor} strokeWidth={2} />
        <Path d="M1 13h3" stroke={strokeColor} strokeWidth={2} />
        <Path d="M6 6h9v9H6z" stroke={strokeColor} strokeWidth={2} />
        <Path d="M15 9h4l3 3v3h-7z" stroke={strokeColor} strokeWidth={2} />
        <Circle cx="9" cy="17.5" r="2" stroke={strokeColor} strokeWidth={2} />
        <Circle cx="18" cy="17.5" r="2" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  const renderSettingsIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    const pathD = "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z";
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Circle cx="12" cy="12" r="3" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d={pathD} stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            
            <Circle cx="12" cy="12" r="3" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Path d={pathD} stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Circle cx="12" cy="12" r="3" stroke={strokeColor} strokeWidth={2} />
        <Path d={pathD} stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>جاري التحقق من الهوية...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a12" />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authHeaderContainer}>
            <Text style={styles.authTitle}>منصة منسا</Text>
            <Text style={styles.authSubtitle}>نظام إدارة المبيعات والمخازن الذكي</Text>
          </View>

          <View style={styles.authCard}>
            <Text style={styles.authCardTitle}>
              {authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>البريد الإلكتروني</Text>
              <TextInput
                style={styles.authInput}
                placeholder="example@email.com"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>كلمة المرور</Text>
              <TextInput
                style={styles.authInput}
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {authMode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>تأكيد كلمة المرور</Text>
                <TextInput
                  style={styles.authInput}
                  placeholder="••••••••"
                  placeholderTextColor="#64748b"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            )}

            <TouchableOpacity 
              style={styles.authSubmitBtn}
              onPress={handleAuthSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.authSubmitBtnText}>
                  {authMode === 'login' ? '💾 دخول' : '✨ إنشاء حساب'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.authSeparatorContainer}>
              <View style={styles.authSeparatorLine} />
              <Text style={styles.authSeparatorText}>أو</Text>
              <View style={styles.authSeparatorLine} />
            </View>

            <TouchableOpacity 
              style={styles.authGoogleBtn}
              onPress={handleGoogleSignIn}
              disabled={isSubmitting}
            >
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </Svg>
              <Text style={styles.authGoogleBtnText}>تسجيل الدخول بواسطة Google</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.authToggleBtn}
              onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              <Text style={styles.authToggleText}>
                {authMode === 'login' ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Alert Modal */}
        <Modal
          visible={alertModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setAlertModal({ visible: false, message: '' })}
        >
          <View style={styles.alertBg}>
            <View style={styles.alertContent}>
              <Text style={styles.alertMessage}>{alertModal.message}</Text>
              <TouchableOpacity
                style={styles.alertBtn}
                onPress={() => setAlertModal({ visible: false, message: '' })}
              >
                <Text style={styles.alertBtnText}>حسناً</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>جاري تحميل منصة منسا...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d12" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>منصة منسا - الجوال</Text>
        <TouchableOpacity 
          style={styles.empBadgeBtn} 
          onPress={() => setEmpModalVisible(true)}
        >
          <Text style={styles.empBadgeText} numberOfLines={1}>
            👤 {selectedEmployeeName}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Tab View */}
      {activeTab === 'dashboard' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
          {/* Dashboard Stats */}
          <Text style={styles.gridTitle}>شبكة الإحصائيات السريعة</Text>
          
          <View style={styles.statsGridRow}>
            {/* Card 1: طلبات جديدة */}
            <View style={styles.newStatCard}>
              <Text style={styles.newStatLabel}>طلبات جديدة</Text>
              <View style={styles.newStatContent}>
                <Text style={styles.newStatValue}>{newOrdersCount}</Text>
                <View style={[styles.newStatIconBg, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <Text style={[styles.newStatIcon, { color: '#c084fc' }]}>🛍️</Text>
                </View>
              </View>
            </View>

            {/* Card 2: طلبات قيد التوصيل */}
            <View style={styles.newStatCard}>
              <Text style={styles.newStatLabel}>طلبات قيد التوصيل</Text>
              <View style={styles.newStatContent}>
                <Text style={styles.newStatValue}>{ofdOrdersCount}</Text>
                <View style={[styles.newStatIconBg, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                  <Text style={[styles.newStatIcon, { color: '#06b6d4' }]}>🚚</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statsGridRow}>
            {/* Card 3: إجمالي العائدات اليوم */}
            <View style={styles.newStatCard}>
              <Text style={styles.newStatLabel}>إجمالي العائدات اليوم</Text>
              <View style={styles.newStatContent}>
                <Text style={styles.newStatValue}>{todaySales.toLocaleString()} د.ع</Text>
                <View style={[styles.newStatIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Text style={[styles.newStatIcon, { color: '#10b981' }]}>💵</Text>
                </View>
              </View>
            </View>

            {/* Card 4: طلبات واصلة */}
            <View style={styles.newStatCard}>
              <Text style={styles.newStatLabel}>طلبات واصلة</Text>
              <View style={styles.newStatContent}>
                <Text style={styles.newStatValue}>{deliveredTodayCount}</Text>
                <View style={[styles.newStatIconBg, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <Text style={[styles.newStatIcon, { color: '#c084fc' }]}>✅</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.gaugeCard}>
            <Text style={styles.gaugeCardHeader}>طلبات تم تسليمها بنجاح</Text>
            
            <View style={styles.gaugeContainer}>
              <Svg viewBox="0 0 200 130" style={styles.gaugeSvg}>
                <Defs>
                  <LinearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#f3e8ff" />
                    <Stop offset="50%" stopColor="#a435e8" />
                    <Stop offset="100%" stopColor="#49159e" />
                  </LinearGradient>
                </Defs>

                {/* Track path */}
                <Path d="M 25 100 A 75 75 0 0 1 175 100" 
                      fill="none" stroke="#2a2a35" strokeWidth="16" />

                {/* Active progress path */}
                <Path 
                  d="M 25 100 A 75 75 0 0 1 175 100" 
                  fill="none" 
                  stroke="url(#purpleGradient)" 
                  strokeWidth="16" 
                  strokeDasharray="235.62" 
                  strokeDashoffset={235.62 - (235.62 * rateThisMonth) / 100} 
                />

                {/* Concentric rings */}
                <Circle cx="100" cy="100" r="40" fill="none" stroke="#a855f7" strokeWidth="1" opacity={0.3} />
                <Circle cx="100" cy="100" r="30" fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.5" />
                <Circle cx="100" cy="100" r="20" fill="none" stroke="#a855f7" strokeWidth="1.5" opacity="0.8" />

                {/* Needle group */}
                <G 
                  x={100}
                  y={100}
                  rotation={(rateThisMonth / 100) * 180 - 90}
                >
                  <Polygon points="-9,0 9,0 0,-83" 
                           fill="rgba(192, 132, 252, 0.4)" 
                           stroke="#f3e8ff" strokeWidth={1.5} />
                </G>

                {/* Pivot center */}
                <Circle cx="100" cy="100" r="12" fill="#4b04b5" stroke="#d8b4fe" strokeWidth="3" />
                <Circle cx="100" cy="100" r="4" fill="#ffffff" />
              </Svg>
            </View>

            <Text style={styles.gaugeValue}>{rateThisMonth}%</Text>

            <Text style={styles.gaugeDescription}>
              📦 {activeThisMonthCount} طلب نشط هذا الشهر
            </Text>
          </View>

          {/* Recent Orders */}
          <View style={styles.bigCard}>
            <Text style={styles.cardTitle}>🕒 آخر الإدخالات والطلبات</Text>
            {orders.slice(0, 10).map((ord) => (
              <View key={ord.id} style={styles.orderItem}>
                <View style={styles.orderLeft}>
                  <Text style={styles.orderCustName}>{ord.customerName}</Text>
                  <Text style={styles.orderMetaText}>{ord.customerPhone} | {ord.governorate}</Text>
                </View>
                <View style={styles.orderRight}>
                  <Text style={styles.orderAmountText}>{Number(ord.totalAmount || 0).toLocaleString()} د.ع</Text>
                  <View style={[
                    styles.statusBadge,
                    ord.status === 'delivered' ? styles.badgeDelivered :
                    ord.status === 'returned' ? styles.badgeReturned :
                    ord.status === 'cancelled' ? styles.badgeCancelled :
                    ord.status === 'backordered' ? styles.badgeBackordered : styles.badgePending
                  ]}>
                    <Text style={styles.statusBadgeText}>
                      {ord.status === 'delivered' ? 'واصل' :
                       ord.status === 'returned' ? 'راجع' :
                       ord.status === 'cancelled' ? 'ملغي' :
                       ord.status === 'backordered' ? 'بانتظار المخزون' : 'قيد الانتظار'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {orders.length === 0 && (
              <Text style={styles.emptyText}>لا توجد طلبات مسجلة حالياً.</Text>
            )}
          </View>
        </ScrollView>
      ) : activeTab === 'entry' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding} keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            
            {/* Input Name */}
            <View style={styles.formGroup}>
              <TextInput 
                style={[styles.input, isFieldInvalid(customerName) && styles.inputError]}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="اسم الزبون *"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>

            {/* Input Phone */}
            <View style={styles.formGroup}>
              <TextInput 
                style={[styles.input, isFieldInvalid(customerPhone, 'phone') && styles.inputError]}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="رقم هاتف الزبون *"
                keyboardType="phone-pad"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              {filteredCustomersByPhone.length > 0 && (
                <View style={styles.phoneDropdown}>
                  {filteredCustomersByPhone.map((c) => (
                    <TouchableOpacity 
                      key={c.id} 
                      style={styles.dropdownItem}
                      onPress={() => handleSelectCustomer(c)}
                    >
                      <Text style={styles.dropdownItemTitle}>{c.name}</Text>
                      <Text style={styles.dropdownItemSubtitle}>{c.phone} | {c.province || c.governorate}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Input Phone 2 */}
            <View style={styles.formGroup}>
              <TextInput 
                style={styles.input}
                value={customerPhone2}
                onChangeText={setCustomerPhone2}
                placeholder="رقم هاتف ثاني للزبون (اختياري)"
                keyboardType="phone-pad"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>

            {/* Governorate Modal Selector */}
            <View style={styles.formGroup}>
              <TouchableOpacity 
                style={[styles.modalTrigger, isFieldInvalid(governorate) && styles.inputError]}
                onPress={() => setGovModalVisible(true)}
              >
                <Text style={governorate ? styles.triggerText : styles.triggerPlaceholder}>
                  {governorate || "المحافظة *"}
                </Text>
                <Text style={styles.triggerArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Region */}
            <View style={styles.formGroup}>
              <TextInput 
                style={[styles.input, isFieldInvalid(region) && styles.inputError]}
                value={region}
                onChangeText={setRegion}
                placeholder="المنطقة / العنوان بالتفصيل *"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>

            {/* Cart Section */}
            <View style={styles.cartSection}>
              <View style={styles.cartHeaderRow}>
                <Text style={styles.cartLabel}>🛒 سلة منتجات الطلب</Text>
                <TouchableOpacity 
                  style={styles.addProdBtn}
                  onPress={() => setProdModalVisible(true)}
                >
                  <Text style={styles.addProdBtnText}>+ إضافة منتج</Text>
                </TouchableOpacity>
              </View>

              {/* Cart Items List */}
              {cart.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.cartItemLeft}>
                    <Text style={styles.cartItemName}>{item.product.name}</Text>
                    <View style={styles.cartPriceContainer}>
                      <TextInput
                        style={styles.cartPriceInput}
                        value={item.unitPrice === 0 ? '' : String(item.unitPrice)}
                        keyboardType="numeric"
                        onChangeText={(text) => {
                          const val = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                          updateCartUnitPrice(item.id, val);
                        }}
                        onEndEditing={() => {
                          if (item.unitPrice === undefined || item.unitPrice === null || isNaN(item.unitPrice)) {
                            updateCartUnitPrice(item.id, 0);
                          }
                        }}
                      />
                      <Text style={styles.currencyLabel}>د.ع</Text>
                      <Text style={styles.multiplierLabel}>×</Text>
                    </View>
                  </View>
                  <View style={styles.cartQtyControls}>
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => updateCartQuantity(item.id, Math.max(1, item.quantity - 1))}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.cartQtyInput}
                      value={item.quantity === 0 ? '' : String(item.quantity)}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        const val = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                        updateCartQuantity(item.id, val);
                      }}
                      onEndEditing={() => {
                        if (!item.quantity || item.quantity < 1) {
                          updateCartQuantity(item.id, 1);
                        }
                      }}
                    />
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => updateCartQuantity(item.id, item.quantity + 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.removeBtn} 
                      onPress={() => removeFromCart(item.id)}
                    >
                      <Text style={styles.removeBtnText}>✖</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {cart.length > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>المجموع النهائي:</Text>
                  <View style={styles.totalInputRow}>
                    <TextInput
                      style={styles.totalAmountInput}
                      value={customTotalAmount !== '' ? customTotalAmount : String(calculatedTotal)}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        const cleanVal = text.replace(/[^0-9]/g, '');
                        setCustomTotalAmount(cleanVal);
                      }}
                      onEndEditing={() => {
                        if (customTotalAmount === '0' || customTotalAmount === '') {
                          setCustomTotalAmount('');
                        }
                      }}
                    />
                    <Text style={styles.totalCurrencyLabel}>د.ع</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyCartText}>السلة فارغة. اضغط على "+ إضافة منتج" للبدء.</Text>
              )}
            </View>



            {/* Payment Method */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>طريقة الدفع</Text>
              <View style={styles.paymentSelector}>
                {['كاش عند التوصيل', 'حوالة زين كاش', 'حوالة بنكية'].map((method) => (
                  <TouchableOpacity 
                    key={method}
                    style={[styles.paymentBtn, paymentMethod === method && styles.paymentBtnActive]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text style={[styles.paymentBtnText, paymentMethod === method && styles.paymentBtnTextActive]}>
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <TouchableOpacity style={styles.replaceBtn} onPress={handleAddReplaceNote}>
                  <Text style={styles.replaceBtnText}>🔄 استبدال</Text>
                </TouchableOpacity>
              </View>
              <TextInput 
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="ملاحظات الطلب..."
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>💾 حفظ وإرسال الطلب</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'account' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
          {/* Account Tab Content */}
          <View style={styles.tabHeaderCard}>
            <Text style={styles.tabHeaderTitle}>👤 ملف الموظف التعريفي</Text>
          </View>
          <View style={styles.statCardBig}>
            <Text style={styles.profileLabel}>الموظف الحالي:</Text>
            <Text style={styles.profileValue}>{selectedEmployeeName}</Text>
            <Text style={styles.profileDescription}>
              مسؤول عن إدخال الطلبات الحالية وتعديلها.
            </Text>
            <TouchableOpacity 
              style={styles.profileSwitchBtn} 
              onPress={() => setEmpModalVisible(true)}
            >
              <Text style={styles.profileSwitchBtnText}>🔄 تغيير الموظف</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabHeaderCard}>
            <Text style={styles.tabHeaderTitle}>🔐 حساب المستخدم</Text>
          </View>
          <View style={styles.statCardBig}>
            <Text style={styles.profileLabel}>البريد الإلكتروني:</Text>
            <Text style={styles.profileValue}>{user?.email}</Text>
            <Text style={styles.profileDescription}>
              هذا هو حساب المنصة المسجل دخولك به حالياً.
            </Text>
            <TouchableOpacity 
              style={[styles.profileSwitchBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444' }]} 
              onPress={() => {
                signOut(auth).catch(err => console.log("Signout error:", err));
              }}
            >
              <Text style={[styles.profileSwitchBtnText, { color: '#ef4444' }]}>🚪 تسجيل الخروج</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'orders' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
          {/* Header row in screenshot */}
          <View style={styles.ordersHeaderRow}>
            {/* Left: User button */}
            <TouchableOpacity 
              style={styles.headerIconButton}
              onPress={() => setEmpModalVisible(true)}
            >
              <Text style={styles.headerIconText}>👤</Text>
            </TouchableOpacity>

            {/* Center: Title & Date */}
            <View style={styles.headerCenter}>
              <Text style={styles.ordersHeaderTitle}>الطلبات</Text>
              <Text style={styles.ordersHeaderDate}>{getArabicDate()}</Text>
            </View>

            {/* Right: Bell button */}
            <TouchableOpacity 
              style={styles.headerIconButton}
              onPress={() => setAlertModal({ visible: true, message: 'لا توجد إشعارات جديدة حالياً.' })}
            >
              <Text style={styles.headerIconText}>🔔</Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Filter Control */}
          <View style={styles.segmentedControl}>
            <TouchableOpacity 
              style={[styles.segmentBtn, ordersFilter === 'completed' && styles.segmentBtnActive]}
              onPress={() => setOrdersFilter('completed')}
            >
              <Text style={[styles.segmentBtnText, ordersFilter === 'completed' && styles.segmentBtnTextActive]}>مكتملة</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.segmentBtn, ordersFilter === 'active' && styles.segmentBtnActive]}
              onPress={() => setOrdersFilter('active')}
            >
              <Text style={[styles.segmentBtnText, ordersFilter === 'active' && styles.segmentBtnTextActive]}>جارية</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.segmentBtn, ordersFilter === 'all' && styles.segmentBtnActive]}
              onPress={() => setOrdersFilter('all')}
            >
              <Text style={[styles.segmentBtnText, ordersFilter === 'all' && styles.segmentBtnTextActive]}>الكل</Text>
            </TouchableOpacity>
          </View>

          {/* Three Counters Cards */}
          <View style={styles.countersRow}>
            {/* Card 3: ملغي */}
            <View style={styles.counterCard}>
              <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.counterNumber}>{cancelledCount}</Text>
              <Text style={styles.counterLabel}>ملغي</Text>
            </View>

            {/* Card 2: جارٍ */}
            <View style={styles.counterCard}>
              <View style={[styles.statusDot, { backgroundColor: '#fb923c' }]} />
              <Text style={styles.counterNumber}>{activeOrdersCountForTab}</Text>
              <Text style={styles.counterLabel}>جارٍ</Text>
            </View>

            {/* Card 1: مكتمل */}
            <View style={styles.counterCard}>
              <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.counterNumber}>{completedCount}</Text>
              <Text style={styles.counterLabel}>مكتمل</Text>
            </View>
          </View>

          {/* Search Input with Animated Spinning Neon Border & Pulsing Glow */}
          {/* Shadow wrapper is separate from overflow:hidden clip so corners render correctly */}
          <Animated.View style={[styles.neonSearchShadowWrapper, { shadowOpacity: neonAnim.interpolate({ inputRange: [0.45, 0.95], outputRange: [0.4, 0.8] }) }]}>
            {/* Clip box handles borderRadius + overflow:hidden */}
            <View style={styles.neonSearchContainer}>
              {/* Spinning Svg Background */}
              <Animated.View style={[styles.neonSearchSpinBg, { transform: [{ rotate: spin }] }]}>
                <Svg width={360} height={360} viewBox="0 0 360 360">
                  <Defs>
                    <LinearGradient id="neonSpinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#ff00aa" />
                      <Stop offset="35%" stopColor="#a855f7" />
                      <Stop offset="70%" stopColor="#00f0ff" />
                      <Stop offset="100%" stopColor="#ff00aa" />
                    </LinearGradient>
                  </Defs>
                  <Circle cx={180} cy={180} r={175} fill="url(#neonSpinGrad)" />
                </Svg>
              </Animated.View>

              {/* The Inner Box Cover */}
              <View style={styles.neonSearchInner}>
                <View style={styles.neonSearchBtn}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#e9d5ff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx="11" cy="11" r="8" />
                    <Path d="m21 21-4.3-4.3" />
                  </Svg>
                </View>
                <TextInput
                  style={styles.neonSearchInput}
                  value={ordersSearchQuery}
                  onChangeText={setOrdersSearchQuery}
                  placeholder="ابحث بالاسم، الهاتف، المحافظة أو رقم الطلب..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
            </View>
          </Animated.View>

          {/* Section: أحدث الطلبات */}
          <Text style={styles.sectionHeaderTitle}>أحدث الطلبات</Text>
          
          {/* Neon spinning border card wrapper */}
          <Animated.View style={[styles.neonCardShadow, { shadowOpacity: neonAnim.interpolate({ inputRange: [0.45, 0.95], outputRange: [0.3, 0.7] }) }]}>
            <View style={styles.neonCardClip}>
              {/* Spinning gradient background */}
              <Animated.View style={[styles.neonCardSpinBg, { transform: [{ rotate: spin }] }]}>
                <Svg width={600} height={600} viewBox="0 0 600 600">
                  <Defs>
                    <LinearGradient id="neonCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#ff00aa" />
                      <Stop offset="30%" stopColor="#a855f7" />
                      <Stop offset="60%" stopColor="#00f0ff" />
                      <Stop offset="85%" stopColor="#a855f7" />
                      <Stop offset="100%" stopColor="#ff00aa" />
                    </LinearGradient>
                  </Defs>
                  <Circle cx={300} cy={300} r={295} fill="url(#neonCardGrad)" />
                </Svg>
              </Animated.View>

              {/* Inner dark content card */}
              <View style={styles.neonCardInner}>
                {orders
                  .filter((ord) => {
                    if (ordersFilter === 'completed') return ord.status === 'delivered';
                    if (ordersFilter === 'active') return ord.status !== 'delivered' && ord.status !== 'cancelled' && ord.status !== 'returned';
                    return true;
                  })
                  .filter((ord) => {
                    if (!ordersSearchQuery.trim()) return true;
                    const query = ordersSearchQuery.toLowerCase().trim();
                    const name = (ord.customerName || '').toLowerCase();
                    const phone = (ord.customerPhone || '').toLowerCase();
                    const phone2 = (ord.customerPhone2 || '').toLowerCase();
                    const gov = (ord.governorate || '').toLowerCase();
                    const id = (ord.id || '').toLowerCase();
                    return name.includes(query) || phone.includes(query) || phone2.includes(query) || gov.includes(query) || id.includes(query);
                  })
                  .map((ord) => (
                    <View key={ord.id} style={styles.orderItem}>
                      <View style={styles.orderLeft}>
                        <Text style={styles.orderCustName}>{ord.customerName}</Text>
                        <Text style={styles.orderMetaText}>{ord.customerPhone} | {ord.governorate}</Text>
                      </View>
                      <View style={styles.orderRight}>
                        <Text style={styles.orderAmountText}>{Number(ord.totalAmount || 0).toLocaleString()} د.ع</Text>
                        <View style={[
                          styles.statusBadge,
                          ord.status === 'delivered' ? styles.badgeDelivered :
                          ord.status === 'returned' ? styles.badgeReturned :
                          ord.status === 'cancelled' ? styles.badgeCancelled :
                          ord.status === 'backordered' ? styles.badgeBackordered : styles.badgePending
                        ]}>
                          <Text style={styles.statusBadgeText}>
                            {ord.status === 'delivered' ? 'واصل' :
                             ord.status === 'returned' ? 'راجع' :
                             ord.status === 'cancelled' ? 'ملغي' :
                             ord.status === 'backordered' ? 'بانتظار المخزون' : 'قيد الانتظار'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                {orders
                  .filter((ord) => {
                    if (ordersFilter === 'completed') return ord.status === 'delivered';
                    if (ordersFilter === 'active') return ord.status !== 'delivered' && ord.status !== 'cancelled' && ord.status !== 'returned';
                    return true;
                  })
                  .filter((ord) => {
                    if (!ordersSearchQuery.trim()) return true;
                    const query = ordersSearchQuery.toLowerCase().trim();
                    const name = (ord.customerName || '').toLowerCase();
                    const phone = (ord.customerPhone || '').toLowerCase();
                    const phone2 = (ord.customerPhone2 || '').toLowerCase();
                    const gov = (ord.governorate || '').toLowerCase();
                    const id = (ord.id || '').toLowerCase();
                    return name.includes(query) || phone.includes(query) || phone2.includes(query) || gov.includes(query) || id.includes(query);
                  }).length === 0 && (
                  <Text style={styles.emptyText}>لا توجد نتائج مطابقة للبحث.</Text>
                )}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
          {/* Settings Tab Content */}
          <View style={styles.tabHeaderCard}>
            <Text style={styles.tabHeaderTitle}>⚙️ إعدادات النظام</Text>
          </View>
          
          <View style={styles.statCardBig}>
            <Text style={styles.settingLabel}>حالة الاتصال بـ Firebase:</Text>
            <Text style={[styles.settingValue, { color: '#10b981' }]}>🟢 متصل ويعمل بشكل سليم</Text>
          </View>

          <View style={styles.statCardBig}>
            <Text style={styles.settingLabel}>إصدار التطبيق:</Text>
            <Text style={styles.settingValue}>v1.2.0 (رقم البناء 48)</Text>
          </View>
          
          <View style={styles.statCardBig}>
            <Text style={styles.settingLabel}>عن منصة منسا:</Text>
            <Text style={styles.settingValue}>نظام إدارة ومتابعة الطلبات اللوجستية المتكامل للجوال.</Text>
          </View>
        </ScrollView>
      )}

      {/* Bottom Tabs Navigation */}
      <View style={styles.bottomNav}>
        {/* Tab 1: التقارير */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          {renderReportsIcon(activeTab === 'dashboard')}
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>التقارير</Text>
        </TouchableOpacity>
        
        {/* Tab 2: حسابي */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'account' && styles.navItemActive]}
          onPress={() => setActiveTab('account')}
        >
          {renderProfileIcon(activeTab === 'account')}
          <Text style={[styles.navText, activeTab === 'account' && styles.navTextActive]}>حسابي</Text>
        </TouchableOpacity>
        
        {/* Tab 3: إضافة طلب (الزر العائم بالمنتصف) */}
        <View style={styles.centerNavWrapper}>
          <TouchableOpacity 
            style={[styles.centerNavBtn, activeTab === 'entry' && styles.centerNavBtnActive]}
            onPress={() => setActiveTab('entry')}
          >
            <Text style={styles.centerNavIcon}>+</Text>
          </TouchableOpacity>
          <Text style={[styles.navText, { marginTop: 4 }, activeTab === 'entry' && styles.navTextActive]}>إضافة طلب</Text>
        </View>

        {/* Tab 4: طلبات */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'orders' && styles.navItemActive]}
          onPress={() => setActiveTab('orders')}
        >
          {renderOrdersIcon(activeTab === 'orders')}
          <Text style={[styles.navText, activeTab === 'orders' && styles.navTextActive]}>طلبات</Text>
        </TouchableOpacity>

        {/* Tab 5: الإعدادات */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          {renderSettingsIcon(activeTab === 'settings')}
          <Text style={[styles.navText, activeTab === 'settings' && styles.navTextActive]}>الإعدادات</Text>
        </TouchableOpacity>
      </View>

      {/* --- Modals Section --- */}

      {/* 1. Employee Selection Modal */}
      <Modal visible={empModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>اختر اسمك (الموظف مُدخل الطلب)</Text>
            <FlatList 
              data={employees}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem}
                  onPress={() => selectEmployee(item)}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setEmpModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Governorate Selection Modal */}
      <Modal visible={govModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>اختر المحافظة</Text>
            <FlatList 
              data={governoratesList}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem}
                  onPress={() => {
                    setGovernorate(item);
                    setGovModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setGovModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. Product Selection Modal */}
      <Modal visible={prodModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContentBig}>
            <Text style={styles.modalTitle}>اختر منتجاً لإضافته</Text>
            
            <TextInput 
              style={styles.searchBar}
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="🔍 ابحث باسم المنتج أو باركود..."
              placeholderTextColor="rgba(255,255,255,0.4)"
            />

            <FlatList 
              data={filteredProductsSearch}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const price = item.units?.[0]?.selling || 0;
                return (
                  <TouchableOpacity 
                    style={styles.productSearchItem}
                    onPress={() => addToCart(item)}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    <Text style={styles.productPriceText}>{price.toLocaleString()} د.ع</Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptySearchText}>لا توجد نتائج مطابقة لبحثك.</Text>
              }
            />
            
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => {
                setProductSearch('');
                setProdModalVisible(false);
              }}
            >
              <Text style={styles.modalCloseText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. Global Alert Modal */}
      <Modal visible={alertModal.visible} transparent animationType="fade">
        <View style={styles.alertBg}>
          <View style={styles.alertContent}>
            <Text style={styles.alertMessage}>{alertModal.message}</Text>
            <TouchableOpacity 
              style={styles.alertBtn}
              onPress={() => setAlertModal({ visible: false, message: '' })}
            >
              <Text style={styles.alertBtnText}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d0d12',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0d0d12',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  loadingText: {
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
    fontSize: 16,
  },
  header: {
    height: 60,
    backgroundColor: 'rgba(30, 30, 40, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  empBadgeBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    maxWidth: 160,
  },
  empBadgeText: {
    color: '#c4b5fd',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  tabContent: {
    flex: 1,
  },
  scrollPadding: {
    padding: 15,
    paddingBottom: 90,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statsGridRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  newStatCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  newStatLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  newStatContent: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
    flex: 1,
    textAlign: 'right',
  },
  newStatIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  newStatIcon: {
    fontSize: 16,
  },
  statCardBig: {
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 18,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    alignItems: 'center',
  },
  gaugeCard: {
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    alignItems: 'center',
    width: 280,
    alignSelf: 'center',
  },
  gaugeCardHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 245,
    height: 160,
  },
  gaugeSvg: {
    width: 245,
    height: 160,
  },
  gaugeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#c084fc',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  gaugeDescription: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statValueBig: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  bigCard: {
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  orderItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderLeft: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderCustName: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  orderMetaText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  orderRight: {
    alignItems: 'flex-start',
    gap: 6,
  },
  orderAmountText: {
    color: '#c084fc',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 99,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  badgePending: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  badgeDelivered: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeReturned: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  badgeCancelled: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  badgeBackordered: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  formContainer: {
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#c4b5fd',
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  labelRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 15,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  inputError: {
    borderColor: '#f43f5e',
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  phoneDropdown: {
    backgroundColor: '#1e1e28',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 180,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'flex-end',
  },
  dropdownItemTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  dropdownItemSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalTrigger: {
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  triggerText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  triggerPlaceholder: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  triggerArrow: {
    color: '#94a3b8',
    fontSize: 12,
  },
  cartSection: {
    backgroundColor: 'rgba(30, 30, 40, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  cartHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#c4b5fd',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  addProdBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  addProdBtnText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  cartItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  cartItemLeft: {
    alignItems: 'flex-end',
  },
  cartItemName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  cartItemSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  cartPriceContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 5,
  },
  cartPriceInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 75,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  currencyLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginRight: 4,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  multiplierLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginRight: 6,
    fontWeight: 'bold',
  },
  cartQtyControls: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cartQtyInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 13,
    width: 36,
    height: 26,
    textAlign: 'center',
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  removeBtn: {
    paddingHorizontal: 5,
    marginLeft: 5,
  },
  removeBtnText: {
    color: '#f43f5e',
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    marginTop: 5,
  },
  totalLabel: {
    color: '#e9d5ff',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  totalValue: {
    color: '#e9d5ff',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  totalInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  totalAmountInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    color: '#e9d5ff',
    fontSize: 15,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 100,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  totalCurrencyLabel: {
    color: '#e9d5ff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 6,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  emptyCartText: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 15,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  paymentSelector: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  paymentBtn: {
    flex: 1,
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  paymentBtnActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  paymentBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  paymentBtnTextActive: {
    color: '#c4b5fd',
  },
  replaceBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  replaceBtnText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  submitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
    borderRadius: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  navIcon: {
    fontSize: 20,
    color: '#94a3b8',
    marginBottom: 2,
  },
  navIconActive: {
    color: '#a855f7',
  },
  navText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  navTextActive: {
    color: '#d8b4fe',
    fontWeight: 'bold',
    textShadowColor: 'rgba(168, 85, 247, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  centerNavWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: -28,
  },
  centerNavBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(168, 85, 247, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  centerNavBtnActive: {
    backgroundColor: '#a855f7',
    borderColor: '#e9d5ff',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 15,
    elevation: 10,
  },
  centerNavIcon: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabHeaderCard: {
    backgroundColor: 'rgba(30, 30, 40, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  tabHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  profileLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  profileValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  profileDescription: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  profileSwitchBtn: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignSelf: 'center',
  },
  profileSwitchBtnText: {
    color: '#c084fc',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  settingLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  settingValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  ordersHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 18,
    color: '#a855f7',
  },
  headerCenter: {
    alignItems: 'center',
  },
  ordersHeaderTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  ordersHeaderDate: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  segmentedControl: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#6366f1',
  },
  segmentBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  segmentBtnTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  countersRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  counterCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  counterNumber: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  counterLabel: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  sectionHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e1e28',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  modalContentBig: {
    backgroundColor: '#1e1e28',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: '85%',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  modalItemText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalCloseBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 15,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  searchBar: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    textAlign: 'right',
    marginBottom: 15,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  // Shadow wrapper: holds glow/shadow without overflow:hidden (required on iOS)
  neonSearchShadowWrapper: {
    marginBottom: 20,
    marginHorizontal: 4,
    borderRadius: 12,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 8,
  },
  // Clip container: clips the spinning SVG to rounded corners
  neonSearchContainer: {
    height: 42,
    borderRadius: 12,
    backgroundColor: '#07070b',
    overflow: 'hidden',
  },
  // Legacy alias kept for safety (unused now)
  neonSearchClip: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  neonSearchSpinBg: {
    position: 'absolute',
    width: 360,
    height: 360,
    left: '50%',
    top: '50%',
    marginLeft: -180,
    marginTop: -180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  neonSearchInner: {
    position: 'absolute',
    left: 1.5,
    top: 1.5,
    right: 1.5,
    bottom: 1.5,
    borderRadius: 10.5,
    backgroundColor: '#0a0a12',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  neonSearchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'right',
    paddingHorizontal: 12,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
    height: '100%',
  },
  neonSearchBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1.2,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  // Neon card: outer shadow aura (no overflow:hidden so shadow renders on iOS)
  neonCardShadow: {
    borderRadius: 16,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    elevation: 10,
  },
  // Neon card: clips the spinning SVG to border radius
  neonCardClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  // Neon card: large spinning gradient disc
  neonCardSpinBg: {
    position: 'absolute',
    width: 600,
    height: 600,
    left: '50%',
    top: '50%',
    marginLeft: -300,
    marginTop: -300,
  },
  // Neon card: inner dark content area inset by border thickness (1.5px)
  neonCardInner: {
    margin: 1.5,
    borderRadius: 14.5,
    backgroundColor: '#0e0e18',
    padding: 18,
  },
  productSearchItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  productPriceText: {
    color: '#a78bfa',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  emptySearchText: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 40,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  alertBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  alertContent: {
    backgroundColor: '#1e1e28',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    gap: 15,
  },
  alertMessage: {
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  alertBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  alertBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#0a0a12',
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  authHeaderContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  authTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
    textShadowColor: '#8b5cf6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  authSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authCard: {
    backgroundColor: '#1e1e28',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 5,
  },
  authCardTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 6,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'right',
  },
  authSubmitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  authSubmitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authToggleBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  authToggleText: {
    color: '#a78bfa',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authSeparatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  authSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  authSeparatorText: {
    color: '#94a3b8',
    fontSize: 12,
    marginHorizontal: 10,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authGoogleBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 2,
  },
  authGoogleBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  }
});
