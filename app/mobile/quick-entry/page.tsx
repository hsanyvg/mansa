"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
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

export default function MobileQuickEntry() {
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
  
  // UI states
  const [showProductDropdown, setShowProductDropdown] = useState(false);
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
      setLoading(false);
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
    if (fieldName === 'notes' || fieldName === 'fbLoginId' || fieldName === 'customerPhone2') return false;
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
      // Small alert for invalid form
      return;
    }

    if (cart.length === 0) {
      alert("سلة المشتريات فارغة!");
      return;
    }

    setIsSubmitting(true);

    try {
      const counterRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'metadata', 'orderCounter');
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

      setNotificationModal({ show: true, message: '✨ تم حفظ الطلب بنجاح!' });
      
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedEmployeeName = employees.find(e => e.id === selectedEmployeeId)?.name || 'الرجاء اختيار الموظف';

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
        <h1 className={styles.title}>إدخال سريع ⚡</h1>
        <div className={styles.employeeBadge} title={selectedEmployeeName}>
          <span>👤 {selectedEmployeeName}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.mainContent}>
        
        {/* Employee Selection */}
        {!selectedEmployeeId && (
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

        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>👤 بيانات الزبون</h2>
          
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
              {showPhoneDropdown && formData.customerPhone.trim().length >= 10 && filteredCustomersByPhone.length > 0 && (
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
            <input 
              type="text" 
              name="customerName"
              className={`${styles.input} ${isFieldInvalid('customerName') ? styles.inputError : ''}`}
              value={formData.customerName}
              onChange={handleFormChange}
              placeholder="الاسم الكامل *"
              autoComplete="off"
            />
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

          {/* Optional Info Dropdown toggle could go here, for now keep it simple */}
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
              placeholder="ملاحظات الطلب (اختياري)..."
            />
          </div>
        </div>

        {/* Cart Section */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>🛒 المنتجات المطلوبة</h2>
          
          <div className={styles.dropdownContainer}>
            <div className={styles.searchContainer}>
              <input 
                type="text" 
                placeholder="ابحث عن منتج بالاسم أو الباركود..."
                className={`${styles.input} ${styles.searchInput}`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 250)}
              />
              <span className={styles.searchIcon}>🔍</span>
            </div>
            
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{product.name}</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>{price.toLocaleString()}</span>
                      </div>
                    </li>
                  );
                })}
                {filteredProductsSearch.length === 0 && (
                  <li className={styles.dropdownItem} style={{ color: '#94a3b8', textAlign: 'center' }}>لا توجد نتائج مطابقة</li>
                )}
              </ul>
            )}
          </div>

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
            
            {cart.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                السلة فارغة حالياً
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Sticky Bottom Bar for Submission */}
      <div className={styles.bottomBar}>
        <div className={styles.totalAmountContainer}>
          <span className={styles.totalLabel}>المجموع الإجمالي</span>
          <span className={styles.totalValue}>{totalAmount.toLocaleString()} د.ع</span>
        </div>
        <button 
          className={styles.submitBtn} 
          onClick={handleSubmit}
          disabled={isSubmitting || cart.length === 0}
        >
          {isSubmitting ? 'جاري الحفظ...' : 'تأكيد الطلب ✓'}
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
