"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
import { signInAnonymously } from 'firebase/auth';
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

interface Product {
  id: string;
  name: string;
  barcode: string;
  units: any[];
  stock: Record<string, { quantity: number; reserved?: number; unit: string }>;
  isComposite?: boolean;
  composition?: any[];
  categoryId?: string;
  subcategoryId?: string;
}

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
}

function QuickEntryContent() {
  const [loading, setLoading] = useState(true);
  const [targetUid, setTargetUid] = useState<string>('');
  const [isPublicClient, setIsPublicClient] = useState<boolean>(false);
  const [showShareNotification, setShowShareNotification] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerPhone2: '',
    governorate: '',
    region: '',
    notes: '',
    paymentMethod: 'كاش عند التوصيل',
    fbLoginId: ''
  });

  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedResponseEmployeeId, setSelectedResponseEmployeeId] = useState('');
  const [currentUserInfo, setCurrentUserInfo] = useState<{ name: string; id: string; role: 'employee' | 'owner' | 'public' }>({
    name: 'طلب مباشر (الزبون)',
    id: 'public_client',
    role: 'public'
  });
  const [baseProducts, setBaseProducts] = useState<Product[]>([]);
  const [compositeProductsData, setCompositeProductsData] = useState<any[]>([]);
  const [customersDb, setCustomersDb] = useState<any[]>([]);
  const [ordersMatches, setOrdersMatches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [customTotalAmount, setCustomTotalAmount] = useState<string>('');
  const [isTotalOverridden, setIsTotalOverridden] = useState(false);

  useEffect(() => {
    setCustomTotalAmount('');
    setIsTotalOverridden(false);
  }, [cart]);

  
  // UI states
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [showGovDropdown, setShowGovDropdown] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [notificationModal, setNotificationModal] = useState({ show: false, message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const governoratesList = [
    "بغداد", "البصرة", "نينوى (الموصل)", "أربيل", "النجف", "ذي قار (الناصرية)",
    "كركوك", "الأنبار (الرمادي)", "ديالى (بعقوبة)", "المثنى (السماوة)",
    "القادسية (الديوانية)", "ميسان (العمارة)", "واسط (الكوت)", "صلاح الدين (تكريت)",
    "دهوك", "السليمانية", "بابل (الحلة)", "كربلاء"
  ];

  // Initialize and check URL parameters for public access & listen to auth
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramUid = params.get('uid') || params.get('store');
      
      if (paramUid) {
        setTargetUid(paramUid);
        setIsPublicClient(true);
      }
      
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user && !user.isAnonymous) {
          try {
            // Check if user is a mapped employee
            const mappingSnap = await getDoc(doc(db, 'employee_mappings', user.uid));
            if (mappingSnap.exists()) {
              const mapData = mappingSnap.data();
              const adminUid = mapData.adminUid;
              const empId = mapData.employeeId;
              
              if (!paramUid) {
                setTargetUid(adminUid);
                setIsPublicClient(false);
              }
              
              // Fetch employee details to get their actual name
              const empSnap = await getDoc(doc(db, 'users', adminUid, 'employees', empId));
              if (empSnap.exists()) {
                const empData = empSnap.data();
                setCurrentUserInfo({
                  name: empData.name || 'موظف',
                  id: empId,
                  role: 'employee'
                });
                setSelectedEmployeeId(empId);
                return;
              }
            }
            
            // If they are logged in but not mapped, they are the owner
            if (!paramUid) {
              setTargetUid(user.uid);
              setIsPublicClient(false);
            }
            setCurrentUserInfo({
              name: 'المالك 👑',
              id: 'owner',
              role: 'owner'
            });
          } catch (err) {
            console.error("Error loading auth info:", err);
          }
        } else {
          // If not logged in at all, sign in anonymously if a paramUid was supplied
          if (paramUid) {
            signInAnonymously(auth).catch(err => console.error("Anonymous authentication failed:", err));
          } else {
            // Fallback for public visitor without credentials
            setTargetUid('anonymous');
            setIsPublicClient(true);
            signInAnonymously(auth).catch(err => console.error("Anonymous auth fallback failed:", err));
          }
          setCurrentUserInfo({ name: 'طلب مباشر (الزبون)', id: 'public_client', role: 'public' });
        }
      });
      return unsubscribe;
    }
  }, []);

  // Fetch categories
  useEffect(() => {
    if (!targetUid) return;
    const unsub = onSnapshot(collection(db, 'users', targetUid, 'categories'), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(cats);
    });
    return () => unsub();
  }, [targetUid]);

  // Fetch employees
  useEffect(() => {
    if (!targetUid) return;
    const unsub = onSnapshot(collection(db, 'users', targetUid, 'employees'), (snapshot) => {
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(empData.filter((e: any) => e.isActive));
    });
    const savedEmpId = localStorage.getItem('selectedEmployeeId');
    if (savedEmpId) setSelectedEmployeeId(savedEmpId);
    return () => unsub();
  }, [targetUid]);

  // Fetch base products
  useEffect(() => {
    if (!targetUid) return;
    const unsub = onSnapshot(collection(db, 'users', targetUid, 'products'), (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setBaseProducts(pData);
    });
    return () => unsub();
  }, [targetUid]);

  // Fetch composite products
  useEffect(() => {
    if (!targetUid) return;
    const unsub = onSnapshot(collection(db, 'users', targetUid, 'composite_products'), (snapshot) => {
      const cData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompositeProductsData(cData);
    });
    return () => unsub();
  }, [targetUid]);

  // Fetch customers
  useEffect(() => {
    if (!targetUid) return;
    const unsub = onSnapshot(collection(db, 'users', targetUid, 'customers'), (snapshot) => {
      setCustomersDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [targetUid]);

  // Phone search for auto-fill matching
  useEffect(() => {
    const phoneQuery = formData.customerPhone.trim();
    if (phoneQuery.length < 10 || !targetUid) {
      setOrdersMatches([]);
      return;
    }
    const searchOrders = async () => {
      try {
        const qPhone = fsQuery(
          collection(db, 'users', targetUid, 'orders'), 
          where('customerPhone', '>=', phoneQuery), 
          where('customerPhone', '<=', phoneQuery + '\uf8ff'),
          limit(3)
        );
        const snapPhone = await getDocs(qPhone);
        const matches: any[] = [];
        snapPhone.forEach(doc => {
          const d = doc.data();
          matches.push({
            id: 'ord-' + doc.id,
            name: d.customerName,
            phone: d.customerPhone,
            province: d.governorate,
            area: d.region,
            source: 'archive'
          });
        });
        setOrdersMatches(matches);
      } catch (err) {
        console.error("Phone search error:", err);
      }
    };
    const timer = setTimeout(searchOrders, 300);
    return () => clearTimeout(timer);
  }, [formData.customerPhone, targetUid]);

  // Combined product lists
  const productsList = React.useMemo(() => {
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
        composition: cp.composition || [],
        categoryId: cp.categoryId || ''
      } as any);
    });
    return merged;
  }, [baseProducts, compositeProductsData]);

  // Filtered products list shown in the catalog
  const filteredProducts = React.useMemo(() => {
    let list = productsList;
    
    // 1. Filter by category
    if (selectedCategoryId !== 'all') {
      list = list.filter(p => p.categoryId === selectedCategoryId);
    }
    
    // 2. Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.name?.toLowerCase().includes(query) || 
        p.barcode?.toLowerCase() === query
      );
    }
    
    return list;
  }, [productsList, selectedCategoryId, searchQuery]);

  // Handlers
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'customerPhone') {
      setShowPhoneDropdown(true);
    }
  };

  const handleSelectCustomer = (cust: any) => {
    setFormData(prev => ({
      ...prev,
      customerName: cust.name,
      customerPhone: cust.phone,
      governorate: cust.province || cust.governorate || '',
      region: cust.area || cust.region || ''
    }));
    setShowPhoneDropdown(false);
  };

  const filteredCustomersByPhone = React.useMemo(() => {
    const phoneQuery = formData.customerPhone.trim();
    if (phoneQuery.length < 10) return [];
    const list: any[] = [];
    const matched = customersDb
      .filter(c => c.phone.includes(phoneQuery))
      .map(c => ({ ...c, source: 'record' }));
    list.push(...matched);
    ordersMatches.forEach(om => {
      if (om.phone.includes(phoneQuery) && !list.find(i => i.phone === om.phone)) {
        list.push(om);
      }
    });
    return list;
  }, [customersDb, ordersMatches, formData.customerPhone]);

  const isValidPhoneNumber = (phone: string) => {
    return /^(\+?\d{10,15})$/.test(phone.replace(/\s+/g, ''));
  };

  const isPhoneInvalid = hasAttemptedSubmit && !isValidPhoneNumber(formData.customerPhone);

  const isFieldInvalid = (fieldName: keyof typeof formData) => {
    if (!hasAttemptedSubmit) return false;
    if (fieldName === 'notes' || fieldName === 'fbLoginId' || fieldName === 'customerPhone2' || fieldName === 'customerName') return false;
    if (fieldName === 'customerPhone') return isPhoneInvalid;
    return formData[fieldName].trim() === '';
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        const price = (product.units && product.units.length > 0) ? product.units[0].selling : 0;
        return [...prev, { id: product.id, product, quantity: 1, unitPrice: price }];
      }
    });
  };

  const updateCartQuantity = (id: string, qty: number) => {
    if (qty < 1) {
      removeFromCart(id);
      return;
    }
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const calculatedTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalAmount = isTotalOverridden ? (Number(customTotalAmount) || 0) : calculatedTotal;

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}/mobile/quick-entry?uid=${targetUid}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShowShareNotification(true);
        setTimeout(() => setShowShareNotification(false), 3000);
      }).catch(err => {
        console.error("Failed to copy link:", err);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    if (currentUserInfo.role === 'owner' && !selectedEmployeeId) {
      alert("يرجى اختيار الموظف مُدخل الطلب أولاً.");
      return;
    }

    if (!selectedResponseEmployeeId) {
      alert("يرجى اختيار موظفة الرد التي قامت بالحجز.");
      return;
    }

    if (
      !isValidPhoneNumber(formData.customerPhone) ||
      formData.governorate.trim() === '' ||
      formData.region.trim() === ''
    ) {
      return;
    }

    if (cart.length === 0) {
      alert("سلة المشتريات فارغة!");
      return;
    }

    setIsSubmitting(true);

    try {
      const counterRef = doc(db, 'users', targetUid, 'metadata', 'orderCounter');
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
      const newOrderRef = doc(db, 'users', targetUid, 'orders', nextId.toString());
      const emp = employees.find(empItem => empItem.id === selectedEmployeeId);

      let isOrderBackordered = false;

      // Check stock availability
      for (const item of cart) {
        const productData = item.product as any;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', targetUid, 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let totalAvailable = 0;
              Object.values(rawData.stock || {}).forEach((s: any) => {
                const uMul = rawData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                totalAvailable += ((Number(s.quantity) || 0) - (Number(s.reserved) || 0)) * uMul;
              });
              if (totalAvailable < component.quantityNeeded * item.quantity) {
                isOrderBackordered = true;
              }
            }
          }
        } else {
          const prodRef = doc(db, 'users', targetUid, 'products', item.product.id);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let totalAvailable = 0;
            Object.values(prodData.stock || {}).forEach((s: any) => {
              const uMul = prodData.units?.find((u: any) => u.type === s.unit)?.count || 1;
              totalAvailable += ((Number(s.quantity) || 0) - (Number(s.reserved) || 0)) * uMul;
            });
            if (totalAvailable < item.quantity) {
              isOrderBackordered = true;
            }
          }
        }
      }

      const responseEmp = employees.find(empItem => empItem.id === selectedResponseEmployeeId);
      
      let orderEmployeeId = 'public_client';
      let orderEmployeeName = 'طلب مباشر (الزبون)';
      
      if (currentUserInfo.role === 'employee') {
        orderEmployeeId = currentUserInfo.id;
        orderEmployeeName = currentUserInfo.name;
      } else if (currentUserInfo.role === 'owner') {
        const emp = employees.find(empItem => empItem.id === selectedEmployeeId);
        orderEmployeeId = selectedEmployeeId;
        orderEmployeeName = emp?.name || 'مجهول';
      }

      const orderData = {
        employeeId: selectedResponseEmployeeId,
        employeeName: responseEmp?.name || 'غير محدد',
        responseEmployeeId: selectedResponseEmployeeId,
        responseEmployeeName: responseEmp?.name || 'غير محدد',
        creatorEmployeeId: orderEmployeeId,
        creatorEmployeeName: orderEmployeeName,
        customerName: orderEmployeeName,
        customerPhone: formData.customerPhone,
        customerPhone2: formData.customerPhone2,
        governorate: formData.governorate,
        region: formData.region,
        notes: formData.notes,
        paymentMethod: formData.paymentMethod,
        fbLoginId: formData.fbLoginId,
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
        const productData = item.product as any;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', targetUid, 'products', component.itemId);
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
          const prodRef = doc(db, 'users', targetUid, 'products', item.product.id);
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

      try {
        const orderId = newOrderRef.id;
        for (const item of cart) {
          fetch('/api/webhooks/meta-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: item.id,
              value: item.quantity * item.unitPrice,
              currency: 'IQD',
              phone: formData.customerPhone,
              firstName: formData.customerName.split(' ')[0] || formData.customerName,
              state: formData.governorate,
              externalId: orderId,
              fb_login_id: formData.fbLoginId
            })
          }).catch(err => console.error("Webhook error:", err));
        }
      } catch (webhookErr) {
        console.error("Failed to trigger webhook:", webhookErr);
      }

      setNotificationModal({ show: true, message: '✨ تم حفظ طلبك بنجاح! شكراً لك.' });
      
      // Reset
      setHasAttemptedSubmit(false);
      setSelectedResponseEmployeeId('');
      setFormData({
        customerName: '', 
        customerPhone: '', 
        customerPhone2: '', 
        governorate: '', 
        region: '', 
        notes: '',
        paymentMethod: 'كاش عند التوصيل',
        fbLoginId: ''
      });
      setCart([]);
      setCustomTotalAmount('');
      setIsTotalOverridden(false);
      setSearchQuery('');

    } catch (err) {
      console.error("Submit order error:", err);
      alert("حدث خطأ أثناء حفظ الطلب. يرجى المحاولة لاحقاً.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedEmployeeName = currentUserInfo.role === 'employee'
    ? currentUserInfo.name
    : (currentUserInfo.role === 'owner'
       ? (employees.find(e => e.id === selectedEmployeeId)?.name || 'المالك 👑')
       : 'طلب مباشر (الزبون)');

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <span>جاري التحضير...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>إدخال الطلبات السريع ⚡</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Share Button (Hidden for public clients) */}
          {!isPublicClient && targetUid && (
            <button 
              type="button" 
              className={styles.shareBtn} 
              onClick={handleCopyLink}
              title="نسخ رابط الطلب المباشر للزبائن"
            >
              🔗 مشاركة الرابط
            </button>
          )}

          <div className={styles.employeeBadge} title={selectedEmployeeName}>
            <span>👤 {selectedEmployeeName}</span>
          </div>
        </div>
      </header>

      {/* Copy Alert Banner */}
      {showShareNotification && (
        <div className={styles.shareNotification}>
          📋 تم نسخ رابط المشاركة بنجاح! أرسله الآن للمستخدمين أو الزبائن.
        </div>
      )}

      {/* Main Content */}
      <main className={styles.mainContent}>
        
        {/* Employee Selection (Only shown for Owner if not selected yet) */}
        {currentUserInfo.role === 'owner' && !selectedEmployeeId && (
          <div className={styles.sectionCard} style={{ borderColor: 'rgba(139, 92, 246, 0.5)' }}>
            <h2 className={styles.sectionTitle}>مُدخل الطلب</h2>
            <div className={styles.formGroup}>
              <select 
                className={`${styles.input} ${styles.select}`}
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  localStorage.setItem('selectedEmployeeId', e.target.value);
                }}
              >
                <option value="">-- من أنت؟ --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Customer Information Form */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>👤 بيانات الزبون والعنوان</h2>
          
          {/* Response Employee Dropdown */}
          <div className={styles.formGroup} style={{ marginBottom: '0.25rem' }}>
            <label className={styles.label} style={{ color: '#c4b5fd', fontWeight: 'bold' }}>موظفة الرد (التي حجزت الطلب) *</label>
            <select 
              className={`${styles.input} ${styles.select} ${hasAttemptedSubmit && !selectedResponseEmployeeId ? styles.inputError : ''}`}
              value={selectedResponseEmployeeId}
              onChange={(e) => setSelectedResponseEmployeeId(e.target.value)}
            >
              <option value="">-- اختر موظفة الرد --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.dropdownContainer}>
              <input 
                type="tel" 
                name="customerPhone"
                className={`${styles.input} ${isPhoneInvalid ? styles.inputError : ''}`}
                value={formData.customerPhone}
                onChange={handleFormChange}
                onFocus={() => setShowPhoneDropdown(true)}
                onBlur={() => setTimeout(() => setShowPhoneDropdown(false), 200)}
                placeholder="رقم هاتف الزبون *"
                autoComplete="off"
              />
              {/* Only show past customer matching if it is an internal employee, not a public customer */}
              {!isPublicClient && showPhoneDropdown && formData.customerPhone.trim().length >= 10 && filteredCustomersByPhone.length > 0 && (
                <ul className={styles.dropdownList}>
                  {filteredCustomersByPhone.map((customer: any, idx: number) => (
                    <li 
                      key={idx} 
                      className={styles.dropdownItem}
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <div className={styles.customerRow}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600' }}>{customer.name}</span>
                          <span className={styles.dropdownSubtext}>{customer.phone}</span>
                        </div>
                        <span className={`${styles.badge} ${customer.source === 'record' ? styles.record : styles.archive}`}>
                          {customer.source === 'record' ? 'سجل' : 'أرشيف'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {isPhoneInvalid && <span className={styles.errorMessage}>رقم هاتف غير صالح</span>}
          </div>



          <div className={styles.formGroup}>
            <div className={styles.dropdownContainer}>
              <input 
                type="text" 
                name="governorate"
                className={`${styles.input} ${isFieldInvalid('governorate') ? styles.inputError : ''}`}
                value={formData.governorate}
                onChange={(e) => {
                  handleFormChange(e);
                  setShowGovDropdown(true);
                }}
                onFocus={() => setShowGovDropdown(true)}
                onBlur={() => setTimeout(() => setShowGovDropdown(false), 200)}
                placeholder="المحافظة *"
                autoComplete="off"
              />
              {showGovDropdown && (
                <ul className={styles.dropdownList}>
                  {governoratesList
                    .filter(gov => gov.includes(formData.governorate))
                    .map((gov, index) => (
                      <li 
                         key={index} 
                        className={styles.dropdownItem}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, governorate: gov }));
                          setShowGovDropdown(false);
                        }}
                      >
                        {gov}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <input 
              type="text" 
              name="region"
              className={`${styles.input} ${isFieldInvalid('region') ? styles.inputError : ''}`}
              value={formData.region}
              onChange={handleFormChange}
              placeholder="المنطقة / العنوان بالتفصيل *"
            />
          </div>

          <div className={styles.formGroup}>
             <input 
              type="tel" 
              name="customerPhone2"
              className={styles.input}
              value={formData.customerPhone2}
              onChange={handleFormChange}
              placeholder="رقم هاتف إضافي (اختياري)"
              autoComplete="off"
            />
          </div>
          
          <div className={styles.formGroup}>
             <textarea 
              name="notes"
              className={styles.input}
              value={formData.notes}
              onChange={handleFormChange}
              placeholder="ملاحظات أو تفاصيل أخرى حول التوصيل..."
            />
          </div>
        </div>

        {/* Product Selection Catalog Section */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>🛍️ كتالوج المنتجات</h2>

          {/* Search bar inside Catalog */}
          <div className={styles.searchContainer}>
            <input 
              type="text" 
              placeholder="ابحث بالاسم أو الباركود..."
              className={`${styles.input} ${styles.searchInput}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className={styles.searchIcon}>🔍</span>
          </div>

          {/* Category tabs */}
          {categories.length > 0 && (
            <div className={styles.categoriesContainer}>
              <button 
                type="button" 
                className={`${styles.categoryTab} ${selectedCategoryId === 'all' ? styles.categoryTabActive : ''}`}
                onClick={() => setSelectedCategoryId('all')}
              >
                الكل 📦
              </button>
              {categories.map((cat) => (
                <button 
                  key={cat.id} 
                  type="button" 
                  className={`${styles.categoryTab} ${selectedCategoryId === cat.id ? styles.categoryTabActive : ''}`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Product Catalog Grid Layout */}
          <div className={styles.productCatalogGrid}>
            {filteredProducts.map(product => {
              const price = product.units?.[0]?.selling || 0;
              const cartItem = cart.find(item => item.id === product.id);
              
              // Calculate stock count
              let stockCount = 0;
              if (product.stock) {
                Object.values(product.stock).forEach((s: any) => {
                  stockCount += (Number(s.quantity) || 0) - (Number(s.reserved) || 0);
                });
              }

              return (
                <div key={product.id} className={styles.productCard}>
                  <div className={styles.productMeta}>
                    <span className={styles.productName}>{product.name}</span>
                    <span className={styles.productPrice}>{price.toLocaleString()} د.ع</span>
                    <span className={`${styles.productStock} ${stockCount <= 0 ? styles.outOfStock : ''}`}>
                      {stockCount > 0 ? `متوفر: ${stockCount}` : 'طلب مسبق'}
                    </span>
                  </div>

                  {cartItem ? (
                    <div className={styles.cardControls}>
                      <button 
                        type="button" 
                        className={styles.qtyBtnSmall} 
                        onClick={() => updateCartQuantity(product.id, cartItem.quantity - 1)}
                      >
                        -
                      </button>
                      <span className={styles.qtyValSmall}>{cartItem.quantity}</span>
                      <button 
                        type="button" 
                        className={styles.qtyBtnSmall} 
                        onClick={() => updateCartQuantity(product.id, cartItem.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="button" 
                      className={styles.addToCartBtn}
                      onClick={() => addToCart(product)}
                    >
                      إضافة للسلة 🛒
                    </button>
                  )}
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', width: '100%' }}>
                لا توجد منتجات مطابقة في هذه الفئة
              </div>
            )}
          </div>
        </div>

        {/* Cart Review List */}
        {cart.length > 0 && (
          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>🛒 السلة المحددة ({cart.length})</h2>
            <div className={styles.cartList}>
              {cart.map(item => (
                <div key={item.id} className={styles.cartItem}>
                  <div className={styles.cartItemInfo}>
                    <span className={styles.cartItemName}>{item.product.name}</span>
                    <span className={styles.cartItemPrice}>
                      {(item.unitPrice * item.quantity).toLocaleString()} د.ع
                    </span>
                  </div>
                  <div className={styles.cartControls}>
                    <button type="button" className={styles.qtyBtn} onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>-</button>
                    <span className={styles.qtyVal}>{item.quantity}</span>
                    <button type="button" className={styles.qtyBtn} onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>+</button>
                  </div>
                  <button type="button" className={styles.removeBtn} onClick={() => removeFromCart(item.id)}>✖</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Sticky Bottom Bar for Submission */}
      <div className={styles.bottomBar}>
        <div className={styles.totalAmountContainer}>
          <span className={styles.totalLabel}>المجموع الإجمالي</span>
          <div className={styles.totalInputWrapper}>
            <input 
              type="number"
              className={styles.totalInput}
              value={isTotalOverridden ? customTotalAmount : calculatedTotal}
              onChange={(e) => {
                setIsTotalOverridden(true);
                setCustomTotalAmount(e.target.value);
              }}
              placeholder="0"
            />
            <span className={styles.totalCurrency}>د.ع</span>
          </div>
        </div>
        <button 
          className={styles.submitBtn} 
          onClick={handleSubmit}
          disabled={isSubmitting || cart.length === 0}
        >
          {isSubmitting ? 'جاري الحفظ...' : 'تأكيد إرسال الطلب ✓'}
        </button>
      </div>

      {/* Success Modal */}
      {notificationModal.show && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalIcon}>✅</div>
            <div className={styles.modalText}>{notificationModal.message}</div>
            <button 
              className={styles.modalBtn}
              onClick={() => setNotificationModal({ show: false, message: '' })}
            >
              موافق
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default function MobileQuickEntry() {
  return (
    <Suspense fallback={
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <span>جاري التحضير...</span>
      </div>
    }>
      <QuickEntryContent />
    </Suspense>
  );
}
