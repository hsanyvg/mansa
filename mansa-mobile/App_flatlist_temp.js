import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  StyleSheet, Switch, 
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
  Easing,
  AppState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Updates from 'expo-updates';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import Svg, { Path, Circle, G, Polygon, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getDoc, 
  updateDoc,
  query as fsQuery, 
  where, 
  getDocs,
  limit,
  runTransaction,
  Timestamp,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  orderBy,
  startAfter
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';

export default function App() {
  const translateStatus = (status) => {
    switch (status) {
      case 'new': return 'جديد';
      case 'pending': return 'قيد الانتظار';
      case 'pending_warehouse': return 'قيد انتظار المخزن';
      case 'processing': return 'قيد المعالجة';
      case 'processed': return 'تمت المعالجة';
      case 'confirmed': return 'مؤكد';
      case 'ofd': return 'في الطريق';
      case 'shipped': return 'تم الشحن';
      case 'delivered': return 'واصل (ناجح)';
      case 'delivered_settled': return 'واصل ومسدد';
      case 'returned': return 'راجع';
      case 'returned_agent': return 'راجع بيد المندوب';
      case 'returned_warehouse': return 'راجع للمخزن';
      case 'postponed': return 'مؤجل';
      case 'partial': return 'جزئي';
      case 'replaced': return 'استبدال';
      case 'backordered': return 'طلب متأخر';
      default: return status || 'غير معروف';
    }
  };

  const [isLightMode, setIsLightMode] = useState(false);
  const formatDateLocal = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const styles = useMemo(() => getStyles(isLightMode), [isLightMode]);



  // Check for OTA Updates on startup
  useEffect(() => {
    async function checkUpdates() {
      if (__DEV__) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log("Error checking for updates:", e);
      }
    }
    checkUpdates();
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [productsTab, setProductsTab] = useState('products');
  const [completedSearchQuery, setCompletedSearchQuery] = useState('');
  const [completedSubTab, setCompletedSubTab] = useState('accounted');
  const [returnedSubTab, setReturnedSubTab] = useState('agent');
  const [postponedSearchQuery, setPostponedSearchQuery] = useState('');
  const [returnedSearchQuery, setReturnedSearchQuery] = useState('');
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const [todaySearchQuery, setTodaySearchQuery] = useState('');
  const [partialSearchQuery, setPartialSearchQuery] = useState('');
  const [processedSearchQuery, setProcessedSearchQuery] = useState('');
  const [ofdSearchQuery, setOfdSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Authentication State
  const [user, setUser] = useState(null);
  const [adminUid, setAdminUid] = useState(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogout = async () => {
    if (isEmployee && adminUid && user) {
      try {
        const sysUserRef = doc(db, 'users', adminUid, 'system_users', user.uid);
        await updateDoc(sysUserRef, { isOnline: false, lastActive: serverTimestamp() });
      } catch(e){}
    }
    await signOut(auth);
  };

  // Listen for Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      if (usr) {
        try {
          const mappingRef = doc(db, 'employee_mappings', usr.uid);
          const mappingSnap = await getDoc(mappingRef);
          if (mappingSnap.exists()) {
             const data = mappingSnap.data();
             setAdminUid(data.adminUid);
             setSelectedEmployeeId(data.employeeId);
             setIsEmployee(true);
             
             try {
                const sysUserRef = doc(db, 'users', data.adminUid, 'system_users', usr.uid);
                await updateDoc(sysUserRef, { isOnline: true, lastActive: serverTimestamp() });
             } catch(e){}
             
          } else {
             setAdminUid(usr.uid);
             setIsEmployee(false);
          }
        } catch(err) {
           console.log("Error checking mapping", err);
           setAdminUid(usr.uid);
           setIsEmployee(false);
        }
      } else {
        setAdminUid(null);
        setIsEmployee(false);
      }
      setUser(usr);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Presence tracker (AppState)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async nextAppState => {
      if (isEmployee && adminUid && user) {
        try {
          const sysUserRef = doc(db, 'users', adminUid, 'system_users', user.uid);
          if (nextAppState === 'active') {
            await updateDoc(sysUserRef, { isOnline: true, lastActive: serverTimestamp() });
          } else if (nextAppState.match(/inactive|background/)) {
            await updateDoc(sysUserRef, { isOnline: false, lastActive: serverTimestamp() });
          }
        } catch(err) {
          console.log("Presence err", err);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isEmployee, adminUid, user]);

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
  const [dashboardStats, setDashboardStats] = useState({
    totalCompletedCount: 0, partialCount: 0, ofdOrdersCount: 0, processedCount: 0,
    newCount: 0, postponedCount: 0, returnedCountCard: 0, cancelledCount: 0,
    todayOrdersCount: 0, todaySales: 0
  });
  const [teamStats, setTeamStats] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [baseProducts, setBaseProducts] = useState([]);
  const [compositeProductsData, setCompositeProductsData] = useState([]);
  const [customersDb, setCustomersDb] = useState([]);
  const [ordersMatches, setOrdersMatches] = useState([]);

  const [plusMenuVisible, setPlusMenuVisible] = useState(false);
  const [addExpenseModalVisible, setAddExpenseModalVisible] = useState(false);
  const [addBarcodeModalVisible, setAddBarcodeModalVisible] = useState(false);

  // Expense form states
  const [treasuryDb, setTreasuryDb] = useState([]);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCurrency, setNewExpenseCurrency] = useState('IQD');
  const [newExpenseWallet, setNewExpenseWallet] = useState('');
  const [newExpenseDetails, setNewExpenseDetails] = useState('');

  // Barcode receipt state
  const [newBarcodeReceipt, setNewBarcodeReceipt] = useState('');
  const [customReceiptNumber, setCustomReceiptNumber] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Full Add Expense states
  const [expenseTagsDb, setExpenseTagsDb] = useState([]);
  const [pagesStoresDb, setPagesStoresDb] = useState([]);
  const [branchesDb, setBranchesDb] = useState([]);
  const [expenseCategoriesDb, setExpenseCategoriesDb] = useState([]);
  const [walletsDb, setWalletsDb] = useState([]);
  
  const [expensePageId, setExpensePageId] = useState('');
  const [expenseBranchId, setExpenseBranchId] = useState('');
  const [expenseItemId, setExpenseItemId] = useState('');
  const [expenseSelectedTags, setExpenseSelectedTags] = useState([]);
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showExpenseDatePicker, setShowExpenseDatePicker] = useState(false);
  const [expenseImage, setExpenseImage] = useState(null);
  const [isUploadingExpense, setIsUploadingExpense] = useState(false);



  // Stats









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
  const [customTotalAmount, setCustomTotalAmount] = useState(null);
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  
  // Edit Order State
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [originalOrderItems, setOriginalOrderItems] = useState([]);
  const [originalOrderStatus, setOriginalOrderStatus] = useState('pending');

  // Search State
  const [productSearch, setProductSearch] = useState('');
  
  // Global Date Filter
  const [globalDateFilter, setGlobalDateFilter] = useState('last_7_days');
  const [tempGlobalDateFilter, setTempGlobalDateFilter] = useState('last_7_days');
  const [tempCustomStartDate, setTempCustomStartDate] = useState(new Date());
  const [tempCustomEndDate, setTempCustomEndDate] = useState(new Date());
  const [tempFilterMonth, setTempFilterMonth] = useState(new Date().getMonth());
  const [tempFilterYear, setTempFilterYear] = useState(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [displayedOrdersCount, setDisplayedOrdersCount] = useState(100);
  const [phoneSearchMatches, setPhoneSearchMatches] = useState([]);

  // Reset pagination on filter or tab change
  useEffect(() => {
    setDisplayedOrdersCount(100);
  }, [activeTab, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, ordersFilter, completedSubTab, ordersSearchQuery, completedSearchQuery]);

  // Custom Modal Visibilities
  const [empModalVisible, setEmpModalVisible] = useState(false);
  const [govModalVisible, setGovModalVisible] = useState(false);
  const [prodModalVisible, setProdModalVisible] = useState(false);
  const [alertModal, setAlertModal] = useState({ visible: false, message: '' });
  
  // Submit loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const governoratesList = [
    "بغداد", "البصرة", "نينوى", "أربيل", "النجف", "ذي قار",
    "كركوك", "الأنبار", "ديالى", "المثنى",
    "القادسية", "ميسان", "واسط", "صلاح الدين",
    "دهوك", "السليمانية", "بابل", "كربلاء"
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

  // Date Range Helper
  const getDateRange = (filter) => {
    const now = new Date();
    let start, end;
    
    // Set end to end of today
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    switch (filter) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
      case 'today_and_yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        break;
      case 'last_7_days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
        break;
      case 'last_30_days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
        break;
      case 'last_60_days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59, 0, 0, 0, 0);
        break;
      case 'last_90_days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        break;
      case 'all_time':
        return null;
      case 'specific_month':
        start = new Date(filterYear, filterMonth, 1, 0, 0, 0, 0);
        end = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59, 999);
        break;
      case 'custom':
        // set start to start of the day of customStartDate
        start = new Date(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate(), 0, 0, 0, 0);
        // set end to end of the day of customEndDate
        end = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate(), 23, 59, 59, 999);
        break;
      default:
        return null;
    }
    
    return { 
      start: Timestamp.fromDate(start), 
      end: Timestamp.fromDate(end) 
    };
  };

  // ------------------ NEW DATA FETCHING (PAGINATION + AGGREGATION) ------------------

  // Reset pagination when tab or filters change
  useEffect(() => {
    setDisplayedOrdersCount(100);
  }, [activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear]);

  // 1. Fetch Dashboard Stats & Team Stats
  useEffect(() => {
    if (!user || !adminUid) return;
    
    const fetchDashboardStats = async () => {
      try {
        let baseQuery = collection(db, 'users', adminUid, 'orders');
        const range = getDateRange(globalDateFilter);
        
        if (!range) {
            // ALL TIME: Use server-side counts (No composite index required)
            const qCompleted = fsQuery(baseQuery, where('status', 'in', ['delivered', 'delivered_settled']));
            const qPartial = fsQuery(baseQuery, where('status', 'in', ['partial', 'replaced']));
            const qOfd = fsQuery(baseQuery, where('status', 'in', ['ofd', 'shipped']));
            const qProcessed = fsQuery(baseQuery, where('status', 'in', ['processed', 'confirmed']));
            const qNew = fsQuery(baseQuery, where('status', 'in', ['pending', 'pending_warehouse', 'new']));
            const qPostponed = fsQuery(baseQuery, where('status', '==', 'postponed'));
            const qReturned = fsQuery(baseQuery, where('status', 'in', ['returned', 'returned_agent', 'returned_warehouse']));
            const qCancelled = fsQuery(baseQuery, where('status', '==', 'cancelled'));
    
            const [cCompleted, cPartial, cOfd, cProcessed, cNew, cPostponed, cReturned, cCancelled, cTotal] = await Promise.all([
              getCountFromServer(qCompleted), getCountFromServer(qPartial), getCountFromServer(qOfd),
              getCountFromServer(qProcessed), getCountFromServer(qNew), getCountFromServer(qPostponed),
              getCountFromServer(qReturned), getCountFromServer(qCancelled), getCountFromServer(baseQuery)
            ]);
    
            const sumAgg = await getAggregateFromServer(qCompleted, { totalAmount: sum('totalAmount') });
    
            setDashboardStats({
              totalCompletedCount: cCompleted.data().count,
              partialCount: cPartial.data().count,
              ofdOrdersCount: cOfd.data().count,
              processedCount: cProcessed.data().count,
              newCount: cNew.data().count,
              postponedCount: cPostponed.data().count,
              returnedCountCard: cReturned.data().count,
              cancelledCount: cCancelled.data().count,
              todayOrdersCount: cTotal.data().count,
              todaySales: sumAgg.data().totalAmount || 0,
            });
            
            // Team Stats
            if (employees && employees.length > 0) {
               const tStats = await Promise.all(employees.map(async emp => {
                  const empQ = fsQuery(baseQuery, where('employeeId', '==', emp.id));
                  const empTotal = await getCountFromServer(empQ);
                  const empDelivered = await getCountFromServer(fsQuery(empQ, where('status', 'in', ['delivered', 'delivered_settled'])));
                  const empReturned = await getCountFromServer(fsQuery(empQ, where('status', 'in', ['returned', 'returned_agent', 'returned_warehouse'])));
                  const empCancelled = await getCountFromServer(fsQuery(empQ, where('status', '==', 'cancelled')));
                  
                  return {
                     emp,
                     total: empTotal.data().count,
                     delivered: empDelivered.data().count,
                     returned: empReturned.data().count,
                     cancelled: empCancelled.data().count,
                     pending: Math.max(0, empTotal.data().count - empDelivered.data().count - empReturned.data().count - empCancelled.data().count)
                  };
               }));
               setTeamStats(tStats);
            }
        } else {
            // SPECIFIC DATE RANGE: Fetch documents and count client-side (Bypasses missing composite indexes)
            const dateQuery = fsQuery(baseQuery, where('date', '>=', range.start), where('date', '<=', range.end));
            const snap = await getDocs(dateQuery);
            
            let stats = {
              totalCompletedCount: 0, partialCount: 0, ofdOrdersCount: 0, processedCount: 0,
              newCount: 0, postponedCount: 0, returnedCountCard: 0, cancelledCount: 0,
              todayOrdersCount: 0, todaySales: 0
            };
            
            let tStatsMap = {};
            if (employees && employees.length > 0) {
               employees.forEach(emp => {
                   tStatsMap[emp.id] = { emp, total: 0, delivered: 0, returned: 0, cancelled: 0, pending: 0 };
               });
            }

            snap.forEach(doc => {
               const data = doc.data();
               const status = data.status;
               stats.todayOrdersCount++;
               
               if (['delivered', 'delivered_settled'].includes(status)) {
                   stats.totalCompletedCount++;
                   stats.todaySales += (Number(data.totalAmount) || 0);
               } else if (['partial', 'replaced'].includes(status)) {
                   stats.partialCount++;
               } else if (['ofd', 'shipped'].includes(status)) {
                   stats.ofdOrdersCount++;
               } else if (['processed', 'confirmed'].includes(status)) {
                   stats.processedCount++;
               } else if (['pending', 'pending_warehouse', 'new'].includes(status)) {
                   stats.newCount++;
               } else if (status === 'postponed') {
                   stats.postponedCount++;
               } else if (['returned', 'returned_agent', 'returned_warehouse'].includes(status)) {
                   stats.returnedCountCard++;
               } else if (status === 'cancelled') {
                   stats.cancelledCount++;
               }
               
               // Team Stats Logic
               if (data.employeeId && tStatsMap[data.employeeId]) {
                   tStatsMap[data.employeeId].total++;
                   if (['delivered', 'delivered_settled'].includes(status)) {
                       tStatsMap[data.employeeId].delivered++;
                   } else if (['returned', 'returned_agent', 'returned_warehouse'].includes(status)) {
                       tStatsMap[data.employeeId].returned++;
                   } else if (status === 'cancelled') {
                       tStatsMap[data.employeeId].cancelled++;
                   } else {
                       tStatsMap[data.employeeId].pending++;
                   }
               }
            });
            
            setDashboardStats(stats);
            if (employees && employees.length > 0) {
               setTeamStats(Object.values(tStatsMap));
            }
        }
      } catch (err) {
        console.log("Error fetching stats:", err);
      }
    };
    fetchDashboardStats();
  }, [globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, employees]);

  // 2. Fetch Paginated Orders for Active Tab
  useEffect(() => {
    if (!user || !adminUid) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    let ordersQuery = collection(db, 'users', adminUid, 'orders');
    const range = getDateRange(globalDateFilter);
    
    // We MUST limit the query to avoid downloading massive amounts of data and crashing the app.
    // Dashboard Stats are handled by the server separately, so this list only needs to show recent items.
    if (range) {
      ordersQuery = fsQuery(
        ordersQuery, 
        where('date', '>=', range.start), 
        where('date', '<=', range.end),
        orderBy('date', 'desc'),
        limit(800)
      );
    } else {
      ordersQuery = fsQuery(ordersQuery, orderBy('date', 'desc'), limit(800));
    }

    const unsub = onSnapshot(ordersQuery, (snapshot) => {
      let fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(o => o.isDeleted !== true);

      // Local Filtering based on tab
      if (activeTab === 'completed_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['delivered', 'delivered_settled'].includes(o.status));
      } else if (activeTab === 'returned_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['returned', 'returned_agent', 'returned_warehouse'].includes(o.status));
      } else if (activeTab === 'postponed_shipments') {
        fetchedOrders = fetchedOrders.filter(o => o.status === 'postponed');
      } else if (activeTab === 'pending_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['pending', 'pending_warehouse', 'new'].includes(o.status));
      } else if (activeTab === 'partial_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['partial', 'replaced'].includes(o.status));
      } else if (activeTab === 'processed_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['processed', 'confirmed'].includes(o.status));
      } else if (activeTab === 'ofd_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['ofd', 'shipped'].includes(o.status));
      } else if (activeTab === 'orders') {
        if (ordersFilter === 'completed') {
          fetchedOrders = fetchedOrders.filter(o => ['delivered', 'partial'].includes(o.status));
        } else if (ordersFilter === 'active') {
          fetchedOrders = fetchedOrders.filter(o => ['pending', 'new', 'ofd', 'shipped', 'postponed', 'processed', 'confirmed', 'pending_warehouse', 'backordered'].includes(o.status));
        }
      }

      // Slicing to the displayed count to avoid rendering lag
      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      console.log("Error fetching orders:", error);
      setLoading(false);
    });
    
    return () => unsub();
  }, [activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user]);

  // Fetch active employees
  useEffect(() => {
    if (!user || !adminUid) {
      setEmployees([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', adminUid, 'employees'), (snapshot) => {
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activeEmps = empData.filter((e) => e.isActive);
      setEmployees(activeEmps);
      if (!isEmployee && !selectedEmployeeId && activeEmps.length > 0) {
        setSelectedEmployeeId(activeEmps[0].id);
      }
    });
    return () => unsub();
  }, [user, adminUid, selectedEmployeeId, isEmployee]);

  // Fetch base products
  useEffect(() => {
    if (!user || !adminUid) {
      setBaseProducts([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', adminUid, 'products'), (snapshot) => {
      setBaseProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user, adminUid]);

  // Fetch composite products
  useEffect(() => {
    if (!user || !adminUid) {
      setCompositeProductsData([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', adminUid, 'composite_products'), (snapshot) => {
      setCompositeProductsData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user, adminUid]);

  // Fetch customers
  useEffect(() => {
    if (!user || !adminUid) {
      setCustomersDb([]);
      return;
    }
    
    const unsubExpCats = onSnapshot(collection(db, 'users', adminUid, 'expense_categories'), s => setExpenseCategoriesDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubWallets = onSnapshot(collection(db, 'users', adminUid, 'wallets'), s => setWalletsDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTags = onSnapshot(collection(db, 'users', adminUid, 'expense_tags'), s => setExpenseTagsDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPagesStores = onSnapshot(collection(db, 'users', adminUid, 'pages_stores'), s => setPagesStoresDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBranches = onSnapshot(collection(db, 'users', adminUid, 'categories'), s => setBranchesDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const unsub = onSnapshot(collection(db, 'users', adminUid, 'customers'), (snapshot) => {
      setCustomersDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user, adminUid]);

  // Search orders archive for matching phone when customer phone length >= 10
  useEffect(() => {
    if (!user || !adminUid) {
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
          collection(db, 'users', adminUid, 'orders'), 
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
  }, [customerPhone, user, adminUid]);

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
  const totalAmount = customTotalAmount !== null && customTotalAmount !== '' ? (parseInt(customTotalAmount.replace(/[^0-9]/g, '')) || 0) : calculatedTotal;

  useEffect(() => {
    setCustomTotalAmount(null);
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

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال البريد الإلكتروني أولاً لإرسال رابط إعادة تعيين كلمة المرور.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAlertModal({ visible: true, message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.' });
    } catch (err) {
      console.log("Reset password error:", err);
      let errMsg = 'حدث خطأ أثناء إرسال رابط إعادة التعيين.';
      if (err.code === 'auth/user-not-found') errMsg = 'لا يوجد حساب مرتبط بهذا البريد الإلكتروني.';
      else if (err.code === 'auth/invalid-email') errMsg = 'البريد الإلكتروني غير صالح.';
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

  
  const pickExpenseImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setExpenseImage(result.assets[0].uri);
    }
  };


  const handleSaveExpense = async () => {
    if (!newExpenseCategory || !newExpenseAmount || !newExpenseWallet) {
      setAlertModal({ visible: true, message: 'يرجى تعبئة الحقول الأساسية (الفئة، المبلغ، المحفظة)' });
      return;
    }
    
    setIsUploadingExpense(true);
    try {
      let uploadedImageUrl = '';
      if (expenseImage) {
        const response = await fetch(expenseImage);
        const blob = await response.blob();
        const filename = `expenses/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const storageRef = ref(storage, `users/${adminUid}/${filename}`);
        const uploadTask = await uploadBytesResumable(storageRef, blob);
        uploadedImageUrl = await getDownloadURL(storageRef);
      }

      const numAmount = Number(newExpenseAmount);
      const cat = expenseCategoriesDb.find(c => c.id === newExpenseCategory);
      const wallet = walletsDb.find(w => w.id === newExpenseWallet);
      
      const pg = pagesStoresDb.find(p => p.id === expensePageId);
      const br = branchesDb.find(b => b.id === expenseBranchId);
      const it = baseProducts.find(i => i.id === expenseItemId) || compositeProductsData.find(i => i.id === expenseItemId);
      
      const batch = writeBatch(db);
      const expenseRef = doc(collection(db, 'users', adminUid, 'expenses'));
      const treasuryRef = doc(collection(db, 'users', adminUid, 'treasury_transactions'));
      
      const dateStr = formatDateLocal(expenseDate);
      const timeStr = expenseDate.toTimeString().split(' ')[0];

      batch.set(expenseRef, {
        categoryId: newExpenseCategory,
        categoryName: cat?.name || '',
        amount: numAmount,
        currency: newExpenseCurrency,
        date: dateStr,
        time: timeStr,
        details: newExpenseDetails,
        walletId: newExpenseWallet,
        walletName: wallet?.name || '',
        pageId: expensePageId,
        pageName: pg?.name || '',
        branchId: expenseBranchId,
        branchName: br?.name || '',
        itemId: expenseItemId,
        itemName: it?.name || '',
        tags: expenseSelectedTags,
        imageUrl: uploadedImageUrl,
        isArchived: false,
        createdAt: serverTimestamp()
      });

      batch.set(treasuryRef, {
        type: 'withdraw',
        walletId: newExpenseWallet,
        amount: numAmount,
        currency: newExpenseCurrency,
        date: dateStr,
        time: timeStr,
        details: `مصروف فئة ${cat?.name || 'غير محدد'} - ${newExpenseDetails}`,
        createdAt: serverTimestamp(),
        isAutomated: true,
        expenseId: expenseRef.id
      });

      await batch.commit();

      // Reset
      setActiveTab('dashboard');
      setNewExpenseCategory('');
      setNewExpenseAmount('');
      setNewExpenseDetails('');
      setNewExpenseWallet('');
      setExpensePageId('');
      setExpenseBranchId('');
      setExpenseItemId('');
      setExpenseSelectedTags([]);
      setExpenseImage(null);
      setExpenseDate(new Date());
      setIsUploadingExpense(false);
      setAlertModal({ visible: true, message: 'تم إضافة المصروف بنجاح' });
    } catch(err) {
      console.log(err);
      setIsUploadingExpense(false);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الحفظ' });
    }
  };

  const handleBarcodeScanned = ({ type, data }) => {
    setScanned(true);
    setNewBarcodeReceipt(data);
  };

  const handleSaveBarcodeReceipt = async () => {
    if (!newBarcodeReceipt.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال رقم الوصل' });
      return;
    }
    try {
      const counterRef = doc(db, 'users', adminUid, 'metadata', 'orderCounter');
      let newOrderId = 100000;
      
      await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (counterDoc.exists()) {
            newOrderId = (counterDoc.data().lastId || 100000) + 1;
            transaction.update(counterRef, { lastId: newOrderId });
          } else {
            transaction.set(counterRef, { lastId: newOrderId });
          }
          
          const newOrderRef = doc(db, 'users', adminUid, 'orders', newOrderId.toString());
          transaction.set(newOrderRef, {
            receiptNumber: newBarcodeReceipt.trim(),
            employeeId: selectedEmployeeId || 'agent',
            employeeName: employees?.find(e => e.id === selectedEmployeeId)?.name || 'مجهول',
            customerName: '',
            customerPhone: '',
            governorate: '',
            region: '',
            notes: 'تم إنشاؤه عبر وصل باركود',
            paymentMethod: 'cash',
            totalAmount: 0,
            items: [],
            date: serverTimestamp(),
            status: 'waiting',
            is_settled: false
          });
      });

      setAddBarcodeModalVisible(false);
      setNewBarcodeReceipt('');
      setAlertModal({ visible: true, message: 'تم إضافة الطلب بنجاح' });
    } catch(err) {
      console.log(err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الحفظ' });
    }
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
    let orderDocId = null;

    try {
      const orderData = {
        employeeId: selectedEmployeeId,
        employeeName: employees.find(e => e.id === selectedEmployeeId)?.name || 'مجهول',
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
        status: 'pending',
        is_settled: false
      };

      const batch = writeBatch(db);
      const counterRef = doc(db, 'users', adminUid, 'metadata', 'orderCounter');
      let newOrderId = 100000;
        
      await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (counterDoc.exists()) {
            newOrderId = (counterDoc.data().lastId || 100000) + 1;
            transaction.update(counterRef, { lastId: newOrderId });
          } else {
            transaction.set(counterRef, { lastId: newOrderId });
          }
          
          const newOrderRef = doc(db, 'users', adminUid, 'orders', newOrderId.toString());
          transaction.set(newOrderRef, orderData);
          orderDocId = newOrderRef.id;
      });

      // Reserve stock
      for (const item of cart) {
        const productData = item.product;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', adminUid, 'products', component.itemId);
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
          const prodRef = doc(db, 'users', adminUid, 'products', item.product.id);
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
        if (orderDocId) {
          fetch('https://management-easy-order.firebaseapp.com/api/webhooks/meta-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: cart[0]?.id,
              value: totalAmount,
              currency: 'IQD',
              phone: customerPhone,
              firstName: customerName.split(' ')[0] || customerName,
              state: governorate,
              externalId: orderDocId,
              fb_login_id: fbLoginId,
              userId: adminUid
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
      setCustomTotalAmount(null);
      setHasAttemptedSubmit(false);

    } catch (err) {
      console.log("Submit order native error:", err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOrder = (order) => {
    if (order.status === 'delivered' || order.status === 'cancelled' || order.status === 'returned_warehouse' || order.status === 'returned_agent' || order.status === 'returned') {
      setAlertModal({ visible: true, message: 'لا يمكن تعديل هذا الطلب بسبب حالته الحالية.' });
      return;
    }
    
    setEditingOrderId(order.id);
    setOriginalOrderItems(order.items || []);
    setOriginalOrderStatus(order.status || 'pending');
    
    setCustomerName(order.customerName || '');
    setCustomerPhone(order.customerPhone || '');
    setCustomerPhone2(order.customerPhone2 || '');
    setGovernorate(order.governorate || '');
    setRegion(order.region || '');
    setNotes(order.notes || '');
    setPaymentMethod(order.paymentMethod || 'كاش عند التوصيل');
    setFbLoginId(order.fbLoginId || '');
    
    if (order.items && order.items.length > 0) {
      const reconstructedCart = order.items.map(item => ({
        id: item.productId,
        product: {
          id: item.productId,
          name: item.productName,
          isComposite: item.isComposite || false,
          composition: item.composition || null
        },
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }));
      setCart(reconstructedCart);
    } else {
      setCart([]);
    }
    
    setCustomTotalAmount(order.totalAmount ? order.totalAmount.toString() : null);
    setActiveTab('entry');
  };

  const cancelEdit = () => {
    setEditingOrderId(null);
    setOriginalOrderItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerPhone2('');
    setGovernorate('');
    setRegion('');
    setNotes('');
    setFbLoginId('');
    setCart([]);
    setCustomTotalAmount(null);
    setHasAttemptedSubmit(false);
    setActiveTab('orders');
  };

  const handleEditSubmit = async () => {
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
    try {
      const orderRef = doc(db, 'users', adminUid, 'orders', editingOrderId);
      const batch = writeBatch(db);
      
      const updates = {
        customerName,
        customerPhone,
        customerPhone2,
        governorate,
        region,
        notes,
        paymentMethod,
        fbLoginId,
        totalAmount,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          isComposite: item.product.isComposite || false,
          composition: item.product.composition || null
        }))
      };

      batch.update(orderRef, updates);

      // Revert stock for original items
      for (const oldItem of originalOrderItems) {
        const productData = { isComposite: oldItem.isComposite, composition: oldItem.composition, id: oldItem.productId };
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', adminUid, 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let stock = { ...rawData.stock };
              let qtyToRevert = component.quantityNeeded * oldItem.quantity;
              const firstStoreKey = Object.keys(stock)[0] || 'default_store';
              if (stock[firstStoreKey]) {
                stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToRevert);
                batch.update(rawProdRef, { stock });
              }
            }
          }
        } else {
          const prodRef = doc(db, 'users', adminUid, 'products', oldItem.productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let stock = { ...prodData.stock };
            let qtyToRevert = oldItem.quantity;
            const firstStoreKey = Object.keys(stock)[0] || 'default_store';
            if (stock[firstStoreKey]) {
              stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToRevert);
              batch.update(prodRef, { stock });
            }
          }
        }
      }

      // Reserve stock for new items
      for (const item of cart) {
        const productData = item.product;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', adminUid, 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let stock = { ...rawData.stock };
              let qtyToReserve = component.quantityNeeded * item.quantity;
              const firstStoreKey = Object.keys(stock)[0] || 'default_store';
              if (!stock[firstStoreKey]) {
                stock[firstStoreKey] = { quantity: 0, reserved: qtyToReserve, unit: rawData.units?.[0]?.type || 'قطعة' };
              } else {
                stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + qtyToReserve;
              }
              batch.update(rawProdRef, { stock });
            }
          }
        } else {
          const prodRef = doc(db, 'users', adminUid, 'products', item.product.id);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let stock = { ...prodData.stock };
            let qtyToReserve = item.quantity;
            const firstStoreKey = Object.keys(stock)[0] || 'default_store';
            if (!stock[firstStoreKey]) {
              stock[firstStoreKey] = { quantity: 0, reserved: qtyToReserve, unit: prodData.units?.[0]?.type || 'قطعة' };
            } else {
              stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + qtyToReserve;
            }
            batch.update(prodRef, { stock });
          }
        }
      }

      await batch.commit();
      setAlertModal({ visible: true, message: 'تم تحديث الطلب والمخزون بنجاح!' });
      cancelEdit();

    } catch (err) {
      console.log("Edit order native error:", err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء التحديث.' });
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

  const completedCount = dashboardStats.totalCompletedCount;
  const cancelledCountForTab = dashboardStats.cancelledCount;
  const activeOrdersCountForTab = dashboardStats.todayOrdersCount - completedCount - cancelledCountForTab - dashboardStats.returnedCountCard;

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
            <Path d="M9 2H15A1 1 0 0 1 16 3V5H8V3A1 1 0 0 1 9 2Z" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M8 4H5A2 2 0 0 0 3 6V20A2 2 0 0 0 5 22H19A2 2 0 0 0 21 20V6A2 2 0 0 0 19 4H16" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M8 11H16" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M8 15H16" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
          </>
        )}
        <Path d="M9 2H15A1 1 0 0 1 16 3V5H8V3A1 1 0 0 1 9 2Z" stroke={strokeColor} strokeWidth={2} />
        <Path d="M8 4H5A2 2 0 0 0 3 6V20A2 2 0 0 0 5 22H19A2 2 0 0 0 21 20V6A2 2 0 0 0 19 4H16" stroke={strokeColor} strokeWidth={2} />
        <Path d="M8 11H16" stroke={strokeColor} strokeWidth={2} />
        <Path d="M8 15H16" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  const renderArchiveIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  
  const renderProductsIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
        )}
        <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke={strokeColor} strokeWidth={2} />
        <Path d="M3.27 6.96L12 12.01l8.73-5.05" stroke={strokeColor} strokeWidth={2} />
        <Path d="M12 22.08V12" stroke={strokeColor} strokeWidth={2} />
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

    const returnedCount = orders.filter(o => o.status === 'returned').length;
  const {
    totalCompletedCount,
    partialCount,
    ofdOrdersCount,
    processedCount,
    newCount,
    postponedCount,
    returnedCountCard,
    cancelledCount,
    todayOrdersCount,
    todaySales
  } = dashboardStats;

  const renderCustomCard = (label, value, bgColor, textColor, svgContent, isWhite, onPress = null) => {
    const CardContent = (
      <View style={{
        width: onPress ? '100%' : '48%', 
        backgroundColor: bgColor, 
        borderRadius: 12, 
        padding: 12, 
        minHeight: 100, 
        justifyContent: 'space-between'
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ 
            backgroundColor: isWhite ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.2)', 
            borderRadius: 8, 
            width: 32, 
            height: 32, 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              {svgContent}
            </Svg>
          </View>
          <Text style={{ color: textColor, fontSize: 32, fontWeight: '400' }}>{value}</Text>
        </View>
        <Text style={{ color: textColor, fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 10 }}>{label}</Text>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity 
          activeOpacity={0.7} 
          onPress={onPress}
          style={{ width: '48%' }}
        >
          {CardContent}
        </TouchableOpacity>
      );
    }
    
    return CardContent;
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
        <StatusBar barStyle="light-content" backgroundColor="#121216" />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>منصة منسا</Text>
            <Text style={styles.authSubtitle}>لوحة التحكم وإدارة المخازن والمبيعات</Text>

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

            {authMode === 'login' && (
              <TouchableOpacity style={styles.forgotPasswordBtn} onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>نسيت كلمة المرور؟</Text>
              </TouchableOpacity>
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
      
      
      {/* Global Header & Search */}
      {activeTab !== 'settings' && (
      <View style={{ backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12', paddingBottom: 10 }}>
        {/* Top Row: Profile & Notifications */}
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 16, marginTop: 15 }}>
          {/* Right: Profile Info */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f3e8ff', justifyContent: 'center', alignItems: 'center', marginLeft: 12 }}>
              <Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 18 }}>
                {selectedEmployeeName ? selectedEmployeeName.split(' ').slice(0,2).map(n => n[0]).join(' ') : '👤'}
              </Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>
              {selectedEmployeeName}
            </Text>
          </View>

          {/* Left: Action Icons */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
            {/* User Icon */}
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => setEmpModalVisible(true)}
            >
              <Svg width={22} height={22} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2.5}>
                <Path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                <Circle cx='12' cy='7' r='4' />
              </Svg>
            </TouchableOpacity>

            {/* Notification Bell */}
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => setAlertModal({ visible: true, message: 'لا توجد إشعارات جديدة حالياً.' })}
            >
              <Svg width={24} height={24} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2}>
                <Path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                <Path d='M13.73 21a2 2 0 0 1-3.46 0' />
              </Svg>
              <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: isLightMode ? '#f8fafc' : '#0f172a' }}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>52</Text>
              </View>
            </TouchableOpacity>

            {/* Date Filter Icon */}
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => {
              setTempGlobalDateFilter(globalDateFilter);
              setTempCustomStartDate(customStartDate);
              setTempCustomEndDate(customEndDate);
              setTempFilterMonth(filterMonth);
              setTempFilterYear(filterYear);
              setDateFilterModalVisible(true);
            }}
            >
              <Svg width={22} height={22} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2.5}>
                <Rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
                <Path d='M16 2v4M8 2v4M3 10h18' />
              </Svg>
            </TouchableOpacity>
            
            

          </View>
        </View>
        
              </View>
      )}


      

      {/* Postponed Shipments Screen */}
      {activeTab === 'postponed_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#f97316', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>الطلبات المؤجلة ({orders.filter(o => o.status === 'postponed').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={postponedSearchQuery} onChangeText={setPostponedSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'postponed');
              if (postponedSearchQuery.trim()) {
                const q = postponedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#f97316' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>مؤجلة</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? item.totalAmount.toLocaleString() + ' د.ع' : '-'}</Text>
                       {item.postponeReason && <Text style={{ textAlign: 'right', color: '#f97316', marginTop: 5 }}>السبب: {item.postponeReason}</Text>}
                       
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* Returned Shipments Screen */}
      {activeTab === 'returned_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#ef4444', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                المرتجعات ({(() => {
                  let fc = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse');
                  if (returnedSubTab === 'agent') fc = fc.filter(o => o.status === 'returned' || o.status === 'returned_agent');
                  else fc = fc.filter(o => o.status === 'returned_warehouse');
                  if (returnedSearchQuery.trim()) {
                    const q = returnedSearchQuery.toLowerCase();
                    fc = fc.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
                  }
                  return fc.length;
                })()})
              </Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={returnedSearchQuery} onChangeText={setReturnedSearchQuery} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 15, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' }}>
               {(() => {
                  const allR = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse');
                  const agentC = allR.filter(o => o.status === 'returned' || o.status === 'returned_agent').length;
                  const warehouseC = allR.filter(o => o.status === 'returned_warehouse').length;
                  return (
                    <>
                       <TouchableOpacity style={{ flex: 1, paddingVertical: 10, backgroundColor: returnedSubTab === 'warehouse' ? '#ef4444' : '#fff' }} onPress={() => setReturnedSubTab('warehouse')}>
                         <Text style={{ textAlign: 'center', color: returnedSubTab === 'warehouse' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>راجع في المخزن ({warehouseC})</Text>
                       </TouchableOpacity>
                       <TouchableOpacity style={{ flex: 1, paddingVertical: 10, backgroundColor: returnedSubTab === 'agent' ? '#ef4444' : '#fff' }} onPress={() => setReturnedSubTab('agent')}>
                         <Text style={{ textAlign: 'center', color: returnedSubTab === 'agent' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>راجع عند المندوب ({agentC})</Text>
                       </TouchableOpacity>
                    </>
                  )
               })()}
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse');
              if (returnedSubTab === 'agent') filtered = filtered.filter(o => o.status === 'returned' || o.status === 'returned_agent');
              else filtered = filtered.filter(o => o.status === 'returned_warehouse');
              
              if (returnedSearchQuery.trim()) {
                const q = returnedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#ef4444' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? item.totalAmount.toLocaleString() + ' د.ع' : '-'}</Text>
                       
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      
      {/* قيد الإنتظار Screen */}
      {activeTab === 'pending_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#27272a', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>قيد الإنتظار ({orders.filter(o => o.status === 'pending' || o.status === 'pending_warehouse' || o.status === 'new').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={pendingSearchQuery} onChangeText={setPendingSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'pending' || o.status === 'pending_warehouse' || o.status === 'new');
              if (pendingSearchQuery.trim()) {
                const q = pendingSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#fff' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* شحنات اليوم Screen */}
      {activeTab === 'today_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#ffffff', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#333', fontSize: 18, fontWeight: 'bold' }}>الطلبات الكلية ({orders.length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={todaySearchQuery} onChangeText={setTodaySearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = [...orders];
              if (todaySearchQuery.trim()) {
                const q = todaySearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#333' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* جزئي او استبدال Screen */}
      {activeTab === 'partial_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#34d399', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>جزئي او استبدال ({orders.filter(o => o.status === 'partial' || o.status === 'replaced').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={partialSearchQuery} onChangeText={setPartialSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'partial' || o.status === 'replaced');
              if (partialSearchQuery.trim()) {
                const q = partialSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#fff' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* تمت المعالجة Screen */}
      {activeTab === 'processed_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#34d399', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>تمت المعالجة ({orders.filter(o => o.status === 'processed' || o.status === 'confirmed').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={processedSearchQuery} onChangeText={setProcessedSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'processed' || o.status === 'confirmed');
              if (processedSearchQuery.trim()) {
                const q = processedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#fff' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* في الطريق للشركة Screen */}
      {activeTab === 'ofd_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#eab308', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>في الطريق للشركة ({orders.filter(o => o.status === 'processing' || o.status === 'confirmed' || o.status === 'ofd' || o.status === 'shipped').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={ofdSearchQuery} onChangeText={setOfdSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'processing' || o.status === 'confirmed' || o.status === 'ofd' || o.status === 'shipped');
              if (ofdSearchQuery.trim()) {
                const q = ofdSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#fff' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* Main Tab View */}
      {activeTab === 'dashboard' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
          {/* Dashboard Stats */}
          <View style={{ marginBottom: 20 }}>
            {/* Row 1 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('الشحنات المكتملة', totalCompletedCount, '#10b981', '#ffffff', 
                <Path d="M3 10h10a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5H3m0-12l4-4m-4 4l4 4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>, false, () => setActiveTab('completed_shipments'))}
              {renderCustomCard('جزئي او استبدال', partialCount, '#34d399', '#ffffff', 
                <><Path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/><Path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/><Path d="M21 21v-5h-5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('partial_shipments'))}
            </View>

            {/* Row 2 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('في الطريق للشركة', ofdOrdersCount, '#eab308', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('ofd_shipments'))}
              {renderCustomCard('تمت المعالجة', processedCount, '#34d399', '#ffffff', 
                <Path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4M12 4v12M8 12l4 4 4-4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>, false, () => setActiveTab('processed_shipments'))}
            </View>

            {/* Row 3 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('قيد الإنتظار', newCount, '#27272a', '#ffffff', 
                <Path d="M5 22h14M5 2h14M8 2v5l4 5-4 5v5m8-20v5l-4 5 4 5v5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>, false, () => setActiveTab('pending_shipments'))}
              {renderCustomCard('مؤجلة', postponedCount, '#f97316', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('postponed_shipments'))}
            </View>

            {/* Row 4 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('راجع', returnedCountCard, '#ef4444', '#ffffff', 
                <><Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Path d="M3 3v5h5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>, false, () => setActiveTab('returned_shipments'))}
              {renderCustomCard('ملغي', cancelledCount, '#ef4444', '#ffffff', 
                <><Circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2"/><Path d="M15 9l-6 6M9 9l6 6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/></>, false, () => setActiveTab('orders'))}
            </View>
            
            {/* Row 5 */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              {renderCustomCard('الطلبات الكلية', todayOrdersCount, '#ffffff', '#94a3b8', 
                <><Circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="2"/><Path d="M12 6v6l4 2" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/></>, true, () => setActiveTab('today_shipments'))}
              {renderCustomCard('المبيعات الكلية', todaySales + ' د.ع', '#ffffff', '#94a3b8', 
                <><Path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>, true, () => setActiveTab('dashboard'))}
            </View>
          </View>

          {/* Team Performance Section */}
          <View style={[styles.bigCard, { marginTop: 15, paddingHorizontal: 0, paddingBottom: 20 }]}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 15 }}>
              <Text style={styles.cardTitle}>📊 أداء الفريق ({employees.length} موظف)</Text>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 10, color: isLightMode ? '#475569' : '#94a3b8' }}>🗓️ تاريخ: {
                  [
                    { id: 'today', label: 'اليوم' },
                    { id: 'yesterday', label: 'أمس' },
                    { id: 'today_and_yesterday', label: 'اليوم وأمس' },
                    { id: 'last_7_days', label: 'آخر 7 أيام' },
                    { id: 'last_30_days', label: 'آخر 30 يوم' },
                    { id: 'last_60_days', label: 'آخر 60 يوم' },
                    { id: 'last_90_days', label: 'آخر 90 يوم' },
                    { id: 'year', label: 'سنة' },
                    { id: 'all_time', label: 'فترة مطلقة' },
                    { id: 'custom', label: 'تاريخ مخصص' }
                  ].find(f => f.id === globalDateFilter)?.label || 'الكل'
                }</Text>
              </View>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
              {(() => {
                // teamStats is already loaded from state!

                return teamStats.map(stat => (
                  <View key={stat.emp.id} style={{ 
                    width: 140, 
                    backgroundColor: isLightMode ? '#ffffff' : 'rgba(30, 30, 40, 0.4)', 
                    borderRadius: 12, 
                    padding: 12, 
                    marginLeft: 10,
                    borderWidth: 1,
                    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.05)'
                  }}>
                    <Text style={{ color: isLightMode ? '#0f172a' : '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 14, marginBottom: 4 }} numberOfLines={1}>{stat.emp.name}</Text>
                    <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8', textAlign: 'center', fontSize: 11, marginBottom: 15 }}>إجمالي الطلبات: {stat.total}</Text>
                    
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 }}>
                      
                      {/* Pending Bar */}
                      <View style={{ alignItems: 'center', width: '30%' }}>
                        <Text style={{ color: '#eab308', fontWeight: 'bold', fontSize: 12 }}>{stat.pending}</Text>
                        <Text style={{ color: '#eab308', fontSize: 9, marginBottom: 4 }}>({stat.penPct}%)</Text>
                        <View style={{ height: 70, width: 8, backgroundColor: 'rgba(234, 179, 8, 0.2)', borderRadius: 4, justifyContent: 'flex-end' }}>
                          <View style={{ width: '100%', height: stat.penPct + '%', backgroundColor: '#eab308', borderRadius: 4 }} />
                        </View>
                        <View style={{ marginTop: 6, width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#eab308', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#eab308', fontSize: 8 }}>⌛</Text>
                        </View>
                        <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8', fontSize: 10, marginTop: 4 }}>انتظار</Text>
                      </View>

                      {/* Returned Bar */}
                      <View style={{ alignItems: 'center', width: '30%' }}>
                        <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 12 }}>{stat.returned}</Text>
                        <Text style={{ color: '#ef4444', fontSize: 9, marginBottom: 4 }}>({stat.retPct}%)</Text>
                        <View style={{ height: 70, width: 8, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 4, justifyContent: 'flex-end' }}>
                          <View style={{ width: '100%', height: stat.retPct + '%', backgroundColor: '#ef4444', borderRadius: 4 }} />
                        </View>
                        <View style={{ marginTop: 6, width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#ef4444', fontSize: 8 }}>↩</Text>
                        </View>
                        <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8', fontSize: 10, marginTop: 4 }}>راجع</Text>
                      </View>

                      {/* Delivered Bar */}
                      <View style={{ alignItems: 'center', width: '30%' }}>
                        <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 12 }}>{stat.delivered}</Text>
                        <Text style={{ color: '#10b981', fontSize: 9, marginBottom: 4 }}>({stat.delPct}%)</Text>
                        <View style={{ height: 70, width: 8, backgroundColor: 'rgba(16, 185, 129, 0.2)', borderRadius: 4, justifyContent: 'flex-end' }}>
                          <View style={{ width: '100%', height: stat.delPct + '%', backgroundColor: '#10b981', borderRadius: 4 }} />
                        </View>
                        <View style={{ marginTop: 6, width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#10b981', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#10b981', fontSize: 8 }}>✓</Text>
                        </View>
                        <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8', fontSize: 10, marginTop: 4 }}>واصل</Text>
                      </View>

                    </View>
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        </ScrollView>
      ) : activeTab === 'add_expense' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding} keyboardShouldPersistTaps="handled">
          <View style={[styles.formContainer, { backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 20, borderRadius: 12 }]}>
            
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#fff' }}>💸 إضافة مصروف</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')} style={{ padding: 8, backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8 }}>
                <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8' }}>رجوع</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              
              {/* Right side fields (in RTL, row-reverse makes this the main grid) */}
              <View style={{ width: '100%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>البيان / التفاصيل</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', color: isLightMode ? '#000' : '#fff', textAlign: 'right', height: 100, textAlignVertical: 'top' }]}
                  placeholder="اكتب التفاصيل هنا..."
                  placeholderTextColor="#64748b"
                  multiline
                  value={newExpenseDetails}
                  onChangeText={setNewExpenseDetails}
                />
              </View>

              {/* Categories & Amounts */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>الفئة</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={newExpenseCategory} onValueChange={setNewExpenseCategory} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر الفئة..." value="" />
                    {expenseCategoriesDb.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>المبلغ</Text>
                <View style={{ flexDirection: 'row-reverse' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', color: isLightMode ? '#000' : '#fff', textAlign: 'right', marginLeft: 10 }]}
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={newExpenseAmount}
                    onChangeText={setNewExpenseAmount}
                  />
                  <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8, width: 80 }}>
                    <Picker selectedValue={newExpenseCurrency} onValueChange={setNewExpenseCurrency} style={{ color: isLightMode ? '#000' : '#fff' }}>
                      <Picker.Item label="د.ع" value="IQD" />
                      <Picker.Item label="$" value="USD" />
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Wallets & Date */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>دفع من محفظة (إلزامي)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={newExpenseWallet} onValueChange={setNewExpenseWallet} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر المحفظة..." value="" />
                    {walletsDb.map(w => <Picker.Item key={w.id} label={w.name} value={w.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>التاريخ</Text>
                <TouchableOpacity 
                  style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', justifyContent: 'center' }]}
                  onPress={() => setShowExpenseDatePicker(true)}
                >
                  <Text style={{ color: isLightMode ? '#000' : '#fff', textAlign: 'center' }}>
                    {formatDateLocal(expenseDate)}
                  </Text>
                </TouchableOpacity>
                {showExpenseDatePicker && (
                  <DateTimePicker
                    value={expenseDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowExpenseDatePicker(false);
                      if (date) setExpenseDate(date);
                    }}
                  />
                )}
              </View>

              {/* Optionals: Page, Branch, Item */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>البيج (اختياري)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={expensePageId} onValueChange={setExpensePageId} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر البيج..." value="" />
                    {pagesStoresDb.map(p => <Picker.Item key={p.id} label={p.name} value={p.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>الفرع (اختياري)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={expenseBranchId} onValueChange={setExpenseBranchId} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر الفرع..." value="" />
                    {branchesDb.map(b => <Picker.Item key={b.id} label={b.name} value={b.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>الصنف (اختياري)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={expenseItemId} onValueChange={setExpenseItemId} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر الصنف..." value="" />
                    {baseProducts.concat(compositeProductsData).map(p => <Picker.Item key={p.id} label={p.name} value={p.id} />)}
                  </Picker>
                </View>
              </View>

              {/* Image and Tags */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>صور الفاتورة / الوصل (اختياري)</Text>
                <TouchableOpacity onPress={pickExpenseImage} style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', padding: 15, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#a855f7', fontWeight: 'bold' }}>{expenseImage ? 'تم اختيار صورة (تغيير)' : '📁 اختيار صور الفاتورة'}</Text>
                </TouchableOpacity>
              </View>

            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={{ backgroundColor: '#a855f7', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 }}
              onPress={handleSaveExpense}
              disabled={isUploadingExpense}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{isUploadingExpense ? 'جاري الحفظ...' : '💾 حفظ العملية'}</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      ) : activeTab === 'entry' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding} keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            
            {/* Section Title */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18 }}>👤</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e2e8f0', marginRight: 8 }}>بيانات الزبون والعنوان</Text>
            </View>

            {/* Employee Selector */}
            <View style={styles.formGroup}>
              <Text style={{ color: '#e9d5ff', fontWeight: 'bold', marginBottom: 8, textAlign: 'right' }}>موظفة الرد (التي حجزت الطلب) *</Text>
              <TouchableOpacity 
                style={[styles.modalTrigger, isFieldInvalid(selectedEmployeeId) && styles.inputError]}
                onPress={() => setEmpModalVisible(true)}
              >
                <Text style={selectedEmployeeId ? styles.triggerText : styles.triggerPlaceholder}>
                  {selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId)?.name : "-- اختر موظفة الرد --"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Receipt Number (Optional) */}
            <View style={styles.formGroup}>
              <TextInput 
                style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff' }]}
                value={customReceiptNumber}
                onChangeText={setCustomReceiptNumber}
                placeholder="رقم الوصل (اختياري، يملأ عبر الباركود)"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>

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

            {/* Governorate Modal Selector */}
            <View style={styles.formGroup}>
              <TouchableOpacity 
                style={[styles.modalTrigger, isFieldInvalid(governorate) && styles.inputError]}
                onPress={() => setGovModalVisible(true)}
              >
                <Text style={governorate ? styles.triggerText : styles.triggerPlaceholder}>
                  {governorate || "المحافظة *"}
                </Text>
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
                placeholder="ملاحظات أو تفاصيل أخرى حول التوصيل..."
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
                      value={customTotalAmount !== null ? customTotalAmount : (calculatedTotal === 0 ? '' : String(calculatedTotal))}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        let cleanVal = text.replace(/[^0-9]/g, '');
                        if (cleanVal.length > 1 && cleanVal.startsWith('0')) {
                          cleanVal = cleanVal.replace(/^0+/, '');
                          if (cleanVal === '') cleanVal = '0';
                        }
                        setCustomTotalAmount(cleanVal);
                      }}
                      onEndEditing={() => {
                        if (customTotalAmount === '0' || customTotalAmount === '') {
                          setCustomTotalAmount(null);
                        }
                      }}
                    />
                    <Text style={styles.totalCurrencyLabel}>د.ع</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyCartText}>السلة فارغة. اضغط على &quot;+ إضافة منتج&quot; للبدء.</Text>
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


            {/* Submit Button */}
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity 
                style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }, { flex: 1, marginRight: editingOrderId ? 8 : 0 }]}
                onPress={editingOrderId ? handleEditSubmit : handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingOrderId ? 'حفظ التعديلات' : '💾 حفظ وإرسال الطلب'}</Text>
                )}
              </TouchableOpacity>

              {editingOrderId && (
                <TouchableOpacity 
                  style={[styles.submitBtn, { backgroundColor: '#475569', flex: 1, marginLeft: 8 }]}
                  onPress={cancelEdit}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitBtnText}>إلغاء التعديل</Text>
                </TouchableOpacity>
              )}
            </View>
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
          <Text style={styles.sectionHeaderTitle}>قائمة الطلبات</Text>
          
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
                {(() => {
                  const filteredList = orders
                    
                    .filter((ord) => {
                      if (ordersFilter === 'completed') return ord.status === 'delivered' || ord.status === 'partial';
                      if (ordersFilter === 'active') return ord.status !== 'delivered' && ord.status !== 'partial' && ord.status !== 'cancelled' && ord.status !== 'returned';
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
                    });

                  if (filteredList.length === 0) {
                    return <Text style={styles.emptyText}>لا توجد نتائج مطابقة للبحث.</Text>;
                  }

                  return (
                    <>
                      <FlatList 
                        data={filteredList} 
                        keyExtractor={ord => ord.id}
                        initialNumToRender={25}
                        maxToRenderPerBatch={50}
                        windowSize={10}
                        contentContainerStyle={{ paddingBottom: 50 }}
                        renderItem={({item: ord}) => (
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
                              ord.status === 'partial' ? styles.badgePartial :
                              ord.status === 'returned' ? styles.badgeReturned :
                              ord.status === 'cancelled' ? styles.badgeCancelled :
                              ord.status === 'backordered' ? styles.badgeBackordered : styles.badgePending
                            ]}>
                              <Text style={styles.statusBadgeText}>
                                {ord.status === 'delivered' ? 'واصل' :
                                 ord.status === 'partial' ? 'واصل جزئي' :
                                 ord.status === 'returned' ? 'راجع' :
                                 ord.status === 'returned_warehouse' ? 'راجع مستلم بالمخزن' :
                                 ord.status === 'cancelled' ? 'ملغي' :
                                 ord.status === 'backordered' ? 'بانتظار المخزون' : 'قيد الانتظار'}
                              </Text>
                            </View>
                            
                            {(ord.status !== 'delivered' && ord.status !== 'cancelled' && ord.status !== 'returned_warehouse' && ord.status !== 'returned' && ord.status !== 'returned_agent') && (
                              <TouchableOpacity 
                                style={{ padding: 6, backgroundColor: 'rgba(168, 85, 247, 0.15)', borderRadius: 6, marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.4)' }}
                                onPress={() => handleEditOrder(ord)}
                              >
                                <Text style={{ color: '#e9d5ff', fontWeight: 'bold', fontSize: 12 }}>✏️ تعديل الطلب</Text>
                              </TouchableOpacity>
                            )}
                            
                            
                          </View>
                        </View>
                      )} 
                      />
                    </>
                  );
                })()}
              </View>
            </View>
            </Animated.View>
          </ScrollView>
        ) : activeTab === 'products_manager' ? (
        <View style={[styles.tabContent, { backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12' }]}>
          {/* Segmented Control */}
          <View style={{ flexDirection: 'row-reverse', padding: 15, backgroundColor: isLightMode ? '#fff' : '#1e293b', borderBottomWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: productsTab === 'products' ? '#a855f7' : 'transparent' }}
              onPress={() => setProductsTab('products')}
            >
              <Text style={{ fontWeight: 'bold', color: productsTab === 'products' ? '#a855f7' : (isLightMode ? '#64748b' : '#94a3b8') }}>الأصناف</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: productsTab === 'categories' ? '#a855f7' : 'transparent' }}
              onPress={() => setProductsTab('categories')}
            >
              <Text style={{ fontWeight: 'bold', color: productsTab === 'categories' ? '#a855f7' : (isLightMode ? '#64748b' : '#94a3b8') }}>الفئات</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: productsTab === 'pages' ? '#a855f7' : 'transparent' }}
              onPress={() => setProductsTab('pages')}
            >
              <Text style={{ fontWeight: 'bold', color: productsTab === 'pages' ? '#a855f7' : (isLightMode ? '#64748b' : '#94a3b8') }}>البيجات</Text>
            </TouchableOpacity>
          </View>

          {/* Content Lists */}
          <ScrollView contentContainerStyle={{ padding: 15 }}>
            {productsTab === 'products' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>قائمة الأصناف ({baseProducts.length})</Text>
                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }} onPress={() => setAddProductModalVisible(true)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ إضافة صنف</Text>
                  </TouchableOpacity>
                </View>
                {baseProducts.map(p => (
                  <View key={p.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{p.name}</Text>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 12 }}>
                      {/* Cost Card */}
                      <View style={{ flex: 1, backgroundColor: isLightMode ? '#fef2f2' : '#7f1d1d', padding: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: isLightMode ? '#ef4444' : '#fca5a5', marginBottom: 4, fontWeight: 'bold' }}>التكلفة</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isLightMode ? '#b91c1c' : '#fee2e2' }}>
                          {typeof p.cost === 'object' ? 0 : (p.cost || p.purchase || 0)}
                        </Text>
                      </View>

                      {/* Selling Card */}
                      <View style={{ flex: 1, backgroundColor: isLightMode ? '#f0fdf4' : '#14532d', padding: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: isLightMode ? '#22c55e' : '#86efac', marginBottom: 4, fontWeight: 'bold' }}>سعر البيع</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isLightMode ? '#15803d' : '#dcfce7' }}>
                          {typeof (p.selling || p.price) === 'object' ? 0 : (p.selling || p.price || 0)}
                        </Text>
                      </View>

                      {/* Quantity Card */}
                      <View style={{ flex: 1, backgroundColor: isLightMode ? '#eff6ff' : '#1e3a8a', padding: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: isLightMode ? '#3b82f6' : '#93c5fd', marginBottom: 4, fontWeight: 'bold' }}>العدد</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isLightMode ? '#1d4ed8' : '#dbeafe' }}>
                          {(() => {
                            if (typeof p.totalBaseQuantity === 'number') return p.totalBaseQuantity;
                            let stk = p.stock || p.quantity;
                            if (typeof stk === 'number' || typeof stk === 'string') return stk;
                            if (typeof stk === 'object' && stk !== null) {
                              let t = 0;
                              Object.keys(stk).forEach(k => { t += Number(stk[k]?.quantity) || 0; });
                              return t;
                            }
                            return 0;
                          })()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {productsTab === 'categories' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>الفئات ({branchesDb.length})</Text>
                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }} onPress={() => setAddCategoryModalVisible(true)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ إضافة فئة</Text>
                  </TouchableOpacity>
                </View>
                {branchesDb.map(c => (
                  <View key={c.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{c.name}</Text>
                  </View>
                ))}
              </>
            )}

            {productsTab === 'pages' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>البيجات ({pagesStoresDb.length})</Text>
                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }} onPress={() => setAddPageModalVisible(true)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ إضافة بيج</Text>
                  </TouchableOpacity>
                </View>
                {pagesStoresDb.map(pg => (
                  <View key={pg.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{pg.name}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
) : activeTab === 'settings' ? (
          <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
          {/* Settings Tab Content */}
          <View style={styles.tabHeaderCard}>
            <Text style={styles.tabHeaderTitle}>⚙️ إعدادات النظام</Text>
          </View>
          <View style={styles.statCardBig}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.profileLabel}>المظهر:</Text>
                <Text style={styles.profileValue}>{isLightMode ? 'فاتح' : 'داكن'}</Text>
              </View>
              <Switch 
                value={isLightMode} 
                onValueChange={setIsLightMode} 
                trackColor={{ false: '#334155', true: '#a855f7' }}
                thumbColor={isLightMode ? '#fff' : '#94a3b8'}
              />
            </View>
          </View>
  
          <View style={styles.statCardBig}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.profileLabel}>المظهر:</Text>
                <Text style={styles.profileValue}>{isLightMode ? 'فاتح' : 'داكن'}</Text>
              </View>
              <Switch 
                value={isLightMode} 
                onValueChange={setIsLightMode} 
                trackColor={{ false: '#334155', true: '#a855f7' }}
                thumbColor={isLightMode ? '#fff' : '#94a3b8'}
              />
            </View>
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

          <View style={styles.statCardBig}>
            <Text style={styles.profileLabel}>تسجيل الخروج:</Text>
            <Text style={styles.profileValue}>{user?.email}</Text>
            <TouchableOpacity 
              style={[styles.profileSwitchBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', marginTop: 10 }]} 
              onPress={handleLogout}
            >
              <Text style={[styles.profileSwitchBtnText, { color: '#ef4444' }]}>🚪 تسجيل الخروج</Text>
            </TouchableOpacity>
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
        ) : null}

      
      {activeTab === 'completed_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          {/* Header */}
          <View style={{ backgroundColor: '#10b951', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Filter Button Placeholder */}
              <TouchableOpacity onPress={() => {}}>
                 <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <Path d="M4 6h16M7 12h10M10 18h4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                 </Svg>
              </TouchableOpacity>
              
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                الشحنات المكتملة عدد الطلبيات { (() => {
                  let fc = orders.filter(o => (o.status === 'delivered' || o.status === 'delivered_settled'));
                  if (completedSubTab === 'accounted') fc = fc.filter(o => o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled')));
                  else fc = fc.filter(o => !(o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled'))));
                  if (completedSearchQuery.trim()) {
                    const q = completedSearchQuery.toLowerCase();
                    fc = fc.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
                  }
                  return fc.length;
                })() }
              </Text>

              {/* Back Button */}
              <TouchableOpacity onPress={() => setActiveTab('dashboard')}>
                 <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                 </Svg>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/>
                  <Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
               </Svg>
               <TextInput 
                 style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }}
                 placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)"
                 value={completedSearchQuery}
                 onChangeText={setCompletedSearchQuery}
               />
            </View>

            <View style={{ flexDirection: 'row', marginTop: 15, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' }}>
               {(() => {
                  const allC = orders.filter(o => (o.status === 'delivered' || o.status === 'delivered_settled'));
                  const acc = allC.filter(o => o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled'))).length;
                  const unacc = allC.length - acc;
                  return (
                    <>
                       <TouchableOpacity 
                          style={{ flex: 1, paddingVertical: 10, backgroundColor: completedSubTab === 'unaccounted' ? '#eab308' : '#fff' }}
                          onPress={() => setCompletedSubTab('unaccounted')}
                       >
                         <Text style={{ textAlign: 'center', color: completedSubTab === 'unaccounted' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>لم تتم المحاسبة ({unacc})</Text>
                       </TouchableOpacity>
                       <TouchableOpacity 
                          style={{ flex: 1, paddingVertical: 10, backgroundColor: completedSubTab === 'accounted' ? '#eab308' : '#fff' }}
                          onPress={() => setCompletedSubTab('accounted')}
                       >
                         <Text style={{ textAlign: 'center', color: completedSubTab === 'accounted' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>تم المحاسبة ({acc})</Text>
                       </TouchableOpacity>
                    </>
                  )
               })()}
            </View>
          </View>

          {/* List */}
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              // Filter completed
              let filtered = orders.filter(o => (o.status === 'delivered' || o.status === 'delivered_settled'));
              
              // Filter by sub tab
              if (completedSubTab === 'accounted') {
                filtered = filtered.filter(o => o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled')));
              } else {
                filtered = filtered.filter(o => !(o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled'))));
              }

              // Filter by search
              if (completedSearchQuery.trim()) {
                const q = completedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => 
                  (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) ||
                  (o.customerName && String(o.customerName).toLowerCase().includes(q)) ||
                  (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q))
                );
              }

              if (filtered.length === 0) {
                return (
                  <View style={{ marginTop: 50, alignItems: 'center' }}>
                     <Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text>
                  </View>
                );
              }

              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#10b951' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', fontWeight: 'bold', color: '#333' }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
            <View style={{height: 50}} />
          </ScrollView>
        </View>
      )}

      {/* Bottom Tabs Navigation */}
      <View style={styles.bottomNav}>
        {/* Right: بياناتي (dashboard) */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          {renderReportsIcon(activeTab === 'dashboard')}
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>بياناتي</Text>
        </TouchableOpacity>

        {/* Center-Right: طلبيات (orders) */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'orders' && styles.navItemActive]}
          onPress={() => setActiveTab('orders')}
        >
          {renderOrdersIcon(activeTab === 'orders')}
          <Text style={[styles.navText, activeTab === 'orders' && styles.navTextActive]}>طلبيات</Text>
        </TouchableOpacity>

        {/* Center-Left: Floating + (entry) */}
        <View style={[styles.centerNavWrapper, { marginTop: -40, flex: 1.2 }]}>
          <TouchableOpacity 
            style={[styles.centerNavBtn, { backgroundColor: 'transparent', borderWidth: 0, width: 68, height: 68, shadowColor: 'transparent', elevation: 0 }, activeTab === 'entry' && styles.centerNavBtnActive]}
            onPress={() => setPlusMenuVisible(true)}
          >
            <Svg width="76" height="76" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
              <Polygon points="50 5, 93 30, 93 70, 50 95, 7 70, 7 30" fill="#a855f7" stroke="#8b5cf6" strokeWidth="6" />
              <Polygon points="50 12, 85 32, 85 68, 50 88, 15 68, 15 32" fill="transparent" stroke="#d8b4fe" strokeWidth="3" />
            </Svg>
            <Text style={[styles.centerNavIcon, { zIndex: 2, fontSize: 34, color: 'white', marginTop: -4, fontWeight: '500' }]}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Left: المنتجات (settings) */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'products_manager' && styles.navItemActive]}
          onPress={() => setActiveTab('products_manager')}
        >
          {renderProductsIcon(activeTab === 'products_manager')}
          <Text style={[styles.navText, activeTab === 'products_manager' && styles.navTextActive]}>المنتجات</Text>
        </TouchableOpacity>
      </View>

      {/* --- Modals Section --- */}

      {/* Plus Menu Modal (Action Sheet) */}
      <Modal visible={plusMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setPlusMenuVisible(false)}>
          <View style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, alignItems: 'center' }}>
            <View style={{ width: 40, height: 5, backgroundColor: isLightMode ? '#cbd5e1' : '#475569', borderRadius: 5, marginBottom: 20 }} />
            
            <TouchableOpacity style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155' }} onPress={() => { setPlusMenuVisible(false); setActiveTab('entry'); }}>
              <Text style={{ fontSize: 18, color: isLightMode ? '#1e293b' : '#f8fafc', fontWeight: 'bold' }}>📦 إضافة طلب</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155' }} onPress={() => { setPlusMenuVisible(false); setActiveTab('add_expense'); }}>
              <Text style={{ fontSize: 18, color: isLightMode ? '#1e293b' : '#f8fafc', fontWeight: 'bold' }}>💸 إضافة مصروف</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15 }} onPress={() => { setPlusMenuVisible(false); setAddBarcodeModalVisible(true); }}>
              <Text style={{ fontSize: 18, color: isLightMode ? '#1e293b' : '#f8fafc', fontWeight: 'bold' }}>🧾 إضافة وصل باركود</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Expense Modal */}
      <Modal visible={addExpenseModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>إضافة مصروف جديد</Text>
            
            <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
              <Picker selectedValue={newExpenseCategory} onValueChange={setNewExpenseCategory} style={{ color: isLightMode ? '#000' : '#fff' }}>
                <Picker.Item label="-- الفئة --" value="" />
                {expenseCategoriesDb.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
              </Picker>
            </View>

            <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
              <Picker selectedValue={newExpenseWallet} onValueChange={setNewExpenseWallet} style={{ color: isLightMode ? '#000' : '#fff' }}>
                <Picker.Item label="-- الخزنة (للسحب منها) --" value="" />
                {walletsDb.map(w => <Picker.Item key={w.id} label={w.name} value={w.id} />)}
              </Picker>
            </View>

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', flex: 1, marginLeft: 10, textAlign: 'right' }]} placeholder="المبلغ" placeholderTextColor="#64748b" keyboardType="numeric" value={newExpenseAmount} onChangeText={setNewExpenseAmount} />
              
              <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, flex: 0.5, marginBottom: 10 }}>
                <Picker selectedValue={newExpenseCurrency} onValueChange={setNewExpenseCurrency} style={{ color: isLightMode ? '#000' : '#fff' }}>
                  <Picker.Item label="د.ع" value="IQD" />
                  <Picker.Item label="$" value="USD" />
                </Picker>
              </View>
            </View>

            <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', textAlign: 'right', height: 80, textAlignVertical: 'top' }]} placeholder="التفاصيل / ملاحظات" placeholderTextColor="#64748b" multiline value={newExpenseDetails} onChangeText={setNewExpenseDetails} />

            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleSaveExpense}><Text style={styles.modalCloseText}>حفظ المصروف</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => setAddExpenseModalVisible(false)}><Text style={styles.modalCloseText}>إغلاق</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Barcode Receipt Modal */}
      <Modal visible={addBarcodeModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b', width: '90%', height: '80%' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>مسح وصل الباركود 📸</Text>
            
            <View style={{ flex: 1, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              {!cameraPermission ? (
                 <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                   <ActivityIndicator size="large" color="#a855f7" />
                 </View>
              ) : !cameraPermission.granted ? (
                 <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                   <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 15 }}>نحتاج إلى صلاحية الكاميرا لمسح الباركود</Text>
                   <TouchableOpacity style={{ backgroundColor: '#a855f7', padding: 10, borderRadius: 8 }} onPress={requestCameraPermission}>
                     <Text style={{ color: '#fff', fontWeight: 'bold' }}>منح الصلاحية</Text>
                   </TouchableOpacity>
                 </View>
              ) : (
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />
              )}
            </View>

            <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right', fontWeight: 'bold' }}>أو أدخل رقم الوصل يدوياً:</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', textAlign: 'right', fontSize: 18, marginBottom: 15 }]} 
              placeholder="رقم الوصل..." 
              placeholderTextColor="#64748b" 
              value={newBarcodeReceipt} 
              onChangeText={setNewBarcodeReceipt} 
            />

            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleSaveBarcodeReceipt}>
              <Text style={styles.modalCloseText}>متابعة وإضافة طلب ➡️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => { setAddBarcodeModalVisible(false); setScanned(false); }}>
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


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

    
      {showStartDatePicker && (
        <DateTimePicker
          value={tempCustomStartDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) setTempCustomStartDate(selectedDate);
          }}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={tempCustomEndDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) setTempCustomEndDate(selectedDate);
          }}
        />
      )}
    
            {/* 5. Date Filter Modal */}
      <Modal visible={dateFilterModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تصفية التاريخ</Text>
            
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 15 }}>
              {[
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'today_and_yesterday', label: 'اليوم وأمس' },
                { id: 'last_7_days', label: 'آخر 7 أيام' },
                { id: 'last_30_days', label: 'آخر 30 يوم' },
                { id: 'last_60_days', label: 'آخر 60 يوم' },
                { id: 'last_90_days', label: 'آخر 90 يوم' },
                { id: 'year', label: 'سنة' },
                { id: 'all_time', label: 'فترة مطلقة' }
              ].map(filter => (
                <TouchableOpacity 
                  key={filter.id}
                  onPress={() => setTempGlobalDateFilter(filter.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: tempGlobalDateFilter === filter.id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(30, 30, 40, 0.65)',
                    borderWidth: 1,
                    borderColor: tempGlobalDateFilter === filter.id ? '#a855f7' : '#475569',
                  }}
                >
                  <Text style={{ 
                    color: tempGlobalDateFilter === filter.id ? '#e9d5ff' : '#cbd5e1',
                    fontWeight: tempGlobalDateFilter === filter.id ? 'bold' : 'normal',
                    fontSize: 13
                  }}>{filter.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={() => setTempGlobalDateFilter('custom')}>
              <Text style={{ color: tempGlobalDateFilter === 'custom' ? '#a855f7' : '#ffffff', marginBottom: 10, textAlign: 'right', fontWeight: 'bold' }}>تاريخ مخصص:</Text>
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, opacity: tempGlobalDateFilter === 'custom' ? 1 : 0.5 }}>
              <TouchableOpacity 
                style={{ flex: 1, marginLeft: 8, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                   setTempGlobalDateFilter('custom');
                   setShowStartDatePicker(true);
                }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>من تاريخ</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{formatDateLocal(tempCustomStartDate)}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ flex: 1, marginRight: 8, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                   setTempGlobalDateFilter('custom');
                   setShowEndDatePicker(true);
                }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>إلى تاريخ</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{formatDateLocal(tempCustomEndDate)}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setTempGlobalDateFilter('specific_month')}>
               <Text style={{ color: tempGlobalDateFilter === 'specific_month' ? '#a855f7' : '#ffffff', marginBottom: 10, textAlign: 'right', fontWeight: 'bold' }}>تحديد شهر وسنة:</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 25, opacity: tempGlobalDateFilter === 'specific_month' ? 1 : 0.5 }}>
              <View style={{ flex: 1, marginLeft: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterMonth(prev => prev === 11 ? 0 : prev + 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>+</Text></TouchableOpacity>
                  <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{tempFilterMonth + 1}</Text>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterMonth(prev => prev === 0 ? 11 : prev - 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>-</Text></TouchableOpacity>
              </View>
              
              <View style={{ flex: 1, marginRight: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterYear(prev => prev + 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>+</Text></TouchableOpacity>
                  <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{tempFilterYear}</Text>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterYear(prev => prev - 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>-</Text></TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
               <TouchableOpacity 
                 style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center', flex: 1, marginLeft: 5 }}
                 onPress={() => {
                   setGlobalDateFilter(tempGlobalDateFilter);
                   setCustomStartDate(tempCustomStartDate);
                   setCustomEndDate(tempCustomEndDate);
                   setFilterMonth(tempFilterMonth);
                   setFilterYear(tempFilterYear);
                   setDateFilterModalVisible(false);
                 }}
               >
                 <Text style={{ color: '#fff', fontWeight: 'bold' }}>موافق</Text>
               </TouchableOpacity>
               
               <TouchableOpacity 
                 style={{ backgroundColor: '#334155', padding: 12, borderRadius: 8, alignItems: 'center', flex: 1, marginRight: 5 }}
                 onPress={() => setDateFilterModalVisible(false)}
               >
                 <Text style={{ color: '#fff', fontWeight: 'bold' }}>إلغاء</Text>
               </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showStartDatePicker && (
        <DateTimePicker
          value={customStartDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) setCustomStartDate(selectedDate);
          }}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={customEndDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) setCustomEndDate(selectedDate);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (isLightMode) => StyleSheet.create({
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
    fontSize: 16,
  },
  header: {
    height: 60,
    backgroundColor: 'rgba(30, 30, 40, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  newStatLabel: {
    fontSize: 12,
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: isLightMode ? 'rgba(15, 23, 42, 0.02)' : isLightMode ? 'rgba(15, 23, 42, 0.02)' : 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.03)' : isLightMode ? 'rgba(15, 23, 42, 0.03)' : 'rgba(255, 255, 255, 0.03)',
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
  badgePartial: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.08)' : isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.1)' : isLightMode ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 180,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: isLightMode ? 'rgba(15, 23, 42, 0.03)' : isLightMode ? 'rgba(15, 23, 42, 0.03)' : 'rgba(255, 255, 255, 0.03)',
    alignItems: 'flex-end',
  },
  dropdownItemTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  dropdownItemSubtitle: {
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalTrigger: {
    backgroundColor: 'rgba(30, 30, 40, 0.65)',
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.08)' : isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
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
    color: isLightMode ? 'rgba(15, 23, 42, 0.3)' : isLightMode ? 'rgba(15, 23, 42, 0.3)' : 'rgba(255, 255, 255, 0.3)',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  triggerArrow: {
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
    fontSize: 12,
  },
  cartSection: {
    backgroundColor: 'rgba(30, 30, 40, 0.3)',
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.04)' : isLightMode ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.04)',
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
    backgroundColor: isLightMode ? 'rgba(15, 23, 42, 0.02)' : isLightMode ? 'rgba(15, 23, 42, 0.02)' : 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.03)' : isLightMode ? 'rgba(15, 23, 42, 0.03)' : 'rgba(255, 255, 255, 0.03)',
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.08)' : isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
    fontSize: 11,
    marginRight: 4,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  multiplierLabel: {
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    backgroundColor: isLightMode ? 'rgba(15, 23, 42, 0.08)' : isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.08)' : isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
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
    borderTopColor: isLightMode ? 'rgba(15, 23, 42, 0.1)' : isLightMode ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.08)' : isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.08)' : isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  paymentBtnActive: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  paymentBtnText: {
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    borderTopColor: isLightMode ? 'rgba(15, 23, 42, 0.08)' : isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
    marginBottom: 2,
  },
  navIconActive: {
    color: '#a855f7',
  },
  navText: {
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.2)' : isLightMode ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.2)',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: isLightMode ? 'rgba(15, 23, 42, 0.03)' : isLightMode ? 'rgba(15, 23, 42, 0.03)' : 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    borderBottomColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  modalItemText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalCloseBtn: {
    backgroundColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
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
    borderBottomColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
  },
  productPriceText: {
    color: '#a78bfa',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  emptySearchText: {
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
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
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.1)' : isLightMode ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: '#121216',
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authSubtitle: {
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authCard: {
    backgroundColor: '#1e1e24',
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authInput: {
    backgroundColor: isLightMode ? 'rgba(15, 23, 42, 0.05)' : isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.1)' : isLightMode ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'right',
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: '#a78bfa',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authSubmitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  authSubmitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authToggleBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  authToggleText: {
    color: '#a78bfa',
    fontSize: 14,
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
    backgroundColor: isLightMode ? 'rgba(15, 23, 42, 0.08)' : isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
  },
  authSeparatorText: {
    color: isLightMode ? isLightMode ? isLightMode ? '#475569' : '#94a3b8' : '#475569' : isLightMode ? '#475569' : '#94a3b8',
    fontSize: 12,
    marginHorizontal: 10,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authGoogleBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: isLightMode ? 'rgba(15, 23, 42, 0.02)' : isLightMode ? 'rgba(15, 23, 42, 0.02)' : 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(15, 23, 42, 0.12)' : isLightMode ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 2,
  },
  authGoogleBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  }
});
