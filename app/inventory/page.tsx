"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, runTransaction, serverTimestamp, query, orderBy } from 'firebase/firestore';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'logs'>('stock');
  const [products, setProducts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [categoriesDb, setCategoriesDb] = useState<any[]>([]);
  const [pagesDb, setPagesDb] = useState<any[]>([]);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  
  // Form State
  const [adjustmentType, setAdjustmentType] = useState<'inbound' | 'adjustment'>('inbound');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(pData);
    });
    return () => unsub();
  }, []);

  // Fetch Stores
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stores'), (snapshot) => {
      const sData = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setStores(sData);
    });
    return () => unsub();
  }, []);

  // Fetch Inventory Logs
  useEffect(() => {
    const q = query(collection(db, 'inventory_logs'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const lData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(lData);
    });
    return () => unsub();
  }, []);

  // Fetch Categories & Pages
  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategoriesDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubPages = onSnapshot(collection(db, 'pages_stores'), (snapshot) => {
      setPagesDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubCats();
      unsubPages();
    };
  }, []);

  const openUpdateModal = (product: any) => {
    setSelectedProduct(product);
    setAdjustmentType('inbound');
    setSelectedStoreId('');
    setQuantity('');
    setReason('');
    setEmployeeName('');
    setShowModal(true);
  };

  const handleUpdateStock = async () => {
    if (!selectedProduct || !quantity || isNaN(Number(quantity))) {
      alert('يرجى التأكد من إدخال كمية صحيحة');
      return;
    }

    if (!selectedStoreId) {
      alert('يرجى اختيار المخزن المستهدف');
      return;
    }
    
    const qtyNum = Number(quantity);
    if (qtyNum <= 0 && adjustmentType === 'inbound') {
      alert('يجب أن تكون الكمية الواردة أكبر من صفر');
      return;
    }
    if (qtyNum < 0 && adjustmentType === 'adjustment') {
      alert('لا يمكن أن يكون المخزون الفعلي بالسالب');
      return;
    }

    if (!employeeName.trim()) {
      alert('يرجى إدخال اسم الموظف المسؤول');
      return;
    }

    setIsSubmitting(true);
    try {
      const productRef = doc(db, 'products', selectedProduct.id);
      const logRef = doc(collection(db, 'inventory_logs'));

      await runTransaction(db, async (transaction) => {
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) {
          throw new Error("المنتج غير موجود في قاعدة البيانات!");
        }

        const productData = productDoc.data();
        const currentStockMap = productData.stock || {};
        
        // Get unit for the store stock entry (default to product's first unit type if available)
        const firstUnitType = (productData.units && productData.units.length > 0)
          ? productData.units[0].type
          : 'قطعة';

        const storeStock = currentStockMap[selectedStoreId] || { quantity: 0, reserved: 0, unit: firstUnitType };
        const previousStoreQty = storeStock.quantity || 0;
        let newStoreQty = previousStoreQty;

        if (adjustmentType === 'inbound') {
          newStoreQty = previousStoreQty + qtyNum;
        } else if (adjustmentType === 'adjustment') {
          newStoreQty = qtyNum;
        }

        // Build updated stock map
        const updatedStockMap = {
          ...currentStockMap,
          [selectedStoreId]: {
            ...storeStock,
            quantity: newStoreQty
          }
        };

        // Recalculate totalBaseQuantity as the sum of all store quantities
        let newTotalBaseQuantity = 0;
        Object.values(updatedStockMap).forEach((s: any) => {
          newTotalBaseQuantity += (s.quantity || 0);
        });

        // Update product document in Firestore
        transaction.update(productRef, {
          stock: updatedStockMap,
          totalBaseQuantity: newTotalBaseQuantity
        });

        // Get store name for logging
        const storeName = stores.find(s => s.id === selectedStoreId)?.name || 'مخزن غير محدد';

        // Write inventory log
        transaction.set(logRef, {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          type: adjustmentType,
          quantity: qtyNum,
          previous_stock: productData.totalBaseQuantity || 0,
          new_stock: newTotalBaseQuantity,
          reason: `${reason.trim() || 'تسوية جرد دورية'} (${storeName})`,
          user_name: employeeName.trim(),
          created_at: serverTimestamp()
        });
      });

      alert('تم تحديث المخزون بنجاح وتسجيل الحركة في السجل!');
      setShowModal(false);
    } catch (error: any) {
      console.error("Transaction failed: ", error);
      alert('حدث خطأ أثناء التحديث: ' + (error.message || 'خطأ غير معروف'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ar-IQ', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>إدارة المخازن والجرد</h1>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'stock' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          📦 المخزون الحالي
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'logs' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📜 سجل حركات المخزن
        </button>
      </div>

      <main>
        {activeTab === 'stock' && (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>الصنف</th>
                  <th>الباركود</th>
                  <th>المخزون الحالي</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredProducts = products.filter(prod => {
                    const pNameClean = prod.name?.trim().toLowerCase();
                    if (!pNameClean) return false;

                    const isPageName = pagesDb.some(page => page.name?.trim().toLowerCase() === pNameClean);
                    if (isPageName) return false;

                    const isMainCatName = categoriesDb.some(cat => cat.name?.trim().toLowerCase() === pNameClean);
                    if (isMainCatName) return false;

                    const isSubCatName = categoriesDb.some(cat => 
                      cat.subcategories?.some((sub: any) => sub.name?.trim().toLowerCase() === pNameClean)
                    );
                    if (isSubCatName) return false;

                    return true;
                  });

                  if (filteredProducts.length === 0) {
                    return (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>جاري تحميل البيانات...</td>
                      </tr>
                    );
                  }

                  return filteredProducts.map((prod, index) => (
                    <tr key={prod.id}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: 'bold' }}>{prod.name}</td>
                      <td>{prod.barcode || '---'}</td>
                      <td style={{ color: '#10B981', fontWeight: 'bold', fontSize: '1.1rem' }}>
                        {prod.totalBaseQuantity || 0}
                      </td>
                      <td>
                        <button 
                          className={styles.updateButton}
                          onClick={() => openUpdateModal(prod)}
                        >
                          <span>🔄</span> تحديث المخزون
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>الصنف</th>
                  <th>نوع الحركة</th>
                  <th>الكمية المدخلة</th>
                  <th>الرصيد السابق</th>
                  <th>الرصيد الجديد</th>
                  <th>الموظف</th>
                  <th>السبب / الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد حركات مخزنية مسجلة</td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    let badgeClass = styles.badge;
                    let typeLabel = log.type;
                    
                    if (log.type === 'inbound') {
                      badgeClass += ` ${styles.badgeInbound}`;
                      typeLabel = 'بضاعة واردة';
                    } else if (log.type === 'outbound') {
                      badgeClass += ` ${styles.badgeOutbound}`;
                      typeLabel = 'بضاعة صادرة';
                    } else if (log.type === 'adjustment') {
                      badgeClass += ` ${styles.badgeAdjustment}`;
                      typeLabel = 'تسوية جرد (تعديل)';
                    } else if (log.type === 'return') {
                       badgeClass += ` ${styles.badgeInbound}`;
                       typeLabel = 'مرتجع';
                    }

                    return (
                      <tr key={log.id}>
                        <td style={{ color: 'var(--text-muted)' }}>{formatDate(log.created_at)}</td>
                        <td style={{ fontWeight: 'bold' }}>{log.product_name}</td>
                        <td><span className={badgeClass}>{typeLabel}</span></td>
                        <td style={{ fontWeight: 'bold' }}>{log.quantity}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{log.previous_stock}</td>
                        <td style={{ fontWeight: 'bold', color: '#3b82f6' }}>{log.new_stock}</td>
                        <td>{log.user_name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{log.reason}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Update Stock Modal */}
      {showModal && selectedProduct && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>تحديث مخزون: <span style={{ color: '#8b5cf6' }}>{selectedProduct.name}</span></h2>
              <button className={styles.closeButton} onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>نوع التعديل</label>
                <select 
                  className={styles.select}
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as any)}
                >
                  <option value="inbound">إضافة بضاعة واردة (تُجمع مع الرصيد الحالي)</option>
                  <option value="adjustment">تسوية جرد يدوي (تُستبدل الرصيد الحالي)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>المخزن المستهدف</label>
                <select 
                  className={styles.select}
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                >
                  <option value="">-- اختر المخزن --</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  {adjustmentType === 'inbound' ? 'الكمية الواردة' : 'المخزون الفعلي الجديد'}
                </label>
                <input 
                  type="number" 
                  className={styles.input}
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>اسم الموظف المسؤول</label>
                <input 
                  type="text" 
                  className={styles.input}
                  placeholder="مثال: أحمد"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>السبب أو الملاحظات</label>
                <textarea 
                  className={styles.textarea}
                  placeholder="اكتب سبب التسوية أو تفاصيل البضاعة الواردة..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                إلغاء
              </button>
              <button 
                className={styles.saveButton}
                onClick={handleUpdateStock}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ الحركة واعتماد المخزون'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
