"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { db } from '../../lib/firebase';
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
  totalBaseQuantity?: number;
}

interface Supplier {
  id: string;
  name: string;
  company: string;
  currentDebt: number;
  phone: string;
}

interface Store {
  id: string;
  name: string;
}

interface CartItem {
  cartId: string;
  product: Product;
  quantity: number;
  costPrice: number;
  unit: string;
}

export default function PurchaseInvoicePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [cashPaid, setCashPaid] = useState(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initial Fetches
  useEffect(() => {
    // Suppliers
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Supplier[]);
    });

    // Stores
    const unsubStores = onSnapshot(collection(db, 'stores'), (snap) => {
      setStores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Store[]);
    });

    // Products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
    });

    // Generate Invoice Number
    setInvoiceNumber('PUR-' + Math.floor(Math.random() * 1000000));

    return () => {
      unsubSuppliers();
      unsubStores();
      unsubProducts();
    };
  }, []);

  const addToCart = (product: Product) => {
    const defaultUnit = product.units?.[0]?.name || 'قطع';
    const newItem: CartItem = {
      cartId: Math.random().toString(36).substr(2, 9),
      product,
      quantity: 1,
      costPrice: 0,
      unit: defaultUnit
    };
    setCart([...cart, newItem]);
    setSearchQuery('');
    setShowProductDropdown(false);
  };

  const updateCartItem = (cartId: string, fields: Partial<CartItem>) => {
    setCart(cart.map(item => item.cartId === cartId ? { ...item, ...fields } : item));
  };

  const removeFromCart = (cartId: string) => {
    setCart(cart.filter(item => item.cartId !== cartId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
  const debtAmount = Math.max(0, totalAmount - cashPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !selectedStoreId || cart.length === 0) {
      alert("الرجاء اختيار مورد ومخزن وإضافة أصناف للفاتورة");
      return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);

    try {
      // 1. Create Purchase Record
      const purchaseRef = doc(collection(db, 'purchases'));
      batch.set(purchaseRef, {
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        storeId: selectedStoreId,
        date: invoiceDate,
        invoiceNumber,
        items: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.unit,
          costPrice: item.costPrice,
          subtotal: item.quantity * item.costPrice
        })),
        totalAmount,
        cashPaid,
        debtAmount,
        createdAt: serverTimestamp()
      });

      // 2. Update Inventory (Products)
      for (const item of cart) {
        const prodRef = doc(db, 'products', item.product.id);
        const prodSnap = await getDoc(prodRef);
        const prodData = prodSnap.data();

        if (prodData) {
          // Calculate base quantity to ADD
          const unitObj = item.product.units.find(u => u.name === item.unit);
          const multiplier = unitObj ? (unitObj.multiplier || 1) : 1;
          const baseQtyToAdd = item.quantity * multiplier;

          const currentStock = prodData.stock || {};
          const storeStock = currentStock[selectedStoreId] || { quantity: 0, unit: 'قطع' };
          
          // Update totalBaseQuantity and store-specific stock
          const newTotalBase = (prodData.totalBaseQuantity || 0) + baseQtyToAdd;
          const newStoreQty = (storeStock.quantity || 0) + baseQtyToAdd;

          batch.update(prodRef, {
            totalBaseQuantity: newTotalBase,
            [`stock.${selectedStoreId}.quantity`]: newStoreQty
          });
        }
      }

      // 3. Update Supplier Debt and record detailed transactions
      const supplierRef = doc(db, 'suppliers', selectedSupplier.id);
      let runningDebt = selectedSupplier.currentDebt || 0;

      // Transaction A: The Purchase (Increases Debt)
      const purchaseTransRef = doc(collection(db, 'supplierTransactions'));
      runningDebt += totalAmount;
      batch.set(purchaseTransRef, {
        supplierId: selectedSupplier.id,
        date: serverTimestamp(),
        type: 'purchase',
        amount: totalAmount,
        balanceAfter: runningDebt,
        notes: `فاتورة شراء رقم: ${invoiceNumber}`
      });

      // Transaction B: The Cash Payment (Decreases Debt)
      if (cashPaid > 0) {
        const paymentTransRef = doc(collection(db, 'supplierTransactions'));
        runningDebt -= cashPaid;
        batch.set(paymentTransRef, {
          supplierId: selectedSupplier.id,
          date: serverTimestamp(),
          type: 'payment',
          amount: cashPaid,
          balanceAfter: runningDebt,
          notes: `دفعة نقدية للفاتورة رقم: ${invoiceNumber}`
        });
      }

      // Update the supplier's final snapshot
      batch.update(supplierRef, { currentDebt: runningDebt });

      await batch.commit();
      setLastInvoiceId(purchaseRef.id);
      setShowSuccessModal(true);
      
      // Reset form
      setCart([]);
      setCashPaid(0);
      setSelectedSupplier(null);
      setInvoiceNumber('PUR-' + Math.floor(Math.random() * 1000000));
    } catch (error) {
      console.error("Error submitting purchase:", error);
      alert("حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.barcode?.includes(searchQuery)
  );

  return (
    <div className={styles.container}>
      <main className={styles.mainSection}>
        <div className={styles.card}>
          <div className={styles.searchHeader}>
            <h2 className={styles.title}>📦 محتويات الفاتورة</h2>
            <div className={styles.searchBox}>
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="بحث عن منتج (اسم أو باركود)..." 
                className={styles.searchInput}
                value={searchQuery}
                onFocus={() => setShowProductDropdown(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className={styles.searchIcon}>🔍</span>
              
              {showProductDropdown && searchQuery && (
                <div className={styles.productDropdown}>
                  {filteredProducts.map(p => (
                    <div key={p.id} className={styles.productItem} onClick={() => addToCart(p)}>
                      <span>{p.name}</span>
                      <small style={{ opacity: 0.5 }}>{p.barcode || 'بدون باركود'}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
            {cart.length > 0 ? (
              <table className={styles.cartTable}>
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th style={{ width: '120px' }}>الوحدة</th>
                    <th style={{ width: '100px' }}>سعر الشراء</th>
                    <th style={{ width: '100px' }}>الكمية</th>
                    <th style={{ width: '120px' }}>المجموع</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.cartId}>
                      <td style={{ fontWeight: 600 }}>{item.product.name}</td>
                      <td>
                        <select 
                          className={styles.unitSelect} 
                          value={item.unit}
                          onChange={(e) => updateCartItem(item.cartId, { unit: e.target.value })}
                        >
                          {item.product.units.map(u => (
                            <option key={u.name} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input 
                          type="number" 
                          className={styles.priceInput} 
                          value={item.costPrice} 
                          onChange={(e) => updateCartItem(item.cartId, { costPrice: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          className={styles.qtyInput} 
                          value={item.quantity} 
                          onChange={(e) => updateCartItem(item.cartId, { quantity: parseFloat(e.target.value) || 1 })}
                        />
                      </td>
                      <td style={{ color: '#10b981', fontWeight: 800 }}>
                        {(item.quantity * item.costPrice).toLocaleString()} د.ع
                      </td>
                      <td>
                        <button className={styles.removeBtn} onClick={() => removeFromCart(item.cartId)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📦</div>
                <p>لم يتم إضافة أي أصناف بعد. ابحث عن منتج للبدء.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <aside className={styles.invoiceInfo}>
        <div className={styles.card}>
          <h2 className={styles.title} style={{ marginBottom: '1.5rem' }}>📄 بيانات الفاتورة</h2>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>المورد</label>
            <select 
                className={styles.select} 
                value={selectedSupplier?.id || ''}
                onChange={(e) => {
                    const s = suppliers.find(sup => sup.id === e.target.value);
                    setSelectedSupplier(s || null);
                }}
            >
              <option value="">إختر المورد</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.company})</option>
              ))}
            </select>
            {selectedSupplier && (
                <div className={styles.supplierDebtBadge}>الدين الحالي: {selectedSupplier.currentDebt?.toLocaleString()} د.ع</div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>المخزن المستلم</label>
            <select className={styles.select} value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}>
              <option value="">إختر المخزن</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>تاريخ الفاتورة</label>
            <input type="date" className={styles.input} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>رقم الفاتورة</label>
            <input type="text" className={styles.input} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>

          <div className={styles.totals}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>إجمالي الفاتورة</span>
              <span className={styles.totalValue}>{totalAmount.toLocaleString()} د.ع</span>
            </div>
            
            <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>المبلغ المدفوع (Cash)</label>
              <input 
                type="number" 
                className={styles.input} 
                style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}
                value={cashPaid}
                onChange={(e) => setCashPaid(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className={`${styles.totalRow} ${styles.debtRow}`}>
              <span className={styles.totalLabel}>المتبقي (دين)</span>
              <span className={styles.debtValue}>{debtAmount.toLocaleString()} د.ع</span>
            </div>
          </div>

          <button 
            className={styles.saveBtn} 
            style={{ marginTop: '1.5rem' }}
            onClick={handleSubmit}
            disabled={isSubmitting || cart.length === 0}
          >
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ الفاتورة ✅'}
          </button>
        </div>
      </aside>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <div className={styles.modalIcon}>🎉</div>
                <h2 className={styles.modalTitle}>تم حفظ الفاتورة بنجاح!</h2>
                <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>تم تحديث المخزون وحساب المورد بشكل صحيح.</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button className={styles.modalBtn} onClick={() => setShowSuccessModal(false)}>فاتورة جديدة ➕</button>
                    <button className={styles.cancelButton} onClick={() => window.location.href = '/suppliers'}>كشف حساب المورد 📑</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
