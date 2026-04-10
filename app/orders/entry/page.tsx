"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { db } from '../../../lib/firebase';
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
  limit 
} from 'firebase/firestore';

interface Product {
  id: string;
  name: string;
  barcode: string;
  units: any[];
  stock: Record<string, { quantity: number; unit: string }>;
}

interface CartItem {
  id: string; // unique cart item id (usually product id)
  product: Product;
  quantity: number;
  unitPrice: number;
}

export default function OrderEntryPage() {
  // Form Data (Right side)
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    governorate: '',
    region: '',
    notes: '',
    paymentMethod: 'كاش عند التوصيل'
  });

  const [customerHistory, setCustomerHistory] = useState<{
    count: number;
    totalSpent: number;
    returns: number;
    deliveredCount: number;
    lastProfile?: any;
  } | null>(null);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [ordersMatches, setOrdersMatches] = useState<any[]>([]);

  const [customersDb, setCustomersDb] = useState<any[]>([]);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);

  const [showGovDropdown, setShowGovDropdown] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [notificationModal, setNotificationModal] = useState({ show: false, message: '' });

  const [baseProducts, setBaseProducts] = useState<Product[]>([]);
  const [compositeProductsData, setCompositeProductsData] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const governoratesList = [
    "بغداد", "البصرة", "نينوى (الموصل)", "أربيل", "النجف", "ذي قار (الناصرية)",
    "كركوك", "الأنبار (الرمادي)", "ديالى (بعقوبة)", "المثنى (السماوة)",
    "القادسية (الديوانية)", "ميسان (العمارة)", "واسط (الكوت)", "صلاح الدين (تكريت)",
    "دهوك", "السليمانية", "بابل (الحلة)", "كربلاء"
  ];

  // Fetch products from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setBaseProducts(pData);
    });
    return () => unsub();
  }, []);

  // Fetch employees
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(empData.filter((e: any) => e.isActive));
    });
    const savedEmpId = localStorage.getItem('selectedEmployeeId');
    if (savedEmpId) setSelectedEmployeeId(savedEmpId);
    return () => unsub();
  }, []);

  // Fetch composite products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'composite_products'), (snapshot) => {
      const cData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompositeProductsData(cData);
    });
    return () => unsub();
  }, []);

  // Fetch customers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomersDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch customer history when phone is 11 digits
  useEffect(() => {
    const phone = formData.customerPhone.trim();
    const name = formData.customerName.trim().toLowerCase();
    
    // Smart Lookup: If name matches an official record exactly, we treat it as identifying the customer.
    const officialMatch = customersDb.find(c => c.name.toLowerCase() === name);
    const searchPhone = officialMatch ? officialMatch.phone : (phone.length === 11 ? phone : null);

    if (searchPhone) {
      const fetchHistory = async () => {
        setIsSearchingHistory(true);
        try {
          // 1. Query Orders
          const qOrders = fsQuery(collection(db, 'orders'), where('customerPhone', '==', searchPhone));
          const snapOrders = await getDocs(qOrders);
          
          let count = 0;
          let totalSpent = 0;
          let returns = 0;
          let deliveredCount = 0;

          snapOrders.forEach(doc => {
            const data = doc.data();
            count++;
            if (data.status === 'delivered') {
              totalSpent += (data.totalAmount || 0);
              deliveredCount++;
            }
            if (data.status === 'cancelled' || data.status === 'returned') {
              returns++;
            }
          });

          // 2. Query Profile
          const qCust = fsQuery(collection(db, 'customers'), where('phone', '==', searchPhone));
          const snapCust = await getDocs(qCust);
          let lastProfile = null;
          if (!snapCust.empty) {
            lastProfile = snapCust.docs[0].data();
          }

          setCustomerHistory({ count, totalSpent, returns, deliveredCount, lastProfile });
        } catch (err) {
          console.error("Error fetching history:", err);
        } finally {
          setIsSearchingHistory(false);
        }
      };
      fetchHistory();
    } else {
      setCustomerHistory(null);
    }
  }, [formData.customerPhone, customersDb]);

  useEffect(() => {
    const phoneQuery = formData.customerPhone.trim();

    if (phoneQuery.length < 10) {
      setOrdersMatches([]);
      return;
    }

    const searchOrders = async () => {
      try {
        const matches: any[] = [];
        
        // Search by Phone ONLY
        const qPhone = fsQuery(
          collection(db, 'orders'), 
          where('customerPhone', '>=', phoneQuery), 
          where('customerPhone', '<=', phoneQuery + '\uf8ff'),
          limit(5)
        );
        const snapPhone = await getDocs(qPhone);
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

    const timer = setTimeout(searchOrders, 300); // Simple debounce
    return () => clearTimeout(timer);
  }, [formData.customerPhone]);

  // Merge products and dynamically calculate available bundles
  const products = React.useMemo(() => {
    const merged = [...baseProducts];
    
    compositeProductsData.forEach(cp => {
      // Calculate max available bundles
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
        barcode: '', // Currently composite products might not have barcodes
        units: [{ selling: cp.sellingPrice || 0, type: 'بكج' }],
        stock: { 'virtual_store': { quantity: minBundles, unit: 'بكج' } },
        isComposite: true,
        composition: cp.composition || []
      } as any);
    });
    
    return merged;
  }, [baseProducts, compositeProductsData]);

  // Form Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'customerPhone') {
      setShowPhoneDropdown(true);
    }
  };

  const handleSelectCustomer = (customer: any) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone,
      governorate: customer.province || '',
      region: customer.area || '',
      notes: customer.notes || prev.notes
    }));
    setShowPhoneDropdown(false);
    // History Effect will trigger automatically because phone matches
  };

  const handleAddReplaceNote = () => {
    setFormData(prev => {
      const tag = "استبدال هذا الطلب";
      const currentNotes = prev.notes || "";
      if (currentNotes.includes(tag)) return prev; // Avoid duplicates
      return {
        ...prev,
        notes: currentNotes ? `${currentNotes}\n${tag}` : tag
      };
    });
  };

  const applyHistoricalData = () => {
    if (customerHistory?.lastProfile) {
      const p = customerHistory.lastProfile;
      setFormData(prev => ({
        ...prev,
        customerName: p.name || prev.customerName,
        governorate: p.province || prev.governorate,
        region: p.area || prev.region,
        notes: p.notes || prev.notes
      }));
    } else if (customerHistory?.count && customerHistory.count > 0) {
       // If no profile in 'customers' collection, try to find an order with the same phone to get Name/Address
       // This is a fallback if the customer wasn't explicitly saved to the 'customers' collection.
       // However, the user mainly wants auto-fill from recognized data.
    }
  };



  const filteredCustomersByPhone = React.useMemo(() => {
    const phoneQuery = (formData.customerPhone || '').trim();
    if (phoneQuery.length < 10) return [];

    const list: any[] = [];
    const customersMatched = customersDb
      .filter(c => c.phone.includes(phoneQuery))
      .map(c => ({ ...c, source: 'customer' }));
    list.push(...customersMatched);

    ordersMatches.forEach(om => {
      if (om.phone.includes(phoneQuery) && !list.find(item => item.phone === om.phone)) {
        list.push(om);
      }
    });

    return list;
  }, [customersDb, ordersMatches, formData.customerPhone]);

  const isPhoneInvalid = (formData.customerPhone.length > 0 && formData.customerPhone.length !== 11) || 
                         (hasAttemptedSubmit && formData.customerPhone.length !== 11);

  const isFieldInvalid = (fieldName: keyof typeof formData) => {
    if (!hasAttemptedSubmit) return false;
    if (fieldName === 'notes') return false; // Optional
    if (fieldName === 'customerPhone') return isPhoneInvalid;
    return formData[fieldName].trim() === '';
  };

  const getInputClass = (fieldName: keyof typeof formData) => {
    return `${styles.input} ${isFieldInvalid(fieldName) ? styles.inputError : ''}`;
  };

  const hasGlobalError = hasAttemptedSubmit && (
    isFieldInvalid('customerName') ||
    isPhoneInvalid ||
    isFieldInvalid('governorate') ||
    isFieldInvalid('region')
  );

  // Cart Functions
  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        // Price strategy: use first unit selling price if available, else 0
        const price = (product.units && product.units.length > 0) ? product.units[0].selling : 0;
        return [...prev, { id: product.id, product, quantity: 1, unitPrice: price }];
      }
    });
    setSearchQuery('');
    setShowProductDropdown(false);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const updateQuantity = (id: string, newQty: number) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
  };

  const updateUnitPrice = (id: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, unitPrice: newPrice } : item));
  };

  const updateItemTotal = (id: string, newTotal: number) => {
    if (newTotal < 0) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, unitPrice: newTotal / item.quantity } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Search logic
  const filteredProducts = products.filter(p => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(query);
    const barcodeMatch = p.barcode?.toLowerCase() === query;
    return nameMatch || barcodeMatch;
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If exact barcode match, auto-add
      const exactMatch = products.find(p => p.barcode === searchQuery);
      if (exactMatch) {
         addToCart(exactMatch);
      } else if (filteredProducts.length === 1) {
         addToCart(filteredProducts[0]);
      }
    }
  };

  const handleKeyDownForm = (e: React.KeyboardEvent<HTMLInputElement>, nextFieldId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextField = document.getElementById(nextFieldId);
      if (nextField) nextField.focus();
    }
  };

  // Submit Logic with Batch Write
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    
    // Validation
    if (!selectedEmployeeId) {
      alert("يرجى اختيار الموظف مُدخل الطلب أولاً.");
      return;
    }

    if (
      formData.customerName.trim() === '' ||
      formData.customerPhone.length !== 11 ||
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
      const batch = writeBatch(db);
      const newOrderRef = doc(collection(db, 'orders'));

      const emp = employees.find(e => e.id === selectedEmployeeId);

      // 1. Save Order Document
      const orderData = {
        employeeId: selectedEmployeeId,
        employeeName: emp?.name || 'مجهول',
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        governorate: formData.governorate,
        region: formData.region,
        notes: formData.notes,
        paymentMethod: formData.paymentMethod,
        totalAmount: totalAmount,
        items: cart.map(item => {
          const p = item.product as any;
          return {
            productId: item.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            isComposite: p.isComposite || false,
            composition: p.composition || null
          };
        }),
        date: serverTimestamp(),
        status: 'pending' // Default status
      };

      batch.set(newOrderRef, orderData);

      // 2. Deduct Stock from Products
      for (const item of cart) {
        const productData = item.product as any;

        // --- Handle Composite Products (BOM) ---
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let stock = { ...rawData.stock };
              let remainingToDeduct = component.quantityNeeded * item.quantity;
              
              for (const storeId in stock) {
                if (remainingToDeduct <= 0) break;
                if (stock[storeId].quantity > 0) {
                  const deductAmount = Math.min(stock[storeId].quantity, remainingToDeduct);
                  stock[storeId].quantity -= deductAmount;
                  remainingToDeduct -= deductAmount;
                }
              }
              
              if (remainingToDeduct > 0) {
                const firstStoreKey = Object.keys(stock)[0];
                if (firstStoreKey) {
                  stock[firstStoreKey].quantity -= remainingToDeduct;
                } else {
                  stock['default_store'] = { quantity: -remainingToDeduct, unit: rawData.units?.[0]?.type || 'قطعة' };
                }
              }

              // Update totalBaseQuantity
              let newTotalBaseQuantity = 0;
              Object.values(stock).forEach((s: any) => {
                const uMul = rawData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
              });

              batch.update(rawProdRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
            }
          }
        } 
        // --- Handle Regular Products ---
        else {
          const prodRef = doc(db, 'products', item.product.id);
          const prodSnap = await getDoc(prodRef);
          
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let stock = { ...prodData.stock };
            let remainingToDeduct = item.quantity;

            // Attempt to deduct from available stores sequentially
            for (const storeId in stock) {
              if (remainingToDeduct <= 0) break;
              if (stock[storeId].quantity > 0) {
                const deductAmount = Math.min(stock[storeId].quantity, remainingToDeduct);
                stock[storeId].quantity -= deductAmount;
                remainingToDeduct -= deductAmount;
              }
            }

            // If there's still quantity to deduct, it means they oversold. 
            if (remainingToDeduct > 0) {
              const firstStoreKey = Object.keys(stock)[0];
              if (firstStoreKey) {
                stock[firstStoreKey].quantity -= remainingToDeduct;
              } else {
                 // Fallback if stock object was empty
                 stock['default_store'] = { quantity: -remainingToDeduct, unit: prodData.units?.[0]?.type || 'قطعة' };
              }
            }

            // Update totalBaseQuantity
            let newTotalBaseQuantity = 0;
            Object.values(stock).forEach((s: any) => {
              const uMul = prodData.units?.find((u: any) => u.type === s.unit)?.count || 1;
              newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
            });

            batch.update(prodRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
          }
        }
      }

      // Commit Batch
      await batch.commit();

      setNotificationModal({ show: true, message: 'تم حفظ الطلب وتحديث المخزون بنجاح!' });
      
      // Reset State
      setHasAttemptedSubmit(false);
      setFormData({
        customerName: '', 
        customerPhone: '', 
        governorate: '', 
        region: '', 
        notes: '',
        paymentMethod: 'كاش عند التوصيل'
      });
      setCart([]);
      setSearchQuery('');
      
    } catch (error) {
      console.error("Error creating order: ", error);
      alert("حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى.");
    }
  };

  return (
    <div className={styles.container}>
      
      <div className={styles.mainLayout}>
        <div className={`${styles.formSection} ${hasGlobalError ? styles.formWrapperError : ''}`}>
          <form onSubmit={handleSubmit}>
          
          <div className={styles.formGroup} style={{ marginBottom: '1.5rem', background: 'rgba(139, 92, 246, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <label className={styles.label} style={{ color: '#c4b5fd' }}>الموظف مُدخل الطلب *</label>
            <select 
              className={styles.input}
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

          <div className={styles.formGroup}>
            <label className={styles.label}>اسم الزبون</label>
            <input 
              id="customerName"
              type="text" 
              name="customerName"
              className={getInputClass('customerName')}
              value={formData.customerName}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDownForm(e, 'customerPhone')}
              autoComplete="off"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>هاتف الزبون</label>
            <div className={styles.searchableSelectContainer}>
              <div className={styles.inputWrapper}>
                <input 
                  id="customerPhone"
                  type="text" 
                  name="customerPhone"
                  className={getInputClass('customerPhone')} 
                  value={formData.customerPhone}
                  onChange={handleChange}
                  onFocus={() => setShowPhoneDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPhoneDropdown(false), 200)}
                  onKeyDown={(e) => handleKeyDownForm(e, 'governorate')}
                  autoComplete="off"
                />
                {isPhoneInvalid && (
                  <span className={styles.errorMessage}>يجب أن يتكون رقم الهاتف من 11 رقماً</span>
                )}
              </div>
              {showPhoneDropdown && formData.customerPhone.trim().length >= 10 && filteredCustomersByPhone.length > 0 && (
                <ul className={styles.dropdownList}>
                  {filteredCustomersByPhone.length > 0 ? (
                    filteredCustomersByPhone.map((customer: any) => (
                    <li 
                      key={customer.id} 
                      className={styles.dropdownItem}
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <div className={styles.customerRow}>
                        <div className={styles.customerMain}>
                          <span className={styles.custName}>{customer.name}</span>
                          <span className={styles.custPhone}>{customer.phone}</span>
                        </div>
                        <div className={styles.customerBadges}>
                          {customer.source === 'customer' ? (
                            <span className={`${styles.sourceBadge} ${styles.badgeRecord}`}>سجل</span>
                          ) : (
                            <span className={`${styles.sourceBadge} ${styles.badgeOrder}`}>أرشيف</span>
                          )}
                          {customer.tag && <span className={styles.custTag}>({customer.tag})</span>}
                        </div>
                      </div>
                    </li>
                    ))
                  ) : (
                    <li className={styles.dropdownItem} style={{ color: 'var(--text-muted)' }}>لا توجد نتائج مطابقة في سجل العملاء</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>المحافظة</label>
            <div className={styles.searchableSelectContainer}>
              <input 
                id="governorate"
                type="text" 
                name="governorate"
                className={getInputClass('governorate')} 
                value={formData.governorate}
                onChange={(e) => {
                  handleChange(e);
                  setShowGovDropdown(true);
                }}
                onFocus={() => setShowGovDropdown(true)}
                onBlur={() => setTimeout(() => setShowGovDropdown(false), 200)}
                onKeyDown={(e) => handleKeyDownForm(e, 'region')}
                placeholder="اختر المحافظة أو اكتب للبحث"
                autoComplete="off"
              />
              <span className={styles.selectArrow}>▼</span>
              
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
                  {governoratesList.filter(gov => gov.includes(formData.governorate)).length === 0 && (
                    <li className={styles.dropdownItem} style={{ color: 'var(--text-muted)' }}>لا توجد نتائج مطابقة</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>المنطقة</label>
            <input 
              id="region"
              type="text" 
              name="region"
              className={getInputClass('region')} 
              value={formData.region}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDownForm(e, 'notes')}
            />
          </div>

          {/* New auto-calculated Total Amount */}
          <div className={styles.formGroup}>
            <label className={styles.label}>المبلغ الكلي (دينار)</label>
            <input 
              type="text" 
              className={styles.readOnlyInput} 
              value={`${new Intl.NumberFormat('en-US').format(totalAmount)} د.ع`}
              readOnly
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>طريقة الدفع</label>
            <select 
              name="paymentMethod"
              className={styles.input}
              value={formData.paymentMethod}
              onChange={handleChange}
            >
              <option value="كاش عند التوصيل">كاش عند التوصيل</option>
              <option value="حوالة زين كاش">حوالة زين كاش</option>
              <option value="حوالة بنكية">حوالة بنكية</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelWithAction}>
              <label className={styles.label}>ملاحظات الطلب</label>
              <button 
                type="button" 
                className={styles.replaceBtn}
                onClick={handleAddReplaceNote}
              >
                🔄 استبدال
              </button>
            </div>
            <textarea 
              name="notes"
              className={styles.textarea} 
              value={formData.notes}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div className={styles.submitBtnContainer}>
            <button type="submit" className={styles.submitBtn}>
              حفظ الطلب
            </button>
            <Link href="/orders/list" className={styles.secondaryBtn}>
              جميع الطلبات
            </Link>
          </div>

          </form>
        </div>

        {/* Customer Info Card (Left of the form) */}
        {customerHistory && (
          <div className={styles.customerInfoCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>👤</span>
              <h3>معلومات الزبون</h3>
            </div>
            
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)' }}>📦</span>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>إجمالي الطلبات</span>
                  <span className={styles.statValue}>{customerHistory.count}</span>
                </div>
              </div>

              <div className={styles.statItem}>
                <span className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)' }}>✅</span>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>ناجحة</span>
                  <span className={`${styles.statValue} ${styles.successText}`}>{customerHistory.deliveredCount}</span>
                </div>
              </div>
              
              <div className={styles.statItem}>
                <span className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.1)' }}>❌</span>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>راجعة</span>
                  <span className={`${styles.statValue} ${styles.failText}`}>{customerHistory.returns}</span>
                </div>
              </div>

              <div className={styles.statItem}>
                <span className={styles.statIcon} style={{ background: 'rgba(251, 191, 36, 0.1)' }}>📈</span>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>نسبة الاستلام</span>
                  <span className={styles.statValue} style={{ color: '#fbbf24' }}>
                    {customerHistory.count > 0 
                      ? Math.round((customerHistory.deliveredCount / customerHistory.count) * 100) 
                      : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.totalSpentSection}>
               <span className={styles.statLabel}>إجمالي الإنفاق (المستلم)</span>
               <span className={styles.totalSpentValue}>{new Intl.NumberFormat('en-US').format(customerHistory.totalSpent)} د.ع</span>
            </div>

            {customerHistory.returns > 0 && (
              <div className={styles.returnWarning}>
                <span className={styles.warningIcon}>⚠️</span>
                <span>تحذير: لديه {customerHistory.returns} طلبات مرتجعة سابقاً!</span>
              </div>
            )}

            {customerHistory.lastProfile && (
              <div className={styles.autoFillPrompt}>
                <p>هل تود تعبئة البيانات تلقائياً؟</p>
                <button 
                  type="button" 
                  className={styles.autoFillBtn}
                  onClick={applyHistoricalData}
                >
                  نعم، تعبئة الآن ✨
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LEFT COLUMN: CART (POS UI) */}
      <div className={styles.cartSection}>
        <div className={styles.cartHeaderContainer}>
          <div className={styles.cartTitleBg}>سلة الزبون</div>
        </div>

        <div className={styles.productSearchContainer}>
          <input 
            type="text" 
            ref={searchInputRef}
            className={styles.productSearchInput}
            placeholder="ابحث عن صنف أو امسح الباركود..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
          />
          <span className={styles.searchIcon}>🔍</span>

          {showProductDropdown && searchQuery && (
            <ul className={styles.dropdownList} style={{ top: 'calc(100% - 1.5rem)', left: '1.5rem', right: '1.5rem' }}>
              {filteredProducts.map(p => (
                <li key={p.id} className={styles.dropdownItem} onClick={() => addToCart(p)}>
                  <strong>{p.name}</strong> {p.barcode && <small style={{color: 'var(--text-muted)'}}>({p.barcode})</small>}
                </li>
              ))}
              {filteredProducts.length === 0 && (
                <li className={styles.dropdownItem} style={{ color: 'var(--text-muted)' }}>لا توجد منتجات مطابقة</li>
              )}
            </ul>
          )}
        </div>

        <div className={styles.cartItemsContainer}>
          {cart.length > 0 ? (
            <table className={styles.cartTable}>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>السعر المفرد</th>
                  <th>الإجمالي</th>
                  <th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold' }}>{item.product.name}</td>
                    <td>
                      <div className={styles.qtyControl}>
                        <button type="button" className={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                        <input 
                          type="number" 
                          className={styles.qtyInput} 
                          value={item.quantity} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            updateQuantity(item.id, val);
                          }}
                        />
                        <button type="button" className={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                      </div>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className={styles.priceInput} 
                        value={new Intl.NumberFormat('en-US').format(item.unitPrice)} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                          updateUnitPrice(item.id, val);
                        }}
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className={styles.priceInput} 
                        value={`${new Intl.NumberFormat('en-US').format(item.quantity * item.unitPrice)} د.ع`} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/,/g, '').replace(' د.ع', '')) || 0;
                          updateItemTotal(item.id, val);
                        }}
                        style={{ color: '#10B981', fontWeight: 'bold' }}
                      />
                    </td>
                    <td>
                      <button type="button" className={styles.deleteBtn} onClick={() => removeFromCart(item.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyCart}>
              <div className={styles.emptyCartIcon}>🛒</div>
              <p>السلة فارغة. ابحث عن أصناف لإضافتها.</p>
            </div>
          )}
        </div>
      </div>

      {notificationModal.show && (
        <div className={styles.modalOverlay}>
          <div className={styles.notificationModal}>
            <div className={styles.notificationContent}>
              <p>{notificationModal.message}</p>
              <button 
                className={styles.notificationBtn} 
                onClick={() => setNotificationModal({ show: false, message: '' })}
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
