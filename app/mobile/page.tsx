"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../lib/firebase";
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
}

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
}

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entry'>('dashboard');
  
  // Dashboard states
  const [orders, setOrders] = useState<any[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [todayOrdersCount, setTodayOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
  const [baseProducts, setBaseProducts] = useState<Product[]>([]);
  const [compositeProductsData, setCompositeProductsData] = useState<any[]>([]);
  const [customersDb, setCustomersDb] = useState<any[]>([]);
  const [ordersMatches, setOrdersMatches] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [showGovDropdown, setShowGovDropdown] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [notificationModal, setNotificationModal] = useState({ show: false, message: '' });

  const governoratesList = [
    "بغداد", "البصرة", "نينوى (الموصل)", "أربيل", "النجف", "ذي قار (الناصرية)",
    "كركوك", "الأنبار (الرمادي)", "ديالى (بعقوبة)", "المثنى (السماوة)",
    "القادسية (الديوانية)", "ميسان (العمارة)", "واسط (الكوت)", "صلاح الدين (تكريت)",
    "دهوك", "السليمانية", "بابل (الحلة)", "كربلاء"
  ];

  // Fetch dashboard stats & orders
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders'), (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(allOrders);

      // Compute statistics
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      let salesToday = 0;
      let countToday = 0;
      let activeCount = 0;

      allOrders.forEach((order: any) => {
        const orderTime = order.date?.toDate ? order.date.toDate().getTime() : new Date(order.date).getTime();
        
        // Today's stats
        if (orderTime >= startOfToday) {
          countToday++;
          if (order.status === 'delivered' || order.status === 'partial') {
            salesToday += Number(order.totalAmount) || 0;
          }
        }

        // Active orders count
        if (order.status !== 'delivered' && order.status !== 'partial' && order.status !== 'cancelled') {
          activeCount++;
        }
      });

      setTodaySales(salesToday);
      setTodayOrdersCount(countToday);
      setActiveOrdersCount(activeCount);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Fetch employees
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'employees'), (snapshot) => {
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(empData.filter((e: any) => e.isActive));
    });
    const savedEmpId = localStorage.getItem('selectedEmployeeId');
    if (savedEmpId) setSelectedEmployeeId(savedEmpId);
    return () => unsub();
  }, []);

  // Fetch base products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'), (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setBaseProducts(pData);
    });
    return () => unsub();
  }, []);

  // Fetch composite products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'composite_products'), (snapshot) => {
      const cData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompositeProductsData(cData);
    });
    return () => unsub();
  }, []);

  // Fetch customers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'customers'), (snapshot) => {
      setCustomersDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Phone search for auto-fill matching
  useEffect(() => {
    const phoneQuery = formData.customerPhone.trim();
    if (phoneQuery.length < 10) {
      setOrdersMatches([]);
      return;
    }
    const searchOrders = async () => {
      try {
        const qPhone = fsQuery(
          collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders'), 
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
            source: 'order'
          });
        });
        setOrdersMatches(matches);
      } catch (err) {
        console.error("Phone search error:", err);
      }
    };
    const timer = setTimeout(searchOrders, 300);
    return () => clearTimeout(timer);
  }, [formData.customerPhone]);

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
        composition: cp.composition || []
      } as any);
    });
    return merged;
  }, [baseProducts, compositeProductsData]);

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

  const handleAddReplaceNote = () => {
    const tag = "استبدال هذا الطلب";
    setFormData(prev => ({
      ...prev,
      notes: prev.notes.includes(tag) ? prev.notes : prev.notes ? `${prev.notes}\n${tag}` : tag
    }));
  };

  const filteredCustomersByPhone = React.useMemo(() => {
    const phoneQuery = formData.customerPhone.trim();
    if (phoneQuery.length < 10) return [];
    const list: any[] = [];
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
  }, [customersDb, ordersMatches, formData.customerPhone]);

  const isValidPhoneNumber = (phone: string) => {
    return /^(\+?\d{10,15})$/.test(phone.replace(/\s+/g, ''));
  };

  const isPhoneInvalid = hasAttemptedSubmit && !isValidPhoneNumber(formData.customerPhone);

  const isFieldInvalid = (fieldName: keyof typeof formData) => {
    if (!hasAttemptedSubmit) return false;
    if (fieldName === 'notes' || fieldName === 'fbLoginId') return false;
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
    setSearchQuery('');
    setShowProductDropdown(false);
  };

  const updateCartQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const filteredProductsSearch = productsList.filter(p => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    return p.name?.toLowerCase().includes(query) || p.barcode?.toLowerCase() === query;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    if (!selectedEmployeeId) {
      alert("يرجى اختيار الموظف مُدخل الطلب أولاً.");
      return;
    }

    if (
      formData.customerName.trim() === '' ||
      !isValidPhoneNumber(formData.customerPhone) ||
      formData.governorate.trim() === '' ||
      formData.region.trim() === ''
    ) {
      alert("يرجى التأكد من ملء جميع الحقول الإلزامية في بيانات الزبون.");
      return;
    }

    if (cart.length === 0) {
      alert("سلة المشتريات فارغة!");
      return;
    }

    try {
      // Generate sequential transaction numeric ID
      const counterRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'metadata', 'orderCounter');
      const counterSnap = await getDoc(counterRef);
      let currentId = 100000;
      if (counterSnap.exists()) {
        currentId = counterSnap.data().lastId;
      }
      const nextId = currentId + 1;

      const batch = writeBatch(db);
      batch.set(counterRef, { lastId: nextId }, { merge: true });
      const newOrderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', nextId.toString());
      const emp = employees.find(empItem => empItem.id === selectedEmployeeId);

      let isOrderBackordered = false;

      // Check stock availability
      for (const item of cart) {
        const productData = item.product as any;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', component.itemId);
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
          const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', item.product.id);
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

      const orderData = {
        employeeId: selectedEmployeeId,
        employeeName: emp?.name || 'مجهول',
        customerName: formData.customerName,
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
            const rawProdRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', component.itemId);
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
          const prodRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'products', item.product.id);
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

      setNotificationModal({ show: true, message: 'تم حفظ الطلب وتحديث المخزون بنجاح!' });
      
      // Reset
      setHasAttemptedSubmit(false);
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
      setSearchQuery('');

    } catch (err) {
      console.error("Submit order error:", err);
      alert("حدث خطأ أثناء حفظ الطلب. يرجى المحاولة لاحقاً.");
    }
  };

  const selectedEmployeeName = employees.find(e => e.id === selectedEmployeeId)?.name || 'لم يختر موظف';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#94a3b8', background: '#0d0d12' }}>
        <span>جاري التحميل...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>منصة منسا - الجوال</h1>
        <div className={styles.employeeBadge} title={selectedEmployeeName}>
          👤 {selectedEmployeeName}
        </div>
      </header>

      {/* Main Tab Screen */}
      {activeTab === 'dashboard' ? (
        <div className={styles.dashboardTab}>
          {/* Top Quick Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>💵</div>
              <span className={styles.statLabel}>مبيعات اليوم (الواصلة)</span>
              <span className={styles.statValue}>{todaySales.toLocaleString()} د.ع</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>📦</div>
              <span className={styles.statLabel}>الطلبات النشطة الكلية</span>
              <span className={styles.statValue}>{activeOrdersCount} طلب</span>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard} style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <div>
                  <span className={styles.statLabel}>إجمالي مسجلات اليوم</span>
                  <span className={styles.statValue} style={{ display: 'block', fontSize: '1.5rem', marginTop: '0.25rem' }}>
                    {todayOrdersCount}
                  </span>
                </div>
                <div className={styles.statIcon} style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', width: '50px', height: '50px' }}>🛒</div>
              </div>
            </div>
          </div>

          {/* Recent Orders List */}
          <div className={styles.bigCard}>
            <h3 className={styles.cardTitle}>🕒 آخر الإدخالات والطلبات</h3>
            <div className={styles.orderList}>
              {orders.slice(0, 10).map((ord) => (
                <div key={ord.id} className={styles.orderItem}>
                  <div className={styles.orderLeft}>
                    <span className={styles.custName}>{ord.customerName}</span>
                    <span className={styles.orderMeta}>
                      {ord.customerPhone} | {ord.governorate}
                    </span>
                  </div>
                  <div className={styles.orderRight}>
                    <span className={styles.orderAmount}>
                      {Number(ord.totalAmount || 0).toLocaleString()} د.ع
                    </span>
                    <span className={`${styles.badge} ${styles[ord.status] || styles.pending}`}>
                      {ord.status === 'delivered' ? 'واصل' :
                       ord.status === 'partial' ? 'واصل جزئي' :
                       ord.status === 'returned' ? 'راجع' :
                       ord.status === 'returned_agent' ? 'راجع بحوزة مندوب' :
                       ord.status === 'returned_warehouse' ? 'راجع مستلم بالمخزن' :
                       ord.status === 'cancelled' ? 'ملغي' :
                       ord.status === 'backordered' ? 'بانتظار المخزون' :
                       ord.status === 'in_progress' ? 'قيد التنفيذ' : 'قيد الانتظار'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.formTab}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* Employee Selector */}
            <div className={styles.formGroup}>
              <label className={styles.label}>الموظف مُدخل الطلب *</label>
              <select 
                className={styles.select}
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  localStorage.setItem('selectedEmployeeId', e.target.value);
                }}
                required
              >
                <option value="">-- اختر اسمك --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            {/* Customer Name */}
            <div className={styles.formGroup}>
              <input 
                type="text" 
                name="customerName"
                className={`${styles.input} ${isFieldInvalid('customerName') ? styles.inputError : ''}`}
                value={formData.customerName}
                onChange={handleFormChange}
                placeholder="اسم الزبون *"
                required
                autoComplete="off"
              />
            </div>

            {/* Customer Phone */}
            <div className={styles.formGroup}>
              <div className={styles.searchableSelectContainer}>
                <input 
                  type="text" 
                  name="customerPhone"
                  className={`${styles.input} ${isPhoneInvalid ? styles.inputError : ''}`}
                  value={formData.customerPhone}
                  onChange={handleFormChange}
                  onFocus={() => setShowPhoneDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPhoneDropdown(false), 250)}
                  placeholder="رقم هاتف الزبون *"
                  required
                  autoComplete="off"
                />
                {showPhoneDropdown && formData.customerPhone.trim().length >= 10 && filteredCustomersByPhone.length > 0 && (
                  <ul className={styles.dropdownList}>
                    {filteredCustomersByPhone.map((customer: any) => (
                      <li 
                        key={customer.id} 
                        className={styles.dropdownItem}
                        onClick={() => handleSelectCustomer(customer)}
                      >
                        <div className={styles.customerRow}>
                          <div className={styles.customerMain}>
                            <span style={{ fontWeight: 'bold' }}>{customer.name}</span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{customer.phone}</span>
                          </div>
                          <span className={`${styles.badge} ${customer.source === 'customer' ? styles.delivered : styles.pending}`}>
                            {customer.source === 'customer' ? 'سجل' : 'أرشيف'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Customer Phone 2 */}
            <div className={styles.formGroup}>
              <input 
                type="text" 
                name="customerPhone2"
                className={styles.input}
                value={formData.customerPhone2}
                onChange={handleFormChange}
                placeholder="رقم هاتف ثاني للزبون (اختياري)"
                autoComplete="off"
              />
            </div>

            {/* Governorate */}
            <div className={styles.formGroup}>
              <div className={styles.searchableSelectContainer}>
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
                  onBlur={() => setTimeout(() => setShowGovDropdown(false), 250)}
                  placeholder="المحافظة *"
                  required
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

            {/* Region */}
            <div className={styles.formGroup}>
              <input 
                type="text" 
                name="region"
                className={`${styles.input} ${isFieldInvalid('region') ? styles.inputError : ''}`}
                value={formData.region}
                onChange={handleFormChange}
                placeholder="المنطقة / العنوان بالتفصيل *"
                required
              />
            </div>

            {/* Product Cart Addition Section */}
            <div className={styles.cartSection}>
              <label className={styles.label}>🛒 سلة المنتجات للطلب</label>
              <div className={styles.searchableSelectContainer}>
                <input 
                  type="text" 
                  placeholder="🔍 ابحث باسم المنتج أو باركود..."
                  className={styles.input}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 250)}
                />
                {showProductDropdown && searchQuery.trim().length > 0 && (
                  <ul className={styles.dropdownList}>
                    {filteredProductsSearch.map(product => {
                      const price = product.units?.[0]?.selling || 0;
                      return (
                        <li 
                          key={product.id} 
                          className={styles.dropdownItem}
                          onClick={() => addToCart(product)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{product.name}</span>
                            <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>{price.toLocaleString()} د.ع</span>
                          </div>
                        </li>
                      );
                    })}
                    {filteredProductsSearch.length === 0 && (
                      <li className={styles.dropdownItem} style={{ color: '#94a3b8' }}>لا توجد منتجات مطابقة</li>
                    )}
                  </ul>
                )}
              </div>

              {/* Display items in Cart */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {cart.map(item => (
                  <div key={item.id} className={styles.cartItem}>
                    <div className={styles.cartItemInfo}>
                      <span className={styles.cartItemName}>{item.product.name}</span>
                      <span className={styles.cartItemPrice}>
                        {item.unitPrice.toLocaleString()} د.ع × {item.quantity}
                      </span>
                    </div>
                    <div className={styles.cartQtyControls}>
                      <button type="button" className={styles.qtyBtn} onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>-</button>
                      <span style={{ fontWeight: 'bold' }}>{item.quantity}</span>
                      <button type="button" className={styles.qtyBtn} onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>+</button>
                      <button type="button" className={styles.removeCartBtn} onClick={() => removeFromCart(item.id)}>✖</button>
                    </div>
                  </div>
                ))}
                {cart.length > 0 && (
                  <div className={styles.totalRow}>
                    <span>المجموع الإجمالي:</span>
                    <span>{totalAmount.toLocaleString()} د.ع</span>
                  </div>
                )}
              </div>
            </div>



            {/* Payment Method */}
            <div className={styles.formGroup}>
              <label className={styles.label}>طريقة الدفع</label>
              <select 
                name="paymentMethod"
                className={styles.select}
                value={formData.paymentMethod}
                onChange={handleFormChange}
              >
                <option value="كاش عند التوصيل">كاش عند التوصيل</option>
                <option value="حوالة زين كاش">حوالة زين كاش</option>
                <option value="حوالة بنكية">حوالة بنكية</option>
              </select>
            </div>

            {/* Notes */}
            <div className={styles.formGroup}>
              <div className={styles.label} style={{ justifyContent: 'flex-end' }}>
                <button type="button" className={styles.replaceBtn} onClick={handleAddReplaceNote}>
                  🔄 استبدال
                </button>
              </div>
              <textarea 
                name="notes"
                className={styles.textarea}
                value={formData.notes}
                onChange={handleFormChange}
                rows={3}
                placeholder="ملاحظات الطلب..."
              />
            </div>

            <button type="submit" className={styles.submitBtn}>
              💾 حفظ الطلب وإرساله
            </button>
          </form>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className={styles.bottomNav}>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.navActive : ''}`}
        >
          <span className={styles.navIconText}>📊</span>
          <span>لوحة التحكم</span>
        </button>
        <button 
          onClick={() => setActiveTab('entry')}
          className={`${styles.navItem} ${activeTab === 'entry' ? styles.navActive : ''}`}
        >
          <span className={styles.navIconText}>🛒</span>
          <span>إدخال طلب</span>
        </button>
      </nav>

      {/* Confirmation Modal */}
      {notificationModal.show && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
            <h3>تم بنجاح</h3>
            <p>{notificationModal.message}</p>
            <button 
              className={styles.modalBtn} 
              onClick={() => setNotificationModal({ show: false, message: '' })}
            >
              حسناً
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
