"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { db } from '../../../lib/firebase';
import { collection, onSnapshot, doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';

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
    notes: ''
  });

  const [showGovDropdown, setShowGovDropdown] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [notificationModal, setNotificationModal] = useState({ show: false, message: '' });

  // POS State (Left side)
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
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
      setProducts(pData);
    });
    return () => unsub();
  }, []);

  // Form Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

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

      // 1. Save Order Document
      const orderData = {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        governorate: formData.governorate,
        region: formData.region,
        notes: formData.notes,
        totalAmount: totalAmount,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice
        })),
        date: serverTimestamp(),
        status: 'pending' // Default status
      };

      batch.set(newOrderRef, orderData);

      // 2. Deduct Stock from Products
      for (const item of cart) {
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
          // We can optionally force one store into negative, or leave it. We'll deduct from the first store available or create one.
          if (remainingToDeduct > 0) {
            const firstStoreKey = Object.keys(stock)[0];
            if (firstStoreKey) {
              stock[firstStoreKey].quantity -= remainingToDeduct;
            } else {
               // Fallback if stock object was empty
               stock['default_store'] = { quantity: -remainingToDeduct, unit: prodData.units?.[0]?.type || 'قطعة' };
            }
          }

          batch.update(prodRef, { stock });
        }
      }

      // Commit Batch
      await batch.commit();

      setNotificationModal({ show: true, message: 'تم حفظ الطلب وتحديث المخزون بنجاح!' });
      
      // Reset State
      setHasAttemptedSubmit(false);
      setFormData({
        customerName: '', customerPhone: '', governorate: '', region: '', notes: ''
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
      
      {/* RIGHT COLUMN: FORM (Appears right in RTL because it is first in DOM) */}
      <div className={`${styles.formSection} ${hasGlobalError ? styles.formWrapperError : ''}`}>
        <form onSubmit={handleSubmit}>
          
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
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>هاتف الزبون</label>
            <div className={styles.inputWrapper}>
              <input 
                id="customerPhone"
                type="text" 
                name="customerPhone"
                className={getInputClass('customerPhone')} 
                value={formData.customerPhone}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDownForm(e, 'governorate')}
              />
              {isPhoneInvalid && (
                <span className={styles.errorMessage}>يجب أن يتكون رقم الهاتف من 11 رقماً</span>
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
            <label className={styles.label}>الملاحظات</label>
            <input 
              id="notes"
              type="text" 
              name="notes"
              className={styles.input} 
              value={formData.notes}
              onChange={handleChange}
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
