"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  writeBatch, 
  doc, 
  getDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import styles from './page.module.css';
import Link from 'next/link';

export default function SalesReturnsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isScannerMode, setIsScannerMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const barcodeBufferRef = useRef<string>('');

  // Fetch Delivered Orders
  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'delivered'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter Logic
  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      const s = searchTerm.toLowerCase();
      if (!s) return true;
      
      const idStr = order.id.toLowerCase();
      const phone = (order.customerPhone || order.phone || '').toString().toLowerCase();
      const name = (order.customerName || '').toLowerCase();
      
      return idStr.includes(s) || phone.includes(s) || name.includes(s);
    });
  }, [orders, searchTerm]);

  // Toast Handler
  const addToast = (msg: string) => {
    setToasts(prev => [...prev, msg]);
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 3000);
  };

  // Barcode Scanner Event Listener
  useEffect(() => {
    if (!isScannerMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field (just in case they have one)
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter') {
        const scanned = barcodeBufferRef.current.trim().toLowerCase();
        if (scanned) {
          processScannedBarcode(scanned);
        }
        barcodeBufferRef.current = '';
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScannerMode, orders]);

  const processScannedBarcode = (scanned: string) => {
    // Try to find exact match or last 6 characters
    const foundOrder = orders.find(o => 
      o.id.toLowerCase() === scanned || 
      o.id.slice(-6).toLowerCase() === scanned
    );

    if (foundOrder) {
      if (!selectedOrderIds.includes(foundOrder.id)) {
        setSelectedOrderIds(prev => [...prev, foundOrder.id]);
        addToast(`✅ تم العثور على الطلبية #${foundOrder.id.slice(-6).toUpperCase()}`);
        setLastScannedId(foundOrder.id);
      } else {
        addToast(`⚠️ الطلبية محددة مسبقاً`);
      }
    } else {
      addToast(`❌ لم يتم العثور على طلبية بالرقم: ${scanned}`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  const handleCheckboxChange = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
    );
  };

  const handleBulkReturnTrigger = () => {
    if (selectedOrderIds.length === 0 || isProcessing) return;
    setShowConfirmModal(true);
  };

  const executeBulkReturn = async () => {
    setShowConfirmModal(false);
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const selectedOrdersData = orders.filter(o => selectedOrderIds.includes(o.id));

      for (const orderData of selectedOrdersData) {
        const orderRef = doc(db, 'orders', orderData.id);
        
        // 1. Update order status
        batch.update(orderRef, { status: 'returned' });

        // 2. Create record in sales_returns
        const returnRef = doc(collection(db, 'sales_returns'));
        batch.set(returnRef, {
          orderId: orderData.id,
          customerName: orderData.customerName,
          totalAmount: orderData.totalAmount || 0,
          returnDate: serverTimestamp(),
          processedBy: 'الماسح الضوئي / نظام المرتجعات'
        });

        // 3. Restore Stock
        if (orderData.items && orderData.items.length > 0) {
          for (const item of orderData.items) {
            // Re-fetch product to get latest and for security (though batch uses refs)
            // Note: Batch cannot read. In a real-world high-concurrency app, this might need a Transaction.
            // But for simple stock restoration in this context, we follow the previous pattern.
            
            if (item.isComposite && item.composition) {
              for (const comp of item.composition) {
                const prodRef = doc(db, 'products', comp.itemId);
                const prodSnap = await getDoc(prodRef); // We must read to calculate new stock
                if (prodSnap.exists()) {
                  const pData = prodSnap.data();
                  let stock = { ...pData.stock };
                  let qtyToReturn = comp.quantityNeeded * item.quantity;
                  
                  const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                  if (!stock[firstStoreKey]) {
                    stock[firstStoreKey] = { quantity: qtyToReturn, unit: pData.units?.[0]?.type || 'قطعة' };
                  } else {
                    stock[firstStoreKey].quantity += qtyToReturn;
                  }

                  let totalBase = 0;
                  Object.values(stock).forEach((s: any) => {
                    const uMul = pData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                    totalBase += (Number(s.quantity) || 0) * uMul;
                  });

                  batch.update(prodRef, { stock, totalBaseQuantity: totalBase });
                }
              }
            } else {
              const prodRef = doc(db, 'products', item.productId || item.id);
              const prodSnap = await getDoc(prodRef);
              if (prodSnap.exists()) {
                const pData = prodSnap.data();
                let stock = { ...pData.stock };
                let qtyToReturn = item.quantity;

                const firstStoreKey = Object.keys(stock)[0] || 'default_store';
                if (!stock[firstStoreKey]) {
                  stock[firstStoreKey] = { quantity: qtyToReturn, unit: pData.units?.[0]?.type || 'قطعة' };
                } else {
                  stock[firstStoreKey].quantity += qtyToReturn;
                }

                let totalBase = 0;
                Object.values(stock).forEach((s: any) => {
                  const uMul = pData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                  totalBase += (Number(s.quantity) || 0) * uMul;
                });

                batch.update(prodRef, { stock, totalBaseQuantity: totalBase });
              }
            }
          }
        }
      }

      await batch.commit();
      addToast(`🔥 تمت عملية الإرجاع بنجاح لـ ${selectedOrderIds.length} طلبات!`);
      setSelectedOrderIds([]);
    } catch (err) {
      console.error("Bulk Return Error:", err);
      alert("حدث خطأ أثناء معالجة المرتجعات.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>↩️ مرتجعات المبيعات</h1>
          <p style={{ color: '#adb5bd', marginTop: '5px' }}>قم بمسح الباركود للطلبات الواصلة لتحويلها إلى مرتجع وإعادة المواد للمخزن.</p>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <input 
              type="text" 
              placeholder="ابحث برقم الطلب أو الهاتف..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button 
            className={`${styles.scannerToggle} ${isScannerMode ? styles.active : ''}`}
            onClick={() => setIsScannerMode(!isScannerMode)}
            title={isScannerMode ? "تعطيل الماسح الضوئي" : "تفعيل الماسح الضوئي"}
          >
            <span>{isScannerMode ? '🟢 الماسح نشط' : '⚪ الماسح معطل'}</span>
          </button>

          {selectedOrderIds.length > 0 && (
            <button className={styles.bulkActionBtn} onClick={handleBulkReturnTrigger} disabled={isProcessing}>
              {isProcessing ? 'جاري المعالجة...' : `تأكيد إرجاع (${selectedOrderIds.length}) طلبات للمخزن`}
            </button>
          )}
        </div>
      </header>

      <div className={styles.tableSection}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '50px' }}>
                <input 
                  type="checkbox" 
                  className={styles.checkbox}
                  checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>رقم الطلب</th>
              <th>تاريخ الطلب</th>
              <th>الزبون</th>
              <th>المبلغ</th>
              <th>الحالة الحالية</th>
              <th>المحتويات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>جاري التحميل...</td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>لا توجد طلبات تطابق بحثك حالياً.</td></tr>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.id);
                const isMatched = lastScannedId === order.id;
                const formattedDate = order.date instanceof Timestamp ? order.date.toDate().toLocaleDateString('en-GB') : '---';
                
                return (
                  <tr key={order.id} className={`${isSelected ? styles.selected : ''} ${isMatched ? styles.matched : ''}`}>
                    <td>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={isSelected}
                        onChange={() => handleCheckboxChange(order.id)}
                      />
                    </td>
                    <td style={{ fontWeight: 'bold', color: '#8b5cf6' }}>#{order.id.slice(-6).toUpperCase()}</td>
                    <td>{formattedDate}</td>
                    <td>{order.customerName}</td>
                    <td style={{ fontWeight: 'bold' }}>{new Intl.NumberFormat('en-US').format(order.totalAmount || 0)}</td>
                    <td>
                      <span className={styles.badge} style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                        واصل (مكتمل)
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                      {(order.items || []).map((i: any) => i.productName).join(', ')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.toastContainer}>
        {toasts.map((toast, idx) => (
          <div key={idx} className={styles.toast}>
            {toast}
          </div>
        ))}
      </div>

      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.modalIcon}>⚠️</div>
            <h3>تأكيد عملية الإرجاع</h3>
            <p>هل أنت متأكد من إرجاع <strong>{selectedOrderIds.length}</strong> طلبات إلى المخزن؟ سيتم تحديث الكميات وحالة الطلبات فوراً.</p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowConfirmModal(false)}>إلغاء</button>
              <button className={styles.confirmBtn} onClick={executeBulkReturn}>تأكيد الإرجاع</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
